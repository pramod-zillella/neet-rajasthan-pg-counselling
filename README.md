# Rajasthan NEET-PG merit lists and allotments

A standalone, static GitHub Pages archive for **NEET-PG 2024 / academic session 2024–25** and **NEET-PG 2025 / academic session 2025–26**. It has separate [merit-list](merit.html) and [allotment](allotments.html) pages with exam-year and round filters, PDF previews, source links and SHA-256 checksums.

The site needs no account, API key or server-side database. Open the [home page](index.html) on GitHub Pages. For local preview, run `python -m http.server 8000` in this directory and visit `http://localhost:8000/`. Browsers generally block `fetch()` from `file://`, so double-clicking an HTML file will not load the document register.

## What is included

| Exam year | Merit lists | Allotment lists |
| --- | --- | --- |
| 2024 | Rounds 1–3, revised Stray, Special Stray; earlier provisional Stray version linked | Rounds 1–3 locally hosted; Stray and Special Stray archive links only |
| 2025 | Rounds 1–3 and Stray | Rounds 1–3 and Stray, including an incomplete/unverified Round 3 recovered copy |

The 2024 merit lists do **not** explicitly contain NEET-PG All India Rank. The 2025 merit lists contain both state merit rank and AIR. An allotment is not a final joining record; candidates can recur across rounds, and an allotment-row count is not a count of distinct candidates. The recovered 2025 Round 3 allotment PDF has 74 physical pages although its page footers say “of 125”; its completeness is not certified. Do not infer a final closing cutoff from it. The older Board portals were unavailable during research, and later corrigenda have not been ruled out.

Public Board-issued PDFs are hosted unchanged as document copies. The site does **not** republish a searchable candidate-level spreadsheet or the private research cache. PDF source URLs and checksums are in [`data/documents.json`](data/documents.json). The 2024 downloaded documents were validated against the Internet Archive's recorded digests and printed page sequences. The 2025 documents were validated against the research pack's SHA-256 source register. The fuller 2024 and 2025 research notes remain in the local `neet-specialty-knowledge-base/exports` source directory.

## Refresh the site

The source research packs live in a sibling `neet-specialty-knowledge-base/exports` directory. After updating and checking those source manifests, run:

```powershell
python scripts/build_site.py
python scripts/verify_site.py
```

Or pass a different exports directory with `--source`. The script checks every copied PDF against its manifest SHA-256 and rebuilds the document register. It will stop on a missing file or mismatch. Review the site text if a source status, date or round changes. Commit and push to `main` to publish the update.

## GitHub Pages setup

This repository includes `.github/workflows/pages.yml` to deploy its root directory on a push to `main`. In repository **Settings → Pages**, choose **GitHub Actions** as the build/deployment source. The site URL is `https://pramod-zillella.github.io/neet-rajasthan-pg-counselling/` when the public repository has that name. Allow the first workflow to finish before opening the URL; a new Pages site may initially return 404.

Source snapshot: 2024 files retrieved 24 October 2026; 2025 files retrieved 20 October 2026. This is an independent historical archive, not an official Rajasthan counselling portal or a live schedule.
