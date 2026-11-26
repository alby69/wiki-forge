# Command Manifest (generato)

> GENERATED FILE — non modificare a mano. Rigenera con `npm run manifest`.
> Fonte: `scripts/gen_command_manifest.mjs`, derivata da `src/shared/api/contracts.ts`,
> `src/frontend/components/chat/commandCatalog.ts`, `src/backend/server/agentServer.ts`
> e `src/shared/mcp/definitions.ts`.

- Route HTTP: **110**
- Handler bus: **163**
- Comandi slash catalogati: **51**
- Comandi slash con case dedicato: **20**
- Tool MCP: **118**
- Gap noti: **32**

## Route HTTP

| Operazione | Metodo | Path | Handler bus |
|---|---|---|---|
| `docs.openapi` | GET | `/api/openapi.json` | sì |
| `docs.swagger` | GET | `/api/docs` | sì |
| `auth.me` | GET | `/api/auth/me` | sì |
| `auth.login` | POST | `/api/auth/login` | sì |
| `users.list` | GET | `/api/users` | sì |
| `users.create` | POST | `/api/users` | sì |
| `users.update` | PATCH | `/api/users/:id` | sì |
| `users.delete` | DELETE | `/api/users/:id` | sì |
| `ui.access` | GET | `/api/ui/access` | sì |
| `ui.preferences.get` | GET | `/api/ui/preferences` | sì |
| `ui.preferences.put` | PUT | `/api/ui/preferences` | sì |
| `graph.sync` | POST | `/api/v1/graph/sync` | sì |
| `graph.validate` | POST | `/api/v1/graph/validate` | sì |
| `graph.rag` | POST | `/api/v1/graph/rag` | sì |
| `graph.clusters` | GET | `/api/v1/graph/clusters` | sì |
| `graph.insights` | GET | `/api/v1/graph/insights` | sì |
| `graph.cypher` | POST | `/api/v1/graph/cypher` | sì |
| `graph.sync.neo4j` | POST | `/api/v1/graph/sync/neo4j` | sì |
| `graph.status` | GET | `/api/v1/graph/status` | sì |
| `graph.events` | GET | `/api/v1/graph/events` | sì |
| `graph.reconcile` | POST | `/api/v1/graph/reconcile` | sì |
| `skills.list` | GET | `/api/skills` | sì |
| `help.list` | GET | `/api/help` | sì |
| `help.get` | GET | `/api/help/:topicId` | sì |
| `scripts.list` | GET | `/api/scripts/list` | sì |
| `scripts.registry` | GET | `/api/scripts/registry` | sì |
| `scripts.schedule` | POST | `/api/scripts/schedule` | sì |
| `scripts.unschedule` | DELETE | `/api/scripts/schedule/:jobId` | sì |
| `scripts.execute` | POST | `/api/scripts/execute` | sì |
| `ke.useCases.list` | GET | `/api/ke/use-cases` | sì |
| `ke.useCases.execute` | POST | `/api/ke/use-cases/execute` | sì |
| `reviews.list` | GET | `/api/reviews` | sì |
| `reviews.add` | POST | `/api/reviews/add` | sì |
| `reviews.action` | POST | `/api/reviews/action` | sì |
| `ingest.queue.list` | GET | `/api/ingest/queue` | sì |
| `ingest.queue.add` | POST | `/api/ingest/queue/add` | sì |
| `ingest.queue.process` | POST | `/api/ingest/queue/process` | sì |
| `projects.list` | GET | `/api/projects` | sì |
| `projects.create` | POST | `/api/projects` | sì |
| `projects.import` | POST | `/api/projects/import` | sì |
| `projects.clone` | POST | `/api/projects/:id/clone` | sì |
| `projects.archive` | POST | `/api/projects/:id/archive` | sì |
| `projects.restore` | POST | `/api/projects/:id/restore` | sì |
| `projects.export` | GET | `/api/projects/:id/export` | sì |
| `projects.exportMarkdownZip` | GET | `/api/projects/:id/export/markdown.zip` | sì |
| `projects.stats` | GET | `/api/projects/:id/stats` | sì |
| `projects.config.get` | GET | `/api/projects/:id/config` | sì |
| `projects.config.put` | PUT | `/api/projects/:id/config` | sì |
| `projects.gguf.list` | GET | `/api/projects/:id/models/gguf` | sì |
| `projects.gguf.uploadStart` | POST | `/api/projects/:id/models/gguf/start` | sì |
| `projects.gguf.uploadChunk` | POST | `/api/projects/:id/models/gguf/chunk` | sì |
| `projects.gguf.uploadFinalize` | POST | `/api/projects/:id/models/gguf/finalize` | sì |
| `projects.gguf.activate` | POST | `/api/projects/:id/models/gguf/activate` | sì |
| `projects.rename` | PATCH | `/api/projects/:id` | sì |
| `projects.delete` | DELETE | `/api/projects/:id` | sì |
| `changesets.list` | GET | `/api/v1/changesets` | sì |
| `changesets.stage` | POST | `/api/v1/changesets` | sì |
| `changesets.get` | GET | `/api/v1/changesets/:id` | sì |
| `changesets.apply` | POST | `/api/v1/changesets/:id/apply` | sì |
| `changesets.reject` | POST | `/api/v1/changesets/:id/reject` | sì |
| `schedule.status` | GET | `/api/ke/schedule` | sì |
| `schedule.events` | GET | `/api/ke/schedule/events` | sì |
| `schedule.runs` | GET | `/api/ke/schedule/runs` | sì |
| `schedule.run` | POST | `/api/ke/schedule/:jobId/run` | sì |
| `schedule.cancel` | POST | `/api/ke/schedule/:jobId/cancel` | sì |
| `schedule.patch` | PATCH | `/api/ke/schedule/:jobId` | sì |
| `schedule.decisions` | GET | `/api/ke/schedule/decisions` | sì |
| `schedule.approvals` | GET | `/api/ke/schedule/approvals` | sì |
| `schedule.trigger` | POST | `/api/ke/schedule/trigger` | sì |
| `schedule.approvalDecision` | POST | `/api/ke/schedule/approvals/:id/:action` | sì |
| `files.download` | GET | `/api/files/download` | sì |
| `review.meta` | GET | `/api/notes/review/meta` | sì |
| `review.verify` | POST | `/api/notes/review/verify` | sì |
| `review.digest` | GET | `/api/notes/review/digest` | sì |
| `review.critique` | POST | `/api/notes/review/critique` | sì |
| `review.snapshots` | GET | `/api/notes/review/snapshots` | sì |
| `review.diff` | GET | `/api/notes/review/diff` | sì |
| `review.restore` | POST | `/api/notes/review/restore` | sì |
| `research.search` | GET | `/api/notes/research/search` | sì |
| `research.backlinks` | GET | `/api/notes/research/backlinks` | sì |
| `research.related` | GET | `/api/notes/research/related` | sì |
| `research.trace` | GET | `/api/notes/research/trace` | sì |
| `research.consult` | POST | `/api/notes/research/consult` | sì |
| `research.promoteAnswer` | POST | `/api/notes/research/promote-answer` | sì |
| `research.deepResearch` | POST | `/api/notes/research/deep-research` | sì |
| `study.guide` | POST | `/api/notes/study/guide` | sì |
| `study.quiz` | POST | `/api/notes/study/quiz` | sì |
| `study.mindmap` | POST | `/api/notes/study/mindmap` | sì |
| `study.audioOverview` | POST | `/api/notes/study/audio-overview` | sì |
| `study.note` | POST | `/api/notes/study/note` | sì |
| `study.promoteNote` | POST | `/api/notes/study/promote-note` | sì |
| `study.thesisChapter` | POST | `/api/notes/study/thesis-chapter` | sì |
| `wiki.notes.list` | GET | `/api/wiki/notes` | sì |
| `templates.list` | GET | `/api/templates` | sì |
| `wiki.folders.list` | GET | `/api/wiki/folders` | sì |
| `wiki.scratchpad.list` | GET | `/api/wiki/scratchpad` | sì |
| `wiki.scratchpad.delete` | POST | `/api/wiki/scratchpad/delete` | sì |
| `wiki.note.save` | POST | `/api/wiki/save` | sì |
| `wiki.note.applyEdit` | POST | `/api/wiki/apply-edit` | sì |
| `wiki.note.attach` | POST | `/api/wiki/attach` | sì |
| `chat.send` | POST | `/api/chat` | sì |
| `wiki.folder.create` | POST | `/api/wiki/folder/create` | sì |
| `wiki.file.create` | POST | `/api/wiki/file/create` | sì |
| `wiki.rename` | POST | `/api/wiki/rename` | sì |
| `wiki.move` | POST | `/api/wiki/move` | sì |
| `wiki.delete` | POST | `/api/wiki/delete` | sì |
| `wiki.trash.list` | GET | `/api/wiki/trash` | sì |
| `wiki.trash.restore` | POST | `/api/wiki/trash/restore` | sì |
| `wiki.upload` | POST | `/api/wiki/upload` | sì |
| `wiki.ingest` | POST | `/api/wiki/ingest` | sì |

