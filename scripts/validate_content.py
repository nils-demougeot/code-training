#!/usr/bin/env python3
"""Validates every piece of content in /content with the same harness as the app.

  - exercises & projects: the reference solution passes all tests; the starter does not.
  - flashcards: the reference answer runs and matches itself (catches typos in answers).
  - quiz questions with `verify: true`: the snippet's stdout equals the marked answer.

Run it with the package versions shipped by Pyodide (see scripts/requirements-content.txt):
    python scripts/validate_content.py [--only <id-substring>] [--skip-local]
"""

import argparse
import json
import os
import re
import shutil
import signal
import subprocess
import sys
import tempfile
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
sys.dont_write_bytecode = True  # keep public/ (copied as-is into the build) free of __pycache__
sys.path.insert(0, str(ROOT / "public"))

import harness  # noqa: E402

DOMAINS = {"python", "numpy", "pandas", "sql", "stats", "ml", "dl", "genai", "algo", "git"}
DIFFICULTIES = {"easy", "medium", "hard"}
CONTENT = ROOT / "content"
SHARED = {p.stem: p.read_text() for p in (CONTENT / "shared").glob("*.py")}

errors: list[str] = []
warnings: list[str] = []


class Timeout(BaseException):
    """BaseException so that an `except Exception` in the code under test cannot swallow it."""


_timed_out = False


def _alarm(_signum, _frame):
    global _timed_out
    _timed_out = True
    raise Timeout()


signal.signal(signal.SIGALRM, _alarm)


def run(payload, seconds=120):
    """Runs the harness with a deadline. The harness reports every exception to the user (it catches
    BaseException), so a single alarm would be swallowed by the current test and the next one could
    loop forever: past the deadline the alarm fires again every 0.5 s until the harness returns."""
    global _timed_out
    _timed_out = False
    signal.setitimer(signal.ITIMER_REAL, seconds, 0.5)
    try:
        result = json.loads(harness.run(json.dumps(payload)))
    except Timeout:
        result = None
    finally:
        signal.setitimer(signal.ITIMER_REAL, 0)
    if _timed_out or result is None:
        return {"ok": False, "error": f"timeout after {seconds}s"}
    return result


def torch_available():
    try:
        import torch  # noqa: F401

        return True
    except ImportError:
        return False


def setup_of(item):
    parts = []
    if item.get("shared"):
        if item["shared"] not in SHARED:
            errors.append(f"{item['id']}: unknown shared setup {item['shared']!r}")
        parts.append(SHARED.get(item["shared"], ""))
    if item.get("setup"):
        parts.append(item["setup"])
    return "\n".join(parts)


def to_python(item, code):
    return f"QUERY = {json.dumps(code)}\n" if item.get("language") == "sql" else code


def describe_failures(res):
    if res.get("error"):
        return res["error"]
    out = []
    for t in res.get("tests", []):
        if not t["passed"]:
            out.append(f"    ✗ {t['name']}: {t.get('error')} | got={t.get('got')} expected={t.get('expected')}")
    return "\n".join(out)


