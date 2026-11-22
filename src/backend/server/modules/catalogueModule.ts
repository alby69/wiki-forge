/**
 * Catalogue domain module — first backend component extracted behind the bus.
 *
 * Owns in-app help parsing and the skills scanner. It has no HTTP types: it
 * receives a command payload and returns a transport-neutral result.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { json, error, type ApiResult } from '../api/http';
import type { CommandContext, DomainModule, MessageBus } from '../bus/messageBus';

export interface HelpTopicMeta {
  id: string;
  title: string;
  icon: string;
  order: number;
  group: string;
  mode: 'focus' | 'dev' | 'both';
  keywords: string[];
  context: string[];
}

export interface SkillSummary {
  id: string;
  name: string;
  description: string;
  path: string;
}

export class HelpRepository {
  constructor(private readonly rootDir: string) {}

  parse(raw: string, fileName: string): { meta: HelpTopicMeta; body: string } | null {
    const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    const frontmatter = match ? match[1] : '';
    const body = match ? match[2] : raw;
    const get = (key: string): string => {
      const m = frontmatter.match(new RegExp(`^${key}:[ \t]*(.*)$`, 'm'));
      return m ? m[1].trim() : '';
    };
    const getList = (key: string): string[] => {
      const value = get(key);
      if (!value) return [];
      return value
        .replace(/^\[/, '')
        .replace(/\]$/, '')
        .split(',')
        .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
        .filter(Boolean);
    };
    const id = get('id') || fileName.replace(/\.md$/, '');
    const mode = get('mode');
    return {
      meta: {
        id,
        title: get('title') || id,
        icon: get('icon') || '📖',
        order: Number(get('order')) || 999,
        group: get('group') || 'Guida',
        mode: mode === 'focus' || mode === 'dev' ? mode : 'both',
        keywords: getList('keywords'),
        context: getList('context'),
      },
      body,
    };
  }

  async list(): Promise<HelpTopicMeta[]> {
    const helpDir = path.resolve(this.rootDir, 'docs', 'help');
    let fileNames: string[];
    try {
      fileNames = await fs.readdir(helpDir);
    } catch {
      return [];
    }
    const topics: HelpTopicMeta[] = [];
    for (const fileName of fileNames) {
      if (!/^[a-z0-9-]+\.md$/.test(fileName)) continue;
      try {
        const raw = await fs.readFile(path.join(helpDir, fileName), 'utf-8');
        const parsed = this.parse(raw, fileName);
        if (parsed && parsed.meta.id === fileName.replace(/\.md$/, '')) topics.push(parsed.meta);
      } catch {
        // Unreadable topic file: skip, same as the previous implementation.
      }
    }
    topics.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
    return topics;
  }

  async get(topicId: string): Promise<{ meta: HelpTopicMeta; body: string } | null> {
    if (!/^[a-z0-9-]+$/.test(topicId)) return null;
    const helpDir = path.resolve(this.rootDir, 'docs', 'help');
    try {
      const raw = await fs.readFile(path.join(helpDir, `${topicId}.md`), 'utf-8');
      const parsed = this.parse(raw, `${topicId}.md`);
      if (!parsed || parsed.meta.id !== topicId) return null;
      return parsed;
    } catch {
      return null;
    }
  }
}

export class CatalogueModule implements DomainModule {
  readonly name = 'catalogue';
  readonly help: HelpRepository;

  constructor(private readonly rootDir: string) {
    this.help = new HelpRepository(rootDir);
  }

  register(bus: MessageBus): void {
    bus.register('help.list', () => this.listHelp());
    bus.register<{ topicId: string }>('help.get', (payload) => this.getHelp(payload.topicId));
    bus.register('skills.list', (_payload, context) => this.listSkills(context));
  }

  async listHelp(): Promise<ApiResult> {
    try {
      return json({ success: true, topics: await this.help.list() });
    } catch (err) {
      return error(String(err), 500);
    }
  }

  private async getHelp(topicId: string): Promise<ApiResult> {
    const topic = await this.help.get(topicId);
    if (!topic) return error(`Help topic not found: ${topicId}`, 404);
    return json({ success: true, topic: { ...topic.meta, markdown: topic.body } });
  }

  private async listSkills(_context: CommandContext): Promise<ApiResult> {
    try {
      const skillsDir = path.resolve(this.rootDir, 'skills');
      const skillFolders = await fs.readdir(skillsDir, { withFileTypes: true });
      const skills: SkillSummary[] = [];
      for (const folder of skillFolders) {
        if (!folder.isDirectory()) continue;
        const skillMdPath = path.join(skillsDir, folder.name, 'SKILL.md');
        try {
          const content = await fs.readFile(skillMdPath, 'utf-8');
          const nameMatch = content.match(/name:\s*([^\n]+)/);
          const descMatch = content.match(/description:\s*> ?\n?([\s\S]*?)(?=\ntriggers:|\n---)/);
          skills.push({
            id: folder.name,
            name: nameMatch ? nameMatch[1].trim() : folder.name,
            description: descMatch ? descMatch[1].trim().replace(/\n\s*/g, ' ') : 'Agent skill package',
            path: `skills/${folder.name}/SKILL.md`,
          });
        } catch {
          // SKILL.md missing: skip the folder.
        }
      }
      return json({ success: true, skills });
    } catch (err) {
      return error(String(err), 500);
    }
  }
}

/** Factory used by AgentServer; the module is a singleton per server instance. */
export function createCatalogueModule(rootDir: string): CatalogueModule {
  return new CatalogueModule(rootDir);
}
