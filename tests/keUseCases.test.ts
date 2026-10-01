import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import * as http from 'node:http';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { AgentServer, KE_USE_CASES } from '../src/server/agentServer';

describe('Knowledge Engineer Use Cases Test Suite', () => {
  let server: http.Server;
  let agentServer: AgentServer;
  let baseUrl: string;

  before(async () => {
    const tmpDir = await fs.mkdtemp(path.join(process.cwd(), 'tmp-ke-test-'));
    await fs.mkdir(path.join(tmpDir, 'wiki'), { recursive: true });
    await fs.mkdir(path.join(tmpDir, 'raw'), { recursive: true });
    await fs.mkdir(path.join(tmpDir, 'output'), { recursive: true });

    agentServer = new AgentServer(tmpDir);

    server = http.createServer(async (req, res) => {
      const handled = await agentServer.handleRequest(req, res);
      if (!handled) {
        res.writeHead(404);
        res.end();
      }
    });

    await new Promise<void>(resolve => {
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address() as { port: number };
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise<void>(resolve => server.close(() => resolve()));
  });

  it('GET /api/ke/use-cases returns all 6 registered KE Use Cases', async () => {
    const res = await fetch(`${baseUrl}/api/ke/use-cases`);
    assert.strictEqual(res.status, 200);

    const data = (await res.json()) as { success: boolean; useCases: any[] };
    assert.strictEqual(data.success, true);
    assert.ok(Array.isArray(data.useCases));
    assert.strictEqual(data.useCases.length, 6);

    const ids = data.useCases.map(u => u.id);
    assert.ok(ids.includes('ke_schema_modeling'));
    assert.ok(ids.includes('ke_ontological_validation'));
    assert.ok(ids.includes('ke_cq_assessment'));
    assert.ok(ids.includes('ke_neuro_symbolic'));
    assert.ok(ids.includes('ke_semantic_export'));
    assert.ok(ids.includes('ke_maturity_eval'));
  });

  it('POST /api/ke/use-cases/execute rejects unknown Use Case IDs with 400', async () => {
    const res = await fetch(`${baseUrl}/api/ke/use-cases/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ useCaseId: 'non_existent_uc' }),
    });

    assert.strictEqual(res.status, 400);
    const data = (await res.json()) as { success: boolean; error: string };
    assert.strictEqual(data.success, false);
    assert.ok(data.error.includes('Invalid or unregistered'));
  });

  it('POST /api/ke/use-cases/execute streams SSE events for ke_schema_modeling', async () => {
    const res = await fetch(`${baseUrl}/api/ke/use-cases/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ useCaseId: 'ke_schema_modeling', stepIndex: 0 }),
    });

    assert.strictEqual(res.status, 200);
    assert.ok(res.headers.get('content-type')?.includes('text/event-stream'));

    const text = await res.text();
    assert.ok(text.includes('data:'));
    assert.ok(text.includes('ke_schema_modeling') || text.includes('Schema'));
    assert.ok(text.includes('[DONE]'));
  });
});
