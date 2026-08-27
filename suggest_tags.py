#!/usr/bin/env python3
"""
suggest_tags.py — Suggest (and optionally write) tags for wiki notes.

WHAT THIS DOES
--------------
Helps keep the tag taxonomy coherent (see config.toml -> [tags]). For each note
it proposes tags drawn from the controlled `allowed` vocabulary, so the agent
(and you) don't end up with `#LLM`, `#llm`, `#ai-model` fragmentation.

It is intentionally dependency-light (Unix KISS philosophy):
  * By default it uses a small, self-contained RAKE implementation (no deps).
  * If `keybert` + `sentence-transformers` are installed, it ranks the allowed
    tags semantically by cosine similarity to the note (much better suggestions).
  * The `allowed` / `blocked` lists come from `config.toml` (same loader style as
    conv2md.py), falling back to built-in defaults when the file is absent.

USAGE
-----
  python suggest_tags.py wiki/ai/foo.md                 # print suggestions
  python suggest_tags.py wiki/ai/foo.md --write         # add suggestions to frontmatter
  python suggest_tags.py --all --write                  # batch over the whole wiki/
  python suggest_tags.py wiki/ai/foo.md --top 6 --write # keep at most 6 tags

Optional (semantic mode):
  pip install keybert sentence-transformers
  python suggest_tags.py wiki/ai/foo.md --semantic
"""

from __future__ import annotations

import argparse
import re
import sys
from collections import Counter
from pathlib import Path

# ---------------------------------------------------------------------------
# Configuration (mirrors conv2md.py: tomllib with safe defaults)
# ---------------------------------------------------------------------------


def load_config() -> dict:
    defaults = {
        "paths": {"wiki": "wiki"},
        "tags": {"allowed": [], "blocked": []},
    }
    try:
        import tomllib  # Python 3.11+
    except ImportError:
        return defaults

    cfg_path = Path("config.toml")
    if not cfg_path.is_file():
        return defaults

    with cfg_path.open("rb") as fh:
        data = tomllib.load(fh)
    merged = defaults.copy()
    for section, values in data.items():
        if isinstance(values, dict):
            merged.setdefault(section, {}).update(values)
    return merged


# ---------------------------------------------------------------------------
# RAKE (Rapid Automatic Keyword Extraction) — pure Python, no dependencies
# ---------------------------------------------------------------------------

RAKE_STOPWORDS = set(
    """
    a an the and or but if then else when at by for with about against between
    into through during before after above below to from up down in out on off
    over under again further once here there all any both each few more most other
    some such no nor not only own same so than too very s t can will just don should
    now of is are was were be been being has have had do does did this that these those
    i you he she it we they them his her its their our your my me as per via per
    """.split()
)


def _rake_phrases(text: str, stopwords: set[str]) -> list[list[str]]:
    words = re.findall(r"[a-z0-9][a-z0-9'-]*", text.lower())
    phrases: list[list[str]] = []
    cur: list[str] = []
    for w in words:
        if w in stopwords:
            if cur:
                phrases.append(cur)
                cur = []
        else:
            cur.append(w)
    if cur:
        phrases.append(cur)
    return phrases


def rake_scores(text: str, stopwords: set[str]) -> tuple[dict[str, float], Counter]:
    phrases = _rake_phrases(text, stopwords)
    freq: Counter[str] = Counter()
    deg: Counter[str] = Counter()
    for ph in phrases:
        for w in set(ph):
            freq[w] += 1
        for w in ph:
            deg[w] += len(ph)
    score_word = {w: deg[w] / freq[w] for w in freq}
    phrase_scores: dict[str, float] = {}
    for ph in phrases:
        phrase_scores[" ".join(ph)] = sum(score_word[w] for w in set(ph))
    return phrase_scores, freq


# ---------------------------------------------------------------------------
# Tag scoring against the controlled vocabulary
# ---------------------------------------------------------------------------


def _humanize(tag: str) -> str:
    return tag.replace("/", " ").replace("-", " ").replace("_", " ").strip()


def score_allowed_tags(
    allowed: list[str],
    text: str,
    phrase_scores: dict[str, float],
    word_freq: Counter,
    blocked: set[str],
    keybert_model=None,
) -> list[tuple[str, float]]:
    """Return [(tag, score)] sorted by descending relevance."""
    results: list[tuple[str, float]] = []

    if keybert_model is not None:
        # Semantic mode: rank allowed tags by similarity to the note.
        doc_emb = keybert_model.encode([text], convert_to_numpy=True)[0]
        for tag in allowed:
            tag_emb = keybert_model.encode([_humanize(tag)], convert_to_numpy=True)[0]
            sim = float(doc_emb @ tag_emb) / (
                (doc_emb @ doc_emb) ** 0.5 * (tag_emb @ tag_emb) ** 0.5 + 1e-9
            )
            results.append((tag, sim))
        return sorted(results, key=lambda x: x[1], reverse=True)

    # Frequency / RAKE mode (no heavy deps).
    for tag in allowed:
        toks = [t for t in re.split(r"[/_-]+", tag.lower()) if t and t not in blocked]
        if not toks:
            continue
        s = 0.0
        for t in toks:
            s += min(word_freq.get(t, 0), 3)
        phrase = " ".join(toks)
        if phrase in phrase_scores:
            s += phrase_scores[phrase]
        if s > 0:
            results.append((tag, s))
    return sorted(results, key=lambda x: x[1], reverse=True)


