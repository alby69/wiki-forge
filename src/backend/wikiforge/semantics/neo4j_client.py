"""C1 — single, injectable Neo4j connection point.

The driver is imported **lazily** inside the default factory: importing this
module (and therefore any watcher or RAG pipeline that uses it) never imports
``neo4j`` and never opens a socket. A disabled config, or a missing password,
makes every operation a no-op, so deployments without Neo4j stay unaffected.

``connect()`` accepts a ``driver_factory`` so tests can inject a fake driver and
verify connect/verify/close without a database or any network access.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Mapping, Optional, Protocol

DEFAULT_URI = "bolt://localhost:7687"
DEFAULT_USER = "neo4j"
DEFAULT_PASSWORD_ENV = "NEO4J_PASSWORD"
DEFAULT_DATABASE = "neo4j"


@dataclass(frozen=True)
class Neo4jConfig:
    """Declarative connection settings; secrets are never stored here.

    The password is only read from the environment named by ``password_env``.
    Keeping it out of the dataclass avoids leaking it through ``repr()`` or a
    config dump.
    """

    enabled: bool = False
    uri: str = DEFAULT_URI
    user: str = DEFAULT_USER
    password_env: str = DEFAULT_PASSWORD_ENV
    database: str = DEFAULT_DATABASE
    tls: bool = False
    projects: Mapping[str, str] = field(default_factory=dict)

    @classmethod
    def from_config(
        cls,
        config: Mapping[str, Any] | None = None,
        *,
        project: str | None = None,
        target_dir: str | Path | None = None,
    ) -> "Neo4jConfig":
        """Build from the ``[neo4j]`` table of a config mapping.

        When ``config`` is omitted the repository ``config.toml`` is loaded via
        the existing, shape-validated loader. ``project`` selects the mapped
        database (falling back to ``default`` and then to ``database``).
        """
        if config is None:
            from src.backend.wikiforge.core.config import get_project_config

            config = get_project_config(target_dir)
        section = config.get("neo4j", {}) if isinstance(config, Mapping) else {}
        if not isinstance(section, Mapping):
            section = {}
        projects = section.get("projects", {})
        settings = cls(
            enabled=bool(section.get("enabled", False)),
            uri=str(section.get("uri", DEFAULT_URI)),
            user=str(section.get("user", DEFAULT_USER)),
            password_env=str(section.get("passwordEnv", DEFAULT_PASSWORD_ENV)),
            database=str(section.get("database", DEFAULT_DATABASE)),
            tls=bool(section.get("tls", False)),
            projects=dict(projects) if isinstance(projects, Mapping) else {},
        )
        return settings.with_database(project) if project else settings

    @classmethod
    def from_env(
        cls,
        environ: Mapping[str, str] | None = None,
        *,
        project: str | None = None,
    ) -> "Neo4jConfig":
        """Build from ``NEO4J_*`` environment variables (opt-in, default off)."""
        env: Mapping[str, str] = os.environ if environ is None else environ
        settings = cls(
            enabled=_env_bool(env.get("NEO4J_ENABLED")),
            uri=env.get("NEO4J_URI", DEFAULT_URI),
            user=env.get("NEO4J_USER", DEFAULT_USER),
            password_env=env.get("NEO4J_PASSWORD_ENV", DEFAULT_PASSWORD_ENV),
            database=env.get("NEO4J_DATABASE", DEFAULT_DATABASE),
            tls=_env_bool(env.get("NEO4J_TLS")),
        )
        return settings.with_database(project) if project else settings

    def password(self, environ: Mapping[str, str] | None = None) -> str | None:
        """Read the password from the configured environment variable."""
        env: Mapping[str, str] = os.environ if environ is None else environ
        value = env.get(self.password_env)
        return value or None

    def database_for(self, project: str | None) -> str:
        """Resolve a project name to its mapped database."""
        if not project:
            return self.database
        return self.projects.get(project, self.projects.get("default", self.database))

    def with_database(self, project: str | None) -> "Neo4jConfig":
        """Return a copy whose ``database`` is resolved for ``project``."""
        if not project:
            return self
        return Neo4jConfig(
            enabled=self.enabled,
            uri=self.uri,
            user=self.user,
            password_env=self.password_env,
            database=self.database_for(project),
            tls=self.tls,
            projects=self.projects,
        )

    def effective_uri(self) -> str:
        """Apply TLS by upgrading the URI scheme (neo4j 5.x style)."""
        if not self.tls:
            return self.uri
        for plain, secure in (("bolt://", "bolt+s://"), ("neo4j://", "neo4j+s://")):
            if self.uri.startswith(plain):
                return secure + self.uri[len(plain):]
        return self.uri


def _env_bool(value: str | None) -> bool:
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


class Neo4jDriverLike(Protocol):
    """Minimal surface the rest of Wiki-Forge needs from a neo4j driver."""

    def session(self, database: str | None = None, **kwargs: Any) -> Any: ...

    def verify_connectivity(self) -> Any: ...

    def close(self) -> Any: ...


DriverFactory = Callable[[Neo4jConfig, str], Neo4jDriverLike]


def _default_driver_factory(config: Neo4jConfig, password: str) -> Neo4jDriverLike:
    """Import the real driver only when a connection is actually requested."""
    from neo4j import GraphDatabase  # noqa: PLC0415 - deliberate lazy import

    return GraphDatabase.driver(
        config.effective_uri(),
        auth=(config.user, password),
        database=config.database,
    )


class Neo4jClient:
    """Own the driver lifecycle; a no-op when Neo4j is not configured.

    ``driver_factory`` is the single injection seam used by the tests. Existing
    constructors (``LiveGraphWatcher``, ``WikiForgeGraphRAG``) keep working: they
    simply receive an optional client they may use instead of a raw driver.
    """

    def __init__(
        self,
        config: Neo4jConfig | Mapping[str, Any] | None = None,
        *,
        driver_factory: DriverFactory | None = None,
        password: str | None = None,
        environ: Mapping[str, str] | None = None,
    ) -> None:
        if isinstance(config, Neo4jConfig):
            self.config = config
        else:
            self.config = Neo4jConfig.from_config(config)
        self._driver_factory = driver_factory or _default_driver_factory
        self._password = password
        self._environ: Mapping[str, str] = os.environ if environ is None else environ
        self._driver: Neo4jDriverLike | None = None

    @property
    def enabled(self) -> bool:
        return self.config.enabled

    @property
    def is_connected(self) -> bool:
        return self._driver is not None

    @property
    def driver(self) -> Neo4jDriverLike | None:
        """The live driver, or ``None`` when disabled/not connected yet."""
        return self._driver

    def connect(self) -> Neo4jDriverLike | None:
        """Create the driver once. Returns ``None`` without touching the network
        when disabled or when the configured password variable is unset.
        """
        if self._driver is not None:
            return self._driver
        if not self.config.enabled:
            return None
        password = self._password or self.config.password(self._environ)
        if not password:
            return None
        self._driver = self._driver_factory(self.config, password)
        return self._driver

    def verify_connectivity(self) -> bool:
        """Return ``True`` only if a real ping succeeds; never raise for an
        unconfigured deployment.
        """
        driver = self.connect()
        if driver is None:
            return False
        try:
            driver.verify_connectivity()
            return True
        except Exception:  # noqa: BLE001 - a dead DB must not break the app
            return False

    def session(self, database: str | None = None, **kwargs: Any) -> Any | None:
        """Convenience for the C2 sync: a session or ``None`` when disabled."""
        driver = self.connect()
        if driver is None:
            return None
        return driver.session(database=database or self.config.database, **kwargs)

    def close(self) -> None:
        """Idempotent shutdown; safe even if ``connect()`` was never called."""
        driver = self._driver
        self._driver = None
        if driver is None:
            return
        try:
            driver.close()
        except Exception:  # noqa: BLE001 - shutdown must not break the app
            pass

    def __enter__(self) -> "Neo4jClient":
        self.connect()
        return self

    def __exit__(self, exc_type: Any, exc: Any, tb: Any) -> None:
        self.close()


__all__ = [
    "DEFAULT_DATABASE",
    "DEFAULT_PASSWORD_ENV",
    "DEFAULT_URI",
    "DEFAULT_USER",
    "DriverFactory",
    "Neo4jClient",
    "Neo4jConfig",
    "Neo4jDriverLike",
]
