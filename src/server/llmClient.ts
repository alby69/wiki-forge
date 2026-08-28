import * as fs from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { WikiNote } from '../core/types/wiki';

export interface LlmConfig {
  provider: 'opencode' | 'anthropic' | 'openai_compatible' | 'ollama' | string;
  opencode_command?: string;
  opencode_args?: string[];
  api_base_url?: string;
  api_key_env?: string;
  model?: string;
  max_tokens?: number;
  timeout_seconds?: number;
}

export interface LlmCompletionParams {
  systemPrompt: string;
  userMessage: string;
  contextNotes?: WikiNote[];
}

export interface LlmClient {
  complete(params: LlmCompletionParams): Promise<string>;
}

export class OpenCodeCliClient implements LlmClient {
  private config: LlmConfig;

  constructor(config: LlmConfig) {
    this.config = config;
  }

  public complete(params: LlmCompletionParams): Promise<string> {
    return new Promise((resolve, reject) => {
      const command = this.config.opencode_command || 'opencode';
      const extraArgs = this.config.opencode_args || ['run', '--non-interactive'];
      const timeoutMs = (this.config.timeout_seconds || 60) * 1000;

      const promptText = buildFullPromptText(params);

      let child: ReturnType<typeof spawn>;
      try {
        child = spawn(command, extraArgs, {
          env: { ...process.env },
          stdio: ['pipe', 'pipe', 'pipe'],
        });
      } catch (err) {
        return reject(
          new Error(
            `OpenCode CLI not found or failed to spawn (${command}): ${String(err)}. Please install OpenCode CLI or change provider in config.toml.`
          )
        );
      }

      let stdout = '';
      let stderr = '';

      const timer = setTimeout(() => {
        child.kill('SIGTERM');
        reject(new Error(`OpenCode CLI process timed out after ${this.config.timeout_seconds || 60} seconds.`));
      }, timeoutMs);

      child.stdout?.on('data', chunk => {
        stdout += chunk.toString();
      });

      child.stderr?.on('data', chunk => {
        stderr += chunk.toString();
      });

      child.on('error', err => {
        clearTimeout(timer);
        reject(
          new Error(
            `OpenCode CLI error: ${err.message}. Ensure '${command}' is installed and available in PATH or configure provider in config.toml.`
          )
        );
      });

      child.on('close', code => {
        clearTimeout(timer);
        if (code === 0) {
          resolve(stdout.trim() || 'No output produced by OpenCode CLI.');
        } else {
          reject(
            new Error(
              `OpenCode CLI exited with code ${code}. ${stderr ? `Error details: ${stderr.trim()}` : ''}`
            )
          );
        }
      });

      if (child.stdin) {
        child.stdin.write(promptText);
        child.stdin.end();
      }
    });
  }
}

export class HttpLlmClient implements LlmClient {
  private config: LlmConfig;

  constructor(config: LlmConfig) {
    this.config = config;
  }

  public async complete(params: LlmCompletionParams): Promise<string> {
    const apiKeyEnvName = this.config.api_key_env || 'WIKIFORGE_LLM_API_KEY';
    const apiKey = process.env[apiKeyEnvName];

    if (!apiKey) {
      throw new Error(
        `API key environment variable '${apiKeyEnvName}' is not set. Please set export ${apiKeyEnvName}="your-key" in environment.`
      );
    }

    const isAnthropic = this.config.provider === 'anthropic';
    const model = this.config.model || (isAnthropic ? 'claude-3-5-sonnet-20241022' : 'gpt-4o');
    const maxTokens = this.config.max_tokens || 4096;
    const timeoutMs = (this.config.timeout_seconds || 60) * 1000;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      if (isAnthropic) {
        const url = this.config.api_base_url || 'https://api.anthropic.com/v1/messages';
        const userContent = buildUserContentWithContext(params.userMessage, params.contextNotes);

        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model,
            max_tokens: maxTokens,
            system: params.systemPrompt,
            messages: [{ role: 'user', content: userContent }],
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Anthropic API request failed with status ${res.status}: ${errText}`);
        }

        const data = (await res.json()) as { content?: Array<{ type: string; text: string }> };
        const textBlock = data.content?.find(c => c.type === 'text');
        return textBlock?.text ?? 'No text response from Anthropic API.';
      } else {
        // OpenAI compatible API
        const baseUrl = this.config.api_base_url || 'https://api.openai.com/v1';
        const url = baseUrl.endsWith('/chat/completions') ? baseUrl : `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
        const userContent = buildUserContentWithContext(params.userMessage, params.contextNotes);

        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            max_tokens: maxTokens,
            messages: [
              { role: 'system', content: params.systemPrompt },
              { role: 'user', content: userContent },
            ],
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`OpenAI compatible API request failed with status ${res.status}: ${errText}`);
        }

        const data = (await res.json()) as { choices?: Array<{ message?: { content: string } }> };
        return data.choices?.[0]?.message?.content ?? 'No response content from OpenAI compatible API.';
      }
    } finally {
      clearTimeout(timer);
    }
  }
}

export class OllamaClient implements LlmClient {
  private config: LlmConfig;

  constructor(config: LlmConfig) {
    this.config = config;
  }

