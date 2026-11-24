/**
 * Shared, presentation-only UI preferences schema.
 *
 * Kept next to the capability matrix so backend validation and frontend state
 * hydration normalise values identically. Preferences never carry permissions.
 */

import type { UiPreferencesDto } from '../api/types';
import {
  isPinnableActionId,
  isUiPanelId,
  isUiViewMode,
} from './capabilities';

export function defaultUiPreferences(): UiPreferencesDto {
  return {
    version: 1,
    pinnedActionIds: [],
    filesVisible: true,
    viewMode: 'editor',
    theme: 'dark',
    density: 'comfortable',
    language: 'it',
    hiddenPanels: [],
  };
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

/** Reject unknown ids and malformed values; keep a valid, minimal default. */
export function normalizeUiPreferences(input: unknown): UiPreferencesDto {
  const fallback = defaultUiPreferences();
  if (!input || typeof input !== 'object' || Array.isArray(input)) return fallback;
  const raw = input as Record<string, unknown>;
  if (raw.version !== 1) return fallback;
  const pinned = Array.isArray(raw.pinnedActionIds)
    ? [...new Set(raw.pinnedActionIds.filter(isPinnableActionId))]
    : fallback.pinnedActionIds;
  const hidden = Array.isArray(raw.hiddenPanels)
    ? [...new Set(raw.hiddenPanels.filter(isUiPanelId))]
    : fallback.hiddenPanels;
  return {
    version: 1,
    pinnedActionIds: pinned,
    filesVisible: asBoolean(raw.filesVisible, fallback.filesVisible),
    viewMode: isUiViewMode(raw.viewMode) ? raw.viewMode as UiPreferencesDto['viewMode'] : fallback.viewMode,
    theme: raw.theme === 'light' ? 'light' : 'dark',
    density: raw.density === 'compact' ? 'compact' : 'comfortable',
    language: raw.language === 'en' ? 'en' : 'it',
    hiddenPanels: hidden,
  };
}

/** Stable signature used to persist only real preference changes. */
export function uiPreferencesSignature(preferences: UiPreferencesDto): string {
  return JSON.stringify({
    version: preferences.version,
    pinnedActionIds: [...preferences.pinnedActionIds].sort(),
    filesVisible: preferences.filesVisible,
    viewMode: preferences.viewMode,
    theme: preferences.theme,
    density: preferences.density,
    language: preferences.language,
    hiddenPanels: [...preferences.hiddenPanels].sort(),
  });
}
