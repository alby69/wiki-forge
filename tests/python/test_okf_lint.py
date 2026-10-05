import pytest
from pathlib import Path
from scripts.okf_lint import lint_file, is_iso_timestamp, is_valid_actor

def test_actor_and_timestamp_validators():
    assert is_iso_timestamp("2026-03-30")
    assert is_iso_timestamp("2026-03-30T10:00:00Z")
    assert is_iso_timestamp("2026-03-30T10:00:00.123Z")
    assert is_iso_timestamp("2026-03-30T10:00:00+02:00")
    assert not is_iso_timestamp("30-03-2026")
    assert not is_iso_timestamp("invalid-date")

    assert is_valid_actor("human:jules")
    assert is_valid_actor("process:compiler")
    assert is_valid_actor("opencode/1.0")
    assert not is_valid_actor("invalid_actor_without_prefix")

def test_lint_file_valid_concept(temp_wiki_dir):
    file_path = temp_wiki_dir / "valid_concept.md"
    errors = lint_file(file_path, temp_wiki_dir)
    assert errors == []

def test_lint_file_missing_frontmatter(temp_wiki_dir):
    bad_file = temp_wiki_dir / "no_fm.md"
    bad_file.write_text("# Just Markdown\nNo frontmatter here.", encoding="utf-8")
    errors = lint_file(bad_file, temp_wiki_dir)
    assert len(errors) > 0
    assert any("Missing YAML frontmatter" in err for err in errors)

def test_lint_file_missing_type(temp_wiki_dir):
    bad_file = temp_wiki_dir / "no_type.md"
    bad_file.write_text("""---
title: Note without type
status: stable
---
# Content
""", encoding="utf-8")
    errors = lint_file(bad_file, temp_wiki_dir)
    assert len(errors) > 0
    assert any("Missing or empty REQUIRED 'type'" in err for err in errors)

def test_lint_file_invalid_status_and_timestamps(temp_wiki_dir):
    bad_file = temp_wiki_dir / "bad_fields.md"
    bad_file.write_text("""---
title: Bad Fields
type: Concept
status: unknown_status
stale_after: "not-a-date"
generated:
  by: invalid_actor_format
  at: "not-iso-date"
---
# Content
""", encoding="utf-8")
    errors = lint_file(bad_file, temp_wiki_dir)
    assert len(errors) >= 3
    assert any("Invalid 'status'" in err for err in errors)
    assert any("'stale_after'" in err for err in errors)
    assert any("'generated.by'" in err for err in errors)
    assert any("'generated.at'" in err for err in errors)

def test_lint_file_invalid_verified_and_sources(temp_wiki_dir):
    bad_file = temp_wiki_dir / "bad_verified_sources.md"
    bad_file.write_text("""---
title: Bad Verified and Sources
type: Concept
status: stable
verified:
  - by: invalid_verified_actor
    at: "bad-date"
sources:
  - author: bad_author
---
# Content
""", encoding="utf-8")
    errors = lint_file(bad_file, temp_wiki_dir)
    assert len(errors) >= 3
    assert any("verified[0].by" in err for err in errors)
    assert any("verified[0].at" in err for err in errors)
    assert any("sources[0] is missing REQUIRED 'resource'" in err for err in errors)

def test_lint_reserved_files(temp_wiki_dir):
    # Topic index.md inside subfolder containing frontmatter should fail
    sub_dir = temp_wiki_dir / "subfolder"
    sub_dir.mkdir(parents=True, exist_ok=True)
    sub_index = sub_dir / "index.md"
    sub_index.write_text("""---
type: Index
---
# Sub Index
""", encoding="utf-8")
    errors = lint_file(sub_index, temp_wiki_dir)
    assert any("Topic index.md MUST NOT contain YAML frontmatter" in err for err in errors)

    # Bad log.md without ISO date heading
    bad_log = temp_wiki_dir / "log.md"
    bad_log.write_text("# Bad Log\nNo ISO date headings.", encoding="utf-8")
    errors_log = lint_file(bad_log, temp_wiki_dir)
    assert any("log.md does not contain any ISO date heading" in err for err in errors_log)

def test_okf_lint_main_cli(temp_wiki_dir, monkeypatch, capsys):
    from scripts.okf_lint import main
    monkeypatch.setattr("sys.argv", ["okf_lint.py", str(temp_wiki_dir), "--json"])
    with pytest.raises(SystemExit) as exc:
        main()
    assert exc.value.code == 0
    captured = capsys.readouterr()
    assert '"status": "success"' in captured.out
