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


class ZettelToRDFConverter(BaseGraphExporter):
    def __init__(self, base_uri="https://w3id.org/wikiforge/id/", ontology_uri="https://w3id.org/wikiforge/ontology/"):
        self.base_uri = base_uri
        self.ontology_uri = ontology_uri

    def convert_notes_to_turtle(self, notes_data: list, include_rdf_star: bool = False) -> str:
        """Converte una lista di note estratte in un grafo RDF serializzato in Turtle/RDF-star."""
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
            rdf_star_annotations = []

            for link in note['links']:
                pred = link['predicate']
                target_iri = f"wfid:{link['target_slug']}"
                link_statements.append(f"    wf:{pred} {target_iri}")

                if include_rdf_star:
                    rdf_star_annotations.append(
                        f"<< {note_iri} wf:{pred} {target_iri} >>\n"
                        f'    wf:created "{link["created"]}"^^xsd:date ;\n'
                        f'    wf:confidence {link["confidence"]} ;\n'
                        f'    prov:wasAttributedTo {author_iri} .'
                    )

            if link_statements:
                ttl_lines.append(" ;\n".join(link_statements) + " .")
            else:
                ttl_lines[-1] = ttl_lines[-1][:-2] + " ."

            ttl_lines.append(f"\n{author_iri} a prov:Agent, foaf:Agent ;")
            ttl_lines.append(f'    foaf:name "{escape_ttl_string(note["author"])}" .\n')

            if rdf_star_annotations:
                ttl_lines.append("# --- RDF-star Edge Metadata ---")
                ttl_lines.extend(rdf_star_annotations)
                ttl_lines.append("")

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

    def process_directory(self, input_dir: Path, output_file: Path, include_rdf_star: bool = False):
        """Scansiona la cartella di note Markdown ed esporta il grafo RDF .ttl (opzionalmente RDF-star)."""
        notes = self.parse_directory(input_dir)
        print(f"📁 Trovate {len(notes)} note Markdown in {input_dir}")

        turtle_content = self.convert_notes_to_turtle(notes, include_rdf_star=include_rdf_star)
        output_file.write_text(turtle_content, encoding="utf-8")
        print(f"✅ Grafo RDF estratto con successo in: {output_file}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Automazione conversione Markdown Zettelkasten in RDF/RDF-star per wiki-forge")
    parser.add_argument("--input", "-i", type=str, default="./notes", help="Cartella contenente le note .md")
    parser.add_argument("--output", "-o", type=str, default="knowledge_graph.ttl", help="File di output .ttl")
    parser.add_argument("--rdf-star", action="store_true", help="Includi annotazioni RDF-star (<< s p o >>)")

    args = parser.parse_args()
    converter = ZettelToRDFConverter()
    converter.process_directory(Path(args.input), Path(args.output), include_rdf_star=args.rdf_star)
