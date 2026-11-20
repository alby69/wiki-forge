import { escapeHtml } from '@frontend/core/utils/html';
import { t } from '@frontend/core/i18n/strings';
import { notifications } from '@frontend/services/notificationService';
import {
  deleteTemplate,
  getDefaultTemplateId,
  getTemplate,
  listTemplates,
  saveTemplate,
  setDefaultTemplateId,
  type TemplateDefinition,
} from '@frontend/services/templateService';

export interface TemplateManagerOptions {
  /** Optional host for tests; a body overlay is created when omitted. */
  container?: HTMLElement;
  /** Open the new-document dialog from the manager. */
  onCreateDocument?: () => void;
  onChange?: () => void;
}

/** Graphical CRUD for templates plus the default-template choice. */
export class TemplateManagerModal {
  private host: HTMLElement;
  private ownsHost: boolean;
  private options: TemplateManagerOptions;
  private editingId?: string;
  private openFlag = false;

  constructor(options: TemplateManagerOptions = {}) {
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

  public open(): void {
    this.editingId = undefined;
    this.render();
    this.host.hidden = false;
    this.openFlag = true;
    if (this.ownsHost && typeof document !== 'undefined') {
      document.body.appendChild(this.host);
    }
  }

  public close(): void {
    this.openFlag = false;
    this.host.innerHTML = '';
    this.host.hidden = true;
    if (this.ownsHost && typeof document !== 'undefined') this.host.remove?.();
  }

  private templateRow(template: TemplateDefinition): string {
    const defaultId = getDefaultTemplateId();
    const isDefault = template.id === defaultId;
    const badge = template.builtIn ? t('builtInTemplate') : t('customTemplate');
    const preview = template.description
      ? escapeHtml(template.description)
      : escapeHtml(template.content.split('\n').find(line => line.trim() && !line.startsWith('#')) ?? '');
    return `<li class="wf-template-row" data-template-id="${escapeHtml(template.id)}">
      <div class="wf-template-row__main">
        <span class="wf-template-row__name">${escapeHtml(template.name)}</span>
        <span class="wf-template-badge wf-template-badge--${template.builtIn ? 'builtin' : 'custom'}">${escapeHtml(badge)}</span>
        ${isDefault ? `<span class="wf-template-badge wf-template-badge--default">${escapeHtml(t('defaultTemplate'))}</span>` : ''}
        <div class="wf-template-row__desc">${preview}</div>
      </div>
      <div class="wf-template-row__actions">
        <button class="wf-btn wf-btn--sm" data-template-default="${escapeHtml(template.id)}" ${isDefault ? 'disabled' : ''}>${escapeHtml(t('useAsDefault'))}</button>
        ${template.builtIn ? '' : `<button class="wf-btn wf-btn--sm" data-template-edit="${escapeHtml(template.id)}">${escapeHtml(t('editTemplate'))}</button>
        <button class="wf-btn wf-btn--sm wf-btn--danger" data-template-delete="${escapeHtml(template.id)}">${escapeHtml(t('deleteTemplate'))}</button>`}
      </div>
    </li>`;
  }

  private render(): void {
    const editing = this.editingId ? getTemplate(this.editingId) : undefined;
    const rows = listTemplates().map(template => this.templateRow(template)).join('');
    this.host.innerHTML = `
      <div class="wf-modal-overlay" data-role="template-manager-overlay">
        <div class="wf-modal" role="dialog" aria-modal="true" aria-labelledby="template-manager-title">
          <div class="wf-modal__header"><h3 class="wf-modal__title" id="template-manager-title">${escapeHtml(t('templateManager'))}</h3></div>
          <div class="wf-modal__body">
            <p class="wf-modal__hint">${escapeHtml(t('templateManagerHint'))}</p>
            <ul class="wf-template-list">${rows}</ul>
            <hr class="wf-template-separator" />
            <h4 class="wf-template-form-title">${escapeHtml(editing ? t('editTemplate') : t('newTemplate'))}</h4>
            <div class="wf-form-grid">
              <div class="wf-form-field">
                <label class="wf-label" for="template-name">${escapeHtml(t('templateName'))}</label>
                <input class="wf-field wf-field--block" id="template-name" type="text" value="${escapeHtml(editing?.name ?? '')}" />
              </div>
              <div class="wf-form-field">
                <label class="wf-label" for="template-description">${escapeHtml(t('templateDescription'))}</label>
                <input class="wf-field wf-field--block" id="template-description" type="text" value="${escapeHtml(editing?.description ?? '')}" />
              </div>
              <div class="wf-form-field wf-form-field--full">
                <label class="wf-label" for="template-content">${escapeHtml(t('templateContent'))}</label>
                <textarea class="wf-field wf-field--block" id="template-content">${escapeHtml(editing?.content ?? '')}</textarea>
              </div>
            </div>
            <div class="wf-modal__error" id="template-error" role="alert"></div>
          </div>
          <div class="wf-modal__footer">
            <button class="wf-btn" id="template-close">${escapeHtml(t('close'))}</button>
            ${this.options.onCreateDocument ? `<button class="wf-btn" id="template-new-document">${escapeHtml(t('newDocument'))}</button>` : ''}
            <button class="wf-btn wf-btn--primary" id="template-save">${escapeHtml(t('saveTemplate'))}</button>
          </div>
        </div>
      </div>`;
    this.bindEvents();
  }

  private bindEvents(): void {
    this.host.querySelector('#template-close')?.addEventListener('click', () => this.close());
    this.host.querySelector('#template-new-document')?.addEventListener('click', () => {
      this.close();
      this.options.onCreateDocument?.();
    });
    this.host.querySelector('#template-save')?.addEventListener('click', () => this.saveForm());

    this.host.querySelectorAll<HTMLElement>('[data-template-default]').forEach(button => {
      button.addEventListener('click', () => {
        const id = button.dataset.templateDefault;
        if (!id) return;
        setDefaultTemplateId(id);
        this.render();
        this.options.onChange?.();
      });
    });
    this.host.querySelectorAll<HTMLElement>('[data-template-edit]').forEach(button => {
      button.addEventListener('click', () => {
        this.editingId = button.dataset.templateEdit;
        this.render();
        this.host.querySelector<HTMLInputElement>('#template-name')?.focus?.();
      });
    });
    this.host.querySelectorAll<HTMLElement>('[data-template-delete]').forEach(button => {
      button.addEventListener('click', () => void this.remove(button.dataset.templateDelete));
    });

    this.host.querySelector('[data-role="template-manager-overlay"]')?.addEventListener('click', event => {
      if ((event.target as HTMLElement) === event.currentTarget) this.close();
    });
    this.host.querySelector('.wf-modal')?.addEventListener('keydown', event => {
      if ((event as KeyboardEvent).key === 'Escape') this.close();
    });
  }

  private saveForm(): void {
    const name = this.host.querySelector<HTMLInputElement>('#template-name')?.value ?? '';
    const description = this.host.querySelector<HTMLInputElement>('#template-description')?.value ?? '';
    const content = this.host.querySelector<HTMLTextAreaElement>('#template-content')?.value ?? '';
    const error = this.host.querySelector<HTMLElement>('#template-error');
    if (!name.trim() || !content.trim()) {
      if (error) error.textContent = t('nameRequired');
      return;
    }
    saveTemplate({ id: this.editingId, name, description, content });
    this.editingId = undefined;
    this.render();
    this.options.onChange?.();
  }

  private async remove(id?: string): Promise<void> {
    if (!id) return;
    const confirmed = await notifications.confirm({
      title: t('deleteTemplate'),
      message: t('confirmDeleteItem', { name: getTemplate(id)?.name ?? id }),
      danger: true,
    });
    if (!confirmed) return;
    if (this.editingId === id) this.editingId = undefined;
    deleteTemplate(id);
    this.render();
    this.options.onChange?.();
  }
}
