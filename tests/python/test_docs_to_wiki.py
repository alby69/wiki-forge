"""Tests for the self-documentation wiki projection (Fase 71-75)."""

from pathlib import Path

import pytest

import check_docs_sync
import docs_book
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


def test_docs_book_follows_didactic_path(tmp_path: Path):
    output = tmp_path / "manuale.md"
    content = docs_book.write_book(REPO_ROOT, DOCS_DIR, output)
    assert content.startswith("# Manuale Wiki-Forge v4.1.")
    assert "## 1. Guida operativa" in content
    assert "## 13. Wiki di self-documentazione" in content
    assert "## 23. Roadmap" in content
    assert "**Fonte**: `docs/standard/SELF_WIKI.md`" in content
    assert docs_book.check_book(REPO_ROOT, DOCS_DIR, output) == []


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
    en_note = bundle["architettura/editor-migration.md"]
    assert "lang/it" in it_note
    assert "layer/generated" in it_note
    assert "  by: process:docs-to-wiki" in it_note
    assert f'at: "{docs_to_wiki.BUILD_STAMP}"' in it_note
    assert "resource: docs/guida/TUTORIAL.md" in it_note
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
    problems = docs_to_wiki.check_bundle(bundle, wiki_dir, DOCS_DIR)
    # The curated note_architettura.md is user-owned and intentionally outside
    # the generated bundle; every other problem means real drift.
    assert docs_wiki_drift.actionable_problems(problems) == [], problems


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


def test_resolve_dir_is_root_relative_not_cwd_relative(tmp_path, monkeypatch):
    # Relative paths are resolved against the repository root even when the
    # process cwd is a project folder such as /app/projects/tesi.
    monkeypatch.chdir(tmp_path)
    assert docs_wiki_drift.resolve_dir(REPO_ROOT, "docs", REPO_ROOT / "docs") == DOCS_DIR
    assert (
        docs_wiki_drift.resolve_dir(
            REPO_ROOT, "projects/wikiforge/wiki", REPO_ROOT / "projects" / "wikiforge" / "wiki"
        )
        == REPO_ROOT / "projects" / "wikiforge" / "wiki"
    )
    # Absolute paths and defaults keep working.
    assert docs_wiki_drift.resolve_dir(REPO_ROOT, str(tmp_path), DOCS_DIR) == tmp_path.resolve()
    assert docs_wiki_drift.resolve_dir(REPO_ROOT, None, tmp_path) == tmp_path.resolve()


def test_repair_regenerates_drift_and_preserves_curated_notes(tmp_path: Path):
    wiki_dir, bundle = _temp_bundle(tmp_path)

    # Simulate drift: a changed file and a deleted file.
    changed = wiki_dir / "index.md"
    changed.write_text("# drifted\n", encoding="utf-8")
    (wiki_dir / "guida" / "tutorial.md").unlink()

    # A human-owned curated note that must never be touched by regeneration.
    curated = wiki_dir / "sintesi" / "user-note.md"
    curated.write_text("---\ntitle: Nota utente\n---\n\nTesto preservato.\n", encoding="utf-8")
    curated_before = curated.read_text(encoding="utf-8")

    fix = docs_wiki_drift.repair(REPO_ROOT, DOCS_DIR, wiki_dir)
    assert fix["written"] >= 2
    assert fix["remaining"] == [], fix["remaining"]
    assert fix["warnings"] == [], fix["warnings"]
    assert changed.read_text(encoding="utf-8") == docs_to_wiki.build_bundle(
        REPO_ROOT, DOCS_DIR, wiki_dir
    )[0]["index.md"]
    assert (wiki_dir / "guida" / "tutorial.md").is_file()
    assert curated.read_text(encoding="utf-8") == curated_before


def test_check_flag_never_writes(tmp_path: Path):
    wiki_dir, _ = _temp_bundle(tmp_path)
    changed = wiki_dir / "index.md"
    changed.write_text("# drifted\n", encoding="utf-8")
    before = changed.read_text(encoding="utf-8")

    code = docs_wiki_drift.main(
        ["--root", str(REPO_ROOT), "--docs-dir", "docs", "--wiki-dir", str(wiki_dir), "--check"]
    )
    assert code == 0
    assert changed.read_text(encoding="utf-8") == before, "--check must not write"


