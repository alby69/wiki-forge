#!/usr/bin/env python3
"""
scripts/ingest_queue.py

Persistent local SQLite queue for resilient document ingestion into Wiki-Forge.
Supports states: pending, processing, completed, failed.
Features automatic retries (max 3), crash recovery, and status tracking.
"""

from __future__ import annotations

import argparse
import json
import os
import queue
import sqlite3
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

DB_FILE = Path("output/ingest_queue.db")

class IngestQueue:
    def __init__(self, db_path: Path = DB_FILE):
        self.db_path = db_path
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    def _get_conn(self) -> sqlite3.Connection:
        conn = sqlite3.connect(str(self.db_path))
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self) -> None:
        with self._get_conn() as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS ingest_jobs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    file_path TEXT UNIQUE NOT NULL,
                    status TEXT NOT NULL DEFAULT 'pending',
                    attempts INTEGER NOT NULL DEFAULT 0,
                    max_retries INTEGER NOT NULL DEFAULT 3,
                    error_message TEXT,
                    created_at REAL NOT NULL,
                    updated_at REAL NOT NULL
                )
            """)
            conn.commit()

    def enqueue_file(self, file_path: str, max_retries: int = 3) -> int:
        norm_path = str(Path(file_path).resolve())
        now = time.time()
        with self._get_conn() as conn:
            cursor = conn.execute(
                """
                INSERT INTO ingest_jobs (file_path, status, attempts, max_retries, created_at, updated_at)
                VALUES (?, 'pending', 0, ?, ?, ?)
                ON CONFLICT(file_path) DO UPDATE SET
                    status = CASE WHEN ingest_jobs.status = 'failed' THEN 'pending' ELSE ingest_jobs.status END,
                    updated_at = ?
                """,
                (norm_path, max_retries, now, now, now)
            )
            conn.commit()
            return cursor.lastrowid or 0

    def enqueue_directory(self, dir_path: str, supported_exts: Optional[set] = None) -> int:
        p = Path(dir_path)
        if not p.is_dir():
            return 0
        if supported_exts is None:
            supported_exts = {".pdf", ".epub", ".docx", ".md", ".markdown", ".txt"}

        files = sorted([f for f in p.rglob("*") if f.is_file() and f.suffix.lower() in supported_exts])
        count = 0
        for f in files:
            self.enqueue_file(str(f))
            count += 1
        return count

    def fetch_next_job(self) -> Optional[Dict[str, Any]]:
        now = time.time()
        with self._get_conn() as conn:
            # Recover stuck processing jobs (> 5 minutes old)
            conn.execute(
                """
                UPDATE ingest_jobs
                SET status = 'pending', updated_at = ?
                WHERE status = 'processing' AND (? - updated_at) > 300
                """,
                (now, now)
            )

            cursor = conn.execute(
                """
                SELECT * FROM ingest_jobs
                WHERE status = 'pending' AND attempts < max_retries
                ORDER BY id ASC
                LIMIT 1
                """
            )
            row = cursor.fetchone()
            if not row:
                return None

            job_id = row["id"]
            attempts = row["attempts"] + 1
            conn.execute(
                """
                UPDATE ingest_jobs
                SET status = 'processing', attempts = ?, updated_at = ?
                WHERE id = ?
                """,
                (attempts, now, job_id)
            )
            conn.commit()

            res = dict(row)
            res["attempts"] = attempts
            res["status"] = "processing"
            return res

    def mark_completed(self, job_id: int) -> None:
        now = time.time()
        with self._get_conn() as conn:
            conn.execute(
                """
                UPDATE ingest_jobs
                SET status = 'completed', error_message = NULL, updated_at = ?
                WHERE id = ?
                """,
                (now, job_id)
            )
            conn.commit()

    def mark_failed(self, job_id: int, error_msg: str) -> None:
        now = time.time()
        with self._get_conn() as conn:
            cursor = conn.execute("SELECT attempts, max_retries FROM ingest_jobs WHERE id = ?", (job_id,))
            row = cursor.fetchone()
            status = "failed"
            if row and row["attempts"] < row["max_retries"]:
                status = "pending"  # Retry

            conn.execute(
                """
                UPDATE ingest_jobs
                SET status = ?, error_message = ?, updated_at = ?
                WHERE id = ?
                """,
                (status, error_msg, now, job_id)
            )
            conn.commit()

    def get_status_summary(self) -> Dict[str, Any]:
        with self._get_conn() as conn:
            cursor = conn.execute(
                """
                SELECT status, COUNT(*) as count FROM ingest_jobs GROUP BY status
                """
            )
            counts = {row["status"]: row["count"] for row in cursor.fetchall()}
            total = sum(counts.values())

            jobs_cursor = conn.execute("SELECT * FROM ingest_jobs ORDER BY id ASC")
            jobs = [dict(r) for r in jobs_cursor.fetchall()]

            return {
                "total": total,
                "pending": counts.get("pending", 0),
                "processing": counts.get("processing", 0),
                "completed": counts.get("completed", 0),
                "failed": counts.get("failed", 0),
                "jobs": jobs,
            }

    def process_queue(self, output_dir: str = "raw") -> tuple[int, int]:
        from scripts.conv2md import convert_pdf, convert_with_pandoc, copy_passthrough, PDF_EXTS, PANDOC_EXTS, PASSTHROUGH_EXTS, check_pandoc, target_path

        out_p = Path(output_dir)
        out_p.mkdir(parents=True, exist_ok=True)
        pandoc_ok = check_pandoc()

        processed = 0
        failed = 0

        while True:
            job = self.fetch_next_job()
            if not job:
                break

            job_id = job["id"]
            fpath = Path(job["file_path"])
            out_file = target_path(out_p, fpath.stem)

            try:
                if not fpath.exists():
                    raise FileNotFoundError(f"Source file missing: {fpath}")

                ext = fpath.suffix.lower()
                if ext in PDF_EXTS:
                    convert_pdf(fpath, out_file, use_ocr=False)
                elif ext in PANDOC_EXTS:
                    if not pandoc_ok:
                        raise RuntimeError("pandoc missing for .docx/.epub")
                    convert_with_pandoc(fpath, out_file, from_format=ext.lstrip("."))
                elif ext in PASSTHROUGH_EXTS:
                    copy_passthrough(fpath, out_file)
                else:
                    raise ValueError(f"Unsupported extension: {ext}")

                self.mark_completed(job_id)
                processed += 1
            except Exception as e:
                self.mark_failed(job_id, str(e))
                failed += 1

        return processed, failed


def main():
    parser = argparse.ArgumentParser(description="Resilient Ingestion Queue for Wiki-Forge")
    parser.add_argument("--enqueue", help="Path to file or directory to enqueue")
    parser.add_argument("--process", action="store_true", help="Process pending items in the queue")
    parser.add_argument("--output", default="raw", help="Output directory for processed Markdown")
    parser.add_argument("--status", action="store_true", help="Display queue status summary")
    parser.add_argument("--json", action="store_true", help="Output status as JSON")

    args = parser.parse_args()
    q = IngestQueue()

    if args.enqueue:
        p = Path(args.enqueue)
        if p.is_dir():
            count = q.enqueue_directory(str(p))
            msg = f"Enqueued {count} files from folder {p}"
        elif p.is_file():
            q.enqueue_file(str(p))
            msg = f"Enqueued file {p}"
        else:
            msg = f"Invalid path: {p}"

        if args.json:
            print(json.dumps({"status": "ok", "message": msg}))
        else:
            print(msg)

    if args.process:
        proc, fail = q.process_queue(args.output)
        msg = f"Processing finished: {proc} completed, {fail} failed."
        if args.json:
            print(json.dumps({"status": "ok", "processed": proc, "failed": fail}))
        else:
            print(msg)

    if args.status or (not args.enqueue and not args.process):
        summary = q.get_status_summary()
        if args.json:
            print(json.dumps(summary))
        else:
            print(f"Ingest Queue Status: {summary['completed']}/{summary['total']} completed (Pending: {summary['pending']}, Processing: {summary['processing']}, Failed: {summary['failed']})")

if __name__ == "__main__":
    main()
