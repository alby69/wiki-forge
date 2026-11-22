/**
 * B3 — opt-in permission policy for bus commands.
 *
 * The middleware is installed on every `AgentServer`, but returns `undefined`
 * immediately when `enable_rbac=false`: legacy responses (including B0's exact
 * envelopes) stay byte-identical. When enabled, it computes a decision from
 * `operationId × projectId × folder`, attaches it to `CommandContext.rbac` and
 * denies with the existing `error(..., 403)` envelope.
 *
 * No IdP exists until B6. A server-derived legacy principal (`process:api-token`,
 * no roles) inherits the project ACL as a service account; an IdP principal in
 * B6 will instead intersect its own roles with that ACL.
 */

import { error, type ApiResult } from '../api/http';
import type { CommandContext } from '../bus/messageBus';
import {
  rolesForProject,
  rolesForScope,
  type RbacConfig,
  type RbacDecision,
} from './rbacConfig';

export type RbacRole = 'Reader' | 'Contributor' | 'KnowledgeEngineer' | 'Admin';

/** Role precedence: a higher role may do everything a lower one may do. */
export const ROLE_RANK: Record<RbacRole, number> = {
  Reader: 0,
  Contributor: 1,
  KnowledgeEngineer: 2,
  Admin: 3,
};

/**
 * Minimum role for every registered operation. Commands are mapped explicitly
 * so that adding one requires a deliberate decision; anything unmapped fails
 * closed with `Admin` via `requiredRoleFor()`.
 */
export const OPERATION_ROLES: Record<string, RbacRole> = {
  // Reader — reads and export
  'files.download': 'Reader',
  'graph.clusters': 'Reader',
  'graph.insights': 'Reader',
  'help.get': 'Reader',
  'help.list': 'Reader',
  'ingest.queue.list': 'Reader',
  'ke.useCases.list': 'Reader',
  'projects.config.get': 'Reader',
  'projects.export': 'Reader',
  'projects.list': 'Reader',
  'projects.stats': 'Reader',
  'research.backlinks': 'Reader',
  'research.related': 'Reader',
  'research.search': 'Reader',
  'review.diff': 'Reader',
  'review.digest': 'Reader',
  'review.meta': 'Reader',
  'review.snapshots': 'Reader',
  'reviews.list': 'Reader',
  'schedule.approvals': 'Reader',
  'schedule.decisions': 'Reader',
  'schedule.events': 'Reader',
  'schedule.runs': 'Reader',
  'schedule.status': 'Reader',
  'scripts.list': 'Reader',
  'scripts.registry': 'Reader',
  'skills.list': 'Reader',
  'wiki.folders.list': 'Reader',
  'wiki.notes.list': 'Reader',
  'wiki.scratchpad.list': 'Reader',
  'wiki.trash.list': 'Reader',

  // Contributor — notes, changeset staging, uploads, generated study material
  'changesets.get': 'Contributor',
  'changesets.list': 'Contributor',
  'changesets.stage': 'Contributor',
  'chat.send': 'Contributor',
  'ingest.queue.add': 'Contributor',
  'ingest.queue.process': 'Contributor',
  'reviews.action': 'Contributor',
  'reviews.add': 'Contributor',
  'schedule.trigger': 'Contributor',
  'study.audioOverview': 'Contributor',
  'study.guide': 'Contributor',
  'study.mindmap': 'Contributor',
  'study.note': 'Contributor',
  'study.promoteNote': 'Contributor',
  'study.quiz': 'Contributor',
  'study.thesisChapter': 'Contributor',
  'wiki.delete': 'Contributor',
  'wiki.file.create': 'Contributor',
  'wiki.folder.create': 'Contributor',
  'wiki.ingest': 'Contributor',
  'wiki.move': 'Contributor',
  'wiki.note.applyEdit': 'Contributor',
  'wiki.note.attach': 'Contributor',
  'wiki.note.save': 'Contributor',
  'wiki.rename': 'Contributor',
  'wiki.scratchpad.delete': 'Contributor',
  'wiki.trash.restore': 'Contributor',
  'wiki.upload': 'Contributor',

  // Knowledge Engineer — verification, use cases, scripts and scheduler
  'ke.useCases.execute': 'KnowledgeEngineer',
  'research.consult': 'KnowledgeEngineer',
  'research.deepResearch': 'KnowledgeEngineer',
  'research.promoteAnswer': 'KnowledgeEngineer',
  'research.trace': 'KnowledgeEngineer',
  'review.critique': 'KnowledgeEngineer',
  'review.restore': 'KnowledgeEngineer',
  'review.verify': 'KnowledgeEngineer',
  'schedule.cancel': 'KnowledgeEngineer',
  'schedule.patch': 'KnowledgeEngineer',
  'schedule.run': 'KnowledgeEngineer',
  'scripts.execute': 'KnowledgeEngineer',
  'scripts.schedule': 'KnowledgeEngineer',
  'scripts.unschedule': 'KnowledgeEngineer',

  // Admin — projects, approval decisions, changeset apply/reject and config
  'changesets.apply': 'Admin',
  'changesets.reject': 'Admin',
  'projects.archive': 'Admin',
  'projects.clone': 'Admin',
  'projects.config.put': 'Admin',
  'projects.create': 'Admin',
  'projects.delete': 'Admin',
  'projects.import': 'Admin',
  'projects.rename': 'Admin',
  'projects.restore': 'Admin',
  'schedule.approvalDecision': 'Admin',
};

