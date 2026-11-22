import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import * as http from 'node:http';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { AgentServer } from '@backend/server/agentServer';

/**
 * B0 — pin the CURRENT auth behaviour before changing it.
 *
 * These assertions intentionally document known gaps (the graph proxy bypass
 * and the raw client-supplied reviewer). They will be updated by B4 and B5;
 * until then this file is the regression baseline, not a specification.
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
      assert.strictEqual((await spec.json() as any).openapi, '3.1.0');

      const docs = await fetch(`${h.baseUrl}/api/docs`);
      assert.strictEqual(docs.status, 200);
      assert.match(await docs.text(), /Wiki-Forge API/);
    });
  });

  it('KNOWN BYPASS (B4): the graph proxy is reached before the token check', async () => {
    await withEnv(
      { WIKIFORGE_API_TOKEN: 'secret-token', FASTAPI_SERVER_URL: 'http://127.0.0.1:9' },
      async () => {
        const res = await fetch(`${h.baseUrl}/api/v1/graph/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        // 502 (upstream unreachable) proves the proxy ran without a token;
        // after B4 this must become the same 401 envelope as every other route.
        assert.strictEqual(res.status, 502);
        const data = await res.json() as any;
        assert.strictEqual(data.success, false);
        assert.match(data.error, /FastAPI Knowledge Graph Service unavailable/);
      },
    );
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
