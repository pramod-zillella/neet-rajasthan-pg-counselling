"""Extract the Board's 2026 provisional merit lists into privacy-limited tables."""

from __future__ import annotations

import csv
import hashlib
import json
import re
from collections import Counter
from decimal import Decimal
from pathlib import Path

import fitz
from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.table import Table, TableStyleInfo


ROOT = Path(__file__).resolve().parents[1]
PDF = ROOT / "documents/2026/merit/round-1.pdf"
SOURCE_URL = "https://pg.neetrajasthan.com/notifications/1793190366735.pdf"
SITE_URL = "https://pramod-zillella.github.io/neet-rajasthan-pg-counselling/documents/2026/merit/round-1.pdf"
SHA256 = "9330f157a453cb7ddbed7c178d55adb8e15e8aee54452ee55905eee4cf336a1f"
ROUND2_SHA256 = "a7e783432fe707cfd0e7a0bbc72ebdd63b4bd9b5ddcce17712e9e551ed9e490d"
ROUND2_SOURCE_URL = "https://pg.neetrajasthan.com/notifications/1795180258933.pdf"
EXPECTED_HEADER = [
    "S. No.", "Reg. ID", "NEET Roll No", "Name", "Gender", "Domicile",
    "Provisional Considered Category", "Additional Category (Filled)",
    "Additional Category (Verified)", "Service Status",
    "In-Service Experience (Years*) (Rural)", "Neet Rank", "Neet Marks",
    "Bonus Marks (If Applicable)", "Total Marks", "State Merit",
]
DOMICILE_REPAIRS = {
    "Madhya Prades": "Madhya Pradesh",
    "Jammu & Kashm": "Jammu and Kashmir",
    "Himachal Prade": "Himachal Pradesh",
    "Chattisgarh": "Chhattisgarh",
}
COLUMNS = [
    "year", "round", "list_serial", "registration_id", "state_merit_rank",
    "neet_pg_air", "domicile", "filled_category", "considered_category",
    "additional_category_filled", "additional_category_verified", "service_status",
    "in_service_experience_years", "neet_marks", "bonus_marks", "total_marks",
    "pdf_page",
]


def clean(value: str | None) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def number(value: str) -> int | float | None:
    text = clean(value)
    if text in {"", "NA", "-"}:
        return None
    parsed = Decimal(text)
    return int(parsed) if parsed == parsed.to_integral_value() else float(parsed)


def extract(pdf_path: Path = PDF, sha256: str = SHA256, round_number: int = 1,
            expected_pages: int = 138, expected_rows: int = 3165) -> list[dict]:
    data = pdf_path.read_bytes()
    assert hashlib.sha256(data).hexdigest() == sha256, "2026 merit PDF differs from reviewed source copy"
    result = []
    with fitz.open(stream=data, filetype="pdf") as pdf:
        assert len(pdf) == expected_pages
        for page_no, page in enumerate(pdf, 1):
            text = page.get_text()
            assert f"Page {page_no} of {expected_pages}" in text, page_no
            assert f"(Round {round_number})" in text, page_no
            tables = page.find_tables().tables
            assert len(tables) == 1, (page_no, len(tables))
            table = tables[0].extract()
            assert [clean(value) for value in table[0]] == EXPECTED_HEADER, page_no
            for raw in table[1:]:
                assert len(raw) == 16, (page_no, raw)
                serial, reg, roll, name, gender, domicile, considered, added, verified, service, years, air, marks, bonus, total, merit = map(clean, raw)
                assert serial.isdigit() and merit == serial, (page_no, serial, merit)
                assert re.fullmatch(r"PM\d{4}", reg), (page_no, serial, reg)
                assert roll.isdigit() and name and gender in {"MALE", "FEMALE", "OTHER"}
                assert domicile and considered and service in {"In-Service", "Non-Service"}
                # The final 'h' of Madhya Pradesh spills into the category cell
                # on seven source rows; the visible category is General.
                if domicile == "Madhya Prades" and considered == "hGeneral":
                    considered = "General"
                assert considered in {"General", "OBC NCL", "MBC NCL", "EWS", "SC", "ST"}, (page_no, serial, considered)
                assert air.isdigit() and marks.isdigit()
                assert number(total) is not None
                bonus_value = number(bonus)
                assert Decimal(total) == Decimal(marks) + (Decimal(bonus) if bonus_value is not None else 0), (page_no, serial, marks, bonus, total)
                experience = number(years)
                assert experience is None or isinstance(experience, int) and experience >= 0
                result.append({
                    "year": 2026, "round": f"Round {round_number}", "list_serial": int(serial),
                    "registration_id": reg, "state_merit_rank": int(merit),
                    "neet_pg_air": int(air),
                    "domicile": DOMICILE_REPAIRS.get(domicile, domicile),
                    # The PDF does not print a primary filled reservation category.
                    "filled_category": None,
                    "considered_category": considered,
                    "additional_category_filled": added,
                    "additional_category_verified": verified,
                    "service_status": service,
                    "in_service_experience_years": experience,
                    "neet_marks": int(marks), "bonus_marks": bonus_value,
                    "total_marks": number(total), "pdf_page": page_no,
                })
    assert len(result) == expected_rows
    assert [row["list_serial"] for row in result] == list(range(1, expected_rows + 1))
    assert len({row["registration_id"] for row in result}) == expected_rows
    assert len({row["neet_pg_air"] for row in result}) == expected_rows
    assert all(row["neet_pg_air"] > 0 for row in result)
    assert all(a['total_marks'] >= b['total_marks'] for a, b in zip(result, result[1:]))
    if round_number == 1:
        assert 1000 < sum(row["service_status"] == "In-Service" for row in result) < 1100
        assert 2900 < sum(row["domicile"] == "Rajasthan" for row in result) < 3000
        assert sum(row["domicile"] == "Telangana" for row in result) == 3
    assert not any("Prades" in row["domicile"] and not row["domicile"].endswith("Pradesh") for row in result)
    return result


