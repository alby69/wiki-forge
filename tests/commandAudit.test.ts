import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { json } from '@backend/server/api/http';
import { createMessageBus } from '@backend/server/bus/messageBus';
import { installCommandAudit } from '@backend/server/observability/commandAudit';
import { createLogger } from '@backend/server/observability/logger';

describe('Central command audit', () => {
  it('logs handled and failed commands with actor and correlation, never payloads', async () => {
    const lines: string[] = [];
    const bus = createMessageBus();
    const uninstall = installCommandAudit(bus, createLogger('command-audit', {
      env: { WIKIFORGE_LOG_LEVEL: 'debug' },
      sink: (line) => { lines.push(line); },
    }));
    bus.register('audit.ok', () => json({ ok: true }));
    bus.register('audit.fail', () => { throw new Error('boom'); });
    const context = {
      correlationId: 'corr-123',
      principal: { actor: 'human:alice', roles: [], source: 'local' as const },
    };

    await bus.dispatch('audit.ok', { secret: 'do-not-log' }, context);
    await bus.dispatch('audit.fail', { secret: 'also-secret' }, context);

    assert.equal(lines.length, 2);
    const records = lines.map((line) => JSON.parse(line) as Record<string, unknown>);
    assert.equal(records[0].command, 'audit.ok');
    assert.equal(records[0].status, 'handled');
    assert.equal(records[0].correlationId, 'corr-123');
    assert.equal(records[0].actor, 'human:alice');
    assert.equal(records[1].command, 'audit.fail');
    assert.equal(records[1].status, 'failed');
    assert.equal(records[1].correlationId, 'corr-123');
    assert.equal(records[1].actor, 'human:alice');
    assert.match(String(records[1].error), /boom/);
    for (const line of lines) assert.doesNotMatch(line, /do-not-log|also-secret/);

    uninstall();
    lines.length = 0;
    await bus.dispatch('audit.ok', {}, context);
    assert.equal(lines.length, 0);
  });
});
