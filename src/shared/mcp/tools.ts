import { ROUTES } from '@shared/api/contracts';
import type { ApiRoute, JsonSchema } from '@shared/api/contracts';

export interface McpToolDescriptor {
  readonly name: string;
  readonly operationId: string;
  readonly description: string;
  readonly inputSchema: JsonSchema;
  readonly mutating: boolean;
  readonly legacy: boolean;
}

export function mcpToolNameForRoute(routeId: string): string {
  return `wf_${routeId.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '')}`;
}

function objectSchema(properties: Record<string, JsonSchema> = {}, required: string[] = []): JsonSchema {
  return {
    type: 'object',
    properties,
    ...(required.length ? { required } : {}),
    additionalProperties: false,
  };
}

function plainSchema(schema: JsonSchema): JsonSchema {
  if (schema.$ref) return { type: 'object', additionalProperties: true };
  const result: JsonSchema = { ...schema };
  delete result.$ref;
  delete result.example;
  delete result.nullable;
  if (result.properties) {
    result.properties = Object.fromEntries(
      Object.entries(result.properties).map(([key, value]) => [key, plainSchema(value)]),
    );
  }
  if (result.items) result.items = plainSchema(result.items);
  if (result.additionalProperties && typeof result.additionalProperties === 'object') {
    result.additionalProperties = plainSchema(result.additionalProperties);
  }
  return result;
}

export function mcpInputSchemaForRoute(route: ApiRoute): JsonSchema {
  const params = objectSchema(
    Object.fromEntries((route.request.params ?? []).map((param) => [param.name, plainSchema(param.schema)])),
    (route.request.params ?? []).filter((param) => param.required).map((param) => param.name),
  );
  const query = objectSchema(
    Object.fromEntries((route.request.query ?? []).map((param) => [param.name, plainSchema(param.schema)])),
    (route.request.query ?? []).filter((param) => param.required).map((param) => param.name),
  );
  const headers = objectSchema(
    Object.fromEntries((route.request.headers ?? []).map((param) => [param.name, plainSchema(param.schema)])),
    (route.request.headers ?? []).filter((param) => param.required).map((param) => param.name),
  );
  return objectSchema({
    params,
    query,
    headers,
    body: route.request.body ? plainSchema(route.request.body) : { type: 'object', additionalProperties: true },
  });
}

export const ROUTE_MCP_TOOLS: readonly McpToolDescriptor[] = ROUTES.map((route) => ({
  name: mcpToolNameForRoute(route.id),
  operationId: route.id,
  description: `${route.summary} · ${route.method} ${route.path}`,
  inputSchema: mcpInputSchemaForRoute(route),
  mutating: route.method !== 'GET',
  legacy: false,
}));

export const LEGACY_MCP_TOOLS: readonly McpToolDescriptor[] = [
  {
    name: 'search_wiki',
    operationId: 'wiki.notes.list',
    description: 'Cerca note interconnesse nella wiki tramite l\'API, senza accesso filesystem diretto.',
    inputSchema: objectSchema({
      query: { type: 'string', description: 'Termini di ricerca.' },
      limit: { type: 'integer', description: 'Numero massimo di risultati.' },
    }, ['query']),
    mutating: false,
    legacy: true,
  },
  {
    name: 'get_concept_metadata',
    operationId: 'wiki.notes.list',
    description: 'Restituisce frontmatter OKF, tag e struttura di una nota.',
    inputSchema: objectSchema({ note_id: { type: 'string', description: 'Id o path della nota.' } }, ['note_id']),
    mutating: false,
    legacy: true,
  },
  {
    name: 'get_line_anchored_citation',
    operationId: 'wiki.notes.list',
    description: 'Estrae un passaggio ancorato a righe da una nota.',
    inputSchema: objectSchema({
      note_id: { type: 'string' },
      line_start: { type: 'integer' },
      line_end: { type: 'integer' },
    }, ['note_id', 'line_start', 'line_end']),
    mutating: false,
    legacy: true,
  },
  {
    name: 'list_trust_tiers',
    operationId: 'wiki.notes.list',
    description: 'Raggruppa le note per OKF Trust Tier.',
    inputSchema: objectSchema(),
    mutating: false,
    legacy: true,
  },
  {
    name: 'get_version_history',
    operationId: 'review.snapshots',
    description: 'Restituisce lo storico degli snapshot di una nota.',
    inputSchema: objectSchema({ note_id: { type: 'string' } }, ['note_id']),
    mutating: false,
    legacy: true,
  },
  {
    name: 'validate_competency_question',
    operationId: 'ke.useCases.execute',
    description: 'Valuta una competency question tramite il caso d\'uso CQ del backend.',
    inputSchema: objectSchema({ question: { type: 'string' } }, ['question']),
    mutating: false,
    legacy: true,
  },
  {
    name: 'get_ontology_gaps',
    operationId: 'ke.useCases.execute',
    description: 'Individua gap ontologici tramite il caso d\'uso di validazione del backend.',
    inputSchema: objectSchema(),
    mutating: false,
    legacy: true,
  },
  {
    name: 'execute_ke_use_case',
    operationId: 'ke.useCases.execute',
    description: 'Esegue un use case KE registrato tramite il kernel HTTP.',
    inputSchema: objectSchema({ use_case_id: { type: 'string' } }, ['use_case_id']),
    mutating: true,
    legacy: true,
  },
];

export const MCP_TOOL_DESCRIPTORS: readonly McpToolDescriptor[] = [
  ...ROUTE_MCP_TOOLS,
  ...LEGACY_MCP_TOOLS,
];
