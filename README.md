# Rajasthan NEET-PG merit lists and allotments

A standalone, static GitHub Pages archive for **NEET-PG 2024 / academic session 2024–25**, **NEET-PG 2025 / academic session 2025–26**, and the **provisional 2026 Round 1 merit list / academic session 2026–27**. The [seat-matrix](matrix.html), [merit-list](merit.html) and [allotment](allotments.html) pages have **filterable, sortable tables** with continuous scrolling and filtered-CSV export. Categorical filters accept multiple checkbox selections, including multiple years and rounds. Within a filter, selected options are combined; different filters narrow the results. The merit and allotment domicile menus include **All Except Rajasthan** (2024 OTHER and named non-Rajasthan 2025–2026 domiciles; the 2026 “Not Applicable” label is excluded). Download the [2026 Round 1 merit Excel workbook](data/Rajasthan-NEET-PG-2026-Round-1-merit.xlsx), the [2024–2025 merit/allotment workbook](data/Rajasthan-NEET-PG-2024-2025-filterable.xlsx), or the [2024–2025 matrix workbook](data/Rajasthan-NEET-PG-2024-2025-seat-matrices.xlsx). Each row links to its source PDF page.

The site needs no account, API key or server-side database. Open the [home page](index.html) on GitHub Pages. For local preview, run `python -m http.server 8000` in this directory and visit `http://localhost:8000/`. Browsers generally block `fetch()` from `file://`, so double-clicking an HTML file will not load the document register.

Selecting categorical options updates the page URL, so you can copy a link to the same year, rounds and selected filters. Type directly into any categorical filter to see matching options; selected values appear as removable chips. You can select several options, and **All Except Rajasthan** remains available in the domicile search. The table-wide search box and numeric ranges apply to the current view and are not saved in that link. No selected chips means all values; use **Clear selection** in the matching-options panel to return to all values.

## What is included

| Exam year | Merit lists | Allotment lists |
| --- | --- | --- |
| 2024 | 16,914 rows: Rounds 1–3, revised Stray, Special Stray; earlier provisional Stray version linked | 4,969 rows: Rounds 1–3; Stray and Special Stray archive links only |
| 2025 | 13,221 rows: Rounds 1–3 and Stray | 5,520 rows: Rounds 1–3 and Stray, including an incomplete/unverified Round 3 recovered copy |
| 2026 | 3,160 rows: provisional Round 1, dated 27 October 2026 | Not yet included |

The 2024 merit lists do **not** explicitly contain NEET-PG All India Rank. The 2025 merit lists and 2026 Round 1 list contain both state merit rank and AIR. The 2026 list is provisional and does not establish final eligibility or admission. An allotment is not a final joining record; candidates can recur across rounds, and an allotment-row count is not a count of distinct candidates. The recovered 2025 Round 3 allotment PDF has 74 physical pages although its page footers say “of 125”; its completeness is not certified. Do not infer a final closing cutoff from it. The older Board portals were unavailable during research, and later corrigenda have not been ruled out.

## Seat matrices

The matrix table contains **10,920 cells from 2024** and **6,144 cells from 2025**, including cells with zero seats. By default the website shows positive-seat rows for one selected round. The 2024 collection uses Board-issued medical and DNB/Diploma PDFs for Round 1, Round 2, Round 3, Stray and Special Stray. The 2025 source set covers medical-college MD/MS seats for Round 1, Round 2, Round 3 and Stray; **2025 DNB/Diploma seats are not in these verified matrices**. A missing route in 2025 must not be interpreted as zero seats.

Round 1 is an initial offered-seat matrix; later rounds are **vacancy snapshots**. The same seat can recur, be upgraded, surrendered or added, so do not sum round totals. The 2024 selected matrices total 2,215 Round 1 seats across MD/MS and DNB/Diploma; the later snapshots show 1,203 Round 2, 900 Round 3, 384 Stray and 82 Special Stray seats. The 2025 MD/MS snapshots show 2,378, 1,311, 1,122 and 550 seats respectively. These are seat counts within their printed scopes, not candidate counts or certified final intake. Prior/revised versions exist in the 2024 Board archive; this site selects the later recovered revision for each route, but a later corrigendum cannot be ruled out.