## Comandi slash

| Comando | Categoria | Case dedicato |
|---|---|---|
| `compile` | ingest | sì |
| `convert-only` | ingest | **no** |
| `ingest` | ingest | **no** |
| `recompile` | ingest | **no** |
| `new-article` | curate | **no** |
| `merge` | curate | **no** |
| `split` | curate | **no** |
| `stub` | curate | **no** |
| `retag` | curate | **no** |
| `export-semantic` | curate | **no** |
| `apply` | curate | sì |
| `audit` | audit | sì |
| `reindex` | audit | sì |
| `prune` | audit | **no** |
| `lint-frontmatter` | audit | **no** |
| `ontology-check` | audit | **no** |
| `stats` | audit | **no** |
| `maturity` | audit | **no** |
| `adversarial-review` | review | **no** |
| `verify` | review | sì |
| `human-review` | review | sì |
| `digest` | review | **no** |
| `diff` | review | **no** |
| `consult` | query | sì |
| `search` | query | **no** |
| `backlinks` | query | **no** |
| `related` | query | **no** |
| `trace` | query | sì |
| `deep-research` | query | sì |
| `study-guide` | study | sì |
| `quiz` | study | sì |
| `mindmap` | study | sì |
| `audio-overview` | study | sì |
| `note` | study | sì |
| `promote-note` | study | sì |
| `thesis-chapter` | study | sì |
| `schema-lint` | ke | **no** |
| `schema-infer` | ke | **no** |
| `validate-cq` | ke | **no** |
| `suggest-odp` | ke | **no** |
| `neuro-check` | ke | **no** |
| `ke-maturity` | ke | **no** |
| `slides` | slides | **no** |
| `generate-slides` | slides | **no** |
| `wizard` | utility | sì |
| `skill` | utility | sì |
| `export` | utility | **no** |
| `template show` | utility | **no** |
| `sources regenerate` | utility | **no** |
| `tag-suggest` | utility | **no** |
| `help` | utility | sì |

