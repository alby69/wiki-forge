import { ROUTES } from '@shared/api/contracts';
import type { JsonSchema } from '@shared/api/contracts';
import { COMMAND_MANIFEST } from '@shared/api/generated/commandManifest.generated';
import {
  LEGACY_MCP_TOOLS,
  mcpInputSchemaForRoute,
  mcpToolNameForRoute,
} from './definitions';
import type { McpToolDescriptor } from './definitions';

export { LEGACY_MCP_TOOLS, mcpInputSchemaForRoute, mcpToolNameForRoute };
export type { McpToolDescriptor };

export const ROUTE_MCP_TOOLS: readonly McpToolDescriptor[] = ROUTES.map((route) => ({
  name: mcpToolNameForRoute(route.id),
  operationId: route.id,
  description: `${route.summary} · ${route.method} ${route.path}`,
  inputSchema: mcpInputSchemaForRoute(route),
  mutating: route.method !== 'GET',
  legacy: false,
}));

export const MCP_TOOL_DESCRIPTORS: readonly McpToolDescriptor[] = COMMAND_MANIFEST.mcpTools.map((tool) => ({
  name: tool.name,
  operationId: tool.operationId,
  description: tool.description,
  inputSchema: tool.inputSchema as JsonSchema,
  mutating: tool.mutating,
  legacy: tool.legacy,
}));
