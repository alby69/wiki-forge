import { ApiStorage, HelpTopicMeta } from '@frontend/storage/ApiStorage';
import { renderMarkdown } from '@frontend/core/utils/markdown';
import { getHelpContext, onHelpContextChange } from '@frontend/core/helpContext';
import { appStore } from '@frontend/store/appStore';

export interface HelpPanelOptions {
  storage: ApiStorage;
  onAskAgent?: (question: string) => void;
}

const DEFAULT_TOPIC_ID = 'inizio';

/**
 * In-app help panel (opened with F1 or the "?" button in the header).
 *
 * Content comes from `docs/help/*.md` through `/api/help` (deterministic, no
 * LLM). On open it preselects the topic most relevant to what the user is
 * doing right now (helpContext registry + current view/mode) and offers to
 * hand the question over to the agent chat.
 */
export class HelpPanel {
  private storage: ApiStorage;
  private onAskAgentCb?: (question: string) => void;
  private overlay: HTMLElement;
  private topics: HelpTopicMeta[] = [];
  private contentCache = new Map<string, string>();
  private selectedId: string | null = null;
  private suggestedId: string | null = null;
  private query = '';
  private isOpen = false;
  private loadingTopics = false;
  private loadingContentId: string | null = null;
  private contentError = false;
  private unsubscribeContext?: () => void;

  constructor(options: HelpPanelOptions) {
    this.storage = options.storage;
    this.onAskAgentCb = options.onAskAgent;

    this.overlay = document.createElement('div');
    this.overlay.className = 'wf-modal-overlay';
    this.overlay.id = 'help-panel-modal';
    this.overlay.style.display = 'none';
    this.overlay.addEventListener('click', e => {
      if (e.target === this.overlay) this.close();
    });
    document.body.appendChild(this.overlay);

    document.addEventListener('keydown', e => {
      if (e.key === 'F1') {
        e.preventDefault();
        void this.toggle();
      } else if (e.key === 'Escape' && this.isOpen) {
        this.close();
      }
    });

    this.unsubscribeContext = onHelpContextChange(() => {
      if (!this.isOpen) return;
      this.suggestedId = this.resolveSuggestedTopic()?.id ?? null;
      this.renderList();
    });
  }

  public async toggle(): Promise<void> {
    if (this.isOpen) {
      this.close();
    } else {
      await this.open();
    }
  }

  public async open(): Promise<void> {
    this.isOpen = true;
    this.overlay.style.display = 'flex';
    this.query = '';

    if (this.topics.length === 0 && !this.loadingTopics) {
      this.loadingTopics = true;
      this.renderShell();
      this.topics = await this.storage.getHelpTopics();
      this.loadingTopics = false;
    }

    this.suggestedId = this.resolveSuggestedTopic()?.id ?? null;

    const firstExisting = (...ids: (string | null | undefined)[]): string | null => {
      for (const id of ids) {
        if (id && this.topics.some(t => t.id === id)) return id;
      }
      return null;
    };

    const wanted = firstExisting(
      this.selectedId,
      this.suggestedId,
      DEFAULT_TOPIC_ID,
      this.topics[0]?.id ?? null
    );

    this.renderShell();
    if (wanted) {
      await this.selectTopic(wanted);
    }
  }

  public close(): void {
    this.isOpen = false;
    this.overlay.style.display = 'none';
  }

  public isOpened(): boolean {
    return this.isOpen;
  }

  public destroy(): void {
    if (this.unsubscribeContext) this.unsubscribeContext();
    this.overlay.remove();
  }

  private resolveSuggestedTopic(): HelpTopicMeta | null {
    if (this.topics.length === 0) return null;
    const byId = (id: string): HelpTopicMeta | null => this.topics.find(t => t.id === id) ?? null;

    const ctx = getHelpContext();
    if (ctx) {
      const byContext = this.topics.find(t => t.context.includes(ctx));
      if (byContext) return byContext;
    }

    const { isAdvancedMode, viewMode } = appStore.getState();
    if (viewMode === 'graph' || viewMode === 'split' || viewMode === 'scratchpad') {
      const byView = byId('viste-grafo');
      if (byView) return byView;
    }
    if (isAdvancedMode) {
      const devTopic = byId('modalita-dev');
      if (devTopic) return devTopic;
    }
    return byId(DEFAULT_TOPIC_ID) ?? this.topics[0];
  }