## Tool MCP

| Tool | OperationId | Mutante | Legacy |
|---|---|---|---|
| `wf_docs_openapi` | `docs.openapi` | no | no |
| `wf_docs_swagger` | `docs.swagger` | no | no |
| `wf_auth_me` | `auth.me` | no | no |
| `wf_auth_login` | `auth.login` | sì | no |
| `wf_users_list` | `users.list` | no | no |
| `wf_users_create` | `users.create` | sì | no |
| `wf_users_update` | `users.update` | sì | no |
| `wf_users_delete` | `users.delete` | sì | no |
| `wf_ui_access` | `ui.access` | no | no |
| `wf_ui_preferences_get` | `ui.preferences.get` | no | no |
| `wf_ui_preferences_put` | `ui.preferences.put` | sì | no |
| `wf_graph_sync` | `graph.sync` | sì | no |
| `wf_graph_validate` | `graph.validate` | sì | no |
| `wf_graph_rag` | `graph.rag` | sì | no |
| `wf_graph_clusters` | `graph.clusters` | no | no |
| `wf_graph_insights` | `graph.insights` | no | no |
| `wf_graph_cypher` | `graph.cypher` | sì | no |
| `wf_graph_sync_neo4j` | `graph.sync.neo4j` | sì | no |
| `wf_graph_status` | `graph.status` | no | no |
| `wf_graph_events` | `graph.events` | no | no |
| `wf_graph_reconcile` | `graph.reconcile` | sì | no |
| `wf_skills_list` | `skills.list` | no | no |
| `wf_help_list` | `help.list` | no | no |
| `wf_help_get` | `help.get` | no | no |
| `wf_scripts_list` | `scripts.list` | no | no |
| `wf_scripts_registry` | `scripts.registry` | no | no |
| `wf_scripts_schedule` | `scripts.schedule` | sì | no |
| `wf_scripts_unschedule` | `scripts.unschedule` | sì | no |
| `wf_scripts_execute` | `scripts.execute` | sì | no |
| `wf_ke_useCases_list` | `ke.useCases.list` | no | no |
| `wf_ke_useCases_execute` | `ke.useCases.execute` | sì | no |
| `wf_reviews_list` | `reviews.list` | no | no |
| `wf_reviews_add` | `reviews.add` | sì | no |
| `wf_reviews_action` | `reviews.action` | sì | no |
| `wf_ingest_queue_list` | `ingest.queue.list` | no | no |
| `wf_ingest_queue_add` | `ingest.queue.add` | sì | no |
| `wf_ingest_queue_process` | `ingest.queue.process` | sì | no |
| `wf_projects_list` | `projects.list` | no | no |
| `wf_projects_create` | `projects.create` | sì | no |
| `wf_projects_import` | `projects.import` | sì | no |
| `wf_projects_clone` | `projects.clone` | sì | no |
| `wf_projects_archive` | `projects.archive` | sì | no |
| `wf_projects_restore` | `projects.restore` | sì | no |
| `wf_projects_export` | `projects.export` | no | no |
| `wf_projects_exportMarkdownZip` | `projects.exportMarkdownZip` | no | no |
| `wf_projects_stats` | `projects.stats` | no | no |
| `wf_projects_config_get` | `projects.config.get` | no | no |
| `wf_projects_config_put` | `projects.config.put` | sì | no |
| `wf_projects_gguf_list` | `projects.gguf.list` | no | no |
| `wf_projects_gguf_uploadStart` | `projects.gguf.uploadStart` | sì | no |
| `wf_projects_gguf_uploadChunk` | `projects.gguf.uploadChunk` | sì | no |
| `wf_projects_gguf_uploadFinalize` | `projects.gguf.uploadFinalize` | sì | no |
| `wf_projects_gguf_activate` | `projects.gguf.activate` | sì | no |
| `wf_projects_rename` | `projects.rename` | sì | no |
| `wf_projects_delete` | `projects.delete` | sì | no |
| `wf_changesets_list` | `changesets.list` | no | no |
| `wf_changesets_stage` | `changesets.stage` | sì | no |
| `wf_changesets_get` | `changesets.get` | no | no |
| `wf_changesets_apply` | `changesets.apply` | sì | no |
| `wf_changesets_reject` | `changesets.reject` | sì | no |
| `wf_schedule_status` | `schedule.status` | no | no |
| `wf_schedule_events` | `schedule.events` | no | no |
| `wf_schedule_runs` | `schedule.runs` | no | no |
| `wf_schedule_run` | `schedule.run` | sì | no |
| `wf_schedule_cancel` | `schedule.cancel` | sì | no |
| `wf_schedule_patch` | `schedule.patch` | sì | no |
| `wf_schedule_decisions` | `schedule.decisions` | no | no |
| `wf_schedule_approvals` | `schedule.approvals` | no | no |
| `wf_schedule_trigger` | `schedule.trigger` | sì | no |
| `wf_schedule_approvalDecision` | `schedule.approvalDecision` | sì | no |
| `wf_files_download` | `files.download` | no | no |
| `wf_review_meta` | `review.meta` | no | no |
| `wf_review_verify` | `review.verify` | sì | no |
| `wf_review_digest` | `review.digest` | no | no |
| `wf_review_critique` | `review.critique` | sì | no |
| `wf_review_snapshots` | `review.snapshots` | no | no |
| `wf_review_diff` | `review.diff` | no | no |
| `wf_review_restore` | `review.restore` | sì | no |
| `wf_research_search` | `research.search` | no | no |
| `wf_research_backlinks` | `research.backlinks` | no | no |
| `wf_research_related` | `research.related` | no | no |
| `wf_research_trace` | `research.trace` | no | no |
| `wf_research_consult` | `research.consult` | sì | no |
| `wf_research_promoteAnswer` | `research.promoteAnswer` | sì | no |
| `wf_research_deepResearch` | `research.deepResearch` | sì | no |
| `wf_study_guide` | `study.guide` | sì | no |
| `wf_study_quiz` | `study.quiz` | sì | no |
| `wf_study_mindmap` | `study.mindmap` | sì | no |
| `wf_study_audioOverview` | `study.audioOverview` | sì | no |
| `wf_study_note` | `study.note` | sì | no |
| `wf_study_promoteNote` | `study.promoteNote` | sì | no |
| `wf_study_thesisChapter` | `study.thesisChapter` | sì | no |
| `wf_wiki_notes_list` | `wiki.notes.list` | no | no |
| `wf_templates_list` | `templates.list` | no | no |
| `wf_wiki_folders_list` | `wiki.folders.list` | no | no |
| `wf_wiki_scratchpad_list` | `wiki.scratchpad.list` | no | no |
| `wf_wiki_scratchpad_delete` | `wiki.scratchpad.delete` | sì | no |
| `wf_wiki_note_save` | `wiki.note.save` | sì | no |
| `wf_wiki_note_applyEdit` | `wiki.note.applyEdit` | sì | no |
| `wf_wiki_note_attach` | `wiki.note.attach` | sì | no |
| `wf_chat_send` | `chat.send` | sì | no |
| `wf_wiki_folder_create` | `wiki.folder.create` | sì | no |
| `wf_wiki_file_create` | `wiki.file.create` | sì | no |
| `wf_wiki_rename` | `wiki.rename` | sì | no |
| `wf_wiki_move` | `wiki.move` | sì | no |
| `wf_wiki_delete` | `wiki.delete` | sì | no |
| `wf_wiki_trash_list` | `wiki.trash.list` | no | no |
| `wf_wiki_trash_restore` | `wiki.trash.restore` | sì | no |
| `wf_wiki_upload` | `wiki.upload` | sì | no |
| `wf_wiki_ingest` | `wiki.ingest` | sì | no |
| `search_wiki` | `wiki.notes.list` | no | sì |
| `get_concept_metadata` | `wiki.notes.list` | no | sì |
| `get_line_anchored_citation` | `wiki.notes.list` | no | sì |
| `list_trust_tiers` | `wiki.notes.list` | no | sì |
| `get_version_history` | `review.snapshots` | no | sì |
| `validate_competency_question` | `ke.useCases.execute` | no | sì |
| `get_ontology_gaps` | `ke.useCases.execute` | no | sì |
| `execute_ke_use_case` | `ke.useCases.execute` | sì | sì |

