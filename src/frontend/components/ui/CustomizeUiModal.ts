/**
 * F4 — declarative UI customizer.
 *
 * Every panel and pin comes from the shared catalogues and is filtered by the
 * F3 permission selectors. Presentation changes go straight to appStore; the
 * uiAccess sync layer persists only real changes through the typed bus.
 */

import { actionLabel, getActions } from '@frontend/core/actions';
import { subscribeLanguage, t, type TranslationKey } from '@frontend/core/i18n/strings';
import { listShortcuts } from '@frontend/core/shortcuts';
import { escapeHtml } from '@frontend/core/utils/html';
import { notifications } from '@frontend/services/notificationService';
import { appStore, type ViewMode } from '@frontend/store/appStore';
import { canAction, canPinAction, isPanelVisible, panelAllowed, visiblePanels } from '@frontend/core/uiAccess';
import { UI_PANELS, type UiPanelId } from '@shared/auth/capabilities';
import type { UiPreferencesDto } from '@shared/api/types';
import { uiPreferencesSignature } from '@shared/auth/uiPreferences';

const VIEW_MODES: ViewMode[] = ['editor', 'graph', 'split', 'scratchpad', 'closed'];

function option(value: string, label: string, selected: string): string {
  return `<option value="${escapeHtml(value)}"${value === selected ? ' selected' : ''}>${escapeHtml(label)}</option>`;
}

/** Modal for panels, pinned actions, appearance and the effective shortcuts. */
export class CustomizeUiModal {
  private overlay: HTMLElement | null = null;
  private unsubscribeLanguage: (() => void) | null = null;
  private previousFocus: HTMLElement | null = null;
  private initialSignature = '';

  public isOpen(): boolean {
    return this.overlay !== null;
  }

