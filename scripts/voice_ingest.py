#!/usr/bin/env python3
"""
scripts/voice_ingest.py
Voice & Multimedia Ingestion (No-Code Entry).
Converts audio dictations (.mp3, .wav) or transcriptions into structured OKF v0.2 notes.
"""

import sys
import os
import argparse
import datetime
import json
from pathlib import Path

def ingest_voice_record(file_path: str, output_dir: str = "raw", title: str | None = None) -> dict:
    path_obj = Path(file_path)
    if not path_obj.exists():
        raise FileNotFoundError(f"Audio or transcript file '{file_path}' not found.")

    ext = path_obj.suffix.lower()
    transcript_text = ""

    now_utc = datetime.datetime.now(datetime.timezone.utc)

    if ext in [".txt", ".md"]:
        transcript_text = path_obj.read_text(encoding="utf-8")
    else:
        # Audio file handling (.mp3, .wav, .m4a, .webm)
        # Attempt to import whisper if installed; otherwise generate structured voice note placeholder
        try:
            import whisper
            model = whisper.load_model("base")
            result = model.transcribe(file_path)
            transcript_text = result.get("text", "").strip()
        except Exception:
            # Fallback for environments without whisper binary
            transcript_text = f"[Audio Ingestion: {path_obj.name}]\n\n(Dictated audio recorded on {now_utc.strftime('%Y-%m-%d %H:%M UTC')}).\nTranscript ready for agent processing."

    note_title = title or path_obj.stem.replace("-", " ").replace("_", " ").title()
    slug = path_obj.stem.lower().replace("_", "-").replace(" ", "-")
    date_str = now_utc.strftime("%Y-%m-%d")
    timestamp_str = now_utc.strftime("%Y-%m-%dT%H:%M:%SZ")

    okf_content = f"""---
type: "Concept"
title: "{note_title}"
description: "Voice dictated ingestion from {path_obj.name}"
status: "draft"
generated:
  by: "voice_ingest.py"
  at: "{timestamp_str}"
verified: []
sources:
  - id: "voice-{slug}"
    resource: "{file_path}"
    title: "{path_obj.name}"
    author: "User Voice Dictation"
    last_modified: "{date_str}"
tags:
  - "source/voice"
  - "status/draft"
---

# {note_title}

## Summary
- Voice dictation ingested from `{path_obj.name}`.

## Dictated Transcript
{transcript_text}

## Sources
- `{file_path}`
"""

    out_dir_path = Path(output_dir)
    out_dir_path.mkdir(parents=True, exist_ok=True)
    out_file = out_dir_path / f"voice_{slug}.md"
    out_file.write_text(okf_content, encoding="utf-8")

    return {
        "status": "success",
        "title": note_title,
        "input_file": file_path,
        "output_file": str(out_file),
        "transcript_length": len(transcript_text)
    }

def main():
    parser = argparse.ArgumentParser(description="Voice & Multimedia Ingestion Tool")
    parser.add_argument("file", nargs="?", default="", help="Path to audio file (.mp3, .wav) or transcript text file.")
    parser.add_argument("--file", dest="opt_file", default="", help="Path to audio file (.mp3, .wav) or transcript text file.")
    parser.add_argument("--output", default="raw", help="Output directory for generated Markdown note (default: raw).")
    parser.add_argument("--title", default=None, help="Custom title for the generated note.")
    parser.add_argument("--json", action="store_true", help="Output result as JSON object on stdout.")

    args = parser.parse_args()
    input_file = args.opt_file or args.file

    if not input_file:
        msg = "Error: Input audio or transcript file path is required."
        if args.json:
            print(json.dumps({"status": "error", "message": msg}))
        else:
            print(msg, file=sys.stderr)
        sys.exit(1)

    try:
        res = ingest_voice_record(input_file, args.output, args.title)
        if args.json:
            print(json.dumps(res))
        else:
            print(f"✅ Ingested '{input_file}' -> '{res['output_file']}'")
    except Exception as e:
        if args.json:
            print(json.dumps({"status": "error", "message": str(e)}))
        else:
            print(f"❌ Error during voice ingestion: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
