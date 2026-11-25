export interface HttpRequestMetric {
  method: string;
  status: number;
  outcome: string;
  durationMs: number;
}

const requests = new Map<string, number>();
const durationMs = new Map<string, number>();
const errors = new Map<string, number>();

function increment(target: Map<string, number>, key: string, amount: number): void {
  target.set(key, (target.get(key) ?? 0) + amount);
}

function labels(metric: HttpRequestMetric): string {
  return `method="${escapeLabel(metric.method)}",status="${metric.status}",outcome="${escapeLabel(metric.outcome)}"`;
}

function escapeLabel(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

function renderCounter(name: string, help: string, values: Map<string, number>): string[] {
  const lines = [`# HELP ${name} ${help}`, `# TYPE ${name} counter`];
  for (const [key, value] of [...values.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    lines.push(`${name}{${key}} ${value}`);
  }
  return lines;
}

export function recordHttpRequest(metric: HttpRequestMetric): void {
  const key = labels(metric);
  increment(requests, key, 1);
  increment(durationMs, key, Math.max(0, metric.durationMs));
  if (metric.status >= 400) increment(errors, key, 1);
}

export function renderPrometheus(): string {
  return [
    ...renderCounter(
      'wikiforge_http_requests_total',
      'Total HTTP requests handled by the API.',
      requests,
    ),
    ...renderCounter(
      'wikiforge_http_request_duration_ms_total',
      'Total HTTP request duration in milliseconds.',
      durationMs,
    ),
    ...renderCounter(
      'wikiforge_http_request_errors_total',
      'Total HTTP requests with a 4xx or 5xx status.',
      errors,
    ),
    '',
  ].join('\n');
}

export function resetHttpMetrics(): void {
  requests.clear();
  durationMs.clear();
  errors.clear();
}
