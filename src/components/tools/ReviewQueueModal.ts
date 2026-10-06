import { resolveApiBaseUrl } from '../../storage/ApiStorage';

export interface ReviewItem {
  id: string;
  title: string;
  sourceFile: string;
  recommendedAction: 'Create Page' | 'Deep Research' | 'Skip';
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'modified';
  createdAt: string;
}

export class ReviewQueueModal {
  private container: HTMLElement | null = null;
  private isOpen = false;

  public open(): void {
    this.isOpen = true;
    this.render();
    this.fetchReviews();
  }

  public close(): void {
    this.isOpen = false;
    if (this.container) {
      this.container.style.display = 'none';
    }
  }

  private render(): void {
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.id = 'wf-review-modal-overlay';
      this.container.className = 'wf-modal-overlay';
      this.container.style.cssText = `
        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(15, 23, 42, 0.75); backdrop-filter: blur(4px);
        z-index: 1000; display: flex; align-items: center; justify-content: center;
      `;
      document.body.appendChild(this.container);
    }

    this.container.style.display = 'flex';
    this.container.innerHTML = `
      <div style="background: #0f172a; border: 1px solid #334155; border-radius: 12px; width: 680px; max-width: 90vw; max-height: 85vh; display: flex; flex-direction: column; overflow: hidden; color: #f8fafc; font-family: sans-serif;">
        <div style="padding: 16px 20px; border-bottom: 1px solid #334155; display: flex; justify-content: space-between; align-items: center;">
          <h3 style="margin: 0; font-size: 16px; color: #38bdf8;">📥 Human-in-the-Loop Review Queue</h3>
          <button id="close-review-modal" style="background: none; border: none; color: #94a3b8; font-size: 20px; cursor: pointer;">&times;</button>
        </div>
        <div id="review-items-container" style="padding: 20px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 12px;">
          <div style="color: #94a3b8; font-size: 13px;">Loading review queue items...</div>
        </div>
      </div>
    `;

    this.container.querySelector('#close-review-modal')?.addEventListener('click', () => this.close());
  }

  private async fetchReviews(): Promise<void> {
    const listEl = this.container?.querySelector('#review-items-container');
    if (!listEl) return;

    try {
      const baseUrl = resolveApiBaseUrl();
      const res = await fetch(`${baseUrl}/api/reviews`);
      const data = await res.json();

      const items: ReviewItem[] = data.reviews || [];
      if (items.length === 0) {
        listEl.innerHTML = `<div style="color: #94a3b8; font-size: 13px; text-align: center; padding: 32px 0;">🎉 No pending review items in queue!</div>`;
        return;
      }

      listEl.innerHTML = items.map(item => `
        <div style="background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 14px; display: flex; flex-direction: column; gap: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <strong style="color: #f8fafc; font-size: 14px;">${item.title}</strong>
            <span style="background: #0284c7; color: #fff; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;">${item.recommendedAction}</span>
          </div>
          <div style="font-size: 12px; color: #94a3b8;">Source: <code>${item.sourceFile}</code> · Date: ${item.createdAt}</div>
          <div style="font-size: 13px; color: #cbd5e1; background: #0f172a; padding: 8px; border-radius: 4px;">${item.reason}</div>
          <div style="display: flex; gap: 8px; margin-top: 4px; justify-content: flex-end;">
            <button data-id="${item.id}" data-action="approve" style="background: #10b981; color: white; border: none; padding: 6px 12px; border-radius: 4px; font-weight: 600; cursor: pointer; font-size: 12px;">Approve</button>
            <button data-id="${item.id}" data-action="reject" style="background: #ef4444; color: white; border: none; padding: 6px 12px; border-radius: 4px; font-weight: 600; cursor: pointer; font-size: 12px;">Reject</button>
          </div>
        </div>
      `).join('');

      listEl.querySelectorAll('button[data-action]').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const target = e.target as HTMLElement;
          const id = target.getAttribute('data-id');
          const action = target.getAttribute('data-action');
          if (id && action) {
            await fetch(`${baseUrl}/api/reviews/action`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id, action })
            });
            this.fetchReviews();
          }
        });
      });
    } catch (err) {
      listEl.innerHTML = `<div style="color: #ef4444; font-size: 13px;">Failed to fetch review items: ${String(err)}</div>`;
    }
  }
}
