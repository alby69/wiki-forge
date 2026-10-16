# Knowledge Engineer (KE) Playbook

## Maturity Ladder (L1-L4)
Wiki-Forge classifies knowledge base maturity across four progressive levels:

| Level | Name | Gate Criteria |
|---|---|---|
| **L1** | **Seeded** | `wiki_articles > 0`, valid OKF frontmatter present |
| **L2** | **Structured** | `shacl_violations == 0`, `broken_links == 0` |
| **L3** | **Connected** | `orphan_ratio < 0.05`, `ke_maturity_score >= 60` |
| **L4** | **Trusted** | `cq_gaps == 0`, all `stable` notes human-verified (`human:` in `verified`) |

## Using the KE Cockpit
Open the Knowledge Engineer Cockpit via the UI or `Ctrl+K` -> **Knowledge Engineer Cockpit**.

- **Health Summary**: Real-time score (0-100) and maturity badge.
- **Next Best Actions**: Prioritized procedure recommendations ordered by severity x impact / effort.
- **Procedure Execution**: Click **[Run Procedure]** to launch step-by-step execution.

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
