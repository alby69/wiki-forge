/**
 * B3 — opt-in permission policy for bus commands.
 *
 * The middleware is installed on every `AgentServer`, but returns `undefined`
 * immediately when `enable_rbac=false`: legacy responses (including B0's exact
 * envelopes) stay byte-identical. When enabled, it computes a decision from
 * `operationId × projectId × folder`, attaches it to `CommandContext.rbac` and
 * denies with the existing `error(..., 403)` envelope.
 *
 * A legacy principal (`process:api-token`) inherits the project ACL as a
 * service account; a B6 IdP principal instead intersects its own trusted roles
 * with that ACL. An IdP principal with no mapped roles gets no access: it must
 * never silently inherit the full service-account ACL.
 */

import { error, type ApiResult } from '../api/http';
import type { CommandContext } from '../bus/messageBus';
import {
  OPERATION_MIN_ROLE,
  ROLE_RANK,
  minimumRoleForOperation,
  type CapabilityRole,
} from '@shared/auth/capabilities';
import {
  rolesForProject,
  rolesForScope,
  type RbacConfig,
  type RbacDecision,
} from './rbacConfig';

export type RbacRole = CapabilityRole;

export const OPERATION_ROLES: Record<string, RbacRole> = OPERATION_MIN_ROLE;
export { ROLE_RANK };

export function requiredRoleFor(command: string): RbacRole {
  return minimumRoleForOperation(command);
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
  if (principal?.source === 'idp' || principal?.source === 'local') {
    return principal.roles.filter((role) => acl.includes(role));
  }
  if (principal?.roles.length) {
    return principal.roles.filter((role) => acl.includes(role));
  }
  // Legacy service account: the project/folder ACL is the only source of
  // truth for `process:api-token`.
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
    const isLocal = context.principal?.source === 'local';
    if (!config.enabled && !isLocal) return undefined;
    if (command === 'auth.login') return undefined;
    if (command === 'auth.me'
      && (payload as { authenticated?: boolean } | null)?.authenticated === false) {
      return undefined;
    }
    const decision = decideRbac(config, command, payload, context);
    context.rbac = decision;
    if (decision.allowed) return undefined;
    return error(
      `Forbidden: '${command}' requires the ${decision.requiredRole} role in project '${context.projectId}'`,
      403,
    );
  };
}
