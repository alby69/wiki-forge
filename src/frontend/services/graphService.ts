import { GraphData, GraphNode, GraphLink, GraphFilterOptions } from '@frontend/core/types/graph';
import type { WikiGraphDto } from '@shared/api/types';

export class GraphService {
  public generateGraphData(backendGraph: WikiGraphDto | null | undefined): GraphData {
    if (!backendGraph) return { nodes: [], links: [] };
    return {
      nodes: backendGraph.nodes.map(node => ({
        id: node.id,
        label: node.label,
        ...(node.group !== undefined ? { group: node.group } : {}),
        val: node.val,
        ...(node.color !== undefined ? { color: node.color } : {}),
        ...(node.tags !== undefined ? { tags: [...node.tags] } : {}),
      })),
      links: backendGraph.links.map(link => ({
        source: link.source,
        target: link.target,
        ...(link.type !== undefined ? { type: link.type } : {}),
      })),
    };
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

    if (options.excludedFolders && options.excludedFolders.length > 0) {
      const excluded = new Set(options.excludedFolders);
      filteredNodes = filteredNodes.filter(node => !(node.group && excluded.has(node.group)));
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

}
