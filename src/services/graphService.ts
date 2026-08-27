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

    return { nodes: filteredNodes, links: filteredLinks };
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
