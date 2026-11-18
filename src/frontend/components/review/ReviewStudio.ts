import { escapeHtml } from '@frontend/core/utils/html';
import { renderMarkdown } from '@frontend/core/utils/markdown';
import { WikiNote } from '@frontend/core/types/wiki';
import {
  ReviewCritiqueResponse,
  ReviewDepth,
  ReviewDiffResponse,
  ReviewDigest,
  ReviewMetaResponse,
  ReviewSnapshot,
  ReviewTab,
} from '@frontend/core/types/review';
import { ApiStorage } from '@frontend/storage/ApiStorage';

export interface ReviewStudioCallbacks {
  /** Called after the note was rewritten by a verify or restore action. */
  onNoteChanged?: (note: WikiNote) => void;
}

const TABS: Array<{ id: ReviewTab; label: string; icon: string; hint: string }> = [
  { id: 'verify', label: 'Verifica', icon: '✓', hint: 'quality gate' },
  { id: 'critique', label: 'Critica', icon: '⚡', hint: 'LLM' },
  { id: 'digest', label: 'Digest', icon: '◷', hint: 'attività' },
  { id: 'diff', label: 'Confronta versioni', icon: '⇄', hint: 'snapshot' },
];

const FOCUS_OPTIONS = [
  { value: 'contraddizioni', label: 'Contraddizioni interne' },
  { value: 'citazioni', label: 'Citazioni mancanti' },
  { value: 'logica', label: 'Salti logici' },
  { value: 'fonti', label: 'Copertura delle fonti' },
];

/**
 * Review Studio: one modal, four horizontal tabs.
 *
 * The tab is chosen by the caller, so the sidebar context menu can open
 * "Critica" directly while the editor header opens "Verifica".
 */
export class ReviewStudio {
  private overlay: HTMLElement;
  private storage: ApiStorage;
  private callbacks: ReviewStudioCallbacks;
  private notes: WikiNote[] = [];

  private noteId: string | null = null;
  private tab: ReviewTab = 'verify';

  private meta: ReviewMetaResponse | null = null;
  private metaLoading = false;
  private reviewer = 'local';

  private critique: ReviewCritiqueResponse | null = null;
  private critiqueLoading = false;

  private digest: ReviewDigest | null = null;
  private digestLoading = false;
  private digestDays = 7;
  private digestScope: 'all' | 'folder' | 'note' = 'all';

  private snapshots: ReviewSnapshot[] = [];
  private snapshotsLoading = false;
  private selectedSnapshotId: string | null = null;
  private diff: ReviewDiffResponse | null = null;
  private diffLoading = false;

