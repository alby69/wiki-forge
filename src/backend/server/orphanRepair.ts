import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { Changeset, ChangesetStore, StageChangesetInput } from './changesetStore';
import {
  FINDINGS_SCHEMA,
  parseFindingsEnvelope,
  type FindingsEnvelope,
  type Finding,
} from './findingChangeset';

export const AUTONOMY_ACTOR = 'process:wiki-forge-autonomy';

const REPAIR_ACTIONS = ['repair-orphan', 'fix-okf-frontmatter'] as const;
type RepairAction = typeof REPAIR_ACTIONS[number];

function resolveInside(projectRoot: string, relative: string): { absolute: string; relative: string } {
  const clean = relative.replace(/\\/g, '/').replace(/^\/+/, '');
  if (!clean || clean.split('/').includes('..')) throw new Error(`Unsafe repair target '${relative}'`);
  const absolute = path.resolve(projectRoot, clean);
  const inside = path.relative(projectRoot, absolute);
  if (inside.startsWith('..') || path.isAbsolute(inside)) {
    throw new Error(`Repair target escapes the project: '${relative}'`);
  }
  if (!inside.toLowerCase().endsWith('.md')) throw new Error(`Repair target must be markdown: '${relative}'`);
  return { absolute, relative: inside.replace(/\\/g, '/') };
}

function titleFor(target: string): string {
  return path.basename(target, '.md').replace(/[-_]+/g, ' ').trim() || 'Orphan Note';
}

function orphanStub(finding: Finding, target: string): string {
  const title = titleFor(target);
  return [
    '---',
    `title: "${title}"`,
    'type: Concept',
    'status: draft',
    'tags: [okf, orphan-repair, status/draft]',
    '---',
    '',
    `# ${title}`,
    '',
    '> Nota stub generata per risolvere un link orfano. Richiede revisione umana.',
    '',
    '## Evidenze',
    ...finding.evidence.map((entry) => `- ${entry}`),
    '',
  ].join('\n');
}

function splitFrontmatter(content: string): { frontmatter: string; body: string } {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (!match) return { frontmatter: '', body: content };
  return { frontmatter: match[1], body: match[2] };
}

function upsertField(frontmatter: string, key: string, value: string): string {
  const escaped = JSON.stringify(value);
  const pattern = new RegExp(`^${key}:.*$`, 'm');
  if (pattern.test(frontmatter)) return frontmatter.replace(pattern, `${key}: ${escaped}`);
  return `${frontmatter.trimEnd()}\n${key}: ${escaped}`;
}

function normalizedNote(original: string, finding: Finding): string {
  const { frontmatter, body } = splitFrontmatter(original);
  const repaired = upsertField(upsertField(frontmatter, 'type', 'Concept'), 'status', 'draft');
  const marker = `<!-- a5:${finding.findingId} -->`;
  const evidenceSection = [
    marker,
    '## Evidenze riparazione A5',
    `- Finding: \`${finding.findingId}\``,
    ...finding.evidence.map((entry) => `- ${entry}`),
  ].join('\n');
  const nextBody = body.includes(marker) ? body : `${body.replace(/\s*$/, '')}\n\n${evidenceSection}\n`;
  return `---\n${repaired.trim()}\n---\n\n${nextBody}`;
}

function repairAction(finding: Finding): RepairAction {
  if (!(REPAIR_ACTIONS as readonly string[]).includes(finding.proposedAction)) {
    throw new Error(`Unsupported repair action: ${finding.proposedAction}`);
  }
  return finding.proposedAction as RepairAction;
}

export async function repairFindingToStageInput(
  finding: Finding,
  projectRoot: string,
): Promise<StageChangesetInput> {
  const action = repairAction(finding);
  const target = resolveInside(projectRoot, finding.targetPath);
  const original = await fs.readFile(target.absolute, 'utf-8').catch(() => '');

  if (action === 'fix-okf-frontmatter' && !original) {
    throw new Error(`Cannot repair missing note: ${finding.targetPath}`);
  }

  const create = action === 'repair-orphan' && !original;
  const edit = create
    ? {
      file: target.relative,
      action: 'create' as const,
      proposed_content: orphanStub(finding, target.relative),
    }
    : {
      file: target.relative,
      action: 'modify' as const,
      proposed_content: normalizedNote(original, finding),
      requireOriginal: true,
    };

  return {
    description: `[A5] ${finding.kind} — ${finding.targetPath}`,
    author: AUTONOMY_ACTOR,
    rationale: [
      `Finding ${finding.findingId} (${finding.kind}, confidenza ${finding.confidence}).`,
      `Azione deterministica: ${finding.proposedAction}.`,
      `Evidenze: ${finding.evidence.join(' | ')}`,
      'Riparazione proposta con snapshot e rivalidazione obbligatoria.',
    ].join(' '),
    sources: [...finding.evidence],
    edits: [edit],
    finding: {
      findingId: finding.findingId,
      kind: finding.kind,
      confidence: finding.confidence,
      evidence: [...finding.evidence],
      targetPath: finding.targetPath,
      proposedAction: finding.proposedAction,
    },
  };
}

export interface StageRepairsResult {
  created: Changeset[];
  skipped: string[];
}

export async function stageRepairChangesets(
  store: ChangesetStore,
  envelope: FindingsEnvelope,
  projectRoot: string,
  actor = AUTONOMY_ACTOR,
): Promise<StageRepairsResult> {
  const findings = parseFindingsEnvelope(envelope).findings;
  const existing = await store.list();
  const seen = new Set(
    existing.map((changeset) => changeset.finding?.findingId).filter((id): id is string => Boolean(id)),
  );

  const created: Changeset[] = [];
  const skipped: string[] = [];
  for (const finding of findings) {
    if (seen.has(finding.findingId)) {
      skipped.push(finding.findingId);
      continue;
    }
    const input = await repairFindingToStageInput(finding, projectRoot);
    created.push(await store.stage({ ...input, actor }));
    seen.add(finding.findingId);
  }
  return { created, skipped };
}

export function collectRepairFindings(
  rootDir: string,
  wikiDir: string,
  wikiRel = 'wiki',
  pythonCmd = process.env.WIKIFORGE_PYTHON || 'python3',
): FindingsEnvelope {
  const result = spawnSync(
    pythonCmd,
    [
      '-m',
      'src.backend.wikiforge.semantics.orphan_repair',
      '--findings',
      '--wiki-dir',
      wikiDir,
      '--wiki-rel',
      wikiRel,
    ],
    { cwd: rootDir, encoding: 'utf-8', maxBuffer: 8 * 1024 * 1024 },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || 'repair planner failed').trim());
  }
  const parsed = JSON.parse(result.stdout || '') as unknown;
  const envelope = parseFindingsEnvelope(parsed);
  if (envelope.schema !== FINDINGS_SCHEMA) throw new Error('Unexpected repair findings schema');
  return envelope;
}
