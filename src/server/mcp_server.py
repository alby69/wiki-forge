#!/usr/bin/env python3
"""
src/server/mcp_server.py
Model Context Protocol (MCP) Server for Wiki-Forge Knowledge Base.
Exposes OKF bundle querying via stdio and HTTP/SSE JSON-RPC 2.0 interface.
"""

import os
import sys
import json
import re
import argparse
from pathlib import Path
from http.server import HTTPServer, BaseHTTPRequestHandler

TOOLS = [
    {
        "name": "search_wiki",
        "description": "Searches interlinked Markdown notes in the wiki/ knowledge base directory for matching query terms.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Search query terms to locate relevant concept notes."
                }
            },
            "required": ["query"]
        }
    },
    {
        "name": "get_concept_metadata",
        "description": "Retrieves YAML frontmatter metadata, OKF status, tags, and structure for a target concept note.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "note_id": {
                    "type": "string",
                    "description": "Unique identifier or path of the note (e.g., 'c64_dev' or 'wiki/ai/claude.md')."
                }
            },
            "required": ["note_id"]
        }
    },
    {
        "name": "get_line_anchored_citation",
        "description": "Extracts line-anchored grounded text passage from a note or raw source file.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "note_id": {
                    "type": "string",
                    "description": "Identifier or relative file path (e.g. 'raw/paper.md' or 'concept')."
                },
                "line_start": {
                    "type": "integer",
                    "description": "1-based starting line number."
                },
                "line_end": {
                    "type": "integer",
                    "description": "1-based ending line number."
                }
            },
            "required": ["note_id", "line_start", "line_end"]
        }
    },
    {
        "name": "list_trust_tiers",
        "description": "Lists all notes in the knowledge base grouped by OKF Trust Tiers (human-reviewed, machine-confirmed, unverified).",
        "inputSchema": {
            "type": "object",
            "properties": {}
        }
    },
    {
        "name": "get_version_history",
        "description": "Retrieves snapshot version history and change logs for a given concept note.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "note_id": {
                    "type": "string",
                    "description": "Identifier of the note."
                }
            },
            "required": ["note_id"]
        }
    }
]

def parse_frontmatter(content: str) -> tuple[dict, str]:
    frontmatter = {}
    body = content
    if content.startswith("---"):
        parts = content.split("---", 2)
        if len(parts) >= 3:
            fm_text = parts[1]
            body = parts[2].strip()
            for line in fm_text.splitlines():
                line = line.strip()
                if ":" in line and not line.startswith("#"):
                    key, val = line.split(":", 1)
                    key = key.strip()
                    val = val.strip().strip("'\"")
                    if val.startswith("[") and val.endswith("]"):
                        items = [i.strip().strip("'\"") for i in val[1:-1].split(",") if i.strip()]
                        frontmatter[key] = items
                    else:
                        frontmatter[key] = val
    return frontmatter, body

def find_note_file(repo_root: Path, note_id: str) -> Path | None:
    clean_id = note_id.strip()
    candidates = [
        repo_root / clean_id,
        repo_root / f"{clean_id}.md",
        repo_root / "wiki" / clean_id,
        repo_root / "wiki" / f"{clean_id}.md",
    ]
    for cand in candidates:
        if cand.is_file():
            return cand
    # Recursive search in wiki/
    wiki_dir = repo_root / "wiki"
    if wiki_dir.exists():
        stem = Path(clean_id).stem.lower()
        for file_path in wiki_dir.rglob("*.md"):
            if file_path.stem.lower() == stem:
                return file_path
    return None

def tool_search_wiki(repo_root: Path, query: str) -> dict:
    q = query.lower()
    wiki_dir = repo_root / "wiki"
    results = []
    if wiki_dir.exists():
        for file_path in wiki_dir.rglob("*.md"):
            try:
                content = file_path.read_text(encoding="utf-8")
                rel_path = file_path.relative_to(repo_root).as_posix()
                if q in file_path.name.lower() or q in content.lower():
                    fm, body = parse_frontmatter(content)
                    title = fm.get("title") or file_path.stem.replace("-", " ").title()
                    snippet = body[:200].replace("\n", " ") + "..."
                    results.append({
                        "note_id": file_path.stem,
                        "path": rel_path,
                        "title": title,
                        "tags": fm.get("tags", []),
                        "snippet": snippet
                    })
            except Exception:
                continue
    return {"query": query, "count": len(results), "matches": results}

