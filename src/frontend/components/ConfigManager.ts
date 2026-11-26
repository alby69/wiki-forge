import { ApiStorage } from '@frontend/storage/ApiStorage';
import { setHelpContext, clearHelpContext } from '@frontend/core/helpContext';
import { canUseOperation } from '@frontend/core/auth';
import type { LocalModelDto } from '@shared/api/types';
import { GGUF_CHUNK_BYTES } from '@shared/llm/gguf';

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char] ?? char);
}

function bytesToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let index = 0; index < bytes.byteLength; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

/**
 * ConfigManager
 * Manages project configuration directly via config.toml (Single Source of Truth).
 * All reads and updates are routed directly to the server API (/api/projects/:id/config)
 * which reads/writes config.toml on disk without keeping duplicate local storage state.
 */
export class ConfigManager {
  private container: HTMLElement;
  private storage: ApiStorage;
  private onProjectChanged: () => void;
  private activeTab: 'general' | 'paths' | 'llm' | 'okf' | 'schema' = 'general';
  private currentConfig: Record<string, any> = {};
  private localModels: LocalModelDto[] = [];
  private activeModelPath = '';
  private localModelStatus = '';

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
    setHelpContext('config');
    const config = await this.storage.getProjectConfig();
    this.currentConfig = config || this.getDefaultConfig();
    await this.refreshLocalModels();
    this.render();
  }

  public close(): void {
    this.container.style.display = 'none';
    clearHelpContext('config');
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
      schema: {
        enabled: false,
        strict: false,
      },
    };
  }

  private render(): void {
    const projectSection = this.currentConfig.project || {};
    const pathsSection = this.currentConfig.paths || {};
    const agentLlmSection = (this.currentConfig.agent && this.currentConfig.agent.llm) || {};
    const okfSection = this.currentConfig.okf || {};
    const schemaSection = this.currentConfig.schema || {};

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

        <!-- Tabs Header -->
        <div style="display: flex; background: #121316; border-bottom: 1px solid #2d3748; padding: 0 20px;">
          <button class="config-tab-btn" data-tab="general" style="padding: 10px 16px; background: transparent; border: none; border-bottom: 2px solid ${this.activeTab === 'general' ? '#3182ce' : 'transparent'}; color: ${this.activeTab === 'general' ? '#ffffff' : '#a0aec0'}; font-weight: 600; font-size: 13px; cursor: pointer;">Generale</button>
          <button class="config-tab-btn" data-tab="paths" style="padding: 10px 16px; background: transparent; border: none; border-bottom: 2px solid ${this.activeTab === 'paths' ? '#3182ce' : 'transparent'}; color: ${this.activeTab === 'paths' ? '#ffffff' : '#a0aec0'}; font-weight: 600; font-size: 13px; cursor: pointer;">Percorsi</button>
          <button class="config-tab-btn" data-tab="llm" style="padding: 10px 16px; background: transparent; border: none; border-bottom: 2px solid ${this.activeTab === 'llm' ? '#3182ce' : 'transparent'}; color: ${this.activeTab === 'llm' ? '#ffffff' : '#a0aec0'}; font-weight: 600; font-size: 13px; cursor: pointer;">LLM & Agent</button>
          <button class="config-tab-btn" data-tab="okf" style="padding: 10px 16px; background: transparent; border: none; border-bottom: 2px solid ${this.activeTab === 'okf' ? '#3182ce' : 'transparent'}; color: ${this.activeTab === 'okf' ? '#ffffff' : '#a0aec0'}; font-weight: 600; font-size: 13px; cursor: pointer;">OKF & Tag</button>
          <button class="config-tab-btn" data-tab="schema" style="padding: 10px 16px; background: transparent; border: none; border-bottom: 2px solid ${this.activeTab === 'schema' ? '#3182ce' : 'transparent'}; color: ${this.activeTab === 'schema' ? '#ffffff' : '#a0aec0'}; font-weight: 600; font-size: 13px; cursor: pointer;">Schema (Read-Only)</button>
        </div>

        <!-- Tab Contents -->
        <div style="flex: 1; padding: 20px; overflow-y: auto;">
          ${this.renderTabContent(projectSection, pathsSection, agentLlmSection, okfSection, typeVocabList, schemaSection)}
        </div>

        <!-- Footer Actions -->
        <div style="padding: 14px 20px; background: #121316; border-top: 1px solid #2d3748; display: flex; align-items: center; justify-content: space-between;">
          <span id="config-status-msg" style="font-size: 12px; color: #48bb78;"></span>
          <div style="display: flex; gap: 8px;">
            <button id="config-cancel-btn" style="background: #2d3748; color: #e2e8f0; border: none; padding: 6px 14px; border-radius: 4px; font-size: 13px; cursor: pointer;">Cancel</button>
            ${canUseOperation('projects.config.put') ? `<button id="config-save-btn" style="background: #3182ce; color: #ffffff; border: none; padding: 6px 18px; border-radius: 4px; font-size: 13px; font-weight: 600; cursor: pointer;">Save Configuration</button>` : ''}
          </div>
        </div>

      </div>
    `;

    this.attachEventListeners();
  }

  private renderLocalModelsSection(): string {
    if (!canUseOperation('projects.gguf.list')) {
      return '<div style="font-size: 12px; color: #a0aec0;">Local GGUF management requires the Admin role.</div>';
    }

    const rows = this.localModels.length
      ? this.localModels.map((model) => `
          <div style="background: #23252b; border: 1px solid #2d3748; border-radius: 6px; padding: 10px; margin-bottom: 8px;">
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
              <div style="min-width: 0;">
                <div style="font-size: 13px; color: #e2e8f0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                  ${escapeHtml(model.name)} ${model.active ? '<span style="color: #48bb78; font-size: 11px;">ACTIVE</span>' : ''}
                </div>
                <div style="font-size: 11px; color: #a0aec0; margin-top: 4px;">
                  ${escapeHtml(model.relativePath)} · ${(model.size / 1024 / 1024).toFixed(1)} MiB · ${escapeHtml(model.checksumSha256.slice(0, 12))}
                </div>
              </div>
              ${canUseOperation('projects.gguf.activate') && !model.active
                ? `<button class="cfg-gguf-use" data-model-id="${escapeHtml(model.id)}" style="background: #2d3748; color: #e2e8f0; border: none; padding: 5px 10px; border-radius: 4px; font-size: 12px; cursor: pointer; white-space: nowrap;">Use</button>`
                : ''}
            </div>
          </div>
        `).join('')
      : '<div style="font-size: 12px; color: #a0aec0;">No GGUF models registered yet.</div>';

    const upload = canUseOperation('projects.gguf.uploadStart')
      ? `
          <div style="display: flex; gap: 8px; align-items: center; margin-top: 10px;">
            <input type="file" id="cfg-gguf-file" accept=".gguf" style="flex: 1; font-size: 12px; color: #a0aec0;" />
            <button id="cfg-gguf-upload-btn" style="background: #3182ce; color: #fff; border: none; padding: 6px 12px; border-radius: 4px; font-size: 12px; font-weight: 600; cursor: pointer; white-space: nowrap;">Upload &amp; activate</button>
          </div>
        `
      : '';

    return `
      <div style="border-top: 1px solid #2d3748; padding-top: 14px; display: flex; flex-direction: column; gap: 10px;">
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
          <div>
            <div style="font-size: 13px; color: #64b5f6; font-weight: 600;">Local GGUF (CPU-only)</div>
            <div style="font-size: 11px; color: #a0aec0; margin-top: 4px;">
              Active path: <code>${escapeHtml(this.activeModelPath || '(none)')}</code>
            </div>
          </div>
          ${this.activeModelPath && canUseOperation('projects.gguf.deactivate')
            ? `<button id="cfg-gguf-deactivate-btn" style="background: #2d3748; color: #e2e8f0; border: none; padding: 5px 10px; border-radius: 4px; font-size: 12px; cursor: pointer; white-space: nowrap;">Deactivate</button>`
            : ''}
        </div>
        <div>${rows}</div>
        ${upload}
        <div id="cfg-gguf-status" style="font-size: 12px; color: #a0aec0; min-height: 16px;">${escapeHtml(this.localModelStatus)}</div>
      </div>
    `;
  }

  private renderTabContent(project: any, paths: any, llm: any, okf: any, typeVocab: string, schema: any): string {
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
              <option value="local" ${llm.provider === 'local' ? 'selected' : ''}>local (GGUF CPU)</option>
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
          ${this.renderLocalModelsSection()}
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

    if (this.activeTab === 'schema') {
      const isEnabled = Boolean(schema.enabled);
      const isStrict = Boolean(schema.strict);
      const types = schema.types || {};

      let typesHtml = '';
      if (Object.keys(types).length === 0) {
        typesHtml = '<p style="font-size: 13px; color: #a0aec0; font-style: italic;">No specific types configured in [schema.types].</p>';
      } else {
        typesHtml = Object.entries(types).map(([typeName, typeDef]: [string, any]) => {
          const req = Array.isArray(typeDef.required) ? typeDef.required.join(', ') : 'none';
          const opt = Array.isArray(typeDef.optional) ? typeDef.optional.join(', ') : 'none';
          const rels = typeDef.relations ? JSON.stringify(typeDef.relations) : '{}';

          return `
            <div style="background: #23252b; border: 1px solid #2d3748; border-radius: 6px; padding: 12px; margin-bottom: 10px;">
              <h4 style="margin: 0 0 8px 0; color: #64b5f6; font-size: 14px;">Type: ${typeName}</h4>
              <div style="font-size: 12px; color: #cbd5e0; line-height: 1.6;">
                <div><strong>Required fields:</strong> ${req || 'none'}</div>
                <div><strong>Optional fields:</strong> ${opt || 'none'}</div>
                <div><strong>Typed relations:</strong> <code>${rels}</code></div>
              </div>
            </div>
          `;
        }).join('');
      }

      return `
        <div style="display: flex; flex-direction: column; gap: 14px;">
          <div style="background: #23252b; border: 1px solid #2d3748; border-radius: 6px; padding: 12px; display: flex; gap: 20px;">
            <div><strong>Schema Status:</strong> <span style="color: ${isEnabled ? '#48bb78' : '#a0aec0'};">${isEnabled ? 'Enabled' : 'Disabled'}</span></div>
            <div><strong>Mode:</strong> <span style="color: ${isStrict ? '#e53e3e' : '#e2e8f0'};">${isStrict ? 'Strict (Errors)' : 'Permissive (Warnings)'}</span></div>
          </div>
          <div>
            <h4 style="margin: 0 0 10px 0; font-size: 13px; color: #a0aec0; font-weight: 600;">Defined Schema Types:</h4>
            ${typesHtml}
          </div>
          <p style="font-size: 12px; color: #a0aec0; margin-top: 10px;">
            ℹ️ <em>To edit schema definitions or add custom type relations, update <code>config.toml</code> directly or run <code>make schema-infer</code> to generate candidate schema settings.</em>
          </p>
        </div>
      `;
    }

    return '';
  }

  private attachEventListeners(): void {
    const closeBtn = this.container.querySelector('#config-close-btn');
    const cancelBtn = this.container.querySelector('#config-cancel-btn');
    const saveBtn = this.container.querySelector('#config-save-btn');

    if (closeBtn) closeBtn.addEventListener('click', () => this.close());
    if (cancelBtn) cancelBtn.addEventListener('click', () => this.close());

    this.container.querySelectorAll('.config-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const tab = target.getAttribute('data-tab') as any;
        if (tab) {
          this.activeTab = tab;
          if (tab === 'llm') {
            void this.refreshLocalModels().then(() => this.render());
          } else {
            this.render();
          }
        }
      });
    });

    this.container.querySelectorAll<HTMLButtonElement>('.cfg-gguf-use').forEach((btn) => {
      btn.addEventListener('click', () => {
        const modelId = btn.getAttribute('data-model-id');
        if (modelId) void this.activateModel(modelId);
      });
    });

    const uploadBtn = this.container.querySelector<HTMLButtonElement>('#cfg-gguf-upload-btn');
    if (uploadBtn) {
      uploadBtn.addEventListener('click', () => void this.uploadGgufModel(uploadBtn));
    }

    const deactivateBtn = this.container.querySelector<HTMLButtonElement>('#cfg-gguf-deactivate-btn');
    if (deactivateBtn) {
      deactivateBtn.addEventListener('click', () => void this.deactivateModel());
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

  private setLocalModelStatus(message: string, isError: boolean = false): void {
    this.localModelStatus = message;
    const el = this.container.querySelector('#cfg-gguf-status') as HTMLElement | null;
    if (el) {
      el.textContent = message;
      el.style.color = isError ? '#e53e3e' : '#a0aec0';
    }
  }

  private async refreshLocalModels(): Promise<void> {
    if (!canUseOperation('projects.gguf.list')) return;
    try {
      const result = await this.storage.listLocalModels();
      this.localModels = result.models;
      this.activeModelPath = result.activeModelPath;
    } catch (err) {
      this.localModelStatus = `Unable to load local models: ${String(err)}`;
    }
  }

  private async activateModel(modelId: string): Promise<void> {
    try {
      this.setLocalModelStatus('Activating local GGUF model...');
      const result = await this.storage.activateLocalModel(modelId);
      if (!this.currentConfig.agent) this.currentConfig.agent = {};
      if (!this.currentConfig.agent.llm) this.currentConfig.agent.llm = {};
      this.currentConfig.agent.llm.provider = 'local';
      this.localModelStatus = `Active model: ${result.model.name}`;
      await this.refreshLocalModels();
      this.render();
    } catch (err) {
      this.setLocalModelStatus(`Activation failed: ${String(err)}`, true);
    }
  }

  private async deactivateModel(): Promise<void> {
    try {
      this.setLocalModelStatus('Disabling local GGUF model...');
      const result = await this.storage.deactivateLocalModel();
      if (!this.currentConfig.agent) this.currentConfig.agent = {};
      if (!this.currentConfig.agent.llm) this.currentConfig.agent.llm = {};
      this.currentConfig.agent.llm.provider = result.provider;
      this.activeModelPath = result.activeModelPath;
      this.setLocalModelStatus(`Local GGUF disabled; provider restored to ${result.provider}.`);
      await this.refreshLocalModels();
      this.render();
    } catch (err) {
      this.setLocalModelStatus(`Deactivation failed: ${String(err)}`, true);
    }
  }

  private async uploadGgufModel(button: HTMLButtonElement): Promise<void> {
    const input = this.container.querySelector('#cfg-gguf-file') as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!file) {
      this.setLocalModelStatus('Select a .gguf file first.', true);
      return;
    }
    if (!file.name.toLowerCase().endsWith('.gguf')) {
      this.setLocalModelStatus('Only .gguf files are supported.', true);
      return;
    }

    button.disabled = true;
    try {
      const chunkCount = Math.max(1, Math.ceil(file.size / GGUF_CHUNK_BYTES));
      this.setLocalModelStatus(`Uploading ${file.name} (${chunkCount} chunks)...`);
      const uploadId = await this.storage.startGgufUpload(file.name, file.size, chunkCount);
      for (let index = 0; index < chunkCount; index += 1) {
        const start = index * GGUF_CHUNK_BYTES;
        const end = Math.min(start + GGUF_CHUNK_BYTES, file.size);
        const buffer = await file.slice(start, end).arrayBuffer();
        const received = await this.storage.uploadGgufChunk(uploadId, index, bytesToBase64(buffer));
        this.setLocalModelStatus(`Uploading ${file.name} (${received}/${chunkCount} chunks)...`);
      }
      this.setLocalModelStatus('Validating GGUF model...');
      const model = await this.storage.finalizeGgufUpload(uploadId);
      this.localModelStatus = `Registered ${model.name}; activating...`;
      await this.activateModel(model.id);
    } catch (err) {
      this.setLocalModelStatus(`Upload failed: ${String(err)}`, true);
      button.disabled = false;
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
