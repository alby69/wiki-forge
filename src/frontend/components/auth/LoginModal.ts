import { escapeHtml } from '@frontend/core/utils/html';
import { t } from '@frontend/core/i18n/strings';
import { signInWithCredentials } from '@frontend/core/auth';
import type { AuthIdentityDto } from '@shared/api/types';

export interface LoginModalOptions {
  container?: HTMLElement;
  onAuthenticated?: (identity: AuthIdentityDto) => void;
}

export class LoginModal {
  private host: HTMLElement;
  private ownsHost: boolean;
  private onAuthenticated?: (identity: AuthIdentityDto) => void;
  private openFlag = false;
  private busy = false;
  private error = '';
  private username = '';

  constructor(options: LoginModalOptions = {}) {
    if (options.container) {
      this.host = options.container;
      this.ownsHost = false;
    } else {
      this.host = typeof document === 'undefined'
        ? ({ innerHTML: '', hidden: true } as unknown as HTMLElement)
        : document.createElement('div');
      this.ownsHost = true;
    }
    this.onAuthenticated = options.onAuthenticated;
  }

  public get isOpen(): boolean {
    return this.openFlag;
  }

  public open(): void {
    if (!this.host.querySelector) return;
    this.openFlag = true;
    this.error = '';
    if (this.ownsHost && typeof document !== 'undefined') document.body.appendChild(this.host);
    this.host.hidden = false;
    this.render();
    this.host.querySelector<HTMLInputElement>('[data-role="login-username"]')?.focus();
  }

  public close(): void {
    this.openFlag = false;
    this.busy = false;
    this.error = '';
    this.host.innerHTML = '';
    this.host.hidden = true;
    if (this.ownsHost && typeof document !== 'undefined') this.host.remove?.();
  }

  private render(): void {
    const submitLabel = this.busy ? t('loginInProgress') : t('loginButton');
    this.host.innerHTML = `
      <div class="wf-modal-overlay" data-role="login-overlay">
        <div class="wf-modal wf-modal--compact" role="dialog" aria-modal="true" aria-labelledby="login-title">
          <div class="wf-modal__header"><h3 class="wf-modal__title" id="login-title">${escapeHtml(t('loginTitle'))}</h3></div>
          <div class="wf-modal__body">
            <p class="wf-modal__hint">${escapeHtml(t('loginHint'))}</p>
            ${this.error ? `<p class="wf-modal__error" data-role="login-error">${escapeHtml(this.error)}</p>` : ''}
            <form data-role="login-form" class="wf-form-grid">
              <label class="wf-field">
                <span>${escapeHtml(t('username'))}</span>
                <input data-role="login-username" name="username" autocomplete="username" value="${escapeHtml(this.username)}" required />
              </label>
              <label class="wf-field">
                <span>${escapeHtml(t('password'))}</span>
                <input data-role="login-password" name="password" type="password" autocomplete="current-password" required />
              </label>
              <button class="wf-btn wf-btn--primary" type="submit" data-role="login-submit" ${this.busy ? 'disabled' : ''}>${escapeHtml(submitLabel)}</button>
            </form>
          </div>
        </div>
      </div>`;
    this.host.querySelector('[data-role="login-form"]')?.addEventListener('submit', event => {
      event.preventDefault();
      void this.submit();
    });
  }

  private async submit(): Promise<void> {
    if (this.busy) return;
    const username = this.host.querySelector<HTMLInputElement>('[data-role="login-username"]')?.value ?? '';
    const password = this.host.querySelector<HTMLInputElement>('[data-role="login-password"]')?.value ?? '';
    this.username = username;
    this.busy = true;
    this.error = '';
    this.render();
    try {
      const identity = await signInWithCredentials(username, password);
      this.close();
      this.onAuthenticated?.(identity);
    } catch (err) {
      this.busy = false;
      this.error = err instanceof Error ? err.message : String(err);
      this.render();
      this.host.querySelector<HTMLInputElement>('[data-role="login-password"]')?.focus();
    }
  }
}
