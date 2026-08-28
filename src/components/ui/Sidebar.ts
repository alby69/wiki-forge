import { WikiNote } from '../../core/types/wiki';
import { escapeHtml } from '../../core/utils/html';

interface TreeNode {
  name: string;
  path: string;
  isFolder: boolean;
  note?: WikiNote;
  children: Map<string, TreeNode>;
}

interface TagNode {
  name: string;
  tag: string;
  count: number;
  children: Map<string, TagNode>;
}

const TAG_PALETTE = [
  '#63b3ed', '#68d391', '#f6ad55', '#fc8181', '#b794f4',
  '#76e4f7', '#f687b3', '#f6e05e', '#9ae6b4', '#cbd5e0',
];

export interface FileActionCallbacks {
  onCreateFolder?: (parentFolder: string, name: string) => Promise<void>;
  onCreateFile?: (parentFolder: string, fileName: string) => Promise<void>;
  onRename?: (path: string, newName: string) => Promise<void>;
  onMove?: (sourcePath: string, targetFolder: string) => Promise<void>;
  onDelete?: (path: string) => Promise<void>;
  onUpload?: (folderPath: string, files: FileList) => Promise<void>;
}

export class Sidebar {
  private container: HTMLElement;
  private notes: WikiNote[] = [];
  private activeId: string | null = null;
  private selectedItemPath: string | null = null;
  private query = '';
  private selectedTags = new Set<string>();
  private expanded = new Set<string>(['wiki']);
  private onSelectNoteCb?: (noteId: string) => void;
  private onFilterTagsCb?: (tags: string[]) => void;
  private actionCb?: FileActionCallbacks;

