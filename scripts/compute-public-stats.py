#!/usr/bin/env python3
"""Compute public display stats from catalog files. Do not invent counts."""

from __future__ import annotations

import csv
import json
from collections import Counter
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"

CATEGORY_LABELS = {
    "books_bibliographies": "Books and bibliographies",
    "clinical_trials": "Clinical trials",
    "clinics": "Clinics",
    "companies_patents": "Companies and patents",
    "culture_stewardship": "Culture and stewardship",
    "documentaries_films": "Documentaries and films",
    "evidence_pages": "Evidence pages",
    "laws_policy": "Laws and policy",
    "news_articles_blogs": "News, articles, and blogs",
    "podcasts_interviews": "Podcasts and interviews",
    "reference_pages": "Reference pages",
    "state_policy_coverage": "State policy coverage",
    "studies_papers": "Studies and papers",
    "weekly_brief": "Weekly brief",
}

# Public topic spine already published as HTML pages. Mapped means the page
# exists on disk and is linked from the site index / reference lanes.
CANONICAL_TOPICS = [
    {"id": "iboga", "name": "Iboga", "group": "reference", "path": "/reference/iboga/"},
    {"id": "ibogaine", "name": "Ibogaine", "group": "reference", "path": "/reference/ibogaine/"},
    {"id": "noribogaine", "name": "Noribogaine", "group": "reference", "path": "/reference/noribogaine-analogs/"},
    {"id": "analogs", "name": "Analogs", "group": "reference", "path": "/reference/analogs/"},
    {"id": "safety-qtc", "name": "Ibogaine safety and QTc", "group": "reference", "path": "/reference/ibogaine-safety-qtc/"},
    {"id": "evidence-by-condition", "name": "Evidence by condition", "group": "reference", "path": "/reference/evidence-by-condition/"},
    {"id": "oud-reference", "name": "Opioid use disorder (reference)", "group": "reference", "path": "/reference/opioid-use-disorder/"},
    {"id": "parkinsons-neurology", "name": "Parkinson's, TBI, and neurology", "group": "reference", "path": "/reference/parkinsons-neurology/"},
    {"id": "policy-law", "name": "Law and policy", "group": "reference", "path": "/reference/policy-law/"},
    {"id": "culture-stewardship", "name": "Culture, history, and stewardship", "group": "reference", "path": "/reference/culture-stewardship/"},
    {"id": "podcasts-media", "name": "Podcasts and media", "group": "reference", "path": "/reference/podcasts-media/"},
    {"id": "clinic-claims", "name": "Clinic claims and adverse events", "group": "reference", "path": "/reference/clinic-claims-adverse-events/"},
    {"id": "oud", "name": "Opioid use disorder (evidence)", "group": "evidence", "path": "/evidence/oud/"},
    {"id": "aud", "name": "Alcohol use disorder", "group": "evidence", "path": "/evidence/aud/"},
    {"id": "tbi", "name": "Traumatic brain injury", "group": "evidence", "path": "/evidence/tbi/"},
    {"id": "ptsd", "name": "PTSD and trauma symptoms", "group": "evidence", "path": "/evidence/ptsd/"},
    {"id": "depression", "name": "Depression and mood", "group": "evidence", "path": "/evidence/depression/"},
    {"id": "parkinsons", "name": "Parkinson's disease", "group": "evidence", "path": "/evidence/parkinsons/"},
    {"id": "withdrawal", "name": "Withdrawal", "group": "evidence", "path": "/evidence/withdrawal/"},
    {"id": "cravings", "name": "Cravings", "group": "evidence", "path": "/evidence/cravings/"},
    {"id": "safety-desk", "name": "Safety desk", "group": "desk", "path": "/safety/"},
    {"id": "culture-desk", "name": "Culture desk", "group": "desk", "path": "/culture/"},
    {"id": "policy-desk", "name": "Policy desk", "group": "desk", "path": "/policy/"},
    {"id": "media-desk", "name": "Media library", "group": "desk", "path": "/media/"},
    {"id": "trials", "name": "Clinical trials", "group": "desk", "path": "/trials/"},
    {"id": "trackers", "name": "Trackers", "group": "desk", "path": "/trackers/"},
    {"id": "claim-checks", "name": "Claim checks", "group": "claims", "path": "/claims/"},
]


def title_label(value: str) -> str:
    if not value:
        return "Unlabeled"
    if " " in value or value[:1].isupper():
        return value
    return " ".join(part.capitalize() for part in value.replace("-", "_").split("_"))


def page_exists(url_path: str) -> bool:
    relative = url_path.strip("/")
    return (ROOT / relative / "index.html").is_file()


