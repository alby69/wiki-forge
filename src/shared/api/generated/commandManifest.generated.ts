// GENERATED FILE — do not edit by hand.
// Run `npm run manifest` to regenerate; `npm run manifest:check` verifies freshness.

export interface CommandManifestRoute {
  readonly id: string;
  readonly method: string;
  readonly path: string;
  readonly command: string;
  readonly tags: readonly string[];
  readonly projectScoped: boolean;
  readonly stream: string | null;
  readonly hasBusHandler: boolean;
}

export interface CommandManifestSlash {
  readonly id: string;
  readonly category: string;
  readonly verb: string;
  readonly hasImplementation: boolean;
}

export interface CommandManifestGap {
  readonly kind: 'route-without-bus' | 'slash-without-implementation';
  readonly id: string;
  readonly detail: string;
}

export interface CommandManifestMcpTool {
  readonly name: string;
  readonly operationId: string;
  readonly description: string;
  readonly inputSchema: Record<string, unknown>;
  readonly mutating: boolean;
  readonly legacy: boolean;
}

export interface CommandManifest {
  readonly routes: readonly CommandManifestRoute[];
  readonly busCommands: readonly string[];
  readonly slashCommands: readonly CommandManifestSlash[];
  readonly implementedSlashCommands: readonly string[];
  readonly mcpTools: readonly CommandManifestMcpTool[];
  readonly gaps: readonly CommandManifestGap[];
}

