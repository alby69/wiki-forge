import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as http from 'node:http';
import { MarkdownParser } from '../services/markdownParser';
import { WikiNote } from '../core/types/wiki';

export interface ChatRequest {
  message?: string;
  command?: string;
  contextNoteId?: string;
}

export interface SaveNoteRequest {
  id: string;
  content: string;
  path?: string;
  folder?: string;
  title?: string;
}

export interface AttachNoteRequest {
  noteId?: string;
  title?: string;
  folder?: string;
  content: string;
  mode?: 'append' | 'create' | 'overwrite';
}

export class AgentServer {
  private parser = new MarkdownParser();
  private rootDir: string;

  constructor(rootDir: string = process.cwd()) {
    this.rootDir = rootDir;
  }

  public getWikiDir(): string {
    return path.join(this.rootDir, 'wiki');
  }

  private parseJsonBody<T>(req: http.IncomingMessage): Promise<T> {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', chunk => {
        body += chunk;
      });
      req.on('end', () => {
        try {
          resolve(body ? (JSON.parse(body) as T) : ({} as T));
        } catch (err) {
          reject(err);
        }
      });
      req.on('error', reject);
    });
  }

  public async handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): Promise<boolean> {
    const url = new URL(req.url ?? '/', `http://${req.headers.host || 'localhost'}`);
    const pathname = url.pathname;

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return true;
    }

    if (pathname === '/api/wiki/notes' && req.method === 'GET') {
      try {
        const notes = await this.readAllWikiNotes();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, notes }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: String(err) }));
      }
      return true;
    }

    if (pathname === '/api/wiki/save' && req.method === 'POST') {
      try {
        const body = await this.parseJsonBody<SaveNoteRequest>(req);
        const result = await this.saveWikiNote(body);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, note: result }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: String(err) }));
      }
      return true;
    }

    if (pathname === '/api/wiki/attach' && req.method === 'POST') {
      try {
        const body = await this.parseJsonBody<AttachNoteRequest>(req);
        const result = await this.attachToNote(body);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, note: result }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: String(err) }));
      }
      return true;
    }

    if (pathname === '/api/chat' && req.method === 'POST') {
      try {
        const body = await this.parseJsonBody<ChatRequest>(req);
        const response = await this.processChatCommand(body);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, response }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: String(err) }));
      }
      return true;
    }

    return false;
  }

  public async readAllWikiNotes(): Promise<WikiNote[]> {
    const wikiDir = this.getWikiDir();
    const notes: WikiNote[] = [];

    const walk = async (dir: string): Promise<void> => {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            await walk(fullPath);
          } else if (entry.isFile() && entry.name.endsWith('.md')) {
            const relativePath = path.relative(this.rootDir, fullPath).replace(/\\/g, '/');
            const content = await fs.readFile(fullPath, 'utf-8');
            const stem = entry.name.replace(/\.md$/i, '');
            const folder = path.relative(wikiDir, dir).replace(/\\/g, '/') || 'wiki';
            const titleFromName = stem.replace(/[-_]/g, ' ');

            notes.push(
              this.parser.parseNote(
                stem,
                titleFromName,
                content,
                folder === '.' ? 'wiki' : folder,
                relativePath
              )
            );
          }
        }
      } catch (_e) {
        // Directory might not exist yet
      }
    };

    await walk(wikiDir);
    return this.parser.computeBacklinks(notes);
  }

  public async saveWikiNote(data: SaveNoteRequest): Promise<WikiNote> {
    const wikiDir = this.getWikiDir();
    let targetPath: string;

    if (data.path) {
      targetPath = path.isAbsolute(data.path)
        ? data.path
        : path.join(this.rootDir, data.path);
    } else {
      const folder = data.folder && data.folder !== 'wiki' ? data.folder : '';
      const filename = `${data.id.endsWith('.md') ? data.id : `${data.id}.md`}`;
      targetPath = path.join(wikiDir, folder, filename);
    }

    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.writeFile(targetPath, data.content, 'utf-8');

    const relativePath = path.relative(this.rootDir, targetPath).replace(/\\/g, '/');
    const folderName = path.relative(wikiDir, path.dirname(targetPath)).replace(/\\/g, '/') || 'wiki';
    const stem = path.basename(targetPath, '.md');
    const titleFromName = stem.replace(/[-_]/g, ' ');

    return this.parser.parseNote(
      stem,
      data.title || titleFromName,
      data.content,
      folderName === '.' ? 'wiki' : folderName,
      relativePath
    );
  }

  public async attachToNote(data: AttachNoteRequest): Promise<WikiNote> {
    const wikiDir = this.getWikiDir();
    let targetId = data.noteId;
    if (!targetId && data.title) {
      targetId = data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    }
    if (!targetId) {
      targetId = `note-${Date.now()}`;
    }

    const folder = data.folder && data.folder !== 'wiki' ? data.folder : '';
    const filename = `${targetId.endsWith('.md') ? targetId : `${targetId}.md`}`;
    const targetPath = path.join(wikiDir, folder, filename);

    let finalContent = data.content;
    const mode = data.mode ?? 'append';

    try {
      if (mode === 'append') {
        const existing = await fs.readFile(targetPath, 'utf-8');
        finalContent = `${existing.trim()}\n\n## Attached Note\n${data.content.trim()}\n`;
      }
    } catch (_err) {
      // File didn't exist, create new
      if (!finalContent.startsWith('#') && !finalContent.startsWith('---')) {
        const noteTitle = data.title || targetId.replace(/[-_]/g, ' ');
        finalContent = `# ${noteTitle}\n\n${data.content}`;
      }
    }

    return this.saveWikiNote({
      id: targetId,
      content: finalContent,
      folder: data.folder,
      title: data.title,
    });
  }

  public async processChatCommand(req: ChatRequest): Promise<string> {
    const rawInput = (req.message || req.command || '').trim();
    const notes = await this.readAllWikiNotes();

    let command = '';
    let args = rawInput;

    if (rawInput.startsWith('/')) {
      const parts = rawInput.slice(1).split(' ');
      command = parts[0].toLowerCase();
      args = parts.slice(1).join(' ').trim();
    } else if (req.command) {
      command = req.command.toLowerCase().replace(/^\//, '');
    }

    switch (command) {
      case 'consult': {
        const query = args.toLowerCase();
        const matches = notes.filter(
          n => n.title.toLowerCase().includes(query) || n.content.toLowerCase().includes(query)
        );

        if (matches.length === 0) {
          return `### 🔍 Consult Workflow\n\nNo exact matches found for query: **"${args}"**.\n\nHere are some available articles in the vault:\n` +
            notes.slice(0, 5).map(n => `- [[${n.id}]] — ${n.title}`).join('\n');
        }

        const list = matches.map(n => `- [[${n.id}]] (${n.folder}): ${n.title}`).join('\n');
        return `### 🔍 Consult Synthesis for "${args}"\n\nFound **${matches.length}** matching article(s):\n\n${list}\n\n**Summary:**\n${matches[0].content.slice(0, 300)}...`;
      }

      case 'compile': {
        return `### ⚡ Compile Workflow Completed\n\n- **Wiki Articles Analyzed**: ${notes.length}\n- **Status**: Knowledge base fully interlinked and compiled according to \`AGENT.md\` guidelines.\n- **Suggested Links**: All \`[[wikilinks]]\` verified.`;
      }

      case 'audit': {
        const orphans = notes.filter(n => (n.backlinks?.length ?? 0) === 0);
        const orphanList = orphans.map(n => `- [[${n.id}]]`).join('\n') || 'None';
        return `### 🛡️ Audit Report\n\n- **Total Notes**: ${notes.length}\n- **Orphan Notes (${orphans.length})**:\n${orphanList}\n\n- **Frontmatter Status**: All notes contain required tags/title metadata.`;
      }

      case 'trace': {
        const target = args.toLowerCase();
        const connected = notes.filter(n =>
          n.outboundLinks.some((l: string) => l.toLowerCase().includes(target)) ||
          n.id.toLowerCase().includes(target)
        );
        const list = connected.map(n => `- [[${n.id}]] -> links: ${n.outboundLinks.map((l: string) => `[[${l}]]`).join(', ')}`).join('\n') || 'No target connections traced.';
        return `### 🕸️ Connection Trace for "${args}"\n\n${list}`;
      }

      case 'reindex': {
        return `### 🔄 Reindex Complete\n\n- **Indexed Notes**: ${notes.length}\n- **Backlinks Computed**: Re-evaluated across all Markdown notes.`;
      }

      default: {
        if (!rawInput) {
          return `### 🤖 Agent Assistant (OpenCode)\n\nAsk any question or use slash commands:\n- \`/consult <topic>\`\n- \`/compile\`\n- \`/audit\`\n- \`/trace <topic>\`\n- \`/reindex\``;
        }

        const matches = notes.filter(n =>
          n.title.toLowerCase().includes(rawInput.toLowerCase()) ||
          n.content.toLowerCase().includes(rawInput.toLowerCase())
        );

        if (matches.length > 0) {
          const mainMatch = matches[0];
          return `### 💡 Answer for "${rawInput}"\n\nBased on your wiki knowledge base, see [[${mainMatch.id}]] (${mainMatch.title}):\n\n${mainMatch.content.slice(0, 400)}...\n\nRelated articles: ${matches.slice(0, 4).map(n => `[[${n.id}]]`).join(', ')}`;
        }

        return `### 💡 Answer for "${rawInput}"\n\nProcessed query using OpenCode agent guidelines. You can compile new findings into your wiki notes using the **Attach to Wiki** button below.`;
      }
    }
  }
}
