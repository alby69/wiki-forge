export interface AgentCommand {
  /** Command text inserted after the leading slash, e.g. "consult" or "template show". */
  cmd: string;
  label: string;
  icon: string;
  /** Optional argument hint shown next to the command, e.g. "<topic>". */
  usage?: string;
  /** Tooltip / short explanation. */
  description?: string;
}

export interface CommandCategory {
  id: string;
  label: string;
  icon: string;
  commands: AgentCommand[];
}

/**
 * Catalogue of every agent slash-command exposed by wiki-forge, grouped by
 * topic. Used to render the expandable command menu in the agent top bar.
 * Keep in sync with skills/<skill>/SKILL.md `triggers.commands` and the
 * router switch in src/server/agentServer.ts.
 */
export const COMMAND_CATALOG: CommandCategory[] = [
  {
    id: 'ingest',
    label: 'Ingestione e Compilazione',
    icon: '🗂️',
    commands: [
      { cmd: 'compile', label: 'Compile', icon: '⚡', description: 'Converte le fonti, ingerisce i raw e rigenera gli indici.' },
      { cmd: 'convert-only', label: 'Convert Only', icon: '📄', description: 'Converte le fonti in Markdown senza pubblicare.' },
      { cmd: 'ingest', label: 'Ingest', icon: '📥', usage: '<source>', description: 'Ingerisce un nuovo file sorgente nella wiki.' },
      { cmd: 'recompile', label: 'Recompile', icon: '♻️', description: 'Ricompila le note già presenti.' },
    ],
  },
  {
    id: 'curate',
    label: 'Curatela',
    icon: '✍️',
    commands: [
      { cmd: 'new-article', label: 'New Article', icon: '🆕', usage: '<name>', description: 'Crea un nuovo articolo dal template.' },
      { cmd: 'merge', label: 'Merge', icon: '🔗', usage: '<a> <b>', description: 'Unisce due articoli sovrapposti.' },
      { cmd: 'split', label: 'Split', icon: '✂️', usage: '<path> <heading>', description: 'Divide un articolo in due a un titolo H2.' },
      { cmd: 'stub', label: 'Stub', icon: '🧩', usage: '<concept>', description: 'Crea un articolo segnaposto per un concetto mancante.' },
      { cmd: 'retag', label: 'Retag', icon: '🏷️', usage: '<path> [+tag] [-tag]', description: 'Modifica i tag di un articolo.' },
      { cmd: 'export-semantic', label: 'Export Semantic', icon: '🌐', description: 'Esporta in JSON-LD e Turtle (OKF v0.2).' },
    ],
  },
  {
    id: 'audit',
    label: 'Audit e Manutenzione',
    icon: '🛡️',
    commands: [
      { cmd: 'audit', label: 'Audit', icon: '🛡️', description: 'Controlla link rotti, orfani e frontmatter.' },
      { cmd: 'reindex', label: 'Reindex', icon: '🔄', description: 'Rigenera indici master e tematici.' },
      { cmd: 'prune', label: 'Prune', icon: '🧹', description: 'Rimuove note vuote o obsolete.' },
      { cmd: 'lint-frontmatter', label: 'Lint Frontmatter', icon: '🔎', description: 'Valida il frontmatter OKF.' },
      { cmd: 'ontology-check', label: 'Ontology Check', icon: '🧬', description: 'Verifica coerenza ontologica e regole.' },
      { cmd: 'stats', label: 'Stats', icon: '📊', description: 'Statistiche globali della wiki.' },
      { cmd: 'maturity', label: 'Maturity', icon: '📈', description: 'Calcola l\'indice di maturità delle note.' },
    ],
  },
  {
    id: 'review',
    label: 'Revisione e Controllo Qualità',
    icon: '🧐',
    commands: [
      { cmd: 'adversarial-review', label: 'Revisione Critica', icon: '⚔️', usage: '[note] [depth=deep]', description: 'Revisione critica delle note con individuazione di contraddizioni.' },
      { cmd: 'verify', label: 'Verifica Umana', icon: '✅', usage: '<note> [reviewer=id] [stable]', description: 'Registra una verifica umana (trust tier 🟢).' },
      { cmd: 'human-review', label: 'Human Review', icon: '👤', usage: '<note> [reviewer=id] [stable]', description: 'Alias di /verify.' },
      { cmd: 'digest', label: 'Digest', icon: '🧾', usage: '[days=7]', description: 'Riassume i cambiamenti recenti per la revisione.' },
      { cmd: 'diff', label: 'Diff', icon: '🧷', usage: '<file> [ref]', description: 'Confronta le versioni di una nota.' },
    ],
  },
  {
    id: 'query',
    label: 'Interrogazione e Ricerca',
    icon: '🔍',
    commands: [
      { cmd: 'consult', label: 'Consult', icon: '🔍', usage: '<topic>', description: 'Sintesi multi-fonte con citazioni [[wikilink]].' },
      { cmd: 'search', label: 'Search', icon: '🔎', usage: '<query>', description: 'Ricerca nel testo delle note.' },
      { cmd: 'backlinks', label: 'Backlinks', icon: '↩️', usage: '<note>', description: 'Mostra i backlink di una nota.' },
      { cmd: 'related', label: 'Related', icon: '🧲', usage: '<note>', description: 'Trova note correlate.' },
      { cmd: 'trace', label: 'Trace', icon: '🕸️', usage: '<topic>', description: 'Traccia le connessioni di un concetto.' },
      { cmd: 'deep-research', label: 'Deep Research', icon: '🔬', usage: '<question>', description: 'Ricerca approfondita multi-fonte.' },
    ],
  },
  {
    id: 'study',
    label: 'Studio e Sintesi',
    icon: '📚',
    commands: [
      { cmd: 'study-guide', label: 'Study Guide', icon: '📝', usage: '[topic]', description: 'Genera una guida di studio strutturata.' },
      { cmd: 'quiz', label: 'Quiz', icon: '🧪', usage: '[topic]', description: 'Crea un quiz di autovalutazione.' },
      { cmd: 'mindmap', label: 'Mindmap', icon: '🧠', usage: '[topic]', description: 'Genera una mappa concettuale.' },
      { cmd: 'audio-overview', label: 'Audio Overview', icon: '🎙️', usage: '[topic]', description: 'Scrive un copione audio.' },
      { cmd: 'note', label: 'Quick Note', icon: '📝', usage: '<text>', description: 'Salva un appunto rapido nello scratchpad.' },
      { cmd: 'promote-note', label: 'Promote Note', icon: '🚀', usage: '<note-id> [folder]', description: 'Promuove un appunto ad articolo wiki.' },
      { cmd: 'thesis-chapter', label: 'Thesis Chapter', icon: '🎓', usage: '[topic]', description: 'Aggrega le note mature in un capitolo.' },
    ],
  },
  {
    id: 'ke',
    label: 'Knowledge Engineering',
    icon: '🧠',
    commands: [
      { cmd: 'schema-lint', label: 'Schema Lint', icon: '🧱', description: 'Valida lo schema tipizzato.' },
      { cmd: 'schema-infer', label: 'Schema Infer', icon: '🪄', description: 'Inferisce uno schema dalle note.' },
      { cmd: 'validate-cq', label: 'Validate CQ', icon: '❓', description: 'Valida le Competency Questions.' },
      { cmd: 'suggest-odp', label: 'Suggest ODP', icon: '🧩', description: 'Suggerisce Ontology Design Pattern.' },
      { cmd: 'neuro-check', label: 'Neuro Check', icon: '🕸️', description: 'Controllo di coerenza neuro-simbolica.' },
      { cmd: 'ke-maturity', label: 'KE Maturity', icon: '📐', description: 'Valuta la maturità Knowledge Engineering.' },
    ],
  },
  {
    id: 'slides',
    label: 'Presentazioni e Slide',
    icon: '🎤',
    commands: [
      { cmd: 'slides', label: 'Slides', icon: '🎤', usage: '[topic]', description: 'Genera slide reveal.js.' },
      { cmd: 'generate-slides', label: 'Generate Slides', icon: '🖼️', usage: '[topic]', description: 'Alias di slides.' },
    ],
  },
  {
    id: 'utility',
    label: 'Onboarding e Utility',
    icon: '🧭',
    commands: [
      { cmd: 'wizard', label: 'Wizard', icon: '🪄', usage: '[scenario]', description: 'Scenari guidati di onboarding.' },
      { cmd: 'skill', label: 'Skills', icon: '🛠️', description: 'Elenca le skill registrate.' },
      { cmd: 'export', label: 'Export', icon: '📤', usage: '[format]', description: 'Esporta la wiki.' },
      { cmd: 'template show', label: 'Template Show', icon: '📐', usage: '[name]', description: 'Mostra i template disponibili.' },
      { cmd: 'sources regenerate', label: 'Sources', icon: '📚', description: 'Rigenera la bibliografia delle fonti.' },
      { cmd: 'tag-suggest', label: 'Tag Suggest', icon: '🏷️', description: 'Suggerisce tag per le note.' },
      { cmd: 'help', label: 'Help', icon: '❔', description: 'Mostra l\'aiuto dei comandi.' },
    ],
  },
];