# ---------------------------------------------------------------------------
# Frontmatter helpers
# ---------------------------------------------------------------------------


def parse_frontmatter(raw: str) -> tuple[dict, str]:
    m = re.match(r"^---\r?\n(.*?)\r?\n---\r?\n?(.*)$", raw, re.S)
    if not m:
        return {}, raw
    block, body = m.group(1), m.group(2)
    fm: dict = {}
    last_list_key: str | None = None
    for line in block.splitlines():
        stripped = line.strip()
        if stripped.startswith("- "):
            if last_list_key is not None:
                fm[last_list_key].append(stripped[2:].strip())
            continue
        if ":" in line:
            key, _, val = line.partition(":")
            key = key.strip()
            val = val.strip()
            if val.startswith("[") and val.endswith("]"):
                fm[key] = [
                    v.strip().strip("'\"") for v in val[1:-1].split(",") if v.strip()
                ]
                last_list_key = key
            elif val == "":
                fm[key] = []
                last_list_key = key
            else:
                fm[key] = val.strip("'\"")
                last_list_key = None
        else:
            last_list_key = None
    return fm, body


def dump_frontmatter(fm: dict) -> str:
    lines = ["---"]
    for k, v in fm.items():
        if isinstance(v, list):
            if not v:
                lines.append(f"{k}: []")
            else:
                lines.append(f"{k}:")
                for item in v:
                    lines.append(f"  - {item}")
        else:
            lines.append(f"{k}: {v}")
    lines.append("---")
    return "\n".join(lines)


def suggest_for_text(text: str, cfg: dict, top: int, keybert_model=None) -> list[str]:
    tags_cfg = cfg.get("tags", {})
    allowed = [str(a) for a in (tags_cfg.get("allowed", []) or [])]
    blocked = set(str(b) for b in (tags_cfg.get("blocked", []) or []))
    stop = RAKE_STOPWORDS | blocked
    phrase_scores, word_freq = rake_scores(text, stop)
    ranked = score_allowed_tags(
        allowed, text, phrase_scores, word_freq, blocked, keybert_model
    )
    return [tag for tag, _ in ranked[:top]]


# ---------------------------------------------------------------------------
# File processing
# ---------------------------------------------------------------------------


def process_file(
    path: Path, cfg: dict, top: int, write: bool, keybert_model=None
) -> None:
    raw = path.read_text(encoding="utf-8")
    fm, body = parse_frontmatter(raw)
    existing = list(fm.get("tags", []) or [])
    suggestions = suggest_for_text(body, cfg, top, keybert_model)

    merged = list(existing)
    for t in suggestions:
        if t not in merged:
            merged.append(t)
    merged = merged[:top]

    print(f"\n{path}")
    print(f"  existing: {existing or '[]'}")
    print(f"  suggested: {suggestions}")
    print(f"  -> tags: {merged}")

    if write:
        fm["tags"] = merged
        new_raw = f"{dump_frontmatter(fm)}\n\n{body.lstrip()}"
        path.write_text(new_raw, encoding="utf-8")
        print("  [written]")


def main() -> None:
    cfg = load_config()
    paths = cfg.get("paths", {})
    wiki_dir = Path(paths.get("wiki", "wiki"))

    parser = argparse.ArgumentParser(description="Suggest tags for wiki notes.")
    parser.add_argument("file", nargs="?", help="A single Markdown note to tag.")
    parser.add_argument(
        "--all", action="store_true", help="Process the whole wiki/ folder."
    )
    parser.add_argument(
        "--wiki", default=str(wiki_dir), help="Wiki folder (default: wiki)."
    )
    parser.add_argument(
        "--write", action="store_true", help="Write suggestions into frontmatter."
    )
    parser.add_argument(
        "--top", type=int, default=6, help="Max tags to keep (default: 6)."
    )
    parser.add_argument(
        "--semantic",
        action="store_true",
        help="Use KeyBERT semantic ranking if available (else falls back to RAKE).",
    )
    args = parser.parse_args()

    keybert_model = None
    if args.semantic:
        try:
            from sentence_transformers import SentenceTransformer  # type: ignore

            keybert_model = SentenceTransformer("all-MiniLM-L6-v2")
            print("Semantic mode: KeyBERT loaded.")
        except Exception as exc:  # noqa: BLE001
            print(
                f"WARNING: --semantic requested but KeyBERT unavailable ({exc}).",
                file=sys.stderr,
            )
            print("Falling back to RAKE frequency scoring.", file=sys.stderr)

    if args.all:
        folder = Path(args.wiki)
        files = sorted(folder.rglob("*.md"))
        if not files:
            print(f"No Markdown notes found in {folder}")
            return
        for f in files:
            process_file(f, cfg, args.top, args.write, keybert_model)
        return

    if not args.file:
        parser.error("provide a MARKDOWN file or use --all")
    path = Path(args.file)
    if not path.is_file():
        print(f"File not found: {path}", file=sys.stderr)
        sys.exit(1)
    process_file(path, cfg, args.top, args.write, keybert_model)


if __name__ == "__main__":
    main()
