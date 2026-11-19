"""Tests for the self-documentation wiki projection (Fase 71-75)."""

from pathlib import Path

import pytest

import docs_to_wiki
import docs_wiki_drift
import promote_doc_answer
from scripts.okf_lint import lint_file

REPO_ROOT = Path(__file__).resolve().parents[2]
DOCS_DIR = REPO_ROOT / "docs"


def _temp_bundle(tmp_path: Path):
    """Generate a fresh bundle into a temporary wiki directory."""
    wiki_dir = tmp_path / "wiki"
    bundle, warnings = docs_to_wiki.build_bundle(REPO_ROOT, DOCS_DIR, wiki_dir)
    assert warnings == [], warnings
    docs_to_wiki.write_bundle(bundle, wiki_dir)
    return wiki_dir, bundle


def test_build_bundle_is_deterministic(tmp_path: Path):
    first, _ = docs_to_wiki.build_bundle(REPO_ROOT, DOCS_DIR, tmp_path / "a")
    second, _ = docs_to_wiki.build_bundle(REPO_ROOT, DOCS_DIR, tmp_path / "b")
    assert first == second
    assert len(first) >= 50
    assert "index.md" in first
    assert "log.md" in first
    assert "sintesi/index.md" in first


def test_generated_bundle_lints_clean(tmp_path: Path):
    wiki_dir, bundle = _temp_bundle(tmp_path)
    errors: list[str] = []
    for rel in sorted(bundle):
        errors.extend(lint_file(wiki_dir / rel, wiki_dir))
    assert errors == [], errors


def test_generated_notes_keep_source_language_and_provenance(tmp_path: Path):
    _wiki_dir, bundle = _temp_bundle(tmp_path)
    it_note = bundle["guida/tutorial.md"]
    en_note = bundle["architettura/architecture.md"]
    assert "lang/it" in it_note
    assert "layer/generated" in it_note
    assert "  by: process:docs-to-wiki" in it_note
    assert f'at: "{docs_to_wiki.BUILD_STAMP}"' in it_note
    assert "resource: docs/TUTORIAL.md" in it_note
    assert "lang/en" in en_note


def test_check_bundle_detects_missing_changed_and_unexpected(tmp_path: Path):
    wiki_dir, bundle = _temp_bundle(tmp_path)
    assert docs_to_wiki.check_bundle(bundle, wiki_dir, DOCS_DIR) == []

    changed = wiki_dir / "guida" / "tutorial.md"
    changed.write_text(changed.read_text(encoding="utf-8") + "\nDRIFT\n", encoding="utf-8")
    problems = docs_to_wiki.check_bundle(bundle, wiki_dir, DOCS_DIR)
    assert any("changed: guida/tutorial.md" in p for p in problems)

    (wiki_dir / "unexpected.md").write_text("# Unexpected\n", encoding="utf-8")
    problems = docs_to_wiki.check_bundle(bundle, wiki_dir, DOCS_DIR)
    assert any("unexpected: unexpected.md" in p for p in problems)

    changed.unlink()
    problems = docs_to_wiki.check_bundle(bundle, wiki_dir, DOCS_DIR)
    assert any("missing: guida/tutorial.md" in p for p in problems)


def test_committed_bundle_matches_docs():
    wiki_dir = REPO_ROOT / "projects" / "wikiforge" / "wiki"
    assert wiki_dir.is_dir(), "the generated bundle must be committed"
    bundle, _ = docs_to_wiki.build_bundle(REPO_ROOT, DOCS_DIR, wiki_dir)
    assert docs_to_wiki.check_bundle(bundle, wiki_dir, DOCS_DIR) == []


def test_drift_report_is_read_only_and_grounded(tmp_path: Path):
    wiki_dir, _ = _temp_bundle(tmp_path)
    result = docs_wiki_drift.analyze(REPO_ROOT, DOCS_DIR, wiki_dir)
    assert result["status"] == "ok"
    assert result["rationale"]
    assert "docs/README.md" in result["sources"]

    (wiki_dir / "index.md").write_text("# drifted\n", encoding="utf-8")
    drifted = docs_wiki_drift.analyze(REPO_ROOT, DOCS_DIR, wiki_dir)
    assert drifted["status"] == "drift"
    assert drifted["drift"]
    assert "docs_to_wiki.py" in drifted["rationale"]


def test_promoted_answer_is_human_verified_and_okf_valid(tmp_path: Path):
    note = promote_doc_answer.build_note(
        "Come funziona la wiki?",
        "Che cos'è la Wiki Docs?",
        "Risposta approvata di esempio.",
        ["docs/README.md", "docs/SELF_WIKI_PLAN.md"],
        "human:alby69",
        "2026-11-19T00:00:00Z",
    )
    assert "verified:" in note
    assert "  - by: human:alby69" in note
    assert "layer/curated" in note
    assert "Risposta approvata di esempio." in note

    wiki_dir = tmp_path / "wiki"
    (wiki_dir / "sintesi").mkdir(parents=True)
    note_path = wiki_dir / "sintesi" / "approved.md"
    note_path.write_text(note, encoding="utf-8")
    assert lint_file(note_path, wiki_dir) == []


def test_promote_rejects_non_human_reviewer(monkeypatch, capsys):
    monkeypatch.setattr(
        "sys.argv",
        [
            "promote_doc_answer.py",
            "--title", "T",
            "--question", "Q",
            "--answer", "A",
            "--sources", "docs/README.md",
            "--reviewer", "process:bot",
            "--dry-run",
            "--json",
        ],
    )
    code = promote_doc_answer.main()
    assert code == 1
    assert "human:<id>" in capsys.readouterr().err


def test_slugify_is_stable():
    assert promote_doc_answer.slugify("Come funziona la Wiki?") == "come-funziona-la-wiki"
    assert promote_doc_answer.slugify("  Architettura / OKF  ") == "architettura-okf"
