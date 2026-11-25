import * as path from 'node:path';
import { createFileSystemStateStore } from './fileStore';
import { createHttpStateStore } from './httpStore';
import { createMemoryStateStore } from './memoryStore';
import type { StateStore } from './types';
import { StateStoreError } from './types';

export type StateBackend = 'file' | 'filesystem' | 'memory' | 'http' | 'postgres' | 'redis' | 's3';

export interface StateStoreConfig {
  backend: StateBackend;
  dir: string;
  url?: string;
  token?: string;
}

const REMOTE_URL_ENV: Partial<Record<StateBackend, string>> = {
  http: 'WIKIFORGE_STATE_URL',
  postgres: 'WIKIFORGE_STATE_POSTGRES_URL',
  redis: 'WIKIFORGE_STATE_REDIS_URL',
  s3: 'WIKIFORGE_STATE_S3_URL',
};

export function readStateStoreConfig(
  env: NodeJS.ProcessEnv = process.env,
  rootDir: string = process.cwd(),
): StateStoreConfig {
  const raw = (env.WIKIFORGE_STATE_BACKEND || 'file').trim().toLowerCase();
  const backend = raw as StateBackend;
  if (!['file', 'filesystem', 'memory', 'http', 'postgres', 'redis', 's3'].includes(backend)) {
    throw new StateStoreError(
      `Unsupported WIKIFORGE_STATE_BACKEND '${raw}': expected file, memory, http, postgres, redis or s3`,
    );
  }
  const urlEnv = REMOTE_URL_ENV[backend];
  const url = urlEnv ? env[urlEnv] : undefined;
  if (urlEnv && !url) {
    throw new StateStoreError(`${urlEnv} is required when WIKIFORGE_STATE_BACKEND=${backend}`);
  }
  return {
    backend,
    dir: env.WIKIFORGE_STATE_DIR || path.join(rootDir, '.wiki-forge', 'state'),
    url,
    token: env.WIKIFORGE_STATE_TOKEN,
  };
}

export function createStateStore(config: StateStoreConfig): StateStore {
  switch (config.backend) {
    case 'memory':
      return createMemoryStateStore();
    case 'http':
    case 'postgres':
    case 'redis':
    case 's3':
      return createHttpStateStore({
        baseUrl: config.url ?? '',
        token: config.token,
        name: config.backend,
      });
    case 'file':
    case 'filesystem':
      return createFileSystemStateStore(config.dir);
    default:
      throw new StateStoreError(`Unsupported state backend '${config.backend}'`);
  }
}

export function createStateStoreFromEnv(
  env: NodeJS.ProcessEnv = process.env,
  rootDir: string = process.cwd(),
): StateStore {
  return createStateStore(readStateStoreConfig(env, rootDir));
}
