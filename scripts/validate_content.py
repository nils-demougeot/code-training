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
import signal
import sys
import tempfile
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
sys.dont_write_bytecode = True  # keep public/ (copied as-is into the build) free of __pycache__
sys.path.insert(0, str(ROOT / "public"))

import harness  # noqa: E402

DOMAINS = {"python", "numpy", "pandas", "sql", "stats", "ml", "dl", "algo"}
DIFFICULTIES = {"easy", "medium", "hard"}
CONTENT = ROOT / "content"
SHARED = {p.stem: p.read_text() for p in (CONTENT / "shared").glob("*.py")}

errors: list[str] = []
warnings: list[str] = []


class Timeout(Exception):
    pass


def _alarm(_signum, _frame):
    raise Timeout()


signal.signal(signal.SIGALRM, _alarm)


def run(payload, seconds=120):
    signal.alarm(seconds)
    try:
        return json.loads(harness.run(json.dumps(payload)))
    except Timeout:
        return {"ok": False, "error": f"timeout after {seconds}s"}
    finally:
        signal.alarm(0)


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

    for path in sorted((CONTENT / "design").glob("*.yaml")):
        case = yaml.safe_load(path.read_text())
        for key in ["id", "title", "company", "difficulty", "minutes", "summary", "context", "steps"]:
            if key not in case:
                errors.append(f"design {path.name}: missing {key}")
        for step in case.get("steps", []):
            for key in ["id", "title", "question", "points", "answer"]:
                if not step.get(key):
                    errors.append(f"design {case.get('id')} › {step.get('id')}: missing {key}")

    for path in sorted((CONTENT / "fiches").glob("*.yaml")):
        f = yaml.safe_load(path.read_text())
        for key in ["id", "title", "domain", "summary", "body"]:
            if key not in f:
                errors.append(f"{path.name}: missing {key}")

    print(f"\n{n_ex} exercices, {n_proj} projets, {n_cards} cartes, {n_quiz} questions de quiz, {n_docs} entrées de doc vérifiés.")
    for w in warnings:
        print(f"⚠️  {w}")
    for e in errors:
        print(f"❌ {e}")
    if errors:
        sys.exit(1)
    print("✅ Contenu valide.")


if __name__ == "__main__":
    main()
