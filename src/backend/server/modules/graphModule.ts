/** Graph commands backed by `scripts/graph_analytics.py` and the C4 Neo4j tool. */

import { error, json, type ApiResult } from '../api/http';
import type { DomainModule, MessageBus } from '../bus/messageBus';
import { runPythonJson, runPythonText, type PythonTool } from './pythonTool';

/** Additive C4 routes: state/query/sync through one injectable Python adapter. */
const NEO4J_TOOL = 'src/backend/wikiforge/semantics/neo4j_api_tool.py';

interface Neo4jPayload {
  cypher?: string;
  params?: Record<string, unknown>;
  projectId?: string;
  body?: {
    cypher?: string;
    params?: Record<string, unknown>;
    projectId?: string;
  };
}

interface ToolReply {
  success?: boolean;
  error?: string;
  errorType?: string;
  [key: string]: unknown;
}

export class GraphModule implements DomainModule {
  readonly name = 'graph-analytics';

  constructor(private readonly tool: PythonTool) {}

  register(bus: MessageBus): void {
    bus.register('graph.clusters', (_payload, context) => this.clusters(context.projectId));
    bus.register('graph.insights', (_payload, context) => this.insights(context.projectId));
    bus.register('graph.status', (_payload, context) => this.status(context.projectId));
    bus.register<Neo4jPayload>('graph.cypher', (payload, context) => this.cypher(payload, context.projectId));
    bus.register<Neo4jPayload>('graph.sync.neo4j', (payload, context) => this.syncNeo4j(payload, context.projectId));
  }

  clusters(projectId: string): Promise<ApiResult> {
    return runPythonJson(
      this.tool,
      'scripts/graph_analytics.py',
      ['--json'],
      projectId,
      '{"clusters":{}}',
    );
  }

  async insights(projectId: string): Promise<ApiResult> {
    try {
      const out = await runPythonText(this.tool, 'scripts/graph_analytics.py', ['--json'], projectId);
      const parsed = JSON.parse(out || '{}') as {
        surprising_connections?: unknown[];
        knowledge_gaps?: unknown[];
      };
      return json({
        success: true,
        surprisingConnections: parsed.surprising_connections || [],
        knowledgeGaps: parsed.knowledge_gaps || [],
      });
    } catch (err) {
      return error(String(err), 500);
    }
  }

  status(projectId: string): Promise<ApiResult> {
    return this.invoke(['status', '--project', projectId], projectId);
  }

  cypher(payload: Neo4jPayload, projectId: string): Promise<ApiResult> {
    const body = payload.body ?? payload;
    if (typeof body.cypher !== 'string' || !body.cypher.trim()) {
      return Promise.resolve(error('cypher must be a non-empty string', 400, { errorType: 'validation_error' }));
    }
    const project = body.projectId || projectId;
    const stdin = JSON.stringify({
      cypher: body.cypher,
      params: body.params ?? {},
      projectId: project,
    });
    // The body project selects the Neo4j database/wiki; the process cwd stays
    // the request project (an unknown id would make spawn fail with ENOENT).
    return this.invoke(['query', '--project', project], projectId, stdin);
  }

  syncNeo4j(payload: Neo4jPayload, projectId: string): Promise<ApiResult> {
    const body = payload.body ?? payload;
    const project = body.projectId || projectId;
    return this.invoke(['sync', '--project', project], projectId);
  }

  private async invoke(args: string[], projectId: string, stdin?: string): Promise<ApiResult> {
    try {
      const out = await runPythonText(this.tool, NEO4J_TOOL, args, projectId, stdin);
      const parsed = JSON.parse(out || '{}') as ToolReply;
      if (parsed.success === false) {
        const clientErrors = ['invalid_request', 'validation_error', 'read_only_violation'];
        const status = clientErrors.includes(String(parsed.errorType)) ? 400 : 500;
        return error(parsed.error ?? 'Neo4j tool failed', status, { errorType: parsed.errorType });
      }
      return json(parsed);
    } catch (err) {
      return error(String(err), 500);
    }
  }
}

export function createGraphModule(tool: PythonTool): GraphModule {
  return new GraphModule(tool);
}
