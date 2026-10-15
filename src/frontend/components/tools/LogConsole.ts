export interface LogLine {
  type: 'start' | 'stdout' | 'stderr' | 'exit' | 'info';
  text: string;
  timestamp: string;
}

export class LogConsole {
  private container: HTMLElement;
  private logElement!: HTMLElement;
  private statusElement!: HTMLElement;
  private lines: LogLine[] = [];
  private autoScroll: boolean = true;
  private activeAbortController: AbortController | null = null;
  private onStopCallback?: () => void;

  constructor(container: HTMLElement) {
    this.container = container;
    this.render();
  }

  private render(): void {
    this.container.innerHTML = `
      <div style="background: #0d0e10; border: 1px solid #2d3748; border-radius: 6px; display: flex; flex-direction: column; height: 100%; overflow: hidden; font-family: monospace; font-size: 12px; color: #e2e8f0;">
        <div style="background: #1a202c; border-bottom: 1px solid #2d3748; padding: 6px 12px; display: flex; align-items: center; justify-content: space-between;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-weight: 600; color: #64b5f6;">🖥️ Console Output</span>
            <span id="log-status" style="font-size: 11px; padding: 2px 6px; border-radius: 4px; background: #2d3748; color: #a0aec0;">Idle</span>
          </div>
          <div style="display: flex; align-items: center; gap: 6px;">
            <button id="log-clear-btn" style="background: #2d3748; color: #e2e8f0; border: none; padding: 3px 8px; border-radius: 4px; font-size: 11px; cursor: pointer;">Clear</button>
            <button id="log-download-btn" style="background: #2d3748; color: #e2e8f0; border: none; padding: 3px 8px; border-radius: 4px; font-size: 11px; cursor: pointer;">Save Log</button>
            <button id="log-stop-btn" style="background: #e53e3e; color: #ffffff; border: none; padding: 3px 8px; border-radius: 4px; font-size: 11px; cursor: pointer; display: none;">Stop</button>
          </div>
        </div>

        <div id="log-body" style="flex: 1; padding: 10px; overflow-y: auto; white-space: pre-wrap; word-break: break-all; line-height: 1.5; background: #0b0c0e;">
          <div style="color: #718096; font-style: italic;">Log output will appear here when a tool is executed...</div>
        </div>
      </div>
    `;

    this.logElement = this.container.querySelector('#log-body')!;
    this.statusElement = this.container.querySelector('#log-status')!;

    const clearBtn = this.container.querySelector('#log-clear-btn');
    const downloadBtn = this.container.querySelector('#log-download-btn');
    const stopBtn = this.container.querySelector('#log-stop-btn');

    if (clearBtn) clearBtn.addEventListener('click', () => this.clear());
    if (downloadBtn) downloadBtn.addEventListener('click', () => this.downloadLog());
    if (stopBtn) stopBtn.addEventListener('click', () => this.stopExecution());
  }

  public setAbortController(controller: AbortController | null, onStop?: () => void): void {
    this.activeAbortController = controller;
    this.onStopCallback = onStop;
    const stopBtn = this.container.querySelector('#log-stop-btn') as HTMLElement;
    if (stopBtn) {
      stopBtn.style.display = controller ? 'inline-block' : 'none';
    }
  }

  public stopExecution(): void {
    if (this.activeAbortController) {
      this.activeAbortController.abort();
      this.activeAbortController = null;
      this.appendLine({
        type: 'stderr',
        text: '\n[Process stopped by user]\n',
        timestamp: new Date().toLocaleTimeString(),
      });
      this.setStatus('Stopped', '#e53e3e');
      if (this.onStopCallback) this.onStopCallback();
    }
  }

  public setStatus(text: string, color: string = '#a0aec0'): void {
    if (this.statusElement) {
      this.statusElement.textContent = text;
      this.statusElement.style.color = color;
    }
  }

  public clear(): void {
    this.lines = [];
    if (this.logElement) {
      this.logElement.innerHTML = '<div style="color: #718096; font-style: italic;">Log output cleared.</div>';
    }
    this.setStatus('Idle', '#a0aec0');
  }

