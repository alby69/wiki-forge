"""C3 — live read-only Cypher service and explicit pipeline modes (no network)."""

from __future__ import annotations

from typing import Any

import pytest

from src.backend.wikiforge.semantics.graph_rag_pipeline import (
    GraphRAGState,
    WikiForgeGraphRAG,
)
from src.backend.wikiforge.semantics.neo4j_client import Neo4jClient, Neo4jConfig
from src.backend.wikiforge.semantics.neo4j_query import (
    Neo4jQueryService,
    QueryExecutionError,
    ReadOnlyViolation,
    validate_read_only,
)

READ_QUERY = "MATCH (n:PermanentNote) WHERE n.title = $title RETURN n.title AS title"


class FakeSession:
    def __init__(self, calls: list, rows: list[dict[str, Any]]) -> None:
        self.calls = calls
        self.rows = rows

    def __enter__(self) -> "FakeSession":
        return self

    def __exit__(self, *_args: object) -> bool:
        return False

    def run(self, query: str, params: dict | None = None, **kwargs: Any) -> list[dict[str, Any]]:
        self.calls.append(("run", query, params, kwargs))
        return self.rows


class FakeDriver:
    """Records sessions/runs; every returned row is an in-memory dict."""

    def __init__(self, rows: list[dict[str, Any]] | None = None) -> None:
        self.rows = rows or [{"title": "Validazione SHACL"}, {"title": "Knowledge Graph"}]
        self.calls: list = []
        self.closed = False

    def session(self, database: str | None = None, **_kwargs: Any) -> FakeSession:
        self.calls.append(("session", database))
        return FakeSession(self.calls, self.rows)

    def verify_connectivity(self) -> None:
        self.calls.append(("verify", None))

    def close(self) -> None:
        self.closed = True


def enabled_client(driver: FakeDriver) -> Neo4jClient:
    return Neo4jClient(
        Neo4jConfig(
            enabled=True,
            password_env="WF_C3_TEST_PASSWORD",
            projects={"default": "neo4j", "tesi": "tesi-db"},
        ),
        driver_factory=lambda _cfg, _pwd: driver,
        environ={"WF_C3_TEST_PASSWORD": "secret"},
    )


def make_state(cypher: str = READ_QUERY, params: dict | None = None) -> GraphRAGState:
    return {
        "question": "Quali note parlano di SHACL?",
        "entities": ["SHACL"],
        "cypher_query": cypher,
        "cypher_params": params if params is not None else {"title": "SHACL"},
        "graph_results": [],
        "vector_results": [],
        "subgraph_triples": [],
        "mode": "",
        "project_id": None,
        "error_message": None,
        "error_type": None,
        "retry_count": 0,
        "final_answer": "",
    }


def test_read_only_whitelist_accepts_generated_query() -> None:
    query = (
        "MATCH (n:PermanentNote)-[r:SUPPORTS*1..2]-(t:PermanentNote)\n"
        "WHERE any(e IN $entities WHERE toLower(n.title) CONTAINS toLower(e))\n"
        "OPTIONAL MATCH (n)-[:WAS_ATTRIBUTED_TO]->(a:Agent)\n"
        "RETURN n.title AS Nota, a.name AS Autore"
    )
    assert validate_read_only(query).startswith("MATCH (n:PermanentNote)")
    assert "RETURN" in validate_read_only(query)


@pytest.mark.parametrize(
    "bad_query",
    [
        "CREATE (n:PermanentNote {id: 'x'}) RETURN n",
        "MATCH (n) SET n.title = 'x' RETURN n",
        "MATCH (n) DELETE n RETURN n",
        "MATCH (n) DETACH DELETE n RETURN n",
        "MATCH (n) REMOVE n.title RETURN n",
        "CALL db.labels() RETURN label",
        "MATCH (n) RETURN n; MATCH (m) DELETE m RETURN m",
        "RETURN 1",
        "",
    ],
)
def test_write_and_non_read_statements_are_rejected(bad_query: str) -> None:
    with pytest.raises(ReadOnlyViolation) as exc:
        validate_read_only(bad_query)
    assert exc.value.code == "read_only_violation"


def test_literals_and_comments_do_not_trigger_false_positives() -> None:
    query = (
        "// CREATE is mentioned only in a comment\n"
        "MATCH (n:PermanentNote) WHERE n.title = 'SET DELETE me' RETURN n.title AS title"
    )
    assert validate_read_only(query).endswith("RETURN n.title AS title")


