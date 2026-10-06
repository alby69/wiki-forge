import ForceGraph from 'force-graph';
import { IGraphViewer } from '../../core/interfaces/IGraphViewer';
import { GraphData, GraphFilterOptions, GraphNode } from '../../core/types/graph';

interface LinkEnd {
  source: string | GraphNode;
  target: string | GraphNode;
}

export class ForceGraphViewer implements IGraphViewer {
  private container: HTMLElement | null = null;
  private fg: ForceGraph | null = null;
  private data: GraphData = { nodes: [], links: [] };
  private adjacency = new Map<string, Set<string>>();
  private activeFilter: GraphFilterOptions = {};
  private onNodeClickCb?: (nodeId: string) => void;
  private onNodeHoverCb?: (nodeId: string | null) => void;
  private highlightedNodeId: string | null = null;
  private hoverNodeId: string | null = null;
  private resizeObs: ResizeObserver | null = null;

  public render(container: HTMLElement, data: GraphData): void {
    this.container = container;
    this.container.style.position = 'relative';

    if (!this.fg) {
      container.innerHTML = '';
      const makeInstance = ForceGraph as unknown as (() => (el: HTMLElement) => ForceGraph);

      const init = () => {
        const width = container.clientWidth || 800;
        const height = container.clientHeight || 600;
        try {
          this.fg = makeInstance()(container)
            .width(width)
            .height(height)
            .nodeId('id')
            .nodeVal('val')
            .nodeRelSize(1)
            .linkColor(this.linkColorFn)
            .linkWidth(this.linkWidthFn)
            .nodeColor(this.nodeColorFn)
            .nodeCanvasObject(this.nodeCanvasObj)
            .nodeCanvasObjectMode(() => 'replace')
            .nodePointerAreaPaint(this.nodePointerArea)
            .nodeLabel((n: any) => this.tooltip(n))
            .onNodeClick((n: any) => this.handleClick(n))
            .onNodeHover((n: any) => this.handleHover(n))
            .onBackgroundClick(() => this.clearHighlight())
            .minZoom(0.2)
            .maxZoom(8);

          this.renderLegend(container);
        } catch (err) {
          container.innerHTML = `<pre style="color:#fc8181;padding:16px;white-space:pre-wrap;font-family:monospace;font-size:12px;">Graph failed to initialise:\n\n${err instanceof Error ? err.stack ?? err.message : String(err)}</pre>`;
          return;
        }

        this.fg.graphData(this.data);
        this.scheduleFit();

        this.resizeObs = new ResizeObserver(() => {
          if (!this.fg) return;
          const w = container.clientWidth;
          const h = container.clientHeight;
          if (w > 0 && h > 0) this.fg.width(w).height(h);
        });
        this.resizeObs.observe(container);
      };

      if (container.clientWidth && container.clientHeight) init();
      else requestAnimationFrame(init);
    }
    this.setData(data);
  }

  private renderLegend(container: HTMLElement): void {
    const legend = document.createElement('div');
    legend.id = 'graph-trust-legend';
    legend.style.cssText = `
      position: absolute; bottom: 16px; left: 16px; background: rgba(15, 23, 42, 0.85);
      border: 1px solid #334155; border-radius: 8px; padding: 8px 12px; font-size: 11px;
      color: #f8fafc; backdrop-filter: blur(4px); pointer-events: none; z-index: 10;
      display: flex; flex-direction: column; gap: 4px;
    `;
    legend.innerHTML = `
      <div style="font-weight: 700; color: #94a3b8; font-size: 10px; margin-bottom: 2px;">GRAPH ANALYTICS & LEGEND</div>
      <div style="display: flex; align-items: center; gap: 6px;">
        <span style="width: 8px; height: 8px; border-radius: 50%; background: #10b981;"></span> Human-Reviewed
      </div>
      <div style="display: flex; align-items: center; gap: 6px;">
        <span style="width: 8px; height: 8px; border-radius: 50%; background: #60a5fa;"></span> Machine-Confirmed
      </div>
      <div style="display: flex; align-items: center; gap: 6px;">
        <span style="width: 8px; height: 8px; border-radius: 50%; background: #94a3b8;"></span> Unverified
      </div>
      <div style="display: flex; align-items: center; gap: 6px;">
        <span style="width: 8px; height: 8px; border-radius: 50%; border: 1.5px solid #ef4444; background: transparent;"></span> Orphan Note
      </div>
      <div style="margin-top: 4px; border-top: 1px solid #334155; padding-top: 4px; font-size: 10px; color: #a0aec0;">
        Louvain Communities: Auto-Clustered by /api/v1/graph/clusters
      </div>
    `;
    container.appendChild(legend);
  }

  private scheduleFit(): void {
    if (!this.fg) return;
    const fit = () => {
      try {
        this.fg?.zoomToFit(400, 40);
      } catch {
        /* canvas not ready yet */
      }
    };
    setTimeout(fit, 60);
    setTimeout(fit, 400);
  }

  private setData(data: GraphData): void {
    const firstRealData = this.data.nodes.length === 0 && data.nodes.length > 0;
    this.data = data;
    this.adjacency = new Map();
    for (const link of data.links as LinkEnd[]) {
      const s = this.endId(link.source);
      const t = this.endId(link.target);
      if (!s || !t) continue;
      (this.adjacency.get(s) ?? this.adjacency.set(s, new Set()).get(s)!).add(t);
      (this.adjacency.get(t) ?? this.adjacency.set(t, new Set()).get(s)!).add(s);
    }
    if (this.fg) {
      this.fg.graphData(data);
      if (firstRealData) this.scheduleFit();
    }
  }

