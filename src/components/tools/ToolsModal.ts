import { ScriptDef, ScriptParamDef } from '../../server/agentServer';
import { LogConsole } from './LogConsole';

export class ToolsModal {
  private overlay: HTMLElement;
  private scripts: ScriptDef[] = [];
  private selectedScript: ScriptDef | null = null;
  private logConsole!: LogConsole;
  private onVaultRefreshCb?: () => void;
  private activeCategory: string = 'Ingestion';

  constructor(onVaultRefresh?: () => void) {
    this.onVaultRefreshCb = onVaultRefresh;
    this.overlay = document.createElement('div');
    this.overlay.id = 'tools-modal-root';
    this.overlay.style.position = 'fixed';
    this.overlay.style.top = '0';
    this.overlay.style.left = '0';
    this.overlay.style.width = '100vw';
    this.overlay.style.height = '100vh';
    this.overlay.style.background = 'rgba(0, 0, 0, 0.75)';
    this.overlay.style.zIndex = '2000';
    this.overlay.style.display = 'none';
    this.overlay.style.alignItems = 'center';
    this.overlay.style.justifyContent = 'center';
    document.body.appendChild(this.overlay);

    this.renderBase();
  }

  private renderBase(): void {
    this.overlay.innerHTML = `
      <div style="background: #18191c; border: 1px solid #2d3748; border-radius: 8px; width: 90vw; max-width: 1100px; height: 85vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5);">
        <!-- Header -->
        <div style="height: 50px; background: #121316; border-bottom: 1px solid #2d3748; display: flex; align-items: center; justify-content: space-between; padding: 0 20px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 20px;">🛠️</span>
            <span style="font-weight: 700; font-size: 16px; color: #64b5f6;">Wiki-Forge Script Control Panel</span>
          </div>
          <button id="tools-modal-close" style="background: none; border: none; color: #a0aec0; font-size: 20px; cursor: pointer;">✕</button>
        </div>

        <!-- Main Body -->
        <div style="flex: 1; display: flex; overflow: hidden;">
          <!-- Left Sidebar: Categories & Scripts -->
          <div style="width: 260px; background: #121316; border-right: 1px solid #2d3748; display: flex; flex-direction: column; overflow-y: auto; padding: 12px;">
            <div id="tools-categories-list" style="display: flex; flex-direction: column; gap: 12px;"></div>
          </div>

          <!-- Right Content Area -->
          <div style="flex: 1; display: flex; flex-direction: column; overflow: hidden; background: #18191c;">
            <!-- Top Half: Tool Form -->
            <div id="tool-form-container" style="flex: 1; padding: 20px; overflow-y: auto; border-bottom: 1px solid #2d3748;">
              <div style="color: #a0aec0; font-style: italic;">Select a script tool from the left menu to configure parameters.</div>
            </div>

            <!-- Bottom Half: Log Console -->
            <div style="height: 280px; padding: 12px; background: #0f1012;">
              <div id="tools-log-console-root" style="height: 100%;"></div>
            </div>
          </div>
        </div>
      </div>
    `;

    const closeBtn = this.overlay.querySelector('#tools-modal-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.close());
    }

    const consoleHost = this.overlay.querySelector('#tools-log-console-root') as HTMLElement;
    this.logConsole = new LogConsole(consoleHost);
  }

  public async open(): Promise<void> {
    this.overlay.style.display = 'flex';
    await this.fetchScriptRegistry();
    this.renderCategoriesList();
    if (this.scripts.length > 0 && !this.selectedScript) {
      this.selectScript(this.scripts[0]);
    }
  }

  public close(): void {
    this.overlay.style.display = 'none';
  }

  private async fetchScriptRegistry(): Promise<void> {
    try {
      const res = await fetch('/api/scripts/list');
      const data = await res.json();
      if (data.success && Array.isArray(data.scripts)) {
        this.scripts = data.scripts;
      }
    } catch (_err) {
      // Fallback
    }
  }

