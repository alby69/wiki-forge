import { KEUseCaseDef, KEUseCaseStep } from '../../server/agentServer';
import { resolveApiBaseUrl } from '../../storage/ApiStorage';
import { LogConsole } from '../tools/LogConsole';

export class KEWorkbenchModal {
  private overlay: HTMLElement;
  private useCases: KEUseCaseDef[] = [];
  private selectedUseCase: KEUseCaseDef | null = null;
  private logConsole!: LogConsole;
  private onVaultRefreshCb?: () => void;
  private apiBaseUrl: string = resolveApiBaseUrl();

  constructor(onVaultRefresh?: () => void) {
    this.onVaultRefreshCb = onVaultRefresh;
    this.overlay = document.createElement('div');
    this.overlay.id = 'ke-workbench-modal-root';
    this.overlay.style.position = 'fixed';
    this.overlay.style.top = '0';
    this.overlay.style.left = '0';
    this.overlay.style.width = '100vw';
    this.overlay.style.height = '100vh';
    this.overlay.style.background = 'rgba(0, 0, 0, 0.8)';
    this.overlay.style.zIndex = '2050';
    this.overlay.style.display = 'none';
    this.overlay.style.alignItems = 'center';
    this.overlay.style.justifyContent = 'center';
    document.body.appendChild(this.overlay);

    this.renderBase();
  }

  private renderBase(): void {
    this.overlay.innerHTML = `
      <div style="background: #0f172a; border: 1px solid #334155; border-radius: 10px; width: 92vw; max-width: 1200px; height: 88vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.7);">
        <!-- Header -->
        <div style="height: 54px; background: #020617; border-bottom: 1px solid #1e293b; display: flex; align-items: center; justify-content: space-between; padding: 0 20px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 22px;">🧠</span>
            <div>
              <span style="font-weight: 700; font-size: 16px; color: #a5b4fc; letter-spacing: 0.5px;">Knowledge Engineer Workbench</span>
              <span style="font-size: 11px; background: #1e1b4b; color: #c7d2fe; padding: 2px 8px; border-radius: 4px; margin-left: 8px; font-weight: 600;">KE Guided Wizard Mode</span>
            </div>
          </div>
          <button id="ke-modal-close" style="background: none; border: none; color: #94a3b8; font-size: 20px; cursor: pointer;">✕</button>
        </div>

        <!-- Main Body -->
        <div style="flex: 1; display: flex; overflow: hidden;">
          <!-- Left Sidebar: KE Use Cases -->
          <div style="width: 310px; background: #020617; border-right: 1px solid #1e293b; display: flex; flex-direction: column; overflow-y: auto; padding: 14px;">
            <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; margin-bottom: 10px; letter-spacing: 0.5px;">Guided Use Cases (CommonKADS)</div>
            <div id="ke-usecase-list" style="display: flex; flex-direction: column; gap: 8px;"></div>
          </div>

          <!-- Right Content Area -->
          <div style="flex: 1; display: flex; flex-direction: column; overflow: hidden; background: #0f172a;">
            <!-- Top Half: Use Case Details & Steps -->
            <div id="ke-usecase-container" style="flex: 1; padding: 20px; overflow-y: auto; border-bottom: 1px solid #1e293b;">
              <div style="color: #94a3b8; font-style: italic;">Seleziona un Use Case guidato dal menu laterale per avviarne l'esecuzione.</div>
            </div>

            <!-- Bottom Half: SSE Log Console -->
            <div style="height: 280px; padding: 12px; background: #020617;">
              <div id="ke-log-console-root" style="height: 100%;"></div>
            </div>
          </div>
        </div>
      </div>
    `;

    const closeBtn = this.overlay.querySelector('#ke-modal-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.close());
    }

    const consoleHost = this.overlay.querySelector('#ke-log-console-root') as HTMLElement;
    this.logConsole = new LogConsole(consoleHost);
  }

  public async open(): Promise<void> {
    this.overlay.style.display = 'flex';
    await this.fetchUseCases();
    this.renderUseCaseList();
    if (this.useCases.length > 0 && !this.selectedUseCase) {
      this.selectUseCase(this.useCases[0]);
    }
  }

  public close(): void {
    this.overlay.style.display = 'none';
  }