def tool_get_concept_metadata(repo_root: Path, note_id: str) -> dict:
    file_path = find_note_file(repo_root, note_id)
    if not file_path:
        return {"error": f"Note '{note_id}' not found."}
    content = file_path.read_text(encoding="utf-8")
    fm, body = parse_frontmatter(content)
    verified = fm.get("verified", [])
    if isinstance(verified, str):
        verified = [verified] if verified else []
    status = fm.get("status", "draft")
    trust_tier = "human-reviewed" if verified else ("machine-confirmed" if status == "stable" else "unverified")
    return {
        "note_id": file_path.stem,
        "path": file_path.relative_to(repo_root).as_posix(),
        "frontmatter": fm,
        "status": status,
        "trust_tier": trust_tier,
        "verified": verified,
        "stale_after": fm.get("stale_after")
    }

def tool_get_line_anchored_citation(repo_root: Path, note_id: str, line_start: int, line_end: int) -> dict:
    file_path = find_note_file(repo_root, note_id)
    if not file_path:
        # Check raw/ directory directly if specified
        raw_cand = repo_root / note_id
        if raw_cand.is_file():
            file_path = raw_cand
        elif (repo_root / "raw" / note_id).is_file():
            file_path = repo_root / "raw" / note_id
        elif (repo_root / "raw" / f"{note_id}.md").is_file():
            file_path = repo_root / "raw" / f"{note_id}.md"

    if not file_path or not file_path.is_file():
        return {"error": f"File '{note_id}' not found."}

    lines = file_path.read_text(encoding="utf-8").splitlines()
    start = max(1, line_start)
    end = min(len(lines), line_end)
    extracted = "\n".join(lines[start - 1:end])

    return {
        "note_id": note_id,
        "path": file_path.relative_to(repo_root).as_posix(),
        "line_anchor": f"#L{start}-L{end}",
        "passage": extracted
    }

def tool_list_trust_tiers(repo_root: Path) -> dict:
    wiki_dir = repo_root / "wiki"
    tiers = {
        "human-reviewed": [],
        "machine-confirmed": [],
        "unverified": []
    }
    if wiki_dir.exists():
        for file_path in wiki_dir.rglob("*.md"):
            try:
                content = file_path.read_text(encoding="utf-8")
                fm, _ = parse_frontmatter(content)
                verified = fm.get("verified", [])
                status = fm.get("status", "draft")
                rel_path = file_path.relative_to(repo_root).as_posix()
                item = {"note_id": file_path.stem, "path": rel_path, "title": fm.get("title", file_path.stem)}
                if verified:
                    tiers["human-reviewed"].append(item)
                elif status == "stable":
                    tiers["machine-confirmed"].append(item)
                else:
                    tiers["unverified"].append(item)
            except Exception:
                continue
    return {
        "summary": {
            "human_reviewed_count": len(tiers["human-reviewed"]),
            "machine_confirmed_count": len(tiers["machine-confirmed"]),
            "unverified_count": len(tiers["unverified"]),
        },
        "tiers": tiers
    }

def tool_get_version_history(repo_root: Path, note_id: str) -> dict:
    versions_dir = repo_root / "wiki" / "versions"
    stem = Path(note_id).stem
    history = []
    if versions_dir.exists():
        pattern = re.compile(rf"^{re.escape(stem)}\.v(\d+)\.md$")
        for vfile in versions_dir.glob("*.md"):
            m = pattern.match(vfile.name)
            if m:
                vnum = int(m.group(1))
                content = vfile.read_text(encoding="utf-8")
                fm, _ = parse_frontmatter(content)
                history.append({
                    "version": vnum,
                    "filename": vfile.name,
                    "path": vfile.relative_to(repo_root).as_posix(),
                    "updated": fm.get("updated") or fm.get("generated", {}).get("at")
                })
    history.sort(key=lambda x: x["version"], reverse=True)
    return {"note_id": stem, "versions_count": len(history), "history": history}

