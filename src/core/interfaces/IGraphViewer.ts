import { GraphData, GraphFilterOptions } from '../types/graph';

/**
 * Interface contract for Graph Viewer Renderers (Decoupled Adapter)
 */
export interface IGraphViewer {
  /**
   * Renders the knowledge graph inside the specified HTML container element
   */
  render(container: HTMLElement, data: GraphData): void;

  /**
   * Highlights a node and its adjacent connected neighborhood
   */
  highlightNode(nodeId: string | null): void;

  /**
   * Sets callback when a node is clicked in the graph
   */
  onNodeClick(callback: (nodeId: string) => void): void;

  /**
   * Sets callback when a node is hovered in the graph
   */
  onNodeHover?(callback: (nodeId: string | null) => void): void;

  /**
   * Updates graph data dynamically without full re-render if supported
   */
  updateData(data: GraphData): void;

  /**
   * Applies filter options (e.g. tag filter, degree filter)
   */
  applyFilter(options: GraphFilterOptions): void;

  /**
   * Destroys instance and cleans up event listeners & WebGL/Canvas contexts
   */
  destroy(): void;
}
