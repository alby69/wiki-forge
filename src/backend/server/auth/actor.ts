/**
 * B5 — canonical provenance actor shared by every write path.
 *
 * This is the TypeScript mirror of `scripts/actor_provenance.py`. The pattern
 * is the same one accepted by `scripts/okf_lint.py` and by the OKF v0.2 spec:
 * `human:<id>`, `process:<id>` or `<producer>/<version>`. Keeping it in one
 * module avoids the drift that previously allowed raw body values such as
 * `mario` or `qa` to be written as provenance.
 */

export type ActorKind = 'human' | 'process' | 'producer';

export const ACTOR_PATTERN =
  /^(human:[a-zA-Z0-9_-]+|process:[a-zA-Z0-9_-]+|[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+)$/;

/** Fallback for a server-derived principal that is malformed: fail closed. */
export const PROCESS_FALLBACK_ACTOR = 'process:api-token';

export function isCanonicalActor(value: unknown): value is string {
  return typeof value === 'string' && ACTOR_PATTERN.test(value.trim());
}

export function actorKind(actor: string): ActorKind {
  if (/^human:/.test(actor)) return 'human';
  if (/^process:/.test(actor)) return 'process';
  return 'producer';
}

/**
 * Normalise an actor without ever inventing a human identity. A server-derived
 * principal keeps its prefix; invalid characters in the id are replaced so a
 * malformed IdP claim cannot inject YAML. Unknown inputs fall back to the
 * canonical process actor.
 */
export function canonicalActor(value: unknown, fallback: string = PROCESS_FALLBACK_ACTOR): string {
  const safeFallback = isCanonicalActor(fallback) ? fallback.trim() : PROCESS_FALLBACK_ACTOR;
  if (!isCanonicalActor(value)) {
    if (typeof value !== 'string') return safeFallback;
    const raw = value.trim();
    const prefix = /^(human|process):/i.exec(raw);
    if (!prefix) return safeFallback;
    const id = raw.slice(prefix[0].length).replace(/[^a-zA-Z0-9_-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    return id ? `${prefix[1].toLowerCase()}:${id}` : safeFallback;
  }
  return value.trim();
}

/**
 * Legacy chat `/verify` used to turn any `reviewer=<id>` token into
 * `human:<id>`. B5 keeps this helper for the legacy path only; strict mode
 * always uses the server-derived principal instead.
 */
export function humanActorFromId(value: unknown, fallback = 'local'): string {
  const raw = typeof value === 'string' ? value.trim().replace(/^human:/i, '') : '';
  const id = (raw || fallback).replace(/[^a-zA-Z0-9_-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return `human:${id || fallback}`;
}
