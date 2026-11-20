import * as fsSync from 'node:fs';
import * as path from 'node:path';

/**
 * Tooling scripts belong to the *installation* (repository root), not to the
 * project data root passed to `AgentServer`. Production passes the repo root
 * as `rootDir`, but embedded use and tests may pass a project-only directory.
 *
 * One shared resolver keeps every spawn site consistent and lets us remove
 * duplicated fallback implementations that used to mask script failures.
 */
export function resolveToolScript(rootDir: string, relativePath: string): string {
  const local = path.resolve(rootDir, relativePath);
  if (fsSync.existsSync(local)) return local;

  const installed = path.resolve(process.cwd(), relativePath);
  if (fsSync.existsSync(installed)) return installed;

  // Neither exists: return the project-relative path so the spawn error stays
  // actionable (and never silently triggers a duplicate writer).
  return local;
}
