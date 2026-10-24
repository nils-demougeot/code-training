"""Execution harness shared by the in-browser engine (Pyodide) and the local runner.

Entry point: ``run(payload_json) -> result_json``.

Payload modes:
  - "run":  execute ``code`` and return stdout, the value of a trailing expression,
            matplotlib figures and a cleaned traceback.
  - "test": execute ``code`` (user) and ``solution`` (reference) in separate namespaces,
            then evaluate every test case and compare results.
  - "eval": flashcard check — evaluate the user's answer and the reference answer
            after a shared ``setup`` and compare them strictly.
"""

import ast
import base64
import contextlib
import io
import json
import linecache
import math
import sys
import time
import traceback
import types

MAX_OUTPUT = 20_000
REPR_LIMIT = 1_200
USER_FILE = "<main>"


# --------------------------------------------------------------------------- helpers

def _truncate(text, limit=MAX_OUTPUT):
    if len(text) > limit:
        return text[:limit] + f"\n… (sortie tronquée, {len(text) - limit} caractères en plus)"
    return text


def _module_of(x):
    return type(x).__module__ or ""


def _is_numpy(x):
    return _module_of(x).startswith("numpy")


def _is_pandas(x):
    return _module_of(x).startswith("pandas")


def _is_torch(x):
    return _module_of(x).startswith("torch")


def _repr(x, limit=REPR_LIMIT):
    try:
        if _is_numpy(x) and hasattr(x, "shape") and getattr(x, "ndim", 0) > 0:
            np = sys.modules["numpy"]
            body = np.array2string(x, threshold=200, precision=4, suppress_small=True)
            text = f"{body}  # shape={x.shape}, dtype={x.dtype}"
        elif _is_pandas(x) and hasattr(x, "to_string"):
            text = x.to_string(max_rows=20, max_cols=12)
            text += f"\n# {type(x).__name__} shape={x.shape}"
        elif _is_torch(x) and hasattr(x, "shape"):
            text = f"{x!r}  # shape={tuple(x.shape)}"
        else:
            text = repr(x)
    except Exception:  # pragma: no cover - defensive
        text = object.__repr__(x)
    if len(text) > limit:
        text = text[:limit] + " …"
    return text


def _clean_traceback(exc):
    """Keep only the frames that come from the user's code."""
    tb = traceback.TracebackException.from_exception(exc)
    frames = [f for f in tb.stack if f.filename == USER_FILE]
    lines = []
    if frames:
        lines.append("Traceback (most recent call last):")
        for f in frames:
            lines.append(f'  Ligne {f.lineno}, dans {f.name}')
            if f.line:
                lines.append(f"    {f.line.strip()}")
    lines.extend(line.rstrip("\n") for line in tb.format_exception_only())
    return "\n".join(lines)


def _error_line(exc):
    tb = exc.__traceback__
    line = None
    while tb is not None:
        if tb.tb_frame.f_code.co_filename == USER_FILE:
            line = tb.tb_lineno
        tb = tb.tb_next
    if line is None and isinstance(exc, SyntaxError) and exc.filename == USER_FILE:
        line = exc.lineno
    return line


def _collect_figures():
    plt_mod = sys.modules.get("matplotlib.pyplot")
    if plt_mod is None:
        return []
    figures = []
    for num in plt_mod.get_fignums():
        fig = plt_mod.figure(num)
        buf = io.BytesIO()
        fig.savefig(buf, format="png", dpi=110, bbox_inches="tight", facecolor="white")
        figures.append(base64.b64encode(buf.getvalue()).decode("ascii"))
    plt_mod.close("all")
    return figures


def _new_namespace():
    return {"__name__": "__main__", "__builtins__": __builtins__}


def _register_source(source, filename):
    """Lets tracebacks show the offending line and makes inspect.getsource() work."""
    linecache.cache[filename] = (len(source), None, source.splitlines(True), filename)


def _exec(source, ns, filename=USER_FILE):
    _register_source(source, filename)
    exec(compile(source, filename, "exec"), ns)


# --------------------------------------------------------------------------- comparison

def _close(a, b, rtol, atol):
    try:
        return math.isclose(float(a), float(b), rel_tol=rtol, abs_tol=atol) or (
            math.isnan(float(a)) and math.isnan(float(b))
        )
    except (TypeError, ValueError, OverflowError):
        return a == b