def check_exercise(path, ex, card_ids, skip_local):
    eid = ex.get("id", path.stem)
    for key in ["id", "title", "domain", "difficulty", "minutes", "statement", "starter", "solution", "tests", "explanation"]:
        if key not in ex:
            errors.append(f"{eid}: missing field {key!r}")
            return
    if ex["domain"] not in DOMAINS:
        errors.append(f"{eid}: bad domain {ex['domain']}")
    if ex["difficulty"] not in DIFFICULTIES:
        errors.append(f"{eid}: bad difficulty {ex['difficulty']}")
    if path.parent.name != ex["domain"]:
        warnings.append(f"{eid}: file in {path.parent.name}/ but domain is {ex['domain']}")
    for cid in ex.get("cards") or []:
        if cid not in card_ids:
            errors.append(f"{eid}: unknown card {cid!r}")
    if not any(not t.get("hidden") for t in ex["tests"]):
        warnings.append(f"{eid}: no visible test")
    if ex.get("engine") == "local" and (skip_local or not torch_available()):
        warnings.append(f"{eid}: skipped (needs local runner / torch)")
        return

    setup = setup_of(ex)
    tests = ex["tests"]
    solution = to_python(ex, ex["solution"])
    res = run({"mode": "test", "code": solution, "solution": solution, "setup": setup, "tests": tests})
    # Bonus tests time the code: on a noisy machine (shared CI runners) give them two more chances.
    for _ in range(2):
        if not (res.get("ok") and res.get("passed") == res.get("total") and res.get("bonusPassed") != res.get("bonusTotal")):
            break
        res = run({"mode": "test", "code": solution, "solution": solution, "setup": setup, "tests": tests})
    if not res.get("ok") or res.get("passed") != res.get("total") or res.get("bonusPassed") != res.get("bonusTotal"):
        errors.append(f"{eid}: solution fails\n{describe_failures(res)}")
    has_bonus = any(t.get("bonus") for t in tests)
    if has_bonus and not ex.get("complexity"):
        errors.append(f"{eid}: bonus tests need a `complexity` block (target + note)")
    if ex.get("naive"):
        # The brute-force version must be accepted… but miss the bonus.
        res = run({"mode": "test", "code": to_python(ex, ex["naive"]), "solution": solution, "setup": setup, "tests": tests})
        if not res.get("ok") or res.get("passed") != res.get("total"):
            errors.append(f"{eid}: naive solution should pass the required tests\n{describe_failures(res)}")
        elif has_bonus and res.get("bonusPassed") == res.get("bonusTotal"):
            errors.append(f"{eid}: naive solution unexpectedly passes the bonus tests")
    res = run({"mode": "test", "code": to_python(ex, ex["starter"]), "solution": solution, "setup": setup, "tests": tests})
    if res.get("ok") and res.get("total") and res.get("passed") == res.get("total"):
        errors.append(f"{eid}: starter already passes every test")
    # Typical mistakes: the tests must reject each of them.
    for i, wrong in enumerate(ex.get("wrong") or []):
        res = run({"mode": "test", "code": to_python(ex, wrong), "solution": solution, "setup": setup, "tests": tests}, 20)
        if res.get("ok") and res.get("total") and res.get("passed") == res.get("total"):
            errors.append(f"{eid}: wrong variant #{i + 1} passes every test (tests too weak)")


def check_project(path, pr, skip_local):
    pid = pr.get("id", path.stem)
    for key in ["id", "title", "domain", "difficulty", "hours", "summary", "intro", "starter", "solution", "steps", "outro"]:
        if key not in pr:
            errors.append(f"{pid}: missing field {key!r}")
            return
    if pr.get("engine") == "local" and (skip_local or not torch_available()):
        warnings.append(f"{pid}: skipped (needs local runner / torch)")
        return
    setup = setup_of(pr)
    tests = []
    for i, step in enumerate(pr["steps"]):
        if not step.get("tests"):
            errors.append(f"{pid}: step {i + 1} has no tests")
        for t in step.get("tests", []):
            tests.append({**t, "name": f"step {i + 1} · {t.get('name') or t.get('call')}"})
    res = run({"mode": "test", "code": pr["solution"], "solution": pr["solution"], "setup": setup, "tests": tests}, 300)
    if not res.get("ok") or res.get("passed") != res.get("total"):
        errors.append(f"{pid}: solution fails\n{describe_failures(res)}")
    res = run({"mode": "test", "code": pr["starter"], "solution": pr["solution"], "setup": setup, "tests": tests}, 300)
    if res.get("ok") and res.get("passed") == res.get("total"):
        errors.append(f"{pid}: starter already passes every test")


def check_deck(path, deck, seen):
    for key in ["id", "title", "domain", "description", "cards"]:
        if key not in deck:
            errors.append(f"{path.name}: missing field {key!r}")
            return set()
    ids = set()
    for card in deck["cards"]:
        cid = card.get("id")
        if not cid or cid in seen or cid in ids:
            errors.append(f"{path.name}: missing or duplicate card id {cid!r}")
        ids.add(cid)
        if not card.get("prompt") or not card.get("answer"):
            errors.append(f"{cid}: card needs prompt and answer")
            continue
        kind = card.get("kind", "expr")
        if kind == "reveal":
            continue
        if kind == "stmt" and not card.get("var"):
            errors.append(f"{cid}: stmt card needs `var`")
        res = run({
            "mode": "eval", "setup": card.get("setup"), "answer": card["answer"], "reference": card["answer"],
            "kind": kind, "var": card.get("var"), "loose": card.get("loose", False),
        }, 30)
        if not res.get("ok") or not res.get("correct"):
            errors.append(f"{cid}: reference answer does not evaluate cleanly: {res.get('error') or res.get('reason')}")
    return ids


