/** JSON Schema validation driven by the shared API catalogue. */

import Ajv, { type ErrorObject, type ValidateFunction } from 'ajv';
import { ROUTES, SCHEMAS } from '../../../shared/api/contracts';
import type { JsonSchema } from '../../../shared/api/contracts';
import { error, type ApiResult } from './http';
import { GRAPH_PROXY_PATHS } from '../modules/graphProxyModule';

const ajv = new Ajv({ allErrors: true, strict: false, allowUnionTypes: true });

for (const [name, schema] of Object.entries(SCHEMAS)) {
  if (!ajv.getSchema(name)) ajv.addSchema({ $id: name, ...schema }, name);
}

const cache = new Map<string, ValidateFunction>();

function normalizeRefs(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeRefs);
  if (typeof value !== 'object' || value === null) return value;
  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (key === '$ref' && typeof entry === 'string' && entry.startsWith('#/components/schemas/')) {
      result[key] = entry.slice('#/components/schemas/'.length) + '#';
    } else {
      result[key] = normalizeRefs(entry);
    }
  }
  return result;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/** Validate a value against a catalogue schema without throwing. */
export function validateWithSchema(schema: JsonSchema, value: unknown): ValidationResult {
  const normalized = normalizeRefs(schema) as JsonSchema;
  const key = JSON.stringify(normalized);
  let validate = cache.get(key);
  if (!validate) {
    try {
      validate = ajv.compile(normalized);
    } catch (err) {
      return { valid: false, errors: [`Invalid API schema: ${String(err)}`] };
    }
    cache.set(key, validate);
  }
  if (validate(value)) return { valid: true, errors: [] };
  return {
    valid: false,
    errors: (validate.errors ?? []).map(formatError),
  };
}

function formatError(error: ErrorObject): string {
  const where = error.instancePath || 'body';
  const detail = error.keyword === 'additionalProperties'
    ? `unknown property ${String((error.params as { additionalProperty?: string }).additionalProperty ?? '')}`
    : (error.message ?? 'invalid value');
  return `${where}: ${detail}`;
}

/** Convenience for the uniform `{ success: false, error }` envelope. */
export function validationMessage(errors: string[]): string {
  return `Invalid request: ${errors.join('; ')}`;
}

const PROXY_COMMANDS = new Set<string>(Object.values(GRAPH_PROXY_PATHS));
const ROUTE_BY_COMMAND = new Map<string, (typeof ROUTES)[number]>(
  ROUTES.map((route) => [route.command, route]),
);

export function createValidationMiddleware(): (
  command: string,
  payload: unknown,
) => ApiResult | undefined {
  return (command, payload) => {
    if (PROXY_COMMANDS.has(command)) return undefined;
    const schema = ROUTE_BY_COMMAND.get(command)?.request.body;
    if (!schema) return undefined;
    const value = payload && typeof payload === 'object' && !Array.isArray(payload) && 'body' in payload
      ? (payload as { body: unknown }).body
      : payload;
    const validation = validateWithSchema(schema, value);
    return validation.valid ? undefined : error(validationMessage(validation.errors), 400);
  };
}
