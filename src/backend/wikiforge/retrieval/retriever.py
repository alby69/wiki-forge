"""Dependency-free hybrid retrieval for Wiki-Forge.

The module exposes the ``Retriever`` port used by Node routes and by the
Python evaluation runner. It implements BM25 (incremental, persisted on disk),
optional RRF-fused semantic ranking from precomputed vectors, and one-hop
graph expansion over ``[[wikilinks]]``. No model or third-party library is
needed: embeddings are disabled by default and only vectors already present on
disk are consumed when explicitly enabled.
"""

from __future__ import annotations

import json
import math
import re
import tomllib
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Iterable, Mapping, Protocol, Sequence

from ..core.exceptions import RetrievalError

_STOPWORDS = frozenset(
    """
    a alla alle allo anche come dalla dalle dallo degli della delle dello dove
    e essere fa fare fatta fatti fatto gia gli il in la le loro lui ma nel nella
    nelle nello no non nostro o ogni per perche perche piu poi qua questa queste
    questi questo quei si sono sta stato sua sue sui suo sulla sulle sullo than
    the their te ti un una uno vi viene vengono voi
    about after again against all also an and are as at be been before being
    between both but by can could did do does doing during each for from had has
    have having he her here hers him his how i if in into is it its me more most
    my no nor not of on once only or other our out over own same she should so
    some such than that the their them then there these they this those through
    to too under until up very was we were what when where which while who why
    will with would you your
    """.split()
)

_TOKEN_RE = re.compile(r"[^\W_]+(?:['’-][^\W_]+)*", re.UNICODE)
_WIKILINK_RE = re.compile(r"\[\[([^\]|#]+)(?:[#|][^\]]*)?\]\]")


@dataclass(frozen=True)
class NoteDocument:
    id: str
    title: str = ""
    content: str = ""
    path: str = ""
    tags: tuple[str, ...] = ()
    links: tuple[str, ...] = ()

    @classmethod
    def from_mapping(cls, data: Mapping[str, Any]) -> "NoteDocument":
        note_id = str(data.get("id") or data.get("note_id") or "").strip()
        if not note_id:
            raise RetrievalError("retrieval note is missing an id")
        raw_tags = data.get("tags") or ()
        raw_links = data.get("links") or data.get("outboundLinks") or ()
        if isinstance(raw_tags, str):
            raw_tags = [raw_tags]
        if isinstance(raw_links, str):
            raw_links = [raw_links]
        return cls(
            id=note_id,
            title=str(data.get("title") or ""),
            content=str(data.get("content") or data.get("text") or ""),
            path=str(data.get("path") or ""),
            tags=tuple(str(tag) for tag in raw_tags),
            links=tuple(str(link) for link in raw_links),
        )


@dataclass(frozen=True)
class RetrievalHit:
    note_id: str
    score: float
    channel: str = "lexical"

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.note_id,
            "note_id": self.note_id,
            "score": round(self.score, 6),
            "channel": self.channel,
        }


@dataclass(frozen=True)
class EmbeddingsConfig:
    enabled: bool = False
    dimensions: int = 0
    vectors_path: str = ".wiki-forge/index/vectors.json"

    @classmethod
    def load(cls, root: Path, config_path: Path | None = None) -> "EmbeddingsConfig":
        """Read only the ``[retrieval.embeddings]`` table; missing means disabled."""
        candidates = [config_path] if config_path else [
            root / "config" / "config.toml",
            root / "config.toml",
        ]
        for candidate in candidates:
            if candidate is None or not candidate.is_file():
                continue
            try:
                data = tomllib.loads(candidate.read_text(encoding="utf-8"))
            except (OSError, tomllib.TOMLDecodeError) as exc:
                raise RetrievalError(f"cannot read retrieval config {candidate}: {exc}") from exc
            section = data.get("retrieval", {})
            table = section.get("embeddings", {}) if isinstance(section, dict) else {}
            if not isinstance(table, dict):
                raise RetrievalError(f"retrieval.embeddings must be a table in {candidate}")
            return cls(
                enabled=bool(table.get("enabled", False)),
                dimensions=int(table.get("dimensions", 0)),
                vectors_path=str(table.get("vectors_path", cls.vectors_path)),
            )
        return cls()


class Retriever(Protocol):
    """Port consumed by routes; implementations never leak ranking internals."""

    def retrieve(self, query: str, limit: int = 5) -> list[RetrievalHit]:
        ...

    def upsert(self, note: NoteDocument) -> bool:
        ...


def tokenize(text: str) -> list[str]:
    """Bilingual (IT/EN) deterministic tokenizer used for BM25 and baselines."""
    return [
        token
        for token in _TOKEN_RE.findall(text.lower())
        if len(token) > 1 and token not in _STOPWORDS
    ]


def index_terms(note: NoteDocument) -> list[str]:
    """Title and tags are repeated so they outrank incidental body mentions."""
    terms = list(tokenize(note.title)) * 3
    for tag in note.tags:
        terms.extend(tokenize(tag) * 2)
    terms.extend(tokenize(note.content))
    return terms