def check_quiz(path, data, seen):
    for q in data.get("questions", []):
        qid = q.get("id")
        if not qid or qid in seen:
            errors.append(f"{path.name}: missing or duplicate question id {qid!r}")
        seen.add(qid)
        choices = q.get("choices") or []
        if len(choices) < 2 or not isinstance(q.get("answer"), int) or not 0 <= q["answer"] < len(choices):
            errors.append(f"{qid}: invalid choices/answer")
            continue
        if len(set(map(str, choices))) != len(choices):
            errors.append(f"{qid}: duplicate choices")
        for key in ["question", "explain", "topic"]:
            if not q.get(key):
                errors.append(f"{qid}: missing {key}")
        if q.get("verify"):
            res = run({"mode": "run", "code": q["code"]}, 30)
            out = (res.get("stdout") or "").strip()
            if res.get("error"):
                out = res["error"].strip().splitlines()[-1]
            expected = str(choices[q["answer"]]).strip()
            if re.fullmatch(r"\w+(Error|Exception)", expected):
                # Answer is an exception type: the snippet must raise exactly that.
                if not (res.get("error") and out.startswith(expected + ":")):
                    errors.append(f"{qid}: expected {expected}, got {out!r}")
            elif out != expected:
                errors.append(f"{qid}: stdout {out!r} != marked answer {expected!r}")
            for i, c in enumerate(choices):
                if i != q["answer"] and str(c).strip() == out:
                    errors.append(f"{qid}: another choice also matches the output")


def check_docs(path, lib):
    for key in ["id", "title", "domain", "sections"]:
        if key not in lib:
            errors.append(f"{path.name}: missing {key}")
            return 0
    n = 0
    setup = setup_of(lib)
    for section in lib["sections"]:
        for entry in section.get("entries", []):
            n += 1
            name = f"doc {lib['id']} › {entry.get('name')}"
            if not entry.get("name") or not entry.get("description"):
                errors.append(f"{name}: needs name and description")
            example = entry.get("example")
            # PyTorch examples cannot run in the browser, but are still checked when torch is installed.
            if not example or (entry.get("run") is False and not (lib["id"] == "pytorch" and torch_available())):
                continue
            code = f"show({json.dumps(example)})" if lib.get("language") == "sql" else example
            res = run({"mode": "run", "code": code, "setup": setup}, 60)
            if not res.get("ok"):
                errors.append(f"{name}: example fails\n{res.get('error')}")
    return n


PARSONS_FIELDS = ["id", "title", "domain", "difficulty", "statement", "solution", "tests"]


def check_parsons(items, only):
    """Parsons problems: the program rebuilt from the blocks passes the tests, every distractor
    swapped in for the line it imitates makes them fail."""
    if not shutil.which("node"):
        warnings.append("node not found: Parsons blocks not checked")
        return 0
    exported = json.loads(subprocess.run(
        ["node", str(ROOT / "scripts" / "parsons-export.mjs")], capture_output=True, text=True, check=True, cwd=ROOT,
    ).stdout)
    n = 0
    for entry in exported:
        item = items.get(entry["id"])
        if item is None or (only and only not in entry["id"]):
            continue
        name = f"blocs {entry['id']}"
        if entry["kind"] == "parsons":
            for key in PARSONS_FIELDS:
                if key not in item:
                    errors.append(f"{name}: missing field {key!r}")
            if item.get("domain") not in DOMAINS or item.get("difficulty") not in DIFFICULTIES:
                errors.append(f"{name}: bad domain or difficulty")
            if not entry["eligible"]:
                errors.append(f"{name}: needs between 3 and 32 blocks (has {entry['blocks']})")
        if not entry["eligible"]:
            continue
        n += 1
        setup = setup_of(item)
        tests = [t for t in item["tests"] if not t.get("bonus")]
        solution = to_python(item, item["solution"])
        res = run({"mode": "test", "code": to_python(item, entry["program"]), "solution": solution, "setup": setup, "tests": tests})
        if not res.get("ok") or res.get("passed") != res.get("total"):
            errors.append(f"{name}: program rebuilt from the blocks fails\n{describe_failures(res)}")
        for d in entry["distractors"]:
            if d["program"] is None:
                errors.append(f"{name}: distractor {d['line']!r} replaces no block")
                continue
            res = run({"mode": "test", "code": to_python(item, d["program"]), "solution": solution, "setup": setup, "tests": tests}, 20)
            if res.get("ok") and res.get("total") and res.get("passed") == res.get("total"):
                errors.append(f"{name}: distractor {d['line']!r} still passes every test")
            elif "timeout" in str(res.get("error")):
                # In the app the learner would wait for the engine timeout: pick a trap that fails fast.
                warnings.append(f"{name}: distractor {d['line']!r} only fails by timeout")
    return n


