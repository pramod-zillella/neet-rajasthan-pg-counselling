"""Fetch selected Rajasthan Board NEET-PG 2024 matrices from archived captures.

Each downloaded PDF is checked against the Internet Archive CDX SHA-1 digest.
The 2024 selection uses the latest recovered revised snapshot for each route.
"""

from __future__ import annotations

import base64
import hashlib
import time
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
SOURCES = [
    ("round-1-medical", "Round 1", "Medical", "19 Nov 2024", "20250419092505", "http://rajpgneet2024.org/docs_upd/seat_matrix_r1_medical_start_19112024%20for%20web.pdf", "KSGF23OBTRNZTEHRL4F3L5WRC5KYAH2S"),
    ("round-1-dnb", "Round 1", "DNB", "19 Nov 2024", "20241207050347", "http://rajpgneet2024.org/docs_upd/seat_matrix_r1_medical_dnb_start_19112024%20for%20web.pdf", "G3DUYBJBGMIJ4CZF3Z5QKZTXUQ3FETWX"),
    ("round-2-medical", "Round 2", "Medical", "11 Jan 2025, after senior demonstrator adjustments", "20250120224244", "https://www.rajpgneet2024.org/docs_upd/vacant_seat_matrix_r2_medical_11012025%20after%20sd.pdf", "OCPGLJFNO3RRFAOABUGJEZPHBUCIUQXX"),
    ("round-2-dnb", "Round 2", "DNB", "11 Jan 2025, after senior demonstrator adjustments", "20250120230320", "https://www.rajpgneet2024.org/docs_upd/vacant_seat_matrix_r2_medical_dnb_11012025%20after%20sd.pdf", "DPVAIMVWYL5TFBJU5RXR55K67MYSOIYH"),
    # The separate 23 Dec Diploma PDF was superseded by the selected 11 Jan
    # DNB/Diploma matrix; including both would duplicate Diploma seat cells.
    ("round-3-medical", "Round 3", "Medical", "3 Feb 2025, after senior demonstrator adjustments", "20250317053710", "http://rajpgneet2024.org/docs_upd/vacant_seat_matrix_r3_medical_after_sr_demo_03022025%20for%20web..pdf", "7PFJDXDG7MECVRVPTGBRGAC54NGUZTWU"),
    ("round-3-dnb", "Round 3", "DNB", "1 Feb 2025 revised", "20250317044626", "http://rajpgneet2024.org/docs_upd/vacant_seat_matrix_r3_medical_dnb_01022025_revised%20for%20web.pdf", "F57HVBGGITI63K7IK2FAXRG25G5NTCAF"),
    ("stray-medical", "Stray vacancy", "Medical", "1 Mar 2025, after senior demonstrator adjustments", "20250317053442", "http://rajpgneet2024.org/docs_upd/20250301_vacant_seat_matrix_r4_stray_vacancy_medical%20after%20sd.pdf", "SNFKCCJYXZITQVTHUU2VAQNQLPT2BIYU"),
    ("stray-dnb", "Stray vacancy", "DNB", "1 Mar 2025, after senior demonstrator adjustments", "20250317044116", "http://rajpgneet2024.org/docs_upd/20250301_vacant_seat_matrix_r4_medical_dnb%20after%20sd.pdf", "NUSLHG6IDD2ZPAJYMDM2646G4NUWIY6Y"),
    ("special-stray-medical", "Special stray vacancy", "Medical", "19 Mar 2025", "20250406105927", "https://www.rajpgneet2024.org/docs_upd/vacant_seat_matrix_r5_medical_19.03.2025.pdf", "MLH5HEOQSUSHSOGTNIJXMFSM5MNB2FXV"),
    ("special-stray-dnb", "Special stray vacancy", "DNB", "8 Mar 2025", "20250317041640", "http://rajpgneet2024.org/docs_upd/20250308_vacant_seat_matrix_r5_medical_dnb.pdf", "56RUJBQUUBOUQHC4UFJG5JQWEMKLJDG3"),
]


def archived_url(capture: str, original: str) -> str:
    return f"https://web.archive.org/web/{capture}if_/{original}"


def archive_sha1(data: bytes) -> str:
    return base64.b32encode(hashlib.sha1(data).digest()).decode("ascii").rstrip("=")


def main() -> None:
    folder = ROOT / "documents" / "2024" / "matrix"
    folder.mkdir(parents=True, exist_ok=True)
    for slug, _, _, _, capture, original, expected_digest in SOURCES:
        target = folder / f"{slug}.pdf"
        if target.exists():
            data = target.read_bytes()
        else:
            url = archived_url(capture, original)
            try:
                with urlopen(Request(url, headers={"User-Agent": "curl/8.6.0"}), timeout=40) as response:
                    data = response.read()
            except HTTPError as exc:
                print(f"Unavailable {slug}: HTTP {exc.code}")
                continue
        if not data.startswith(b"%PDF") or archive_sha1(data) != expected_digest:
            raise ValueError(f"PDF/digest mismatch for {slug}: {archive_sha1(data)}")
        target.write_bytes(data)
        print(f"Verified {slug}: {len(data):,} bytes, SHA-256 {hashlib.sha256(data).hexdigest()}")
        time.sleep(0.5)


if __name__ == "__main__":
    main()
