/** Shared adapter for the repository's Python command-line tools. */

import { spawn } from 'node:child_process';
import { binary, error, type ApiResult } from '../api/http';

export interface PythonTool {
  resolveRoot(projectId: string): Promise<string>;
  pathFor(relativePath: string): string;
  pythonCmd: string;
}

/**
 * Run a Python tool in the project workspace and return its stdout verbatim.
 *
 * `stdin` is additive (C4): tools that read a JSON request can receive it
 * without writing temporary files. Existing callers are unaffected.
 */
export async function runPythonText(
  tool: PythonTool,
  relativePath: string,
  args: string[],
  projectId: string,
  stdin?: string,
): Promise<string> {
  const cwd = await tool.resolveRoot(projectId);
  const script = tool.pathFor(relativePath);
  const child = spawn(tool.pythonCmd, [script, ...args], { cwd });
  if (stdin !== undefined) {
    // A tool may exit before consuming its input; a broken pipe is not an error.
    child.stdin.on('error', () => { /* ignore EPIPE */ });
    child.stdin.end(stdin);
  }
  let out = '';
  child.stdout.on('data', (chunk) => { out += chunk.toString('utf-8'); });
  await new Promise<void>((resolve, reject) => {
    // Without an error listener a failed spawn crashes the whole gateway.
    child.on('error', reject);
    child.on('close', () => resolve());
  });
  return out;
}

/** Pass stdout through unchanged; `fallback` preserves the old empty envelope. */
export async function runPythonJson(
  tool: PythonTool,
  relativePath: string,
  args: string[],
  projectId: string,
  fallback: string,
): Promise<ApiResult> {
  try {
    const out = await runPythonText(tool, relativePath, args, projectId);
    return binary(out || fallback, 'application/json');
  } catch (err) {
    return error(String(err), 500);
  }
}
