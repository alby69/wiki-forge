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
      const totalDegree = inDegree + outDegree;
      const val = Math.max(1, totalDegree);

      const okfType = (typeof note.frontmatter?.type === 'string'
        ? note.frontmatter.type
        : this.inferOkfType(note));

      nodes.push({
        id: note.id,
        label: note.title,
        group: note.folder || 'default',
        val,
        color: this.getNodeColor(note, okfType),
        tags: note.tags,
        okfType,
        trustTier: note.trustTier || 'unverified',
        status: note.status || 'draft',
        isOrphan: totalDegree === 0,
        inDegree,
        outDegree,
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
   * Filters GraphData based on user criteria (tags, search, degree, OKF filters, depth, maxNodes)
   */
  public filterGraphData(data: GraphData, options: GraphFilterOptions): GraphData {
    let filteredNodes = [...data.nodes];

    // OKF Filters
    if (options.hideDrafts) {
      filteredNodes = filteredNodes.filter(node => node.status !== 'draft');
    }

    if (options.hideUnverified) {
      filteredNodes = filteredNodes.filter(node => node.trustTier !== 'unverified');
    }

    if (options.showOnlyOrphans) {
      filteredNodes = filteredNodes.filter(node => node.isOrphan);
    }

    if (options.okfType && options.okfType !== 'all') {
      filteredNodes = filteredNodes.filter(node =>
        node.okfType?.toLowerCase() === options.okfType!.toLowerCase()
      );
    }

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

    // Contextual neighborhood filtering if activeNodeId and neighborhoodDepth are specified
    if (options.activeNodeId && options.neighborhoodDepth && options.neighborhoodDepth > 0) {
      const activeId = options.activeNodeId;
      const depth = options.neighborhoodDepth;
      const allowedNodeIds = new Set<string>([activeId]);
      let currentBorder = new Set<string>([activeId]);

      for (let d = 0; d < depth; d++) {
        const nextBorder = new Set<string>();
        for (const link of data.links) {
          const s = typeof link.source === 'object' ? (link.source as any).id : link.source;
          const t = typeof link.target === 'object' ? (link.target as any).id : link.target;
          if (currentBorder.has(s) && !allowedNodeIds.has(t)) {
            allowedNodeIds.add(t);
            nextBorder.add(t);
          }
          if (currentBorder.has(t) && !allowedNodeIds.has(s)) {
            allowedNodeIds.add(s);
            nextBorder.add(s);
          }
        }
        currentBorder = nextBorder;
      }

      filteredNodes = filteredNodes.filter(node => allowedNodeIds.has(node.id));
    }

    // Default max nodes cap (e.g., 50) to prevent unreadable hairball if no search or specific filter is set
    const maxNodesLimit = options.maxNodes ?? 50;
    const isExplicitSearch = Boolean(options.searchQuery?.trim()) || (options.selectedTags && options.selectedTags.length > 0);

    if (!isExplicitSearch && filteredNodes.length > maxNodesLimit) {
      // Prioritize active node, high degree hubs, and non-orphans
      const activeId = options.activeNodeId;
      filteredNodes.sort((a, b) => {
        if (a.id === activeId) return -1;
        if (b.id === activeId) return 1;
        return b.val - a.val;
      });
      filteredNodes = filteredNodes.slice(0, maxNodesLimit);
    }

    const validNodeIds = new Set(filteredNodes.map(n => n.id));
    const filteredLinks = data.links.filter(
      link => {
        const s = typeof link.source === 'object' ? (link.source as any).id : link.source;
        const t = typeof link.target === 'object' ? (link.target as any).id : link.target;
        return validNodeIds.has(s) && validNodeIds.has(t);
      }
    );

    return { nodes: filteredNodes, links: filteredLinks };
  }

  private inferOkfType(note: WikiNote): string {
    const tags = note.tags.map(t => t.toLowerCase());
    if (tags.includes('paper') || tags.includes('article')) return 'Paper';
    if (tags.includes('tool') || tags.includes('software')) return 'Tool';
    if (tags.includes('workflow') || tags.includes('process')) return 'Workflow';
    if (tags.includes('guideline') || tags.includes('policy')) return 'Guideline';
    if (tags.includes('thesis')) return 'Thesis';
    return 'Concept';
  }

  /**
   * Helper to select node color based on OKF type or tag/folder
   */
  private getNodeColor(note: WikiNote, okfType?: string): string {
    if (note.tags.includes('architecture')) return '#4fc3f7';
    if (note.tags.includes('assembly')) return '#ffb74d';
    if (note.tags.includes('python')) return '#81c784';
    if (note.tags.includes('llm') || note.tags.includes('agent')) return '#ba68c8';

    switch (okfType) {
      case 'Paper': return '#81c784';      // Green
      case 'Tool': return '#ba68c8';       // Purple
      case 'Workflow': return '#ffb74d';   // Orange
      case 'Guideline': return '#e57373';  // Red-pink
      case 'Thesis': return '#f687b3';     // Pink
      case 'Concept': return '#4fc3f7';    // Cyan/Blue
      default: break;
    }

    if (note.folder === 'wiki') return '#64b5f6';
    return '#90a4ae';
  }
}
