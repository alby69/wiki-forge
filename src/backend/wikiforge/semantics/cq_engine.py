"""
src/wikiforge/semantics/cq_engine.py

Competency Question (CQ) Test Suite Runner for Knowledge Engineering.
Maps natural language CQs to declarative SPARQL/Cypher unit tests and executes them
against RDF graph models to verify domain competency coverage.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
from rdflib import Graph

try:
    import yaml
except ImportError:
    yaml = None


class CQTestCase(BaseModel):
    cq_id: str
    question: str
    sparql_query: str
    expected_min_results: int = 1
    expected_bindings: Optional[List[Dict[str, str]]] = None


class CQTestResult(BaseModel):
    cq_id: str
    question: str
    status: str  # "PASSED", "FAILED", "ERROR"
    result_count: int = 0
    actual_bindings: List[Dict[str, str]] = Field(default_factory=list)
    message: str = ""


class CQSuiteResult(BaseModel):
    total_questions: int = 0
    passed_count: int = 0
    failed_count: int = 0
    error_count: int = 0
    results: List[CQTestResult] = Field(default_factory=list)


class CQEngine:
    """
    Executes declarative Competency Question test suites against RDF knowledge graphs.
    """

    def __init__(self, data_graph: Optional[Graph] = None):
        self.data_graph = data_graph or Graph()

    def set_graph(self, graph: Graph) -> None:
        self.data_graph = graph

    def run_test_case(self, test_case: CQTestCase) -> CQTestResult:
        if not self.data_graph:
            return CQTestResult(
                cq_id=test_case.cq_id,
                question=test_case.question,
                status="ERROR",
                message="Data graph is empty or not provided.",
            )

        try:
            query_res = self.data_graph.query(test_case.sparql_query)
            bindings: List[Dict[str, str]] = []
            for row in query_res:
                row_dict = {}
                if hasattr(row, "asdict"):
                    for var_name, val in row.asdict().items():
                        row_dict[str(var_name)] = str(val)
                elif isinstance(row, (tuple, list)):
                    for idx, val in enumerate(row):
                        row_dict[f"var{idx}"] = str(val)
                bindings.append(row_dict)

            actual_count = len(bindings)

            # Check min results requirement
            if actual_count < test_case.expected_min_results:
                return CQTestResult(
                    cq_id=test_case.cq_id,
                    question=test_case.question,
                    status="FAILED",
                    result_count=actual_count,
                    actual_bindings=bindings,
                    message=f"Expected min {test_case.expected_min_results} results, got {actual_count}.",
                )

            # Check expected bindings if specified
            if test_case.expected_bindings:
                for expected in test_case.expected_bindings:
                    found = False
                    for b in bindings:
                        if all(b.get(k) == str(v) for k, v in expected.items()):
                            found = True
                            break
                    if not found:
                        return CQTestResult(
                            cq_id=test_case.cq_id,
                            question=test_case.question,
                            status="FAILED",
                            result_count=actual_count,
                            actual_bindings=bindings,
                            message=f"Expected binding {expected} not found in query results.",
                        )

            return CQTestResult(
                cq_id=test_case.cq_id,
                question=test_case.question,
                status="PASSED",
                result_count=actual_count,
                actual_bindings=bindings,
                message="Competency Question satisfied.",
            )

        except Exception as e:
            return CQTestResult(
                cq_id=test_case.cq_id,
                question=test_case.question,
                status="ERROR",
                message=f"SPARQL execution error: {str(e)}",
            )

    def run_suite(
        self, suite_source: str | Path | dict, data_graph: Optional[Graph] = None
    ) -> CQSuiteResult:
        if data_graph is not None:
            self.data_graph = data_graph

        suite_data: dict = {}
        if isinstance(suite_source, (str, Path)):
            p = Path(suite_source)
            if p.is_file():
                content = p.read_text(encoding="utf-8")
                if yaml:
                    try:
                        suite_data = yaml.safe_load(content) or {}
                    except Exception:
                        suite_data = {}
        elif isinstance(suite_source, dict):
            suite_data = suite_source

        raw_cqs = suite_data.get("competency_questions", [])
        suite_result = CQSuiteResult()

        for raw_cq in raw_cqs:
            test_case = CQTestCase(
                cq_id=str(raw_cq.get("id") or raw_cq.get("cq_id", "CQ")),
                question=str(raw_cq.get("question", "")),
                sparql_query=str(raw_cq.get("query") or raw_cq.get("sparql_query", "")),
                expected_min_results=int(raw_cq.get("expected_min_results", 1)),
                expected_bindings=raw_cq.get("expected_bindings"),
            )
            res = self.run_test_case(test_case)
            suite_result.results.append(res)
            suite_result.total_questions += 1
            if res.status == "PASSED":
                suite_result.passed_count += 1
            elif res.status == "FAILED":
                suite_result.failed_count += 1
            else:
                suite_result.error_count += 1

        return suite_result
