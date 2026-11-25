import { createRequire } from 'node:module';

export type SpanAttributeValue = string | number | boolean;
export type SpanAttributes = Record<string, SpanAttributeValue>;

export interface Span {
  setAttribute(key: string, value: SpanAttributeValue): void;
  setAttributes(attributes: SpanAttributes): void;
  addEvent(name: string, attributes?: SpanAttributes): void;
  recordException(error: unknown): void;
  end(endTime?: number): void;
}

export interface SpanOptions {
  attributes?: SpanAttributes;
}

export interface Tracer {
  startActiveSpan<T>(name: string, fn: (span: Span) => T): T;
  startActiveSpan<T>(name: string, options: SpanOptions, fn: (span: Span) => T): T;
}

export interface TraceApi {
  getTracer(name: string, version?: string): Tracer;
}

export interface Telemetry {
  trace: TraceApi;
  provider: 'opentelemetry' | 'local';
}

class LocalSpan implements Span {
  setAttribute(_key: string, _value: SpanAttributeValue): void {}
  setAttributes(_attributes: SpanAttributes): void {}
  addEvent(_name: string, _attributes?: SpanAttributes): void {}
  recordException(_error: unknown): void {}
  end(_endTime?: number): void {}
}

class LocalTracer {
  public startActiveSpan<T>(
    name: string,
    optionsOrFn: SpanOptions | ((span: Span) => T),
    maybeFn?: (span: Span) => T,
  ): T {
    const fn = typeof optionsOrFn === 'function' ? optionsOrFn : maybeFn;
    if (!fn) throw new TypeError('startActiveSpan requires a callback');
    const span = new LocalSpan();
    if (typeof optionsOrFn !== 'function') span.setAttributes(optionsOrFn.attributes ?? {});
    return fn(span);
  }
}

export const localTrace: TraceApi = {
  getTracer(_name: string, _version?: string): Tracer {
    return new LocalTracer() as unknown as Tracer;
  },
};

export const trace: TraceApi = localTrace;

const nodeRequire = createRequire(import.meta.url);

function loadOpenTelemetry(env: NodeJS.ProcessEnv): TraceApi | undefined {
  if (env.WIKIFORGE_OTEL_DISABLED === '1') return undefined;
  try {
    const api = nodeRequire('@opentelemetry/api') as { trace?: TraceApi };
    if (typeof api.trace?.getTracer === 'function') return api.trace;
  } catch {
    return undefined;
  }
  return undefined;
}

let cached: Telemetry | undefined;

export function createTelemetry(env: NodeJS.ProcessEnv = process.env): Telemetry {
  const external = loadOpenTelemetry(env);
  return external ? { trace: external, provider: 'opentelemetry' } : { trace: localTrace, provider: 'local' };
}

export function getTelemetry(): Telemetry {
  cached ??= createTelemetry();
  return cached;
}
