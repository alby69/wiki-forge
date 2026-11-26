"""Regression tests for semantic DOC_BLOCK_REF checks."""

import hashlib
import re
from pathlib import Path

import check_docs_sync


MASTER_BLOCKS = {
    "slash-commands": (
        "docs/riferimenti/SLASH_COMMANDS_REFERENCE.md",
        "| `/compile` | Compila le fonti |",
    ),
    "script-automation": (
        "docs/riferimenti/SCRIPT_AUTOMATION_REFERENCE.md",
        "| `okf_lint` | 🟢 read-only — nessuna scrittura rilevante |",
    ),
}


def _fixture(tmp_path: Path) -> tuple[Path, Path, dict[str, str]]:
    docs = tmp_path / "docs"
    help_dir = docs / "help"
    help_dir.mkdir(parents=True)

    digests: dict[str, str] = {}
    refs: list[str] = []
    for name, (master_rel, block) in MASTER_BLOCKS.items():
        master = tmp_path / master_rel
        master.parent.mkdir(parents=True, exist_ok=True)
        master.write_text(
            f"# Master\n\n<!-- DOC_BLOCK:{name} -->\n{block}\n"
            f"<!-- /DOC_BLOCK:{name} -->\n",
            encoding="utf-8",
        )
        content = master.read_text(encoding="utf-8")
        match = re.search(
            rf"<!--\s*DOC_BLOCK:{name}\s*-->(.*?)"
            rf"<!--\s*/DOC_BLOCK:{name}\s*-->",
            content,
            re.DOTALL,
        )
        assert match is not None
        digest = hashlib.sha256(
            check_docs_sync.normalise_block(match.group(1)).encode("utf-8")
        ).hexdigest()
        digests[name] = digest
        refs.append(
            f"<!-- DOC_BLOCK_REF:{name} {master_rel} sha256:{digest} -->"
        )

    topic = help_dir / "chat-comandi.md"
    topic.write_text("# Chat\n\n" + "\n".join(refs) + "\n", encoding="utf-8")
    return tmp_path, topic, digests


def test_semantic_ref_is_valid(tmp_path: Path) -> None:
    root, _topic, _digests = _fixture(tmp_path)
    assert check_docs_sync.check_semantic_refs(root) == []


def test_stale_semantic_hash_is_reported_and_fixed(tmp_path: Path) -> None:
    root, topic, digests = _fixture(tmp_path)
    stale = digests["slash-commands"]
    topic.write_text(
        topic.read_text(encoding="utf-8").replace(stale, "0" * 64),
        encoding="utf-8",
    )

    errors = check_docs_sync.check_semantic_refs(root)
    assert any("stale hash" in error for error in errors)

    assert check_docs_sync.check_semantic_refs(root, fix=True) == []
    assert stale in topic.read_text(encoding="utf-8")


def _state_root_fixture(tmp_path: Path) -> Path:
    for rel, content in {
        "README.md": ".wikiforge/STATUS.md .wikiforge/metrics/history.jsonl .wiki-forge/state/",
        "docs/architettura/ARCHITECTURE.md": ".wikiforge/STATUS.md .wiki-forge/state/",
        "docs/processi/KNOWLEDGE_ENGINEERING.md": ".wikiforge/ .wiki-forge/",
    }.items():
        path = tmp_path / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")
    return tmp_path


def test_state_root_boundary_is_accepted(tmp_path: Path) -> None:
    root = _state_root_fixture(tmp_path)
    assert check_docs_sync.check_state_roots(root) == []


def test_single_root_claim_is_rejected(tmp_path: Path) -> None:
    root = _state_root_fixture(tmp_path)
    ke = root / "docs" / "processi" / "KNOWLEDGE_ENGINEERING.md"
    ke.write_text(ke.read_text(encoding="utf-8") + " `.wikiforge/` is historical only.", encoding="utf-8")

    errors = check_docs_sync.check_state_roots(root)
    assert any("historical only" in error for error in errors)


def _local_cloud_fixture(tmp_path: Path) -> Path:
    for rel, content in {
        "docs/help/inizio.md": "Wiki-Forge è local-first.",
        "docs/guida/GUIDA_OPERATIVA.md": (
            "Installazione locale: il vault resta sul computer. "
            "L'hook `cloud_backup_webdav` non è collegato a un backup attivo."
        ),
    }.items():
        path = tmp_path / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")
    return tmp_path


def test_local_cloud_claims_are_accepted(tmp_path: Path) -> None:
    root = _local_cloud_fixture(tmp_path)
    assert check_docs_sync.check_local_cloud_claims(root) == []


def test_absolute_cloud_claim_is_rejected(tmp_path: Path) -> None:
    root = _local_cloud_fixture(tmp_path)
    intro = root / "docs" / "help" / "inizio.md"
    intro.write_text("Niente va in cloud.", encoding="utf-8")

    errors = check_docs_sync.check_local_cloud_claims(root)
    assert any("must not promise" in error for error in errors)