  constructor(storage: ApiStorage, callbacks: ReviewStudioCallbacks = {}) {
    this.storage = storage;
    this.callbacks = callbacks;

    this.overlay = document.createElement('div');
    this.overlay.className = 'wf-rs-overlay';
    this.overlay.id = 'wf-review-studio';
    this.overlay.addEventListener('mousedown', event => {
      if (event.target === this.overlay) this.close();
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && this.isOpen()) this.close();
    });
    document.body.appendChild(this.overlay);
  }

  public isOpen(): boolean {
    return this.overlay.classList.contains('open');
  }

  public setNotes(notes: WikiNote[]): void {
    this.notes = notes;
    if (this.isOpen()) this.renderShell();
  }

  public open(noteId: string, tab: ReviewTab = 'verify'): void {
    const changedNote = this.noteId !== noteId;
    this.noteId = noteId;
    this.tab = tab;
    if (changedNote) {
      this.meta = null;
      this.snapshots = [];
      this.selectedSnapshotId = null;
      this.diff = null;
    }
    if (tab === 'critique' && changedNote) this.critique = null;

    this.overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    this.renderShell();
    void this.loadTab();
  }

  public close(): void {
    this.overlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  public setTab(tab: ReviewTab): void {
    if (this.tab === tab) return;
    this.tab = tab;
    this.renderShell();
    void this.loadTab();
  }

  // -------------------------------------------------------------------------
  // Data loading
  // -------------------------------------------------------------------------

  private currentNote(): WikiNote | undefined {
    return this.notes.find(note => note.id === this.noteId);
  }

  private noteRef(): string {
    return this.meta?.note?.path || this.currentNote()?.path || this.noteId || '';
  }

  private async loadTab(): Promise<void> {
    if (this.tab === 'verify') {
      if (!this.meta || this.meta.note?.path !== this.noteRef()) await this.loadMeta();
    } else if (this.tab === 'digest') {
      if (!this.digest) await this.loadDigest();
    } else if (this.tab === 'diff') {
      await this.loadSnapshots();
    }
  }

  private async loadMeta(): Promise<void> {
    this.metaLoading = true;
    this.renderBody();
    const ref = this.currentNote()?.path || this.noteId || '';
    const meta = await this.storage.getReviewMeta(ref);
    this.meta = meta;
    if (meta.success) {
      const stored = localStorage.getItem('wiki-forge:reviewer') || '';
      this.reviewer = stored || meta.suggestedReviewer || 'local';
    }
    this.metaLoading = false;
    this.renderBody();
  }

  private async loadDigest(): Promise<void> {
    this.digestLoading = true;
    this.renderBody();
    const note = this.currentNote();
    const scope = this.digestScope;
    const digest = await this.storage.getReviewDigest({
      days: this.digestDays,
      scope,
      note: scope === 'all' ? undefined : note?.path || this.meta?.note?.path || this.noteId || undefined,
    });
    this.digest = digest;
    this.digestLoading = false;
    this.renderBody();
  }

  private async loadSnapshots(): Promise<void> {
    this.snapshotsLoading = true;
    this.renderBody();
    const snapshots = await this.storage.listReviewSnapshots(this.noteRef() || this.noteId || '');
    this.snapshots = snapshots;
    this.snapshotsLoading = false;

    if (snapshots.length > 0 && !this.selectedSnapshotId) {
      this.selectedSnapshotId = snapshots[0].id;
    }
    this.renderBody();
    if (this.selectedSnapshotId) await this.loadDiff(this.selectedSnapshotId);
  }

  private async loadDiff(snapshotId: string): Promise<void> {
    this.selectedSnapshotId = snapshotId;
    this.diffLoading = true;
    this.diff = null;
    this.renderBody();
    const diff = await this.storage.getReviewDiff(this.noteRef() || this.noteId || '', snapshotId);
    if (this.selectedSnapshotId === snapshotId) {
      this.diff = diff;
      this.diffLoading = false;
      this.renderBody();
    }
  }

  private async submitVerification(): Promise<void> {
    const button = this.overlay.querySelector<HTMLButtonElement>('#wf-rs-verify-btn');
    if (button?.disabled) return;

    const reviewerInput = this.overlay.querySelector<HTMLInputElement>('#wf-rs-reviewer');
    const commentInput = this.overlay.querySelector<HTMLTextAreaElement>('#wf-rs-comment');
    const stableInput = this.overlay.querySelector<HTMLInputElement>('#wf-rs-stable');

    this.reviewer = reviewerInput?.value.trim() || 'local';
    localStorage.setItem('wiki-forge:reviewer', this.reviewer);

    if (button) {
      button.disabled = true;
      button.textContent = 'Registrazione…';
    }

    const result = await this.storage.verifyNote({
      note: this.noteRef() || this.noteId || '',
      reviewer: this.reviewer,
      comment: commentInput?.value.trim() || undefined,
      setStable: stableInput?.checked === true,
    });

    if (result.success) {
      if (result.meta) this.meta = result.meta;
      else await this.loadMeta();
      this.renderShell();

      const note = result.note;
      if (note) {
        const updated = this.notes.find(candidate => candidate.id === note.id);
        if (updated) {
          updated.status = note.status ?? updated.status;
          updated.trustTier = (note.trustTier as WikiNote['trustTier']) ?? updated.trustTier;
          this.callbacks.onNoteChanged?.(updated);
        }
      }
    } else {
      this.renderBody();
      const host = this.overlay.querySelector<HTMLElement>('#wf-rs-verify-feedback');
      if (host) {
        host.innerHTML = `<div class="wf-rs-error">${escapeHtml(result.error || 'Verifica non riuscita')}</div>`;
      }
    }
  }

  private async submitCritique(): Promise<void> {
    const button = this.overlay.querySelector<HTMLButtonElement>('#wf-rs-critique-btn');
    if (button?.disabled) return;

    const depth = (this.overlay.querySelector<HTMLSelectElement>('#wf-rs-depth')?.value || 'standard') as ReviewDepth;
    const instructions = this.overlay.querySelector<HTMLTextAreaElement>('#wf-rs-instructions')?.value.trim() || '';
    const focus = Array.from(
      this.overlay.querySelectorAll<HTMLInputElement>('input[name="wf-rs-focus"]:checked')
    ).map(input => input.value);

    this.critiqueLoading = true;
    this.critique = null;
    this.renderBody();

    this.critique = await this.storage.critiqueNote({
      note: this.noteRef() || this.noteId || '',
      depth,
      focus,
      instructions: instructions || undefined,
    });
    this.critiqueLoading = false;
    this.renderBody();
  }

  private async restoreSnapshot(): Promise<void> {
    if (!this.selectedSnapshotId) return;
    const confirmed = confirm(
      'Ripristinare questa versione? La versione corrente verrà salvata come nuovo snapshot.'
    );
    if (!confirmed) return;

    const restored = await this.storage.restoreReviewSnapshot(
      this.noteRef() || this.noteId || '',
      this.selectedSnapshotId
    );
    if (!restored) {
      this.diff = { success: false, error: 'Ripristino non riuscito' };
      this.renderBody();
      return;
    }

    this.callbacks.onNoteChanged?.(restored);
    this.meta = null;
    this.selectedSnapshotId = null;
    this.diff = null;
    await this.loadSnapshots();
  }

  // -------------------------------------------------------------------------
  // Rendering
  // -------------------------------------------------------------------------

  private renderShell(): void {
    const note = this.currentNote();
    const metaNote = this.meta?.note;
    const title = metaNote?.title || note?.title || this.noteId || 'Nota';
    const path = metaNote?.path || note?.path || '';

    this.overlay.innerHTML = `
      <div class="wf-rs-modal" role="dialog" aria-modal="true" aria-label="Review Studio">
        <div class="wf-rs-header">
          <div>
            <h2><span class="dot"></span> Review Studio</h2>
            <div class="wf-rs-subtitle">
              <strong>${escapeHtml(title)}</strong>
              ${path ? `<code>${escapeHtml(path)}</code>` : ''}
              <span>· revisione e qualità della nota</span>
            </div>
          </div>
          <button class="wf-rs-close" id="wf-rs-close" title="Chiudi (Esc)">✕</button>
        </div>
        <div class="wf-rs-tabs" role="tablist">
          ${TABS.map(tab => `
            <button class="wf-rs-tab${this.tab === tab.id ? ' active' : ''}"
                    role="tab"
                    aria-selected="${this.tab === tab.id}"
                    data-tab="${tab.id}">
              <span aria-hidden="true">${tab.icon}</span>${tab.label}
              <span class="hint">${tab.hint}</span>
            </button>`).join('')}
        </div>
        <div class="wf-rs-body" id="wf-rs-body"></div>
      </div>`;

    this.overlay.querySelector('#wf-rs-close')?.addEventListener('click', () => this.close());
    this.overlay.querySelectorAll<HTMLElement>('.wf-rs-tab').forEach(button => {
      button.addEventListener('click', () => {
        const tab = button.getAttribute('data-tab') as ReviewTab | null;
        if (tab) this.setTab(tab);
      });
    });

    this.renderBody();
  }

  private renderBody(): void {
    const host = this.overlay.querySelector<HTMLElement>('#wf-rs-body');
    if (!host) return;

    if (this.tab === 'verify') host.innerHTML = this.renderVerifyTab();
    else if (this.tab === 'critique') host.innerHTML = this.renderCritiqueTab();
    else if (this.tab === 'digest') host.innerHTML = this.renderDigestTab();
    else host.innerHTML = this.renderDiffTab();

    this.bindBodyEvents();
  }

  private renderNoteBadges(): string {
    const note = this.meta?.note;
    if (!note) return '';
    const tier = note.trustTier === 'human-reviewed'
      ? '<span class="wf-rs-badge green">🟢 human-reviewed</span>'
      : note.trustTier === 'machine-confirmed'
        ? '<span class="wf-rs-badge amber">🟡 machine-confirmed</span>'
        : '<span class="wf-rs-badge">⚪ unverified</span>';
    const status = `<span class="wf-rs-badge">${escapeHtml(note.status)}</span>`;
    const stale = note.staleAfter
      ? `<span class="wf-rs-badge ${note.staleAfter.slice(0, 10) < new Date().toISOString().slice(0, 10) ? 'red' : 'green'}">stale ${escapeHtml(note.staleAfter.slice(0, 10))}</span>`
      : '';
    return `${tier}${status}<span class="wf-rs-badge">${escapeHtml(note.folder)}</span>${stale}`;
  }

  private renderVerifyTab(): string {
    if (this.metaLoading) {
      return '<div class="wf-rs-loading">Analisi della nota e della Quality Gate…</div>';
    }

    if (!this.meta || !this.meta.success || !this.meta.note) {
      return `
        <div class="wf-rs-error">
          ${escapeHtml(this.meta?.error || 'Impossibile caricare i metadati della nota.')}
        </div>
        <div class="wf-rs-actions" style="margin-top: 12px;">
          <button class="wf-rs-btn" id="wf-rs-retry-meta">Riprova</button>
        </div>`;
    }

    const note = this.meta.note;
    const quality = this.meta.quality;
    const score = quality && quality.total > 0 ? Math.round((quality.passed / quality.total) * 100) : 0;
    const gateItems = (quality?.items || []).map(item => `
      <div class="wf-rs-gate-item ${item.ok ? 'ok' : 'ko'}">
        <span class="icon">${item.ok ? '✓' : '✕'}</span>
        <div>
          <div class="label">${escapeHtml(item.label)} <span class="val">${escapeHtml(item.value)}</span></div>
          <div class="detail">${escapeHtml(item.detail)}</div>
        </div>
      </div>`).join('');

    const history = this.meta.history || [];
    const historyHtml = history.length > 0
      ? `<div class="wf-rs-history">${history.map(event => `
          <div class="wf-rs-history-item">
            <span class="who">${escapeHtml(event.actor)}</span>
            <span class="when">${escapeHtml((event.at || '').replace('T', ' ').replace('Z', ' UTC'))}</span>
          </div>`).join('')}</div>`
      : '<div class="wf-rs-empty">Nessuna verifica registrata: la nota è ancora <em>unverified</em>.</div>';

    const updated = note.updatedAt ? new Date(note.updatedAt).toLocaleString('it-IT') : '—';

    return `
      <div class="wf-rs-grid">
        <div>
          <div class="wf-rs-panel">
            <div class="wf-rs-panel-title">Nota</div>
            <div class="wf-rs-note-title">${escapeHtml(note.title)}</div>
            <div class="wf-rs-badges">${this.renderNoteBadges()}</div>
            <div class="wf-rs-meta-list">
              <div class="wf-rs-meta-item"><span class="k">Percorso</span><span class="v">${escapeHtml(note.path)}</span></div>
              <div class="wf-rs-meta-item"><span class="k">Ultima modifica</span><span class="v">${escapeHtml(updated)}</span></div>
              <div class="wf-rs-meta-item"><span class="k">Righe</span><span class="v">${note.lineCount}</span></div>
              <div class="wf-rs-meta-item"><span class="k">Dimensione</span><span class="v">${(note.bytes / 1024).toFixed(1)} KB</span></div>
              <div class="wf-rs-meta-item"><span class="k">Fonti</span><span class="v">${note.sources}</span></div>
              <div class="wf-rs-meta-item"><span class="k">Link interni</span><span class="v">${note.outboundLinks.length}${note.brokenLinks.length ? ` · ${note.brokenLinks.length} rotti` : ''}</span></div>
              <div class="wf-rs-meta-item"><span class="k">Tag</span><span class="v">${escapeHtml(note.tags.slice(0, 4).join(', ') || '—')}</span></div>
              <div class="wf-rs-meta-item"><span class="k">Snapshot</span><span class="v">${this.meta.snapshotCount ?? 0}</span></div>
            </div>
          </div>

          <div class="wf-rs-panel">
            <div class="wf-rs-panel-title">Storico verifiche</div>
            ${historyHtml}
          </div>
        </div>

        <div>
          <div class="wf-rs-panel">
            <div class="wf-rs-panel-title">
              <span>Quality Gate</span>
              <span>${quality?.passed ?? 0}/${quality?.total ?? 0} · ${score}%</span>
            </div>
            <div class="wf-rs-gate">${gateItems || '<div class="wf-rs-empty">Nessun controllo disponibile.</div>'}</div>
          </div>

          <div class="wf-rs-panel">
            <div class="wf-rs-panel-title">Registra verifica umana</div>
            <div class="wf-rs-row">
              <div class="wf-rs-field">
                <label for="wf-rs-reviewer">Reviewer</label>
                <input type="text" id="wf-rs-reviewer" value="${escapeHtml(this.reviewer)}" placeholder="es. alby69" />
              </div>
              <div class="wf-rs-field">
                <label for="wf-rs-stable-wrap">Status</label>
                <label class="wf-rs-check" id="wf-rs-stable-wrap" style="margin: 8px 0 0;">
                  <input type="checkbox" id="wf-rs-stable" />
                  Imposta <code>stable</code>
                </label>
              </div>
            </div>
            <div class="wf-rs-field">
              <label for="wf-rs-comment">Commento (opzionale)</label>
              <textarea id="wf-rs-comment" placeholder="Cosa hai controllato? Es. fonti verificate, citazioni allineate…"></textarea>
            </div>
            <div class="wf-rs-actions">
              <button class="wf-rs-btn primary" id="wf-rs-verify-btn">Registra verifica</button>
              <span style="font-size: 11px; color: #64748b;">scriverà <code>verified</code> nel frontmatter</span>
            </div>
            <div id="wf-rs-verify-feedback" class="wf-rs-result"></div>
          </div>
        </div>
      </div>`;
  }

  private renderCritiqueTab(): string {
    const result = this.critique;

    const resultHtml = this.critiqueLoading
      ? '<div class="wf-rs-loading">Revisione critica in corso… può richiedere qualche secondo.</div>'
      : result
        ? result.success
          ? `<div class="wf-rs-result">
               ${result.fallback ? '<div class="wf-rs-badge amber" style="margin-bottom: 10px; display: inline-block;">report deterministico · provider LLM non disponibile</div>' : ''}
               <div class="wf-rs-md">${renderMarkdown(result.markdown)}</div>
             </div>`
          : `<div class="wf-rs-error">${escapeHtml(result.error || 'Revisione non riuscita')}</div>`
        : '<div class="wf-rs-empty">Scegli profondità e focus, poi avvia la revisione. Il report evidenzia contraddizioni, citazioni mancanti e salti logici.</div>';

    return `
      <div class="wf-rs-panel">
        <div class="wf-rs-panel-title">Revisione critica avversariale</div>
        <div class="wf-rs-row">
          <div class="wf-rs-field">
            <label for="wf-rs-depth">Profondità</label>
            <select id="wf-rs-depth">
              <option value="fast">Veloce · max 5 finding</option>
              <option value="standard" selected>Standard · 5-7 finding</option>
              <option value="deep">Approfondita · 8+ finding</option>
            </select>
          </div>
          <div class="wf-rs-field">
            <label>Focus</label>
            <div style="display: flex; flex-wrap: wrap; gap: 4px 14px; padding-top: 4px;">
              ${FOCUS_OPTIONS.map(option => `
                <label class="wf-rs-check" style="margin: 0;">
                  <input type="checkbox" name="wf-rs-focus" value="${option.value}" checked />
                  ${option.label}
                </label>`).join('')}
            </div>
          </div>
        </div>
        <div class="wf-rs-field">
          <label for="wf-rs-instructions">Istruzioni aggiuntive (opzionale)</label>
          <textarea id="wf-rs-instructions" placeholder="Es. concentrati sul capitolo 3 e confronta con [[governance-controllo-responsabilita]]"></textarea>
        </div>
        <div class="wf-rs-actions">
          <button class="wf-rs-btn primary" id="wf-rs-critique-btn">Avvia revisione critica</button>
          ${result?.success ? '<button class="wf-rs-btn ghost" id="wf-rs-critique-copy">Copia report</button>' : ''}
        </div>
      </div>
      <div class="wf-rs-panel">
        <div class="wf-rs-panel-title">Report</div>
        ${resultHtml}
      </div>`;
  }

  private renderDigestTab(): string {
    const digest = this.digest;
    const stats = digest?.stats;
    const health = digest?.health;

    const timeline = digest && digest.days.length > 0
      ? `<div class="wf-rs-timeline">${digest.days.map(day => `
          <div class="wf-rs-timeline-day">
            <div class="wf-rs-timeline-date">${escapeHtml(day.date)}</div>
            ${day.items.map(item => `
              <div class="wf-rs-timeline-item">
                <span class="kind ${escapeHtml(item.kind)}">${escapeHtml(item.kind)}</span>
                ${escapeHtml(item.title)}${item.detail ? ` — ${escapeHtml(item.detail)}` : ''}
              </div>`).join('')}
          </div>`).join('')}</div>`
      : digest
        ? '<div class="wf-rs-empty">Nessuna attività nel periodo selezionato.</div>'
        : '';

    const actions = digest && digest.nextActions.length > 0
      ? `<div class="wf-rs-panel">
           <div class="wf-rs-panel-title">Prossime azioni</div>
           ${digest.nextActions.map(action => `
             <div class="wf-rs-timeline-item">• ${escapeHtml(action.title)}</div>`).join('')}
         </div>`
      : '';

    return `
      <div class="wf-rs-panel">
        <div class="wf-rs-panel-title">Digest attività</div>
        <div class="wf-rs-row">
          <div class="wf-rs-field">
            <label for="wf-rs-days">Periodo</label>
            <select id="wf-rs-days">
              ${[1, 7, 14, 30, 90].map(days => `
                <option value="${days}" ${days === this.digestDays ? 'selected' : ''}>ultimi ${days} giorni</option>`).join('')}
            </select>
          </div>
          <div class="wf-rs-field">
            <label for="wf-rs-scope">Ambito</label>
            <select id="wf-rs-scope">
              <option value="all" ${this.digestScope === 'all' ? 'selected' : ''}>tutta la wiki</option>
              <option value="folder" ${this.digestScope === 'folder' ? 'selected' : ''}>cartella della nota</option>
              <option value="note" ${this.digestScope === 'note' ? 'selected' : ''}>solo questa nota</option>
            </select>
          </div>
          <div class="wf-rs-field">
            <label>&nbsp;</label>
            <button class="wf-rs-btn primary" id="wf-rs-digest-btn">Genera digest</button>
          </div>
        </div>
      </div>

      ${this.digestLoading ? '<div class="wf-rs-loading">Lettura di log.md e controllo della wiki…</div>' : ''}

      ${!this.digestLoading && digest && !digest.success ? `<div class="wf-rs-error">${escapeHtml(digest.error || 'Digest non disponibile')}</div>` : ''}

      ${!this.digestLoading && digest && digest.success ? `
        <div class="wf-rs-stats">
          <div class="wf-rs-stat"><div class="v">${stats!.notesChanged}</div><div class="k">note modificate</div></div>
          <div class="wf-rs-stat good"><div class="v">${stats!.verified}</div><div class="k">verificate</div></div>
          <div class="wf-rs-stat ${stats!.stale > 0 ? 'alert' : ''}"><div class="v">${stats!.stale}</div><div class="k">stale</div></div>
          <div class="wf-rs-stat ${stats!.brokenLinks > 0 ? 'alert' : ''}"><div class="v">${stats!.brokenLinks}</div><div class="k">link rotti</div></div>
          <div class="wf-rs-stat"><div class="v">${stats!.notes}</div><div class="k">note in ambito</div></div>
        </div>

        <div class="wf-rs-health">
          <div class="wf-rs-health-head">
            <strong>Salute della wiki · ${health!.score}/100</strong>
            <span>${escapeHtml(health!.label)} · ${escapeHtml(health!.summary)}</span>
          </div>
          <div class="wf-rs-bar"><div style="width: ${Math.max(2, health!.score)}%;"></div></div>
        </div>

        <div class="wf-rs-panel">
          <div class="wf-rs-panel-title">
            <span>Attività recente</span>
            <button class="wf-rs-btn ghost" id="wf-rs-digest-copy" style="padding: 3px 9px; font-size: 11px;">Copia Markdown</button>
          </div>
          ${timeline}
        </div>

        ${actions}
      ` : ''}`;
  }

  private renderDiffTab(): string {
    if (this.snapshotsLoading) {
      return '<div class="wf-rs-loading">Ricerca delle versioni precedenti…</div>';
    }

    if (this.snapshots.length === 0) {
      return `
        <div class="wf-rs-empty">
          <strong>Nessuna versione precedente.</strong><br />
          Wiki-Forge salva uno snapshot prima di ogni modifica alla nota (dall'editor, da <code>/verify</code>
          o da un ripristino). Modifica questa nota e torna qui per confrontare le versioni.
        </div>
        <div class="wf-rs-actions" style="margin-top: 12px;">
          <button class="wf-rs-btn" id="wf-rs-snapshots-refresh">Aggiorna</button>
        </div>`;
    }

    const list = this.snapshots.map(snapshot => `
      <div class="wf-rs-snapshot${snapshot.id === this.selectedSnapshotId ? ' selected' : ''}" data-snapshot="${escapeHtml(snapshot.id)}">
        <div style="flex: 1; min-width: 0;">
          <div class="when">${escapeHtml(new Date(snapshot.at).toLocaleString('it-IT'))}</div>
          <div class="reason">${escapeHtml(snapshot.reason)} · ${(snapshot.bytes / 1024).toFixed(1)} KB</div>
        </div>
        <span style="color: #475569;">›</span>
      </div>`).join('');

    const diff = this.diff;
    const rows = diff?.rows || [];
    const stats = diff?.stats;
    const diffHtml = this.diffLoading
      ? '<div class="wf-rs-loading">Calcolo del diff…</div>'
      : diff && diff.success
        ? `
          <div class="wf-rs-diff-head">
            <span class="stats">
              <span class="add">+${stats?.added ?? 0}</span> ·
              <span class="del">−${stats?.removed ?? 0}</span> ·
              ${stats?.context ?? 0} invariati
            </span>
            <button class="wf-rs-btn danger" id="wf-rs-restore-btn">Ripristina questa versione</button>
          </div>
          <div class="wf-rs-diff">
            ${rows.map(row => `
              <div class="wf-rs-diff-row ${row.type}">
                <div class="ln">${row.leftNo ?? ''}</div>
                <div class="ln">${row.rightNo ?? ''}</div>
                <div class="txt">${escapeHtml(row.type === 'add' ? row.right : row.left) || '&nbsp;'}</div>
              </div>`).join('')}
          </div>`
        : diff
          ? `<div class="wf-rs-error">${escapeHtml(diff.error || 'Confronto non disponibile')}</div>`
          : '<div class="wf-rs-empty">Seleziona una versione per vedere le differenze.</div>';

    return `
      <div class="wf-rs-grid" style="grid-template-columns: minmax(240px, 0.8fr) minmax(0, 2fr);">
        <div class="wf-rs-panel">
          <div class="wf-rs-panel-title">
            <span>Snapshot (${this.snapshots.length})</span>
            <button class="wf-rs-btn ghost" id="wf-rs-snapshots-refresh" style="padding: 2px 8px; font-size: 10.5px;">Aggiorna</button>
          </div>
          <div class="wf-rs-snapshots">${list}</div>
        </div>
        <div class="wf-rs-panel">
          <div class="wf-rs-panel-title">Confronto con la versione corrente</div>
          ${diffHtml}
        </div>
      </div>`;
  }

  private bindBodyEvents(): void {
    this.overlay.querySelector('#wf-rs-retry-meta')?.addEventListener('click', () => {
      void this.loadMeta();
    });

    this.overlay.querySelector<HTMLInputElement>('#wf-rs-reviewer')?.addEventListener('change', event => {
      this.reviewer = (event.target as HTMLInputElement).value.trim() || 'local';
    });

    this.overlay.querySelector('#wf-rs-verify-btn')?.addEventListener('click', () => {
      void this.submitVerification();
    });

    this.overlay.querySelector('#wf-rs-critique-btn')?.addEventListener('click', () => {
      void this.submitCritique();
    });

    this.overlay.querySelector('#wf-rs-critique-copy')?.addEventListener('click', () => {
      if (this.critique?.markdown) void this.copy(this.critique.markdown, 'Report copiato');
    });

    this.overlay.querySelector('#wf-rs-digest-btn')?.addEventListener('click', () => {
      const days = Number(this.overlay.querySelector<HTMLSelectElement>('#wf-rs-days')?.value || 7);
      const scope = (this.overlay.querySelector<HTMLSelectElement>('#wf-rs-scope')?.value || 'all') as
        | 'all'
        | 'folder'
        | 'note';
      this.digestDays = Number.isFinite(days) ? days : 7;
      this.digestScope = scope;
      void this.loadDigest();
    });

    this.overlay.querySelector('#wf-rs-digest-copy')?.addEventListener('click', () => {
      if (this.digest?.markdown) void this.copy(this.digest.markdown, 'Digest copiato');
    });

    this.overlay.querySelector('#wf-rs-snapshots-refresh')?.addEventListener('click', () => {
      this.selectedSnapshotId = null;
      void this.loadSnapshots();
    });

    this.overlay.querySelectorAll<HTMLElement>('.wf-rs-snapshot').forEach(row => {
      row.addEventListener('click', () => {
        const id = row.getAttribute('data-snapshot');
        if (id && id !== this.selectedSnapshotId) void this.loadDiff(id);
      });
    });

    this.overlay.querySelector('#wf-rs-restore-btn')?.addEventListener('click', () => {
      void this.restoreSnapshot();
    });
  }

  private async copy(text: string, message: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      const host = this.overlay.querySelector<HTMLElement>('#wf-rs-verify-feedback');
      if (host) host.innerHTML = `<div class="wf-rs-empty">${escapeHtml(message)}</div>`;
    } catch (_err) {
      // Clipboard may be unavailable (non-secure context); selection still works.
    }
  }
}