## Gap noti

| Tipo | ID | Dettaglio |
|---|---|---|
| slash-without-implementation | `adversarial-review` | catalogued slash command has no dedicated case in processChatCommand |
| slash-without-implementation | `backlinks` | catalogued slash command has no dedicated case in processChatCommand |
| slash-without-implementation | `convert-only` | catalogued slash command has no dedicated case in processChatCommand |
| slash-without-implementation | `diff` | catalogued slash command has no dedicated case in processChatCommand |
| slash-without-implementation | `digest` | catalogued slash command has no dedicated case in processChatCommand |
| slash-without-implementation | `export` | catalogued slash command has no dedicated case in processChatCommand |
| slash-without-implementation | `export-semantic` | catalogued slash command has no dedicated case in processChatCommand |
| slash-without-implementation | `generate-slides` | catalogued slash command has no dedicated case in processChatCommand |
| slash-without-implementation | `ingest` | catalogued slash command has no dedicated case in processChatCommand |
| slash-without-implementation | `ke-maturity` | catalogued slash command has no dedicated case in processChatCommand |
| slash-without-implementation | `lint-frontmatter` | catalogued slash command has no dedicated case in processChatCommand |
| slash-without-implementation | `maturity` | catalogued slash command has no dedicated case in processChatCommand |
| slash-without-implementation | `merge` | catalogued slash command has no dedicated case in processChatCommand |
| slash-without-implementation | `neuro-check` | catalogued slash command has no dedicated case in processChatCommand |
| slash-without-implementation | `new-article` | catalogued slash command has no dedicated case in processChatCommand |
| slash-without-implementation | `ontology-check` | catalogued slash command has no dedicated case in processChatCommand |
| slash-without-implementation | `prune` | catalogued slash command has no dedicated case in processChatCommand |
| slash-without-implementation | `recompile` | catalogued slash command has no dedicated case in processChatCommand |
| slash-without-implementation | `related` | catalogued slash command has no dedicated case in processChatCommand |
| slash-without-implementation | `retag` | catalogued slash command has no dedicated case in processChatCommand |
| slash-without-implementation | `schema-infer` | catalogued slash command has no dedicated case in processChatCommand |
| slash-without-implementation | `schema-lint` | catalogued slash command has no dedicated case in processChatCommand |
| slash-without-implementation | `search` | catalogued slash command has no dedicated case in processChatCommand |
| slash-without-implementation | `slides` | catalogued slash command has no dedicated case in processChatCommand |
| slash-without-implementation | `sources regenerate` | catalogued slash command has no dedicated case in processChatCommand |
| slash-without-implementation | `split` | catalogued slash command has no dedicated case in processChatCommand |
| slash-without-implementation | `stats` | catalogued slash command has no dedicated case in processChatCommand |
| slash-without-implementation | `stub` | catalogued slash command has no dedicated case in processChatCommand |
| slash-without-implementation | `suggest-odp` | catalogued slash command has no dedicated case in processChatCommand |
| slash-without-implementation | `tag-suggest` | catalogued slash command has no dedicated case in processChatCommand |
| slash-without-implementation | `template show` | catalogued slash command has no dedicated case in processChatCommand |
| slash-without-implementation | `validate-cq` | catalogued slash command has no dedicated case in processChatCommand |
