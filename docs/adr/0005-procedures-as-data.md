# 5. Procedures as Declarative TOML Data

* **Status:** Accepted
* **Deciders:** Wiki-Forge Engineering
* **Date:** 2026-10-16

## Context and Problem Statement

Guided workflows (onboarding, link repair, source intake, thesis compilation) are currently hard-coded in TypeScript components, custom Python scripts, or prose agent instructions. Modifying or extending a procedure requires editing application source code.

## Decision Drivers

* **Extensibility:** Knowledge Engineers and end users should be able to inspect, customize, and create procedures without touching code.
* **Shared Engine:** CLI wizards, Web UI steppers, and AI agents must share identical procedure definitions and execution rules.
* **Resumability:** Long-running multi-step procedures must track state and be resumable across restarts.

## Considered Options

1. **Hard-code procedures in TypeScript classes.**
2. **Define procedures in Python scripts.**
3. **Define procedures as declarative TOML files (`config/procedures/*.toml`) validated by JSON Schema.**

## Decision Outcome

Chosen option: **Option 3 (Declarative TOML procedures executed by a shared TS engine)**.

Procedures are stored as TOML files in `config/procedures/{ke,user}/*.toml`. User overrides live in `.wikiforge/procedures/`.
* Schema validation is enforced using Zod and JSON Schema.
* Step kinds include `auto` (core function call), `agent` (LLM proposal generating a changeset), `review` (human approval step), `manual` (human checkbox action), and `check` (metric verification).
* Run state is saved to `.wikiforge/state/<run-id>.json`.

### Positive Consequences

* Single procedure engine used across Web UI, CLI, and Agent commands.
* End-user procedures can be edited visually or via text overrides without recompiling software.
* Built-in dependency DAG prevents executing actions out of order.

### Negative Consequences

* Step parameters and triggers must be expressible in declarative TOML syntax.
