export class MainLayout {
  private container: HTMLElement;
  public sidebarContainer!: HTMLElement;
  public editorContainer!: HTMLElement;
  public graphContainer!: HTMLElement;
  public contextContainer!: HTMLElement;
  public headerContainer!: HTMLElement;
  public graphControlsContainer!: HTMLElement;
  public chatContainer!: HTMLElement;
  private sidebarWidth = 280;
  private contextWidth = 280;
  private editorFlex = 1;
  private graphFlex = 1;
  private isResizingSidebar = false;
  private isResizingContext = false;

  constructor(container: HTMLElement) {
    this.container = container;
    this.render();
  }

  public render(): void {
    this.container.innerHTML = `
      <div id="wiki-forge-app" style="display: flex; flex-direction: column; height: 100vh; width: 100vw; background: #121316; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; overflow: hidden;">
        <div id="header-root"></div>
        <div style="flex: 1; display: flex; overflow: hidden; position: relative;">
          <div id="sidebar-root" style="width: ${this.sidebarWidth}px; min-width: 200px; max-width: 500px; flex-shrink: 0;"></div>
          <div id="sidebar-resizer" class="resizer" data-resizer="sidebar" style="width: 4px; cursor: col-resize; background: transparent; position: relative; z-index: 10; touch-action: none;"></div>
          <div id="main-content-area" style="flex: 1; display: flex; flex-direction: column; overflow: hidden; background: #18191c; min-width: 0;">
            <div id="graph-controls-root"></div>
            <div style="flex: 1; display: flex; overflow: hidden; position: relative;">
              <div id="editor-root" style="flex: ${this.editorFlex}; height: 100%; display: flex; flex-direction: column; min-width: 0;"></div>
              <div id="graph-resizer" class="resizer" data-resizer="graph" style="width: 4px; cursor: col-resize; background: transparent; position: relative; z-index: 10; touch-action: none;"></div>
              <div id="graph-root" style="flex: ${this.graphFlex}; height: 100%; position: relative; min-width: 0;"></div>
            </div>
          </div>
          <div id="context-resizer" class="resizer" data-resizer="context" style="width: 4px; cursor: col-resize; background: transparent; position: relative; z-index: 10; touch-action: none;"></div>
          <div id="context-root" style="width: ${this.contextWidth}px; min-width: 200px; max-width: 500px; height: 100%; border-left: 1px solid #2d3748; flex-shrink: 0;"></div>
          <div id="chat-root" style="display: none; height: 100%; z-index: 100;"></div>
        </div>
        <footer style="height: 24px; background: #0d0e10; border-top: 1px solid #2d3748; display: flex; align-items: center; justify-content: space-between; padding: 0 16px; font-size: 11px; color: #718096;">
          <div>Status: Connected | Vault: /wiki</div>
          <div>Engine: Active | OpenCode Protocol v2.1</div>
        </footer>
      </div>
    `;

    this.headerContainer = this.container.querySelector('#header-root')!;
    this.sidebarContainer = this.container.querySelector('#sidebar-root')!;
    this.editorContainer = this.container.querySelector('#editor-root')!;
    this.graphContainer = this.container.querySelector('#graph-root')!;
    this.contextContainer = this.container.querySelector('#context-root')!;
    this.graphControlsContainer = this.container.querySelector('#graph-controls-root')!;
    this.chatContainer = this.container.querySelector('#chat-root')!;

    this.bindResizers();
  }

  private bindResizers(): void {
    const sidebarResizer = this.container.querySelector('#sidebar-resizer') as HTMLElement;
    const graphResizer = this.container.querySelector('#graph-resizer') as HTMLElement;
    const contextResizer = this.container.querySelector('#context-resizer') as HTMLElement;

    const startResize = (e: MouseEvent, type: 'sidebar' | 'graph' | 'context') => {
      e.preventDefault();
      if (type === 'sidebar') this.isResizingSidebar = true;
      else if (type === 'graph') this.isResizingGraph = true;
      else this.isResizingContext = true;

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    };

    const onMouseMove = (e: MouseEvent) => {
      if (this.isResizingSidebar) {
        const newWidth = Math.max(200, Math.min(500, e.clientX));
        this.sidebarWidth = newWidth;
        this.sidebarContainer.style.width = `${newWidth}px`;
      } else if (this.isResizingGraph) {
        const mainArea = this.container.querySelector('#main-content-area') as HTMLElement;
        const editorRect = this.editorContainer.getBoundingClientRect();
        const mainRect = mainArea.getBoundingClientRect();
        const offset = e.clientX - mainRect.left;
        const totalWidth = mainRect.width;
        if (offset > 200 && offset < totalWidth - 200) {
          this.editorFlex = offset / totalWidth;
          this.graphFlex = 1 - this.editorFlex;
          this.editorContainer.style.flex = String(this.editorFlex);
          this.graphContainer.style.flex = String(this.graphFlex);
        }
      } else if (this.isResizingContext) {
        const appRect = this.container.querySelector('#wiki-forge-app')!.getBoundingClientRect();
        const offset = appRect.right - e.clientX;
        const newWidth = Math.max(200, Math.min(500, offset));
        this.contextWidth = newWidth;
        this.contextContainer.style.width = `${newWidth}px`;
      }
    };

    const onMouseUp = () => {
      this.isResizingSidebar = false;
      this.isResizingGraph = false;
      this.isResizingContext = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    sidebarResizer?.addEventListener('mousedown', (e) => startResize(e, 'sidebar'));
    graphResizer?.addEventListener('mousedown', (e) => startResize(e, 'graph'));
    contextResizer?.addEventListener('mousedown', (e) => startResize(e, 'context'));

    // Visual feedback on hover
    [sidebarResizer, graphResizer, contextResizer].forEach(resizer => {
      resizer?.addEventListener('mouseenter', () => {
        resizer.style.background = '#3182ce';
      });
      resizer?.addEventListener('mouseleave', () => {
        if (!this.isResizingSidebar && !this.isResizingGraph && !this.isResizingContext) {
          resizer.style.background = 'transparent';
        }
      });
    });
  }

  private isResizingGraph = false;

  public setViewMode(mode: 'editor' | 'graph' | 'split'): void {
    if (mode === 'editor') {
      this.editorContainer.style.display = 'flex';
      this.graphContainer.style.display = 'none';
      this.graphControlsContainer.style.display = 'none';
      const graphResizer = this.container.querySelector('#graph-resizer') as HTMLElement;
      if (graphResizer) graphResizer.style.display = 'none';
    } else if (mode === 'graph') {
      this.editorContainer.style.display = 'none';
      this.graphContainer.style.display = 'block';
      this.graphControlsContainer.style.display = 'block';
      const graphResizer = this.container.querySelector('#graph-resizer') as HTMLElement;
      if (graphResizer) graphResizer.style.display = 'none';
    } else {
      this.editorContainer.style.display = 'flex';
      this.graphContainer.style.display = 'block';
      this.graphControlsContainer.style.display = 'block';
      const graphResizer = this.container.querySelector('#graph-resizer') as HTMLElement;
      if (graphResizer) graphResizer.style.display = 'block';
    }
  }
}
