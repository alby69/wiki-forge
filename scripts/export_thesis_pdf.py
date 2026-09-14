#!/usr/bin/env python3
"""
scripts/export_thesis_pdf.py
Exports compiled thesis markdown (output/thesis_compiled.md) to PDF via Pandoc.
"""

import sys
import os
import subprocess
import argparse
from pathlib import Path

def export_pdf(input_md: Path, output_pdf: Path, pdf_engine: str = "xelatex", toc: bool = True):
    if not input_md.exists():
        print(f"Error: Input file '{input_md}' does not exist. Run scripts/generate_thesis.py first.", file=sys.stderr)
        sys.exit(1)

    cmd = ["pandoc", str(input_md), "-o", str(output_pdf)]
    if toc:
        cmd.append("--toc")
        cmd.append("--toc-depth=3")

    cmd.extend([
        "-V", "geometry:margin=2.5cm",
        "-V", "fontsize=11pt",
        "-V", "document-class=report",
        "--pdf-engine=" + pdf_engine
    ])

    output_pdf.parent.mkdir(parents=True, exist_ok=True)
    print(f"📄 Running Pandoc export: {' '.join(cmd)}")

    try:
        res = subprocess.run(cmd, capture_output=True, text=True)
        if res.returncode == 0:
            print(f"✅ Thesis PDF successfully exported to '{output_pdf}'")
        else:
            print(f"⚠️ Pandoc Warning/Error:\n{res.stderr}", file=sys.stderr)
            # Fallback to wkhtmltopdf or print error
            if "pdf-engine" in res.stderr:
                print("Tip: Ensure LaTeX or standard Pandoc PDF engine is installed on your host system.", file=sys.stderr)
    except Exception as e:
        print(f"Error executing Pandoc: {e}", file=sys.stderr)
        sys.exit(1)

def main():
    parser = argparse.ArgumentParser(description="Export compiled thesis markdown to PDF.")
    parser.add_argument("--input", default="output/thesis_compiled.md", help="Input compiled Markdown file")
    parser.add_argument("--output", default="output/thesis_final.pdf", help="Output PDF file")
    parser.add_argument("--engine", default="xelatex", help="Pandoc PDF engine (e.g., xelatex, pdflatex, wkhtmltopdf, weasyprint)")
    parser.add_argument("--no-toc", action="store_true", help="Disable Table of Contents")

    args = parser.parse_args()
    export_pdf(Path(args.input).resolve(), Path(args.output).resolve(), args.engine, not args.no_toc)

if __name__ == "__main__":
    main()
