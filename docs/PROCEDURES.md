# Procedure Engine Specification

## Schema & Attributes

Procedures are TOML files located in `config/procedures/`.

### Top-level Fields
- `id` (string, required): Unique identifier (e.g. `ke.ontological-integrity`, `user.onboarding`).
- `title` (string, required): Display title.
- `role` (string, required): `ke` (Knowledge Engineer) or `user` (Focus Mode operator).
- `description` (string): Detailed summary.
- `requires` (array of strings): Prerequisite procedure IDs (DAG dependencies).
- `exit_criteria` (object, optional): Metric threshold evaluated at completion:
  - `metric`: string (e.g. `shacl_violations`, `cq_gaps`, `ke_maturity_score`)
  - `op`: `==`, `<=`, or `>=`
  - `value`: numeric threshold

### Step Fields (`[[steps]]`)
- `id` (string, required): Step identifier.
- `kind` (string, required): `auto` (script execution) or `review` (human approval).
- `script` (string, optional): Script file name in `scripts/` or `src/`.
- `title` (string): Step label.
- `description` (string): Step explanation.

## Persistent Run State
Procedure execution states are stored in `.wikiforge/state/<run_id>.json`:

```json
{
  "run_id": "run-1710000000000",
  "procedure_id": "ke.ontological-integrity",
  "status": "paused_for_review",
  "current_step_index": 1,
  "step_states": [
    { "id": "scan", "kind": "auto", "status": "completed" },
    { "id": "review", "kind": "review", "status": "paused_for_review" }
  ]
}
```
