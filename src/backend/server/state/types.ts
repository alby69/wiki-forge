export interface StateEntry<T = unknown> {
  value: T;
  version: number;
  updatedAt: string;
}

export interface StateStore {
  readonly name: string;
  get<T>(key: string): Promise<StateEntry<T> | null>;
  put<T>(key: string, value: T, expectedVersion?: number): Promise<StateEntry<T>>;
  remove(key: string, expectedVersion?: number): Promise<boolean>;
  append<T>(key: string, event: T): Promise<void>;
  readAll<T>(key: string): Promise<T[]>;
}

export class StateConflictError extends Error {
  readonly key: string;
  readonly expectedVersion: number;
  readonly actualVersion: number;

  constructor(key: string, expectedVersion: number, actualVersion: number) {
    super(`State conflict on '${key}': expected version ${expectedVersion}, found ${actualVersion}`);
    this.name = 'StateConflictError';
    this.key = key;
    this.expectedVersion = expectedVersion;
    this.actualVersion = actualVersion;
  }
}

export class StateStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StateStoreError';
  }
}

export const STATE_BACKEND_ENV_CONTRACT = {
  WIKIFORGE_STATE_BACKEND: 'file | filesystem | memory | http | postgres | redis | s3 (default: file)',
  WIKIFORGE_STATE_DIR: 'filesystem backend root (default: <root>/.wiki-forge/state)',
  WIKIFORGE_STATE_URL: 'HTTP adapter base URL for backend=http',
  WIKIFORGE_STATE_POSTGRES_URL: 'HTTP adapter base URL for backend=postgres',
  WIKIFORGE_STATE_REDIS_URL: 'HTTP adapter base URL for backend=redis',
  WIKIFORGE_STATE_S3_URL: 'HTTP adapter base URL for backend=s3',
  WIKIFORGE_STATE_TOKEN: 'optional Bearer token sent to every HTTP adapter',
  WIKIFORGE_WORKER_CONCURRENCY: 'script job pool size (default: 2)',
  WIKIFORGE_WORKER_LEASE_MS: 'leader lease TTL in ms (default: 30000)',
  WIKIFORGE_WORKER_ID: 'leader identity (default: worker:<pid>@<hostname>)',
} as const;

export const HTTP_STATE_CONTRACT = {
  'GET /state/:key': '200 {"entry":StateEntry|null}',
  'PUT /state/:key': 'body {"value":unknown,"expectedVersion":number}; 200 {"entry":StateEntry}; 409 on version mismatch',
  'DELETE /state/:key': 'query version=number; 200 {"removed":boolean}',
  'POST /state/:key/events': 'body {"event":unknown}; 201 {"ok":true}',
  'GET /state/:key/events': '200 {"events":unknown[]}',
} as const;
