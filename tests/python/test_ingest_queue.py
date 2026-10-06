import tempfile
from pathlib import Path
import pytest
from scripts.ingest_queue import IngestQueue

def test_ingest_queue_basic():
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "test_queue.db"
        q = IngestQueue(db_path=db_path)

        f1 = Path(tmpdir) / "sample1.md"
        f1.write_text("Test content 1", encoding="utf-8")

        f2 = Path(tmpdir) / "sample2.txt"
        f2.write_text("Test content 2", encoding="utf-8")

        count = q.enqueue_directory(tmpdir)
        assert count == 2

        summary = q.get_status_summary()
        assert summary["total"] == 2
        assert summary["pending"] == 2

        job = q.fetch_next_job()
        assert job is not None
        assert job["status"] == "processing"

        q.mark_completed(job["id"])
        summary = q.get_status_summary()
        assert summary["completed"] == 1
        assert summary["pending"] == 1

def test_ingest_queue_retry_and_process():
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "test_queue.db"
        output_dir = Path(tmpdir) / "raw_out"
        q = IngestQueue(db_path=db_path)

        f1 = Path(tmpdir) / "sample1.md"
        f1.write_text("Sample MD text", encoding="utf-8")

        q.enqueue_file(str(f1), max_retries=2)
        proc, fail = q.process_queue(output_dir=str(output_dir))
        assert proc == 1
        assert fail == 0

        out_file = output_dir / "sample1.md"
        assert out_file.exists()
        assert out_file.read_text(encoding="utf-8") == "Sample MD text"
