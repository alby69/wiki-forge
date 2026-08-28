import test from 'node:test';
import assert from 'node:assert/strict';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { AgentServer } from '../src/server/agentServer';
import { LlmClient, LlmCompletionParams, LlmClientFactory, parseConfigToml } from '../src/server/llmClient';

class MockLlmClient implements LlmClient {
  public lastParams?: LlmCompletionParams;
  public mockResponse: string;

  constructor(mockResponse: string = 'Synthesized answer from Mock LLM') {
    this.mockResponse = mockResponse;
  }

  public async complete(params: LlmCompletionParams): Promise<string> {
    this.lastParams = params;
    return this.mockResponse;
  }
}

test('LLM Client & AgentServer Multi-Provider Integration Test Suite', async t => {
  const tmpDir = path.join(process.cwd(), 'tests', 'tmp-llm-' + Date.now());
  const wikiDir = path.join(tmpDir, 'wiki');

  await fs.mkdir(wikiDir, { recursive: true });
  await fs.writeFile(
    path.join(wikiDir, 'graeber-debt.md'),
    `---
title: Graeber on Debt
tags: [anthropology, economics]
---
# Graeber on Debt

David Graeber criticizes the myth of barter in modern economics.
`,
    'utf-8'
  );

  const mockClient = new MockLlmClient('### 💡 Synthesized Graeber Answer\n\nGraeber shows that debt and credit preceded barter in historical societies.');
  const agentServer = new AgentServer(tmpDir, mockClient);

  t.after(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  await t.test('parseConfigToml parses agent.llm section correctly', () => {
    const sampleToml = `
[project]
title = "Test KB"
context = "Test context"

[agent.llm]
provider = "anthropic"
api_key_env = "CUSTOM_API_KEY"
model = "claude-3-5-sonnet"
max_tokens = 2048
timeout_seconds = 30
`;
    const parsed = parseConfigToml(sampleToml);
    assert.equal(parsed.projectTitle, 'Test KB');
    assert.equal(parsed.projectContext, 'Test context');
    assert.equal(parsed.agentLlmConfig.provider, 'anthropic');
    assert.equal(parsed.agentLlmConfig.api_key_env, 'CUSTOM_API_KEY');
    assert.equal(parsed.agentLlmConfig.model, 'claude-3-5-sonnet');
    assert.equal(parsed.agentLlmConfig.max_tokens, 2048);
    assert.equal(parsed.agentLlmConfig.timeout_seconds, 30);
  });

  await t.test('AgentServer routes user query through LlmClient and includes context notes', async () => {
    const response = await agentServer.processChatCommand({
      message: 'What is Graeber theory on debt?',
    });

    assert.ok(response.includes('Synthesized Graeber Answer'));
    assert.ok(mockClient.lastParams);
    assert.equal(mockClient.lastParams.userMessage, 'What is Graeber theory on debt?');
    assert.ok((mockClient.lastParams.contextNotes?.length ?? 0) > 0);
    assert.equal(mockClient.lastParams.contextNotes?.[0].id, 'graeber-debt');
  });

  await t.test('LlmClientFactory creates client based on provider type', () => {
    const anthropicClient = LlmClientFactory.createClient({ provider: 'anthropic' });
    assert.ok(anthropicClient);

    const ollamaClient = LlmClientFactory.createClient({ provider: 'ollama' });
    assert.ok(ollamaClient);

    const opencodeClient = LlmClientFactory.createClient({ provider: 'opencode' });
    assert.ok(opencodeClient);
  });
});
