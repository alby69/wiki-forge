import type { AuthIdentityDto } from '@shared/api/types';
import type { Principal } from '../bus/messageBus';

export interface AuthIdentityOptions {
  rbacEnabled: boolean;
  strict: boolean;
  idpConfigured: boolean;
  userStoreConfigured?: boolean;
}

export function buildAuthIdentity(
  principal: Principal,
  authenticated: boolean,
  options: AuthIdentityOptions,
): AuthIdentityDto {
  return {
    actor: principal.actor,
    roles: [...principal.roles],
    source: principal.source,
    authenticated,
    rbacEnabled: options.rbacEnabled,
    strict: options.strict,
    idpConfigured: options.idpConfigured,
    ...(options.userStoreConfigured === true ? { userStoreConfigured: true } : {}),
  };
}
