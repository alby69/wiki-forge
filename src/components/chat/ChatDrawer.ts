import { WikiNote } from '../../core/types/wiki';
import { renderMarkdown } from '../../core/utils/markdown';
import { ApiStorage, AttachOptions } from '../../storage/ApiStorage';
import { appStore } from '../../store/appStore';
import { AttachModal } from './AttachModal';
import { COMMAND_CATALOG } from './commandCatalog';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

const STORAGE_KEY = 'wiki-forge:chat-history';
const CHAT_WIDTH_KEY = 'wiki-forge:chat-width';
const CHAT_MIN_WIDTH = 320;

export class ChatDrawer {
  private container: HTMLElement;
  private apiStorage: ApiStorage;
  private isOpen: boolean = false;
  private commandsOpen: boolean = false;
  private isMaximized: boolean = false;
  private chatWidth: number = 380;
  private isResizingChat: boolean = false;
  private messages: ChatMessage[] = [];
  private notesGetter: () => WikiNote[];
  private onAttachSuccessCb?: () => void;
  private onOpenLinkCb?: (target: string) => void;

  constructor(
    container: HTMLElement,
    apiStorage: ApiStorage,
    notesGetter: () => WikiNote[],
    onAttachSuccess?: () => void,
    onOpenLink?: (target: string) => void
  ) {
    this.container = container;
    this.apiStorage = apiStorage;
    this.notesGetter = notesGetter;
    this.onAttachSuccessCb = onAttachSuccess;
    this.onOpenLinkCb = onOpenLink;

    this.loadHistory();
    this.loadChatWidth();
    this.render();

    appStore.subscribe(() => {
      this.render();
    });

    if (typeof document !== 'undefined') {
      document.addEventListener('click', e => this.handleDocumentClick(e));
      document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && this.isMaximized) {
          this.setMaximized(false);
        }
      });
    }
  }

  private loadChatWidth(): void {
    try {
      const saved = localStorage.getItem(CHAT_WIDTH_KEY);
      if (saved) {
        const w = Number.parseInt(saved, 10);
        if (Number.isFinite(w) && w >= CHAT_MIN_WIDTH) {
          this.chatWidth = w;
        }
      }
    } catch (_e) {
      // fallback
    }
  }

  private saveChatWidth(): void {
    try {
      localStorage.setItem(CHAT_WIDTH_KEY, String(this.chatWidth));
    } catch (_e) {
      // fallback
    }
  }

  private handleDocumentClick(e: MouseEvent): void {
    if (!this.commandsOpen) return;
    const target = e.target as HTMLElement | null;
    if (target && (target.closest('#chat-commands-panel') || target.closest('#chat-commands-toggle'))) {
      return;
    }
    this.setCommandsOpen(false);
  }

  private loadHistory(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved) as ChatMessage[];
          if (Array.isArray(parsed) && parsed.length > 0) {
            this.messages = parsed;
            return;
          }
        }
      }
    } catch (_e) {
      // fallback
    }

    this.messages = [
      {
        id: 'welcome',
        sender: 'assistant',
        text: '### 🤖 Wiki-Forge Agent Assistant\n\nBenvenuto! Come posso aiutarti con la tua Knowledge Base?\n\nScegli un\'azione rapida qui sotto o fai una domanda.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ];
  }

  private saveHistory(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.messages));
      }
    } catch (_e) {
      // fallback
    }
  }

  public clearHistory(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (_e) {
      // fallback
    }

    this.messages = [
      {
        id: 'welcome',
        sender: 'assistant',
        text: '### 🤖 Wiki-Forge Agent Assistant\n\nBenvenuto! Come posso aiutarti con la tua Knowledge Base?\n\nScegli un\'azione rapida qui sotto o fai una domanda.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ];
    this.render();
  }

  public toggle(): void {
    this.isOpen = !this.isOpen;
    this.container.style.display = this.isOpen ? 'flex' : 'none';
  }

  public open(): void {
    this.isOpen = true;
    this.container.style.display = 'flex';
  }

  public close(): void {
    this.isOpen = false;
    this.container.style.display = 'none';
  }

  public render(): void {
    this.applyFrameStyles();

    this.container.innerHTML = `
      <div id="chat-resize-handle" title="Trascina per ridimensionare" style="position: absolute; left: 0; top: 0; bottom: 0; width: 6px; cursor: col-resize; z-index: 20; touch-action: none; display: ${this.isMaximized ? 'none' : 'block'};"></div>

      <div id="chat-header-bar" title="Doppio click per ingrandire/ripristinare" style="padding: 12px 16px; background: #020617; border-bottom: 1px solid #1e293b; display: flex; align-items: center; justify-content: space-between; cursor: default;">
        <div style="font-weight: 600; color: #60a5fa; font-size: 14px; display: flex; align-items: center; gap: 6px;">
          <span>💬</span> Agent Assistant
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <button id="chat-maximize-btn" title="${this.isMaximized ? 'Ripristina dimensione' : 'Massimizza finestra'}" style="background: none; border: 1px solid #334155; border-radius: 6px; color: #94a3b8; font-size: 12px; cursor: pointer; padding: 2px 6px; line-height: 1.2;">${this.isMaximized ? '🗗' : '⛶'}</button>
          <button id="chat-clear-btn" title="Clear history" style="background: none; border: none; color: #94a3b8; font-size: 11px; cursor: pointer; display: flex; align-items: center; gap: 2px;">🗑️ Clear</button>
          <button id="chat-close-btn" style="background: none; border: none; color: #94a3b8; font-size: 16px; cursor: pointer;">&times;</button>
        </div>
      </div>

      <div id="chat-commands-toggle" style="padding: 8px 12px; background: #1e293b; border-bottom: 1px solid #334155; display: flex; align-items: center; justify-content: space-between; cursor: pointer; user-select: none;">
        <span style="font-size: 11px; font-weight: 600; color: #cbd5e1; display: flex; align-items: center; gap: 6px;">
          <span>⚡</span> Comandi
          <span style="font-weight: 400; color: #64748b;">· tutti gli strumenti dell'agente</span>
        </span>
        <span id="chat-commands-chevron" style="font-size: 10px; color: #94a3b8;">${this.commandsOpen ? '▴' : '▾'}</span>
      </div>

      <div id="chat-commands-panel" style="display: ${this.commandsOpen ? 'block' : 'none'}; background: #0b1220; border-bottom: 1px solid #334155; max-height: 55vh; overflow-y: auto; padding: 8px 10px; box-sizing: border-box;">
        ${this.renderCommandCatalog()}
      </div>

      <div id="chat-messages-list" style="flex: 1; padding: 12px; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; font-size: 13px; line-height: 1.5;">
        ${this.renderMessages()}
      </div>

      <div style="padding: 12px; background: #020617; border-top: 1px solid #1e293b; display: flex; flex-direction: column; gap: 8px;">
        <textarea id="chat-input" placeholder="Chiedi qualcosa o seleziona un'azione..." style="width: 100%; height: 60px; background: #1e293b; border: 1px solid #334155; border-radius: 8px; color: #f8fafc; padding: 8px; font-family: inherit; font-size: 12px; resize: none; box-sizing: border-box;"></textarea>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 10px; color: #64748b;">Invio per spedire</span>
          <button id="chat-send-btn" style="background: #4f46e5; color: white; border: none; padding: 6px 14px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer;">Invia</button>
        </div>
      </div>
    `;

    this.attachEventListeners();
  }

  private applyFrameStyles(): void {
    const c = this.container.style;
    c.display = this.isOpen ? 'flex' : 'none';
    c.flexDirection = 'column';
    c.background = '#0f172a';
    c.boxSizing = 'border-box';

    if (this.isMaximized) {
      c.position = 'fixed';
      c.top = '0';
      c.left = '0';
      c.right = '0';
      c.bottom = '0';
      c.width = '100vw';
      c.height = '100vh';
      c.borderLeft = 'none';
      c.borderRadius = '0';
      c.boxShadow = '0 0 0 1px #1e293b, 0 0 60px rgba(0, 0, 0, 0.65)';
      c.zIndex = '1000';
    } else {
      c.position = 'relative';
      c.top = '';
      c.left = '';
      c.right = '';
      c.bottom = '';
      c.width = `${this.chatWidth}px`;
      c.height = '100%';
      c.borderLeft = '1px solid #1e293b';
      c.borderRadius = '';
      c.boxShadow = '';
      c.zIndex = '100';
    }

    const handle = this.container.querySelector('#chat-resize-handle') as HTMLElement | null;
    if (handle) handle.style.display = this.isMaximized ? 'none' : 'block';
  }

  private setMaximized(maximized: boolean): void {
    this.isMaximized = maximized;
    this.applyFrameStyles();
    const btn = this.container.querySelector('#chat-maximize-btn') as HTMLElement | null;
    if (btn) {
      btn.textContent = maximized ? '🗗' : '⛶';
      btn.title = maximized ? 'Ripristina dimensione' : 'Massimizza finestra';
    }
  }

  private toggleMaximize(): void {
    if (!this.isOpen) return;
    this.setMaximized(!this.isMaximized);
  }

  private startChatResize(e: MouseEvent): void {
    e.preventDefault();
    this.isResizingChat = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMove = (ev: MouseEvent): void => {
      if (this.isMaximized) return;
      const maxWidth = Math.max(520, window.innerWidth - CHAT_MIN_WIDTH);
      const raw = window.innerWidth - ev.clientX;
      this.chatWidth = Math.min(Math.max(raw, CHAT_MIN_WIDTH), maxWidth);
      this.container.style.width = `${this.chatWidth}px`;
    };

    const onUp = (): void => {
      this.isResizingChat = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      this.saveChatWidth();
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  private renderCommandCatalog(): string {
    const escape = (s: string): string =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    return COMMAND_CATALOG.map(category => {
      const items = category.commands
        .map(cmd => {
          const tooltip = cmd.description ? `${cmd.label} — ${cmd.description}` : cmd.label;
          const usage = cmd.usage ? ` <span style="opacity: 0.5;">${escape(cmd.usage)}</span>` : '';
          return `
            <button class="chat-cmd-item" data-cmd="/${escape(cmd.cmd)}" title="${escape(tooltip)}" style="display: inline-flex; align-items: center; gap: 4px; background: #1e293b; color: #e2e8f0; border: 1px solid #334155; padding: 4px 8px; border-radius: 6px; font-size: 11px; cursor: pointer; white-space: nowrap;">
              <span>${cmd.icon}</span> /${escape(cmd.cmd)}${usage}
            </button>`;
        })
        .join('');

      return `
        <div style="margin-bottom: 10px;">
          <div style="font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b; font-weight: 700; margin: 2px 2px 6px;">
            ${category.icon} ${escape(category.label)}
          </div>
          <div style="display: flex; flex-wrap: wrap; gap: 4px;">${items}</div>
        </div>`;
    }).join('');
  }

  private setCommandsOpen(open: boolean): void {
    this.commandsOpen = open;
    const panel = this.container.querySelector('#chat-commands-panel') as HTMLElement | null;
    const chevron = this.container.querySelector('#chat-commands-chevron');
    if (panel) panel.style.display = open ? 'block' : 'none';
    if (chevron) chevron.textContent = open ? '▴' : '▾';
  }

  private renderMessages(): string {
    const { isAdvancedMode } = appStore.getState();

    return this.messages
      .map(msg => {
        const isUser = msg.sender === 'user';
        const bg = isUser ? '#4338ca' : '#1e293b';
        const align = isUser ? 'flex-end' : 'flex-start';

        const actionChipsHtml = !isUser
          ? `
            <div class="action-chips-container">
              <button class="action-chip" data-chip-cmd="/study-guide">📝 Guida Studio</button>
              <button class="action-chip" data-chip-cmd="/mindmap">📊 Mappa Concettuale</button>
              <button class="action-chip" data-chip-cmd="/quiz">🧪 Quiz</button>
              ${
                isAdvancedMode
                  ? `
                  <button class="action-chip" data-chip-cmd="/audio-overview">🎙️ Audio Script</button>
                  <button class="action-chip" data-chip-cmd="/deep-research">🔬 Deep Research</button>
                `
                  : ''
              }
            </div>
          `
          : '';

        return `
          <div style="align-self: ${align}; max-width: 92%; display: flex; flex-direction: column; gap: 4px;">
            <div style="background: ${bg}; padding: 10px 12px; border-radius: 12px; color: #f8fafc;" class="markdown-body">
              ${renderMarkdown(msg.text)}
              ${actionChipsHtml}
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 10px; color: #64748b; padding: 0 4px;">
              <span>${msg.timestamp}</span>
              ${
                !isUser
                  ? `<button class="attach-btn" data-msg-id="${msg.id}" style="background: none; border: none; color: #60a5fa; cursor: pointer; font-size: 10px; padding: 0;">📌 Salva nella Wiki</button>`
                  : ''
              }
            </div>
          </div>
        `;
      })
      .join('');
  }

  private attachEventListeners(): void {
    const closeBtn = this.container.querySelector('#chat-close-btn');
    closeBtn?.addEventListener('click', () => this.close());

    const clearBtn = this.container.querySelector('#chat-clear-btn');
    clearBtn?.addEventListener('click', () => this.clearHistory());

    const maximizeBtn = this.container.querySelector('#chat-maximize-btn');
    maximizeBtn?.addEventListener('click', () => this.toggleMaximize());

    const headerBar = this.container.querySelector('#chat-header-bar');
    headerBar?.addEventListener('dblclick', () => this.toggleMaximize());

    const resizeHandle = this.container.querySelector('#chat-resize-handle') as HTMLElement | null;
    resizeHandle?.addEventListener('mousedown', e => this.startChatResize(e));
    resizeHandle?.addEventListener('mouseenter', () => {
      if (!this.isMaximized) resizeHandle.style.background = 'rgba(96, 165, 250, 0.35)';
    });
    resizeHandle?.addEventListener('mouseleave', () => {
      if (!this.isResizingChat) resizeHandle.style.background = 'transparent';
    });

    const input = this.container.querySelector('#chat-input') as HTMLTextAreaElement;
    const sendBtn = this.container.querySelector('#chat-send-btn');

    const send = (): void => {
      const text = input.value.trim();
      if (!text) return;
      input.value = '';
      void this.handleSendMessage(text);
    };

    sendBtn?.addEventListener('click', send);
    input?.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        send();
      }
    });

    const toggle = this.container.querySelector('#chat-commands-toggle');
    toggle?.addEventListener('click', () => {
      this.setCommandsOpen(!this.commandsOpen);
    });

    this.container.querySelectorAll('.chat-cmd-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const cmd = btn.getAttribute('data-cmd');
        if (cmd) {
          input.value = `${cmd} `;
          input.focus();
          this.setCommandsOpen(false);
        }
      });
    });

    this.container.querySelectorAll('.action-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const cmd = chip.getAttribute('data-chip-cmd');
        if (cmd) {
          void this.handleSendMessage(cmd);
        }
      });
    });

    this.container.querySelectorAll('.attach-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const msgId = btn.getAttribute('data-msg-id');
        const msg = this.messages.find(m => m.id === msgId);
        if (msg) {
          new AttachModal(
            this.notesGetter(),
            msg.text,
            (options: AttachOptions) => {
              void this.apiStorage.attachNote(options).then(() => {
                if (this.onAttachSuccessCb) this.onAttachSuccessCb();
              });
            }
          );
        }
      });
    });

    this.bindMessageLinks(this.container);
  }

  /**
   * Binds navigation for every kind of link an agent reply can contain:
   *  - [[wikilinks]]    -> a.wikilink[data-wikilink]
   *  - raw sources      -> a.source-link[data-source-file] (raw/file.md#L..)
   *  - bare .md refs    -> a.note-link[data-note-ref]
   *  - markdown links   -> a[href*=".md"]
   * A `data-bound` flag avoids double-binding when innerHTML is rewritten.
   */
  private bindMessageLinks(scope: Element): void {
    const bind = (links: NodeListOf<Element>, resolve: (el: HTMLElement) => void) => {
      links.forEach(node => {
        const link = node as HTMLElement;
        if (link.dataset.bound) return;
        link.dataset.bound = '1';
        link.addEventListener('click', e => {
          e.preventDefault();
          resolve(link);
        });
      });
    };

    bind(
      scope.querySelectorAll('a.wikilink'),
      link => {
        const target = link.getAttribute('data-wikilink');
        if (target && this.onOpenLinkCb) this.onOpenLinkCb(target);
      }
    );

    bind(
      scope.querySelectorAll('a.source-link'),
      link => {
        const file = link.getAttribute('data-source-file');
        if (file && this.onOpenLinkCb) {
          const stem = file.replace(/^raw\/?/i, '').replace(/\.md$/i, '');
          this.onOpenLinkCb(stem || file);
        }
      }
    );

    bind(
      scope.querySelectorAll('a.note-link'),
      link => {
        const ref = link.getAttribute('data-note-ref');
        if (ref && this.onOpenLinkCb) this.onOpenLinkCb(ref);
      }
    );

    bind(
      scope.querySelectorAll('a[href]'),
      link => {
        const href = (link.getAttribute('href') || '').split('#')[0].split('?')[0].replace(/^\.?\//, '');
        if (!href.toLowerCase().endsWith('.md')) return;
        if (this.onOpenLinkCb) this.onOpenLinkCb(href);
      }
    );
  }

  public async handleSendMessage(text: string): Promise<void> {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    this.messages.push({
      id: `msg-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: time,
    });

    this.saveHistory();
    this.render();

    const assistantMsgId = `msg-${Date.now() + 1}`;
    const assistantMsg: ChatMessage = {
      id: assistantMsgId,
      sender: 'assistant',
      text: '',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    this.messages.push(assistantMsg);
    this.render();

    const list = this.container.querySelector('#chat-messages-list');
    const attachBtns = this.container.querySelectorAll('.attach-btn');
    const targetAttachBtn = Array.from(attachBtns).find(b => b.getAttribute('data-msg-id') === assistantMsgId);
    const msgWrapper = targetAttachBtn?.closest('div')?.parentElement?.querySelector('.markdown-body');

    await this.apiStorage.sendChatStream(
      text,
      (chunk: string) => {
        assistantMsg.text += chunk;
        if (msgWrapper) {
          msgWrapper.innerHTML = renderMarkdown(assistantMsg.text);
          this.bindMessageLinks(msgWrapper);
        }
        if (list) list.scrollTop = list.scrollHeight;
      }
    );

    this.saveHistory();
  }
}
