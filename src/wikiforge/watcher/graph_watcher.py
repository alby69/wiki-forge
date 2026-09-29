"""
src/wikiforge/watcher/graph_watcher.py

Incremental Event-Driven Graph Sync File Watcher for wiki-forge.
Watches for changes (creation, modification, deletion) in Markdown files within wiki/
and incrementally updates Neo4j or RDF graph representations.
"""

import os
import sys
import time
from pathlib import Path
from typing import Optional, Callable, Any

from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler, FileSystemEvent

from src.wikiforge.semantics.markdown_to_rdf import ZettelToRDFConverter, slugify
from src.wikiforge.semantics.markdown_to_cypher import ZettelToCypherConverter


class GraphSyncHandler(FileSystemEventHandler):
    """
    Event handler for incremental graph updates on markdown file events.
    """

    def __init__(self, watch_dir: Path, neo4j_driver: Optional[Any] = None, on_change_callback: Optional[Callable[[str, str], None]] = None):
        super().__init__()
        self.watch_dir = Path(watch_dir)
        self.neo4j_driver = neo4j_driver
        self.on_change_callback = on_change_callback
        self.rdf_converter = ZettelToRDFConverter()
        self.cypher_converter = ZettelToCypherConverter()

    def _is_markdown(self, filepath: str) -> bool:
        return filepath.endswith(".md") and not Path(filepath).name.startswith(".")

    def on_created(self, event: FileSystemEvent) -> None:
        if event.is_directory or not self._is_markdown(event.src_path):
            return
        p = Path(event.src_path)
        print(f"➕ [GraphWatcher] File creato: {p.name}")

        try:
            note_data = self.rdf_converter.parse_markdown_file(p, input_dir=self.watch_dir)
            cypher_statements = self.cypher_converter.convert_notes_to_cypher([note_data])
            self._execute_cypher(cypher_statements)

            if self.on_change_callback:
                self.on_change_callback("CREATED", str(p))
        except Exception as e:
            print(f"❌ Error processing created file {p.name}: {e}")

    def on_modified(self, event: FileSystemEvent) -> None:
        if event.is_directory or not self._is_markdown(event.src_path):
            return
        p = Path(event.src_path)
        print(f"✏️ [GraphWatcher] File modificato: {p.name}")

        try:
            note_data = self.rdf_converter.parse_markdown_file(p, input_dir=self.watch_dir)
            cypher_statements = self.cypher_converter.convert_notes_to_cypher([note_data])
            self._execute_cypher(cypher_statements)

            if self.on_change_callback:
                self.on_change_callback("MODIFIED", str(p))
        except Exception as e:
            print(f"❌ Error processing modified file {p.name}: {e}")

    def on_deleted(self, event: FileSystemEvent) -> None:
        if event.is_directory or not self._is_markdown(event.src_path):
            return
        p = Path(event.src_path)
        print(f"🗑️ [GraphWatcher] File eliminato: {p.name}")

        try:
            note_slug = slugify(p.stem)
            delete_query = f"MATCH (n:PermanentNote {{id: '{note_slug}'}}) DETACH DELETE n;"
            self._execute_cypher([delete_query])

            if self.on_change_callback:
                self.on_change_callback("DELETED", str(p))
        except Exception as e:
            print(f"❌ Error processing deleted file {p.name}: {e}")

    def _execute_cypher(self, statements: list) -> None:
        """Executes Cypher statements against Neo4j driver if available."""
        if self.neo4j_driver:
            try:
                with self.neo4j_driver.session() as session:
                    for stmt in statements:
                        session.run(stmt)
            except Exception as e:
                print(f"⚠️ Neo4j sync error: {e}")


class LiveGraphWatcher:
    """
    Live file watcher service managing observer daemon.
    """

    def __init__(self, watch_dir: str | Path = "wiki", neo4j_driver: Optional[Any] = None):
        self.watch_dir = Path(watch_dir)
        self.neo4j_driver = neo4j_driver
        self.observer = Observer()
        self.handler = GraphSyncHandler(self.watch_dir, neo4j_driver=neo4j_driver)

    def start(self, blocking: bool = False) -> None:
        self.watch_dir.mkdir(parents=True, exist_ok=True)
        self.observer.schedule(self.handler, path=str(self.watch_dir), recursive=True)
        self.observer.start()
        print(f"👀 [LiveGraphWatcher] Avviato monitoraggio live su '{self.watch_dir}'...")

        if blocking:
            try:
                while True:
                    time.sleep(1)
            except KeyboardInterrupt:
                self.stop()

    def stop(self) -> None:
        self.observer.stop()
        self.observer.join()
        print("🛑 [LiveGraphWatcher] Monitoraggio interrotto.")


if __name__ == "__main__":
    watch_folder = sys.argv[1] if len(sys.argv) > 1 else "wiki"
    watcher = LiveGraphWatcher(watch_dir=watch_folder)
    watcher.start(blocking=True)
