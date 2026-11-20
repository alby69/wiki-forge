import '@milkdown/crepe/theme/common/style.css';
import '@milkdown/crepe/theme/frame-dark.css';

import './styles/tokens.css';
import './styles/theme.css';
import './styles/primitives.css';
import './styles/sidebar.css';
import './styles/chat-drawer.css';
import './styles/editor.css';
import './styles/review-studio.css';
import './styles/research-studio.css';
import './styles/study-studio.css';

import { WikiNote } from '@frontend/core/types/wiki';
import type { ReviewTab } from '@frontend/core/types/review';
import type { ResearchTab } from '@frontend/core/types/research';
import type { StudyTab } from '@frontend/core/types/study';
import { MarkdownParser } from '@frontend/services/markdownParser';
import { GraphService } from '@frontend/services/graphService';
import { ApiStorage } from '@frontend/storage/ApiStorage';
import { appStore } from '@frontend/store/appStore';
import type { ViewMode } from '@frontend/store/appStore';
import { isSingleView, nextViewMode, SingleViewMode } from '@frontend/core/utils/viewMode';
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
import { ChangesetReviewModal } from '@frontend/components/ke/ChangesetReviewModal';
import { OnboardingWizard } from '@frontend/components/simple-mode/OnboardingWizard';
import { SimpleModeDashboard } from '@frontend/components/simple-mode/SimpleModeDashboard';
import { VersionTimeline } from '@frontend/components/advanced-mode/VersionTimeline';
import { ReviewStudio } from '@frontend/components/review/ReviewStudio';
import { ResearchStudio } from '@frontend/components/research/ResearchStudio';
import { StudyStudio } from '@frontend/components/study/StudyStudio';
import { ReviewContextMenu } from '@frontend/components/review/ReviewContextMenu';
import { HelpPanel } from '@frontend/components/ui/HelpPanel';
import { CommandPalette } from '@frontend/components/ui/CommandPalette';
import { ProjectManagerModal } from '@frontend/components/projects/ProjectManagerModal';
import { ProjectService } from '@frontend/services/projectService';
import { bindActionHandler } from '@frontend/core/actions';
import { eventBus } from '@frontend/core/events';
import { applyStoredLanguage, t } from '@frontend/core/i18n/strings';
import { installShortcuts, registerActionShortcuts, setShortcutContext } from '@frontend/core/shortcuts';
import { notifications } from '@frontend/services/notificationService';

export class WikiForgeApp {
  private parser = new MarkdownParser();
  private graphService = new GraphService();
  private storage = new ApiStorage();
  private notes: WikiNote[] = [];
  private selectedNote: WikiNote | null = null;
  private filterTags: string[] = [];
  private excludedFolders: string[] = [];
  private contextVisible = true;
  /** Last single pane shown, restored when Split is clicked again. */
  private lastSingleView: SingleViewMode = 'editor';

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
  private changesetReviewModal!: ChangesetReviewModal;
  private onboardingWizard!: OnboardingWizard;
  private simpleDashboard!: SimpleModeDashboard;
  private versionTimeline!: VersionTimeline;
  private reviewStudio!: ReviewStudio;
  private researchStudio!: ResearchStudio;
  private studyStudio!: StudyStudio;
  private reviewContextMenu!: ReviewContextMenu;
  private helpPanel!: HelpPanel;
  private commandPalette!: CommandPalette;
  private projectService = new ProjectService();
  private projectManager!: ProjectManagerModal;

