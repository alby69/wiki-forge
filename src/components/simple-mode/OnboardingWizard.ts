import { ApiStorage } from '../../storage/ApiStorage';
import { appStore } from '../../store/appStore';
import { DropZoneIngest } from './DropZoneIngest';

export interface OnboardingWizardOptions {
  storage: ApiStorage;
  onComplete?: () => void;
}

export class OnboardingWizard {
  private container: HTMLElement;
  private storage: ApiStorage;
  private onCompleteCb?: () => void;
  private currentStep: 1 | 2 | 3 = 1;

  private selectedScenario: string = 'academic';
  private selectedModel: string = 'claude-sonnet-4-6';
  private uploadedCount: number = 0;

  constructor(options: OnboardingWizardOptions) {
    this.storage = options.storage;
    this.onCompleteCb = options.onComplete;

    this.container = document.createElement('div');
    this.container.className = 'wf-modal-overlay';
    this.container.id = 'onboarding-wizard-modal';
    this.container.style.display = 'none';
    document.body.appendChild(this.container);
  }

  public open(): void {
    this.currentStep = 1;
    this.container.style.display = 'flex';
    this.render();
  }

  public close(): void {
    this.container.style.display = 'none';
  }

  public render(): void {
    this.container.innerHTML = `
      <div class="wf-modal-content" style="width: 640px; max-width: 92vw; padding: 24px;">

        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 22px;">🪄</span>
            <div>
              <h2 style="margin: 0; font-size: 18px; font-weight: 700; color: #f8fafc;">Benvenuto in Wiki-Forge</h2>
              <div style="font-size: 12px; color: #94a3b8;">Guida al primo avvio &bull; Step ${this.currentStep} di 3</div>
            </div>
          </div>
          <button id="wizard-close-btn" style="background: none; border: none; color: #94a3b8; font-size: 20px; cursor: pointer;">✕</button>
        </div>

        <!-- Progress Indicator -->
        <div style="display: flex; gap: 8px; margin-bottom: 24px;">
          <div style="flex: 1; height: 4px; border-radius: 2px; background: ${this.currentStep >= 1 ? '#6366f1' : '#334155'}; transition: background 0.3s;"></div>
          <div style="flex: 1; height: 4px; border-radius: 2px; background: ${this.currentStep >= 2 ? '#6366f1' : '#334155'}; transition: background 0.3s;"></div>
          <div style="flex: 1; height: 4px; border-radius: 2px; background: ${this.currentStep >= 3 ? '#6366f1' : '#334155'}; transition: background 0.3s;"></div>
        </div>

        <!-- Step Content -->
        <div id="wizard-step-body" style="min-height: 260px;">
          ${this.renderStepContent()}
        </div>

        <!-- Footer Navigation -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 24px; padding-top: 16px; border-top: 1px solid #334155;">
          <button id="wizard-prev-btn" style="background: #334155; color: #f8fafc; border: none; padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; visibility: ${this.currentStep > 1 ? 'visible' : 'hidden'};">Indietro</button>
          <button id="wizard-next-btn" style="background: #4f46e5; color: #ffffff; border: none; padding: 8px 20px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer;">${this.currentStep === 3 ? 'Inizia &amp; Salva' : 'Avanti'}</button>
        </div>

      </div>
    `;

    this.attachEventListeners();
    if (this.currentStep === 2) {
      const dropzoneSlot = this.container.querySelector('#wizard-dropzone-slot');
      if (dropzoneSlot) {
        new DropZoneIngest(dropzoneSlot as HTMLElement, {
          storage: this.storage,
          onSuccess: count => {
            this.uploadedCount = count;
          },
        });
      }
    }
  }

