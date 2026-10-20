# Knowledge Engineer (KE) Playbook

## Maturity Ladder (L1-L4)
Wiki-Forge classifies knowledge base maturity across four progressive levels:

| Level | Name | Gate Criteria |
|---|---|---|
| **L1** | **Seeded** | `wiki_articles > 0`, valid OKF frontmatter present |
| **L2** | **Structured** | `shacl_violations == 0`, `broken_links == 0` |
| **L3** | **Connected** | `orphan_ratio < 0.05`, `ke_maturity_score >= 60` |
| **L4** | **Trusted** | `cq_gaps == 0`, all `stable` notes human-verified (`human:` in `verified`) |

## Using the KE Workbench
Open the **🧠 KE Workbench** panel from the toolbar in Developer Mode.

- **Six guided use cases**: Schema & Taxonomy Modeling, Ontological Integrity, Competency Questions, Neuro-Symbolic & ODP, Semantic Export, Maturity Evaluation — each with step-by-step workflows you can run individually or with **▶ Run All Steps**.
- **Health metrics**: run `/ke-maturity` in chat for the L1-L4 maturity evaluation, or call the backend endpoint `/api/v1/health` for a 0-100 Health Score and prioritized Next Best Actions.
- **Procedure definitions** live in `config/procedures/<id>.toml` and are executed by the backend Procedure Engine (see [`docs/PROCEDURES.md`](PROCEDURES.md)).

## Writing Custom Procedures
Custom TOML procedures reside in `config/procedures/<id>.toml`:

```toml
id = "ke.custom-check"
title = "Custom Domain Check"
role = "ke"
description = "Runs custom domain checks"
requires = ["ke.bootstrap"]

[exit_criteria]
metric = "shacl_violations"
op = "=="
value = 0

[[steps]]
id = "scan"
kind = "auto"
script = "shacl_validator.py"
title = "Run SHACL Scan"

[[steps]]
id = "review"
kind = "review"
title = "Review Warnings"
```
