from pathlib import Path
from schema_infer import infer_schema

FIXTURES_DIR = Path(__file__).parent / "fixtures" / "ke_wiki"


def test_schema_infer():
    wiki_dir = FIXTURES_DIR / "wiki"
    toml_out = infer_schema(wiki_dir=str(wiki_dir))

    assert "[schema]" in toml_out
    assert "[schema.types.concept]" in toml_out
    assert "[schema.types.entity]" in toml_out
