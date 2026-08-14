#!/usr/bin/env python3
"""Apply computed public stats to static HTML surfaces."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_all(path: Path, replacements: list[tuple[str, str]]) -> bool:
    text = path.read_text(encoding="utf-8")
    original = text
    for old, new in replacements:
        text = text.replace(old, new)
    if text != original:
        path.write_text(text, encoding="utf-8")
        return True
    return False


def coverage_block(stats: dict, coverage: dict) -> str:
    topics = "".join(
        f'<li><a href="{topic["path"]}">{topic["name"]}</a> · {topic["status"]}</li>'
        for topic in coverage["topics"]
    )
    review = coverage["underReview"][0]
    return f"""<div class="coverage-dashboard" aria-label="Coverage audit dashboard" data-coverage-dashboard>
    <article><span>Canonical topics</span><strong data-coverage-stat="canonicalTopics">{stats["canonicalTopics"]}</strong><p>required history, culture, safety, law, evidence, and media pages</p></article>
<article><span>Mapped</span><strong data-coverage-stat="mapped">{stats["mappedTopics"]}</strong><p>published HTML page exists and is linked</p></article>
<article><span>Under review</span><strong data-coverage-stat="underReview">{stats["underReviewItems"]}</strong><p>named reviewers pending consent</p></article>
<article><span>Sources</span><strong data-coverage-stat="publicSearchRecords">{stats["publicSearchRecords"]}</strong><p>public records indexed for search</p></article>
  </div>
  <p class="section-note">Mapped {stats["mappedTopics"]} of {stats["canonicalTopics"]} means each listed topic has a public page. The previous “Mapped 0” figure was a hardcoded widget value, not an empty site. Under review is {review["name"].lower()}, not an unmapped topic. Machine-readable copy: <a href="/data/coverage-audit.json">coverage-audit.json</a>.</p>
  <ul class="coverage-topic-list" data-coverage-topics>{topics}<li>{review["name"]} · under review</li></ul>"""


def main() -> None:
    stats = json.loads((ROOT / "data" / "site-stats.json").read_text(encoding="utf-8"))
    coverage = json.loads((ROOT / "data" / "coverage-audit.json").read_text(encoding="utf-8"))
    new_coverage = coverage_block(stats, coverage)
    changed = []

    for path in ROOT.rglob("*.html"):
        if ".git" in path.parts:
            continue
        reps = [
            (
                "Reviewed 2026-05-18 · Educational reference. Not medical advice.",
                f"Reviewed {stats['lastReviewed']} · Educational reference. Not medical advice.",
            ),
            (
                "LAST REVIEWED 2026-06-30 · 815 SOURCES · 0 CORRECTIONS",
                f"LAST REVIEWED {stats['lastReviewed']} · {stats['publicSearchRecords']} SOURCES · 0 CORRECTIONS",
            ),
            (
                "LAST REVIEWED 2026-05-18 · 815 SOURCES · 0 CORRECTIONS",
                f"LAST REVIEWED {stats['lastReviewed']} · {stats['publicSearchRecords']} SOURCES · 0 CORRECTIONS",
            ),
            (
                "Educational reference only; not medical advice and not legal advice. Last updated 2026-05-18.",
                f"Educational reference only; not medical advice and not legal advice. Last reviewed {stats['lastReviewed']}.",
            ),
        ]
        if replace_all(path, reps):
            changed.append(str(path.relative_to(ROOT)))

    home = ROOT / "index.html"
    home_text = home.read_text(encoding="utf-8")
    home_text = home_text.replace(
        '<p class="stamp-row"><span>Last full review · 2026-05-18</span><span>815 sources indexed</span><span>4 claim checks</span><span>2 corrections logged</span></p>',
        (
            '<p class="stamp-row" data-public-stats>'
            f'<span data-stat="lastReviewed">Last full review · {stats["lastReviewed"]}</span>'
            f'<span data-stat="catalogGeneratedAt">Catalog generated · {stats["catalogGeneratedAt"]}</span>'
            f'<span data-stat="publicSearchRecords">{stats["publicSearchRecords"]} sources indexed</span>'
            f'<span data-stat="claimChecksPublished">{stats["claimChecksPublished"]} claim checks</span>'
            "</p>"
        ),
    )
    home.write_text(home_text, encoding="utf-8")
    changed.append("index.html")

    old_dash = """<div class="coverage-dashboard" aria-label="Coverage audit dashboard">
    <article><span>Canonical topics</span><strong>27</strong><p>required history, culture, safety, law, and media coverage</p></article>
<article><span>Mapped</span><strong>0</strong><p>visible or searchable in the current site</p></article>
<article><span>Under review</span><strong>1</strong><p>known gaps or items needing stronger sources</p></article>
<article><span>Sources</span><strong>815</strong><p>public records indexed for search</p></article>
  </div>"""
    for rel in ("visuals/index.html", "sources/index.html"):
        path = ROOT / rel
        text = path.read_text(encoding="utf-8")
        if old_dash not in text:
            raise SystemExit(f"Coverage dashboard block not found in {rel}")
        path.write_text(text.replace(old_dash, new_coverage), encoding="utf-8")
        changed.append(rel)

    sources = ROOT / "sources" / "index.html"
    sources_text = sources.read_text(encoding="utf-8")
    sources_reps = [
        (
            '<div class="source-total"><span>Sources indexed</span><strong>815</strong></div>',
            f'<div class="source-total"><span>Sources indexed</span><strong data-stat="publicSearchRecords">{stats["publicSearchRecords"]}</strong></div>',
        ),
        (
            "<span>Podcasts and interviews</span>\n      <strong>426</strong>",
            "<span>Podcasts and interviews</span>\n      <strong>431</strong>",
        ),
        (
            "<span>Evidence pages</span>\n      <strong>8</strong>\n    </article></section>",
            "<span>Evidence pages</span>\n      <strong>8</strong>\n    </article>\n<article>\n      <span>Weekly brief</span>\n      <strong>5</strong>\n    </article>\n<article>\n      <span>Documentaries and films</span>\n      <strong>2</strong>\n    </article></section>",
        ),
        (
            "<p><strong>Youtube Video</strong><span>274</span></p><p><strong>Journalism</strong><span>242</span></p><p><strong>Podcast Interview</strong><span>143</span></p>",
            "<p><strong>Youtube Video</strong><span>278</span></p><p><strong>Journalism</strong><span>242</span></p><p><strong>Podcast Interview</strong><span>144</span></p>",
        ),
        (
            "<p><strong>Media metadata</strong><span>418</span></p>",
            "<p><strong>Media metadata</strong><span>423</span></p>",
        ),
    ]
    if replace_all(sources, sources_reps):
        changed.append("sources/index.html")

    print("updated", len(set(changed)), "files")
    for item in sorted(set(changed)):
        print(" ", item)


if __name__ == "__main__":
    main()
