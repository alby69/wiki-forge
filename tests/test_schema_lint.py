import os
from pathlib import Path
import pytest

from ke_common import iter_pages, resolve_wikilink
from schema_lint import lint_schema

FIXTURES_DIR = Path(__file__).parent / "fixtures" / "ke_wiki"


def test_schema_lint_all_sch_codes():
    wiki_dir = FIXTURES_DIR / "wiki"
    config_path = FIXTURES_DIR / "config.toml"
    res = lint_schema(project=None, wiki_dir=str(wiki_dir), config_path=config_path, strict_override=True)

    findings = res["findings"]
    sch_codes = {f["id"] for f in findings}

    assert "SCH-001" in sch_codes, "SCH-001 (missing required field) should be detected"
    assert "SCH-002" in sch_codes, "SCH-002 (unknown relation for type) should be detected"
    assert "SCH-003" in sch_codes, "SCH-003 (unresolved target) should be detected"
    assert "SCH-004" in sch_codes, "SCH-004 (target type mismatch) should be detected"
    assert "SCH-005" in sch_codes, "SCH-005 (cycle detected) should be detected"
    assert "SCH-006" in sch_codes, "SCH-006 (unknown type in strict mode) should be detected"


def test_wikilink_resolution_with_labels():
    wiki_dir = FIXTURES_DIR / "wiki"
    pages = iter_pages(wiki_dir=str(wiki_dir))

    # Test prefLabel match
    page = resolve_wikilink("Valid Concept", pages)
    assert page is not None
    assert page.id == "sch001"