def compare(got, expected, *, strict=False, rtol=1e-5, atol=1e-6, unordered=False):
    """Return (equal: bool, reason: str | None)."""
    if _is_torch(got) and hasattr(got, "detach"):
        got = got.detach().cpu().numpy()
    if _is_torch(expected) and hasattr(expected, "detach"):
        expected = expected.detach().cpu().numpy()

    # pandas -----------------------------------------------------------------
    if _is_pandas(expected) and hasattr(expected, "shape"):
        pd = sys.modules["pandas"]
        if type(got) is not type(expected):
            return False, f"type attendu {type(expected).__name__}, obtenu {type(got).__name__}"
        try:
            if isinstance(expected, pd.DataFrame):
                pd.testing.assert_frame_equal(
                    got, expected, check_dtype=strict, check_exact=False, rtol=rtol, atol=atol
                )
            elif isinstance(expected, pd.Series):
                pd.testing.assert_series_equal(
                    got, expected, check_dtype=strict, check_exact=False, rtol=rtol, atol=atol,
                    check_names=strict,
                )
            else:
                pd.testing.assert_index_equal(got, expected, exact=strict)
        except AssertionError as err:
            msg = str(err).strip().splitlines()
            return False, " ".join(m.strip() for m in msg[:4])
        return True, None

    # numpy arrays -------------------------------------------------------------
    if _is_numpy(expected) and hasattr(expected, "shape") and getattr(expected, "ndim", 0) > 0:
        np = sys.modules["numpy"]
        if not hasattr(got, "shape") or not hasattr(got, "dtype"):
            if strict or not isinstance(got, (list, tuple)):
                return False, f"un np.ndarray était attendu, obtenu {type(got).__name__}"
            got = np.asarray(got)
        if got.shape != expected.shape:
            return False, f"shape attendue {expected.shape}, obtenue {got.shape}"
        if strict and got.dtype != expected.dtype:
            return False, f"dtype attendu {expected.dtype}, obtenu {got.dtype}"
        if expected.dtype.kind in "fc" or got.dtype.kind in "fc":
            ok = np.allclose(got, expected, rtol=rtol, atol=atol, equal_nan=True)
        else:
            ok = np.array_equal(got, expected)
        return (True, None) if ok else (False, "valeurs différentes")

    # numpy scalars & plain numbers --------------------------------------------
    num_types = (int, float)
    if _is_numpy(expected) and hasattr(expected, "item"):
        expected = expected.item()
    if _is_numpy(got) and hasattr(got, "item") and getattr(got, "ndim", 0) == 0:
        got = got.item()
    if isinstance(expected, bool) or isinstance(got, bool):
        if type(got) is not type(expected):
            return False, f"type attendu {type(expected).__name__}, obtenu {type(got).__name__}"
        return (got == expected, None if got == expected else "valeurs différentes")
    if isinstance(expected, num_types) and isinstance(got, num_types):
        if strict and type(got) is not type(expected):
            return False, f"type attendu {type(expected).__name__}, obtenu {type(got).__name__}"
        if isinstance(expected, float) or isinstance(got, float):
            return (True, None) if _close(got, expected, rtol, atol) else (False, "valeurs différentes")
        return (True, None) if got == expected else (False, "valeurs différentes")

    # containers -----------------------------------------------------------------
    if isinstance(expected, (list, tuple)):
        if not isinstance(got, (list, tuple)) or (strict and type(got) is not type(expected)):
            return False, f"type attendu {type(expected).__name__}, obtenu {type(got).__name__}"
        if type(got) is not type(expected) and not unordered:
            return False, f"type attendu {type(expected).__name__}, obtenu {type(got).__name__}"
        if len(got) != len(expected):
            return False, f"longueur attendue {len(expected)}, obtenue {len(got)}"
        if unordered:
            try:
                got, expected = sorted(got), sorted(expected)
            except TypeError:
                pass
        for i, (g, e) in enumerate(zip(got, expected)):
            ok, reason = compare(g, e, strict=strict, rtol=rtol, atol=atol)
            if not ok:
                return False, f"élément [{i}] : {reason}"
        return True, None
    if isinstance(expected, dict):
        if not isinstance(got, dict):
            return False, f"type attendu dict, obtenu {type(got).__name__}"
        if set(got.keys()) != set(expected.keys()):
            missing = set(expected) - set(got)
            extra = set(got) - set(expected)
            parts = []
            if missing:
                parts.append(f"clés manquantes {sorted(map(repr, missing))}")
            if extra:
                parts.append(f"clés en trop {sorted(map(repr, extra))}")
            return False, ", ".join(parts)
        for k in expected:
            ok, reason = compare(got[k], expected[k], strict=strict, rtol=rtol, atol=atol)
            if not ok:
                return False, f"clé {k!r} : {reason}"
        return True, None
    if isinstance(expected, (set, frozenset)):
        if not isinstance(got, (set, frozenset)):
            return False, f"type attendu {type(expected).__name__}, obtenu {type(got).__name__}"
        return (True, None) if got == expected else (False, "éléments différents")

    if strict and type(got) is not type(expected):
        return False, f"type attendu {type(expected).__name__}, obtenu {type(got).__name__}"
    try:
        equal = bool(got == expected)
    except Exception as err:
        return False, f"comparaison impossible : {err}"
    return (True, None) if equal else (False, "valeurs différentes")


