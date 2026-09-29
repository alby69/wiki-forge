"""
tests/test_api_cli.py

Integration tests for REST API endpoints (FastAPI TestClient) and CLI commands.
"""

import unittest
from fastapi.testclient import TestClient

from src.wikiforge.api.api_server import app


class TestAPIAndCLI(unittest.TestCase):

    def setUp(self):
        self.client = TestClient(app)

    def test_health_check(self):
        resp = self.client.get("/api/v1/health")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["status"], "ok")

    def test_rag_query_endpoint(self):
        resp = self.client.post("/api/v1/graph/rag", json={"question": "Quale nota parla di SHACL?"})
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("SHACL", data["question"])
        self.assertIn("MATCH", data["cypher_query"])
        self.assertIn("final_answer", data)


if __name__ == "__main__":
    unittest.main()
