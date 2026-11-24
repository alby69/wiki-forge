/**
 * Presentation-only preferences, stored per authenticated actor.
 *
 * The key is a SHA-256 digest of `source:actor`, so the file never contains a
 * readable actor/username and a client cannot choose another user's key. The
 * data itself cannot widen permissions: every field is a layout choice and is
 * normalised against the shared catalogue before being persisted.
 */

import { createHash } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { UiPreferencesDto } from '@shared/api/types';
import { defaultUiPreferences, normalizeUiPreferences } from '@shared/auth/uiPreferences';
import type { Principal } from '../bus/messageBus';
import { atomicWriteFile } from '../safeFs';

export { defaultUiPreferences, normalizeUiPreferences } from '@shared/auth/uiPreferences';

export interface UiPreferencesStoreOptions {
  rootDir?: string;
  env?: NodeJS.ProcessEnv;
  filePath?: string;
  now?: () => number;
}

interface StoredEntry {
  preferences: UiPreferencesDto;
  updatedAt: string;
}

interface StoredPreferences {
  version: 1;
  entries: Record<string, StoredEntry>;
}

export class UiPreferencesStore {
  private readonly rootDir: string;
  private readonly filePath: string;
  private readonly now: () => number;
  private entries: Record<string, StoredEntry> = {};
  private loaded = false;

  constructor(options: UiPreferencesStoreOptions = {}) {
    this.rootDir = path.resolve(options.rootDir ?? process.cwd());
    const env = options.env ?? process.env;
    const configured = options.filePath ?? env.WIKIFORGE_UI_PREFERENCES_FILE;
    const resolved = configured
      ? path.resolve(this.rootDir, configured)
      : path.join(this.rootDir, '.wiki-forge', 'ui-preferences.json');
    const relative = path.relative(this.rootDir, resolved);
    if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
      throw new Error('Access denied: UI preferences path escapes the root directory');
    }
    this.filePath = resolved;
    this.now = options.now ?? Date.now;
  }

  /** Stable, opaque key. Never accept a key or actor from a request body. */
  public keyFor(principal: Principal | undefined): string {
    const source = principal?.source ?? 'process';
    const actor = principal?.actor ?? 'process:api-token';
    return createHash('sha256').update(`${source}:${actor}`, 'utf-8').digest('hex');
  }

  public async get(principal: Principal | undefined): Promise<UiPreferencesDto> {
    await this.initialize();
    const entry = this.entries[this.keyFor(principal)];
    return entry ? normalizeUiPreferences(entry.preferences) : defaultUiPreferences();
  }

  public async put(principal: Principal | undefined, input: unknown): Promise<UiPreferencesDto> {
    await this.initialize();
    const preferences = normalizeUiPreferences(input);
    const key = this.keyFor(principal);
    this.entries = {
      ...this.entries,
      [key]: { preferences, updatedAt: new Date(this.now()).toISOString() },
    };
    await this.persist();
    return preferences;
  }

  private async initialize(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const raw = await fs.readFile(this.filePath, 'utf-8');
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const record = parsed as Record<string, unknown>;
        if (record.version === 1 && record.entries && typeof record.entries === 'object' && !Array.isArray(record.entries)) {
          for (const [key, value] of Object.entries(record.entries as Record<string, unknown>)) {
            if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
            const entry = value as Record<string, unknown>;
            this.entries[key] = {
              preferences: normalizeUiPreferences(entry.preferences),
              updatedAt: typeof entry.updatedAt === 'string' ? entry.updatedAt : '',
            };
          }
        }
      }
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        // A corrupt store never blocks startup: start from empty preferences.
        this.entries = {};
      }
    }
  }

  private async persist(): Promise<void> {
    const payload: StoredPreferences = { version: 1, entries: this.entries };
    await atomicWriteFile(this.filePath, `${JSON.stringify(payload, null, 2)}\n`, {
      encoding: 'utf-8',
      mode: 0o600,
    });
  }
}