  public async selectTopic(id: string): Promise<void> {
    const topic = this.topics.find(t => t.id === id);
    if (!topic) return;
    this.selectedId = id;
    this.contentError = false;
    this.renderList();

    if (!this.contentCache.has(id)) {
      this.loadingContentId = id;
      this.renderContent();
      const full = await this.storage.getHelpTopic(id);
      this.loadingContentId = null;
      if (full) {
        this.contentCache.set(id, full.markdown);
      } else {
        this.contentError = true;
      }
    }

    if (this.isOpen) this.renderContent();
  }

  private renderShell(): void {
    this.overlay.innerHTML = `
      <div class="wf-modal-content" style="width: min(920px, 94vw); height: min(640px, 88vh); display: flex; flex-direction: column;">
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 18px; border-bottom: 1px solid #2d3748; flex-shrink: 0;">
          <div style="display: flex; align-items: center; gap: 10px; min-width: 0;">
            <span style="font-size: 18px;">❓</span>
            <div style="min-width: 0;">
              <div style="font-size: 15px; font-weight: 700; color: #f8fafc;">Guida Wiki-Forge</div>
              <div style="font-size: 11px; color: #94a3b8;">Guida in-app · premi <b>F1</b> per aprirla o chiuderla ovunque</div>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <input id="help-search-input" type="search" placeholder="Cerca un argomento..." value="${this.escapedQuery()}"
              style="width: 220px; background: #1e293b; border: 1px solid #334155; border-radius: 8px; color: #f8fafc; padding: 6px 10px; font-size: 12px; outline: none;" />
            <button id="help-close-btn" title="Chiudi (Esc)" style="background: none; border: none; color: #94a3b8; font-size: 20px; cursor: pointer; line-height: 1; padding: 0 2px;">&times;</button>
          </div>
        </div>
        <div style="flex: 1; display: flex; overflow: hidden; min-height: 0;">
          <div id="help-topics-list" style="width: 250px; flex-shrink: 0; overflow-y: auto; border-right: 1px solid #2d3748; background: #12141a; padding: 8px; box-sizing: border-box;"></div>
          <div id="help-topic-content" style="flex: 1; overflow-y: auto; padding: 18px 22px; box-sizing: border-box; font-size: 13px; line-height: 1.6; color: #cbd5e1;"></div>
        </div>
      </div>
    `;

    const closeBtn = this.overlay.querySelector('#help-close-btn');
    closeBtn?.addEventListener('click', () => this.close());

    const searchInput = this.overlay.querySelector('#help-search-input') as HTMLInputElement | null;
    searchInput?.addEventListener('input', () => {
      this.query = searchInput.value;
      this.renderList();
    });

    this.renderList();
    this.renderContent();
  }

