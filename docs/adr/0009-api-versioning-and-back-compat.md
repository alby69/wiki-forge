# 9. REST API v1 Prefix and Backward Compatibility

* **Status:** Accepted
* **Deciders:** Wiki-Forge Engineering
* **Date:** 2026-10-16

## Context and Problem Statement

The current REST API endpoints in `src/backend/server/agentServer.ts` use unversioned paths (e.g. `/api/wiki/notes`, `/api/chat`, `/api/reviews`). Refactoring core backend data structures and procedure models risks breaking external clients, browser extensions, or custom sidecar scripts relying on legacy endpoint URLs.

## Decision Drivers

* **Clean API Design:** Standardize versioned REST API endpoints under `/api/v1/`.
* **Zero Disruption Migration:** Provide a seamless migration path for existing web extensions, integrations, and scripts.
* **OpenAPI Specification:** Publish a formal OpenAPI schema (`docs/openapi.yaml`).

## Considered Options

1. **Break legacy unversioned endpoints immediately.**
2. **Maintain dual endpoints permanently with no deprecation schedule.**
3. **Migrate primary endpoints under `/api/v1/` while maintaining legacy `/api/*` path aliases with a `Deprecation` HTTP header for one release cycle.**

## Decision Outcome

Chosen option: **Option 3 (Primary `/api/v1/` route namespace with legacy aliases)**.

All new REST API endpoints will be registered under the `/api/v1` namespace (e.g. `/api/v1/status`, `/api/v1/next`, `/api/v1/wiki/notes`, `/api/v1/changesets`). Legacy unversioned `/api/*` endpoints will transparently alias to their v1 counterparts and return a `Deprecation: true` HTTP response header.

### Positive Consequences

* Clean, version-controlled REST API contract.
* Backward compatibility for existing browser extensions and custom scripts during v3.0.
* Clear deprecation signal for integrators.

### Negative Consequences

* Minor code routing complexity to maintain fallback aliases.
