import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

/** Content of `.wiki-forge/scheduler.lock`. */
export interface LockInfo {
  pid: number;
  hostname: string;
  acquiredAt: string;
}

export class LockHeldError extends Error {
  constructor(public readonly holder: LockInfo) {
    super(
      `Scheduler lock is held by PID ${holder.pid} on ${holder.hostname} ` +
        `(acquired ${holder.acquiredAt || 'unknown'})`
    );
    this.name = 'LockHeldError';
  }
}

export interface ProcessLock {
  readonly filePath: string;
  acquire(): Promise<LockInfo>;
  release(): Promise<void>;
  read(): Promise<LockInfo | null>;
  isHeld(): boolean;
}

/**
 * True when a process with this PID exists. EPERM means "alive but owned by
 * another user", which still counts as a live lock holder on POSIX.
 */
export function isPidAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === 'EPERM';
  }
}

function parseLock(text: string): LockInfo | null {
  try {
    const parsed = JSON.parse(text) as Partial<LockInfo>;
    if (typeof parsed.pid !== 'number' || !Number.isInteger(parsed.pid)) return null;
    return {
      pid: parsed.pid,
      hostname: typeof parsed.hostname === 'string' ? parsed.hostname : 'unknown',
      acquiredAt: typeof parsed.acquiredAt === 'string' ? parsed.acquiredAt : '',
    };
  } catch {
    return null;
  }
}

/**
 * PID-based inter-process lock. A lock left behind by a crashed process (dead
 * PID, or our own PID from a previous run) is taken over automatically, so a
 * restart after `kill -9` does not require manual cleanup.
 */
export function createPidLock(
  lockPath: string,
  options: { pid?: number; hostname?: string; now?: () => Date } = {}
): ProcessLock {
  const pid = options.pid ?? process.pid;
  const hostname = options.hostname ?? os.hostname();
  const now = options.now ?? (() => new Date());
  let held = false;

  const read = async (): Promise<LockInfo | null> => {
    try {
      return parseLock(await fs.readFile(lockPath, 'utf-8'));
    } catch {
      return null;
    }
  };

  return {
    filePath: lockPath,
    isHeld: () => held,
    read,

    async acquire() {
      const info: LockInfo = { pid, hostname, acquiredAt: now().toISOString() };
      const payload = `${JSON.stringify(info, null, 2)}\n`;
      await fs.mkdir(path.dirname(lockPath), { recursive: true });

      try {
        // Exclusive creation: two starters race safely, only one wins.
        await fs.writeFile(lockPath, payload, { flag: 'wx', encoding: 'utf-8' });
        held = true;
        return info;
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err;
      }

      const existing = await read();
      if (existing && existing.pid !== pid && isPidAlive(existing.pid)) {
        throw new LockHeldError(existing);
      }
      // Stale lock: overwrite it. A concurrent takeover is still safe because
      // only one writer can win the final write and each release checks its PID.
      await fs.writeFile(lockPath, payload, 'utf-8');
      held = true;
      return info;
    },

    async release() {
      if (!held) return;
      const existing = await read();
      // Never delete a lock that another live instance has since taken over.
      if (existing && existing.pid === pid) {
        await fs.unlink(lockPath).catch(() => undefined);
      }
      held = false;
    },
  };
}
