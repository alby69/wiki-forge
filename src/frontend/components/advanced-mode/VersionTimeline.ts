import { WikiNote } from '@frontend/core/types/wiki';
import { ApiStorage } from '@frontend/storage/ApiStorage';
import { setHelpContext, clearHelpContext } from '@frontend/core/helpContext';
import { notifications } from '@frontend/services/notificationService';
import { t } from '@frontend/core/i18n/strings';

export interface NoteVersion {
  version: number;
  timestamp: string;
  author?: string;
  summary?: string;
  content: string;
  snapshotId?: string;
}

export class VersionTimeline {
  private container: HTMLElement;
  private storage: ApiStorage;
  private activeNote: WikiNote | null = null;
  private versions: NoteVersion[] = [];
  private selectedVersion: NoteVersion | null = null;
  private onRollbackCb?: (note: WikiNote) => void;

  constructor(storage: ApiStorage, onRollback?: (note: WikiNote) => void) {
    this.storage = storage;
    this.onRollbackCb = onRollback;

    this.container = document.createElement('div');
    this.container.className = 'wf-modal-overlay';
    this.container.id = 'version-timeline-modal';
    this.container.style.display = 'none';
    document.body.appendChild(this.container);
  }

  public open(note: WikiNote): void {
    this.activeNote = note;
    this.container.style.display = 'flex';
    setHelpContext('versioni');
    void this.loadVersionHistory(note);
  }

  public close(): void {
    this.container.style.display = 'none';
    clearHelpContext('versioni');
  }

  private async loadVersionHistory(note: WikiNote): Promise<void> {
    const snapshots = await this.storage.listReviewSnapshots(note.path || note.id);
    this.versions = snapshots.map((snapshot, index) => ({
      version: snapshots.length - index,
      timestamp: snapshot.at,
      summary: snapshot.reason || 'Snapshot',
      content: snapshot.content ?? '',
      snapshotId: snapshot.id,
    }));
    this.selectedVersion = this.versions[0] ?? null;
    this.render();
  }

  public render(): void {
    if (!this.activeNote) return;

    const versionListHtml = this.versions.length === 0
      ? '<div style="font-size:12px;color:#94a3b8;">Nessuno snapshot registrato per questa nota.</div>'
      : this.versions.map(v => {
          const isSelected = this.selectedVersion?.snapshotId === v.snapshotId;
          return `
            <div class="version-item ${isSelected ? 'selected' : ''}" data-ver="${v.version}" style="padding: 10px 12px; border-radius: 8px; border: 1px solid ${isSelected ? '#6366f1' : '#334155'}; background: ${isSelected ? 'rgba(99, 102, 241, 0.15)' : '#1e293b'}; cursor: pointer; margin-bottom: 8px;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-weight: 700; font-size: 13px; color: #f8fafc;">v${v.version}</span>
                <span style="font-size: 10px; color: #94a3b8;">${v.timestamp}</span>
              </div>
              <div style="font-size: 11px; color: #94a3b8; margin-top: 4px;">${v.summary || 'No changelog description'}</div>
            </div>
          `;
        }).join('');

    const canRollback = Boolean(this.selectedVersion?.snapshotId);

    this.container.innerHTML = `
      <div class="wf-modal-content" style="width: 780px; max-width: 94vw; max-height: 85vh; display: flex; flex-direction: column;">
        <div style="padding: 16px 20px; background: #020617; border-bottom: 1px solid #1e293b; display: flex; align-items: center; justify-content: space-between;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 20px;">📜</span>
            <div>
              <h3 style="margin: 0; font-size: 16px; font-weight: 700; color: #f8fafc;">Version History &amp; Rollback</h3>
              <div style="font-size: 11px; color: #94a3b8;">Note: <code style="color: #60a5fa;">${this.activeNote.path}</code></div>
            </div>
          </div>
          <button id="version-close-btn" style="background: none; border: none; color: #94a3b8; font-size: 20px; cursor: pointer;">✕</button>
        </div>
        <div style="display: flex; flex: 1; overflow: hidden;">
          <div style="width: 260px; padding: 16px; border-right: 1px solid #1e293b; overflow-y: auto; background: #0f172a;">
            <div style="font-size: 12px; font-weight: 600; color: #94a3b8; margin-bottom: 12px;">SNAPSHOT TIMELINE</div>
            ${versionListHtml}
          </div>
          <div style="flex: 1; padding: 16px; overflow-y: auto; display: flex; flex-direction: column;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #1e293b;">
              <span style="font-size: 13px; font-weight: 600; color: #f8fafc;">
                ${this.selectedVersion ? `Viewing Revision v${this.selectedVersion.version}` : 'Nessuna revisione disponibile'}
              </span>
              ${canRollback ? `<button id="version-rollback-btn" style="background: #ef4444; color: white; border: none; padding: 6px 14px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer;">🔄 Rollback to v${this.selectedVersion!.version}</button>` : ''}
            </div>
            <pre style="flex: 1; margin: 0; padding: 12px; background: #020617; border: 1px solid #1e293b; border-radius: 8px; color: #f8fafc; font-family: monospace; font-size: 12px; white-space: pre-wrap; overflow-y: auto;">${this.selectedVersion?.content || 'Seleziona uno snapshot per visualizzare il contenuto.'}</pre>
          </div>
        </div>
      </div>
    `;

    this.attachEventListeners();
  }

  private attachEventListeners(): void {
    const closeBtn = this.container.querySelector('#version-close-btn');
    const rollbackBtn = this.container.querySelector('#version-rollback-btn');

    if (closeBtn) closeBtn.addEventListener('click', () => this.close());

    this.container.querySelectorAll('.version-item').forEach(item => {
      item.addEventListener('click', () => {
        const verNum = parseInt(item.getAttribute('data-ver') || '1', 10);
        const found = this.versions.find(v => v.version === verNum);
        if (found) {
          this.selectedVersion = found;
          this.render();
        }
      });
    });

    if (rollbackBtn && this.selectedVersion?.snapshotId && this.activeNote) {
      rollbackBtn.addEventListener('click', async () => {
        const selected = this.selectedVersion;
        const note = this.activeNote;
        if (!selected?.snapshotId || !note) return;
        const confirmed = await notifications.confirm({
          title: t('restore'),
          message: t('rollbackVersion', { name: note.title, version: selected.version }),
          danger: true,
        });
        if (!confirmed) return;
        const restoredNote = await this.storage.restoreReviewSnapshot(note.path || note.id, selected.snapshotId);
        if (!restoredNote) {
          notifications.error('Impossibile ripristinare lo snapshot selezionato.');
          return;
        }
        this.close();
        this.onRollbackCb?.(restoredNote);
      });
    }
  }
}
