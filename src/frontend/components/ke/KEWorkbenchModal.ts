import { KEUseCaseDef, KEUseCaseStep } from '@backend/server/agentServer';
import { getActiveProjectId } from '@frontend/storage/ApiStorage';
import { apiBus } from '@frontend/core/apiBus';
import { ApiClientError } from '@frontend/api/client';
import { eventBus } from '@frontend/core/events';
import { setHelpContext, clearHelpContext } from '@frontend/core/helpContext';
import { clampConsoleHeight } from '@frontend/core/utils/consolePanel';
import { escapeHtml } from '@frontend/core/utils/html';
import { bindResizer } from '@frontend/core/ui/resizer';
import { appStore } from '@frontend/store/appStore';
import {
  formatScheduleTime,
  POLICY_ACTION_META,
  schedulerEventToLogLine,
  statusLabel,
  toApprovalViews,
  toPolicyDecisionViews,
  toScheduleRunViews,
  toScheduleSnapshotView,
  ApprovalView,
  PolicyDecisionView,
  ScheduleJobView,
  ScheduleRunView,
  ScheduleSnapshotView,
} from '@frontend/core/utils/schedulePanel';
import { LogConsole } from '../tools/LogConsole';

export class KEWorkbenchModal {
  private overlay: HTMLElement;
  private useCases: KEUseCaseDef[] = [];
  private selectedUseCase: KEUseCaseDef | null = null;
  private logConsole!: LogConsole;
  private onVaultRefreshCb?: () => void;
  /** Reads the project selected in the header picker at request time. */
  private projectIdProvider: () => string;
  private consoleHeight = 280;
  private consoleCollapsed = false;
  private isResizingConsole = false;

  // F4 — Agent schedule tab
  private activeTab: 'usecases' | 'schedule' = 'usecases';
  private scheduleSnapshot: ScheduleSnapshotView | null = null;
  private scheduleErrors: string[] = [];
  private scheduleRuns: ScheduleRunView[] = [];
  // F5/F6 — policy decisions and the human approval queue
  private scheduleDecisions: PolicyDecisionView[] = [];
  private scheduleApprovals: ApprovalView[] = [];
  private readonly scheduleBusy = new Set<string>();
  private scheduleEventsAbort?: AbortController;
  private scheduleRunAbort?: AbortController;

  constructor(onVaultRefresh?: () => void, projectIdProvider: () => string = getActiveProjectId) {
    this.onVaultRefreshCb = onVaultRefresh;
    this.projectIdProvider = projectIdProvider;
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

    this.loadConsolePrefs();
    this.renderBase();
    // S4: a job created in the Script Control Panel refreshes an open Workbench
    // without either component calling the other.
    eventBus.on('schedule:changed', ({ projectId }) => {
      if (this.activeTab !== 'schedule' || this.overlay.style.display === 'none') return;
      if (projectId && projectId !== this.requestProjectId()) return;
      void this.refreshSchedule();
    });
  }

  private loadConsolePrefs(): void {
    try {
      const storedHeight = Number(localStorage.getItem('wiki-forge:ke-console-height'));
      if (storedHeight > 0) {
        this.consoleHeight = clampConsoleHeight(storedHeight);
      }
      this.consoleCollapsed = localStorage.getItem('wiki-forge:ke-console-collapsed') === 'true';
    } catch {
      /* storage unavailable */
    }
  }