COMPETITION_FIELDS = ["id", "title", "emoji", "difficulty", "task", "metric", "metric_label", "higher_is_better", "shared",
                      "summary", "story", "data", "medals", "leaderboard", "submission", "steps", "gold"]
STEP_FIELDS = ["id", "title", "goal", "instructions", "starter", "solution", "hints", "tests", "explanation"]


def notebook(cells):
    """The cells of a competition notebook run one after the other in the same namespace."""
    return "\n\n".join(c.rstrip() for c in cells) + "\n"


def competition_score(setup, code):
    res = run({"mode": "run", "code": code + "\nprint('__SCORE__', repr(float(_score(submission))))\n", "setup": setup}, 600)
    m = re.search(r"__SCORE__ ([0-9.eE+-]+)", res.get("stdout") or "")
    return (float(m.group(1)) if m else None), res


def check_competition(path, comp):
    """Kaggle-style competition: each step of the reference notebook passes its tests, each starter
    cell fails them, and the medals are calibrated (naive < bronze, reference >= silver, gold reachable)."""
    name = f"compétition {comp.get('id', path.stem)}"
    for key in COMPETITION_FIELDS:
        if key not in comp:
            errors.append(f"{name}: missing {key}")
    if any(k not in comp for k in ("steps", "medals", "shared")):
        return
    setup = setup_of(comp)
    better = (lambda a, b: a >= b) if comp["higher_is_better"] else (lambda a, b: a <= b)
    medals = comp["medals"]
    if not (better(medals["gold"], medals["silver"]) and better(medals["silver"], medals["bronze"])):
        errors.append(f"{name}: medals out of order {medals}")
    steps = comp["steps"]
    solutions = [s["solution"] for s in steps]
    for k, step in enumerate(steps):
        sname = f"{name} › {step.get('id')}"
        for key in STEP_FIELDS:
            if key not in step:
                errors.append(f"{sname}: missing {key}")
        print(f"  · {sname}", flush=True)
        res = run({"mode": "test", "code": notebook(solutions[: k + 1]), "setup": setup, "tests": step["tests"]}, 600)
        if not res.get("ok") or res.get("passed") != res.get("total"):
            errors.append(f"{sname}: the reference notebook fails\n{describe_failures(res)}")
        for label, cell in [("starter", step["starter"])] + [(f"wrong #{i + 1}", w) for i, w in enumerate(step.get("wrong", []))]:
            res = run({"mode": "test", "code": notebook(solutions[:k] + [cell]), "setup": setup, "tests": step["tests"]}, 600)
            if res.get("ok") and res.get("total") and res.get("passed") == res.get("total"):
                errors.append(f"{sname}: the {label} cell passes every test")
    ref, res = competition_score(setup, notebook(solutions))
    naive, _ = competition_score(setup, "submission = _naive_submission()")
    model_step = next((i for i, s in enumerate(steps) if s["id"] == "model"), None)
    gold = None
    if model_step is not None:
        cells = solutions[:model_step] + [comp["gold"]] + solutions[model_step + 1:]
        gold, _ = competition_score(setup, notebook(cells))
    else:
        errors.append(f"{name}: no step with id 'model' (the gold solution replaces it)")
    print(f"    naïf {naive} · référence {ref} · or {gold} · médailles {medals}", flush=True)
    if ref is None:
        errors.append(f"{name}: no score for the reference notebook\n{res.get('error')}")
        return
    if naive is None or better(naive, medals["bronze"]):
        errors.append(f"{name}: the naive submission ({naive}) already earns bronze")
    if not better(ref, medals["silver"]):
        errors.append(f"{name}: the reference notebook ({ref}) does not reach silver ({medals['silver']})")
    if gold is None or not better(gold, medals["gold"]):
        errors.append(f"{name}: the gold solution ({gold}) does not reach gold ({medals['gold']})")


