export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface ToastOptions {
  message: string;
  variant?: ToastVariant;
  duration?: number; // duration in ms, default 4000
  closable?: boolean;
}

export class ToastManager {
  private static container: HTMLElement | null = null;

  private static ensureContainer(): HTMLElement {
    if (this.container && document.body.contains(this.container)) {
      return this.container;
    }

    const existing = document.getElementById('toast-container');
    if (existing) {
      this.container = existing;
      return existing;
    }

    const container = document.createElement('div');
    container.id = 'toast-container';
    container.setAttribute('aria-live', 'polite');
    container.setAttribute('aria-atomic', 'true');
    container.style.position = 'fixed';
    container.style.bottom = '20px';
    container.style.right = '20px';
    container.style.zIndex = '10000';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '8px';
    container.style.maxWidth = '360px';
    container.style.pointerEvents = 'none';

    document.body.appendChild(container);
    this.container = container;
    return container;
  }

  public static show(options: ToastOptions): HTMLElement {
    const { message, variant = 'info', duration = 4000, closable = true } = options;
    const container = this.ensureContainer();

    const toast = document.createElement('div');
    toast.className = `toast toast-${variant}`;
    toast.setAttribute('role', variant === 'error' ? 'alert' : 'status');
    toast.style.pointerEvents = 'auto';
    toast.style.padding = '10px 14px';
    toast.style.borderRadius = '6px';
    toast.style.fontSize = '13px';
    toast.style.fontWeight = '500';
    toast.style.display = 'flex';
    toast.style.alignItems = 'center';
    toast.style.justifyContent = 'space-between';
    toast.style.gap = '10px';
    toast.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.4)';
    toast.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';

    // Variant colors
    if (variant === 'success') {
      toast.style.background = '#1a365d';
      toast.style.color = '#90cdf4';
      toast.style.borderLeft = '4px solid #3182ce';
    } else if (variant === 'error') {
      toast.style.background = '#742a2a';
      toast.style.color = '#feb2b2';
      toast.style.borderLeft = '4px solid #fc8181';
    } else if (variant === 'warning') {
      toast.style.background = '#744210';
      toast.style.color = '#fbd38d';
      toast.style.borderLeft = '4px solid #dd6b20';
    } else {
      // info
      toast.style.background = '#2d3748';
      toast.style.color = '#e2e8f0';
      toast.style.borderLeft = '4px solid #64b5f6';
    }

    const messageSpan = document.createElement('span');
    messageSpan.textContent = message;
    messageSpan.style.flex = '1';
    toast.appendChild(messageSpan);

    const closeToast = () => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 250);
    };

    if (closable) {
      const closeBtn = document.createElement('button');
      closeBtn.innerHTML = '&times;';
      closeBtn.setAttribute('aria-label', 'Close notification');
      closeBtn.style.background = 'none';
      closeBtn.style.border = 'none';
      closeBtn.style.color = 'inherit';
      closeBtn.style.fontSize = '16px';
      closeBtn.style.cursor = 'pointer';
      closeBtn.style.padding = '0 4px';
      closeBtn.style.lineHeight = '1';
      closeBtn.addEventListener('click', closeToast);
      toast.appendChild(closeBtn);
    }

    container.appendChild(toast);

    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateY(0)';
    });

    if (duration > 0) {
      setTimeout(closeToast, duration);
    }

    return toast;
  }
}

export const showToast = (options: ToastOptions | string, variant: ToastVariant = 'info') => {
  if (typeof options === 'string') {
    return ToastManager.show({ message: options, variant });
  }
  return ToastManager.show(options);
};

export const useToast = () => ({
  show: showToast,
  success: (msg: string, duration?: number) => showToast({ message: msg, variant: 'success', duration }),
  error: (msg: string, duration?: number) => showToast({ message: msg, variant: 'error', duration }),
  warning: (msg: string, duration?: number) => showToast({ message: msg, variant: 'warning', duration }),
  info: (msg: string, duration?: number) => showToast({ message: msg, variant: 'info', duration }),
});