def test_main_regenerates_by_default(tmp_path: Path):
    wiki_dir, bundle = _temp_bundle(tmp_path)
    (wiki_dir / "index.md").write_text("# drifted\n", encoding="utf-8")

    code = docs_wiki_drift.main(
        ["--root", str(REPO_ROOT), "--docs-dir", "docs", "--wiki-dir", str(wiki_dir), "--json"]
    )
    assert code == 0
    assert (wiki_dir / "index.md").read_text(encoding="utf-8") == bundle["index.md"]


def test_preserved_user_note_is_not_drift(tmp_path: Path):
    wiki_dir, _ = _temp_bundle(tmp_path)
    (wiki_dir / "architettura" / "note_architettura.md").write_text(
        "# Nota architettura dell'utente\n", encoding="utf-8"
    )
    result = docs_wiki_drift.analyze(REPO_ROOT, DOCS_DIR, wiki_dir)
    assert result["status"] == "ok"
    assert result["drift"] == []
    assert result["preserved"] == ["unexpected: architettura/note_architettura.md"]


def test_ci_docs_sync_accepts_preserved_user_note():
    """The CI entry point must use the same preserved-note policy as the tests."""
    assert check_docs_sync.check_generated_wiki(REPO_ROOT) == []


def test_any_user_note_is_preserved_not_just_the_known_filename(tmp_path: Path):
    wiki_dir, _ = _temp_bundle(tmp_path)
    (wiki_dir / "guida" / "nota-dell-utente.md").write_text(
        "# Nota scritta dall'utente\n", encoding="utf-8"
    )
    result = docs_wiki_drift.analyze(REPO_ROOT, DOCS_DIR, wiki_dir)
    assert result["status"] == "ok"
    assert result["drift"] == []
    assert result["preserved"] == ["unexpected: guida/nota-dell-utente.md"]


def test_bundle_depends_only_on_docs_not_on_wiki_notes(tmp_path: Path):
    """Adding a note anywhere in the wiki cannot change the docs projection."""
    wiki_dir, bundle = _temp_bundle(tmp_path)
    user_note = "# Nota scritta a mano\n"
    (wiki_dir / "architettura" / "nuova-nota.md").write_text(user_note, encoding="utf-8")
    (wiki_dir / "sintesi" / "nota-utente.md").write_text(user_note, encoding="utf-8")

    rebuilt, warnings = docs_to_wiki.build_bundle(REPO_ROOT, DOCS_DIR, wiki_dir)
    assert warnings == []
    assert rebuilt == bundle

    problems = docs_to_wiki.check_bundle(rebuilt, wiki_dir, DOCS_DIR)
    assert docs_to_wiki.actionable_problems(problems, wiki_dir) == []

    fix = docs_wiki_drift.repair(REPO_ROOT, DOCS_DIR, wiki_dir)
    assert fix["written"] == 0
    assert fix["remaining"] == []
    assert (wiki_dir / "architettura" / "nuova-nota.md").read_text(encoding="utf-8") == user_note
    assert (wiki_dir / "sintesi" / "nota-utente.md").read_text(encoding="utf-8") == user_note


def test_stale_generated_note_is_still_reported_as_drift(tmp_path: Path):
    wiki_dir, _ = _temp_bundle(tmp_path)
    (wiki_dir / "architettura" / "stale.md").write_text(
        "---\ntype: Concept\ntitle: Stale\ntags: [layer/generated]\n"
        "generated:\n  by: process:docs-to-wiki\n  at: '2026-11-19T00:00:00Z'\n"
        "---\n\n# Stale\n",
        encoding="utf-8",
    )
    problems = docs_to_wiki.check_bundle(
        docs_to_wiki.build_bundle(REPO_ROOT, DOCS_DIR, wiki_dir)[0], wiki_dir, DOCS_DIR
    )
    assert "unexpected: architettura/stale.md" in docs_to_wiki.actionable_problems(problems, wiki_dir)


def test_promoted_answer_is_human_verified_and_okf_valid(tmp_path: Path):
    note = promote_doc_answer.build_note(
        "Come funziona la wiki?",
        "Che cos'è la Wiki Docs?",
        "Risposta approvata di esempio.",
        ["docs/README.md", "docs/standard/SELF_WIKI.md"],
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
