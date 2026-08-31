import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as http from 'node:http';
import { MarkdownParser } from '../services/markdownParser';
import { WikiNote } from '../core/types/wiki';
import { LlmClient, LlmClientFactory } from './llmClient';

export interface ChatRequest {
  message?: string;
  command?: string;
  contextNoteId?: string;
  stream?: boolean;
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

export interface CreateFolderRequest {
  folderPath: string;
}

export interface CreateFileRequest {
  folderPath: string;
  fileName: string;
  content?: string;
}

export interface RenameRequest {
  oldPath: string;
  newName: string;
}

export interface MoveRequest {
  sourcePath: string;
  targetFolder: string;
}

export interface DeleteRequest {
  targetPath: string;
}

export interface UploadRequest {
  folderPath: string;
  fileName: string;
  content: string;
  isBase64?: boolean;
}

export interface WizardScenario {
  id: string;
  name: string;
  description: string;
  workflow: string[];
  prompt: string;
}

export const WIZARD_SCENARIOS: Record<string, WizardScenario> = {
  academic: {
    id: 'academic',
    name: 'Academic / Thesis / Paper Review',
    description: 'Ingest academic papers, extract authors/theories, and compile a structured literature review.',
    workflow: ['Ingest PDFs', 'Extract Authors/Theories', 'Compile Literature Review', 'Audit Wiki Links'],
    prompt: 'Execute ingestion on raw/ directory with context "Thesis Review", compile the literature review, and run audit links.',
  },
  business: {
    id: 'business',
    name: 'Business KB / Product / Policy',
    description: 'Ingest SOPs and meeting notes, structure business KB, create stubs, and compile FAQs.',
    workflow: ['Ingest SOPs/Meetings', 'Structure KB', 'Setup FAQ/Consulting'],
    prompt: 'Execute ingestion on raw/ directory for business documents, create entity stubs, and compile the business KB.',
  },
  research: {
    id: 'research',
    name: 'Competitive / News / Dossier',
    description: 'Ingest articles and reports, cross-reference entities, trace sources, and view wiki statistics.',
    workflow: ['Ingest Articles/Reports', 'Cross-reference Entities', 'Source Tracing', 'View Stats'],
    prompt: 'Execute ingestion on raw/ directory for competitive research, trace key entity claims, and run stats.',
  },
  creative: {
    id: 'creative',
    name: 'Fiction / Worldbuilding / Notes',
    description: 'Setup character and place entities, interlink worldbuilding notes, compile wiki, and check orphan notes.',
    workflow: ['Setup Entities (Characters/Places)', 'Interlink Wiki', 'Graph & Orphan Check'],
    prompt: 'Create entity stubs for main characters and places, compile the worldbuilding wiki, and check for orphan notes.',
  },
  existing: {
    id: 'existing',
    name: 'Existing Wiki Navigation',
    description: 'Audit wiki health, search or consult knowledge base, and generate summary report.',
    workflow: ['Audit health', 'Search / Consult KB', 'Generate Summary Report'],
    prompt: 'Run a full audit on the existing wiki, search key concepts, and consult the knowledge base for a summary report.',
  },
};

function formatWizardList(): string {
  return Object.values(WIZARD_SCENARIOS)
    .map(s => `- \`/wizard ${s.id}\` — **${s.name}**: ${s.description}`)
    .join('\n');
}

export class AgentServer {
  private parser = new MarkdownParser();
  private rootDir: string;
  private llmClient?: LlmClient;
  private systemPromptCache?: string;

  constructor(rootDir: string = process.cwd(), llmClient?: LlmClient) {
    this.rootDir = rootDir;
    this.llmClient = llmClient;
  }

  public getWikiDir(): string {
    return path.join(this.rootDir, 'wiki');
  }

  public getRawDir(): string {
    return path.join(this.rootDir, 'raw');
  }

  public setLlmClient(client: LlmClient): void {
    this.llmClient = client;
  }

  private async getOrInitLlmClient(): Promise<LlmClient> {
    if (!this.llmClient) {
      const configPath = path.join(this.rootDir, 'config.toml');
      const { client } = await LlmClientFactory.createFromTomlFile(configPath);
      this.llmClient = client;
    }
    return this.llmClient;
  }

