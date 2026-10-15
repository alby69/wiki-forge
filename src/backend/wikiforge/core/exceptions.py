"""
exceptions.py — Standardized exception hierarchy for Wiki-Forge backend and scripts.

WHAT THIS DOES
--------------
Defines domain-specific exception types to replace bare `except Exception:` catches,
enabling robust, readable, and actionable error handling across Wiki-Forge.
"""

class WikiForgeError(Exception):
    """Base exception class for all Wiki-Forge errors."""
    pass


class ConfigError(WikiForgeError):
    """Raised when configuration files or environment setups are invalid/missing."""
    pass


class ConversionError(WikiForgeError):
    """Raised when source conversion (PDF, EPUB, DOCX, Markdown CoT) fails."""
    pass


class GraphValidationError(WikiForgeError):
    """Raised when RDF/SHACL/Cypher knowledge graph validation fails."""
    pass


class QueryExecutionError(WikiForgeError):
    """Raised when CQ or graph query execution fails."""
    pass
