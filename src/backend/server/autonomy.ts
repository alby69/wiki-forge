import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as fsSync from 'node:fs';
import * as path from 'node:path';
import * as toml from 'smol-toml';
import { buildAllowedEnv } from './process/scriptRunner';
import type { Changeset, ChangesetStore, StageChangesetInput } from './changesetStore';
import type { Finding } from './findingChangeset';

export const AUTONOMY_ACTOR = 'process:wiki-forge-autonomy';
export const AUTONOMY_AUDIT_FILE = '.wiki-forge/autonomy-audit.jsonl';
export const AUTONOMY_FINDINGS_FILE = '.wiki-forge/autonomy-findings.jsonl';
export const AUTONOMY_MODES = ['off', 'propose', 'bounded'] as const;

export type AutonomyMode = typeof AUTONOMY_MODES[number];
export type SafetyClass = 'read-only' | 'report' | 'workspace' | 'wiki-write' | 'blocked' | 'unknown';

export interface AutonomyConfig {
  mode: AutonomyMode;
  scripts: string[];
  paths: string[];
  findingKinds: string[];
  revalidation: string[];
}

export interface AutonomyCandidate {
  finding: Finding;
  stage: StageChangesetInput;
  scriptId?: string;
  safety: SafetyClass;
}

export interface RevalidationResult {
  ok: boolean;
  failures: string[];
}

export type Revalidator = (projectRoot: string, changeset: Changeset) => Promise<RevalidationResult>;

export type AutonomyOutcome = 'skipped' | 'staged' | 'applied' | 'rolled_back';

export interface AutonomyAuditEntry {
  at: string;
  mode: AutonomyMode;
  actor: string;
  findingId: string;
  kind: string;
  targetPath: string;
  scriptId?: string;
  safety: SafetyClass;
  outcome: AutonomyOutcome;
  changeSetId?: string;
  reason: string;
}

export interface AutonomyResult {
  outcome: AutonomyOutcome;
  changeset?: Changeset;
  /** Structured advisory left behind when bounded revalidation fails. */
  finding?: Finding;
  reason: string;
  audit: AutonomyAuditEntry;
}