  private saveConsolePrefs(): void {
    try {
      localStorage.setItem('wiki-forge:ke-console-height', String(this.consoleHeight));
      localStorage.setItem('wiki-forge:ke-console-collapsed', String(this.consoleCollapsed));
    } catch {
      /* storage unavailable */
    }
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
              <span id="ke-active-project" title="Wiki selezionata nel selettore progetti" style="font-size: 11px; font-family: monospace; background: #1e293b; color: #68d391; padding: 2px 8px; border-radius: 10px; margin-left: 8px;">project: …</span>
            </div>
          </div>
          <button id="ke-modal-close" style="background: none; border: none; color: #94a3b8; font-size: 20px; cursor: pointer;">✕</button>
        </div>

        <!-- Workbench tabs -->
        <div role="tablist" aria-label="Sezioni del KE Workbench" style="background: #020617; border-bottom: 1px solid #1e293b; display: flex; align-items: center; gap: 4px; padding: 8px 14px 0;">
          <button class="ke-workbench-tab" data-tab="usecases" type="button" role="tab" aria-selected="true" style="padding: 8px 14px; background: transparent; border: none; border-bottom: 2px solid #6366f1; color: #ffffff; font-weight: 700; font-size: 12px; cursor: pointer;">🧩 Use Case</button>
          <button class="ke-workbench-tab" data-tab="schedule" type="button" role="tab" aria-selected="false" style="padding: 8px 14px; background: transparent; border: none; border-bottom: 2px solid transparent; color: #94a3b8; font-weight: 700; font-size: 12px; cursor: pointer;">🤖 Agenti &amp; Schedule</button>
          <span id="ke-schedule-health" style="margin-left: 10px; font-size: 11px; color: #64748b;"></span>
          <button id="ke-schedule-refresh" type="button" title="Aggiorna stato agenti" style="margin-left: auto; background: #1e293b; color: #94a3b8; border: 1px solid #334155; padding: 3px 10px; border-radius: 4px; font-size: 11px; cursor: pointer;">↻ Aggiorna</button>
        </div>

        <!-- Main Body -->
        <div style="flex: 1; display: flex; overflow: hidden;">
          <!-- Left Sidebar: Use Cases / Schedule history -->
          <div style="width: 310px; background: #020617; border-right: 1px solid #1e293b; display: flex; flex-direction: column; overflow-y: auto; padding: 14px;">
            <div id="ke-usecase-sidebar" style="display: flex; flex-direction: column;">
              <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; margin-bottom: 10px; letter-spacing: 0.5px;">Guided Use Cases (CommonKADS)</div>
              <div id="ke-usecase-list" style="display: flex; flex-direction: column; gap: 8px;"></div>
            </div>
            <div id="ke-schedule-sidebar" style="display: none; flex-direction: column; gap: 10px;">
              <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px;">Stato Scheduler</div>
              <div id="ke-schedule-summary" style="font-size: 12px; color: #cbd5e1; line-height: 1.5;"></div>
              <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; margin-top: 6px; letter-spacing: 0.5px;">Ultimi run</div>
              <div id="ke-schedule-history" style="display: flex; flex-direction: column; gap: 6px;"></div>
            </div>
          </div>

          <!-- Right Content Area -->
          <div id="ke-right-pane" style="flex: 1; display: flex; flex-direction: column; overflow: hidden; background: #0f172a; min-height: 0; position: relative;">
            <!-- Use Case details & steps -->
            <div id="ke-usecase-container" style="flex: 1; min-height: 0; padding: 20px; overflow-y: auto; border-bottom: 1px solid #1e293b;">
              <div style="color: #94a3b8; font-style: italic;">Seleziona un Use Case guidato dal menu laterale per avviarne l'esecuzione.</div>
            </div>

            <!-- F4: scheduled agent cards -->
            <div id="ke-schedule-container" style="display: none; flex: 1; min-height: 0; padding: 20px; overflow-y: auto; border-bottom: 1px solid #1e293b;">
              <div style="color: #94a3b8; font-style: italic;">Caricamento agenti schedulati…</div>
            </div>

            <!-- Drag handle: resize the Console Output -->
            <div id="ke-console-resizer" title="Trascina per ridimensionare la Console Output" style="height: 4px; flex-shrink: 0; cursor: row-resize; background: transparent; position: relative; z-index: 6; touch-action: none;"></div>

            <!-- Bottom Half: SSE Log Console -->
            <div id="ke-console-panel" style="height: ${this.consoleHeight}px; flex-shrink: 0; padding: 12px; background: #020617; overflow: hidden;">
              <div id="ke-log-console-root" style="height: 100%;"></div>
            </div>

            <!-- Collapse toggle, kept outside the panel so it stays visible when hidden -->
            <button id="ke-console-toggle" type="button" title="Nascondi Console Output" aria-label="Nascondi Console Output" style="position: absolute; right: 16px; bottom: ${this.consoleHeight + 8}px; z-index: 10; background: #1e293b; color: #94a3b8; border: 1px solid #334155; padding: 2px 9px; border-radius: 4px; font-size: 11px; cursor: pointer; transition: color 0.15s, background 0.15s;">▾ Console</button>
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
    this.bindConsoleControls();
    this.bindScheduleControls();
  }

  private bindScheduleControls(): void {
    this.overlay.querySelectorAll<HTMLElement>('.ke-workbench-tab').forEach((button) => {
      button.addEventListener('click', () => {
        const tab = button.getAttribute('data-tab');
        if (tab === 'usecases' || tab === 'schedule') this.setTab(tab);
      });
    });

    this.overlay.querySelector('#ke-schedule-refresh')?.addEventListener('click', () => {
      void this.refreshSchedule();
    });
  }

  /**
   * Console controls mirror the file sidebar in MainLayout: a persistent small
   * toggle hides/shows the panel and a drag handle resizes it. Both height and
   * collapsed state survive closing and reopening the Workbench.
   */
  private bindConsoleControls(): void {
    const resizer = this.overlay.querySelector('#ke-console-resizer') as HTMLElement;
    const panel = this.overlay.querySelector('#ke-console-panel') as HTMLElement;
    const rightPane = this.overlay.querySelector('#ke-right-pane') as HTMLElement;
    const toggle = this.overlay.querySelector('#ke-console-toggle') as HTMLElement;
    if (!resizer || !panel || !rightPane || !toggle) return;

    bindResizer(resizer, {
      axis: 'y',
      onStart: () => { this.isResizingConsole = true; },
      onResize: event => {
        if (this.consoleCollapsed) return;
        const rect = rightPane.getBoundingClientRect();
        this.consoleHeight = clampConsoleHeight(rect.bottom - event.clientY, rect.height);
        panel.style.height = `${this.consoleHeight}px`;
        toggle.style.bottom = `${this.consoleHeight + 8}px`;
      },
      onEnd: () => {
        this.isResizingConsole = false;
        resizer.style.background = 'transparent';
        this.saveConsolePrefs();
      },
    });

    toggle.addEventListener('click', () => this.toggleConsole());

    window.addEventListener('resize', () => this.applyConsoleState());
    this.applyConsoleState();
  }

  public toggleConsole(): void {
    this.consoleCollapsed = !this.consoleCollapsed;
    this.applyConsoleState();
    this.saveConsolePrefs();
  }

