"""
src/wikiforge/cli.py

CLI interface for wiki-forge Enterprise Knowledge Graph suite.
Provides command-line commands:
  python3 -m src.wikiforge.cli validate-shacl --shapes shapes.ttl
  python3 -m src.wikiforge.cli query-rag "Quali note trattano di SHACL?"
  python3 -m src.wikiforge.cli sync-graph --input wiki --output knowledge_graph.ttl
  python3 -m src.wikiforge.cli run-cq --suite tests/competency_questions/cqs.yml
"""

import sys
import argparse
from pathlib import Path
from rdflib import Graph

from src.wikiforge.semantics.shacl_validator import validate_shacl
from src.wikiforge.semantics.markdown_to_rdf import ZettelToRDFConverter
from src.wikiforge.semantics.graph_rag_pipeline import WikiForgeGraphRAG, GraphRAGState
from src.wikiforge.semantics.cq_runner import CQRunner


def cmd_validate_shacl(args):
    graph_p = Path(args.graph)
    shapes_p = Path(args.shapes)

    if not graph_p.exists():
        print(f"❌ Grafo RDF non trovato: {graph_p}")
        sys.exit(1)
    if not shapes_p.exists():
        print(f"❌ File vincoli SHACL non trovato: {shapes_p}")
        sys.exit(1)

    print(f"🔍 Validazione SHACL in corso su '{graph_p}' con vincoli '{shapes_p}'...")
    data_g = Graph()
    data_g.parse(str(graph_p), format="turtle")
    res = validate_shacl(data_g, str(shapes_p))

    print(res["results_text"])
    if res["conforms"]:
        print("✅ VALIDAZIONE COMPLETA: Il grafo è conforme a tutti i vincoli SHACL.")
        sys.exit(0)
    else:
        print("❌ VALIDAZIONE FALLITA: Violazioni SHACL rilevate.")
        sys.exit(1)


def cmd_query_rag(args):
    question = args.question
    print(f"🤖 Interrogazione GraphRAG per: '{question}'...\n")

    rag = WikiForgeGraphRAG()
    initial_state: GraphRAGState = {
        "question": question,
        "entities": [],
        "cypher_query": "",
        "graph_results": [],
        "vector_results": [],
        "subgraph_triples": [],
        "error_message": None,
        "retry_count": 0,
        "final_answer": ""
    }

    st1 = rag.extract_entities_node(initial_state)
    st2 = rag.generate_cypher_node(st1)
    st3 = rag.execute_cypher_node(st2)
    st4 = rag.synthesize_answer_node(st3)

    print("--- CYPHER QUERY GENERATA ---")
    print(st2["cypher_query"])
    print("\n--- RISPOSTA SINTETIZZATA ---")
    print(st4["final_answer"])


def cmd_sync_graph(args):
    wiki_p = Path(args.input)
    out_p = Path(args.output)

    if not wiki_p.exists():
        print(f"❌ Cartella note non trovata: {wiki_p}")
        sys.exit(1)

    print(f"🔄 Sincronizzazione note Markdown da '{wiki_p}' in '{out_p}'...")
    converter = ZettelToRDFConverter()
    converter.process_directory(wiki_p, out_p)
    print("✅ Sincronizzazione completata.")


def cmd_run_cq(args):
    suite_p = Path(args.suite)
    graph_p = Path(args.graph)

    if not suite_p.exists():
        print(f"❌ File suite CQ non trovato: {suite_p}")
        sys.exit(1)

    print(f"🧪 Esecuzione Competency Questions da '{suite_p}'...")
    runner = CQRunner(ttl_path=graph_p if graph_p.exists() else None)
    result = runner.run_suite_file(suite_p)
    report = runner.generate_report(result, output_markdown_path=args.output)

    print(report)
    if result.failed_count > 0 or result.error_count > 0:
        sys.exit(1)
    else:
        sys.exit(0)


def main():
    parser = argparse.ArgumentParser(prog="wikiforge", description="CLI Interface for wiki-forge Enterprise Knowledge Graph")
    subparsers = parser.add_subparsers(dest="command", help="Comando da eseguire")

    # validate-shacl
    p_val = subparsers.add_parser("validate-shacl", help="Esegue la validazione SHACL del grafo RDF")
    p_val.add_argument("--graph", "-g", type=str, default="knowledge_graph.ttl", help="File grafo RDF .ttl")
    p_val.add_argument("--shapes", "-s", type=str, default="src/wikiforge/config/shapes.ttl", help="File vincoli SHACL .ttl")
    p_val.set_defaults(func=cmd_validate_shacl)

    # query-rag
    p_rag = subparsers.add_parser("query-rag", help="Interroga il Knowledge Graph tramite GraphRAG")
    p_rag.add_argument("question", type=str, help="Domanda in linguaggio naturale")
    p_rag.set_defaults(func=cmd_query_rag)

    # sync-graph
    p_sync = subparsers.add_parser("sync-graph", help="Sincronizza le note Markdown in RDF Turtle e Cypher")
    p_sync.add_argument("--input", "-i", type=str, default="wiki", help="Cartella note Markdown")
    p_sync.add_argument("--output", "-o", type=str, default="knowledge_graph.ttl", help="File output .ttl")
    p_sync.set_defaults(func=cmd_sync_graph)

    # run-cq
    p_cq = subparsers.add_parser("run-cq", help="Esegue la suite di test Competency Questions (CQ)")
    p_cq.add_argument("--suite", "-s", type=str, default="tests/competency_questions/cqs.yml", help="File YAML CQ suite")
    p_cq.add_argument("--graph", "-g", type=str, default="knowledge_graph.ttl", help="File grafo RDF .ttl")
    p_cq.add_argument("--output", "-o", type=str, default="output/cq_report.md", help="File Markdown report")
    p_cq.set_defaults(func=cmd_run_cq)

    args = parser.parse_args()
    if not args.command:
        parser.print_help()
        sys.exit(1)

    args.func(args)


if __name__ == "__main__":
    main()
