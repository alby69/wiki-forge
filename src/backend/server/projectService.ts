import * as fs from 'node:fs/promises';
import * as fsSync from 'node:fs';
import * as path from 'node:path';
import * as toml from 'smol-toml';
import {
  atomicWriteFile,
  listTrash,
  restoreFromTrash,
  softDelete,
  type SoftDeleteOptions,
  type TrashEntry,
} from './safeFs';

/** F5 — single source of truth for project lifecycle operations. */

export interface ProjectEntry {
  id: string;
  name: string;
  path: string;
  archived?: boolean;
  createdAt?: string;
  sourceProjectId?: string;
}

export interface ProjectListOptions {
  includeArchived?: boolean;
}

export interface CloneInclude {
  wiki: boolean;
  raw: boolean;
  sources: boolean;
  notes: boolean;
  output: boolean;
  config: boolean;
}

export interface CloneProjectOptions {
  id: string;
  name: string;
  include?: Partial<CloneInclude>;
}

export type ProjectDeleteMode = 'unregister' | 'trash' | 'permanent';

export interface BundleManifestFile {
  path: string;
  encoding: 'base64';
}

export interface ProjectBundleManifest {
  format: 'wikiforge-project';
  version: 1;
  id: string;
  name: string;
  exportedAt: string;
  files: BundleManifestFile[];
}

export interface ProjectBundle {
  manifest: ProjectBundleManifest;
  files: Record<string, string>;
}

export interface ProjectStats {
  notes: number;
  sources: number;
  assets: number;
  totalBytes: number;
}

export interface ArchiveResult {
  project: ProjectEntry;
  entry: TrashEntry;
}

export interface RemoveResult {
  id: string;
  mode: ProjectDeleteMode;
  trashed?: TrashEntry;
}

type ConfigObject = Record<string, unknown>;

const DEFAULT_PROJECT: ProjectEntry = { id: 'default', name: 'Default Wiki', path: '.' };
const SCAFFOLD_DIRS = ['sources', 'raw', 'wiki', 'output', 'notes', 'templates'] as const;
const RUNTIME_SEGMENTS = new Set(['.wiki-forge', 'trash', 'snapshots', 'node_modules']);
const BASE64_RE = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

export const DEFAULT_CLONE_INCLUDE: CloneInclude = {
  wiki: true,
  raw: true,
  sources: true,
  notes: true,
  output: true,
  config: true,
};

function statusError(message: string, status: number): Error {
  const err = new Error(message);
  (err as unknown as { status: number }).status = status;
  return err;
}

function isPlainObject(value: unknown): value is ConfigObject {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isProjectEntry(value: unknown): value is ProjectEntry {
  if (!isPlainObject(value)) return false;
  return typeof value.id === 'string' && typeof value.name === 'string' && typeof value.path === 'string';
}

/** IDs are also directory names: keep them lowercase, ASCII and path-safe. */
export function sanitizeProjectId(raw: string): string {
  const cleaned = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!cleaned) throw statusError('Invalid project ID', 400);
  return cleaned;
}

function cleanDisplayName(raw: string | undefined, fallback: string): string {
  const value = typeof raw === 'string' ? raw.trim().replace(/\s+/g, ' ') : '';
  return value || fallback;
}

function hasRuntimeSegment(relative: string): boolean {
  return relative.split('/').some((segment) => RUNTIME_SEGMENTS.has(segment));
}

function isRuntimeFile(relative: string): boolean {
  return hasRuntimeSegment(relative) || relative.toLowerCase().endsWith('.db');
}

/** Reject absolute paths, traversal and runtime files coming from a bundle. */
function normalizeBundlePath(raw: unknown): string {
  if (typeof raw !== 'string' || !raw.trim()) {
    throw statusError('Invalid bundle file path', 400);
  }
  const normalized = raw.replace(/\\/g, '/');
  if (normalized.startsWith('/') || path.isAbsolute(normalized)) {
    throw statusError(`Access denied: absolute path '${raw}' in bundle`, 400);
  }
  const parts = normalized.split('/');
  if (parts.some((part) => !part || part === '.' || part === '..')) {
    throw statusError(`Access denied: path traversal '${raw}' in bundle`, 400);
  }
  if (isRuntimeFile(parts.join('/'))) {
    throw statusError(`Access denied: runtime file '${raw}' in bundle`, 400);
  }
  return parts.join('/');
}

