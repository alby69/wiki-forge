import * as fs from 'node:fs/promises';
import * as path from 'node:path';

/**
 * A5/A11 — the single safe filesystem layer for wiki content.
 *
 *  * `atomicWriteFile` never leaves a partially written note: content lands in
 *    a temp file in the same directory, then an atomic rename replaces the
 *    target.
 *  * `softDelete` moves files/directories to `<project>/.wiki-forge/trash/`
 *    (or to an explicit destination, used by project archives) and updates an
 *    auditable manifest instead of unlinking them.
 *
 * Keeping these primitives here (rather than inline in every handler) is what
 * lets the REST layer, the LLM write path and the changeset applier share one
 * durability policy.
 */

export interface TrashEntry {
  id: string;
  originalPath: string;
  trashedPath: string;
  deletedAt: string;
  type: 'file' | 'directory';
}

/**
 * Optional override for the destination folder and manifest. F5 project
 * archiving reuses `softDelete` but stores entries under
 * `<root>/.wiki-forge/archive/` instead of the normal trash folder.
 */
export interface SoftDeleteOptions {
  destinationDir?: string;
  manifestFile?: string;
}

const TRASH_DIR = '.wiki-forge/trash';
const MANIFEST_FILE = 'manifest.jsonl';

export function getTrashDir(projectRoot: string): string {
  return path.resolve(projectRoot, TRASH_DIR);
}

function resolveDestinationDir(projectRoot: string, options?: SoftDeleteOptions): string {
  return options?.destinationDir ? path.resolve(options.destinationDir) : getTrashDir(projectRoot);
}

function resolveManifestPath(projectRoot: string, options?: SoftDeleteOptions): string {
  return options?.manifestFile
    ? path.resolve(options.manifestFile)
    : path.join(resolveDestinationDir(projectRoot, options), MANIFEST_FILE);
}

function sanitize(relative: string): string {
  return relative.replace(/[\\/]+/g, '__').replace(/[^A-Za-z0-9._-]/g, '_');
}

function assertInside(root: string, target: string): string {
  const absolute = path.resolve(target);
  const relative = path.relative(path.resolve(root), absolute);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    const err = new Error('Access denied: path escapes the project root');
    (err as unknown as { status: number }).status = 400;
    throw err;
  }
  return absolute;
}

/** Read manifest lines in their original (oldest-first) order. */
async function readManifestLines(manifest: string): Promise<string[]> {
  try {
    const content = await fs.readFile(manifest, 'utf-8');
    return content.split(/\r?\n/).filter(Boolean);
  } catch {
    return [];
  }
}

/** Append an audit record without ever leaving a partially written manifest. */
async function appendManifest(manifest: string, entry: TrashEntry): Promise<void> {
  const lines = await readManifestLines(manifest);
  lines.push(JSON.stringify(entry));
  await atomicWriteFile(manifest, `${lines.join('\n')}\n`, 'utf-8');
}

/**
 * Write `content` atomically. A failed write leaves the previous file intact.
 */
export async function atomicWriteFile(
  target: string,
  content: Parameters<typeof fs.writeFile>[1],
  options?: Parameters<typeof fs.writeFile>[2]
): Promise<void> {
  await fs.mkdir(path.dirname(target), { recursive: true });
  const temp = path.join(
    path.dirname(target),
    `.${path.basename(target)}.${process.pid}.${Date.now()}.tmp`
  );
  try {
    await fs.writeFile(temp, content, options);
    await fs.rename(temp, target);
  } catch (err) {
    await fs.unlink(temp).catch(() => undefined);
    throw err;
  }
}

/**
 * Move a target into a trash/archive folder instead of deleting it permanently.
 * Returns the manifest entry so callers can surface an undo id in the UI.
 */
export async function softDelete(
  target: string,
  projectRoot: string,
  options?: SoftDeleteOptions
): Promise<TrashEntry> {
  const absolute = path.resolve(target);
  const stat = await fs.stat(absolute);
  const relative = path.relative(projectRoot, absolute).replace(/\\/g, '/') || path.basename(absolute);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const id = `${stamp}-${sanitize(relative)}`;
  const trashDir = resolveDestinationDir(projectRoot, options);
  const trashed = path.join(trashDir, id);

  await fs.mkdir(trashDir, { recursive: true });
  // fs.rename replaces an empty destination directory on POSIX but fails on
  // Windows; the id includes milliseconds so collisions are effectively impossible.
  await fs.rename(absolute, trashed);

  const entry: TrashEntry = {
    id,
    originalPath: relative,
    trashedPath: path.relative(projectRoot, trashed).replace(/\\/g, '/'),
    deletedAt: new Date().toISOString(),
    type: stat.isDirectory() ? 'directory' : 'file',
  };
  await appendManifest(resolveManifestPath(projectRoot, options), entry);
  return entry;
}

/** Read the trash manifest (newest first). Missing manifest means empty trash. */
export async function listTrash(
  projectRoot: string,
  options?: SoftDeleteOptions
): Promise<TrashEntry[]> {
  try {
    const lines = await readManifestLines(resolveManifestPath(projectRoot, options));
    return lines.map((line) => JSON.parse(line) as TrashEntry).reverse();
  } catch {
    return [];
  }
}

/** Restore a trashed item to its original location. */
export async function restoreFromTrash(
  projectRoot: string,
  id: string,
  options?: SoftDeleteOptions
): Promise<string> {
  const entries = await listTrash(projectRoot, options);
  const entry = entries.find((item) => item.id === id);
  if (!entry) throw new Error(`Unknown trash id '${id}'`);
  const source = assertInside(projectRoot, path.resolve(projectRoot, entry.trashedPath));
  const destination = assertInside(projectRoot, path.resolve(projectRoot, entry.originalPath));
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.rename(source, destination);
  return entry.originalPath;
}