# --------------------------------------------------------------------------- modes

class _ShowExpressions(ast.NodeTransformer):
    """Wraps each top-level expression statement so its value is displayed, like a notebook
    cell but for every line (``f(3)`` alone on a line shows its result, no print needed)."""

    def visit_Module(self, node):
        body = []
        for stmt in node.body:
            if isinstance(stmt, ast.Expr) and not (
                isinstance(stmt.value, ast.Constant) and isinstance(stmt.value.value, str)
            ):
                call = ast.Call(
                    func=ast.Name(id="__ct_show__", ctx=ast.Load()),
                    args=[stmt.value, ast.Constant(stmt.lineno)],
                    keywords=[],
                )
                stmt = ast.copy_location(ast.Expr(value=call), stmt)
            body.append(stmt)
        node.body = body
        return ast.fix_missing_locations(node)


def _displayable(value):
    if value is None:
        return False
    module = _module_of(value)
    if module.startswith("matplotlib"):
        return False
    if isinstance(value, (list, tuple)) and value and _module_of(value[0]).startswith("matplotlib"):
        return False
    return True


def _mode_run(payload):
    """Runs the code, displays the value of every top-level expression, then evaluates the
    optional ``examples`` (calls of the user's functions) and shows their results."""
    code = payload.get("code", "")
    setup = payload.get("setup") or ""
    examples = payload.get("examples") or []
    ns = _new_namespace()
    out = io.StringIO()
    shown = []  # (stdout offset, line, repr)

    def show(value, line):
        if _displayable(value):
            shown.append((out.tell(), line, _repr(value, 4_000)))
        return value

    ns["__ct_show__"] = show
    result = {
        "ok": True, "stdout": "", "value": None, "error": None, "errorLine": None, "figures": [],
        "segments": [], "examples": [],
    }
    start = time.perf_counter()
    with contextlib.redirect_stdout(out), contextlib.redirect_stderr(out):
        try:
            if setup:
                _exec(setup, ns, "<setup>")
            _register_source(code, USER_FILE)
            tree = _ShowExpressions().visit(ast.parse(code, USER_FILE))
            exec(compile(tree, USER_FILE, "exec"), ns)
        except BaseException as exc:  # noqa: BLE001 - we report everything to the user
            if isinstance(exc, KeyboardInterrupt):
                raise
            result["ok"] = False
            result["error"] = _clean_traceback(exc)
            result["errorLine"] = _error_line(exc)

    text = out.getvalue()
    segments, cursor = [], 0
    for offset, line, value in shown:
        if offset > cursor:
            segments.append({"kind": "stdout", "text": _truncate(text[cursor:offset], 10_000)})
        segments.append({"kind": "value", "line": line, "text": value})
        cursor = offset
    if cursor < len(text):
        segments.append({"kind": "stdout", "text": _truncate(text[cursor:], 10_000)})
    result["segments"] = segments
    result["stdout"] = _truncate(text)

    if result["ok"]:
        for call in examples:
            entry = {"call": call}
            try:
                value, printed = _eval_expr(call, ns)
                entry["value"] = _repr(value, 2_000)
                if printed:
                    entry["stdout"] = _truncate(printed, 2_000)
            except BaseException as exc:  # noqa: BLE001
                if isinstance(exc, KeyboardInterrupt):
                    raise
                entry["error"] = _clean_traceback(exc)
            result["examples"].append(entry)

    result["figures"] = _collect_figures()
    result["durationMs"] = round((time.perf_counter() - start) * 1000, 1)
    return result


