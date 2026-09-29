"""
tests/test_graph_watcher.py

Unit tests for LiveGraphWatcher and GraphSyncHandler.
"""

import unittest
import tempfile
from pathlib import Path
from src.wikiforge.watcher.graph_watcher import GraphSyncHandler, LiveGraphWatcher


class TestGraphWatcher(unittest.TestCase):

    def test_handler_file_events(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_p = Path(tmp_dir)
            events = []

            def callback(event_type, filepath):
                events.append((event_type, filepath))

            handler = GraphSyncHandler(watch_dir=tmp_p, on_change_callback=callback)

            test_file = tmp_p / "note.md"
            test_file.write_text("# Test Note\n[[supports::other-note]]", encoding="utf-8")

            class MockEvent:
                def __init__(self, path):
                    self.src_path = str(path)
                    self.is_directory = False

            handler.on_created(MockEvent(test_file))
            self.assertEqual(len(events), 1)
            self.assertEqual(events[0][0], "CREATED")


if __name__ == "__main__":
    unittest.main()
