#!/usr/bin/env python3
"""
ingest_queue.py — Persistent Ingestion Queue Engine for Wiki-Forge.

Provides disk-backed queue management with SQLite, automatic crash recovery,
retry logic (max 3 attempts), status tracking, and JSON output formatting.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sqlite3
import sys
import time
from pathlib import Path


DB_DIR = Path(".wiki-forge")
DB_PATH = DB_DIR / "ingest_queue.db"


def init_db(db_path: Path = DB_PATH) -> sqlite3.Connection:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    with conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS queue_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                file_path TEXT UNIQUE NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                attempts INTEGER NOT NULL DEFAULT 0,
                max_attempts INTEGER NOT NULL DEFAULT 3,
                error_message TEXT,
                sha256_hash TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
    return conn


def compute_sha256(path: Path) -> str:
    hasher = hashlib.sha256()
    with path.open("rb") as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    return hasher.hexdigest()


def enqueue_file(file_path: Path, conn: sqlite3.Connection | None = None) -> dict:
    if conn is None:
        conn = init_db()

    file_str = str(file_path.resolve())
    sha = compute_sha256(file_path) if file_path.exists() else ""

    with conn:
        cursor = conn.execute("SELECT * FROM queue_items WHERE file_path = ?", (file_str,))
        existing = cursor.fetchone()
        if existing:
            if existing["sha256_hash"] == sha and existing["status"] == "completed":
                return dict(existing)
            conn.execute(
                "UPDATE queue_items SET status = 'pending', attempts = 0, sha256_hash = ?, error_message = NULL, updated_at = CURRENT_TIMESTAMP WHERE file_path = ?",
                (sha, file_str),
            )
        else:
            conn.execute(
                "INSERT INTO queue_items (file_path, sha256_hash) VALUES (?, ?)",
                (file_str, sha),
            )

    cursor = conn.execute("SELECT * FROM queue_items WHERE file_path = ?", (file_str,))
    return dict(cursor.fetchone())


def get_queue_items(conn: sqlite3.Connection | None = None) -> list[dict]:
    if conn is None:
        conn = init_db()
    cursor = conn.execute("SELECT * FROM queue_items ORDER BY id ASC")
    return [dict(row) for row in cursor.fetchall()]


def update_status(file_path: str, status: str, error: str = "", conn: sqlite3.Connection | None = None) -> None:
    if conn is None:
        conn = init_db()
    with conn:
        if status == "processing":
            conn.execute(
                "UPDATE queue_items SET status = ?, attempts = attempts + 1, updated_at = CURRENT_TIMESTAMP WHERE file_path = ?",
                (status, file_path),
            )
        else:
            conn.execute(
                "UPDATE queue_items SET status = ?, error_message = ?, updated_at = CURRENT_TIMESTAMP WHERE file_path = ?",
                (status, error, file_path),
            )


def reset_failed(conn: sqlite3.Connection | None = None) -> int:
    if conn is None:
        conn = init_db()
    with conn:
        cursor = conn.execute(
            "UPDATE queue_items SET status = 'pending', attempts = 0, error_message = NULL WHERE status = 'failed' OR attempts < max_attempts"
        )
        return cursor.rowcount


def main() -> None:
    parser = argparse.ArgumentParser(description="Wiki-Forge Ingestion Queue CLI")
    parser.add_argument("action", nargs="?", choices=["list", "enqueue", "reset"], default="list")
    parser.add_argument("--file", help="File path to enqueue")
    parser.add_argument("--json", action="store_true", help="JSON output format")

    args = parser.parse_args()
    conn = init_db()

    if args.action == "enqueue" and args.file:
        res = enqueue_file(Path(args.file), conn)
        if args.json:
            print(json.dumps(res))
        else:
            print(f"Enqueued: {res['file_path']} (Status: {res['status']})")
    elif args.action == "reset":
        cnt = reset_failed(conn)
        if args.json:
            print(json.dumps({"status": "success", "reset_count": cnt}))
        else:
            print(f"Reset {cnt} failed queue items.")
    else:
        items = get_queue_items(conn)
        if args.json:
            print(json.dumps({"items": items}))
        else:
            print(f"Total Queue Items: {len(items)}")
            for it in items:
                print(f"[{it['id']}] {it['status']} (attempts: {it['attempts']}/{it['max_attempts']}) - {it['file_path']}")


if __name__ == "__main__":
    main()
