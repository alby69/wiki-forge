import { currentRequestContext } from './context';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export interface StructuredLogger {
  debug(message: string, fields?: Record<string, unknown>): void;
  info(message: string, fields?: Record<string, unknown>): void;
  warn(message: string, fields?: Record<string, unknown>): void;
  error(message: string, fields?: Record<string, unknown>): void;
}

export interface LoggerOptions {
  env?: NodeJS.ProcessEnv;
  sink?: (line: string) => void;
}

function parseLevel(value: string | undefined): LogLevel {
  const normalized = (value ?? '').trim().toLowerCase();
  return normalized === 'debug' || normalized === 'warn' || normalized === 'error'
    ? normalized
    : 'info';
}

export function createLogger(component: string, options: LoggerOptions = {}): StructuredLogger {
  const env = options.env ?? process.env;
  const sink = options.sink ?? ((line: string) => { process.stdout.write(`${line}\n`); });
  const threshold = LEVELS[parseLevel(env.WIKIFORGE_LOG_LEVEL)];

  const write = (level: LogLevel, message: string, fields: Record<string, unknown> = {}): void => {
    if (LEVELS[level] < threshold) return;
    const correlationId = currentRequestContext()?.correlationId;
    sink(JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      component,
      message,
      ...(correlationId ? { correlationId } : {}),
      ...fields,
    }));
  };

  return {
    debug: (message, fields) => write('debug', message, fields),
    info: (message, fields) => write('info', message, fields),
    warn: (message, fields) => write('warn', message, fields),
    error: (message, fields) => write('error', message, fields),
  };
}

export const httpLogger = createLogger('http');
