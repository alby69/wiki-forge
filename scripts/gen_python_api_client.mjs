#!/usr/bin/env node
/**
 * Generate the typed Node/browser client from the exported FastAPI OpenAPI JSON.
 *
 *   npm run python-contract           # export schema + regenerate client
 *   npm run python-contract:check     # fail on drift
 *
 * PYTHON_OPENAPI_PATH / PYTHON_API_CLIENT_PATH override the artifacts (tests use this).
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const SPEC_PATH = process.env.PYTHON_OPENAPI_PATH
  ? path.resolve(process.env.PYTHON_OPENAPI_PATH)
  : path.join(REPO_ROOT, 'src', 'shared', 'api', 'generated', 'python.openapi.json');
const DEFAULT_CLIENT_PATH = path.join(REPO_ROOT, 'src', 'shared', 'api', 'generated', 'pythonApi.generated.ts');
const METHODS = ['get', 'post', 'put', 'patch', 'delete'];
const INDENT = '  ';

function clientPath() {
  return process.env.PYTHON_API_CLIENT_PATH ? path.resolve(process.env.PYTHON_API_CLIENT_PATH) : DEFAULT_CLIENT_PATH;
}

function relative(file) {
  return path.isAbsolute(file) && file.startsWith(`${REPO_ROOT}${path.sep}`) ? path.relative(REPO_ROOT, file) : file;
}

function pascalCase(value) {
  const parts = String(value).replace(/[^A-Za-z0-9]+/g, ' ').trim().split(/\s+/);
  return parts.map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join('') || 'Anonymous';
}

function camelCase(value) {
  const name = pascalCase(value);
  return name.charAt(0).toLowerCase() + name.slice(1);
}

function typeName(schemaName, used) {
  const base = /^[A-Z][A-Za-z0-9]*$/.test(schemaName) ? schemaName : pascalCase(schemaName);
  let candidate = base;
  let suffix = 2;
  while (used.has(candidate)) candidate = `${base}${suffix++}`;
  used.add(candidate);
  return candidate;
}

function refName(ref, names) {
  const key = String(ref).split('/').pop() ?? 'Unknown';
  return names.get(key) ?? pascalCase(key);
}

function propertyKey(key) {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? key : JSON.stringify(key);
}

function union(parts, glue) {
  const unique = [...new Set(parts.filter(Boolean))];
  if (unique.length === 0) return 'unknown';
  if (unique.length === 1) return unique[0];
  return unique.map((part) => (part.includes(' | ') ? `(${part})` : part)).join(glue);
}

export function renderType(schema, names) {
  if (!schema || typeof schema !== 'object') return 'unknown';
  if (typeof schema.$ref === 'string') return refName(schema.$ref, names);
  if ('const' in schema) return JSON.stringify(schema.const);
  if (Array.isArray(schema.enum) && schema.enum.length > 0) {
    return union(schema.enum.map((value) => JSON.stringify(value)), ' | ');
  }
  const variants = schema.oneOf ?? schema.anyOf;
  if (Array.isArray(variants) && variants.length > 0) {
    return union(variants.map((variant) => renderType(variant, names)), ' | ');
  }
  if (Array.isArray(schema.allOf) && schema.allOf.length > 0) {
    return union(schema.allOf.map((part) => renderType(part, names)), ' & ');
  }
  switch (schema.type) {
    case 'string': return 'string';
    case 'integer':
    case 'number': return 'number';
    case 'boolean': return 'boolean';
    case 'null': return 'null';
    case 'array': return `Array<${renderType(schema.items, names)}>`;
    case 'object': {
      const properties = schema.properties ?? {};
      const entries = Object.entries(properties).sort(([a], [b]) => a.localeCompare(b));
      if (entries.length === 0) {
        return schema.additionalProperties && typeof schema.additionalProperties === 'object'
          ? `Record<string, ${renderType(schema.additionalProperties, names)}>`
          : 'Record<string, unknown>';
      }
      const required = new Set(Array.isArray(schema.required) ? schema.required : []);
      const lines = entries.map(([key, value]) => {
        const optional = required.has(key) ? '' : '?';
        return `${INDENT}${propertyKey(key)}${optional}: ${renderType(value, names)};`;
      });
      return `{\n${lines.join('\n')}\n}`;
    }
    default: return 'unknown';
  }
}

function variantGuard(schema, value, names) {
  const guard = renderGuard(schema, value, names);
  if (schema.type !== 'object' || !schema.properties) return guard;
  const keys = Object.keys(schema.properties).sort().join(',');
  return `isRecord(${value}) && Object.keys(${value}).sort().join(',') === ${JSON.stringify(keys)} && (${guard})`;
}

export function renderGuard(schema, value, names) {
  if (!schema || typeof schema !== 'object') return 'true';
  if (typeof schema.$ref === 'string') return `is${refName(schema.$ref, names)}(${value})`;
  if ('const' in schema) return `${value} === ${JSON.stringify(schema.const)}`;
  if (Array.isArray(schema.enum) && schema.enum.length > 0) {
    return union(schema.enum.map((item) => `${value} === ${JSON.stringify(item)}`), ' || ');
  }
  const variants = schema.oneOf ?? schema.anyOf;
  if (Array.isArray(variants) && variants.length > 0) {
    return `(${union(variants.map((variant) => variantGuard(variant, value, names)), ' || ')})`;
  }
  if (Array.isArray(schema.allOf) && schema.allOf.length > 0) {
    return `(${union(schema.allOf.map((part) => renderGuard(part, value, names)), ' && ')})`;
  }
  switch (schema.type) {
    case 'string': return `typeof ${value} === 'string'`;
    case 'integer': return `Number.isInteger(${value})`;
    case 'number': return `typeof ${value} === 'number' && Number.isFinite(${value})`;
    case 'boolean': return `typeof ${value} === 'boolean'`;
    case 'null': return `${value} === null`;
    case 'array': {
      const item = renderGuard(schema.items, 'item', names);
      return `Array.isArray(${value}) && ${value}.every((item) => ${item})`;
    }
    case 'object': {
      const checks = [`isRecord(${value})`];
      const required = new Set(Array.isArray(schema.required) ? schema.required : []);
      for (const [key, child] of Object.entries(schema.properties ?? {}).sort(([a], [b]) => a.localeCompare(b))) {
        const property = `${value}[${JSON.stringify(key)}]`;
        const guard = renderGuard(child, property, names);
        checks.push(required.has(key)
          ? `hasOwn(${value}, ${JSON.stringify(key)}) && ${guard}`
          : `(${property} === undefined || ${guard})`);
      }
      return checks.join(' && ');
    }
    default: return 'true';
  }
}

function collectNamedSchemas(spec, names) {
  const named = new Map();
  for (const [key, schema] of Object.entries(spec.components?.schemas ?? {}).sort(([a], [b]) => a.localeCompare(b))) {
    named.set(key, { schema, name: names.get(key) });
  }
  const visit = (node) => {
    if (!node || typeof node !== 'object') return;
    if (typeof node.title === 'string' && (node.type === 'object' || node.oneOf || node.anyOf || node.allOf)) {
      if (!named.has(node.title)) {
        const name = typeName(node.title, new Set([...names.values(), ...[...named.values()].map((entry) => entry.name)]));
        named.set(node.title, { schema: node, name });
      }
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === 'object') visit(value);
    }
  };
  for (const item of Object.values(spec.paths ?? {})) {
    for (const operation of Object.values(item ?? {})) {
      if (!operation || typeof operation !== 'object') continue;
      for (const content of Object.values(operation.requestBody?.content ?? {})) visit(content?.schema);
      for (const response of Object.values(operation.responses ?? {})) {
        for (const content of Object.values(response?.content ?? {})) visit(content?.schema);
      }
    }
  }
  return named;
}

function pathKey(pathName, used) {
  const segments = pathName.replace(/^\/api\/v1\//, '').split('/').filter(Boolean);
  const base = camelCase(segments.join(' ') || 'root');
  let candidate = base;
  let suffix = 2;
  while (used.has(candidate)) candidate = `${base}${suffix++}`;
  used.add(candidate);
  return candidate;
}

function operationName(operation, pathName, method, used) {
  const operationId = String(operation.operationId ?? '');
  const prefix = operationId.split('_api_v1_')[0];
  const base = prefix && prefix !== operationId ? camelCase(prefix) : camelCase(`${method} ${pathName}`);
  let candidate = base;
  let suffix = 2;
  while (used.has(candidate)) candidate = `${base}${suffix++}`;
  used.add(candidate);
  return candidate;
}

function responseSchema(operation) {
  const response = operation.responses?.['200'] ?? operation.responses?.['201'] ?? {};
  const content = response.content ?? {};
  if (content['text/event-stream']) return { schema: content['text/event-stream'].schema, stream: true };
  if (content['application/json']) return { schema: content['application/json'].schema, stream: false };
  return { schema: {}, stream: false };
}

function schemaTypeName(schema, names) {
  if (!schema || typeof schema !== 'object') return 'unknown';
  if (typeof schema.$ref === 'string') return refName(schema.$ref, names);
  if (typeof schema.title === 'string' && names.has(schema.title)) return names.get(schema.title).name;
  const rendered = renderType(schema, names);
  return rendered.includes('\n') ? `Record<string, unknown>` : rendered;
}

export function renderClient(spec, clientName = 'pythonApi.generated.ts') {
  const componentNames = new Map();
  const usedTypeNames = new Set();
  for (const key of Object.keys(spec.components?.schemas ?? {}).sort()) {
    componentNames.set(key, typeName(key, usedTypeNames));
  }
  const named = collectNamedSchemas(spec, componentNames);
  for (const entry of named.values()) {
    if (entry.name && !usedTypeNames.has(entry.name)) usedTypeNames.add(entry.name);
  }

  const lines = [
    '/**',
    ` * AUTO-GENERATED by scripts/gen_python_api_client.mjs from python.openapi.json — DO NOT EDIT.`,
    ` * Regenerate with: npm run python-contract (target: ${clientName})`,
    ' * Verify with: npm run python-contract:check',
    ' */',
    '',
    'export const PYTHON_OPENAPI_SNAPSHOT = ' + JSON.stringify(spec, null, 2) + ' as const;',
    '',
  ];

  const usedPathKeys = new Set();
  const paths = Object.keys(spec.paths ?? {}).sort().map((pathName) => [pathName, pathKey(pathName, usedPathKeys)]);
  lines.push('export const PYTHON_API_PATHS = {');
  for (const [pathName, key] of paths) lines.push(`${INDENT}${propertyKey(key)}: ${JSON.stringify(pathName)},`);
  lines.push('} as const;', '');

  const graphPaths = paths.filter(([pathName]) => pathName.includes('/graph/'));
  lines.push('export type PythonApiPath = (typeof PYTHON_API_PATHS)[keyof typeof PYTHON_API_PATHS];');
  lines.push(`export type PythonApiGraphPath = ${graphPaths.map(([, key]) => `typeof PYTHON_API_PATHS.${key}`).join(' | ') || 'never'};`);
  lines.push("export const OPENAPI_JSON_PATH = '/openapi.json';", '');

  lines.push(
    'export function isRecord(value: unknown): value is Record<string, unknown> {',
    `${INDENT}return typeof value === 'object' && value !== null && !Array.isArray(value);`,
    '}',
    '',
    'export function hasOwn(value: Record<string, unknown>, key: string): boolean {',
    `${INDENT}return Object.prototype.hasOwnProperty.call(value, key);`,
    '}',
    '',
  );

  for (const [key, entry] of [...named.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    if (entry.name !== key) continue;
    lines.push(`export type ${entry.name} = ${renderType(entry.schema, componentNames)};`, '');
    lines.push(`export function is${entry.name}(value: unknown): value is ${entry.name} {`);
    lines.push(`${INDENT}return ${renderGuard(entry.schema, 'value', componentNames)};`);
    lines.push('}', '');
  }

  const operations = [];
  const usedOperationNames = new Set();
  for (const [pathName, key] of paths) {
    const item = spec.paths[pathName] ?? {};
    for (const method of METHODS.filter((candidate) => item[candidate])) {
      const operation = item[method];
      const name = operationName(operation, pathName, method, usedOperationNames);
      const requestSchema = operation.requestBody?.content?.['application/json']?.schema;
      const requestType = requestSchema ? schemaTypeName(requestSchema, componentNames) : undefined;
      const { schema: responseSchemaValue, stream } = responseSchema(operation);
      const responseType = stream ? 'Response' : schemaTypeName(responseSchemaValue, componentNames);
      operations.push({ name, pathName, pathKey: key, method, operationId: String(operation.operationId ?? name), requestType, responseType, stream });
    }
  }

  lines.push('export interface PythonApiClientOptions {');
  lines.push(`${INDENT}baseUrl?: string;`);
  lines.push(`${INDENT}fetchImpl?: typeof fetch;`);
  lines.push('}', '');
  lines.push('export interface PythonApiRequestOptions {');
  lines.push(`${INDENT}method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';`);
  lines.push(`${INDENT}search?: string;`);
  lines.push(`${INDENT}headers?: Record<string, string>;`);
  lines.push(`${INDENT}body?: unknown;`);
  lines.push(`${INDENT}bodyText?: string;`);
  lines.push(`${INDENT}signal?: AbortSignal;`);
  lines.push('}', '');
  lines.push(`export const DEFAULT_PYTHON_API_BASE_URL = ${JSON.stringify('http://localhost:8000')};`, '');
  lines.push('export const PYTHON_API_OPERATIONS = [');
  for (const operation of operations) {
    lines.push(`${INDENT}{ name: ${JSON.stringify(operation.name)}, operationId: ${JSON.stringify(operation.operationId)}, method: ${JSON.stringify(operation.method.toUpperCase())}, path: PYTHON_API_PATHS.${operation.pathKey}, stream: ${operation.stream} },`);
  }
  lines.push('] as const;', '');
  lines.push('export type PythonApiOperationName = (typeof PYTHON_API_OPERATIONS)[number][\'name\'];', '');

  lines.push(
    'async function readJson<T>(response: Response): Promise<T> {',
    `${INDENT}if (!response.ok) throw new Error(\`Python API request failed: HTTP \${response.status}\`);`,
    `${INDENT}return (await response.json()) as T;`,
    '}',
    '',
    'async function requireOk(response: Response): Promise<Response> {',
    `${INDENT}if (!response.ok) throw new Error(\`Python API request failed: HTTP \${response.status}\`);`,
    `${INDENT}return response;`,
    '}',
    '',
    'export function createPythonApiClient(options: PythonApiClientOptions = {}) {',
    `${INDENT}const baseUrl = (options.baseUrl ?? DEFAULT_PYTHON_API_BASE_URL).replace(/\\/+$/, '');`,
    `${INDENT}const fetchImpl: typeof fetch = options.fetchImpl ?? ((input, init) => fetch(input, init));`,
    `${INDENT}const request = (endpoint: PythonApiPath | typeof OPENAPI_JSON_PATH, init: PythonApiRequestOptions = {}): Promise<Response> => {`,
    `${INDENT}${INDENT}const { body, bodyText, search = '', headers, ...rest } = init;`,
    `${INDENT}${INDENT}const requestHeaders: Record<string, string> = { ...(headers ?? {}) };`,
    `${INDENT}${INDENT}if (body !== undefined && !Object.keys(requestHeaders).some((key) => key.toLowerCase() === 'content-type')) {`,
    `${INDENT}${INDENT}${INDENT}requestHeaders['Content-Type'] = 'application/json';`,
    `${INDENT}${INDENT}}`,
    `${INDENT}${INDENT}return fetchImpl(\`\${baseUrl}\${endpoint}\${search}\`, {`,
    `${INDENT}${INDENT}${INDENT}...rest,`,
    `${INDENT}${INDENT}${INDENT}headers: requestHeaders,`,
    `${INDENT}${INDENT}${INDENT}body: bodyText ?? (body === undefined ? undefined : JSON.stringify(body)),`,
    `${INDENT}${INDENT}});`,
    `${INDENT}};`,
    `${INDENT}return {`,
    `${INDENT}${INDENT}request,`,
    `${INDENT}${INDENT}getOpenApiSpec: async (init: PythonApiRequestOptions = {}): Promise<unknown> => readJson<unknown>(await request(OPENAPI_JSON_PATH, { method: 'GET', ...init })),`,
  );

  for (const operation of operations) {
    const args = operation.requestType
      ? `body: ${operation.requestType}, options: PythonApiRequestOptions = {}`
      : `options: PythonApiRequestOptions = {}`;
    const init = operation.requestType
      ? `{ method: ${JSON.stringify(operation.method.toUpperCase())}, body, ...options }`
      : `{ method: ${JSON.stringify(operation.method.toUpperCase())}, ...options }`;
    const call = operation.stream
      ? `requireOk(await request(PYTHON_API_PATHS.${operation.pathKey}, ${init}))`
      : `readJson<${operation.responseType}>(await request(PYTHON_API_PATHS.${operation.pathKey}, ${init}))`;
    lines.push(`${INDENT}${INDENT}${operation.name}: async (${args}): Promise<${operation.responseType}> => ${call},`);
  }
  lines.push(`${INDENT}};`, '}', '');
  lines.push('export type PythonApiClient = ReturnType<typeof createPythonApiClient>;', '');

  return lines.join('\n');
}

export async function loadSpec(file = SPEC_PATH) {
  return JSON.parse(await readFile(file, 'utf-8'));
}

async function main() {
  const isCheck = process.argv.includes('--check');
  const target = clientPath();
  const spec = await loadSpec();
  const content = renderClient(spec, relative(target));
  if (isCheck) {
    const current = await readFile(target, 'utf-8').catch(() => null);
    if (current !== content) {
      console.error(`STALE: ${relative(target)} does not match ${relative(SPEC_PATH)}`);
      console.error('Run `npm run python-contract` to regenerate.');
      process.exitCode = 1;
      return;
    }
    console.log(`OK: ${relative(target)} matches ${relative(SPEC_PATH)}`);
    return;
  }
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, content, 'utf-8');
  console.log(`Wrote ${relative(target)}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
