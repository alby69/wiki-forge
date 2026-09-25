/**
 * Knowledge Graph Node and Link definitions for the Graph Viewer
 */

export interface GraphNode {
  id: string;        // Unique identifier (relative path or note ID)
  label: string;     // Display title on the node
  group?: string;    // Folder or primary tag category
  val: number;       // Node size weight based on link degree
  color?: string;    // Accent color based on tag or status
  tags?: string[];   // Associated tags for filtering
  okfType?: string;  // OKF Note Type (Concept, Paper, Tool, Workflow, etc.)
  trustTier?: 'human-reviewed' | 'machine-confirmed' | 'unverified'; // OKF Trust Tier
  status?: string;   // Note status (draft, stable, deprecated)
  isOrphan?: boolean; // Whether node has 0 inbound and outbound links
  inDegree?: number;
  outDegree?: number;
}

export interface GraphLink {
  source: string;    // ID of source node
  target: string;    // ID of target node
  type?: string;     // Relationship type (e.g., "wikilink", "tag", "parent")
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export interface GraphFilterOptions {
  selectedTags?: string[];
  searchQuery?: string;
  minDegree?: number;
  folder?: string;
  hideDrafts?: boolean;
  hideUnverified?: boolean;
  showOnlyOrphans?: boolean;
  okfType?: string;
  activeNodeId?: string;
  neighborhoodDepth?: number; // 0 (all), 1 (direct), 2 (depth 2)
  maxNodes?: number; // default max nodes limit (e.g. 50)
}