  private async fetchUseCases(): Promise<void> {
    const url = `${this.apiBaseUrl}/api/ke/use-cases`;
    try {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }
      const data = await res.json();
      if (data.success && Array.isArray(data.useCases)) {
        this.useCases = data.useCases;
      }
    } catch (err) {
      // Surface the failure instead of silently rendering an empty menu.
      const detail = err instanceof Error ? err.message : String(err);
      const listEl = this.overlay.querySelector('#ke-usecase-list');
      if (listEl) {
        listEl.innerHTML = `
          <div style="font-size: 12px; color: #feb2b2; background: #742a2a; border: 1px solid #9b2c2c; border-radius: 4px; padding: 10px; line-height: 1.4;">
            <strong style="display: block; margin-bottom: 4px;">Impossibile caricare gli Use Case</strong>
            <span style="font-family: monospace; font-size: 11px;">${detail}</span>
            <div style="margin-top: 6px; font-size: 11px; color: #fbd5d5;">Endpoint: ${url}</div>
          </div>
        `;
      }
      console.error('Failed to load KE Use Cases:', err);
    }
  }

  private renderUseCaseList(): void {
    const listEl = this.overlay.querySelector('#ke-usecase-list');
    if (!listEl) return;

    if (this.useCases.length === 0) {
      listEl.innerHTML = `<div style="font-size: 12px; color: #94a3b8;">Nessun Use Case KE registrato.</div>`;
      return;
    }

    listEl.innerHTML = this.useCases
      .map(u => {
        const isSelected = this.selectedUseCase?.id === u.id;
        return `
          <button class="ke-usecase-item" data-id="${u.id}" style="text-align: left; background: ${
          isSelected ? 'rgba(99, 102, 241, 0.2)' : '#1e293b'
        }; color: ${isSelected ? '#ffffff' : '#cbd5e1'}; border: 1px solid ${
          isSelected ? '#6366f1' : '#334155'
        }; padding: 10px 12px; border-radius: 6px; cursor: pointer; display: flex; flex-direction: column; gap: 4px; transition: all 0.15s;">
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <span style="font-weight: 700; font-size: 13px; color: ${isSelected ? '#818cf8' : '#f8fafc'};">${u.title}</span>
            </div>
            <span style="font-size: 11px; opacity: 0.8; line-height: 1.3;">${u.summary}</span>
            <span style="font-size: 10px; color: #a5b4fc; font-weight: 600; margin-top: 2px;">${u.category} • ${u.steps.length} Passaggi</span>
          </button>
        `;
      })
      .join('');

    const items = listEl.querySelectorAll('.ke-usecase-item');
    items.forEach(item => {
      item.addEventListener('click', () => {
        const id = item.getAttribute('data-id');
        const found = this.useCases.find(u => u.id === id);
        if (found) {
          this.selectUseCase(found);
          this.renderUseCaseList();
        }
      });
    });
  }

  private selectUseCase(useCase: KEUseCaseDef): void {
    this.selectedUseCase = useCase;
    const container = this.overlay.querySelector('#ke-usecase-container');
    if (!container) return;

    const stepsHtml = useCase.steps
      .map(s => this.renderStepCard(s, useCase.id))
      .join('');

    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 18px;">
        <div style="background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 16px;">
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <h3 style="margin: 0; font-size: 18px; color: #818cf8; font-weight: 700;">${useCase.title}</h3>
            <span style="font-size: 11px; background: #312e81; color: #c7d2fe; padding: 3px 10px; border-radius: 12px; font-weight: 600;">${useCase.category}</span>
          </div>
          <div style="font-size: 13px; color: #cbd5e1; margin-top: 8px; line-height: 1.4;">${useCase.summary}</div>
          <div style="font-size: 12px; color: #94a3b8; margin-top: 6px;"><strong>Obiettivo KE:</strong> ${useCase.objective}</div>

          <div style="margin-top: 14px; display: flex; align-items: center; gap: 12px;">
            <button id="run-all-steps-btn" style="background: #4f46e5; color: #ffffff; border: none; padding: 8px 18px; border-radius: 6px; font-weight: 700; font-size: 13px; cursor: pointer; display: flex; align-items: center; gap: 6px;">
              ▶ Esegui Tutti i Passaggi dell'Use Case
            </button>
            <span id="ke-exec-status" style="font-size: 12px; color: #94a3b8;">Pronto per l'esecuzione guidata</span>
          </div>
        </div>

        <div>
          <h4 style="margin: 0 0 10px 0; font-size: 14px; color: #f8fafc; font-weight: 700;">Passaggi Operativi del Workflow</h4>
          <div style="display: flex; flex-direction: column; gap: 10px;">
            ${stepsHtml}
          </div>
        </div>
      </div>
    `;

    const runAllBtn = container.querySelector('#run-all-steps-btn');
    if (runAllBtn) {
      runAllBtn.addEventListener('click', () => this.executeUseCase(useCase));
    }

    useCase.steps.forEach((step, idx) => {
      const stepBtn = container.querySelector(`#run-step-btn-${idx}`);
      if (stepBtn) {
        stepBtn.addEventListener('click', () => this.executeUseCase(useCase, idx));
      }
    });
  }

  private renderStepCard(step: KEUseCaseStep, useCaseId: string): string {
    return `
      <div style="background: #020617; border: 1px solid #1e293b; border-radius: 6px; padding: 12px 14px; display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;">
        <div style="display: flex; gap: 12px;">
          <div style="background: #312e81; color: #a5b4fc; width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 12px; flex-shrink: 0;">
            ${step.stepNumber}
          </div>
          <div>
            <div style="font-weight: 600; font-size: 13px; color: #f8fafc;">${step.title}</div>
            <div style="font-size: 12px; color: #94a3b8; margin-top: 2px; line-height: 1.3;">${step.description}</div>
            <div style="font-size: 11px; font-family: monospace; color: #64748b; margin-top: 4px;">Script: ${step.scriptId}.py</div>
          </div>
        </div>
        <button id="run-step-btn-${step.stepNumber - 1}" style="background: #1e293b; color: #818cf8; border: 1px solid #334155; padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: 600; cursor: pointer; white-space: nowrap;">
          Esegui Step ${step.stepNumber}
        </button>
      </div>
    `;
  }

  private async executeUseCase(useCase: KEUseCaseDef, stepIndex?: number): Promise<void> {
    const statusInd = this.overlay.querySelector('#ke-exec-status') as HTMLElement | null;
    const runAllBtn = this.overlay.querySelector('#run-all-steps-btn') as HTMLButtonElement | null;

    if (runAllBtn) runAllBtn.disabled = true;
    if (statusInd) {
      statusInd.textContent = typeof stepIndex === 'number' ? `Esecuzione Step ${stepIndex + 1}...` : 'Esecuzione Use Case in corso...';
      statusInd.style.color = '#818cf8';
    }

    this.logConsole.setStatus('Running', '#818cf8');
    this.logConsole.appendLine({
      type: 'start',
      text: `▶ Launching KE Use Case: ${useCase.title}...`,
      timestamp: new Date().toLocaleTimeString(),
    });

    const abortController = new AbortController();
    this.logConsole.setAbortController(abortController, () => {
      if (runAllBtn) runAllBtn.disabled = false;
      if (statusInd) {
        statusInd.textContent = 'Interrotto dall\'utente';
        statusInd.style.color = '#ef4444';
      }
    });

    try {
      const response = await fetch(`${this.apiBaseUrl}/api/ke/use-cases/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ useCaseId: useCase.id, stepIndex }),
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
                  text: `★ Objective: ${event.objective}`,
                  timestamp: new Date().toLocaleTimeString(),
                });
              } else if (event.type === 'step_start') {
                this.logConsole.appendLine({
                  type: 'start',
                  text: `[Step ${event.stepNumber}] ${event.title} ($ ${event.cmd})`,
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
              } else if (event.type === 'step_end') {
                this.logConsole.appendLine({
                  type: 'exit',
                  text: `✓ Step ${event.stepNumber} completed with code ${event.code}`,
                  timestamp: new Date().toLocaleTimeString(),
                });
              } else if (event.type === 'exit') {
                this.logConsole.setStatus('Success', '#34d399');
                if (statusInd) {
                  statusInd.textContent = 'Use Case Completato con Successo';
                  statusInd.style.color = '#34d399';
                }
              }
            } catch (_err) {
              // Ignore invalid JSON
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
        this.logConsole.setStatus('Error', '#ef4444');
        if (statusInd) {
          statusInd.textContent = 'Errore di Esecuzione';
          statusInd.style.color = '#ef4444';
        }
      }
    } finally {
      if (runAllBtn) runAllBtn.disabled = false;
      this.logConsole.setAbortController(null);
    }
  }
}
