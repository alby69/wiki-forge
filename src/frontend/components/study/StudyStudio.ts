import { escapeHtml } from '@frontend/core/utils/html';
import { renderMarkdown } from '@frontend/core/utils/markdown';
import { WikiNote } from '@frontend/core/types/wiki';
import {
  StudyMindmapResponse,
  StudyOpenOptions,
  StudyOutputResponse,
  StudyPromoteResponse,
  StudyQuickNoteResponse,
  StudyQuizResponse,
  StudyScratchpadEntry,
  StudyTab,
  StudyThesisResponse,
} from '@frontend/core/types/study';
import { ApiStorage } from '@frontend/storage/ApiStorage';

export interface StudyStudioCallbacks {
  /** Opens a note in the editor and closes the modal. */
  onOpenNote?: (noteId: string) => void;
  /** Called after a note was promoted or the scratchpad changed. */
  onVaultChanged?: () => void;
}

const TABS: Array<{ id: StudyTab; label: string; icon: string; hint: string; command: string }> = [
  { id: 'guide', label: 'Guida', icon: '📝', hint: 'studio', command: '/study-guide' },
  { id: 'quiz', label: 'Quiz', icon: '🧪', hint: 'autovalutazione', command: '/quiz' },
  { id: 'mindmap', label: 'Mindmap', icon: '🧠', hint: 'mappa', command: '/mindmap' },
  { id: 'audio', label: 'Audio', icon: '🎙️', hint: 'copione', command: '/audio-overview' },
  { id: 'note', label: 'Note', icon: '📝', hint: 'scratchpad', command: '/note' },
  { id: 'promote', label: 'Promuovi', icon: '🚀', hint: 'in wiki', command: '/promote-note' },
  { id: 'thesis', label: 'Tesi', icon: '🎓', hint: 'capitolo', command: '/thesis-chapter' },
];

const EXAMPLES: Record<StudyTab, string> = {
  guide: 'Es. governance clinica',
  quiz: 'Es. intelligenza artificiale',
  mindmap: 'Es. governance-clinica (titolo o id della nota)',
  audio: 'Es. architetture agentiche',
  note: 'Es. Idea: collegare la governance clinica ai percorsi di cura.',
  promote: 'Scegli una nota veloce dallo scratchpad.',
  thesis: 'Es. Impatto degli LLM sul lavoro cognitivo',
};

/**
 * Study Studio: one modal, seven horizontal tabs matching the
 * "📚 Studio e Sintesi" agent commands.
 *
 * Every tab posts to `/api/notes/study/*`, which runs the same deterministic
 * builders as the chat commands. Artefacts are written under `output/`.
 */
export class StudyStudio {
  private overlay: HTMLElement;
  private storage: ApiStorage;
  private callbacks: StudyStudioCallbacks;
  private notes: WikiNote[] = [];

  private tab: StudyTab = 'guide';

  private guideTopic = '';
  private quizTopic = '';
  private quizCount = 5;
  private mindmapTarget = '';
  private audioTopic = '';
  private noteText = '';
  private promoteId = '';
  private promoteFolder = 'general';
  private thesisTopic = '';
  private thesisTitle = '';
  private thesisMaturity = 0;

  private guide: StudyOutputResponse | null = null;
  private guideLoading = false;

  private quiz: StudyQuizResponse | null = null;
  private quizLoading = false;

  private mindmap: StudyMindmapResponse | null = null;
  private mindmapLoading = false;

  private audio: StudyOutputResponse | null = null;
  private audioLoading = false;

  private quickNote: StudyQuickNoteResponse | null = null;
  private quickNoteLoading = false;

  private promote: StudyPromoteResponse | null = null;
  private promoteLoading = false;

  private thesis: StudyThesisResponse | null = null;
  private thesisLoading = false;

  private scratchpad: StudyScratchpadEntry[] = [];

  private feedback = '';

