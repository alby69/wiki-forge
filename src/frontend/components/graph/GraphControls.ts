import { GraphFilterOptions } from '@frontend/core/types/graph';

interface GraphControlsCallbacks {
  onFilterChange: (options: GraphFilterOptions) => void;
  onZoom: (action: 'in' | 'out' | 'fit') => void;
}

export class GraphControls {
  private container: HTMLElement;
  private cb: GraphControlsCallbacks;
  private folders: string[] = [];
  private excluded: string[] = [];

  constructor(container: HTMLElement, cb: GraphControlsCallbacks) {
    this.container = container;
    this.cb = cb;
    this.render();
  }

  /**
   * (Re)populates the folder checkbox list used to hide whole thematic
   * folders from the graph. Called whenever the vault changes.
   */
  public setAvailableFolders(folders: string[], excluded: string[]): void {
    this.folders = folders;
    this.excluded = excluded.filter(f => folders.includes(f));
    this.renderFolderFilters();
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private render(): void {
    this.container.innerHTML = `
      <div class="graph-controls-panel" style="padding: 10px; background: #1a1b1e; border-bottom: 1px solid #2d3748; display: flex; gap: 12px; align-items: center; flex-wrap: wrap; font-size: 13px;">
        <span style="font-weight: 600; color: #e2e8f0;">Graph:</span>
        <div style="display: flex; gap: 4px;">
          <button id="graph-zoom-in" title="Zoom in" style="background: #2d3748; color: #fff; border: 1px solid #4a5568; width: 28px; height: 26px; border-radius: 4px; cursor: pointer;">+</button>
          <button id="graph-zoom-out" title="Zoom out" style="background: #2d3748; color: #fff; border: 1px solid #4a5568; width: 28px; height: 26px; border-radius: 4px; cursor: pointer;">&minus;</button>
          <button id="graph-zoom-fit" title="Fit to view" style="background: #2d3748; color: #fff; border: 1px solid #4a5568; padding: 0 8px; height: 26px; border-radius: 4px; cursor: pointer; font-size: 12px;">Fit</button>
        </div>
        <input type="text" id="graph-search-input" placeholder="Search node..." style="background: #2d3748; border: 1px solid #4a5568; color: #fff; padding: 4px 8px; border-radius: 4px; font-size: 12px;" />
        <label style="color: #a0aec0; display: flex; align-items: center; gap: 4px;">
          Min connections:
          <input type="number" id="graph-degree-input" min="0" max="20" value="0" style="width: 45px; background: #2d3748; border: 1px solid #4a5568; color: #fff; padding: 4px; border-radius: 4px; font-size: 12px;" />
        </label>
        <label style="color: #a0aec0; display: flex; align-items: center; gap: 4px; cursor: pointer;" title="Raggruppa i nodi per cartella/tipo in super-nodi per migliorare le prestazioni con wiki di grandi dimensioni">
          <input type="checkbox" id="graph-cluster-toggle" style="cursor: pointer;" />
          Attiva Clustering
        </label>
        <details style="color: #a0aec0;">
          <summary style="cursor: pointer; user-select: none;" title="Scegli le cartelle da nascondere dal grafo">Nascondi cartelle</summary>
          <div id="graph-folder-exclude-box" style="position: absolute; margin-top: 6px; padding: 6px; background: #202127; border: 1px solid #2d3748; border-radius: 4px; display: flex; flex-direction: column; gap: 4px; min-width: 160px; max-height: 260px; overflow-y: auto; z-index: 5;"></div>
        </details>
        <button id="reset-graph-btn" style="background: #4a5568; color: #fff; border: none; padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 12px;">Reset</button>
      </div>
    `;

    const searchInput = this.container.querySelector('#graph-search-input') as HTMLInputElement;
    const degreeInput = this.container.querySelector('#graph-degree-input') as HTMLInputElement;
    const clusterToggle = this.container.querySelector('#graph-cluster-toggle') as HTMLInputElement;
    const resetBtn = this.container.querySelector('#reset-graph-btn') as HTMLButtonElement;

    const currentOptions = (): GraphFilterOptions => ({
      searchQuery: searchInput.value,
      minDegree: parseInt(degreeInput.value, 10) || 0,
      enableClustering: clusterToggle.checked,
      excludedFolders: [...this.excluded],
    });

    const triggerChange = () => {
      this.cb.onFilterChange(currentOptions());
    };

    searchInput.addEventListener('input', triggerChange);
    degreeInput.addEventListener('change', triggerChange);
    clusterToggle.addEventListener('change', triggerChange);
    resetBtn.addEventListener('click', () => {
      searchInput.value = '';
      degreeInput.value = '0';
      clusterToggle.checked = false;
      this.excluded = [];
      this.renderFolderFilters();
      triggerChange();
    });

    this.container.querySelector('#graph-zoom-in')?.addEventListener('click', () => this.cb.onZoom('in'));
    this.container.querySelector('#graph-zoom-out')?.addEventListener('click', () => this.cb.onZoom('out'));
    this.container.querySelector('#graph-zoom-fit')?.addEventListener('click', () => this.cb.onZoom('fit'));

    this.renderFolderFilters();
  }

  private renderFolderFilters(): void {
    const box = this.container.querySelector('#graph-folder-exclude-box') as HTMLElement | null;
    if (!box) return;

    if (this.folders.length === 0) {
      box.innerHTML = '<span style="color: #718096; font-size: 12px;">Nessuna cartella</span>';
      return;
    }

    box.innerHTML = this.folders
      .map(
        folder => `
          <label style="display: flex; align-items: center; gap: 6px; color: #cbd5e0; font-size: 12px; cursor: pointer;">
            <input type="checkbox" value="${this.escapeHtml(folder)}" ${this.excluded.includes(folder) ? 'checked' : ''} style="cursor: pointer;" />
            <span>${this.escapeHtml(folder)}</span>
          </label>`
      )
      .join('');

    box.querySelectorAll('input[type="checkbox"]').forEach(elm => {
      elm.addEventListener('change', () => {
        const checkbox = elm as HTMLInputElement;
        const folder = checkbox.value;
        if (checkbox.checked) {
          if (!this.excluded.includes(folder)) this.excluded.push(folder);
        } else {
          this.excluded = this.excluded.filter(f => f !== folder);
        }
        this.cb.onFilterChange({
          searchQuery: (this.container.querySelector('#graph-search-input') as HTMLInputElement).value,
          minDegree: parseInt((this.container.querySelector('#graph-degree-input') as HTMLInputElement).value, 10) || 0,
          enableClustering: (this.container.querySelector('#graph-cluster-toggle') as HTMLInputElement).checked,
          excludedFolders: [...this.excluded],
        });
      });
    });
  }
}