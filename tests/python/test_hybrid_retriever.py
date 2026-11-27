"""Phase 94 — dependency-free hybrid retriever and measurable eval gate."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import pytest

from src.backend.wikiforge.api import health
from src.backend.wikiforge.retrieval.retriever import (
    BM25Index,
    DiskVectorStore,
    EmbeddingsConfig,
    HybridRetriever,
    NoteDocument,
    RetrievalHit,
    graph_expand,
    rrf_fuse,
)
from tests.eval import run_eval

REPO_ROOT = Path(__file__).resolve().parents[2]


def _notes() -> list[NoteDocument]:
    return [
        NoteDocument("alpha", "Alpha protocol", "alpha gamma delta", "wiki/alpha.md", ("topic",), ("beta",)),
        NoteDocument("beta", "Beta protocol", "beta gamma", "wiki/beta.md", ("topic",)),
        NoteDocument("gamma", "Gamma note", "unrelated text", "wiki/gamma.md"),
    ]


def test_bm25_index_updates_incrementally_and_persists(tmp_path: Path) -> None:
    path = tmp_path / "index" / "bm25-default.json"
    index = BM25Index(path)
    index.sync(_notes())
    index.save()

    reloaded = BM25Index(path)
    assert "alpha" in {hit.note_id for hit in reloaded.search("gamma")}
    assert path.is_file()

    reloaded.upsert(NoteDocument("alpha", "Alpha protocol", "new sigma content", "wiki/alpha.md"))
    reloaded.save()
    again = BM25Index(path)
    scores = {hit.note_id for hit in again.search("sigma")}
    assert scores == {"alpha"}
    assert all(hit.note_id != "alpha" for hit in again.search("delta"))

    assert again.remove("alpha") is True
    assert again.remove("alpha") is False
    assert again.search("sigma") == []


def test_bm25_sync_removes_stale_notes(tmp_path: Path) -> None:
    index = BM25Index(tmp_path / "index.json")
    index.sync(_notes())
    assert len(index.docs) == 3
    index.sync([_notes()[0]])
    assert set(index.docs) == {"alpha"}


def test_rrf_fusion_orders_by_combined_rank_and_merges_channels() -> None:
    fused = rrf_fuse([(["b", "a", "c"], "lexical"), (["a", "d", "b"], "semantic")], k=60)
    assert [hit.note_id for hit in fused] == ["a", "b", "d", "c"]
    assert fused[0].channel == "lexical+semantic"
    assert fused[0].score == pytest.approx(1 / 61 + 1 / 62)


def test_graph_expansion_adds_one_hop_neighbour_after_seed() -> None:
    hits = [RetrievalHit("seed", 0.016, "lexical"), RetrievalHit("other", 0.015, "lexical")]
    expanded = graph_expand(
        hits, {"seed": ["neighbour"], "other": [], "neighbour": []}, seeds=2, per_seed=1
    )
    assert [hit.note_id for hit in expanded] == ["seed", "neighbour", "other"]
    assert expanded[1].channel == "graph:seed"
    assert expanded[1].score == pytest.approx(0.016 * 0.92)


def test_embeddings_disabled_ignores_vectors_on_disk(tmp_path: Path) -> None:
    config_dir = tmp_path / "config"
    config_dir.mkdir()
    (config_dir / "config.toml").write_text(
        '[retrieval.embeddings]\nenabled = false\n', encoding="utf-8"
    )
    (tmp_path / "vectors.json").write_text(json.dumps({"alpha": [1.0, 0.0]}), encoding="utf-8")

    config = EmbeddingsConfig.load(tmp_path)
    assert config.enabled is False
    store = DiskVectorStore(config, tmp_path)
    assert store.search([1.0, 0.0]) == []

    index = BM25Index(tmp_path / "index.json")
    index.sync(_notes())
    retriever = HybridRetriever(index=index, embeddings=config, vectors=store)
    assert retriever.retrieve("gamma", query_vector=[1.0, 0.0])


def test_enabled_disk_vectors_contribute_to_rrf(tmp_path: Path) -> None:
    (tmp_path / "vectors.json").write_text(
        json.dumps({"gamma": [1.0, 0.0], "alpha": [0.0, 1.0]}), encoding="utf-8"
    )
    config = EmbeddingsConfig(enabled=True, vectors_path="vectors.json")
    store = DiskVectorStore(config, tmp_path)
    semantic = store.search([1.0, 0.0], limit=2)
    assert semantic[0].note_id == "gamma"
    assert semantic[0].channel == "semantic"


def test_cli_query_and_incremental_update(tmp_path: Path) -> None:
    script = REPO_ROOT / "scripts" / "retrieve.py"
    payload = json.dumps(
        {
            "notes": [
                {"id": "alpha", "title": "Alpha protocol", "content": "alpha gamma", "links": ["beta"]},
                {"id": "beta", "title": "Beta protocol", "content": "beta gamma"},
            ]
        }
    )
    query = subprocess.run(
        [sys.executable, str(script), "--root", str(tmp_path), "--scope", "cli", "query", "--query", "alpha"],
        input=payload,
        capture_output=True,
        text=True,
        cwd=REPO_ROOT,
        check=False,
    )
    assert query.returncode == 0, query.stderr
    result = json.loads(query.stdout)
    assert result["status"] == "success"
    assert result["results"][0]["id"] == "alpha"

    update = subprocess.run(
        [
            sys.executable, str(script), "--root", str(tmp_path), "--scope", "cli",
            "update", "--delete-ids", "alpha",
        ],
        input="{}",
        capture_output=True,
        text=True,
        cwd=REPO_ROOT,
        check=False,
    )
    assert update.returncode == 0, update.stderr
    assert json.loads(update.stdout)["status"] == "success"

    after = subprocess.run(
        [sys.executable, str(script), "--root", str(tmp_path), "--scope", "cli", "query", "--query", "alpha"],
        input="{}",
        capture_output=True,
        text=True,
        cwd=REPO_ROOT,
        check=False,
    )
    assert after.returncode == 0, after.stderr
    assert json.loads(after.stdout)["results"] == []


def test_eval_suite_has_50_bilingual_gold_questions_and_beats_baseline(tmp_path: Path) -> None:
    notes = run_eval.load_notes()
    questions = run_eval.load_questions()
    assert len(questions) >= 50
    assert {question["language"] for question in questions} >= {"it", "en"}
    assert sum(1 for question in questions if question["abstain"]) >= 5

    report = run_eval.evaluate(notes, questions, root=tmp_path)
    assert report["passed"] is True
    assert report["question_count"] == len(questions)
    for key, margin in run_eval.MIN_MARGINS.items():
        assert report["metrics"]["delta"][key] >= margin
    assert report["metrics"]["hybrid"]["correct_abstention_rate"] >= run_eval.MIN_CORRECT_ABSTENTION


def test_eval_regression_is_detected_by_runner(tmp_path: Path) -> None:
    report_path = tmp_path / "latest.json"
    degraded = run_eval.evaluate(
        run_eval.load_notes(), run_eval.load_questions(), root=tmp_path, degrade=True
    )
    assert degraded["passed"] is False
    assert any("recall@5" in failure for failure in degraded["failures"])

    exit_code = run_eval.main(["--degrade", "--report", str(report_path)])
    assert exit_code == 1
    written = json.loads(report_path.read_text(encoding="utf-8"))
    assert written["passed"] is False
    assert written["margin_ok"] is False


def test_health_reports_eval_summary_and_failure(tmp_path: Path) -> None:
    assert health.read_retrieval_eval(tmp_path)["available"] is False

    report_path = tmp_path / ".wiki-forge" / "health" / "eval" / "latest.json"
    report_path.parent.mkdir(parents=True)
    report_path.write_text(
        json.dumps(
            {
                "passed": False,
                "margin_ok": False,
                "question_count": 50,
                "metrics": {"recall@5": 0.4, "mrr": 0.3, "citation_precision": 0.1, "correct_abstention_rate": 1.0},
            }
        ),
        encoding="utf-8",
    )
    summary = health.read_retrieval_eval(tmp_path)
    assert summary["available"] is True
    assert summary["passed"] is False
    assert summary["recall@5"] == 0.4
    assert summary["question_count"] == 50
