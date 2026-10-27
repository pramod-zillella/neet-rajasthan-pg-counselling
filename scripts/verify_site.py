"""Check public document integrity and local site links before publishing."""

from __future__ import annotations

import hashlib
import json
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit


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
    print("Verified 18 records, 17 PDFs and local page links.")


if __name__ == "__main__":
    main()
