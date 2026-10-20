import './styles/theme.css';
import './styles/sidebar.css';
import './styles/chat-drawer.css';
import './styles/editor.css';

import { WikiNote } from '@frontend/core/types/wiki';
import { MarkdownParser } from '@frontend/services/markdownParser';
import { GraphService } from '@frontend/services/graphService';
import { ApiStorage } from '@frontend/storage/ApiStorage';
import { appStore } from '@frontend/store/appStore';
import type { ViewMode } from '@frontend/store/appStore';
import { MainLayout } from '@frontend/components/ui/MainLayout';
import { Header } from '@frontend/components/ui/Header';
import { Sidebar } from '@frontend/components/ui/Sidebar';
import { MarkdownEditor } from '@frontend/components/editor/MarkdownEditor';
import { ContextPanel } from '@frontend/components/editor/ContextPanel';
import { ForceGraphViewer } from '@frontend/components/graph/ForceGraphViewer';
import { GraphControls } from '@frontend/components/graph/GraphControls';
import { ChatDrawer } from '@frontend/components/chat/ChatDrawer';
import { ScratchpadPanel } from '@frontend/components/scratchpad/ScratchpadPanel';
import { ConfigManager } from '@frontend/components/ConfigManager';
import { ToolsModal } from '@frontend/components/tools/ToolsModal';
import { KEWorkbenchModal } from '@frontend/components/ke/KEWorkbenchModal';
import { OnboardingWizard } from '@frontend/components/simple-mode/OnboardingWizard';
import { SimpleModeDashboard } from '@frontend/components/simple-mode/SimpleModeDashboard';
import { VersionTimeline } from '@frontend/components/advanced-mode/VersionTimeline';
import { HelpPanel } from '@frontend/components/ui/HelpPanel';

export class WikiForgeApp {
  private parser = new MarkdownParser();
  private graphService = new GraphService();
  private storage = new ApiStorage();
  private notes: WikiNote[] = [];
  private selectedNote: WikiNote | null = null;
  private filterTags: string[] = [];
  private excludedFolders: string[] = [];
  private contextVisible = true;

  private layout!: MainLayout;
  private header!: Header;
  private sidebar!: Sidebar;
  private editor!: MarkdownEditor;
  private contextPanel!: ContextPanel;
  private graphViewer!: ForceGraphViewer;
  private graphControls!: GraphControls;
  private chatDrawer!: ChatDrawer;
  private scratchpadPanel!: ScratchpadPanel;
  private configManager!: ConfigManager;
  private toolsModal!: ToolsModal;
  private keWorkbenchModal!: KEWorkbenchModal;
  private onboardingWizard!: OnboardingWizard;
  private simpleDashboard!: SimpleModeDashboard;
  private versionTimeline!: VersionTimeline;
  private helpPanel!: HelpPanel;

  constructor(rootContainer: HTMLElement) {
    this.layout = new MainLayout(rootContainer);
    this.initUI();
    void this.loadVault();
    this.checkFirstLaunchOnboarding();
  }

  private checkFirstLaunchOnboarding(): void {
    const { onboardingCompleted } = appStore.getState();
    if (!onboardingCompleted) {
      setTimeout(() => {
        this.onboardingWizard.open();
      }, 500);
    }
  }

  private async loadVault(preserveSelection: boolean = false): Promise<void> {
    const projects = await this.storage.getProjects();
    const activeId = this.storage.getActiveProjectId();
    this.header.setProjects(projects, activeId);

    const currentId = preserveSelection ? this.selectedNote?.id ?? null : null;

    let notes = await this.storage.getAllNotes();
    if (notes.length === 0 && activeId === 'default') {
      notes = this.buildSampleVault();
    }
    this.notes = this.parser.computeBacklinks(notes);
    this.selectedNote = this.notes.find(n => n.id === currentId) ?? this.notes[0] ?? null;
    this.refreshAll();
    void this.scratchpadPanel.load();
  }

