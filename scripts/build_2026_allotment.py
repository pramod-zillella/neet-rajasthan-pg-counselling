"""Build privacy-limited Rajasthan/MCC 2026 Round 1 allotment tables."""

from __future__ import annotations

import csv
import hashlib
import json
import re
from collections import Counter
from pathlib import Path

import fitz
from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.table import Table, TableStyleInfo

from mcc_2026_source import SOURCE_URL as MCC_URL, SHA256 as MCC_SHA256, extract as extract_mcc

ROOT = Path(__file__).resolve().parents[1]
RAJASTHAN_PDF = ROOT / "documents/2026/allotment/round-1.pdf"
MCC_PDF = ROOT / "documents/2026/mcc/round-1.pdf"
RAJASTHAN_URL = "https://pg.neetrajasthan.com/notifications/1793436152872.pdf"
RAJASTHAN_SHA256 = "4e5d9e657ba3f5a3cc3c31a24837c07311b49d61062b250adc236d9207037abc"
SITE = "https://pramod-zillella.github.io/neet-rajasthan-pg-counselling/"
HEADERS = ["S. No.", "Reg ID", "NEET Roll No", "Candidate Name", "Gender", "Domicile",
           "Allotted Category", "Additional Category (Filled)", "Allotted College (Seat Type)",
           "Allotted Course", "Service Status", "State Merit Rank", "All India Rank"]
SEAT_PATTERN = re.compile(r"^(.*?) \((Government|State|AI|Management)\)$")
DOMICILE_NORMAL = {"Jammu & Kashmir": "Jammu and Kashmir", "Chattisgarh": "Chhattisgarh"}
ALLOTMENT_FIELDS = ["year", "round", "list_serial", "registration_id", "merit_number", "neet_pg_air",
                    "college", "course", "seat_type", "domicile", "considered_category",
                    "allotted_category", "additional_category_filled", "service_status", "allotment_status",
                    "mcc_match", "mcc_college", "mcc_course", "mcc_quota", "mcc_allotted_category",
                    "mcc_candidate_category", "mcc_pdf_page", "pdf_page"]
CROSS_FIELDS = ["state_merit_rank", "registration_id", "neet_pg_air", "domicile", "service_status",
                "considered_category", "mcc_match", "mcc_college", "mcc_course", "mcc_quota",
                "mcc_allotted_category", "mcc_candidate_category", "mcc_pdf_page", "state_match",
                "state_college", "state_course", "state_seat_type", "state_allotted_category", "state_pdf_page",
                "merit_pdf_page"]


def clean(value: str | None) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def source_rows() -> list[dict]:
    data = RAJASTHAN_PDF.read_bytes()
    assert hashlib.sha256(data).hexdigest() == RAJASTHAN_SHA256
    rows = []
    with fitz.open(stream=data, filetype="pdf") as pdf:
        assert len(pdf) == 53
        assert "INDICATIVE ROUND 1 SEAT ALLOTMENT RESULT" in pdf[0].get_text()
        for page_index in range(5, len(pdf)):
            tables = pdf[page_index].find_tables().tables
            assert len(tables) == 1, (page_index + 1, len(tables))
            extracted = tables[0].extract()
            assert [clean(v) for v in extracted[0]] == HEADERS, page_index + 1
            for raw in extracted[1:]:
                assert len(raw) == len(HEADERS)
                row = dict(zip(HEADERS, map(clean, raw)))
                row["pdf_page"] = page_index + 1
                rows.append(row)
    assert len(rows) == 1366
    assert [int(row["S. No."]) for row in rows] == list(range(1, 1367))
    assert len({row["Reg ID"] for row in rows}) == 1366
    assert len({row["All India Rank"] for row in rows}) == 1366
    return rows


