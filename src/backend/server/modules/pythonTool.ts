/** Shared adapter for the repository's Python command-line tools. */

import { binary, error, type ApiResult } from '../api/http';
import { runScript } from '../process/scriptRunner';

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
  const result = await runScript({
    command: tool.pythonCmd,
    args: [script, ...args],
    cwd,
    stdin,
  });
  if (result.error) throw result.error;
  return result.stdout;
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