  constructor(
    container: HTMLElement,
    onSelectNote?: (noteId: string) => void,
    onFilterTags?: (tags: string[]) => void,
    actionCb?: FileActionCallbacks
  ) {
    this.container = container;
    this.onSelectNoteCb = onSelectNote;
    this.onFilterTagsCb = onFilterTags;
    this.actionCb = actionCb;
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

  /** Notes visible under the current search query + selected-tag filter.
   *  A selected tag may be an exact tag (e.g. `topic/ai`) or a namespace
   *  prefix (e.g. `topic`); in the latter case any note whose tag starts with
   *  `topic/` matches. */
  private getVisibleNotes(): WikiNote[] {
    const q = this.query.trim().toLowerCase();
    return this.notes.filter(note => {
      if (this.selectedTags.size > 0) {
        const hasTag = note.tags.some(t =>
          Array.from(this.selectedTags).some(sel => t === sel || t.startsWith(`${sel}/`))
        );
        if (!hasTag) return false;
      }
      if (q) {
        const hay = `${note.title} ${note.path} ${note.tags.join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }

  /** Build a frequency + namespace tree over all tags in the vault. */
  private getTagTree(): TagNode[] {
    const counts = new Map<string, number>();
    for (const note of this.notes) {
      for (const tag of note.tags) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }

    const roots = new Map<string, TagNode>();
    for (const [tag, count] of counts) {
      const parts = tag.split('/');
      const rootName = parts[0];
      if (!roots.has(rootName)) {
        roots.set(rootName, { name: rootName, tag: rootName, count: 0, children: new Map() });
      }
      const root = roots.get(rootName)!;
      root.count += count;
      let cursor = root;
      for (let i = 1; i < parts.length; i++) {
        const seg = parts[i];
        const childTag = `${cursor.tag}/${seg}`;
        if (!cursor.children.has(seg)) {
          cursor.children.set(seg, { name: seg, tag: childTag, count: 0, children: new Map() });
        }
        cursor = cursor.children.get(seg)!;
      }
      cursor.count = count; // leaf carries its own frequency
    }
    return Array.from(roots.values()).sort((a, b) => b.count - a.count);
  }

  /** Index of a tag's root namespace — stable color for the same root. */
  private rootIndex(tag: string): number {
    const root = tag.split('/')[0];
    const roots = Array.from(
      new Set(this.notes.flatMap(n => n.tags).map(t => t.split('/')[0]))
    ).sort();
    return Math.max(0, roots.indexOf(root));
  }

  /** Highest per-tag frequency, used to scale the cloud font sizes. */
  private maxTagCount(): number {
    let max = 1;
    const seen = new Map<string, number>();
    for (const note of this.notes) {
      for (const tag of note.tags) {
        const c = (seen.get(tag) ?? 0) + 1;
        seen.set(tag, c);
        if (c > max) max = c;
      }
    }
    return max;
  }

  private renderTagNode(node: TagNode, depth: number, palette: string[]): string {
    const color = palette[this.rootIndex(node.tag) % palette.length];
    const isLeaf = node.children.size === 0;
    const size = isLeaf
      ? 12 + Math.round((Math.log(node.count + 1) / Math.log(this.maxTagCount() + 1)) * 9)
      : 12;
    const active = this.selectedTags.has(node.tag);
    const bg = active ? color : `color-mix(in srgb, ${color} 18%, transparent)`;
    const fg = active ? '#fff' : color;

    if (isLeaf) {
      return `<span class="tag-chip" data-tag="${escapeHtml(node.tag)}" title="${escapeHtml(
        node.tag
      )} — ${node.count} note${node.count === 1 ? '' : 's'}" style="background: ${bg}; color: ${fg}; padding: 2px 7px; border-radius: 4px; font-size: ${size}px; margin: 0 4px 5px 0; display: inline-block; cursor: pointer; user-select: none; border: 1px solid ${active ? color : 'transparent'};">#${escapeHtml(
        node.tag
      )}</span>`;
    }

    const childrenHTML = Array.from(node.children.values())
      .sort((a, b) => b.count - a.count)
      .map(child => this.renderTagNode(child, depth + 1, palette))
      .join('');

    return `
      <div style="margin: 0 0 6px ${depth === 0 ? 0 : 10}px;">
        <div class="tag-chip tag-root" data-tag="${escapeHtml(node.tag)}" title="${escapeHtml(
      node.tag
    )} — ${node.count} note${node.count === 1 ? '' : 's'}" style="color: ${color}; font-weight: 700; font-size: ${size}px; margin: 0 4px 4px 0; display: inline-block; cursor: pointer; user-select: none;">▾ ${escapeHtml(
      node.name
    )}</div>
        <div style="padding-left: 12px;">${childrenHTML}</div>
      </div>`;
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
      const selected = this.selectedItemPath === node.path;
      html += `
        <div class="tree-folder${selected ? ' tree-item-selected' : ''}" data-folder="${escapeHtml(node.path)}" draggable="true"
             style="padding: 4px 8px 4px ${pad}px; font-size: 13px; color: ${selected ? '#63b3ed' : '#cbd5e1'}; cursor: pointer; border-radius: 4px; display: flex; align-items: center; gap: 4px; user-select: none; ${selected ? 'background: #2a4365;' : ''}">
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
      const selected = this.selectedItemPath === node.path;
      const pad = 8 + depth * 14;
      html += `
        <div class="tree-file${active ? ' tree-file-active' : ''}${selected ? ' tree-item-selected' : ''}" data-note-id="${escapeHtml(node.note!.id)}" data-path="${escapeHtml(node.path)}" draggable="true"
             style="padding: 4px 8px 4px ${pad + 14}px; font-size: 13px; color: ${active ? '#fff' : selected ? '#63b3ed' : '#cbd5e1'}; cursor: pointer; border-radius: 4px; display: flex; align-items: center; gap: 4px; ${active ? 'background: #3182ce; font-weight: 600;' : selected ? 'background: #2a4365;' : ''}">
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

    const tagTree = this.getTagTree();
    const tagsHTML = tagTree
      .map(root => this.renderTagNode(root, 0, TAG_PALETTE))
      .join('');
    const clearHTML =
      this.selectedTags.size > 0
        ? `<span class="tag-clear" style="color: #fc8181; font-size: 11px; cursor: pointer; margin-left: 4px; text-transform: none;">clear</span>`
        : '';

    this.container.innerHTML = `
      <div style="width: 280px; background: #121316; height: 100%; border-right: 1px solid #2d3748; display: flex; flex-direction: column; color: #e2e8f0;">
        <!-- File Operations Toolbar -->
        <div style="padding: 8px 10px; border-bottom: 1px solid #2d3748; display: flex; gap: 4px; background: #1a1b1e; align-items: center; flex-wrap: wrap;">
          <button id="btn-new-folder" title="New Folder" style="background: #2d3748; color: #e2e8f0; border: none; border-radius: 4px; padding: 4px 8px; font-size: 12px; cursor: pointer; display: flex; align-items: center; gap: 4px;">📁+</button>
          <button id="btn-new-file" title="New File" style="background: #2d3748; color: #e2e8f0; border: none; border-radius: 4px; padding: 4px 8px; font-size: 12px; cursor: pointer; display: flex; align-items: center; gap: 4px;">📄+</button>
          <button id="btn-upload-file" title="Upload File" style="background: #2d3748; color: #e2e8f0; border: none; border-radius: 4px; padding: 4px 8px; font-size: 12px; cursor: pointer; display: flex; align-items: center; gap: 4px;">📤 Upload</button>
          <button id="btn-rename-item" title="Rename Selected" style="background: #2d3748; color: #e2e8f0; border: none; border-radius: 4px; padding: 4px 8px; font-size: 12px; cursor: pointer;">✏️</button>
          <button id="btn-delete-item" title="Delete Selected" style="background: #742a2a; color: #feb2b2; border: none; border-radius: 4px; padding: 4px 8px; font-size: 12px; cursor: pointer;">🗑️</button>
          <input type="file" id="sidebar-file-input" multiple style="display: none;" />
        </div>

        <!-- Search Input -->
        <div style="padding: 8px 10px; border-bottom: 1px solid #2d3748;">
          <input type="text" id="vault-search-input" value="${escapeHtml(this.query)}" placeholder="Search files... (Ctrl+K)" style="width: 100%; background: #1a1b1e; border: 1px solid #2d3748; color: #fff; padding: 6px 10px; border-radius: 4px; font-size: 12px; box-sizing: border-box; outline: none;" />
        </div>

        <!-- File Tree Explorer Dropzone -->
        <div id="file-tree-container" style="flex: 1; overflow-y: auto; padding: 8px 4px; position: relative;">
          ${treeHTML || '<div style="font-size: 12px; color: #718096; padding: 8px;">No notes match the current filter.</div>'}
        </div>

        <!-- Tag Cloud -->
        <div style="padding: 10px 12px; border-top: 1px solid #2d3748; max-height: 30%; overflow-y: auto;">
          <div style="font-size: 11px; font-weight: 700; color: #a0aec0; margin-bottom: 8px; text-transform: uppercase;">Tag cloud ${clearHTML}</div>
          <div>${tagsHTML || '<span style="font-size: 11px; color: #718096;">No tags</span>'}</div>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  private bindEvents(): void {
    const search = this.container.querySelector<HTMLInputElement>('#vault-search-input');
    search?.addEventListener('input', () => {
      this.query = search.value;
      this.render();
    });

    const fileInput = this.container.querySelector<HTMLInputElement>('#sidebar-file-input');

    this.container.querySelector('#btn-new-folder')?.addEventListener('click', async () => {
      const parent = this.selectedItemPath && !this.selectedItemPath.endsWith('.md') ? this.selectedItemPath : 'wiki';
      const name = prompt(`Enter new folder name inside '${parent}':`);
      if (name && this.actionCb?.onCreateFolder) {
        await this.actionCb.onCreateFolder(parent, name.trim());
      }
    });

    this.container.querySelector('#btn-new-file')?.addEventListener('click', async () => {
      const parent = this.selectedItemPath && !this.selectedItemPath.endsWith('.md') ? this.selectedItemPath : 'wiki';
      const name = prompt(`Enter new file name (e.g. 'new-note.md') inside '${parent}':`);
      if (name && this.actionCb?.onCreateFile) {
        await this.actionCb.onCreateFile(parent, name.trim());
      }
    });

    this.container.querySelector('#btn-upload-file')?.addEventListener('click', () => {
      fileInput?.click();
    });

    fileInput?.addEventListener('change', async () => {
      if (fileInput.files && fileInput.files.length > 0 && this.actionCb?.onUpload) {
        const folder = this.selectedItemPath && !this.selectedItemPath.endsWith('.md') ? this.selectedItemPath : 'wiki';
        await this.actionCb.onUpload(folder, fileInput.files);
      }
    });

    this.container.querySelector('#btn-rename-item')?.addEventListener('click', async () => {
      if (!this.selectedItemPath) {
        alert('Please select a file or folder in the tree first.');
        return;
      }
      const currentName = this.selectedItemPath.split('/').pop() || '';
      const newName = prompt(`Rename '${currentName}' to:`, currentName);
      if (newName && newName !== currentName && this.actionCb?.onRename) {
        await this.actionCb.onRename(this.selectedItemPath, newName.trim());
      }
    });

    this.container.querySelector('#btn-delete-item')?.addEventListener('click', async () => {
      if (!this.selectedItemPath) {
        alert('Please select a file or folder in the tree first.');
        return;
      }
      if (confirm(`Are you sure you want to delete '${this.selectedItemPath}'?`)) {
        if (this.actionCb?.onDelete) {
          await this.actionCb.onDelete(this.selectedItemPath);
          this.selectedItemPath = null;
        }
      }
    });

    this.container.querySelectorAll('.tree-folder').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const folderPath = item.getAttribute('data-folder');
        if (folderPath) {
          this.selectedItemPath = folderPath;
          if (this.expanded.has(folderPath)) this.expanded.delete(folderPath);
          else this.expanded.add(folderPath);
          this.render();
        }
      });
    });

    this.container.querySelectorAll('.tree-file').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const noteId = item.getAttribute('data-note-id');
        const filePath = item.getAttribute('data-path');
        if (filePath) this.selectedItemPath = filePath;
        if (noteId && this.onSelectNoteCb) this.onSelectNoteCb(noteId);
        this.render();
      });
    });

    // Drag-and-drop file moving support within tree
    let draggedPath: string | null = null;

    this.container.querySelectorAll('[draggable="true"]').forEach(el => {
      el.addEventListener('dragstart', (e: Event) => {
        const dragEvent = e as DragEvent;
        const target = el as HTMLElement;
        draggedPath = target.getAttribute('data-path') || target.getAttribute('data-folder');
        if (dragEvent.dataTransfer) {
          dragEvent.dataTransfer.setData('text/plain', draggedPath || '');
        }
      });
    });

    this.container.querySelectorAll('.tree-folder').forEach(folderEl => {
      folderEl.addEventListener('dragover', (e: Event) => {
        e.preventDefault();
        (folderEl as HTMLElement).style.background = '#2b6cb0';
      });

      folderEl.addEventListener('dragleave', () => {
        (folderEl as HTMLElement).style.background = '';
      });

      folderEl.addEventListener('drop', async (e: Event) => {
        e.preventDefault();
        (folderEl as HTMLElement).style.background = '';
        const targetFolder = folderEl.getAttribute('data-folder');
        const dragEvent = e as DragEvent;

        // 1. Native OS File drop
        if (dragEvent.dataTransfer && dragEvent.dataTransfer.files && dragEvent.dataTransfer.files.length > 0) {
          if (targetFolder && this.actionCb?.onUpload) {
            await this.actionCb.onUpload(targetFolder, dragEvent.dataTransfer.files);
          }
          return;
        }

        // 2. Tree item drag move
        const sourcePath = dragEvent.dataTransfer?.getData('text/plain') || draggedPath;
        if (sourcePath && targetFolder && sourcePath !== targetFolder && this.actionCb?.onMove) {
          await this.actionCb.onMove(sourcePath, targetFolder);
        }
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