  constructor(rootContainer: HTMLElement) {
    applyStoredLanguage();
    this.layout = new MainLayout(rootContainer);
    this.initUI();
    this.bindGlobalActions();
    registerActionShortcuts();
    setShortcutContext(() => ({ noteId: this.selectedNote?.id }));
    installShortcuts();
    eventBus.on('vault:changed', () => void this.loadVault(true));
    eventBus.on('project:changed', ({ id }) => {
      if (id !== this.storage.getActiveProjectId()) this.storage.setActiveProjectId(id);
      void this.loadVault();
    });
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
      eventBus.emit('vault:changed', {});
    });

    this.toolsModal = new ToolsModal(
      () => {
        void this.loadVault();
      },
      () => this.storage.getActiveProjectId()
    );

    this.keWorkbenchModal = new KEWorkbenchModal(
      () => {
        void this.loadVault();
      },
      () => this.storage.getActiveProjectId()
    );

    this.changesetReviewModal = new ChangesetReviewModal(
      () => {
        void this.loadVault();
      },
      () => this.storage.getActiveProjectId()
    );

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

    this.reviewStudio = new ReviewStudio(this.storage, {
      onNoteChanged: note => {
        this.selectedNote = note;
        void this.loadVault(true);
        this.editor.showSaveStatus('Nota aggiornata dalla Review Studio');
      },
    });

    this.researchStudio = new ResearchStudio(this.storage, {
      onOpenNote: (noteId, projectId) => {
        if (projectId && projectId !== this.storage.getActiveProjectId()) {
          this.storage.setActiveProjectId(projectId);
          void this.loadVault().then(() => this.selectNote(noteId));
          return;
        }
        this.selectNote(noteId);
      },
      onVaultChanged: () => {
        eventBus.emit('vault:changed', {});
        this.editor.showSaveStatus(t('vaultUpdated'));
      },
      onScratchpadChanged: () => {
        void this.scratchpadPanel.load();
      },
    });

    this.studyStudio = new StudyStudio(this.storage, {
      onOpenNote: noteId => this.selectNote(noteId),
      onVaultChanged: () => {
        eventBus.emit('vault:changed', {});
        void this.scratchpadPanel.load();
        this.editor.showSaveStatus(t('vaultUpdated'));
      },
    });

    this.reviewContextMenu = new ReviewContextMenu({
      onOpenReview: (noteId, tab) => this.openReviewStudio(noteId, tab),
      onOpenResearch: (noteId, tab) => this.openResearchStudio({ noteId, tab }),
      onOpenStudy: (noteId, tab) => this.openStudyStudio({ noteId, tab }),
    });

    // Keyboard shortcuts are registered once in core/shortcuts.ts; see
    // bindGlobalActions() below for the action handlers they dispatch to.
    this.header = new Header({
      container: this.layout.headerContainer,
      onViewModeChange: mode => this.handleViewModeToggle(mode),
      onToggleChat: () => this.chatDrawer.toggle(),
      onProjectSelect: projectId => this.storage.setActiveProjectId(projectId),
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
        onRenameDocument: async (oldPath, newTitle) => {
          const preview = await this.storage.previewRename(oldPath, newTitle);
          if (!preview) {
            notifications.translated('renameUnavailable', 'error');
            return;
          }
          if (!preview.success) {
            notifications.translated('renameFailed', 'error', { error: preview.error ?? 'unknown' });
            return;
          }

          const samples = preview.updatedFiles
            .flatMap(update => update.samples)
            .slice(0, 8)
            .join('\n');
          const message = t('renameDocumentMessage', {
            oldTitle: preview.renamed.oldTitle,
            newTitle: preview.renamed.newTitle,
            from: preview.renamed.from,
            to: preview.renamed.to,
            count: preview.totalReplacements,
            files: preview.updatedFiles.length,
          }) + (samples ? `\n\n${samples}` : '');
          const proceed = await notifications.confirm({ title: t('renameDocument'), message });
          if (!proceed) return;

          const result = await this.storage.renameDocument(oldPath, newTitle);
          if (!result || !result.success) {
            notifications.translated('renameFailed', 'error', { error: result?.error ?? 'unknown' });
            return;
          }

          await this.loadVault();
          this.selectNote(result.renamed.id);
          this.editor.showSaveStatus(
            `Rinominato in "${result.renamed.newTitle}" · ${result.totalReplacements} link aggiornati`
          );
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
        onContextMenu: (noteId, _filePath, event) => {
          const note = this.notes.find(candidate => candidate.id === noteId);
          this.reviewContextMenu.show(noteId, note?.title || noteId, event.clientX, event.clientY);
        },
      }
    );

    this.editor = new MarkdownEditor(
      this.layout.editorContainer,
      {
        onSave: (noteId, content, fullContent) => {
          void this.updateAndSaveNote(noteId, content, fullContent);
        },
        onOpenLink: target => this.openWikilink(target),
        getNotes: () => this.notes,
        onToggleContext: () => this.toggleContext(),
        onOpenHistory: () => this.openVersionTimeline(),
        onOpenReview: () => this.openReviewStudio(),
      },
      { storage: this.storage }
    );

    this.contextPanel = new ContextPanel(this.layout.contextContainer, noteId => {
      this.selectNote(noteId);
    });

    this.graphViewer = new ForceGraphViewer();
    this.graphViewer.render(this.layout.graphContainer, { nodes: [], links: [] });
    this.graphViewer.onNodeClick(nodeId => {
      // selectNote() reveals the editor without forcing a split view.
      this.selectNote(nodeId);
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
      target => this.openWikilink(target),
      (tab, query) => this.openResearchStudio({ tab, query })
    );

    this.helpPanel = new HelpPanel({
      storage: this.storage,
      onAskAgent: question => this.chatDrawer.prefill(question),
    });

    this.commandPalette = new CommandPalette(
      () => this.notes,
      noteId => this.selectNote(noteId),
      () => void this.keWorkbenchModal.open(),
      () => ({ noteId: this.selectedNote?.id })
    );

    this.projectManager = new ProjectManagerModal({
      service: this.projectService,
      onChanged: () => {
        void this.loadVault();
      },
      onOpenProject: id => this.storage.setActiveProjectId(id),
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
    appStore.subscribe(state => {
      this.layout.setViewMode(state.viewMode);
    });

    this.layout.setViewMode(appStore.getState().viewMode);
  }

  /** Single wiring point between the action catalogue and app behaviour. */
  private bindGlobalActions(): void {
    bindActionHandler('global:projects', () => void this.projectManager.open());
    bindActionHandler('global:research', () => this.openResearchStudio());
    bindActionHandler('global:docsWiki', () => this.openDocsWiki());
    bindActionHandler('global:study', () => this.openStudyStudio());
    bindActionHandler('global:review', () => this.openReviewStudio());
    bindActionHandler('global:tools', () => void this.toolsModal.open());
    bindActionHandler('global:config', () => void this.configManager.open());
    bindActionHandler('global:wizard', () => this.onboardingWizard.open());
    bindActionHandler('global:keWorkbench', () => void this.keWorkbenchModal.open());
    bindActionHandler('global:changesets', () => void this.changesetReviewModal.open());
    bindActionHandler('global:help', () => void this.helpPanel.open());
    bindActionHandler('global:chat', () => this.chatDrawer.toggle());
    bindActionHandler('global:toggleMode', () => appStore.toggleAdvancedMode());

    bindActionHandler('note:info', () => this.toggleContext());
    bindActionHandler('note:review', context => this.openReviewStudio(context.noteId));
    bindActionHandler('note:history', () => this.openVersionTimeline());

    for (const tab of ['verify', 'critique', 'digest', 'diff'] as ReviewTab[]) {
      bindActionHandler(`review:${tab}`, context => this.openReviewStudio(context.noteId, tab));
    }
    bindActionHandler('research:backlinks', context => this.openResearchStudio({ noteId: context.noteId, tab: 'backlinks' }));
    bindActionHandler('research:related', context => this.openResearchStudio({ noteId: context.noteId, tab: 'related' }));
    for (const tab of ['guide', 'quiz', 'mindmap', 'audio'] as StudyTab[]) {
      bindActionHandler(`study:${tab}`, context => this.openStudyStudio({ noteId: context.noteId, tab }));
    }
    for (const mode of ['editor', 'graph', 'split', 'scratchpad'] as ViewMode[]) {
      bindActionHandler(`view:${mode}`, () => this.handleViewModeToggle(mode));
    }
  }

  private refreshAll(): void {
    this.sidebar.setNotes(this.notes);
    if (this.selectedNote) this.sidebar.setActiveNote(this.selectedNote.id);
    this.editor.setNote(this.selectedNote);
    this.contextPanel.setSelectedNote(this.selectedNote);
    this.reviewStudio.setNotes(this.notes);
    this.researchStudio.setNotes(this.notes);
    this.studyStudio.setNotes(this.notes);
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

      // In Graph-only mode the editor is hidden, so selecting a note would look
      // like a no-op: reveal it by switching to the full-width editor. Split is
      // only entered when the user explicitly clicks the Split toggle.
      const mode = appStore.getState().viewMode;
      if (mode === 'graph') {
        this.lastSingleView = 'editor';
        appStore.setViewMode('editor');
      } else if (mode === 'scratchpad' || mode === 'closed') {
        appStore.setViewMode('editor');
      }
    }
  }

  /** Editor / Scratchpad / Graph / Split act as toggles. Split is explicit:
   *  re-clicking it restores the last single pane full width (instead of
   *  leaving the central area empty). */
  private handleViewModeToggle(mode: ViewMode): void {
    const current = appStore.getState().viewMode;
    if (isSingleView(mode)) this.lastSingleView = mode;
    appStore.setViewMode(nextViewMode(current, mode, this.lastSingleView));
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

  /** Opens the Review Studio on the given note (or the current selection). */
  public openReviewStudio(noteId?: string, tab: ReviewTab = 'verify'): void {
    const id = noteId || this.selectedNote?.id;
    if (!id) return;
    this.reviewStudio.open(id, tab);
  }

  /**
   * Opens the Research Studio. Search and trace take a free-text query, while
   * backlinks and related default to the current note; consult and deep
   * research accept a question.
   */
  public openResearchStudio(options: { noteId?: string; tab?: ResearchTab; query?: string; projectId?: string; scopeLabel?: string } = {}): void {
    this.researchStudio.open({
      noteId: options.projectId ? undefined : (options.noteId || this.selectedNote?.id),
      tab: options.tab ?? 'search',
      query: options.query,
      projectId: options.projectId,
      scopeLabel: options.scopeLabel,
    });
  }

  /**
   * Opens the Research Studio scoped to the self-documentation wiki without
   * changing the active project/vault. Ctrl+Alt+W is the keyboard shortcut.
   */
  public openDocsWiki(): void {
    this.openResearchStudio({
      tab: 'consult',
      projectId: 'wikiforge',
      scopeLabel: 'Wiki Docs · wiki-forge',
      query: 'Come funziona l\'architettura di wiki-forge?',
    });
  }

  /**
   * Opens the Study Studio. Generative tabs (guide, quiz, mindmap, audio)
   * prefill the topic from the current note; notes/promote use the scratchpad
   * and thesis aggregates chapters and syntheses.
   */
  public openStudyStudio(options: { noteId?: string; tab?: StudyTab; topic?: string } = {}): void {
    this.studyStudio.open({
      noteId: options.noteId || this.selectedNote?.id,
      tab: options.tab ?? 'guide',
      topic: options.topic,
    });
  }

  private async updateAndSaveNote(noteId: string, newContent: string, fullContent?: string): Promise<void> {
    const target = this.notes.find(n => n.id === noteId);
    if (!target) return;

    const saved = await this.storage.saveNote({
      id: noteId,
      content: newContent,
      rawContent: fullContent ?? `${target.frontmatterRaw ?? ''}${newContent}`,
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
    this.editor.showSaveStatus(`💾 ${t('saved')}`);
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
