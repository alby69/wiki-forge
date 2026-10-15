// ==========================================================
// Script Cypher Generato Automaticamente per Neo4j (wiki-forge)
// ==========================================================

// 1. Creazione Vincoli di Unicità e Indici
CREATE CONSTRAINT note_id_unique IF NOT EXISTS FOR (n:PermanentNote) REQUIRE n.id IS UNIQUE;
CREATE CONSTRAINT agent_id_unique IF NOT EXISTS FOR (a:Agent) REQUIRE a.id IS UNIQUE;

// 2. Ingestione Nodi e Relazioni
