/**
 * B2 — declarative RBAC catalogue (inert).
 *
 * Reads the `[enterprise]` table of `config.toml` and normalises it into a
 * transport-neutral shape. Nothing in this loader denies or allows an
 * operation: the B3 middleware enforces the catalogue when `enable_rbac=true`,
 * while the B6 IdP remains opt-in through `auth.provider`.
 */

import * as fs from 'node:fs/promises';
import * as fsSync from 'node:fs';
import * as path from 'node:path';
import * as toml from 'smol-toml';

/** Canonical roles mirrored by the Python schema and the config catalogue. */
export const DEFAULT_ROLES = ['Reader', 'Contributor', 'KnowledgeEngineer', 'Admin'] as const;

/** B6 — provider scelto in `[enterprise.auth]`; vuoto disattiva l'adapter. */
export type IdpProvider = 'oidc' | 'saml' | 'oauth2';

export interface RbacAuthConfig {
  issuer: string;
  audience: string;
  jwksUrl: string;
  samlMetadataUrl: string;
  /** B6 — `""` keeps the B0–B5 behaviour; the other values select an adapter. */
  provider: IdpProvider | '';
  clientId: string;
  authorizationUrl: string;
  tokenUrl: string;
  /** Claim containing the canonical actor (`sub` by default). */
  actorClaim: string;
  /** Claim containing IdP roles/groups (`roles` by default). */
  rolesClaim: string;
  /** IdP role → canonical RBAC role mapping. */
  roleMap: Record<string, string>;
}

export interface RbacConfig {
  enabled: boolean;
  roles: string[];
  permissionsByRole: Record<string, string[]>;
  projectAcls: Record<string, string[]>;
  defaultAcl: string[];
  auth: RbacAuthConfig;
}

/**
 * B3 — decision attached to `CommandContext` when enforcement is active.
 *
 * Modules read it instead of re-deriving permissions: `visibleProjects` is
 * used to filter listings. `context.rbac` is absent in legacy mode, where no
 * filter must be applied at all.
 */
export interface RbacDecision {
  allowed: boolean;
  /** Effective roles after IdP roles ∩ project/folder ACL. */
  roles: string[];
  /** Minimum role required by the operation (unknown commands fail closed). */
  requiredRole: string;
  /** Projects whose ACL grants at least one effective role. */
  visibleProjects: string[];
}

export function defaultRbacConfig(env: NodeJS.ProcessEnv = process.env): RbacConfig {
  return {
    enabled: env.NODE_ENV === 'production',
    roles: [...DEFAULT_ROLES],
    permissionsByRole: {},
    projectAcls: {},
    defaultAcl: [...DEFAULT_ROLES],
    auth: {
      issuer: '', audience: '', jwksUrl: '', samlMetadataUrl: '',
      provider: '', clientId: '', authorizationUrl: '', tokenUrl: '',
      actorClaim: '', rolesClaim: '', roleMap: {},
    },
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function normalizeRbacConfig(raw: unknown, env: NodeJS.ProcessEnv = process.env): RbacConfig {
  const config = defaultRbacConfig(env);
  const enterprise = asRecord(asRecord(raw).enterprise);

  if (env.NODE_ENV !== 'production') config.enabled = enterprise.enable_rbac === true;

  for (const [role, permissions] of Object.entries(asRecord(enterprise.roles))) {
    config.permissionsByRole[role] = asStringArray(permissions) ?? [];
  }
  const customRoles = Object.keys(config.permissionsByRole)
    .filter((role) => !DEFAULT_ROLES.some((canonical) => canonical === role))
    .sort();
  config.roles = [...DEFAULT_ROLES, ...customRoles];

  for (const [project, roles] of Object.entries(asRecord(enterprise.projectAcls))) {
    const acl = asStringArray(roles);
    if (acl) config.projectAcls[project] = acl;
  }
  if (config.projectAcls.default) config.defaultAcl = [...config.projectAcls.default];

  const auth = asRecord(enterprise.auth);
  for (const key of [
    'issuer', 'audience', 'jwksUrl', 'samlMetadataUrl',
    'clientId', 'authorizationUrl', 'tokenUrl', 'actorClaim', 'rolesClaim',
  ] as const) {
    const value = auth[key];
    if (typeof value === 'string') config.auth[key] = value;
  }
  const provider = auth.provider;
  if (provider === 'oidc' || provider === 'saml' || provider === 'oauth2') {
    config.auth.provider = provider;
  }
  for (const [from, to] of Object.entries(asRecord(auth.roleMap))) {
    if (typeof to === 'string' && to.trim()) config.auth.roleMap[from] = to.trim();
  }

  return config;
}

/** Roles allowed in a project; unknown projects fall back to `default`. */
export function rolesForProject(config: RbacConfig, projectId: string): string[] {
  return config.projectAcls[projectId] ?? config.defaultAcl;
}

/**
 * B3 — roles allowed for a note path inside a project.
 *
 * A key of `[enterprise.projectAcls]` containing `/` is a folder scope, e.g.
 * `"wikiforge/wiki/processi" = ["Admin"]`. The longest matching prefix wins;
 * a plain project key stays the fallback. Folder keys are additive to B2's
 * schema (`projectAcls` maps arbitrary string keys to string arrays).
 */
export function rolesForScope(config: RbacConfig, projectId: string, scopePath?: string): string[] {
  const base = rolesForProject(config, projectId);
  if (!scopePath) return base;
  const normalized = scopePath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  if (!normalized) return base;
  const segments = normalized.split('/');
  for (let length = segments.length; length > 0; length -= 1) {
    const key = `${projectId}/${segments.slice(0, length).join('/')}`;
    if (Object.prototype.hasOwnProperty.call(config.projectAcls, key)) {
      return config.projectAcls[key];
    }
  }
  return base;
}

/** Load the RBAC catalogue from the first config.toml found under `rootDir`. */
export async function loadRbacConfig(
  rootDir: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<RbacConfig> {
  for (const relative of ['config/config.toml', 'config.toml']) {
    try {
      const content = await fs.readFile(path.join(rootDir, relative), 'utf-8');
      return normalizeRbacConfig(toml.parse(content) as unknown, env);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') continue;
      throw err;
    }
  }
  return defaultRbacConfig(env);
}

/**
 * B3 — constructor-friendly variant used by `AgentServer` to install the
 * middleware before the first dispatch. An unreadable/malformed file falls
 * back to the legacy (disabled) catalogue so opt-in stays strictly opt-in:
 * an invalid file can never turn enforcement on by accident.
 */
export function loadRbacConfigSync(
  rootDir: string,
  env: NodeJS.ProcessEnv = process.env,
): RbacConfig {
  for (const relative of ['config/config.toml', 'config.toml']) {
    try {
      const content = fsSync.readFileSync(path.join(rootDir, relative), 'utf-8');
      return normalizeRbacConfig(toml.parse(content) as unknown, env);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') continue;
      return defaultRbacConfig(env);
    }
  }
  return defaultRbacConfig(env);
}
