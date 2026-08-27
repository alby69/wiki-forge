import { WikiNote } from '../../core/types/wiki';
import { escapeHtml } from '../../core/utils/html';

export class Sidebar {
  private container: HTMLElement;
  private notes: WikiNote[] = [];
  private onSelectNoteCb?: (noteId: string) => void;

  constructor(container: HTMLElement, onSelectNote?: (noteId: string) => void) {
    this.container = container;
    this.onSelectNoteCb = onSelectNote;
    this.render();
  }

  public setNotes(notes: WikiNote[]): void {
    this.notes = notes;
    this.render();
  }

  public render(): void {
    const folders = new Map<string, WikiNote[]>();

    this.notes.forEach(note => {
      const folder = note.folder || 'wiki';
      if (!folders.has(folder)) {
        folders.set(folder, []);
      }
      folders.get(folder)!.push(note);
    });

    let treeHTML = '';
    folders.forEach((folderNotes, folderName) => {
      treeHTML += `
        <div style="margin-bottom: 12px;">
          <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #a0aec0; margin-bottom: 6px;">📁 ${folderName}</div>
          <ul style="list-style: none; padding-left: 8px; margin: 0;">
            ${folderNotes
              .map(
                n => `
              <li class="sidebar-note-item" data-note-id="${escapeHtml(n.id)}" style="padding: 4px 8px; font-size: 13px; color: #cbd5e1; cursor: pointer; border-radius: 4px; transition: background 0.15s ease;">
                📄 ${escapeHtml(n.title)}
              </li>
            `
              )
              .join('')}
          </ul>
        </div>
      `;
    });

    const allTags = Array.from(new Set(this.notes.flatMap(n => n.tags)));
    const tagsHTML = allTags
      .map(
        t =>
          `<span style="background: #2d3748; color: #a0aec0; padding: 2px 6px; border-radius: 4px; font-size: 11px; margin-right: 4px; margin-bottom: 4px; display: inline-block;">#${t}</span>`
      )
      .join('');

    this.container.innerHTML = `
      <div style="width: 240px; background: #121316; height: 100%; border-right: 1px solid #2d3748; padding: 16px; box-sizing: border-box; display: flex; flex-direction: column; color: #e2e8f0;">
        <div style="margin-bottom: 16px;">
          <input type="text" id="vault-search-input" placeholder="Search notes... (Ctrl+K)" style="width: 100%; background: #1a1b1e; border: 1px solid #2d3748; color: #fff; padding: 6px 10px; border-radius: 4px; font-size: 12px; box-sizing: border-box;" />
        </div>
        <div style="flex: 1; overflow-y: auto;">
          <div style="font-size: 12px; font-weight: 600; color: #e2e8f0; margin-bottom: 10px;">VAULT EXPLORER</div>
          ${treeHTML || '<div style="font-size: 12px; color: #718096;">Vault is empty.</div>'}
        </div>
        <div style="margin-top: 16px; padding-top: 12px; border-top: 1px solid #2d3748;">
          <div style="font-size: 11px; font-weight: 700; color: #a0aec0; margin-bottom: 6px;">TAGS</div>
          <div>${tagsHTML || '<span style="font-size: 11px; color: #718096;">No tags</span>'}</div>
        </div>
      </div>
    `;

    const items = this.container.querySelectorAll('.sidebar-note-item');
    items.forEach(item => {
      item.addEventListener('click', () => {
        const noteId = item.getAttribute('data-note-id');
        if (noteId && this.onSelectNoteCb) {
          this.onSelectNoteCb(noteId);
        }
      });
    });
  }
}
