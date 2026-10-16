# Architecture Decision Records (ADRs)

This directory documents the key architectural decisions for **Wiki-Forge v3.0**.

| ADR ID | Title | Status |
|--------|-------|--------|
| [0001](0001-typescript-core.md) | Single Deterministic Core in TypeScript (`src/core`) | Accepted |
| [0002](0002-python-converters-only.md) | Python Reserved for Format Conversion Subprocesses | Accepted |
| [0003](0003-dot-wikiforge-state.md) | Persistent On-Disk State in `.wikiforge/` | Accepted |
| [0004](0004-changesets-plan-review-apply.md) | Plan → Review → Apply Workflow for LLM Writes | Accepted |
| [0005](0005-procedures-as-data.md) | Procedures as Declarative TOML Data | Accepted |
| [0006](0006-single-command-registry.md) | Single Command Registry in `config/commands.toml` | Accepted |
| [0007](0007-ui-templating-and-store.md) | Dependency-Light UI Templating with `lit-html` | Accepted |
| [0008](0008-server-auth-and-security.md) | Standalone Server Security, Origin Checks, and Loopback Auth | Accepted |
| [0009](0009-api-versioning-and-back-compat.md) | REST API v1 Prefix and Backward Compatibility | Accepted |
