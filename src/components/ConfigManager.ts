import { ApiStorage, ProjectInfo } from '../storage/ApiStorage';

export class ConfigManager {
  private container: HTMLElement;
  private storage: ApiStorage;
  private onProjectChanged: () => void;
  private activeTab: 'general' | 'paths' | 'llm' | 'okf' = 'general';
  private currentConfig: Record<string, any> = {};
  private projects: ProjectInfo[] = [];

  constructor(storage: ApiStorage, onProjectChanged: () => void) {
    this.storage = storage;
    this.onProjectChanged = onProjectChanged;

    this.container = document.createElement('div');
    this.container.id = 'config-manager-modal';
    this.container.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
      background: rgba(0,0,0,0.7); display: none; align-items: center; justify-content: center;
      z-index: 1000; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    `;
    document.body.appendChild(this.container);
  }

  public async open(): Promise<void> {
    this.container.style.display = 'flex';
    this.projects = await this.storage.getProjects();
    const config = await this.storage.getProjectConfig();
    this.currentConfig = config || this.getDefaultConfig();
    this.render();
  }

  public close(): void {
    this.container.style.display = 'none';
  }

  private getDefaultConfig(): Record<string, any> {
    const activeId = this.storage.getActiveProjectId();
    return {
      project: {
        name: activeId,
        title: `${activeId} Wiki`,
        context: '',
        language: 'en',
      },
      paths: {
        sources: 'sources',
        raw: 'raw',
        wiki: 'wiki',
        output: 'output',
        notes: 'notes',
      },
      agent: {
        confirm_destructive: true,
        llm: {
          provider: 'opencode',
          model: 'claude-sonnet-4-6',
          api_key_env: 'WIKIFORGE_LLM_API_KEY',
          timeout_seconds: 60,
        },
      },
      okf: {
        version: '0.2',
        type_vocabulary: ['Concept', 'Paper', 'Book', 'Tool', 'Process', 'Playbook', 'Reference', 'StudyGuide', 'Quiz'],
      },
    };
  }

  private render(): void {
    const activeId = this.storage.getActiveProjectId();
    const activeProj = this.projects.find(p => p.id === activeId) || { id: activeId, name: activeId };

    const projOptions = this.projects
      .map(p => `<option value="${p.id}" ${p.id === activeId ? 'selected' : ''}>${p.name} (${p.id})</option>`)
      .join('');

    const projectSection = this.currentConfig.project || {};
    const pathsSection = this.currentConfig.paths || {};
    const agentLlmSection = (this.currentConfig.agent && this.currentConfig.agent.llm) || {};
    const okfSection = this.currentConfig.okf || {};

    const typeVocabList = Array.isArray(okfSection.type_vocabulary)
      ? okfSection.type_vocabulary.join(', ')
      : okfSection.type_vocabulary || '';

    this.container.innerHTML = `
      <div style="width: 680px; max-width: 90vw; max-height: 85vh; background: #18191c; border: 1px solid #2d3748; border-radius: 8px; display: flex; flex-direction: column; overflow: hidden; color: #e2e8f0; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5);">

        <!-- Header -->
        <div style="padding: 16px 20px; background: #121316; border-bottom: 1px solid #2d3748; display: flex; align-items: center; justify-content: space-between;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 18px;">⚙️</span>
            <h3 style="margin: 0; font-size: 16px; font-weight: 600; color: #64b5f6;">Configuration Manager</h3>
          </div>
          <button id="config-close-btn" style="background: transparent; border: none; color: #a0aec0; font-size: 18px; cursor: pointer;">✕</button>
        </div>

        <!-- Project Selector Bar -->
        <div style="padding: 12px 20px; background: #1e2025; border-bottom: 1px solid #2d3748; display: flex; align-items: center; justify-content: space-between; gap: 12px;">
          <div style="display: flex; align-items: center; gap: 8px; flex: 1;">
            <label style="font-size: 12px; color: #a0aec0; font-weight: 600;">Project:</label>
            <select id="config-project-select" style="background: #2d3748; color: #ffffff; border: 1px solid #4a5568; padding: 4px 8px; border-radius: 4px; font-size: 13px; flex: 1;">
              ${projOptions}
            </select>
          </div>
          <button id="config-new-project-btn" style="background: #2b6cb0; color: #ffffff; border: none; padding: 4px 10px; border-radius: 4px; font-size: 12px; font-weight: 600; cursor: pointer;">+ New Project</button>
          ${activeId !== 'default' ? `<button id="config-delete-project-btn" style="background: #c53030; color: #ffffff; border: none; padding: 4px 10px; border-radius: 4px; font-size: 12px; font-weight: 600; cursor: pointer;">Delete Project</button>` : ''}
        </div>

        <!-- Tabs Header -->
        <div style="display: flex; background: #121316; border-bottom: 1px solid #2d3748; padding: 0 20px;">
          <button class="config-tab-btn" data-tab="general" style="padding: 10px 16px; background: transparent; border: none; border-bottom: 2px solid ${this.activeTab === 'general' ? '#3182ce' : 'transparent'}; color: ${this.activeTab === 'general' ? '#ffffff' : '#a0aec0'}; font-weight: 600; font-size: 13px; cursor: pointer;">Generale</button>
          <button class="config-tab-btn" data-tab="paths" style="padding: 10px 16px; background: transparent; border: none; border-bottom: 2px solid ${this.activeTab === 'paths' ? '#3182ce' : 'transparent'}; color: ${this.activeTab === 'paths' ? '#ffffff' : '#a0aec0'}; font-weight: 600; font-size: 13px; cursor: pointer;">Percorsi</button>
          <button class="config-tab-btn" data-tab="llm" style="padding: 10px 16px; background: transparent; border: none; border-bottom: 2px solid ${this.activeTab === 'llm' ? '#3182ce' : 'transparent'}; color: ${this.activeTab === 'llm' ? '#ffffff' : '#a0aec0'}; font-weight: 600; font-size: 13px; cursor: pointer;">LLM & Agent</button>
          <button class="config-tab-btn" data-tab="okf" style="padding: 10px 16px; background: transparent; border: none; border-bottom: 2px solid ${this.activeTab === 'okf' ? '#3182ce' : 'transparent'}; color: ${this.activeTab === 'okf' ? '#ffffff' : '#a0aec0'}; font-weight: 600; font-size: 13px; cursor: pointer;">OKF & Tag</button>
        </div>

        <!-- Tab Contents -->
        <div style="flex: 1; padding: 20px; overflow-y: auto;">
          ${this.renderTabContent(projectSection, pathsSection, agentLlmSection, okfSection, typeVocabList)}
        </div>

        <!-- Footer Actions -->
        <div style="padding: 14px 20px; background: #121316; border-top: 1px solid #2d3748; display: flex; align-items: center; justify-content: space-between;">
          <span id="config-status-msg" style="font-size: 12px; color: #48bb78;"></span>
          <div style="display: flex; gap: 8px;">
            <button id="config-cancel-btn" style="background: #2d3748; color: #e2e8f0; border: none; padding: 6px 14px; border-radius: 4px; font-size: 13px; cursor: pointer;">Cancel</button>
            <button id="config-save-btn" style="background: #3182ce; color: #ffffff; border: none; padding: 6px 18px; border-radius: 4px; font-size: 13px; font-weight: 600; cursor: pointer;">Save Configuration</button>
          </div>
        </div>

      </div>
    `;

    this.attachEventListeners();
  }

  private renderTabContent(project: any, paths: any, llm: any, okf: any, typeVocab: string): string {
    if (this.activeTab === 'general') {
      return `
        <div style="display: flex; flex-direction: column; gap: 14px;">
          <div>
            <label style="display: block; font-size: 12px; color: #a0aec0; margin-bottom: 4px; font-weight: 600;">Internal Name (name):</label>
            <input type="text" id="cfg-proj-name" value="${project.name || ''}" style="width: 100%; background: #2d3748; border: 1px solid #4a5568; color: #fff; padding: 6px 10px; border-radius: 4px; font-size: 13px; box-sizing: border-box;" />
          </div>
          <div>
            <label style="display: block; font-size: 12px; color: #a0aec0; margin-bottom: 4px; font-weight: 600;">Display Title (title):</label>
            <input type="text" id="cfg-proj-title" value="${project.title || ''}" style="width: 100%; background: #2d3748; border: 1px solid #4a5568; color: #fff; padding: 6px 10px; border-radius: 4px; font-size: 13px; box-sizing: border-box;" />
          </div>
          <div>
            <label style="display: block; font-size: 12px; color: #a0aec0; margin-bottom: 4px; font-weight: 600;">Language (language):</label>
            <input type="text" id="cfg-proj-lang" value="${project.language || 'en'}" style="width: 100%; background: #2d3748; border: 1px solid #4a5568; color: #fff; padding: 6px 10px; border-radius: 4px; font-size: 13px; box-sizing: border-box;" />
          </div>
          <div>
            <label style="display: block; font-size: 12px; color: #a0aec0; margin-bottom: 4px; font-weight: 600;">Project Context (context):</label>
            <textarea id="cfg-proj-context" rows="4" style="width: 100%; background: #2d3748; border: 1px solid #4a5568; color: #fff; padding: 6px 10px; border-radius: 4px; font-size: 13px; box-sizing: border-box; resize: vertical;">${project.context || ''}</textarea>
          </div>
        </div>
      `;
    }

    if (this.activeTab === 'paths') {
      return `
        <div style="display: flex; flex-direction: column; gap: 14px;">
          <div>
            <label style="display: block; font-size: 12px; color: #a0aec0; margin-bottom: 4px; font-weight: 600;">Sources Directory (sources):</label>
            <input type="text" id="cfg-path-sources" value="${paths.sources || 'sources'}" style="width: 100%; background: #2d3748; border: 1px solid #4a5568; color: #fff; padding: 6px 10px; border-radius: 4px; font-size: 13px; box-sizing: border-box;" />
          </div>
          <div>
            <label style="display: block; font-size: 12px; color: #a0aec0; margin-bottom: 4px; font-weight: 600;">Raw Directory (raw):</label>
            <input type="text" id="cfg-path-raw" value="${paths.raw || 'raw'}" style="width: 100%; background: #2d3748; border: 1px solid #4a5568; color: #fff; padding: 6px 10px; border-radius: 4px; font-size: 13px; box-sizing: border-box;" />
          </div>
          <div>
            <label style="display: block; font-size: 12px; color: #a0aec0; margin-bottom: 4px; font-weight: 600;">Wiki Directory (wiki):</label>
            <input type="text" id="cfg-path-wiki" value="${paths.wiki || 'wiki'}" style="width: 100%; background: #2d3748; border: 1px solid #4a5568; color: #fff; padding: 6px 10px; border-radius: 4px; font-size: 13px; box-sizing: border-box;" />
          </div>
          <div>
            <label style="display: block; font-size: 12px; color: #a0aec0; margin-bottom: 4px; font-weight: 600;">Output Directory (output):</label>
            <input type="text" id="cfg-path-output" value="${paths.output || 'output'}" style="width: 100%; background: #2d3748; border: 1px solid #4a5568; color: #fff; padding: 6px 10px; border-radius: 4px; font-size: 13px; box-sizing: border-box;" />
          </div>
          <div>
            <label style="display: block; font-size: 12px; color: #a0aec0; margin-bottom: 4px; font-weight: 600;">Notes Directory (notes):</label>
            <input type="text" id="cfg-path-notes" value="${paths.notes || 'notes'}" style="width: 100%; background: #2d3748; border: 1px solid #4a5568; color: #fff; padding: 6px 10px; border-radius: 4px; font-size: 13px; box-sizing: border-box;" />
          </div>
        </div>
      `;
    }

    if (this.activeTab === 'llm') {
      return `
        <div style="display: flex; flex-direction: column; gap: 14px;">
          <div>
            <label style="display: block; font-size: 12px; color: #a0aec0; margin-bottom: 4px; font-weight: 600;">LLM Provider (provider):</label>
            <select id="cfg-llm-provider" style="width: 100%; background: #2d3748; border: 1px solid #4a5568; color: #fff; padding: 6px 10px; border-radius: 4px; font-size: 13px; box-sizing: border-box;">
              <option value="opencode" ${llm.provider === 'opencode' ? 'selected' : ''}>opencode (CLI)</option>
              <option value="anthropic" ${llm.provider === 'anthropic' ? 'selected' : ''}>anthropic (Anthropic API)</option>
              <option value="openai_compatible" ${llm.provider === 'openai_compatible' ? 'selected' : ''}>openai_compatible (OpenAI / vLLM)</option>
              <option value="ollama" ${llm.provider === 'ollama' ? 'selected' : ''}>ollama (Local Ollama)</option>
            </select>
          </div>
          <div>
            <label style="display: block; font-size: 12px; color: #a0aec0; margin-bottom: 4px; font-weight: 600;">Model (model):</label>
            <input type="text" id="cfg-llm-model" value="${llm.model || 'claude-sonnet-4-6'}" style="width: 100%; background: #2d3748; border: 1px solid #4a5568; color: #fff; padding: 6px 10px; border-radius: 4px; font-size: 13px; box-sizing: border-box;" />
          </div>
          <div>
            <label style="display: block; font-size: 12px; color: #a0aec0; margin-bottom: 4px; font-weight: 600;">API Key Env Variable (api_key_env):</label>
            <input type="text" id="cfg-llm-apikeyenv" value="${llm.api_key_env || 'WIKIFORGE_LLM_API_KEY'}" style="width: 100%; background: #2d3748; border: 1px solid #4a5568; color: #fff; padding: 6px 10px; border-radius: 4px; font-size: 13px; box-sizing: border-box;" />
          </div>
          <div>
            <label style="display: block; font-size: 12px; color: #a0aec0; margin-bottom: 4px; font-weight: 600;">Timeout Seconds (timeout_seconds):</label>
            <input type="number" id="cfg-llm-timeout" value="${llm.timeout_seconds || 60}" style="width: 100%; background: #2d3748; border: 1px solid #4a5568; color: #fff; padding: 6px 10px; border-radius: 4px; font-size: 13px; box-sizing: border-box;" />
          </div>
        </div>
      `;
    }

    if (this.activeTab === 'okf') {
      return `
        <div style="display: flex; flex-direction: column; gap: 14px;">
          <div>
            <label style="display: block; font-size: 12px; color: #a0aec0; margin-bottom: 4px; font-weight: 600;">OKF Spec Version (version):</label>
            <input type="text" id="cfg-okf-version" value="${okf.version || '0.2'}" style="width: 100%; background: #2d3748; border: 1px solid #4a5568; color: #fff; padding: 6px 10px; border-radius: 4px; font-size: 13px; box-sizing: border-box;" />
          </div>
          <div>
            <label style="display: block; font-size: 12px; color: #a0aec0; margin-bottom: 4px; font-weight: 600;">Controlled Type Vocabulary (comma-separated):</label>
            <textarea id="cfg-okf-vocab" rows="4" style="width: 100%; background: #2d3748; border: 1px solid #4a5568; color: #fff; padding: 6px 10px; border-radius: 4px; font-size: 13px; box-sizing: border-box; resize: vertical;">${typeVocab}</textarea>
          </div>
        </div>
      `;
    }

    return '';
  }

  private attachEventListeners(): void {
    const closeBtn = this.container.querySelector('#config-close-btn');
    const cancelBtn = this.container.querySelector('#config-cancel-btn');
    const saveBtn = this.container.querySelector('#config-save-btn');
    const projSelect = this.container.querySelector('#config-project-select') as HTMLSelectElement;
    const newProjBtn = this.container.querySelector('#config-new-project-btn');
    const deleteProjBtn = this.container.querySelector('#config-delete-project-btn');

    if (closeBtn) closeBtn.addEventListener('click', () => this.close());
    if (cancelBtn) cancelBtn.addEventListener('click', () => this.close());

    this.container.querySelectorAll('.config-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const tab = target.getAttribute('data-tab') as any;
        if (tab) {
          this.activeTab = tab;
          this.render();
        }
      });
    });

    if (projSelect) {
      projSelect.addEventListener('change', async () => {
        const newId = projSelect.value;
        this.storage.setActiveProjectId(newId);
        const config = await this.storage.getProjectConfig(newId);
        this.currentConfig = config || this.getDefaultConfig();
        this.onProjectChanged();
        this.render();
      });
    }

    if (newProjBtn) {
      newProjBtn.addEventListener('click', async () => {
        const id = prompt('Enter new project ID (e.g. thesis, business-kb):');
        if (!id) return;
        const name = prompt('Enter project title:', `${id} Wiki`) || id;
        const created = await this.storage.createProject(id, name);
        if (created) {
          this.storage.setActiveProjectId(created.id);
          this.projects = await this.storage.getProjects();
          const config = await this.storage.getProjectConfig(created.id);
          this.currentConfig = config || this.getDefaultConfig();
          this.onProjectChanged();
          this.render();
        } else {
          alert('Failed to create project.');
        }
      });
    }

    if (deleteProjBtn) {
      deleteProjBtn.addEventListener('click', async () => {
        const activeId = this.storage.getActiveProjectId();
        if (confirm(`Are you sure you want to delete project '${activeId}' from projects registry?`)) {
          const deleteFolder = confirm(`Do you also want to permanently delete the folder 'projects/${activeId}' on disk?`);
          await this.storage.deleteProject(activeId, deleteFolder);
          this.storage.setActiveProjectId('default');
          this.projects = await this.storage.getProjects();
          const config = await this.storage.getProjectConfig('default');
          this.currentConfig = config || this.getDefaultConfig();
          this.onProjectChanged();
          this.render();
        }
      });
    }

    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        this.updateCurrentConfigFromDOM();
        const success = await this.storage.updateProjectConfig(this.currentConfig);
        const statusEl = this.container.querySelector('#config-status-msg') as HTMLElement;
        if (success) {
          if (statusEl) statusEl.textContent = 'Saved successfully!';
          this.onProjectChanged();
          setTimeout(() => this.close(), 600);
        } else {
          if (statusEl) {
            statusEl.style.color = '#e53e3e';
            statusEl.textContent = 'Error saving config.';
          }
        }
      });
    }
  }

  private updateCurrentConfigFromDOM(): void {
    if (!this.currentConfig.project) this.currentConfig.project = {};
    if (!this.currentConfig.paths) this.currentConfig.paths = {};
    if (!this.currentConfig.agent) this.currentConfig.agent = {};
    if (!this.currentConfig.agent.llm) this.currentConfig.agent.llm = {};
    if (!this.currentConfig.okf) this.currentConfig.okf = {};

    const nameEl = this.container.querySelector('#cfg-proj-name') as HTMLInputElement;
    const titleEl = this.container.querySelector('#cfg-proj-title') as HTMLInputElement;
    const langEl = this.container.querySelector('#cfg-proj-lang') as HTMLInputElement;
    const contextEl = this.container.querySelector('#cfg-proj-context') as HTMLTextAreaElement;

    if (nameEl) this.currentConfig.project.name = nameEl.value;
    if (titleEl) this.currentConfig.project.title = titleEl.value;
    if (langEl) this.currentConfig.project.language = langEl.value;
    if (contextEl) this.currentConfig.project.context = contextEl.value;

    const srcEl = this.container.querySelector('#cfg-path-sources') as HTMLInputElement;
    const rawEl = this.container.querySelector('#cfg-path-raw') as HTMLInputElement;
    const wikiEl = this.container.querySelector('#cfg-path-wiki') as HTMLInputElement;
    const outEl = this.container.querySelector('#cfg-path-output') as HTMLInputElement;
    const notesEl = this.container.querySelector('#cfg-path-notes') as HTMLInputElement;

    if (srcEl) this.currentConfig.paths.sources = srcEl.value;
    if (rawEl) this.currentConfig.paths.raw = rawEl.value;
    if (wikiEl) this.currentConfig.paths.wiki = wikiEl.value;
    if (outEl) this.currentConfig.paths.output = outEl.value;
    if (notesEl) this.currentConfig.paths.notes = notesEl.value;

    const provEl = this.container.querySelector('#cfg-llm-provider') as HTMLSelectElement;
    const modelEl = this.container.querySelector('#cfg-llm-model') as HTMLInputElement;
    const apiKeyEnvEl = this.container.querySelector('#cfg-llm-apikeyenv') as HTMLInputElement;
    const timeoutEl = this.container.querySelector('#cfg-llm-timeout') as HTMLInputElement;

    if (provEl) this.currentConfig.agent.llm.provider = provEl.value;
    if (modelEl) this.currentConfig.agent.llm.model = modelEl.value;
    if (apiKeyEnvEl) this.currentConfig.agent.llm.api_key_env = apiKeyEnvEl.value;
    if (timeoutEl) this.currentConfig.agent.llm.timeout_seconds = parseInt(timeoutEl.value, 10) || 60;

    const okfVerEl = this.container.querySelector('#cfg-okf-version') as HTMLInputElement;
    const okfVocabEl = this.container.querySelector('#cfg-okf-vocab') as HTMLTextAreaElement;

    if (okfVerEl) this.currentConfig.okf.version = okfVerEl.value;
    if (okfVocabEl) {
      this.currentConfig.okf.type_vocabulary = okfVocabEl.value
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
    }
  }
}
