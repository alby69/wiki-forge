#!/usr/bin/env python3
"""
conv2md.py — Convert source documents to Markdown for an LLM Wiki.

WHAT THIS DOES
--------------
This script turns your original documents (PDF, EPUB, DOCX) and plain-text
notes (MD, TXT) into clean Markdown files inside the `raw/` inbox, ready for
the LLM agent to read and compile into the wiki.

It is intentionally small and dependency-light (Unix KISS philosophy):
  * PDF  -> pymupdf4llm  (fast, CPU-only, LLM-friendly text extraction)
  * EPUB -> pandoc        (preserves chapters and structure)
  * DOCX -> pandoc        (good fidelity for headings, lists, tables)
  * MD/TXT -> direct copy (e.g. notes captured with Obsidian Web Clipper)

DESIGN PRINCIPLES
-----------------
  * Decoupled: one clear job (format -> markdown). No wiki logic here.
  * Idempotent: already-converted files are skipped, so you can re-run safely.
  * Configurable: reads defaults from `config.toml` when present, but works
    fine without it (sensible built-in defaults).
  * Zero forced dependencies: only `pymupdf4llm` (pip) and `pandoc` (system)
    are needed for the conversions you actually use.

USAGE
-----
  python conv2md.py                       # uses config.toml paths (default)
  python conv2md.py --input backup --output raw
  python conv2md.py --input backup --output raw --ocr   # note scanned PDFs

Dependencies:
  pip install pymupdf4llm
  pandoc  (https://pandoc.org/installing.html)
"""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from pathlib import Path

# --- Supported formats ------------------------------------------------------

# Formats handled by an external converter (pandoc).
PANDOC_EXTS = {".docx", ".epub"}
# PDF handled by pymupdf4llm.
PDF_EXTS = {".pdf"}
# Plain-text formats that only need to be copied into `raw/`.
PASSTHROUGH_EXTS = {".md", ".markdown", ".txt", ".text"}
SUPPORTED_EXTS = PANDOC_EXTS | PDF_EXTS | PASSTHROUGH_EXTS

# ---------------------------------------------------------------------------
# Configuration helpers
# ---------------------------------------------------------------------------


def load_config() -> dict:
    """
    Load `config.toml` if available.

    Returns a dict with a `paths` key holding source/raw/wiki/output folder
    names. If the file or the `tomllib` module is missing (Python < 3.11),
    built-in defaults are returned so the script still works everywhere.
    """
    defaults = {
        "project": {"name": "llm-wiki", "language": "en"},
        "paths": {
            "sources": "backup",
            "raw": "raw",
            "wiki": "wiki",
            "output": "output",
        },
        "conversion": {"ocr": False},
    }
    try:
        import tomllib  # Python 3.11+
    except ImportError:
        return defaults

    cfg_path = Path("config.toml")
    if not cfg_path.is_file():
        return defaults

    with cfg_path.open("rb") as fh:
        data = tomllib.load(fh)
    # Shallow-merge so a partial config still inherits defaults.
    merged = defaults.copy()
    for section, values in data.items():
        if isinstance(values, dict):
            merged.setdefault(section, {}).update(values)
    return merged


# ---------------------------------------------------------------------------
# Conversion backends
# ---------------------------------------------------------------------------


def check_pandoc() -> bool:
    """Return True if the `pandoc` binary is on the PATH, else warn and return False."""
    if shutil.which("pandoc") is None:
        print(
            "WARNING: pandoc not found in PATH. Install it from "
            "https://pandoc.org/installing.html to convert .docx and .epub files.",
            file=sys.stderr,
        )
        return False
    return True


def convert_pdf(path: Path, out_path: Path, use_ocr: bool) -> None:
    """Convert a PDF to Markdown using pymupdf4llm."""
    import pymupdf4llm  # imported lazily so the dep is only needed for PDFs

    if use_ocr:
        # pymupdf4llm does not perform OCR by itself; this flag only documents
        # the intent. Scanned PDFs without a text layer may yield empty output.
        print(
            f"  [note] {path.name}: OCR requested, but pymupdf4llm extracts the "
            "native text layer. For scans, run an OCR step (e.g. Tesseract) first."
        )
    # `to_markdown` returns a string by default, but may return a list of chunk
    # dicts; normalize both cases so the writer always receives text.
    md = pymupdf4llm.to_markdown(str(path))
    if isinstance(md, list):
        md = "\n\n".join(chunk.get("text", "") for chunk in md)
    out_path.write_text(md, encoding="utf-8")