def check_maths():
    """Maths exercises (src/maths): many random instances of each, every answer recomputed
    independently (scripts/maths_check.py), and every lesson/statement/correction rendered."""
    if not shutil.which("node"):
        warnings.append("node not found: maths exercises not checked")
        return 0, 0
    sys.path.insert(0, str(ROOT / "scripts"))
    import maths_check

    report = json.loads(subprocess.run(
        ["node", str(ROOT / "scripts" / "maths-export.mjs"), "60"], capture_output=True, text=True, check=True, cwd=ROOT,
    ).stdout)
    for p in report["problems"]:
        errors.append(f"maths {p}")
    failed = {}
    for inst in report["instances"]:
        msg = maths_check.check_instance(inst)
        if msg and inst["id"] not in failed:
            failed[inst["id"]] = msg
            errors.append(f"maths {inst['id']} (graine {inst['seed']}): {msg}")
    return sum(len(c["exercises"]) for c in report["chapters"]), len(report["instances"])


def check_git_levels():
    """Git simulator lessons: the reference solution reaches every goal (src/git/levels.ts)."""
    if not shutil.which("node"):
        warnings.append("node not found: Git lessons not checked")
        return 0
    report = json.loads(subprocess.run(
        ["node", str(ROOT / "scripts" / "git-levels-check.mjs")], capture_output=True, text=True, check=True, cwd=ROOT,
    ).stdout)
    for e in report["errors"]:
        errors.append(f"git {e}")
    return report["levels"]


def check_mental():
    """Mental arithmetic (src/mental): every level drawn 2,000 times; each answer recomputed in Python
    from its own expression, typing the displayed answer is accepted, and answers stay mental-sized."""
    if not shutil.which("node"):
        warnings.append("node not found: mental arithmetic not checked")
        return 0
    report = json.loads(subprocess.run(
        ["node", str(ROOT / "scripts" / "mental-export.mjs"), "2000"], capture_output=True, text=True, check=True, cwd=ROOT,
    ).stdout)
    for p in report["problems"]:
        errors.append(f"calcul mental {p}")
    for smp in report["samples"]:
        got = eval(smp["expr"], {"__builtins__": {}})
        ans = smp["answer"]
        name = f"calcul mental niv. {smp['level']} « {smp['text']} »"
        if abs(got - ans) > 1e-9 * max(1, abs(ans)):
            errors.append(f"{name}: Python gives {got}, the app expects {ans}")
        elif abs(round(ans, 3) - ans) > 1e-9 or abs(ans) >= 100_000:
            errors.append(f"{name}: answer {ans} is not a mental-arithmetic answer")
    return len(report["samples"])


def check_mcq_lengths():
    """Multiple-choice questions (missions, Explain it simply, GenAI and maths quizzes): the right answer
    must not be recognisable by its length. Per question, it is at most 25 % longer than the longest
    wrong option; per collection, it is the longest option in at most 40 % of the questions (25 % by chance)."""
    if not shutil.which("node"):
        return 0
    questions = json.loads(subprocess.run(
        ["node", str(ROOT / "scripts" / "mcq-export.mjs")], capture_output=True, text=True, check=True, cwd=ROOT,
    ).stdout)
    longest = {}
    for q in questions:
        # Formulas are compared on meaning, not on length.
        if any("$" in o["text"] for o in q["options"]):
            continue
        lengths = [len(o["text"]) for o in q["options"]]
        right = [i for i, o in enumerate(q["options"]) if o["right"]][0]
        wrong = max(n for i, n in enumerate(lengths) if i != right)
        if lengths[right] > 1.25 * wrong:
            errors.append(f"QCM {q['id']}: la bonne réponse ({lengths[right]} caractères) se repère à sa longueur (fausse la plus longue : {wrong})")
        n, k = longest.get(q["source"], (0, 0))
        longest[q["source"]] = (n + 1, k + (lengths[right] == max(lengths)))
    for source, (n, k) in longest.items():
        if n >= 10 and k > 0.4 * n:
            errors.append(f"QCM {source}: la bonne réponse est la plus longue dans {k} questions sur {n} (40 % maximum)")
    return len(questions)