The 2024 government medical matrices print the first seat column as “Govt.” in Round 1 and “Recog.” later, and the second as “Mgmt.” The filter groups those as State (Government) and State (Management) while preserving the exact printed label. Private-college “AIQ”, “SQ” and “Mgmt.” columns are grouped as AI, State and Management. **2024 AIQ and 2025 AI in these private-college matrices refer to Rajasthan Board seats, not MCC AIQ allotments.** Aggregate Total columns are excluded to avoid double-counting. DNB/Diploma PDFs have no quota split; each branch-centre count is a programme total. The long 2025 Immunohaematology/Transfusion Medicine branch label is completed using the full Round 1 label where later PDFs clip its ending. All 2024 matrix PDF bytes match the Internet Archive's recorded SHA-1 digests. The 2025 PDF bytes match the source register's SHA-256 hashes. Source dates, links and hashes are in [`data/matrix-documents.json`](data/matrix-documents.json).

The tables retain registration IDs for cross-reference but omit candidate names, relatives, gender and NEET roll numbers. For 2024, each recovered allotment was joined to the same-round merit PDF; all 4,969 matches agreed on merit number. For 2025, all 5,520 recovered allotments were matched to their round-specific merit records; this build rechecked both state merit number and AIR. Domicile and provisional considered category were read from the corresponding merit PDFs and added to allotments. PDF source URLs and checksums are in [`data/documents.json`](data/documents.json). The 2024 copies were validated against the Internet Archive's recorded digests and printed page sequences; the 2025 copies against the research pack's SHA-256 source register.

The 2026 Round 1 list was extracted directly from the Board's [138-page provisional PDF](documents/2026/merit/round-1.pdf). Its 3,160 sequential list/state-merit numbers, unique registration IDs, marks arithmetic, page footers and headers are checked in [`scripts/build_2026_merit.py`](scripts/build_2026_merit.py). The Board attachment is dated 27 October 2026; the retained PDF has SHA-256 `81af5fb564301768820020bd640bd01d4dbb9066f7bcc53f04b8e7e6d3dc8c3f`. The searchable [CSV](data/2026-merit.csv) and Excel contain AIR, marks, domicile, considered category, additional category (filled and verified), service status and rural in-service years. The source does **not** print the primary filled reservation category, so that field is blank. Clipped domicile names were expanded only where unambiguous, and a text-layer spill into seven General category cells was checked against the printed page and repaired. The Board's “Not Applicable” domicile is preserved as-is. Names, gender and NEET roll numbers are excluded from the derived files.

Some long 2025 domicile names run into the adjacent category column in the PDF text layer. Unambiguous state names were normalized, using the same registration ID in another round as a cross-check where available. The PDF truncates the ending of “Dadra and Nagar”; the table explicitly marks that label as truncated rather than guessing the full jurisdiction name.

The 2024 allotted seat-type label is parsed from the institution suffix in the Board's allotment PDF. Its **“All India”** label is within Rajasthan state counselling, not an MCC AIQ result. “Post MBBS DNB/Diploma” labels describe the programme route rather than a reservation category. For 2025, the allotted seat type comes from its explicit PDF column. The source text layer sometimes joins wrapped college names across rows, attaches candidate-name letters to MD/MS, drops the degree prefix, or clips long course names. The displayed 2025 labels use checked college identities and one consistent course spelling across rounds; the original PDFs remain linked to each row. The build accepts only the 49 reviewed college and 43 reviewed course labels, so a new extraction artifact requires review before publication. Preserve distinctions such as OBC versus OBC NCL in the considered-category filter.

Original public Board-issued PDFs remain hosted unchanged as evidence. The private research cache is not published. The fuller research notes remain in the local `neet-specialty-knowledge-base/exports` source directory.

