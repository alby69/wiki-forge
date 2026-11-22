import * as fs from 'node:fs/promises';
import * as path from 'node:path';

/**
 * F6 — persistent queue of mutating steps waiting for a human decision.
 *
 * Nothing in this module executes a step: it only records what the Policy
 * Agent withheld and the reviewer's answer. Execution happens in AgentServer
 * after an explicit POST .../approve, with snapshots and an audit entry.
 */

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'failed';

export interface ApprovalRequest {
  id: string;
  jobId: string;
  useCaseId: string;
  project: string;
  stepIndex: number;
  /** S2: distinguishes generated script jobs from the original Use Case jobs. */
  jobKind?: 'use_case' | 'script';
  scriptId?: string;
  /** S2: redacted resolved args, so the reviewer sees what will actually run. */
  scriptArgs?: Record<string, unknown>;
  title?: string;
  trigger: 'cron' | 'manual' | 'event';
  event?: string;
  rationale: string;
  sources: string[];
  createdAt: string;
  status: ApprovalStatus;
  decidedAt?: string;
  decidedBy?: string;
  reason?: string;
  error?: string;
}

export type NewApprovalRequest = Omit<ApprovalRequest, 'id' | 'createdAt' | 'status'>;

export interface ApprovalStoreOptions {
  filePath: string;
  now?: () => Date;
}

export class ApprovalStore {
  private readonly filePath: string;
  private readonly now: () => Date;

  constructor(options: ApprovalStoreOptions) {
    this.filePath = options.filePath;
    this.now = options.now ?? (() => new Date());
  }

  /**
   * B3 — `project` is an additive filter used by the RBAC membership gate.
   * Omitting it preserves the historical "all approvals" behaviour.
   */
  public async list(
    options: { jobId?: string; status?: ApprovalStatus; project?: string } = {},
  ): Promise<ApprovalRequest[]> {
    const requests = await this.read();
    return requests
      .filter((request) => !options.jobId || request.jobId === options.jobId)
      .filter((request) => !options.status || request.status === options.status)
      .filter((request) => !options.project || request.project === options.project)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  public async get(id: string): Promise<ApprovalRequest | undefined> {
    return (await this.read()).find((request) => request.id === id);
  }

  /** Add a pending request, or return the existing one if it is still pending. */
  public async stage(request: NewApprovalRequest): Promise<ApprovalRequest> {
    const requests = await this.read();
    const existing = requests.find(
      (item) =>
        item.status === 'pending' &&
        item.jobId === request.jobId &&
        item.stepIndex === request.stepIndex
    );
    if (existing) return existing;

    const created: ApprovalRequest = {
      ...request,
      id: `appr-${this.now().getTime()}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: this.now().toISOString(),
      status: 'pending',
    };
    requests.push(created);
    await this.write(requests);
    return created;
  }

  public async update(
    id: string,
    patch: Partial<Pick<ApprovalRequest, 'status' | 'decidedBy' | 'reason' | 'error'>>
  ): Promise<ApprovalRequest | undefined> {
    const requests = await this.read();
    const index = requests.findIndex((request) => request.id === id);
    if (index < 0) return undefined;
    const updated: ApprovalRequest = {
      ...requests[index],
      ...patch,
      decidedAt: this.now().toISOString(),
    };
    requests[index] = updated;
    await this.write(requests);
    return updated;
  }

  private async read(): Promise<ApprovalRequest[]> {
    try {
      const text = await fs.readFile(this.filePath, 'utf-8');
      const parsed = JSON.parse(text);
      return Array.isArray(parsed) ? (parsed as ApprovalRequest[]) : [];
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
      return [];
    }
  }

  private async write(requests: ApprovalRequest[]): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const temp = `${this.filePath}.${process.pid}.tmp`;
    await fs.writeFile(temp, JSON.stringify(requests, null, 2), 'utf-8');
    await fs.rename(temp, this.filePath);
  }
}
