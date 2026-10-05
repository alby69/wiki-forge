import pytest
from pathlib import Path
from rdflib import Graph, Namespace, URIRef, Literal

from src.wikiforge.semantics.markdown_to_rdf import ZettelToRDFConverter, escape_ttl_string, slugify
from src.wikiforge.semantics.cq_runner import CQRunner
from src.wikiforge.semantics.cq_engine import CQEngine, CQTestCase

def test_slugify_and_escape():
    assert slugify("C64 Development / Assembly") == "c64-development-assembly"
    assert slugify("   Special #$% Words  ") == "special-words"
    assert escape_ttl_string('Hello "World"\nNew line') == 'Hello \\"World\\"\\nNew line'

def test_markdown_to_rdf_converter_basic(temp_wiki_dir):
    converter = ZettelToRDFConverter()
    note_path = temp_wiki_dir / "valid_concept.md"
    note_data = converter.parse_markdown_file(note_path, input_dir=temp_wiki_dir)

    assert note_data["slug"] == "valid-concept"
    assert note_data["title"] == "Valid Concept Note"
    assert len(note_data["links"]) == 1
    assert note_data["links"][0]["target_slug"] == "another-concept"
    assert note_data["links"][0]["predicate"] == "refersTo"

def test_markdown_to_rdf_star_generation(temp_wiki_dir):
    converter = ZettelToRDFConverter()
    note_path = temp_wiki_dir / "valid_concept.md"
    note_data = converter.parse_markdown_file(note_path, input_dir=temp_wiki_dir)

    ttl_star = converter.convert_notes_to_turtle([note_data], include_rdf_star=True)
    assert "@prefix wf:" in ttl_star
    assert "wfid:valid-concept" in ttl_star
    assert "# --- RDF-star Edge Metadata ---" in ttl_star
    assert "<< wfid:valid-concept wf:refersTo wfid:another-concept >>" in ttl_star
    assert "wf:confidence" in ttl_star

def test_cq_runner_with_graph():
    wf = Namespace("https://w3id.org/wikiforge/ontology/")
    wfid = Namespace("https://w3id.org/wikiforge/id/")
    g = Graph()
    g.add((wfid["concept-a"], wf["refersTo"], wfid["concept-b"]))

    runner = CQRunner(data_graph=g)
    test_suite = {
        "competency_questions": [
            {
                "id": "CQ-1",
                "question": "Which concepts refer to concept-b?",
                "query": "SELECT ?s WHERE { ?s <https://w3id.org/wikiforge/ontology/refersTo> <https://w3id.org/wikiforge/id/concept-b> }",
                "expected_min_results": 1
            }
        ]
    }
    result = runner.run_suite_file(test_suite)
    assert result.total_questions == 1
    assert result.passed_count == 1
    assert result.failed_count == 0
    assert result.error_count == 0

def test_cq_runner_malformed_yaml_handling(tmp_path):
    malformed_yaml_file = tmp_path / "bad_cq_suite.yml"
    malformed_yaml_file.write_text("competency_questions:\n  - id: CQ-1\n    question: [Unclosed bracket\n    query: : : : invalid syntax", encoding="utf-8")

    runner = CQRunner()
    # Should handle malformed YAML safely without throwing crashing exception
    result = runner.run_suite_file(malformed_yaml_file)
    assert result.total_questions == 0
    assert result.passed_count == 0
    assert result.failed_count == 0
    assert result.error_count == 0

def test_mcp_execute_ke_use_case(temp_wiki_dir):
    repo_root = temp_wiki_dir.parent
    from src.server.mcp_server import execute_tool, TOOLS

    tool_names = [t["name"] for t in TOOLS]
    assert "execute_ke_use_case" in tool_names

    res = execute_tool(repo_root, "execute_ke_use_case", {"use_case_id": "ke_ontological_validation"})
    assert res["status"] == "completed"
    assert res["use_case_id"] == "ke_ontological_validation"
    assert "executed_steps" in res
