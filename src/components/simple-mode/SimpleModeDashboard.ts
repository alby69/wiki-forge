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
    this.container = document.createElement('div');
    this.container.id = 'simple-mode-dashboard';
    this.container.style.cssText = `
      background: #18191c;
      border-bottom: 1px solid #2d3748;
      padding: 14px 20px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      color: #e2e8f0;
    `;
    parent.insertBefore(this.container, parent.firstChild);

    this.storage = options.storage;
    this.onOpenChat = options.onOpenChat;
    this.onVaultUpdated = options.onVaultUpdated;

    this.render();
  }

  public render(): void {
    this.container.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 18px;">🌟</span>
          <span style="font-weight: 600; font-size: 14px; color: #64b5f6;">Modalità Semplice — Flusso in 3 Passi</span>
        </div>
        <div style="font-size: 11px; color: #a0aec0;">
          Carica -> Elabora -> Esplora
        </div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px;">
        <button id="simple-upload-btn" style="
          background: #2b6cb0; color: #ffffff; border: none; padding: 12px 16px; border-radius: 8px;
          display: flex; flex-direction: column; align-items: center; gap: 6px; cursor: pointer;
          font-weight: 600; font-size: 13px; transition: background 0.2s;
        " onmouseover="this.style.background='#3182ce'" onmouseout="this.style.background='#2b6cb0'">
          <span style="font-size: 22px;">📥</span>
          <span>1. Carica Documenti</span>
          <span style="font-size: 10px; font-weight: normal; opacity: 0.8;">PDF, EPUB, DOCX, TXT</span>
        </button>

        <button id="simple-compile-btn" ${this.isCompiling ? 'disabled' : ''} style="
          background: ${this.isCompiling ? '#4a5568' : '#2f855a'}; color: #ffffff; border: none; padding: 12px 16px; border-radius: 8px;
          display: flex; flex-direction: column; align-items: center; gap: 6px; cursor: ${this.isCompiling ? 'not-allowed' : 'pointer'};
          font-weight: 600; font-size: 13px; transition: background 0.2s;
        " onmouseover="if(!this.disabled) this.style.background='#38a169'" onmouseout="if(!this.disabled) this.style.background='#2f855a'">
          <span style="font-size: 22px;">⚡</span>
          <span>${this.isCompiling ? 'Compilazione...' : '2. Compila Wiki'}</span>
          <span style="font-size: 10px; font-weight: normal; opacity: 0.8;">Converti & Interconnetti</span>
        </button>

        <button id="simple-chat-btn" style="
          background: #4c51bf; color: #ffffff; border: none; padding: 12px 16px; border-radius: 8px;
          display: flex; flex-direction: column; align-items: center; gap: 6px; cursor: pointer;
          font-weight: 600; font-size: 13px; transition: background 0.2s;
        " onmouseover="this.style.background='#5a67d8'" onmouseout="this.style.background='#4c51bf'">
          <span style="font-size: 22px;">💬</span>
          <span>3. Chiedi alla Wiki</span>
          <span style="font-size: 10px; font-weight: normal; opacity: 0.8;">Assistente e Ricerca</span>
        </button>
      </div>

      ${
        this.isCompiling || this.compileStatusMsg
          ? `
          <div style="background: #1a202c; border: 1px solid #2d3748; padding: 10px 14px; border-radius: 6px; display: flex; flex-direction: column; gap: 6px;">
            <div style="display: flex; justify-content: space-between; font-size: 12px; color: #cbd5e0;">
              <span>${this.compileStatusMsg || 'Elaborazione in corso...'}</span>
              <span>${this.compileProgress}%</span>
            </div>
            <div style="width: 100%; height: 6px; background: #2d3748; border-radius: 3px; overflow: hidden;">
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
    this.compileStatusMsg = 'Inizio conversione ed ingestione dei documenti...';
    this.render();

    try {
      this.compileProgress = 40;
      this.compileStatusMsg = 'Compilazione articoli e creazione wikilinks...';
      this.render();

      await this.storage.sendChatStream('/compile', (chunk: string) => {
        if (chunk.includes('Compiling') || chunk.includes('Ingesting')) {
          this.compileProgress = Math.min(90, this.compileProgress + 10);
          this.render();
        }
      });

      this.compileProgress = 100;
      this.compileStatusMsg = '✅ Compilazione completata con successo!';
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
      this.compileStatusMsg = `⚠️ Errore durante la compilazione: ${String(err)}`;
      this.render();
    }
  }

  public setVisible(visible: boolean): void {
    this.container.style.display = visible ? 'flex' : 'none';
  }
}
