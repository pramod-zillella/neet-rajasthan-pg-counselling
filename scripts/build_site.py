"""Build the public Rajasthan NEET-PG document archive from researched sources.

Usage (from this repository):
    python scripts/build_site.py
    python scripts/build_site.py --source ../neet-specialty-knowledge-base/exports

Only Board-issued PDF copies and a document manifest are published. Candidate-level
derived CSVs, workbooks, and research caches are deliberately not copied.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import shutil
from datetime import date
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]

MERIT_2024 = {
    "Round 1": ("round-1", 1),
    "Round 2": ("round-2", 2),
    "Round 3": ("round-3", 3),
    "Stray vacancy — revised eligible list": ("stray", 4),
    "Special stray vacancy": ("special-stray", 5),
}
ALLOT_2024 = {
    "Round 1": ("round-1", 1),
    "Round 2": ("round-2", 2),
    "Round 3": ("round-3", 3),
    "Stray vacancy": ("stray", 4),
    "Special stray vacancy": ("special-stray", 5),
}
MERIT_2025 = {
    "merit-r1": ("Round 1", "round-1", 1, "23 Nov 2025", 3706),
    "merit-r2": ("Round 2", "round-2", 2, "17 Dec 2025", 3830),
    "merit-r3": ("Round 3", "round-3", 3, "15 Feb 2026", 5289),
    "merit-r4": ("Stray vacancy", "stray", 4, "24 Feb 2026", 396),
}
ALLOT_2025 = {
    "drive-r1-allotment": ("Round 1", "round-1", 1, "6 Dec 2025", 1604),
    "drive-r2-allotment": ("Round 2", "round-2", 2, "26 Dec 2025", 1551),
    "drive-r3-allotment": ("Round 3", "round-3", 3, "Date unverified", 2145),
    "drive-r4-allotment": ("Stray vacancy", "stray", 4, "25 Feb 2026", 220),
}


def csv_rows(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8-sig", newline="") as stream:
        return list(csv.DictReader(stream))


def digest(path: Path) -> str:
    hashed = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            hashed.update(block)
    return hashed.hexdigest()


def copy_verified(source: Path, destination: Path, expected: str) -> str:
    if not source.is_file():
        raise FileNotFoundError(source)
    actual = digest(source)
    if not expected or actual.lower() != expected.lower():
        raise ValueError(f"SHA256 mismatch for {source}: {actual} != {expected}")
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, destination)
    return destination.relative_to(ROOT).as_posix()


def build(source_root: Path) -> list[dict]:
    docs: list[dict] = []
    root24 = source_root / "rajasthan-pg2024"
    root25 = source_root / "rajasthan-pg2025" / "merit-and-air"

    for row in csv_rows(root24 / "merit-lists" / "sources.csv"):
        label = row["round"]
        if label not in MERIT_2024:
            continue  # Earlier, superseded stray version is linked from the revised card.
        slug, order = MERIT_2024[label]
        filename = row["filename"]
        local = copy_verified(
            root24 / "merit-lists" / filename,
            ROOT / "documents" / "2024" / "merit" / f"{slug}.pdf",
            row["sha256"],
        )
        docs.append({
            "year": 2024, "kind": "merit", "round": label,
            "roundKey": slug, "order": order, "date": row["document_date"],
            "pages": int(row["pages"]), "entries": int(row["listed_entries"]),
            "path": local, "status": "available", "sha256": row["sha256"],
            "sourceUrl": row["source_url"], "archiveUrl": row["archive_url"],
            "note": "State merit numbers only; NEET-PG All India Rank is not shown.",
        })

    old_stray = next(
        row for row in csv_rows(root24 / "merit-lists" / "sources.csv")
        if row["earlier_version"].lower() == "true"
    )
    old_path = copy_verified(
        root24 / "merit-lists" / old_stray["filename"],
        ROOT / "documents" / "2024" / "merit" / "stray-earlier-version.pdf",
        old_stray["sha256"],
    )
    next(doc for doc in docs if doc["year"] == 2024 and doc["roundKey"] == "stray").update({
        "alternatePath": old_path,
        "alternateLabel": "Earlier provisional version, 28 Feb 2025",
    })

    for row in csv_rows(root24 / "sources.csv"):
        label = row["round"]
        slug, order = ALLOT_2024[label]
        filename = row["filename"]
        available = bool(filename)
        local = None
        if available:
            local = copy_verified(
                root24 / filename,
                ROOT / "documents" / "2024" / "allotment" / f"{slug}.pdf",
                row["sha256"],
            )
        docs.append({
            "year": 2024, "kind": "allotment", "round": label,
            "roundKey": slug, "order": order, "date": row["document_date"] or "Not verified",
            "pages": int(row["pages"]) if row["pages"] else None,
            "entries": int(row["allotment_rows"]) if row["allotment_rows"] else None,
            "path": local, "status": "available" if available else "archive-only",
            "sha256": row["sha256"] or None, "sourceUrl": row["source_url"],
            "archiveUrl": row["archive_url"],
            "note": "Provisional allotments; not final admissions."
            if available else "Archived source is indexed, but a complete local PDF was not verified.",
        })

    rows25 = {row["Source_ID"]: row for row in csv_rows(root25 / "sources.csv")}
    for source_id, (label, slug, order, doc_date, count) in MERIT_2025.items():
        row = rows25[source_id]
        local = copy_verified(
            root25 / row["Local_file"],
            ROOT / "documents" / "2025" / "merit" / f"{slug}.pdf",
            row["SHA256"],
        )
        docs.append({
            "year": 2025, "kind": "merit", "round": label,
            "roundKey": slug, "order": order, "date": doc_date,
            "pages": int(row["PDF_pages"]), "entries": count,
            "path": local, "status": "available", "sha256": row["SHA256"],
            "sourceUrl": row["URL"], "archiveUrl": None,
            "note": "Shows both state merit rank and NEET-PG All India Rank. Provisional list.",
        })

    for source_id, (label, slug, order, doc_date, count) in ALLOT_2025.items():
        row = rows25[source_id]
        local = copy_verified(
            root25 / row["Local_file"],
            ROOT / "documents" / "2025" / "allotment" / f"{slug}.pdf",
            row["SHA256"],
        )
        note = "Provisional allotments; not final admissions."
        if slug == "round-3":
            note = ("Recovered copy has 74 physical pages, while page footers say ‘of 125’. "
                    "Completeness and the document date are unverified.")
        docs.append({
            "year": 2025, "kind": "allotment", "round": label,
            "roundKey": slug, "order": order, "date": doc_date,
            "pages": int(row["PDF_pages"]), "entries": count,
            "path": local, "status": "available", "sha256": row["SHA256"],
            "sourceUrl": row["URL"], "archiveUrl": None,
            "note": note,
        })

    docs.sort(key=lambda item: (-item["year"], item["kind"], item["order"]))
    (ROOT / "data").mkdir(parents=True, exist_ok=True)
    manifest = {
        "built": date.today().isoformat(),
        "sourceSnapshot": "24 Oct 2026 (2024 files); 20 Oct 2026 (2025 files)",
        "documents": docs,
    }
    (ROOT / "data" / "documents.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    return docs


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--source", type=Path,
        default=ROOT.parent / "neet-specialty-knowledge-base" / "exports",
        help="Directory containing rajasthan-pg2024 and rajasthan-pg2025",
    )
    args = parser.parse_args()
    built = build(args.source.resolve())
    print(f"Verified and built {len(built)} document records; "
          f"{sum(bool(doc['path']) for doc in built)} local PDFs.")