  private endId(end: string | GraphNode): string {
    return typeof end === 'object' ? (end as GraphNode).id : end;
  }

  public highlightNode(nodeId: string | null): void {
    this.highlightedNodeId = nodeId;
    this.refresh();
  }

  public onNodeClick(callback: (nodeId: string) => void): void {
    this.onNodeClickCb = callback;
  }

  public onNodeHover(callback: (nodeId: string | null) => void): void {
    this.onNodeHoverCb = callback;
  }

  public updateData(data: GraphData): void {
    this.setData(data);
  }

  public applyFilter(options: GraphFilterOptions): void {
    this.activeFilter = options;
  }

  public zoomBy(factor: number): void {
    if (this.fg) this.fg.zoom(this.fg.zoom() * factor, 300);
  }

  public zoomToFit(): void {
    if (this.fg) this.fg.zoomToFit(400, 40);
  }

  public destroy(): void {
    this.resizeObs?.disconnect();
    this.resizeObs = null;
    if (this.fg) {
      this.fg.pauseAnimation();
      (this.fg as any)._destructor?.();
      this.fg = null;
    }
    if (this.container) this.container.innerHTML = '';
  }

  private activeId(): string | null {
    return this.hoverNodeId ?? this.highlightedNodeId;
  }

  private isActive(nodeId: string): boolean {
    const active = this.activeId();
    if (!active) return true;
    return nodeId === active || (this.adjacency.get(active)?.has(nodeId) ?? false);
  }

  private refresh(): void {
    if (!this.fg) return;
    this.fg
      .nodeColor(this.nodeColorFn)
      .linkColor(this.linkColorFn)
      .linkWidth(this.linkWidthFn);
  }

  private nodeColorFn = (node: any): string => {
    const color = (node.color as string) || '#94a3b8';
    return this.isActive(node.id) ? color : this.dim(color);
  };

  private linkColorFn = (link: any): string => {
    const active = this.activeId();
    if (!active) return 'rgba(148,163,184,0.35)';
    const s = this.endId(link.source);
    const t = this.endId(link.target);
    if (s === active || t === active) return 'rgba(96,165,250,0.85)';
    return 'rgba(148,163,184,0.08)';
  };

  private linkWidthFn = (link: any): number => {
    const active = this.activeId();
    if (!active) return 1;
    const s = this.endId(link.source);
    const t = this.endId(link.target);
    return s === active || t === active ? 2.2 : 0.4;
  };

  private nodeCanvasObj = (node: any, ctx: CanvasRenderingContext2D, globalScale: number): void => {
    const val = typeof node.val === 'number' ? node.val : 1;
    const r = Math.max(3.5, Math.sqrt(val) * 2.2);
    const active = this.isActive(node.id);
    const color = (node.color as string) || '#94a3b8';

    ctx.beginPath();
    ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
    ctx.fillStyle = active ? color : this.dim(color);
    ctx.fill();

    if (node.isOrphan) {
      ctx.lineWidth = 1.8 / globalScale;
      ctx.strokeStyle = '#ef4444';
      ctx.stroke();
    } else if (node.id === this.highlightedNodeId) {
      ctx.lineWidth = 1.8 / globalScale;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
    }

    const fontSize = Math.max(2.5, 11 / globalScale);
    ctx.font = `${fontSize}px Sans-Serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = active ? '#f8fafc' : 'rgba(203,213,225,0.4)';
    ctx.fillText(node.label, node.x, node.y + r + 1);
  };

  private tooltip(node: any): string {
    const tags = Array.isArray(node.tags) && node.tags.length ? ` · #${node.tags.join('  #')}` : '';
    const trust = node.trustTier ? ` · Tier: ${node.trustTier}` : '';
    return `<b>${node.label}</b> (${node.group || 'wiki'})${trust}${tags}`;
  }

  private nodePointerArea = (node: any, paintColor: string, ctx: CanvasRenderingContext2D): void => {
    const val = typeof node.val === 'number' ? node.val : 1;
    const r = Math.max(3.5, Math.sqrt(val) * 2.2) + 2;
    ctx.fillStyle = paintColor;
    ctx.beginPath();
    ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
    ctx.fill();
  };

  private handleClick(node: any): void {
    this.highlightedNodeId = node.id;
    this.refresh();
    if (this.fg) {
      this.fg.centerAt(node.x, node.y, 600);
      this.fg.zoom(2.2, 600);
    }
    if (this.onNodeClickCb) this.onNodeClickCb(node.id);
  }

  private handleHover(node: any | null): void {
    this.hoverNodeId = node ? node.id : null;
    this.refresh();
    if (this.onNodeHoverCb) this.onNodeHoverCb(node ? node.id : null);
    if (this.container) this.container.style.cursor = node ? 'pointer' : 'grab';
  }

  private clearHighlight(): void {
    this.highlightedNodeId = null;
    this.hoverNodeId = null;
    this.refresh();
  }

  private dim(color: string): string {
    return color.length === 7 && color.startsWith('#')
      ? `${color}40`
      : 'rgba(148,163,184,0.25)';
  }
}
