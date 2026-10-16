# 8. Standalone Server Security, Origin Checks, and Loopback Auth

* **Status:** Accepted
* **Deciders:** Wiki-Forge Engineering
* **Date:** 2026-10-16

## Context and Problem Statement

The backend Node.js server (`src/backend/server/agentServer.ts`) runs locally and accepts filesystem modification requests (saving, attaching, renaming, deleting files). Running a local server without strict host/origin validation exposes the user's filesystem to DNS rebinding or cross-site request forgery (CSRF) from malicious websites opened in the user's web browser.

## Decision Drivers

* **Local Machine Protection:** Prevent arbitrary web pages on the internet from invoking local REST endpoints.
* **Path Containment:** Ensure file operations cannot escape designated project directories (`wiki/`, `raw/`, `sources/`).
* **Optional Authentication:** Support zero-configuration loopback access for single-user mode, while enabling bearer token authentication when exposed over local networks or desktop sidecars.

## Considered Options

1. **Require full OAuth2/OIDC authentication for all requests.**
2. **Bind to loopback without host/origin checks.**
3. **Bind strictly to loopback (`127.0.0.1`), enforce strict `Origin`/`Host` header validation, sanitize paths via `realpath` containment, and offer configurable bearer token authentication (`[server.auth]`).**

## Decision Outcome

Chosen option: **Option 3 (Loopback binding + Origin/Host validation + Path containment + Configurable Auth)**.

The standalone server (built using Fastify) will enforce:
1. **Loopback Binding:** Default listener bound strictly to `127.0.0.1`.
2. **DNS Rebinding & CSRF Protection:** Strict checking of `Host` and `Origin` headers against allowed local origins (`localhost`, `127.0.0.1`).
3. **Strict Path Containment:** All file resolution uses `fs.realpath` validation to ensure paths remain inside allowed vault directories, rejecting symlink escape attacks.
4. **Token Authentication:** Support token mode (`X-WikiForge-Token` or `Authorization: Bearer <token>`) using a locally generated secret saved in `.wikiforge/server.json`.

### Positive Consequences

* Robust protection against web-based DNS rebinding and CSRF attacks.
* Hardened against path traversal vulnerabilities.
* Flexible single-user loopback or authenticated sidecar modes.

### Negative Consequences

* External network access requires explicitly enabling token auth and host overrides.
