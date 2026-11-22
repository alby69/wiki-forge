import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import * as http from 'node:http';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { AgentServer } from '@backend/server/agentServer';
import { json } from '@backend/server/api/http';
import { createMessageBus, type CommandContext } from '@backend/server/bus/messageBus';
import {
  deriveRequestPrincipal,
  legacyPrincipal,
  LEGACY_PRINCIPAL_ACTOR,
} from '@backend/server/auth/principal';

/**
 * B1 — server-derived Principal (additive, enforcement-free).
 *
 * Legacy mode has a single shared API token, so the only honest identity is a
 * process actor. These tests pin that the HTTP adapter derives it from the
 * verified transport and never from body fields or client-supplied headers.
 */

const EXPECTED_LEGACY = {
  actor: LEGACY_PRINCIPAL_ACTOR,
  roles: [],
  source: 'legacy-token',
};

interface Harness {
  agentServer: AgentServer;
  baseUrl: string;
  close: () => Promise<void>;
}

interface Captured {
  command: string;
  payload: unknown;
  context: CommandContext;
}

async function createHarness(): Promise<Harness> {
  const tmpDir = await fs.mkdtemp(path.join(process.cwd(), 'tmp-principal-'));
  await fs.mkdir(path.join(tmpDir, 'wiki'), { recursive: true });
  await fs.mkdir(path.join(tmpDir, 'raw'), { recursive: true });
  await fs.mkdir(path.join(tmpDir, 'output'), { recursive: true });

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

  return {
    agentServer,
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await fs.rm(tmpDir, { recursive: true, force: true });
    },
  };
}

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

describe('Principal derivato dal server (B1)', () => {
  let h: Harness;
  const captured: Captured[] = [];

  before(async () => {
    h = await createHarness();
    h.agentServer.getBus().use((command, payload, context) => {
      captured.push({ command, payload, context });
      return undefined; // observation only: never short-circuit the real handler
    });
  });

  after(async () => {
    await h.close();
  });

  it('legacyPrincipal() has the canonical process actor and no roles', () => {
    assert.deepStrictEqual(legacyPrincipal(), EXPECTED_LEGACY);
  });

  it('deriveRequestPrincipal() ignores client identity headers and env', () => {
    const principal = deriveRequestPrincipal(
      {
        headers: {
          'x-principal-actor': 'human:mario',
          'x-wikiforge-token': 'secret-token',
          authorization: 'Bearer secret-token',
          'x-user': 'admin',
        },
      },
      { WIKIFORGE_API_TOKEN: 'secret-token' },
    );
    assert.deepStrictEqual(principal, EXPECTED_LEGACY);
  });

  it('populates context.principal on a normal HTTP dispatch', async () => {
    captured.length = 0;
    await withEnv({ WIKIFORGE_API_TOKEN: undefined }, async () => {
      const res = await fetch(`${h.baseUrl}/api/help`);
      assert.strictEqual(res.status, 200);
    });
    const entry = captured.find((c) => c.command === 'help.list');
    assert.ok(entry, 'help.list should have been dispatched through the bus');
    assert.deepStrictEqual(entry.context.principal, EXPECTED_LEGACY);
    assert.strictEqual(entry.context.operationId, 'help.list');
    assert.ok(entry.context.correlationId);
  });

  it('body fields reviewer/user/actor/principal cannot overwrite the principal', async () => {
    captured.length = 0;
    await withEnv({ WIKIFORGE_API_TOKEN: 'secret-token' }, async () => {
      const res = await fetch(`${h.baseUrl}/api/ke/schedule/trigger`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-WikiForge-Token': 'secret-token',
          'X-Principal-Actor': 'human:mario',
        },
        body: JSON.stringify({
          event: 'note.created',
          project: 'default',
          reviewer: 'mario',
          user: 'admin',
          actor: 'human:spoofed',
          principal: { actor: 'human:spoofed', roles: ['Admin'], source: 'idp' },
        }),
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual((await res.json() as any).success, true);
    });

    const entry = captured.find((c) => c.command === 'schedule.trigger');
    assert.ok(entry, 'schedule.trigger should have been dispatched through the bus');
    assert.deepStrictEqual(entry.context.principal, EXPECTED_LEGACY);
    // The spoofed `principal` is stripped; every other body field is still
    // passed through unchanged, so legacy handlers and envelopes are untouched.
    const payload = entry.payload as Record<string, unknown>;
    assert.ok(!('principal' in payload));
    assert.strictEqual(payload.reviewer, 'mario');
    assert.strictEqual(payload.user, 'admin');
    assert.strictEqual(payload.actor, 'human:spoofed');
  });

  it('uses a fresh principal object for every request', async () => {
    captured.length = 0;
    await fetch(`${h.baseUrl}/api/help`);
    await fetch(`${h.baseUrl}/api/help`);
    const entries = captured.filter((c) => c.command === 'help.list');
    assert.strictEqual(entries.length, 2);
    assert.deepStrictEqual(entries[0].context.principal, entries[1].context.principal);
    assert.notStrictEqual(entries[0].context.principal, entries[1].context.principal);
  });

  it('stays additive: non-HTTP callers dispatch with no principal', async () => {
    const bus = createMessageBus();
    let seen: CommandContext | undefined;
    bus.register('test.principal', (_payload, context) => {
      seen = context;
      return json({ success: true });
    });
    await bus.dispatch('test.principal', {});
    assert.ok(seen);
    assert.strictEqual(seen.principal, undefined);
  });
});
