import './styles/theme.css';
import './styles/sidebar.css';
import './styles/chat-drawer.css';
import './styles/editor.css';

import { WikiNote } from './core/types/wiki';
import { MarkdownParser } from './services/markdownParser';
import { GraphService } from './services/graphService';
import { ApiStorage } from './storage/ApiStorage';
import { MainLayout } from './components/ui/MainLayout';
import { Header } from './components/ui/Header';
import { Sidebar } from './components/ui/Sidebar';
import { MarkdownEditor } from './components/editor/MarkdownEditor';
import { ContextPanel } from './components/editor/ContextPanel';
import { ForceGraphViewer } from './components/graph/ForceGraphViewer';
import { GraphControls } from './components/graph/GraphControls';
import { ChatDrawer } from './components/chat/ChatDrawer';

export class WikiForgeApp {
  private parser = new MarkdownParser();
  private graphService = new GraphService();
  private storage = new ApiStorage();
  private notes: WikiNote[] = [];
  private selectedNote: WikiNote | null = null;
  private filterTags: string[] = [];

  private layout!: MainLayout;
  private header!: Header;
  private sidebar!: Sidebar;
  private editor!: MarkdownEditor;
  private contextPanel!: ContextPanel;
  private graphViewer!: ForceGraphViewer;
  private graphControls!: GraphControls;
  private chatDrawer!: ChatDrawer;

  constructor(rootContainer: HTMLElement) {
    this.layout = new MainLayout(rootContainer);
    this.initUI();
    void this.loadVault();
  }

  private async loadVault(): Promise<void> {
    let notes = await this.storage.getAllNotes();
    if (notes.length === 0) {
      notes = this.buildSampleVault();
    }
    this.notes = this.parser.computeBacklinks(notes);
    this.selectedNote = this.notes[0] ?? null;
    this.refreshAll();
  }

  private buildSampleVault(): WikiNote[] {
    const raw = [
      [
        '01-index',
        'System Architecture',
        `---
title: System Architecture
tags: [architecture, core]
---
# System Architecture

The **Wiki-Forge** project utilizes a decoupled architecture split into UI, Core Services, and Storage.

- See [[02-c64-dev]] for assembly details.
- See [[03-llm-agent]] for agent pipeline.
`,
      ],
      [
        '02-c64-dev',
        'C64 Development',
        `---
title: C64 Development
tags: [assembly, c64]
---
# C64 Development

Commodore 64 assembly programming techniques and memory maps.

Links to [[01-index]].
`,
      ],
      [
        '03-llm-agent',
        'LLM Agent Pipeline',
        `---
title: LLM Agent Pipeline
tags: [python, agent, llm]
---
# LLM Agent Pipeline

Automated wiki compilation and RAG knowledge retrieval.

Backlink to [[01-index]].
`,
      ],
    ];

    return raw.map(([id, title, content]) =>
      this.parser.parseNote(id, title, content, 'wiki', `wiki/${id}.md`)
    );
  }

  private initUI(): void {
    this.header = new Header(
      this.layout.headerContainer,
      mode => {
        this.layout.setViewMode(mode);
      },
      () => {
        this.chatDrawer.toggle();
      }
    );

    this.sidebar = new Sidebar(
      this.layout.sidebarContainer,
      noteId => {
        this.selectNote(noteId);
      },
      tags => {
        this.filterTags = tags;
        this.refreshGraph();
      },
      {
        onCreateFolder: async (parent, name) => {
          const folderPath = `${parent}/${name}`;
          await this.storage.createFolder(folderPath);
          await this.loadVault();
        },
        onCreateFile: async (parent, fileName) => {
          await this.storage.createFile(parent, fileName);
          await this.loadVault();
        },
        onRename: async (oldPath, newName) => {
          await this.storage.renameItem(oldPath, newName);
          await this.loadVault();
        },
        onMove: async (sourcePath, targetFolder) => {
          await this.storage.moveItem(sourcePath, targetFolder);
          await this.loadVault();
        },
        onDelete: async (path) => {
          await this.storage.deleteNote(path);
          await this.loadVault();
        },
        onUpload: async (folderPath, files) => {
          for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const text = await file.text();
            await this.storage.uploadFile(folderPath, file.name, text);
          }
          await this.loadVault();
        },
      }
    );

