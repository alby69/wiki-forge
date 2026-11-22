"""
src/backend/wikiforge/watcher/graph_watcher.py

Incremental Event-Driven Graph Sync File Watcher for wiki-forge.
Watches for changes (creation, modification, deletion) in Markdown files within wiki/
and incrementally updates Neo4j or RDF graph representations.

C2 — the vault -> Neo4j direction is real and idempotent:
  * one parametrized MERGE per note (``$id``, ``$title``, ``$content``,
    ``$hash``, ``$revision`` ...), one ``session.run()`` per statement;
  * ``wf:source`` / ``wf:origin`` / ``wf:contentHash`` / ``wf:lastModified`` /
    ``wf:revision`` metadata;
  * unchanged content is a no-op (no Cypher, no events);
  * deletes use the very same nested ``base_parser.slugify()`` convention as
    the parser, so notes in subfolders resolve to the correct node id;
  * ``on_moved`` + a small debounce coalesce rename churn;
  * a structured ``on_event`` callback emits ``graph.changed`` events while
    the legacy ``on_change_callback(type, path)`` keeps its exact signature.
"""

import argparse
import hashlib
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Optional

# Ensure project root is in sys.path for direct script execution
_file_path = Path(__file__).resolve()
_REPO_ROOT: Optional[Path] = None
for _parent in _file_path.parents:
    if (_parent / "src").is_dir() and (_parent / "config").is_dir():
        if str(_parent) not in sys.path:
            sys.path.insert(0, str(_parent))
        _REPO_ROOT = _parent
        break

# C4 — ``watchdog`` is an optional runtime dependency. Importing this module
# (e.g. from the API tool) must stay possible on installations without it; only
# ``LiveGraphWatcher`` actually needs the observer.
try:
    from watchdog.observers import Observer
    from watchdog.events import FileSystemEventHandler, FileSystemEvent

    WATCHDOG_AVAILABLE = True
except ImportError:  # pragma: no cover - exercised by dependency-free installs
    WATCHDOG_AVAILABLE = False
    Observer = None  # type: ignore[assignment,misc]

    class FileSystemEventHandler:  # type: ignore[no-redef]
        """Minimal stand-in keeping ``GraphSyncHandler`` importable."""

        def on_created(self, event: Any) -> None: pass
        def on_modified(self, event: Any) -> None: pass
        def on_deleted(self, event: Any) -> None: pass
        def on_moved(self, event: Any) -> None: pass

    class FileSystemEvent:  # type: ignore[no-redef]
        """Minimal stand-in used only for type annotations."""

        src_path = ""
        dest_path = ""
        is_directory = False

from src.backend.wikiforge.semantics.base_parser import slugify
from src.backend.wikiforge.semantics.markdown_to_rdf import ZettelToRDFConverter
from src.backend.wikiforge.semantics.markdown_to_cypher import ZettelToCypherConverter

StructuredEvent = dict[str, Any]


def resolve_project_wiki(project_id: str | None, repo_root: Path | None = None) -> Path:
    """C2 — ``--project <id>`` resolves to ``projects/<id>/wiki``.

    Without a project id the repository-level ``wiki`` is used. No existence
    check is performed here: ``LiveGraphWatcher.start()`` creates the folder.
    """
    root = repo_root or _REPO_ROOT or Path.cwd()
    if project_id:
        return root / "projects" / project_id / "wiki"
    return root / "wiki"