  private renderStepContent(): string {
    if (this.currentStep === 1) {
      return `
        <div>
          <h3 style="margin: 0 0 8px 0; font-size: 15px; color: #f8fafc;">Step 1: Qual è il tuo obiettivo principale?</h3>
          <p style="margin: 0 0 16px 0; font-size: 13px; color: #94a3b8;">Seleziona uno scenario per personalizzare la tua esperienza e la struttura della wiki.</p>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div class="scenario-card ${this.selectedScenario === 'academic' ? 'selected' : ''}" data-scenario="academic" style="padding: 14px; border: 2px solid ${this.selectedScenario === 'academic' ? '#6366f1' : '#334155'}; border-radius: 12px; background: rgba(30, 41, 59, 0.5); cursor: pointer;">
              <div style="font-size: 20px;">🎓</div>
              <div style="font-weight: 600; font-size: 13px; color: #f8fafc; margin-top: 4px;">Tesi Magistrale &amp; Ricerca</div>
              <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">Revisione della letteratura, citazioni grounded e sintesi.</div>
            </div>

            <div class="scenario-card ${this.selectedScenario === 'business' ? 'selected' : ''}" data-scenario="business" style="padding: 14px; border: 2px solid ${this.selectedScenario === 'business' ? '#6366f1' : '#334155'}; border-radius: 12px; background: rgba(30, 41, 59, 0.5); cursor: pointer;">
              <div style="font-size: 20px;">🏢</div>
              <div style="font-weight: 600; font-size: 13px; color: #f8fafc; margin-top: 4px;">Business KB &amp; Policy</div>
              <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">SOP, verbali di riunioni e procedure operative.</div>
            </div>

            <div class="scenario-card ${this.selectedScenario === 'research' ? 'selected' : ''}" data-scenario="research" style="padding: 14px; border: 2px solid ${this.selectedScenario === 'research' ? '#6366f1' : '#334155'}; border-radius: 12px; background: rgba(30, 41, 59, 0.5); cursor: pointer;">
              <div style="font-size: 20px;">📰</div>
              <div style="font-weight: 600; font-size: 13px; color: #f8fafc; margin-top: 4px;">Ricerca Competitiva</div>
              <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">Analisi di articoli, report e tracciamento fonti.</div>
            </div>

            <div class="scenario-card ${this.selectedScenario === 'creative' ? 'selected' : ''}" data-scenario="creative" style="padding: 14px; border: 2px solid ${this.selectedScenario === 'creative' ? '#6366f1' : '#334155'}; border-radius: 12px; background: rgba(30, 41, 59, 0.5); cursor: pointer;">
              <div style="font-size: 20px;">✍️</div>
              <div style="font-weight: 600; font-size: 13px; color: #f8fafc; margin-top: 4px;">Worldbuilding &amp; Fiction</div>
              <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">Personaggi, luoghi e trame interconnesse.</div>
            </div>
          </div>
        </div>
      `;
    }

    if (this.currentStep === 2) {
      return `
        <div>
          <h3 style="margin: 0 0 8px 0; font-size: 15px; color: #f8fafc;">Step 2: Carica le tue fonti iniziali</h3>
          <p style="margin: 0 0 16px 0; font-size: 13px; color: #94a3b8;">Trascina i tuoi file PDF, EPUB o Markdown. Verranno salvati e convertiti per la tua Knowledge Base.</p>

          <div id="wizard-dropzone-slot"></div>
        </div>
      `;
    }

    if (this.currentStep === 3) {
      return `
        <div>
          <h3 style="margin: 0 0 8px 0; font-size: 15px; color: #f8fafc;">Step 3: Scegli il tuo assistente LLM</h3>
          <p style="margin: 0 0 16px 0; font-size: 13px; color: #94a3b8;">Seleziona il modello che risponderà alle tue domande e sintetizzerà le note.</p>

          <div style="display: flex; flex-direction: column; gap: 12px;">
            <label class="model-option" style="padding: 12px; border: 1px solid #334155; border-radius: 8px; background: rgba(30, 41, 59, 0.5); display: flex; align-items: center; justify-content: space-between; cursor: pointer;">
              <div style="display: flex; align-items: center; gap: 10px;">
                <input type="radio" name="wizard-model" value="claude-sonnet-4-6" ${this.selectedModel === 'claude-sonnet-4-6' ? 'checked' : ''} />
                <div>
                  <div style="font-weight: 600; font-size: 13px; color: #f8fafc;">Claude 3.5 Sonnet (Raccomandato)</div>
                  <div style="font-size: 11px; color: #94a3b8;">Massima qualità di sintesi e citazioni precise.</div>
                </div>
              </div>
              <span style="font-size: 11px; background: #059669; color: #ecfdf5; padding: 2px 6px; border-radius: 4px;">Ottimale</span>
            </label>

            <label class="model-option" style="padding: 12px; border: 1px solid #334155; border-radius: 8px; background: rgba(30, 41, 59, 0.5); display: flex; align-items: center; justify-content: space-between; cursor: pointer;">
              <div style="display: flex; align-items: center; gap: 10px;">
                <input type="radio" name="wizard-model" value="opencode" ${this.selectedModel === 'opencode' ? 'checked' : ''} />
                <div>
                  <div style="font-weight: 600; font-size: 13px; color: #f8fafc;">OpenCode CLI Agent</div>
                  <div style="font-size: 11px; color: #94a3b8;">Integrazione con la tua configurazione locale OpenCode.</div>
                </div>
              </div>
            </label>

            <label class="model-option" style="padding: 12px; border: 1px solid #334155; border-radius: 8px; background: rgba(30, 41, 59, 0.5); display: flex; align-items: center; justify-content: space-between; cursor: pointer;">
              <div style="display: flex; align-items: center; gap: 10px;">
                <input type="radio" name="wizard-model" value="ollama" ${this.selectedModel === 'ollama' ? 'checked' : ''} />
                <div>
                  <div style="font-weight: 600; font-size: 13px; color: #f8fafc;">Local Ollama</div>
                  <div style="font-size: 11px; color: #94a3b8;">100% Locale e offline (nessun invio dati all'esterno).</div>
                </div>
              </div>
              <span style="font-size: 11px; background: #334155; color: #cbd5e0; padding: 2px 6px; border-radius: 4px;">Offline</span>
            </label>
          </div>
        </div>
      `;
    }

    return '';
  }

