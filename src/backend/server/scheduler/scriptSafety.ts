/**
 * S0/S1 — script safety metadata derived from the generated registry.
 *
 * `SCRIPT_SCHEMAS` in Python is the single source of truth. This module only
 * projects it into the shape used by the F5 Policy Agent and by the scheduler,
 * so adding a new script can never silently bypass the approval gate.
 *
 * S1 adds argument-aware classification: the effective safety of an invocation
 * is derived from parameter defaults, `automation.defaultArgs`, job args and
 * the `automation.argSafety` overrides generated from the same SSOT.
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

/**
 * Replicate `useCaseRunner`'s precedence without importing the runner:
 * schema defaults -> catalog defaults -> job/step args. This is what the F5
 * policy must classify, otherwise `--check`/`--fix` style flags would be missed.
 */
export function resolveScriptArgs(
  scriptId: string | undefined,
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  const def = scriptId ? GENERATED_SCRIPT_REGISTRY[scriptId] : undefined;
  if (!def) return { ...overrides };
  const resolved: Record<string, unknown> = {};
  for (const param of def.parameters) {
    if (param.default !== undefined) resolved[param.name] = param.default;
  }
  return { ...resolved, ...(def.automation?.defaultArgs ?? {}), ...overrides };
}

function ruleMatches(when: Record<string, unknown>, args: Record<string, unknown>): boolean {
  return Object.entries(when).every(([key, value]) => args[key] === value);
}

/** Effective safety for a concrete invocation, not just for the script id. */
export function resolveScriptSafety(
  scriptId: string | undefined,
  overrides: Record<string, unknown> = {}
): ResolvedScriptSafety {
  if (!scriptId) return 'unknown';
  const automation = getScriptAutomation(scriptId);
  if (!automation) return 'unknown';
  if (automation.safety === 'blocked') return 'blocked';

  const args = resolveScriptArgs(scriptId, overrides);
  for (const rule of automation.argSafety ?? []) {
    if (ruleMatches(rule.when, args)) return rule.safety;
  }
  return automation.safety;
}

export function getScriptSafety(
  scriptId: string | undefined,
  args?: Record<string, unknown>
): ResolvedScriptSafety {
  return args ? resolveScriptSafety(scriptId, args) : resolveScriptSafety(scriptId);
}

/**
 * Fail-closed check used by the Policy Agent. An unknown script id is treated
 * as mutating so a typo can never turn into an unattended write; a step with
 * no script id is not a script invocation.
 */
export function isMutatingScript(
  scriptId: string | undefined,
  args?: Record<string, unknown>
): boolean {
  if (!scriptId) return false;
  if (LEGACY_MUTATING_SCRIPT_IDS.has(scriptId)) return true;
  const safety = resolveScriptSafety(scriptId, args);
  if (safety === 'unknown') return true;
  return MUTATING_SAFETIES.has(safety);
}

export function isBlockedScript(scriptId: string | undefined): boolean {
  return getScriptSafety(scriptId) === 'blocked';
}

export function isSchedulableScript(scriptId: string | undefined): boolean {
  return getScriptAutomation(scriptId)?.schedulable === true;
}
