"""Regression tests for semantic DOC_BLOCK_REF checks."""

import hashlib
import re
from pathlib import Path

import check_docs_sync


MASTER_REL = "docs/SLASH_COMMANDS_REFERENCE.md"
BLOCK = "| `/compile` | Compila le fonti |"


def _fixture(tmp_path: Path) -> tuple[Path, Path, str]:
    docs = tmp_path / "docs"
    help_dir = docs / "help"
    help_dir.mkdir(parents=True)

    master = docs / "SLASH_COMMANDS_REFERENCE.md"
    master.write_text(
        f"# Catalogo\n\n<!-- DOC_BLOCK:slash-commands -->\n{BLOCK}\n"
        "<!-- /DOC_BLOCK:slash-commands -->\n",
        encoding="utf-8",
    )

    content = master.read_text(encoding="utf-8")
    match = re.search(
        r"<!--\s*DOC_BLOCK:slash-commands\s*-->(.*?)<!--\s*/DOC_BLOCK:slash-commands\s*-->",
        content,
        re.DOTALL,
    )
    assert match is not None
    digest = hashlib.sha256(
        check_docs_sync.normalise_block(match.group(1)).encode("utf-8")
    ).hexdigest()

    topic = help_dir / "chat-comandi.md"
    topic.write_text(
        f"# Chat\n\n<!-- DOC_BLOCK_REF:slash-commands {MASTER_REL} sha256:{digest} -->\n",
        encoding="utf-8",
    )
    return tmp_path, topic, digest


def test_semantic_ref_is_valid(tmp_path: Path) -> None:
    root, _topic, _digest = _fixture(tmp_path)
    assert check_docs_sync.check_semantic_refs(root) == []


def test_stale_semantic_hash_is_reported_and_fixed(tmp_path: Path) -> None:
    root, topic, digest = _fixture(tmp_path)
    topic.write_text(topic.read_text(encoding="utf-8").replace(digest, "0" * 64), encoding="utf-8")

    errors = check_docs_sync.check_semantic_refs(root)
    assert any("stale hash" in error for error in errors)

    assert check_docs_sync.check_semantic_refs(root, fix=True) == []
    assert digest in topic.read_text(encoding="utf-8")