  constructor(storage: ApiStorage, callbacks: StudyStudioCallbacks = {}) {
    this.storage = storage;
    this.callbacks = callbacks;

    this.overlay = document.createElement('div');
    this.overlay.className = 'wf-rs-overlay wf-st-overlay';
    this.overlay.id = 'wf-study-studio';
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

  public open(options: StudyOpenOptions = {}): void {
    if (options.tab) this.tab = options.tab;

    if (options.noteId) {
      const note = this.notes.find(item => item.id === options.noteId);
      if (note) {
        if (this.tab === 'mindmap') this.mindmapTarget = note.title;
        if (this.tab === 'guide' && !this.guideTopic) this.guideTopic = note.title;
        if (this.tab === 'quiz' && !this.quizTopic) this.quizTopic = note.title;
        if (this.tab === 'audio' && !this.audioTopic) this.audioTopic = note.title;
        if (this.tab === 'thesis' && !this.thesisTopic) this.thesisTopic = note.title;
      }
    }
    if (options.topic) this.setTopic(this.tab, options.topic);

    this.feedback = '';
    this.overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    this.renderShell();
    void this.refreshScratchpad();
  }

  public close(): void {
    this.overlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  public setTab(tab: StudyTab): void {
    if (this.tab === tab) return;
    this.tab = tab;
    this.feedback = '';
    this.renderShell();
    if (tab === 'note' || tab === 'promote') void this.refreshScratchpad();
  }

  // -------------------------------------------------------------------------
  // Data loading
  // -------------------------------------------------------------------------

  private setTopic(tab: StudyTab, topic: string): void {
    if (tab === 'guide') this.guideTopic = topic;
    else if (tab === 'quiz') this.quizTopic = topic;
    else if (tab === 'mindmap') this.mindmapTarget = topic;
    else if (tab === 'audio') this.audioTopic = topic;
    else if (tab === 'note') this.noteText = topic;
    else if (tab === 'thesis') this.thesisTopic = topic;
  }

  private async refreshScratchpad(): Promise<void> {
    this.scratchpad = await this.storage.getScratchpad();
    if (!this.promoteId && this.scratchpad.length > 0) {
      this.promoteId = this.scratchpad[this.scratchpad.length - 1].id;
    }
    if (this.isOpen() && (this.tab === 'note' || this.tab === 'promote')) this.renderBody();
  }

  private async runGuide(): Promise<void> {
    this.guideLoading = true;
    this.guide = null;
    this.renderBody();
    this.guide = await this.storage.studyGuide(this.guideTopic.trim());
    this.guideLoading = false;
    this.renderBody();
  }

  private async runQuiz(): Promise<void> {
    this.quizLoading = true;
    this.quiz = null;
    this.renderBody();
    this.quiz = await this.storage.studyQuiz(this.quizTopic.trim(), this.quizCount);
    this.quizLoading = false;
    this.renderBody();
  }

  private async runMindmap(): Promise<void> {
    this.mindmapLoading = true;
    this.mindmap = null;
    this.renderBody();
    this.mindmap = await this.storage.studyMindmap(this.mindmapTarget.trim());
    this.mindmapLoading = false;
    this.renderBody();
  }

  private async runAudio(): Promise<void> {
    this.audioLoading = true;
    this.audio = null;
    this.renderBody();
    this.audio = await this.storage.studyAudioOverview(this.audioTopic.trim());
    this.audioLoading = false;
    this.renderBody();
  }

  private async runQuickNote(): Promise<void> {
    if (!this.noteText.trim()) return;
    this.quickNoteLoading = true;
    this.quickNote = null;
    this.renderBody();
    this.quickNote = await this.storage.studyQuickNote(this.noteText.trim());
    this.quickNoteLoading = false;
    if (this.quickNote.success) {
      this.noteText = '';
      this.scratchpad = this.quickNote.entries;
      this.promoteId = this.quickNote.entry?.id || this.promoteId;
      this.callbacks.onVaultChanged?.();
    }
    this.renderShell();
  }

  private async runPromote(): Promise<void> {
    if (!this.promoteId) return;
    this.promoteLoading = true;
    this.promote = null;
    this.renderBody();
    this.promote = await this.storage.studyPromoteNote(this.promoteId, this.promoteFolder.trim() || 'general');
    this.promoteLoading = false;
    if (this.promote.success) {
      this.callbacks.onVaultChanged?.();
    }
    this.renderBody();
  }

  private async runThesis(): Promise<void> {
    this.thesisLoading = true;
    this.thesis = null;
    this.renderBody();
    this.thesis = await this.storage.studyThesisChapter(this.thesisTopic.trim(), {
      title: this.thesisTitle.trim(),
      minMaturity: this.thesisMaturity,
    });
    this.thesisLoading = false;
    this.renderBody();
  }

  // -------------------------------------------------------------------------
  // Rendering
  // -------------------------------------------------------------------------

  private renderShell(): void {
    const tabMeta = TABS.find(tab => tab.id === this.tab);

    this.overlay.innerHTML = `
      <div class="wf-rs-modal" role="dialog" aria-modal="true" aria-label="Study Studio">
        <div class="wf-rs-header">
          <div>
            <h2><span class="dot"></span> Study Studio</h2>
            <div class="wf-rs-subtitle">
              <strong>Knowledge base</strong>
              <code>${this.notes.length} note</code>
              <span>· studio e sintesi</span>
              <span>· scratchpad <code>${this.scratchpad.length}</code></span>
            </div>
          </div>
          <button class="wf-rs-close" id="wf-st-close" title="Chiudi (Esc)">✕</button>
        </div>
        <div class="wf-rs-tabs" role="tablist">
          ${TABS.map(tab => `
            <button class="wf-rs-tab wf-st-tab${this.tab === tab.id ? ' active' : ''}"
                    role="tab"
                    aria-selected="${this.tab === tab.id}"
                    data-st-tab="${tab.id}"
                    title="${tab.command}">
              <span aria-hidden="true">${tab.icon}</span>${tab.label}
              <span class="hint">${tab.hint}</span>
            </button>`).join('')}
        </div>
        <div class="wf-rs-body" id="wf-st-body"></div>
      </div>`;

    this.overlay.querySelector('#wf-st-close')?.addEventListener('click', () => this.close());
    this.overlay.querySelectorAll<HTMLElement>('.wf-st-tab').forEach(button => {
      button.addEventListener('click', () => {
        const tab = button.getAttribute('data-st-tab') as StudyTab | null;
        if (tab) this.setTab(tab);
      });
    });

    const modal = this.overlay.querySelector('.wf-rs-modal');
    if (modal) modal.setAttribute('data-command', tabMeta?.command || '');

    this.renderBody();
  }

  private renderBody(): void {
    const host = this.overlay.querySelector<HTMLElement>('#wf-st-body');
    if (!host) return;

    if (this.tab === 'guide') host.innerHTML = this.renderGuideTab();
    else if (this.tab === 'quiz') host.innerHTML = this.renderQuizTab();
    else if (this.tab === 'mindmap') host.innerHTML = this.renderMindmapTab();
    else if (this.tab === 'audio') host.innerHTML = this.renderAudioTab();
    else if (this.tab === 'note') host.innerHTML = this.renderNoteTab();
    else if (this.tab === 'promote') host.innerHTML = this.renderPromoteTab();
    else host.innerHTML = this.renderThesisTab();

    if (this.feedback) {
      const feedback = document.createElement('div');
      feedback.className = 'wf-st-feedback';
      feedback.textContent = this.feedback;
      host.appendChild(feedback);
    }

    this.bindBodyEvents();
  }

  private renderSources(sources: Array<{ id: string; title: string; path: string }>): string {
    if (sources.length === 0) return '';
    return `
      <div class="wf-rs-panel" style="margin-top: 14px;">
        <div class="wf-rs-panel-title">Note usate come fonte</div>
        <div class="wf-st-sources">
          ${sources.map(source => `
            <button class="wf-st-note-link" data-note-id="${escapeHtml(source.id)}" title="${escapeHtml(source.path)}">
              ${escapeHtml(source.title)}
              <code>${escapeHtml(source.path)}</code>
            </button>`).join('')}
        </div>
      </div>`;
  }

  private renderOutput(
    result: StudyOutputResponse | null,
    loading: boolean,
    loadingText: string,
    emptyText: string,
    copyLabel: string,
    copyId: string
  ): string {
    if (loading) return `<div class="wf-rs-loading">${loadingText}</div>`;
    if (!result) return `<div class="wf-rs-empty">${emptyText}</div>`;
    if (!result.success) {
      return `<div class="wf-rs-error">${escapeHtml(result.error || 'Generazione non riuscita')}</div>`;
    }

    return `
      <div class="wf-rs-result">
        <div class="wf-st-stats">
          <span>file <code>${escapeHtml(result.outputPath)}</code></span>
          <span><strong>${result.sources.length}</strong> fonti</span>
        </div>
        <div class="wf-st-actions-inline">
          <button class="wf-rs-btn ghost" id="${copyId}" data-copy="${escapeHtml(result.markdown)}">${copyLabel}</button>
        </div>
        <div class="wf-rs-md">${renderMarkdown(result.markdown)}</div>
        ${this.renderSources(result.sources)}
      </div>`;
  }

  private renderGuideTab(): string {
    return `
      <div class="wf-rs-panel">
        <div class="wf-rs-panel-title">Guida di studio · <code>/study-guide [argomento]</code></div>
        <div class="wf-rs-field">
          <label for="wf-st-guide-topic">Argomento</label>
          <input type="text" id="wf-st-guide-topic" value="${escapeHtml(this.guideTopic)}" placeholder="${escapeHtml(EXAMPLES.guide)}" />
        </div>
        <div class="wf-rs-actions">
          <button class="wf-rs-btn primary" id="wf-st-guide-btn">Genera guida</button>
          <span class="wf-st-hint">Sintesi, sezioni, glossario e domande di autovalutazione dalle note più pertinenti.</span>
        </div>
      </div>
      <div class="wf-rs-panel">
        <div class="wf-rs-panel-title">Guida</div>
        ${this.renderOutput(this.guide, this.guideLoading, 'Costruzione della guida di studio…', 'Scegli un argomento e genera una guida dalle note della wiki.', 'Copia guida', 'wf-st-guide-copy')}
      </div>`;
  }

  private renderQuizTab(): string {
    const result = this.quiz;
    const summary = result?.success
      ? `<div class="wf-st-stats"><span><strong>${result.count}</strong> domande</span><span>${result.sources.length} fonti</span></div>`
      : '';

    return `
      <div class="wf-rs-panel">
        <div class="wf-rs-panel-title">Quiz di autovalutazione · <code>/quiz [argomento] [n]</code></div>
        <div class="wf-rs-row">
          <div class="wf-rs-field" style="flex: 1 1 320px;">
            <label for="wf-st-quiz-topic">Argomento</label>
            <input type="text" id="wf-st-quiz-topic" value="${escapeHtml(this.quizTopic)}" placeholder="${escapeHtml(EXAMPLES.quiz)}" />
          </div>
          <div class="wf-rs-field" style="flex: 0 0 120px;">
            <label for="wf-st-quiz-count">Domande</label>
            <input type="number" id="wf-st-quiz-count" min="1" max="25" value="${this.quizCount}" />
          </div>
          <div class="wf-rs-field" style="flex: 0 0 auto;">
            <label>&nbsp;</label>
            <button class="wf-rs-btn primary" id="wf-st-quiz-btn">Genera quiz</button>
          </div>
        </div>
        ${summary}
      </div>
      <div class="wf-rs-panel">
        <div class="wf-rs-panel-title">Quiz</div>
        ${this.renderOutput(result, this.quizLoading, 'Preparazione delle domande a risposta multipla…', 'Scegli un argomento e quante domande generare (1–25).', 'Copia quiz', 'wf-st-quiz-copy')}
      </div>`;
  }

  private renderMindmapTab(): string {
    const result = this.mindmap;
    const noteOptions = this.notes
      .slice()
      .sort((a, b) => a.title.localeCompare(b.title))
      .map(note => `<option value="${escapeHtml(note.title)}" ${note.title === this.mindmapTarget ? 'selected' : ''}>${escapeHtml(note.title)} · ${escapeHtml(note.folder || 'wiki')}</option>`)
      .join('');

    const stats = result?.success
      ? `<div class="wf-st-stats">
           <span><strong>${result.headings}</strong> sezioni</span>
           <span><strong>${result.wikilinks}</strong> wikilink</span>
           ${result.note ? `<span>radice <code>${escapeHtml(result.note.path)}</code></span>` : ''}
         </div>`
      : '';

    return `
      <div class="wf-rs-panel">
        <div class="wf-rs-panel-title">Mappa concettuale · <code>/mindmap [nota]</code></div>
        <div class="wf-rs-field">
          <label for="wf-st-mindmap-note">Nota di partenza</label>
          <select id="wf-st-mindmap-note">${noteOptions}</select>
        </div>
        <div class="wf-rs-field">
          <label for="wf-st-mindmap-target">Oppure titolo / id</label>
          <input type="text" id="wf-st-mindmap-target" value="${escapeHtml(this.mindmapTarget)}" placeholder="${escapeHtml(EXAMPLES.mindmap)}" />
        </div>
        <div class="wf-rs-actions">
          <button class="wf-rs-btn primary" id="wf-st-mindmap-btn">Genera mindmap</button>
          <span class="wf-st-hint">Albero gerarchico dei titoli più il payload JSON per il grafo.</span>
        </div>
        ${stats}
      </div>
      <div class="wf-rs-panel">
        <div class="wf-rs-panel-title">Mappa</div>
        ${this.renderOutput(result, this.mindmapLoading, 'Estrazione di titoli e collegamenti…', 'Scegli la nota da cui partire: la mappa segue i suoi titoli e i wikilink uscenti.', 'Copia mindmap', 'wf-st-mindmap-copy')}
      </div>`;
  }

  private renderAudioTab(): string {
    return `
      <div class="wf-rs-panel">
        <div class="wf-rs-panel-title">Copione audio · <code>/audio-overview [argomento]</code></div>
        <div class="wf-rs-field">
          <label for="wf-st-audio-topic">Argomento</label>
          <input type="text" id="wf-st-audio-topic" value="${escapeHtml(this.audioTopic)}" placeholder="${escapeHtml(EXAMPLES.audio)}" />
        </div>
        <div class="wf-rs-actions">
          <button class="wf-rs-btn primary" id="wf-st-audio-btn">Genera copione</button>
          <span class="wf-st-hint">Dialogo Host A / Host B pronto per la sintesi vocale (TTS disabilitato di default).</span>
        </div>
      </div>
      <div class="wf-rs-panel">
        <div class="wf-rs-panel-title">Copione</div>
        ${this.renderOutput(this.audio, this.audioLoading, 'Scrittura del dialogo audio…', 'Scegli un argomento per generare il copione in stile podcast.', 'Copia copione', 'wf-st-audio-copy')}
      </div>`;
  }

  private renderNoteTab(): string {
    const entries = this.scratchpad
      .slice()
      .reverse()
      .map(entry => `
        <div class="wf-st-entry">
          <div class="wf-st-entry-head">
            <span class="wf-st-badge">${escapeHtml(entry.timestamp)}</span>
            <code>${escapeHtml(entry.id)}</code>
          </div>
          <pre>${escapeHtml(entry.text)}</pre>
        </div>`)
      .join('');

    const resultMessage = this.quickNote
      ? this.quickNote.success
        ? `<div class="wf-st-feedback-inline">Nota salvata nello scratchpad${this.quickNote.entry ? ` · id <code>${escapeHtml(this.quickNote.entry.id)}</code>` : ''}.</div>`
        : `<div class="wf-rs-error">${escapeHtml(this.quickNote.error || 'Salvataggio non riuscito')}</div>`
      : '';

    return `
      <div class="wf-rs-panel">
        <div class="wf-rs-panel-title">Nota veloce · <code>/note &lt;testo&gt;</code></div>
        <div class="wf-rs-field">
          <label for="wf-st-note-text">Testo della nota</label>
          <textarea id="wf-st-note-text" placeholder="${escapeHtml(EXAMPLES.note)}">${escapeHtml(this.noteText)}</textarea>
        </div>
        <div class="wf-rs-actions">
          <button class="wf-rs-btn primary" id="wf-st-note-btn" ${this.quickNoteLoading ? 'disabled' : ''}>${this.quickNoteLoading ? 'Salvataggio…' : 'Salva nello scratchpad'}</button>
          <span class="wf-st-hint">Le note restano fuori da <code>wiki/index.md</code> finché non vengono promosse.</span>
        </div>
        ${resultMessage}
      </div>
      <div class="wf-rs-panel">
        <div class="wf-rs-panel-title">Scratchpad · <code>notes/quick-notes.md</code> (${this.scratchpad.length})</div>
        ${entries || '<div class="wf-rs-empty">Nessuna nota veloce: qui compariranno le voci salvate.</div>'}
      </div>`;
  }

  private renderPromoteTab(): string {
    const options = this.scratchpad
      .slice()
      .reverse()
      .map(entry => `<option value="${escapeHtml(entry.id)}" ${entry.id === this.promoteId ? 'selected' : ''}>${escapeHtml(entry.timestamp)} · ${escapeHtml(entry.text.split('\n')[0].slice(0, 60))}</option>`)
      .join('');

    const result = this.promote;
    const resultHtml = this.promoteLoading
      ? '<div class="wf-rs-loading">Promozione della nota in un articolo della wiki…</div>'
      : result
        ? result.success
          ? `<div class="wf-st-feedback-inline">Articolo creato${result.note ? `: <strong>${escapeHtml(result.note.title)}</strong> · <code>${escapeHtml(result.note.path)}</code>` : ''}.</div>`
          : `<div class="wf-rs-error">${escapeHtml(result.error || 'Promozione non riuscita')}</div>`
        : '<div class="wf-rs-empty">Scegli una voce dello scratchpad e la cartella wiki di destinazione.</div>';

    return `
      <div class="wf-rs-panel">
        <div class="wf-rs-panel-title">Promuovi nota · <code>/promote-note &lt;id&gt; [cartella]</code></div>
        <div class="wf-rs-row">
          <div class="wf-rs-field" style="flex: 1 1 320px;">
            <label for="wf-st-promote-id">Nota veloce</label>
            ${options ? `<select id="wf-st-promote-id">${options}</select>` : '<div class="wf-rs-empty">Scratchpad vuoto.</div>'}
          </div>
          <div class="wf-rs-field" style="flex: 0 0 200px;">
            <label for="wf-st-promote-folder">Cartella wiki</label>
            <input type="text" id="wf-st-promote-folder" value="${escapeHtml(this.promoteFolder)}" placeholder="general" />
          </div>
          <div class="wf-rs-field" style="flex: 0 0 auto;">
            <label>&nbsp;</label>
            <button class="wf-rs-btn primary" id="wf-st-promote-btn" ${options ? '' : 'disabled'}>Promuovi</button>
          </div>
        </div>
        <div class="wf-rs-actions">
          <span class="wf-st-hint">Crea l'articolo, aggiorna l'indice tematico e quello principale.</span>
        </div>
      </div>
      <div class="wf-rs-panel">
        <div class="wf-rs-panel-title">Esito</div>
        ${resultHtml}
      </div>`;
  }

  private renderThesisTab(): string {
    const result = this.thesis;
    const stats = result?.success
      ? `<div class="wf-st-stats">
           <span><strong>${result.chapters.length}</strong> capitoli</span>
           <span><strong>${result.syntheses.length}</strong> sintesi</span>
           <span>file <code>${escapeHtml(result.outputPath)}</code></span>
         </div>
         ${result.chapters.length > 0 ? `
           <div class="wf-st-list">
             ${result.chapters.map(chapter => `
               <div class="wf-st-list-item">
                 <span class="wf-st-badge">${chapter.number < 999 ? `Cap. ${chapter.number}` : 'Cap.'}</span>
                 <span>${escapeHtml(chapter.title)}</span>
                 <code>${escapeHtml(chapter.path)}</code>
                 <span class="wf-st-maturity">${chapter.maturity}/100</span>
               </div>`).join('')}
           </div>` : ''}
         ${result.syntheses.length > 0 ? `
           <div class="wf-st-list">
             ${result.syntheses.map(synthesis => `
               <div class="wf-st-list-item">
                 <span class="wf-st-badge alt">${escapeHtml(synthesis.type)}</span>
                 <span>${escapeHtml(synthesis.title)}</span>
                 <code>${escapeHtml(synthesis.path)}</code>
                 <span class="wf-st-maturity">${synthesis.maturity}/100</span>
               </div>`).join('')}
           </div>` : ''}`
      : '';

    return `
      <div class="wf-rs-panel">
        <div class="wf-rs-panel-title">Capitolo di tesi · <code>/thesis-chapter [argomento]</code></div>
        <div class="wf-rs-row">
          <div class="wf-rs-field" style="flex: 1 1 320px;">
            <label for="wf-st-thesis-topic">Argomento</label>
            <input type="text" id="wf-st-thesis-topic" value="${escapeHtml(this.thesisTopic)}" placeholder="${escapeHtml(EXAMPLES.thesis)}" />
          </div>
          <div class="wf-rs-field" style="flex: 0 0 120px;">
            <label for="wf-st-thesis-maturity">Maturità min.</label>
            <input type="number" id="wf-st-thesis-maturity" min="0" max="100" value="${this.thesisMaturity}" />
          </div>
        </div>
        <div class="wf-rs-field">
          <label for="wf-st-thesis-title">Titolo della bozza (opzionale)</label>
          <input type="text" id="wf-st-thesis-title" value="${escapeHtml(this.thesisTitle)}" placeholder="Es. Tesi di Laurea" />
        </div>
        <div class="wf-rs-actions">
          <button class="wf-rs-btn primary" id="wf-st-thesis-btn">Compila capitolo</button>
          <span class="wf-st-hint">Unisce i capitoli (<code>tipo: capitolo_tesi</code>) e le sintesi sopra la soglia di maturità.</span>
        </div>
        ${stats}
      </div>
      <div class="wf-rs-panel">
        <div class="wf-rs-panel-title">Bozza</div>
        ${this.renderOutput(result, this.thesisLoading, 'Aggregazione di capitoli e sintesi…', 'Imposta argomento e soglia, poi compila la bozza del capitolo.', 'Copia bozza', 'wf-st-thesis-copy')}
      </div>`;
  }

  private bindBodyEvents(): void {
    this.overlay.querySelector<HTMLInputElement>('#wf-st-guide-topic')?.addEventListener('input', event => {
      this.guideTopic = (event.target as HTMLInputElement).value;
    });
    this.overlay.querySelector<HTMLInputElement>('#wf-st-guide-topic')?.addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        void this.runGuide();
      }
    });
    this.overlay.querySelector('#wf-st-guide-btn')?.addEventListener('click', () => void this.runGuide());

