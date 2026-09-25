import { WikiNote } from '../../core/types/wiki';
import { escapeHtml } from '../../core/utils/html';
import { FacetedTagManager } from '../tools/FacetedTagManager';
import { ApiStorage } from '../../storage/ApiStorage';

interface TreeNode {
  name: string;
  path: string;
  isFolder: boolean;
  note?: WikiNote;
  children: Map<string, TreeNode>;
}

export interface FileActionCallbacks {
  onCreateFolder?: (parentFolder: string, name: string) => Promise<void>;
  onCreateFile?: (parentFolder: string, fileName: string) => Promise<void>;
  onRename?: (path: string, newName: string) => Promise<void>;
  onMove?: (sourcePath: string, targetFolder: string) => Promise<void>;
  onDelete?: (path: string) => Promise<void>;
  onUpload?: (folderPath: string, files: FileList) => Promise<void>;
  getFolders?: () => Promise<string[]>;
  onOpenCurationDashboard?: () => void;
  onTagsUpdated?: () => void;
}

export class Sidebar {
  private container: HTMLElement;
  private apiStorage = new ApiStorage();
  private notes: WikiNote[] = [];
  private activeId: string | null = null;
  private selectedItemPath: string | null = null;
  private query = '';
  private selectedTags = new Set<string>();
  private expanded = new Set<string>(['wiki']);
  private onSelectNoteCb?: (noteId: string) => void;
  private onFilterTagsCb?: (tags: string[]) => void;
  private actionCb?: FileActionCallbacks;
  private tagManager: FacetedTagManager | null = null;

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
    void this.render();
  }

  public setNotes(notes: WikiNote[]): void {
    this.notes = notes;
    if (this.tagManager) {
      this.tagManager.setNotes(notes);
    }
    void this.render();
  }

  public setActiveNote(noteId: string): void {
    this.activeId = noteId;
    void this.render();
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


  private async buildTree(notes: WikiNote[]): Promise<TreeNode> {
    const root: TreeNode = {
      name: '',
      path: '',
      isFolder: true,
      children: new Map(),
    };

    // Add folders from notes
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

    // Add empty folders from API
    if (this.actionCb?.getFolders) {
      try {
        const folders = await this.actionCb.getFolders();
        for (const folderPath of folders) {
          if (folderPath === 'wiki' || folderPath === '.') continue;
          const segments = folderPath.split('/');
          let cursor = root;
          segments.forEach((seg, idx) => {
            if (!cursor.children.has(seg)) {
              cursor.children.set(seg, {
                name: seg,
                path: segments.slice(0, idx + 1).join('/'),
                isFolder: true,
                children: new Map(),
              });
            }
            cursor = cursor.children.get(seg)!;
          });
        }
      } catch (_e) {
        // Ignore folder fetch errors
      }
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

  public async render(): Promise<void> {
    const root = await this.buildTree(this.getVisibleNotes());
    const treeHTML = Array.from(root.children.values())
      .map(child => this.renderNode(child, 0))
      .join('');

this.container.innerHTML = `
      <div style="width: 100%; background: #121316; height: 100%; border-right: 1px solid #2d3748; display: flex; flex-direction: column; color: #e2e8f0;">
        <!-- File Operations & Curation Toolbar -->
        <div style="padding: 8px 10px; border-bottom: 1px solid #2d3748; background: #1a1b1e; flex-shrink: 0;">
          <div style="display: flex; gap: 4px; flex-wrap: wrap; align-items: center; overflow-x: auto;" id="toolbar-primary">
            <button id="btn-new-folder" title="New Folder" style="background: #2d3748; color: #e2e8f0; border: none; border-radius: 4px; padding: 4px 8px; font-size: 12px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; flex-shrink: 0;">📁+</button>
            <button id="btn-new-file" title="New File" style="background: #2d3748; color: #e2e8f0; border: none; border-radius: 4px; padding: 4px 8px; font-size: 12px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; flex-shrink: 0;">📄+</button>
            <button id="btn-upload-file" title="Upload File" style="background: #2d3748; color: #e2e8f0; border: none; border-radius: 4px; padding: 4px 8px; font-size: 12px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; flex-shrink: 0;">📤</button>
            <button id="btn-curation-dashboard" title="Open Curation Dashboard" style="background: #2b6cb0; color: #ffffff; border: none; border-radius: 4px; padding: 4px 8px; font-size: 12px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; font-weight: 600; white-space: nowrap; flex-shrink: 0;">🛡️ Curation</button>
          </div>
          <div style="display: flex; gap: 4px; flex-wrap: wrap; align-items: center; margin-top: 4px; overflow-x: auto;" id="toolbar-secondary">
            <button id="btn-rename-item" title="Rename Selected" style="background: #2d3748; color: #e2e8f0; border: none; border-radius: 4px; padding: 4px 8px; font-size: 12px; cursor: pointer; white-space: nowrap; flex-shrink: 0;">✏️</button>
            <button id="btn-delete-item" title="Delete Selected" style="background: #742a2a; color: #feb2b2; border: none; border-radius: 4px; padding: 4px 8px; font-size: 12px; cursor: pointer; white-space: nowrap; flex-shrink: 0;">🗑️</button>
          </div>
          <input type="file" id="sidebar-file-input" multiple style="display: none;" />
        </div>

        <!-- Search Input -->
        <div style="padding: 8px 10px; border-bottom: 1px solid #2d3748; flex-shrink: 0;">
          <input type="text" id="vault-search-input" value="${escapeHtml(this.query)}" placeholder="Search files... (Ctrl+K)" style="width: 100%; background: #1a1b1e; border: 1px solid #2d3748; color: #fff; padding: 6px 10px; border-radius: 4px; font-size: 12px; box-sizing: border-box; outline: none;" />
        </div>

        <!-- File Tree Explorer Dropzone -->
        <div id="file-tree-container" style="flex: 1; overflow-y: auto; padding: 8px 4px; position: relative; min-height: 0;">
          ${treeHTML || '<div style="font-size: 12px; color: #718096; padding: 8px;">No notes match the current filter.</div>'}
        </div>

        <!-- Faceted Tag Manager -->
        <div id="faceted-tag-manager-container" style="padding: 10px 12px; border-top: 1px solid #2d3748; flex-shrink: 0; max-height: 40%; overflow-y: auto;">
        </div>
      </div>
    `;

    this.bindEvents();

    const tagContainer = this.container.querySelector('#faceted-tag-manager-container') as HTMLElement;
    if (tagContainer) {
      this.tagManager = new FacetedTagManager(tagContainer, this.apiStorage, {
        onFilterTagsChange: (tags) => {
          this.selectedTags = new Set(tags);
          if (this.onFilterTagsCb) this.onFilterTagsCb(tags);
          void this.render();
        },
        onTagsUpdated: () => {
          if (this.actionCb?.onTagsUpdated) {
            this.actionCb.onTagsUpdated();
          }
        },
      });
      this.tagManager.setNotes(this.notes);
    }
  }

  private async refresh(): Promise<void> {
    await this.render();
  }

  private bindEvents(): void {
    const search = this.container.querySelector<HTMLInputElement>('#vault-search-input');
    search?.addEventListener('input', () => {
      this.query = search.value;
      void this.refresh();
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

    this.container.querySelector('#btn-curation-dashboard')?.addEventListener('click', () => {
      if (this.actionCb?.onOpenCurationDashboard) {
        this.actionCb.onOpenCurationDashboard();
      }
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
          void this.refresh();
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
        void this.refresh();
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
        void this.refresh();
      });
    });

    this.container.querySelector('.tag-clear')?.addEventListener('click', () => {
      this.selectedTags.clear();
      this.onFilterTagsCb?.([]);
      void this.refresh();
    });
  }
}
