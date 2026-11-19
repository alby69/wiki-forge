import { CronExpressionParser } from 'cron-parser';

/**
 * A job trigger. Cron expressions use the classic 5-field form
 * (`min hour day month weekday`); `every=<n>m|h|d` is the readable interval
 * alternative. All times are resolved in the configured IANA timezone.
 */
export interface ParsedSchedule {
  kind: 'cron' | 'interval';
  expression: string;
  timezone: string;
  intervalMs?: number;
}

const INTERVAL_UNITS_MS: Record<string, number> = {
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

const WEEKDAYS = [
  'domenica',
  'lunedì',
  'martedì',
  'mercoledì',
  'giovedì',
  'venerdì',
  'sabato',
];

export function isValidTimezone(timezone: string): boolean {
  if (!timezone || typeof timezone !== 'string') return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

/** Parse and validate a schedule expression, throwing on invalid input. */
export function parseSchedule(
  expression: string,
  timezone: string = 'UTC'
): ParsedSchedule {
  if (!isValidTimezone(timezone)) {
    throw new Error(`Invalid timezone '${timezone}'`);
  }
  if (typeof expression !== 'string' || !expression.trim()) {
    throw new Error('Schedule expression is empty');
  }

  const trimmed = expression.trim();
  const intervalMatch = /^every=(\d+)([mhd])$/i.exec(trimmed);
  if (intervalMatch) {
    const amount = Number(intervalMatch[1]);
    if (amount < 1) throw new Error(`Invalid interval '${trimmed}': amount must be positive`);
    return {
      kind: 'interval',
      expression: trimmed.toLowerCase(),
      timezone,
      intervalMs: amount * INTERVAL_UNITS_MS[intervalMatch[2].toLowerCase()],
    };
  }

  const fields = trimmed.split(/\s+/);
  if (fields.length !== 5 && fields.length !== 6) {
    throw new Error(
      `Invalid cron expression '${trimmed}': expected 5 fields (min hour day month weekday)`
    );
  }

  try {
    // Parsing once here rejects invalid fields at config load time, not at
    // the first tick. cron-parser accepts both 5 and 6 field expressions.
    CronExpressionParser.parse(trimmed, { tz: timezone });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(`Invalid cron expression '${trimmed}': ${detail}`);
  }

  return { kind: 'cron', expression: trimmed, timezone };
}

/** First occurrence strictly after `from`, as a UTC Date ready for comparison. */
export function nextRunAt(schedule: ParsedSchedule, from: Date): Date {
  if (schedule.kind === 'interval') {
    return new Date(from.getTime() + (schedule.intervalMs ?? 0));
  }
  const iterator = CronExpressionParser.parse(schedule.expression, {
    tz: schedule.timezone,
    currentDate: from,
  });
  return iterator.next().toDate();
}

/** Human readable description for the Workbench job cards. */
export function describeSchedule(schedule: ParsedSchedule): string {
  if (schedule.kind === 'interval') {
    const amount = Math.round((schedule.intervalMs ?? 0) / INTERVAL_UNITS_MS.m);
    if (amount % 1440 === 0) {
      const days = amount / 1440;
      return `ogni ${days} ${days === 1 ? 'giorno' : 'giorni'}`;
    }
    if (amount % 60 === 0) {
      const hours = amount / 60;
      return `ogni ${hours} ${hours === 1 ? 'ora' : 'ore'}`;
    }
    return `ogni ${amount} minuti`;
  }

  const [minute, hour, dayOfMonth, month, dayOfWeek] = schedule.expression.split(/\s+/);
  const at = /^\d+$/.test(minute) && /^\d+$/.test(hour)
    ? `alle ${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`
    : null;

  if (at && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    return `ogni giorno ${at} (${schedule.timezone})`;
  }
  if (at && dayOfMonth === '*' && month === '*' && /^\d$/.test(dayOfWeek)) {
    return `ogni ${WEEKDAYS[Number(dayOfWeek)]} ${at} (${schedule.timezone})`;
  }
  if (at && /^\d+$/.test(dayOfMonth) && month === '*' && dayOfWeek === '*') {
    return `il giorno ${dayOfMonth} del mese ${at} (${schedule.timezone})`;
  }
  return `cron '${schedule.expression}' (${schedule.timezone})`;
}
