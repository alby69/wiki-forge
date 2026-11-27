#!/usr/bin/env python3
"""Phase 94 retrieval evaluation runner.

Compares the hybrid retriever (BM25 + RRF + one-hop graph expansion) against
the deterministic lexical baseline used before Phase 94. Metrics are
recall@5, MRR, citation precision and correct "non so" (abstention) rate.

The runner is fast (in-memory fixtures, stdlib only), deterministic and fails
with exit code 1 when the hybrid advantage drops below the fixed margins.
"""

from __future__ import annotations

import argparse
import json
import math
import os
import re
import sys
import tempfile
from pathlib import Path
from typing import Any, Callable, Iterable, Mapping, Sequence

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from src.backend.wikiforge.retrieval.retriever import (  # noqa: E402
    BM25Index,
    DiskVectorStore,
    EmbeddingsConfig,
    HybridRetriever,
    NoteDocument,
)

REPO_ROOT = Path(__file__).resolve().parents[2]
CORPUS_PATH = Path(__file__).resolve().parent / "corpus.json"
GOLD_PATH = Path(__file__).resolve().parent / "gold.jsonl"
DEFAULT_REPORT = REPO_ROOT / ".wiki-forge" / "health" / "eval" / "latest.json"

K = 5
RRF_K = 60
MIN_MARGINS = {"recall@5": 0.08, "mrr": 0.08, "citation_precision": 0.08}
MIN_CORRECT_ABSTENTION = 0.90
_TOKEN_RE = re.compile(r"[^\W_]+", re.UNICODE)


def load_notes(path: Path = CORPUS_PATH) -> list[NoteDocument]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        raise ValueError("retrieval eval corpus must be a JSON list")
    return [NoteDocument.from_mapping(item) for item in data]


def load_questions(path: Path = GOLD_PATH) -> list[dict[str, Any]]:
    questions = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.strip():
            questions.append(json.loads(line))
    return questions


def lexical_baseline(notes: Sequence[NoteDocument], query: str, limit: int = K) -> list[str]:
    """Pre-Phase-94 substring ranking, mirrored from researchHelpers.searchNotes."""
    q = query.strip()
    tokens = [token for token in _TOKEN_RE.findall(q.lower()) if token]
    if not tokens:
        return []
    phrase = q.lower()
    scored: list[tuple[float, str, str]] = []

    for note in notes:
        title = note.title.lower()
        note_id = note.id.lower()
        tags = " ".join(note.tags).lower()
        score = 0.0
        if phrase in title:
            score += 15
        if phrase in note_id:
            score += 8
        if phrase in tags:
            score += 5
        for token in tokens:
            if token in title:
                score += 6
            if token in note_id:
                score += 2
            if token in tags:
                score += 3
            for line in note.content.splitlines():
                if token in line.lower():
                    score += 1
        if score > 0:
            scored.append((score, note.title, note.id))

    scored.sort(key=lambda row: (-row[0], row[1], row[2]))
    return [note_id for _, _, note_id in scored[:limit]]


def _score(ranked: Sequence[str], relevant: Sequence[str]) -> tuple[float, float, float]:
    expected = set(relevant)
    top = set(ranked[:K])
    matched = top & expected
    recall = len(matched) / len(expected) if expected else 0.0
    mrr = 0.0
    for index, note_id in enumerate(ranked[:K], start=1):
        if note_id in expected:
            mrr = 1.0 / index
            break
    precision = len(matched) / K
    return recall, mrr, precision


def evaluate_ranker(
    ranker: Callable[[str], list[str]],
    questions: Iterable[Mapping[str, Any]],
) -> dict[str, float]:
    questions = list(questions)
    answerable = [q for q in questions if not q.get("abstain")]
    abstentions = [q for q in questions if q.get("abstain")]
    recalls: list[float] = []
    mrrs: list[float] = []
    precisions: list[float] = []

    for question in answerable:
        recall, mrr, precision = _score(ranker(str(question["question"])), question.get("relevant", []))
        recalls.append(recall)
        mrrs.append(mrr)
        precisions.append(precision)

    correct = sum(1 for question in abstentions if not ranker(str(question["question"])))
    return {
        "recall@5": round(sum(recalls) / len(recalls), 4) if recalls else 0.0,
        "mrr": round(sum(mrrs) / len(mrrs), 4) if mrrs else 0.0,
        "citation_precision": round(sum(precisions) / len(precisions), 4) if precisions else 0.0,
        "correct_abstention_rate": round(correct / len(abstentions), 4) if abstentions else 0.0,
    }


