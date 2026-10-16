# 2. Python Reserved for Format Conversion Subprocesses

* **Status:** Accepted
* **Deciders:** Wiki-Forge Engineering
* **Date:** 2026-10-16

## Context and Problem Statement

Python excels at document format conversion (PyMuPDF / `fitz` for PDF page extraction, `pyshacl` for RDF shape validation, Pandoc PDF rendering). However, spreading general application logic between Python and TypeScript creates runtime ambiguity, packaging friction, and complex local installation requirements for non-technical users.

## Decision Drivers

* Clear runtime boundary between TypeScript application orchestration and Python document conversion.
* Minimal installation footprint for lightweight usage.
* High conversion fidelity for multimodal sources (PDF, EPUB, DOCX, Web Clips).

## Considered Options

1. **Re-implement document parsing in pure Node.js/WASM.**
2. **Maintain Python as a co-equal runtime for core logic and APIs.**
3. **Restrict Python's role strictly to document conversion subprocesses (`conv2md.py`, `clip2md.py`) behind typed TS adapters.**

## Decision Outcome

Chosen option: **Option 3 (Python restricted strictly to format conversion behind typed adapters)**.

Python scripts in `scripts/` perform document conversion (`conv2md.py`, `clip2md.py`) and optional specialized semantic tools (e.g., `pyshacl`, `export_semantic.py`). The main application execution environment calls Python as isolated child processes through typed TS adapter interfaces in `src/core/converters/`.

### Positive Consequences

* Clean, unambiguous system boundary.
* Non-technical users running the Web UI/CLI do not need Python unless converting raw PDF/EPUB binary documents.
* Easy containerization in Docker.

### Negative Consequences

* Data passed to Python converters must be serialized via JSON/CLI arguments or filesystem queues.
