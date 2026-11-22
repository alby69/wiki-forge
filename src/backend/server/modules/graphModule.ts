/** Graph analytics commands backed by `scripts/graph_analytics.py`. */

import { error, json, type ApiResult } from '../api/http';
import type { DomainModule, MessageBus } from '../bus/messageBus';
import { runPythonJson, runPythonText, type PythonTool } from './pythonTool';

export class GraphModule implements DomainModule {
  readonly name = 'graph-analytics';

  constructor(private readonly tool: PythonTool) {}

  register(bus: MessageBus): void {
    bus.register('graph.clusters', (_payload, context) => this.clusters(context.projectId));
    bus.register('graph.insights', (_payload, context) => this.insights(context.projectId));
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
}

export function createGraphModule(tool: PythonTool): GraphModule {
  return new GraphModule(tool);
}
