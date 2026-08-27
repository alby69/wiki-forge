import { IGraphViewer } from '../../core/interfaces/IGraphViewer';
import { GraphData, GraphFilterOptions, GraphNode } from '../../core/types/graph';
import { escapeHtml } from '../../core/utils/html';

export class ForceGraphViewer implements IGraphViewer {
  private container: HTMLElement | null = null;
  private data: GraphData = { nodes: [], links: [] };
  private activeFilter: GraphFilterOptions = {};
  private onNodeClickCb?: (nodeId: string) => void;
  private onNodeHoverCb?: (nodeId: string | null) => void;
  private highlightedNodeId: string | null = null;

  public render(container: HTMLElement, data: GraphData): void {
    this.container = container;
    this.data = data;
    this.updateCanvas();
  }

  public highlightNode(nodeId: string | null): void {
    this.highlightedNodeId = nodeId;
    this.updateCanvas();
  }

  public onNodeClick(callback: (nodeId: string) => void): void {
    this.onNodeClickCb = callback;
  }

  public onNodeHover(callback: (nodeId: string | null) => void): void {
    this.onNodeHoverCb = callback;
  }

  public updateData(data: GraphData): void {
    this.data = data;
    this.updateCanvas();
  }

  public applyFilter(options: GraphFilterOptions): void {
    this.activeFilter = options;
    this.updateCanvas();
  }

  public destroy(): void {
    if (this.container) {
      this.container.innerHTML = '';
    }
  }

  private updateCanvas(): void {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="force-graph-wrapper" style="position: relative; width: 100%; height: 100%; background: #121316; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #a0aec0; overflow: hidden; border-radius: 8px;">
        <div class="graph-canvas-simulated" style="width: 100%; height: 100%; position: relative;">
          ${this.renderGraphNodesHTML()}
        </div>
      </div>
    `;

    this.attachEventListeners();
  }

  private renderGraphNodesHTML(): string {
    if (this.data.nodes.length === 0) {
      return `<div style="padding: 2rem; text-align: center;">No graph nodes match the active filter.</div>`;
    }

    const width = 800;
    const height = 500;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(centerX, centerY) - 80;

    const nodePositions = new Map<string, { x: number; y: number }>();
    const nodeCount = this.data.nodes.length;

    this.data.nodes.forEach((node, idx) => {
      const angle = (idx / nodeCount) * 2 * Math.PI;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);
      nodePositions.set(node.id, { x, y });
    });

    let svgContent = `<svg width="100%" height="100%" viewBox="0 0 ${width} ${height}" style="position: absolute; top:0; left:0;">`;

    // Render edges
    this.data.links.forEach(link => {
      const sourcePos = nodePositions.get(link.source);
      const targetPos = nodePositions.get(link.target);

      if (sourcePos && targetPos) {
        const isHighlighted =
          this.highlightedNodeId === link.source || this.highlightedNodeId === link.target;
        const strokeColor = isHighlighted ? '#64b5f6' : 'rgba(255, 255, 255, 0.15)';
        const strokeWidth = isHighlighted ? 2 : 1;

        svgContent += `
          <line x1="${sourcePos.x}" y1="${sourcePos.y}" x2="${targetPos.x}" y2="${targetPos.y}"
                stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-dasharray="${isHighlighted ? 'none' : '2,2'}" />
        `;
      }
    });

    // Render nodes
    this.data.nodes.forEach(node => {
      const pos = nodePositions.get(node.id)!;
      const isHighlighted = this.highlightedNodeId === node.id;
      const size = Math.min(24, Math.max(10, node.val * 3));
      const nodeColor = node.color || '#90a4ae';

      svgContent += `
        <g class="graph-node-group" data-node-id="${escapeHtml(node.id)}" style="cursor: pointer;">
          <circle cx="${pos.x}" cy="${pos.y}" r="${size}" fill="${nodeColor}"
                  stroke="${isHighlighted ? '#ffffff' : 'transparent'}" stroke-width="2"
                  style="transition: all 0.2s ease; filter: drop-shadow(0px 0px 6px ${nodeColor});" />
          <text x="${pos.x}" y="${pos.y + size + 14}" fill="${isHighlighted ? '#ffffff' : '#cbd5e1'}"
                font-size="11" font-family="sans-serif" text-anchor="middle">${escapeHtml(node.label)}</text>
        </g>
      `;
    });

    svgContent += `</svg>`;
    return svgContent;
  }

  private attachEventListeners(): void {
    if (!this.container) return;

    const nodeElements = this.container.querySelectorAll('.graph-node-group');
    nodeElements.forEach(el => {
      const nodeId = el.getAttribute('data-node-id');
      if (!nodeId) return;

      el.addEventListener('click', () => {
        if (this.onNodeClickCb) this.onNodeClickCb(nodeId);
      });

      el.addEventListener('mouseenter', () => {
        this.highlightNode(nodeId);
        if (this.onNodeHoverCb) this.onNodeHoverCb(nodeId);
      });

      el.addEventListener('mouseleave', () => {
        this.highlightNode(null);
        if (this.onNodeHoverCb) this.onNodeHoverCb(null);
      });
    });
  }
}