    this.editor = new MarkdownEditor(
      this.layout.editorContainer,
      (noteId, content) => {
        void this.updateAndSaveNote(noteId, content);
      },
      target => this.openWikilink(target),
      () => this.notes
    );

    this.contextPanel = new ContextPanel(this.layout.contextContainer, noteId => {
      this.selectNote(noteId);
    });

    this.graphViewer = new ForceGraphViewer();
    this.graphViewer.render(this.layout.graphContainer, { nodes: [], links: [] });
    this.graphViewer.onNodeClick(nodeId => {
      this.selectNote(nodeId);
      this.layout.setViewMode('split');
    });

    this.graphControls = new GraphControls(this.layout.graphControlsContainer, {
      onFilterChange: options => {
        const fullData = this.graphService.generateGraphData(this.notes);
        const filtered = this.graphService.filterGraphData(fullData, {
          ...options,
          selectedTags: this.filterTags,
        });
        this.graphViewer.updateData(filtered);
      },
      onZoom: action => {
        if (action === 'in') this.graphViewer.zoomBy(1.4);
        else if (action === 'out') this.graphViewer.zoomBy(1 / 1.4);
        else this.graphViewer.zoomToFit();
      },
    });

    this.chatDrawer = new ChatDrawer(
      this.layout.chatContainer,
      this.storage,
      () => this.notes,
      () => {
        void this.loadVault();
      },
      target => this.openWikilink(target)
    );

    this.layout.setViewMode('split');
  }

  private refreshAll(): void {
    this.sidebar.setNotes(this.notes);
    if (this.selectedNote) this.sidebar.setActiveNote(this.selectedNote.id);
    this.editor.setNote(this.selectedNote);
    this.contextPanel.setSelectedNote(this.selectedNote);
    this.refreshGraph();
  }

  private refreshGraph(): void {
    const full = this.graphService.generateGraphData(this.notes);
    const filtered = this.graphService.filterGraphData(full, { selectedTags: this.filterTags });
    this.graphViewer.updateData(filtered);
  }

  public selectNote(noteId: string): void {
    const found = this.notes.find(
      n => n.id === noteId || n.title.toLowerCase() === noteId.toLowerCase()
    );
    if (found) {
      this.selectedNote = found;
      this.sidebar.setActiveNote(found.id);
      this.editor.setNote(found);
      this.contextPanel.setSelectedNote(found);
      this.graphViewer.highlightNode(found.id);
    }
  }

  public openWikilink(target: string): void {
    const found = this.parser.resolveLinkTarget(target, this.notes);
    if (found) {
      this.selectNote(found.id);
    }
  }

  private async updateAndSaveNote(noteId: string, newContent: string): Promise<void> {
    const target = this.notes.find(n => n.id === noteId);
    if (!target) return;

    const saved = await this.storage.saveNote({
      id: noteId,
      content: newContent,
      folder: target.folder,
      path: target.path,
      title: target.title,
    });

    const idx = this.notes.findIndex(n => n.id === noteId);
    if (idx !== -1) {
      this.notes[idx] = saved;
    } else {
      this.notes.push(saved);
    }

    this.notes = this.parser.computeBacklinks(this.notes);
    this.selectedNote = this.notes.find(n => n.id === saved.id) ?? saved;
    this.refreshAll();
    this.editor.showSaveStatus('Saved to disk! 💾');
  }
}

// Bootstrap the application once the DOM is ready.
const root = document.getElementById('app');
function showFatalError(err: unknown): void {
  const msg = err instanceof Error ? `${err.message}\n\n${err.stack ?? ''}` : String(err);
  if (root) {
    root.innerHTML = `<pre style="color:#fc8181;padding:16px;white-space:pre-wrap;font-family:monospace;font-size:12px;">Wiki-Forge failed to start:\n\n${msg}</pre>`;
  }
  console.error(err);
}
if (root) {
  try {
    new WikiForgeApp(root);
  } catch (err) {
    showFatalError(err);
  }
}
window.addEventListener('error', e => showFatalError(e.error ?? e.message));
