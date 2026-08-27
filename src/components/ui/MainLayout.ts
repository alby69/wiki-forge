export class MainLayout {
  private container: HTMLElement;
  public sidebarContainer!: HTMLElement;
  public editorContainer!: HTMLElement;
  public graphContainer!: HTMLElement;
  public contextContainer!: HTMLElement;
  public headerContainer!: HTMLElement;
  public graphControlsContainer!: HTMLElement;
  public chatContainer!: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
    this.render();
  }

  public render(): void {
    this.container.innerHTML = `
      <div id="wiki-forge-app" style="display: flex; flex-direction: column; height: 100vh; width: 100vw; background: #121316; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; overflow: hidden;">
        <div id="header-root"></div>
        <div style="flex: 1; display: flex; overflow: hidden; position: relative;">
          <div id="sidebar-root"></div>
          <div id="main-content-area" style="flex: 1; display: flex; flex-direction: column; overflow: hidden; background: #18191c;">
            <div id="graph-controls-root"></div>
            <div style="flex: 1; display: flex; overflow: hidden; position: relative;">
              <div id="editor-root" style="flex: 1; height: 100%; display: flex; flex-direction: column;"></div>
              <div id="graph-root" style="flex: 1; height: 100%; position: relative;"></div>
            </div>
          </div>
          <div id="context-root" style="width: 280px; height: 100%; border-left: 1px solid #2d3748;"></div>
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
  }

  public setViewMode(mode: 'editor' | 'graph' | 'split'): void {
    if (mode === 'editor') {
      this.editorContainer.style.display = 'flex';
      this.graphContainer.style.display = 'none';
      this.graphControlsContainer.style.display = 'none';
    } else if (mode === 'graph') {
      this.editorContainer.style.display = 'none';
      this.graphContainer.style.display = 'block';
      this.graphControlsContainer.style.display = 'block';
    } else {
      this.editorContainer.style.display = 'flex';
      this.graphContainer.style.display = 'block';
      this.graphControlsContainer.style.display = 'block';
    }
  }
}
