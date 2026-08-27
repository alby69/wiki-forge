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
    if (!this.fg) {
      container.innerHTML = '';
      const factory = ForceGraph as unknown as (el: HTMLElement) => ForceGraph;
      // The container may not be laid out yet (0x0); never pass 0 or the canvas
      // stays invisible. Fall back to a sane size — the ResizeObserver below
      // snaps it to the real dimensions as soon as layout settles.
      const init = () => {
        const width = container.clientWidth || 800;
        const height = container.clientHeight || 600;
        this.fg = factory(container)
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

        this.resizeObs = new ResizeObserver(() => {
          if (this.fg && container.clientWidth && container.clientHeight) {
            this.fg.width(container.clientWidth).height(container.clientHeight);
          }
        });
        this.resizeObs.observe(container);
      };

      if (container.clientWidth && container.clientHeight) init();
      else requestAnimationFrame(init);
    }
    this.setData(data);
  }

  private setData(data: GraphData): void {
    this.data = data;
    this.adjacency = new Map();
    for (const link of data.links as LinkEnd[]) {
      const s = this.endId(link.source);
      const t = this.endId(link.target);
      if (!s || !t) continue;
      (this.adjacency.get(s) ?? this.adjacency.set(s, new Set()).get(s)!).add(t);
      (this.adjacency.get(t) ?? this.adjacency.set(t, new Set()).get(t)!).add(s);
    }
    if (this.fg) this.fg.graphData(data);
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

  /** Zoom in / out by a multiplicative factor (Obsidian-style buttons). */
  public zoomBy(factor: number): void {
    if (this.fg) this.fg.zoom(this.fg.zoom() * factor, 300);
  }

  /** Fit the whole graph into view. */
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

  // --- internals ---------------------------------------------------------

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
    // Re-assigning the same accessors forces force-graph to repaint.
    this.fg
      .nodeColor(this.nodeColorFn)
      .linkColor(this.linkColorFn)
      .linkWidth(this.linkWidthFn);
  }

  private nodeColorFn = (node: any): string => {
    const color = (node.color as string) || '#90a4ae';
    return this.isActive(node.id) ? color : this.dim(color);
  };

  private linkColorFn = (link: any): string => {
    const active = this.activeId();
    if (!active) return 'rgba(160,174,192,0.35)';
    const s = this.endId(link.source);
    const t = this.endId(link.target);
    if (s === active || t === active) return 'rgba(100,181,246,0.85)';
    return 'rgba(160,174,192,0.08)';
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
    const r = Math.max(3, Math.sqrt(val) * 2.2);
    const active = this.isActive(node.id);
    const color = (node.color as string) || '#90a4ae';

    ctx.beginPath();
    ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
    ctx.fillStyle = active ? color : this.dim(color);
    ctx.fill();

    if (node.id === this.highlightedNodeId) {
      ctx.lineWidth = 1.5 / globalScale;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
    }

    const fontSize = Math.max(2.5, 11 / globalScale);
    ctx.font = `${fontSize}px Sans-Serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = active ? '#e2e8f0' : 'rgba(203,213,225,0.4)';
    ctx.fillText(node.label, node.x, node.y + r + 1);
  };

  private tooltip(node: any): string {
    const tags = Array.isArray(node.tags) && node.tags.length ? `  ·  #${node.tags.join('  #')}` : '';
    return `<b>${node.label}</b>  (${node.group || 'wiki'})${tags}`;
  }

  private nodePointerArea = (node: any, paintColor: string, ctx: CanvasRenderingContext2D): void => {
    const val = typeof node.val === 'number' ? node.val : 1;
    const r = Math.max(3, Math.sqrt(val) * 2.2) + 2;
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
      : 'rgba(144,164,174,0.25)';
  }
}