def evaluate(
    notes: Sequence[NoteDocument],
    questions: Sequence[Mapping[str, Any]],
    *,
    root: Path | None = None,
    degrade: bool = False,
) -> dict[str, Any]:
    workspace = Path(root) if root else Path(tempfile.mkdtemp(prefix="wf-retrieval-eval-"))
    index = BM25Index(workspace / "index" / "bm25-eval.json")
    index.sync(notes)
    retriever = HybridRetriever(
        index=index,
        embeddings=EmbeddingsConfig(enabled=False),
        vectors=DiskVectorStore(EmbeddingsConfig(enabled=False), workspace),
        rrf_k=RRF_K,
        hops=1,
    )

    def hybrid(query: str) -> list[str]:
        hits = retriever.retrieve(query, limit=K)
        ranked = [hit.note_id for hit in hits]
        # Deliberate regression used by the CI regression test only.
        return list(reversed(ranked))[:2] if degrade else ranked

    hybrid_metrics = evaluate_ranker(hybrid, questions)
    baseline_metrics = evaluate_ranker(lambda query: lexical_baseline(notes, query), questions)
    deltas = {
        key: round(hybrid_metrics[key] - baseline_metrics[key], 4)
        for key in ("recall@5", "mrr", "citation_precision", "correct_abstention_rate")
    }
    failures = [
        f"{key}: delta {deltas[key]:.4f} < required {margin:.4f}"
        for key, margin in MIN_MARGINS.items()
        if deltas[key] + 1e-9 < margin
    ]
    if hybrid_metrics["correct_abstention_rate"] + 1e-9 < MIN_CORRECT_ABSTENTION:
        failures.append(
            f"correct_abstention_rate: {hybrid_metrics['correct_abstention_rate']:.4f} "
            f"< required {MIN_CORRECT_ABSTENTION:.4f}"
        )

    languages: dict[str, int] = {}
    for question in questions:
        language = str(question.get("language", "unknown"))
        languages[language] = languages.get(language, 0) + 1

    return {
        "status": "pass" if not failures else "fail",
        "passed": not failures,
        "margin_ok": not failures,
        "question_count": len(questions),
        "language_counts": languages,
        "generated_at": os.environ.get("SOURCE_DATE_EPOCH", "deterministic"),
        "evaluator": "hybrid-bm25-rrf-graph-vs-lexical",
        "metrics": {"hybrid": hybrid_metrics, "baseline": baseline_metrics, "delta": deltas},
        "margins": dict(MIN_MARGINS),
        "min_correct_abstention": MIN_CORRECT_ABSTENTION,
        "failures": failures,
    }


def write_report(report: Mapping[str, Any], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--corpus", type=Path, default=CORPUS_PATH)
    parser.add_argument("--gold", type=Path, default=GOLD_PATH)
    parser.add_argument("--report", type=Path, default=DEFAULT_REPORT)
    parser.add_argument("--degrade", action="store_true", help="simulate a regression (test only)")
    args = parser.parse_args(argv)

    notes = load_notes(args.corpus)
    questions = load_questions(args.gold)
    report = evaluate(notes, questions, degrade=args.degrade)
    write_report(report, Path(args.report))

    hybrid = report["metrics"]["hybrid"]
    delta = report["metrics"]["delta"]
    print(
        "eval:check "
        f"questions={report['question_count']} "
        f"recall@5={hybrid['recall@5']} (Δ{delta['recall@5']:+.4f}) "
        f"MRR={hybrid['mrr']} (Δ{delta['mrr']:+.4f}) "
        f"citations={hybrid['citation_precision']} (Δ{delta['citation_precision']:+.4f}) "
        f"non-so={hybrid['correct_abstention_rate']} "
        f"status={report['status']}"
    )
    for failure in report["failures"]:
        print(f"  - {failure}")
    return 0 if report["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
