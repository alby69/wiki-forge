import { escapeHtml } from '@frontend/core/utils/html';
import { subscribeLanguage, t, type TranslationKey } from '@frontend/core/i18n/strings';
import {
  notifications,
  type NotificationVariant,
} from '@frontend/services/notificationService';
import {
  type CloneInclude,
  type ProjectDeleteMode,
  type ProjectInfoExtended,
  type ProjectService,
  type ProjectStats,
} from '@frontend/services/projectService';
import { appStore } from '@frontend/store/appStore';
import { canUseOperation } from '@frontend/core/auth';

export interface ProjectManagerOptions {
  service: ProjectService;
  onChanged: () => void | Promise<void>;
  onOpenProject?: (id: string) => void;
  container?: HTMLElement;
}

type View = 'list' | 'create' | 'clone' | 'rename' | 'import';
type Toast = { key: TranslationKey; vars?: Record<string, string | number>; variant?: NotificationVariant };

const ID_PATTERN = /^[a-z0-9_-]+$/;
const INCLUDE_KEYS: Array<keyof CloneInclude> = ['wiki', 'raw', 'sources', 'notes', 'output', 'config'];

function includeLabel(key: keyof CloneInclude): string {
  if (key === 'sources') return t('sources');
  if (key === 'notes') return t('notes');
  return key;
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / 1024 ** index;
  return `${value >= 10 || index === 0 ? Math.round(value) : value.toFixed(1)} ${units[index]}`;
}

/** Styled project lifecycle UI. Active-project selection is owned by the caller. */
export class ProjectManagerModal {
  private overlay: HTMLElement | null = null;
  private unsubscribeLanguage: (() => void) | null = null;
  private previousFocus: HTMLElement | null = null;
  private projects: ProjectInfoExtended[] = [];
  private stats: Record<string, ProjectStats> = {};
  private view: View = 'list';
  private targetId: string | null = null;
  private cloneSourceId: string | null = null;
  private busy = false;

  constructor(private readonly options: ProjectManagerOptions) {}

  public async open(): Promise<void> {
    if (!this.overlay) {
      this.previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const overlay = document.createElement('div');
      overlay.className = 'wf-modal-overlay';
      overlay.addEventListener('click', event => {
        if (event.target === overlay) this.close();
      });
      overlay.addEventListener('click', event => this.onClick(event));
      overlay.addEventListener('keydown', event => this.onKeydown(event));
      (this.options.container ?? document.body).appendChild(overlay);
      this.overlay = overlay;
    }
    this.unsubscribeLanguage?.();
    this.unsubscribeLanguage = subscribeLanguage(() => {
      if (this.overlay?.isConnected) this.render();
    });
    this.view = 'list';
    this.targetId = null;
    await this.refresh();
  }

