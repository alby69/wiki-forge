import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { StringDecoder } from 'node:string_decoder';

export const DEFAULT_SUBPROCESS_TIMEOUT_MS = 900_000;
export const DEFAULT_MAX_OUTPUT_BYTES = 1024 * 1024;

export const DEFAULT_ENV_ALLOWLIST = [
  'PATH',
  'HOME',
  'USER',
  'SHELL',
  'TMPDIR',
  'TEMP',
  'TMP',
  'LANG',
  'LC_ALL',
  'LC_CTYPE',
  'PYTHONPATH',
  'PYTHONUNBUFFERED',
  'PYTHONIOENCODING',
  'VIRTUAL_ENV',
  'NODE_ENV',
  'OPENCODE_BIN',
  'WIKIFORGE_*',
  'WIKI_FORGE_*',
  'NEO4J_*',
] as const;

export interface ScriptRunOptions {
  command: string;
  args: readonly string[];
  cwd?: string;
  extraEnv?: NodeJS.ProcessEnv;
  envAllowlist?: readonly string[];
  timeoutMs?: number;
  maxOutputBytes?: number;
  stdin?: string;
  signal?: AbortSignal;
  onStdout?: (chunk: string) => void;
  onStderr?: (chunk: string) => void;
}

export interface ScriptRunResult {
  code: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  truncated: boolean;
  signal?: NodeJS.Signals | null;
  error?: Error;
}

export interface ManagedProcess {
  readonly child: ChildProcessWithoutNullStreams;
  readonly done: Promise<ScriptRunResult>;
  cancel(): void;
}

function isEnvAllowed(key: string, allowlist: readonly string[]): boolean {
  return allowlist.some((entry) =>
    entry.endsWith('*') ? key.startsWith(entry.slice(0, -1)) : key === entry,
  );
}

export function buildAllowedEnv(
  allowlist: readonly string[] = DEFAULT_ENV_ALLOWLIST,
  extraEnv: NodeJS.ProcessEnv = {},
  source: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(source)) {
    if (value !== undefined && isEnvAllowed(key, allowlist)) env[key] = value;
  }
  for (const [key, value] of Object.entries(extraEnv)) {
    if (value !== undefined && isEnvAllowed(key, allowlist)) env[key] = value;
  }
  return env;
}

export function spawnManaged(options: ScriptRunOptions): ManagedProcess {
  const timeoutMs = options.timeoutMs ?? DEFAULT_SUBPROCESS_TIMEOUT_MS;
  const maxOutputBytes = Math.max(1, options.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES);
  const env = buildAllowedEnv(options.envAllowlist, options.extraEnv);
  const child = spawn(options.command, [...options.args], {
    cwd: options.cwd,
    env,
    stdio: 'pipe',
  });

  const stdoutChunks: Buffer[] = [];
  const stderrChunks: Buffer[] = [];
  const stdoutSize = { bytes: 0 };
  const stderrSize = { bytes: 0 };
  const state = { timedOut: false, truncated: false, error: undefined as Error | undefined };
  const stdoutDecoder = new StringDecoder('utf-8');
  const stderrDecoder = new StringDecoder('utf-8');

  const collect = (chunk: Buffer, target: 'stdout' | 'stderr'): void => {
    const used = target === 'stdout' ? stdoutSize : stderrSize;
    const chunks = target === 'stdout' ? stdoutChunks : stderrChunks;
    const decoder = target === 'stdout' ? stdoutDecoder : stderrDecoder;
    const callback = target === 'stdout' ? options.onStdout : options.onStderr;
    const room = Math.max(0, maxOutputBytes - used.bytes);
    const accepted = chunk.subarray(0, room);
    if (accepted.length > 0) {
      chunks.push(accepted);
      used.bytes += accepted.length;
    }
    if (accepted.length < chunk.length) state.truncated = true;
    const text = decoder.write(accepted);
    if (text) callback?.(text);
  };

  let timer: NodeJS.Timeout | undefined;
  let onAbort: (() => void) | undefined;

  const done = new Promise<ScriptRunResult>((resolve) => {
    let settled = false;

    const finish = (code: number, signal?: NodeJS.Signals | null): void => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      if (onAbort) options.signal?.removeEventListener('abort', onAbort);
      resolve({
        code,
        stdout: Buffer.concat(stdoutChunks).toString('utf-8') + stdoutDecoder.end(),
        stderr: Buffer.concat(stderrChunks).toString('utf-8') + stderrDecoder.end(),
        timedOut: state.timedOut,
        truncated: state.truncated,
        signal,
        error: state.error,
      });
    };

    child.stdout.on('data', (chunk: Buffer) => collect(chunk, 'stdout'));
    child.stderr.on('data', (chunk: Buffer) => collect(chunk, 'stderr'));
    child.on('error', (err) => {
      state.error = err;
      finish(-1);
    });
    child.on('close', (code, signal) =>
      finish(state.error ? -1 : (code ?? (state.timedOut || signal ? 124 : 0)), signal));

    if (timeoutMs > 0) {
      timer = setTimeout(() => {
        state.timedOut = true;
        child.kill('SIGTERM');
      }, timeoutMs);
      timer.unref?.();
    }
    if (options.signal) {
      onAbort = () => child.kill('SIGTERM');
      if (options.signal.aborted) onAbort();
      else options.signal.addEventListener('abort', onAbort, { once: true });
    }
  });

  if (options.stdin !== undefined) {
    child.stdin.on('error', () => undefined);
    child.stdin.end(options.stdin);
  } else {
    child.stdin.end();
  }

  return {
    child,
    done,
    cancel: () => child.kill('SIGTERM'),
  };
}

export async function runScript(options: ScriptRunOptions): Promise<ScriptRunResult> {
  const managed = spawnManaged(options);
  return managed.done;
}