export function defaultAutonomyConfig(): AutonomyConfig {
  return {
    mode: 'off',
    scripts: [],
    paths: [],
    findingKinds: [],
    revalidation: ['okf_lint', 'shacl', 'cq_validator'],
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function normalizeAutonomyConfig(raw: unknown): AutonomyConfig {
  const config = defaultAutonomyConfig();
  const section = asRecord(asRecord(raw).autonomy);
  const mode = section.mode;
  if (mode === 'off' || mode === 'propose' || mode === 'bounded') config.mode = mode;
  config.scripts = asStringArray(section.scripts) ?? [];
  config.paths = asStringArray(section.paths) ?? [];
  config.findingKinds = asStringArray(section.findingKinds) ?? [];
  const revalidation = asStringArray(section.revalidation);
  if (revalidation) config.revalidation = revalidation;
  return config;
}

export function loadAutonomyConfigSync(rootDir: string): AutonomyConfig {
  for (const relative of ['config/config.toml', 'config.toml']) {
    try {
      const content = fsSync.readFileSync(path.join(rootDir, relative), 'utf-8');
      return normalizeAutonomyConfig(toml.parse(content) as unknown);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') continue;
      return defaultAutonomyConfig();
    }
  }
  return defaultAutonomyConfig();
}

function normalizePath(value: string): string {
  return value.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
}

function pathAllowed(config: AutonomyConfig, targetPath: string): boolean {
  const target = normalizePath(targetPath);
  return config.paths.some((prefix) => {
    const clean = normalizePath(prefix);
    return target === clean || target.startsWith(`${clean}/`);
  });
}

function safeScripts(safety: SafetyClass): boolean {
  return safety === 'read-only' || safety === 'report';
}

const INTERNAL_SAFETY: Record<string, SafetyClass> = {
  orphan_repair: 'read-only',
};

/** Classify registered scripts and the internal A5 planner without widening the registry. */
export function resolveAutonomySafety(
  scriptId: string | undefined,
  registrySafety: string | undefined = undefined,
): SafetyClass {
  if (!scriptId) return 'unknown';
  const internal = INTERNAL_SAFETY[scriptId];
  if (internal) return internal;
  if (registrySafety === 'read-only' || registrySafety === 'report'
    || registrySafety === 'workspace' || registrySafety === 'wiki-write'
    || registrySafety === 'blocked') return registrySafety;
  return 'unknown';
}

export function isBoundedAllowed(config: AutonomyConfig, candidate: AutonomyCandidate): boolean {
  const scriptId = candidate.scriptId ?? candidate.stage.author ?? '';
  return config.mode === 'bounded'
    && config.scripts.includes(scriptId)
    && config.findingKinds.includes(candidate.finding.kind)
    && pathAllowed(config, candidate.finding.targetPath)
    && safeScripts(candidate.safety);
}

export function decideAutonomy(config: AutonomyConfig, candidate: AutonomyCandidate): AutonomyOutcome {
  if (config.mode === 'off') return 'skipped';
  if (config.mode === 'propose') return 'staged';
  return isBoundedAllowed(config, candidate) ? 'applied' : 'skipped';
}

interface ValidatorPaths {
  wikiRel: string;
  configRel: string;
}

const VALIDATOR_COMMANDS: Record<string, (paths: ValidatorPaths) => string[]> = {
  okf_lint: ({ wikiRel }) => ['scripts/okf_lint.py', '--json', wikiRel],
  schema_lint: ({ wikiRel, configRel }) => [
    'scripts/schema_lint.py', '--strict', '--json', '--wiki-dir', wikiRel, '--config', configRel,
  ],
  shacl: ({ wikiRel }) => [
    '-W', 'ignore', '-m', 'src.backend.wikiforge.semantics.shacl_validator', '--wiki-dir', wikiRel,
  ],
  cq_validator: ({ wikiRel }) => [
    'scripts/cq_validator.py', '--findings', '--wiki-dir', wikiRel,
    '--cq-file', path.join(wikiRel, 'competency_questions.md'),
  ],
};

export function validatorCommand(name: string, paths: ValidatorPaths): string[] | undefined {
  return VALIDATOR_COMMANDS[name]?.(paths);
}

function pythonCommand(): string {
  return process.env.WIKIFORGE_PYTHON || 'python3';
}

function relativeToRoot(rootDir: string, absolute: string): string {
  return path.relative(rootDir, absolute).replace(/\\/g, '/') || '.';
}

function parseValidator(name: string, output: string): RevalidationResult {
  try {
    const parsed = JSON.parse(output) as Record<string, unknown>;
    if (name === 'cq_validator') {
      if (typeof parsed.count === 'number' && parsed.count > 0) {
        return { ok: false, failures: [`cq_validator: ${parsed.count} finding(s)`] };
      }
      return { ok: true, failures: [] };
    }
    const passed = typeof parsed.ok === 'boolean' ? parsed.ok : parsed.conforms;
    const status = typeof parsed.status === 'string' ? parsed.status : undefined;
    const failed = passed === false
      || (status !== undefined && status !== 'success' && status !== 'ok' && status !== 'disabled');
    if (failed) {
      const detail = parsed.summary ?? parsed.errors ?? parsed.violations
        ?? parsed.findings ?? 'validation failed';
      return { ok: false, failures: [`${name}: ${JSON.stringify(detail).slice(0, 300)}`] };
    }
    return { ok: true, failures: [] };
  } catch {
    return { ok: false, failures: [`${name}: invalid JSON output`] };
  }
}

export function createScriptRevalidator(rootDir: string): Revalidator {
  return async (projectRoot) => {
    const config = loadAutonomyConfigSync(rootDir);
    const failures: string[] = [];
    const wikiRel = relativeToRoot(rootDir, path.join(projectRoot, 'wiki'));
    const projectConfig = path.join(projectRoot, 'config.toml');
    const configRel = fsSync.existsSync(projectConfig)
      ? relativeToRoot(rootDir, projectConfig)
      : relativeToRoot(rootDir, path.join(rootDir, 'config', 'config.toml'));

    for (const requested of config.revalidation) {
      const args = validatorCommand(requested, { wikiRel, configRel });
      if (!args) {
        failures.push(`${requested}: unsupported validator`);
        continue;
      }
      const result = spawnSync(pythonCommand(), args, {
        cwd: rootDir,
        encoding: 'utf-8',
        maxBuffer: 8 * 1024 * 1024,
        env: buildAllowedEnv(),
      });
      if (result.error) {
        failures.push(`${requested}: ${result.error.message}`);
        continue;
      }
      if (result.status !== 0) {
        const detail = (result.stderr || result.stdout || '').trim().split('\n')[0];
        failures.push(`${requested}: ${detail || `exit ${result.status}`}`);
        continue;
      }
      const parsed = parseValidator(requested, result.stdout || '');
      failures.push(...parsed.failures);
    }
    return { ok: failures.length === 0, failures };
  };
}

export interface AutonomyEngineOptions {
  revalidate?: Revalidator;
  now?: () => Date;
  auditPath?: string;
  findingsPath?: string;
}

export class AutonomyEngine {
  private readonly revalidate: Revalidator;
  private readonly now: () => Date;
  private readonly auditPath: string;
  private readonly findingsPath: string;

  constructor(
    private readonly rootDir: string,
    private readonly config: AutonomyConfig,
    private readonly store: ChangesetStore,
    options: AutonomyEngineOptions = {},
  ) {
    this.revalidate = options.revalidate ?? createScriptRevalidator(rootDir);
    this.now = options.now ?? (() => new Date());
    this.auditPath = path.resolve(rootDir, options.auditPath ?? AUTONOMY_AUDIT_FILE);
    this.findingsPath = path.resolve(rootDir, options.findingsPath ?? AUTONOMY_FINDINGS_FILE);
  }

  private async audit(entry: AutonomyAuditEntry): Promise<void> {
    await fs.mkdir(path.dirname(this.auditPath), { recursive: true });
    await fs.appendFile(this.auditPath, `${JSON.stringify(entry)}\n`, 'utf-8');
  }

  private async leaveFinding(
    candidate: AutonomyCandidate,
    changeset: Changeset,
    phase: 'pre' | 'post',
    failures: string[],
  ): Promise<Finding> {
    const digest = createHash('sha256')
      .update([candidate.finding.findingId, changeset.id, phase, ...failures].join('\n'))
      .digest('hex')
      .slice(0, 12);
    const finding: Finding = {
      findingId: `inconsistency-autonomy-${digest}`,
      kind: 'inconsistency',
      confidence: 1,
      evidence: [
        `autonomy=${phase}-revalidation-failure`,
        `changeset=${changeset.id}`,
        ...failures.map((failure) => `failure=${failure}`),
      ],
      targetPath: candidate.finding.targetPath,
      proposedAction: 'review-autonomy-revalidation-failure',
    };
    await fs.mkdir(path.dirname(this.findingsPath), { recursive: true });
    await fs.appendFile(this.findingsPath, `${JSON.stringify(finding)}\n`, 'utf-8');
    return finding;
  }

  private result(
    outcome: AutonomyOutcome,
    reason: string,
    candidate: AutonomyCandidate,
    changeset?: Changeset,
    finding?: Finding,
  ): AutonomyResult {
    const audit: AutonomyAuditEntry = {
      at: this.now().toISOString(),
      mode: this.config.mode,
      actor: AUTONOMY_ACTOR,
      findingId: candidate.finding.findingId,
      kind: candidate.finding.kind,
      targetPath: candidate.finding.targetPath,
      ...(candidate.scriptId ? { scriptId: candidate.scriptId } : {}),
      safety: candidate.safety,
      outcome,
      ...(changeset ? { changeSetId: changeset.id } : {}),
      reason,
    };
    return {
      outcome,
      ...(changeset ? { changeset } : {}),
      ...(finding ? { finding } : {}),
      reason,
      audit,
    };
  }

  async process(candidate: AutonomyCandidate, projectRoot: string): Promise<AutonomyResult> {
    const decision = decideAutonomy(this.config, candidate);
    if (decision === 'skipped') {
      const reason = this.config.mode === 'off'
        ? 'autonomy mode is off'
        : 'candidate is outside the bounded allowlist';
      const result = this.result('skipped', reason, candidate);
      await this.audit(result.audit);
      return result;
    }

    const changeset = await this.store.stage({ ...candidate.stage, actor: AUTONOMY_ACTOR });
    if (decision === 'staged') {
      const result = this.result('staged', 'propose mode: awaiting human approval', candidate, changeset);
      await this.audit(result.audit);
      return result;
    }

    const pre = await this.revalidate(projectRoot, changeset);
    if (!pre.ok) {
      await this.store.reject(changeset.id, `rivalidazione fallita: ${pre.failures.join('; ')}`, AUTONOMY_ACTOR);
      const finding = await this.leaveFinding(candidate, changeset, 'pre', pre.failures);
      const result = this.result('rolled_back', pre.failures.join('; '), candidate, changeset, finding);
      await this.audit(result.audit);
      return result;
    }

    await this.store.apply(changeset.id, AUTONOMY_ACTOR, true);
    const post = await this.revalidate(projectRoot, changeset);
    if (!post.ok) {
      await this.store.rollback(changeset.id, AUTONOMY_ACTOR);
      const finding = await this.leaveFinding(candidate, changeset, 'post', post.failures);
      const result = this.result('rolled_back', post.failures.join('; '), candidate, changeset, finding);
      await this.audit(result.audit);
      return result;
    }

    const result = this.result('applied', 'revalidated bounded repair', candidate, changeset);
    await this.audit(result.audit);
    return result;
  }
}
