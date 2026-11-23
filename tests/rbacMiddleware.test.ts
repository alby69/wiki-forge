import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import * as http from 'node:http';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { AgentServer } from '@backend/server/agentServer';
import { legacyPrincipal } from '@backend/server/auth/principal';
import type { CommandContext } from '@backend/server/bus/messageBus';
import {
  DEFAULT_ROLES,
  loadRbacConfigSync,
  normalizeRbacConfig,
  rolesForScope,
  type RbacConfig,
} from '@backend/server/auth/rbacConfig';
import {
  createRbacMiddleware,
  decideRbac,
  OPERATION_ROLES,
  requiredRoleFor,
  type RbacRole,
} from '@backend/server/auth/rbacMiddleware';
import { ApprovalStore, type ApprovalRequest } from '@backend/server/scheduler/approvalStore';

/**
 * B3 — opt-in RBAC gate on the message bus.
 *
 * Flag off: no decision on CommandContext, every legacy response unchanged.
 * Flag on: operation × project × folder → required role, 403 with the existing
 * envelope, and membership filters on projects/approvals listings.
 */

interface Harness {
  agentServer: AgentServer;
  baseUrl: string;
  tmpDir: string;
  close: () => Promise<void>;
}

interface HarnessOptions {
  configToml: string;
  projects?: Array<{ id: string; name: string }>;
  approvals?: ApprovalRequest[];
  capture?: Array<{ command: string; context: CommandContext }>;
}

const ALL_ROLES = [...DEFAULT_ROLES];

/** Minimal F6 job: `startScheduler()` creates the approval store only with a job. */
const SCHEDULE_TOML = `
[agent.policy]
enabled = false

[agent.scheduler]
enabled = true
timezone = "UTC"
max_concurrency = 1
default_timeout_seconds = 60
log_dir = "output/scheduler"

[[agent.scheduler.jobs]]
id = "rbac-approvals-probe"
role = "Semantic Publisher"
use_case = "ke_semantic_export"
steps = [1]
schedule = "0 3 1 * *"
enabled = true
project = "default"
auto_apply = false
max_retries = 0
`;

function principal(role: RbacRole) {
  return { actor: `human:${role.toLowerCase()}`, roles: [role], source: 'idp' as const };
}

function matrixConfig(): RbacConfig {
  return normalizeRbacConfig({
    enterprise: {
      enable_rbac: true,
      projectAcls: { default: ALL_ROLES },
    },
  });
}

