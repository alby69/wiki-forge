---
type: Reference
title: "OKF Extensions — Wiki-Forge"
description: "This document describes the compatible extensions that Wiki-Forge adds on top of"
resource: docs/standard/OKF_EXTENSIONS.md
tags: [scope/docs, layer/generated, area/standard, lang/en]
status: stable
generated:
  by: process:docs-to-wiki
  at: "2026-11-26T00:00:00Z"
sources:
  - id: source-docs-standard-okf-extensions-md
    resource: docs/standard/OKF_EXTENSIONS.md
    title: "OKF Extensions — Wiki-Forge"
    author: human:alby69
---
# OKF Extensions — Wiki-Forge

This document describes the **compatible extensions** that Wiki-Forge adds on top of
the Open Knowledge Format v0.2 standard (`docs/standard/OKF_SPEC.md`). Every
extension is additive: a strict OKF v0.2 reader MUST still parse and display
the note, ignoring the extra keys and inline anchors.

---

## 1. Line-anchor citations (`[^src:ID#Lx-Ly]`)

A stable note can anchor an individual claim to the exact span of one of its
declared sources. The anchor is an inline footnote-style token:

```
[^src:raw-source-1#L12-L18]
```

Grammar (EBNF):

```
anchor     = "[^src:" source-id "#L" line ( "-L" line )? "]"
source-id  = 1*( letter | digit | "-" | "_" | "." )
line       = positive-integer
```

- `source-id` MUST match the `id` of an entry in the note's `sources:` frontmatter
  array. An anchor whose id is not declared is an **orphan**.
- `line` points into `sources[].resource` (a project-relative path). `Lx-Ly`
  is inclusive and 1-based; `Lx` alone is equivalent to `Lx-Lx`.
- The same anchor may appear several times; anchors on different lines count as
  separate claims.

### 1.1 Claim coverage

A *claim* is any non-heading body line with at least 12 non-whitespace
characters after stripping anchors, wikilinks and markup. Coverage is

```
coverage = claimsAnchored / claimsTotal      (1.0 when claimsTotal == 0)
```

`/verify-citations` reports both the number of anchors and the coverage ratio.

### 1.2 Hash baselines (`sources[].sha256`)

When a note is verified with `setStable`, Wiki-Forge writes the sha256 of every
readable source into the matching `sources[].sha256` field:

```yaml
sources:
  - id: raw-source-1
    resource: raw/source_COMPILED.md
    sha256: 9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08
```

On every subsequent check the live sha256 of `resource` is compared with the
stored baseline. A mismatch is reported as a **hash** issue (advisory for the
report, blocking for `status: stable` promotion).

### 1.3 Verification gate (L4 / `stable`)

`recordHumanVerification` (the `/verify` command and the Review Studio
"Verifica" tab) refuses to write a verification event when:

- any anchor is **orphan**, references a **missing source**, or points **out of
  range** (hard block, `citation-gate-failed`);
- `setStable` is requested and coverage is below
  `WIKIFORGE_CITATION_MIN_COVERAGE` (default `0`, i.e. disabled)
  (`citation-coverage-low`);
- `setStable` is requested and a **hash** issue exists
  (`citation-source-changed`).

The gate is deterministic and runs without an LLM.

### 1.4 Semantic verdicts (optional, advisory)

`/verify-citations <note> semantic` adds an LLM pass that classifies each
anchor as `supported`, `partial` or `unsupported` by comparing the claim line
with the cited source excerpt. Verdicts are advisory: they are never written to
the note and never affect the gate.

## 2. Provenance export (PROV-O)

`scripts/export_prov.py` (and the shared `ProvGraphExporter` in
`src/backend/wikiforge/semantics/prov_exporter.py`) serialises every note as a
W3C PROV-O graph:

- the note is a `prov:Entity` attributed to its `author`/`generated.by`;
- each `[^src:…]` anchor is a `prov:Entity` linked with `prov:wasDerivedFrom`
  and carrying `wf:lineAnchor`, `wf:startLine`, `wf:endLine` and
  `wf:sourceSha256` (when a baseline exists);
- each `verified:` event is a `prov:Activity` connected via
  `prov:wasGeneratedBy` and `prov:wasAssociatedWith`.

Output: `output/prov_export.ttl` and `output/prov_export.jsonld`.

## 3. Compatibility statement

- All new frontmatter keys (`sources[].sha256`) are optional; a note without
  them parses as a valid OKF v0.2 document.
- Inline anchors live in the body and are invisible to a reader that does not
  recognise them.
- No required OKF v0.2 field is added, removed or renamed.
- The `okf_version` marker stays `"0.2"`.
