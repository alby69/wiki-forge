import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import * as http from 'node:http';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { AgentServer } from '@backend/server/agentServer';

/**
 * Auth characterization — B0 baseline plus the B4 hardening.
 *
 * B0 pinned the envelope and the two then-known gaps. B4 closed the graph
 * proxy bypass; the raw client-supplied reviewer remains documented here and
 * will be fixed by B5.
 */

const UNAUTHORIZED = {
  success: false,
  error: 'Unauthorized: Invalid or missing X-WikiForge-Token',
};

interface Harness {
  agentServer: AgentServer;
  baseUrl: string;
  close: () => Promise<void>;
}

async function createHarness(): Promise<Harness> {
  const tmpDir = await fs.mkdtemp(path.join(process.cwd(), 'tmp-auth-char-'));
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
  values: Partial<Record<'WIKIFORGE_API_TOKEN' | 'FASTAPI_SERVER_URL', string | undefined>>,
  fn: () => Promise<void>,
): Promise<void> {
  const keys = Object.keys(values) as Array<keyof typeof values>;
  const previous = new Map<string, string | undefined>();
  for (const key of keys) {
    previous.set(key, process.env[key]);
    const value = values[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    await fn();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

describe('Auth characterization (B0)', () => {
  let h: Harness;

  before(async () => {
    h = await createHarness();
  });

  after(async () => {
    await h.close();
  });

  it('serves a catalogue endpoint with 200 when no token is configured', async () => {
    await withEnv({ WIKIFORGE_API_TOKEN: undefined }, async () => {
      const res = await fetch(`${h.baseUrl}/api/help`);
      assert.strictEqual(res.status, 200);
      const data = await res.json() as any;
      assert.strictEqual(data.success, true);
    });
  });

  it('returns 401 with the exact envelope when a token is configured and the header is missing', async () => {
    await withEnv({ WIKIFORGE_API_TOKEN: 'secret-token' }, async () => {
      const res = await fetch(`${h.baseUrl}/api/help`);
      assert.strictEqual(res.status, 401);
      assert.deepStrictEqual(await res.json(), UNAUTHORIZED);
    });
  });

  it('returns the same 401 envelope for a wrong token', async () => {
    await withEnv({ WIKIFORGE_API_TOKEN: 'secret-token' }, async () => {
      const res = await fetch(`${h.baseUrl}/api/help`, {
        headers: { 'X-WikiForge-Token': 'wrong-token' },
      });
      assert.strictEqual(res.status, 401);
      assert.deepStrictEqual(await res.json(), UNAUTHORIZED);
    });
  });

  it('accepts the valid token via X-WikiForge-Token', async () => {
    await withEnv({ WIKIFORGE_API_TOKEN: 'secret-token' }, async () => {
      const res = await fetch(`${h.baseUrl}/api/help`, {
        headers: { 'X-WikiForge-Token': 'secret-token' },
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual((await res.json() as any).success, true);
    });
  });

  it('accepts the valid token via Authorization: Bearer', async () => {
    await withEnv({ WIKIFORGE_API_TOKEN: 'secret-token' }, async () => {
      const res = await fetch(`${h.baseUrl}/api/help`, {
        headers: { Authorization: 'Bearer secret-token' },
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual((await res.json() as any).success, true);
    });
  });

  it('keeps /api/openapi.json and /api/docs public', async () => {
    await withEnv({ WIKIFORGE_API_TOKEN: 'secret-token' }, async () => {
      const spec = await fetch(`${h.baseUrl}/api/openapi.json`);
      assert.strictEqual(spec.status, 200);
      const specJson = await spec.json() as any;
      assert.strictEqual(specJson.openapi, '3.1.0');
      assert.match(specJson.info.description, /WIKIFORGE_API_TOKEN/);
      assert.doesNotMatch(specJson.info.description, /WIKIFORGE_TOKEN/);
      assert.match(specJson.components.securitySchemes.WikiForgeToken.description, /WIKIFORGE_API_TOKEN/);

      const docs = await fetch(`${h.baseUrl}/api/docs`);
      assert.strictEqual(docs.status, 200);
      assert.match(await docs.text(), /Wiki-Forge API/);
    });
  });

  it('B4: graph routes require the token with the exact B0 envelope', async () => {
    await withEnv(
      { WIKIFORGE_API_TOKEN: 'secret-token', FASTAPI_SERVER_URL: 'http://127.0.0.1:9' },
      async () => {
        for (const route of ['/api/v1/graph/sync', '/api/v1/graph/validate', '/api/v1/graph/rag']) {
          const missing = await fetch(`${h.baseUrl}${route}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
          });
          assert.strictEqual(missing.status, 401, `${route} without token`);
          assert.deepStrictEqual(await missing.json(), UNAUTHORIZED);

          const wrong = await fetch(`${h.baseUrl}${route}`, {
            method: 'GET',
            headers: { 'X-WikiForge-Token': 'wrong-token' },
          });
          assert.strictEqual(wrong.status, 401, `${route} with wrong token`);
          assert.deepStrictEqual(await wrong.json(), UNAUTHORIZED);
        }
      },
    );
  });

  it('B4: a valid token reaches the graph proxy (502 proves authentication passed)', async () => {
    await withEnv(
      { WIKIFORGE_API_TOKEN: 'secret-token', FASTAPI_SERVER_URL: 'http://127.0.0.1:9' },
      async () => {
        const res = await fetch(`${h.baseUrl}/api/v1/graph/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-WikiForge-Token': 'secret-token' },
          body: JSON.stringify({}),
        });
        assert.strictEqual(res.status, 502);
        const data = await res.json() as any;
        assert.strictEqual(data.success, false);
        assert.match(data.error, /FastAPI Knowledge Graph Service unavailable/);
      },
    );
  });

  it('B4: without a configured token the graph proxy stays reachable as before', async () => {
    await withEnv(
      { WIKIFORGE_API_TOKEN: undefined, FASTAPI_SERVER_URL: 'http://127.0.0.1:9' },
      async () => {
        const res = await fetch(`${h.baseUrl}/api/v1/graph/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        assert.strictEqual(res.status, 502);
        assert.match((await res.json() as any).error, /FastAPI Knowledge Graph Service unavailable/);
      },
    );
  });

  it('B4: graph CORS preflight is public even when a token is configured', async () => {
    await withEnv({ WIKIFORGE_API_TOKEN: 'secret-token' }, async () => {
      const res = await fetch(`${h.baseUrl}/api/v1/graph/sync`, { method: 'OPTIONS' });
      assert.strictEqual(res.status, 204);
      assert.strictEqual(res.headers.get('access-control-allow-origin'), '*');
      assert.match(res.headers.get('access-control-allow-headers') ?? '', /X-WikiForge-Token/);
    });
  });

  it('KNOWN PROVENANCE (B5): reviewer is taken raw from the client body, default human', async () => {
    const calls: Array<{ decision: string; reviewer?: string }> = [];
    const original = h.agentServer.decideApproval.bind(h.agentServer);
    h.agentServer.decideApproval = async (approvalId, decision, reviewer) => {
      calls.push({ decision, reviewer });
      return {
        approval: {
          id: approvalId,
          status: decision === 'approved' ? 'approved' : 'rejected',
          decidedBy: reviewer,
        } as any,
      };
    };
    try {
      const explicit = await fetch(`${h.baseUrl}/api/ke/schedule/approvals/a-1/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewer: 'mario' }),
      });
      assert.strictEqual(explicit.status, 200);
      assert.strictEqual(((await explicit.json()) as any).approval.decidedBy, 'mario');

      const implicit = await fetch(`${h.baseUrl}/api/ke/schedule/approvals/a-2/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      assert.strictEqual(implicit.status, 200);
      assert.strictEqual(((await implicit.json()) as any).approval.decidedBy, 'human');

      assert.deepStrictEqual(calls, [
        { decision: 'approved', reviewer: 'mario' },
        { decision: 'approved', reviewer: 'human' },
      ]);
    } finally {
      h.agentServer.decideApproval = original;
    }
  });
});