/** Unknown commands require Admin: a new endpoint is never public by default. */
export function requiredRoleFor(command: string): RbacRole {
  return OPERATION_ROLES[command] ?? 'Admin';
}

const PATH_FIELDS = ['path', 'note', 'noteRef', 'file', 'filePath', 'target', 'folder'];

/** Wiki-relative scope of a command, if its payload carries a path. */
export function scopePathFromPayload(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return undefined;
  const record = payload as Record<string, unknown>;
  const sources = [record.body, record].filter(
    (source): source is Record<string, unknown> =>
      Boolean(source) && typeof source === 'object' && !Array.isArray(source),
  );
  for (const source of sources) {
    for (const field of PATH_FIELDS) {
      const value = source[field];
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
  }
  return undefined;
}

/** Roles actually granted for this request, never wider than the project ACL. */
export function effectiveRoles(
  config: RbacConfig,
  principal: CommandContext['principal'],
  projectId: string,
  scopePath?: string,
): string[] {
  const acl = rolesForScope(config, projectId, scopePath);
  if (principal?.roles.length) {
    return principal.roles.filter((role) => acl.includes(role));
  }
  // Legacy service account: until B6 there is no human identity, so the
  // project/folder ACL is the only source of truth for `process:api-token`.
  return acl;
}

/** Projects visible to the caller; modules use this to filter listings. */
export function visibleProjectsFor(config: RbacConfig, principal: CommandContext['principal']): string[] {
  const candidates = new Set([
    'default',
    ...Object.keys(config.projectAcls).filter((key) => !key.includes('/')),
  ]);
  return [...candidates]
    .filter((project) => effectiveRoles(config, principal, project).length > 0)
    .sort();
}

/** Pure decision function, also used by the role matrix tests. */
export function decideRbac(
  config: RbacConfig,
  command: string,
  payload: unknown,
  context: Pick<CommandContext, 'projectId' | 'principal'>,
): RbacDecision {
  const requiredRole = requiredRoleFor(command);
  const roles = effectiveRoles(config, context.principal, context.projectId, scopePathFromPayload(payload));
  const rank = roles.reduce(
    (highest, role) => Math.max(highest, ROLE_RANK[role as RbacRole] ?? -1),
    -1,
  );
  return {
    allowed: rank >= ROLE_RANK[requiredRole],
    roles,
    requiredRole,
    visibleProjects: visibleProjectsFor(config, context.principal),
  };
}

/**
 * Bus middleware factory. With `enabled=false` this returns a no-op result for
 * every dispatch, so no HTTP response, status or envelope changes.
 */
export function createRbacMiddleware(config: RbacConfig) {
  return (
    command: string,
    payload: unknown,
    context: CommandContext,
  ): ApiResult | undefined => {
    if (!config.enabled) return undefined;
    const decision = decideRbac(config, command, payload, context);
    context.rbac = decision;
    if (decision.allowed) return undefined;
    return error(
      `Forbidden: '${command}' requires the ${decision.requiredRole} role in project '${context.projectId}'`,
      403,
    );
  };
}