def test_service_binds_params_adds_limit_and_passes_timeout() -> None:
    driver = FakeDriver()
    service = Neo4jQueryService(
        client=enabled_client(driver),
        timeout_seconds=2.5,
        max_rows=7,
    )
    rows = service.execute_read(READ_QUERY, {"title": "SHACL"}, project_id="tesi")

    assert rows == [{"title": "Validazione SHACL"}, {"title": "Knowledge Graph"}]
    assert service.is_live is True
    run = [entry for entry in driver.calls if entry[0] == "run"]
    assert len(run) == 1
    _, query, params, kwargs = run[0]
    assert query.startswith("MATCH (n:PermanentNote)")
    assert query.rstrip().endswith("LIMIT 7")
    assert params == {"title": "SHACL"}
    assert kwargs == {"timeout": 2.5}
    assert ("session", "tesi-db") in driver.calls


def test_service_caps_rows_and_rejects_bad_params() -> None:
    rows = [{"n": i} for i in range(10)]
    service = Neo4jQueryService(driver=FakeDriver(rows), max_rows=3)
    assert service.execute_read("MATCH (n) RETURN n") == [{"n": 0}, {"n": 1}, {"n": 2}]
    with pytest.raises(ReadOnlyViolation):
        service.execute_read(READ_QUERY, params=["not", "a", "mapping"])  # type: ignore[arg-type]


def test_service_wraps_driver_failures_once() -> None:
    class BrokenDriver(FakeDriver):
        def session(self, database: str | None = None, **_kwargs: Any) -> FakeSession:
            raise RuntimeError("connection lost")

    service = Neo4jQueryService(driver=BrokenDriver())
    with pytest.raises(QueryExecutionError) as exc:
        service.execute_read(READ_QUERY)
    assert exc.value.code == "query_execution_error"


def test_pipeline_live_mode_returns_fake_results_in_graph_results() -> None:
    driver = FakeDriver([{"Nota": "SHACL", "Autore": "Elisa"}])
    client = enabled_client(driver)
    rag = WikiForgeGraphRAG(neo4j_client=client)
    state = make_state()

    out = rag.execute_cypher_node(state)

    assert out["mode"] == "live"
    assert out["graph_results"] == [{"Nota": "SHACL", "Autore": "Elisa"}]
    assert out["error_message"] is None
    assert out["error_type"] is None
    assert out["vector_results"] and out["subgraph_triples"]
    run = [entry for entry in driver.calls if entry[0] == "run"]
    assert len(run) == 1
    assert run[0][2] == {"title": "SHACL"}


def test_pipeline_mock_mode_is_explicit_without_a_driver() -> None:
    rag = WikiForgeGraphRAG()
    out = rag.execute_cypher_node(make_state())

    assert out["mode"] == "mock"
    assert len(out["graph_results"]) == 2  # legacy fixtures preserved
    assert out["graph_results"][0]["Autore"] == "Elisa Kendall"
    assert out["error_message"] is None


def test_pipeline_never_silently_downgrades_live_to_mock() -> None:
    rag = WikiForgeGraphRAG()
    out = rag.execute_cypher_node({**make_state(), "mode": "live"})

    assert out["mode"] == "live"
    assert out["graph_results"] == []
    assert out["error_type"] == "query_mode"
    assert "configured Neo4j driver" in out["error_message"]
    assert out["retry_count"] == 1


def test_pipeline_rejects_write_query_with_typed_error() -> None:
    driver = FakeDriver()
    rag = WikiForgeGraphRAG(neo4j_client=enabled_client(driver))
    out = rag.execute_cypher_node(make_state("MATCH (n) SET n.title = 'x' RETURN n"))

    assert out["error_type"] == "read_only_violation"
    assert out["graph_results"] == []
    assert out["retry_count"] == 1
    assert not any(entry[0] == "run" for entry in driver.calls)


def test_generate_cypher_is_parametrized_and_legacy_assertions_hold() -> None:
    state = make_state()
    rag = WikiForgeGraphRAG()
    generated = rag.generate_cypher_node(state)

    assert "MATCH (n:PermanentNote)" in generated["cypher_query"]
    assert "RETURN n.title AS Nota" in generated["cypher_query"]
    assert "$entities" in generated["cypher_query"]
    assert "'" not in generated["cypher_query"]
    assert generated["cypher_params"] == {"entities": ["SHACL"]}
    assert validate_read_only(generated["cypher_query"])