  public isPythonError(text: string): boolean {
    return (
      text.includes('Traceback (most recent call last):') ||
      /^(ModuleNotFoundError|ImportError|YAMLError|SyntaxError|FileNotFoundError|ValueError|TypeError|AttributeError|RuntimeError|KeyError|ZeroDivisionError|Error):/m.test(text) ||
      (text.includes('File "') && text.includes('line ') && text.includes('in '))
    );
  }

  public getSuggestedHint(text: string): string {
    if (text.includes('ModuleNotFoundError') || text.includes('ImportError') || text.includes('No module named')) {
      return '💡 Suggerimento: Verifica di aver installato le dipendenze con `pip install -r requirements.txt` o controlla la sintassi del file YAML.';
    }
    if (text.includes('YAMLError') || text.includes('yaml') || text.includes('ScannerError') || text.includes('ParserError')) {
      return '💡 Suggerimento: Verifica la sintassi del file YAML o il frontmatter della nota per evitare errori di indentazione o virgolette non chiuse.';
    }
    if (text.includes('FileNotFoundError') || text.includes('No such file')) {
      return '💡 Suggerimento: Verifica che il file o la cartella specificata nei parametri esista e sia all\'interno del vault.';
    }
    return '💡 Suggerimento: Verifica i parametri dello script, le dipendenze in `requirements.txt` e la validità del file YAML/Markdown.';
  }

  public truncateStackTrace(text: string): string {
    const lines = text.split('\n');
    if (lines.length <= 12) {
      return text.trim();
    }
    const header = lines.slice(0, 2);
    const tail = lines.slice(-8);
    return [...header, '   ... [stack trace origin truncated for readability] ...', ...tail].join('\n').trim();
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  public appendLine(line: LogLine): void {
    if (this.lines.length === 0) {
      this.logElement.innerHTML = '';
    }
    this.lines.push(line);

    if (this.isPythonError(line.text)) {
      const truncated = this.truncateStackTrace(line.text);
      const hint = this.getSuggestedHint(line.text);

      const alertBox = document.createElement('div');
      alertBox.className = 'alert-error';
      alertBox.style.cssText = `
        border: 1px solid #e53e3e;
        background: #2d1517;
        padding: 10px 12px;
        border-radius: 6px;
        margin: 8px 0;
        color: #fed7d7;
        font-family: monospace;
        font-size: 11px;
      `;

      alertBox.innerHTML = `
        <div style="font-weight: bold; color: #feb2b2; margin-bottom: 6px; font-size: 12px; display: flex; align-items: center; gap: 6px;">
          <span>⚠️ Python Execution Error Detected</span>
        </div>
        <pre style="white-space: pre-wrap; word-break: break-all; margin: 0 0 8px 0; font-family: inherit; color: #fed7d7;">[${this.escapeHtml(line.timestamp)}] ${this.escapeHtml(truncated)}</pre>
        <div style="font-style: italic; color: #fbd38d; border-top: 1px dashed #742a2a; padding-top: 6px;">
          ${this.escapeHtml(hint)}
        </div>
      `;
      this.logElement.appendChild(alertBox);
    } else {
      const div = document.createElement('div');
      if (line.type === 'start') {
        div.style.color = '#64b5f6';
        div.style.fontWeight = 'bold';
        div.style.margin = '4px 0';
      } else if (line.type === 'stderr') {
        div.style.color = '#feb2b2';
      } else if (line.type === 'exit') {
        div.style.color = line.text.includes('code 0') ? '#68d391' : '#fc8181';
        div.style.fontWeight = 'bold';
        div.style.margin = '4px 0';
      } else {
        div.style.color = '#e2e8f0';
      }

      div.textContent = `[${line.timestamp}] ${line.text}`;
      this.logElement.appendChild(div);
    }

    if (this.autoScroll) {
      this.logElement.scrollTop = this.logElement.scrollHeight;
    }
  }

  public downloadLog(): void {
    const text = this.lines.map(l => `[${l.timestamp}] ${l.text}`).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wiki-forge-tool-log-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
