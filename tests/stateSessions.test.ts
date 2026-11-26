import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { afterEach, describe, it } from 'node:test';
import { DEFAULT_SESSION_KEY, UserStore } from '@backend/server/auth/userStore';
import { createFileSystemStateStore } from '@backend/server/state/fileStore';
import { readStateStoreConfig } from '@backend/server/state/index';

const tempDirs: string[] = [];

afterEach(async () => {
  for (const dir of tempDirs.splice(0)) {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

async function makeTempDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(process.cwd(), 'tmp-state-sessions-'));
  tempDirs.push(dir);
  return dir;
}

async function readStateFiles(dir: string): Promise<string> {
  let content = '';
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const entryPath = path.join(dir, entry.name);
    content += entry.isDirectory()
      ? await readStateFiles(entryPath)
      : await fs.readFile(entryPath, 'utf-8');
  }
  return content;
}

describe('user sessions in StateStore', () => {
  it('keeps the Node state root separate from the Python health root', async () => {
    const rootDir = await makeTempDir();
    const config = readStateStoreConfig({}, rootDir);

    assert.equal(config.dir, path.join(rootDir, '.wiki-forge', 'state'));
    assert.notEqual(config.dir, path.join(rootDir, '.wikiforge', 'state'));

    const state = createFileSystemStateStore(config.dir);
    await state.put('boundary-check', true);

    assert.equal(await fs.stat(path.join(rootDir, '.wiki-forge', 'state')).then(() => true, () => false), true);
    assert.equal(await fs.stat(path.join(rootDir, '.wikiforge')).then(() => true, () => false), false);
  });

  it('hydrates sessions in a new UserStore using the same state directory', async () => {
    const rootDir = await makeTempDir();
    let now = 1_800_000_000;
    const env = {
      WIKIFORGE_ADMIN_USERNAME: 'admin',
      WIKIFORGE_ADMIN_PASSWORD: 'admin-password',
    };
    const first = new UserStore({ rootDir, env, now: () => now });
    const session = await first.authenticate({ username: 'admin', password: 'admin-password' });
    assert.ok(session);
    assert.deepEqual(await first.principalForToken(session.token), {
      actor: 'human:admin', roles: ['Admin'], source: 'local',
    });

    const stateDir = path.join(rootDir, '.wiki-forge', 'state');
    const state = createFileSystemStateStore(stateDir);
    const entry = await state.get<Record<string, { userId: string; expiresAt: number }>>(DEFAULT_SESSION_KEY);
    assert.ok(entry);
    assert.deepEqual(Object.values(entry.value).map((value) => value.userId), [session.user.id]);
    assert.ok(!(await readStateFiles(stateDir)).includes(session.token));

    const second = new UserStore({ rootDir, env: {}, now: () => now });
    assert.deepEqual(await second.principalForToken(session.token), {
      actor: 'human:admin', roles: ['Admin'], source: 'local',
    });
  });

  it('uses WIKIFORGE_STATE_DIR from env for sessions', async () => {
    const rootDir = await makeTempDir();
    const stateDir = path.join(rootDir, 'custom-state');
    let now = 1_800_000_000;
    const env = {
      WIKIFORGE_STATE_BACKEND: 'file',
      WIKIFORGE_STATE_DIR: stateDir,
      WIKIFORGE_ADMIN_USERNAME: 'admin',
      WIKIFORGE_ADMIN_PASSWORD: 'admin-password',
    };
    const first = new UserStore({ rootDir, env, now: () => now });
    const session = await first.authenticate({ username: 'admin', password: 'admin-password' });
    assert.ok(session);

    const configured = createFileSystemStateStore(stateDir);
    assert.ok(await configured.get(DEFAULT_SESSION_KEY));
    const fallback = createFileSystemStateStore(path.join(rootDir, '.wiki-forge', 'state'));
    assert.equal(await fallback.get(DEFAULT_SESSION_KEY), null);

    const second = new UserStore({ rootDir, env, now: () => now });
    assert.deepEqual(await second.principalForToken(session.token), {
      actor: 'human:admin', roles: ['Admin'], source: 'local',
    });
  });

  it('rejects expired sessions and persists the cleanup', async () => {
    const rootDir = await makeTempDir();
    let now = 1_800_000_000;
    const env = {
      WIKIFORGE_ADMIN_USERNAME: 'admin',
      WIKIFORGE_ADMIN_PASSWORD: 'admin-password',
      WIKIFORGE_SESSION_TTL_MS: '1000',
    };
    const first = new UserStore({ rootDir, env, now: () => now });
    const session = await first.authenticate({ username: 'admin', password: 'admin-password' });
    assert.ok(session);
    assert.ok(await first.principalForToken(session.token));

    now += 1001;
    assert.equal(await first.principalForToken(session.token), undefined);
    const state = createFileSystemStateStore(path.join(rootDir, '.wiki-forge', 'state'));
    const entry = await state.get<Record<string, unknown>>(DEFAULT_SESSION_KEY);
    assert.deepEqual(entry?.value, {});

    const second = new UserStore({ rootDir, env, now: () => now });
    assert.equal(await second.principalForToken(session.token), undefined);
  });

  it('accepts an injected store and session key', async () => {
    const rootDir = await makeTempDir();
    const store = createFileSystemStateStore(path.join(rootDir, '.wiki-forge', 'state'));
    const env = {
      WIKIFORGE_ADMIN_USERNAME: 'admin',
      WIKIFORGE_ADMIN_PASSWORD: 'admin-password',
    };
    const first = new UserStore({ rootDir, env, store, sessionKey: 'auth/custom-sessions' });
    const session = await first.authenticate({ username: 'admin', password: 'admin-password' });
    assert.ok(session);
    assert.ok(await store.get('auth/custom-sessions'));

    const second = new UserStore({
      rootDir,
      env: {},
      store,
      sessionKey: 'auth/custom-sessions',
    });
    assert.deepEqual(await second.principalForToken(session.token), {
      actor: 'human:admin', roles: ['Admin'], source: 'local',
    });
  });

  it('keeps sessions written by another UserStore after a state conflict', async () => {
    const rootDir = await makeTempDir();
    const store = createFileSystemStateStore(path.join(rootDir, '.wiki-forge', 'state'));
    const env = {
      WIKIFORGE_ADMIN_USERNAME: 'admin',
      WIKIFORGE_ADMIN_PASSWORD: 'admin-password',
    };
    const now = 1_800_000_000;
    const writer = new UserStore({ rootDir, env, store, now: () => now });
    await writer.initialize();
    const first = await writer.authenticate({ username: 'admin', password: 'admin-password' });
    const stale = new UserStore({ rootDir, env, store, now: () => now });
    await stale.initialize();
    const second = await writer.authenticate({ username: 'admin', password: 'admin-password' });
    assert.ok(first);
    assert.ok(second);
    const third = await stale.authenticate({ username: 'admin', password: 'admin-password' });
    assert.ok(third);

    const reader = new UserStore({ rootDir, env: {}, store, now: () => now });
    for (const token of [first.token, second.token, third.token]) {
      assert.deepEqual(await reader.principalForToken(token), {
        actor: 'human:admin', roles: ['Admin'], source: 'local',
      });
    }
  });
});