def build() -> None:
    merit = json.loads((ROOT / "data/2026-merit.json").read_text(encoding="utf-8"))
    assert len(merit) == 3165, "Rebuild revised 2026 merit first"
    by_registration = {row["registration_id"]: row for row in merit}
    mcc_rows = extract_mcc(MCC_PDF)
    mcc_by_air = {row["neet_pg_air"]: row for row in mcc_rows}
    state_rows = []
    for raw in source_rows():
        registration = raw["Reg ID"]
        source = by_registration[registration]
        air = int(raw["All India Rank"])
        rank = int(raw["State Merit Rank"])
        domicile = DOMICILE_NORMAL.get(raw["Domicile"], raw["Domicile"])
        assert (source["neet_pg_air"], source["state_merit_rank"], source["domicile"], source["service_status"]) == (
            air, rank, domicile, raw["Service Status"]), registration
        label = raw["Allotted College (Seat Type)"]
        match = SEAT_PATTERN.fullmatch(label)
        college, seat_type = (match.group(1), match.group(2)) if match else (label, "Not stated")
        assert match or registration == "PM0573", (registration, label)
        mcc = mcc_by_air.get(air)
        state_rows.append({
            "year": 2026, "round": "Round 1", "list_serial": int(raw["S. No."]),
            "registration_id": registration, "merit_number": rank, "neet_pg_air": air,
            "college": college, "course": raw["Allotted Course"], "seat_type": seat_type,
            "domicile": domicile, "considered_category": source["considered_category"],
            "allotted_category": raw["Allotted Category"],
            "additional_category_filled": raw["Additional Category (Filled)"],
            "service_status": raw["Service Status"], "allotment_status": "Indicative",
            "mcc_match": "Also MCC Round 1" if mcc else "No MCC Round 1 allotment",
            "mcc_college": mcc["college"] if mcc else None,
            "mcc_course": mcc["course"] if mcc else None,
            "mcc_quota": mcc["quota"] if mcc else None,
            "mcc_allotted_category": mcc["allotted_category"] if mcc else None,
            "mcc_candidate_category": mcc["candidate_category"] if mcc else None,
            "mcc_pdf_page": mcc["pdf_page"] if mcc else None,
            "pdf_page": raw["pdf_page"],
        })
    assert len(state_rows) == 1366
    state_by_registration = {row["registration_id"]: row for row in state_rows}
    cross = []
    for person in merit:
        state = state_by_registration.get(person["registration_id"])
        mcc = mcc_by_air.get(person["neet_pg_air"])
        cross.append({
            "state_merit_rank": person["state_merit_rank"],
            "registration_id": person["registration_id"], "neet_pg_air": person["neet_pg_air"],
            "domicile": person["domicile"], "service_status": person["service_status"],
            "considered_category": person["considered_category"],
            "mcc_match": "MCC Round 1 allotment" if mcc else "No MCC Round 1 allotment",
            "mcc_college": mcc["college"] if mcc else None,
            "mcc_course": mcc["course"] if mcc else None,
            "mcc_quota": mcc["quota"] if mcc else None,
            "mcc_allotted_category": mcc["allotted_category"] if mcc else None,
            "mcc_candidate_category": mcc["candidate_category"] if mcc else None,
            "mcc_pdf_page": mcc["pdf_page"] if mcc else None,
            "state_match": "Rajasthan Round 1 allotment" if state else "No Rajasthan Round 1 allotment",
            "state_college": state["college"] if state else None,
            "state_course": state["course"] if state else None,
            "state_seat_type": state["seat_type"] if state else None,
            "state_allotted_category": state["allotted_category"] if state else None,
            "state_pdf_page": state["pdf_page"] if state else None,
            "merit_pdf_page": person["pdf_page"],
        })
    assert len(cross) == 3165
    assert sum(row["state_match"] == "Rajasthan Round 1 allotment" for row in cross) == 1366
    target = ROOT / "data"
    (target / "2026-allotment.json").write_text(json.dumps(state_rows, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    (target / "2026-cross-counselling.json").write_text(json.dumps(cross, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    save_csv(target / "2026-allotment.csv", state_rows, ALLOTMENT_FIELDS, "pdf_page")
    save_csv(target / "2026-cross-counselling.csv", cross, CROSS_FIELDS, "merit_pdf_page")
    save_workbook(target / "Rajasthan-NEET-PG-2026-Round-1-allotments-and-MCC.xlsx", state_rows, cross)
    print(f"2026 Board allotments: {len(state_rows)}; revised merit: {len(merit)}; MCC final PDF: {len(mcc_rows)}")
    print("MCC matched in merit:", sum(row["mcc_college"] is not None for row in cross))
    print("MCC matched in state allotments:", sum(row["mcc_college"] is not None for row in state_rows))
    print("MCC matches by domicile:", dict(Counter(row["domicile"] for row in cross if row["mcc_college"])))


def save_csv(path: Path, rows: list[dict], fields: list[str], main_page: str) -> None:
    with path.open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=fields + ["source_pdf_url", "mcc_source_pdf_url"])
        writer.writeheader()
        for row in rows:
            main_kind = "merit" if main_page == "merit_pdf_page" else "allotment"
            writer.writerow({**row,
                "source_pdf_url": f"{SITE}documents/2026/{main_kind}/round-1.pdf#page={row[main_page]}",
                "mcc_source_pdf_url": f"{SITE}documents/2026/mcc/round-1.pdf#page={row['mcc_pdf_page']}" if row["mcc_pdf_page"] else "",
            })


def save_workbook(path: Path, state: list[dict], cross: list[dict]) -> None:
    book = Workbook()
    notes = book.active
    notes.title = "Read first"
    for line in [
        "Rajasthan NEET-PG 2026 indicative Round 1 allotments dated 31 October 2026, cross-referenced to MCC final Round 1 result dated 24 October 2026.",
        "Rajasthan's revised provisional merit list of 28 October 2026 has 3,165 candidates. An earlier 27 October list had 3,160.",
        "The AIR match is exact and unique in both sources. Appearing in both results does not prove joining either seat.",
        "The MCC result contains all its quota types, including All India, DNB and Self-Financed Merit Seat; it is a different counselling process from Rajasthan Board AI-nature seats.",
        "One Rajasthan allotment source row (PM0573) omits the seat-type suffix; its seat type is shown as Not stated.",
        "Candidate names, relatives, gender and roll numbers are omitted from derived sheets. Source PDFs remain linked.",
        f"Rajasthan Board source: {RAJASTHAN_URL}; SHA-256 {RAJASTHAN_SHA256}",
        f"MCC source: {MCC_URL}; SHA-256 {MCC_SHA256}",
    ]:
        notes.append([line])
    notes.column_dimensions["A"].width = 125
    for title, rows, fields, page_field, source_kind in [
        ("Rajasthan allotments", state, ALLOTMENT_FIELDS, "pdf_page", "allotment"),
        ("Cross counselling", cross, CROSS_FIELDS, "merit_pdf_page", "merit"),
    ]:
        sheet = book.create_sheet(title)
        sheet.append([field.replace("_", " ").title() for field in fields] + ["Source PDF", "MCC source PDF"])
        for row in rows:
            source = f"{SITE}documents/2026/{source_kind}/round-1.pdf#page={row[page_field]}"
            mcc_source = f"{SITE}documents/2026/mcc/round-1.pdf#page={row['mcc_pdf_page']}" if row["mcc_pdf_page"] else None
            sheet.append([row[field] for field in fields] + ["Open source", "Open MCC source" if mcc_source else None])
            for column, url in [(len(fields) + 1, source), (len(fields) + 2, mcc_source)]:
                if url:
                    cell = sheet.cell(sheet.max_row, column)
                    cell.hyperlink = url
                    cell.font = Font(color="0A6B69", underline="single")
        sheet.freeze_panes = "E2"
        sheet.auto_filter.ref = sheet.dimensions
        sheet.sheet_view.showGridLines = False
        for cell in sheet[1]:
            cell.font = Font(bold=True, color="FFFFFF")
            cell.fill = PatternFill("solid", fgColor="184D55")
            cell.alignment = Alignment(vertical="center")
        sheet.row_dimensions[1].height = 24
        for index, field in enumerate(fields + ["source", "mcc_source"], 1):
            sheet.column_dimensions[get_column_letter(index)].width = 54 if "college" in field else 39 if "course" in field else 26 if "category" in field else 18
        table = Table(displayName="Allotments2026" if source_kind == "allotment" else "CrossCounselling2026", ref=sheet.dimensions)
        table.tableStyleInfo = TableStyleInfo(name="TableStyleMedium2", showRowStripes=True)
        sheet.add_table(table)
    book.save(path)


if __name__ == "__main__":
    build()