def _normalize_link(link: str) -> str:
    return link.strip().strip("/").removesuffix(".md").lower()


class BM25Index:
    """Incremental BM25 index persisted as JSON under ``.wiki-forge/index``."""

    K1 = 1.5
    B = 0.75

    def __init__(self, path: Path):
        self.path = Path(path)
        self.docs: dict[str, dict[str, Any]] = {}
        self.df: dict[str, int] = {}
        self.total_len = 0
        self._load()

    def _load(self) -> None:
        if not self.path.is_file():
            return
        try:
            payload = json.loads(self.path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise RetrievalError(f"cannot read BM25 index {self.path}: {exc}") from exc
        if not isinstance(payload, dict):
            raise RetrievalError(f"BM25 index {self.path} must contain a JSON object")
        docs = payload.get("docs", {})
        df = payload.get("df", {})
        if not isinstance(docs, dict) or not isinstance(df, dict):
            raise RetrievalError(f"BM25 index {self.path} has invalid docs/df tables")
        self.docs = docs
        self.df = {str(term): int(count) for term, count in df.items()}
        self.total_len = int(payload.get("total_len", 0))

    def save(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        payload = {"version": 1, "docs": self.docs, "df": self.df, "total_len": self.total_len}
        temporary = self.path.with_name(f".{self.path.name}.tmp")
        try:
            temporary.write_text(
                json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")),
                encoding="utf-8",
            )
            temporary.replace(self.path)
        except OSError as exc:
            raise RetrievalError(f"cannot write BM25 index {self.path}: {exc}") from exc

    def _remove(self, note_id: str) -> None:
        previous = self.docs.pop(note_id, None)
        if not previous:
            return
        self.total_len -= int(previous.get("length", 0))
        for term in previous.get("tokens", {}):
            remaining = self.df.get(term, 0) - 1
            if remaining > 0:
                self.df[term] = remaining
            else:
                self.df.pop(term, None)

    def upsert(self, note: NoteDocument) -> bool:
        counts = dict(Counter(index_terms(note)))
        previous = self.docs.get(note.id)
        if previous and previous.get("tokens") == counts and previous.get("links") == list(note.links):
            return False
        self._remove(note.id)
        length = sum(counts.values())
        self.docs[note.id] = {
            "title": note.title,
            "path": note.path,
            "tokens": counts,
            "length": length,
            "links": [_normalize_link(link) for link in note.links],
        }
        self.total_len += length
        for term in counts:
            self.df[term] = self.df.get(term, 0) + 1
        return True

    def remove(self, note_id: str) -> bool:
        if note_id not in self.docs:
            return False
        self._remove(note_id)
        return True

    def sync(self, notes: Iterable[NoteDocument], *, remove_missing: bool = True) -> int:
        incoming = list(notes)
        ids = {note.id for note in incoming}
        changed = sum(1 for note in incoming if self.upsert(note))
        if remove_missing:
            for stale in sorted(set(self.docs) - ids):
                changed += int(self.remove(stale))
        return changed

    def graph(self) -> dict[str, list[str]]:
        return {
            note_id: sorted(set(doc.get("links", [])) - {note_id})
            for note_id, doc in self.docs.items()
        }

    def search(self, query: str, limit: int = 5) -> list[RetrievalHit]:
        terms = [term for term in dict.fromkeys(tokenize(query)) if term in self.df]
        total = len(self.docs)
        if not terms or total == 0 or self.total_len == 0:
            return []
        avgdl = self.total_len / total
        results: list[RetrievalHit] = []
        for note_id, doc in self.docs.items():
            counts = doc.get("tokens", {})
            length = int(doc.get("length", 0))
            score = 0.0
            for term in terms:
                frequency = int(counts.get(term, 0))
                if frequency == 0:
                    continue
                idf = math.log(1.0 + (total - self.df[term] + 0.5) / (self.df[term] + 0.5))
                denominator = frequency + self.K1 * (1.0 - self.B + self.B * length / avgdl)
                score += idf * frequency * (self.K1 + 1.0) / denominator
            if score > 0:
                results.append(RetrievalHit(note_id, score, "lexical"))
        results.sort(key=lambda hit: (-hit.score, hit.note_id))
        return results[:limit]


class DiskVectorStore:
    """Reads precomputed vectors from disk; no embedding library is imported."""

    def __init__(self, config: EmbeddingsConfig, root: Path):
        self.config = config
        path = Path(config.vectors_path)
        self.path = path if path.is_absolute() else root / path
        self.vectors: dict[str, list[float]] = {}
        if not config.enabled:
            return
        if not self.path.is_file():
            return
        try:
            payload = json.loads(self.path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise RetrievalError(f"cannot read vector store {self.path}: {exc}") from exc
        if not isinstance(payload, dict):
            raise RetrievalError(f"vector store {self.path} must contain a JSON object")
        self.vectors = {
            str(key): [float(value) for value in values]
            for key, values in payload.items()
            if isinstance(values, list)
        }

    @staticmethod
    def _cosine(left: Sequence[float], right: Sequence[float]) -> float:
        if not left or not right or len(left) != len(right):
            return 0.0
        dot = sum(a * b for a, b in zip(left, right))
        norm_left = math.sqrt(sum(a * a for a in left))
        norm_right = math.sqrt(sum(b * b for b in right))
        return dot / (norm_left * norm_right) if norm_left and norm_right else 0.0

    def search(self, query_vector: Sequence[float] | None, limit: int = 5) -> list[RetrievalHit]:
        if not self.config.enabled or not query_vector or not self.vectors:
            return []
        results = [
            RetrievalHit(note_id, self._cosine(query_vector, vector), "semantic")
            for note_id, vector in self.vectors.items()
        ]
        results = [hit for hit in results if hit.score > 0]
        results.sort(key=lambda hit: (-hit.score, hit.note_id))
        return results[:limit]


def rrf_fuse(rankings: Sequence[tuple[Sequence[str], str]], k: int = 60) -> list[RetrievalHit]:
    """Reciprocal Rank Fusion with deterministic tie-breaking by note id."""
    scores: dict[str, float] = {}
    channels: dict[str, set[str]] = {}
    for note_ids, channel in rankings:
        for rank, note_id in enumerate(note_ids, start=1):
            scores[note_id] = scores.get(note_id, 0.0) + 1.0 / (k + rank)
            channels.setdefault(note_id, set()).add(channel)
    hits = [
        RetrievalHit(note_id, score, "+".join(sorted(channels[note_id])))
        for note_id, score in scores.items()
    ]
    hits.sort(key=lambda hit: (-hit.score, hit.note_id))
    return hits


def graph_expand(
    hits: Sequence[RetrievalHit],
    graph: Mapping[str, Sequence[str]],
    *,
    seeds: int = 5,
    per_seed: int = 2,
    decay: float = 0.92,
) -> list[RetrievalHit]:
    """Insert one-hop neighbours directly after their seed (single hop only)."""
    expanded: list[RetrievalHit] = []
    seen: set[str] = set()
    for hit in hits:
        if hit.note_id in seen:
            continue
        seen.add(hit.note_id)
        expanded.append(hit)
        seed_index = sum(1 for item in expanded if item.channel != "graph")
        if seed_index > seeds:
            continue
        neighbours = [
            neighbour
            for neighbour in graph.get(hit.note_id, [])
            if neighbour not in seen and neighbour in {node for node in graph}
        ]
        for neighbour in neighbours[:per_seed]:
            seen.add(neighbour)
            expanded.append(
                RetrievalHit(neighbour, hit.score * decay, f"graph:{hit.note_id}")
            )
    return expanded


@dataclass
class HybridRetriever:
    """RRF-fused BM25 + optional vectors + one-hop graph expansion."""

    index: BM25Index
    embeddings: EmbeddingsConfig = field(default_factory=EmbeddingsConfig)
    vectors: DiskVectorStore | None = None
    rrf_k: int = 60
    hops: int = 1

    def retrieve(
        self,
        query: str,
        limit: int = 5,
        query_vector: Sequence[float] | None = None,
    ) -> list[RetrievalHit]:
        lexical = self.index.search(query, max(limit * 4, 20))
        semantic = self.vectors.search(query_vector, max(limit * 4, 20)) if self.vectors else []
        if not lexical and not semantic:
            return []
        fused = rrf_fuse(
            [
                ([hit.note_id for hit in lexical], "lexical"),
                ([hit.note_id for hit in semantic], "semantic"),
            ],
            k=self.rrf_k,
        )
        ranked = graph_expand(fused, self.index.graph()) if self.hops > 0 else fused
        return ranked[: max(1, limit)]

    def upsert(self, note: NoteDocument) -> bool:
        return self.index.upsert(note)

    def remove(self, note_id: str) -> bool:
        return self.index.remove(note_id)

    def sync(self, notes: Iterable[NoteDocument], *, remove_missing: bool = True) -> int:
        return self.index.sync(notes, remove_missing=remove_missing)

    def save(self) -> None:
        self.index.save()


def index_path(root: Path, scope: str = "default") -> Path:
    """Index location shared by the CLI, routes and evaluation runner."""
    from ..state_root import canonical_root

    safe = re.sub(r"[^a-zA-Z0-9_-]+", "-", scope or "default").strip("-") or "default"
    return canonical_root(root) / "index" / f"bm25-{safe}.json"


def build_hybrid_retriever(
    root: Path,
    scope: str = "default",
    *,
    config_path: Path | None = None,
) -> HybridRetriever:
    embeddings = EmbeddingsConfig.load(Path(root), config_path)
    retriever = HybridRetriever(
        index=BM25Index(index_path(Path(root), scope)),
        embeddings=embeddings,
        vectors=DiskVectorStore(embeddings, Path(root)),
    )
    return retriever