def growth_exponent(func, make_input, n0=500, max_n=1 << 21, target=0.15, budget=3.0):
    """Empirical complexity: times ``func(*make_input(n))`` for n = n0, 2·n0, 4·n0… and returns
    the exponent k of the best fit t ∝ n^k between the last two sizes (≈1 for O(n), ≈2 for O(n²)).
    Machine-independent (it is a ratio) and time-boxed by ``budget`` seconds."""
    import gc

    def timed(args):
        t0 = time.perf_counter()
        func(*args)
        return time.perf_counter() - t0

    points, inputs, total, n = [], [], 0.0, n0
    gc_was_enabled = gc.isenabled()
    gc.disable()
    try:
        while n <= max_n:
            args = make_input(n)
            best = None
            for _ in range(3):
                elapsed = timed(args)
                best = elapsed if best is None else min(best, elapsed)
                total += elapsed
                if elapsed > 0.2 or total > budget:
                    break
            points.append([n, best])
            inputs = (inputs + [args])[-2:]
            if (best >= target and len(points) >= 2) or total > budget:
                break
            n *= 2
        # A single noisy sample on the last size skews the ratio: re-time the last two sizes
        # alternately and keep each minimum, so background noise hits both sides alike.
        if len(points) >= 2:
            for _ in range(2):
                if total > 1.5 * budget:
                    break
                for point, args in zip(points[-2:], inputs):
                    elapsed = timed(args)
                    point[1] = min(point[1], elapsed)
                    total += elapsed
    finally:
        if gc_was_enabled:
            gc.enable()
    if len(points) < 2:
        return float("inf")
    (n1, t1), (n2, t2) = points[-2], points[-1]
    return math.log(max(t2, 1e-9) / max(t1, 1e-9)) / math.log(n2 / n1)


def _eval_expr(source, ns):
    out = io.StringIO()
    _register_source(source, "<test>")
    with contextlib.redirect_stdout(out):
        value = eval(compile(source, "<test>", "eval"), ns)
    return value, out.getvalue()


def _mode_test(payload):
    code = payload.get("code", "")
    solution = payload.get("solution") or ""
    setup = payload.get("setup") or ""
    tests = payload.get("tests") or []
    result = {
        "ok": True, "stdout": "", "error": None, "errorLine": None, "tests": [], "figures": [],
        # Bonus tests (e.g. optimal complexity) never block validation: counted separately.
        "passed": 0, "total": sum(1 for t in tests if not t.get("bonus")),
        "bonusPassed": 0, "bonusTotal": 0,
    }
    start = time.perf_counter()

    user_ns = _new_namespace()
    out = io.StringIO()
    with contextlib.redirect_stdout(out), contextlib.redirect_stderr(out):
        try:
            if setup:
                _exec(setup, user_ns, "<setup>")
            _exec(code, user_ns)
        except BaseException as exc:  # noqa: BLE001
            if isinstance(exc, KeyboardInterrupt):
                raise
            result["ok"] = False
            result["error"] = _clean_traceback(exc)
            result["errorLine"] = _error_line(exc)
    result["stdout"] = _truncate(out.getvalue(), 5_000)
    if not result["ok"]:
        for t in tests:
            result["tests"].append({
                "name": t.get("name") or t.get("call") or "test", "passed": False,
                "hidden": bool(t.get("hidden")), "bonus": bool(t.get("bonus")),
                "error": "Le code n'a pas pu s'exécuter.",
            })
        result["figures"] = _collect_figures()
        return result

    ref_ns = None
    if solution:
        ref_ns = _new_namespace()
        with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            if setup:
                _exec(setup, ref_ns, "<setup>")
            _exec(solution, ref_ns, "<solution>")

    for index, t in enumerate(tests):
        name = t.get("name") or (t.get("call") or f"Test {index + 1}")
        entry = {"name": name, "hidden": bool(t.get("hidden")), "passed": False, "bonus": bool(t.get("bonus"))}
        t0 = time.perf_counter()
        try:
            if t.get("call"):
                entry["input"] = t["call"]
                got, printed = _eval_expr(t["call"], user_ns)
                if printed:
                    entry["stdout"] = _truncate(printed, 2_000)
                if "expected" in t and t["expected"] is not None:
                    exp_ns = ref_ns if ref_ns is not None else user_ns
                    expected = eval(compile(str(t["expected"]), "<expected>", "eval"), dict(exp_ns))
                elif ref_ns is not None:
                    with contextlib.redirect_stdout(io.StringIO()):
                        expected = eval(compile(t["call"], "<expected>", "eval"), ref_ns)
                else:
                    raise RuntimeError("Test mal configuré : aucune valeur attendue.")
                ok, reason = compare(
                    got, expected,
                    strict=bool(t.get("strict")),
                    rtol=float(t.get("rtol", 1e-5)), atol=float(t.get("atol", 1e-6)),
                    unordered=bool(t.get("unordered")),
                )
                entry["got"] = _repr(got)
                entry["expected"] = _repr(expected)
                entry["passed"] = ok
                if not ok:
                    entry["error"] = reason
            elif t.get("check"):
                check_ns = dict(user_ns)
                check_ns["growth_exponent"] = growth_exponent
                if ref_ns is not None:
                    check_ns["ref"] = types.SimpleNamespace(
                        **{k: v for k, v in ref_ns.items() if not k.startswith("__")}
                    )
                printed = io.StringIO()
                with contextlib.redirect_stdout(printed):
                    _exec(t["check"], check_ns, "<check>")
                if printed.getvalue():
                    entry["stdout"] = _truncate(printed.getvalue(), 2_000)
                entry["passed"] = True
            else:
                raise RuntimeError("Test mal configuré.")
        except AssertionError as exc:
            entry["error"] = str(exc) or "Assertion échouée"
        except BaseException as exc:  # noqa: BLE001
            if isinstance(exc, KeyboardInterrupt):
                raise
            entry["error"] = _clean_traceback(exc)
        entry["durationMs"] = round((time.perf_counter() - t0) * 1000, 1)
        if entry["bonus"]:
            result["bonusTotal"] += 1
            result["bonusPassed"] += int(entry["passed"])
        elif entry["passed"]:
            result["passed"] += 1
        result["tests"].append(entry)

    result["figures"] = _collect_figures()
    result["durationMs"] = round((time.perf_counter() - start) * 1000, 1)
    return result


