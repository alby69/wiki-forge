import { WikiNote } from './core/types/wiki';
import { MarkdownParser } from './services/markdownParser';
import { GraphService } from './services/graphService';
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
  private notes: WikiNote[] = [];
  private selectedNote: WikiNote | null = null;

  private layout!: MainLayout;
  private header!: Header;
  private sidebar!: Sidebar;
  private editor!: MarkdownEditor;
  private contextPanel!: ContextPanel;
  private graphViewer!: ForceGraphViewer;
  private graphControls!: GraphControls;

  constructor(rootContainer: HTMLElement) {
    this.layout = new MainLayout(rootContainer);
    this.initSampleVault();
    this.initUI();
  }

  private initSampleVault(): void {
    const note1 = this.parser.parseNote(
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
      'wiki'
    );

    const note2 = this.parser.parseNote(
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
      'wiki'
    );

    const note3 = this.parser.parseNote(
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
      'wiki'
    );

    const rawNotes = [note1, note2, note3];
    this.notes = this.parser.computeBacklinks(rawNotes);
    this.selectedNote = this.notes[0];
  }

  private initUI(): void {
    this.header = new Header(this.layout.headerContainer, mode => {
      this.layout.setViewMode(mode);
    });

    this.sidebar = new Sidebar(this.layout.sidebarContainer, noteId => {
      this.selectNote(noteId);
    });

    this.editor = new MarkdownEditor(this.layout.editorContainer, (noteId, content) => {
      this.updateNoteContent(noteId, content);
    });

    this.contextPanel = new ContextPanel(this.layout.contextContainer, noteId => {
      this.selectNote(noteId);
    });

    this.graphViewer = new ForceGraphViewer();
    this.graphViewer.render(this.layout.graphContainer, this.graphService.generateGraphData(this.notes));
    this.graphViewer.onNodeClick(nodeId => this.selectNote(nodeId));

    this.graphControls = new GraphControls(this.layout.graphControlsContainer, options => {
      const fullData = this.graphService.generateGraphData(this.notes);
      const filtered = this.graphService.filterGraphData(fullData, options);
      this.graphViewer.updateData(filtered);
    });

    this.sidebar.setNotes(this.notes);
    this.editor.setNote(this.selectedNote);
    this.contextPanel.setSelectedNote(this.selectedNote);
    this.layout.setViewMode('split');
  }

  public selectNote(noteId: string): void {
    const found = this.notes.find(n => n.id === noteId || n.title.toLowerCase() === noteId.toLowerCase());
    if (found) {
      this.selectedNote = found;
      this.editor.setNote(found);
      this.contextPanel.setSelectedNote(found);
      this.graphViewer.highlightNode(found.id);
    }
  }

  private updateNoteContent(noteId: string, newContent: string): void {
    const idx = this.notes.findIndex(n => n.id === noteId);
    if (idx !== -1) {
      const updated = this.parser.parseNote(
        this.notes[idx].id,
        this.notes[idx].title,
        newContent,
        this.notes[idx].folder
      );
      this.notes[idx] = updated;
      this.notes = this.parser.computeBacklinks(this.notes);

      const refreshed = this.notes.find(n => n.id === noteId)!;
      this.selectedNote = refreshed;
      this.sidebar.setNotes(this.notes);
      this.editor.setNote(refreshed);
      this.contextPanel.setSelectedNote(refreshed);
      this.graphViewer.updateData(this.graphService.generateGraphData(this.notes));
    }
  }
}