    this.overlay.querySelector<HTMLInputElement>('#wf-st-quiz-topic')?.addEventListener('input', event => {
      this.quizTopic = (event.target as HTMLInputElement).value;
    });
    this.overlay.querySelector<HTMLInputElement>('#wf-st-quiz-topic')?.addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        void this.runQuiz();
      }
    });
    this.overlay.querySelector<HTMLInputElement>('#wf-st-quiz-count')?.addEventListener('change', event => {
      const parsed = Number.parseInt((event.target as HTMLInputElement).value, 10);
      this.quizCount = Number.isFinite(parsed) ? Math.max(1, Math.min(25, parsed)) : 5;
    });
    this.overlay.querySelector('#wf-st-quiz-btn')?.addEventListener('click', () => void this.runQuiz());

    this.overlay.querySelector<HTMLSelectElement>('#wf-st-mindmap-note')?.addEventListener('change', event => {
      this.mindmapTarget = (event.target as HTMLSelectElement).value;
    });
    this.overlay.querySelector<HTMLInputElement>('#wf-st-mindmap-target')?.addEventListener('input', event => {
      this.mindmapTarget = (event.target as HTMLInputElement).value;
    });
    this.overlay.querySelector('#wf-st-mindmap-btn')?.addEventListener('click', () => void this.runMindmap());

    this.overlay.querySelector<HTMLInputElement>('#wf-st-audio-topic')?.addEventListener('input', event => {
      this.audioTopic = (event.target as HTMLInputElement).value;
    });
    this.overlay.querySelector<HTMLInputElement>('#wf-st-audio-topic')?.addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        void this.runAudio();
      }
    });
    this.overlay.querySelector('#wf-st-audio-btn')?.addEventListener('click', () => void this.runAudio());

    this.overlay.querySelector<HTMLTextAreaElement>('#wf-st-note-text')?.addEventListener('input', event => {
      this.noteText = (event.target as HTMLTextAreaElement).value;
    });
    this.overlay.querySelector('#wf-st-note-btn')?.addEventListener('click', () => void this.runQuickNote());

    this.overlay.querySelector<HTMLSelectElement>('#wf-st-promote-id')?.addEventListener('change', event => {
      this.promoteId = (event.target as HTMLSelectElement).value;
    });
    this.overlay.querySelector<HTMLInputElement>('#wf-st-promote-folder')?.addEventListener('input', event => {
      this.promoteFolder = (event.target as HTMLInputElement).value;
    });
    this.overlay.querySelector('#wf-st-promote-btn')?.addEventListener('click', () => void this.runPromote());

    this.overlay.querySelector<HTMLInputElement>('#wf-st-thesis-topic')?.addEventListener('input', event => {
      this.thesisTopic = (event.target as HTMLInputElement).value;
    });
    this.overlay.querySelector<HTMLInputElement>('#wf-st-thesis-title')?.addEventListener('input', event => {
      this.thesisTitle = (event.target as HTMLInputElement).value;
    });
    this.overlay.querySelector<HTMLInputElement>('#wf-st-thesis-maturity')?.addEventListener('change', event => {
      const parsed = Number.parseInt((event.target as HTMLInputElement).value, 10);
      this.thesisMaturity = Number.isFinite(parsed) ? Math.max(0, Math.min(100, parsed)) : 0;
    });
    this.overlay.querySelector('#wf-st-thesis-btn')?.addEventListener('click', () => void this.runThesis());

    this.overlay.querySelectorAll<HTMLElement>('[data-copy]').forEach(button => {
      button.addEventListener('click', () => {
        const text = button.getAttribute('data-copy');
        if (text) void this.copy(text, 'Contenuto copiato negli appunti');
      });
    });

    this.overlay.querySelectorAll<HTMLElement>('.wf-st-note-link').forEach(button => {
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