  private attachEventListeners(): void {
    const closeBtn = this.container.querySelector('#wizard-close-btn');
    const prevBtn = this.container.querySelector('#wizard-prev-btn');
    const nextBtn = this.container.querySelector('#wizard-next-btn');

    if (closeBtn) closeBtn.addEventListener('click', () => this.close());

    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        if (this.currentStep > 1) {
          this.currentStep--;
          this.render();
        }
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', async () => {
        if (this.currentStep < 3) {
          this.currentStep++;
          this.render();
        } else {
          await this.finishOnboarding();
        }
      });
    }

    this.container.querySelectorAll('.scenario-card').forEach(card => {
      card.addEventListener('click', () => {
        const scenario = card.getAttribute('data-scenario');
        if (scenario) {
          this.selectedScenario = scenario;
          this.render();
        }
      });
    });

    this.container.querySelectorAll('input[name="wizard-model"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        this.selectedModel = (e.target as HTMLInputElement).value;
      });
    });
  }

  private async finishOnboarding(): Promise<void> {
    try {
      const rawConfig = (await this.storage.getProjectConfig()) || {};
      const config = (rawConfig as Record<string, any>) || {};
      if (!config.project) config.project = {};
      if (!config.agent) config.agent = {};
      if (!config.agent.llm) config.agent.llm = {};

      // Never clobber an existing project context: the wizard may run again
      // from the header, and a hand-written description must survive.
      if (!config.project.context) {
        config.project.context = `Scenario preset: ${this.selectedScenario}`;
      }
      if (this.selectedModel === 'opencode' || this.selectedModel === 'ollama') {
        config.agent.llm.provider = this.selectedModel;
      } else {
        config.agent.llm.model = this.selectedModel;
      }

      const saved = await this.storage.updateProjectConfig(config);

      if (!saved) {
        throw new Error('Unable to save project configuration');
      }
      
    } catch (_e) {
      // Fallback
    }

    appStore.setOnboardingCompleted(true);
    this.close();
    if (this.onCompleteCb) this.onCompleteCb();
  }
}