  private renderCategoriesList(): void {
    const categoriesListEl = this.overlay.querySelector('#tools-categories-list');
    if (!categoriesListEl) return;

    const categories: Record<string, ScriptDef[]> = {};
    for (const script of this.scripts) {
      if (!categories[script.category]) {
        categories[script.category] = [];
      }
      categories[script.category].push(script);
    }

    let html = '';
    for (const [category, scriptList] of Object.entries(categories)) {
      html += `
        <div>
          <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #718096; margin-bottom: 6px; letter-spacing: 0.5px;">${category}</div>
          <div style="display: flex; flex-direction: column; gap: 2px;">
            ${scriptList
              .map(
                s => `
              <button class="script-menu-item" data-id="${s.id}" style="text-align: left; background: ${
                  this.selectedScript?.id === s.id ? '#2b6cb0' : '#1a202c'
                }; color: ${this.selectedScript?.id === s.id ? '#ffffff' : '#e2e8f0'}; border: 1px solid ${
                  this.selectedScript?.id === s.id ? '#3182ce' : '#2d3748'
                }; padding: 8px 10px; border-radius: 4px; font-size: 12px; cursor: pointer; display: flex; flex-direction: column; gap: 2px; transition: background 0.15s;">
                <span style="font-weight: 600;">${s.displayName}</span>
                <span style="font-size: 10px; opacity: 0.7;">${s.path}</span>
              </button>
            `
              )
              .join('')}
          </div>
        </div>
      `;
    }

    categoriesListEl.innerHTML = html;

