import { describe, it } from 'node:test';
import assert from 'node:assert';
import * as http from 'node:http';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { AgentServer } from '@backend/server/agentServer';
import {
  DEFAULT_ROLES,
  defaultRbacConfig,
  loadRbacConfig,
  normalizeRbacConfig,
  rolesForProject,
} from '@backend/server/auth/rbacConfig';

/**
 * B2 — the RBAC catalogue is declarative and readable.
 *
 * B3 installs the opt-in bus gate; these tests keep pinning the config shape.
 * With the full default ACL the gate is permissive, so the HTTP responses
 * asserted here are unchanged. Actual denial/membership cases live in
 * `tests/rbacMiddleware.test.ts`.
 */

const REPO_ROOT = process.cwd();
const UNAUTHORIZED = {
  success: false,
  error: 'Unauthorized: Invalid or missing X-WikiForge-Token',
};

async function withEnv(
  values: Partial<Record<'WIKIFORGE_API_TOKEN', string | undefined>>,
  fn: () => Promise<void>,
): Promise<void> {
  const key = 'WIKIFORGE_API_TOKEN' as const;
  const previous = process.env[key];
  const value = values[key];
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
  try {
    await fn();
  } finally {
    if (previous === undefined) delete process.env[key];
    else process.env[key] = previous;
  }
}

async function withHarness(
  configToml: string,
  fn: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const tmpDir = await fs.mkdtemp(path.join(process.cwd(), 'tmp-rbac-config-'));
  await fs.mkdir(path.join(tmpDir, 'config'), { recursive: true });
  await fs.mkdir(path.join(tmpDir, 'wiki'), { recursive: true });
  await fs.mkdir(path.join(tmpDir, 'raw'), { recursive: true });
  await fs.mkdir(path.join(tmpDir, 'output'), { recursive: true });
  await fs.writeFile(path.join(tmpDir, 'config', 'config.toml'), configToml, 'utf-8');

  const agentServer = new AgentServer(tmpDir);
  const server = http.createServer(async (req, res) => {
    const handled = await agentServer.handleRequest(req, res);
    if (!handled) {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address() as { port: number };
  try {
    await fn(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}

describe('Config RBAC dichiarativa e inerte (B2)', () => {
  it('loads the four canonical roles from the repository config', async () => {
    const config = await loadRbacConfig(REPO_ROOT);
    assert.strictEqual(config.enabled, false);
    assert.deepStrictEqual(config.roles, [...DEFAULT_ROLES]);
    assert.deepStrictEqual(config.defaultAcl, [...DEFAULT_ROLES]);
    assert.deepStrictEqual(config.permissionsByRole.Reader, ['wiki.read', 'export.read']);
    assert.deepStrictEqual(config.permissionsByRole.Admin, ['project.write', 'approval.decide', 'config.write']);
    assert.deepStrictEqual(config.auth, {
      issuer: '', audience: '', jwksUrl: '', samlMetadataUrl: '',
      provider: '', clientId: '', authorizationUrl: '', tokenUrl: '',
      actorClaim: '', rolesClaim: '', roleMap: {},
    });
  });

  it('loads the same catalogue from both project configs', async () => {
    for (const name of ['tesi', 'wikiforge']) {
      const config = await loadRbacConfig(path.join(REPO_ROOT, 'projects', name));
      assert.strictEqual(config.enabled, false);
      assert.deepStrictEqual(config.roles, [...DEFAULT_ROLES]);
      assert.deepStrictEqual(rolesForProject(config, name), [...DEFAULT_ROLES]);
    }
  });

  it('falls back to defaults when no config.toml exists', async () => {
    const tmpDir = await fs.mkdtemp(path.join(process.cwd(), 'tmp-rbac-empty-'));
    try {
      const config = await loadRbacConfig(tmpDir);
      assert.deepStrictEqual(config, defaultRbacConfig());
      assert.deepStrictEqual(rolesForProject(config, 'unknown-project'), [...DEFAULT_ROLES]);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('prefers config/config.toml over a root config.toml', async () => {
    const tmpDir = await fs.mkdtemp(path.join(process.cwd(), 'tmp-rbac-order-'));
    try {
      await fs.mkdir(path.join(tmpDir, 'config'), { recursive: true });
      await fs.writeFile(path.join(tmpDir, 'config.toml'), '[enterprise]\nenable_rbac = true\n', 'utf-8');
      await fs.writeFile(path.join(tmpDir, 'config', 'config.toml'), '[enterprise]\nenable_rbac = false\n', 'utf-8');
      assert.strictEqual((await loadRbacConfig(tmpDir)).enabled, false);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('normalises custom roles, ACLs and IdP placeholders without enforcing them', () => {
    const config = normalizeRbacConfig({
      enterprise: {
        enable_rbac: true,
        auth: { issuer: 'https://idp.example.com', audience: 'wiki-forge', jwksUrl: '', samlMetadataUrl: '' },
        roles: { Reader: ['wiki.read'], Auditor: ['audit.read'] },
        projectAcls: { default: ['Reader'], tesi: ['Reader', 'Auditor'] },
      },
    });
    assert.strictEqual(config.enabled, true);
    assert.deepStrictEqual(config.roles, [...DEFAULT_ROLES, 'Auditor']);
    assert.deepStrictEqual(rolesForProject(config, 'tesi'), ['Reader', 'Auditor']);
    assert.deepStrictEqual(rolesForProject(config, 'unknown'), ['Reader']);
    assert.strictEqual(config.auth.issuer, 'https://idp.example.com');
    assert.strictEqual(config.auth.audience, 'wiki-forge');
  });

  it('enable_rbac=true with the full default ACL keeps 200/401/docs unchanged', async () => {
    // B3 made the flag effective; the default ACL grants all four roles, so
    // these responses are still byte-identical. Restricted ACLs are covered in
    // tests/rbacMiddleware.test.ts (403 + membership filters).
    const configToml = '[enterprise]\nenable_rbac = true\n';
    await withEnv({ WIKIFORGE_API_TOKEN: undefined }, async () => {
      await withHarness(configToml, async (baseUrl) => {
        const res = await fetch(`${baseUrl}/api/help`);
        assert.strictEqual(res.status, 200);
        assert.strictEqual((await res.json() as any).success, true);
      });
    });
    await withEnv({ WIKIFORGE_API_TOKEN: 'secret-token' }, async () => {
      await withHarness(configToml, async (baseUrl) => {
        const missing = await fetch(`${baseUrl}/api/help`);
        assert.strictEqual(missing.status, 401);
        assert.deepStrictEqual(await missing.json(), UNAUTHORIZED);

        const docs = await fetch(`${baseUrl}/api/docs`);
        assert.strictEqual(docs.status, 200);

        const valid = await fetch(`${baseUrl}/api/help`, {
          headers: { 'X-WikiForge-Token': 'secret-token' },
        });
        assert.strictEqual(valid.status, 200);
      });
    });
  });
});
