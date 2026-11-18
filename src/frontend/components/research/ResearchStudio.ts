import { escapeHtml } from '@frontend/core/utils/html';
import { renderMarkdown } from '@frontend/core/utils/markdown';
import { WikiNote } from '@frontend/core/types/wiki';
import {
  ResearchBacklinksResponse,
  ResearchConsultResponse,
  ResearchDeepResearchResponse,
  ResearchOpenOptions,
  ResearchRelatedResponse,
  ResearchSearchResponse,
  ResearchTab,
  ResearchTraceResponse,
} from '@frontend/core/types/research';
import { ApiStorage } from '@frontend/storage/ApiStorage';

export interface ResearchStudioCallbacks {
  /** Opens a result note in the editor and closes the modal. */
  onOpenNote?: (noteId: string) => void;
  /** Called after deep research wrote a new synthesis note. */
  onVaultChanged?: () => void;
}

const TABS: Array<{ id: ResearchTab; label: string; icon: string; hint: string; command: string }> = [
  { id: 'consult', label: 'Consult', icon: '💬', hint: 'LLM', command: '/consult' },
  { id: 'search', label: 'Ricerca', icon: '🔍', hint: 'full-text', command: '/search' },
  { id: 'backlinks', label: 'Backlink', icon: '↩', hint: 'entranti', command: '/backlinks' },
  { id: 'related', label: 'Correlate', icon: '🧩', hint: 'suggerite', command: '/related' },
  { id: 'trace', label: 'Traccia', icon: '🕸️', hint: 'fonti raw', command: '/trace' },
  { id: 'deep', label: 'Deep Research', icon: '🔬', hint: 'report', command: '/deep-research' },
];

const EXAMPLES: Record<ResearchTab, string> = {
  consult: 'Es. Quali decisioni sono documentate sulla governance clinica?',
  search: 'Es. governance clinica',
  backlinks: 'Seleziona la nota di cui elencare i link entranti.',
  related: 'Seleziona la nota di cui cercare connessioni mancanti.',
  trace: 'Es. governance clinica',
  deep: 'Es. Confronta le strategie di governance clinica descritte nella wiki',
};

/**
 * Research Studio: one modal, six horizontal tabs matching the
 * "🔍 Interrogazione e Ricerca" agent commands.
 *
 * Search, backlinks, related and trace are deterministic; consult and deep
 * research call the LLM and fall back to a deterministic report when the
 * provider is unavailable.
 */
export class ResearchStudio {
  private overlay: HTMLElement;
  private storage: ApiStorage;
  private callbacks: ResearchStudioCallbacks;
  private notes: WikiNote[] = [];

  private noteId: string | null = null;
  private tab: ResearchTab = 'search';

  private consultQuestion = '';
  private searchQuery = '';
  private traceQuery = '';
  private deepQuestion = '';

  private consult: ResearchConsultResponse | null = null;
  private consultLoading = false;

  private search: ResearchSearchResponse | null = null;
  private searchLoading = false;

  private backlinks: ResearchBacklinksResponse | null = null;
  private backlinksLoading = false;

  private related: ResearchRelatedResponse | null = null;
  private relatedLoading = false;

  private trace: ResearchTraceResponse | null = null;
  private traceLoading = false;

  private deep: ResearchDeepResearchResponse | null = null;
  private deepLoading = false;

  private feedback = '';

