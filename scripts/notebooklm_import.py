#!/usr/bin/env python3
"""
scripts/notebooklm_import.py
Importa file Markdown esportati da NotebookLM in wiki-forge,
aggiungendo il frontmatter OKF v0.2 richiesto e posizionandoli in raw/.
"""
import argparse
import sys
from pathlib import Path
from datetime import datetime, timezone
import re
from okf_common import resolve_dir, resolve_path

def generate_okf_frontmatter(title: str, source_name: str) -> str:
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    # Nota: 'human:utente' rispetta la regex ACTOR_REGEX di okf_lint.py
    return f"""---
type: StudyGuide
status: draft
generated:
  by: human:utente
  at: "{now}"
sources:
  - resource: "NotebookLM Export: {source_name}"
    author: "human:utente"
tags:
  - topic/notebooklm
  - status/draft
---

"""

def process_file(input_path: Path, output_dir: Path, source_name: str) -> Path:
    if not input_path.exists():
        print(f"❌ Errore: Il file {input_path} non esiste.", file=sys.stderr)
        sys.exit(1)

    content = input_path.read_text(encoding="utf-8")

    # Rimuovi eventuali frontmatter YAML preesistenti dall'export di NotebookLM
    # per evitare doppi blocchi "---"
    if content.startswith("---"):
        parts = re.split(r"^---\s*$", content, maxsplit=2, flags=re.MULTILINE)
        if len(parts) >= 3:
            content = parts[2].strip()

    # Genera nuovo frontmatter OKF v0.2
    safe_title = input_path.stem.replace("_", " ").title()
    frontmatter = generate_okf_frontmatter(safe_title, source_name)

    # Nome file di output: mantiene il nome originale ma aggiunge suffisso
    output_filename = f"{input_path.stem}_NOTEBOOKLM.md"
    output_path = output_dir / output_filename

    output_path.write_text(frontmatter + content, encoding="utf-8")
    print(f"✅ Importato con successo: {output_path}")
    print("💡 Prossimo passo: Esegui `/compile` nell'agente per integrarlo nella wiki.")
    return output_path

def main():
    parser = argparse.ArgumentParser(description="Importa export Markdown da NotebookLM in wiki-forge.")
    parser.add_argument("input_file", nargs="?", type=Path, help="Percorso del file .md esportato da NotebookLM")
    parser.add_argument("--input-file", dest="opt_input_file", type=Path, help="Percorso del file .md esportato da NotebookLM")
    parser.add_argument("--source", type=str, default="NotebookLM Session", help="Nome descrittivo della fonte")
    parser.add_argument("--output-dir", type=Path, default=Path("raw"), help="Cartella di destinazione (default: raw)")
    parser.add_argument("--json", action="store_true", help="Output result as JSON object on stdout.")

    args = parser.parse_args()
    target_input = args.opt_input_file or args.input_file
    if not target_input:
        if args.json:
            import json
            print(json.dumps({"status": "error", "message": "input_file is required"}))
        else:
            parser.print_help()
        sys.exit(1)

    target_input = resolve_path(str(target_input))
    output_dir = resolve_dir(str(args.output_dir), default="raw")
    output_dir.mkdir(parents=True, exist_ok=True)

    try:
        out_path = process_file(target_input, output_dir, args.source)
        if args.json:
            import json
            print(json.dumps({"status": "success", "output_path": str(out_path)}))
    except SystemExit:
        if args.json:
            import json
            print(json.dumps({"status": "error", "message": f"File {target_input} not found"}))
        sys.exit(1)
    except Exception as exc:
        if args.json:
            import json
            print(json.dumps({"status": "error", "message": str(exc)}))
        sys.exit(1)

if __name__ == "__main__":
    main()
