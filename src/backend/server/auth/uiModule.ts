/**
 * UI shell commands: a single server-derived access view model plus
 * presentation preferences scoped to the trusted Principal.
 *
 * The module deliberately reuses the B3 helpers instead of reimplementing the
 * role intersection: the UI must show exactly what the bus would allow.
 */

import { json, type ApiResult } from '../api/http';
import type { CommandContext, DomainModule, MessageBus, Principal } from '../bus/messageBus';
import type { RbacConfig } from './rbacConfig';
import { effectiveRoles, visibleProjectsFor } from './rbacMiddleware';
import { legacyPrincipal } from './principal';
import { UiPreferencesStore } from './uiPreferencesStore';
import type { UiAccessDto } from '@shared/api/types';
import {
  ACTION_MIN_ROLE,
  OPERATION_MIN_ROLE,
  roleHasCapability,
  type CapabilityRole,
} from '@shared/auth/capabilities';

export interface UiModuleOptions {
  rbac: RbacConfig;
  store: UiPreferencesStore;
}

type Payload = Record<string, unknown>;

function bodyOf(payload: Payload): unknown {
  return payload.body && typeof payload.body === 'object' && !Array.isArray(payload.body)
    ? payload.body
    : payload;
}

/** Build the permission view from the same decision inputs used by the bus. */
export function buildUiAccess(config: RbacConfig, principal: Principal | undefined): UiAccessDto {
  const trusted = principal ?? legacyPrincipal();
  const visibleProjects = visibleProjectsFor(config, trusted);
  const projectRoles: Record<string, string[]> = {};
  for (const projectId of visibleProjects) {
    projectRoles[projectId] = effectiveRoles(config, trusted, projectId);
  }
  const effective = [...new Set([
    ...trusted.roles,
    ...Object.values(projectRoles).flat(),
  ])];

  const allowed = (required: CapabilityRole): boolean => roleHasCapability(effective, required);
  return {
    actor: trusted.actor,
    source: trusted.source,
    authenticated: trusted.source === 'local' || trusted.source === 'idp',
    roles: [...trusted.roles],
    visibleProjects,
    projectRoles,
    actions: Object.entries(ACTION_MIN_ROLE)
      .filter(([, required]) => allowed(required))
      .map(([actionId]) => actionId),
    operations: Object.entries(OPERATION_MIN_ROLE)
      .filter(([, required]) => allowed(required))
      .map(([operationId]) => operationId),
  };
}

export class UiModule implements DomainModule {
  readonly name = 'ui';

  constructor(private readonly options: UiModuleOptions) {}

  register(bus: MessageBus): void {
    bus.register<Payload>('ui.access', (_payload, context) => this.access(context));
    bus.register<Payload>('ui.preferences.get', (_payload, context) => this.get(context));
    bus.register<Payload>('ui.preferences.put', (payload, context) => this.put(payload, context));
  }

  private access(context: CommandContext): ApiResult {
    return json({ success: true, access: buildUiAccess(this.options.rbac, context.principal) });
  }

  private async get(context: CommandContext): Promise<ApiResult> {
    const preferences = await this.options.store.get(context.principal);
    return json({ success: true, preferences });
  }

  private async put(payload: Payload, context: CommandContext): Promise<ApiResult> {
    const preferences = await this.options.store.put(context.principal, bodyOf(payload));
    return json({ success: true, preferences });
  }
}
