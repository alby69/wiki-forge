import { WikiNote } from '../../frontend/core/types/wiki';

/**
 * Deterministic building blocks behind the Study Studio.
 *
 * They only work on the notes already loaded by `AgentServer`, so they can be
 * unit-tested without a filesystem or a running server. The same builders feed
 * the chat commands (`/study-guide`, `/quiz`, `/mindmap`, `/audio-overview`,
 * `/thesis-chapter`) and the `POST /api/notes/study/*` endpoints.
 */

export interface StudyNoteRef {
  id: string;
  title: string;
  path: string;
  folder: string;
}

export interface StudySource extends StudyNoteRef {}

export interface StudyMindmapNode {
  id: string;
  label: string;
  group: string;
}

export interface StudyMindmapLink {
  source: string;
  target: string;
}

export interface StudyThesisChapter {
  title: string;
  number: number;
  path: string;
  maturity: number;
}

export interface StudyThesisSynthesis {
  title: string;
  path: string;
  maturity: number;
  type: string;
}

export interface StudyThesisResult {
  title: string;
  minMaturity: number;
  markdown: string;
  chapters: StudyThesisChapter[];
  syntheses: StudyThesisSynthesis[];
}

const STRUCTURAL_IDS = /^(index|log)$/i;
const CHAPTER_TYPES = new Set(['capitolo_tesi', 'capitolo']);
const SYNTHESIS_TYPES = new Set(['sintesi', 'concetto', 'concept']);
const CHAPTER_TAGS = new Set(['thesis/chapter', 'type/chapter', 'chapter']);

export function toStudyNoteRef(note: WikiNote): StudyNoteRef {
  return {
    id: note.id,
    title: note.title,
    path: note.path,
    folder: note.folder || 'wiki',
  };
}

/** Notes that make sense as study material (indexes and logs are structural). */
export function usableStudyNotes(notes: WikiNote[]): WikiNote[] {
  const filtered = notes.filter(note => !STRUCTURAL_IDS.test(note.id));
  return filtered.length > 0 ? filtered : notes;
}

export function slugifyTopic(value: string, fallback: string = 'general'): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || fallback;
}

/**
 * Ranks the notes against a free-text topic. With no topic it returns the
 * first `limit` notes, which is what the chat commands do for a quick overview.
 */