def main() -> None:
    completeness = json.loads((DATA / "site-completeness.json").read_text(encoding="utf-8"))
    search = json.loads((DATA / "public-search-index.json").read_text(encoding="utf-8"))
    with (DATA / "source-catalog.csv").open(newline="", encoding="utf-8") as handle:
        catalog_rows = list(csv.DictReader(handle))

    search_records = search.get("records") or []
    search_total = len(search_records)
    if search.get("totalRecords") not in (None, search_total):
        raise SystemExit(
            f"public-search-index totalRecords {search.get('totalRecords')} != len(records) {search_total}"
        )

    podcast_count = sum(1 for row in search_records if row.get("category") == "podcasts_interviews")
    claim_pages = sorted(
        path.parent.name
        for path in (ROOT / "claims").glob("*/index.html")
        if path.parent.name != "claims"
    )

    topics = []
    for topic in CANONICAL_TOPICS:
        mapped = page_exists(topic["path"])
        topics.append({**topic, "status": "mapped" if mapped else "unmapped"})

    mapped_count = sum(1 for topic in topics if topic["status"] == "mapped")
    unmapped_count = len(topics) - mapped_count
    under_review = [
        {
            "id": "named-reviewers",
            "name": "Named external reviewers",
            "status": "under_review",
            "note": "Editorial board roles are public; named medical, cultural, and legal reviewers stay unpublished until consent.",
        }
    ]

    categories = {
        CATEGORY_LABELS.get(key, title_label(key)): count
        for key, count in sorted((search.get("categories") or {}).items())
    }
    source_types = Counter(title_label(row.get("sourceType") or "") for row in search_records)
    confidence = Counter(row.get("confidence") or "Unlabeled" for row in search_records)

    stats = {
        "generatedAt": date.today().isoformat(),
        "lastReviewed": completeness.get("lastReviewed"),
        "completenessOverall": completeness.get("overall"),
        "catalogGeneratedAt": (search.get("generatedAt") or "")[:10],
        "catalogRecords": len(catalog_rows),
        "catalogSource": "data/source-catalog.csv",
        "publicSearchRecords": search_total,
        "publicSearchSource": "data/public-search-index.json",
        "podcastInterviewRecords": podcast_count,
        "claimChecksPublished": len(claim_pages),
        "claimCheckSlugs": claim_pages,
        "correctionsLogged": 0,
        "canonicalTopics": len(topics),
        "mappedTopics": mapped_count,
        "unmappedTopics": unmapped_count,
        "underReviewItems": len(under_review),
        "notes": [
            "Display 'sources indexed' as publicSearchRecords. That is the file the public search box loads.",
            "catalogRecords is the CSV/BibTeX export (815). It is 5 records behind the 2026-07-15 public search index (820).",
            "site-quality-report.md previously listed 1182 source records and 643 podcast/interview records. Those totals are not reproducible from the published catalog files and are not shown on public pages.",
            "lastReviewed comes from data/site-completeness.json. It is the latest published completeness snapshot, not a new medical review.",
            "correctionsLogged is 0 because no public correction-log file is published.",
        ],
    }

    coverage = {
        "generatedAt": stats["generatedAt"],
        "lastReviewed": stats["lastReviewed"],
        "explanation": (
            "The previous public widget showed Canonical topics 27 / Mapped 0 / Under review 1 / Sources 815. "
            "Mapped 0 was a hardcoded generator value, not an empty site. This audit lists the 27 published "
            "topic pages (12 reference, 8 evidence conditions, 6 desks, 1 claim-check index) and marks each "
            "mapped only when the HTML page exists. Under review is the standing named-reviewer gap, not an unmapped topic."
        ),
        "counts": {
            "canonicalTopics": len(topics),
            "mapped": mapped_count,
            "unmapped": unmapped_count,
            "underReview": len(under_review),
            "publicSearchRecords": search_total,
        },
        "topics": topics,
        "underReview": under_review,
    }

    counts = {
        "generatedAt": search.get("generatedAt"),
        "totalRecords": search_total,
        "sourceFile": "data/public-search-index.json",
        "catalogExportRecords": len(catalog_rows),
        "catalogExportFile": "data/source-catalog.csv",
        "categories": categories,
        "sourceTypes": dict(source_types.most_common()),
        "confidence": dict(confidence.most_common()),
    }

    (DATA / "site-stats.json").write_text(json.dumps(stats, indent=2) + "\n", encoding="utf-8")
    (DATA / "coverage-audit.json").write_text(json.dumps(coverage, indent=2) + "\n", encoding="utf-8")
    (DATA / "source-type-counts.json").write_text(json.dumps(counts, indent=2) + "\n", encoding="utf-8")

    print(json.dumps({
        "lastReviewed": stats["lastReviewed"],
        "catalogRecords": stats["catalogRecords"],
        "publicSearchRecords": stats["publicSearchRecords"],
        "podcastInterviewRecords": stats["podcastInterviewRecords"],
        "claimChecksPublished": stats["claimChecksPublished"],
        "canonicalTopics": stats["canonicalTopics"],
        "mappedTopics": stats["mappedTopics"],
        "unmappedTopics": stats["unmappedTopics"],
        "underReviewItems": stats["underReviewItems"],
        "topCategories": list(categories.items())[:8],
        "topSourceTypes": source_types.most_common(8),
        "topConfidence": confidence.most_common(8),
    }, indent=2))


if __name__ == "__main__":
    main()
