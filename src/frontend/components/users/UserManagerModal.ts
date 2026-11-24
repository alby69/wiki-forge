import { escapeHtml } from '@frontend/core/utils/html';
import { t, type TranslationKey } from '@frontend/core/i18n/strings';
import { apiBus } from '@frontend/core/apiBus';
import { notifications } from '@frontend/services/notificationService';
import { appStore } from '@frontend/store/appStore';
import { ACTION_MIN_ROLE, ROLE_ORDER, canUseAction } from '@shared/auth/capabilities';
import type { ManagedUserDto, ManagedUserRole } from '@shared/api/types';

const ROLES: readonly ManagedUserRole[] = ROLE_ORDER;

const ROLE_DESCRIPTIONS: Record<ManagedUserRole, TranslationKey> = {
  Reader: 'roleReaderDescription',
  Contributor: 'roleContributorDescription',
  KnowledgeEngineer: 'roleKnowledgeEngineerDescription',
  Admin: 'roleAdminDescription',
};

/** Capability preview derived from the shared action/role matrix. */
const CAPABILITY_PREVIEW: ReadonlyArray<{ labelKey: TranslationKey; actionId: string }> = [
  { labelKey: 'capabilityBrowse', actionId: 'global:projects' },
  { labelKey: 'capabilityEdit', actionId: 'global:template' },
  { labelKey: 'capabilityChat', actionId: 'global:chat' },
  { labelKey: 'capabilityReview', actionId: 'review:verify' },
  { labelKey: 'capabilityKeWorkbench', actionId: 'global:keWorkbench' },
  { labelKey: 'capabilityUsers', actionId: 'global:users' },
  { labelKey: 'capabilityCustomize', actionId: 'global:customize' },
];

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

  /** Local accounts carry the managed username as `human:<username>`. */
  private selfUsername(): string | undefined {
    const identity = appStore.getState().auth.identity;
    if (!identity || identity.source !== 'local' || !identity.authenticated) return undefined;
    const match = /^human:(.+)$/.exec(identity.actor);
    return match?.[1] || undefined;
  }

  private isSelf(user: ManagedUserDto, username = this.selfUsername()): boolean {
    return !!username && user.username === username;
  }

  private renderRoleGuide(): string {
    const cards = ROLES.map(role => {
      const capabilities = CAPABILITY_PREVIEW.map(item => ({
        label: t(item.labelKey),
        allowed: canUseAction([role], item.actionId),
      }));
      const count = Object.keys(ACTION_MIN_ROLE).filter(id => canUseAction([role], id)).length;
      return `
        <article class="wf-role-card">
          <header class="wf-role-card__header">
            <strong>${escapeHtml(role)}</strong>
            <span class="wf-template-badge">${escapeHtml(t('capabilityCount', { count }))}</span>
          </header>
          <p class="wf-role-card__desc">${escapeHtml(t(ROLE_DESCRIPTIONS[role]))}</p>
          <ul class="wf-role-card__caps">
            ${capabilities.map(cap => `
              <li class="${cap.allowed ? 'is-allowed' : ''}" title="${escapeHtml(cap.allowed ? t('capabilityAllowed') : t('capabilityDenied'))}">
                <span aria-hidden="true">${cap.allowed ? '✓' : '✕'}</span> ${escapeHtml(cap.label)}
              </li>`).join('')}
          </ul>
        </article>`;
    }).join('');
    return `
      <section class="wf-role-guide" aria-label="${escapeHtml(t('roleGuideTitle'))}">
        <h4 class="wf-template-form-title">${escapeHtml(t('roleGuideTitle'))}</h4>
        <p class="wf-template-hint">${escapeHtml(t('roleGuideHint'))}</p>
        <div class="wf-role-guide__grid">${cards}</div>
      </section>`;
  }

  private render(): void {
    const username = this.selfUsername();
    if (this.editingId) {
      const target = this.users.find(user => user.id === this.editingId);
      if (target && this.isSelf(target, username)) this.editingId = undefined;
    }
    const editing = this.users.find(user => user.id === this.editingId);
    const rows = this.users.map(user => {
      const self = this.isSelf(user, username);
      const blockedAttrs = self
        ? ` disabled aria-disabled="true" title="${escapeHtml(t('selfAccountNotice'))}"`
        : '';
      return `
        <li class="wf-template-row" data-user-id="${escapeHtml(user.id)}"${self ? ' data-self="true"' : ''}>
          <div class="wf-template-row__main">
            <span class="wf-template-row__name">${escapeHtml(user.username)}</span>
            ${self ? `<span class="wf-template-badge wf-template-badge--self">${escapeHtml(t('selfAccountBadge'))}</span>` : ''}
            <span class="wf-template-badge">${user.roles.map(role => escapeHtml(role)).join(' · ')}</span>
            ${user.active ? '' : `<span class="wf-template-badge">${escapeHtml(t('active'))}: ✕</span>`}
          </div>
          <div class="wf-template-row__actions">
            <button class="wf-btn wf-btn--sm" data-user-edit="${escapeHtml(user.id)}"${blockedAttrs}>${escapeHtml(t('edit'))}</button>
            <button class="wf-btn wf-btn--sm wf-btn--danger" data-user-delete="${escapeHtml(user.id)}"${blockedAttrs}>${escapeHtml(t('deleteUser'))}</button>
          </div>
        </li>`;
    }).join('');
    this.host.innerHTML = `
      <div class="wf-modal-overlay" data-role="user-manager-overlay">
        <div class="wf-modal" role="dialog" aria-modal="true" aria-labelledby="user-manager-title">
          <div class="wf-modal__header"><h3 class="wf-modal__title" id="user-manager-title">${escapeHtml(t('userManager'))}</h3></div>
          <div class="wf-modal__body">
            ${username ? `<p class="wf-role-guide__notice" role="note">${escapeHtml(t('selfAccountNotice'))}</p>` : ''}
            <ul class="wf-template-list">${rows}</ul>
            ${this.renderRoleGuide()}
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
        const user = this.users.find(item => item.id === button.dataset.userEdit);
        if (user && this.isSelf(user)) {
          this.status = t('selfEditBlocked');
          this.render();
          return;
        }
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
    const editingUser = this.editingId ? this.users.find(user => user.id === this.editingId) : undefined;
    if (editingUser && this.isSelf(editingUser)) {
      this.status = t('selfEditBlocked');
      this.render();
      return;
    }
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
    if (user && this.isSelf(user)) {
      this.status = t('selfDeleteBlocked');
      this.render();
      return;
    }
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
