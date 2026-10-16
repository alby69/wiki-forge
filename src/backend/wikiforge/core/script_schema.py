"""
script_schema.py — Dynamic Script Schema Registry & CLI Interface for Wiki-Forge.

WHAT THIS DOES
--------------
Provides a single source of truth for script schemas in Python, allowing any script
to handle `--json-schema` automatically and output its metadata as a JSON string on stdout.
"""

from __future__ import annotations

import json
import sys
from typing import Any, Dict, List, Optional


SCRIPT_SCHEMAS: Dict[str, Dict[str, Any]] = {
    "conv2md": {
        "id": "conv2md",
        "path": "scripts/conv2md.py",
        "displayName": "Convert Sources to Markdown",
        "category": "Ingestion",
        "description": "Converts PDF, EPUB, DOCX, MD, and TXT sources from input directory into raw/ Markdown notes.",
        "parameters": [
            {"name": "input", "label": "Input Directory", "type": "text", "default": "backup", "cliFlag": "--input", "description": "Source directory containing documents."},
            {"name": "output", "label": "Output Directory", "type": "text", "default": "raw", "cliFlag": "--output", "description": "Destination directory for Markdown notes."},
            {"name": "ocr", "label": "Use OCR Flag", "type": "boolean", "default": False, "cliFlag": "--ocr", "description": "Note scanned PDFs for OCR extraction."},
        ],
    },
    "enrich_cot": {
        "id": "enrich_cot",
        "path": "scripts/enrich_cot.py",
        "displayName": "Two-Step CoT Enrichment",
        "category": "Ingestion",
        "description": "Applies Two-Step Chain-of-Thought (Analysis -> Generation) enrichment on Markdown notes.",
        "parameters": [
            {"name": "input", "label": "Input Directory", "type": "text", "default": "raw", "cliFlag": "--input", "description": "Source directory containing Markdown notes."},
            {"name": "output", "label": "Output Directory", "type": "text", "default": "wiki", "cliFlag": "--output", "description": "Destination directory for enriched notes."},
        ],
    },
    "clip2md": {
        "id": "clip2md",
        "path": "scripts/clip2md.py",
        "displayName": "Web Clipper",
        "category": "Ingestion",
        "description": "Fetches HTML from a target web URL and saves clean Markdown to sources/web-clips/.",
        "parameters": [
            {"name": "url", "label": "URL to Clip", "type": "text", "required": True, "positional": True, "placeholder": "https://example.com/article", "description": "Target webpage URL."},
            {"name": "output", "label": "Output Directory", "type": "text", "default": "sources/web-clips", "cliFlag": "--output", "description": "Destination folder for web clips."},
        ],
    },
    "notebooklm_import": {
        "id": "notebooklm_import",
        "path": "scripts/notebooklm_import.py",
        "displayName": "Import NotebookLM Export",
        "category": "Ingestion",
        "description": "Imports NotebookLM Markdown export files with OKF v0.2 frontmatter metadata.",
        "parameters": [
            {"name": "input_file", "label": "Export File Path", "type": "text", "required": True, "positional": True, "placeholder": "sources/notebooklm-export.md", "description": "Path to exported .md file."},
            {"name": "source", "label": "Source Name", "type": "text", "default": "NotebookLM Session", "cliFlag": "--source", "description": "Descriptive title for the source."},
            {"name": "output_dir", "label": "Output Directory", "type": "text", "default": "raw", "cliFlag": "--output-dir", "description": "Destination folder for imported note."},
        ],
    },
    "migrate_to_okf": {
        "id": "migrate_to_okf",
        "path": "scripts/migrate_to_okf.py",
        "displayName": "Migrate to OKF v0.2",
        "category": "OKF Maintenance",
        "description": "One-shot migration converting existing wiki Markdown files to OKF v0.2 compliant frontmatter.",
        "parameters": [
            {"name": "confirm", "label": "Confirm Migration (Danger / Backup first)", "type": "boolean", "default": False, "required": True, "cliFlag": "--confirm", "description": "Check to acknowledge irreversible frontmatter migration."},
            {"name": "wiki_dir", "label": "Wiki Directory (optional)", "type": "text", "default": "", "cliFlag": "--wiki-dir", "placeholder": "auto → projects/tesi/wiki", "description": "Target wiki dir."},
        ],
    },
    "okf_lint": {
        "id": "okf_lint",
        "path": "scripts/okf_lint.py",
        "displayName": "Lint OKF Bundle",
        "category": "OKF Maintenance",
        "description": "Validates frontmatter structure, required fields, and index compliance across all notes.",
        "parameters": [
            {"name": "wiki_dir", "label": "Wiki Directory", "type": "text", "default": "wiki", "positional": True, "description": "Path to target wiki directory."},
        ],
    },
    "okf_log": {
        "id": "okf_log",
        "path": "scripts/okf_log.py",
        "displayName": "Append OKF Log Entry",
        "category": "OKF Maintenance",
        "description": "Appends a new entry to the OKF wiki update log (wiki/log.md).",
        "parameters": [
            {"name": "wiki_dir", "label": "Wiki Directory", "type": "text", "default": "wiki", "positional": True, "description": "Path to target wiki directory."},
            {"name": "message", "label": "Log Message", "type": "text", "required": True, "positional": True, "placeholder": "Descriptive summary of changes", "description": "Details of the update."},
            {"name": "type", "label": "Log Type", "type": "select", "default": "Update", "cliFlag": "--type", "options": ["Update", "Creation", "Deprecation", "Initialization"], "description": "Category keyword for the log entry."},
            {"name": "date", "label": "Date (YYYY-MM-DD)", "type": "text", "cliFlag": "--date", "placeholder": "Today (UTC)", "description": "Optional override date."},
        ],
    },
    "okf_reindex": {
        "id": "okf_reindex",
        "path": "scripts/okf_reindex.py",
        "displayName": "Regenerate OKF Indexes",
        "category": "OKF Maintenance",
        "description": "Regenerates master index.md and thematic folder indexes according to OKF §8.",
        "parameters": [
            {"name": "wiki_dir", "label": "Wiki Directory", "type": "text", "default": "wiki", "positional": True, "description": "Path to target wiki directory."},
        ],
    },
    "okf_stats": {
        "id": "okf_stats",
        "path": "scripts/okf_stats.py",
        "displayName": "OKF Bundle Analytics",
        "category": "OKF Maintenance",
        "description": "Generates OKF bundle analytics report covering note types, statuses, and trust tiers.",
        "parameters": [
            {"name": "wiki_dir", "label": "Wiki Directory", "type": "text", "default": "wiki", "positional": True, "description": "Path to target wiki directory."},
        ],
    },
    "wiki_stats": {
        "id": "wiki_stats",
        "path": "scripts/wiki_stats.py",
        "displayName": "Global Wiki Statistics",
        "category": "Analysis & Metrics",
        "description": "Calculates global wiki statistics and updates docs/METRICS.md.",
        "parameters": [],
    },
    "maturity_calculator": {
        "id": "maturity_calculator",
        "path": "scripts/maturity_calculator.py",
        "displayName": "Calculate Maturity Score",
        "category": "Analysis & Metrics",
        "description": "Calculates and updates Maturity Index scores (0-100) for wiki notes.",
        "parameters": [
            {"name": "path", "label": "Target Path", "type": "text", "default": "wiki", "positional": True, "description": "Path to note file or wiki directory."},
            {"name": "write", "label": "Write to Frontmatter", "type": "boolean", "default": False, "cliFlag": "--write", "description": "Persist maturity scores directly into Markdown YAML."},
            {"name": "dry_run", "label": "Dry Run Mode", "type": "boolean", "default": False, "cliFlag": "--dry-run", "description": "Display calculation preview without writing."},
            {"name": "min_score", "label": "Min Score Filter", "type": "number", "default": 0, "cliFlag": "--min-score", "description": "Filter output by minimum maturity score."},
        ],
    },
    "check_docs_sync": {
        "id": "check_docs_sync",
        "path": "scripts/check_docs_sync.py",
        "displayName": "Verify Docs & Skills Sync",
        "category": "Analysis & Metrics",
        "description": "Verifies consistency between agent skills, README, TUTORIAL, and CHANGELOG.",
        "parameters": [],
    },
    "suggest_tags": {
        "id": "suggest_tags",
        "path": "scripts/suggest_tags.py",
        "displayName": "Suggest Taxonomy Tags",
        "category": "Taxonomy",
        "description": "Suggests taxonomy tags for notes using controlled vocabulary (RAKE / KeyBERT).",
        "parameters": [
            {"name": "all", "label": "Process Entire Wiki", "type": "boolean", "default": True, "cliFlag": "--all", "description": "Batch process all notes in wiki directory."},
            {"name": "file", "label": "Single Note Path", "type": "text", "positional": True, "placeholder": "wiki/concept.md", "description": "Single note file path."},
            {"name": "wiki", "label": "Wiki Directory", "type": "text", "default": "wiki", "cliFlag": "--wiki", "description": "Path to wiki folder."},
            {"name": "write", "label": "Write Frontmatter", "type": "boolean", "default": False, "cliFlag": "--write", "description": "Write suggested tags into Markdown frontmatter."},
            {"name": "top", "label": "Max Tags", "type": "number", "default": 6, "cliFlag": "--top", "description": "Maximum number of tags to retain."},
            {"name": "semantic", "label": "Semantic Mode (KeyBERT)", "type": "boolean", "default": False, "cliFlag": "--semantic", "description": "Use KeyBERT semantic embeddings if installed."},
        ],
    },
    "schema_infer": {
        "id": "schema_infer",
        "path": "scripts/schema_infer.py",
        "displayName": "Infer Domain Schema",
        "category": "Knowledge Engineering",
        "description": "Scans wiki pages and proposes a [schema] TOML block of types, fields, and relations.",
        "parameters": [
            {"name": "project", "label": "Project ID", "type": "text", "cliFlag": "--project", "description": "Project ID."},
            {"name": "wiki_dir", "label": "Wiki Directory", "type": "text", "default": "wiki", "cliFlag": "--wiki-dir", "description": "Override wiki directory path."},
        ],
    },
    "schema_lint": {
        "id": "schema_lint",
        "path": "scripts/schema_lint.py",
        "displayName": "Lint Schema Constraints",
        "category": "Knowledge Engineering",
        "description": "Validates wiki pages against the [schema] defined in config.toml.",
        "parameters": [
            {"name": "project", "label": "Project ID", "type": "text", "cliFlag": "--project", "description": "Project ID."},
            {"name": "wiki_dir", "label": "Wiki Directory", "type": "text", "default": "wiki", "cliFlag": "--wiki-dir", "description": "Override wiki directory path."},
            {"name": "strict", "label": "Strict Mode Flag", "type": "boolean", "default": False, "cliFlag": "--strict", "description": "Treat violations as errors."},
            {"name": "path", "label": "Path Pattern Filter", "type": "text", "cliFlag": "--path", "description": "Filter pages by path pattern."},
            {"name": "config", "label": "Config Path", "type": "text", "cliFlag": "--config", "description": "Override config.toml path."},
        ],
    },
    "generate_thesis": {
        "id": "generate_thesis",
        "path": "scripts/generate_thesis.py",
        "displayName": "Compile Thesis Draft",
        "category": "Thesis & Study",
        "description": "Aggregates wiki notes and chapter syntheses into a single compiled thesis draft.",
        "parameters": [
            {"name": "wiki_dir", "label": "Wiki Directory", "type": "text", "default": "wiki", "cliFlag": "--wiki-dir", "description": "Path to target wiki directory."},
            {"name": "output", "label": "Output Path", "type": "text", "default": "output/thesis_compiled.md", "cliFlag": "--output", "description": "Destination path for compiled Markdown."},
            {"name": "min_maturity", "label": "Min Maturity Score", "type": "number", "default": 0, "cliFlag": "--min-maturity", "description": "Filter included notes by minimum maturity."},
            {"name": "title", "label": "Thesis Title", "type": "text", "default": "Thesis Draft", "cliFlag": "--title", "description": "Title header for the compiled document."},
        ],
    },
    "export_thesis_pdf": {
        "id": "export_thesis_pdf",
        "path": "scripts/export_thesis_pdf.py",
        "displayName": "Export Thesis to PDF",
        "category": "Thesis & Study",
        "description": "Exports compiled thesis Markdown to PDF format via Pandoc.",
        "parameters": [
            {"name": "input", "label": "Input Markdown Path", "type": "text", "default": "output/thesis_compiled.md", "cliFlag": "--input", "description": "Source compiled thesis Markdown file."},
            {"name": "output", "label": "Output PDF Path", "type": "text", "default": "output/thesis_final.pdf", "cliFlag": "--output", "description": "Destination PDF file path."},
            {"name": "engine", "label": "PDF Engine", "type": "select", "default": "xelatex", "cliFlag": "--engine", "options": ["xelatex", "pdflatex", "wkhtmltopdf", "weasyprint"], "description": "Pandoc PDF rendering engine."},
            {"name": "no_toc", "label": "Disable TOC", "type": "boolean", "default": False, "cliFlag": "--no-toc", "description": "Disable automatic Table of Contents generation."},
        ],
    },
    "wizard": {
        "id": "wizard",
        "path": "scripts/wizard.py",
        "displayName": "Domain Setup Wizard",
        "category": "Wizard",
        "description": "Interactive domain setup wizard for academic, business, research, creative, or thesis workflows.",
        "parameters": [
            {"name": "preset", "label": "Domain Preset", "type": "select", "default": "academic", "cliFlag": "--preset", "options": ["academic", "business", "research", "creative", "existing", "thesis"], "description": "Scenario preset configuration."},
        ],
    },
    "voice_ingest": {
        "id": "voice_ingest",
        "path": "scripts/voice_ingest.py",
        "displayName": "Voice & Multimedia Ingest",
        "category": "Ingestion",
        "description": "Converts audio dictations or text transcriptions into structured OKF v0.2 notes.",
        "parameters": [
            {"name": "file", "label": "Audio / Transcript File Path", "type": "text", "required": True, "positional": True, "placeholder": "sources/dictation.mp3", "description": "Path to audio or transcript file."},
            {"name": "output", "label": "Output Directory", "type": "text", "default": "raw", "cliFlag": "--output", "description": "Destination directory for generated Markdown note."},
            {"name": "title", "label": "Note Title", "type": "text", "cliFlag": "--title", "placeholder": "Voice Note Title", "description": "Optional custom title."},
        ],
    },
    "export_semantic": {
        "id": "export_semantic",
        "path": "scripts/export_semantic.py",
        "displayName": "Semantic RDF Exporter (JSON-LD/TTL)",
        "category": "Knowledge Engineering",
        "description": "Exports OKF v0.2 knowledge base notes into W3C standard RDF formats (JSON-LD and Turtle).",
        "parameters": [
            {"name": "wiki_dir", "label": "Wiki Directory", "type": "text", "default": "wiki", "cliFlag": "--wiki-dir", "description": "Path to target wiki folder."},
            {"name": "output_dir", "label": "Output Directory", "type": "text", "default": "output", "cliFlag": "--output-dir", "description": "Destination folder for JSON-LD and TTL files."},
        ],
    },
    "ontology_rules": {
        "id": "ontology_rules",
        "path": "scripts/ontology_rules.py",
        "displayName": "Ontology Rule Engine",
        "category": "Knowledge Engineering",
        "description": "Validates logical ontology constraints.",
        "parameters": [
            {"name": "wiki_dir", "label": "Wiki Directory", "type": "text", "default": "wiki", "positional": True, "description": "Path to target wiki folder."},
            {"name": "strict", "label": "Strict Mode Flag", "type": "boolean", "default": False, "cliFlag": "--strict", "description": "Return error code if rule violations are found."},
        ],
    },
    "cq_validator": {
        "id": "cq_validator",
        "path": "scripts/cq_validator.py",
        "displayName": "Competency Questions Engine",
        "category": "Knowledge Engineering",
        "description": "Validates knowledge base coverage against natural language Competency Questions (CQ).",
        "parameters": [
            {"name": "wiki_dir", "label": "Wiki Directory", "type": "text", "default": "wiki", "cliFlag": "--wiki-dir", "description": "Path to target wiki folder."},
            {"name": "cq_file", "label": "CQ File Path", "type": "text", "default": "wiki/competency_questions.md", "cliFlag": "--cq-file", "description": "Path to Markdown competency questions file."},
            {"name": "output", "label": "Report Output Path", "type": "text", "default": "output/cq_validation_report.md", "cliFlag": "--output", "description": "Destination path for markdown report."},
        ],
    },
    "odp_suggester": {
        "id": "odp_suggester",
        "path": "scripts/odp_suggester.py",
        "displayName": "ODP Pattern Suggester",
        "category": "Knowledge Engineering",
        "description": "Scans informal note properties and suggests formal Ontology Design Patterns (ODP).",
        "parameters": [
            {"name": "wiki_dir", "label": "Wiki Directory", "type": "text", "default": "wiki", "cliFlag": "--wiki-dir", "description": "Path to target wiki folder."},
            {"name": "catalog", "label": "ODP Catalog Path", "type": "text", "default": "config/odp_catalog.json", "cliFlag": "--catalog", "description": "Path to JSON ODP catalog."},
        ],
    },
    "neuro_symbolic_check": {
        "id": "neuro_symbolic_check",
        "path": "scripts/neuro_symbolic_check.py",
        "displayName": "Neuro-Symbolic Consistency Check",
        "category": "Knowledge Engineering",
        "description": "Checks logical contradictions and infers missing semantic links across the knowledge graph.",
        "parameters": [
            {"name": "wiki_dir", "label": "Wiki Directory", "type": "text", "default": "wiki", "cliFlag": "--wiki-dir", "description": "Path to target wiki folder."},
            {"name": "output", "label": "Report Output Path", "type": "text", "default": "output/neuro_symbolic_report.md", "cliFlag": "--output", "description": "Destination path for markdown report."},
        ],
    },
    "ke_maturity": {
        "id": "ke_maturity",
        "path": "scripts/ke_maturity.py",
        "displayName": "KE Maturity Assessment",
        "category": "Knowledge Engineering",
        "description": "Assesses knowledge base platform maturity across 6 dimensions (L1-L4).",
        "parameters": [
            {"name": "wiki_dir", "label": "Wiki Directory", "type": "text", "default": "wiki", "cliFlag": "--wiki-dir", "description": "Path to target wiki folder."},
            {"name": "output", "label": "Report Output Path", "type": "text", "default": "output/ke_maturity_report.md", "cliFlag": "--output", "description": "Destination path for markdown report."},
        ],
    },
    "graph_analytics": {
        "id": "graph_analytics",
        "path": "scripts/graph_analytics.py",
        "displayName": "Graph Louvain Analytics & Insights",
        "category": "Analysis & Metrics",
        "description": "Performs Louvain community detection and surfaces surprising links.",
        "parameters": [
            {"name": "wiki_dir", "label": "Wiki Directory", "type": "text", "default": "wiki", "cliFlag": "--wiki-dir", "description": "Path to target wiki directory."},
        ],
    },
}


def check_and_handle_json_schema(script_id: str) -> None:
    """
    Check if `--json-schema` is present in `sys.argv`.
    If present, print the script's JSON schema to stdout and exit cleanly with 0.
    """
    if "--json-schema" in sys.argv:
        schema = SCRIPT_SCHEMAS.get(script_id, {
            "id": script_id,
            "displayName": script_id,
            "category": "General",
            "description": "Wiki-Forge CLI script",
            "parameters": []
        })
        print(json.dumps(schema, indent=2))
        sys.exit(0)
