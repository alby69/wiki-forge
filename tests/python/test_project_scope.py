"""Regression tests: script path resolution must follow the selected wiki."""

from scripts import okf_common


def test_detect_project_id_prefers_the_selected_project(monkeypatch):
    monkeypatch.setenv(okf_common.ACTIVE_PROJECT_ENV, "wikiforge")
    assert okf_common.detect_project_id() == "wikiforge"


def test_detect_project_id_falls_back_when_env_is_unknown(monkeypatch):
    monkeypatch.setenv(okf_common.ACTIVE_PROJECT_ENV, "not-a-project")
    detected = okf_common.detect_project_id()
    assert detected in {"tesi", "wikiforge"}
    assert detected != "not-a-project"


def test_resolve_dir_uses_selected_project_even_from_repo_root(monkeypatch):
    """The old fallback picked projects/tesi/wiki (alphabetical first)."""
    monkeypatch.delenv("WIKI_FORGE_WIKI_DIR", raising=False)
    monkeypatch.setenv(okf_common.ACTIVE_PROJECT_ENV, "wikiforge")
    monkeypatch.chdir(okf_common.repo_root())

    resolved = okf_common.resolve_dir("wiki")
    assert resolved == (okf_common.repo_root() / "projects" / "wikiforge" / "wiki").resolve()
