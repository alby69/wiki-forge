import { ApiStorage } from '@frontend/storage/ApiStorage';
import { setHelpContext, clearHelpContext } from '@frontend/core/helpContext';

export interface MarkdownImportModalOptions {
  storage: ApiStorage;
  onSuccess?: (noteId?: string) => void;
}

/** Fallback wiki folders offered to the user even before any folder exists. */
const DEFAULT_FOLDERS = ['fonti', 'concetti', 'sintesi', 'domande', 'capitoli', 'general'];
const HIDDEN_FOLDERS = ['wiki', 'raw', 'sources', 'output'];

/**
 * Simple, non-technical importer: pick a local Markdown file, choose the wiki
 * folder, then on "Importa" the file is ingested and compiled into the vault.
 */
export class MarkdownImportModal {
  private overlay?: HTMLElement;
  private storage: ApiStorage;
  private onSuccessCb?: (noteId?: string) => void;
  private selectedFile?: File;
  private folders: string[] = [...DEFAULT_FOLDERS];
  private status = '';
  private busy = false;

  constructor(options: MarkdownImportModalOptions) {
    this.storage = options.storage;
    this.onSuccessCb = options.onSuccess;
  }

  public async open(): Promise<void> {
    setHelpContext('import-md');
    if (this.overlay) {
      this.overlay.style.display = 'flex';
      return;
    }
    await this.loadFolders();
    this.render();
  }

  public close(): void {
    if (this.overlay) this.overlay.style.display = 'none';
    clearHelpContext('import-md');
  }

  private async loadFolders(): Promise<void> {
    try {
      const all = await this.storage.getAllFolders();
      const cleaned = all
        .map(f => f.replace(/^wiki\/?/i, ''))
        .filter(f => f && !HIDDEN_FOLDERS.includes(f));
      this.folders = Array.from(new Set([...DEFAULT_FOLDERS, ...cleaned])).sort();
    } catch (_err) {
      // keep defaults
    }
  }

  private render(): void {
    this.overlay = document.createElement('div');
    this.overlay.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
      background: rgba(0,0,0,0.75); display: flex; align-items: center; justify-content: center;
      z-index: 1000; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    `;

    const card = document.createElement('div');
    card.style.cssText = `
      width: 520px; max-width: 90vw; background: #18191c; border: 1px solid #2d3748;
      border-radius: 12px; padding: 20px; color: #f8fafc; display: flex; flex-direction: column; gap: 16px;
      box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5);
    `;

    card.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #2d3748; padding-bottom: 12px;">
        <h3 style="margin: 0; font-size: 16px; font-weight: 600; color: #64b5f6;">📝 Importa Documento Markdown</h3>
        <button id="mdim-close" style="background: transparent; border: none; color: #a0aec0; font-size: 18px; cursor: pointer;">✕</button>
      </div>

      <input type="file" id="mdim-file-input" accept=".md,.markdown,text/markdown" style="display: none;" />

      <div id="mdim-file-area" style="
        display: flex; flex-direction: column; align-items: center; gap: 8px; cursor: pointer;
        border: 2px dashed #4a5568; border-radius: 10px; padding: 22px; text-align: center;
        background: rgba(45,55,72,0.25); transition: border-color 0.2s, background 0.2s;
      ">
        <div style="font-size: 30px;">📄</div>
        <div id="mdim-file-label" style="font-weight: 600; font-size: 14px; color: #f8fafc;">
          Clicca per scegliere un file .md
        </div>
        <div style="font-size: 12px; color: #94a3b8;">Verrà aggiunto alla wiki e compilato automaticamente</div>
      </div>

      <label style="display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: #cbd5e0;">
        Cartella della wiki di destinazione
        <select id="mdim-folder" style="
          background: #2d3748; color: #f8fafc; border: 1px solid #4a5568; border-radius: 8px;
          padding: 8px 10px; font-size: 13px; outline: none;
        ">
          ${this.folders.map(f => `<option value="${f}">${f}</option>`).join('')}
        </select>
      </label>

      <div id="mdim-status" style="min-height: 18px; font-size: 12px; color: #a5b4fc;">${this.status}</div>

      <div style="display: flex; justify-content: flex-end; gap: 10px;">
        <button id="mdim-cancel" style="
          background: #2d3748; color: #e2e8f0; border: none; border-radius: 8px; padding: 9px 16px;
          font-size: 13px; font-weight: 600; cursor: pointer;
        ">Annulla</button>
        <button id="mdim-import" disabled style="
          background: #4a5568; color: #ffffff; border: none; border-radius: 8px; padding: 9px 16px;
          font-size: 13px; font-weight: 600; cursor: not-allowed; opacity: 0.65;
        ">Importa nella wiki</button>
      </div>
    `;