    const menuItems = categoriesListEl.querySelectorAll('.script-menu-item');
    menuItems.forEach(item => {
      item.addEventListener('click', () => {
        const id = item.getAttribute('data-id');
        const found = this.scripts.find(s => s.id === id);
        if (found) {
          this.selectScript(found);
          this.renderCategoriesList();
        }
      });
    });
  }

  private selectScript(script: ScriptDef): void {
    this.selectedScript = script;
    const container = this.overlay.querySelector('#tool-form-container');
    if (!container) return;

    const paramFields = script.parameters.map(p => this.renderParamInput(p)).join('');

    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 16px;">
        <div>
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <h3 style="margin: 0; font-size: 18px; color: #64b5f6; font-weight: 700;">${script.displayName}</h3>
            <span style="font-size: 11px; background: #2d3748; color: #a0aec0; padding: 2px 8px; border-radius: 4px;">${script.category}</span>
          </div>
          <div style="font-size: 13px; color: #a0aec0; margin-top: 6px;">${script.description}</div>
          <div style="font-size: 11px; font-family: monospace; color: #4a5568; margin-top: 4px;">Script path: ${script.path}</div>
        </div>

        <form id="script-exec-form" style="display: flex; flex-direction: column; gap: 12px;">
          ${paramFields || '<div style="font-size: 12px; color: #718096; font-style: italic;">This tool requires no input arguments.</div>'}

          <div style="margin-top: 8px; display: flex; align-items: center; gap: 10px;">
            <button id="run-tool-btn" type="submit" style="background: #3182ce; color: #ffffff; border: none; padding: 8px 20px; border-radius: 4px; font-weight: 600; font-size: 13px; cursor: pointer; display: flex; align-items: center; gap: 6px;">
              ▶ Run Tool
            </button>
            <span id="exec-status-indicator" style="font-size: 12px; color: #a0aec0;">Ready</span>
          </div>
        </form>
      </div>
    `;

    const form = container.querySelector('#script-exec-form') as HTMLFormElement;
    if (form) {
      form.addEventListener('submit', e => {
        e.preventDefault();
        void this.executeTool(script, form);
      });
    }
  }

  private renderParamInput(param: ScriptParamDef): string {
    const fieldId = `param-${param.name}`;
    let inputHtml = '';

    if (param.type === 'boolean') {
      const isChecked = param.default === true ? 'checked' : '';
      inputHtml = `
        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
          <input type="checkbox" id="${fieldId}" name="${param.name}" ${isChecked} style="accent-color: #3182ce;" />
          <span style="font-size: 13px; color: #e2e8f0; font-weight: 600;">${param.label}</span>
        </label>
      `;
    } else if (param.type === 'select') {
      const optionsHtml = (param.options || [])
        .map(opt => `<option value="${opt}" ${opt === param.default ? 'selected' : ''}>${opt}</option>`)
        .join('');
      inputHtml = `
        <label style="display: flex; flex-direction: column; gap: 4px;">
          <span style="font-size: 12px; color: #cbd5e0; font-weight: 600;">${param.label}</span>
          <select id="${fieldId}" name="${param.name}" style="background: #2d3748; color: #e2e8f0; border: 1px solid #4a5568; padding: 6px 10px; border-radius: 4px; font-size: 12px;">
            ${optionsHtml}
          </select>
        </label>
      `;
    } else {
      const val = param.default !== undefined ? param.default : '';
      const req = param.required ? 'required' : '';
      const inputType = param.type === 'number' ? 'number' : 'text';
      inputHtml = `
        <label style="display: flex; flex-direction: column; gap: 4px;">
          <span style="font-size: 12px; color: #cbd5e0; font-weight: 600;">${param.label} ${param.required ? '<span style="color: #e53e3e;">*</span>' : ''}</span>
          <input type="${inputType}" id="${fieldId}" name="${param.name}" value="${val}" placeholder="${param.placeholder || ''}" ${req} style="background: #2d3748; color: #e2e8f0; border: 1px solid #4a5568; padding: 6px 10px; border-radius: 4px; font-size: 12px;" />
        </label>
      `;
    }

    return `
      <div style="display: flex; flex-direction: column; gap: 2px;">
        ${inputHtml}
        ${param.description ? `<span style="font-size: 11px; color: #718096;">${param.description}</span>` : ''}
      </div>
    `;
  }

  private async executeTool(script: ScriptDef, form: HTMLFormElement): Promise<void> {
    const formData = new FormData(form);
    const args: Record<string, any> = {};

    for (const param of script.parameters) {
      if (param.type === 'boolean') {
        args[param.name] = formData.has(param.name);
      } else if (param.type === 'number') {
        const val = formData.get(param.name);
        args[param.name] = val !== null ? Number(val) : param.default ?? 0;
      } else {
        const val = formData.get(param.name);
        args[param.name] = val !== null ? String(val) : param.default ?? '';
      }
    }

    const runBtn = form.querySelector('#run-tool-btn') as HTMLButtonElement;
    const statusInd = form.querySelector('#exec-status-indicator') as HTMLElement | null;

    if (runBtn) {
      runBtn.disabled = true;
      runBtn.style.opacity = '0.6';
    }
    if (statusInd) {
      statusInd.textContent = 'Running...';
      statusInd.style.color = '#64b5f6';
    }

    this.logConsole.setStatus('Running', '#64b5f6');
    this.logConsole.appendLine({
      type: 'start',
      text: `▶ Launching ${script.displayName} (${script.path})...`,
      timestamp: new Date().toLocaleTimeString(),
    });

    const abortController = new AbortController();
    this.logConsole.setAbortController(abortController, () => {
      if (runBtn) {
        runBtn.disabled = false;
        runBtn.style.opacity = '1';
      }
      if (statusInd) {
        statusInd.textContent = 'Stopped';
        statusInd.style.color = '#e53e3e';
      }
    });

    try {
      const response = await fetch('/api/scripts/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scriptId: script.id, args }),
        signal: abortController.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error(`Execution request failed with status ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ')) {
            const rawData = trimmed.slice(6);
            if (rawData === '[DONE]') break;

            try {
              const event = JSON.parse(rawData);
              if (event.type === 'start') {
                this.logConsole.appendLine({
                  type: 'start',
                  text: `$ ${event.cmd}`,
                  timestamp: new Date().toLocaleTimeString(),
                });
              } else if (event.type === 'stdout') {
                this.logConsole.appendLine({
                  type: 'stdout',
                  text: event.text,
                  timestamp: new Date().toLocaleTimeString(),
                });
              } else if (event.type === 'stderr') {
                this.logConsole.appendLine({
                  type: 'stderr',
                  text: event.text,
                  timestamp: new Date().toLocaleTimeString(),
                });
              } else if (event.type === 'exit') {
                const isSuccess = event.code === 0;
                this.logConsole.appendLine({
                  type: 'exit',
                  text: `Process finished with exit code ${event.code}`,
                  timestamp: new Date().toLocaleTimeString(),
                });
                this.logConsole.setStatus(isSuccess ? 'Success' : `Failed (code ${event.code})`, isSuccess ? '#68d391' : '#e53e3e');
                if (statusInd) {
                  statusInd.textContent = isSuccess ? 'Completed' : 'Error';
                  statusInd.style.color = isSuccess ? '#68d391' : '#e53e3e';
                }
              }
            } catch (_err) {
              // Ignore invalid JSON chunks
            }
          }
        }
      }

      if (this.onVaultRefreshCb) {
        this.onVaultRefreshCb();
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        this.logConsole.appendLine({
          type: 'stderr',
          text: `Execution error: ${err.message}`,
          timestamp: new Date().toLocaleTimeString(),
        });
        this.logConsole.setStatus('Error', '#e53e3e');
        if (statusInd) {
          statusInd.textContent = 'Failed';
          statusInd.style.color = '#e53e3e';
        }
      }
    } finally {
      if (runBtn) {
        runBtn.disabled = false;
        runBtn.style.opacity = '1';
      }
      this.logConsole.setAbortController(null);
    }
  }
}
