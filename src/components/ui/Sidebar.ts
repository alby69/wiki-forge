import { WikiNote } from '../../core/types/wiki';
import { escapeHtml } from '../../core/utils/html';

interface TreeNode {
  name: string;
  path: string;
  isFolder: boolean;
  note?: WikiNote;
  children: Map<string, TreeNode>;
}

export class Sidebar {
  private container: HTMLElement;
  private notes: WikiNote[] = [];
  private activeId: string | null = null;
  private query = '';
  private selectedTags = new Set<string>();
  private expanded = new Set<string>(['wiki']);
  private onSelectNoteCb?: (noteId: string) => void;
  private onFilterTagsCb?: (tags: string[]) => void;

  constructor(
    container: HTMLElement,
    onSelectNote?: (noteId: string) => void,
    onFilterTags?: (tags: string[]) => void
  ) {
    this.container = container;
    this.onSelectNoteCb = onSelectNote;
    this.onFilterTagsCb = onFilterTags;
    this.render();
  }

  public setNotes(notes: WikiNote[]): void {
    this.notes = notes;
    this.render();
  }

  public setActiveNote(noteId: string): void {
    this.activeId = noteId;
    this.render();
  }

  /** Notes visible under the current search query + selected-tag filter. */
  private getVisibleNotes(): WikiNote[] {
    const q = this.query.trim().toLowerCase();
    return this.notes.filter(note => {
      if (this.selectedTags.size > 0) {
        const hasTag = note.tags.some(t => this.selectedTags.has(t));
        if (!hasTag) return false;
      }
      if (q) {
        const hay = `${note.title} ${note.path} ${note.tags.join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }

  private buildTree(notes: WikiNote[]): TreeNode {
    const root: TreeNode = {
      name: '',
      path: '',
      isFolder: true,
      children: new Map(),
    };

    for (const note of notes) {
      const segments = (note.path || `wiki/${note.id}.md`).split('/');
      let cursor = root;
      segments.forEach((seg, idx) => {
        const isFile = idx === segments.length - 1;
        if (!cursor.children.has(seg)) {
          cursor.children.set(seg, {
            name: seg,
            path: segments.slice(0, idx + 1).join('/'),
            isFolder: !isFile,
            children: new Map(),
          });
        }
        const node = cursor.children.get(seg)!;
        if (isFile) {
          node.note = note;
          node.isFolder = false;
        }
        cursor = node;
      });
    }
    return root;
  }

  private folderHasMatch(node: TreeNode, q: string): boolean {
    if (!node.isFolder) {
      return (node.note?.title.toLowerCase().includes(q) ?? false) ||
        node.path.toLowerCase().includes(q);
    }
    for (const child of node.children.values()) {
      if (this.folderHasMatch(child, q)) return true;
    }
    return false;
  }

  private renderNode(node: TreeNode, depth: number): string {
    const q = this.query.trim().toLowerCase();
    let html = '';

    if (node.isFolder) {
      if (q && !this.folderHasMatch(node, q)) return '';
      const isExpanded = q ? true : this.expanded.has(node.path);
      const chevron = isExpanded ? '▾' : '▸';
      const pad = 8 + depth * 14;
      html += `
        <div class="tree-folder" data-folder="${escapeHtml(node.path)}"
             style="padding: 3px 8px 3px ${pad}px; font-size: 13px; color: #cbd5e1; cursor: pointer; border-radius: 4px; display: flex; align-items: center; gap: 4px; user-select: none;">
          <span class="tree-chevron" style="width: 10px; display: inline-block; color: #718096;">${chevron}</span>
          <span>📁 ${escapeHtml(node.name)}</span>
        </div>`;
      if (isExpanded) {
        for (const child of node.children.values()) {
          html += this.renderNode(child, depth + 1);
        }
      }
    } else {
      if (q && !((node.note?.title.toLowerCase().includes(q) ?? false) || node.path.toLowerCase().includes(q))) {
        return '';
      }
      const active = node.note && node.note.id === this.activeId;
      const pad = 8 + depth * 14;
      html += `
        <div class="tree-file${active ? ' tree-file-active' : ''}" data-note-id="${escapeHtml(node.note!.id)}"
             style="padding: 3px 8px 3px ${pad + 14}px; font-size: 13px; color: ${active ? '#fff' : '#cbd5e1'}; cursor: pointer; border-radius: 4px; display: flex; align-items: center; gap: 4px;">
          <span>📄 ${escapeHtml(node.note!.title)}</span>
        </div>`;
    }
    return html;
  }

  public render(): void {
    const root = this.buildTree(this.getVisibleNotes());
    const treeHTML = Array.from(root.children.values())
      .map(child => this.renderNode(child, 0))
      .join('');

    const allTags = Array.from(new Set(this.notes.flatMap(n => n.tags))).sort();
    const tagsHTML = allTags
      .map(t => {
        const active = this.selectedTags.has(t);
        const style = active
          ? 'background: #3182ce; color: #fff; border-color: #3182ce;'
          : 'background: #2d3748; color: #a0aec0; border: 1px solid transparent;';
        return `<span class="tag-chip" data-tag="${escapeHtml(t)}" style="${style} padding: 2px 6px; border-radius: 4px; font-size: 11px; margin-right: 4px; margin-bottom: 4px; display: inline-block; cursor: pointer; user-select: none;">#${escapeHtml(t)}</span>`;
      })
      .join('');
    const clearHTML =
      this.selectedTags.size > 0
        ? `<span class="tag-clear" style="color: #fc8181; font-size: 11px; cursor: pointer; margin-left: 4px;">clear</span>`
        : '';

    this.container.innerHTML = `
      <div style="width: 260px; background: #121316; height: 100%; border-right: 1px solid #2d3748; display: flex; flex-direction: column; color: #e2e8f0;">
        <div style="padding: 12px 12px 8px; border-bottom: 1px solid #2d3748;">
          <input type="text" id="vault-search-input" placeholder="Search files... (Ctrl+K)" style="width: 100%; background: #1a1b1e; border: 1px solid #2d3748; color: #fff; padding: 6px 10px; border-radius: 4px; font-size: 12px; box-sizing: border-box; outline: none;" />
        </div>
        <div style="flex: 1; overflow-y: auto; padding: 8px 4px;">
          ${treeHTML || '<div style="font-size: 12px; color: #718096; padding: 8px;">No notes match the current filter.</div>'}
        </div>
        <div style="padding: 10px 12px; border-top: 1px solid #2d3748; max-height: 30%; overflow-y: auto;">
          <div style="font-size: 11px; font-weight: 700; color: #a0aec0; margin-bottom: 6px; text-transform: uppercase;">Tags ${clearHTML}</div>
          <div>${tagsHTML || '<span style="font-size: 11px; color: #718096;">No tags</span>'}</div>
        </div>
      </div>
    `;

    const search = this.container.querySelector<HTMLInputElement>('#vault-search-input');
    search?.addEventListener('input', () => {
      this.query = search.value;
      this.render();
    });

    this.container.querySelectorAll('.tree-folder').forEach(item => {
      item.addEventListener('click', () => {
        const folderPath = item.getAttribute('data-folder');
        if (folderPath) {
          if (this.expanded.has(folderPath)) this.expanded.delete(folderPath);
          else this.expanded.add(folderPath);
          this.render();
        }
      });
    });

    this.container.querySelectorAll('.tree-file').forEach(item => {
      item.addEventListener('click', () => {
        const noteId = item.getAttribute('data-note-id');
        if (noteId && this.onSelectNoteCb) this.onSelectNoteCb(noteId);
      });
    });

    this.container.querySelectorAll('.tag-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const tag = chip.getAttribute('data-tag');
        if (!tag) return;
        if (this.selectedTags.has(tag)) this.selectedTags.delete(tag);
        else this.selectedTags.add(tag);
        this.onFilterTagsCb?.(Array.from(this.selectedTags));
        this.render();
      });
    });

    this.container.querySelector('.tag-clear')?.addEventListener('click', () => {
      this.selectedTags.clear();
      this.onFilterTagsCb?.([]);
      this.render();
    });
  }
}
