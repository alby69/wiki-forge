import type { DomainModule, MessageBus } from '../server/bus/messageBus';
import type { GraphEventHub } from '../server/graphEvents';
import type { PythonTool } from '../server/modules/pythonTool';
import { createChangesetsModule } from '../server/modules/changesetsModule';
import { createChatModule } from '../server/modules/chatModule';
import { createExecutionModule } from '../server/modules/executionModule';
import { createFilesModule } from '../server/modules/filesModule';
import { createGraphModule, type GraphModule } from '../server/modules/graphModule';
import { createGraphProxyModule, type FastApiUrlResolver } from '../server/modules/graphProxyModule';
import { createProjectsModule } from '../server/modules/projectsModule';
import { createResearchModule } from '../server/modules/researchModule';
import { createReviewStudioModule } from '../server/modules/reviewStudioModule';
import { createSchedulerModule } from '../server/modules/schedulerModule';
import { createSlashModule } from '../server/modules/slashModule';
import { createStudyModule } from '../server/modules/studyModule';
import { createTemplateModule } from '../server/modules/templateModule';
import { createVaultModule } from '../server/modules/vaultModule';
import type { Retriever } from '../server/retrieval/retrieverPort';
import type { KernelPorts } from './ports';

export interface KernelOptions {
  bus: MessageBus;
  ports: KernelPorts;
  pythonTool: PythonTool;
  graphEvents: GraphEventHub;
  fastApiUrl?: FastApiUrlResolver;
  coreModules?: readonly DomainModule[];
  retriever?: Retriever;
}

export interface Kernel {
  bus: MessageBus;
  modules: readonly DomainModule[];
  graph: GraphModule;
}

export function createKernel(options: KernelOptions): Kernel {
  const ports = options.ports;
  const modules: DomainModule[] = [
    ...(options.coreModules ?? []),
    createProjectsModule(ports.projects),
    createTemplateModule(),
    createChangesetsModule(ports.changesets, options.graphEvents),
    createFilesModule(ports.files),
    createSchedulerModule(ports.scheduler),
    createExecutionModule(ports.execution),
    createVaultModule(ports.vault),
    createReviewStudioModule(ports.reviewStudio),
    createResearchModule(ports.research, options.retriever),
    createStudyModule(ports.study),
    createChatModule(ports.chat),
    createSlashModule(ports.slash),
  ];
  const graph = createGraphModule(
    options.pythonTool,
    options.graphEvents,
    ports.graph,
  );
  modules.push(graph, createGraphProxyModule({ baseUrl: options.fastApiUrl }));
  for (const module of modules) module.register(options.bus);
  return { bus: options.bus, modules, graph };
}
