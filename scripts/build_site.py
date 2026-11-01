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
MERIT_2026_SHA256 = "9330f157a453cb7ddbed7c178d55adb8e15e8aee54452ee55905eee4cf336a1f"
MERIT_2026_SOURCE = "https://pg.neetrajasthan.com/notifications/1793190366735.pdf"
ALLOTMENT_2026_SHA256 = "4e5d9e657ba3f5a3cc3c31a24837c07311b49d61062b250adc236d9207037abc"
ALLOTMENT_2026_SOURCE = "https://pg.neetrajasthan.com/notifications/1793436152872.pdf"
MCC_2026_SHA256 = "0cc737b10d3b6fc23ee4d814a18736f786ac3f1ed4d46538a4f670f013b482ac"
MCC_2026_SOURCE = "https://cdnbbsr.s3waas.gov.in/s3e0f7a4d0ef9b84b83b693bbf3feb8e6e/uploads/2026/10/202610241746468472.pdf"


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

    merit26 = ROOT / "documents" / "2026" / "merit" / "round-1.pdf"
    if digest(merit26) != MERIT_2026_SHA256:
        raise ValueError(f"2026 merit PDF differs from verified Board copy: {merit26}")
    docs.append({
        "year": 2026, "kind": "merit", "round": "Round 1", "roundKey": "round-1",
        "order": 1, "date": "28 Oct 2026", "pages": 138, "entries": 3165,
        "path": merit26.relative_to(ROOT).as_posix(), "status": "available",
        "sha256": MERIT_2026_SHA256, "sourceUrl": MERIT_2026_SOURCE,
        "archiveUrl": None,
        "alternatePath": "documents/2026/merit/round-1-27-oct.pdf",
        "note": "Revised provisional Round 1 state merit list; replaces the 27 Oct version of 3,160 entries. Later revisions may follow.",
    })

    allot26 = ROOT / "documents" / "2026" / "allotment" / "round-1.pdf"
    if digest(allot26) != ALLOTMENT_2026_SHA256:
        raise ValueError(f"2026 allotment PDF differs from Board copy: {allot26}")
    docs.append({
        "year": 2026, "kind": "allotment", "round": "Round 1", "roundKey": "round-1",
        "order": 1, "date": "31 Oct 2026", "pages": 53, "entries": 1366,
        "path": allot26.relative_to(ROOT).as_posix(), "status": "available",
        "sha256": ALLOTMENT_2026_SHA256, "sourceUrl": ALLOTMENT_2026_SOURCE,
        "archiveUrl": None,
        "note": "Indicative Round 1 result; Board invited grievances until 1 Nov 2026. Not a final joining record.",
    })

    mcc26 = ROOT / "documents" / "2026" / "mcc" / "round-1.pdf"
    if digest(mcc26) != MCC_2026_SHA256:
        raise ValueError(f"MCC 2026 PDF differs from final Round 1 copy: {mcc26}")
    docs.append({
        "year": 2026, "kind": "mcc", "round": "Round 1", "roundKey": "round-1",
        "order": 1, "date": "24 Oct 2026", "pages": 1735, "entries": 28723,
        "path": mcc26.relative_to(ROOT).as_posix(), "status": "available",
        "sha256": MCC_2026_SHA256, "sourceUrl": MCC_2026_SOURCE,
        "archiveUrl": None,
        "note": "MCC final Round 1 result across all MCC quota types; separate from Rajasthan Board allotments.",
    })

    docs.sort(key=lambda item: (-item["year"], item["kind"], item["order"]))
    (ROOT / "data").mkdir(parents=True, exist_ok=True)
    manifest = {
        "built": date.today().isoformat(),
        "sourceSnapshot": "24 Oct 2026 (2024 files); 20 Oct 2026 (2025 files); 28 Oct 2026 (revised merit); 31 Oct 2026 (indicative Rajasthan allotment); 24 Oct 2026 (MCC final Round 1)",
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