def odd_dollars(text):
    """A lone `$` starts a formula in the Markdown renderer: amounts must be written with € or `USD`."""
    return len(re.findall(r"(?<!\\)\$", text.replace("$$", ""))) % 2 == 1


def jargon_rules():
    """The jargon detector of the explain page (src/pages/ExplainPage.tsx), reused to keep model answers plain."""
    src = (ROOT / "src" / "pages" / "ExplainPage.tsx").read_text()
    return [(re.compile(m.group(1), re.I), m.group(2)) for m in re.finditer(r"\[/(.+?)/i, '([^']+)'", src)]


def check_choice(name, c, verdicts):
    opts = c.get("options") or []
    if len(opts) < 3:
        errors.append(f"{name}: needs at least 3 options")
    for o in opts:
        if not o.get("text") or not o.get("feedback"):
            errors.append(f"{name}: every option needs text and feedback")
    if verdicts:
        if any(o.get("verdict") not in ("best", "ok", "bad") for o in opts):
            errors.append(f"{name}: every option needs a verdict (best/ok/bad)")
        if sum(o.get("verdict") == "best" for o in opts) != 1:
            errors.append(f"{name}: exactly one option must be 'best'")
    elif c.get("multi"):
        n = sum(bool(o.get("correct")) for o in opts)
        if n == 0 or n == len(opts):
            errors.append(f"{name}: a multiple choice needs right and wrong options")
    elif sum(bool(o.get("correct")) for o in opts) != 1:
        errors.append(f"{name}: exactly one option must be correct")


def walk_text(obj):
    if isinstance(obj, str):
        yield obj
    elif isinstance(obj, dict):
        for v in obj.values():
            yield from walk_text(v)
    elif isinstance(obj, list):
        for v in obj:
            yield from walk_text(v)


def check_mission(path, m):
    mid = m.get("id", path.name)
    for key in ["id", "title", "emoji", "industry", "difficulty", "minutes", "skills", "client", "brief", "context",
                "discovery", "facts", "framing", "approach", "plan", "value", "pitch", "debrief"]:
        if key not in m:
            errors.append(f"{mid}: missing {key}")
            return
    if m["difficulty"] not in DIFFICULTIES:
        errors.append(f"{mid}: bad difficulty")
    for key in ["name", "role", "company"]:
        if not m["client"].get(key):
            errors.append(f"{mid}: client needs {key}")
    facts = {f["id"] for f in m["facts"]}
    if len(facts) != len(m["facts"]):
        errors.append(f"{mid}: duplicate fact ids")
    qs = m["discovery"]["questions"]
    budget = m["discovery"]["budget"]
    if len({q["id"] for q in qs}) != len(qs):
        errors.append(f"{mid}: duplicate question ids")
    if not 0 < budget < len(qs):
        errors.append(f"{mid}: the question budget must be smaller than the number of questions")
    values = [q.get("value") for q in qs]
    if any(v not in ("key", "useful", "weak", "off") for v in values):
        errors.append(f"{mid}: question value must be key/useful/weak/\"off\" (quote off: YAML 1.1 reads it as false)")
    if not 1 <= values.count("key") <= budget:
        errors.append(f"{mid}: between 1 and {budget} key questions expected")
    if not {"weak", "off"} & set(values):
        errors.append(f"{mid}: add at least one weak or off-topic question as a trap")
    revealed = set()
    for q in qs:
        for key in ["text", "answer", "why"]:
            if not q.get(key):
                errors.append(f"{mid}/{q.get('id')}: missing {key}")
        for r in q.get("reveals") or []:
            if r not in facts:
                errors.append(f"{mid}/{q['id']}: reveals unknown fact {r!r}")
            revealed.add(r)
    if facts - revealed:
        errors.append(f"{mid}: facts never revealed: {sorted(facts - revealed)}")
    if not m["framing"]:
        errors.append(f"{mid}: framing needs questions")
    for c in m["framing"]:
        check_choice(f"{mid}/framing/{c.get('id')}", c, verdicts=False)
        if c.get("multi"):
            right = [len(o["text"]) for o in c["options"] if o.get("correct")]
            wrong = [len(o["text"]) for o in c["options"] if not o.get("correct")]
            if right and wrong and sum(right) / len(right) > 1.3 * sum(wrong) / len(wrong):
                errors.append(f"{mid}/framing/{c['id']}: the right options are much longer than the wrong ones")
    check_choice(f"{mid}/approach", m["approach"], verdicts=True)
    check_choice(f"{mid}/pitch", m["pitch"], verdicts=True)
    steps = m["plan"].get("steps") or []
    if len(steps) < 4 or len(set(steps)) != len(steps):
        errors.append(f"{mid}: the plan needs at least 4 distinct steps")
    numbers = m["value"].get("numbers") or {}
    for f in m["value"].get("fields") or []:
        try:
            got = eval(f["formula"], {"__builtins__": {}}, dict(numbers))
        except Exception as e:  # noqa: BLE001
            errors.append(f"{mid}: formula {f.get('formula')!r} fails: {e}")
            continue
        if abs(got - f["answer"]) > 0.5 * 10 ** -f["decimals"] + 1e-9:
            errors.append(f"{mid}: field {f['label']!r}: formula gives {got}, answer says {f['answer']}")
    if not m["value"].get("fields"):
        errors.append(f"{mid}: value needs fields")
    for t in walk_text(m):
        if odd_dollars(t):
            errors.append(f"{mid}: unbalanced $ in {t[:60]!r}")


