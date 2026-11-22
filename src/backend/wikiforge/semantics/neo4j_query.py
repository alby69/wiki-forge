"""C3 — safe, read-only Cypher execution against an injected Neo4j client.

No driver is imported here: the connection is owned by ``Neo4jClient`` (C1).
Every query is validated before reaching the database, bound through Cypher
parameters (never interpolated), time-boxed and row-limited. Write statements
are rejected with a typed exception even when no driver is configured.
"""

from __future__ import annotations

import re
from typing import Any, Iterable, Mapping, Optional

DEFAULT_TIMEOUT_SECONDS = 5.0
DEFAULT_MAX_ROWS = 100

# Clause starters accepted by the generated, read-only queries.
_READ_CLAUSE = re.compile(r"^(?:OPTIONAL\s+)?MATCH\b", re.IGNORECASE)
_RETURN_CLAUSE = re.compile(r"\bRETURN\b", re.IGNORECASE)
_LIMIT_CLAUSE = re.compile(r"\bLIMIT\s+\d+\b", re.IGNORECASE)

# Anything that can mutate data, change the schema, call procedures or run a
# second statement. Extracted from a comment/string-free normalization, so
# literal text such as a note titled "DELETE me" cannot trigger a false positive.
_FORBIDDEN = re.compile(
    r"\b(CREATE|MERGE|SET|DELETE|DETACH|REMOVE|DROP|ALTER|INSERT|UPDATE|"
    r"CALL|FOREACH|LOAD\s+CSV|USING|CONSTRAINT|INDEX|APOC|UNION)\b",
    re.IGNORECASE,
)
_COMMENT_LINE = re.compile(r"//[^\n]*")
_COMMENT_BLOCK = re.compile(r"/\*.*?\*/", re.DOTALL)
_STRING_LITERAL = re.compile(r"'(?:\\.|[^'\\])*'|\"(?:\\.|[^\"\\])*\"|`(?:\\.|[^`\\])*`", re.DOTALL)


class CypherQueryError(Exception):
    """Base class for typed query failures."""

    code = "query_error"


class ReadOnlyViolation(CypherQueryError):
    """The submitted statement is not an allowed single read-only MATCH/RETURN."""

    code = "read_only_violation"


class QueryExecutionError(CypherQueryError):
    """The driver failed while running an otherwise valid read query."""

    code = "query_execution_error"


def strip_cypher_noise(cypher: str) -> str:
    """Remove comments and quoted literals, replacing them with a space.

    This keeps keyword checks honest: a title containing the word ``SET`` is
    data, not a clause, while ``SET n.x = 1`` is a mutation.
    """
    cleaned = _COMMENT_BLOCK.sub(" ", cypher)
    cleaned = _COMMENT_LINE.sub(" ", cleaned)
    return _STRING_LITERAL.sub(" ", cleaned)


def validate_read_only(cypher: str) -> str:
    """Validate one read-only statement; return the comment-free query.

    Raises ``ReadOnlyViolation`` for empty/multiple statements, anything that
    does not start with MATCH, a missing RETURN, or forbidden write/procedure
    keywords.
    """
    if not isinstance(cypher, str) or not cypher.strip():
        raise ReadOnlyViolation("Cypher query must be a non-empty string")

    cleaned = strip_cypher_noise(cypher)
    statements = [part.strip() for part in cleaned.split(";") if part.strip()]
    if len(statements) != 1:
        raise ReadOnlyViolation("Exactly one Cypher statement is allowed")
    statement = statements[0]
    if not _READ_CLAUSE.match(statement):
        raise ReadOnlyViolation("Only MATCH / OPTIONAL MATCH read queries are allowed")
    if not _RETURN_CLAUSE.search(statement):
        raise ReadOnlyViolation("A read query must contain a RETURN clause")
    forbidden = _FORBIDDEN.search(statement)
    if forbidden:
        raise ReadOnlyViolation(f"Write/procedure clause not allowed: {forbidden.group(1).upper()}")
    return statement


class Neo4jQueryService:
    """Execute validated read-only Cypher through the injected client/driver."""

    def __init__(
        self,
        client: Optional[Any] = None,
        *,
        driver: Optional[Any] = None,
        timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS,
        max_rows: int = DEFAULT_MAX_ROWS,
    ) -> None:
        self.client = client
        self._driver = driver
        try:
            self.timeout_seconds = float(timeout_seconds)
            self.max_rows = int(max_rows)
        except (TypeError, ValueError) as exc:
            raise ValueError("timeout_seconds and max_rows must be numbers") from exc
        if self.timeout_seconds <= 0 or self.max_rows <= 0:
            raise ValueError("timeout_seconds and max_rows must be positive")

    @property
    def is_live(self) -> bool:
        """True only when a real driver can be obtained from the injection."""
        return self._effective_driver() is not None

    def _effective_driver(self) -> Optional[Any]:
        if self._driver is not None:
            return self._driver
        if self.client is None:
            return None
        connector = getattr(self.client, "connect", None)
        if callable(connector):
            connector()  # lazy: no-op for a disabled client
        return getattr(self.client, "driver", None)

    def _database_for(self, project_id: Optional[str]) -> Optional[str]:
        if not project_id:
            return None
        config = getattr(self.client, "config", None)
        resolver = getattr(config, "database_for", None)
        if callable(resolver):
            return resolver(project_id)
        return None

    @staticmethod
    def _with_row_limit(cypher: str, limit: int) -> str:
        if _LIMIT_CLAUSE.search(strip_cypher_noise(cypher)):
            return cypher
        return f"{cypher.rstrip()}\nLIMIT {limit}"

    @staticmethod
    def _records_to_dicts(records: Optional[Iterable[Any]]) -> list[dict[str, Any]]:
        if records is None:
            return []
        # Both dict rows and neo4j.Record objects implement the mapping protocol.
        return [dict(record) for record in records]

    def execute_read(
        self,
        cypher: str,
        params: Optional[Mapping[str, Any]] = None,
        project_id: Optional[str] = None,
    ) -> list[dict[str, Any]]:
        """Run one validated read query; return at most ``max_rows`` dict rows.

        ``params`` are always passed as a parameter map; no value is ever
        formatted into the query string. ``project_id`` selects the configured
        database when the injected client exposes a project mapping.
        """
        statement = validate_read_only(cypher)
        if params is not None and not isinstance(params, Mapping):
            raise ReadOnlyViolation("Cypher parameters must be a mapping")
        driver = self._effective_driver()
        if driver is None:
            # Validation still succeeded; callers decide the mode explicitly.
            return []

        bounded = self._with_row_limit(statement, self.max_rows)
        database = self._database_for(project_id)
        try:
            session = driver.session(database=database) if database else driver.session()
            with session as active:
                result = active.run(bounded, dict(params or {}), timeout=self.timeout_seconds)
                return self._records_to_dicts(result)[:self.max_rows]
        except CypherQueryError:
            raise
        except Exception as exc:  # noqa: BLE001 - driver errors are wrapped once
            raise QueryExecutionError(f"Neo4j read query failed: {exc}") from exc


__all__ = [
    "CypherQueryError",
    "DEFAULT_MAX_ROWS",
    "DEFAULT_TIMEOUT_SECONDS",
    "Neo4jQueryService",
    "QueryExecutionError",
    "ReadOnlyViolation",
    "validate_read_only",
]
