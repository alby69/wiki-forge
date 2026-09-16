#!/usr/bin/env python3
"""
clip2md.py — Simple web clipper to fetch HTML and save clean Markdown.

Fetches a webpage from a given URL, extracts basic title and text content,
and saves it as a Markdown file in `sources/web-clips/` (or configured directory).
"""

from __future__ import annotations

import argparse
import re
import sys
import urllib.request
from html.parser import HTMLParser
from pathlib import Path


def load_config() -> dict:
    defaults = {
        "webclip": {
            "enabled": True,
            "folder": "sources/web-clips",
            "format": "markdown",
        }
    }
    try:
        import tomllib
    except ImportError:
        return defaults

    cfg_path = Path("config.toml")
    if cfg_path.is_file():
        with cfg_path.open("rb") as fh:
            data = tomllib.load(fh)
        for section, values in data.items():
            if isinstance(values, dict):
                defaults.setdefault(section, {}).update(values)
    return defaults


class HTMLToTextParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.text: list[str] = []
        self.title: str = ""
        self.in_title: bool = False
        self.ignore_tags = {"script", "style", "head", "meta", "link", "noscript"}
        self.current_tag: str | None = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() == "title":
            self.in_title = True
        self.current_tag = tag.lower()

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "title":
            self.in_title = False
        if tag.lower() in {"p", "h1", "h2", "h3", "h4", "h5", "h6", "li", "div"}:
            self.text.append("\n\n")

    def handle_data(self, data: str) -> None:
        if self.in_title:
            self.title += data
        elif self.current_tag not in self.ignore_tags:
            cleaned = data.strip()
            if cleaned:
                self.text.append(cleaned + " ")


def slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_-]+", "-", text)
    return text.strip("-") or "web-clip"


def clip_url(url: str, output_folder: Path) -> Path:
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "Mozilla/5.0 (compatible; LLMWikiClipper/1.0)"},
    )

    with urllib.request.urlopen(req) as response:
        html_content = response.read().decode("utf-8", errors="ignore")

    parser = HTMLToTextParser()
    parser.feed(html_content)

    title = parser.title.strip() or "Web Clip"
    slug = slugify(title)
    body = "".join(parser.text).strip()
    body = re.sub(r"\n{3,}", "\n\n", body)

    md_content = f"""# {title}

**Source URL:** [{url}]({url})

---

{body}
"""

    output_folder.mkdir(parents=True, exist_ok=True)
    out_file = output_folder / f"{slug}.md"
    out_file.write_text(md_content, encoding="utf-8")
    return out_file


def main() -> None:
    cfg = load_config()
    clip_cfg = cfg.get("webclip", {})

    parser = argparse.ArgumentParser(
        description="Fetch a web page and save it as a Markdown file for source ingestion."
    )
    parser.add_argument("url", nargs="?", help="URL to clip")
    parser.add_argument(
        "--output",
        default=clip_cfg.get("folder", "sources/web-clips"),
        help="Destination folder for web clips. Default: sources/web-clips",
    )
    args = parser.parse_args()

    if not args.url:
        parser.print_help()
        sys.exit(1)

    try:
        saved_path = clip_url(args.url, Path(args.output))
        print(f"Clipped '{args.url}' -> {saved_path}")
    except Exception as exc:
        print(f"Error clipping URL '{args.url}': {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
