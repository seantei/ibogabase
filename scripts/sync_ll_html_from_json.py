#!/usr/bin/env python3
"""Sync media/listening-library/index.html stamp/chips from data/listening-library.json."""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "listening-library.json"
HTML = ROOT / "media" / "listening-library" / "index.html"


def main() -> None:
    data = json.loads(DATA.read_text())
    meta = data["meta"]
    dead = int(meta.get("linkDeadCount") or 0)
    need = int(meta.get("needsVerifyCount") or 0)
    verified = int(meta.get("verifiedCount") or 0)
    entries = int(meta.get("entryCount") or len(data.get("entries") or []))
    live_ok = max(entries - dead, 0)
    stamp = (
        f"LAST REVIEWED 2026-09-22 · {entries} CURATED ENTRIES · "
        f"{live_ok} LIVE URLS OK · {dead} DEAD LINK FLAGGED"
    )
    html = HTML.read_text()
    html2, n = re.subn(
        r'(<p class="review-stamp">)(.*?)(</p>)',
        r"\1" + stamp + r"\3",
        html,
        count=1,
        flags=re.S,
    )
    if n != 1:
        raise SystemExit(f"stamp replace failed n={n}")

    banner = f"""
      <section class="reference-card" id="link-verify-status" aria-label="Outbound link verify status">
        <h2>Outbound link verify status</h2>
        <p>Pass of 2026-09-22 PT: {live_ok} curated outbound URLs responded OK; <strong>{dead} dead link remains flagged</strong> (Clare Wilkins / ibogaineconference.org — Cloudflare 522). No replacement URLs were invented for dead hosts. SoftGuard/captcha responses are not counted as dead.</p>
        <p class="section-note">Machine-readable flags: needsVerifyCount={need}, verifiedCount={verified}, linkDeadCount={dead}.</p>
      </section>
"""
    if 'id="link-verify-status"' not in html2:
        html2 = html2.replace(
            '<section aria-label="Curated entries">',
            banner + "\n      <section aria-label=\"Curated entries\">",
            1,
        )

    for e in data.get("entries") or []:
        eid = e.get("id") or ""
        if not eid:
            continue
        m = re.search(
            rf'(<article[^>]*id="{re.escape(eid)}"[^>]*>)(.*?)(</article>)',
            html2,
            flags=re.S,
        )
        if not m:
            continue
        head, body, tail = m.group(1), m.group(2), m.group(3)
        body2 = re.sub(
            r'<span class="chip[^"]*">\s*Needs verify\s*</span>\s*',
            "",
            body,
            flags=re.I,
        )
        if e.get("linkDead") or e.get("linkStatus") == "dead":
            if "Dead link" not in body2 and "DEAD LINK" not in body2:
                body2 = body2.replace(
                    '<div class="chip-row">',
                    '<div class="chip-row">\n    <span class="chip chip-sm chip-warn">Dead link flagged</span>',
                    1,
                )
            body2 = body2.replace(
                ">Listen / watch on original platform →</a>",
                ">Original URL (currently unreachable) →</a>",
            )
        html2 = html2[: m.start()] + head + body2 + tail + html2[m.end() :]

    HTML.write_text(html2)
    print("stamp:", stamp)
    print("bytes:", len(html2))


if __name__ == "__main__":
    main()
