import type { JobKind } from '../scheduler/jobStore';
import type { StateStore } from './types';

export const APPROVAL_OUTBOX_KEY = 'outbox/approvals';

export interface ApprovalStagedEvent {
  type: 'approval.staged';
  approvalId: string;
  jobId: string;
  useCaseId: string;
  project: string;
  at: string;
}

export interface ApprovalRequiredEvent {
  type: 'approval.required';
  jobId: string;
  approvalIds: string[];
  steps?: number[];
  jobKind?: JobKind;
  scriptIds?: string[];
  rationale: string;
  sources: string[];
  at: string;
}

export interface ApprovalDecidedEvent {
  type: 'approval.decided';
  approvalId: string;
  jobId: string;
  status: 'approved' | 'rejected';
  decidedBy: string;
  reason?: string;
  at: string;
}

export type ApprovalEvent = ApprovalStagedEvent | ApprovalRequiredEvent | ApprovalDecidedEvent;

export interface ApprovalOutboxFilter {
  jobId?: string;
  type?: ApprovalEvent['type'];
}

export class ApprovalOutbox {
  readonly key: string;

  constructor(
    private readonly store: StateStore,
    key: string = APPROVAL_OUTBOX_KEY,
    private readonly now: () => Date = () => new Date(),
  ) {
    this.key = key;
  }

  public async append(event: ApprovalEvent): Promise<void> {
    const payload = { ...event, at: event.at || this.now().toISOString() } as ApprovalEvent;
    await this.store.append(this.key, payload);
  }

  public async readAll(filter: ApprovalOutboxFilter = {}): Promise<ApprovalEvent[]> {
    const events = await this.store.readAll<ApprovalEvent>(this.key);
    return events.filter(
      (event) =>
        (!filter.jobId || event.jobId === filter.jobId) &&
        (!filter.type || event.type === filter.type),
    );
  }
}