function parseBundle(input: ProjectBundle | string | Buffer): ProjectBundle {
  let parsed: unknown = input;
  if (typeof input === 'string' || Buffer.isBuffer(input)) {
    try {
      parsed = JSON.parse(input.toString('utf-8')) as unknown;
    } catch {
      throw statusError('Invalid project bundle: malformed JSON', 400);
    }
  }
  if (!isPlainObject(parsed) || !isPlainObject(parsed.manifest) || !isPlainObject(parsed.files)) {
    throw statusError('Invalid project bundle: missing manifest or files', 400);
  }
  const manifest = parsed.manifest;
  if (manifest.format !== 'wikiforge-project' || manifest.version !== 1) {
    throw statusError('Unsupported project bundle format or version', 400);
  }
  if (typeof manifest.id !== 'string' || typeof manifest.name !== 'string' || !Array.isArray(manifest.files)) {
    throw statusError('Invalid project bundle manifest', 400);
  }
  return parsed as unknown as ProjectBundle;
}

function deepMerge(base: ConfigObject, patch: ConfigObject): ConfigObject {
  const result: ConfigObject = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (isPlainObject(value) && isPlainObject(result[key])) {
      result[key] = deepMerge(result[key] as ConfigObject, value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

export class ProjectService {
  private readonly rootDir: string;

  constructor(rootDir: string) {
    this.rootDir = path.resolve(rootDir);
  }

  // ------------------------------------------------------------------ paths

  /** Preserve the legacy lookup: `config/config.toml`, then root `config.toml`. */
  public getConfigPath(dir: string): string {
    const configInSub = path.join(dir, 'config', 'config.toml');
    if (fsSync.existsSync(configInSub)) return configInSub;
    const configInRoot = path.join(dir, 'config.toml');
    if (fsSync.existsSync(configInRoot)) return configInRoot;
    return configInSub;
  }

  public getProjectsJsonPath(): string {
    const registryInSub = path.join(this.rootDir, 'config', 'projects.json');
    if (fsSync.existsSync(registryInSub)) return registryInSub;
    const registryInRoot = path.join(this.rootDir, 'projects.json');
    if (fsSync.existsSync(registryInRoot)) return registryInRoot;
    return registryInSub;
  }

  private assertInsideRoot(target: string): string {
    const absolute = path.resolve(target);
    const relative = path.relative(this.rootDir, absolute);
    if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
      throw statusError('Access denied: Invalid project path traversal detected', 400);
    }
    return absolute;
  }

  private projectPathFor(id: string): { relative: string; absolute: string } {
    const relative = `projects/${id}`;
    return { relative, absolute: this.assertInsideRoot(path.resolve(this.rootDir, relative)) };
  }

  private archiveOptions(): SoftDeleteOptions {
    const dir = this.assertInsideRoot(path.join(this.rootDir, '.wiki-forge', 'archive'));
    return { destinationDir: dir, manifestFile: path.join(dir, 'manifest.jsonl') };
  }

  private async exists(target: string): Promise<boolean> {
    return (await fs.stat(target).catch(() => null)) !== null;
  }

  // ---------------------------------------------------------------- registry

  private async readRegistry(): Promise<ProjectEntry[]> {
    try {
      const data = await fs.readFile(this.getProjectsJsonPath(), 'utf-8');
      const list = JSON.parse(data) as unknown;
      if (Array.isArray(list) && list.length > 0 && list.every(isProjectEntry)) {
        return list.map((entry) => ({ ...entry, path: entry.path.replace(/\\/g, '/') }));
      }
    } catch {
      // Missing or invalid registry: fall back to the default project.
    }
    return [{ ...DEFAULT_PROJECT }];
  }

  public async saveProjects(projects: ProjectEntry[]): Promise<void> {
    const registryPath = this.getProjectsJsonPath();
    await fs.mkdir(path.dirname(registryPath), { recursive: true });
    await atomicWriteFile(registryPath, JSON.stringify(projects, null, 2), 'utf-8');
  }

  public async list(options: ProjectListOptions = {}): Promise<ProjectEntry[]> {
    const projects = await this.readRegistry();
    return options.includeArchived ? projects : projects.filter((project) => !project.archived);
  }

  public async get(id: string): Promise<ProjectEntry | undefined> {
    return (await this.readRegistry()).find((project) => project.id === id);
  }

  private async getRequired(id: string): Promise<ProjectEntry> {
    const project = await this.get(id);
    if (!project) throw statusError(`Project '${id}' not found`, 404);
    return project;
  }

  public async resolveRoot(id: string = 'default'): Promise<string> {
    if (id !== 'default' && sanitizeProjectId(id) !== id) {
      throw statusError('Access denied: Invalid project ID', 400);
    }
    const project = await this.get(id);
    const relative = project
      ? project.path
      : id === 'default'
        ? '.'
        : `projects/${id}`;
    return this.assertInsideRoot(path.resolve(this.rootDir, relative));
  }

  private async assertProjectAbsent(id: string, projects: ProjectEntry[]): Promise<void> {
    if (projects.some((project) => project.id === id)) {
      throw statusError(`Project '${id}' already exists`, 400);
    }
    if (await this.exists(this.projectPathFor(id).absolute)) {
      throw statusError(`Project '${id}' already exists on disk`, 400);
    }
  }

  // ------------------------------------------------------------------ config

  private async readConfigObject(configPath: string): Promise<ConfigObject> {
    try {
      const parsed = toml.parse(await fs.readFile(configPath, 'utf-8')) as unknown;
      return isPlainObject(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }

  private initialConfig(id: string, name: string): ConfigObject {
    return {
      project: { name: id, title: name, context: '', language: 'en' },
      paths: { sources: 'sources', raw: 'raw', wiki: 'wiki', output: 'output', notes: 'notes', templates: 'templates' },
    };
  }

  private async writeInitialConfig(projectRoot: string, id: string, name: string): Promise<void> {
    await atomicWriteFile(
      this.getConfigPath(projectRoot),
      toml.stringify(this.initialConfig(id, name)),
      'utf-8'
    );
  }

  /** Rewrite only [project].name/title; all other sections survive untouched. */
  public async writeProjectConfig(projectRoot: string, id: string, name: string): Promise<void> {
    const config = await this.readConfigObject(this.getConfigPath(projectRoot));
    const project = isPlainObject(config.project) ? { ...config.project } : {};
    project.name = id;
    project.title = name;
    config.project = project;
    await atomicWriteFile(this.getConfigPath(projectRoot), toml.stringify(config), 'utf-8');
  }

  private async writeConfigForNewProject(
    projectRoot: string,
    id: string,
    name: string,
    sourceRoot?: string
  ): Promise<void> {
    let config: ConfigObject | undefined;
    if (sourceRoot) {
      try {
        const parsed = toml.parse(await fs.readFile(this.getConfigPath(sourceRoot), 'utf-8')) as unknown;
        if (isPlainObject(parsed)) config = { ...parsed };
      } catch {
        // No usable root/source config: use the built-in defaults.
      }
    }
    if (!config) {
      await this.writeInitialConfig(projectRoot, id, name);
      return;
    }
    const project = isPlainObject(config.project) ? { ...config.project } : {};
    project.name = id;
    project.title = name;
    config.project = project;
    await atomicWriteFile(this.getConfigPath(projectRoot), toml.stringify(config), 'utf-8');
  }

  public async readProjectConfig(id: string): Promise<ConfigObject> {
    const projectRoot = await this.resolveRoot(id);
    return this.readConfigObject(this.getConfigPath(projectRoot));
  }

  /** PUT helper: deep-merge the patch and keep the registry display name in sync. */
  public async mergeProjectConfig(id: string, patch: ConfigObject): Promise<ConfigObject> {
    const projectRoot = await this.resolveRoot(id);
    const configPath = this.getConfigPath(projectRoot);
    const merged = deepMerge(await this.readConfigObject(configPath), patch);
    await atomicWriteFile(configPath, toml.stringify(merged), 'utf-8');

    const newName = isPlainObject(patch.project)
      ? typeof patch.project.title === 'string'
        ? patch.project.title.trim()
        : typeof patch.project.name === 'string'
          ? patch.project.name.trim()
          : ''
      : '';
    if (newName) {
      const projects = await this.readRegistry();
      const entry = projects.find((project) => project.id === id);
      if (entry && entry.name !== newName) {
        entry.name = newName;
        await this.saveProjects(projects);
      }
    }
    return merged;
  }

  // -------------------------------------------------------------- lifecycle

  public async create(id: string, name: string): Promise<ProjectEntry> {
    const cleanId = sanitizeProjectId(id);
    if (cleanId === 'default') throw statusError("Project 'default' is reserved", 400);
    const displayName = cleanDisplayName(name, cleanId);
    const projects = await this.readRegistry();
    await this.assertProjectAbsent(cleanId, projects);

    const { relative, absolute } = this.projectPathFor(cleanId);
    const createdDirs: string[] = [];
    const entry: ProjectEntry = {
      id: cleanId,
      name: displayName,
      path: relative,
      createdAt: new Date().toISOString(),
    };
    const original = projects.map((project) => ({ ...project }));

    try {
      await this.mkdirTracked(absolute, createdDirs);
      for (const sub of SCAFFOLD_DIRS) {
        await this.mkdirTracked(path.join(absolute, sub), createdDirs);
      }
      await this.writeConfigForNewProject(absolute, cleanId, displayName, this.rootDir);
      projects.push(entry);
      await this.saveProjects(projects);
      return entry;
    } catch (err) {
      await this.saveProjects(original).catch(() => undefined);
      await this.rollbackDirs(createdDirs);
      throw err;
    }
  }

  private async mkdirTracked(target: string, created: string[]): Promise<void> {
    if (await this.exists(target)) return;
    await fs.mkdir(target, { recursive: true });
    created.push(target);
  }

  private async rollbackDirs(dirs: string[]): Promise<void> {
    for (const dir of dirs.reverse()) {
      await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  public async rename(id: string, name: string): Promise<ProjectEntry> {
    const displayName = cleanDisplayName(name, id);
    const projects = await this.readRegistry();
    const index = projects.findIndex((project) => project.id === id);
    if (index < 0) throw statusError(`Project '${id}' not found`, 404);
    const previous = { ...projects[index] };
    projects[index] = { ...previous, name: displayName };

    await this.saveProjects(projects);
    try {
      await this.writeProjectConfig(await this.resolveRoot(id), id, displayName);
    } catch (err) {
      projects[index] = previous;
      await this.saveProjects(projects).catch(() => undefined);
      throw err;
    }
    return projects[index];
  }

  private cloneFilter(sourceRoot: string, include: CloneInclude): (source: string) => boolean {
    const flags: Record<string, keyof CloneInclude> = {
      wiki: 'wiki',
      raw: 'raw',
      sources: 'sources',
      notes: 'notes',
      output: 'output',
    };
    return (source: string) => {
      const relative = path.relative(sourceRoot, path.resolve(source)).replace(/\\/g, '/');
      if (!relative) return true;
      if (isRuntimeFile(relative)) return false;
      const parts = relative.split('/');
      const flag = flags[parts[0]];
      if (flag && include[flag] === false) return false;
      if (relative === 'config.toml' || relative === 'config/config.toml') return include.config;
      return true;
    };
  }

  public async clone(sourceId: string, options: CloneProjectOptions): Promise<ProjectEntry> {
    const source = await this.getRequired(sourceId);
    const cleanId = sanitizeProjectId(options.id);
    if (cleanId === 'default') throw statusError("Project 'default' is reserved", 400);
    const displayName = cleanDisplayName(options.name, cleanId);
    const include: CloneInclude = { ...DEFAULT_CLONE_INCLUDE, ...options.include };

    const projects = await this.readRegistry();
    await this.assertProjectAbsent(cleanId, projects);
    const sourceRoot = await this.resolveRoot(sourceId);
    const { relative, absolute } = this.projectPathFor(cleanId);
    const entry: ProjectEntry = {
      id: cleanId,
      name: displayName,
      path: relative,
      createdAt: new Date().toISOString(),
      sourceProjectId: source.id,
    };
    const original = projects.map((project) => ({ ...project }));

    try {
      await fs.cp(sourceRoot, absolute, {
        recursive: true,
        filter: this.cloneFilter(sourceRoot, include),
      });
      for (const sub of SCAFFOLD_DIRS) {
        await fs.mkdir(path.join(absolute, sub), { recursive: true });
      }
      if (include.config) {
        await this.writeConfigForNewProject(absolute, cleanId, displayName, sourceRoot);
      } else {
        await this.writeInitialConfig(absolute, cleanId, displayName);
      }
      projects.push(entry);
      await this.saveProjects(projects);
      return entry;
    } catch (err) {
      await this.saveProjects(original).catch(() => undefined);
      await fs.rm(absolute, { recursive: true, force: true }).catch(() => undefined);
      throw err;
    }
  }

  private async findArchiveEntry(project: ProjectEntry): Promise<TrashEntry | undefined> {
    const entries = await listTrash(this.rootDir, this.archiveOptions());
    return entries.find((entry) => entry.originalPath.replace(/\\/g, '/') === project.path);
  }

  /** Where the project's files currently live (archived projects live in .wiki-forge/archive). */
  private async dataRootFor(project: ProjectEntry): Promise<string> {
    if (!project.archived) return this.resolveRoot(project.id);
    const archived = await this.findArchiveEntry(project);
    if (!archived) throw statusError(`Archived project '${project.id}' has no archive entry`, 404);
    return this.assertInsideRoot(path.resolve(this.rootDir, archived.trashedPath));
  }

  public async archive(id: string): Promise<ArchiveResult> {
    if (id === 'default') throw statusError("Cannot archive default project", 400);
    const projects = await this.readRegistry();
    const project = projects.find((item) => item.id === id);
    if (!project) throw statusError(`Project '${id}' not found`, 404);
    if (project.archived) throw statusError(`Project '${id}' is already archived`, 400);

    const source = await this.dataRootFor(project);
    if (!(await this.exists(source))) throw statusError(`Project '${id}' folder is missing`, 404);
    const options = this.archiveOptions();
    const entry = await softDelete(source, this.rootDir, options);
    project.archived = true;
    try {
      await this.saveProjects(projects);
    } catch (err) {
      await restoreFromTrash(this.rootDir, entry.id, options).catch(() => undefined);
      throw err;
    }
    return { project: { ...project }, entry };
  }

  public async restore(id: string): Promise<ProjectEntry> {
    const projects = await this.readRegistry();
    const project = projects.find((item) => item.id === id);
    if (!project) throw statusError(`Project '${id}' not found`, 404);
    if (!project.archived) throw statusError(`Project '${id}' is not archived`, 400);
    const archived = await this.findArchiveEntry(project);
    if (!archived) throw statusError(`Archived project '${id}' has no archive entry`, 404);

    const options = this.archiveOptions();
    await restoreFromTrash(this.rootDir, archived.id, options);
    delete project.archived;
    try {
      await this.saveProjects(projects);
    } catch (err) {
      await softDelete(await this.resolveRoot(id), this.rootDir, options).catch(() => undefined);
      project.archived = true;
      throw err;
    }
    return { ...project };
  }

  public async remove(
    id: string,
    mode: ProjectDeleteMode = 'trash',
    confirm?: string
  ): Promise<RemoveResult> {
    if (id === 'default') throw statusError('Cannot delete default project', 400);
    if (mode !== 'unregister' && mode !== 'trash' && mode !== 'permanent') {
      throw statusError(`Invalid delete mode '${String(mode)}'`, 400);
    }

    let projects = await this.readRegistry();
    const project = projects.find((item) => item.id === id);
    if (!project) throw statusError(`Project '${id}' not found`, 404);
    const original = projects.map((item) => ({ ...item }));
    const remaining = () => projects.filter((item) => item.id !== id);

    if (mode === 'unregister') {
      await this.saveProjects(remaining());
      return { id, mode };
    }

    if (mode === 'permanent' && confirm !== id) {
      throw statusError("Permanent deletion requires confirm=<project id>", 400);
    }

    // Archived projects must be back at their original path before a normal
    // soft delete, so the trash manifest records the real location.
    if (project.archived && mode === 'trash') await this.restore(id);
    projects = await this.readRegistry();

    const target = await this.dataRootFor(await this.getRequired(id));
    let trashed: TrashEntry | undefined;
    if (mode === 'trash') {
      trashed = await softDelete(target, this.rootDir);
    }

    await this.saveProjects(remaining());
    try {
      if (mode === 'permanent') {
        await fs.rm(target, { recursive: true, force: true });
      }
    } catch (err) {
      if (trashed) await restoreFromTrash(this.rootDir, trashed.id).catch(() => undefined);
      await this.saveProjects(original).catch(() => undefined);
      throw err;
    }
    return { id, mode, trashed };
  }

  // ------------------------------------------------------------ export/import

  private async collectFiles(root: string): Promise<Array<{ absolute: string; relative: string; size: number }>> {
    const files: Array<{ absolute: string; relative: string; size: number }> = [];
    const walk = async (dir: string, prefix: string): Promise<void> => {
      let entries: import('node:fs').Dirent[];
      try {
        entries = await fs.readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
          if (!RUNTIME_SEGMENTS.has(entry.name)) await walk(path.join(dir, entry.name), relative);
        } else if (entry.isFile() && !isRuntimeFile(relative)) {
          const absolute = path.join(dir, entry.name);
          const stat = await fs.stat(absolute);
          files.push({ absolute, relative, size: stat.size });
        }
      }
    };
    await walk(root, '');
    return files.sort((a, b) => a.relative.localeCompare(b.relative));
  }

  public async exportBundle(id: string): Promise<ProjectBundle> {
    const project = await this.getRequired(id);
    const root = await this.dataRootFor(project);
    const collected = await this.collectFiles(root);
    const files: Record<string, string> = {};
    const manifestFiles: BundleManifestFile[] = [];
    for (const file of collected) {
      files[file.relative] = (await fs.readFile(file.absolute)).toString('base64');
      manifestFiles.push({ path: file.relative, encoding: 'base64' });
    }
    return {
      manifest: {
        format: 'wikiforge-project',
        version: 1,
        id: project.id,
        name: project.name,
        exportedAt: new Date().toISOString(),
        files: manifestFiles,
      },
      files,
    };
  }

  /** JSON-encoded bundle: no ZIP dependency required. */
  public async export(id: string): Promise<string> {
    return JSON.stringify(await this.exportBundle(id));
  }

  public async import(input: ProjectBundle | string | Buffer): Promise<ProjectEntry> {
    const bundle = parseBundle(input);
    const { manifest } = bundle;
    const cleanId = sanitizeProjectId(manifest.id);
    if (cleanId === 'default') throw statusError("Project 'default' is reserved", 400);
    const displayName = cleanDisplayName(manifest.name, cleanId);

    const seen = new Set<string>();
    const fileEntries = manifest.files.map((file) => {
      const relative = normalizeBundlePath(file.path);
      if (file.encoding !== 'base64') throw statusError(`Unsupported encoding for '${file.path}'`, 400);
      if (seen.has(relative)) throw statusError(`Duplicate bundle path '${relative}'`, 400);
      seen.add(relative);
      const content = bundle.files[file.path];
      if (typeof content !== 'string' || !BASE64_RE.test(content)) {
        throw statusError(`Invalid base64 payload for '${file.path}'`, 400);
      }
      return { relative, content };
    });

    const projects = await this.readRegistry();
    await this.assertProjectAbsent(cleanId, projects);
    const { relative, absolute } = this.projectPathFor(cleanId);
    const entry: ProjectEntry = {
      id: cleanId,
      name: displayName,
      path: relative,
      createdAt: new Date().toISOString(),
    };
    const original = projects.map((project) => ({ ...project }));

    try {
      await fs.mkdir(absolute, { recursive: true });
      for (const sub of SCAFFOLD_DIRS) {
        await fs.mkdir(path.join(absolute, sub), { recursive: true });
      }
      for (const file of fileEntries) {
        const target = this.assertInsideRoot(path.resolve(absolute, file.relative));
        await atomicWriteFile(target, Buffer.from(file.content, 'base64'));
      }
      await this.writeProjectConfig(absolute, cleanId, displayName);
      projects.push(entry);
      await this.saveProjects(projects);
      return entry;
    } catch (err) {
      await this.saveProjects(original).catch(() => undefined);
      await fs.rm(absolute, { recursive: true, force: true }).catch(() => undefined);
      throw err;
    }
  }

  // ------------------------------------------------------------------- stats

  public async stats(id: string): Promise<ProjectStats> {
    const project = await this.getRequired(id);
    const root = await this.dataRootFor(project);
    const files = await this.collectFiles(root);
    const stats: ProjectStats = { notes: 0, sources: 0, assets: 0, totalBytes: 0 };
    for (const file of files) {
      stats.totalBytes += file.size;
      const relative = file.relative;
      if (relative.startsWith('wiki/') && relative.toLowerCase().endsWith('.md')) stats.notes += 1;
      else if (relative.startsWith('sources/')) stats.sources += 1;
      else if (relative.startsWith('raw/') || relative.startsWith('assets/')) stats.assets += 1;
    }
    return stats;
  }
}
