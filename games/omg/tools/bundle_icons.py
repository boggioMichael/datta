#!/usr/bin/env python3
"""Bundle public/omg/icons/*.svg into icons/all.json so the game loads every
picture with one request."""
import json, pathlib, re
d = pathlib.Path(__file__).resolve().parents[3] / "public" / "omg" / "icons"
out = {}
for f in sorted(d.glob("*.svg")):
    t = f.read_text(encoding="utf-8")
    t = re.sub(r">\s+<", "><", t.strip())
    out[f.stem] = t
(d / "all.json").write_text(json.dumps(out, separators=(",", ":")), encoding="utf-8")
print(f"{len(out)} icons -> {d / 'all.json'} ({(d / 'all.json').stat().st_size // 1024} KB)")
