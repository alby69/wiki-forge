"""
src/wikiforge/semantics/cq_runner.py

Standalone Competency Questions (CQ) Test Runner.
Loads YAML declarative CQs (e.g. tests/competency_questions/cqs.yml)
and executes them against an RDF graph or RDF graph loaded from Turtle files.
Returns structured results and compliance reports.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Dict, Any, Optional
from rdflib import Graph

from src.wikiforge.semantics.cq_engine import CQEngine, CQSuiteResult


class CQRunner:
    """
    Runner for Competency Questions test suites.
    """

    def __init__(self, ttl_path: Optional[str | Path] = None, data_graph: Optional[Graph] = None):
        self.graph = data_graph or Graph()
        if ttl_path and Path(ttl_path).exists():
            self.graph.parse(str(ttl_path), format="turtle")
        self.engine = CQEngine(data_graph=self.graph)

    def run_suite_file(self, suite_yaml_path: str | Path) -> CQSuiteResult:
        """Runs the YAML suite against the current graph."""
        return self.engine.run_suite(suite_yaml_path)

    def generate_report(self, result: CQSuiteResult, output_markdown_path: Optional[str | Path] = None) -> str:
        """Generates a Markdown compliance report."""
        lines = [
            "# Competency Questions (CQ) Compliance Report",
            "",
            f"- **Total CQs**: {result.total_questions}",
            f"- **Passed**: {result.passed_count} ✅",
            f"- **Failed**: {result.failed_count} ❌",
            f"- **Errors**: {result.error_count} ⚠️",
            "",
            "## Details",
            ""
        ]

        for res in result.results:
            status_icon = "✅" if res.status == "PASSED" else ("❌" if res.status == "FAILED" else "⚠️")
            lines.append(f"### {status_icon} [{res.cq_id}] {res.question}")
            lines.append(f"- **Status**: `{res.status}`")
            lines.append(f"- **Result Count**: {res.result_count}")
            lines.append(f"- **Message**: {res.message}")
            if res.actual_bindings:
                lines.append("- **Bindings**:")
                for b in res.actual_bindings:
                    lines.append(f"  - `{b}`")
            lines.append("")

        report_str = "\n".join(lines)
        if output_markdown_path:
            out_p = Path(output_markdown_path)
            out_p.parent.mkdir(parents=True, exist_ok=True)
            out_p.write_text(report_str, encoding="utf-8")

        return report_str


def main():
    parser = argparse.ArgumentParser(description="Competency Question Test Runner for wiki-forge")
    parser.add_argument("--suite", "-s", type=str, default="tests/competency_questions/cqs.yml", help="Path to YAML CQ suite")
    parser.add_argument("--graph", "-g", type=str, default="knowledge_graph.ttl", help="Path to RDF Turtle graph file")
    parser.add_argument("--output", "-o", type=str, default="output/cq_report.md", help="Path for output Markdown report")

    args = parser.parse_args()

    suite_p = Path(args.suite)
    graph_p = Path(args.graph)

    if not suite_p.exists():
        print(f"❌ Suite file not found: {suite_p}")
        sys.exit(1)

    runner = CQRunner(ttl_path=graph_p if graph_p.exists() else None)
    result = runner.run_suite_file(suite_p)
    report = runner.generate_report(result, output_markdown_path=args.output)

    print(report)

    if result.failed_count > 0 or result.error_count > 0:
        sys.exit(1)
    else:
        sys.exit(0)


if __name__ == "__main__":
    main()