export function matchNotesByTopic(notes: WikiNote[], topic: string, limit: number = 5): WikiNote[] {
  const pool = usableStudyNotes(notes);
  const query = topic.trim().toLowerCase();
  const cappedLimit = Math.max(1, Math.min(50, limit));

  if (!query) return pool.slice(0, cappedLimit);

  const words = query.split(/\s+/).filter(Boolean);
  const scored = pool
    .map(note => {
      const title = note.title.toLowerCase();
      const id = note.id.toLowerCase();
      const folder = (note.folder || '').toLowerCase();
      const tags = note.tags.join(' ').toLowerCase();
      const body = note.content.toLowerCase();

      let score = 0;
      for (const word of words) {
        if (title.includes(word)) score += 6;
        else if (id.includes(word)) score += 5;
        else if (folder.includes(word)) score += 4;
        else if (tags.includes(word)) score += 3;
        else if (body.includes(word)) score += 1;
      }
      return { note, score };
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || a.note.title.localeCompare(b.note.title));

  if (scored.length === 0) return pool.slice(0, cappedLimit);
  return scored.slice(0, cappedLimit).map(item => item.note);
}

export function noteSources(notes: WikiNote[]): StudySource[] {
  return notes.map(toStudyNoteRef);
}

function sourceLines(notes: WikiNote[]): string {
  if (notes.length === 0) return '  - wiki/index.md';
  return notes.map(note => `  - ${note.path.startsWith('wiki/') ? note.path : `wiki/${note.path}`}`).join('\n');
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function uniqueTags(notes: WikiNote[]): string[] {
  const seen = new Set<string>();
  for (const note of notes) {
    for (const tag of note.tags) {
      const value = tag.trim();
      if (value) seen.add(value);
    }
  }
  return Array.from(seen).sort();
}

// ---------------------------------------------------------------------------
// Study guide
// ---------------------------------------------------------------------------

export function buildStudyGuide(notes: WikiNote[], topic: string): { markdown: string; sources: StudySource[]; notes: WikiNote[]; slug: string } {
  const relevant = matchNotesByTopic(notes, topic, 6);
  const slug = slugifyTopic(topic);
  const heading = topic.trim() || 'General Overview';
  const sourceNotes = relevant.length > 0 ? relevant : usableStudyNotes(notes).slice(0, 3);
  const tags = uniqueTags(sourceNotes);

  const sections = sourceNotes
    .map(note => {
      const keyTerms = note.tags.length > 0 ? note.tags.join(', ') : 'general';
      const summary = firstMeaningfulLine(note.content) || 'Key concept of the note.';
      return `### ${note.title}
- **Summary**: ${summary}
- **Note**: [[${note.id}]]
- **Folder**: ${note.folder || 'wiki'}
- **Key Terms**: ${keyTerms}
`;
    })
    .join('\n');

  const questions = sourceNotes.slice(0, 4).map((note, index) => {
    const number = index + 1;
    return `${number}. **Q${number}**: What are the core arguments presented in [[${note.id}]]?
   - *Answer*: Start from the summary of **${note.title}** and follow its wikilinks.`;
  });

  const markdown = `---
tags: [study-guide, ${slug}]
created: ${today()}
sources:
${sourceLines(sourceNotes)}
---

# Study Guide: ${heading}

## 📖 Executive Summary
Study guide covering **${sourceNotes.length}** wiki article(s) about *${heading}*.

## 🗂️ Section Breakdown
${sections || 'No notes found for this topic.'}

## 💡 Key Glossary & Terms
- **Primary Concepts**: ${sourceNotes.map(note => `[[${note.id}]]`).join(', ') || 'None'}
${tags.length > 0 ? `- **Tags**: ${tags.map(tag => `#${tag}`).join(', ')}` : ''}

## ❓ Self-Assessment Questions
${questions.join('\n') || '1. **Q1**: Which notes cover this topic? Start from [[index]].'}
`;

  return { markdown, sources: noteSources(sourceNotes), notes: sourceNotes, slug };
}

function firstMeaningfulLine(content: string): string {
  const body = stripFrontmatter(content);
  const line = body
    .split('\n')
    .map(text => text.trim())
    .find(text => text.length > 0 && !text.startsWith('#') && !text.startsWith('---'));
  return (line || '').slice(0, 220);
}

function stripFrontmatter(content: string): string {
  if (!content.startsWith('---')) return content;
  const match = content.match(/^---\s*\n[\s\S]*?\n---\s*\n?/);
  return match ? content.slice(match[0].length) : content;
}

// ---------------------------------------------------------------------------
// Quiz
// ---------------------------------------------------------------------------

export function buildQuiz(
  notes: WikiNote[],
  topic: string,
  requestedCount: number = 5
): { markdown: string; sources: StudySource[]; notes: WikiNote[]; count: number; slug: string } {
  const count = Math.max(1, Math.min(25, Math.floor(requestedCount) || 5));
  const relevant = matchNotesByTopic(notes, topic, 10);
  const pool = relevant.length > 0 ? relevant : usableStudyNotes(notes).slice(0, 3);
  const slug = slugifyTopic(topic);
  const heading = topic.trim() || 'General Knowledge';
  const letters = ['A', 'B', 'C', 'D'];

  const questions: string[] = [];
  for (let index = 1; index <= count; index++) {
    const note = pool[(index - 1) % Math.max(1, pool.length)];
    const title = note ? note.title : 'Wiki Concepts';
    const noteId = note ? note.id : 'index';
    const correct = (index - 1) % letters.length;

    const options = letters.map((letter, optionIndex) => {
      if (optionIndex === correct) return `- ${letter}) ${title}`;
      const distractor = pool[(index + optionIndex) % Math.max(1, pool.length)];
      const label = distractor && distractor.id !== noteId
        ? distractor.title
        : ['A different concept', 'An unrelated topic', 'A legacy archive'][optionIndex % 3];
      return `- ${letter}) ${label}`;
    });

    questions.push(`### Question ${index}
What is the main subject of [[${noteId}]]?

${options.join('\n')}

**Correct Answer**: **${letters[correct]}**
**Explanation**: [[${noteId}]] covers **${title}**.
`);
  }

  const sourceNotes = pool.length > 0 ? pool : usableStudyNotes(notes).slice(0, 3);
  const markdown = `---
tags: [quiz, ${slug}]
created: ${today()}
sources:
${sourceLines(sourceNotes)}
---

# Self-Assessment Quiz: ${heading} (${questions.length} Questions)

${questions.join('\n---\n\n')}
`;

  return {
    markdown,
    sources: noteSources(sourceNotes),
    notes: sourceNotes,
    count: questions.length,
    slug,
  };
}

// ---------------------------------------------------------------------------
// Mind map
// ---------------------------------------------------------------------------

export function selectMindmapNote(notes: WikiNote[], target: string): WikiNote | undefined {
  const pool = usableStudyNotes(notes);
  const query = target.trim().toLowerCase().replace(/^\[\[|\]\]$/g, '');
  if (!query) return pool[0];

  return (
    pool.find(note => note.id.toLowerCase() === query) ||
    pool.find(note => note.title.toLowerCase() === query) ||
    pool.find(note => note.path.toLowerCase() === query) ||
    pool.find(note => note.path.toLowerCase().replace(/\.md$/i, '').endsWith(`/${query}`)) ||
    pool.find(note => note.id.toLowerCase().includes(query) || note.title.toLowerCase().includes(query)) ||
    pool[0]
  );
}

export function buildMindmap(notes: WikiNote[], target: string): {
  note?: StudyNoteRef;
  markdown: string;
  tree: string[];
  nodes: StudyMindmapNode[];
  links: StudyMindmapLink[];
  headings: number;
  wikilinks: number;
  slug: string;
} {
  const note = selectMindmapNote(notes, target);
  if (!note) {
    return {
      markdown: '### 🧠 Mind Map\n\nNo matching note found to generate a mind map.',
      tree: [],
      nodes: [],
      links: [],
      headings: 0,
      wikilinks: 0,
      slug: slugifyTopic(target),
    };
  }

  const tree: string[] = [`- **${note.title}** (\`[[${note.id}]]\`)`];
  const nodes: StudyMindmapNode[] = [{ id: note.id, label: note.title, group: 'root' }];
  const links: StudyMindmapLink[] = [];
  let currentHeading = '';

  for (const line of note.content.split('\n')) {
    if (line.startsWith('## ')) {
      const title = line.replace(/^##\s+/, '').trim();
      if (!title) continue;
      currentHeading = title;
      tree.push(`  - 📌 **${title}**`);
      const subId = `${note.id}-${slugifyTopic(title)}`;
      nodes.push({ id: subId, label: title, group: 'heading' });
      links.push({ source: note.id, target: subId });
    } else if (line.startsWith('### ')) {
      const title = line.replace(/^###\s+/, '').trim();
      if (!title) continue;
      tree.push(`    - 🔹 ${title}`);
      const subId = `${note.id}-${slugifyTopic(`${currentHeading}-${title}`)}`;
      nodes.push({ id: subId, label: title, group: 'subheading' });
      const parentId = currentHeading ? `${note.id}-${slugifyTopic(currentHeading)}` : note.id;
      links.push({ source: parentId, target: subId });
    } else if (line.trim().startsWith('- ')) {
      const text = line.trim().replace(/^-\s+/, '').slice(0, 80);
      if (text) tree.push(`      - ${text}`);
    }
  }

  const slug = slugifyTopic(note.id);
  const jsonPayload = JSON.stringify({ nodes, links }, null, 2);
  const source = note.path.startsWith('wiki/') ? note.path : `wiki/${note.path}`;

  const markdown = `---
tags: [mindmap, ${slug}]
created: ${today()}
sources:
  - ${source}
---

# Mind Map: ${note.title}

## 🌳 Hierarchical Tree
${tree.join('\n')}

## 🔗 Connected Wikilinks
${note.outboundLinks.map(link => `- [[${link}]]`).join('\n') || '- None'}

## 📊 ForceGraph Data Payload (JSON)
\`\`\`json
${jsonPayload}
\`\`\`
`;

  return {
    note: toStudyNoteRef(note),
    markdown,
    tree,
    nodes,
    links,
    headings: nodes.length - 1,
    wikilinks: note.outboundLinks.length,
    slug,
  };
}

// ---------------------------------------------------------------------------
// Audio overview
// ---------------------------------------------------------------------------

export function buildAudioOverview(notes: WikiNote[], topic: string): {
  markdown: string;
  sources: StudySource[];
  notes: WikiNote[];
  slug: string;
  tts: 'none';
} {
  const relevant = matchNotesByTopic(notes, topic, 3);
  const pool = relevant.length > 0 ? relevant : usableStudyNotes(notes).slice(0, 3);
  const slug = slugifyTopic(topic, 'overview');
  const heading = topic.trim() || 'General Overview';
  const firstId = pool[0]?.id || 'index';
  const links = pool.map(note => `[[${note.id}]]`).join(', ') || '[[index]]';

  const markdown = `---
tags: [audio-script, ${slug}]
created: ${today()}
sources:
${sourceLines(pool)}
---

# Audio Overview Dialogue Script: ${heading}

**Host A**: Welcome back to Wiki-Cast! Today we are taking a deep dive into the knowledge base covering ${links}.
**Host B**: Exactly! What is really fascinating here is how these concepts connect together.
**Host A**: Right, in [[${firstId}]] the main emphasis is on structured, traceable knowledge synthesis.
**Host B**: And that links directly with our raw-source grounded references.
**Host A**: That wraps up this quick overview audio script!
`;

  return {
    markdown,
    sources: noteSources(pool),
    notes: pool,
    slug,
    tts: 'none',
  };
}

// ---------------------------------------------------------------------------
// Thesis chapter
// ---------------------------------------------------------------------------

function frontmatterString(note: WikiNote, keys: string[]): string {
  for (const key of keys) {
    const value = note.frontmatter[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number') return String(value);
  }
  return '';
}

function maturityOf(note: WikiNote): number {
  const raw = note.frontmatter.maturita ?? note.frontmatter.maturity;
  const value = typeof raw === 'number' ? raw : Number.parseInt(String(raw ?? ''), 10);
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function noteTags(note: WikiNote): string[] {
  return note.tags.map(tag => tag.trim().toLowerCase()).filter(Boolean);
}

function isChapterNote(note: WikiNote): boolean {
  const type = frontmatterString(note, ['tipo', 'type']).toLowerCase();
  if (CHAPTER_TYPES.has(type)) return true;
  if (noteTags(note).some(tag => CHAPTER_TAGS.has(tag))) return true;
  const folder = (note.folder || '').toLowerCase();
  return folder.split('/').includes('capitoli');
}

function isSynthesisNote(note: WikiNote): boolean {
  const type = frontmatterString(note, ['tipo', 'type']).toLowerCase();
  if (SYNTHESIS_TYPES.has(type)) return true;
  return note.path.toLowerCase().includes('sintesi');
}

function chapterNumber(note: WikiNote): number {
  const explicit = frontmatterString(note, ['capitolo_numero']);
  if (explicit) {
    const parsed = Number.parseInt(explicit, 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  const stem = note.id.split('/').pop() || note.id;
  const match = stem.match(/^(\d+)/);
  return match ? Number.parseInt(match[1], 10) : 999;
}

function chapterHeading(number: number, title: string): string {
  if (/^capitolo\b/i.test(title)) return title;
  if (number > 0 && number < 999) return `Capitolo ${number}: ${title}`;
  return title;
}

export function buildThesis(
  notes: WikiNote[],
  options: { title?: string; minMaturity?: number; topic?: string } = {}
): StudyThesisResult {
  const pool = usableStudyNotes(notes);
  const minMaturity = Math.max(0, Math.min(100, Math.floor(options.minMaturity ?? 0) || 0));
  const topic = (options.topic || '').trim();
  const title = options.title?.trim() || (topic ? `Tesi: ${topic}` : 'Tesi di Laurea');

  const chapters: Array<{ note: WikiNote; number: number; title: string }> = [];
  const syntheses: Array<{ note: WikiNote; maturity: number; title: string; type: string }> = [];

  for (const note of pool) {
    if (isChapterNote(note)) {
      chapters.push({
        note,
        number: chapterNumber(note),
        title: frontmatterString(note, ['titolo', 'title']) || note.title,
      });
      continue;
    }
    if (isSynthesisNote(note)) {
      const maturity = maturityOf(note);
      if (maturity >= minMaturity) {
        syntheses.push({
          note,
          maturity,
          title: frontmatterString(note, ['titolo', 'title']) || note.title,
          type: frontmatterString(note, ['tipo', 'type']) || 'sintesi',
        });
      }
    }
  }

  chapters.sort((a, b) => a.number - b.number || a.note.path.localeCompare(b.note.path));
  syntheses.sort((a, b) => b.maturity - a.maturity || a.title.localeCompare(b.title));

  const parts: string[] = [
    `# ${title}\n`,
    '*Tesi Dinamica Evolutiva generata da Wiki-Forge Thesis Edition*\n',
    '---\n\n',
  ];

  if (chapters.length > 0) {
    parts.push('## Parte I: Capitoli Strutturati\n\n');
    for (const chapter of chapters) {
      parts.push(`### ${chapterHeading(chapter.number, chapter.title)}\n`);
      parts.push(`*(Maturità capitolo: ${maturityOf(chapter.note)}/100)*\n\n`);
      parts.push(`${stripFrontmatter(chapter.note.content).trim()}\n\n---\n\n`);
    }
  }

  if (syntheses.length > 0) {
    parts.push('## Parte II: Sintesi e Modelli Concettuali (Knowledge Base)\n\n');
    for (const synthesis of syntheses) {
      parts.push(`### ${synthesis.title}\n`);
      parts.push(`*(Tipo: ${synthesis.type} | Maturità: ${synthesis.maturity}/100)*\n\n`);
      parts.push(`${stripFrontmatter(synthesis.note.content).trim()}\n\n---\n\n`);
    }
  }

  if (chapters.length === 0 && syntheses.length === 0) {
    parts.push(
      '## Nessun contenuto\n\n' +
        'Nessun capitolo (`tipo: capitolo_tesi`) o nota di sintesi con maturità sufficiente è stato trovato.\n' +
        'Crea un capitolo o abbassa la soglia di maturità per compilare la bozza.\n'
    );
  }

  return {
    title,
    minMaturity,
    markdown: parts.join(''),
    chapters: chapters.map(chapter => ({
      title: chapter.title,
      number: chapter.number,
      path: chapter.note.path,
      maturity: maturityOf(chapter.note),
    })),
    syntheses: syntheses.map(synthesis => ({
      title: synthesis.title,
      path: synthesis.note.path,
      maturity: synthesis.maturity,
      type: synthesis.type,
    })),
  };
}