def convert_with_pandoc(path: Path, out_path: Path, from_format: str) -> None:
    """Convert a document to Markdown using the `pandoc` CLI."""
    subprocess.run(
        ["pandoc", str(path), "-f", from_format, "-t", "markdown", "-o", str(out_path)],
        check=True,
        capture_output=True,
        text=True,
    )


def copy_passthrough(path: Path, out_path: Path) -> None:
    """Copy a plain-text / markdown source straight into `raw/`."""
    out_path.write_text(path.read_text(encoding="utf-8"), encoding="utf-8")


# ---------------------------------------------------------------------------
# Idempotency helpers
# ---------------------------------------------------------------------------


def target_path(output_dir: Path, stem: str) -> Path:
    """
    Return the destination path for a converted file.

    If `<stem>.md` already exists, the source was already converted, so the
    caller should skip it instead of overwriting or duplicating.
    """
    return output_dir / f"{stem}.md"


def already_converted(output_dir: Path, stem: str) -> bool:
    """True when a converted file for this stem already exists in `raw/`."""
    return target_path(output_dir, stem).exists()


# ---------------------------------------------------------------------------
# Main processing loop
# ---------------------------------------------------------------------------


def process_folder(input_dir: Path, output_dir: Path, use_ocr: bool) -> None:
    """Walk `input_dir`, convert every supported file into `output_dir`."""
    output_dir.mkdir(parents=True, exist_ok=True)
    pandoc_ok = check_pandoc()

    files = sorted(
        p for p in input_dir.rglob("*") if p.suffix.lower() in SUPPORTED_EXTS
    )
    if not files:
        print(f"No PDF/EPUB/DOCX/MD/TXT files found in {input_dir}")
        return

    ok, skipped, failed = 0, 0, 0
    for f in files:
        ext = f.suffix.lower()
        out_path = target_path(output_dir, f.stem)

        # Idempotency: never overwrite an existing conversion.
        if already_converted(output_dir, f.stem):
            print(f"Skip (already converted): {f.name}")
            skipped += 1
            continue

        print(f"Convert: {f.name} -> {out_path.name}")
        try:
            if ext in PDF_EXTS:
                convert_pdf(f, out_path, use_ocr=use_ocr)
            elif ext in PANDOC_EXTS:
                if not pandoc_ok:
                    raise RuntimeError(
                        "pandoc is required for .docx/.epub but is not installed"
                    )
                convert_with_pandoc(f, out_path, from_format=ext.lstrip("."))
            elif ext in PASSTHROUGH_EXTS:
                copy_passthrough(f, out_path)
            ok += 1
        except subprocess.CalledProcessError as exc:
            print(f"  ERROR (pandoc) on {f.name}: {exc.stderr}", file=sys.stderr)
            failed += 1
        except Exception as exc:  # noqa: BLE001 — surface any failure, keep going
            print(f"  ERROR on {f.name}: {exc}", file=sys.stderr)
            failed += 1

    print(
        f"\nDone: {ok} converted, {skipped} skipped (already present), "
        f"{failed} failed. Output in: {output_dir}"
    )


def main() -> None:
    """Parse CLI arguments (falling back to config.toml) and run the conversion."""
    cfg = load_config()
    paths = cfg.get("paths", {})
    conv = cfg.get("conversion", {})

    parser = argparse.ArgumentParser(
        description="Convert PDF/EPUB/DOCX/MD/TXT sources into Markdown for an LLM Wiki."
    )
    parser.add_argument(
        "--input",
        default=paths.get("sources", "backup"),
        help="Source folder with original documents (recursive). Default: backup",
    )
    parser.add_argument(
        "--output",
        default=paths.get("raw", "raw"),
        help="Destination folder for Markdown. Default: raw",
    )
    parser.add_argument(
        "--ocr",
        action="store_true",
        default=bool(conv.get("ocr", False)),
        help="Note scanned PDFs (real OCR needs a separate step, see README).",
    )
    args = parser.parse_args()

    input_dir = Path(args.input)
    if not input_dir.is_dir():
        print(f"Invalid input folder: {input_dir}", file=sys.stderr)
        sys.exit(1)

    process_folder(input_dir, Path(args.output), args.ocr)


if __name__ == "__main__":
    main()
