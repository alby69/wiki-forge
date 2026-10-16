"""
src/backend/wikiforge/vault.py

Safe Vault & Changeset Manager for Wiki-Forge.
Provides atomic file write operations, soft-delete to .wikiforge/trash/,
pre-apply snapshots, and changeset proposal/review/application staging.
"""

import json
import os
import shutil
import tempfile
import time
from pathlib import Path
from typing import Any, Dict, List, Optional


class VaultManager:
    def __init__(self, repo_root: Path):
        self.repo_root = repo_root.resolve()
        self.wikiforge_dir = self.repo_root / ".wikiforge"
        self.trash_dir = self.wikiforge_dir / "trash"
        self.changesets_dir = self.wikiforge_dir / "changesets"

        self.wikiforge_dir.mkdir(parents=True, exist_ok=True)
        self.trash_dir.mkdir(parents=True, exist_ok=True)
        self.changesets_dir.mkdir(parents=True, exist_ok=True)

    def atomic_write_file(self, file_path: Path, content: str) -> None:
        """Writes content to file_path atomically using a temporary file."""
        abs_target = file_path.resolve()
        abs_target.parent.mkdir(parents=True, exist_ok=True)

        # Create temp file in same directory to ensure atomic os.replace across filesystems
        fd, temp_path = tempfile.mkstemp(dir=abs_target.parent, prefix=".tmp_vault_")
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as f:
                f.write(content)
            os.replace(temp_path, abs_target)
        except Exception:
            if os.path.exists(temp_path):
                os.unlink(temp_path)
            raise

    def soft_delete_file(self, file_path: Path) -> Path:
        """Soft-deletes a file by moving it to .wikiforge/trash/ with a timestamp suffix."""
        abs_target = file_path.resolve()
        if not abs_target.exists():
            raise FileNotFoundError(f"File '{file_path}' does not exist.")

        timestamp = time.strftime("%Y%m%d_%H%M%S")
        trash_file = self.trash_dir / f"{timestamp}_{abs_target.name}"
        shutil.move(str(abs_target), str(trash_file))
        return trash_file

    def stage_changeset(
        self,
        description: str,
        edits: List[Dict[str, Any]],
        author: str = "agent",
    ) -> Dict[str, Any]:
        """
        Stages a set of proposed file changes into .wikiforge/changesets/<id>.json.
        edits element format:
        {
           "file": "wiki/folder/note.md",
           "action": "create" | "modify" | "delete",
           "proposed_content": "...",
           "find": "...", # optional find block for targeted replace
           "replace": "..."
        }
        """
        cs_id = f"cs-{int(time.time()*1000)}"
        timestamp = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

        # For modify actions, populate original_content from disk if present
        processed_edits = []
        for edit in edits:
            rel_file = edit.get("file", "").strip()
            abs_file = self.repo_root / rel_file
            orig_content = ""
            if abs_file.exists() and abs_file.is_file():
                try:
                    orig_content = abs_file.read_text(encoding="utf-8")
                except Exception:
                    orig_content = ""

            processed_edits.append({
                "file": rel_file,
                "action": edit.get("action", "modify"),
                "original_content": orig_content,
                "proposed_content": edit.get("proposed_content", ""),
                "find": edit.get("find"),
                "replace": edit.get("replace"),
            })

        cs_data = {
            "id": cs_id,
            "timestamp": timestamp,
            "author": author,
            "status": "pending",
            "description": description,
            "edits": processed_edits,
        }

        cs_path = self.changesets_dir / f"{cs_id}.json"
        self.atomic_write_file(cs_path, json.dumps(cs_data, indent=2))
        return cs_data

    def list_changesets(self, status: Optional[str] = None) -> List[Dict[str, Any]]:
        changesets = []
        for cs_file in self.changesets_dir.glob("cs-*.json"):
            try:
                data = json.loads(cs_file.read_text(encoding="utf-8"))
                if status is None or data.get("status") == status:
                    changesets.append(data)
            except Exception:
                continue
        changesets.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
        return changesets

    def get_changeset(self, cs_id: str) -> Optional[Dict[str, Any]]:
        cs_path = self.changesets_dir / f"{cs_id}.json"
        if not cs_path.exists():
            return None
        try:
            return json.loads(cs_path.read_text(encoding="utf-8"))
        except Exception:
            return None

    def apply_changeset(self, cs_id: str) -> Dict[str, Any]:
        cs_path = self.changesets_dir / f"{cs_id}.json"
        data = self.get_changeset(cs_id)
        if not data:
            raise FileNotFoundError(f"Changeset '{cs_id}' not found.")

        if data.get("status") != "pending":
            raise ValueError(f"Changeset '{cs_id}' status is '{data.get('status')}', cannot re-apply.")

        applied_files = []
        for edit in data.get("edits", []):
            rel_file = edit["file"]
            action = edit.get("action", "modify")
            abs_file = self.repo_root / rel_file

            if action == "delete":
                if abs_file.exists():
                    self.soft_delete_file(abs_file)
                    applied_files.append(rel_file)
            elif action == "create":
                self.atomic_write_file(abs_file, edit.get("proposed_content", ""))
                applied_files.append(rel_file)
            elif action == "modify":
                if edit.get("find") is not None and edit.get("replace") is not None:
                    # Target find & replace edit
                    orig = abs_file.read_text(encoding="utf-8") if abs_file.exists() else ""
                    find_str = edit["find"]
                    repl_str = edit["replace"]
                    if find_str in orig:
                        updated = orig.replace(find_str, repl_str, 1)
                        self.atomic_write_file(abs_file, updated)
                    else:
                        raise ValueError(f"Find block not found in {rel_file}")
                else:
                    self.atomic_write_file(abs_file, edit.get("proposed_content", ""))
                applied_files.append(rel_file)

        data["status"] = "applied"
        data["applied_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        self.atomic_write_file(cs_path, json.dumps(data, indent=2))

        return {"changeset_id": cs_id, "status": "applied", "applied_files": applied_files}

    def reject_changeset(self, cs_id: str, reason: str = "") -> Dict[str, Any]:
        cs_path = self.changesets_dir / f"{cs_id}.json"
        data = self.get_changeset(cs_id)
        if not data:
            raise FileNotFoundError(f"Changeset '{cs_id}' not found.")

        data["status"] = "rejected"
        data["rejected_reason"] = reason
        data["rejected_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        self.atomic_write_file(cs_path, json.dumps(data, indent=2))

        return {"changeset_id": cs_id, "status": "rejected"}