export const COMMAND_MANIFEST: CommandManifest = {
  "routes": [
    {
      "id": "docs.openapi",
      "method": "GET",
      "path": "/api/openapi.json",
      "command": "docs.openapi",
      "tags": [
        "Documentation"
      ],
      "projectScoped": false,
      "stream": null,
      "hasBusHandler": true
    },
    {
      "id": "docs.swagger",
      "method": "GET",
      "path": "/api/docs",
      "command": "docs.swagger",
      "tags": [
        "Documentation"
      ],
      "projectScoped": false,
      "stream": null,
      "hasBusHandler": true
    },
    {
      "id": "auth.me",
      "method": "GET",
      "path": "/api/auth/me",
      "command": "auth.me",
      "tags": [
        "Identity"
      ],
      "projectScoped": false,
      "stream": null,
      "hasBusHandler": true
    },
    {
      "id": "auth.login",
      "method": "POST",
      "path": "/api/auth/login",
      "command": "auth.login",
      "tags": [
        "Identity"
      ],
      "projectScoped": false,
      "stream": null,
      "hasBusHandler": true
    },
    {
      "id": "users.list",
      "method": "GET",
      "path": "/api/users",
      "command": "users.list",
      "tags": [
        "Identity"
      ],
      "projectScoped": false,
      "stream": null,
      "hasBusHandler": true
    },
    {
      "id": "users.create",
      "method": "POST",
      "path": "/api/users",
      "command": "users.create",
      "tags": [
        "Identity"
      ],
      "projectScoped": false,
      "stream": null,
      "hasBusHandler": true
    },
    {
      "id": "users.update",
      "method": "PATCH",
      "path": "/api/users/:id",
      "command": "users.update",
      "tags": [
        "Identity"
      ],
      "projectScoped": false,
      "stream": null,
      "hasBusHandler": true
    },
    {
      "id": "users.delete",
      "method": "DELETE",
      "path": "/api/users/:id",
      "command": "users.delete",
      "tags": [
        "Identity"
      ],
      "projectScoped": false,
      "stream": null,
      "hasBusHandler": true
    },
    {
      "id": "ui.access",
      "method": "GET",
      "path": "/api/ui/access",
      "command": "ui.access",
      "tags": [
        "Identity"
      ],
      "projectScoped": false,
      "stream": null,
      "hasBusHandler": true
    },
    {
      "id": "ui.preferences.get",
      "method": "GET",
      "path": "/api/ui/preferences",
      "command": "ui.preferences.get",
      "tags": [
        "Identity"
      ],
      "projectScoped": false,
      "stream": null,
      "hasBusHandler": true
    },
    {
      "id": "ui.preferences.put",
      "method": "PUT",
      "path": "/api/ui/preferences",
      "command": "ui.preferences.put",
      "tags": [
        "Identity"
      ],
      "projectScoped": false,
      "stream": null,
      "hasBusHandler": true
    },
    {
      "id": "graph.sync",
      "method": "POST",
      "path": "/api/v1/graph/sync",
      "command": "graph.sync",
      "tags": [
        "Knowledge Graph"
      ],
      "projectScoped": false,
      "stream": null,
      "hasBusHandler": true
    },
    {
      "id": "graph.validate",
      "method": "POST",
      "path": "/api/v1/graph/validate",
      "command": "graph.validate",
      "tags": [
        "Knowledge Graph"
      ],
      "projectScoped": false,
      "stream": null,
      "hasBusHandler": true
    },
    {
      "id": "graph.rag",
      "method": "POST",
      "path": "/api/v1/graph/rag",
      "command": "graph.rag",
      "tags": [
        "Knowledge Graph"
      ],
      "projectScoped": false,
      "stream": null,
      "hasBusHandler": true
    },
    {
      "id": "graph.clusters",
      "method": "GET",
      "path": "/api/v1/graph/clusters",
      "command": "graph.clusters",
      "tags": [
        "Knowledge Graph"
      ],
      "projectScoped": true,
      "stream": null,
      "hasBusHandler": true
    },
    {
      "id": "graph.insights",
      "method": "GET",
      "path": "/api/v1/graph/insights",
      "command": "graph.insights",
      "tags": [
        "Knowledge Graph"
      ],
      "projectScoped": true,
      "stream": null,
      "hasBusHandler": true
    },
    {
      "id": "graph.cypher",
      "method": "POST",
      "path": "/api/v1/graph/cypher",
      "command": "graph.cypher",
      "tags": [
        "Knowledge Graph"
      ],
      "projectScoped": true,
      "stream": null,
      "hasBusHandler": true
    },
    {
      "id": "graph.sync.neo4j",
      "method": "POST",
      "path": "/api/v1/graph/sync/neo4j",
      "command": "graph.sync.neo4j",
      "tags": [
        "Knowledge Graph"
      ],
      "projectScoped": true,
      "stream": null,
      "hasBusHandler": true
    },
    {
      "id": "graph.status",
      "method": "GET",
      "path": "/api/v1/graph/status",
      "command": "graph.status",
      "tags": [
        "Knowledge Graph"
      ],
      "projectScoped": true,
      "stream": null,
      "hasBusHandler": true
    },
    {
      "id": "graph.events",
      "method": "GET",
      "path": "/api/v1/graph/events",
      "command": "graph.events",
      "tags": [
        "Knowledge Graph"
      ],
      "projectScoped": true,
      "stream": "sse",
      "hasBusHandler": true
    },
    {
      "id": "graph.reconcile",
      "method": "POST",
      "path": "/api/v1/graph/reconcile",
      "command": "graph.reconcile",
      "tags": [
        "Knowledge Graph"
      ],
      "projectScoped": true,
      "stream": null,
      "hasBusHandler": true
    },
    {
      "id": "skills.list",
      "method": "GET",
      "path": "/api/skills",
      "command": "skills.list",
      "tags": [
        "Catalogues"
      ],
      "projectScoped": false,
      "stream": null,
      "hasBusHandler": true
    },
    {
      "id": "help.list",
      "method": "GET",
      "path": "/api/help",
      "command": "help.list",
      "tags": [
        "Catalogues"
      ],
      "projectScoped": false,
      "stream": null,
      "hasBusHandler": true
    },
    {
      "id": "help.get",
      "method": "GET",
      "path": "/api/help/:topicId",
      "command": "help.get",
      "tags": [
        "Catalogues"
      ],
      "projectScoped": false,
      "stream": null,
      "hasBusHandler": true
    },
    {
      "id": "scripts.list",
      "method": "GET",
      "path": "/api/scripts/list",
      "command": "scripts.list",
      "tags": [
        "Catalogues"
      ],
      "projectScoped": false,
      "stream": null,
      "hasBusHandler": true
    },
    {
      "id": "scripts.registry",
      "method": "GET",
      "path": "/api/scripts/registry",
      "command": "scripts.list",
      "tags": [
        "Catalogues"
      ],
      "projectScoped": false,
      "stream": null,
      "hasBusHandler": true
    },
    {
      "id": "scripts.schedule",
      "method": "POST",
      "path": "/api/scripts/schedule",
      "command": "scripts.schedule",
      "tags": [
        "Catalogues",
        "Scheduler"
      ],
      "projectScoped": false,
      "stream": null,
      "hasBusHandler": true
    },
    {
      "id": "scripts.unschedule",
      "method": "DELETE",
      "path": "/api/scripts/schedule/:jobId",
      "command": "scripts.unschedule",
      "tags": [
        "Catalogues",
        "Scheduler"
      ],
      "projectScoped": false,
      "stream": null,
      "hasBusHandler": true
    },
    {
      "id": "scripts.execute",
      "method": "POST",
      "path": "/api/scripts/execute",
      "command": "scripts.execute",
      "tags": [
        "Catalogues"
      ],
      "projectScoped": true,
      "stream": "sse",
      "hasBusHandler": true
    },
    {
      "id": "ke.useCases.list",
      "method": "GET",
      "path": "/api/ke/use-cases",
      "command": "ke.useCases.list",
      "tags": [
        "Catalogues"
      ],
      "projectScoped": false,
      "stream": null,
      "hasBusHandler": true
    },
    {
      "id": "ke.useCases.execute",
      "method": "POST",
      "path": "/api/ke/use-cases/execute",
      "command": "ke.useCases.execute",
      "tags": [
        "Knowledge Engineering"
      ],
      "projectScoped": true,
      "stream": "sse",
      "hasBusHandler": true
    },
    {
      "id": "reviews.list",
      "method": "GET",
      "path": "/api/reviews",
      "command": "reviews.list",
      "tags": [
        "Review Queue"
      ],
      "projectScoped": true,
      "stream": null,
      "hasBusHandler": true
    },
    {
      "id": "reviews.add",
      "method": "POST",
      "path": "/api/reviews/add",
      "command": "reviews.add",
      "tags": [
        "Review Queue"
      ],
      "projectScoped": true,
      "stream": null,
      "hasBusHandler": true
    },
    {
      "id": "reviews.action",
      "method": "POST",
      "path": "/api/reviews/action",
      "command": "reviews.action",
      "tags": [
        "Review Queue"
      ],
      "projectScoped": true,
      "stream": null,
      "hasBusHandler": true
    },
    {
      "id": "ingest.queue.list",
      "method": "GET",
      "path": "/api/ingest/queue",
      "command": "ingest.queue.list",
      "tags": [
        "Ingestion"
      ],
      "projectScoped": true,
      "stream": null,
      "hasBusHandler": true
    },
    {
      "id": "ingest.queue.add",
      "method": "POST",
      "path": "/api/ingest/queue/add",
      "command": "ingest.queue.add",
      "tags": [
        "Ingestion"
      ],
      "projectScoped": true,
      "stream": null,
      "hasBusHandler": true
    },
    {
      "id": "ingest.queue.process",
      "method": "POST",
      "path": "/api/ingest/queue/process",
      "command": "ingest.queue.process",
      "tags": [
        "Ingestion"
      ],
      "projectScoped": true,
      "stream": "sse",
      "hasBusHandler": true
    },
    {
      "id": "projects.list",
      "method": "GET",
      "path": "/api/projects",
      "command": "projects.list",
      "tags": [
        "Projects"
      ],
      "projectScoped": false,
      "stream": null,
      "hasBusHandler": true
    },
    {
      "id": "projects.create",
      "method": "POST",
      "path": "/api/projects",
      "command": "projects.create",
      "tags": [
        "Projects"
      ],
      "projectScoped": false,
      "stream": null,
      "hasBusHandler": true
    },
    {
      "id": "projects.import",
      "method": "POST",
      "path": "/api/projects/import",
      "command": "projects.import",
      "tags": [
        "Projects"
      ],
      "projectScoped": false,
      "stream": null,
      "hasBusHandler": true
    },
    {
      "id": "projects.clone",
      "method": "POST",
      "path": "/api/projects/:id/clone",
      "command": "projects.clone",
      "tags": [
        "Projects"
      ],
      "projectScoped": false,
      "stream": null,
      "hasBusHandler": true
    },
    {
      "id": "projects.archive",
      "method": "POST",
      "path": "/api/projects/:id/archive",
      "command": "projects.archive",
      "tags": [
        "Projects"
      ],
      "projectScoped": false,
      "stream": null,
      "hasBusHandler": true
    },
    {
      "id": "projects.restore",
      "method": "POST",
      "path": "/api/projects/:id/restore",
      "command": "projects.restore",
      "tags": [
        "Projects"
      ],
      "projectScoped": false,
      "stream": null,
      "hasBusHandler": true
    },
    {
      "id": "projects.export",
      "method": "GET",
      "path": "/api/projects/:id/export",
      "command": "projects.export",
      "tags": [
        "Projects"
      ],
      "projectScoped": false,
      "stream": null,
      "hasBusHandler": true
    },
    {
      "id": "projects.exportMarkdownZip",
      "method": "GET",
      "path": "/api/projects/:id/export/markdown.zip",
      "command": "projects.exportMarkdownZip",
      "tags": [
        "Projects"
      ],
      "projectScoped": true,
      "stream": "binary",
      "hasBusHandler": true
    },
    {
      "id": "projects.stats",
      "method": "GET",
      "path": "/api/projects/:id/stats",
      "command": "projects.stats",
      "tags": [
        "Projects"
      ],
      "projectScoped": false,
      "stream": null,
      "hasBusHandler": true
    },
    {
      "id": "projects.config.get",
      "method": "GET",
      "path": "/api/projects/:id/config",
      "command": "projects.config.get",
      "tags": [
        "Projects"
      ],
      "projectScoped": false,
      "stream": null,
      "hasBusHandler": true
    },
    {
      "id": "projects.config.put",
      "method": "PUT",
      "path": "/api/projects/:id/config",
      "command": "projects.config.put",
      "tags": [
        "Projects"
      ],
      "projectScoped": false,
      "stream": null,
      "hasBusHandler": true
    },
    {
      "id": "projects.rename",
      "method": "PATCH",
      "path": "/api/projects/:id",
      "command": "projects.rename",
      "tags": [
        "Projects"
      ],
      "projectScoped": false,
      "stream": null,
      "hasBusHandler": true
    },
    {
      "id": "projects.delete",
      "method": "DELETE",
      "path": "/api/projects/:id",
      "command": "projects.delete",
      "tags": [
        "Projects"
      ],
      "projectScoped": false,
      "stream": null,
      "hasBusHandler": true
    },
    {
      "id": "changesets.list",
      "method": "GET",
      "path": "/api/v1/changesets",
      "command": "changesets.list",
      "tags": [
        "Changesets"
      ],
      "projectScoped": true,
      "stream": null,
      "hasBusHandler": true
    },
    {
      "id": "changesets.stage",
      "method": "POST",
      "path": "/api/v1/changesets",
      "command": "changesets.stage",
      "tags": [
        "Changesets"
      ],
      "projectScoped": true,
      "stream": null,
      "hasBusHandler": true
    },
    {
      "id": "changesets.get",
      "method": "GET",
      "path": "/api/v1/changesets/:id",
      "command": "changesets.get",
      "tags": [
        "Changesets"
      ],
      "projectScoped": true,
      "stream": null,
      "hasBusHandler": true
    },
    {
      "id": "changesets.apply",
      "method": "POST",
      "path": "/api/v1/changesets/:id/apply",
      "command": "changesets.apply",
      "tags": [
        "Changesets"
      ],
      "projectScoped": true,
      "stream": null,
      "hasBusHandler": true
    },
    {
      "id": "changesets.reject",
      "method": "POST",
      "path": "/api/v1/changesets/:id/reject",
      "command": "changesets.reject",
      "tags": [
        "Changesets"
      ],
      "projectScoped": true,
      "stream": null,
      "hasBusHandler": true
    },
    {
      "id": "schedule.status",
      "method": "GET",
      "path": "/api/ke/schedule",
      "command": "schedule.status",
      "tags": [
        "Scheduler"
      ],
      "projectScoped": false,
      "stream": null,
      "hasBusHandler": true
    },
    {
      "id": "schedule.events",
      "method": "GET",
      "path": "/api/ke/schedule/events",
      "command": "schedule.events",
      "tags": [
        "Scheduler"
      ],
      "projectScoped": false,
      "stream": "sse",
      "hasBusHandler": true
    },
    {
      "id": "schedule.runs",
      "method": "GET",
      "path": "/api/ke/schedule/runs",
      "command": "schedule.runs",
      "tags": [
        "Scheduler"
      ],
      "projectScoped": false,
      "stream": null,
      "hasBusHandler": true
    },
    {
      "id": "schedule.run",
      "method": "POST",
      "path": "/api/ke/schedule/:jobId/run",
      "command": "schedule.run",
      "tags": [
        "Scheduler"
      ],
      "projectScoped": false,
      "stream": "sse",
      "hasBusHandler": true
    },
    {
      "id": "schedule.cancel",
      "method": "POST",
      "path": "/api/ke/schedule/:jobId/cancel",
      "command": "schedule.cancel",
      "tags": [
        "Scheduler"
      ],
      "projectScoped": false,
      "stream": null,
      "hasBusHandler": true
    },
    {
      "id": "schedule.patch",
      "method": "PATCH",
      "path": "/api/ke/schedule/:jobId",
      "command": "schedule.patch",
      "tags": [
        "Scheduler"
      ],
      "projectScoped": false,
      "stream": null,
      "hasBusHandler": true
    },
    {
      "id": "schedule.decisions",
      "method": "GET",
      "path": "/api/ke/schedule/decisions",
      "command": "schedule.decisions",
      "tags": [
        "Scheduler"
      ],
      "projectScoped": false,
      "stream": null,
      "hasBusHandler": true
    },
    {
      "id": "schedule.approvals",
      "method": "GET",
      "path": "/api/ke/schedule/approvals",
      "command": "schedule.approvals",
      "tags": [
        "Scheduler"
      ],
      "projectScoped": false,
      "stream": null,
      "hasBusHandler": true
    },
    {
      "id": "schedule.trigger",
      "method": "POST",
      "path": "/api/ke/schedule/trigger",
      "command": "schedule.trigger",
      "tags": [
        "Scheduler"
      ],
      "projectScoped": false,
      "stream": null,
      "hasBusHandler": true
    },
    {
      "id": "schedule.approvalDecision",
      "method": "POST",
      "path": "/api/ke/schedule/approvals/:id/:action",
      "command": "schedule.approvalDecision",
      "tags": [
        "Scheduler"
      ],
      "projectScoped": false,
      "stream": null,
      "hasBusHandler": true
    },
    {
      "id": "files.download",
      "method": "GET",
      "path": "/api/files/download",
      "command": "files.download",
      "tags": [
        "Files"
      ],
      "projectScoped": true,
      "stream": "binary",
      "hasBusHandler": true
    },
    {
      "id": "review.meta",
      "method": "GET",
      "path": "/api/notes/review/meta",
      "command": "review.meta",
      "tags": [
        "Review Studio"
      ],
      "projectScoped": true,
      "stream": null,
      "hasBusHandler": true
    },
    {
      "id": "review.verify",
      "method": "POST",
      "path": "/api/notes/review/verify",
      "command": "review.verify",
      "tags": [
        "Review Studio"
      ],
      "projectScoped": true,
      "stream": null,
      "hasBusHandler": true
    },
    {
      "id": "review.digest",
      "method": "GET",
      "path": "/api/notes/review/digest",
      "command": "review.digest",
      "tags": [
        "Review Studio"
      ],
      "projectScoped": true,
      "stream": null,
      "hasBusHandler": true
    },
    {
      "id": "review.critique",
      "method": "POST",
      "path": "/api/notes/review/critique",
      "command": "review.critique",
      "tags": [
        "Review Studio"
      ],
      "projectScoped": true,
      "stream": null,
      "hasBusHandler": true
    },
    {
      "id": "review.snapshots",
      "method": "GET",
      "path": "/api/notes/review/snapshots",
      "command": "review.snapshots",
      "tags": [
        "Review Studio"
      ],
      "projectScoped": true,
      "stream": null,
      "hasBusHandler": true
    },
    {
      "id": "review.diff",
      "method": "GET",
      "path": "/api/notes/review/diff",
      "command": "review.diff",
      "tags": [
        "Review Studio"
      ],
      "projectScoped": true,
      "stream": null,
      "hasBusHandler": true
    },
    {
      "id": "review.restore",
      "method": "POST",
      "path": "/api/notes/review/restore",
      "command": "review.restore",
      "tags": [
        "Review Studio"
      ],
      "projectScoped": true,
      "stream": null,
      "hasBusHandler": true
    },
    {
      "id": "research.search",
      "method": "GET",
      "path": "/api/notes/research/search",
      "command": "research.search",
      "tags": [
        "Research Studio"
      ],
      "projectScoped": true,
      "stream": null,
      "hasBusHandler": true
    },
    {
      "id": "research.backlinks",
      "method": "GET",
      "path": "/api/notes/research/backlinks",
      "command": "research.backlinks",
      "tags": [
        "Research Studio"
      ],
      "projectScoped": true,
      "stream": null,
      "hasBusHandler": true
    },
    {
      "id": "research.related",
      "method": "GET",
      "path": "/api/notes/research/related",
      "command": "research.related",
      "tags": [
        "Research Studio"
      ],
      "projectScoped": true,
      "stream": null,
      "hasBusHandler": true
    },
    {
      "id": "research.trace",
      "method": "GET",
      "path": "/api/notes/research/trace",
      "command": "research.trace",
      "tags": [
        "Research Studio"
      ],
      "projectScoped": true,
      "stream": null,
      "hasBusHandler": true
    },
    {
      "id": "research.consult",
      "method": "POST",
      "path": "/api/notes/research/consult",
      "command": "research.consult",
      "tags": [
        "Research Studio"
      ],
      "projectScoped": true,
      "stream": null,
      "hasBusHandler": true
    },
    {
      "id": "research.promoteAnswer",
      "method": "POST",
      "path": "/api/notes/research/promote-answer",
      "command": "research.promoteAnswer",
      "tags": [
        "Research Studio"
      ],
      "projectScoped": true,
      "stream": null,
      "hasBusHandler": true
    },
    {
      "id": "research.deepResearch",
      "method": "POST",
      "path": "/api/notes/research/deep-research",
      "command": "research.deepResearch",
      "tags": [
        "Research Studio"
      ],
      "projectScoped": true,
      "stream": null,
      "hasBusHandler": true
    },
    {
      "id": "study.guide",
      "method": "POST",
      "path": "/api/notes/study/guide",
      "command": "study.guide",
      "tags": [
        "Study Studio"
      ],
      "projectScoped": true,
      "stream": null,
      "hasBusHandler": true
    },
    {
      "id": "study.quiz",
      "method": "POST",
      "path": "/api/notes/study/quiz",
      "command": "study.quiz",
      "tags": [
        "Study Studio"
      ],
      "projectScoped": true,
      "stream": null,
      "hasBusHandler": true
    },
    {
      "id": "study.mindmap",
      "method": "POST",
      "path": "/api/notes/study/mindmap",
      "command": "study.mindmap",
      "tags": [
        "Study Studio"
      ],
      "projectScoped": true,
      "stream": null,
      "hasBusHandler": true
    },
    {
      "id": "study.audioOverview",
      "method": "POST",
      "path": "/api/notes/study/audio-overview",
      "command": "study.audioOverview",
      "tags": [
        "Study Studio"
      ],
      "projectScoped": true,
      "stream": null,
      "hasBusHandler": true
    },
    {
      "id": "study.note",
      "method": "POST",
      "path": "/api/notes/study/note",
      "command": "study.note",
      "tags": [
        "Study Studio"
      ],
      "projectScoped": true,
      "stream": null,
      "hasBusHandler": true
    },
    {
      "id": "study.promoteNote",
      "method": "POST",
      "path": "/api/notes/study/promote-note",
      "command": "study.promoteNote",
      "tags": [
        "Study Studio"
      ],
      "projectScoped": true,
      "stream": null,
      "hasBusHandler": true
    },
    {
      "id": "study.thesisChapter",
      "method": "POST",
      "path": "/api/notes/study/thesis-chapter",
      "command": "study.thesisChapter",
      "tags": [
        "Study Studio"
      ],
      "projectScoped": true,
      "stream": null,
      "hasBusHandler": true
    },
    {
      "id": "wiki.notes.list",
      "method": "GET",
      "path": "/api/wiki/notes",
      "command": "wiki.notes.list",
      "tags": [
        "Vault"
      ],
      "projectScoped": true,
      "stream": null,
      "hasBusHandler": true
    },
    {
      "id": "templates.list",
      "method": "GET",
      "path": "/api/templates",
      "command": "templates.list",
      "tags": [
        "Templates"
      ],
      "projectScoped": false,
      "stream": null,
      "hasBusHandler": true
    },
    {
      "id": "wiki.folders.list",
      "method": "GET",
      "path": "/api/wiki/folders",
      "command": "wiki.folders.list",
      "tags": [
        "Vault"
      ],
      "projectScoped": true,
      "stream": null,
      "hasBusHandler": true
    },
    {
      "id": "wiki.scratchpad.list",
      "method": "GET",
      "path": "/api/wiki/scratchpad",
      "command": "wiki.scratchpad.list",
      "tags": [
        "Vault"
      ],
      "projectScoped": true,
      "stream": null,
      "hasBusHandler": true
    },
    {
      "id": "wiki.scratchpad.delete",
      "method": "POST",
      "path": "/api/wiki/scratchpad/delete",
      "command": "wiki.scratchpad.delete",
      "tags": [
        "Vault"
      ],
      "projectScoped": true,
      "stream": null,
      "hasBusHandler": true
    },
    {
      "id": "wiki.note.save",
      "method": "POST",
      "path": "/api/wiki/save",
      "command": "wiki.note.save",
      "tags": [
        "Vault"
      ],
      "projectScoped": true,
      "stream": null,
      "hasBusHandler": true
    },
    {
      "id": "wiki.note.applyEdit",
      "method": "POST",
      "path": "/api/wiki/apply-edit",
      "command": "wiki.note.applyEdit",
      "tags": [
        "Vault"
      ],
      "projectScoped": true,
      "stream": null,
      "hasBusHandler": true
    },
    {
      "id": "wiki.note.attach",
      "method": "POST",
      "path": "/api/wiki/attach",
      "command": "wiki.note.attach",
      "tags": [
        "Vault"
      ],
      "projectScoped": true,
      "stream": null,
      "hasBusHandler": true
    },
    {
      "id": "chat.send",
      "method": "POST",
      "path": "/api/chat",
      "command": "chat.send",
      "tags": [
        "Chat"
      ],
      "projectScoped": true,
      "stream": null,
      "hasBusHandler": true
    },
    {
      "id": "wiki.folder.create",
      "method": "POST",
      "path": "/api/wiki/folder/create",
      "command": "wiki.folder.create",
      "tags": [
        "Vault"
      ],
      "projectScoped": true,
      "stream": null,
      "hasBusHandler": true
    },
    {
      "id": "wiki.file.create",
      "method": "POST",
      "path": "/api/wiki/file/create",
      "command": "wiki.file.create",
      "tags": [
        "Vault"
      ],
      "projectScoped": true,
      "stream": null,
      "hasBusHandler": true
    },
    {
      "id": "wiki.rename",
      "method": "POST",
      "path": "/api/wiki/rename",
      "command": "wiki.rename",
      "tags": [
        "Vault"
      ],
      "projectScoped": true,
      "stream": null,
      "hasBusHandler": true
    },
    {
      "id": "wiki.move",
      "method": "POST",
      "path": "/api/wiki/move",
      "command": "wiki.move",
      "tags": [
        "Vault"
      ],
      "projectScoped": true,
      "stream": null,
      "hasBusHandler": true
    },
    {
      "id": "wiki.delete",
      "method": "POST",
      "path": "/api/wiki/delete",
      "command": "wiki.delete",
      "tags": [
        "Vault"
      ],
      "projectScoped": true,
      "stream": null,
      "hasBusHandler": true
    },
    {
      "id": "wiki.trash.list",
      "method": "GET",
      "path": "/api/wiki/trash",
      "command": "wiki.trash.list",
      "tags": [
        "Vault"
      ],
      "projectScoped": true,
      "stream": null,
      "hasBusHandler": true
    },
    {
      "id": "wiki.trash.restore",
      "method": "POST",
      "path": "/api/wiki/trash/restore",
      "command": "wiki.trash.restore",
      "tags": [
        "Vault"
      ],
      "projectScoped": true,
      "stream": null,
      "hasBusHandler": true
    },
    {
      "id": "wiki.upload",
      "method": "POST",
      "path": "/api/wiki/upload",
      "command": "wiki.upload",
      "tags": [
        "Vault"
      ],
      "projectScoped": true,
      "stream": null,
      "hasBusHandler": true
    },
    {
      "id": "wiki.ingest",
      "method": "POST",
      "path": "/api/wiki/ingest",
      "command": "wiki.ingest",
      "tags": [
        "Ingestion"
      ],
      "projectScoped": true,
      "stream": null,
      "hasBusHandler": true
    }
  ],
  "busCommands": [
    "auth.login",
    "auth.me",
    "changesets.apply",
    "changesets.get",
    "changesets.list",
    "changesets.reject",
    "changesets.stage",
    "chat.command",
    "chat.send",
    "cmd.adversarial-review",
    "cmd.applica",
    "cmd.apply",
    "cmd.audio-overview",
    "cmd.audit",
    "cmd.backlinks",
    "cmd.compile",
    "cmd.consult",
    "cmd.convert-only",
    "cmd.deep-research",
    "cmd.diff",
    "cmd.digest",
    "cmd.export",
    "cmd.export-semantic",
    "cmd.generate-slides",
    "cmd.help",
    "cmd.human-review",
    "cmd.ingest",
    "cmd.ke-maturity",
    "cmd.lint-frontmatter",
    "cmd.maturity",
    "cmd.merge",
    "cmd.mindmap",
    "cmd.neuro-check",
    "cmd.new-article",
    "cmd.note",
    "cmd.ontology-check",
    "cmd.promote-note",
    "cmd.prune",
    "cmd.quiz",
    "cmd.recompile",
    "cmd.reindex",
    "cmd.related",
    "cmd.retag",
    "cmd.schema-infer",
    "cmd.schema-lint",
    "cmd.search",
    "cmd.skill",
    "cmd.slides",
    "cmd.sources regenerate",
    "cmd.split",
    "cmd.stats",
    "cmd.stub",
    "cmd.study-guide",
    "cmd.suggest-odp",
    "cmd.tag-suggest",
    "cmd.template show",
    "cmd.thesis-chapter",
    "cmd.trace",
    "cmd.validate-cq",
    "cmd.verify",
    "cmd.wizard",
    "docs.openapi",
    "docs.swagger",
    "files.download",
    "graph.clusters",
    "graph.cypher",
    "graph.events",
    "graph.insights",
    "graph.rag",
    "graph.reconcile",
    "graph.status",
    "graph.sync",
    "graph.sync.neo4j",
    "graph.validate",
    "help.get",
    "help.list",
    "ingest.queue.add",
    "ingest.queue.list",
    "ingest.queue.process",
    "ke.useCases.execute",
    "ke.useCases.list",
    "projects.archive",
    "projects.clone",
    "projects.config.get",
    "projects.config.put",
    "projects.create",
    "projects.delete",
    "projects.export",
    "projects.exportMarkdownZip",
    "projects.import",
    "projects.list",
    "projects.rename",
    "projects.restore",
    "projects.stats",
    "research.backlinks",
    "research.consult",
    "research.deepResearch",
    "research.promoteAnswer",
    "research.related",
    "research.search",
    "research.trace",
    "review.critique",
    "review.diff",
    "review.digest",
    "review.meta",
    "review.restore",
    "review.snapshots",
    "review.verify",
    "reviews.action",
    "reviews.add",
    "reviews.list",
    "schedule.approvalDecision",
    "schedule.approvals",
    "schedule.cancel",
    "schedule.decisions",
    "schedule.events",
    "schedule.patch",
    "schedule.run",
    "schedule.runs",
    "schedule.status",
    "schedule.trigger",
    "scripts.execute",
    "scripts.list",
    "scripts.registry",
    "scripts.schedule",
    "scripts.unschedule",
    "skills.list",
    "study.audioOverview",
    "study.guide",
    "study.mindmap",
    "study.note",
    "study.promoteNote",
    "study.quiz",
    "study.thesisChapter",
    "templates.list",
    "ui.access",
    "ui.preferences.get",
    "ui.preferences.put",
    "users.create",
    "users.delete",
    "users.list",
    "users.update",
    "wiki.delete",
    "wiki.file.create",
    "wiki.folder.create",
    "wiki.folders.list",
    "wiki.ingest",
    "wiki.move",
    "wiki.note.applyEdit",
    "wiki.note.attach",
    "wiki.note.save",
    "wiki.notes.list",
    "wiki.rename",
    "wiki.scratchpad.delete",
    "wiki.scratchpad.list",
    "wiki.trash.list",
    "wiki.trash.restore",
    "wiki.upload"
  ],
  "slashCommands": [
    {
      "id": "compile",
      "category": "ingest",
      "verb": "compile",
      "hasImplementation": true
    },
    {
      "id": "convert-only",
      "category": "ingest",
      "verb": "convert-only",
      "hasImplementation": false
    },
    {
      "id": "ingest",
      "category": "ingest",
      "verb": "ingest",
      "hasImplementation": false
    },
    {
      "id": "recompile",
      "category": "ingest",
      "verb": "recompile",
      "hasImplementation": false
    },
    {
      "id": "new-article",
      "category": "curate",
      "verb": "new-article",
      "hasImplementation": false
    },
    {
      "id": "merge",
      "category": "curate",
      "verb": "merge",
      "hasImplementation": false
    },
    {
      "id": "split",
      "category": "curate",
      "verb": "split",
      "hasImplementation": false
    },
    {
      "id": "stub",
      "category": "curate",
      "verb": "stub",
      "hasImplementation": false
    },
    {
      "id": "retag",
      "category": "curate",
      "verb": "retag",
      "hasImplementation": false
    },
    {
      "id": "export-semantic",
      "category": "curate",
      "verb": "export-semantic",
      "hasImplementation": false
    },
    {
      "id": "apply",
      "category": "curate",
      "verb": "apply",
      "hasImplementation": true
    },
    {
      "id": "audit",
      "category": "audit",
      "verb": "audit",
      "hasImplementation": true
    },
    {
      "id": "reindex",
      "category": "audit",
      "verb": "reindex",
      "hasImplementation": true
    },
    {
      "id": "prune",
      "category": "audit",
      "verb": "prune",
      "hasImplementation": false
    },
    {
      "id": "lint-frontmatter",
      "category": "audit",
      "verb": "lint-frontmatter",
      "hasImplementation": false
    },
    {
      "id": "ontology-check",
      "category": "audit",
      "verb": "ontology-check",
      "hasImplementation": false
    },
    {
      "id": "stats",
      "category": "audit",
      "verb": "stats",
      "hasImplementation": false
    },
    {
      "id": "maturity",
      "category": "audit",
      "verb": "maturity",
      "hasImplementation": false
    },
    {
      "id": "adversarial-review",
      "category": "review",
      "verb": "adversarial-review",
      "hasImplementation": false
    },
    {
      "id": "verify",
      "category": "review",
      "verb": "verify",
      "hasImplementation": true
    },
    {
      "id": "human-review",
      "category": "review",
      "verb": "human-review",
      "hasImplementation": true
    },
    {
      "id": "digest",
      "category": "review",
      "verb": "digest",
      "hasImplementation": false
    },
    {
      "id": "diff",
      "category": "review",
      "verb": "diff",
      "hasImplementation": false
    },
    {
      "id": "consult",
      "category": "query",
      "verb": "consult",
      "hasImplementation": true
    },
    {
      "id": "search",
      "category": "query",
      "verb": "search",
      "hasImplementation": false
    },
    {
      "id": "backlinks",
      "category": "query",
      "verb": "backlinks",
      "hasImplementation": false
    },
    {
      "id": "related",
      "category": "query",
      "verb": "related",
      "hasImplementation": false
    },
    {
      "id": "trace",
      "category": "query",
      "verb": "trace",
      "hasImplementation": true
    },
    {
      "id": "deep-research",
      "category": "query",
      "verb": "deep-research",
      "hasImplementation": true
    },
    {
      "id": "study-guide",
      "category": "study",
      "verb": "study-guide",
      "hasImplementation": true
    },
    {
      "id": "quiz",
      "category": "study",
      "verb": "quiz",
      "hasImplementation": true
    },
    {
      "id": "mindmap",
      "category": "study",
      "verb": "mindmap",
      "hasImplementation": true
    },
    {
      "id": "audio-overview",
      "category": "study",
      "verb": "audio-overview",
      "hasImplementation": true
    },
    {
      "id": "note",
      "category": "study",
      "verb": "note",
      "hasImplementation": true
    },
    {
      "id": "promote-note",
      "category": "study",
      "verb": "promote-note",
      "hasImplementation": true
    },
    {
      "id": "thesis-chapter",
      "category": "study",
      "verb": "thesis-chapter",
      "hasImplementation": true
    },
    {
      "id": "schema-lint",
      "category": "ke",
      "verb": "schema-lint",
      "hasImplementation": false
    },
    {
      "id": "schema-infer",
      "category": "ke",
      "verb": "schema-infer",
      "hasImplementation": false
    },
    {
      "id": "validate-cq",
      "category": "ke",
      "verb": "validate-cq",
      "hasImplementation": false
    },
    {
      "id": "suggest-odp",
      "category": "ke",
      "verb": "suggest-odp",
      "hasImplementation": false
    },
    {
      "id": "neuro-check",
      "category": "ke",
      "verb": "neuro-check",
      "hasImplementation": false
    },
    {
      "id": "ke-maturity",
      "category": "ke",
      "verb": "ke-maturity",
      "hasImplementation": false
    },
    {
      "id": "slides",
      "category": "slides",
      "verb": "slides",
      "hasImplementation": false
    },
    {
      "id": "generate-slides",
      "category": "slides",
      "verb": "generate-slides",
      "hasImplementation": false
    },
    {
      "id": "wizard",
      "category": "utility",
      "verb": "wizard",
      "hasImplementation": true
    },
    {
      "id": "skill",
      "category": "utility",
      "verb": "skill",
      "hasImplementation": true
    },
    {
      "id": "export",
      "category": "utility",
      "verb": "export",
      "hasImplementation": false
    },
    {
      "id": "template show",
      "category": "utility",
      "verb": "template",
      "hasImplementation": false
    },
    {
      "id": "sources regenerate",
      "category": "utility",
      "verb": "sources",
      "hasImplementation": false
    },
    {
      "id": "tag-suggest",
      "category": "utility",
      "verb": "tag-suggest",
      "hasImplementation": false
    },
    {
      "id": "help",
      "category": "utility",
      "verb": "help",
      "hasImplementation": true
    }
  ],
  "implementedSlashCommands": [
    "applica",
    "apply",
    "audio-overview",
    "audit",
    "compile",
    "consult",
    "deep-research",
    "help",
    "human-review",
    "mindmap",
    "note",
    "promote-note",
    "quiz",
    "reindex",
    "skill",
    "study-guide",
    "thesis-chapter",
    "trace",
    "verify",
    "wizard"
  ],
  "mcpTools": [
    {
      "name": "wf_docs_openapi",
      "operationId": "docs.openapi",
      "description": "Get the merged OpenAPI 3.1 specification · GET /api/openapi.json",
      "inputSchema": {
        "type": "object",
        "properties": {
          "params": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "query": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "headers": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "body": {
            "type": "object",
            "additionalProperties": true
          }
        },
        "additionalProperties": false
      },
      "mutating": false,
      "legacy": false
    },
    {
      "name": "wf_docs_swagger",
      "operationId": "docs.swagger",
      "description": "Open the self-hosted Swagger UI browser · GET /api/docs",
      "inputSchema": {
        "type": "object",
        "properties": {
          "params": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "query": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "headers": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "body": {
            "type": "object",
            "additionalProperties": true
          }
        },
        "additionalProperties": false
      },
      "mutating": false,
      "legacy": false
    },
    {
      "name": "wf_auth_me",
      "operationId": "auth.me",
      "description": "Resolve the server-derived identity of the current request · GET /api/auth/me",
      "inputSchema": {
        "type": "object",
        "properties": {
          "params": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "query": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "headers": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "body": {
            "type": "object",
            "additionalProperties": true
          }
        },
        "additionalProperties": false
      },
      "mutating": false,
      "legacy": false
    },
    {
      "name": "wf_auth_login",
      "operationId": "auth.login",
      "description": "Sign in with a server-side user account · POST /api/auth/login",
      "inputSchema": {
        "type": "object",
        "properties": {
          "params": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "query": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "headers": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "body": {
            "type": "object",
            "properties": {
              "username": {
                "type": "string"
              },
              "password": {
                "type": "string"
              }
            },
            "required": [
              "username",
              "password"
            ],
            "description": "User credentials"
          }
        },
        "additionalProperties": false
      },
      "mutating": true,
      "legacy": false
    },
    {
      "name": "wf_users_list",
      "operationId": "users.list",
      "description": "List server-side user accounts · GET /api/users",
      "inputSchema": {
        "type": "object",
        "properties": {
          "params": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "query": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "headers": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "body": {
            "type": "object",
            "additionalProperties": true
          }
        },
        "additionalProperties": false
      },
      "mutating": false,
      "legacy": false
    },
    {
      "name": "wf_users_create",
      "operationId": "users.create",
      "description": "Create a server-side user account · POST /api/users",
      "inputSchema": {
        "type": "object",
        "properties": {
          "params": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "query": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "headers": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "body": {
            "type": "object",
            "properties": {
              "username": {
                "type": "string"
              },
              "password": {
                "type": "string"
              },
              "roles": {
                "type": "array",
                "items": {
                  "type": "string",
                  "description": "Canonical RBAC role"
                }
              },
              "active": {
                "type": "boolean"
              }
            },
            "required": [
              "username",
              "password",
              "roles"
            ],
            "description": "New user"
          }
        },
        "additionalProperties": false
      },
      "mutating": true,
      "legacy": false
    },
    {
      "name": "wf_users_update",
      "operationId": "users.update",
      "description": "Update roles, status or password of a server-side user · PATCH /api/users/:id",
      "inputSchema": {
        "type": "object",
        "properties": {
          "params": {
            "type": "object",
            "properties": {
              "id": {
                "type": "string"
              }
            },
            "required": [
              "id"
            ],
            "additionalProperties": false
          },
          "query": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "headers": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "body": {
            "type": "object",
            "properties": {
              "roles": {
                "type": "array",
                "items": {
                  "type": "string",
                  "description": "Canonical RBAC role"
                }
              },
              "active": {
                "type": "boolean"
              },
              "password": {
                "type": "string"
              }
            },
            "required": [],
            "description": "User changes"
          }
        },
        "additionalProperties": false
      },
      "mutating": true,
      "legacy": false
    },
    {
      "name": "wf_users_delete",
      "operationId": "users.delete",
      "description": "Delete a server-side user account · DELETE /api/users/:id",
      "inputSchema": {
        "type": "object",
        "properties": {
          "params": {
            "type": "object",
            "properties": {
              "id": {
                "type": "string"
              }
            },
            "required": [
              "id"
            ],
            "additionalProperties": false
          },
          "query": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "headers": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "body": {
            "type": "object",
            "additionalProperties": true
          }
        },
        "additionalProperties": false
      },
      "mutating": true,
      "legacy": false
    },
    {
      "name": "wf_ui_access",
      "operationId": "ui.access",
      "description": "Resolve the permission-aware UI view model for the current caller · GET /api/ui/access",
      "inputSchema": {
        "type": "object",
        "properties": {
          "params": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "query": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "headers": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "body": {
            "type": "object",
            "additionalProperties": true
          }
        },
        "additionalProperties": false
      },
      "mutating": false,
      "legacy": false
    },
    {
      "name": "wf_ui_preferences_get",
      "operationId": "ui.preferences.get",
      "description": "Read the presentation preferences of the current caller · GET /api/ui/preferences",
      "inputSchema": {
        "type": "object",
        "properties": {
          "params": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "query": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "headers": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "body": {
            "type": "object",
            "additionalProperties": true
          }
        },
        "additionalProperties": false
      },
      "mutating": false,
      "legacy": false
    },
    {
      "name": "wf_ui_preferences_put",
      "operationId": "ui.preferences.put",
      "description": "Save the presentation preferences of the current caller · PUT /api/ui/preferences",
      "inputSchema": {
        "type": "object",
        "properties": {
          "params": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "query": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "headers": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "body": {
            "type": "object",
            "additionalProperties": true
          }
        },
        "additionalProperties": false
      },
      "mutating": true,
      "legacy": false
    },
    {
      "name": "wf_graph_sync",
      "operationId": "graph.sync",
      "description": "Convert wiki notes to an RDF/Turtle knowledge graph · POST /api/v1/graph/sync",
      "inputSchema": {
        "type": "object",
        "properties": {
          "params": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "query": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "headers": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "body": {
            "type": "object",
            "properties": {
              "wiki_dir": {
                "type": "string",
                "description": "Default: wiki"
              },
              "output_ttl": {
                "type": "string",
                "description": "Default: knowledge_graph.ttl"
              }
            },
            "required": [],
            "description": "Sync request"
          }
        },
        "additionalProperties": false
      },
      "mutating": true,
      "legacy": false
    },
    {
      "name": "wf_graph_validate",
      "operationId": "graph.validate",
      "description": "Validate the RDF graph against W3C SHACL shapes · POST /api/v1/graph/validate",
      "inputSchema": {
        "type": "object",
        "properties": {
          "params": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "query": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "headers": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "body": {
            "type": "object",
            "properties": {
              "graph_path": {
                "type": "string",
                "description": "Default: knowledge_graph.ttl"
              },
              "shapes_path": {
                "type": "string",
                "description": "Default: src/backend/wikiforge/config/shapes.ttl"
              }
            },
            "required": [],
            "description": "Validation request"
          }
        },
        "additionalProperties": false
      },
      "mutating": true,
      "legacy": false
    },
    {
      "name": "wf_graph_rag",
      "operationId": "graph.rag",
      "description": "Run the stateful GraphRAG pipeline on a question · POST /api/v1/graph/rag",
      "inputSchema": {
        "type": "object",
        "properties": {
          "params": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "query": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "headers": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "body": {
            "type": "object",
            "properties": {
              "question": {
                "type": "string"
              }
            },
            "required": [
              "question"
            ],
            "description": "RAG query"
          }
        },
        "additionalProperties": false
      },
      "mutating": true,
      "legacy": false
    },
    {
      "name": "wf_graph_clusters",
      "operationId": "graph.clusters",
      "description": "Compute Louvain communities over the wiki graph · GET /api/v1/graph/clusters",
      "inputSchema": {
        "type": "object",
        "properties": {
          "params": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "query": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "headers": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "body": {
            "type": "object",
            "additionalProperties": true
          }
        },
        "additionalProperties": false
      },
      "mutating": false,
      "legacy": false
    },
    {
      "name": "wf_graph_insights",
      "operationId": "graph.insights",
      "description": "Report surprising connections and knowledge gaps · GET /api/v1/graph/insights",
      "inputSchema": {
        "type": "object",
        "properties": {
          "params": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "query": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "headers": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "body": {
            "type": "object",
            "additionalProperties": true
          }
        },
        "additionalProperties": false
      },
      "mutating": false,
      "legacy": false
    },
    {
      "name": "wf_graph_cypher",
      "operationId": "graph.cypher",
      "description": "Execute one validated read-only Cypher query · POST /api/v1/graph/cypher",
      "inputSchema": {
        "type": "object",
        "properties": {
          "params": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "query": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "headers": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "body": {
            "type": "object",
            "properties": {
              "cypher": {
                "type": "string",
                "description": "A single MATCH / OPTIONAL MATCH statement with RETURN"
              },
              "params": {
                "type": "object",
                "additionalProperties": true,
                "description": "Cypher parameter map; values are bound by name"
              },
              "projectId": {
                "type": "string",
                "description": "Optional project id selecting the configured Neo4j database"
              }
            },
            "required": [
              "cypher"
            ],
            "description": "Read-only Cypher request"
          }
        },
        "additionalProperties": false
      },
      "mutating": true,
      "legacy": false
    },
    {
      "name": "wf_graph_sync_neo4j",
      "operationId": "graph.sync.neo4j",
      "description": "Synchronize a project wiki into Neo4j · POST /api/v1/graph/sync/neo4j",
      "inputSchema": {
        "type": "object",
        "properties": {
          "params": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "query": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "headers": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "body": {
            "type": "object",
            "properties": {
              "projectId": {
                "type": "string",
                "description": "Optional project id; defaults to X-Project-Id"
              }
            },
            "required": [],
            "description": "Neo4j sync request"
          }
        },
        "additionalProperties": false
      },
      "mutating": true,
      "legacy": false
    },
    {
      "name": "wf_graph_status",
      "operationId": "graph.status",
      "description": "Report Neo4j configuration without connecting · GET /api/v1/graph/status",
      "inputSchema": {
        "type": "object",
        "properties": {
          "params": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "query": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "headers": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "body": {
            "type": "object",
            "additionalProperties": true
          }
        },
        "additionalProperties": false
      },
      "mutating": false,
      "legacy": false
    },
    {
      "name": "wf_graph_events",
      "operationId": "graph.events",
      "description": "Subscribe to graph change events (SSE) · GET /api/v1/graph/events",
      "inputSchema": {
        "type": "object",
        "properties": {
          "params": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "query": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "headers": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "body": {
            "type": "object",
            "additionalProperties": true
          }
        },
        "additionalProperties": false
      },
      "mutating": false,
      "legacy": false
    },
    {
      "name": "wf_graph_reconcile",
      "operationId": "graph.reconcile",
      "description": "Reconcile Neo4j revisions into reviewable changesets · POST /api/v1/graph/reconcile",
      "inputSchema": {
        "type": "object",
        "properties": {
          "params": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "query": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "headers": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "body": {
            "type": "object",
            "properties": {
              "projectId": {
                "type": "string",
                "description": "Accepted for compatibility; staging always uses X-Project-Id"
              }
            },
            "required": [],
            "description": "Reconcile request"
          }
        },
        "additionalProperties": false
      },
      "mutating": true,
      "legacy": false
    },
    {
      "name": "wf_skills_list",
      "operationId": "skills.list",
      "description": "List installed agent skill packages · GET /api/skills",
      "inputSchema": {
        "type": "object",
        "properties": {
          "params": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "query": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "headers": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "body": {
            "type": "object",
            "additionalProperties": true
          }
        },
        "additionalProperties": false
      },
      "mutating": false,
      "legacy": false
    },
    {
      "name": "wf_help_list",
      "operationId": "help.list",
      "description": "List in-app help topics · GET /api/help",
      "inputSchema": {
        "type": "object",
        "properties": {
          "params": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "query": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "headers": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "body": {
            "type": "object",
            "additionalProperties": true
          }
        },
        "additionalProperties": false
      },
      "mutating": false,
      "legacy": false
    },
    {
      "name": "wf_help_get",
      "operationId": "help.get",
      "description": "Get one help topic with Markdown body · GET /api/help/:topicId",
      "inputSchema": {
        "type": "object",
        "properties": {
          "params": {
            "type": "object",
            "properties": {
              "topicId": {
                "type": "string"
              }
            },
            "required": [
              "topicId"
            ],
            "additionalProperties": false
          },
          "query": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "headers": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "body": {
            "type": "object",
            "additionalProperties": true
          }
        },
        "additionalProperties": false
      },
      "mutating": false,
      "legacy": false
    },
    {
      "name": "wf_scripts_list",
      "operationId": "scripts.list",
      "description": "List executable Python scripts generated from SCRIPT_SCHEMAS · GET /api/scripts/list",
      "inputSchema": {
        "type": "object",
        "properties": {
          "params": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "query": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "headers": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "body": {
            "type": "object",
            "additionalProperties": true
          }
        },
        "additionalProperties": false
      },
      "mutating": false,
      "legacy": false
    },
    {
      "name": "wf_scripts_registry",
      "operationId": "scripts.registry",
      "description": "Alias of GET /api/scripts/list kept for older tools · GET /api/scripts/registry",
      "inputSchema": {
        "type": "object",
        "properties": {
          "params": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "query": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "headers": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "body": {
            "type": "object",
            "additionalProperties": true
          }
        },
        "additionalProperties": false
      },
      "mutating": false,
      "legacy": false
    },
    {
      "name": "wf_scripts_schedule",
      "operationId": "scripts.schedule",
      "description": "Create a persisted script job and activate it immediately (S3) · POST /api/scripts/schedule",
      "inputSchema": {
        "type": "object",
        "properties": {
          "params": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "query": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "headers": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "body": {
            "type": "object",
            "properties": {
              "id": {
                "type": "string",
                "description": "Stable job id (letters, digits, dot, dash or underscore)"
              },
              "scriptId": {
                "type": "string",
                "description": "Script id from /api/scripts/list"
              },
              "schedule": {
                "type": "string",
                "description": "Optional 5-field cron expression; defaults to the catalog value"
              },
              "args": {
                "type": "object",
                "additionalProperties": true,
                "description": "Optional script argument overrides"
              },
              "project": {
                "type": "string",
                "description": "Project id, default \"default\""
              },
              "role": {
                "type": "string",
                "description": "Optional job role"
              },
              "enabled": {
                "type": "boolean",
                "description": "Mutating scripts are forced to false"
              },
              "eventTrigger": {
                "type": "string",
                "description": "Optional note.created | note.modified | note.deleted trigger"
              },
              "debounceSeconds": {
                "type": "integer",
                "description": "Event debounce in seconds (1–3600)"
              },
              "maxRetries": {
                "type": "integer",
                "description": "Retries 0–5, default 1"
              }
            },
            "required": [
              "id",
              "scriptId"
            ],
            "description": "Script job to schedule"
          }
        },
        "additionalProperties": false
      },
      "mutating": true,
      "legacy": false
    },
    {
      "name": "wf_scripts_unschedule",
      "operationId": "scripts.unschedule",
      "description": "Remove a persisted script job and deactivate it immediately (S3) · DELETE /api/scripts/schedule/:jobId",
      "inputSchema": {
        "type": "object",
        "properties": {
          "params": {
            "type": "object",
            "properties": {
              "jobId": {
                "type": "string"
              }
            },
            "required": [
              "jobId"
            ],
            "additionalProperties": false
          },
          "query": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "headers": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "body": {
            "type": "object",
            "additionalProperties": true
          }
        },
        "additionalProperties": false
      },
      "mutating": true,
      "legacy": false
    },
    {
      "name": "wf_scripts_execute",
      "operationId": "scripts.execute",
      "description": "Execute a Python script and stream stdout/stderr as SSE · POST /api/scripts/execute",
      "inputSchema": {
        "type": "object",
        "properties": {
          "params": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "query": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "headers": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "body": {
            "type": "object",
            "properties": {
              "scriptId": {
                "type": "string",
                "description": "Script id from /api/scripts/list"
              },
              "script": {
                "type": "string",
                "description": "Legacy alias of scriptId"
              },
              "args": {
                "type": "object",
                "additionalProperties": true,
                "description": "Arguments validated against the script schema"
              },
              "projectId": {
                "type": "string",
                "description": "Fallback when no X-Project-Id header is sent"
              }
            },
            "required": [],
            "description": "Script execution request"
          }
        },
        "additionalProperties": false
      },
      "mutating": true,
      "legacy": false
    },
    {
      "name": "wf_ke_useCases_list",
      "operationId": "ke.useCases.list",
      "description": "List the 8 Knowledge Engineering Use Cases · GET /api/ke/use-cases",
      "inputSchema": {
        "type": "object",
        "properties": {
          "params": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "query": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "headers": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "body": {
            "type": "object",
            "additionalProperties": true
          }
        },
        "additionalProperties": false
      },
      "mutating": false,
      "legacy": false
    },
    {
      "name": "wf_ke_useCases_execute",
      "operationId": "ke.useCases.execute",
      "description": "Execute a KE Use Case and stream its step events · POST /api/ke/use-cases/execute",
      "inputSchema": {
        "type": "object",
        "properties": {
          "params": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "query": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "headers": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "body": {
            "type": "object",
            "properties": {
              "useCaseId": {
                "type": "string"
              },
              "stepIndex": {
                "type": "integer",
                "description": "Execute a single step (0-based)"
              },
              "args": {
                "type": "object",
                "additionalProperties": true
              },
              "projectId": {
                "type": "string",
                "description": "Fallback when no X-Project-Id header is sent"
              }
            },
            "required": [
              "useCaseId"
            ],
            "description": "Use Case execution request"
          }
        },
        "additionalProperties": false
      },
      "mutating": true,
      "legacy": false
    },
    {
      "name": "wf_reviews_list",
      "operationId": "reviews.list",
      "description": "List pending review items from .llm-wiki/reviews.json · GET /api/reviews",
      "inputSchema": {
        "type": "object",
        "properties": {
          "params": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "query": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "headers": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "body": {
            "type": "object",
            "additionalProperties": true
          }
        },
        "additionalProperties": false
      },
      "mutating": false,
      "legacy": false
    },
    {
      "name": "wf_reviews_add",
      "operationId": "reviews.add",
      "description": "Add a review item · POST /api/reviews/add",
      "inputSchema": {
        "type": "object",
        "properties": {
          "params": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "query": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "headers": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "body": {
            "type": "object",
            "properties": {
              "title": {
                "type": "string"
              },
              "sourceFile": {
                "type": "string"
              },
              "recommendedAction": {
                "type": "string"
              },
              "reason": {
                "type": "string"
              }
            },
            "required": [
              "title",
              "sourceFile"
            ],
            "description": "Review item"
          }
        },
        "additionalProperties": false
      },
      "mutating": true,
      "legacy": false
    },
    {
      "name": "wf_reviews_action",
      "operationId": "reviews.action",
      "description": "Approve or reject (remove) a review item · POST /api/reviews/action",
      "inputSchema": {
        "type": "object",
        "properties": {
          "params": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "query": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "headers": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "body": {
            "type": "object",
            "properties": {
              "id": {
                "type": "string"
              },
              "action": {
                "type": "string",
                "description": "approve | reject",
                "enum": [
                  "approve",
                  "reject"
                ]
              }
            },
            "required": [
              "id",
              "action"
            ]
          }
        },
        "additionalProperties": false
      },
      "mutating": true,
      "legacy": false
    },
    {
      "name": "wf_ingest_queue_list",
      "operationId": "ingest.queue.list",
      "description": "List the SQLite ingestion queue · GET /api/ingest/queue",
      "inputSchema": {
        "type": "object",
        "properties": {
          "params": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "query": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "headers": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "body": {
            "type": "object",
            "additionalProperties": true
          }
        },
        "additionalProperties": false
      },
      "mutating": false,
      "legacy": false
    },
    {
      "name": "wf_ingest_queue_add",
      "operationId": "ingest.queue.add",
      "description": "Enqueue a raw file for conversion · POST /api/ingest/queue/add",
      "inputSchema": {
        "type": "object",
        "properties": {
          "params": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "query": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "headers": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "body": {
            "type": "object",
            "properties": {
              "filePath": {
                "type": "string",
                "description": "Path relative to the project root"
              }
            },
            "required": [
              "filePath"
            ]
          }
        },
        "additionalProperties": false
      },
      "mutating": true,
      "legacy": false
    },
    {
      "name": "wf_ingest_queue_process",
      "operationId": "ingest.queue.process",
      "description": "Process the queue with two-step CoT conversion (SSE) · POST /api/ingest/queue/process",
      "inputSchema": {
        "type": "object",
        "properties": {
          "params": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "query": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "headers": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "body": {
            "type": "object",
            "additionalProperties": true
          }
        },
        "additionalProperties": false
      },
      "mutating": true,
      "legacy": false
    },
    {
      "name": "wf_projects_list",
      "operationId": "projects.list",
      "description": "List projects in the workspace · GET /api/projects",
      "inputSchema": {
        "type": "object",
        "properties": {
          "params": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "query": {
            "type": "object",
            "properties": {
              "includeArchived": {
                "type": "boolean",
                "description": "Include archived projects"
              }
            },
            "additionalProperties": false
          },
          "headers": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "body": {
            "type": "object",
            "additionalProperties": true
          }
        },
        "additionalProperties": false
      },
      "mutating": false,
      "legacy": false
    },
    {
      "name": "wf_projects_create",
      "operationId": "projects.create",
      "description": "Create and scaffold a project · POST /api/projects",
      "inputSchema": {
        "type": "object",
        "properties": {
          "params": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "query": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "headers": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "body": {
            "type": "object",
            "properties": {
              "id": {
                "type": "string"
              },
              "name": {
                "type": "string"
              }
            },
            "required": [
              "id",
              "name"
            ]
          }
        },
        "additionalProperties": false
      },
      "mutating": true,
      "legacy": false
    },
    {
      "name": "wf_projects_import",
      "operationId": "projects.import",
      "description": "Import a project bundle · POST /api/projects/import",
      "inputSchema": {
        "type": "object",
        "properties": {
          "params": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "query": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "headers": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "body": {
            "type": "object",
            "additionalProperties": true,
            "description": "ProjectBundle, optionally wrapped in a `bundle` property"
          }
        },
        "additionalProperties": false
      },
      "mutating": true,
      "legacy": false
    },
    {
      "name": "wf_projects_clone",
      "operationId": "projects.clone",
      "description": "Clone a project with optional content includes · POST /api/projects/:id/clone",
      "inputSchema": {
        "type": "object",
        "properties": {
          "params": {
            "type": "object",
            "properties": {
              "id": {
                "type": "string"
              }
            },
            "required": [
              "id"
            ],
            "additionalProperties": false
          },
          "query": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "headers": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "body": {
            "type": "object",
            "properties": {
              "id": {
                "type": "string",
                "description": "New project id"
              },
              "name": {
                "type": "string"
              },
              "include": {
                "type": "object",
                "additionalProperties": true,
                "description": "Directory include flags"
              }
            },
            "required": [
              "id"
            ]
          }
        },
        "additionalProperties": false
      },
      "mutating": true,
      "legacy": false
    },
    {
      "name": "wf_projects_archive",
      "operationId": "projects.archive",
      "description": "Archive a project under .wiki-forge/archive/ · POST /api/projects/:id/archive",
      "inputSchema": {
        "type": "object",
        "properties": {
          "params": {
            "type": "object",
            "properties": {
              "id": {
                "type": "string"
              }
            },
            "required": [
              "id"
            ],
            "additionalProperties": false
          },
          "query": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "headers": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "body": {
            "type": "object",
            "additionalProperties": true
          }
        },
        "additionalProperties": false
      },
      "mutating": true,
      "legacy": false
    },
    {
      "name": "wf_projects_restore",
      "operationId": "projects.restore",
      "description": "Restore an archived project · POST /api/projects/:id/restore",
      "inputSchema": {
        "type": "object",
        "properties": {
          "params": {
            "type": "object",
            "properties": {
              "id": {
                "type": "string"
              }
            },
            "required": [
              "id"
            ],
            "additionalProperties": false
          },
          "query": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "headers": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "body": {
            "type": "object",
            "additionalProperties": true
          }
        },
        "additionalProperties": false
      },
      "mutating": true,
      "legacy": false
    },
    {
      "name": "wf_projects_export",
      "operationId": "projects.export",
      "description": "Export a project as a JSON bundle · GET /api/projects/:id/export",
      "inputSchema": {
        "type": "object",
        "properties": {
          "params": {
            "type": "object",
            "properties": {
              "id": {
                "type": "string"
              }
            },
            "required": [
              "id"
            ],
            "additionalProperties": false
          },
          "query": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "headers": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "body": {
            "type": "object",
            "additionalProperties": true
          }
        },
        "additionalProperties": false
      },
      "mutating": false,
      "legacy": false
    },
    {
      "name": "wf_projects_exportMarkdownZip",
      "operationId": "projects.exportMarkdownZip",
      "description": "Export the project wiki as a ZIP of Markdown files · GET /api/projects/:id/export/markdown.zip",
      "inputSchema": {
        "type": "object",
        "properties": {
          "params": {
            "type": "object",
            "properties": {
              "id": {
                "type": "string"
              }
            },
            "required": [
              "id"
            ],
            "additionalProperties": false
          },
          "query": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "headers": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "body": {
            "type": "object",
            "additionalProperties": true
          }
        },
        "additionalProperties": false
      },
      "mutating": false,
      "legacy": false
    },
    {
      "name": "wf_projects_stats",
      "operationId": "projects.stats",
      "description": "Get note, source and asset counts for a project · GET /api/projects/:id/stats",
      "inputSchema": {
        "type": "object",
        "properties": {
          "params": {
            "type": "object",
            "properties": {
              "id": {
                "type": "string"
              }
            },
            "required": [
              "id"
            ],
            "additionalProperties": false
          },
          "query": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "headers": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "body": {
            "type": "object",
            "additionalProperties": true
          }
        },
        "additionalProperties": false
      },
      "mutating": false,
      "legacy": false
    },
    {
      "name": "wf_projects_config_get",
      "operationId": "projects.config.get",
      "description": "Read a project config.toml as JSON · GET /api/projects/:id/config",
      "inputSchema": {
        "type": "object",
        "properties": {
          "params": {
            "type": "object",
            "properties": {
              "id": {
                "type": "string"
              }
            },
            "required": [
              "id"
            ],
            "additionalProperties": false
          },
          "query": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "headers": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "body": {
            "type": "object",
            "additionalProperties": true
          }
        },
        "additionalProperties": false
      },
      "mutating": false,
      "legacy": false
    },
    {
      "name": "wf_projects_config_put",
      "operationId": "projects.config.put",
      "description": "Merge sections into a project config.toml · PUT /api/projects/:id/config",
      "inputSchema": {
        "type": "object",
        "properties": {
          "params": {
            "type": "object",
            "properties": {
              "id": {
                "type": "string"
              }
            },
            "required": [
              "id"
            ],
            "additionalProperties": false
          },
          "query": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "headers": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "body": {
            "type": "object",
            "additionalProperties": true,
            "description": "Partial config object"
          }
        },
        "additionalProperties": false
      },
      "mutating": true,
      "legacy": false
    },
    {
      "name": "wf_projects_rename",
      "operationId": "projects.rename",
      "description": "Rename a project display name · PATCH /api/projects/:id",
      "inputSchema": {
        "type": "object",
        "properties": {
          "params": {
            "type": "object",
            "properties": {
              "id": {
                "type": "string"
              }
            },
            "required": [
              "id"
            ],
            "additionalProperties": false
          },
          "query": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "headers": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "body": {
            "type": "object",
            "properties": {
              "name": {
                "type": "string"
              }
            },
            "required": [
              "name"
            ]
          }
        },
        "additionalProperties": false
      },
      "mutating": true,
      "legacy": false
    },
    {
      "name": "wf_projects_delete",
      "operationId": "projects.delete",
      "description": "Unregister, trash or permanently delete a project · DELETE /api/projects/:id",
      "inputSchema": {
        "type": "object",
        "properties": {
          "params": {
            "type": "object",
            "properties": {
              "id": {
                "type": "string"
              }
            },
            "required": [
              "id"
            ],
            "additionalProperties": false
          },
          "query": {
            "type": "object",
            "properties": {
              "mode": {
                "type": "string",
                "description": "unregister | trash | permanent",
                "enum": [
                  "unregister",
                  "trash",
                  "permanent"
                ]
              },
              "deleteFolder": {
                "type": "boolean"
              },
              "confirm": {
                "type": "string"
              }
            },
            "additionalProperties": false
          },
          "headers": {
            "type": "object",
            "properties": {
              "X-Confirm-Token": {
                "type": "string"
              }
            },
            "additionalProperties": false
          },
          "body": {
            "type": "object",
            "additionalProperties": true
          }
        },
        "additionalProperties": false
      },
      "mutating": true,
      "legacy": false
    },
    {
      "name": "wf_changesets_list",
      "operationId": "changesets.list",
      "description": "List staged changesets · GET /api/v1/changesets",
      "inputSchema": {
        "type": "object",
        "properties": {
          "params": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "query": {
            "type": "object",
            "properties": {
              "status": {
                "type": "string",
                "description": "pending | applied | rejected",
                "enum": [
                  "pending",
                  "applied",
                  "rejected"
                ]
              }
            },
            "additionalProperties": false
          },
          "headers": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "body": {
            "type": "object",
            "additionalProperties": true
          }
        },
        "additionalProperties": false
      },
      "mutating": false,
      "legacy": false
    },
    {
      "name": "wf_changesets_stage",
      "operationId": "changesets.stage",
      "description": "Stage proposed edits without touching the wiki · POST /api/v1/changesets",
      "inputSchema": {
        "type": "object",
        "properties": {
          "params": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "query": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "headers": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "body": {
            "type": "object",
            "properties": {
              "description": {
                "type": "string"
              },
              "rationale": {
                "type": "string"
              },
              "sources": {
                "type": "array",
                "items": {
                  "type": "string"
                }
              },
              "edits": {
                "type": "array",
                "items": {
                  "type": "object",
                  "additionalProperties": true,
                  "description": "path plus find/replace or proposed_content"
                },
                "description": "Edits to stage"
              }
            },
            "required": [
              "description",
              "edits"
            ],
            "description": "Changeset proposal"
          }
        },
        "additionalProperties": false
      },
      "mutating": true,
      "legacy": false
    },
    {
      "name": "wf_changesets_get",
      "operationId": "changesets.get",
      "description": "Get one changeset · GET /api/v1/changesets/:id",
      "inputSchema": {
        "type": "object",
        "properties": {
          "params": {
            "type": "object",
            "properties": {
              "id": {
                "type": "string"
              }
            },
            "required": [
              "id"
            ],
            "additionalProperties": false
          },
          "query": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "headers": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "body": {
            "type": "object",
            "additionalProperties": true
          }
        },
        "additionalProperties": false
      },
      "mutating": false,
      "legacy": false
    },
    {
      "name": "wf_changesets_apply",
      "operationId": "changesets.apply",
      "description": "Apply a reviewed changeset (atomic; deletes go through trash) · POST /api/v1/changesets/:id/apply",
      "inputSchema": {
        "type": "object",
        "properties": {
          "params": {
            "type": "object",
            "properties": {
              "id": {
                "type": "string"
              }
            },
            "required": [
              "id"
            ],
            "additionalProperties": false
          },
          "query": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "headers": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "body": {
            "type": "object",
            "additionalProperties": true
          }
        },
        "additionalProperties": false
      },
      "mutating": true,
      "legacy": false
    },
    {
      "name": "wf_changesets_reject",
      "operationId": "changesets.reject",
      "description": "Reject a changeset with an optional reason · POST /api/v1/changesets/:id/reject",
      "inputSchema": {
        "type": "object",
        "properties": {
          "params": {
            "type": "object",
            "properties": {
              "id": {
                "type": "string"
              }
            },
            "required": [
              "id"
            ],
            "additionalProperties": false
          },
          "query": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "headers": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "body": {
            "type": "object",
            "properties": {
              "reason": {
                "type": "string"
              }
            },
            "required": [],
            "description": "Rejection reason"
          }
        },
        "additionalProperties": false
      },
      "mutating": true,
      "legacy": false
    },
    {
      "name": "wf_schedule_status",
      "operationId": "schedule.status",
      "description": "Get scheduler config, validation errors and live snapshot · GET /api/ke/schedule",
      "inputSchema": {
        "type": "object",
        "properties": {
          "params": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "query": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "headers": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "body": {
            "type": "object",
            "additionalProperties": true
          }
        },
        "additionalProperties": false
      },
      "mutating": false,
      "legacy": false
    },
    {
      "name": "wf_schedule_events",
      "operationId": "schedule.events",
      "description": "Subscribe to the live scheduler event stream (SSE) · GET /api/ke/schedule/events",
      "inputSchema": {
        "type": "object",
        "properties": {
          "params": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "query": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "headers": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "body": {
            "type": "object",
            "additionalProperties": true
          }
        },
        "additionalProperties": false
      },
      "mutating": false,
      "legacy": false
    },
    {
      "name": "wf_schedule_runs",
      "operationId": "schedule.runs",
      "description": "Read the scheduler audit log (newest first) · GET /api/ke/schedule/runs",
      "inputSchema": {
        "type": "object",
        "properties": {
          "params": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "query": {
            "type": "object",
            "properties": {
              "jobId": {
                "type": "string"
              },
              "limit": {
                "type": "integer",
                "description": "1–1000, default 100"
              }
            },
            "additionalProperties": false
          },
          "headers": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "body": {
            "type": "object",
            "additionalProperties": true
          }
        },
        "additionalProperties": false
      },
      "mutating": false,
      "legacy": false
    },
    {
      "name": "wf_schedule_run",
      "operationId": "schedule.run",
      "description": "Run a scheduled job now and stream its events (SSE) · POST /api/ke/schedule/:jobId/run",
      "inputSchema": {
        "type": "object",
        "properties": {
          "params": {
            "type": "object",
            "properties": {
              "jobId": {
                "type": "string"
              }
            },
            "required": [
              "jobId"
            ],
            "additionalProperties": false
          },
          "query": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "headers": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "body": {
            "type": "object",
            "additionalProperties": true
          }
        },
        "additionalProperties": false
      },
      "mutating": true,
      "legacy": false
    },
    {
      "name": "wf_schedule_cancel",
      "operationId": "schedule.cancel",
      "description": "Cancel a running job · POST /api/ke/schedule/:jobId/cancel",
      "inputSchema": {
        "type": "object",
        "properties": {
          "params": {
            "type": "object",
            "properties": {
              "jobId": {
                "type": "string"
              }
            },
            "required": [
              "jobId"
            ],
            "additionalProperties": false
          },
          "query": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "headers": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "body": {
            "type": "object",
            "additionalProperties": true
          }
        },
        "additionalProperties": false
      },
      "mutating": true,
      "legacy": false
    },
    {
      "name": "wf_schedule_patch",
      "operationId": "schedule.patch",
      "description": "Enable/disable a job or change its cron schedule at runtime · PATCH /api/ke/schedule/:jobId",
      "inputSchema": {
        "type": "object",
        "properties": {
          "params": {
            "type": "object",
            "properties": {
              "jobId": {
                "type": "string"
              }
            },
            "required": [
              "jobId"
            ],
            "additionalProperties": false
          },
          "query": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "headers": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "body": {
            "type": "object",
            "properties": {
              "enabled": {
                "type": "boolean"
              },
              "schedule": {
                "type": "string",
                "description": "5-field cron expression"
              }
            },
            "required": [],
            "description": "Partial job update"
          }
        },
        "additionalProperties": false
      },
      "mutating": true,
      "legacy": false
    },
    {
      "name": "wf_schedule_decisions",
      "operationId": "schedule.decisions",
      "description": "Read the F5 policy decision log · GET /api/ke/schedule/decisions",
      "inputSchema": {
        "type": "object",
        "properties": {
          "params": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "query": {
            "type": "object",
            "properties": {
              "jobId": {
                "type": "string"
              },
              "limit": {
                "type": "integer",
                "description": "Default 50"
              }
            },
            "additionalProperties": false
          },
          "headers": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "body": {
            "type": "object",
            "additionalProperties": true
          }
        },
        "additionalProperties": false
      },
      "mutating": false,
      "legacy": false
    },
    {
      "name": "wf_schedule_approvals",
      "operationId": "schedule.approvals",
      "description": "List F6 approval requests and debounced events · GET /api/ke/schedule/approvals",
      "inputSchema": {
        "type": "object",
        "properties": {
          "params": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "query": {
            "type": "object",
            "properties": {
              "jobId": {
                "type": "string"
              },
              "status": {
                "type": "string",
                "description": "pending | approved | rejected | failed",
                "enum": [
                  "pending",
                  "approved",
                  "rejected",
                  "failed"
                ]
              }
            },
            "additionalProperties": false
          },
          "headers": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "body": {
            "type": "object",
            "additionalProperties": true
          }
        },
        "additionalProperties": false
      },
      "mutating": false,
      "legacy": false
    },
    {
      "name": "wf_schedule_trigger",
      "operationId": "schedule.trigger",
      "description": "Publish a debounced note event (webhook) · POST /api/ke/schedule/trigger",
      "inputSchema": {
        "type": "object",
        "properties": {
          "params": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "query": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "headers": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "body": {
            "type": "object",
            "properties": {
              "event": {
                "type": "string",
                "description": "note.created | note.modified | note.deleted",
                "enum": [
                  "note.created",
                  "note.modified",
                  "note.deleted"
                ]
              },
              "project": {
                "type": "string"
              },
              "path": {
                "type": "string",
                "description": "Wiki-relative note path"
              }
            },
            "required": [
              "event"
            ],
            "description": "Trigger event"
          }
        },
        "additionalProperties": false
      },
      "mutating": true,
      "legacy": false
    },
    {
      "name": "wf_schedule_approvalDecision",
      "operationId": "schedule.approvalDecision",
      "description": "Approve or reject a pending F6 request · POST /api/ke/schedule/approvals/:id/:action",
      "inputSchema": {
        "type": "object",
        "properties": {
          "params": {
            "type": "object",
            "properties": {
              "id": {
                "type": "string"
              },
              "action": {
                "type": "string"
              }
            },
            "required": [
              "id",
              "action"
            ],
            "additionalProperties": false
          },
          "query": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "headers": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "body": {
            "type": "object",
            "properties": {
              "reviewer": {
                "type": "string",
                "description": "Defaults to \"human\""
              },
              "reason": {
                "type": "string"
              }
            },
            "required": [],
            "description": "Decision metadata"
          }
        },
        "additionalProperties": false
      },
      "mutating": true,
      "legacy": false
    },
    {
      "name": "wf_files_download",
      "operationId": "files.download",
      "description": "Download a project file (path must stay inside the project root) · GET /api/files/download",
      "inputSchema": {
        "type": "object",
        "properties": {
          "params": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "query": {
            "type": "object",
            "properties": {
              "path": {
                "type": "string"
              }
            },
            "required": [
              "path"
            ],
            "additionalProperties": false
          },
          "headers": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "body": {
            "type": "object",
            "additionalProperties": true
          }
        },
        "additionalProperties": false
      },
      "mutating": false,
      "legacy": false
    },
    {
      "name": "wf_review_meta",
      "operationId": "review.meta",
      "description": "Get note identity, OKF quality gate, verification history and snapshot count · GET /api/notes/review/meta",
      "inputSchema": {
        "type": "object",
        "properties": {
          "params": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "query": {
            "type": "object",
            "properties": {
              "note": {
                "type": "string",
                "description": "Note id, title or wiki-relative path"
              }
            },
            "required": [
              "note"
            ],
            "additionalProperties": false
          },
          "headers": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "body": {
            "type": "object",
            "additionalProperties": true
          }
        },
        "additionalProperties": false
      },
      "mutating": false,
      "legacy": false
    },
    {
      "name": "wf_review_verify",
      "operationId": "review.verify",
      "description": "Record human verification and optionally promote the note to stable · POST /api/notes/review/verify",
      "inputSchema": {
        "type": "object",
        "properties": {
          "params": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "query": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "headers": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "body": {
            "type": "object",
            "properties": {
              "note": {
                "type": "string"
              },
              "reviewer": {
                "type": "string"
              },
              "comment": {
                "type": "string"
              },
              "setStable": {
                "type": "boolean"
              }
            },
            "required": [
              "note"
            ],
            "description": "Verification request"
          }
        },
        "additionalProperties": false
      },
      "mutating": true,
      "legacy": false
    },
    {
      "name": "wf_review_digest",
      "operationId": "review.digest",
      "description": "Deterministic activity digest from wiki/log.md · GET /api/notes/review/digest",
      "inputSchema": {
        "type": "object",
        "properties": {
          "params": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "query": {
            "type": "object",
            "properties": {
              "days": {
                "type": "integer",
                "description": "Clamped to 1–365, default 7"
              },
              "scope": {
                "type": "string",
                "description": "all | folder | note",
                "enum": [
                  "all",
                  "folder",
                  "note"
                ]
              },
              "note": {
                "type": "string"
              }
            },
            "additionalProperties": false
          },
          "headers": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "body": {
            "type": "object",
            "additionalProperties": true
          }
        },
        "additionalProperties": false
      },
      "mutating": false,
      "legacy": false
    },
    {
      "name": "wf_review_critique",
      "operationId": "review.critique",
      "description": "LLM critique of a note with deterministic offline fallback · POST /api/notes/review/critique",
      "inputSchema": {
        "type": "object",
        "properties": {
          "params": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "query": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "headers": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "body": {
            "type": "object",
            "properties": {
              "note": {
                "type": "string"
              },
              "depth": {
                "type": "string",
                "description": "fast | standard | deep",
                "enum": [
                  "fast",
                  "standard",
                  "deep"
                ]
              },
              "focus": {
                "type": "array",
                "items": {
                  "type": "string"
                }
              },
              "instructions": {
                "type": "string"
              }
            },
            "required": [
              "note"
            ],
            "description": "Critique request"
          }
        },
        "additionalProperties": false
      },
      "mutating": true,
      "legacy": false
    },
    {
      "name": "wf_review_snapshots",
      "operationId": "review.snapshots",
      "description": "List local snapshots of a note (newest first, 25 retained) · GET /api/notes/review/snapshots",
      "inputSchema": {
        "type": "object",
        "properties": {
          "params": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "query": {
            "type": "object",
            "properties": {
              "note": {
                "type": "string"
              }
            },
            "required": [
              "note"
            ],
            "additionalProperties": false
          },
          "headers": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "body": {
            "type": "object",
            "additionalProperties": true
          }
        },
        "additionalProperties": false
      },
      "mutating": false,
      "legacy": false
    },
    {
      "name": "wf_review_diff",
      "operationId": "review.diff",
      "description": "Row-based diff between a note and one of its snapshots · GET /api/notes/review/diff",
      "inputSchema": {
        "type": "object",
        "properties": {
          "params": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "query": {
            "type": "object",
            "properties": {
              "note": {
                "type": "string"
              },
              "snapshot": {
                "type": "string"
              }
            },
            "required": [
              "note",
              "snapshot"
            ],
            "additionalProperties": false
          },
          "headers": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "body": {
            "type": "object",
            "additionalProperties": true
          }
        },
        "additionalProperties": false
      },
      "mutating": false,
      "legacy": false
    },
    {
      "name": "wf_review_restore",
      "operationId": "review.restore",
      "description": "Restore a snapshot (the current content is snapshotted first) · POST /api/notes/review/restore",
      "inputSchema": {
        "type": "object",
        "properties": {
          "params": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "query": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "headers": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "body": {
            "type": "object",
            "properties": {
              "note": {
                "type": "string"
              },
              "snapshot": {
                "type": "string"
              }
            },
            "required": [
              "note",
              "snapshot"
            ]
          }
        },
        "additionalProperties": false
      },
      "mutating": true,
      "legacy": false
    },
    {
      "name": "wf_research_search",
      "operationId": "research.search",
      "description": "Deterministic weighted full-text search over wiki notes · GET /api/notes/research/search",
      "inputSchema": {
        "type": "object",
        "properties": {
          "params": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "query": {
            "type": "object",
            "properties": {
              "q": {
                "type": "string"
              },
              "limit": {
                "type": "integer",
                "description": "1–100, default 30"
              }
            },
            "required": [
              "q"
            ],
            "additionalProperties": false
          },
          "headers": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "body": {
            "type": "object",
            "additionalProperties": true
          }
        },
        "additionalProperties": false
      },
      "mutating": false,
      "legacy": false
    },
    {
      "name": "wf_research_backlinks",
      "operationId": "research.backlinks",
      "description": "List notes that link to the target note · GET /api/notes/research/backlinks",
      "inputSchema": {
        "type": "object",
        "properties": {
          "params": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "query": {
            "type": "object",
            "properties": {
              "note": {
                "type": "string"
              }
            },
            "required": [
              "note"
            ],
            "additionalProperties": false
          },
          "headers": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "body": {
            "type": "object",
            "additionalProperties": true
          }
        },
        "additionalProperties": false
      },
      "mutating": false,
      "legacy": false
    },
    {
      "name": "wf_research_related",
      "operationId": "research.related",
      "description": "Suggest notes sharing tags/vocabulary that are not linked yet · GET /api/notes/research/related",
      "inputSchema": {
        "type": "object",
        "properties": {
          "params": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "query": {
            "type": "object",
            "properties": {
              "note": {
                "type": "string"
              },
              "limit": {
                "type": "integer",
                "description": "1–50, default 12"
              }
            },
            "required": [
              "note"
            ],
            "additionalProperties": false
          },
          "headers": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "body": {
            "type": "object",
            "additionalProperties": true
          }
        },
        "additionalProperties": false
      },
      "mutating": false,
      "legacy": false
    },
    {
      "name": "wf_research_trace",
      "operationId": "research.trace",
      "description": "Trace a claim to notes, wikilinks and line-anchored raw sources · GET /api/notes/research/trace",
      "inputSchema": {
        "type": "object",
        "properties": {
          "params": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "query": {
            "type": "object",
            "properties": {
              "q": {
                "type": "string"
              }
            },
            "required": [
              "q"
            ],
            "additionalProperties": false
          },
          "headers": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "body": {
            "type": "object",
            "additionalProperties": true
          }
        },
        "additionalProperties": false
      },
      "mutating": false,
      "legacy": false
    },
    {
      "name": "wf_research_consult",
      "operationId": "research.consult",
      "description": "LLM answer grounded in the best-matching notes, with offline fallback · POST /api/notes/research/consult",
      "inputSchema": {
        "type": "object",
        "properties": {
          "params": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "query": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "headers": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "body": {
            "type": "object",
            "properties": {
              "question": {
                "type": "string"
              }
            },
            "required": [
              "question"
            ]
          }
        },
        "additionalProperties": false
      },
      "mutating": true,
      "legacy": false
    },
    {
      "name": "wf_research_promoteAnswer",
      "operationId": "research.promoteAnswer",
      "description": "Save a consult answer as an OKF Reference note or a scratchpad entry · POST /api/notes/research/promote-answer",
      "inputSchema": {
        "type": "object",
        "properties": {
          "params": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "query": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "headers": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "body": {
            "type": "object",
            "properties": {
              "question": {
                "type": "string"
              },
              "markdown": {
                "type": "string",
                "description": "Answer markdown (alias: answer)"
              },
              "answer": {
                "type": "string"
              },
              "citations": {
                "type": "array",
                "items": {
                  "type": "object",
                  "additionalProperties": true
                }
              },
              "fallback": {
                "type": "boolean"
              }
            },
            "required": [
              "question"
            ],
            "description": "Promotion request"
          }
        },
        "additionalProperties": false
      },
      "mutating": true,
      "legacy": false
    },
    {
      "name": "wf_research_deepResearch",
      "operationId": "research.deepResearch",
      "description": "Generate a multi-source report and synthesis note · POST /api/notes/research/deep-research",
      "inputSchema": {
        "type": "object",
        "properties": {
          "params": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "query": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "headers": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "body": {
            "type": "object",
            "properties": {
              "question": {
                "type": "string"
              }
            },
            "required": [
              "question"
            ]
          }
        },
        "additionalProperties": false
      },
      "mutating": true,
      "legacy": false
    },
    {
      "name": "wf_study_guide",
      "operationId": "study.guide",
      "description": "Build a deterministic study guide and write output/study-guide-*.md · POST /api/notes/study/guide",
      "inputSchema": {
        "type": "object",
        "properties": {
          "params": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "query": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "headers": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "body": {
            "type": "object",
            "properties": {
              "topic": {
                "type": "string"
              }
            },
            "required": [],
            "description": "Study topic"
          }
        },
        "additionalProperties": false
      },
      "mutating": true,
      "legacy": false
    },
    {
      "name": "wf_study_quiz",
      "operationId": "study.quiz",
      "description": "Build a multiple-choice quiz (count clamped to 1–25, default 5) · POST /api/notes/study/quiz",
      "inputSchema": {
        "type": "object",
        "properties": {
          "params": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "query": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "headers": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "body": {
            "type": "object",
            "properties": {
              "topic": {
                "type": "string"
              },
              "count": {
                "type": "integer"
              }
            },
            "required": [],
            "description": "Quiz request"
          }
        },
        "additionalProperties": false
      },
      "mutating": true,
      "legacy": false
    },
    {
      "name": "wf_study_mindmap",
      "operationId": "study.mindmap",
      "description": "Extract headings and wikilinks of a note into a mindmap · POST /api/notes/study/mindmap",
      "inputSchema": {
        "type": "object",
        "properties": {
          "params": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "query": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "headers": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "body": {
            "type": "object",
            "properties": {
              "target": {
                "type": "string",
                "description": "Note id, title or path"
              }
            },
            "required": [],
            "description": "Mindmap target"
          }
        },
        "additionalProperties": false
      },
      "mutating": true,
      "legacy": false
    },
    {
      "name": "wf_study_audioOverview",
      "operationId": "study.audioOverview",
      "description": "Build a Host A / Host B dialogue script · POST /api/notes/study/audio-overview",
      "inputSchema": {
        "type": "object",
        "properties": {
          "params": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "query": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "headers": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "body": {
            "type": "object",
            "properties": {
              "topic": {
                "type": "string"
              }
            },
            "required": [],
            "description": "Audio topic"
          }
        },
        "additionalProperties": false
      },
      "mutating": true,
      "legacy": false
    },
    {
      "name": "wf_study_note",
      "operationId": "study.note",
      "description": "Append a timestamped entry to notes/quick-notes.md · POST /api/notes/study/note",
      "inputSchema": {
        "type": "object",
        "properties": {
          "params": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "query": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "headers": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "body": {
            "type": "object",
            "properties": {
              "text": {
                "type": "string"
              }
            },
            "required": [
              "text"
            ],
            "description": "Quick note text"
          }
        },
        "additionalProperties": false
      },
      "mutating": true,
      "legacy": false
    },
    {
      "name": "wf_study_promoteNote",
      "operationId": "study.promoteNote",
      "description": "Promote a scratchpad entry into a wiki note and refresh indexes · POST /api/notes/study/promote-note",
      "inputSchema": {
        "type": "object",
        "properties": {
          "params": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "query": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "headers": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "body": {
            "type": "object",
            "properties": {
              "noteId": {
                "type": "string"
              },
              "folder": {
                "type": "string",
                "description": "Default: general"
              }
            },
            "required": [
              "noteId"
            ]
          }
        },
        "additionalProperties": false
      },
      "mutating": true,
      "legacy": false
    },
    {
      "name": "wf_study_thesisChapter",
      "operationId": "study.thesisChapter",
      "description": "Aggregate thesis chapters and mature syntheses into output/thesis_compiled.md · POST /api/notes/study/thesis-chapter",
      "inputSchema": {
        "type": "object",
        "properties": {
          "params": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "query": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "headers": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "body": {
            "type": "object",
            "properties": {
              "topic": {
                "type": "string"
              },
              "title": {
                "type": "string"
              },
              "minMaturity": {
                "type": "number"
              }
            },
            "required": [],
            "description": "Thesis request"
          }
        },
        "additionalProperties": false
      },
      "mutating": true,
      "legacy": false
    },
    {
      "name": "wf_wiki_notes_list",
      "operationId": "wiki.notes.list",
      "description": "Read every wiki note with backlinks computed · GET /api/wiki/notes",
      "inputSchema": {
        "type": "object",
        "properties": {
          "params": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "query": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "headers": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "body": {
            "type": "object",
            "additionalProperties": true
          }
        },
        "additionalProperties": false
      },
      "mutating": false,
      "legacy": false
    },
    {
      "name": "wf_templates_list",
      "operationId": "templates.list",
      "description": "List canonical note templates managed by the backend · GET /api/templates",
      "inputSchema": {
        "type": "object",
        "properties": {
          "params": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "query": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "headers": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "body": {
            "type": "object",
            "additionalProperties": true
          }
        },
        "additionalProperties": false
      },
      "mutating": false,
      "legacy": false
    },
    {
      "name": "wf_wiki_folders_list",
      "operationId": "wiki.folders.list",
      "description": "List wiki folders · GET /api/wiki/folders",
      "inputSchema": {
        "type": "object",
        "properties": {
          "params": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "query": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "headers": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "body": {
            "type": "object",
            "additionalProperties": true
          }
        },
        "additionalProperties": false
      },
      "mutating": false,
      "legacy": false
    },
    {
      "name": "wf_wiki_scratchpad_list",
      "operationId": "wiki.scratchpad.list",
      "description": "Parse notes/quick-notes.md into scratchpad entries · GET /api/wiki/scratchpad",
      "inputSchema": {
        "type": "object",
        "properties": {
          "params": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "query": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "headers": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "body": {
            "type": "object",
            "additionalProperties": true
          }
        },
        "additionalProperties": false
      },
      "mutating": false,
      "legacy": false
    },
    {
      "name": "wf_wiki_scratchpad_delete",
      "operationId": "wiki.scratchpad.delete",
      "description": "Delete one scratchpad entry by id · POST /api/wiki/scratchpad/delete",
      "inputSchema": {
        "type": "object",
        "properties": {
          "params": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "query": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "headers": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "body": {
            "type": "object",
            "properties": {
              "id": {
                "type": "string"
              }
            },
            "required": [
              "id"
            ]
          }
        },
        "additionalProperties": false
      },
      "mutating": true,
      "legacy": false
    },
    {
      "name": "wf_wiki_note_save",
      "operationId": "wiki.note.save",
      "description": "Save a note atomically (rawContent preserves OKF frontmatter byte-for-byte) · POST /api/wiki/save",
      "inputSchema": {
        "type": "object",
        "properties": {
          "params": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "query": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "headers": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "body": {
            "type": "object",
            "properties": {
              "id": {
                "type": "string"
              },
              "content": {
                "type": "string"
              },
              "rawContent": {
                "type": "string",
                "description": "Exact full document to write"
              },
              "path": {
                "type": "string"
              },
              "folder": {
                "type": "string"
              },
              "title": {
                "type": "string"
              }
            },
            "required": [
              "id",
              "content"
            ],
            "description": "Save note request"
          }
        },
        "additionalProperties": false
      },
      "mutating": true,
      "legacy": false
    },
    {
      "name": "wf_wiki_note_applyEdit",
      "operationId": "wiki.note.applyEdit",
      "description": "Apply an exact, unique find/replace to one note · POST /api/wiki/apply-edit",
      "inputSchema": {
        "type": "object",
        "properties": {
          "params": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "query": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "headers": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "body": {
            "type": "object",
            "properties": {
              "file": {
                "type": "string"
              },
              "find": {
                "type": "string"
              },
              "replace": {
                "type": "string"
              }
            },
            "required": [
              "file",
              "find",
              "replace"
            ]
          }
        },
        "additionalProperties": false
      },
      "mutating": true,
      "legacy": false
    },
    {
      "name": "wf_wiki_note_attach",
      "operationId": "wiki.note.attach",
      "description": "Attach generated content to a note (append, create or overwrite) · POST /api/wiki/attach",
      "inputSchema": {
        "type": "object",
        "properties": {
          "params": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "query": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "headers": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "body": {
            "type": "object",
            "properties": {
              "noteId": {
                "type": "string"
              },
              "title": {
                "type": "string"
              },
              "folder": {
                "type": "string"
              },
              "content": {
                "type": "string"
              },
              "mode": {
                "type": "string",
                "description": "append | create | overwrite",
                "enum": [
                  "append",
                  "create",
                  "overwrite"
                ]
              }
            },
            "required": [
              "content"
            ],
            "description": "Attach request"
          }
        },
        "additionalProperties": false
      },
      "mutating": true,
      "legacy": false
    },
    {
      "name": "wf_chat_send",
      "operationId": "chat.send",
      "description": "Send a chat command (plain JSON or SSE when stream=true) · POST /api/chat",
      "inputSchema": {
        "type": "object",
        "properties": {
          "params": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "query": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "headers": {
            "type": "object",
            "properties": {
              "Accept": {
                "type": "string"
              }
            },
            "additionalProperties": false
          },
          "body": {
            "type": "object",
            "properties": {
              "message": {
                "type": "string"
              },
              "command": {
                "type": "string"
              },
              "contextNoteId": {
                "type": "string"
              },
              "stream": {
                "type": "boolean",
                "description": "Set true or send Accept: text/event-stream to stream"
              }
            },
            "required": [],
            "description": "Chat request"
          }
        },
        "additionalProperties": false
      },
      "mutating": true,
      "legacy": false
    },
    {
      "name": "wf_wiki_folder_create",
      "operationId": "wiki.folder.create",
      "description": "Create a folder inside the wiki · POST /api/wiki/folder/create",
      "inputSchema": {
        "type": "object",
        "properties": {
          "params": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "query": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "headers": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "body": {
            "type": "object",
            "properties": {
              "path": {
                "type": "string",
                "description": "Wiki-relative folder path"
              }
            },
            "required": [
              "path"
            ]
          }
        },
        "additionalProperties": false
      },
      "mutating": true,
      "legacy": false
    },
    {
      "name": "wf_wiki_file_create",
      "operationId": "wiki.file.create",
      "description": "Create a note, optionally from an OKF template · POST /api/wiki/file/create",
      "inputSchema": {
        "type": "object",
        "properties": {
          "params": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "query": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "headers": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "body": {
            "type": "object",
            "properties": {
              "folder": {
                "type": "string"
              },
              "name": {
                "type": "string",
                "description": "File name"
              },
              "content": {
                "type": "string",
                "description": "Full note content"
              }
            },
            "required": [
              "name",
              "content"
            ]
          }
        },
        "additionalProperties": false
      },
      "mutating": true,
      "legacy": false
    },
    {
      "name": "wf_wiki_rename",
      "operationId": "wiki.rename",
      "description": "Rename a note/folder and rewrite all inbound wikilinks · POST /api/wiki/rename",
      "inputSchema": {
        "type": "object",
        "properties": {
          "params": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "query": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "headers": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "body": {
            "type": "object",
            "properties": {
              "from": {
                "type": "string",
                "description": "Current path"
              },
              "to": {
                "type": "string",
                "description": "New path"
              },
              "type": {
                "type": "string",
                "description": "file | folder",
                "enum": [
                  "file",
                  "folder"
                ]
              },
              "dryRun": {
                "type": "boolean",
                "description": "Preview link rewrites without writing"
              },
              "newTitle": {
                "type": "string",
                "description": "Legacy title rename: slugify the name and update frontmatter"
              },
              "newName": {
                "type": "string",
                "description": "Legacy raw name rename"
              },
              "extraAliases": {
                "type": "array",
                "items": {
                  "type": "string"
                },
                "description": "Additional aliases to rewrite"
              }
            },
            "required": [
              "from",
              "to"
            ]
          }
        },
        "additionalProperties": false
      },
      "mutating": true,
      "legacy": false
    },
    {
      "name": "wf_wiki_move",
      "operationId": "wiki.move",
      "description": "Move a note/folder and rewrite all inbound wikilinks · POST /api/wiki/move",
      "inputSchema": {
        "type": "object",
        "properties": {
          "params": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "query": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "headers": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "body": {
            "type": "object",
            "properties": {
              "from": {
                "type": "string"
              },
              "to": {
                "type": "string"
              },
              "type": {
                "type": "string",
                "description": "file | folder",
                "enum": [
                  "file",
                  "folder"
                ]
              },
              "dryRun": {
                "type": "boolean"
              }
            },
            "required": [
              "from",
              "to"
            ]
          }
        },
        "additionalProperties": false
      },
      "mutating": true,
      "legacy": false
    },
    {
      "name": "wf_wiki_delete",
      "operationId": "wiki.delete",
      "description": "Soft-delete a note/folder into .wiki-forge/trash/ · POST /api/wiki/delete",
      "inputSchema": {
        "type": "object",
        "properties": {
          "params": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "query": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "headers": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "body": {
            "type": "object",
            "properties": {
              "targetPath": {
                "type": "string",
                "description": "Wiki-relative path"
              },
              "path": {
                "type": "string",
                "description": "Legacy alias of targetPath"
              },
              "type": {
                "type": "string",
                "description": "file | folder"
              }
            },
            "required": []
          }
        },
        "additionalProperties": false
      },
      "mutating": true,
      "legacy": false
    },
    {
      "name": "wf_wiki_trash_list",
      "operationId": "wiki.trash.list",
      "description": "List trashed files · GET /api/wiki/trash",
      "inputSchema": {
        "type": "object",
        "properties": {
          "params": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "query": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "headers": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "body": {
            "type": "object",
            "additionalProperties": true
          }
        },
        "additionalProperties": false
      },
      "mutating": false,
      "legacy": false
    },
    {
      "name": "wf_wiki_trash_restore",
      "operationId": "wiki.trash.restore",
      "description": "Restore a trashed file by id · POST /api/wiki/trash/restore",
      "inputSchema": {
        "type": "object",
        "properties": {
          "params": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "query": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "headers": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "body": {
            "type": "object",
            "properties": {
              "id": {
                "type": "string",
                "description": "Trash entry id"
              }
            },
            "required": [
              "id"
            ]
          }
        },
        "additionalProperties": false
      },
      "mutating": true,
      "legacy": false
    },
    {
      "name": "wf_wiki_upload",
      "operationId": "wiki.upload",
      "description": "Upload text or base64 content into raw/assets · POST /api/wiki/upload",
      "inputSchema": {
        "type": "object",
        "properties": {
          "params": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "query": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "headers": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "body": {
            "type": "object",
            "properties": {
              "path": {
                "type": "string",
                "description": "Destination path"
              },
              "content": {
                "type": "string"
              },
              "encoding": {
                "type": "string",
                "description": "utf-8 | base64"
              }
            },
            "required": [
              "path",
              "content"
            ]
          }
        },
        "additionalProperties": false
      },
      "mutating": true,
      "legacy": false
    },
    {
      "name": "wf_wiki_ingest",
      "operationId": "wiki.ingest",
      "description": "Stage + compile a markdown source into a wiki note · POST /api/wiki/ingest",
      "inputSchema": {
        "type": "object",
        "properties": {
          "params": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "query": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "headers": {
            "type": "object",
            "properties": {},
            "additionalProperties": false
          },
          "body": {
            "type": "object",
            "properties": {
              "content": {
                "type": "string"
              },
              "fileName": {
                "type": "string"
              },
              "folder": {
                "type": "string",
                "description": "Target wiki folder"
              }
            },
            "required": [
              "content",
              "fileName"
            ]
          }
        },
        "additionalProperties": false
      },
      "mutating": true,
      "legacy": false
    },
    {
      "name": "search_wiki",
      "operationId": "wiki.notes.list",
      "description": "Cerca note interconnesse nella wiki tramite l'API, senza accesso filesystem diretto.",
      "inputSchema": {
        "type": "object",
        "properties": {
          "query": {
            "type": "string",
            "description": "Termini di ricerca."
          },
          "limit": {
            "type": "integer",
            "description": "Numero massimo di risultati."
          }
        },
        "required": [
          "query"
        ],
        "additionalProperties": false
      },
      "mutating": false,
      "legacy": true
    },
    {
      "name": "get_concept_metadata",
      "operationId": "wiki.notes.list",
      "description": "Restituisce frontmatter OKF, tag e struttura di una nota.",
      "inputSchema": {
        "type": "object",
        "properties": {
          "note_id": {
            "type": "string",
            "description": "Id o path della nota."
          }
        },
        "required": [
          "note_id"
        ],
        "additionalProperties": false
      },
      "mutating": false,
      "legacy": true
    },
    {
      "name": "get_line_anchored_citation",
      "operationId": "wiki.notes.list",
      "description": "Estrae un passaggio ancorato a righe da una nota.",
      "inputSchema": {
        "type": "object",
        "properties": {
          "note_id": {
            "type": "string"
          },
          "line_start": {
            "type": "integer"
          },
          "line_end": {
            "type": "integer"
          }
        },
        "required": [
          "note_id",
          "line_start",
          "line_end"
        ],
        "additionalProperties": false
      },
      "mutating": false,
      "legacy": true
    },
    {
      "name": "list_trust_tiers",
      "operationId": "wiki.notes.list",
      "description": "Raggruppa le note per OKF Trust Tier.",
      "inputSchema": {
        "type": "object",
        "properties": {},
        "additionalProperties": false
      },
      "mutating": false,
      "legacy": true
    },
    {
      "name": "get_version_history",
      "operationId": "review.snapshots",
      "description": "Restituisce lo storico degli snapshot di una nota.",
      "inputSchema": {
        "type": "object",
        "properties": {
          "note_id": {
            "type": "string"
          }
        },
        "required": [
          "note_id"
        ],
        "additionalProperties": false
      },
      "mutating": false,
      "legacy": true
    },
    {
      "name": "validate_competency_question",
      "operationId": "ke.useCases.execute",
      "description": "Valuta una competency question tramite il caso d'uso CQ del backend.",
      "inputSchema": {
        "type": "object",
        "properties": {
          "question": {
            "type": "string"
          }
        },
        "required": [
          "question"
        ],
        "additionalProperties": false
      },
      "mutating": false,
      "legacy": true
    },
    {
      "name": "get_ontology_gaps",
      "operationId": "ke.useCases.execute",
      "description": "Individua gap ontologici tramite il caso d'uso di validazione del backend.",
      "inputSchema": {
        "type": "object",
        "properties": {},
        "additionalProperties": false
      },
      "mutating": false,
      "legacy": true
    },
    {
      "name": "execute_ke_use_case",
      "operationId": "ke.useCases.execute",
      "description": "Esegue un use case KE registrato tramite il kernel HTTP.",
      "inputSchema": {
        "type": "object",
        "properties": {
          "use_case_id": {
            "type": "string"
          }
        },
        "required": [
          "use_case_id"
        ],
        "additionalProperties": false
      },
      "mutating": true,
      "legacy": true
    }
  ],
  "gaps": [
    {
      "kind": "slash-without-implementation",
      "id": "adversarial-review",
      "detail": "catalogued slash command has no dedicated case in processChatCommand"
    },
    {
      "kind": "slash-without-implementation",
      "id": "backlinks",
      "detail": "catalogued slash command has no dedicated case in processChatCommand"
    },
    {
      "kind": "slash-without-implementation",
      "id": "convert-only",
      "detail": "catalogued slash command has no dedicated case in processChatCommand"
    },
    {
      "kind": "slash-without-implementation",
      "id": "diff",
      "detail": "catalogued slash command has no dedicated case in processChatCommand"
    },
    {
      "kind": "slash-without-implementation",
      "id": "digest",
      "detail": "catalogued slash command has no dedicated case in processChatCommand"
    },
    {
      "kind": "slash-without-implementation",
      "id": "export",
      "detail": "catalogued slash command has no dedicated case in processChatCommand"
    },
    {
      "kind": "slash-without-implementation",
      "id": "export-semantic",
      "detail": "catalogued slash command has no dedicated case in processChatCommand"
    },
    {
      "kind": "slash-without-implementation",
      "id": "generate-slides",
      "detail": "catalogued slash command has no dedicated case in processChatCommand"
    },
    {
      "kind": "slash-without-implementation",
      "id": "ingest",
      "detail": "catalogued slash command has no dedicated case in processChatCommand"
    },
    {
      "kind": "slash-without-implementation",
      "id": "ke-maturity",
      "detail": "catalogued slash command has no dedicated case in processChatCommand"
    },
    {
      "kind": "slash-without-implementation",
      "id": "lint-frontmatter",
      "detail": "catalogued slash command has no dedicated case in processChatCommand"
    },
    {
      "kind": "slash-without-implementation",
      "id": "maturity",
      "detail": "catalogued slash command has no dedicated case in processChatCommand"
    },
    {
      "kind": "slash-without-implementation",
      "id": "merge",
      "detail": "catalogued slash command has no dedicated case in processChatCommand"
    },
    {
      "kind": "slash-without-implementation",
      "id": "neuro-check",
      "detail": "catalogued slash command has no dedicated case in processChatCommand"
    },
    {
      "kind": "slash-without-implementation",
      "id": "new-article",
      "detail": "catalogued slash command has no dedicated case in processChatCommand"
    },
    {
      "kind": "slash-without-implementation",
      "id": "ontology-check",
      "detail": "catalogued slash command has no dedicated case in processChatCommand"
    },
    {
      "kind": "slash-without-implementation",
      "id": "prune",
      "detail": "catalogued slash command has no dedicated case in processChatCommand"
    },
    {
      "kind": "slash-without-implementation",
      "id": "recompile",
      "detail": "catalogued slash command has no dedicated case in processChatCommand"
    },
    {
      "kind": "slash-without-implementation",
      "id": "related",
      "detail": "catalogued slash command has no dedicated case in processChatCommand"
    },
    {
      "kind": "slash-without-implementation",
      "id": "retag",
      "detail": "catalogued slash command has no dedicated case in processChatCommand"
    },
    {
      "kind": "slash-without-implementation",
      "id": "schema-infer",
      "detail": "catalogued slash command has no dedicated case in processChatCommand"
    },
    {
      "kind": "slash-without-implementation",
      "id": "schema-lint",
      "detail": "catalogued slash command has no dedicated case in processChatCommand"
    },
    {
      "kind": "slash-without-implementation",
      "id": "search",
      "detail": "catalogued slash command has no dedicated case in processChatCommand"
    },
    {
      "kind": "slash-without-implementation",
      "id": "slides",
      "detail": "catalogued slash command has no dedicated case in processChatCommand"
    },
    {
      "kind": "slash-without-implementation",
      "id": "sources regenerate",
      "detail": "catalogued slash command has no dedicated case in processChatCommand"
    },
    {
      "kind": "slash-without-implementation",
      "id": "split",
      "detail": "catalogued slash command has no dedicated case in processChatCommand"
    },
    {
      "kind": "slash-without-implementation",
      "id": "stats",
      "detail": "catalogued slash command has no dedicated case in processChatCommand"
    },
    {
      "kind": "slash-without-implementation",
      "id": "stub",
      "detail": "catalogued slash command has no dedicated case in processChatCommand"
    },
    {
      "kind": "slash-without-implementation",
      "id": "suggest-odp",
      "detail": "catalogued slash command has no dedicated case in processChatCommand"
    },
    {
      "kind": "slash-without-implementation",
      "id": "tag-suggest",
      "detail": "catalogued slash command has no dedicated case in processChatCommand"
    },
    {
      "kind": "slash-without-implementation",
      "id": "template show",
      "detail": "catalogued slash command has no dedicated case in processChatCommand"
    },
    {
      "kind": "slash-without-implementation",
      "id": "validate-cq",
      "detail": "catalogued slash command has no dedicated case in processChatCommand"
    }
  ]
};

export const OPERATION_IDS: readonly string[] = COMMAND_MANIFEST.routes.map((route) => route.id);
export const COMMAND_GAPS: readonly CommandManifestGap[] = COMMAND_MANIFEST.gaps;
