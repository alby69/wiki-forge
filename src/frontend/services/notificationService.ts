import { t, type TranslationKey } from '@frontend/core/i18n/strings';

export type NotificationVariant = 'info' | 'success' | 'warning' | 'error';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

export interface PromptOptions {
  title: string;
  label: string;
  defaultValue?: string;
  placeholder?: string;
}

/**
 * Replaces native alert/confirm/prompt with accessible, styled dialogs.
 * Toast messages use an aria-live region so screen readers announce them.
 */
class NotificationService {
  private stack: HTMLElement | null = null;

  private getStack(): HTMLElement | null {
    if (typeof document === 'undefined') return null;
    if (this.stack?.isConnected) return this.stack;
    const stack = document.createElement('div');
    stack.className = 'wf-toast-stack';
    stack.setAttribute('role', 'status');
    stack.setAttribute('aria-live', 'polite');
    stack.setAttribute('aria-atomic', 'false');
    document.body.appendChild(stack);
    this.stack = stack;
    return stack;
  }

  public show(message: string, variant: NotificationVariant = 'info', duration = 4000): void {
    const stack = this.getStack();
    if (!stack) return;
    const toast = document.createElement('div');
    toast.className = `wf-toast wf-toast--${variant}`;
    toast.textContent = message;
    stack.appendChild(toast);
    if (duration > 0) {
      window.setTimeout(() => toast.remove(), duration);
    }
  }

  public info(message: string): void { this.show(message, 'info'); }
  public success(message: string): void { this.show(message, 'success'); }
  public warning(message: string): void { this.show(message, 'warning'); }
  public error(message: string): void { this.show(message, 'error', 7000); }

  public translated(key: TranslationKey, variant: NotificationVariant = 'info', vars: Record<string, string | number> = {}): void {
    this.show(t(key, vars), variant);
  }

  public confirm(options: ConfirmOptions): Promise<boolean> {
    return new Promise(resolve => {
      if (typeof document === 'undefined') {
        resolve(false);
        return;
      }
      const overlay = document.createElement('div');
      overlay.className = 'wf-modal-overlay';
      overlay.innerHTML = `
        <div class="wf-modal wf-modal--compact" role="dialog" aria-modal="true" aria-labelledby="wf-confirm-title">
          <div class="wf-modal__header"><h3 class="wf-modal__title" id="wf-confirm-title"></h3></div>
          <div class="wf-modal__body"><p id="wf-confirm-message" style="white-space: pre-line; margin: 0; font-size: 13px; color: var(--wf-text-muted);"></p></div>
          <div class="wf-modal__footer">
            <button class="wf-btn" data-action="cancel"></button>
            <button class="wf-btn wf-btn--primary" data-action="confirm"></button>
          </div>
        </div>`;
      overlay.querySelector('#wf-confirm-title')!.textContent = options.title;
      overlay.querySelector('#wf-confirm-message')!.textContent = options.message;
      const cancelBtn = overlay.querySelector<HTMLButtonElement>('[data-action="cancel"]')!;
      const confirmBtn = overlay.querySelector<HTMLButtonElement>('[data-action="confirm"]')!;
      cancelBtn.textContent = options.cancelLabel ?? t('cancel');
      confirmBtn.textContent = options.confirmLabel ?? t('confirm');
      if (options.danger) confirmBtn.className = 'wf-btn wf-btn--danger';

      const finish = (result: boolean): void => {
        overlay.remove();
        resolve(result);
      };
      cancelBtn.addEventListener('click', () => finish(false));
      confirmBtn.addEventListener('click', () => finish(true));
      overlay.addEventListener('click', event => {
        if (event.target === overlay) finish(false);
      });
      overlay.addEventListener('keydown', event => {
        if (event.key === 'Escape') finish(false);
        else if (event.key === 'Enter' && !(event.target as HTMLElement).matches('textarea')) finish(true);
        else if (event.key === 'Tab') {
          const buttons = [cancelBtn, confirmBtn];
          const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
          event.preventDefault();
          buttons[(index + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length].focus();
        }
      });
      document.body.appendChild(overlay);
      confirmBtn.focus();
    });
  }

  public prompt(options: PromptOptions): Promise<string | null> {
    return new Promise(resolve => {
      if (typeof document === 'undefined') {
        resolve(null);
        return;
      }
      const overlay = document.createElement('div');
      overlay.className = 'wf-modal-overlay';
      overlay.innerHTML = `
        <div class="wf-modal wf-modal--compact" role="dialog" aria-modal="true" aria-labelledby="wf-prompt-title">
          <div class="wf-modal__header"><h3 class="wf-modal__title" id="wf-prompt-title"></h3></div>
          <div class="wf-modal__body">
            <div class="wf-form-field">
              <label class="wf-label" for="wf-prompt-input"></label>
              <input class="wf-field wf-field--block" id="wf-prompt-input" type="text" />
            </div>
          </div>
          <div class="wf-modal__footer">
            <button class="wf-btn" data-action="cancel"></button>
            <button class="wf-btn wf-btn--primary" data-action="confirm"></button>
          </div>
        </div>`;
      overlay.querySelector('#wf-prompt-title')!.textContent = options.title;
      overlay.querySelector('label')!.textContent = options.label;
      const input = overlay.querySelector<HTMLInputElement>('#wf-prompt-input')!;
      input.value = options.defaultValue ?? '';
      input.placeholder = options.placeholder ?? '';
      const cancelBtn = overlay.querySelector<HTMLButtonElement>('[data-action="cancel"]')!;
      const confirmBtn = overlay.querySelector<HTMLButtonElement>('[data-action="confirm"]')!;
      cancelBtn.textContent = t('cancel');
      confirmBtn.textContent = t('confirm');

      const finish = (result: string | null): void => {
        overlay.remove();
        resolve(result);
      };
      cancelBtn.addEventListener('click', () => finish(null));
      confirmBtn.addEventListener('click', () => finish(input.value.trim() || null));
      input.addEventListener('keydown', event => {
        if (event.key === 'Enter') finish(input.value.trim() || null);
        else if (event.key === 'Escape') finish(null);
      });
      overlay.addEventListener('click', event => {
        if (event.target === overlay) finish(null);
      });
      document.body.appendChild(overlay);
      input.focus();
      input.select();
    });
  }
}

export const notifications = new NotificationService();
