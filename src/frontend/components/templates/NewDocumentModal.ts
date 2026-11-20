import { escapeHtml } from '@frontend/core/utils/html';
import { t } from '@frontend/core/i18n/strings';
import {
  getDefaultTemplateId,
  getTemplate,
  listTemplates,
  renderTemplate,
} from '@frontend/services/templateService';

export interface NewDocumentResult {
  /** Folder relative to the wiki root ('' means the wiki root). */
  folderPath: string;
  fileName: string;
  content: string;
}

export interface NewDocumentModalOptions {
  /** Optional host for tests; a body overlay is created when omitted. */
  container?: HTMLElement;
  defaultPath?: string;
  onSubmit: (result: NewDocumentResult) => void | Promise<void>;
  onCancel?: () => void;
}

/** Normalise a user-entered wiki path into the form createFile expects. */
export function normalizeFolderPath(raw: string): string {
  return raw
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\/?wiki\/?/i, '')
    .replace(/^\/+|\/+$/g, '')
    .replace(/\/{2,}/g, '/');
}

/** Keep the document name inside the wiki and always end with `.md`. */
export function buildFileName(raw: string): string {
  const stem = raw
    .trim()
    .replace(/\\/g, '/')
    .split('/')
    .pop()!
    .replace(/[<>:"|?*]/g, '-')
    .replace(/\.md$/i, '')
    .trim();
  return `${stem || 'senza-titolo'}.md`;
}

/** Dialog for creating a document with a name, an editable path and a template. */
export class NewDocumentModal {
  private host: HTMLElement;
  private ownsHost: boolean;
  private options: NewDocumentModalOptions;
  private openFlag = false;

  constructor(options: NewDocumentModalOptions) {
    this.options = options;
    if (options.container) {
      this.host = options.container;
      this.ownsHost = false;
    } else {
      this.host = typeof document === 'undefined'
        ? ({ innerHTML: '', hidden: true } as unknown as HTMLElement)
        : document.createElement('div');
      this.ownsHost = true;
    }
  }

  public get isOpen(): boolean {
    return this.openFlag;
  }

  public open(defaultPath?: string): void {
    const path = defaultPath ?? this.options.defaultPath ?? 'wiki';
    this.host.innerHTML = this.markup(path);
    this.host.hidden = false;
    this.openFlag = true;
    if (this.ownsHost && typeof document !== 'undefined') {
      document.body.appendChild(this.host);
    }
    this.bindEvents();
    this.updatePreview();
    this.host.querySelector<HTMLInputElement>('#new-doc-name')?.focus?.();
  }

  public close(): void {
    this.openFlag = false;
    this.host.innerHTML = '';
    this.host.hidden = true;
    if (this.ownsHost && typeof document !== 'undefined') this.host.remove?.();
    this.options.onCancel?.();
  }

  private markup(defaultPath: string): string {
    const templates = listTemplates();
    const selectedId = getDefaultTemplateId();
    const options = templates
      .map(template => {
        const suffix = template.builtIn ? t('builtInTemplate') : t('customTemplate');
        return `<option value="${escapeHtml(template.id)}" ${template.id === selectedId ? 'selected' : ''}>${escapeHtml(template.name)} — ${escapeHtml(suffix)}</option>`;
      })
      .join('');
    const initialPath = defaultPath.replace(/^\/?wiki\/?/i, '');

    return `
      <div class="wf-modal-overlay" data-role="new-document-overlay">
        <div class="wf-modal wf-modal--compact" role="dialog" aria-modal="true" aria-labelledby="new-doc-title">
          <div class="wf-modal__header"><h3 class="wf-modal__title" id="new-doc-title">${escapeHtml(t('newDocument'))}</h3></div>
          <div class="wf-modal__body">
            <p class="wf-modal__hint">${escapeHtml(t('newDocumentHint'))}</p>
            <div class="wf-form-field">
              <label class="wf-label" for="new-doc-name">${escapeHtml(t('documentName'))}</label>
              <input class="wf-field wf-field--block" id="new-doc-name" type="text" placeholder="nuova-nota.md" autocomplete="off" />
            </div>
            <div class="wf-form-field wf-template-field">
              <label class="wf-label" for="new-doc-path">${escapeHtml(t('documentPath'))}</label>
              <input class="wf-field wf-field--block" id="new-doc-path" type="text" value="${escapeHtml(initialPath)}" placeholder="guida/approfondimenti" autocomplete="off" />
              <span class="wf-template-hint">wiki/${escapeHtml(initialPath || '…')} · ${escapeHtml(t('documentPathHint'))}</span>
            </div>
            <div class="wf-form-field">
              <label class="wf-label" for="new-doc-template">${escapeHtml(t('chooseTemplate'))}</label>
              <select class="wf-field wf-field--block" id="new-doc-template">${options}</select>
            </div>
            <div class="wf-form-field wf-template-field">
              <label class="wf-label" for="new-doc-preview">${escapeHtml(t('templatePreview'))}</label>
              <textarea class="wf-field wf-field--block wf-template-preview" id="new-doc-preview" readonly></textarea>
            </div>
            <div class="wf-modal__error" id="new-doc-error" role="alert"></div>
          </div>
          <div class="wf-modal__footer">
            <button class="wf-btn" id="new-doc-cancel">${escapeHtml(t('cancel'))}</button>
            <button class="wf-btn wf-btn--primary" id="new-doc-submit">${escapeHtml(t('create'))}</button>
          </div>
        </div>
      </div>`;
  }

  private bindEvents(): void {
    this.host.querySelector('#new-doc-template')?.addEventListener('change', () => this.updatePreview());
    this.host.querySelector('#new-doc-name')?.addEventListener('input', () => this.updatePreview());
    this.host.querySelector('#new-doc-cancel')?.addEventListener('click', () => this.close());
    this.host.querySelector('#new-doc-submit')?.addEventListener('click', () => void this.submit());

    this.host.querySelector('[data-role="new-document-overlay"]')?.addEventListener('click', event => {
      if ((event.target as HTMLElement) === event.currentTarget) this.close();
    });
    this.host.querySelector('.wf-modal')?.addEventListener('keydown', event => {
      if ((event as KeyboardEvent).key === 'Escape') this.close();
    });
  }

  private updatePreview(): void {
    if (!this.openFlag) return;
    const select = this.host.querySelector<HTMLSelectElement>('#new-doc-template');
    const name = this.host.querySelector<HTMLInputElement>('#new-doc-name')?.value ?? '';
    const preview = this.host.querySelector<HTMLTextAreaElement>('#new-doc-preview');
    const template = getTemplate(select?.value || getDefaultTemplateId());
    if (!template || !preview) return;
    const title = name.trim().replace(/\.md$/i, '') || 'Titolo';
    preview.value = renderTemplate(template.content, { title });
  }

  private async submit(): Promise<void> {
    const nameInput = this.host.querySelector<HTMLInputElement>('#new-doc-name');
    const error = this.host.querySelector<HTMLElement>('#new-doc-error');
    const name = nameInput?.value?.trim() ?? '';
    if (!name) {
      if (error) error.textContent = t('nameRequired');
      nameInput?.focus?.();
      return;
    }
    const pathInput = this.host.querySelector<HTMLInputElement>('#new-doc-path');
    const select = this.host.querySelector<HTMLSelectElement>('#new-doc-template');
    const template = getTemplate(select?.value ?? '') ?? getTemplate(getDefaultTemplateId());
    if (!template) return;

    const title = name.replace(/\.md$/i, '') || name;
    const result: NewDocumentResult = {
      folderPath: normalizeFolderPath(pathInput?.value ?? 'wiki'),
      fileName: buildFileName(name),
      content: renderTemplate(template.content, { title }),
    };
    this.host.hidden = true;
    this.openFlag = false;
    this.host.innerHTML = '';
    if (this.ownsHost && typeof document !== 'undefined') this.host.remove?.();
    await this.options.onSubmit(result);
  }
}