def build() -> None:
    rounds = [extract(), extract(ROOT / 'documents/2026/merit/round-2.pdf', ROUND2_SHA256, 2, 149, 3413)]
    rows = rounds[0] + rounds[1]
    target = ROOT / "data"
    (target / "2026-merit.json").write_text(json.dumps(rows, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    with (target / "2026-merit.csv").open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=COLUMNS + ["source_pdf_url"])
        writer.writeheader()
        for row in rows:
            url = SITE_URL.replace('round-1.pdf', 'round-2.pdf') if row['round'] == 'Round 2' else SITE_URL
            writer.writerow({**row, "source_pdf_url": f"{url}#page={row['pdf_page']}"})

    # Keep the existing Round 1 workbook link stable and export each round alone.
    for round_number, rows in enumerate(rounds, 1):
        write_workbook(rows, round_number, target)
    print(f"Verified 2026 merit lists: {len(rounds[0])} Round 1 and {len(rounds[1])} Round 2 rows.")


def write_workbook(rows: list[dict], round_number: int, target: Path) -> None:
    source_url = SOURCE_URL if round_number == 1 else ROUND2_SOURCE_URL
    site_url = SITE_URL.replace('round-1.pdf', f'round-{round_number}.pdf')
    sha256 = SHA256 if round_number == 1 else ROUND2_SHA256
    date = '28 October 2026' if round_number == 1 else '20 November 2026'
    pages = 138 if round_number == 1 else 149

    wb = Workbook()
    notes = wb.active
    notes.title = "Read first"
    for line in [
        f"Rajasthan NEET-PG 2026 Round {round_number} provisional state merit list, published {date}.",
        f"{len(rows):,} rows extracted from the {pages}-page Board PDF. State merit and NEET-PG AIR are separate fields.",
        "The PDF does not print a primary filled reservation category; that column is blank. Additional category fields are printed separately.",
        "Source domicile labels clipped by the PDF were expanded only where unambiguous: Madhya Pradesh, Himachal Pradesh, Jammu and Kashmir, and Chhattisgarh.",
        "The source's Not Applicable domicile is retained; it is not classified as an out-of-state domicile.",
        "NA in the bonus and in-service experience columns is blank in this workbook; a numeric zero remains zero.",
        "Names, gender and NEET roll numbers are omitted from the searchable data; the source PDF remains linked for verification.",
        "Round 1 uses the revised 28 October list. Round 2 is provisional; absence from a later list does not establish withdrawal or joining elsewhere.",
        f"Board source: {source_url}",
        f"Verified PDF SHA-256: {sha256}",
    ]:
        notes.append([line])
    notes.column_dimensions["A"].width = 120
    ws = wb.create_sheet(f"2026 Round {round_number} Merit")
    labels = {
        "neet_pg_air": "NEET-PG AIR", "considered_category": "Provisional Considered Category",
        "additional_category_filled": "Additional Category (Filled)",
        "additional_category_verified": "Additional Category (Verified)",
        "service_status": "Service / Non-Service", "pdf_page": "Source PDF Page",
    }
    ws.append([labels.get(column, column.replace("_", " ").title()) for column in COLUMNS])
    for excel_row, row in enumerate(rows, 2):
        ws.append([row[column] for column in COLUMNS])
        link = ws.cell(excel_row, COLUMNS.index("pdf_page") + 1)
        link.hyperlink = f"{site_url}#page={row['pdf_page']}"
        link.font = Font(color="0A6B69", underline="single")
    ws.freeze_panes = "E2"
    ws.auto_filter.ref = ws.dimensions
    ws.sheet_view.showGridLines = False
    for cell in ws[1]:
        cell.font = Font(bold=True, color="FFFFFF")
        cell.fill = PatternFill("solid", fgColor="184D55")
        cell.alignment = Alignment(vertical="center")
    ws.row_dimensions[1].height = 25
    widths = {"registration_id": 20, "domicile": 24, "considered_category": 29,
              "additional_category_filled": 26, "additional_category_verified": 46,
              "service_status": 22, "in_service_experience_years": 27, "round": 18}
    for index, column in enumerate(COLUMNS, 1):
        ws.column_dimensions[get_column_letter(index)].width = widths.get(column, 18)
    table = Table(displayName=f"Merit2026Round{round_number}", ref=ws.dimensions)
    table.tableStyleInfo = TableStyleInfo(name="TableStyleMedium2", showRowStripes=True)
    ws.add_table(table)
    wb.save(target / f"Rajasthan-NEET-PG-2026-Round-{round_number}-merit.xlsx")
    print(f"Verified 2026 Round {round_number} provisional merit: {len(rows)} rows, {pages} pages, {len(set(row['domicile'] for row in rows))} domicile labels.")
    print("Considered categories:", dict(Counter(row["considered_category"] for row in rows)))


if __name__ == "__main__":
    build()
