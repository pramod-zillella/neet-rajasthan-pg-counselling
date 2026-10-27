"""Check public document integrity and local site links before publishing."""

from __future__ import annotations

import hashlib
import json
import csv
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit

from openpyxl import load_workbook


ROOT = Path(__file__).resolve().parents[1]


class Links(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.paths: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attrs_dict = dict(attrs)
        target = attrs_dict.get("href") or attrs_dict.get("src")
        if target and not urlsplit(target).scheme and not target.startswith(("#", "//")):
            self.paths.append(urlsplit(target).path)


def main() -> None:
    manifest = json.loads((ROOT / "data" / "documents.json").read_text(encoding="utf-8"))
    docs = manifest["documents"]
    assert len(docs) == 18, f"Expected 18 round records, got {len(docs)}"
    assert sum(d["kind"] == "merit" for d in docs) == 9
    assert sum(d["kind"] == "allotment" and bool(d["path"]) for d in docs) == 7
    assert sum(d["status"] == "archive-only" for d in docs) == 2
    local_pdfs = set()
    for doc in docs:
        assert doc["sourceUrl"].startswith("http"), doc
        if not doc["path"]:
            assert doc["archiveUrl"].startswith("https://web.archive.org/"), doc
            continue
        path = ROOT / doc["path"]
        assert path.is_file(), path
        assert path.read_bytes().startswith(b"%PDF"), path
        assert hashlib.sha256(path.read_bytes()).hexdigest().lower() == doc["sha256"].lower(), path
        assert path.stat().st_size < 100 * 1024 * 1024, path
        local_pdfs.add(path)
        if doc.get("alternatePath"):
            alternate = ROOT / doc["alternatePath"]
            assert alternate.is_file(), alternate
            local_pdfs.add(alternate)

    for html in ROOT.glob("*.html"):
        parser = Links()
        parser.feed(html.read_text(encoding="utf-8"))
        for relative in parser.paths:
            assert (html.parent / relative).is_file(), f"Broken local link: {html.name} -> {relative}"

    assert len(local_pdfs) == 17
    expected = {(2024,"merit"):16914, (2024,"allotment"):4969,
                (2025,"merit"):13221, (2025,"allotment"):5520}
    rows_by_key = {}
    for (year, kind), count in expected.items():
        stem = f"{year}-{kind}"
        rows = json.loads((ROOT / "data" / f"{stem}.json").read_text(encoding="utf-8"))
        assert len(rows) == count, stem
        assert all(row["year"] == year and row["domicile"] and row["considered_category"] for row in rows), stem
        assert all(row["pdf_page"] > 0 for row in rows), stem
        if kind == "allotment":
            assert all(row["college"] and row["course"] and row["seat_type"] and row["service_status"] for row in rows), stem
        if year == 2025:
            assert all("General" not in row["domicile"] and "OBC" not in row["domicile"] for row in rows), stem
        assert all(row["neet_pg_air"] is None for row in rows) if year == 2024 else all(row["neet_pg_air"] for row in rows), stem
        with (ROOT / "data" / f"{stem}.csv").open(encoding="utf-8-sig", newline="") as stream:
            reader = csv.DictReader(stream)
            assert "source_pdf_url" in reader.fieldnames
            assert sum(1 for _ in reader) == count
        rows_by_key[(year,kind)] = rows

    for year in (2024, 2025):
        merit = {(r["round"], r["registration_id"]): r for r in rows_by_key[(year,"merit")]}
        for allot in rows_by_key[(year,"allotment")]:
            source = merit[(allot["round"], allot["registration_id"])]
            assert allot["merit_number"] == source["state_merit_rank"]
            assert allot["neet_pg_air"] == source["neet_pg_air"]
            assert allot["domicile"] == source["domicile"]
            assert allot["considered_category"] == source["considered_category"]
            assert allot["service_status"] == source["service_status"]

    workbook = load_workbook(ROOT / "data" / "Rajasthan-NEET-PG-2024-2025-filterable.xlsx", read_only=False)
    for (year, kind), count in expected.items():
        sheet = workbook[f"{year} {'Merit' if kind == 'merit' else 'Allotments'}"]
        assert sheet.max_row == count + 1
        headers = [cell.value for cell in sheet[1]]
        assert "Provisional Considered Category" in headers and "Service / Non-Service" in headers
        if kind == "allotment":
            assert "Allotted Seat Type" in headers
        page_col = headers.index("Source PDF Page") + 1
        assert sheet.cell(2, page_col).hyperlink.target.startswith("https://pramod-zillella.github.io/")
    print("Verified 40,624 table rows, round/AIR joins, Excel links, 17 PDFs and site links.")


if __name__ == "__main__":
    main()
