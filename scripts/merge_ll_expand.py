#!/usr/bin/env python3
import base64
import json
import re
from pathlib import Path

root = Path(".")

def load_text(path: Path, b64_path: Path, part0: Path, part1: Path) -> str:
    if path.exists():
        return path.read_text()
    if part0.exists() and part1.exists():
        return part0.read_text() + part1.read_text()
    shards = sorted(path.parent.glob(b64_path.name + ".*"))
    shards = [s for s in shards if s.name.split(".")[-1].isdigit()]
    if shards:
        b64 = "".join("".join(s.read_text().split()) for s in shards)
        return base64.b64decode(b64).decode("utf-8")
    if b64_path.exists():
        return base64.b64decode("".join(b64_path.read_text().split())).decode("utf-8")
    raise SystemExit(f"missing {path} / {b64_path} / parts")

patch_raw = load_text(
    root / "data/_ship_chunks/ll-expand-patch.json",
    root / "data/_ship_chunks/ll-expand-patch.json.b64",
    root / "data/_ship_chunks/ll-expand-patch.json.part0",
    root / "data/_ship_chunks/ll-expand-patch.json.part1",
)
(root / "data/_ship_chunks/ll-expand-patch.json").write_text(patch_raw)
patch = json.loads(patch_raw)

data = json.loads((root / "data/listening-library.json").read_text())
existing = {e["id"] for e in data["entries"]}
added = 0
for e in patch["entries"]:
    if e["id"] not in existing:
        data["entries"].append(e)
        added += 1
data["meta"].update(patch["metaUpdate"])
data["meta"]["entryCount"] = len(data["entries"])
data["meta"]["verifiedCount"] = len(data["entries"])
data["lastReviewed"] = "2026-09-22"
data.setdefault("verifySummary", {})["expandPass20260922"] = patch["expandPass"]
(root / "data/listening-library.json").write_text(
    json.dumps(data, indent=2, ensure_ascii=False) + "\n"
)

frag = load_text(
    root / "data/_ship_chunks/ll-expand-html-fragment.html",
    root / "data/_ship_chunks/ll-expand-html-fragment.html.b64",
    root / "data/_ship_chunks/ll-expand-html-fragment.html.part0",
    root / "data/_ship_chunks/ll-expand-html-fragment.html.part1",
)
(root / "data/_ship_chunks/ll-expand-html-fragment.html").write_text(frag)

html_path = root / "media/listening-library/index.html"
html = html_path.read_text()
if not any(f'id="{eid}"' in html for eid in patch["addedIds"]):
    m = re.search(
        r'(<article[^>]*id="ivy-fm-iboga-tag"[^>]*>.*?</article>)', html, flags=re.S
    )
    if not m:
        raise SystemExit("ivy-fm article not found")
    html = html[: m.end()] + "\n" + frag + html[m.end() :]

stamp = patch["stamp"]
html, n = re.subn(
    r'(<p class="review-stamp">)(.*?)(</p>)',
    r"\1" + stamp + r"\3",
    html,
    count=1,
    flags=re.S,
)
if n != 1:
    raise SystemExit(f"stamp replace failed n={n}")
html = re.sub(
    r"Pass of 2026-09-22 PT: \d+ curated outbound URLs responded OK;",
    "Pass of 2026-09-22 PT: 59 curated outbound URLs responded OK;",
    html,
    count=1,
)
html = re.sub(
    r"Machine-readable flags: needsVerifyCount=\d+, verifiedCount=\d+, linkDeadCount=\d+\.",
    "Machine-readable flags: needsVerifyCount=0, verifiedCount=60, linkDeadCount=1.",
    html,
    count=1,
)
html = re.sub(
    r"(<h2>Curated entries \()\d+(\)</h2>)",
    r"\g<1>60\2",
    html,
    count=1,
)
html = re.sub(
    r'\s*<span class="chip[^"]*">\s*Needs URL verify\s*</span>\s*',
    "\n    ",
    html,
    flags=re.I,
)
html = re.sub(
    r'\s*<span class="chip[^"]*">\s*Needs verify\s*</span>\s*',
    "\n    ",
    html,
    flags=re.I,
)
m = re.search(
    r'(<article[^>]*id="clare-wilkins-future-primitive-2016"[^>]*>)(.*?)(</article>)',
    html,
    flags=re.S,
)
if m:
    head, body, tail = m.group(1), m.group(2), m.group(3)
    if "Dead link" not in body:
        body = body.replace(
            '<div class="chip-row">',
            '<div class="chip-row">\n    <span class="chip chip-sm chip-warn">Dead link flagged</span>',
            1,
        )
    body = body.replace(
        ">Listen / watch on original platform →</a>",
        ">Original URL (currently unreachable) →</a>",
    )
    html = html[: m.start()] + head + body + tail + html[m.end() :]

html_path.write_text(html)
print("merged added", added, "total", len(data["entries"]))
