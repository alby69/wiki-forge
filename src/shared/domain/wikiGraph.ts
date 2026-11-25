import { MarkdownParser } from './markdownParser';
import type { WikiNote } from './wiki';
import type { WikiGraphDto, WikiGraphLinkDto, WikiGraphNodeDto } from '../api/types';

const parser = new MarkdownParser();

function isStructural(note: WikiNote): boolean {
  const fileName = (note.path || note.id).toLowerCase().split('/').pop() || '';
  return fileName === 'index' || fileName === 'index.md' || fileName === 'log' || fileName === 'log.md';
}

function getNodeColor(note: WikiNote): string {
  if (note.tags.includes('architecture')) return '#4fc3f7';
  if (note.tags.includes('assembly')) return '#ffb74d';
  if (note.tags.includes('python')) return '#81c784';
  if (note.tags.includes('llm') || note.tags.includes('agent')) return '#ba68c8';
  if (note.folder === 'wiki') return '#64b5f6';
  return '#90a4ae';
}

export function buildWikiGraph(notes: WikiNote[]): WikiGraphDto {
  const articleNotes = notes.filter(note => !isStructural(note));
  const knownNoteIds = new Set(articleNotes.map(note => note.id));
  const nodes: WikiGraphNodeDto[] = articleNotes.map(note => {
    const inDegree = note.backlinks?.length || 0;
    const outDegree = note.outboundLinks?.length || 0;
    return {
      id: note.id,
      label: note.title,
      group: note.folder || 'default',
      val: Math.max(1, inDegree + outDegree),
      color: getNodeColor(note),
      tags: note.tags,
    };
  });
  const links: WikiGraphLinkDto[] = [];
  for (const note of articleNotes) {
    for (const target of note.outboundLinks || []) {
      const targetNote = parser.resolveLinkTarget(target, notes);
      if (targetNote && knownNoteIds.has(targetNote.id)) {
        links.push({ source: note.id, target: targetNote.id, type: 'wikilink' });
      }
    }
  }
  return { nodes, links };
}
