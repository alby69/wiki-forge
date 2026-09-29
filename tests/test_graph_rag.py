import unittest
from src.wikiforge.semantics.graph_rag_pipeline import (
    WikiForgeGraphRAG,
    GraphRAGState,
    build_graph_rag_app,
    LANGGRAPH_AVAILABLE,
)

class TestGraphRAGPipeline(unittest.TestCase):
    def setUp(self):
        self.rag = WikiForgeGraphRAG()
        self.initial_state: GraphRAGState = {
            "question": "Quale nota parla di SHACL ed Elisa Kendall?",
            "entities": [],
            "cypher_query": "",
            "graph_results": [],
            "error_message": None,
            "retry_count": 0,
            "final_answer": ""
        }

    def test_extract_entities_node(self):
        st = self.rag.extract_entities_node(self.initial_state)
        self.assertIn("SHACL", st["entities"])
        self.assertIn("Elisa", st["entities"])
        self.assertIsNone(st["error_message"])

    def test_generate_cypher_node(self):
        st_entities = self.rag.extract_entities_node(self.initial_state)
        st_cypher = self.rag.generate_cypher_node(st_entities)
        self.assertIn("MATCH (n:PermanentNote)", st_cypher["cypher_query"])
        self.assertIn("RETURN n.title AS Nota", st_cypher["cypher_query"])

    def test_execute_cypher_node(self):
        st_entities = self.rag.extract_entities_node(self.initial_state)
        st_cypher = self.rag.generate_cypher_node(st_entities)
        st_exec = self.rag.execute_cypher_node(st_cypher)
        self.assertIsInstance(st_exec["graph_results"], list)
        self.assertGreater(len(st_exec["graph_results"]), 0)
        self.assertIsNone(st_exec["error_message"])

    def test_synthesize_answer_node(self):
        st_entities = self.rag.extract_entities_node(self.initial_state)
        st_cypher = self.rag.generate_cypher_node(st_entities)
        st_exec = self.rag.execute_cypher_node(st_cypher)
        st_synth = self.rag.synthesize_answer_node(st_exec)
        self.assertIn("Elisa Kendall", st_synth["final_answer"])
        self.assertIn("Knowledge Graph", st_synth["final_answer"])

    def test_build_workflow_langgraph(self):
        if LANGGRAPH_AVAILABLE:
            app = self.rag.build_workflow()
            self.assertIsNotNone(app)
            output = app.invoke(self.initial_state)
            self.assertIn("final_answer", output)
            self.assertGreater(len(output["final_answer"]), 0)

if __name__ == "__main__":
    unittest.main()
