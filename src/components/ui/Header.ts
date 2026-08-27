export class Header {
  private container: HTMLElement;
  private onViewModeChangeCb?: (mode: 'editor' | 'graph' | 'split') => void;

  constructor(container: HTMLElement, onViewModeChange?: (mode: 'editor' | 'graph' | 'split') => void) {
    this.container = container;
    this.onViewModeChangeCb = onViewModeChange;
    this.render();
  }

  public render(): void {
    this.container.innerHTML = `
      <header style="height: 50px; background: #121316; border-bottom: 1px solid #2d3748; display: flex; align-items: center; justify-content: space-between; padding: 0 16px; color: #e2e8f0;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <div style="font-weight: 700; font-size: 16px; color: #64b5f6; letter-spacing: 0.5px; display: flex; align-items: center; gap: 6px;">
            <span style="font-size: 18px;">⚒️</span> Wiki-Forge
          </div>
          <span style="font-size: 11px; background: #2d3748; color: #a0aec0; padding: 2px 6px; border-radius: 4px;">v2.0 UI</span>
        </div>

        <div style="display: flex; gap: 8px;">
          <button id="view-mode-editor" style="background: #2d3748; color: #e2e8f0; border: none; padding: 6px 12px; border-radius: 4px; font-size: 12px; cursor: pointer;">Editor</button>
          <button id="view-mode-graph" style="background: #2d3748; color: #e2e8f0; border: none; padding: 6px 12px; border-radius: 4px; font-size: 12px; cursor: pointer;">Graph View</button>
          <button id="view-mode-split" style="background: #3182ce; color: #ffffff; border: none; padding: 6px 12px; border-radius: 4px; font-size: 12px; cursor: pointer; font-weight: 600;">Split View</button>
        </div>
      </header>
    `;

    const editorBtn = this.container.querySelector('#view-mode-editor');
    const graphBtn = this.container.querySelector('#view-mode-graph');
    const splitBtn = this.container.querySelector('#view-mode-split');

    if (editorBtn) editorBtn.addEventListener('click', () => this.onViewModeChangeCb?.('editor'));
    if (graphBtn) graphBtn.addEventListener('click', () => this.onViewModeChangeCb?.('graph'));
    if (splitBtn) splitBtn.addEventListener('click', () => this.onViewModeChangeCb?.('split'));
  }
}