class GraphSyncHandler(FileSystemEventHandler):
    """
    Event handler for incremental graph updates on markdown file events.
    """

    def __init__(
        self,
        watch_dir: Path,
        neo4j_driver: Optional[Any] = None,
        on_change_callback: Optional[Callable[[str, str], None]] = None,
        neo4j_client: Optional[Any] = None,
        on_event: Optional[Callable[[StructuredEvent], None]] = None,
        debounce_seconds: float = 0.05,
    ):
        super().__init__()
        self.watch_dir = Path(watch_dir)
        self.neo4j_driver = neo4j_driver
        # C1 — optional injected client; the raw-driver argument stays intact so
        # every existing caller keeps working unchanged.
        self.neo4j_client = neo4j_client
        self.on_change_callback = on_change_callback
        # C2 — structured events, independent from the legacy callback.
        self.on_event = on_event
        self.debounce_seconds = max(0.0, debounce_seconds)
        self.rdf_converter = ZettelToRDFConverter()
        self.cypher_converter = ZettelToCypherConverter()

        self._hashes: dict[str, str] = {}
        self._revisions: dict[str, int] = {}
        self._last_seen: dict[tuple[str, str], float] = {}

    def _is_markdown(self, filepath: str) -> bool:
        return filepath.endswith(".md") and not Path(filepath).name.startswith(".")

    def _note_id(self, path: Path) -> str:
        """Mirror ``base_parser.parse_markdown_file`` slug resolution.

        Nested notes are keyed by ``<parent>-<stem>``; using only ``stem`` on
        delete (as the old code did) targeted the wrong node.
        """
        try:
            rel = path.relative_to(self.watch_dir)
        except ValueError:
            rel = Path(path.name)
        if rel.parent != Path("."):
            return slugify(f"{rel.parent.as_posix()}-{rel.stem}")
        return slugify(rel.stem)

    def _relative_path(self, path: Path) -> str:
        try:
            return path.relative_to(self.watch_dir).as_posix()
        except ValueError:
            return Path(path.name).as_posix()

    def _debounced(self, action: str, path: Path) -> bool:
        """Coalesce repeated watchdog events for the same path/action."""
        if self.debounce_seconds <= 0:
            return False
        key = (action, str(path))
        now = time.monotonic()
        previous = self._last_seen.get(key)
        self._last_seen[key] = now
        return previous is not None and (now - previous) < self.debounce_seconds

    def _emit(self, action: str, path: Path, note_id: str, revision: int) -> None:
        payload: StructuredEvent = {
            "event": "graph.changed",
            "origin": "vault",
            "path": self._relative_path(path),
            "id": note_id,
            "revision": revision,
            "action": action,
        }
        if self.on_change_callback:
            # Legacy signature is deliberately untouched (uppercase action).
            self.on_change_callback(action, str(path))
        if self.on_event:
            self.on_event(payload)

    def _sync_note(self, path: Path, action: str) -> None:
        """Parse, hash and MERGE one note. Unchanged content is a no-op."""
        note_id = self._note_id(path)
        try:
            raw = path.read_text(encoding="utf-8")
        except OSError as exc:
            print(f"❌ Cannot read {path.name}: {exc}")
            return

        content_hash = hashlib.sha256(raw.encode("utf-8")).hexdigest()
        if self._hashes.get(note_id) == content_hash:
            return

        try:
            note_data = self.rdf_converter.parse_markdown_file(path, input_dir=self.watch_dir)
        except Exception as exc:
            print(f"❌ Error processing {path.name}: {exc}")
            return

        self._hashes[note_id] = content_hash
        revision = self._revisions.get(note_id, 0) + 1
        self._revisions[note_id] = revision

        try:
            modified = datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc).isoformat()
        except OSError:
            modified = datetime.now(timezone.utc).isoformat()

        statement = (
            "MERGE (n:PermanentNote {id: $id}) "
            "SET n.title = $title, n.content = $content, n.author = $author, "
            "n.`wf:source` = $source, n.`wf:origin` = $origin, "
            "n.`wf:contentHash` = $hash, n.`wf:lastModified` = $lastModified, "
            "n.`wf:revision` = $revision"
        )
        params = {
            "id": note_id,
            "title": note_data.get("title", path.stem),
            "content": note_data.get("body", raw),
            "author": note_data.get("author", "Anonymus"),
            "source": "wikiforge",
            "origin": "vault",
            "hash": content_hash,
            "lastModified": modified,
            "revision": revision,
        }
        self._execute_cypher([(statement, params)])
        self._emit(action, path, note_id, revision)

    def sync_note(self, path: Path | str, action: str = "SYNC") -> None:
        """C4 — public, idempotent single-note sync used by the API tool.

        It reuses exactly the same hash/revision logic as watchdog events, so a
        full vault scan can never issue a duplicate MERGE for an unchanged note.
        """
        self._sync_note(Path(path), action)

    def _delete_note(self, path: Path, action: str = "DELETED") -> None:
        note_id = self._note_id(path)
        revision = self._revisions.get(note_id, 0) + 1
        self._revisions[note_id] = revision
        self._hashes.pop(note_id, None)
        statement = "MATCH (n:PermanentNote {id: $id}) DETACH DELETE n"
        self._execute_cypher([(statement, {"id": note_id})])
        self._emit(action, path, note_id, revision)

    def on_created(self, event: FileSystemEvent) -> None:
        if event.is_directory or not self._is_markdown(event.src_path):
            return
        p = Path(event.src_path)
        print(f"➕ [GraphWatcher] File creato: {p.name}")
        if self._debounced("CREATED", p):
            return
        try:
            self._sync_note(p, "CREATED")
        except Exception as e:
            print(f"❌ Error processing created file {p.name}: {e}")

    def on_modified(self, event: FileSystemEvent) -> None:
        if event.is_directory or not self._is_markdown(event.src_path):
            return
        p = Path(event.src_path)
        print(f"✏️ [GraphWatcher] File modificato: {p.name}")
        if self._debounced("MODIFIED", p):
            return
        try:
            self._sync_note(p, "MODIFIED")
        except Exception as e:
            print(f"❌ Error processing modified file {p.name}: {e}")

    def on_deleted(self, event: FileSystemEvent) -> None:
        if event.is_directory or not self._is_markdown(event.src_path):
            return
        p = Path(event.src_path)
        print(f"🗑️ [GraphWatcher] File eliminato: {p.name}")
        if self._debounced("DELETED", p):
            return
        try:
            self._delete_note(p)
        except Exception as e:
            print(f"❌ Error processing deleted file {p.name}: {e}")

    def on_moved(self, event: FileSystemEvent) -> None:
        """C2 — a rename is one delete + one MERGE, with a single event pair."""
        src = Path(event.src_path)
        dest = Path(getattr(event, "dest_path", ""))
        if event.is_directory or not self._is_markdown(str(dest)):
            return
        print(f"➡️ [GraphWatcher] File spostato: {src.name} → {dest.name}")
        if self._debounced("MOVED", dest):
            return
        try:
            self._delete_note(src, "MOVED")
            self._sync_note(dest, "MOVED")
        except Exception as e:
            print(f"❌ Error processing moved file {dest.name}: {e}")

    def _effective_driver(self) -> Optional[Any]:
        """C1 — prefer the injected client's driver, keep the raw driver as-is."""
        if self.neo4j_driver is not None:
            return self.neo4j_driver
        if self.neo4j_client is not None:
            connector = getattr(self.neo4j_client, "connect", None)
            if callable(connector):
                connector()  # lazy: no-op when the client is disabled
            return getattr(self.neo4j_client, "driver", None)
        return None

    def _execute_cypher(self, statements: list, params: Optional[dict[str, Any]] = None) -> None:
        """Execute each statement with its own ``session.run()`` call.

        Accepts plain strings (legacy shape) or ``(statement, params)`` tuples
        (C2 parametrized shape). Without a driver this is a no-op by design;
        callbacks are still emitted so legacy consumers keep working.
        """
        driver = self._effective_driver()
        if driver:
            try:
                with driver.session() as session:
                    for entry in statements:
                        if isinstance(entry, tuple):
                            statement, values = entry
                        else:
                            statement, values = entry, params or {}
                        session.run(statement, values)
            except Exception as e:
                print(f"⚠️ Neo4j sync error: {e}")