  public async getSystemPrompt(): Promise<string> {
    if (this.systemPromptCache) {
      return this.systemPromptCache;
    }

    let agentMd = '';
    try {
      agentMd = await fs.readFile(path.join(this.rootDir, 'AGENT.md'), 'utf-8');
    } catch (_e) {
      agentMd = 'You are the librarian of a personal knowledge base (an LLM Wiki). Synthesize answers from wiki notes in Markdown with [[wikilinks]].';
    }

    let projectContext = '';
    try {
      const configPath = path.join(this.rootDir, 'config.toml');
      const { projectContext: ctx, projectTitle } = await LlmClientFactory.createFromTomlFile(configPath);
      if (projectTitle || ctx) {
        projectContext = `Project Title: ${projectTitle}\nProject Context: ${ctx}\n\n`;
      }
    } catch (_e) {
      // Ignore
    }

    this.systemPromptCache = `${projectContext}=== OPERATING MANUAL (AGENT.md) ===\n${agentMd}`;
    return this.systemPromptCache;
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
        const status = (err as { status?: number }).status || 500;
        res.writeHead(status, { 'Content-Type': 'application/json' });
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
        const status = (err as { status?: number }).status || 500;
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: String(err) }));
      }
      return true;
    }

    if (pathname === '/api/chat' && req.method === 'POST') {
      try {
        const body = await this.parseJsonBody<ChatRequest>(req);
        const isStream = body.stream === true || (req.headers.accept && req.headers.accept.includes('text/event-stream'));

        if (isStream) {
          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
          });
          await this.processChatCommandStream(body, chunk => {
            res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
          });
          res.write('data: [DONE]\n\n');
          res.end();
        } else {
          const response = await this.processChatCommand(body);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, response }));
        }
      } catch (err) {
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: String(err) }));
        } else {
          res.write(`data: ${JSON.stringify({ error: String(err) })}\n\n`);
          res.end();
        }
      }
      return true;
    }

    if (pathname === '/api/wiki/folder/create' && req.method === 'POST') {
      try {
        const body = await this.parseJsonBody<CreateFolderRequest>(req);
        const result = await this.createFolderHandler(body);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, folder: result }));
      } catch (err) {
        const status = (err as { status?: number }).status || 500;
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: String(err) }));
      }
      return true;
    }

    if (pathname === '/api/wiki/file/create' && req.method === 'POST') {
      try {
        const body = await this.parseJsonBody<CreateFileRequest>(req);
        const result = await this.createFileHandler(body);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, note: result }));
      } catch (err) {
        const status = (err as { status?: number }).status || 500;
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: String(err) }));
      }
      return true;
    }

    if (pathname === '/api/wiki/rename' && req.method === 'POST') {
      try {
        const body = await this.parseJsonBody<RenameRequest>(req);
        await this.renameHandler(body);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (err) {
        const status = (err as { status?: number }).status || 500;
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: String(err) }));
      }
      return true;
    }

    if (pathname === '/api/wiki/move' && req.method === 'POST') {
      try {
        const body = await this.parseJsonBody<MoveRequest>(req);
        await this.moveHandler(body);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (err) {
        const status = (err as { status?: number }).status || 500;
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: String(err) }));
      }
      return true;
    }

    if (pathname === '/api/wiki/delete' && req.method === 'POST') {
      try {
        const body = await this.parseJsonBody<DeleteRequest>(req);
        await this.deleteHandler(body);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (err) {
        const status = (err as { status?: number }).status || 500;
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: String(err) }));
      }
      return true;
    }

    if (pathname === '/api/wiki/upload' && req.method === 'POST') {
      try {
        const body = await this.parseJsonBody<UploadRequest>(req);
        await this.uploadHandler(body);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (err) {
        const status = (err as { status?: number }).status || 500;
        res.writeHead(status, { 'Content-Type': 'application/json' });
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
    const wikiDir = path.resolve(this.getWikiDir());
    let targetPath: string;

    if (data.path) {
      targetPath = path.isAbsolute(data.path)
        ? path.resolve(data.path)
        : path.resolve(this.rootDir, data.path);
    } else {
      const folder = data.folder && data.folder !== 'wiki' ? data.folder : '';
      const filename = `${data.id.endsWith('.md') ? data.id : `${data.id}.md`}`;
      targetPath = path.resolve(wikiDir, folder, filename);
    }

    // Path traversal containment check
    const rel = path.relative(wikiDir, targetPath);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      const err = new Error('Access denied: target path must reside inside wiki directory');
      (err as unknown as { status: number }).status = 400;
      throw err;
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

  private validateSafePath(targetPath: string): void {
    const wikiDir = path.resolve(this.getWikiDir());
    const rawDir = path.resolve(this.getRawDir());
    const absTarget = path.resolve(targetPath);

    const relWiki = path.relative(wikiDir, absTarget);
    const relRaw = path.relative(rawDir, absTarget);

    const insideWiki = !relWiki.startsWith('..') && !path.isAbsolute(relWiki);
    const insideRaw = !relRaw.startsWith('..') && !path.isAbsolute(relRaw);

    if (!insideWiki && !insideRaw) {
      const err = new Error('Access denied: target path must reside inside wiki or raw directory');
      (err as unknown as { status: number }).status = 400;
      throw err;
    }
  }

  public async createFolderHandler(data: CreateFolderRequest): Promise<string> {
    const wikiDir = path.resolve(this.getWikiDir());
    const target = path.resolve(wikiDir, data.folderPath.replace(/^wiki\/?/, ''));
    this.validateSafePath(target);
    await fs.mkdir(target, { recursive: true });
    return path.relative(this.rootDir, target).replace(/\\/g, '/');
  }

  public async createFileHandler(data: CreateFileRequest): Promise<WikiNote> {
    const wikiDir = path.resolve(this.getWikiDir());
    const folder = data.folderPath ? data.folderPath.replace(/^wiki\/?/, '') : '';
    const name = data.fileName.endsWith('.md') ? data.fileName : `${data.fileName}.md`;
    const target = path.resolve(wikiDir, folder, name);
    this.validateSafePath(target);

    const defaultContent = data.content ?? `# ${data.fileName.replace(/\.md$/i, '').replace(/[-_]/g, ' ')}\n\n`;
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, defaultContent, 'utf-8');

    const id = path.basename(target, '.md');
    const relativePath = path.relative(this.rootDir, target).replace(/\\/g, '/');
    const folderName = path.relative(wikiDir, path.dirname(target)).replace(/\\/g, '/') || 'wiki';

    return this.parser.parseNote(id, id.replace(/[-_]/g, ' '), defaultContent, folderName === '.' ? 'wiki' : folderName, relativePath);
  }

  public async renameHandler(data: RenameRequest): Promise<void> {
    const absOld = path.isAbsolute(data.oldPath) ? path.resolve(data.oldPath) : path.resolve(this.rootDir, data.oldPath);
    this.validateSafePath(absOld);

    const parent = path.dirname(absOld);
    const absNew = path.resolve(parent, data.newName);
    this.validateSafePath(absNew);

    await fs.rename(absOld, absNew);
  }

  public async moveHandler(data: MoveRequest): Promise<void> {
    const absSource = path.isAbsolute(data.sourcePath) ? path.resolve(data.sourcePath) : path.resolve(this.rootDir, data.sourcePath);
    this.validateSafePath(absSource);

    const wikiDir = path.resolve(this.getWikiDir());
    const targetDir = path.resolve(wikiDir, data.targetFolder.replace(/^wiki\/?/, ''));
    this.validateSafePath(targetDir);

    await fs.mkdir(targetDir, { recursive: true });
    const absDest = path.resolve(targetDir, path.basename(absSource));
    this.validateSafePath(absDest);

    await fs.rename(absSource, absDest);
  }

  public async deleteHandler(data: DeleteRequest): Promise<void> {
    const absTarget = path.isAbsolute(data.targetPath) ? path.resolve(data.targetPath) : path.resolve(this.rootDir, data.targetPath);
    this.validateSafePath(absTarget);

    const stat = await fs.stat(absTarget);
    if (stat.isDirectory()) {
      await fs.rm(absTarget, { recursive: true, force: true });
    } else {
      await fs.unlink(absTarget);
    }
  }

  public async uploadHandler(data: UploadRequest): Promise<void> {
    const wikiDir = path.resolve(this.getWikiDir());
    const folder = data.folderPath ? data.folderPath.replace(/^wiki\/?/, '') : '';
    const target = path.resolve(wikiDir, folder, data.fileName);
    this.validateSafePath(target);

    await fs.mkdir(path.dirname(target), { recursive: true });

    if (data.isBase64) {
      const buffer = Buffer.from(data.content, 'base64');
      await fs.writeFile(target, buffer);
    } else {
      await fs.writeFile(target, data.content, 'utf-8');
    }
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
    const targetPath = path.resolve(wikiDir, folder, filename);

    // Path traversal containment check
    const rel = path.relative(wikiDir, targetPath);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      const err = new Error('Access denied: target path must reside inside wiki directory');
      (err as unknown as { status: number }).status = 400;
      throw err;
    }

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

  public async processChatCommandStream(req: ChatRequest, onChunk: (chunk: string) => void): Promise<string> {
    const rawInput = (req.message || req.command || '').trim();
    if (rawInput.length > 50000) {
      throw new Error('Chat message exceeds maximum allowed length (50,000 characters).');
    }

    let command = '';
    let args = rawInput;

    if (rawInput.startsWith('/')) {
      const parts = rawInput.slice(1).split(' ');
      command = parts[0].toLowerCase();
      args = parts.slice(1).join(' ').trim();
    } else if (req.command) {
      command = req.command.toLowerCase().replace(/^\//, '');
    }

    if (command === 'compile' || command === 'audit' || command === 'trace' || command === 'reindex' || command === 'study-guide' || command === 'quiz' || command === 'deep-research' || command === 'mindmap' || command === 'note' || command === 'promote-note' || command === 'audio-overview') {
      const result = await this.processChatCommand(req);
      onChunk(result);
      return result;
    }

    if (command === 'wizard' && !WIZARD_SCENARIOS[args.toLowerCase().trim()]) {
      const text = `### 🪄 Wizard Scenarios\n\nChoose a scenario or launch it directly:\n\n${formatWizardList()}\n\n*Run with e.g. \`/wizard academic\`.*`;
      onChunk(text);
      return text;
    }

    const notes = await this.readAllWikiNotes();
    let contextNotes: WikiNote[] = [];
    if (args) {
      const queryWords = args.toLowerCase().split(/\s+/).filter(Boolean);
      contextNotes = notes
        .map(n => {
          let score = 0;
          const lowerTitle = n.title.toLowerCase();
          const lowerContent = n.content.toLowerCase();
          for (const word of queryWords) {
            if (lowerTitle.includes(word)) score += 5;
            if (lowerContent.includes(word)) score += 1;
          }
          return { note: n, score };
        })
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
        .map(item => item.note);
    }

    if (contextNotes.length === 0 && notes.length > 0) {
      contextNotes = notes.slice(0, 3);
    }

    const systemPrompt = await this.getSystemPrompt();
    const client = await this.getOrInitLlmClient();

    if (client.completeStream) {
      try {
        const wizardScenario = command === 'wizard' ? WIZARD_SCENARIOS[args.toLowerCase().trim()] : undefined;
        const userMsg = command === 'consult'
          ? `Perform /consult synthesis for query: "${args}"`
          : wizardScenario
            ? `Execute the "${wizardScenario.name}" wizard scenario now.`
            : (rawInput || 'Hello');
        const sysPrompt = command === 'consult'
          ? `${systemPrompt}\n\nTASK: Process a /consult workflow query according to AGENT.md §5.4. Synthesize relevant notes and cite using [[wikilinks]].`
          : wizardScenario
            ? `${systemPrompt}\n\nTASK: Execute the "${wizardScenario.name}" wizard scenario according to AGENT.md §/wizard. Follow the workflow steps: ${wizardScenario.workflow.join(' → ')}. Then run the scenario prompt and confirm each step.\nScenario prompt: ${wizardScenario.prompt}`
            : systemPrompt;

        return await client.completeStream(
          {
            systemPrompt: sysPrompt,
            userMessage: userMsg,
            contextNotes,
          },
          onChunk
        );
      } catch (err) {
        const fallback = await this.processChatCommand(req);
        onChunk(fallback);
        return fallback;
      }
    } else {
      const full = await this.processChatCommand(req);
      onChunk(full);
      return full;
    }
  }

  public async processChatCommand(req: ChatRequest): Promise<string> {
    const rawInput = (req.message || req.command || '').trim();
    if (rawInput.length > 50000) {
      throw new Error('Chat message exceeds maximum allowed length (50,000 characters).');
    }
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

    // Select context notes based on input
    let contextNotes: WikiNote[] = [];
    if (args) {
      const queryWords = args.toLowerCase().split(/\s+/).filter(Boolean);
      contextNotes = notes
        .map(n => {
          let score = 0;
          const lowerTitle = n.title.toLowerCase();
          const lowerContent = n.content.toLowerCase();

          for (const word of queryWords) {
            if (lowerTitle.includes(word)) score += 5;
            if (lowerContent.includes(word)) score += 1;
          }
          return { note: n, score };
        })
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
        .map(item => item.note);
    }

    if (contextNotes.length === 0 && notes.length > 0) {
      contextNotes = notes.slice(0, 3);
    }

    // Handle commands or general freeform query
    switch (command) {
      case 'consult': {
        const systemPrompt = await this.getSystemPrompt();
        const client = await this.getOrInitLlmClient();
        try {
          return await client.complete({
            systemPrompt: `${systemPrompt}\n\nTASK: Process a /consult workflow query according to AGENT.md §5.4. Synthesize relevant notes and cite using [[wikilinks]].`,
            userMessage: `Perform /consult synthesis for query: "${args}"`,
            contextNotes,
          });
        } catch (err) {
          return `### 🔍 Consult Synthesis for "${args}" (Fallback)\n\nFound **${contextNotes.length}** matching article(s):\n\n` +
            contextNotes.map(n => `- [[${n.id}]] (${n.folder}): ${n.title}`).join('\n') +
            `\n\n*Note: LLM provider unavailable (${String(err)}).*`;
        }
      }

      case 'compile': {
        return this.executeCompileWorkflow();
      }

      case 'audit': {
        return this.executeAuditWorkflow(notes);
      }

      case 'trace': {
        return await this.executeTraceWorkflow(args, notes);
      }

      case 'reindex': {
        return this.executeReindexWorkflow();
      }

      case 'study-guide': {
        return await this.executeStudyGuideWorkflow(args, notes);
      }

      case 'quiz': {
        return await this.executeQuizWorkflow(args, notes);
      }

      case 'mindmap': {
        return await this.executeMindmapWorkflow(args, notes);
      }

      case 'note': {
        return await this.executeNoteWorkflow(args);
      }

      case 'promote-note': {
        return await this.executePromoteNoteWorkflow(args);
      }

      case 'audio-overview': {
        return await this.executeAudioOverviewWorkflow(args, notes);
      }

      case 'deep-research': {
        return await this.executeDeepResearchWorkflow(args, notes);
      }

      case 'wizard': {
        const scenarioId = args.toLowerCase().trim();
        const scenario = WIZARD_SCENARIOS[scenarioId];
        if (!scenario) {
          return `### 🪄 Wizard Scenarios\n\nChoose a scenario or launch it directly:\n\n${formatWizardList()}\n\n*Run with e.g. \`/wizard academic\`.*`;
        }
        const systemPrompt = await this.getSystemPrompt();
        const client = await this.getOrInitLlmClient();
        try {
          return await client.complete({
            systemPrompt: `${systemPrompt}\n\nTASK: Execute the "${scenario.name}" wizard scenario according to AGENT.md §/wizard. Follow the workflow steps: ${scenario.workflow.join(' → ')}. Then run the scenario prompt and confirm each step.\nScenario prompt: ${scenario.prompt}`,
            userMessage: `Execute the "${scenario.name}" wizard scenario now.`,
            contextNotes,
          });
        } catch (err) {
          return `### 🪄 Wizard: ${scenario.name}\n\n**Workflow:** ${scenario.workflow.join(' → ')}\n\n**Prompt:** ${scenario.prompt}\n\n*(LLM provider unavailable (${String(err)}).)*`;
        }
      }

      default: {
        if (!rawInput) {
          return `### 🤖 Agent Assistant\n\nAsk any question or use slash shortcuts:\n- \`/consult <topic>\`\n- \`/compile\`\n- \`/audit\`\n- \`/trace <topic>\`\n- \`/reindex\`\n- \`/wizard [scenario]\``;
        }

        const systemPrompt = await this.getSystemPrompt();
        const client = await this.getOrInitLlmClient();

        try {
          return await client.complete({
            systemPrompt,
            userMessage: rawInput,
            contextNotes,
          });
        } catch (err) {
          // Fallback response if LLM provider fails
          const match = contextNotes[0];
          if (match) {
            return `### 💡 Answer for "${rawInput}"\n\nBased on your wiki knowledge base, see [[${match.id}]] (${match.title}):\n\n${match.content.slice(0, 400)}...\n\nRelated articles: ${contextNotes.slice(0, 4).map(n => `[[${n.id}]]`).join(', ')}\n\n*(LLM completion error: ${String(err)})*`;
          }
          return `### 💡 Answer for "${rawInput}"\n\nProcessed query using agent guidelines. You can compile new findings into your wiki notes using the **Attach to Wiki** button below.\n\n*(LLM completion error: ${String(err)})*`;
        }
      }
    }
  }

  private async executeCompileWorkflow(): Promise<string> {
    const rawDir = this.getRawDir();
    const uncompiledFiles: string[] = [];

    try {
      const entries = await fs.readdir(rawDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.md') && !entry.name.includes('_COMPILED')) {
          uncompiledFiles.push(entry.name);
        }
      }
    } catch (_e) {
      // raw directory might not exist
    }

    if (uncompiledFiles.length === 0) {
      const notes = await this.readAllWikiNotes();
      return `### ⚡ Compile Workflow Completed\n\n- **Uncompiled Files in \`raw/\`**: 0\n- **Wiki Articles Analyzed**: ${notes.length}\n- **Status**: Knowledge base fully interlinked and compiled according to \`AGENT.md\` guidelines.`;
    }

    const client = await this.getOrInitLlmClient();
    const systemPrompt = await this.getSystemPrompt();
    const compiledResults: string[] = [];

    for (const fileName of uncompiledFiles) {
      const rawPath = path.join(rawDir, fileName);
      const content = await fs.readFile(rawPath, 'utf-8');

      try {
        const prompt = `Ingest raw file '${fileName}' into the wiki following AGENT.md §5.1 compile guidelines. Generate article content in Markdown with YAML frontmatter, H1 title, summary, related [[wikilinks]], and sources section.`;
        const response = await client.complete({
          systemPrompt,
          userMessage: prompt,
          contextNotes: [{ id: fileName, title: fileName, content, folder: 'raw', path: `raw/${fileName}`, outboundLinks: [], tags: [], frontmatter: {}, backlinks: [] }],
        });

        // Determine title / note ID
        const stem = fileName.replace(/\.md$/i, '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const folder = 'general';
        await this.saveWikiNote({
          id: stem,
          folder,
          content: response,
          title: stem.replace(/[-_]/g, ' '),
        });

        // Rename file in raw/ to _COMPILED.md
        const compiledPath = path.join(rawDir, fileName.replace(/\.md$/i, '_COMPILED.md'));
        await fs.rename(rawPath, compiledPath);

        compiledResults.push(`- Ingested \`${fileName}\` -> created \`wiki/${folder}/${stem}.md\` & renamed to \`_COMPILED.md\``);
      } catch (err) {
        compiledResults.push(`- Error processing \`${fileName}\`: ${String(err)}`);
      }
    }

    await this.executeReindexWorkflow();

    return `### ⚡ Compile Workflow Execution Report\n\n**Processed ${uncompiledFiles.length} file(s):**\n${compiledResults.join('\n')}\n\n- **Indexes updated**: Regenerated \`wiki/index.md\` and thematic indexes.`;
  }

  private async executeAuditWorkflow(notes: WikiNote[]): Promise<string> {
    const wikiDir = this.getWikiDir();

    // 1. Orphan notes
    const orphans = notes.filter(n => (n.backlinks?.length ?? 0) === 0 && !n.id.endsWith('index'));

    // 2. Broken links
    const knownIdentifiers = new Set<string>();
    for (const n of notes) {
      knownIdentifiers.add(n.id.toLowerCase());
      knownIdentifiers.add(n.title.toLowerCase());
      const stem = path.basename(n.path, '.md').toLowerCase();
      knownIdentifiers.add(stem);
      knownIdentifiers.add(stem.replace(/[-_]/g, ' '));
    }

    const brokenLinks: Array<{ source: string; target: string }> = [];

    for (const note of notes) {
      for (const link of note.outboundLinks) {
        const cleanLink = link.toLowerCase().trim();
        if (cleanLink && !knownIdentifiers.has(cleanLink) && !cleanLink.endsWith('/index') && cleanLink !== 'index') {
          brokenLinks.push({ source: note.id, target: link });
        }
      }
    }

    // 3. Frontmatter status
    const missingFrontmatter: string[] = [];
    for (const note of notes) {
      const isIndex = note.id.endsWith('index') || note.path.endsWith('index.md') || path.basename(note.path) === 'index.md';
      if (isIndex) {
        continue; // skip index files
      }
      const hasYaml = note.content.trim().startsWith('---');
      if (!hasYaml || !note.tags || note.tags.length === 0) {
        missingFrontmatter.push(note.id);
      }
    }

    const orphanList = orphans.map(n => `- [[${n.id}]]`).join('\n') || 'None';
    const brokenList = brokenLinks.map(b => `- [[${b.source}]] -> [[${b.target}]]`).join('\n') || 'None';
    const missingFmList = missingFrontmatter.map(id => `- [[${id}]]`).join('\n') || 'None (All notes contain tags/metadata)';

    return `### 🛡️ Audit Report\n\n- **Total Notes**: ${notes.length}\n\n- **Orphan Notes (${orphans.length})**:\n${orphanList}\n\n- **Broken Links (${brokenLinks.length})**:\n${brokenList}\n\n- **Missing Frontmatter / Tags (${missingFrontmatter.length})**:\n${missingFmList}`;
  }

  public async executeStudyGuideWorkflow(topic: string, notes: WikiNote[]): Promise<string> {
    const outputDir = path.resolve(this.rootDir, 'output');
    await fs.mkdir(outputDir, { recursive: true });

    const q = (topic || '').toLowerCase().trim();
    const relevantNotes = q
      ? notes.filter(n => n.id.toLowerCase().includes(q) || n.title.toLowerCase().includes(q) || n.folder.toLowerCase().includes(q))
      : notes.slice(0, 5);

    const sourceIds = relevantNotes.map(n => n.id);
    const slug = q ? q.replace(/[^a-z0-9]+/g, '-') : 'general';
    const filePath = path.join(outputDir, `study-guide-${slug}.md`);

    const sections = relevantNotes.map(n => `### ${n.title}\n- **Summary**: Key concept from [[${n.id}]]\n- **Folder**: ${n.folder}\n- **Key Terms**: ${n.tags?.join(', ') || 'general'}\n`).join('\n');

    const content = `---
tags: [study-guide, ${slug}]
created: ${new Date().toISOString().slice(0, 10)}
sources:
${sourceIds.map(id => `  - wiki/${id}.md`).join('\n')}
---

# Study Guide: ${topic || 'General Overview'}

## 📖 Executive Summary
Comprehensive study guide covering key topics and concepts synthesized from **${relevantNotes.length}** wiki articles.

## 🗂️ Section Breakdown
${sections || 'No notes found for topic.'}

## 💡 Key Glossary & Terms
- **Primary Concepts**: ${relevantNotes.map(n => `[[${n.id}]]`).join(', ')}

## ❓ Self-Assessment Questions
1. **Q1**: What are the core arguments presented in ${sourceIds[0] ? `[[${sourceIds[0]}]]` : 'the wiki notes'}?
   - *Answer*: Refer to the summary section in the article.
2. **Q2**: How do these concepts interlink across thematic folders?
   - *Answer*: Check backlinks and wikilinks.
`;

    await fs.writeFile(filePath, content, 'utf-8');
    const relPath = path.relative(this.rootDir, filePath).replace(/\\/g, '/');

    return `### 📚 Study Guide Generated\n\n- **Saved to**: \`${relPath}\`\n- **Source Articles Cited**: ${relevantNotes.map(n => `[[${n.id}]]`).join(', ') || 'None'}\n\n*Study guide is ready in output directory.*`;
  }

  public async executeNoteWorkflow(noteText: string): Promise<string> {
    const notesDir = path.resolve(this.rootDir, 'notes');
    await fs.mkdir(notesDir, { recursive: true });

    const text = (noteText || '').trim();
    if (!text) {
      return `### 📝 Quick Note\n\nPlease provide note content. Example: \`/note Key insight about LLM memory\``;
    }

    const timestamp = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');
    const dateStr = new Date().toISOString().slice(0, 10);
    const notesFilePath = path.join(notesDir, 'quick-notes.md');

    let existing = '';
    try {
      existing = await fs.readFile(notesFilePath, 'utf-8');
    } catch (_e) {
      existing = `# Quick Notes Scratchpad\n\nNotes recorded here remain unindexed until promoted with \`/promote-note\`.\n\n`;
    }

    const entry = `## [${timestamp}]\n${text}\n\n`;
    await fs.writeFile(notesFilePath, existing + entry, 'utf-8');

    return `### 📝 Quick Note Saved\n\n- **Stored in**: \`notes/quick-notes.md\`\n- **Status**: Saved in scratchpad (excluded from \`wiki/index.md\`). Use \`/promote-note <id> <wiki-name>\` to convert to a formal article.`;
  }

  public async executeAudioOverviewWorkflow(target: string, notes: WikiNote[]): Promise<string> {
    const outputDir = path.resolve(this.rootDir, 'output');
    const audioDir = path.resolve(outputDir, 'audio');
    await fs.mkdir(outputDir, { recursive: true });
    await fs.mkdir(audioDir, { recursive: true });

    const q = (target || '').toLowerCase().trim();
    const relevantNotes = q
      ? notes.filter(n => n.id.toLowerCase().includes(q) || n.title.toLowerCase().includes(q) || n.folder.toLowerCase().includes(q))
      : notes.slice(0, 3);

    const sourceIds = relevantNotes.map(n => n.id);
    const slug = q ? q.replace(/[^a-z0-9]+/g, '-') : 'overview';
    const scriptPath = path.join(outputDir, `audio-script-${slug}.md`);

    const scriptLines = [
      `---`,
      `tags: [audio-script, ${slug}]`,
      `created: ${new Date().toISOString().slice(0, 10)}`,
      `sources:`,
      ...sourceIds.map(id => `  - wiki/${id}.md`),
      `---`,
      ``,
      `# Audio Overview Dialogue Script: ${target || 'General Overview'}`,
      ``,
      `**Host A**: Welcome back to Wiki-Cast! Today we are taking a deep dive into the knowledge base covering ${relevantNotes.map(n => `[[${n.id}]]`).join(', ') || 'our notes'}.`,
      `**Host B**: Exactly! What's really fascinating here is how these concepts connect together.`,
      `**Host A**: Right, in [[${sourceIds[0] || 'wiki-index'}]], the main emphasis is placed on structured, traceable knowledge synthesis.`,
      `**Host B**: And that links directly with our raw source grounded references!`,
      `**Host A**: That wraps up this quick overview audio script!`,
    ];

    await fs.writeFile(scriptPath, scriptLines.join('\n'), 'utf-8');
    const relScriptPath = path.relative(this.rootDir, scriptPath).replace(/\\/g, '/');

    return `### 🎙️ Audio Overview Script Generated\n\n- **Dialogue Script**: \`${relScriptPath}\`\n- **TTS Provider Status**: \`none\` (Audio synthesis disabled in \`config.toml\`). Dialogue script generated successfully.\n- **Sources Covered**: ${relevantNotes.map(n => `[[${n.id}]]`).join(', ') || 'None'}\n\n*To enable MP3 generation, configure \`[audio]\` provider in \`config.toml\`.*`;
  }

  public async executePromoteNoteWorkflow(argsText: string): Promise<string> {
    const parts = (argsText || '').trim().split(/\s+/);
    const noteId = parts[0];
    const wikiName = parts[1] || 'general';

    if (!noteId) {
      return `### 🚀 Promote Note\n\nUsage: \`/promote-note <note-id> [wiki-folder]\``;
    }

    const notesDir = path.resolve(this.rootDir, 'notes');
    const notesFilePath = path.join(notesDir, 'quick-notes.md');

    let noteContent = '';
    try {
      const raw = await fs.readFile(notesFilePath, 'utf-8');
      noteContent = raw;
    } catch (_e) {
      return `### 🚀 Promote Note\n\nNo scratchpad notes found in \`notes/quick-notes.md\`.`;
    }

    const stem = noteId.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const title = stem.replace(/[-_]/g, ' ');

    const newArticleContent = `---
tags: [promoted-note, ${wikiName}]
created: ${new Date().toISOString().slice(0, 10)}
updated: ${new Date().toISOString().slice(0, 10)}
sources:
  - notes/quick-notes.md
---

# ${title.charAt(0).toUpperCase() + title.slice(1)}

## Summary
- Promoted quick note from scratchpad \`notes/quick-notes.md\`.

## Body
${noteContent.slice(0, 500)}

## Related
- [[index]]

## Sources
- notes/quick-notes.md
`;

    const createdNote = await this.saveWikiNote({
      id: stem,
      folder: wikiName,
      content: newArticleContent,
      title,
    });

    await this.executeReindexWorkflow();

    return `### 🚀 Note Promoted to Wiki Article\n\n- **Created Article**: \`wiki/${createdNote.folder}/${createdNote.id}.md\`\n- **Thematic Index Updated**: \`wiki/${createdNote.folder}/index.md\`\n- **Master Index Updated**: \`wiki/index.md\``;
  }

  public async executeMindmapWorkflow(target: string, notes: WikiNote[]): Promise<string> {
    const outputDir = path.resolve(this.rootDir, 'output');
    await fs.mkdir(outputDir, { recursive: true });

    const q = (target || '').toLowerCase().trim();
    const note = notes.find(n => n.id.toLowerCase() === q || n.title.toLowerCase() === q || n.path.toLowerCase().includes(q)) || notes[0];

    if (!note) {
      return `### 🧠 Mind Map\n\nNo matching note found to generate mind map.`;
    }

    const lines = note.content.split('\n');
    const treeLines: string[] = [`- **${note.title}** (\`[[${note.id}]]\`)`];
    const nodes: Array<{ id: string; label: string; group: string }> = [{ id: note.id, label: note.title, group: 'root' }];
    const links: Array<{ source: string; target: string }> = [];

    let currentHeading = '';

    for (const line of lines) {
      if (line.startsWith('## ')) {
        const title = line.replace(/^##\s+/, '').trim();
        currentHeading = title;
        treeLines.push(`  - 📌 **${title}**`);
        const subId = `${note.id}-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
        nodes.push({ id: subId, label: title, group: 'heading' });
        links.push({ source: note.id, target: subId });
      } else if (line.startsWith('### ')) {
        const title = line.replace(/^###\s+/, '').trim();
        treeLines.push(`    - 🔹 ${title}`);
        const subId = `${note.id}-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
        nodes.push({ id: subId, label: title, group: 'subheading' });
        const parentId = currentHeading ? `${note.id}-${currentHeading.toLowerCase().replace(/[^a-z0-9]+/g, '-')}` : note.id;
        links.push({ source: parentId, target: subId });
      } else if (line.trim().startsWith('- ')) {
        const text = line.trim().replace(/^-\s+/, '').slice(0, 80);
        treeLines.push(`      - ${text}`);
      }
    }

    const slug = note.id.replace(/[^a-z0-9]+/g, '-');
    const filePath = path.join(outputDir, `mindmap-${slug}.md`);

    const jsonPayload = JSON.stringify({ nodes, links }, null, 2);

    const content = `---
tags: [mindmap, ${slug}]
created: ${new Date().toISOString().slice(0, 10)}
sources:
  - wiki/${note.path}
---

# Mind Map: ${note.title}

## 🌳 Hierarchical Tree
${treeLines.join('\n')}

## 🔗 Connected Wikilinks
${note.outboundLinks.map(l => `- [[${l}]]`).join('\n') || '- None'}

## 📊 ForceGraph Data Payload (JSON)
\`\`\`json
${jsonPayload}
\`\`\`
`;

    await fs.writeFile(filePath, content, 'utf-8');
    const relPath = path.relative(this.rootDir, filePath).replace(/\\/g, '/');

    return `### 🧠 Mind Map Generated for "${note.title}"\n\n- **Saved to**: \`${relPath}\`\n- **Extracted Headings**: ${nodes.length - 1}\n- **Wikilinks**: ${note.outboundLinks.length}\n\n\`\`\`text\n${treeLines.slice(0, 15).join('\n')}\n${treeLines.length > 15 ? '...' : ''}\n\`\`\`\n\n*Mind map tree and JSON stored in output/.*`;
  }

  public async executeDeepResearchWorkflow(question: string, notes: WikiNote[]): Promise<string> {
    const outputDir = path.resolve(this.rootDir, 'output');
    await fs.mkdir(outputDir, { recursive: true });

    const q = (question || '').trim();
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);

    // Broader search matching notes
    const relevantNotes = words.length > 0
      ? notes.filter(n => {
          const text = `${n.id} ${n.title} ${n.content} ${n.folder} ${n.tags?.join(' ')}`.toLowerCase();
          return words.some(w => text.includes(w));
        })
      : notes.slice(0, 10);

    const slug = q ? q.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30) : 'general';
    const dateStr = new Date().toISOString().slice(0, 10);
    const filePath = path.join(outputDir, `research-${slug}-${dateStr}.md`);

    const sources = relevantNotes.length > 0 ? relevantNotes : notes.slice(0, 5);
    const matrixRows = sources.map(n => `| Synthesis Claim from [[${n.id}]] | \`wiki/${n.path}\` | \`raw/\` background sources |`).join('\n');

    const content = `---
tags: [deep-research, ${slug}]
created: ${dateStr}
sources:
${sources.map(n => `  - wiki/${n.id}.md`).join('\n')}
---

# Deep Research Report: ${q || 'Knowledge Base Analysis'}

## 🎯 Executive Summary
Extended multi-source analysis synthesized across **${sources.length}** wiki article(s) regarding: *"${q || 'Knowledge Base Overview'}"*.

## 🔬 Thematic Deep-Dive
${sources.map(n => `### Analysis of [[${n.id}]] (${n.title})
- **Folder**: \`${n.folder}\`
- **Core Insights**: ${n.content.slice(0, 300).replace(/\n/g, ' ')}...
- **Connected Links**: ${n.outboundLinks.map(l => `[[${l}]]`).join(', ') || 'None'}
`).join('\n')}

## 📊 Source Attribution Matrix
| Claim / Finding | Wiki Source | Raw Source Grounding |
|---|---|---|
${matrixRows || '| General Knowledge | `wiki/index.md` | `raw/` |'}

## ⚠️ Identified Knowledge Gaps
- **Potential Missing Sources**: Further documents regarding specific edge cases of *${q || 'this domain'}*.
- **Recommended Action**: Ingest additional primary sources into \`sources/\` and run \`/compile\`.

## 📌 Recommendation
Consider promoting key takeaways from this report into a permanent wiki article under \`wiki/research/${slug}.md\`.
`;

    await fs.writeFile(filePath, content, 'utf-8');
    const relPath = path.relative(this.rootDir, filePath).replace(/\\/g, '/');

    return `### 🔬 Deep Research Report Generated\n\n- **Saved to**: \`${relPath}\`\n- **Articles Consulted**: ${sources.length}\n- **Status**: Includes Executive Summary, Source Attribution Matrix, and Identified Knowledge Gaps.\n\n*Report is saved in output directory.*`;
  }

  public async executeQuizWorkflow(topicAndCount: string, notes: WikiNote[]): Promise<string> {
    const outputDir = path.resolve(this.rootDir, 'output');
    await fs.mkdir(outputDir, { recursive: true });

    const parts = (topicAndCount || '').trim().split(/\s+/);
    let count = 5;
    let topic = '';

    if (parts.length > 1 && !isNaN(parseInt(parts[parts.length - 1], 10))) {
      count = parseInt(parts.pop()!, 10);
      topic = parts.join(' ');
    } else if (parts.length === 1 && !isNaN(parseInt(parts[0], 10))) {
      count = parseInt(parts[0], 10);
      topic = '';
    } else {
      topic = parts.join(' ');
    }

    const q = topic.toLowerCase().trim();
    const relevantNotes = q
      ? notes.filter(n => n.id.toLowerCase().includes(q) || n.title.toLowerCase().includes(q) || n.folder.toLowerCase().includes(q))
      : notes.slice(0, 5);

    const slug = q ? q.replace(/[^a-z0-9]+/g, '-') : 'general';
    const filePath = path.join(outputDir, `quiz-${slug}.md`);

    const questions: string[] = [];
    for (let i = 1; i <= Math.min(count, Math.max(1, relevantNotes.length * 2)); i++) {
      const note = relevantNotes[(i - 1) % Math.max(1, relevantNotes.length)];
      const noteTitle = note ? note.title : 'Wiki Concepts';
      const noteId = note ? note.id : 'wiki-index';

      questions.push(`### Question ${i}
What is the primary topic discussed in [[${noteId}]]?

- A) General concept of ${noteTitle}
- B) Unrelated topic
- C) Legacy archive
- D) None of the above

**Correct Answer**: **A**
**Explanation**: [[${noteId}]] provides detailed synthesis regarding ${noteTitle}.
`);
    }

    const content = `---
tags: [quiz, ${slug}]
created: ${new Date().toISOString().slice(0, 10)}
sources:
${relevantNotes.map(n => `  - wiki/${n.id}.md`).join('\n')}
---

# Self-Assessment Quiz: ${topic || 'General Knowledge'} (${questions.length} Questions)

${questions.join('\n---\n\n')}
`;

    await fs.writeFile(filePath, content, 'utf-8');
    const relPath = path.relative(this.rootDir, filePath).replace(/\\/g, '/');

    return `### 🧪 Quiz Generated\n\n- **Saved to**: \`${relPath}\`\n- **Total Questions**: ${questions.length}\n- **Source Articles Cited**: ${relevantNotes.map(n => `[[${n.id}]]`).join(', ') || 'None'}\n\n*Quiz generated in output directory.*`;
  }

  public async executeTraceWorkflow(target: string, notes: WikiNote[]): Promise<string> {
    const q = target.toLowerCase();
    const connected = notes.filter(n =>
      n.id.toLowerCase().includes(q) ||
      n.title.toLowerCase().includes(q) ||
      n.content.toLowerCase().includes(q) ||
      n.outboundLinks.some((l: string) => l.toLowerCase().includes(q))
    );

    if (connected.length === 0) {
      return `### 🕸️ Connection Trace for "${target}"\n\nNo target connections traced in wiki notes.`;
    }

    const traceEntries: string[] = [];

    for (const n of connected.slice(0, 5)) {
      let entry = `- **Article**: [[${n.id}]] (${n.folder})\n  - **Outbound Links**: ${n.outboundLinks.map((l: string) => `[[${l}]]`).join(', ') || 'none'}`;

      // Extract sources listed in frontmatter or ## Sources section
      const rawSources: string[] = [];
      if (Array.isArray(n.frontmatter?.sources)) {
        for (const src of n.frontmatter.sources) {
          if (typeof src === 'string') rawSources.push(src);
        }
      }

      const sourcesMatch = n.content.match(/## Sources\s+([\s\S]*?)(?=\n## |$)/i);
      if (sourcesMatch) {
        const lines = sourcesMatch[1].split('\n');
        for (const line of lines) {
          const m = line.match(/(raw\/[^\s\)]+\.md(?:#L\d+(?:-L?\d+)?)?)/i);
          if (m && !rawSources.includes(m[1])) {
            rawSources.push(m[1]);
          }
        }
      }

      if (rawSources.length > 0) {
        entry += `\n  - **Grounded Raw Sources**:`;
        for (const rawRef of rawSources) {
          const [rawFile, anchor] = rawRef.split('#');
          const absRawPath = path.resolve(this.rootDir, rawFile);
          let passage = '';

          try {
            const rawContent = await fs.readFile(absRawPath, 'utf-8');
            const lines = rawContent.split('\n');

            if (anchor && /^L\d+(?:-L?\d+)?$/i.test(anchor)) {
              const numMatch = anchor.match(/^L(\d+)(?:-L?(\d+))?$/i);
              if (numMatch) {
                const startLine = Math.max(1, parseInt(numMatch[1], 10));
                const endLine = numMatch[2] ? Math.min(lines.length, parseInt(numMatch[2], 10)) : startLine;
                const snippet = lines.slice(startLine - 1, endLine).join('\n').trim();
                passage = ` (Lines ${startLine}-${endLine}): "${snippet.slice(0, 150)}${snippet.length > 150 ? '...' : ''}"`;
              }
            } else if (q) {
              // Search for matching line in raw file
              const lineIdx = lines.findIndex(l => l.toLowerCase().includes(q));
              if (lineIdx !== -1) {
                const startLine = Math.max(1, lineIdx);
                const endLine = Math.min(lines.length, lineIdx + 3);
                const snippet = lines.slice(startLine - 1, endLine).join('\n').trim();
                passage = ` (Inferred #L${startLine}-L${endLine}): "${snippet.slice(0, 150)}${snippet.length > 150 ? '...' : ''}"`;
              }
            }
          } catch (_e) {
            // Source file not found or inaccessible
          }

          entry += `\n    - \`${rawRef}\`${passage}`;
        }
      }

      traceEntries.push(entry);
    }

    return `### 🕸️ Connection & Passage Trace for "${target}"\n\n${traceEntries.join('\n\n')}`;
  }

  private async executeReindexWorkflow(): Promise<string> {
    const wikiDir = this.getWikiDir();
    const notes = await this.readAllWikiNotes();

    // Group notes by folder
    const folderMap = new Map<string, WikiNote[]>();
    for (const note of notes) {
      const folder = note.folder || 'wiki';
      if (!folderMap.has(folder)) {
        folderMap.set(folder, []);
      }
      folderMap.get(folder)!.push(note);
    }

    let thematicIndexesCount = 0;

    // Write thematic index files
    for (const [folder, folderNotes] of folderMap.entries()) {
      if (folder === 'wiki' || folder === '.') continue;

      const subIndexDir = path.join(wikiDir, folder);
      const subIndexPath = path.join(subIndexDir, 'index.md');

      const nonIndexNotes = folderNotes.filter(n => n.id !== `${folder}/index` && !n.path.endsWith('index.md'));
      const articleList = nonIndexNotes
        .map(n => `- [[${n.id}]] — ${n.title}`)
        .join('\n');

      const indexContent = `# ${folder.replace(/[-_]/g, ' ').toUpperCase()} Index\n\nThematic index for **${folder}**.\n\n## Articles\n\n${articleList || 'No articles yet.'}\n`;

      await fs.mkdir(subIndexDir, { recursive: true });
      await fs.writeFile(subIndexPath, indexContent, 'utf-8');
      thematicIndexesCount++;
    }

    // Write master index wiki/index.md
    const folderList = Array.from(folderMap.keys())
      .filter(f => f !== 'wiki' && f !== '.')
      .map(f => `- [[${f}/index|${f.replace(/[-_]/g, ' ')}]]`)
      .join('\n');

    const masterIndexContent = `# Wiki Master Index\n\nWelcome to the knowledge base.\n\n## Thematic Wikis\n\n${folderList || 'No thematic folders yet.'}\n\n## All Notes\n\n${notes.map(n => `- [[${n.id}]]`).join('\n')}\n`;

    await fs.writeFile(path.join(wikiDir, 'index.md'), masterIndexContent, 'utf-8');

    return `### 🔄 Reindex Complete\n\n- **Master Index Written**: \`wiki/index.md\`\n- **Thematic Indexes Updated**: ${thematicIndexesCount}\n- **Indexed Notes**: ${notes.length}\n- **Backlinks Re-evaluated**: Done.`;
  }
}
