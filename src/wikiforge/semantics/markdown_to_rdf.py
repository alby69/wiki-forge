import os
import re
import argparse
from pathlib import Path
import yaml

TURTLE_PREFIXES = """@prefix wf: <https://w3id.org/wikiforge/ontology/> .
@prefix wfid: <https://w3id.org/wikiforge/id/> .
@prefix dcterms: <http://purl.org/dc/terms/> .
@prefix prov: <http://www.w3.org/ns/prov#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

"""

def escape_ttl_string(val: str) -> str:
    """Escapa i caratteri speciali per i letterali Turtle."""
    if not val:
        return ""
    return val.replace('\\', '\\\\').replace('"', '\\"').replace('\n', '\\n')

def slugify(text: str) -> str:
    """Genera uno slug valido per IRI RDF."""
    text = text.lower().strip()
    text = text.replace('_', '-').replace('/', '-').replace('\\', '-')
    text = re.sub(r'[^\w\s-]', '', text)
    res = re.sub(r'[\s_-]+', '-', text).strip('-')
    return res or "note"

class ZettelToRDFConverter:
    def __init__(self, base_uri="https://w3id.org/wikiforge/id/", ontology_uri="https://w3id.org/wikiforge/ontology/"):
        self.base_uri = base_uri
        self.ontology_uri = ontology_uri

    def parse_markdown_file(self, filepath: Path, input_dir: Path = Path(".")) -> dict:
        """Estrae frontmatter YAML, titolo e wikilinks semantici da una nota Markdown."""
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

        try:
            rel_path = filepath.relative_to(input_dir)
        except ValueError:
            rel_path = filepath

        if metadata.get("id") or metadata.get("identifier"):
            raw_id = metadata.get("id") or metadata.get("identifier")
            note_slug = slugify(str(raw_id))
        elif rel_path.parent != Path("."):
            note_slug = slugify(f"{rel_path.parent.as_posix()}-{rel_path.stem}")
        else:
            note_slug = slugify(filepath.stem)

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
            target_str = target.strip()
            target_p = Path(target_str)

            if target_p.parent != Path("."):
                target_slug = slugify(f"{target_p.parent.as_posix()}-{target_p.stem}")
            else:
                target_slug = slugify(target_p.stem)

            if pred:
                predicate_name = pred.strip()
            else:
                predicate_name = "refersTo"

            semantic_links.append({
                "predicate": predicate_name,
                "target_slug": target_slug,
                "target_raw": target_str
            })

        return {
            "file_path": str(filepath),
            "id": note_slug,
            "slug": note_slug,
            "title": title,
            "created": str(created_date),
            "author": author,
            "tags": tags,
            "body": body,
            "links": semantic_links
        }

    def convert_notes_to_turtle(self, notes_data: list) -> str:
        """Converte una lista di note estratte in un grafo RDF serializzato in Turtle."""
        ttl_lines = [TURTLE_PREFIXES]

        all_targets = set()
        for note in notes_data:
            for link in note['links']:
                all_targets.add(link['target_slug'])

        for note in notes_data:
            note_iri = f"wfid:{note['slug']}"
            author_slug = slugify(note['author'])
            author_iri = f"wfid:agent-{author_slug}"

            ttl_lines.append(f"# --- Nota: {note['title']} ---")
            ttl_lines.append(f"{note_iri} a wf:PermanentNote ;")
            ttl_lines.append(f'    dcterms:identifier "{escape_ttl_string(note["id"])}" ;')
            ttl_lines.append(f'    dcterms:title "{escape_ttl_string(note["title"])}" ;')
            ttl_lines.append(f'    dcterms:created "{note["created"]}"^^xsd:date ;')
            ttl_lines.append(f'    wf:content "{escape_ttl_string(note["body"][:300])}..." ;')
            ttl_lines.append(f'    prov:wasAttributedTo {author_iri} ;')

            link_statements = []
            for link in note['links']:
                pred = link['predicate']
                target_iri = f"wfid:{link['target_slug']}"
                link_statements.append(f"    wf:{pred} {target_iri}")

            if link_statements:
                ttl_lines.append(" ;\n".join(link_statements) + " .")
            else:
                ttl_lines[-1] = ttl_lines[-1][:-2] + " ."

            ttl_lines.append(f"\n{author_iri} a prov:Agent, foaf:Agent ;")
            ttl_lines.append(f'    foaf:name "{escape_ttl_string(note["author"])}" .\n')

        parsed_slugs = {n['slug'] for n in notes_data}
        missing_targets = all_targets - parsed_slugs
        if missing_targets:
            ttl_lines.append("# --- Link Targets / Stub Notes ---")
            for target_slug in sorted(missing_targets):
                target_iri = f"wfid:{target_slug}"
                ttl_lines.append(f"{target_iri} a wf:PermanentNote ;")
                ttl_lines.append(f'    dcterms:identifier "{target_slug}" ;')
                ttl_lines.append(f'    dcterms:title "Stub {target_slug}" ;')
                ttl_lines.append(f'    dcterms:created "2026-01-01"^^xsd:date ;')
                ttl_lines.append(f'    wf:content "Stub note for target {target_slug}" ;')
                ttl_lines.append(f'    prov:wasAttributedTo wfid:agent-anonymus .\n')

        return "\n".join(ttl_lines)

    def process_directory(self, input_dir: Path, output_file: Path):
        """Scansiona la cartella di note Markdown ed esporta il grafo RDF .ttl."""
        notes = []
        md_files = list(input_dir.glob("**/*.md"))
        print(f"📁 Trovate {len(md_files)} note Markdown in {input_dir}")

        for md_file in md_files:
            note_data = self.parse_markdown_file(md_file, input_dir=input_dir)
            notes.append(note_data)

        turtle_content = self.convert_notes_to_turtle(notes)
        output_file.write_text(turtle_content, encoding="utf-8")
        print(f"✅ Grafo RDF estratto con successo in: {output_file}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Automazione conversione Markdown Zettelkasten in RDF per wiki-forge")
    parser.add_argument("--input", "-i", type=str, default="./notes", help="Cartella contenente le note .md")
    parser.add_argument("--output", "-o", type=str, default="knowledge_graph.ttl", help="File di output .ttl")

    args = parser.parse_args()
    converter = ZettelToRDFConverter()
    converter.process_directory(Path(args.input), Path(args.output))
