import { GraphFilterOptions } from '../../core/types/graph';

interface GraphControlsCallbacks {
  onFilterChange: (options: GraphFilterOptions) => void;
  onZoom: (action: 'in' | 'out' | 'fit') => void;
}

export class GraphControls {
  private container: HTMLElement;
  private cb: GraphControlsCallbacks;

  constructor(container: HTMLElement, cb: GraphControlsCallbacks) {
    this.container = container;
    this.cb = cb;
    this.render();
  }

  public render(): void {
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
        <button id="reset-graph-btn" style="background: #4a5568; color: #fff; border: none; padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 12px;">Reset</button>
      </div>
    `;

    const searchInput = this.container.querySelector('#graph-search-input') as HTMLInputElement;
    const degreeInput = this.container.querySelector('#graph-degree-input') as HTMLInputElement;
    const resetBtn = this.container.querySelector('#reset-graph-btn') as HTMLButtonElement;

    const triggerChange = () => {
      this.cb.onFilterChange({
        searchQuery: searchInput.value,
        minDegree: parseInt(degreeInput.value, 10) || 0,
      });
    };

    searchInput.addEventListener('input', triggerChange);
    degreeInput.addEventListener('change', triggerChange);
    resetBtn.addEventListener('click', () => {
      searchInput.value = '';
      degreeInput.value = '0';
      triggerChange();
    });

    this.container.querySelector('#graph-zoom-in')?.addEventListener('click', () => this.cb.onZoom('in'));
    this.container.querySelector('#graph-zoom-out')?.addEventListener('click', () => this.cb.onZoom('out'));
    this.container.querySelector('#graph-zoom-fit')?.addEventListener('click', () => this.cb.onZoom('fit'));
  }
}
