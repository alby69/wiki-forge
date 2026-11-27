# Security Policy

## Supported versions

| Version | Supported |
| --- | --- |
| 4.1.x | Yes |
| 4.0.x | Security fixes only |
| < 4.0 | No |

## Reporting a vulnerability

Use the repository's **Security → Report a vulnerability** flow (private GitHub advisory).
Do not open a public issue for secrets, exploitable bugs or vulnerable dependencies.

Include: affected component (Node gateway, Python FastAPI, UI, wiki projection or CI),
steps to reproduce, impact and any known mitigation. You should receive an acknowledgement
within 3 working days and a remediation plan within 10 working days.

## Scope and gates

CI enforces `npm run verify` (docs sync, manifest, typecheck, build, test, coverage, E2E),
a non-decreasing TypeScript line-coverage baseline, Python coverage gates, CodeQL,
`npm audit`, `pip-audit`, gitleaks, CycloneDX SBOM, hadolint and Trivy.

Never commit tokens, `.env` files, GGUF models, `raw/` sources or private notes.
Secrets in CI are limited to the built-in `GITHUB_TOKEN`.
