import unittest
from src.backend.core import load_config, SUPPORTED_EXTS

class TestCoreAPI(unittest.TestCase):
    def test_supported_exts(self):
        self.assertIn('.md', SUPPORTED_EXTS)
        self.assertIn('.pdf', SUPPORTED_EXTS)

    def test_load_config(self):
        config = load_config()
        self.assertIsNotNone(config)

if __name__ == '__main__':
    unittest.main()
