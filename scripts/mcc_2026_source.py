"""Read every allotment row from MCC's official 2026 Round 1 PDF.

The user-supplied CSV drops the first row of nearly every PDF page. Reading the
PDF by its fixed column positions restores those rows and preserves page links.
"""

from __future__ import annotations

import hashlib
import re
from pathlib import Path

import fitz

SOURCE_URL = "https://cdnbbsr.s3waas.gov.in/s3e0f7a4d0ef9b84b83b693bbf3feb8e6e/uploads/2026/10/202610241746468472.pdf"
SOURCE_PAGE = "https://mcc.nic.in/document/final-allotment-result-for-pg-counselling-round-1-dated-24-10-2026/"
SHA256 = "0cc737b10d3b6fc23ee4d814a18736f786ac3f1ed4d46538a4f670f013b482ac"
EXPECTED_ROWS = 28723
BOUNDS = (0, 45, 90, 180, 540, 650, 700, 760, 842)
FIELDS = ("serial", "neet_pg_air", "quota", "college", "course", "allotted_category", "candidate_category", "remarks")


def clean(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def extract(pdf_path: Path) -> list[dict]:
    payload = pdf_path.read_bytes()
    assert hashlib.sha256(payload).hexdigest() == SHA256, "MCC PDF checksum differs from checked result"
    result: list[dict] = []
    with fitz.open(stream=payload, filetype="pdf") as pdf:
        assert len(pdf) == 1735, len(pdf)
        for page_index in range(1, len(pdf)):
            page_number = page_index + 1
            words = pdf[page_index].get_text("words")
            ranks = [(y, value) for x, y, _, _, value, *_ in words if 45 <= x < 90 and value.isdigit() and y < 565]
            starts = sorted({y for x, y, _, _, value, *_ in words
                             if x < 45 and value.isdigit() and y < 565
                             and any(abs(y - rank_y) < 2 for rank_y, _ in ranks)})
            for index, y in enumerate(starts):
                end = starts[index + 1] - 0.5 if index + 1 < len(starts) else 565
                cells: list[list[tuple[float, float, str]]] = [[] for _ in FIELDS]
                for x, wy, _, _, value, *_ in words:
                    if y - 0.5 <= wy < end:
                        column = next((k for k in range(8) if BOUNDS[k] <= x < BOUNDS[k + 1]), None)
                        if column is not None:
                            cells[column].append((wy, x, value))
                values = [clean(" ".join(value for _, _, value in sorted(cell))) for cell in cells]
                if not values[0] or not values[1]:
                    continue
                assert values[0].isdigit() and values[1].isdigit(), (page_number, values)
                row = dict(zip(FIELDS, values))
                row["serial"] = int(row["serial"])
                row["neet_pg_air"] = int(row["neet_pg_air"])
                row["pdf_page"] = page_number
                assert row["remarks"] == "Allotted", (page_number, row)
                assert row["college"] and row["course"] and row["quota"] and row["allotted_category"] and row["candidate_category"], (page_number, row)
                result.append(row)
    assert len(result) == EXPECTED_ROWS, (len(result), EXPECTED_ROWS)
    assert [row["serial"] for row in result] == list(range(1, EXPECTED_ROWS + 1))
    assert len({row["neet_pg_air"] for row in result}) == EXPECTED_ROWS
    return result
