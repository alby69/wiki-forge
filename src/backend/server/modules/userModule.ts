import { error, json, type ApiResult } from '../api/http';
import type { CommandContext, DomainModule, MessageBus } from '../bus/messageBus';
import type { RbacConfig } from '../auth/rbacConfig';
import { buildAuthIdentity } from '../auth/identity';
import { UserStore, type UserCreateInput, type UserUpdateInput, type UserCredentials } from '../auth/userStore';
import type { ManagedUserRole } from '@shared/api/types';

export interface UserModuleOptions {
  store: UserStore;
  rbac: RbacConfig;
  idpConfigured: boolean;
  strict: boolean;
  env?: NodeJS.ProcessEnv;
}

type Payload = Record<string, unknown>;

function bodyOf(payload: Payload): Payload {
  const body = payload.body;
  return body && typeof body === 'object' && !Array.isArray(body) ? body as Payload : payload;
}

function idFrom(payload: Payload): string {
  const direct = payload.id;
  if (typeof direct === 'string') return direct;
  const params = payload.params;
  if (params && typeof params === 'object' && !Array.isArray(params)) {
    const id = (params as Payload).id;
    if (typeof id === 'string') return id;
  }
  return '';
}

function failure(err: unknown): ApiResult {
  const status = (err as { status?: number } | null | undefined)?.status;
  const message = err instanceof Error ? err.message : String(err);
  const code = status ?? (message.startsWith('User not found') ? 404 : 400);
  return error(message, code);
}

export class UserModule implements DomainModule {
  readonly name = 'users';

  constructor(private readonly options: UserModuleOptions) {}

  register(bus: MessageBus): void {
    bus.register<Payload>('auth.login', (payload, context) => this.login(payload, context));
    bus.register<Payload>('users.list', (_payload, context) => this.list(context));
    bus.register<Payload>('users.create', (payload, context) => this.create(payload, context));
    bus.register<Payload>('users.update', (payload, context) => this.update(payload, context));
    bus.register<Payload>('users.delete', (payload, context) => this.remove(payload, context));
  }

  private canManage(context: CommandContext): boolean {
    const principal = context.principal;
    if (!principal) return false;
    if (principal.source === 'local') {
      const roles = context.rbac?.roles ?? principal.roles;
      return context.rbac?.allowed !== false && roles.includes('Admin');
    }
    if (this.options.rbac.enabled) {
      return context.rbac?.allowed === true && (context.rbac.roles ?? principal.roles).includes('Admin');
    }
    return principal.source === 'legacy-token' && Boolean((this.options.env ?? process.env).WIKIFORGE_API_TOKEN);
  }

  private deny(): ApiResult {
    return error("Forbidden: 'users.*' requires the Admin role", 403);
  }

  private async login(payload: Payload, context: CommandContext): Promise<ApiResult> {
    const body = bodyOf(payload);
    const credentials: UserCredentials = {
      username: String(body.username ?? ''),
      password: String(body.password ?? ''),
    };
    const session = await this.options.store.authenticate(credentials);
    if (!session) return error('Invalid username or password', 401);
    const auth = buildAuthIdentity(
      { actor: `human:${session.user.username}`, roles: session.user.roles, source: 'local' },
      true,
      this.identityOptions(),
    );
    return json({ success: true, token: session.token, user: session.user, auth });
  }

  private async list(context: CommandContext): Promise<ApiResult> {
    if (!this.canManage(context)) return this.deny();
    try {
      return json({ success: true, users: await this.options.store.list() });
    } catch (err) {
      return failure(err);
    }
  }

  private async create(payload: Payload, context: CommandContext): Promise<ApiResult> {
    if (!this.canManage(context)) return this.deny();
    const body = bodyOf(payload);
    const input: UserCreateInput = {
      username: String(body.username ?? ''),
      password: String(body.password ?? ''),
      roles: (Array.isArray(body.roles) ? body.roles : []) as ManagedUserRole[],
      active: body.active === undefined ? undefined : body.active === true,
    };
    try {
      return json({ success: true, user: await this.options.store.create(input) });
    } catch (err) {
      return failure(err);
    }
  }

  private async update(payload: Payload, context: CommandContext): Promise<ApiResult> {
    if (!this.canManage(context)) return this.deny();
    const body = bodyOf(payload);
    const changes: UserUpdateInput = {};
    if (body.roles !== undefined) changes.roles = (Array.isArray(body.roles) ? body.roles : []) as ManagedUserRole[];
    if (body.active !== undefined) changes.active = body.active === true;
    if (body.password !== undefined) changes.password = String(body.password ?? '');
    try {
      return json({ success: true, user: await this.options.store.update(idFrom(payload), changes) });
    } catch (err) {
      return failure(err);
    }
  }

  private async remove(payload: Payload, context: CommandContext): Promise<ApiResult> {
    if (!this.canManage(context)) return this.deny();
    try {
      await this.options.store.delete(idFrom(payload));
      return json({ success: true });
    } catch (err) {
      return failure(err);
    }
  }

  private identityOptions() {
    return {
      rbacEnabled: this.options.rbac.enabled,
      strict: this.options.strict,
      idpConfigured: this.options.idpConfigured,
      userStoreConfigured: this.options.store.isEnabledSync(),
    };
  }
}