  private applyConsoleState(): void {
    const resizer = this.overlay.querySelector('#ke-console-resizer') as HTMLElement;
    const panel = this.overlay.querySelector('#ke-console-panel') as HTMLElement;
    const rightPane = this.overlay.querySelector('#ke-right-pane') as HTMLElement;
    const toggle = this.overlay.querySelector('#ke-console-toggle') as HTMLElement;
    if (!resizer || !panel || !rightPane || !toggle) return;

    // A height saved in a tall window must not starve the steps pane after the
    // window shrinks. The overlay is hidden while constructed (rect = 0), so
    // only clamp once it is actually laid out.
    const rect = rightPane.getBoundingClientRect();
    if (rect.height > 0) {
      this.consoleHeight = clampConsoleHeight(this.consoleHeight, rect.height);
    }

    if (this.consoleCollapsed) {
      panel.style.display = 'none';
      resizer.style.display = 'none';
      toggle.style.bottom = '8px';
      toggle.textContent = '▴ Console';
      toggle.title = 'Mostra Console Output';
      toggle.setAttribute('aria-label', 'Mostra Console Output');
    } else {
      panel.style.display = 'block';
      resizer.style.display = '';
      panel.style.height = `${this.consoleHeight}px`;
      toggle.style.bottom = `${this.consoleHeight + 8}px`;
      toggle.textContent = '▾ Console';
      toggle.title = 'Nascondi Console Output';
      toggle.setAttribute('aria-label', 'Nascondi Console Output');
    }
  }

  public async open(): Promise<void> {
    this.overlay.style.display = 'flex';
    this.applyConsoleState();
    this.renderActiveProjectBadge();
    setHelpContext('ke-workbench');
    await this.fetchUseCases();
    this.renderUseCaseList();
    if (this.useCases.length > 0 && !this.selectedUseCase) {
      this.selectUseCase(this.useCases[0]);
    }
    // Load the agent status in the background so the tab badge is ready even
    // if the user never opens it. Reopen the live stream if the user had left
    // the Workbench on the schedule tab.
    void this.refreshSchedule();
    if (this.activeTab === 'schedule') this.openScheduleEvents();
  }

  public close(): void {
    this.closeScheduleEvents();
    this.scheduleRunAbort?.abort();
    this.scheduleRunAbort = undefined;
    this.overlay.style.display = 'none';
    clearHelpContext('ke-workbench');
  }

  /** The active project is read per request, not cached when the modal opens. */
  private getProjectId(): string {
    const id = this.projectIdProvider().trim();
    return id || 'default';
  }

  /** Every KE request must carry the selected wiki, including use-case runs.
   * The bus applies it as `X-Project-Id` via its third `dispatch`/`stream` argument. */
  private requestProjectId(): string {
    return this.getProjectId();
  }

  /** Reproduce the legacy error text: JSON `error` envelope or bare HTTP status. */
  private requestErrorDetail(err: unknown): string {
    if (err instanceof ApiClientError) {
      const body = err.body as { error?: unknown } | null;
      if (body && typeof body === 'object' && typeof body.error === 'string' && body.error) {
        return body.error;
      }
      return `HTTP ${err.status}`;
    }
    return err instanceof Error ? err.message : String(err);
  }

  private renderActiveProjectBadge(): void {
    const badge = this.overlay.querySelector('#ke-active-project');
    if (badge) badge.textContent = `project: ${this.getProjectId()}`;
  }