    this.overlay.appendChild(card);
    document.body.appendChild(this.overlay);
    this.attachListeners();
  }

  private attachListeners(): void {
    if (!this.overlay) return;
    const area = this.overlay.querySelector('#mdim-file-area') as HTMLElement;
    const input = this.overlay.querySelector('#mdim-file-input') as HTMLInputElement;

    area.addEventListener('click', () => {
      if (!this.busy) input.click();
    });
    area.addEventListener('dragover', e => {
      e.preventDefault();
      area.style.borderColor = '#4f46e5';
    });
    area.addEventListener('dragleave', () => {
      area.style.borderColor = '#4a5568';
    });
    area.addEventListener('drop', e => {
      e.preventDefault();
      area.style.borderColor = '#4a5568';
      const file = e.dataTransfer?.files?.[0];
      if (file) this.setFile(file);
    });
    input.addEventListener('change', () => {
      if (input.files && input.files[0]) this.setFile(input.files[0]);
    });

    this.overlay.querySelector('#mdim-close')?.addEventListener('click', () => this.close());
    this.overlay.querySelector('#mdim-cancel')?.addEventListener('click', () => this.close());
    this.overlay.querySelector('#mdim-import')?.addEventListener('click', () => void this.runImport());
  }

  private setFile(file: File): void {
    if (!/\.(md|markdown)$/i.test(file.name)) {
      this.status = '⚠️ Seleziona un file con estensione .md';
      this.updateStatus();
      return;
    }
    this.selectedFile = file;
    this.status = '';
    const label = this.overlay?.querySelector('#mdim-file-label') as HTMLElement | null;
    if (label) {
      label.textContent = `📄 ${file.name}`;
      label.style.color = '#68d391';
    }
    this.setBusy(false);
    this.updateStatus();
  }

  private setBusy(busy: boolean): void {
    this.busy = busy;
    const btn = this.overlay?.querySelector('#mdim-import') as HTMLButtonElement | null;
    const enabled = !busy && !!this.selectedFile;
    if (btn) {
      btn.disabled = !enabled;
      btn.style.background = enabled ? '#3182ce' : '#4a5568';
      btn.style.cursor = enabled ? 'pointer' : 'not-allowed';
      btn.style.opacity = enabled ? '1' : '0.65';
      btn.textContent = busy ? 'Importazione...' : 'Importa nella wiki';
    }
  }

  private updateStatus(): void {
    const el = this.overlay?.querySelector('#mdim-status') as HTMLElement | null;
    if (el) el.textContent = this.status;
  }

  private async runImport(): Promise<void> {
    if (!this.selectedFile || this.busy) return;
    const folder =
      (this.overlay?.querySelector('#mdim-folder') as HTMLSelectElement | null)?.value || 'general';

    this.setBusy(true);
    this.status = 'Ingestione e compilazione in corso...';
    this.updateStatus();

    try {
      const content = await this.selectedFile.text();
      const result = await this.storage.ingestMarkdownFile(this.selectedFile.name, content, folder);
      if (result.success) {
        this.status = result.compiled
          ? `✅ ${result.message || `Importato in wiki/${result.targetFolder}/`}`
          : `✅ ${result.message || `Copiato in raw/${this.selectedFile.name}`}`;
        this.onSuccessCb?.(result.note?.id);
        window.setTimeout(() => this.close(), result.compiled ? 1400 : 2600);
      } else {
        this.status = `⚠️ Errore: ${result.error}`;
      }
    } catch (err) {
      this.status = `⚠️ Errore: ${String(err)}`;
    } finally {
      this.setBusy(false);
      this.updateStatus();
    }
  }
}