class LiveGraphWatcher:
    """
    Live file watcher service managing observer daemon.
    """

    def __init__(
        self,
        watch_dir: str | Path = "wiki",
        neo4j_driver: Optional[Any] = None,
        neo4j_client: Optional[Any] = None,
        on_change_callback: Optional[Callable[[str, str], None]] = None,
        on_event: Optional[Callable[[StructuredEvent], None]] = None,
        debounce_seconds: float = 0.05,
    ):
        if Observer is None:  # C4 — dependency-free installs can still sync via API
            raise RuntimeError("watchdog is required for LiveGraphWatcher; install the 'watchdog' package")
        self.watch_dir = Path(watch_dir)
        self.neo4j_driver = neo4j_driver
        # C1 — additive parameter; existing positional calls are unaffected.
        self.neo4j_client = neo4j_client
        self.observer = Observer()
        self.handler = GraphSyncHandler(
            self.watch_dir,
            neo4j_driver=neo4j_driver,
            neo4j_client=neo4j_client,
            on_change_callback=on_change_callback,
            on_event=on_event,
            debounce_seconds=debounce_seconds,
        )

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


def main(argv: list[str] | None = None) -> int:
    """CLI: a watch folder, or ``--project <id>`` -> ``projects/<id>/wiki``."""
    parser = argparse.ArgumentParser(description="Wiki-Forge live vault → Neo4j sync")
    parser.add_argument("watch_dir", nargs="?", default=None, help="wiki folder to watch")
    parser.add_argument("--project", default=os.getenv("WIKIFORGE_PROJECT"), help="project id")
    args = parser.parse_args(argv)
    watch_dir = Path(args.watch_dir) if args.watch_dir else resolve_project_wiki(args.project)
    watcher = LiveGraphWatcher(watch_dir=watch_dir)
    watcher.start(blocking=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