  public open(): void {
    if (this.overlay) return;
    this.previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.initialSignature = uiPreferencesSignature(appStore.getState().preferences);

    const overlay = document.createElement('div');
    overlay.className = 'wf-modal-overlay';
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) this.close();
    });
    overlay.addEventListener('click', event => this.onClick(event));
    overlay.addEventListener('change', event => this.onChange(event));
    overlay.addEventListener('keydown', event => this.onKeydown(event));
    document.body.appendChild(overlay);
    this.overlay = overlay;

    this.unsubscribeLanguage = subscribeLanguage(() => {
      if (this.overlay?.isConnected) this.render();
    });
    this.render();
    (overlay.querySelector('input, select, button') as HTMLElement | null)?.focus();
  }

  public close(): void {
    if (uiPreferencesSignature(appStore.getState().preferences) !== this.initialSignature) {
      notifications.translated('customizeUiSaved', 'success');
    }
    this.unsubscribeLanguage?.();
    this.unsubscribeLanguage = null;
    this.overlay?.remove();
    this.overlay = null;
    this.previousFocus?.focus();
    this.previousFocus = null;
  }

  private render(): void {
    if (!this.overlay) return;
    const closeLabel = escapeHtml(t('close'));
    this.overlay.innerHTML = `
      <div class="wf-modal" role="dialog" aria-modal="true" aria-labelledby="customize-ui-title">
        <div class="wf-modal__header">
          <h3 class="wf-modal__title" id="customize-ui-title">${escapeHtml(t('customizeUi'))}</h3>
          <button type="button" class="wf-icon-btn" data-action="close" title="${closeLabel}" aria-label="${closeLabel}">✕</button>
        </div>
        <div class="wf-modal__body">
          <p class="wf-modal__hint">${escapeHtml(t('customizeUiHint'))}</p>
          <section aria-labelledby="customize-layout-title">
            <h4 id="customize-layout-title">${escapeHtml(t('layoutSection'))}</h4>
            ${this.renderPanels()}
          </section>
          <section aria-labelledby="customize-toolbar-title">
            <h4 id="customize-toolbar-title">${escapeHtml(t('toolbarSection'))}</h4>
            ${this.renderPins()}
          </section>
          <section aria-labelledby="customize-appearance-title">
            <h4 id="customize-appearance-title">${escapeHtml(t('appearanceSection'))}</h4>
            ${this.renderAppearance()}
          </section>
          <section aria-labelledby="customize-shortcuts-title">
            <h4 id="customize-shortcuts-title">${escapeHtml(t('shortcutsSection'))}</h4>
            ${this.renderShortcuts()}
          </section>
        </div>
        <div class="wf-modal__footer">
          <button type="button" class="wf-btn wf-btn--primary" data-action="close">${escapeHtml(t('saveAndClose'))}</button>
        </div>
      </div>`;
  }

  private renderPanels(): string {
    const visible = new Set<UiPanelId>(visiblePanels());
    return `<div class="wf-menu__section" role="group" aria-label="${escapeHtml(t('visiblePanels'))}">
      ${UI_PANELS.map((panel) => {
        const allowed = panelAllowed(panel.id);
        const checked = visible.has(panel.id);
        const label = escapeHtml(t(panel.labelKey as TranslationKey));
        const disabled = panel.essential === true || !allowed;
        return `<label class="wf-menu__row" for="ui-panel-${panel.id}">
          <input type="checkbox" id="ui-panel-${panel.id}" data-panel="${panel.id}"
            aria-label="${label}" ${checked ? 'checked' : ''}${disabled ? ' disabled' : ''} />
          <span aria-hidden="true">${panel.icon}</span> ${label}
        </label>`;
      }).join('')}
    </div>`;
  }

  private renderPins(): string {
    const state = appStore.getState();
    const pinned = new Set(state.pinnedActionIds);
    const actions = getActions({ group: 'global', menu: true })
      .filter(action => canPinAction(action.id));
    if (actions.length === 0) return `<p class="wf-modal__hint">${escapeHtml(t('noShortcuts'))}</p>`;
    return `<div class="wf-menu__section" role="group" aria-label="${escapeHtml(t('customizeBar'))}">
      ${actions.map((action) => {
        const pinId = `ui-pin-${action.id.replace(':', '-')}`;
        const label = escapeHtml(actionLabel(action));
        return `<label class="wf-menu__row" for="${pinId}">
          <input type="checkbox" id="${pinId}" data-pin="${action.id}"
            aria-label="${escapeHtml(t('showInBar'))}: ${label}" ${pinned.has(action.id) ? 'checked' : ''} />
          <span aria-hidden="true">${action.icon}</span> ${label}
        </label>`;
      }).join('')}
    </div>`;
  }

  private renderAppearance(): string {
    const preferences: UiPreferencesDto = appStore.getState().preferences;
    return `<div class="wf-form-grid">
      <label class="wf-label" for="ui-theme">${escapeHtml(t('theme'))}
        <select id="ui-theme" class="wf-field" data-pref="theme">
          ${option('dark', 'Dark', preferences.theme)}
          ${option('light', 'Light', preferences.theme)}
        </select>
      </label>
      <label class="wf-label" for="ui-density">${escapeHtml(t('density'))}
        <select id="ui-density" class="wf-field" data-pref="density">
          ${option('comfortable', t('densityComfortable'), preferences.density)}
          ${option('compact', t('densityCompact'), preferences.density)}
        </select>
      </label>
      <label class="wf-label" for="ui-view-mode">${escapeHtml(t('view'))}
        <select id="ui-view-mode" class="wf-field" data-pref="viewMode">
          ${VIEW_MODES.map(mode => option(mode, t(`view${mode.charAt(0).toUpperCase()}${mode.slice(1)}` as TranslationKey), preferences.viewMode)).join('')}
        </select>
      </label>
      <label class="wf-label" for="ui-language">${escapeHtml(t('language'))}
        <select id="ui-language" class="wf-field" data-pref="language">
          ${option('it', 'Italiano', preferences.language)}
          ${option('en', 'English', preferences.language)}
        </select>
      </label>
    </div>`;
  }

  private renderShortcuts(): string {
    const shortcuts = listShortcuts()
      .filter(definition => !definition.id.startsWith('action:') || canAction(definition.id.slice('action:'.length)));
    if (shortcuts.length === 0) return `<p class="wf-modal__hint">${escapeHtml(t('noShortcuts'))}</p>`;
    return `<ul class="wf-shortcut-list">
      ${shortcuts.map(definition => `<li><kbd>${escapeHtml(definition.combo)}</kbd>
        <span>${escapeHtml(definition.id)}</span></li>`).join('')}
    </ul>`;
  }

  private onClick(event: Event): void {
    const target = event.target as HTMLElement;
    if (target.closest('[data-action="close"]')) this.close();
  }

  private onChange(event: Event): void {
    const target = event.target as HTMLInputElement & HTMLSelectElement;
    if (target.dataset.panel) {
      const panel = target.dataset.panel as UiPanelId;
      if (panelAllowed(panel)) appStore.setHiddenPanel(panel, !target.checked);
    } else if (target.dataset.pin) {
      const actionId = target.dataset.pin;
      if (canPinAction(actionId)) appStore.setPinnedAction(actionId, target.checked);
    } else if (target.dataset.pref) {
      this.applyPreference(target.dataset.pref, target.value);
    } else {
      return;
    }
  }

  private applyPreference(key: string, value: string): void {
    if (key === 'theme' && (value === 'dark' || value === 'light')) appStore.setTheme(value);
    else if (key === 'density' && (value === 'comfortable' || value === 'compact')) appStore.setDensity(value);
    else if (key === 'viewMode' && VIEW_MODES.includes(value as ViewMode)) appStore.setViewMode(value as ViewMode);
    else if (key === 'language' && (value === 'it' || value === 'en')) appStore.setUiLanguage(value);
  }

  private onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
    }
  }
}
