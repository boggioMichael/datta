#!/usr/bin/env python3
"""Validate an 8200-prep content pack JSON file. Usage: python3 -I validate.py pack.json"""
import json, re, sys

HEB = re.compile(r"[֐-׿]")

def main(path):
    problems = []
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    for k in ("pack", "category", "title", "items"):
        if k not in data:
            problems.append(f"missing top-level key: {k}")
    items = data.get("items", [])
    if len(items) < 10:
        problems.append(f"too few items: {len(items)}")
    ids = set()
    subs = {}
    for i, it in enumerate(items):
        where = f"item[{i}] id={it.get('id')}"
        for k in ("id", "sub", "subTitle", "type", "difficulty", "q", "timeSec", "tags", "pro"):
            if k not in it:
                problems.append(f"{where}: missing {k}")
        iid = it.get("id", "")
        if not re.fullmatch(r"[a-z0-9]+(-[a-z0-9]+)*", iid or ""):
            problems.append(f"{where}: bad id format")
        if iid in ids:
            problems.append(f"{where}: duplicate id")
        ids.add(iid)
        t = it.get("type")
        if t not in ("mcq", "likert", "open"):
            problems.append(f"{where}: bad type {t}")
        if it.get("difficulty") not in (1, 2, 3):
            problems.append(f"{where}: difficulty must be 1/2/3")
        q = it.get("q", "")
        if not isinstance(q, str) or len(q.strip()) < 5:
            problems.append(f"{where}: q too short")
        if t == "mcq":
            opts = it.get("options")
            if not isinstance(opts, list) or len(opts) != 4:
                problems.append(f"{where}: mcq needs exactly 4 options")
            else:
                if len(set(o.strip() for o in opts)) != 4:
                    problems.append(f"{where}: duplicate options")
                a = it.get("answer")
                if not isinstance(a, int) or not (0 <= a < 4):
                    problems.append(f"{where}: answer must be int 0..3")
            if not it.get("explanation") or len(it.get("explanation", "")) < 15:
                problems.append(f"{where}: explanation missing/too short")
        if t == "likert":
            if "trait" not in it:
                problems.append(f"{where}: likert needs trait")
            if "reverse" not in it:
                problems.append(f"{where}: likert needs reverse")
        if t == "open":
            if not it.get("model") or len(it.get("model", "")) < 15:
                problems.append(f"{where}: open needs model answer")
        if not isinstance(it.get("timeSec"), int) or it.get("timeSec", 0) <= 0:
            problems.append(f"{where}: timeSec must be positive int")
        if not isinstance(it.get("pro"), bool):
            problems.append(f"{where}: pro must be boolean")
        if not isinstance(it.get("tags"), list) or not it.get("tags"):
            problems.append(f"{where}: tags must be non-empty list")
        subs.setdefault(it.get("sub"), []).append(it)
        if not HEB.search(q) and data.get("pack") not in ("english",) and it.get("sub") not in ("vocab", "reading", "grammar"):
            problems.append(f"{where}: question has no Hebrew text")
    # answer position balance
    mcq = [it for it in items if it.get("type") == "mcq" and isinstance(it.get("answer"), int)]
    if mcq:
        counts = [0, 0, 0, 0]
        for it in mcq:
            counts[it["answer"]] += 1
        if max(counts) > 0.5 * len(mcq):
            problems.append(f"answer positions unbalanced: {counts}")
    for sub, its in subs.items():
        free = sum(1 for it in its if not it.get("pro"))
        if len(its) >= 5 and (free == 0 or free == len(its)):
            problems.append(f"sub {sub}: needs a mix of free and pro items (free={free}/{len(its)})")
    for les in data.get("lessons", []):
        for k in ("id", "title", "minutes", "md"):
            if k not in les:
                problems.append(f"lesson {les.get('id')}: missing {k}")
    print(f"{path}: {len(items)} items, subs={ {k: len(v) for k, v in subs.items()} }, lessons={len(data.get('lessons', []))}")
    if problems:
        print("PROBLEMS:")
        for p in problems:
            print(" -", p)
        sys.exit(1)
    print("OK")

if __name__ == "__main__":
    main(sys.argv[1])
