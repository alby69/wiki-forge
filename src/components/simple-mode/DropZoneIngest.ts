import { ApiStorage } from '../../storage/ApiStorage';

export interface DropZoneIngestOptions {
  storage: ApiStorage;
  onSuccess?: (fileCount: number) => void;
  targetFolder?: string;
}

export class DropZoneIngest {
  private container: HTMLElement;
  private storage: ApiStorage;
  private onSuccessCb?: (fileCount: number) => void;
  private targetFolder: string;
  private isUploading: boolean = false;
  private progress: number = 0;
  private statusMessage: string = '';

  constructor(parent: HTMLElement, options: DropZoneIngestOptions) {
    this.container = document.createElement('div');
    this.container.className = 'dropzone-wrapper';
    parent.appendChild(this.container);

    this.storage = options.storage;
    this.onSuccessCb = options.onSuccess;
    this.targetFolder = options.targetFolder || 'raw';

    this.render();
  }

  public render(): void {
    this.container.innerHTML = `
      <div class="dropzone-container" id="dropzone-area">
        <input type="file" id="dropzone-file-input" multiple accept=".pdf,.epub,.docx,.md,.txt" style="display: none;" />
        <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
          <div style="font-size: 32px;">📄</div>
          <div style="font-weight: 600; font-size: 14px; color: #f8fafc;">
            ${this.isUploading ? 'Ingesting documents...' : 'Drag & Drop documents or click to browse'}
          </div>
          <div style="font-size: 12px; color: #94a3b8;">
            Supports PDF, EPUB, DOCX, Markdown & TXT files
          </div>
        </div>

        ${
          this.isUploading
            ? `
            <div class="dropzone-progress-bar">
              <div class="dropzone-progress-fill" style="width: ${this.progress}%;"></div>
            </div>
            <div style="margin-top: 8px; font-size: 12px; color: #a5b4fc;">
              ${this.statusMessage || `Processing... ${this.progress}%`}
            </div>
          `
            : ''
        }

        ${
          this.statusMessage && !this.isUploading
            ? `<div style="margin-top: 10px; font-size: 12px; color: #34d399; font-weight: 600;">${this.statusMessage}</div>`
            : ''
        }
      </div>
    `;

    this.attachEventListeners();
  }

  private attachEventListeners(): void {
    const area = this.container.querySelector('#dropzone-area') as HTMLElement;
    const input = this.container.querySelector('#dropzone-file-input') as HTMLInputElement;

    if (!area || !input) return;

    area.addEventListener('click', () => {
      if (!this.isUploading) input.click();
    });

    area.addEventListener('dragover', e => {
      e.preventDefault();
      area.classList.add('drag-over');
    });

    area.addEventListener('dragleave', () => {
      area.classList.remove('drag-over');
    });

    area.addEventListener('drop', e => {
      e.preventDefault();
      area.classList.remove('drag-over');
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        void this.handleFiles(e.dataTransfer.files);
      }
    });

    input.addEventListener('change', () => {
      if (input.files && input.files.length > 0) {
        void this.handleFiles(input.files);
      }
    });
  }

  public async handleFiles(fileList: FileList): Promise<void> {
    const files = Array.from(fileList);
    if (files.length === 0) return;

    this.isUploading = true;
    this.progress = 10;
    this.statusMessage = `Uploading ${files.length} document(s)...`;
    this.render();

    try {
      let uploadedCount = 0;
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const isText = file.name.endsWith('.md') || file.name.endsWith('.txt');
        const content = isText ? await file.text() : await file.arrayBuffer();

        await this.storage.uploadFile(this.targetFolder, file.name, content);
        uploadedCount++;
        this.progress = Math.round(10 + ((i + 1) / files.length) * 80);
        this.statusMessage = `Processing ${file.name} (${uploadedCount}/${files.length})...`;
        this.render();
      }

      this.progress = 100;
      this.isUploading = false;
      this.statusMessage = `✅ ${uploadedCount} document(s) uploaded and ready for analysis!`;
      this.render();

      if (this.onSuccessCb) {
        this.onSuccessCb(uploadedCount);
      }
    } catch (err) {
      this.isUploading = false;
      this.progress = 0;
      this.statusMessage = `⚠️ Error uploading files: ${String(err)}`;
      this.render();
    }
  }
}
