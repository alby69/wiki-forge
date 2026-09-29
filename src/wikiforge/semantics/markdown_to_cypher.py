import os
import re
import argparse
from pathlib import Path
import yaml

def escape_cypher_string(val: str) -> str:
    """Escapa le virgolette e i caratteri speciali per Cypher."""
    if not val:
        return ""
    return val.replace('\\', '\\\\').replace("'", "\\'").replace('\n', ' ')

def slugify(text: str) -> str:
    """Genera uno slug valido per gli ID dei nodi."""
    text = text.lower().strip()
    text = re.sub(r'[^\w\s-]', '', text)
    return re.sub(r'[\s_-]+', '-', text)

class ZettelToCypherConverter:
    def __init__(self):
        pass

    def parse_markdown_file(self, filepath: Path) -> dict:
        """Estrae metadati, testo e wikilinks semantici."""
        content = filepath.read_text(encoding="utf-8")
        metadata = {}
        body = content

        frontmatter_match = re.match(r'^---\s*\n(.*?)\n---\s*\n(.*)$', content, re.DOTALL)
        if frontmatter_match:
            yaml_text, body = frontmatter_match.groups()
            try:
                metadata = yaml.safe_load(yaml_text) or {}
            except yaml.YAMLError as e:
                print(f"⚠️ Errore YAML in {filepath.name}: {e}")

        note_id = str(metadata.get("id") or metadata.get("identifier") or filepath.stem)
        note_slug = slugify(note_id)

        title = metadata.get("title")
        if not title:
            h1_match = re.search(r'^#\s+(.+)$', body, re.MULTILINE)
            title = h1_match.group(1).strip() if h1_match else filepath.stem

        created_date = metadata.get("created") or metadata.get("date") or "2026-01-01"
        author = metadata.get("author") or "Anonymus"
        tags = metadata.get("tags") or []
        if isinstance(tags, str):
            tags = [t.strip() for t in tags.split(",")]

        semantic_links = []
        wikilink_pattern = re.compile(r'\[\[(?:([^\]:]+)::)?([^\]]+)\]\]')

        for match in wikilink_pattern.finditer(body):
            pred, target = match.groups()
            target_slug = slugify(target.strip())

            if pred:
                predicate_name = pred.strip()
            else:
                predicate_name = "refersTo"

            semantic_links.append({
                "predicate": predicate_name,
                "target_slug": target_slug
            })

        return {
            "id": note_id,
            "slug": note_slug,
            "title": title,
            "created": str(created_date),
            "author": author,
            "tags": tags,
            "body": body,
            "links": semantic_links
        }

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
        notes = []
        md_files = list(input_dir.glob("**/*.md"))
        print(f"📁 Trovate {len(md_files)} note Markdown in {input_dir}")

        for md_file in md_files:
            note_data = self.parse_markdown_file(md_file)
            notes.append(note_data)

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
