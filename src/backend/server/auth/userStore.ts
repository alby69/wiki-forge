import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import * as fsSync from 'node:fs';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { atomicWriteFile } from '../safeFs';
import { DEFAULT_ROLES } from '../auth/rbacConfig';
import type { Principal } from '../bus/messageBus';
import type { ManagedUserDto, ManagedUserRole } from '@shared/api/types';

export interface UserStoreOptions {
  rootDir?: string;
  env?: NodeJS.ProcessEnv;
  filePath?: string;
  now?: () => number;
}

interface StoredUser {
  id: string;
  username: string;
  passwordHash: string;
  roles: ManagedUserRole[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Session {
  userId: string;
  expiresAt: number;
}

export interface UserCredentials {
  username: string;
  password: string;
}

export interface UserCreateInput extends UserCredentials {
  roles: ManagedUserRole[];
  active?: boolean;
}

export interface UserUpdateInput {
  roles?: ManagedUserRole[];
  active?: boolean;
  password?: string;
}

function asRole(value: unknown): ManagedUserRole | undefined {
  return DEFAULT_ROLES.find((role): role is ManagedUserRole => role === value);
}

function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

function tokenDigest(token: string): string {
  return createHash('sha256').update(token, 'utf-8').digest('hex');
}

export class UserStore {
  private readonly rootDir: string;
  private readonly env: NodeJS.ProcessEnv;
  private readonly filePath: string;
  private readonly now: () => number;
  private readonly users = new Map<string, StoredUser>();
  private readonly sessions = new Map<string, Session>();
  private loaded = false;

  constructor(options: UserStoreOptions = {}) {
    this.rootDir = options.rootDir ?? process.cwd();
    this.env = options.env ?? process.env;
    this.now = options.now ?? Date.now;
    const configured = options.filePath ?? this.env.WIKIFORGE_USER_STORE_FILE;
    this.filePath = configured
      ? path.resolve(this.rootDir, configured)
      : path.resolve(this.rootDir, '.wiki-forge', 'users.json');
  }

  public isEnabledSync(): boolean {
    return Boolean(this.bootstrapUsername() && this.bootstrapPassword()) || fsSync.existsSync(this.filePath);
  }

  public async initialize(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;
    await this.readUsers();
    const username = this.bootstrapUsername();
    const password = this.bootstrapPassword();
    if (username && password && !this.findByUsername(username)) {
      const user = this.buildUser({ username, password, roles: ['Admin'], active: true });
      this.users.set(user.id, user);
      await this.persist();
    }
  }

  public async list(): Promise<ManagedUserDto[]> {
    await this.initialize();
    return [...this.users.values()]
      .map(user => this.toDto(user))
      .sort((a, b) => a.username.localeCompare(b.username));
  }

  public async create(input: UserCreateInput): Promise<ManagedUserDto> {
    await this.initialize();
    const username = this.normalizeUsername(input.username);
    if (this.findByUsername(username)) throw new Error(`User already exists: ${username}`);
    const user = this.buildUser({
      username,
      password: this.validatePassword(input.password),
      roles: this.validateRoles(input.roles),
      active: input.active === undefined ? true : input.active,
    });
    this.users.set(user.id, user);
    await this.persist();
    return this.toDto(user);
  }

  public async update(id: string, changes: UserUpdateInput): Promise<ManagedUserDto> {
    await this.initialize();
    const user = this.users.get(id);
    if (!user) throw new Error(`User not found: ${id}`);
    const next: StoredUser = {
      ...user,
      roles: changes.roles === undefined ? user.roles : this.validateRoles(changes.roles),
      active: changes.active === undefined ? user.active : changes.active,
      passwordHash: changes.password === undefined
        ? user.passwordHash
        : hashPassword(this.validatePassword(changes.password)),
      updatedAt: new Date(this.now()).toISOString(),
    };
    this.assertActiveAdmin([...this.users.values()].map(user => user.id === id ? next : user));
    this.users.set(id, next);
    await this.persist();
    return this.toDto(next);
  }

  public async delete(id: string): Promise<void> {
    await this.initialize();
    if (!this.users.has(id)) throw new Error(`User not found: ${id}`);
    this.assertActiveAdmin([...this.users.values()].filter(user => user.id !== id));
    this.users.delete(id);
    for (const [digest, session] of [...this.sessions]) {
      if (session.userId === id) this.sessions.delete(digest);
    }
    await this.persist();
  }

  public async authenticate(input: UserCredentials): Promise<{ token: string; user: ManagedUserDto } | undefined> {
    await this.initialize();
    const user = this.findByUsername(this.normalizeUsername(input.username));
    if (!user || !user.active) return undefined;
    if (!this.verifyPassword(input.password, user.passwordHash)) return undefined;
    const token = randomBytes(32).toString('base64url');
    this.sessions.set(tokenDigest(token), {
      userId: user.id,
      expiresAt: this.now() + this.sessionTtlMs(),
    });
    return { token, user: this.toDto(user) };
  }

  public principalForToken(token: string | undefined): Principal | undefined {
    if (!token) return undefined;
    const digest = tokenDigest(token);
    const session = this.sessions.get(digest);
    if (!session) return undefined;
    if (session.expiresAt <= this.now()) {
      this.sessions.delete(digest);
      return undefined;
    }
    const user = this.users.get(session.userId);
    if (!user || !user.active) return undefined;
    return { actor: `human:${user.username}`, roles: [...user.roles], source: 'local' };
  }

  private bootstrapUsername(): string {
    return (this.env.WIKIFORGE_ADMIN_USERNAME ?? '').trim();
  }

  private bootstrapPassword(): string {
    return this.env.WIKIFORGE_ADMIN_PASSWORD ?? '';
  }

  private sessionTtlMs(): number {
    const configured = Number(this.env.WIKIFORGE_SESSION_TTL_MS ?? '');
    return Number.isFinite(configured) && configured > 0 ? configured : 8 * 60 * 60 * 1000;
  }

  private normalizeUsername(value: unknown): string {
    const username = String(value ?? '').trim();
    if (!/^[A-Za-z0-9._-]{2,64}$/.test(username)) {
      throw new Error('Username must be 2-64 characters: letters, digits, dot, dash or underscore');
    }
    return username;
  }

  private validatePassword(value: unknown): string {
    const password = String(value ?? '');
    if (password.length < 8) throw new Error('Password must be at least 8 characters');
    return password;
  }

  private validateRoles(value: unknown): ManagedUserRole[] {
    if (!Array.isArray(value) || value.length === 0) throw new Error('At least one role is required');
    const roles = [...new Set(value.map(asRole).filter((role): role is ManagedUserRole => Boolean(role)))];
    if (roles.length === 0) throw new Error('Unknown or invalid role');
    return roles;
  }

  private buildUser(input: { username: string; password: string; roles: ManagedUserRole[]; active: boolean }): StoredUser {
    const timestamp = new Date(this.now()).toISOString();
    return {
      id: randomUUID(),
      username: input.username,
      passwordHash: hashPassword(input.password),
      roles: input.roles,
      active: input.active,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  }

  private findByUsername(username: string): StoredUser | undefined {
    return [...this.users.values()].find(user => user.username === username);
  }

  private assertActiveAdmin(users: Iterable<StoredUser>): void {
    const admins = [...users].filter(user => user.active && user.roles.includes('Admin'));
    if (admins.length === 0) throw new Error('At least one active Admin account is required');
  }

  private verifyPassword(password: string, encoded: string): boolean {
    const [saltHex, hashHex] = encoded.split(':');
    if (!saltHex || !hashHex) return false;
    const expected = Buffer.from(hashHex, 'hex');
    const actual = scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length || 64);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }

  private toDto(user: StoredUser): ManagedUserDto {
    return {
      id: user.id,
      username: user.username,
      roles: [...user.roles],
      active: user.active,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private async readUsers(): Promise<void> {
    let raw: string;
    try {
      raw = await fs.readFile(this.filePath, 'utf-8');
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return;
      throw err;
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error('User store must contain an array');
    for (const entry of parsed) {
      const user = this.parseStoredUser(entry);
      if (user) this.users.set(user.id, user);
    }
  }

  private parseStoredUser(value: unknown): StoredUser | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const record = value as Record<string, unknown>;
    const roles = this.validateRoles(record.roles);
    if (
      typeof record.id !== 'string' || !record.id
      || typeof record.username !== 'string' || !record.username
      || typeof record.passwordHash !== 'string' || !record.passwordHash
      || typeof record.createdAt !== 'string'
      || typeof record.updatedAt !== 'string'
    ) return null;
    return {
      id: record.id,
      username: record.username,
      passwordHash: record.passwordHash,
      roles,
      active: record.active !== false,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  private async persist(): Promise<void> {
    const users = [...this.users.values()];
    await atomicWriteFile(this.filePath, `${JSON.stringify(users, null, 2)}\n`, { mode: 0o600 });
  }
}