  private escapedQuery(): string {
    return this.query
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private filteredTopics(): HelpTopicMeta[] {
    const q = this.query.toLowerCase().trim();
    if (!q) return this.topics;
    return this.topics.filter(
      t =>
        t.title.toLowerCase().includes(q) ||
        t.id.includes(q.replace(/\s+/g, '-')) ||
        t.group.toLowerCase().includes(q) ||
        t.keywords.some(k => k.toLowerCase().includes(q))
    );
  }

  private renderList(): void {
    const host = this.overlay.querySelector('#help-topics-list');
    if (!host) return;

    if (this.loadingTopics) {
      host.innerHTML = `<div style="color: #64748b; font-size: 12px; padding: 10px;">Caricamento argomenti...</div>`;
      return;
    }

    const visible = this.filteredTopics();
    if (visible.length === 0) {
      host.innerHTML = `<div style="color: #64748b; font-size: 12px; padding: 10px;">Nessun argomento per "<b>${this.escapeHtml(this.query)}</b>".</div>`;
      return;
    }

    let currentGroup = '';
    let html = '';
    for (const topic of visible) {
      if (topic.group !== currentGroup) {
        currentGroup = topic.group;
        html += `<div style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; color: #64748b; margin: 12px 6px 4px;">${this.escapeHtml(currentGroup)}</div>`;
      }
      const isActive = topic.id === this.selectedId;
      const isSuggested = topic.id === this.suggestedId;
      html += `
        <div class="help-topic-item" data-topic-id="${topic.id}"
          style="display: flex; align-items: center; gap: 7px; padding: 7px 8px; border-radius: 7px; cursor: pointer; font-size: 12.5px; margin-bottom: 2px;
                 background: ${isActive ? '#1d4ed8' : 'transparent'}; color: ${isActive ? '#ffffff' : '#cbd5e1'}; font-weight: ${isActive ? 600 : 400};">
          <span style="flex-shrink: 0;">${topic.icon}</span>
          <span style="flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${this.escapeHtml(topic.title)}</span>
          ${isSuggested ? `<span title="Argomento più rilevante in base a ciò che stai facendo ora" style="flex-shrink: 0; font-size: 10px;">⭐</span>` : ''}
        </div>`;
    }

    if (this.suggestedId && visible.some(t => t.id === this.suggestedId)) {
      html += `<div style="font-size: 10px; color: #64748b; margin: 14px 6px 6px; border-top: 1px solid #2d3748; padding-top: 8px;">⭐ = rilevante in base a ciò che stai facendo ora</div>`;
    }

    host.innerHTML = html;

    host.querySelectorAll<HTMLElement>('.help-topic-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = item.getAttribute('data-topic-id');
        if (id) void this.selectTopic(id);
      });
      item.addEventListener('mouseenter', () => {
        if (item.getAttribute('data-topic-id') !== this.selectedId) {
          item.style.background = '#1e293b';
        }
      });
      item.addEventListener('mouseleave', () => {
        const id = item.getAttribute('data-topic-id');
        item.style.background = id === this.selectedId ? '#1d4ed8' : 'transparent';
      });
    });
  }

  private renderContent(): void {
    const host = this.overlay.querySelector('#help-topic-content');
    if (!host) return;

    if (this.loadingTopics) {
      host.innerHTML = `<div style="color: #64748b;">Caricamento della guida...</div>`;
      return;
    }

    const topic = this.topics.find(t => t.id === this.selectedId);
    if (!topic) {
      host.innerHTML = `
        <div style="color: #94a3b8;">
          <div style="font-size: 24px; margin-bottom: 8px;">❓</div>
          <div style="font-size: 14px; font-weight: 600; color: #cbd5e1; margin-bottom: 6px;">Nessun argomento disponibile</div>
          <div style="font-size: 12px;">I contenuti della guida non sono stati trovati. Verifica che la cartella <code>docs/help/</code> sia presente nel progetto.</div>
        </div>`;
      return;
    }

    if (this.loadingContentId === topic.id) {
      host.innerHTML = `
        <div style="color: #94a3b8; font-size: 13px;">⏳ Caricamento "${this.escapeHtml(topic.title)}"...</div>`;
      return;
    }

    if (this.contentError) {
      host.innerHTML = `
        <div style="color: #f6ad55; font-size: 13px;">Impossibile caricare l'argomento "${this.escapeHtml(topic.title)}". Riprova più tardi.</div>`;
      return;
    }

    const markdown = this.contentCache.get(topic.id) ?? '';
    const body = renderMarkdown(markdown);

    host.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 12px; flex-wrap: wrap;">
        <div style="display: flex; align-items: center; gap: 8px; min-width: 0;">
          <span style="font-size: 17px;">${topic.icon}</span>
          <span style="font-size: 15px; font-weight: 700; color: #f8fafc;">${this.escapeHtml(topic.title)}</span>
          ${topic.id === this.suggestedId ? `<span style="font-size: 10px; background: #3b2f0b; color: #fbd38d; border: 1px solid #975a16; padding: 2px 7px; border-radius: 999px; white-space: nowrap;">⭐ Rilevante ora</span>` : ''}
        </div>
        <div style="font-size: 10px; color: #64748b; white-space: nowrap;">${this.escapeHtml(topic.group)}</div>
      </div>
      <div class="help-body" style="max-width: 720px;">${body}</div>
      <div style="margin-top: 22px; padding-top: 14px; border-top: 1px solid #2d3748; display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap;">
        <span style="font-size: 11px; color: #64748b;">Non trovi la risposta tra gli argomenti?</span>
        <button id="help-ask-agent-btn" style="background: #4338ca; color: #fff; border: none; padding: 7px 14px; border-radius: 7px; font-size: 12px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px;">
          💬 Chiedi all'agente
        </button>
      </div>
      <div style="margin-top: 10px; font-size: 10.5px; color: #475569;">
        Approfondisci: <code>docs/help/${topic.id}.md</code> · anche in chat con <code>/help ${topic.id}</code>
      </div>
    `;

    const askBtn = host.querySelector('#help-ask-agent-btn');
    askBtn?.addEventListener('click', () => {
      const question = `Dimmi di più su: "${topic.title}" (argomento della guida Wiki-Forge, docs/help/${topic.id}.md)`;
      this.close();
      this.onAskAgentCb?.(question);
    });
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
