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

    this.messages.push({
      id: 'welcome',
      sender: 'assistant',
      text: '### 🤖 OpenCode Agent Assistant\n\nWelcome! How can I assist with your knowledge base?\n\nTry slash shortcuts: `/consult`, `/compile`, `/audit`, `/trace`, `/reindex`.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    });

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
    this.container.style.width = '360px';
    this.container.style.height = '100%';
    this.container.style.background = '#151619';
    this.container.style.borderLeft = '1px solid #2d3748';
    this.container.style.boxSizing = 'border-box';

    this.container.innerHTML = `
      <div style="padding: 12px 16px; background: #121316; border-bottom: 1px solid #2d3748; display: flex; align-items: center; justify-content: space-between;">
        <div style="font-weight: 600; color: #64b5f6; font-size: 14px; display: flex; align-items: center; gap: 6px;">
          <span>💬</span> OpenCode Assistant
        </div>
        <button id="chat-close-btn" style="background: none; border: none; color: #a0aec0; font-size: 16px; cursor: pointer;">&times;</button>
      </div>

      <div style="padding: 8px 12px; background: #1a1c23; border-bottom: 1px solid #2d3748; display: flex; gap: 6px; overflow-x: auto;" class="chat-shortcuts">
        <button data-cmd="/consult" style="background: #2d3748; color: #e2e8f0; border: none; padding: 4px 8px; border-radius: 4px; font-size: 11px; cursor: pointer; white-space: nowrap;">🔍 /consult</button>
        <button data-cmd="/compile" style="background: #2d3748; color: #e2e8f0; border: none; padding: 4px 8px; border-radius: 4px; font-size: 11px; cursor: pointer; white-space: nowrap;">⚡ /compile</button>
        <button data-cmd="/audit" style="background: #2d3748; color: #e2e8f0; border: none; padding: 4px 8px; border-radius: 4px; font-size: 11px; cursor: pointer; white-space: nowrap;">🛡️ /audit</button>
        <button data-cmd="/trace" style="background: #2d3748; color: #e2e8f0; border: none; padding: 4px 8px; border-radius: 4px; font-size: 11px; cursor: pointer; white-space: nowrap;">🕸️ /trace</button>
        <button data-cmd="/reindex" style="background: #2d3748; color: #e2e8f0; border: none; padding: 4px 8px; border-radius: 4px; font-size: 11px; cursor: pointer; white-space: nowrap;">🔄 /reindex</button>
      </div>

      <div id="chat-messages-list" style="flex: 1; padding: 12px; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; font-size: 13px; line-height: 1.5;">
        ${this.renderMessages()}
      </div>

      <div style="padding: 12px; background: #121316; border-top: 1px solid #2d3748; display: flex; flex-direction: column; gap: 8px;">
        <textarea id="chat-input" placeholder="Ask a question or type /consult..." style="width: 100%; height: 60px; background: #18191c; border: 1px solid #2d3748; border-radius: 6px; color: #e2e8f0; padding: 8px; font-family: inherit; font-size: 12px; resize: none; box-sizing: border-box;"></textarea>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 10px; color: #718096;">Press Enter to send</span>
          <button id="chat-send-btn" style="background: #3182ce; color: white; border: none; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: 600; cursor: pointer;">Send</button>
        </div>
      </div>
    `;

    this.attachEventListeners();
  }

  private renderMessages(): string {
    return this.messages
      .map(msg => {
        const isUser = msg.sender === 'user';
        const bg = isUser ? '#2b6cb0' : '#1e2330';
        const align = isUser ? 'flex-end' : 'flex-start';

        return `
          <div style="align-self: ${align}; max-width: 90%; display: flex; flex-direction: column; gap: 4px;">
            <div style="background: ${bg}; padding: 10px 12px; border-radius: 8px; color: #e2e8f0;" class="markdown-body">
              ${renderMarkdown(msg.text)}
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 10px; color: #718096; padding: 0 4px;">
              <span>${msg.timestamp}</span>
              ${
                !isUser
                  ? `<button class="attach-btn" data-msg-id="${msg.id}" style="background: none; border: none; color: #64b5f6; cursor: pointer; font-size: 10px; padding: 0;">📌 Attach to Wiki</button>`
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

    this.render();

    const reply = await this.apiStorage.sendChat(text);

    this.messages.push({
      id: `msg-${Date.now()}`,
      sender: 'assistant',
      text: reply,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    });

    this.render();

    const list = this.container.querySelector('#chat-messages-list');
    if (list) list.scrollTop = list.scrollHeight;
  }
}
