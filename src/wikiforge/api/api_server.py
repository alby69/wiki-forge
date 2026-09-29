"""
src/wikiforge/api/api_server.py

FastAPI REST API server for wiki-forge Enterprise Knowledge Graph & GraphRAG services.
Provides REST endpoints for graph synchronization, SHACL quality validation,
and interactive GraphRAG query execution.
"""

from pathlib import Path
from typing import Dict, Any, Optional, List
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from rdflib import Graph

from src.wikiforge.semantics.markdown_to_rdf import ZettelToRDFConverter
from src.wikiforge.semantics.shacl_validator import validate_shacl
from src.wikiforge.semantics.graph_rag_pipeline import WikiForgeGraphRAG, GraphRAGState

app = FastAPI(
    title="Wiki-Forge Knowledge Graph & GraphRAG API",
    description="REST API interface for Enterprise Knowledge Graph operations, SHACL validation, and GraphRAG querying.",
    version="1.0.0"
)

# Request / Response Schemas
class SyncRequest(BaseModel):
    wiki_dir: str = Field(default="wiki", description="Target folder containing Markdown notes")
    output_ttl: str = Field(default="knowledge_graph.ttl", description="Output Turtle file path")

class SyncResponse(BaseModel):
    status: str
    message: str
    processed_notes: int
    output_path: str

class ValidationRequest(BaseModel):
    graph_path: str = Field(default="knowledge_graph.ttl", description="Turtle file path")
    shapes_path: str = Field(default="src/wikiforge/config/shapes.ttl", description="SHACL shapes path")

class RAGQueryRequest(BaseModel):
    question: str = Field(..., description="User query natural language string")

class RAGQueryResponse(BaseModel):
    question: str
    entities: List[str]
    cypher_query: str
    final_answer: str


@app.get("/api/v1/health")
def health_check():
    return {"status": "ok", "service": "wiki-forge-kg-api"}


@app.post("/api/v1/graph/sync", response_model=SyncResponse)
def sync_graph(req: SyncRequest):
    wiki_p = Path(req.wiki_dir)
    out_p = Path(req.output_ttl)

    if not wiki_p.exists():
        raise HTTPException(status_code=404, detail=f"Wiki directory '{req.wiki_dir}' not found.")

    try:
        converter = ZettelToRDFConverter()
        notes = []
        md_files = list(wiki_p.glob("**/*.md"))

        for md_file in md_files:
            note_data = converter.parse_markdown_file(md_file, input_dir=wiki_p)
            notes.append(note_data)

        turtle_content = converter.convert_notes_to_turtle(notes)
        out_p.parent.mkdir(parents=True, exist_ok=True)
        out_p.write_text(turtle_content, encoding="utf-8")

        return SyncResponse(
            status="SUCCESS",
            message=f"Synchronized {len(notes)} notes into RDF graph.",
            processed_notes=len(notes),
            output_path=str(out_p)
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Sync error: {str(e)}")


@app.post("/api/v1/graph/validate")
def validate_shacl_endpoint(req: ValidationRequest):
    graph_p = Path(req.graph_path)
    shapes_p = Path(req.shapes_path)

    if not graph_p.exists():
        raise HTTPException(status_code=404, detail=f"Data graph file '{req.graph_path}' not found.")
    if not shapes_p.exists():
        raise HTTPException(status_code=404, detail=f"Shapes file '{req.shapes_path}' not found.")

    try:
        data_g = Graph()
        data_g.parse(str(graph_p), format="turtle")
        res = validate_shacl(data_g, str(shapes_p))
        return {
            "conforms": res["conforms"],
            "graph_path": str(graph_p),
            "shapes_path": str(shapes_p),
            "report": res["results_text"],
            "violations": res["violations"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"SHACL validation error: {str(e)}")


@app.post("/api/v1/graph/rag", response_model=RAGQueryResponse)
def query_rag(req: RAGQueryRequest):
    try:
        rag = WikiForgeGraphRAG()
        initial_state: GraphRAGState = {
            "question": req.question,
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

        return RAGQueryResponse(
            question=req.question,
            entities=st4["entities"],
            cypher_query=st4["cypher_query"],
            final_answer=st4["final_answer"]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"GraphRAG error: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
