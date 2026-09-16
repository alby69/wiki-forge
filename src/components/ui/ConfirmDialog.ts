export interface ConfirmDialogOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  onConfirm?: () => void | Promise<void>;
  onCancel?: () => void;
}

export class ConfirmDialog {
  private overlay: HTMLElement;
  private previousActiveElement: HTMLElement | null = null;
  private options: ConfirmDialogOptions;

  constructor(options: ConfirmDialogOptions) {
    this.options = {
      title: options.title || 'Confirm Action',
      message: options.message,
      confirmText: options.confirmText || 'Confirm',
      cancelText: options.cancelText || 'Cancel',
      variant: options.variant || 'danger',
      onConfirm: options.onConfirm,
      onCancel: options.onCancel,
    };

    if (typeof document !== 'undefined') {
      this.previousActiveElement = document.activeElement as HTMLElement;
    }

    this.overlay = this.render();
  }

  private render(): HTMLElement {
    const overlay = document.createElement('div');
    overlay.className = 'confirm-dialog-overlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.65)';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.zIndex = '10000';
    overlay.style.backdropFilter = 'blur(3px)';

    const dialog = document.createElement('div');
    dialog.className = 'confirm-dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'confirm-dialog-title');
    dialog.setAttribute('aria-describedby', 'confirm-dialog-message');
    dialog.style.background = '#1a1b1e';
    dialog.style.border = '1px solid #2d3748';
    dialog.style.borderRadius = '8px';
    dialog.style.padding = '20px';
    dialog.style.width = '90%';
    dialog.style.maxWidth = '420px';
    dialog.style.boxShadow = '0 10px 25px rgba(0, 0, 0, 0.5)';
    dialog.style.color = '#e2e8f0';

    const isDanger = this.options.variant === 'danger';
    const btnBg = isDanger ? '#e53e3e' : '#3182ce';

    dialog.innerHTML = `
      <h3 id="confirm-dialog-title" style="margin-top: 0; margin-bottom: 12px; font-size: 16px; font-weight: 700; color: ${isDanger ? '#fc8181' : '#64b5f6'}; display: flex; align-items: center; gap: 8px;">
        <span>${isDanger ? '⚠️' : 'ℹ️'}</span> ${this.options.title}
      </h3>
      <p id="confirm-dialog-message" style="margin-bottom: 20px; font-size: 13px; color: #a0aec0; line-height: 1.5; white-space: pre-wrap;">${this.options.message}</p>
      <div style="display: flex; justify-content: flex-end; gap: 10px;">
        <button id="confirm-dialog-cancel" aria-label="${this.options.cancelText}" style="background: #2d3748; color: #e2e8f0; border: none; padding: 8px 16px; border-radius: 4px; font-size: 13px; font-weight: 600; cursor: pointer;">${this.options.cancelText}</button>
        <button id="confirm-dialog-confirm" aria-label="${this.options.confirmText}" style="background: ${btnBg}; color: #ffffff; border: none; padding: 8px 16px; border-radius: 4px; font-size: 13px; font-weight: 600; cursor: pointer;">${this.options.confirmText}</button>
      </div>
    `;

    overlay.appendChild(dialog);
    this.bindEvents(overlay, dialog);

    return overlay;
  }

  private bindEvents(overlay: HTMLElement, dialog: HTMLElement): void {
    const confirmBtn = dialog.querySelector('#confirm-dialog-confirm') as HTMLButtonElement;
    const cancelBtn = dialog.querySelector('#confirm-dialog-cancel') as HTMLButtonElement;

    const close = () => {
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
      if (this.previousActiveElement && typeof this.previousActiveElement.focus === 'function') {
        this.previousActiveElement.focus();
      }
    };

    confirmBtn?.addEventListener('click', async () => {
      close();
      if (this.options.onConfirm) {
        await this.options.onConfirm();
      }
    });

    cancelBtn?.addEventListener('click', () => {
      close();
      if (this.options.onCancel) {
        this.options.onCancel();
      }
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        close();
        if (this.options.onCancel) this.options.onCancel();
      }
    });

    const focusableElements = dialog.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];

    setTimeout(() => {
      if (cancelBtn) cancelBtn.focus();
    }, 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        document.removeEventListener('keydown', handleKeyDown);
        close();
        if (this.options.onCancel) this.options.onCancel();
        return;
      }

      if (e.key === 'Tab') {
        if (e.shiftKey) {
          if (document.activeElement === firstFocusable) {
            e.preventDefault();
            lastFocusable?.focus();
          }
        } else {
          if (document.activeElement === lastFocusable) {
            e.preventDefault();
            firstFocusable?.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
  }

  public show(): void {
    if (typeof document !== 'undefined') {
      document.body.appendChild(this.overlay);
    }
  }

  public static confirm(options: ConfirmDialogOptions): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      const dialog = new ConfirmDialog({
        ...options,
        onConfirm: async () => {
          if (options.onConfirm) await options.onConfirm();
          resolve(true);
        },
        onCancel: () => {
          if (options.onCancel) options.onCancel();
          resolve(false);
        },
      });
      dialog.show();
    });
  }
}

export const confirmAction = (options: ConfirmDialogOptions): Promise<boolean> => {
  return ConfirmDialog.confirm(options);
};
