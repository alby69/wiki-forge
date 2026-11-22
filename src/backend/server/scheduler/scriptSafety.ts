/**
 * S0 — script safety metadata derived from the generated registry.
 *
 * `SCRIPT_SCHEMAS` in Python is the single source of truth. This module only
 * projects it into the shape used by the F5 Policy Agent and by the scheduler,
 * so adding a new script can never silently bypass the approval gate.
 */

import { GENERATED_SCRIPT_REGISTRY } from '../generated/scriptRegistry.generated';
import type { ScriptAutomation, ScriptSafety } from '../agentServer';

export type ResolvedScriptSafety = ScriptSafety | 'unknown';

/** Kept for compatibility with commands that are not in the script registry. */
export const LEGACY_MUTATING_SCRIPT_IDS: ReadonlySet<string> = new Set(['promote_doc_answer']);

/** Classes that write outside `output/` and therefore require F6 approval. */
export const MUTATING_SAFETIES: ReadonlySet<ScriptSafety> = new Set<ScriptSafety>([
  'workspace',
  'wiki-write',
  'blocked',
]);

/** Backwards-compatible export: now generated instead of hand-maintained. */
export const MUTATING_SCRIPT_IDS: ReadonlySet<string> = new Set<string>([
  ...Object.entries(GENERATED_SCRIPT_REGISTRY)
    .filter(([, def]) => def.automation && MUTATING_SAFETIES.has(def.automation.safety))
    .map(([id]) => id),
  ...LEGACY_MUTATING_SCRIPT_IDS,
]);

export function getScriptAutomation(scriptId: string | undefined): ScriptAutomation | undefined {
  if (!scriptId) return undefined;
  return GENERATED_SCRIPT_REGISTRY[scriptId]?.automation;
}

export function getScriptSafety(scriptId: string | undefined): ResolvedScriptSafety {
  return getScriptAutomation(scriptId)?.safety ?? 'unknown';
}

/**
 * Fail-closed check used by the Policy Agent. A missing/unknown script id is
 * treated as mutating so a typo can never turn into an unattended write.
 */
export function isMutatingScript(scriptId: string | undefined): boolean {
  if (!scriptId) return false;
  if (LEGACY_MUTATING_SCRIPT_IDS.has(scriptId)) return true;
  const safety = getScriptSafety(scriptId);
  if (safety === 'unknown') return true;
  return MUTATING_SAFETIES.has(safety);
}

export function isBlockedScript(scriptId: string | undefined): boolean {
  return getScriptSafety(scriptId) === 'blocked';
}

export function isSchedulableScript(scriptId: string | undefined): boolean {
  return getScriptAutomation(scriptId)?.schedulable === true;
}