  private async fetchUseCases(): Promise<void> {
    try {
      const data = await apiBus.dispatch('ke.useCases.list', {}, this.requestProjectId());
      if (data.success && Array.isArray(data.useCases)) {
        this.useCases = data.useCases as unknown as KEUseCaseDef[];
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
            <div style="margin-top: 6px; font-size: 11px; color: #fbd5d5;">Endpoint: ke.useCases.list</div>
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
    const projectId = this.getProjectId();
    this.renderActiveProjectBadge();
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
      text: `▶ Launching KE Use Case: ${useCase.title} on project '${projectId}'...`,
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
      // projectId is repeated in the body for proxies that strip headers.
      await apiBus.stream(
        'ke.useCases.execute',
        { body: { useCaseId: useCase.id, stepIndex, projectId } },
        (event) => {
          try {
            const frame = JSON.parse(event.data) as {
              type?: string;
              objective?: string;
              stepNumber?: number | string;
              title?: string;
              cmd?: string;
              text: string;
              code?: number;
            };
            if (frame.type === 'start') {
              this.logConsole.appendLine({
                type: 'start',
                text: `★ Objective: ${frame.objective}`,
                timestamp: new Date().toLocaleTimeString(),
              });
            } else if (frame.type === 'step_start') {
              this.logConsole.appendLine({
                type: 'start',
                text: `[Step ${frame.stepNumber}] ${frame.title} ($ ${frame.cmd})`,
                timestamp: new Date().toLocaleTimeString(),
              });
            } else if (frame.type === 'stdout') {
              this.logConsole.appendLine({
                type: 'stdout',
                text: frame.text,
                timestamp: new Date().toLocaleTimeString(),
              });
            } else if (frame.type === 'stderr') {
              this.logConsole.appendLine({
                type: 'stderr',
                text: frame.text,
                timestamp: new Date().toLocaleTimeString(),
              });
            } else if (frame.type === 'step_end') {
              this.logConsole.appendLine({
                type: 'exit',
                text: `✓ Step ${frame.stepNumber} completed with code ${frame.code}`,
                timestamp: new Date().toLocaleTimeString(),
              });
            } else if (frame.type === 'exit') {
              this.logConsole.setStatus('Success', '#34d399');
              if (statusInd) {
                statusInd.textContent = 'Use Case Completato con Successo';
                statusInd.style.color = '#34d399';
              }
            }
          } catch (_err) {
            // Ignore invalid JSON
          }
        },
        abortController.signal,
        projectId,
      );

      if (this.onVaultRefreshCb) {
        this.onVaultRefreshCb();
      }
    } catch (err) {
      if (!(err instanceof Error && err.name === 'AbortError')) {
        // Keep the legacy wording for HTTP failures raised by the bus.
        const detail = err instanceof ApiClientError
          ? `Execution request failed with status ${err.status}`
          : err instanceof Error
            ? err.message
            : String(err);
        this.logConsole.appendLine({
          type: 'stderr',
          text: `Execution error: ${detail}`,
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

  // ------------------------------------------------------------ F4 schedule tab

  public setTab(tab: 'usecases' | 'schedule'): void {
    this.activeTab = tab;
    this.applyTabState();
    if (tab === 'schedule') {
      void this.refreshSchedule();
      this.openScheduleEvents();
    } else {
      this.closeScheduleEvents();
    }
  }

  public getActiveTab(): 'usecases' | 'schedule' {
    return this.activeTab;
  }

  private applyTabState(): void {
    this.overlay.querySelectorAll<HTMLElement>('.ke-workbench-tab').forEach((button) => {
      const active = button.getAttribute('data-tab') === this.activeTab;
      button.style.borderBottomColor = active ? '#6366f1' : 'transparent';
      button.style.color = active ? '#ffffff' : '#94a3b8';
      button.setAttribute('aria-selected', String(active));
    });
    const showSchedule = this.activeTab === 'schedule';
    const ucPane = this.overlay.querySelector('#ke-usecase-container') as HTMLElement | null;
    const schedPane = this.overlay.querySelector('#ke-schedule-container') as HTMLElement | null;
    const ucSide = this.overlay.querySelector('#ke-usecase-sidebar') as HTMLElement | null;
    const schedSide = this.overlay.querySelector('#ke-schedule-sidebar') as HTMLElement | null;
    if (ucPane) ucPane.style.display = showSchedule ? 'none' : 'block';
    if (schedPane) schedPane.style.display = showSchedule ? 'block' : 'none';
    if (ucSide) ucSide.style.display = showSchedule ? 'none' : 'flex';
    if (schedSide) schedSide.style.display = showSchedule ? 'flex' : 'none';
  }

  /** GET /api/ke/schedule — refresh cards, health badge and run history. */
  public async refreshSchedule(): Promise<void> {
    try {
      const data = await apiBus.dispatch('schedule.status', {}, this.requestProjectId());
      this.scheduleSnapshot = toScheduleSnapshotView(data.snapshot);
      this.scheduleErrors = Array.isArray(data.errors)
        ? data.errors.filter((error): error is string => typeof error === 'string')
        : [];
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      this.scheduleSnapshot = null;
      this.scheduleErrors = [`Impossibile contattare lo scheduler: ${detail}`];
    }
    await Promise.all([
      this.fetchScheduleRuns(),
      this.fetchScheduleDecisions(),
      this.fetchScheduleApprovals(),
    ]);
    this.renderSchedule();
  }

  private renderSchedule(): void {
    const pane = this.overlay.querySelector('#ke-schedule-container') as HTMLElement | null;
    const health = this.overlay.querySelector('#ke-schedule-health') as HTMLElement | null;
    const summary = this.overlay.querySelector('#ke-schedule-summary') as HTMLElement | null;
    if (!pane) return;

    const snapshot = this.scheduleSnapshot;
    if (health) {
      health.textContent = snapshot
        ? `${snapshot.running ? '🟢 Attivo' : '🔴 Fermo'} · ${snapshot.jobs.length} job · ${snapshot.jobs.filter(j => j.enabled).length} abilitati`
        : '⚪ Scheduler non disponibile';
      health.style.color = snapshot?.running ? '#34d399' : '#f87171';
    }
    if (summary) {
      summary.innerHTML = snapshot
        ? `<div>Lock: <strong>${snapshot.lockHeld ? 'attivo' : 'libero'}</strong></div>
           <div>Attivi: <strong>${snapshot.activeJobs.length}</strong></div>
           <div>Stato: <strong>${snapshot.enabled ? 'abilitato' : 'disabilitato'}</strong></div>`
        : '<div style="color:#f87171;">Nessuno snapshot disponibile.</div>';
    }

    const errorsHtml = this.scheduleErrors.length > 0
      ? `<div style="background:#742a2a; border:1px solid #9b2c2c; color:#fed7d7; padding:10px 12px; border-radius:6px; margin-bottom:12px; font-size:12px; line-height:1.5;">
           <strong>Configurazione scheduler</strong>
           ${this.scheduleErrors.map(e => `<div style="font-family:monospace; font-size:11px;">${escapeHtml(e)}</div>`).join('')}
         </div>`
      : '';

    if (!snapshot) {
      pane.innerHTML = `${errorsHtml}<div style="color:#f87171; font-size:13px;">Lo scheduler non è raggiungibile. Verifica che il server API sia in esecuzione.</div>`;
      return;
    }
    if (snapshot.jobs.length === 0) {
      pane.innerHTML = `${errorsHtml}<div style="color:#94a3b8; font-size:13px;">Nessun job schedulato configurato.</div>`;
      return;
    }

    pane.innerHTML = `${errorsHtml}
      ${this.renderPolicySection()}
      <div style="display:flex; flex-direction:column; gap:12px;">
        ${snapshot.jobs.map(job => this.renderJobCard(job)).join('')}
      </div>`;

    for (const approval of this.scheduleApprovals.filter(item => item.status === 'pending')) {
      const key = this.cssId(approval.id);
      pane.querySelector(`#ke-approve-${key}`)?.addEventListener('click', () => {
        void this.decideApproval(approval.id, 'approve');
      });
      pane.querySelector(`#ke-reject-${key}`)?.addEventListener('click', () => {
        void this.decideApproval(approval.id, 'reject');
      });
    }

    snapshot.jobs.forEach((job) => {
      pane.querySelector(`#ke-job-toggle-${this.cssId(job.id)}`)?.addEventListener('click', () => {
        void this.toggleJob(job, !job.enabled);
      });
      pane.querySelector(`#ke-job-run-${this.cssId(job.id)}`)?.addEventListener('click', () => {
        void this.runJobNow(job.id);
      });
      pane.querySelector(`#ke-job-cancel-${this.cssId(job.id)}`)?.addEventListener('click', () => {
        void this.cancelJob(job.id);
      });
      if (job.jobKind === 'script') {
        pane.querySelector(`#ke-job-delete-${this.cssId(job.id)}`)?.addEventListener('click', () => {
          void this.removeScriptJob(job.id);
        });
      }
      pane.querySelector(`#ke-job-cron-${this.cssId(job.id)}`)?.addEventListener('click', () => {
        const input = pane.querySelector(`#ke-job-cron-input-${this.cssId(job.id)}`) as HTMLInputElement | null;
        if (input?.value) void this.saveJobSchedule(job, input.value.trim());
      });
    });
  }

  private cssId(id: string): string {
    return id.replace(/[^A-Za-z0-9_-]/g, '_');
  }

  /** F5/F6 — grounded policy decisions and mutating steps awaiting a human. */
  private renderPolicySection(): string {
    const pending = this.scheduleApprovals.filter(item => item.status === 'pending');
    const decisions = this.scheduleDecisions.slice(0, 3);

    const approvalsHtml = pending.length === 0
      ? '<div style="font-size:11px; color:#64748b;">Nessuna approvazione in attesa.</div>'
      : `<div style="display:flex; flex-direction:column; gap:8px;">
           ${pending.map((item) => {
             const step = item.title || item.scriptId || `step ${item.stepIndex}`;
             const isScriptJob = item.jobKind === 'script';
             const args = item.scriptArgs
               ? Object.entries(item.scriptArgs)
                   .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
                   .join(', ')
               : '';
             return `<div class="ke-approval-card" data-approval-id="${escapeHtml(item.id)}" style="background:#1e1b4b; border:1px solid #4338ca; border-radius:6px; padding:10px 12px;">
               <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
                 <div style="font-size:12px; font-weight:700; color:#e0e7ff;">⏸ ${escapeHtml(item.jobId)} · ${isScriptJob ? 'job script' : 'use case'} · ${escapeHtml(step)}</div>
                 <div style="display:flex; gap:6px;">
                   <button id="ke-approve-${this.cssId(item.id)}" type="button" title="Esegui lo step mutante" style="background:#14532d; color:#bbf7d0; border:1px solid #166534; padding:3px 10px; border-radius:4px; font-size:11px; font-weight:700; cursor:pointer;">✅ Approva</button>
                   <button id="ke-reject-${this.cssId(item.id)}" type="button" title="Rifiuta lo step mutante" style="background:#7f1d1d; color:#fecaca; border:1px solid #991b1b; padding:3px 10px; border-radius:4px; font-size:11px; font-weight:700; cursor:pointer;">❌ Rifiuta</button>
                 </div>
               </div>
               ${isScriptJob ? `<div style="font-size:11px; color:#c7d2fe; margin-top:6px;"><strong>Args risolti:</strong> <code style="color:#a5b4fc;">${escapeHtml(args || '—')}</code></div>` : ''}
                <div style="font-size:11px; color:#c7d2fe; margin-top:6px;"><strong>Motivazione:</strong> ${escapeHtml(item.rationale || '—')}</div>
               <div style="font-size:11px; color:#94a3b8; margin-top:4px;"><strong>Fonti:</strong> ${item.sources.length ? item.sources.map(source => `<code style="color:#a5b4fc;">${escapeHtml(source)}</code>`).join(', ') : '—'}</div>
             </div>`;
           }).join('')}
         </div>`;

    const decisionsHtml = decisions.length === 0
      ? '<div style="font-size:11px; color:#64748b;">Nessuna decisione di policy registrata.</div>'
      : `<div style="display:flex; flex-direction:column; gap:6px;">
           ${decisions.map((item) => {
             const meta = POLICY_ACTION_META[item.action] ?? POLICY_ACTION_META.allow;
             return `<div class="ke-policy-decision" style="background:#0f172a; border-left:3px solid ${meta.color}; border-radius:4px; padding:6px 10px;">
               <div style="font-size:11px; font-weight:700; color:${meta.color};">${meta.icon} ${meta.label} · ${escapeHtml(item.jobId)} <span style="color:#64748b; font-weight:400;">(${item.origin === 'llm' ? 'LLM' : 'fallback'} · ${escapeHtml(formatScheduleTime(item.at))})</span></div>
               <div style="font-size:11px; color:#cbd5e1; margin-top:3px;">${escapeHtml(item.rationale || '—')}</div>
               <div style="font-size:10px; color:#64748b; margin-top:3px;">Fonti: ${item.sources.length ? item.sources.map(source => escapeHtml(source)).join(', ') : '—'}</div>
             </div>`;
           }).join('')}
         </div>`;

    return `<div class="ke-policy-section" style="background:#020617; border:1px solid #312e81; border-radius:8px; padding:12px 14px; margin-bottom:14px; display:flex; flex-direction:column; gap:12px;">
      <div>
        <div style="font-size:11px; font-weight:700; text-transform:uppercase; color:#a5b4fc; letter-spacing:0.5px; margin-bottom:6px;">⏸ Approvazioni in attesa (${pending.length})</div>
        ${approvalsHtml}
      </div>
      <div>
        <div style="font-size:11px; font-weight:700; text-transform:uppercase; color:#a5b4fc; letter-spacing:0.5px; margin-bottom:6px;">🧠 Decisioni Policy Agent</div>
        ${decisionsHtml}
      </div>
    </div>`;
  }

  private async fetchScheduleDecisions(): Promise<void> {
    try {
      const data = await apiBus.dispatch(
        'schedule.decisions',
        { query: { limit: 5 } },
        this.requestProjectId(),
      );
      this.scheduleDecisions = toPolicyDecisionViews(data);
    } catch {
      this.scheduleDecisions = [];
    }
  }

  private async fetchScheduleApprovals(): Promise<void> {
    try {
      const data = await apiBus.dispatch(
        'schedule.approvals',
        { query: { status: 'pending' } },
        this.requestProjectId(),
      );
      this.scheduleApprovals = toApprovalViews(data);
    } catch {
      this.scheduleApprovals = [];
    }
  }

  /** F6 — a mutating step runs only after this explicit human decision. */
  private async decideApproval(id: string, action: 'approve' | 'reject'): Promise<void> {
    const identity = appStore.getState().auth.identity;
    // B7 — a verified IdP actor replaces the hardcoded label in strict mode;
    // legacy mode keeps 'utente workbench' byte-for-byte.
    const reviewer = identity?.strict && identity.source === 'idp'
      ? identity.actor
      : 'utente workbench';
    try {
      const data = await apiBus.dispatch(
        'schedule.approvalDecision',
        { params: { id, action }, body: { reviewer } },
        this.requestProjectId(),
      );
      if (data.success === false) {
        throw new Error((data as { error?: string }).error ?? 'HTTP 200');
      }
      this.logConsole.appendLine({
        type: 'info',
        text: `${action === 'approve' ? '✅ Approvato' : '❌ Rifiutato'} step mutante '${id}'`,
        timestamp: new Date().toLocaleTimeString(),
      });
    } catch (err) {
      const detail = this.requestErrorDetail(err);
      this.logConsole.appendLine({
        type: 'stderr',
        text: `Decisione su '${id}' non riuscita: ${detail}`,
        timestamp: new Date().toLocaleTimeString(),
      });
    }
    await this.refreshSchedule();
  }

  private renderJobCard(job: ScheduleJobView): string {
    const status = statusLabel(job.lastStatus);
    const busy = this.scheduleBusy.has(job.id) || job.active;
    const steps = job.steps && job.steps.length > 0 ? ` · step ${job.steps.join(', ')}` : '';
    const scriptBadge = job.jobKind === 'script'
      ? `<span style="font-size:10px; font-weight:700; color:#fbbf24; background:#422006; border:1px solid #92400e; border-radius:10px; padding:2px 8px; margin-left:8px;">🕒 job script${job.scriptId ? ` · ${escapeHtml(job.scriptId)}` : ''}</span>`
      : '';
    const resolvedArgs = job.args ? JSON.stringify(job.args) : '';
    return `
      <div class="ke-sched-card" data-job-id="${escapeHtml(job.id)}" style="background:#020617; border:1px solid #334155; border-radius:8px; padding:14px;">
        <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px;">
          <div>
            <div style="font-weight:700; font-size:14px; color:#f8fafc;">${escapeHtml(job.role)}</div>
            <div style="font-size:11px; color:#a5b4fc; font-family:monospace;">${escapeHtml(job.useCaseId)}${scriptBadge}</div>
            ${resolvedArgs ? `<div style="font-size:10px; color:#94a3b8; font-family:monospace; margin-top:4px;">Args risolti: ${escapeHtml(resolvedArgs)}</div>` : ''}
          </div>
          <span style="font-size:11px; font-weight:700; color:${status.color}; background:#1e293b; border-radius:12px; padding:3px 10px; white-space:nowrap;">${status.icon} ${status.label}</span>
        </div>
        <div style="font-size:12px; color:#94a3b8; margin-top:8px;">${escapeHtml(job.description)}${steps}</div>
        <div style="font-size:11px; color:#64748b; margin-top:4px;">Prossima corsa: <strong style="color:#cbd5e1;">${escapeHtml(formatScheduleTime(job.nextRunAt))}</strong> · Ultimo run: ${escapeHtml(formatScheduleTime(job.lastRunAt))}</div>
        ${job.lastError ? `<div style="font-size:11px; color:#f87171; margin-top:6px; font-family:monospace;">${escapeHtml(job.lastError)}</div>` : ''}
        ${job.consecutiveFailures > 0 ? `<div style="font-size:11px; color:#fbbf24; margin-top:4px;">${job.consecutiveFailures} fallimenti consecutivi</div>` : ''}
        <div style="display:flex; align-items:center; flex-wrap:wrap; gap:8px; margin-top:12px;">
          <button id="ke-job-toggle-${this.cssId(job.id)}" type="button" style="background:${job.enabled ? '#312e81' : '#1e293b'}; color:#c7d2fe; border:1px solid #4338ca; padding:4px 10px; border-radius:4px; font-size:11px; font-weight:600; cursor:pointer;">${job.enabled ? '⏸ Disabilita' : '▶ Abilita'}</button>
          <button id="ke-job-run-${this.cssId(job.id)}" type="button" style="background:#4f46e5; color:#ffffff; border:none; padding:4px 12px; border-radius:4px; font-size:11px; font-weight:700; cursor:pointer;" ${busy ? 'disabled' : ''}>⚡ Esegui ora</button>
          <button id="ke-job-cancel-${this.cssId(job.id)}" type="button" style="background:#7f1d1d; color:#fecaca; border:1px solid #991b1b; padding:4px 10px; border-radius:4px; font-size:11px; font-weight:600; cursor:pointer;" ${job.active ? '' : 'disabled'}>⏹ Annulla</button>
          ${job.jobKind === 'script' ? `<button id="ke-job-delete-${this.cssId(job.id)}" type="button" title="Rimuove il job da config/script_schedules.toml" style="background:#3f3f46; color:#fecaca; border:1px solid #71717a; padding:4px 10px; border-radius:4px; font-size:11px; font-weight:600; cursor:pointer;">🗑 Rimuovi</button>` : ''}
          <input id="ke-job-cron-input-${this.cssId(job.id)}" type="text" value="${escapeHtml(job.expression)}" aria-label="Cron di ${escapeHtml(job.id)}" style="background:#0f172a; color:#e2e8f0; border:1px solid #334155; border-radius:4px; padding:4px 6px; font-family:monospace; font-size:11px; width:120px;" />
          <button id="ke-job-cron-${this.cssId(job.id)}" type="button" title="Salva orario (cron o every=...)" style="background:#1e293b; color:#94a3b8; border:1px solid #334155; padding:4px 8px; border-radius:4px; font-size:11px; cursor:pointer;">Salva orario</button>
        </div>
      </div>`;
  }

  private async fetchScheduleRuns(): Promise<void> {
    const host = this.overlay.querySelector('#ke-schedule-history') as HTMLElement | null;
    if (!host) return;
    try {
      const data = await apiBus.dispatch('schedule.runs', { query: { limit: 8 } }, this.requestProjectId());
      this.scheduleRuns = toScheduleRunViews(data);
    } catch {
      this.scheduleRuns = [];
    }
    host.innerHTML = this.scheduleRuns.length === 0
      ? '<div style="font-size:11px; color:#64748b;">Nessun run registrato.</div>'
      : this.scheduleRuns.map(run => {
          const status = statusLabel(run.status);
          return `<div style="background:#1e293b; border-radius:4px; padding:6px 8px; font-size:11px; color:#cbd5e1;">
            <span style="color:${status.color}; font-weight:700;">${status.icon}</span>
            ${escapeHtml(run.job)}<br/>
            <span style="color:#64748b;">${escapeHtml(formatScheduleTime(run.startedAt))}</span>
          </div>`;
        }).join('');
  }

  /** S4 — DELETE /api/scripts/schedule/:jobId (Use Case jobs have no remove button). */
  private async removeScriptJob(jobId: string): Promise<void> {
    try {
      const data = await apiBus.dispatch(
        'scripts.unschedule',
        { params: { jobId } },
        this.requestProjectId(),
      );
      if (data.success === false) {
        throw new Error((data as { error?: string }).error ?? 'HTTP 200');
      }
      this.logConsole.appendLine({
        type: 'info',
        text: `🗑 Job script '${jobId}' rimosso dalla configurazione`,
        timestamp: new Date().toLocaleTimeString(),
      });
    } catch (err) {
      const detail = this.requestErrorDetail(err);
      this.logConsole.appendLine({
        type: 'stderr',
        text: `Rimozione di '${jobId}' non riuscita: ${detail}`,
        timestamp: new Date().toLocaleTimeString(),
      });
    }
    await this.refreshSchedule();
  }

  private async toggleJob(job: ScheduleJobView, enabled: boolean): Promise<void> {
    try {
      await apiBus.dispatch(
        'schedule.patch',
        { params: { jobId: job.id }, body: { enabled } },
        this.requestProjectId(),
      );
      await this.refreshSchedule();
    } catch (err) {
      const detail = this.requestErrorDetail(err);
      this.logConsole.appendLine({
        type: 'stderr',
        text: `Aggiornamento job '${job.id}' non riuscito: ${detail}`,
        timestamp: new Date().toLocaleTimeString(),
      });
    }
  }

  private async saveJobSchedule(job: ScheduleJobView, expression: string): Promise<void> {
    try {
      await apiBus.dispatch(
        'schedule.patch',
        { params: { jobId: job.id }, body: { schedule: expression } },
        this.requestProjectId(),
      );
      await this.refreshSchedule();
    } catch (err) {
      const detail = this.requestErrorDetail(err);
      this.logConsole.appendLine({
        type: 'stderr',
        text: `Orario di '${job.id}' non valido: ${detail}`,
        timestamp: new Date().toLocaleTimeString(),
      });
    }
  }

  /** POST /api/ke/schedule/:id/run — stream scheduler + Use Case events to the shared console. */
  private async runJobNow(jobId: string): Promise<void> {
    if (this.scheduleBusy.has(jobId)) return;
    const controller = new AbortController();
    this.scheduleRunAbort = controller;
    this.scheduleBusy.add(jobId);
    this.renderSchedule();
    this.logConsole.setStatus('Running', '#818cf8');
    this.logConsole.appendLine({
      type: 'start',
      text: `▶ Avvio job schedulato: ${jobId}`,
      timestamp: new Date().toLocaleTimeString(),
    });
    this.logConsole.setAbortController(controller, () => {
      void this.cancelJob(jobId);
    });

    let finalStatus = 'cancelled';
    try {
      let finished = false;
      await apiBus.stream(
        'schedule.run',
        { params: { jobId } },
        (event) => {
          if (finished) return;
          let frame: Record<string, unknown>;
          try {
            frame = JSON.parse(event.data) as Record<string, unknown>;
          } catch (_err) {
            return; // Ignore malformed frames like the previous reader did.
          }
          const line = schedulerEventToLogLine(frame, new Date().toLocaleTimeString());
          if (line) this.logConsole.appendLine(line);
          if (frame.type === 'job_finished' && frame.jobId === jobId) {
            finalStatus = typeof frame.status === 'string' ? frame.status : 'cancelled';
            finished = true;
          }
        },
        controller.signal,
        this.requestProjectId(),
      );
      const meta = statusLabel(finalStatus as any);
      this.logConsole.setStatus(meta.label, meta.color);
    } catch (err) {
      if (!(err instanceof Error && err.name === 'AbortError')) {
        const detail = this.requestErrorDetail(err);
        this.logConsole.appendLine({
          type: 'stderr',
          text: `Esecuzione job '${jobId}' non riuscita: ${detail}`,
          timestamp: new Date().toLocaleTimeString(),
        });
        this.logConsole.setStatus('Error', '#ef4444');
      }
    } finally {
      this.scheduleBusy.delete(jobId);
      if (this.scheduleRunAbort === controller) {
        this.scheduleRunAbort = undefined;
        this.logConsole.setAbortController(null);
      }
      await this.refreshSchedule();
    }
  }

  private async cancelJob(jobId: string): Promise<void> {
    try {
      await apiBus.dispatch('schedule.cancel', { params: { jobId } }, this.requestProjectId());
      this.logConsole.appendLine({
        type: 'info',
        text: `⏹ Annullamento richiesto per '${jobId}'`,
        timestamp: new Date().toLocaleTimeString(),
      });
    } catch (err) {
      const detail = this.requestErrorDetail(err);
      this.logConsole.appendLine({
        type: 'stderr',
        text: `Annullamento di '${jobId}' non riuscito: ${detail}`,
        timestamp: new Date().toLocaleTimeString(),
      });
    }
    await this.refreshSchedule();
  }

  /** GET /api/ke/schedule/events — live status for the job cards. */
  private openScheduleEvents(): void {
    this.closeScheduleEvents();
    const controller = new AbortController();
    this.scheduleEventsAbort = controller;

    // The bus delivers parsed SSE frames synchronously; keep refreshes ordered.
    let refreshChain: Promise<void> = Promise.resolve();
    void (async () => {
      try {
        await apiBus.stream(
          'schedule.events',
          {},
          (event) => {
            let frame: Record<string, unknown>;
            try {
              frame = JSON.parse(event.data) as Record<string, unknown>;
            } catch (_err) {
              return; // Ignore malformed frames like the previous reader did.
            }
            if (frame.type === 'snapshot') {
              const view = toScheduleSnapshotView(frame.snapshot);
              if (view) {
                this.scheduleSnapshot = view;
                this.renderSchedule();
              }
            } else if (
              frame.type === 'job_started' ||
              frame.type === 'job_finished' ||
              frame.type === 'job_retry' ||
              frame.type === 'job_skipped' ||
              frame.type === 'policy_decision' ||
              frame.type === 'approval_required' ||
              frame.type === 'event_triggered' ||
              frame.type === 'jobs_changed'
            ) {
              refreshChain = refreshChain
                .then(() => this.refreshSchedule())
                .catch(() => { /* keep the stream alive */ });
            }
          },
          controller.signal,
          this.requestProjectId(),
        );
        await refreshChain;
      } catch (err) {
        // Closing the tab or the modal aborts this stream on purpose.
        if (!(err instanceof Error && err.name === 'AbortError')) {
          console.warn('KE schedule events stream ended:', err);
        }
      }
    })();
  }

  private closeScheduleEvents(): void {
    this.scheduleEventsAbort?.abort();
    this.scheduleEventsAbort = undefined;
  }
}