async function createHarness(options: HarnessOptions): Promise<Harness> {
  const tmpDir = await fs.mkdtemp(path.join(process.cwd(), 'tmp-rbac-middleware-'));
  for (const dir of ['config', 'wiki', 'raw', 'output', '.wiki-forge']) {
    await fs.mkdir(path.join(tmpDir, dir), { recursive: true });
  }
  await fs.writeFile(path.join(tmpDir, 'config', 'config.toml'), options.configToml, 'utf-8');
  if (options.projects) {
    await fs.writeFile(
      path.join(tmpDir, 'config', 'projects.json'),
      JSON.stringify(options.projects.map((p) => ({ ...p, path: `projects/${p.id}` })), null, 2),
      'utf-8',
    );
  }
  if (options.approvals) {
    await fs.writeFile(
      path.join(tmpDir, '.wiki-forge', 'scheduler-approvals.json'),
      JSON.stringify(options.approvals, null, 2),
      'utf-8',
    );
    await fs.writeFile(path.join(tmpDir, 'config', 'agent_schedule.toml'), SCHEDULE_TOML, 'utf-8');
  }

  const agentServer = new AgentServer(tmpDir);
  if (options.capture) {
    agentServer.getBus().use((command, _payload, context) => {
      options.capture!.push({ command, context });
      return undefined;
    });
  }
  const server = http.createServer(async (req, res) => {
    const handled = await agentServer.handleRequest(req, res);
    if (!handled) {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address() as { port: number };
  let schedulerStarted = false;
  if (options.approvals) {
    await agentServer.startScheduler();
    schedulerStarted = true;
  }

  return {
    agentServer,
    baseUrl: `http://127.0.0.1:${address.port}`,
    tmpDir,
    close: async () => {
      if (schedulerStarted) await agentServer.stopScheduler();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await fs.rm(tmpDir, { recursive: true, force: true });
    },
  };
}

async function json(url: string, options?: RequestInit): Promise<{ status: number; body: any }> {
  const res = await fetch(url, options);
  return { status: res.status, body: await res.json() as any };
}

function approval(project: string, id: string): ApprovalRequest {
  return {
    id,
    jobId: `job-${project}`,
    useCaseId: 'ke_semantic_export',
    project,
    stepIndex: 1,
    trigger: 'manual',
    rationale: `Approvazione di prova ${project}`,
    sources: [],
    createdAt: `2026-11-22T10:00:0${id.slice(-1)}Z`,
    status: 'pending',
  };
}

describe('Gate RBAC opt-in via middleware del bus (B3)', () => {
  let previousToken: string | undefined;

  before(() => {
    previousToken = process.env.WIKIFORGE_API_TOKEN;
    delete process.env.WIKIFORGE_API_TOKEN;
  });

  after(() => {
    if (previousToken === undefined) delete process.env.WIKIFORGE_API_TOKEN;
    else process.env.WIKIFORGE_API_TOKEN = previousToken;
  });

  it('flag off: no decision is attached and legacy responses stay unchanged', async () => {
    const capture: Array<{ command: string; context: CommandContext }> = [];
    const h = await createHarness({
      configToml: `
[enterprise]
enable_rbac = false
[enterprise.projectAcls]
default = ["Reader", "Contributor", "KnowledgeEngineer", "Admin"]
wikiforge = ["Reader"]
`,
      capture,
    });
    try {
      const dispatch = await h.agentServer.getBus().dispatch(
        'rbac.probe.unknown',
        {},
        { projectId: 'wikiforge', principal: principal('Reader') },
      );
      if (dispatch.kind !== 'json') assert.fail('expected a JSON result');
      assert.strictEqual(dispatch.status, 404, 'no RBAC interception, only the missing handler');
      const seen = capture.find((entry) => entry.command === 'rbac.probe.unknown');
      assert.ok(seen);
      assert.strictEqual(seen.context.rbac, undefined);

      const write = await json(`${h.baseUrl}/api/ke/schedule/trigger?projectId=wikiforge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'note.created' }),
      });
      assert.strictEqual(write.status, 200);
      assert.strictEqual(write.body.success, true);
    } finally {
      await h.close();
    }
  });

  const matrix: Array<[RbacRole, string, boolean]> = [
    ['Reader', 'help.list', true],
    ['Reader', 'wiki.note.save', false],
    ['Reader', 'projects.create', false],
    ['Reader', 'schedule.approvalDecision', false],
    ['Contributor', 'help.list', true],
    ['Contributor', 'wiki.note.save', true],
    ['Contributor', 'ke.useCases.execute', false],
    ['Contributor', 'projects.create', false],
    ['KnowledgeEngineer', 'help.list', true],
    ['KnowledgeEngineer', 'wiki.note.save', true],
    ['KnowledgeEngineer', 'ke.useCases.execute', true],
    ['KnowledgeEngineer', 'schedule.approvalDecision', false],
    ['Admin', 'help.list', true],
    ['Admin', 'wiki.note.save', true],
    ['Admin', 'ke.useCases.execute', true],
    ['Admin', 'schedule.approvalDecision', true],
    ['Admin', 'projects.create', true],
  ];

  for (const [role, command, allowed] of matrix) {
    it(`${role} × ${command} → ${allowed ? 'allow' : 'deny'}`, () => {
      const decision = decideRbac(matrixConfig(), command, {}, {
        projectId: 'default',
        principal: principal(role),
      });
      assert.strictEqual(decision.allowed, allowed);
      assert.strictEqual(decision.requiredRole, requiredRoleFor(command));
      assert.deepStrictEqual(decision.roles, [role]);
    });
  }

  it('unknown commands fail closed as Admin', () => {
    assert.strictEqual(requiredRoleFor('brand.new.command'), 'Admin');
    const reader = decideRbac(matrixConfig(), 'brand.new.command', {}, {
      projectId: 'default',
      principal: principal('Reader'),
    });
    assert.strictEqual(reader.allowed, false);
    assert.strictEqual(reader.requiredRole, 'Admin');
    const admin = decideRbac(matrixConfig(), 'brand.new.command', {}, {
      projectId: 'default',
      principal: principal('Admin'),
    });
    assert.strictEqual(admin.allowed, true);
  });

  it('folder ACL narrows the effective roles for a project', () => {
    const config = normalizeRbacConfig({
      enterprise: {
        enable_rbac: true,
        projectAcls: {
          default: ALL_ROLES,
          wikiforge: ALL_ROLES,
          'wikiforge/wiki/processi': ['Admin'],
        },
      },
    });
    assert.deepStrictEqual(rolesForScope(config, 'wikiforge', 'wiki/processi/piano.md'), ['Admin']);
    assert.deepStrictEqual(rolesForScope(config, 'wikiforge', 'wiki/note/bozza.md'), ALL_ROLES);
    assert.deepStrictEqual(rolesForScope(config, 'tesi', 'wiki/processi/piano.md'), ALL_ROLES);

    const protectedNote = { note: 'wiki/processi/piano.md' };
    assert.strictEqual(
      decideRbac(config, 'wiki.note.save', protectedNote, {
        projectId: 'wikiforge', principal: principal('Contributor'),
      }).allowed,
      false,
    );
    assert.strictEqual(
      decideRbac(config, 'wiki.note.save', protectedNote, {
        projectId: 'wikiforge', principal: principal('Admin'),
      }).allowed,
      true,
    );
    assert.strictEqual(
      decideRbac(config, 'wiki.note.save', { note: 'wiki/note/bozza.md' }, {
        projectId: 'wikiforge', principal: principal('Contributor'),
      }).allowed,
      true,
    );
  });

  it('flag on: 403 uses the existing envelope and the decision is on the context', async () => {
    const capture: Array<{ command: string; context: CommandContext }> = [];
    const h = await createHarness({
      configToml: `
[enterprise]
enable_rbac = true
[enterprise.projectAcls]
default = ["Reader", "Contributor", "KnowledgeEngineer", "Admin"]
wikiforge = ["Reader"]
`,
      capture,
    });
    try {
      const denied = await json(`${h.baseUrl}/api/ke/schedule/trigger?projectId=wikiforge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'note.created' }),
      });
      assert.strictEqual(denied.status, 403);
      assert.deepStrictEqual(denied.body, {
        success: false,
        error: "Forbidden: 'schedule.trigger' requires the KnowledgeEngineer role in project 'wikiforge'",
      });

      const allowed = await json(`${h.baseUrl}/api/ke/schedule/trigger?projectId=default`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'note.created' }),
      });
      assert.strictEqual(allowed.status, 200);
      assert.strictEqual(allowed.body.success, true);

      // A denied dispatch short-circuits before later observers, so only the
      // allowed one is captured here.
      const seen = capture.filter((entry) => entry.command === 'schedule.trigger');
      assert.strictEqual(seen.length, 1);
      assert.strictEqual(seen[0].context.rbac?.requiredRole, 'KnowledgeEngineer');
      assert.strictEqual(seen[0].context.rbac?.allowed, true);

      // The denied decision itself is verifiable with the pure function.
      const deniedDecision = decideRbac(loadRbacConfigSync(h.tmpDir), 'schedule.trigger', {}, {
        projectId: 'wikiforge',
        principal: legacyPrincipal(),
      });
      assert.deepStrictEqual(deniedDecision.roles, ['Reader']);
      assert.strictEqual(deniedDecision.allowed, false);
    } finally {
      await h.close();
    }
  });

  const membershipToml = `
[enterprise]
enable_rbac = true
[enterprise.projectAcls]
default = ["Reader", "Contributor", "KnowledgeEngineer", "Admin"]
tesi = ["Reader"]
wikiforge = []
`;
  const registry = [
    { id: 'tesi', name: 'Tesi' },
    { id: 'wikiforge', name: 'WikiForge' },
  ];
  const approvals = [
    approval('default', 'appr-1'),
    approval('tesi', 'appr-2'),
    approval('wikiforge', 'appr-3'),
  ];

  it('projects.list hides projects outside the visible membership set', async () => {
    const h = await createHarness({ configToml: membershipToml, projects: registry, approvals });
    try {
      const listed = await json(`${h.baseUrl}/api/projects`);
      assert.strictEqual(listed.status, 200);
      assert.deepStrictEqual(listed.body.projects.map((p: any) => p.id), ['tesi']);
    } finally {
      await h.close();
    }
  });

  it('flag off keeps the full projects.list unchanged', async () => {
    const h = await createHarness({
      configToml: membershipToml.replace('enable_rbac = true', 'enable_rbac = false'),
      projects: registry,
    });
    try {
      const listed = await json(`${h.baseUrl}/api/projects`);
      assert.deepStrictEqual(listed.body.projects.map((p: any) => p.id), ['tesi', 'wikiforge']);
    } finally {
      await h.close();
    }
  });

  it('approvals are filtered per project and by visible membership', async () => {
    const h = await createHarness({ configToml: membershipToml, approvals });
    try {
      const all = await json(`${h.baseUrl}/api/ke/schedule/approvals`);
      assert.strictEqual(all.status, 200);
      assert.deepStrictEqual(all.body.approvals.map((a: any) => a.project).sort(), ['default', 'tesi']);

      const one = await json(`${h.baseUrl}/api/ke/schedule/approvals?project=tesi`);
      assert.deepStrictEqual(one.body.approvals.map((a: any) => a.id), ['appr-2']);

      const hidden = await json(`${h.baseUrl}/api/ke/schedule/approvals?project=wikiforge`);
      assert.deepStrictEqual(hidden.body.approvals, []);
    } finally {
      await h.close();
    }
  });

  it('ApprovalStore.list accepts the additive project filter', async () => {
    const tmpDir = await fs.mkdtemp(path.join(process.cwd(), 'tmp-approval-filter-'));
    try {
      const store = new ApprovalStore({ filePath: path.join(tmpDir, 'approvals.json') });
      for (const item of approvals) await store.stage(item);
      assert.strictEqual((await store.list()).length, 3);
      const tesi = await store.list({ project: 'tesi' });
      assert.strictEqual(tesi.length, 1);
      assert.strictEqual(tesi[0].project, 'tesi');
      assert.deepStrictEqual(await store.list({ project: 'unknown' }), []);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('every registered command has an explicit role mapping', async () => {
    const h = await createHarness({ configToml: '[enterprise]\nenable_rbac = false\n' });
    try {
      const missing = h.agentServer.getBus().commands().filter((command) => !(command in OPERATION_ROLES));
      assert.deepStrictEqual(missing, []);
    } finally {
      await h.close();
    }
  });

  it('createRbacMiddleware is a no-op when the catalogue is disabled', () => {
    const config = matrixConfig();
    config.enabled = false;
    const context: CommandContext = {
      rootDir: process.cwd(),
      projectId: 'wikiforge',
      correlationId: 'test',
      principal: principal('Reader'),
    };
    assert.strictEqual(createRbacMiddleware(config)('projects.create', {}, context), undefined);
    assert.strictEqual(context.rbac, undefined);
  });

  it('loadRbacConfigSync reads the same catalogue as the async loader', () => {
    const config = loadRbacConfigSync(process.cwd());
    assert.strictEqual(config.enabled, false);
    assert.deepStrictEqual(config.roles, ALL_ROLES);
    assert.deepStrictEqual(config.defaultAcl, ALL_ROLES);
  });
});
