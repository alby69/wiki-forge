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
from typing import List, Tuple

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


def extract_pdf_images(pdf_path: Path, assets_dir: Path) -> List[Tuple[int, str]]:
    """Extract images from PDF pages and save into assets_dir."""
    extracted = []
    try:
        import fitz  # PyMuPDF
    except ImportError:
        return extracted

    assets_dir.mkdir(parents=True, exist_ok=True)
    try:
        doc = fitz.open(str(pdf_path))
        for page_num in range(len(doc)):
            page = doc[page_num]
            image_list = page.get_images(full=True)
            for img_index, img_info in enumerate(image_list, start=1):
                xref = img_info[0]
                base_image = doc.extract_image(xref)
                image_bytes = base_image["image"]
                image_ext = base_image["ext"]
                img_filename = f"{pdf_path.stem}_p{page_num + 1}_img{img_index}.{image_ext}"
                img_file_path = assets_dir / img_filename
                img_file_path.write_bytes(image_bytes)
                extracted.append((page_num + 1, img_filename))
        doc.close()
    except Exception as e:
        print(f"  [warning] Image extraction failed for {pdf_path.name}: {e}", file=sys.stderr)

    return extracted


def convert_pdf(path: Path, out_path: Path, use_ocr: bool) -> None:
    """Convert a PDF to Markdown using pymupdf4llm and extract images."""
    import pymupdf4llm  # imported lazily so the dep is only needed for PDFs

    if use_ocr:
        print(
            f"  [note] {path.name}: OCR requested, but pymupdf4llm extracts the "
            "native text layer. For scans, run an OCR step (e.g. Tesseract) first."
        )

    md = pymupdf4llm.to_markdown(str(path))
    if isinstance(md, list):
        md = "\n\n".join(chunk.get("text", "") for chunk in md)

    # Extract images to wiki/assets or output_dir/assets
    assets_dir = out_path.parent / "assets"
    extracted_imgs = extract_pdf_images(path, assets_dir)

    if extracted_imgs:
        img_md_lines = ["\n\n## 🖼️ Estratte Immagini dal Documento\n"]
        for page_num, img_filename in extracted_imgs:
            img_md_lines.append(f"![Immagine estratta da pag. {page_num}](../assets/{img_filename})")
        md += "\n".join(img_md_lines)

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


def process_folder(input_dir: Path, output_dir: Path, use_ocr: bool, quiet: bool = False) -> tuple[int, int, int]:
    """Walk `input_dir`, convert every supported file into `output_dir`."""
    output_dir.mkdir(parents=True, exist_ok=True)
    pandoc_ok = check_pandoc()

    files = sorted(
        p for p in input_dir.rglob("*") if p.suffix.lower() in SUPPORTED_EXTS
    )
    if not files:
        if not quiet:
            print(f"No PDF/EPUB/DOCX/MD/TXT files found in {input_dir}", file=sys.stderr)
        return 0, 0, 0

    ok, skipped, failed = 0, 0, 0
    for f in files:
        ext = f.suffix.lower()
        out_path = target_path(output_dir, f.stem)

        # Idempotency: never overwrite an existing conversion.
        if already_converted(output_dir, f.stem):
            if not quiet:
                print(f"Skip (already converted): {f.name}", file=sys.stderr)
            skipped += 1
            continue

        if not quiet:
            print(f"Convert: {f.name} -> {out_path.name}", file=sys.stderr)
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

    if not quiet:
        print(
            f"\nDone: {ok} converted, {skipped} skipped (already present), "
            f"{failed} failed. Output in: {output_dir}",
            file=sys.stderr
        )
    return ok, skipped, failed


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
    parser.add_argument(
        "--json",
        action="store_true",
        help="Output result as JSON object on stdout.",
    )
    args = parser.parse_args()

    input_dir = Path(args.input)
    if not input_dir.is_dir():
        msg = f"Invalid input folder: {input_dir}"
        if args.json:
            import json
            print(json.dumps({"status": "error", "message": msg}))
        else:
            print(msg, file=sys.stderr)
        sys.exit(1)

    result = process_folder(input_dir, Path(args.output), args.ocr, quiet=args.json)
    if args.json:
        import json
        print(json.dumps({
            "status": "success",
            "ok": result[0],
            "skipped": result[1],
            "failed": result[2],
            "output_dir": str(args.output),
        }))


if __name__ == "__main__":
    main()
