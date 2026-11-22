/**
 * B2 — declarative RBAC catalogue (inert).
 *
 * Reads the `[enterprise]` table of `config.toml` and normalises it into a
 * transport-neutral shape. Nothing here denies or allows an operation: the
 * permission gate arrives in B3 and the IdP in B6. Setting `enable_rbac=true`
 * on its own therefore cannot change any HTTP response.
 */

import * as fs from 'node:fs/promises';
import * as fsSync from 'node:fs';
import * as path from 'node:path';
import * as toml from 'smol-toml';

/** Canonical roles mirrored by the Python schema and the config catalogue. */
export const DEFAULT_ROLES = ['Reader', 'Contributor', 'KnowledgeEngineer', 'Admin'] as const;

export interface RbacAuthConfig {
  issuer: string;
  audience: string;
  jwksUrl: string;
  samlMetadataUrl: string;
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

export function defaultRbacConfig(): RbacConfig {
  return {
    enabled: false,
    roles: [...DEFAULT_ROLES],
    permissionsByRole: {},
    projectAcls: {},
    defaultAcl: [...DEFAULT_ROLES],
    auth: { issuer: '', audience: '', jwksUrl: '', samlMetadataUrl: '' },
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

export function normalizeRbacConfig(raw: unknown): RbacConfig {
  const config = defaultRbacConfig();
  const enterprise = asRecord(asRecord(raw).enterprise);

  config.enabled = enterprise.enable_rbac === true;

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
  for (const key of Object.keys(config.auth) as Array<keyof RbacAuthConfig>) {
    const value = auth[key];
    if (typeof value === 'string') config.auth[key] = value;
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
export async function loadRbacConfig(rootDir: string): Promise<RbacConfig> {
  for (const relative of ['config/config.toml', 'config.toml']) {
    try {
      const content = await fs.readFile(path.join(rootDir, relative), 'utf-8');
      return normalizeRbacConfig(toml.parse(content) as unknown);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') continue;
      throw err;
    }
  }
  return defaultRbacConfig();
}

/**
 * B3 — constructor-friendly variant used by `AgentServer` to install the
 * middleware before the first dispatch. An unreadable/malformed file falls
 * back to the legacy (disabled) catalogue so opt-in stays strictly opt-in:
 * an invalid file can never turn enforcement on by accident.
 */
export function loadRbacConfigSync(rootDir: string): RbacConfig {
  for (const relative of ['config/config.toml', 'config.toml']) {
    try {
      const content = fsSync.readFileSync(path.join(rootDir, relative), 'utf-8');
      return normalizeRbacConfig(toml.parse(content) as unknown);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') continue;
      return defaultRbacConfig();
    }
  }
  return defaultRbacConfig();
}