def execute_tool(repo_root: Path, name: str, args: dict) -> dict:
    if name == "search_wiki":
        return tool_search_wiki(repo_root, args.get("query", ""))
    elif name == "get_concept_metadata":
        return tool_get_concept_metadata(repo_root, args.get("note_id", ""))
    elif name == "get_line_anchored_citation":
        return tool_get_line_anchored_citation(repo_root, args.get("note_id", ""), args.get("line_start", 1), args.get("line_end", 1))
    elif name == "list_trust_tiers":
        return tool_list_trust_tiers(repo_root)
    elif name == "get_version_history":
        return tool_get_version_history(repo_root, args.get("note_id", ""))
    else:
        return {"error": f"Unknown tool '{name}'"}

def handle_json_rpc(repo_root: Path, request: dict) -> dict | None:
    method = request.get("method")
    req_id = request.get("id")

    if method == "initialize":
        return {
            "jsonrpc": "2.0",
            "id": req_id,
            "result": {
                "protocolVersion": "2024-11-05",
                "capabilities": {
                    "tools": {}
                },
                "serverInfo": {
                    "name": "wiki-forge-mcp",
                    "version": "1.0.0"
                }
            }
        }
    elif method == "tools/list":
        return {
            "jsonrpc": "2.0",
            "id": req_id,
            "result": {
                "tools": TOOLS
            }
        }
    elif method == "tools/call":
        params = request.get("params", {})
        tool_name = params.get("name")
        arguments = params.get("arguments", {})
        res = execute_tool(repo_root, tool_name, arguments)
        return {
            "jsonrpc": "2.0",
            "id": req_id,
            "result": {
                "content": [
                    {
                        "type": "text",
                        "text": json.dumps(res, indent=2)
                    }
                ]
            }
        }
    elif method == "ping":
        return {
            "jsonrpc": "2.0",
            "id": req_id,
            "result": {}
        }
    else:
        if req_id is not None:
            return {
                "jsonrpc": "2.0",
                "id": req_id,
                "error": {
                    "code": -32601,
                    "message": f"Method '{method}' not found"
                }
            }
    return None

class MCPHTTPHandler(BaseHTTPRequestHandler):
    repo_root = Path(__file__).resolve().parent.parent.parent

    def do_POST(self):
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length).decode("utf-8")
        try:
            req = json.loads(body)
            resp = handle_json_rpc(self.repo_root, req)
            if resp:
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps(resp).encode("utf-8"))
            else:
                self.send_response(204)
                self.end_headers()
        except Exception as e:
            self.send_response(500)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}).encode("utf-8"))

    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps({"status": "running", "server": "wiki-forge-mcp"}).encode("utf-8"))

def main():
    parser = argparse.ArgumentParser(description="Wiki-Forge MCP Server")
    parser.add_argument("--http", action="store_true", help="Run HTTP server mode")
    parser.add_argument("--port", type=int, default=8080, help="Port for HTTP mode (default: 8080)")
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parent.parent.parent

    if args.http:
        server_address = ("", args.port)
        httpd = HTTPServer(server_address, MCPHTTPHandler)
        print(f"🚀 Wiki-Forge MCP Server running on HTTP port {args.port}...")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down MCP Server.")
    else:
        # Stdio mode
        for line in sys.stdin:
            line = line.strip()
            if not line:
                continue
            try:
                req = json.loads(line)
                resp = handle_json_rpc(repo_root, req)
                if resp:
                    print(json.dumps(resp), flush=True)
            except Exception as e:
                err_resp = {
                    "jsonrpc": "2.0",
                    "id": None,
                    "error": {
                        "code": -32700,
                        "message": f"Parse error: {e}"
                    }
                }
                print(json.dumps(err_resp), flush=True)

if __name__ == "__main__":
    main()
