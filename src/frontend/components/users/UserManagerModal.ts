import { escapeHtml } from '@frontend/core/utils/html';
import { t } from '@frontend/core/i18n/strings';
import { apiBus } from '@frontend/core/apiBus';
import { notifications } from '@frontend/services/notificationService';
import type { ManagedUserDto, ManagedUserRole } from '@shared/api/types';

const ROLES: ManagedUserRole[] = ['Reader', 'Contributor', 'KnowledgeEngineer', 'Admin'];

export interface UserManagerOptions {
  container?: HTMLElement;
}

export class UserManagerModal {
  private host: HTMLElement;
  private ownsHost: boolean;
  private users: ManagedUserDto[] = [];
  private editingId?: string;
  private status = '';
  private openFlag = false;

  constructor(options: UserManagerOptions = {}) {
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

  public async open(): Promise<void> {
    this.editingId = undefined;
    this.status = '';
    this.openFlag = true;
    if (this.ownsHost && typeof document !== 'undefined') document.body.appendChild(this.host);
    this.host.hidden = false;
    await this.load();
    this.render();
  }

  public close(): void {
    this.openFlag = false;
    this.host.innerHTML = '';
    this.host.hidden = true;
    if (this.ownsHost && typeof document !== 'undefined') this.host.remove?.();
  }

  private async load(): Promise<boolean> {
    try {
      const data = await apiBus.dispatch('users.list', {});
      if (data.success === false) {
        this.status = (data as { error?: string }).error ?? t('userStoreUnavailable');
        return false;
      }
      this.users = data.users ?? [];
      this.status = '';
      return true;
    } catch (err) {
      this.status = this.errorMessage(err);
      return false;
    }
  }

  private render(): void {
    const editing = this.users.find(user => user.id === this.editingId);
    const rows = this.users.map(user => `
      <li class="wf-template-row" data-user-id="${escapeHtml(user.id)}">
        <div class="wf-template-row__main">
          <span class="wf-template-row__name">${escapeHtml(user.username)}</span>
          <span class="wf-template-badge">${user.roles.map(role => escapeHtml(role)).join(' · ')}</span>
          ${user.active ? '' : `<span class="wf-template-badge">${escapeHtml(t('active'))}: ✕</span>`}
        </div>
        <div class="wf-template-row__actions">
          <button class="wf-btn wf-btn--sm" data-user-edit="${escapeHtml(user.id)}">${escapeHtml(t('edit'))}</button>
          <button class="wf-btn wf-btn--sm wf-btn--danger" data-user-delete="${escapeHtml(user.id)}">${escapeHtml(t('deleteUser'))}</button>
        </div>
      </li>`).join('');
    this.host.innerHTML = `
      <div class="wf-modal-overlay" data-role="user-manager-overlay">
        <div class="wf-modal" role="dialog" aria-modal="true" aria-labelledby="user-manager-title">
          <div class="wf-modal__header"><h3 class="wf-modal__title" id="user-manager-title">${escapeHtml(t('userManager'))}</h3></div>
          <div class="wf-modal__body">
            <ul class="wf-template-list">${rows}</ul>
            <hr class="wf-template-separator" />
            <h4 class="wf-template-form-title">${escapeHtml(editing ? t('edit') : t('createUser'))}</h4>
            <div class="wf-form-grid">
              <div class="wf-form-field">
                <label class="wf-label" for="user-username">${escapeHtml(t('username'))}</label>
                <input class="wf-field wf-field--block" id="user-username" type="text" value="${escapeHtml(editing?.username ?? '')}" ${editing ? 'disabled' : ''} />
              </div>
              <div class="wf-form-field">
                <label class="wf-label" for="user-password">${escapeHtml(t('password'))}</label>
                <input class="wf-field wf-field--block" id="user-password" type="password" placeholder="${editing ? '••••••••' : ''}" />
              </div>
              <div class="wf-form-field wf-form-field--full">
                <span class="wf-label">${escapeHtml(t('roles'))}</span>
                ${ROLES.map(role => `<label class="wf-menu__item"><input type="checkbox" data-user-role="${role}" ${editing?.roles.includes(role) ? 'checked' : (!editing && role === 'Reader' ? 'checked' : '')} /> ${escapeHtml(role)}</label>`).join('')}
              </div>
              <div class="wf-form-field wf-form-field--full">
                <label class="wf-menu__item"><input type="checkbox" id="user-active" ${editing?.active === false ? '' : 'checked'} /> ${escapeHtml(t('active'))}</label>
              </div>
            </div>
            <div class="wf-modal__error" id="user-error" role="alert">${escapeHtml(this.status)}</div>
          </div>
          <div class="wf-modal__footer">
            <button class="wf-btn" id="user-close">${escapeHtml(t('close'))}</button>
            <button class="wf-btn wf-btn--primary" id="user-save">${escapeHtml(editing ? t('saveUser') : t('createUser'))}</button>
          </div>
        </div>
      </div>`;
    this.bindEvents();
  }

  private bindEvents(): void {
    this.host.querySelector('#user-close')?.addEventListener('click', () => this.close());
    this.host.querySelector('#user-save')?.addEventListener('click', () => void this.save());
    this.host.querySelectorAll<HTMLElement>('[data-user-edit]').forEach(button => {
      button.addEventListener('click', () => {
        this.editingId = button.dataset.userEdit;
        this.status = '';
        this.render();
      });
    });
    this.host.querySelectorAll<HTMLElement>('[data-user-delete]').forEach(button => {
      button.addEventListener('click', () => void this.remove(button.dataset.userDelete));
    });
    this.host.querySelector('[data-role="user-manager-overlay"]')?.addEventListener('click', event => {
      if ((event.target as HTMLElement) === event.currentTarget) this.close();
    });
  }

  private selectedRoles(): ManagedUserRole[] {
    return ROLES.filter(role => this.host.querySelector<HTMLInputElement>(`[data-user-role="${role}"]`)?.checked);
  }

  private async save(): Promise<void> {
    const username = this.host.querySelector<HTMLInputElement>('#user-username')?.value ?? '';
    const password = this.host.querySelector<HTMLInputElement>('#user-password')?.value ?? '';
    const active = this.host.querySelector<HTMLInputElement>('#user-active')?.checked ?? true;
    const roles = this.selectedRoles();
    try {
      const data = this.editingId
        ? await apiBus.dispatch('users.update', {
            params: { id: this.editingId },
            body: { roles, active, ...(password ? { password } : {}) },
          })
        : await apiBus.dispatch('users.create', { body: { username, password, roles, active } });
      if (data.success === false) {
        this.status = (data as { error?: string }).error ?? t('userStoreUnavailable');
        this.render();
        return;
      }
      this.status = t(this.editingId ? 'userUpdated' : 'userCreated');
      this.editingId = undefined;
      await this.load();
      this.render();
    } catch (err) {
      this.status = this.errorMessage(err);
      this.render();
    }
  }

  private async remove(id?: string): Promise<void> {
    if (!id) return;
    const user = this.users.find(item => item.id === id);
    const confirmed = await notifications.confirm({
      title: t('deleteUser'),
      message: t('confirmDeleteItem', { name: user?.username ?? id }),
      danger: true,
    });
    if (!confirmed) return;
    try {
      const data = await apiBus.dispatch('users.delete', { params: { id } });
      if (data.success === false) {
        this.status = (data as { error?: string }).error ?? t('userStoreUnavailable');
      } else {
        this.status = t('userDeleted');
        if (this.editingId === id) this.editingId = undefined;
      }
      await this.load();
      this.render();
    } catch (err) {
      this.status = this.errorMessage(err);
      this.render();
    }
  }

  private errorMessage(err: unknown): string {
    return err instanceof Error ? err.message : t('userStoreUnavailable');
  }
}
