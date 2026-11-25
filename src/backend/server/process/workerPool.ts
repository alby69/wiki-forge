export interface WorkerPoolStats {
  concurrency: number;
  active: number;
  pending: number;
}

export class WorkerPool {
  readonly concurrency: number;
  private active = 0;
  private readonly queue: Array<() => void> = [];

  constructor(concurrency: number) {
    if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 32) {
      throw new RangeError(`Worker concurrency must be an integer in 1..32, got ${concurrency}`);
    }
    this.concurrency = concurrency;
  }

  get stats(): WorkerPoolStats {
    return { concurrency: this.concurrency, active: this.active, pending: this.queue.length };
  }

  run<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const start = (): void => {
        this.active += 1;
        void task().then(resolve, reject).finally(() => {
          this.active -= 1;
          this.drain();
        });
      };
      const queued = (): void => {
        this.queue.push(start);
        this.drain();
      };
      if (this.active < this.concurrency) start();
      else queued();
    });
  }

  private drain(): void {
    while (this.active < this.concurrency && this.queue.length > 0) {
      const next = this.queue.shift();
      next?.();
    }
  }
}
