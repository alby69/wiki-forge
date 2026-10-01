import { ApiStorage } from '../../storage/ApiStorage';
import { DropZoneIngest } from './DropZoneIngest';

export interface SimpleModeDashboardOptions {
  storage: ApiStorage;
  onOpenChat: () => void;
  onVaultUpdated: () => void;
}

export class SimpleModeDashboard {
  private container: HTMLElement;
  private storage: ApiStorage;
  private onOpenChat: () => void;
  private onVaultUpdated: () => void;
  private dropZoneModal?: HTMLElement;
  private isCompiling: boolean = false;
  private compileProgress: number = 0;
  private compileStatusMsg: string = '';

  constructor(parent: HTMLElement, options: SimpleModeDashboardOptions) {
    this.storage = options.storage;
    this.onOpenChat = options.onOpenChat;
    this.onVaultUpdated = options.onVaultUpdated;

    this.container = document.createElement('div');
    this.container.id = 'simple-mode-dashboard';
    this.container.style.cssText = `
      display: flex;
      align-items: center;
      gap: 6px;
      pointer-events: auto;
    `;
    parent.appendChild(this.container);

    this.render();
  }

  public render(): void {
    const pill = `
      border: none; border-radius: 8px; cursor: pointer; white-space: nowrap;
      display: flex; align-items: center; gap: 7px;
      padding: 5px 11px; font-weight: 600; font-size: 12px; line-height: 1.15;
      transition: background 0.2s, opacity 0.2s;
    `;
    const col = `display: flex; flex-direction: column; align-items: flex-start; gap: 1px;`;
    const sub = `font-size: 9px; font-weight: 400; opacity: 0.85; letter-spacing: 0.1px;`;

    this.container.innerHTML = `
      <button id="simple-upload-btn" title="1. Carica Documenti — PDF, EPUB, DOCX, TXT" style="
        background: #2b6cb0; color: #ffffff;
        ${pill}
      " onmouseover="this.style.background='#3182ce'" onmouseout="this.style.background='#2b6cb0'">
        <span style="font-size: 15px;">📥</span>
        <span style="${col}">
          <span>1. Carica</span>
          <span style="${sub}">Documenti</span>
        </span>
      </button>

      <button id="simple-compile-btn" title="2. Compila Wiki — Converti e interconnetti" ${this.isCompiling ? 'disabled' : ''} style="
        background: ${this.isCompiling ? '#4a5568' : '#2f855a'}; color: #ffffff; cursor: ${this.isCompiling ? 'not-allowed' : 'pointer'};
        ${pill}
      " onmouseover="if(!this.disabled) this.style.background='#38a169'" onmouseout="if(!this.disabled) this.style.background='#2f855a'">
        <span style="font-size: 15px;">⚡</span>
        <span style="${col}">
          <span>2. Compila</span>
          <span style="${sub}">Converti &amp; Link</span>
        </span>
      </button>

      <button id="simple-chat-btn" title="3. Chiedi alla Wiki — Assistente e ricerca" style="
        background: #4c51bf; color: #ffffff;
        ${pill}
      " onmouseover="this.style.background='#5a67d8'" onmouseout="this.style.background='#4c51bf'">
        <span style="font-size: 15px;">💬</span>
        <span style="${col}">
          <span>3. Chiedi</span>
          <span style="${sub}">Alla Wiki</span>
        </span>
      </button>

      ${
        this.isCompiling || this.compileStatusMsg
          ? `
          <div title="${this.compileStatusMsg || 'Elaborazione in corso...'}" style="
            display: flex; flex-direction: column; gap: 3px; min-width: 108px; max-width: 150px;
            padding: 0 2px;
          ">
            <div style="display: flex; justify-content: space-between; gap: 8px; font-size: 10px; color: #cbd5e0;">
              <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${this.compileStatusMsg || 'Elaborazione...'}</span>
              <span style="flex-shrink: 0;">${this.compileProgress}%</span>
            </div>
            <div style="width: 100%; height: 4px; background: #2d3748; border-radius: 2px; overflow: hidden;">
              <div style="width: ${this.compileProgress}%; height: 100%; background: #48bb78; transition: width 0.3s;"></div>
            </div>
          </div>
        `
          : ''
      }
    `;

    this.attachEventListeners();
  }

  private attachEventListeners(): void {
    const uploadBtn = this.container.querySelector('#simple-upload-btn');
    const compileBtn = this.container.querySelector('#simple-compile-btn');
    const chatBtn = this.container.querySelector('#simple-chat-btn');

    uploadBtn?.addEventListener('click', () => {
      this.openUploadModal();
    });

    compileBtn?.addEventListener('click', () => {
      void this.executeCompilePipeline();
    });

    chatBtn?.addEventListener('click', () => {
      this.onOpenChat();
    });
  }

  private openUploadModal(): void {
    if (this.dropZoneModal) {
      this.dropZoneModal.style.display = 'flex';
      return;
    }

    this.dropZoneModal = document.createElement('div');
    this.dropZoneModal.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
      background: rgba(0,0,0,0.75); display: flex; align-items: center; justify-content: center;
      z-index: 1000; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    `;

    const modalCard = document.createElement('div');
    modalCard.style.cssText = `
      width: 520px; max-width: 90vw; background: #18191c; border: 1px solid #2d3748;
      border-radius: 12px; padding: 20px; color: #f8fafc; display: flex; flex-direction: column; gap: 16px;
      box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5);
    `;

    modalCard.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #2d3748; padding-bottom: 12px;">
        <h3 style="margin: 0; font-size: 16px; font-weight: 600; color: #64b5f6;">📥 Carica Documenti Sorgente</h3>
        <button id="dropzone-close-btn" style="background: transparent; border: none; color: #a0aec0; font-size: 18px; cursor: pointer;">✕</button>
      </div>
      <div id="dropzone-container-root"></div>
    `;

    this.dropZoneModal.appendChild(modalCard);
    document.body.appendChild(this.dropZoneModal);

    const closeBtn = modalCard.querySelector('#dropzone-close-btn');
    closeBtn?.addEventListener('click', () => {
      if (this.dropZoneModal) this.dropZoneModal.style.display = 'none';
    });

    const root = modalCard.querySelector('#dropzone-container-root') as HTMLElement;
    if (root) {
      new DropZoneIngest(root, {
        storage: this.storage,
        targetFolder: 'sources',
        onSuccess: () => {
          this.onVaultUpdated();
        },
      });
    }
  }

  private async executeCompilePipeline(): Promise<void> {
    if (this.isCompiling) return;

    this.isCompiling = true;
    this.compileProgress = 15;
    this.compileStatusMsg = 'Inizio conversione...';
    this.render();

    try {
      this.compileProgress = 40;
      this.compileStatusMsg = 'Creazione wikilinks...';
      this.render();

      await this.storage.sendChatStream('/compile', (chunk: string) => {
        if (chunk.includes('Compiling') || chunk.includes('Ingesting')) {
          this.compileProgress = Math.min(90, this.compileProgress + 10);
          this.render();
        }
      });

      this.compileProgress = 100;
      this.compileStatusMsg = 'Completato';
      this.isCompiling = false;
      this.render();

      this.onVaultUpdated();

      setTimeout(() => {
        this.compileStatusMsg = '';
        this.compileProgress = 0;
        this.render();
      }, 4000);
    } catch (err) {
      this.isCompiling = false;
      this.compileStatusMsg = 'Errore';
      this.render();
    }
  }

  public setVisible(visible: boolean): void {
    this.container.style.display = visible ? 'flex' : 'none';
  }
}