def _mode_eval(payload):
    """Flashcard check: compare the user's answer with the reference answer."""
    setup = payload.get("setup") or ""
    answer = payload.get("answer") or ""
    reference = payload.get("reference") or ""
    kind = payload.get("kind") or "expr"
    var = payload.get("var")
    strict = not payload.get("loose", False)
    result = {"ok": True, "correct": False, "got": None, "expected": None, "error": None, "reason": None}

    def evaluate(source, filename):
        ns = _new_namespace()
        with contextlib.redirect_stdout(io.StringIO()) as printed:
            if setup:
                _exec(setup, ns, "<setup>")
            if kind == "stmt":
                _register_source(source, filename)
                exec(compile(source, filename, "exec"), ns)
                value = ns.get(var) if var else None
            elif kind == "stdout":
                _register_source(source, filename)
                exec(compile(source, filename, "exec"), ns)
                value = None
            else:
                _register_source(source.strip(), filename)
                value = eval(compile(source.strip(), filename, "eval"), ns)
        if kind == "stdout":
            value = printed.getvalue()
        return value

    try:
        expected = evaluate(reference, "<reference>")
    except BaseException as exc:  # noqa: BLE001
        result["ok"] = False
        result["error"] = "Carte mal configurée : " + "".join(traceback.format_exception_only(exc)).strip()
        return result
    result["expected"] = _repr(expected)
    try:
        got = evaluate(answer, USER_FILE)
    except BaseException as exc:  # noqa: BLE001
        if isinstance(exc, KeyboardInterrupt):
            raise
        result["error"] = _clean_traceback(exc)
        return result
    result["got"] = _repr(got)
    ok, reason = compare(got, expected, strict=strict)
    result["correct"] = ok
    result["reason"] = reason
    return result


def run(payload_json):
    payload = json.loads(payload_json)
    mode = payload.get("mode", "run")
    try:
        if mode == "test":
            result = _mode_test(payload)
        elif mode == "eval":
            result = _mode_eval(payload)
        else:
            result = _mode_run(payload)
    except BaseException as exc:  # noqa: BLE001 - last-resort guard (e.g. broken solution)
        result = {"ok": False, "error": "Erreur interne du harness : " + repr(exc), "internal": True}
    return json.dumps(result, default=str)


if __name__ == "__main__":
    import os

    os.environ.setdefault("MPLBACKEND", "Agg")
    sys.stdout.write(run(sys.stdin.read()))
