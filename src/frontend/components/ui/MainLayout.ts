import { paneFlexes } from '@frontend/core/utils/viewMode';
import { bindResizer } from '@frontend/core/ui/resizer';

export class MainLayout {
  private container: HTMLElement;
  public sidebarContainer!: HTMLElement;
  public editorContainer!: HTMLElement;
  public scratchContainer!: HTMLElement;
  public emptyContainer!: HTMLElement;
  public graphContainer!: HTMLElement;
  public contextContainer!: HTMLElement;
  public headerContainer!: HTMLElement;
  public graphControlsContainer!: HTMLElement;
  public chatContainer!: HTMLElement;
  public mainContentArea!: HTMLElement;
  private sidebarWidth = 280;
  private contextHeight = 168;
  private editorFlex = 1;
  private graphFlex = 1;
  private sidebarCollapsed = false;
  private sidebarToggleBtn!: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
    try {
      this.sidebarCollapsed = localStorage.getItem('wiki-forge:sidebar-collapsed') === 'true';
      this.sidebarWidth = Number(localStorage.getItem('wiki-forge:sidebar-width')) || this.sidebarWidth;
      this.contextHeight = Number(localStorage.getItem('wiki-forge:context-height')) || this.contextHeight;
      const ratio = Number(localStorage.getItem('wiki-forge:editor-ratio'));
      if (ratio > 0.2 && ratio < 0.8) {
        this.editorFlex = ratio;
        this.graphFlex = 1 - ratio;
      }
    } catch {
      this.sidebarCollapsed = false;
    }
    this.render();
  }

  public render(): void {
    this.container.innerHTML = `
      <div id="wiki-forge-app" style="display: flex; flex-direction: column; height: 100vh; width: 100vw; background: var(--wf-bg-deep); font-family: var(--wf-font); overflow: hidden;">
        <div id="header-root" style="position: relative; flex-shrink: 0;">
          <div id="header-bar-root"></div>
        </div>
        <div style="flex: 1; display: flex; overflow: hidden; position: relative;">
          <div id="sidebar-root" style="width: ${this.sidebarWidth}px; min-width: 200px; max-width: 500px; flex-shrink: 0;"></div>
          <div id="sidebar-resizer" data-resizer="sidebar"></div>
          <button id="sidebar-toggle-btn" title="Nascondi barra laterale (file manager e tag cloud)" style="position: absolute; top: 14px; left: ${this.sidebarCollapsed ? 0 : this.sidebarWidth - 10}px; width: 20px; height: 28px; z-index: 20; border-radius: 0 6px 6px 0; background: #1e293b; border: 1px solid #334155; border-left: none; color: #94a3b8; cursor: pointer; font-size: 11px; line-height: 1; padding: 0; transition: color 0.15s, background 0.15s;">${this.sidebarCollapsed ? '▶' : '◀'}</button>
          <div id="main-content-area" style="flex: 1; display: flex; flex-direction: column; overflow: hidden; background: #18191c; min-width: 0;">
            <div id="graph-controls-root"></div>
            <div style="flex: 1; display: flex; overflow: hidden; position: relative; min-height: 0;">
              <div id="scratch-root" style="display: none; flex: 1; height: 100%; position: relative; min-width: 0;"></div>
              <div id="editor-root" style="flex: ${this.editorFlex}; height: 100%; display: flex; flex-direction: column; min-width: 0;"></div>
              <div id="graph-resizer" data-resizer="graph"></div>
              <div id="graph-root" style="flex: ${this.graphFlex}; height: 100%; position: relative; min-width: 0;"></div>
              <div id="view-empty" style="display: none; flex: 1; height: 100%; align-items: center; justify-content: center; flex-direction: column; gap: 8px; background: #18191c; color: #718096;"></div>
            </div>
            <div id="context-resizer" data-resizer="context"></div>
            <div id="context-root" style="height: ${this.contextHeight}px; min-height: 0; flex-shrink: 0; border-top: 1px solid #2d3748; background: #121316;"></div>
          </div>
          <div id="chat-root" style="display: none; height: 100%; z-index: 100;"></div>
        </div>
        <footer style="height: 24px; background: var(--wf-bg-deep); border-top: 1px solid var(--wf-border); display: flex; align-items: center; justify-content: space-between; padding: 0 var(--wf-space-4); font-size: 11px; color: var(--wf-text-subtle);">
          <div>Wiki-Forge</div>
          <div>Ctrl+K · F1</div>
        </footer>
      </div>
    `;

    this.headerContainer = this.container.querySelector('#header-bar-root')!;
    this.sidebarContainer = this.container.querySelector('#sidebar-root')!;
    this.editorContainer = this.container.querySelector('#editor-root')!;
    this.scratchContainer = this.container.querySelector('#scratch-root')!;
    this.emptyContainer = this.container.querySelector('#view-empty')!;
    this.graphContainer = this.container.querySelector('#graph-root')!;
    this.contextContainer = this.container.querySelector('#context-root')!;
    this.graphControlsContainer = this.container.querySelector('#graph-controls-root')!;
    this.chatContainer = this.container.querySelector('#chat-root')!;
    this.mainContentArea = this.container.querySelector('#main-content-area')!;
    this.sidebarToggleBtn = this.container.querySelector('#sidebar-toggle-btn')!;

    this.sidebarToggleBtn.addEventListener('click', () => this.toggleSidebar());
    this.applySidebarState();

    this.emptyContainer.innerHTML = `
      <div style="text-align: center; display: flex; flex-direction: column; gap: 8px; align-items: center;">
        <div style="font-size: 40px; opacity: 0.6;">🕳️</div>
        <div style="font-size: 15px; font-weight: 600; color: #a0aec0;">Vista chiusa</div>
        <div style="font-size: 12px; color: #718096;">Usa Editor, Scratchpad o Graph nella barra in alto per aprirla.</div>
      </div>`;

    this.bindResizers();
  }

  private bindResizers(): void {
    const sidebarResizer = this.container.querySelector('#sidebar-resizer') as HTMLElement | null;
    const graphResizer = this.container.querySelector('#graph-resizer') as HTMLElement | null;
    const contextResizer = this.container.querySelector('#context-resizer') as HTMLElement | null;
    const persist = (key: string, value: number): void => {
      try {
        localStorage.setItem(key, String(value));
      } catch {
        /* storage unavailable */
      }
    };

    if (sidebarResizer) {
      bindResizer(sidebarResizer, {
        axis: 'x',
        onResize: event => {
          const width = Math.max(200, Math.min(500, event.clientX));
          this.sidebarWidth = width;
          this.sidebarContainer.style.width = `${width}px`;
          const toggle = this.container.querySelector('#sidebar-toggle-btn') as HTMLElement | null;
          if (toggle) toggle.style.left = `${width - 10}px`;
        },
        onEnd: () => persist('wiki-forge:sidebar-width', this.sidebarWidth),
      });
    }

    if (graphResizer) {
      bindResizer(graphResizer, {
        axis: 'x',
        onResize: event => {
          const mainRect = this.mainContentArea.getBoundingClientRect();
          const offset = event.clientX - mainRect.left;
          if (offset > 200 && offset < mainRect.width - 200) {
            this.editorFlex = offset / mainRect.width;
            this.graphFlex = 1 - this.editorFlex;
            this.editorContainer.style.flex = String(this.editorFlex);
            this.graphContainer.style.flex = String(this.graphFlex);
          }
        },
        onEnd: () => persist('wiki-forge:editor-ratio', this.editorFlex),
      });
    }

    if (contextResizer) {
      bindResizer(contextResizer, {
        axis: 'y',
        onResize: event => {
          const height = Math.max(84, Math.min(420, window.innerHeight - event.clientY));
          this.contextHeight = height;
          this.contextContainer.style.height = `${height}px`;
        },
        onEnd: () => persist('wiki-forge:context-height', this.contextHeight),
      });
    }
  }

  public toggleSidebar(): void {
    this.sidebarCollapsed = !this.sidebarCollapsed;
    try {
      localStorage.setItem('wiki-forge:sidebar-collapsed', String(this.sidebarCollapsed));
    } catch {
      /* storage unavailable */
    }
    this.applySidebarState();
  }

  private applySidebarState(): void {
    const resizer = this.container.querySelector('#sidebar-resizer') as HTMLElement;
    if (this.sidebarCollapsed) {
      this.sidebarContainer.style.width = '0px';
      this.sidebarContainer.style.minWidth = '0px';
      this.sidebarContainer.style.overflow = 'hidden';
      if (resizer) resizer.style.display = 'none';
      this.sidebarToggleBtn.style.left = '0px';
      this.sidebarToggleBtn.style.borderRadius = '0 6px 6px 0';
      this.sidebarToggleBtn.textContent = '▶';
      this.sidebarToggleBtn.title = 'Mostra barra laterale (file manager e tag cloud)';
      // Keep the collapsed toggle (20px wide) from overlapping the editor title.
      this.mainContentArea.style.marginLeft = '20px';
    } else {
      this.sidebarContainer.style.width = `${this.sidebarWidth}px`;
      this.sidebarContainer.style.minWidth = '200px';
      this.sidebarContainer.style.overflow = '';
      if (resizer) resizer.style.display = '';
      this.sidebarToggleBtn.style.left = `${this.sidebarWidth - 10}px`;
      this.sidebarToggleBtn.style.borderRadius = '0 6px 6px 0';
      this.sidebarToggleBtn.textContent = '◀';
      this.sidebarToggleBtn.title = 'Nascondi barra laterale (file manager e tag cloud)';
      this.mainContentArea.style.marginLeft = '';
    }
  }

  public setViewMode(mode: 'editor' | 'graph' | 'split' | 'scratchpad' | 'closed'): void {
    const showEditor = mode === 'editor' || mode === 'split';
    const showGraph = mode === 'graph' || mode === 'split';
    const showScratch = mode === 'scratchpad';
    const showEmpty = mode === 'closed';

    this.editorContainer.style.display = showEditor ? 'flex' : 'none';
    this.graphContainer.style.display = showGraph ? 'block' : 'none';
    this.scratchContainer.style.display = showScratch ? 'flex' : 'none';
    this.emptyContainer.style.display = showEmpty ? 'flex' : 'none';
    this.graphControlsContainer.style.display = showGraph ? 'block' : 'none';

    // A single visible pane must take the whole row; only split keeps the
    // ratio the user dragged (see paneFlexes).
    const flex = paneFlexes(showEditor, showGraph, this.editorFlex, this.graphFlex);
    this.editorContainer.style.flex = flex.editor;
    this.graphContainer.style.flex = flex.graph;

    const graphResizer = this.container.querySelector('#graph-resizer') as HTMLElement;
    if (graphResizer) graphResizer.style.display = showEditor && showGraph ? 'block' : 'none';
  }

  public setContextVisible(visible: boolean): void {
    const context = this.container.querySelector('#context-root') as HTMLElement;
    const resizer = this.container.querySelector('#context-resizer') as HTMLElement;
    if (context) context.style.display = visible ? 'block' : 'none';
    if (resizer) resizer.style.display = visible ? 'block' : 'none';
  }
}