  private buildSampleVault(): WikiNote[] {
    const raw = [
      [
        '01-index',
        'System Architecture',
        `---
title: System Architecture
tags: [architecture, core]
version: 1
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
version: 1
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
version: 1
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
    this.configManager = new ConfigManager(this.storage, () => {
      void this.loadVault();
    });

    this.toolsModal = new ToolsModal(() => {
      void this.loadVault();
    });

    this.keWorkbenchModal = new KEWorkbenchModal(() => {
      void this.loadVault();
    });

    this.onboardingWizard = new OnboardingWizard({
      storage: this.storage,
      onComplete: () => {
        void this.loadVault();
      },
    });

    this.versionTimeline = new VersionTimeline(this.storage, note => {
      this.selectedNote = note;
      void this.loadVault();
    });

    this.header = new Header({
      container: this.layout.headerContainer,
      onViewModeChange: mode => this.handleViewModeToggle(mode),
      onToggleChat: () => {
        this.chatDrawer.toggle();
      },
      onOpenConfig: () => {
        void this.configManager.open();
      },
      onProjectSelect: projectId => {
        this.storage.setActiveProjectId(projectId);
        void this.loadVault();
      },
      onOpenTools: () => {
        void this.toolsModal.open();
      },
      onOpenWizard: () => {
        this.onboardingWizard.open();
      },
      onOpenKEWorkbench: () => {
        void this.keWorkbenchModal.open();
      },
      onOpenHelp: () => {
        void this.helpPanel.open();
      },
    });

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
        getFolders: async () => {
          return this.storage.getAllFolders();
        },
      }
    );

    this.editor = new MarkdownEditor(
      this.layout.editorContainer,
      (noteId, content) => {
        void this.updateAndSaveNote(noteId, content);
      },
      target => this.openWikilink(target),
      () => this.notes,
      () => this.toggleContext(),
      () => this.openVersionTimeline()
    );

    this.contextPanel = new ContextPanel(this.layout.contextContainer, noteId => {
      this.selectNote(noteId);
    });

    this.graphViewer = new ForceGraphViewer();
    this.graphViewer.render(this.layout.graphContainer, { nodes: [], links: [] });
    this.graphViewer.onNodeClick(nodeId => {
      this.selectNote(nodeId);
      appStore.setViewMode('split');
    });

    this.graphControls = new GraphControls(this.layout.graphControlsContainer, {
      onFilterChange: options => {
        this.excludedFolders = options.excludedFolders ?? [];
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
        void this.loadVault(true);
      },
      target => this.openWikilink(target)
    );

    this.helpPanel = new HelpPanel({
      storage: this.storage,
      onAskAgent: question => this.chatDrawer.prefill(question),
    });

    this.scratchpadPanel = new ScratchpadPanel(this.layout.scratchContainer, {
      getScratchpad: () => this.storage.getScratchpad(),
      onPromoteScratchpad: noteId => {
        void this.chatDrawer.handleSendMessage(`/promote-note ${noteId}`);
        void this.chatDrawer.open();
      },
      deleteScratchpad: noteId => this.storage.deleteScratchpad(noteId),
    });

    this.simpleDashboard = new SimpleModeDashboard({
      storage: this.storage,
      onOpenChat: () => this.chatDrawer.open(),
      onVaultUpdated: () => void this.loadVault(),
    });
    this.header.setSimpleDashboard(this.simpleDashboard);

    appStore.subscribe(state => {
      this.layout.setViewMode(state.viewMode);
    });

    this.layout.setViewMode(appStore.getState().viewMode);
  }

  private refreshAll(): void {
    this.sidebar.setNotes(this.notes);
    if (this.selectedNote) this.sidebar.setActiveNote(this.selectedNote.id);
    this.editor.setNote(this.selectedNote);
    this.contextPanel.setSelectedNote(this.selectedNote);
    this.refreshGraph();
  }

  private refreshGraph(): void {
    this.graphControls.setAvailableFolders(this.collectFolders(), this.excludedFolders);
    const full = this.graphService.generateGraphData(this.notes);
    const filtered = this.graphService.filterGraphData(full, {
      selectedTags: this.filterTags,
      excludedFolders: this.excludedFolders,
    });
    this.graphViewer.updateData(filtered);
  }

  private collectFolders(): string[] {
    const groups = new Set<string>();
    this.notes.forEach(note => groups.add(note.folder || 'default'));
    return Array.from(groups).sort();
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

      // In Graph-only mode the editor is hidden, so selecting a note
      // would look like a no-op: reveal it by falling back to Split.
      const mode = appStore.getState().viewMode;
      if (mode === 'graph') {
        appStore.setViewMode('split');
      } else if (mode === 'scratchpad' || mode === 'closed') {
        appStore.setViewMode('editor');
      }
    }
  }

  /** Editor / Scratchpad / Graph / Split act as toggles: re-clicking the active
   *  pane closes it ('closed'), Split shows both at half width. */
  private handleViewModeToggle(mode: ViewMode): void {
    if (appStore.getState().viewMode === mode) {
      appStore.setViewMode('closed');
    } else {
      appStore.setViewMode(mode);
    }
  }

  private toggleContext(): void {
    this.contextVisible = !this.contextVisible;
    this.layout.setContextVisible(this.contextVisible);
    this.editor.setContextVisible(this.contextVisible);
  }

  public openWikilink(target: string): void {
    const found = this.parser.resolveLinkTarget(target, this.notes);
    if (found) {
      this.selectNote(found.id);
    }
  }

  public openVersionTimeline(): void {
    if (this.selectedNote) {
      this.versionTimeline.open(this.selectedNote);
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