  public close(): void {
    this.unsubscribeLanguage?.();
    this.unsubscribeLanguage = null;
    this.overlay?.remove();
    this.overlay = null;
    this.busy = false;
    this.previousFocus?.focus();
    this.previousFocus = null;
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------

  private render(): void {
    if (!this.overlay) return;
    if (this.view === 'list') this.renderList();
    else this.renderForm();
  }

  private shell(titleKey: TranslationKey, body: string, footer: string, compact = false): void {
    if (!this.overlay) return;
    const closeLabel = escapeHtml(t('close'));
    this.overlay.innerHTML = `
      <div class="wf-modal${compact ? ' wf-modal--compact' : ''}" role="dialog" aria-modal="true" aria-labelledby="wf-project-manager-title">
        <div class="wf-modal__header">
          <h3 class="wf-modal__title" id="wf-project-manager-title">${escapeHtml(t(titleKey))}</h3>
          <button type="button" class="wf-icon-btn" data-action="close" title="${closeLabel}" aria-label="${closeLabel}">✕</button>
        </div>
        <div class="wf-modal__body">${body}</div>
        <div class="wf-modal__footer">${footer}</div>
      </div>`;
  }

  private renderList(): void {
    const activeId = appStore.getState().activeProjectId;
    const rows = this.projects.length
      ? this.projects.map(project => this.renderRow(project, activeId)).join('')
      : `<tr><td colspan="6">${escapeHtml(t('noProjects'))}</td></tr>`;
    const admin = canUseOperation('projects.create');
    const body = `
      <p class="wf-modal__hint">${escapeHtml(t('projectManagerHint'))}</p>
      <div style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:10px;">
        ${admin ? `<button type="button" class="wf-btn wf-btn--primary" data-action="new">${escapeHtml(t('newProject'))}</button>` : ''}
        ${admin ? `<button type="button" class="wf-btn" data-action="clone">${escapeHtml(t('cloneProject'))}</button>` : ''}
        ${admin ? `<button type="button" class="wf-btn" data-action="import">${escapeHtml(t('importProject'))}</button>` : ''}
      </div>
      <div style="overflow-x:auto;">
        <table class="wf-table">
          <thead><tr>
            <th>${escapeHtml(t('name'))}</th><th>${escapeHtml(t('id'))}</th><th>${escapeHtml(t('path'))}</th>
            <th>${escapeHtml(t('status'))}</th><th>${escapeHtml(t('stats'))}</th><th>${escapeHtml(t('actions'))}</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
    const footer = `<button type="button" class="wf-btn" data-action="close">${escapeHtml(t('close'))}</button>`;
    this.shell('projectManager', body, footer);
  }

  private renderRow(project: ProjectInfoExtended, activeId: string): string {
    const id = escapeHtml(project.id);
    const name = escapeHtml(project.name);
    const status = [
      project.archived ? `<span class="wf-badge">${escapeHtml(t('archived'))}</span>` : '',
      project.id === activeId ? `<span class="wf-badge wf-badge--success">${escapeHtml(t('active'))}</span>` : '',
    ].filter(Boolean).join(' ') || '—';
    const admin = canUseOperation('projects.create');
    const buttons: Array<[string, string, string]> = [
      ['open', t('open'), 'wf-btn--info'],
      ['export', t('export'), ''],
      ...(admin ? [
        ['rename', t('rename'), ''],
        ['clone', t('clone'), ''],
        [project.archived ? 'restore' : 'archive', project.archived ? t('restore') : t('archive'), 'wf-btn--warning'],
        ['delete', t('delete'), 'wf-btn--warning'],
        ['permanent', t('permanentDelete'), 'wf-btn--danger'],
      ] as Array<[string, string, string]> : []),
    ];
    const actions = buttons
      .map(([action, label, variant]) => `
        <button type="button" class="wf-btn wf-btn--sm ${variant}" data-action="${action}" data-id="${id}"
          title="${escapeHtml(label)}" aria-label="${escapeHtml(`${label}: ${project.name}`)}">${escapeHtml(label)}</button>`)
      .join('');
    return `<tr>
      <td><strong>${name}</strong></td>
      <td><code>${id}</code></td>
      <td><code>${escapeHtml(project.path)}</code></td>
      <td>${status}</td>
      <td>${escapeHtml(this.formatStats(this.stats[project.id]))}</td>
      <td><div class="wf-table__actions">${actions}</div></td>
    </tr>`;
  }

  private renderForm(): void {
    let titleKey: TranslationKey = 'newProject';
    let submitKey: TranslationKey = 'create';
    let fields = '';
    if (this.view === 'create') {
      fields = this.idNameFields();
    } else if (this.view === 'clone') {
      titleKey = 'cloneProject';
      submitKey = 'clone';
      const options = this.projects
        .map(project => {
          const selected = project.id === (this.cloneSourceId ?? appStore.getState().activeProjectId);
          return `<option value="${escapeHtml(project.id)}"${selected ? ' selected' : ''}>${escapeHtml(project.name)} (${escapeHtml(project.id)})</option>`;
        })
        .join('');
      const checks = INCLUDE_KEYS
        .map(key => `<label class="wf-label" style="display:inline-flex; align-items:center; gap:4px;">
          <input type="checkbox" data-include="${key}" checked>${escapeHtml(includeLabel(key))}
        </label>`)
        .join('');
      fields = `
        <div class="wf-form-field wf-form-field--full">
          <label class="wf-label" for="pm-source">${escapeHtml(t('sourceProject'))}</label>
          <select class="wf-field wf-field--block" id="pm-source">${options}</select>
        </div>
        ${this.idNameFields()}
        <div class="wf-form-field wf-form-field--full">
          <span class="wf-label">${escapeHtml(t('includeContent'))}</span>
          <div style="display:flex; flex-wrap:wrap; gap:10px;">${checks}</div>
        </div>`;
    } else if (this.view === 'rename') {
      titleKey = 'renameProject';
      submitKey = 'rename';
      const current = this.projects.find(project => project.id === this.targetId)?.name ?? '';
      fields = `<div class="wf-form-field wf-form-field--full">
        <label class="wf-label" for="pm-name">${escapeHtml(t('projectName'))}</label>
        <input class="wf-field wf-field--block" id="pm-name" type="text" value="${escapeHtml(current)}" />
      </div>`;
    } else {
      titleKey = 'importProject';
      submitKey = 'import';
      fields = `<div class="wf-form-field wf-form-field--full">
        <label class="wf-label" for="pm-bundle">${escapeHtml(t('bundle'))}</label>
        <textarea class="wf-field wf-field--block" id="pm-bundle" rows="10" spellcheck="false"></textarea>
      </div>`;
    }

    const body = `<div class="wf-form-grid">${fields}</div><div class="wf-modal__error" id="pm-error"></div>`;
    const footer = `
      <button type="button" class="wf-btn" data-action="cancel">${escapeHtml(t('cancel'))}</button>
      <button type="button" class="wf-btn wf-btn--primary" data-action="submit">${escapeHtml(t(submitKey))}</button>`;
    this.shell(titleKey, body, footer, true);
    this.overlay?.querySelector<HTMLElement>('#pm-source, #pm-id, #pm-name, #pm-bundle')?.focus();
  }

  private idNameFields(): string {
    return `
      <div class="wf-form-field">
        <label class="wf-label" for="pm-id">${escapeHtml(t('projectId'))}</label>
        <input class="wf-field wf-field--block" id="pm-id" type="text" spellcheck="false" />
      </div>
      <div class="wf-form-field">
        <label class="wf-label" for="pm-name">${escapeHtml(t('projectName'))}</label>
        <input class="wf-field wf-field--block" id="pm-name" type="text" />
      </div>`;
  }

  private formatStats(stats?: ProjectStats): string {
    if (!stats) return '—';
    const count = (value: unknown): string => (typeof value === 'number' && Number.isFinite(value) ? String(value) : '0');
    const bytes = typeof stats.totalBytes === 'number'
      ? stats.totalBytes
      : typeof stats.bytes === 'number' ? stats.bytes : 0;
    const parts = [
      `${count(stats.notes)} ${t('notes')}`,
      `${count(stats.sources)} ${t('sources')}`,
      `${count(stats.assets)} ${t('assets')}`,
    ];
    if (bytes > 0) parts.push(`${t('size')}: ${formatBytes(bytes)}`);
    return parts.join(' · ');
  }

  // ---------------------------------------------------------------------------
  // Events and actions
  // ---------------------------------------------------------------------------

  private onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
      return;
    }
    if (event.key === 'Enter' && this.view !== 'list' && !(event.target as HTMLElement).matches('textarea')) {
      event.preventDefault();
      void this.submitForm();
    }
  }

  private onClick(event: MouseEvent): void {
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-action]');
    if (!target || !this.overlay?.contains(target)) return;
    void this.handleAction(target.dataset.action ?? '', target.dataset.id ?? '');
  }

  private async handleAction(action: string, id: string): Promise<void> {
    switch (action) {
      case 'close':
        this.close();
        break;
      case 'cancel':
        this.view = 'list';
        this.render();
        break;
      case 'new':
        this.showForm('create');
        break;
      case 'import':
        this.showForm('import');
        break;
      case 'clone':
        this.showForm('clone', id || undefined);
        break;
      case 'rename':
        this.showForm('rename', id);
        break;
      case 'submit':
        await this.submitForm();
        break;
      case 'open':
        await this.runAction(async () => {
          this.options.onOpenProject?.(id);
          this.close();
        });
        break;
      case 'export':
        await this.runAction(async () => this.downloadBundle(id), {
          key: 'projectExported',
        });
        break;
      case 'archive': {
        const project = this.findProject(id);
        const confirmed = await notifications.confirm({
          title: t('archive'),
          message: t('confirmArchiveMessage', { name: project?.name ?? id }),
          confirmLabel: t('archive'),
        });
        if (!confirmed) break;
        await this.runAction(async () => {
          await this.options.service.archive(id);
          await this.afterMutation();
        }, { key: 'projectArchived' });
        break;
      }
      case 'restore':
        await this.runAction(async () => {
          await this.options.service.restore(id);
          await this.afterMutation();
        }, { key: 'projectRestored' });
        break;
      case 'delete': {
        const project = this.findProject(id);
        const confirmed = await notifications.confirm({
          title: t('deleteProject'),
          message: t('confirmDeleteMessage', { name: project?.name ?? id }),
          confirmLabel: t('moveToTrash'),
        });
        if (!confirmed) break;
        await this.removeProject(id, 'trash');
        break;
      }
      case 'permanent': {
        const project = this.findProject(id);
        const confirmed = await notifications.confirm({
          title: t('permanentDelete'),
          message: t('confirmPermanentMessage', { name: project?.name ?? id }),
          confirmLabel: t('permanentDelete'),
          danger: true,
        });
        if (!confirmed) break;
        await this.removeProject(id, 'permanent', id);
        break;
      }
    }
  }

  private showForm(view: View, id?: string): void {
    this.view = view;
    this.targetId = id ?? null;
    if (view === 'clone') this.cloneSourceId = id ?? null;
    this.render();
  }

  private async removeProject(id: string, mode: ProjectDeleteMode, confirm?: string): Promise<void> {
    await this.runAction(async () => {
      await this.options.service.remove(id, mode, confirm);
      await this.afterMutation();
    }, { key: 'projectDeleted' });
  }

  private async submitForm(): Promise<void> {
    if (this.busy) return;
    if (this.view === 'create' || this.view === 'clone') {
      const id = this.value('#pm-id');
      const name = this.value('#pm-name');
      const error = this.validate(id, name);
      if (error) {
        this.setError(error);
        return;
      }
      if (this.view === 'create') {
        await this.runAction(async () => {
          await this.options.service.create(id, name);
          await this.afterMutation();
        }, { key: 'projectCreated', vars: { name } });
      } else {
        const sourceId = this.value('#pm-source') || this.projects[0]?.id || '';
        const include: CloneInclude = {};
        this.overlay?.querySelectorAll<HTMLInputElement>('[data-include]').forEach(input => {
          const key = input.dataset.include as keyof CloneInclude | undefined;
          if (key) include[key] = input.checked;
        });
        await this.runAction(async () => {
          await this.options.service.clone(sourceId, { id, name, include });
          await this.afterMutation();
        }, { key: 'projectCloned', vars: { name } });
      }
      return;
    }
    if (this.view === 'rename') {
      const name = this.value('#pm-name');
      if (!name) {
        this.setError(`${t('projectName')}: —`);
        return;
      }
      const id = this.targetId ?? '';
      await this.runAction(async () => {
        await this.options.service.rename(id, name);
        await this.afterMutation();
      }, { key: 'projectRenamed', vars: { name } });
      return;
    }
    if (this.view === 'import') {
      const raw = this.value('#pm-bundle');
      if (!raw) {
        this.setError(`${t('bundle')}: —`);
        return;
      }
      let bundle: unknown;
      try {
        bundle = JSON.parse(raw);
      } catch (err) {
        this.setError(err instanceof Error ? err.message : String(err));
        return;
      }
      await this.runAction(async () => {
        await this.options.service.importBundle(bundle);
        await this.afterMutation();
      }, { key: 'projectImported' });
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private async runAction(action: () => Promise<void>, success?: Toast): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.setButtonsDisabled(true);
    try {
      await action();
      if (success) {
        notifications.translated(success.key, success.variant ?? 'success', success.vars ?? {});
      }
    } catch (err) {
      notifications.translated('operationFailed', 'error', {
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      this.busy = false;
      if (this.overlay?.isConnected) this.setButtonsDisabled(false);
    }
  }

  private setButtonsDisabled(disabled: boolean): void {
    this.overlay?.querySelectorAll<HTMLButtonElement>('button').forEach(button => {
      button.disabled = disabled;
    });
  }

  private async afterMutation(): Promise<void> {
    this.view = 'list';
    await this.refresh();
    await this.options.onChanged();
  }

  private async refresh(): Promise<void> {
    try {
      this.projects = await this.options.service.list(true);
      this.stats = {};
      await Promise.all(this.projects.map(async project => {
        try {
          this.stats[project.id] = await this.options.service.stats(project.id);
        } catch (_err) {
          // Stats are informational; a missing endpoint must not block the list.
        }
      }));
    } catch (err) {
      this.projects = [];
      this.stats = {};
      notifications.translated('operationFailed', 'error', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
    this.render();
  }

  private findProject(id: string): ProjectInfoExtended | undefined {
    return this.projects.find(project => project.id === id);
  }

  private value(selector: string): string {
    return (this.overlay?.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(selector)?.value ?? '').trim();
  }

  private validate(id: string, name: string): string | null {
    if (!ID_PATTERN.test(id)) return `${t('projectId')}: /^[a-z0-9_-]+$/`;
    if (!name) return `${t('projectName')}: —`;
    return null;
  }

  private setError(message: string): void {
    const element = this.overlay?.querySelector('#pm-error');
    if (element) element.textContent = message;
  }

  private async downloadBundle(id: string): Promise<void> {
    const bundle = await this.options.service.exportBundle(id);
    const url = URL.createObjectURL(new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${id.replace(/[^a-z0-9_-]+/gi, '_')}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
