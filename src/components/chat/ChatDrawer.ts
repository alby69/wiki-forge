import { WikiNote } from '../../core/types/wiki';
import { renderMarkdown } from '../../core/utils/markdown';
import { ApiStorage, AttachOptions } from '../../storage/ApiStorage';
import { AttachModal } from './AttachModal';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

const STORAGE_KEY = 'wiki-forge:chat-history';

export class ChatDrawer {
  private container: HTMLElement;
  private apiStorage: ApiStorage;
  private isOpen: boolean = false;
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
    this.render();
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
    this.container.style.display = this.isOpen ? 'flex' : 'none';
    this.container.style.flexDirection = 'column';
    this.container.style.width = '380px';
    this.container.style.height = '100%';
    this.container.style.background = '#0f172a';
    this.container.style.borderLeft = '1px solid #1e293b';
    this.container.style.boxSizing = 'border-box';

    this.container.innerHTML = `
      <div style="padding: 12px 16px; background: #020617; border-bottom: 1px solid #1e293b; display: flex; align-items: center; justify-content: space-between;">
        <div style="font-weight: 600; color: #60a5fa; font-size: 14px; display: flex; align-items: center; gap: 6px;">
          <span>💬</span> Agent Assistant
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <button id="chat-clear-btn" title="Clear history" style="background: none; border: none; color: #94a3b8; font-size: 11px; cursor: pointer; display: flex; align-items: center; gap: 2px;">🗑️ Clear</button>
          <button id="chat-close-btn" style="background: none; border: none; color: #94a3b8; font-size: 16px; cursor: pointer;">&times;</button>
        </div>
      </div>

      <div style="padding: 8px 12px; background: #1e293b; border-bottom: 1px solid #334155; display: flex; gap: 6px; overflow-x: auto;" class="chat-shortcuts">
        <button data-cmd="/consult" style="background: #334155; color: #f8fafc; border: none; padding: 4px 8px; border-radius: 6px; font-size: 11px; cursor: pointer; white-space: nowrap;">🔍 /consult</button>
        <button data-cmd="/compile" style="background: #334155; color: #f8fafc; border: none; padding: 4px 8px; border-radius: 6px; font-size: 11px; cursor: pointer; white-space: nowrap;">⚡ /compile</button>
        <button data-cmd="/audit" style="background: #334155; color: #f8fafc; border: none; padding: 4px 8px; border-radius: 6px; font-size: 11px; cursor: pointer; white-space: nowrap;">🛡️ /audit</button>
        <button data-cmd="/trace" style="background: #334155; color: #f8fafc; border: none; padding: 4px 8px; border-radius: 6px; font-size: 11px; cursor: pointer; white-space: nowrap;">🕸️ /trace</button>
        <button data-cmd="/reindex" style="background: #334155; color: #f8fafc; border: none; padding: 4px 8px; border-radius: 6px; font-size: 11px; cursor: pointer; white-space: nowrap;">🔄 /reindex</button>
        <button data-cmd="/wizard" style="background: #4f46e5; color: #ffffff; border: none; padding: 4px 8px; border-radius: 6px; font-size: 11px; cursor: pointer; white-space: nowrap;">🪄 /wizard</button>
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

  private renderMessages(): string {
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
              <button class="action-chip" data-chip-cmd="/audio-overview">🎙️ Audio Script</button>
              <button class="action-chip" data-chip-cmd="/deep-research">🔬 Deep Research</button>
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

    this.container.querySelectorAll('.chat-shortcuts button').forEach(btn => {
      btn.addEventListener('click', () => {
        const cmd = btn.getAttribute('data-cmd');
        if (cmd) {
          input.value = `${cmd} `;
          input.focus();
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

    this.container.querySelectorAll('a.wikilink').forEach(link => {
      link.addEventListener('click', e => {
        e.preventDefault();
        const target = link.getAttribute('data-wikilink');
        if (target && this.onOpenLinkCb) {
          this.onOpenLinkCb(target);
        }
      });
    });
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
          msgWrapper.querySelectorAll('a.wikilink').forEach(link => {
            link.addEventListener('click', e => {
              e.preventDefault();
              const target = link.getAttribute('data-wikilink');
              if (target && this.onOpenLinkCb) {
                this.onOpenLinkCb(target);
              }
            });
          });
        }
        if (list) list.scrollTop = list.scrollHeight;
      }
    );

    this.saveHistory();
  }
}