## Round 1 seat growth, 2024 to 2026

The [seat-growth page](growth.html) compares MD/MS seats initially offered in Round 1 by college and branch. It supports multi-select college and branch filters, change filters, sorting, filtered CSV and a [full Excel workbook](data/Rajasthan-NEET-PG-2024-2026-seat-growth.xlsx). All seat-type columns within the same college and branch are summed once. Later-round vacancy snapshots and 2024 DNB/Diploma seats are excluded from growth calculations.

| Comparable scope | 2024 | 2025 | 2026 |
| --- | ---: | ---: | ---: |
| All MD/MS colleges in the verified Rajasthan matrices | 2,008 | 2,378 | Unverified private component |
| Government, RUHS-CMS and society colleges | 945 | 980 | 990 provisional |

The full MD/MS total rose **370** from 2024 to 2025. Of this net change, **59 seats** are at colleges absent from the 2024 matrix (Dr S S Tantia 54, ESIC Alwar 5), and **311** are net changes at existing colleges. The government/RUHS/society total rose **35** from 2024 to 2025 and **10** from 2025 to the provisional 2026 matrix.

The Rajasthan Board's [2026 Round 1 MD/MS attachment](https://pg.neetrajasthan.com/notifications/1792388159259.pdf) includes a 2026 government/RUHS/society matrix on PDF page 1. **PDF page 2 is explicitly headed as the 2025 private-college matrix**. Its 2025 numbers are excluded; 2026 private figures and a 2026 all-college growth total are left blank until an authentic current private matrix is available. The retained official PDF is [`documents/2026/matrix/round-1-medical.pdf`](documents/2026/matrix/round-1-medical.pdf), SHA-256 `95f9bb153604f332b8394ed14e2b27046077a4a99736adea6425652bc3da2e09`. Page 1 is dated 16 October 2026 and marked provisional, so later revisions can change its totals. The explicit branch-alias mapping and row/printed-total checks are in [`scripts/build_growth.py`](scripts/build_growth.py). The two 2024 Anatomy labels and two Transfusion Medicine labels are combined to match the later combined programme labels. “New college” means absent from the verified 2024 Round 1 matrix, not founded in 2025.

## Refresh the site

The source research packs live in a sibling `neet-specialty-knowledge-base/exports` directory. Install the extraction dependencies, then rebuild and verify:

```powershell
python -m pip install -r requirements.txt
python scripts/build_site.py
python scripts/build_2026_merit.py
python scripts/build_tables.py
python scripts/build_matrix.py
python scripts/build_growth.py
python scripts/verify_site.py
```

The 2024 matrix PDFs are already in `documents/2024/matrix/`; `scripts/fetch_2024_matrix_pdfs.py` retrieves the selected archive captures and checks their recorded SHA-1 digests if they need to be restored. `build_site.py` and `build_tables.py` accept `--source` for a different exports directory. `build_site.py` checks each copied merit/allotment PDF against its manifest SHA-256. `build_2026_merit.py` validates and extracts the retained 2026 Round 1 PDF. `build_tables.py` asserts source row counts, sequential 2024 list numbers, same-round registration matches, and 2025 rank/AIR agreement. `build_matrix.py` reconciles 2024 printed row/column totals, 2025 source hashes and round totals. Review the site text if source status, dates or rounds change. Commit and push to `main` to publish an update.

## GitHub Pages setup

This repository includes `.github/workflows/pages.yml` to deploy its root directory on a push to `main`. In repository **Settings → Pages**, choose **GitHub Actions** as the build/deployment source. The site URL is `https://pramod-zillella.github.io/neet-rajasthan-pg-counselling/` when the public repository has that name. Allow the first workflow to finish before opening the URL; a new Pages site may initially return 404.

Source snapshot: 2024 files retrieved 24 October 2026; 2025 files retrieved 20 October 2026; 2026 Round 1 merit list published 27 October 2026. This is an independent research archive, not an official Rajasthan counselling portal or a live schedule.