def check_explain(path, d, rules):
    did = d.get("id", path.name)
    for key in ["id", "title", "emoji", "summary", "items", "write"]:
        if key not in d:
            errors.append(f"{did}: missing {key}")
            return
    ids = [i.get("id") for i in d["items"]] + [w.get("id") for w in d["write"]]
    if len(set(ids)) != len(ids):
        errors.append(f"{did}: duplicate ids")
    if len(d["items"]) < 5:
        errors.append(f"{did}: at least 5 situations expected")
    for it in d["items"]:
        name = f"{did}/{it.get('id')}"
        if it.get("kind") not in ("explain", "metric", "pushback", "so-what"):
            errors.append(f"{name}: bad kind {it.get('kind')!r}")
        for key in ["audience", "prompt", "takeaway"]:
            if not it.get(key):
                errors.append(f"{name}: missing {key}")
        check_choice(name, it, verdicts=True)
    for w in d["write"]:
        name = f"{did}/{w.get('id')}"
        for key in ["audience", "prompt", "model"]:
            if not w.get(key):
                errors.append(f"{name}: missing {key}")
        if len(w.get("checklist") or []) < 3:
            errors.append(f"{name}: the checklist needs at least 3 items")
        found = [term for rx, term in rules if rx.search(w.get("model", ""))]
        if found:
            errors.append(f"{name}: the model answer uses jargon the page flags: {found}")
        words = len(w.get("model", "").split())
        if words > w.get("maxWords", 120):
            errors.append(f"{name}: the model answer has {words} words, more than the limit it sets")
    for t in walk_text(d):
        if odd_dollars(t):
            errors.append(f"{did}: unbalanced $ in {t[:60]!r}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--only", help="only check items whose id contains this string")
    parser.add_argument("--skip-local", action="store_true", help="skip exercises that need PyTorch")
    args = parser.parse_args()
    # Snippets may write files (doc examples: json, torch.save): keep them out of the repo.
    os.chdir(tempfile.mkdtemp(prefix="ct-validate-"))

    card_ids: set[str] = set()
    n_cards = 0
    for path in sorted((CONTENT / "cards").glob("*.yaml")):
        deck = yaml.safe_load(path.read_text())
        if args.only and args.only not in deck.get("id", ""):
            card_ids |= {c.get("id") for c in deck.get("cards", [])}
            continue
        ids = check_deck(path, deck, card_ids)
        n_cards += len(ids)
        card_ids |= ids

    n_quiz = 0
    quiz_ids: set[str] = set()
    for path in sorted((CONTENT / "quiz").glob("*.yaml")):
        data = yaml.safe_load(path.read_text())
        if data.get("domain") not in DOMAINS:
            errors.append(f"{path.name}: bad domain")
        if not args.only:
            check_quiz(path, data, quiz_ids)
            n_quiz += len(data.get("questions", []))

    ex_ids: set[str] = set()
    n_ex = 0
    for path in sorted((CONTENT / "exercises").rglob("*.yaml")):
        ex = yaml.safe_load(path.read_text())
        if ex.get("id") in ex_ids:
            errors.append(f"duplicate exercise id {ex.get('id')}")
        ex_ids.add(ex.get("id"))
        if args.only and args.only not in ex.get("id", ""):
            continue
        n_ex += 1
        print(f"  · {ex.get('id')}", flush=True)
        check_exercise(path, ex, card_ids, args.skip_local)

    parsons_items = {}
    for path in sorted((CONTENT / "exercises").rglob("*.yaml")):
        ex = yaml.safe_load(path.read_text())
        parsons_items[ex.get("id")] = ex
    for path in sorted((CONTENT / "parsons").glob("*.yaml")):
        item = yaml.safe_load(path.read_text())
        if item.get("id") in parsons_items:
            errors.append(f"duplicate id {item.get('id')} (parsons)")
        parsons_items[item.get("id")] = item
    n_parsons = check_parsons(parsons_items, args.only)
    n_git = 0 if args.only and not args.only.startswith("git") else check_git_levels()
    n_maths, n_maths_inst = (0, 0) if args.only and not args.only.startswith("maths") else check_maths()

    n_comp = 0
    for path in sorted((CONTENT / "competitions").glob("*.yaml")):
        comp = yaml.safe_load(path.read_text())
        if args.only and args.only not in f"comp-{comp.get('id')}":
            continue
        n_comp += 1
        check_competition(path, comp)

    n_proj = 0
    for path in sorted((CONTENT / "projects").glob("*.yaml")):
        pr = yaml.safe_load(path.read_text())
        if args.only and args.only not in pr.get("id", ""):
            continue
        n_proj += 1
        print(f"  · project {pr.get('id')}", flush=True)
        check_project(path, pr, args.skip_local)

    n_docs = 0
    for path in sorted((CONTENT / "docs").glob("*.yaml")):
        lib = yaml.safe_load(path.read_text())
        lib.setdefault("id", path.stem)
        if args.only and not args.only.startswith("doc"):
            continue
        if args.only and args.only not in f"doc-{lib['id']}":
            continue
        n_docs += check_docs(path, lib)

    for path in sorted((CONTENT / "fiches").glob("*.yaml")):
        f = yaml.safe_load(path.read_text())
        for key in ["id", "title", "domain", "summary", "body"]:
            if key not in f:
                errors.append(f"{path.name}: missing {key}")

    n_missions = 0
    for path in sorted((CONTENT / "missions").glob("*.yaml")):
        n_missions += 1
        check_mission(path, yaml.safe_load(path.read_text()))
    if not args.only and n_missions and len({yaml.safe_load(p.read_text())["id"] for p in (CONTENT / "missions").glob("*.yaml")}) != n_missions:
        errors.append("duplicate mission ids")
    n_explain = 0
    rules = jargon_rules()
    if len(rules) < 15:
        errors.append("could not read the jargon list from ExplainPage.tsx")
    for path in sorted((CONTENT / "explain").glob("*.yaml")):
        n_explain += 1
        check_explain(path, yaml.safe_load(path.read_text()), rules)

    n_mcq = 0 if args.only else check_mcq_lengths()
    n_mental = 0 if args.only and not args.only.startswith("mental") else check_mental()

    print(f"\n{n_ex} exercices, {n_proj} projets, {n_cards} cartes, {n_quiz} questions de quiz, {n_docs} entrées de doc, {n_parsons} problèmes de blocs, {n_git} missions Git, {n_comp} compétitions, {n_maths} exercices de maths ({n_maths_inst} tirages), {n_missions} missions client, {n_explain} decks explain, {n_mental} calculs mentaux, {n_mcq} QCM vérifiés.")
    for w in warnings:
        print(f"⚠️  {w}")
    for e in errors:
        print(f"❌ {e}")
    if errors:
        sys.exit(1)
    print("✅ Contenu valide.")


if __name__ == "__main__":
    main()
