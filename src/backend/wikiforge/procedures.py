"""
src/backend/wikiforge/procedures.py

Procedure Engine for Wiki-Forge.
Parses TOML procedure definitions from config/procedures/*.toml, validates DAG requirements,
manages step execution (auto scripts vs human review pauses), evaluates exit criteria,
and persists run state in .wikiforge/state/<run_id>.json.
"""

import json
import os
import subprocess
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

try:
    import tomllib
except ImportError:
    try:
        import tomli as tomllib
    except ImportError:
        import smol_toml as tomllib

from src.backend.wikiforge.api.health import compute_health_metrics


class ProcedureEngine:
    def __init__(self, repo_root: Path, procedures_dir: Optional[Path] = None):
        self.repo_root = repo_root.resolve()
        self.procedures_dir = (procedures_dir or (self.repo_root / "config" / "procedures")).resolve()
        self.wikiforge_dir = self.repo_root / ".wikiforge"
        self.state_dir = self.wikiforge_dir / "state"

        self.procedures_dir.mkdir(parents=True, exist_ok=True)
        self.wikiforge_dir.mkdir(parents=True, exist_ok=True)
        self.state_dir.mkdir(parents=True, exist_ok=True)

    def list_procedures(self) -> List[Dict[str, Any]]:
        procedures = []
        for file_p in self.procedures_dir.glob("*.toml"):
            if file_p.name == "schema.toml":
                continue
            proc = self.get_procedure_by_path(file_p)
            if proc:
                procedures.append(proc)
        procedures.sort(key=lambda x: x.get("id", ""))
        return procedures

    def get_procedure_by_path(self, file_path: Path) -> Optional[Dict[str, Any]]:
        try:
            content = file_path.read_text(encoding="utf-8")
            if hasattr(tomllib, "loads"):
                data = tomllib.loads(content)
            else:
                data = tomllib.parse(content)
            return data
        except Exception:
            return None

    def get_procedure(self, procedure_id: str) -> Optional[Dict[str, Any]]:
        for file_p in self.procedures_dir.glob("*.toml"):
            proc = self.get_procedure_by_path(file_p)
            if proc and proc.get("id") == procedure_id:
                return proc
        return None

    def start_run(self, procedure_id: str, args: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        proc = self.get_procedure(procedure_id)
        if not proc:
            raise ValueError(f"Procedure '{procedure_id}' not found.")

        # Validate DAG dependencies ('requires')
        requires = proc.get("requires", [])
        if requires:
            completed_procs = {
                r.get("procedure_id") for r in self.list_runs(status="completed")
            }
            missing = [req for req in requires if req not in completed_procs]
            if missing:
                raise ValueError(f"Cannot start '{procedure_id}': missing prerequisite procedures: {missing}")

        run_id = f"run-{int(time.time()*1000)}"
        timestamp = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

        steps = proc.get("steps", [])
        step_states = []
        for s in steps:
            step_states.append({
                "id": s.get("id"),
                "kind": s.get("kind", "auto"),
                "title": s.get("title", s.get("id")),
                "script": s.get("script"),
                "status": "pending",
                "output": "",
                "error": "",
                "started_at": None,
                "completed_at": None,
            })

        run_data = {
            "run_id": run_id,
            "procedure_id": procedure_id,
            "procedure_title": proc.get("title", procedure_id),
            "role": proc.get("role", "user"),
            "status": "in_progress",
            "current_step_index": 0,
            "args": args or {},
            "step_states": step_states,
            "created_at": timestamp,
            "updated_at": timestamp,
            "completed_at": None,
        }

        self.save_run_state(run_data)

        # Also write wizard_state.json if role == 'user'
        if proc.get("role") == "user":
            wizard_file = self.wikiforge_dir / "wizard_state.json"
            wizard_file.write_text(json.dumps(run_data, indent=2), encoding="utf-8")

        # Automatically advance initial step
        return self.advance_run(run_id)

    def get_run(self, run_id: str) -> Optional[Dict[str, Any]]:
        state_file = self.state_dir / f"{run_id}.json"
        if not state_file.exists():
            return None
        try:
            return json.loads(state_file.read_text(encoding="utf-8"))
        except Exception:
            return None

    def save_run_state(self, run_data: Dict[str, Any]) -> None:
        run_id = run_data["run_id"]
        run_data["updated_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        state_file = self.state_dir / f"{run_id}.json"

        # Write temp file and replace
        temp_file = self.state_dir / f".tmp_{run_id}.json"
        temp_file.write_text(json.dumps(run_data, indent=2), encoding="utf-8")
        temp_file.replace(state_file)

        # Update wizard_state.json if user wizard
        if run_data.get("role") == "user":
            wizard_file = self.wikiforge_dir / "wizard_state.json"
            wizard_file.write_text(json.dumps(run_data, indent=2), encoding="utf-8")

    def list_runs(self, procedure_id: Optional[str] = None, status: Optional[str] = None) -> List[Dict[str, Any]]:
        runs = []
        for file_p in self.state_dir.glob("run-*.json"):
            try:
                data = json.loads(file_p.read_text(encoding="utf-8"))
                if procedure_id and data.get("procedure_id") != procedure_id:
                    continue
                if status and data.get("status") != status:
                    continue
                runs.append(data)
            except Exception:
                continue
        runs.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        return runs

    def advance_run(self, run_id: str) -> Dict[str, Any]:
        run = self.get_run(run_id)
        if not run:
            raise FileNotFoundError(f"Run '{run_id}' not found.")

        if run["status"] in ("completed", "failed"):
            return run

        steps = run["step_states"]
        idx = run["current_step_index"]

        while idx < len(steps):
            step = steps[idx]
            run["current_step_index"] = idx

            if step["status"] == "completed":
                idx += 1
                continue

            if step["kind"] == "review":
                if step["status"] == "pending":
                    step["status"] = "paused_for_review"
                    step["started_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
                    run["status"] = "paused_for_review"
                    self.save_run_state(run)
                    return run
                elif step["status"] == "paused_for_review":
                    # Still waiting for user approval
                    return run

            if step["kind"] == "auto":
                step["status"] = "in_progress"
                step["started_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
                self.save_run_state(run)

                # Execute script
                script_name = step.get("script")
                if script_name:
                    script_path = self.repo_root / "scripts" / script_name
                    if not script_path.exists():
                        script_path = self.repo_root / "src" / "backend" / "wikiforge" / "semantics" / script_name

                    if script_path.exists():
                        cmd = [sys.executable, str(script_path)]
                        try:
                            proc_res = subprocess.run(
                                cmd,
                                cwd=str(self.repo_root),
                                capture_output=True,
                                text=True,
                                timeout=30,
                            )
                            step["output"] = proc_res.stdout
                            step["error"] = proc_res.stderr
                            if proc_res.returncode == 0:
                                step["status"] = "completed"
                            else:
                                step["status"] = "failed"
                                run["status"] = "failed"
                                self.save_run_state(run)
                                return run
                        except Exception as e:
                            step["status"] = "failed"
                            step["error"] = str(e)
                            run["status"] = "failed"
                            self.save_run_state(run)
                            return run
                    else:
                        step["status"] = "completed"
                        step["output"] = f"Script '{script_name}' completed or mocked."
                else:
                    step["status"] = "completed"

                step["completed_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
                idx += 1

        # All steps executed
        proc = self.get_procedure(run["procedure_id"])
        exit_criteria = proc.get("exit_criteria") if proc else None

        if exit_criteria:
            health = compute_health_metrics(self.repo_root)
            metric = exit_criteria.get("metric")
            op = exit_criteria.get("op", "==")
            target = exit_criteria.get("value")

            metrics_flat = health.get("metrics", {})
            metrics_flat["health_score"] = health.get("health_score")
            actual = metrics_flat.get(metric)

            criteria_met = False
            if actual is not None:
                if op == "==":
                    criteria_met = actual == target
                elif op == "<=":
                    criteria_met = actual <= target
                elif op == ">=":
                    criteria_met = actual >= target

            if not criteria_met:
                run["status"] = "failed"
                run["exit_criteria_error"] = f"Exit criteria failed: {metric} ({actual}) {op} {target}"
                self.save_run_state(run)
                return run

        run["status"] = "completed"
        run["completed_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        self.save_run_state(run)
        return run

    def approve_step(self, run_id: str, step_id: str) -> Dict[str, Any]:
        run = self.get_run(run_id)
        if not run:
            raise FileNotFoundError(f"Run '{run_id}' not found.")

        steps = run["step_states"]
        found = False
        for step in steps:
            if step["id"] == step_id:
                if step["status"] in ("paused_for_review", "pending"):
                    step["status"] = "completed"
                    step["completed_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
                    found = True
                    break

        if not found:
            raise ValueError(f"Step '{step_id}' not ready for approval in run '{run_id}'.")

        run["status"] = "in_progress"
        run["current_step_index"] += 1
        self.save_run_state(run)

        return self.advance_run(run_id)
