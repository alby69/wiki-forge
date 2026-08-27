import { WikiNote } from './core/types/wiki';
import { MarkdownParser } from './services/markdownParser';
import { GraphService } from './services/graphService';
import { FileStorage } from './storage/FileStorage';
import { MainLayout } from './components/ui/MainLayout';
import { Header } from './components/ui/Header';
import { Sidebar } from './components/ui/Sidebar';
import { MarkdownEditor } from './components/editor/MarkdownEditor';
import { ContextPanel } from './components/editor/ContextPanel';
import { ForceGraphViewer } from './components/graph/ForceGraphViewer';
import { GraphControls } from './components/graph/GraphControls';

export class WikiForgeApp {
  private parser = new MarkdownParser();
  private graphService = new GraphService();
  private storage = new FileStorage();
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

  constructor(rootContainer: HTMLElement) {
    this.layout = new MainLayout(rootContainer);
    this.initUI();
    // Load the real vault asynchronously (falls back to a demo vault).
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

  /**
   * Demo vault used only when no Markdown files are found under wiki/ or raw/.
   * Keeps the UI usable out-of-the-box for first-time exploration.
   */
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
    this.header = new Header(this.layout.headerContainer, mode => {
      this.layout.setViewMode(mode);
    });

    this.sidebar = new Sidebar(
      this.layout.sidebarContainer,
      noteId => {
        this.selectNote(noteId);
      },
      tags => {
        this.filterTags = tags;
        this.refreshGraph();
      }
    );

    this.editor = new MarkdownEditor(
      this.layout.editorContainer,
      (noteId, content) => {
        this.updateNoteContent(noteId, content);
      },
      target => this.openWikilink(target)
    );

    this.contextPanel = new ContextPanel(this.layout.contextContainer, noteId => {
      this.selectNote(noteId);
    });

    this.graphViewer = new ForceGraphViewer();
    this.graphViewer.render(this.layout.graphContainer, { nodes: [], links: [] });
    this.graphViewer.onNodeClick(nodeId => {
      this.selectNote(nodeId);
      // Obsidian-like: clicking a node opens the note, so make sure the editor
      // pane is visible (it is hidden in pure "graph" view mode).
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

    this.layout.setViewMode('split');
  }

  /** Push the current notes/selection into every UI region. */
  private refreshAll(): void {
    this.sidebar.setNotes(this.notes);
    if (this.selectedNote) this.sidebar.setActiveNote(this.selectedNote.id);
    this.editor.setNote(this.selectedNote);
    this.contextPanel.setSelectedNote(this.selectedNote);
    this.refreshGraph();
  }

  /** Recompute the graph honouring the current tag filter (from the sidebar). */
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

  /** Navigate to a note referenced by a [[wikilink]] (same- or cross-folder). */
  public openWikilink(target: string): void {
    const found = this.parser.resolveLinkTarget(target, this.notes);
    if (found) {
      this.selectNote(found.id);
    }
  }

  private updateNoteContent(noteId: string, newContent: string): void {
    const idx = this.notes.findIndex(n => n.id === noteId);
    if (idx !== -1) {
      const refreshed = this.parser.parseNote(
        this.notes[idx].id,
        this.notes[idx].title,
        newContent,
        this.notes[idx].folder ?? 'wiki'
      );
      this.notes[idx] = refreshed;
      this.notes = this.parser.computeBacklinks(this.notes);

      const updated = this.notes.find(n => n.id === noteId)!;
      this.selectedNote = updated;
      this.refreshAll();
    }
  }
}

// Bootstrap the application once the DOM is ready.
const root = document.getElementById('app');
if (root) {
  new WikiForgeApp(root);
}
