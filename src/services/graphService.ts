import { GraphData, GraphNode, GraphLink, GraphFilterOptions } from '../core/types/graph';
import { WikiNote } from '../core/types/wiki';
import { MarkdownParser } from './markdownParser';

export class GraphService {
  private parser = new MarkdownParser();

  /**
   * Transforms WikiNotes into standard GraphData JSON for Graph Viewer engine
   */
  public generateGraphData(notes: WikiNote[]): GraphData {
    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];
    const knownNoteIds = new Set<string>();

    notes.forEach(note => knownNoteIds.add(note.id));

    // 1. Create nodes
    notes.forEach(note => {
      const inDegree = note.backlinks?.length || 0;
      const outDegree = note.outboundLinks?.length || 0;
      const val = Math.max(1, inDegree + outDegree);

      nodes.push({
        id: note.id,
        label: note.title,
        group: note.folder || 'default',
        val,
        color: this.getNodeColor(note),
        tags: note.tags,
      });
    });

    // 2. Create edges from wiki links (resolves same- and cross-folder links)
    notes.forEach(note => {
      note.outboundLinks.forEach(target => {
        const targetNote = this.parser.resolveLinkTarget(target, notes);

        if (targetNote && knownNoteIds.has(targetNote.id)) {
          links.push({
            source: note.id,
            target: targetNote.id,
            type: 'wikilink',
          });
        }
      });
    });

    return { nodes, links };
  }

  /**
   * Filters GraphData based on user criteria (tags, search, degree)
   */
  public filterGraphData(data: GraphData, options: GraphFilterOptions): GraphData {
    let filteredNodes = [...data.nodes];

    if (options.selectedTags && options.selectedTags.length > 0) {
      filteredNodes = filteredNodes.filter(node =>
        node.tags?.some(tag => options.selectedTags!.includes(tag))
      );
    }

    if (options.searchQuery && options.searchQuery.trim()) {
      const query = options.searchQuery.toLowerCase().trim();
      filteredNodes = filteredNodes.filter(node =>
        node.label.toLowerCase().includes(query) || node.id.toLowerCase().includes(query)
      );
    }

    if (options.minDegree && options.minDegree > 0) {
      filteredNodes = filteredNodes.filter(node => node.val >= options.minDegree!);
    }

    if (options.folder && options.folder !== 'all') {
      filteredNodes = filteredNodes.filter(node => node.group === options.folder);
    }

    const validNodeIds = new Set(filteredNodes.map(n => n.id));
    const filteredLinks = data.links.filter(
      link => validNodeIds.has(link.source) && validNodeIds.has(link.target)
    );

    const CLUSTER_THRESHOLD = 300;
    const shouldCluster = options.enableClustering ?? (filteredNodes.length > CLUSTER_THRESHOLD);

    const filteredData = { nodes: filteredNodes, links: filteredLinks };

    if (shouldCluster) {
      return this.clusterGraphData(filteredData);
    }

    return filteredData;
  }

  /**
   * Clusters nodes by group (folder/type) into super-nodes for large graphs
   */
  public clusterGraphData(data: GraphData): GraphData {
    if (data.nodes.length === 0) return data;

    const clusters = new Map<string, GraphNode[]>();
    const nodeToClusterMap = new Map<string, string>();

    for (const node of data.nodes) {
      const clusterKey = node.group || 'general';
      if (!clusters.has(clusterKey)) {
        clusters.set(clusterKey, []);
      }
      clusters.get(clusterKey)!.push(node);
      nodeToClusterMap.set(node.id, `cluster:${clusterKey}`);
    }

    const superNodes: GraphNode[] = [];
    for (const [clusterKey, clusterNodes] of clusters.entries()) {
      const totalVal = clusterNodes.reduce((acc, n) => acc + (n.val || 1), 0);
      const repColor = clusterNodes[0]?.color || '#64b5f6';
      const aggregatedTags = Array.from(new Set(clusterNodes.flatMap(n => n.tags || [])));

      superNodes.push({
        id: `cluster:${clusterKey}`,
        label: `📦 ${clusterKey} (${clusterNodes.length})`,
        group: clusterKey,
        val: Math.max(5, Math.min(30, totalVal)),
        color: repColor,
        tags: aggregatedTags,
      });
    }

    const superLinksSet = new Set<string>();
    const superLinks: GraphLink[] = [];

    for (const link of data.links) {
      const srcId = typeof link.source === 'object' ? (link.source as any).id : link.source;
      const tgtId = typeof link.target === 'object' ? (link.target as any).id : link.target;
      const srcCluster = nodeToClusterMap.get(srcId);
      const tgtCluster = nodeToClusterMap.get(tgtId);

      if (srcCluster && tgtCluster && srcCluster !== tgtCluster) {
        const linkKey = `${srcCluster}->${tgtCluster}`;
        if (!superLinksSet.has(linkKey)) {
          superLinksSet.add(linkKey);
          superLinks.push({
            source: srcCluster,
            target: tgtCluster,
            type: 'cluster-link',
          });
        }
      }
    }

    return { nodes: superNodes, links: superLinks };
  }

  /**
   * Helper to select node color based on tag or folder
   */
  private getNodeColor(note: WikiNote): string {
    if (note.tags.includes('architecture')) return '#4fc3f7';
    if (note.tags.includes('assembly')) return '#ffb74d';
    if (note.tags.includes('python')) return '#81c784';
    if (note.tags.includes('llm') || note.tags.includes('agent')) return '#ba68c8';
    if (note.folder === 'wiki') return '#64b5f6';
    return '#90a4ae';
  }
}