  constructor(storage: ApiStorage, callbacks: ResearchStudioCallbacks = {}) {
    this.storage = storage;
    this.callbacks = callbacks;

    this.overlay = document.createElement('div');
    this.overlay.className = 'wf-rs-overlay wf-rq-overlay';
    this.overlay.id = 'wf-research-studio';
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

  public open(options: ResearchOpenOptions = {}): void {
    const previousNote = this.noteId;
    if (options.noteId) this.noteId = options.noteId;
    if (options.noteRef) {
      const resolved = this.resolveNote(options.noteRef);
      if (resolved) this.noteId = resolved.id;
    }
    if (!this.noteId && this.notes.length > 0) this.noteId = this.notes[0].id;

    const noteChanged = previousNote !== this.noteId;
    if (noteChanged) {
      this.backlinks = null;
      this.related = null;
    }

    if (options.tab) this.tab = options.tab;
    if (options.query) this.setQuery(this.tab, options.query);

    this.feedback = '';
    this.overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    this.renderShell();
    void this.loadTab(true);
  }

  public close(): void {
    this.overlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  public setTab(tab: ResearchTab): void {
    if (this.tab === tab) return;
    this.tab = tab;
    this.feedback = '';
    this.renderShell();
    void this.loadTab(false);
  }

  // -------------------------------------------------------------------------
  // Data loading
  // -------------------------------------------------------------------------

  private resolveNote(ref: string): WikiNote | undefined {
    const value = ref.trim().toLowerCase().replace(/^\[\[|\]\]$/g, '');
    if (!value) return undefined;
    return this.notes.find(note => note.id.toLowerCase() === value)
      || this.notes.find(note => note.title.toLowerCase() === value)
      || this.notes.find(note => note.path.toLowerCase() === value)
      || this.notes.find(note => note.path.toLowerCase().replace(/\.md$/i, '').endsWith(`/${value}`));
  }

  private currentNote(): WikiNote | undefined {
    return this.noteId ? this.notes.find(note => note.id === this.noteId) : undefined;
  }

  private noteRef(): string {
    return this.currentNote()?.path || this.noteId || '';
  }

  private setQuery(tab: ResearchTab, query: string): void {
    if (tab === 'consult') this.consultQuestion = query;
    else if (tab === 'search') this.searchQuery = query;
    else if (tab === 'trace') this.traceQuery = query;
    else if (tab === 'deep') this.deepQuestion = query;
    else {
      const resolved = this.resolveNote(query);
      if (resolved) this.noteId = resolved.id;
    }
  }

  private hasQuery(tab: ResearchTab): boolean {
    if (tab === 'consult') return Boolean(this.consultQuestion.trim());
    if (tab === 'search') return Boolean(this.searchQuery.trim());
    if (tab === 'trace') return Boolean(this.traceQuery.trim());
    if (tab === 'deep') return Boolean(this.deepQuestion.trim());
    return Boolean(this.noteId);
  }

  private async loadTab(force: boolean): Promise<void> {
    if (this.tab === 'search') {
      if (this.hasQuery('search') && (force || !this.search)) await this.runSearch();
    } else if (this.tab === 'backlinks') {
      if (this.hasQuery('backlinks') && (force || !this.backlinks)) await this.runBacklinks();
    } else if (this.tab === 'related') {
      if (this.hasQuery('related') && (force || !this.related)) await this.runRelated();
    } else if (this.tab === 'trace') {
      if (this.hasQuery('trace') && (force || !this.trace)) await this.runTrace();
    } else if (this.tab === 'consult') {
      if (this.hasQuery('consult') && (force || !this.consult)) await this.runConsult();
    } else if (this.tab === 'deep') {
      if (this.hasQuery('deep') && (force || !this.deep)) await this.runDeep();
    }
  }

  private async runSearch(): Promise<void> {
    this.searchLoading = true;
    this.search = null;
    this.renderBody();
    this.search = await this.storage.researchSearch(this.searchQuery.trim());
    this.searchLoading = false;
    this.renderBody();
  }

  private async runBacklinks(): Promise<void> {
    if (!this.noteId) return;
    this.backlinksLoading = true;
    this.backlinks = null;
    this.renderBody();
    this.backlinks = await this.storage.researchBacklinks(this.noteRef());
    this.backlinksLoading = false;
    this.renderBody();
  }

  private async runRelated(): Promise<void> {
    if (!this.noteId) return;
    this.relatedLoading = true;
    this.related = null;
    this.renderBody();
    this.related = await this.storage.researchRelated(this.noteRef());
    this.relatedLoading = false;
    this.renderBody();
  }

  private async runTrace(): Promise<void> {
    this.traceLoading = true;
    this.trace = null;
    this.renderBody();
    this.trace = await this.storage.researchTrace(this.traceQuery.trim());
    this.traceLoading = false;
    this.renderBody();
  }

  private async runConsult(): Promise<void> {
    this.consultLoading = true;
    this.consult = null;
    this.renderBody();
    this.consult = await this.storage.researchConsult(this.consultQuestion.trim());
    this.consultLoading = false;
    this.renderBody();
  }

  private async runDeep(): Promise<void> {
    this.deepLoading = true;
    this.deep = null;
    this.renderBody();
    this.deep = await this.storage.researchDeepResearch(this.deepQuestion.trim());
    this.deepLoading = false;
    this.renderBody();
    if (this.deep.success) this.callbacks.onVaultChanged?.();
  }

  // -------------------------------------------------------------------------
  // Rendering
  // -------------------------------------------------------------------------

  private renderShell(): void {
    const note = this.currentNote();
    const tabMeta = TABS.find(tab => tab.id === this.tab);

    this.overlay.innerHTML = `
      <div class="wf-rs-modal" role="dialog" aria-modal="true" aria-label="Research Studio">
        <div class="wf-rs-header">
          <div>
            <h2><span class="dot"></span> Research Studio</h2>
            <div class="wf-rs-subtitle">
              <strong>Knowledge base</strong>
              <code>${this.notes.length} note</code>
              <span>· interrogazione e ricerca</span>
              ${note ? `<span>· contesto: <strong>${escapeHtml(note.title)}</strong></span>` : ''}
            </div>
          </div>
          <button class="wf-rs-close" id="wf-rq-close" title="Chiudi (Esc)">✕</button>
        </div>
        <div class="wf-rs-tabs" role="tablist">
          ${TABS.map(tab => `
            <button class="wf-rs-tab wf-rq-tab${this.tab === tab.id ? ' active' : ''}"
                    role="tab"
                    aria-selected="${this.tab === tab.id}"
                    data-rq-tab="${tab.id}"
                    title="${tab.command}">
              <span aria-hidden="true">${tab.icon}</span>${tab.label}
              <span class="hint">${tab.hint}</span>
            </button>`).join('')}
        </div>
        <div class="wf-rs-body" id="wf-rq-body"></div>
      </div>`;

    this.overlay.querySelector('#wf-rq-close')?.addEventListener('click', () => this.close());
    this.overlay.querySelectorAll<HTMLElement>('.wf-rq-tab').forEach(button => {
      button.addEventListener('click', () => {
        const tab = button.getAttribute('data-rq-tab') as ResearchTab | null;
        if (tab) this.setTab(tab);
      });
    });

    const modal = this.overlay.querySelector('.wf-rs-modal');
    if (modal) modal.setAttribute('data-command', tabMeta?.command || '');

    this.renderBody();
  }

  private renderBody(): void {
    const host = this.overlay.querySelector<HTMLElement>('#wf-rq-body');
    if (!host) return;

    if (this.tab === 'consult') host.innerHTML = this.renderConsultTab();
    else if (this.tab === 'search') host.innerHTML = this.renderSearchTab();
    else if (this.tab === 'backlinks') host.innerHTML = this.renderBacklinksTab();
    else if (this.tab === 'related') host.innerHTML = this.renderRelatedTab();
    else if (this.tab === 'trace') host.innerHTML = this.renderTraceTab();
    else host.innerHTML = this.renderDeepTab();

    if (this.feedback) {
      const feedback = document.createElement('div');
      feedback.className = 'wf-rq-feedback';
      feedback.textContent = this.feedback;
      host.appendChild(feedback);
    }

    this.bindBodyEvents();
  }

  private renderNoteSelect(): string {
    const options = this.notes
      .slice()
      .sort((a, b) => a.title.localeCompare(b.title))
      .map(note => `<option value="${escapeHtml(note.id)}" ${note.id === this.noteId ? 'selected' : ''}>${escapeHtml(note.title)} · ${escapeHtml(note.folder || 'wiki')}</option>`)
      .join('');
    return `<select id="wf-rq-note-select" aria-label="Nota di riferimento">${options}</select>`;
  }

  private renderChips(values: string[], className: string = 'wf-rq-chip'): string {
    if (values.length === 0) return '';
    return `<div class="wf-rq-chips">${values.map(value => `<span class="${className}">${escapeHtml(value)}</span>`).join('')}</div>`;
  }

  private renderNoteButton(note: { id: string; title: string; path: string; folder?: string }): string {
    return `<button class="wf-rq-note-link" data-note-id="${escapeHtml(note.id)}" title="Apri ${escapeHtml(note.path)}">${escapeHtml(note.title)}</button>
      <code class="wf-rq-path">${escapeHtml(note.path)}</code>`;
  }

  private renderConsultTab(): string {
    const result = this.consult;
    const resultHtml = this.consultLoading
      ? '<div class="wf-rs-loading">Interrogazione della wiki e sintesi della risposta…</div>'
      : result
        ? result.success
          ? `<div class="wf-rs-result">
               ${result.fallback ? '<span class="wf-rs-badge amber" style="display: inline-block; margin-bottom: 10px;">fallback deterministico · provider LLM non disponibile</span>' : '<span class="wf-rs-badge green" style="display: inline-block; margin-bottom: 10px;">risposta LLM con note citate</span>'}
               <div class="wf-rs-md">${renderMarkdown(result.markdown)}</div>
               ${result.citations.length > 0 ? `
                 <div class="wf-rs-panel" style="margin-top: 14px;">
                   <div class="wf-rs-panel-title">Note usate come contesto</div>
                   <div class="wf-rq-citations">
                     ${result.citations.map(citation => `<button class="wf-rq-note-link" data-note-id="${escapeHtml(citation.id)}">${escapeHtml(citation.title)}</button>`).join('')}
                   </div>
                 </div>` : ''}
             </div>`
          : `<div class="wf-rs-error">${escapeHtml(result.error || 'Consultazione non riuscita')}</div>`
        : '<div class="wf-rs-empty">Fai una domanda in linguaggio naturale: la wiki viene cercata per parole chiave e le note pertinenti diventano il contesto della risposta.</div>';

    return `
      <div class="wf-rs-panel">
        <div class="wf-rs-panel-title">Consulta la wiki · <code>/consult</code></div>
        <div class="wf-rs-field">
          <label for="wf-rq-consult-question">Domanda</label>
          <textarea id="wf-rq-consult-question" placeholder="${escapeHtml(EXAMPLES.consult)}">${escapeHtml(this.consultQuestion)}</textarea>
        </div>
        <div class="wf-rs-actions">
          <button class="wf-rs-btn primary" id="wf-rq-consult-btn">Chiedi alla wiki</button>
          <button class="wf-rs-btn ghost" id="wf-rq-consult-copy" ${result?.success ? '' : 'disabled'}>Copia risposta</button>
          <span class="wf-rq-hint">Usa il provider LLM configurato; in assenza risponde con le note più pertinenti.</span>
        </div>
      </div>
      <div class="wf-rs-panel">
        <div class="wf-rs-panel-title">Risposta</div>
        ${resultHtml}
      </div>`;
  }

  private renderSearchTab(): string {
    const result = this.search;
    const stats = result?.success
      ? `<div class="wf-rq-stats">
           <span><strong>${result.total}</strong> note</span>
           <span><strong>${result.totalMatches}</strong> righe</span>
           <span>${result.scanned} note scansionate</span>
           <span>${result.tookMs} ms</span>
         </div>`
      : '';

    const list = this.searchLoading
      ? '<div class="wf-rs-loading">Ricerca full-text nelle note…</div>'
      : result
        ? result.success
          ? result.results.length > 0
            ? result.results.map(hit => `
                <div class="wf-rq-card">
                  <div class="wf-rq-card-head">
                    <div>${this.renderNoteButton(hit.note)}</div>
                    <span class="wf-rq-badge">${hit.matchCount} righe · score ${hit.score}</span>
                  </div>
                  ${hit.matches.map(match => `
                    <div class="wf-rq-snippet">
                      <span class="ln">L${match.line}</span>
                      <pre>${escapeHtml(match.snippet)}</pre>
                    </div>`).join('')}
                </div>`).join('')
            : '<div class="wf-rs-empty">Nessuna nota contiene la query. Prova con meno parole o un sinonimo.</div>'
          : `<div class="wf-rs-error">${escapeHtml(result.error || 'Ricerca non riuscita')}</div>`
        : '<div class="wf-rs-empty">Ricerca case-insensitive su titolo, id, tag e corpo. Le note sono ordinate per rilevanza; le righe mostrano il contesto.</div>';

    return `
      <div class="wf-rs-panel">
        <div class="wf-rs-panel-title">Ricerca full-text · <code>/search</code></div>
        <div class="wf-rs-row">
          <div class="wf-rs-field" style="flex: 1 1 320px;">
            <label for="wf-rq-search-query">Query</label>
            <input type="text" id="wf-rq-search-query" value="${escapeHtml(this.searchQuery)}" placeholder="${escapeHtml(EXAMPLES.search)}" />
          </div>
          <div class="wf-rs-field" style="flex: 0 0 auto;">
            <label>&nbsp;</label>
            <button class="wf-rs-btn primary" id="wf-rq-search-btn">Cerca</button>
          </div>
        </div>
        ${stats}
      </div>
      <div class="wf-rs-panel">
        <div class="wf-rs-panel-title">Risultati</div>
        ${list}
      </div>`;
  }

  private renderBacklinksTab(): string {
    const result = this.backlinks;
    const list = this.backlinksLoading
      ? '<div class="wf-rs-loading">Ricerca dei link entranti…</div>'
      : result
        ? result.success
          ? result.items.length > 0
            ? result.items.map(item => `
                <div class="wf-rq-card">
                  <div class="wf-rq-card-head">
                    <div>${this.renderNoteButton(item.source)}</div>
                    <span class="wf-rq-badge">riga ${item.line}</span>
                  </div>
                  <div class="wf-rq-snippet">
                    <span class="ln">L${item.line}</span>
                    <pre>${escapeHtml(item.snippet)}</pre>
                  </div>
                </div>`).join('')
            : '<div class="wf-rs-empty">Nessuna nota linka questa pagina. I backlink nascono dai <code>[[wikilink]]</code> nel corpo delle note.</div>'
          : `<div class="wf-rs-error">${escapeHtml(result.error || 'Backlink non disponibili')}</div>`
        : '<div class="wf-rs-empty">Seleziona una nota e carica i link entranti.</div>';

    return `
      <div class="wf-rs-panel">
        <div class="wf-rs-panel-title">Backlink · <code>/backlinks</code></div>
        <div class="wf-rs-field">
          <label for="wf-rq-note-select">Nota di riferimento</label>
          ${this.renderNoteSelect()}
        </div>
        <div class="wf-rs-actions">
          <button class="wf-rs-btn primary" id="wf-rq-backlinks-btn">Carica backlink</button>
          ${result?.success ? `<span class="wf-rq-hint">${result.items.length} link entranti su ${result.scanned} note · target <code>${escapeHtml(result.target?.path || '')}</code></span>` : ''}
        </div>
      </div>
      <div class="wf-rs-panel">
        <div class="wf-rs-panel-title">Note che citano la pagina</div>
        ${list}
      </div>`;
  }

  private renderRelatedTab(): string {
    const result = this.related;
    const list = this.relatedLoading
      ? '<div class="wf-rs-loading">Confronto di tag e vocabolario…</div>'
      : result
        ? result.success
          ? result.suggestions.length > 0
            ? result.suggestions.map(suggestion => `
                <div class="wf-rq-card">
                  <div class="wf-rq-card-head">
                    <div>${this.renderNoteButton(suggestion.note)}</div>
                    <span class="wf-rq-badge">score ${suggestion.score}</span>
                  </div>
                  <div class="wf-rq-rationale">${escapeHtml(suggestion.rationale || 'affinità tematica')}</div>
                  ${this.renderChips(suggestion.sharedTags.map(tag => `#${tag}`), 'wf-rq-chip tag')}
                  ${this.renderChips(suggestion.sharedTerms, 'wf-rq-chip term')}
                </div>`).join('')
            : '<div class="wf-rs-empty">Nessuna connessione mancante: tutte le note affini sono già linkate (o non condividono tag/concetti).</div>'
          : `<div class="wf-rs-error">${escapeHtml(result.error || 'Suggerimenti non disponibili')}</div>`
        : '<div class="wf-rs-empty">Le correlazioni propongono solo note non ancora collegate, in entrambe le direzioni.</div>';

    return `
      <div class="wf-rs-panel">
        <div class="wf-rs-panel-title">Note correlate · <code>/related</code></div>
        <div class="wf-rs-field">
          <label for="wf-rq-note-select">Nota di riferimento</label>
          ${this.renderNoteSelect()}
        </div>
        <div class="wf-rs-actions">
          <button class="wf-rs-btn primary" id="wf-rq-related-btn">Suggerisci correlazioni</button>
          ${result?.success ? `<span class="wf-rq-hint">${result.suggestions.length} suggerimenti su ${result.scanned} note</span>` : ''}
        </div>
      </div>
      <div class="wf-rs-panel">
        <div class="wf-rs-panel-title">Connessioni mancanti</div>
        ${list}
      </div>`;
  }

  private renderTraceTab(): string {
    const result = this.trace;
    const list = this.traceLoading
      ? '<div class="wf-rs-loading">Tracciamento delle note e delle fonti raw…</div>'
      : result
        ? result.success
          ? result.notes.length > 0
            ? result.notes.map(item => `
                <div class="wf-rq-card">
                  <div class="wf-rq-card-head">
                    <div>${this.renderNoteButton(item.note)}</div>
                    <span class="wf-rq-badge">${escapeHtml(item.matchedIn.join(' · ') || 'match')}</span>
                  </div>
                  ${item.outboundLinks.length > 0 ? `
                    <div class="wf-rq-row">
                      <span class="wf-rq-label">Link uscenti</span>
                      ${this.renderChips(item.outboundLinks.map(link => `[[${link}]]`))}
                    </div>` : ''}
                  ${item.sources.length > 0 ? `
                    <div class="wf-rq-row">
                      <span class="wf-rq-label">Fonti raw</span>
                      <div class="wf-rq-sources">
                        ${item.sources.map(source => `
                          <div class="wf-rq-source ${source.exists ? 'ok' : 'missing'}">
                            <code>${escapeHtml(source.rawRef)}</code>
                            <span class="wf-rq-badge">${source.exists ? (source.startLine ? `L${source.startLine}${source.endLine && source.endLine !== source.startLine ? `-${source.endLine}` : ''}` : 'file presente') : 'file assente'}</span>
                            ${source.passage ? `<pre>${escapeHtml(source.passage)}</pre>` : ''}
                          </div>`).join('')}
                      </div>
                    </div>` : '<div class="wf-rq-hint">Nessuna fonte raw dichiarata nel frontmatter o nella sezione <code>## Sources</code>.</div>'}
                </div>`).join('')
            : '<div class="wf-rs-empty">Nessuna nota corrisponde alla query.</div>'
          : `<div class="wf-rs-error">${escapeHtml(result.error || 'Tracciamento non riuscito')}</div>`
        : '<div class="wf-rs-empty">La traccia collega una parola chiave alle note che la contengono e alle fonti raw dichiarate, con passaggio citato quando disponibile.</div>';

    return `
      <div class="wf-rs-panel">
        <div class="wf-rs-panel-title">Traccia affermazione · <code>/trace</code></div>
        <div class="wf-rs-row">
          <div class="wf-rs-field" style="flex: 1 1 320px;">
            <label for="wf-rq-trace-query">Affermazione o concetto</label>
            <input type="text" id="wf-rq-trace-query" value="${escapeHtml(this.traceQuery)}" placeholder="${escapeHtml(EXAMPLES.trace)}" />
          </div>
          <div class="wf-rs-field" style="flex: 0 0 auto;">
            <label>&nbsp;</label>
            <button class="wf-rs-btn primary" id="wf-rq-trace-btn">Traccia</button>
          </div>
        </div>
      </div>
      <div class="wf-rs-panel">
        <div class="wf-rs-panel-title">Percorso nella wiki</div>
        ${list}
      </div>`;
  }

  private renderDeepTab(): string {
    const result = this.deep;
    const resultHtml = this.deepLoading
      ? '<div class="wf-rs-loading">Analisi multi-fonte e stesura del report… può richiedere qualche secondo.</div>'
      : result
        ? result.success
          ? `<div class="wf-rs-result">
               ${result.fallback ? '<span class="wf-rs-badge amber" style="display: inline-block; margin-bottom: 10px;">report deterministico · provider LLM non disponibile</span>' : '<span class="wf-rs-badge green" style="display: inline-block; margin-bottom: 10px;">sintesi LLM con note citate</span>'}
               <div class="wf-rq-stats">
                 <span><strong>${result.articles}</strong> articoli consultati</span>
                 ${result.outputPath ? `<span>report <code>${escapeHtml(result.outputPath)}</code></span>` : ''}
                 ${result.synthesisPath ? `<span>sintesi <code>${escapeHtml(result.synthesisPath)}</code></span>` : ''}
               </div>
               <div class="wf-rs-md">${renderMarkdown(result.markdown)}</div>
             </div>`
          : `<div class="wf-rs-error">${escapeHtml(result.error || 'Deep research non riuscito')}</div>`
        : '<div class="wf-rs-empty">Il report viene salvato in <code>output/</code> e in <code>wiki/synthesis/</code>, con frontmatter e matrice delle fonti.</div>';

    return `
      <div class="wf-rs-panel">
        <div class="wf-rs-panel-title">Deep Research · <code>/deep-research</code></div>
        <div class="wf-rs-field">
          <label for="wf-rq-deep-question">Domanda di ricerca</label>
          <textarea id="wf-rq-deep-question" placeholder="${escapeHtml(EXAMPLES.deep)}">${escapeHtml(this.deepQuestion)}</textarea>
        </div>
        <div class="wf-rs-actions">
          <button class="wf-rs-btn primary" id="wf-rq-deep-btn">Avvia deep research</button>
          <button class="wf-rs-btn ghost" id="wf-rq-deep-copy" ${result?.success ? '' : 'disabled'}>Copia report</button>
          <span class="wf-rq-hint">Genera un report esteso e una nota di sintesi; il file viene scritto solo se il backend risponde.</span>
        </div>
      </div>
      <div class="wf-rs-panel">
        <div class="wf-rs-panel-title">Report</div>
        ${resultHtml}
      </div>`;
  }

  private bindBodyEvents(): void {
    this.overlay.querySelector('#wf-rq-note-select')?.addEventListener('change', event => {
      const select = event.target as HTMLSelectElement;
      this.noteId = select.value || null;
      this.backlinks = null;
      this.related = null;
      this.renderShell();
      void this.loadTab(false);
    });

    this.overlay.querySelector<HTMLInputElement>('#wf-rq-search-query')?.addEventListener('input', event => {
      this.searchQuery = (event.target as HTMLInputElement).value;
    });
    this.overlay.querySelector<HTMLInputElement>('#wf-rq-search-query')?.addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        void this.runSearch();
      }
    });
    this.overlay.querySelector<HTMLTextAreaElement>('#wf-rq-consult-question')?.addEventListener('input', event => {
      this.consultQuestion = (event.target as HTMLTextAreaElement).value;
    });
    this.overlay.querySelector<HTMLInputElement>('#wf-rq-trace-query')?.addEventListener('input', event => {
      this.traceQuery = (event.target as HTMLInputElement).value;
    });
    this.overlay.querySelector<HTMLInputElement>('#wf-rq-trace-query')?.addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        void this.runTrace();
      }
    });
    this.overlay.querySelector<HTMLTextAreaElement>('#wf-rq-deep-question')?.addEventListener('input', event => {
      this.deepQuestion = (event.target as HTMLTextAreaElement).value;
    });

    this.overlay.querySelector('#wf-rq-search-btn')?.addEventListener('click', () => {
      if (this.searchQuery.trim()) void this.runSearch();
    });
    this.overlay.querySelector('#wf-rq-backlinks-btn')?.addEventListener('click', () => {
      void this.runBacklinks();
    });
    this.overlay.querySelector('#wf-rq-related-btn')?.addEventListener('click', () => {
      void this.runRelated();
    });
    this.overlay.querySelector('#wf-rq-trace-btn')?.addEventListener('click', () => {
      if (this.traceQuery.trim()) void this.runTrace();
    });
    this.overlay.querySelector('#wf-rq-consult-btn')?.addEventListener('click', () => {
      if (this.consultQuestion.trim()) void this.runConsult();
    });
    this.overlay.querySelector('#wf-rq-deep-btn')?.addEventListener('click', () => {
      if (this.deepQuestion.trim()) void this.runDeep();
    });

    this.overlay.querySelector('#wf-rq-consult-copy')?.addEventListener('click', () => {
      if (this.consult?.markdown) void this.copy(this.consult.markdown, 'Risposta copiata');
    });
    this.overlay.querySelector('#wf-rq-deep-copy')?.addEventListener('click', () => {
      if (this.deep?.markdown) void this.copy(this.deep.markdown, 'Report copiato');
    });

    this.overlay.querySelectorAll<HTMLElement>('.wf-rq-note-link').forEach(button => {
      button.addEventListener('click', () => {
        const noteId = button.getAttribute('data-note-id');
        if (!noteId) return;
        this.close();
        this.callbacks.onOpenNote?.(noteId);
      });
    });
  }

  private async copy(text: string, message: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this.feedback = message;
      this.renderBody();
    } catch (_err) {
      // Clipboard may be unavailable (non-secure context); selection still works.
    }
  }
}