  public async complete(params: LlmCompletionParams): Promise<string> {
    const baseUrl = this.config.api_base_url || 'http://localhost:11434';
    const url = baseUrl.endsWith('/api/chat') ? baseUrl : `${baseUrl.replace(/\/+$/, '')}/api/chat`;
    const model = this.config.model || 'llama3';
    const timeoutMs = (this.config.timeout_seconds || 60) * 1000;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const userContent = buildUserContentWithContext(params.userMessage, params.contextNotes);
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          stream: false,
          messages: [
            { role: 'system', content: params.systemPrompt },
            { role: 'user', content: userContent },
          ],
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Ollama API request failed with status ${res.status}: ${errText}`);
      }

      const data = (await res.json()) as { message?: { content: string } };
      return data.message?.content ?? 'No content returned from Ollama.';
    } finally {
      clearTimeout(timer);
    }
  }
}

function buildUserContentWithContext(userMessage: string, contextNotes?: WikiNote[]): string {
  if (!contextNotes || contextNotes.length === 0) {
    return userMessage;
  }

  const contextText = contextNotes
    .map(n => `--- Note: ${n.title} (ID: [[${n.id}]], Folder: ${n.folder}) ---\n${n.content}`)
    .join('\n\n');

  return `Context notes from Wiki Knowledge Base:\n\n${contextText}\n\nUser Question / Task:\n${userMessage}`;
}

function buildFullPromptText(params: LlmCompletionParams): string {
  const userWithContext = buildUserContentWithContext(params.userMessage, params.contextNotes);
  return `=== SYSTEM INSTRUCTIONS ===\n${params.systemPrompt}\n\n=== USER INPUT ===\n${userWithContext}`;
}

/**
 * Minimal TOML parser helper for `config.toml` sections
 */
export function parseConfigToml(tomlContent: string): { agentLlmConfig: LlmConfig; projectContext: string; projectTitle: string } {
  let provider = 'opencode';
  let opencodeCommand = 'opencode';
  let opencodeArgs = ['run', '--non-interactive'];
  let apiBaseUrl = '';
  let apiKeyEnv = 'WIKIFORGE_LLM_API_KEY';
  let model = 'claude-sonnet-4-6';
  let maxTokens = 4096;
  let timeoutSeconds = 60;
  let projectContext = '';
  let projectTitle = '';

  const lines = tomlContent.split(/\r?\n/);
  let currentSection = '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      currentSection = trimmed.slice(1, -1).trim();
      continue;
    }

    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    let rawVal = trimmed.slice(eqIndex + 1).trim();

    if (rawVal.includes('#')) {
      const commentIdx = rawVal.indexOf('#');
      const quoteCountBefore = (rawVal.slice(0, commentIdx).match(/"/g) || []).length;
      if (quoteCountBefore % 2 === 0) {
        rawVal = rawVal.slice(0, commentIdx).trim();
      }
    }

    const parseStringVal = (v: string): string => {
      if (v.startsWith('"') && v.endsWith('"')) {
        return v.slice(1, -1);
      }
      if (v.startsWith("'") && v.endsWith("'")) {
        return v.slice(1, -1);
      }
      return v;
    };

    if (currentSection === 'project') {
      if (key === 'context') projectContext = parseStringVal(rawVal);
      if (key === 'title') projectTitle = parseStringVal(rawVal);
    } else if (currentSection === 'agent.llm') {
      if (key === 'provider') provider = parseStringVal(rawVal);
      if (key === 'opencode_command') opencodeCommand = parseStringVal(rawVal);
      if (key === 'api_base_url') apiBaseUrl = parseStringVal(rawVal);
      if (key === 'api_key_env') apiKeyEnv = parseStringVal(rawVal);
      if (key === 'model') model = parseStringVal(rawVal);
      if (key === 'max_tokens') maxTokens = parseInt(rawVal, 10) || 4096;
      if (key === 'timeout_seconds') timeoutSeconds = parseInt(rawVal, 10) || 60;
      if (key === 'opencode_args') {
        try {
          opencodeArgs = JSON.parse(rawVal);
        } catch (_e) {
          // ignore
        }
      }
    }
  }

  return {
    agentLlmConfig: {
      provider,
      opencode_command: opencodeCommand,
      opencode_args: opencodeArgs,
      api_base_url: apiBaseUrl,
      api_key_env: apiKeyEnv,
      model,
      max_tokens: maxTokens,
      timeout_seconds: timeoutSeconds,
    },
    projectContext,
    projectTitle,
  };
}

export class LlmClientFactory {
  public static createClient(config: LlmConfig): LlmClient {
    switch (config.provider) {
      case 'anthropic':
      case 'openai_compatible':
        return new HttpLlmClient(config);
      case 'ollama':
        return new OllamaClient(config);
      case 'opencode':
      default:
        return new OpenCodeCliClient(config);
    }
  }

  public static async createFromTomlFile(configPath: string): Promise<{ client: LlmClient; projectContext: string; projectTitle: string }> {
    try {
      const content = await fs.readFile(configPath, 'utf-8');
      const { agentLlmConfig, projectContext, projectTitle } = parseConfigToml(content);
      return {
        client: LlmClientFactory.createClient(agentLlmConfig),
        projectContext,
        projectTitle,
      };
    } catch (_err) {
      const defaultConfig: LlmConfig = {
        provider: 'opencode',
        opencode_command: 'opencode',
        opencode_args: ['run', '--non-interactive'],
      };
      return {
        client: LlmClientFactory.createClient(defaultConfig),
        projectContext: '',
        projectTitle: '',
      };
    }
  }
}
