import { resolveApiBaseUrl } from '../../storage/ApiStorage';

export interface ChangesetData {
  id: string;
  timestamp: string;
  author: string;
  status: 'pending' | 'applied' | 'rejected';
  description: string;
  edits: Array<{
    file: string;
    action: 'create' | 'modify' | 'delete';
    original_content?: string;
    proposed_content?: string;
  }>;
}

export class ChangesetReviewModal {
  private overlay: HTMLElement;
  private apiBaseUrl: string = resolveApiBaseUrl();
  private changesets: ChangesetData[] = [];
  private selectedChangeset: ChangesetData | null = null;
  private onAppliedCb?: () => void;

  constructor(onApplied?: () => void) {
    this.onAppliedCb = onApplied;
    this.overlay = document.createElement('div');
    this.overlay.id = 'changeset-review-modal-root';
    this.overlay.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
      background: rgba(0,0,0,0.85); display: none; align-items: center; justify-content: center;
      z-index: 2070; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    `;

    this.renderBase();
    document.body.appendChild(this.overlay);
  }

  private renderBase(): void {
    this.overlay.innerHTML = `
      <div style="background: #0f172a; border: 1px solid #334155; border-radius: 12px; width: 90vw; max-width: 1100px; height: 85vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.8);">
        <!-- Header -->
        <div style="height: 52px; background: #020617; border-bottom: 1px solid #1e293b; display: flex; align-items: center; justify-content: space-between; padding: 0 20px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 20px;">📋</span>
            <span style="font-weight: 700; font-size: 16px; color: #f8fafc;">Changeset Review Queue</span>
            <span style="font-size: 11px; background: #1e1b4b; color: #c7d2fe; padding: 2px 8px; border-radius: 4px; font-weight: 600;">Plan-Review-Apply Safety</span>
          </div>
          <button id="cs-modal-close" style="background: none; border: none; color: #94a3b8; font-size: 20px; cursor: pointer;">✕</button>
        </div>

        <!-- Body -->
        <div style="flex: 1; display: flex; overflow: hidden;">
          <!-- Left list -->
          <div style="width: 320px; background: #020617; border-right: 1px solid #1e293b; display: flex; flex-direction: column; padding: 12px; gap: 8px; overflow-y: auto;">
            <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px;">Pending Changesets</div>
            <div id="cs-list-container" style="display: flex; flex-direction: column; gap: 8px;"></div>
          </div>

          <!-- Right Diff Details -->
          <div id="cs-details-container" style="flex: 1; padding: 20px; overflow-y: auto; background: #0f172a; display: flex; flex-direction: column; gap: 16px;">
            <div style="color: #64748b; font-style: italic;">Select a changeset from the left queue to inspect diffs and approve changes.</div>
          </div>
        </div>
      </div>
    `;

    const closeBtn = this.overlay.querySelector('#cs-modal-close');
    closeBtn?.addEventListener('click', () => this.close());
  }

  public async open(): Promise<void> {
    this.overlay.style.display = 'flex';
    await this.fetchChangesets();
    this.renderList();
    if (this.changesets.length > 0) {
      this.selectChangeset(this.changesets[0]);
    }
  }

  public close(): void {
    this.overlay.style.display = 'none';
  }

  private async fetchChangesets(): Promise<void> {
    try {
      const res = await fetch(`${this.apiBaseUrl}/api/v1/changesets?status=pending`);
      if (res.ok) {
        const data = await res.json();
        this.changesets = data.changesets || [];
      }
    } catch (_e) {
      // Ignore
    }
  }

  private renderList(): void {
    const listEl = this.overlay.querySelector('#cs-list-container');
    if (!listEl) return;

    if (this.changesets.length === 0) {
      listEl.innerHTML = `<div style="font-size: 12px; color: #64748b;">No pending changesets in queue.</div>`;
      return;
    }

    listEl.innerHTML = this.changesets
      .map(
        cs => `
      <div class="cs-item" data-id="${cs.id}" style="
        background: ${this.selectedChangeset?.id === cs.id ? '#1e293b' : '#020617'};
        border: 1px solid ${this.selectedChangeset?.id === cs.id ? '#6366f1' : '#1e293b'};
        padding: 10px 12px; border-radius: 6px; cursor: pointer; display: flex; flex-direction: column; gap: 4px;
      ">
        <div style="font-weight: 700; font-size: 13px; color: #f8fafc;">${cs.description || cs.id}</div>
        <div style="font-size: 11px; color: #94a3b8;">${cs.edits.length} edit(s) • ${cs.author}</div>
        <div style="font-size: 10px; color: #64748b;">${cs.timestamp}</div>
      </div>
    `
      )
      .join('');

    const items = listEl.querySelectorAll('.cs-item');
    items.forEach(item => {
      item.addEventListener('click', () => {
        const id = item.getAttribute('data-id');
        const found = this.changesets.find(c => c.id === id);
        if (found) {
          this.selectChangeset(found);
          this.renderList();
        }
      });
    });
  }

  private selectChangeset(cs: ChangesetData): void {
    this.selectedChangeset = cs;
    const detailsEl = this.overlay.querySelector('#cs-details-container');
    if (!detailsEl) return;

    const editsHtml = cs.edits
      .map(
        e => `
      <div style="background: #020617; border: 1px solid #1e293b; border-radius: 6px; padding: 12px; display: flex; flex-direction: column; gap: 8px;">
        <div style="font-weight: 700; font-size: 13px; color: #818cf8;">${e.action.toUpperCase()}: ${e.file}</div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-family: monospace; font-size: 11px;">
          <div style="background: #1e1b4b; border: 1px solid #312e81; padding: 8px; border-radius: 4px; color: #fca5a5; max-height: 200px; overflow-y: auto; white-space: pre-wrap;">
            <strong>Original Content:</strong>\n${e.original_content || '(empty)'}
          </div>
          <div style="background: #064e3b; border: 1px solid #065f46; padding: 8px; border-radius: 4px; color: #6ee7b7; max-height: 200px; overflow-y: auto; white-space: pre-wrap;">
            <strong>Proposed Content:</strong>\n${e.proposed_content || '(empty)'}
          </div>
        </div>
      </div>
    `
      )
      .join('');

    detailsEl.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #1e293b; padding-bottom: 12px;">
        <div>
          <h3 style="margin: 0; font-size: 16px; color: #f8fafc;">${cs.description}</h3>
          <div style="font-size: 12px; color: #94a3b8; margin-top: 4px;">ID: ${cs.id} • Proposed by ${cs.author} at ${cs.timestamp}</div>
        </div>
        <div style="display: flex; gap: 10px;">
          <button id="cs-approve-btn" style="background: #059669; color: #ffffff; border: none; padding: 8px 16px; border-radius: 6px; font-weight: 700; font-size: 13px; cursor: pointer;">
            ✓ Accept & Apply
          </button>
          <button id="cs-reject-btn" style="background: #dc2626; color: #ffffff; border: none; padding: 8px 16px; border-radius: 6px; font-weight: 700; font-size: 13px; cursor: pointer;">
            ✕ Reject
          </button>
        </div>
      </div>

      <div style="display: flex; flex-direction: column; gap: 12px;">
        ${editsHtml}
      </div>
    `;

    const approveBtn = detailsEl.querySelector('#cs-approve-btn');
    approveBtn?.addEventListener('click', () => this.applyChangeset(cs.id));

    const rejectBtn = detailsEl.querySelector('#cs-reject-btn');
    rejectBtn?.addEventListener('click', () => this.rejectChangeset(cs.id));
  }

  private async applyChangeset(csId: string): Promise<void> {
    try {
      const res = await fetch(`${this.apiBaseUrl}/api/v1/changesets/${csId}/apply`, { method: 'POST' });
      if (res.ok) {
        alert('Changeset applied successfully!');
        if (this.onAppliedCb) this.onAppliedCb();
        await this.open();
      }
    } catch (err: any) {
      alert(`Error applying changeset: ${err.message}`);
    }
  }

  private async rejectChangeset(csId: string): Promise<void> {
    try {
      const res = await fetch(`${this.apiBaseUrl}/api/v1/changesets/${csId}/reject`, { method: 'POST' });
      if (res.ok) {
        alert('Changeset rejected.');
        await this.open();
      }
    } catch (err: any) {
      alert(`Error rejecting changeset: ${err.message}`);
    }
  }
}
