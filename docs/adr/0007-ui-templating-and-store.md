# 7. Dependency-Light UI Templating with `lit-html`

* **Status:** Accepted
* **Deciders:** Wiki-Forge Engineering
* **Date:** 2026-10-16

## Context and Problem Statement

The Web UI (`src/frontend/`) currently relies on vanilla DOM manipulations using `element.innerHTML = ...` combined with custom string formatting and a hand-written `escapeHtml` function. This approach creates security risks (XSS vulnerabilities if raw string escaping is missed), performance overhead (full re-renders tearing down DOM state), and verbose boilerplate code.

## Decision Drivers

* **Security:** Templating layer must escape dynamic values by default to eliminate XSS surface.
* **KISS / Lightweight Philosophy:** Avoid heavy framework runtimes (e.g., React, Angular) that add large bundle sizes and complex build steps.
* **Modern Standard:** Support clean component rendering, template literals, and reactive store subscriptions.

## Considered Options

1. **Preact / React:** Lightweight vDOM framework (~4KB).
2. **Vanilla DOM with `document.createElement`:** Zero dependencies, but verbose.
3. **`lit-html`:** Tiny template literal library (~3KB) providing efficient HTML rendering and default XSS sanitization.

## Decision Outcome

Chosen option: **Option 3 (`lit-html`)**.

The Web UI components will adopt `lit-html` for template rendering.
* Dynamic values inside `${val}` are safely escaped by default.
* HTML produced from Markdown parsing will be explicitly sanitized using `DOMPurify` before rendering via `unsafeHTML()`.
* State management will use a tiny typed pub/sub store module (`src/frontend/store/`).

### Positive Consequences

* Prevents XSS vulnerabilities by default.
* Tiny bundle size footprint (< 5KB overhead).
* Standard JavaScript tagged template literal syntax (`html`...``).

### Negative Consequences

* Requires introducing `lit-html` and `dompurify` npm packages.
