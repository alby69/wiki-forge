import re
import sys
import argparse
from pathlib import Path

# Ensure project root is in sys.path for direct script execution
_file_path = Path(__file__).resolve()
for _parent in _file_path.parents:
    if (_parent / "src").is_dir() and (_parent / "config").is_dir():
        if str(_parent) not in sys.path:
            sys.path.insert(0, str(_parent))
        break

from src.backend.wikiforge.semantics.base_parser import BaseGraphExporter, slugify


def escape_cypher_string(val: str) -> str:
    """Escapa le virgolette e i caratteri speciali per Cypher."""
    if not val:
        return ""
    return val.replace('\\', '\\\\').replace("'", "\\'").replace('\n', ' ')


class ZettelToCypherConverter(BaseGraphExporter):
    def convert_notes_to_cypher(self, notes_data: list) -> str:
        """Genera lo script Cypher con vincoli e costrutti MERGE."""
        cypher_lines = [
            "// ==========================================================",
            "// Script Cypher Generato Automaticamente per Neo4j (wiki-forge)",
            "// ==========================================================\n",
            "// 1. Creazione Vincoli di Unicità e Indici",
            "CREATE CONSTRAINT note_id_unique IF NOT EXISTS FOR (n:PermanentNote) REQUIRE n.id IS UNIQUE;",
            "CREATE CONSTRAINT agent_id_unique IF NOT EXISTS FOR (a:Agent) REQUIRE a.id IS UNIQUE;\n",
            "// 2. Ingestione Nodi e Relazioni\n"
        ]

        for note in notes_data:
            note_var = f"n_{re.sub(r'[^a-zA-Z0-9_]', '_', note['slug'])}"
            author_slug = slugify(note['author'])
            author_var = f"a_{re.sub(r'[^a-zA-Z0-9_]', '_', author_slug)}"

            cypher_lines.append(f"// --- Nota: {note['title']} ---")

            # MERGE Nota
            cypher_lines.append(
                f"MERGE ({note_var}:PermanentNote {{id: '{note['slug']}'}}) "
                f"SET {note_var}.title = '{escape_cypher_string(note['title'])}', "
                f"{note_var}.created = date('{note['created']}'), "
                f"{note_var}.content = '{escape_cypher_string(note['body'][:300])}...', "
                f"{note_var}.tags = {note['tags']};"
            )

            # MERGE Autore & Relazione Attribuzione
            cypher_lines.append(
                f"MERGE ({author_var}:Agent {{id: '{author_slug}'}}) "
                f"SET {author_var}.name = '{escape_cypher_string(note['author'])}';"
            )
            cypher_lines.append(f"MERGE ({note_var})-[r_attr:WAS_ATTRIBUTED_TO]->({author_var});")

            # MERGE Relazioni Semantiche
            for idx, link in enumerate(note['links']):
                target_var = f"t_{re.sub(r'[^a-zA-Z0-9_]', '_', link['target_slug'])}"
                rel_type = link['predicate'].upper()

                cypher_lines.append(f"MERGE ({target_var}:PermanentNote {{id: '{link['target_slug']}'}});")
                cypher_lines.append(
                    f"MERGE ({note_var})-[r_{note_var}_{idx}:{rel_type} {{raw_predicate: '{link['predicate']}'}}]->({target_var});"
                )

            cypher_lines.append("")

        return "\n".join(cypher_lines)

    def process_directory(self, input_dir: Path, output_file: Path):
        """Processa la cartella ed esporta lo script .cypher."""
        notes = self.parse_directory(input_dir)
        print(f"📁 Trovate {len(notes)} note Markdown in {input_dir}")

        cypher_content = self.convert_notes_to_cypher(notes)
        output_file.write_text(cypher_content, encoding="utf-8")
        print(f"✅ Script Cypher esportato con successo in: {output_file}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Automazione conversione Markdown Zettelkasten in Cypher Neo4j per wiki-forge")
    parser.add_argument("--input", "-i", type=str, default="./notes", help="Cartella contenente le note .md")
    parser.add_argument("--output", "-o", type=str, default="knowledge_graph.cypher", help="File di output .cypher")

    args = parser.parse_args()
    converter = ZettelToCypherConverter()
    converter.process_directory(Path(args.input), Path(args.output))
