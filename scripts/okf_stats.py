#!/usr/bin/env python3
"""
scripts/okf_stats.py
OKF v0.2 Bundle Analytics and Statistics for wiki-forge.
"""

import sys
import re
from pathlib import Path
from datetime import datetime, timezone

try:
    import yaml
except ImportError:
    yaml = None

def compute_okf_stats(wiki_dir: Path) -> dict:
    total_files = 0
    concepts_count = 0
    reserved_count = 0

    types_dist = {}
    statuses_dist = {"draft": 0, "stable": 0, "deprecated": 0}
    trust_tiers = {"unverified": 0, "machine-confirmed": 0, "human-reviewed": 0}
    stale_count = 0
    sources_count = 0

    now_utc = datetime.now(timezone.utc)

    for md_file in wiki_dir.glob("**/*.md"):
        total_files += 1
        file_name = md_file.name.lower()

        if file_name in ("index.md", "log.md"):
            reserved_count += 1
            continue

        concepts_count += 1
        content = md_file.read_text(encoding="utf-8")

        if content.startswith("---") and yaml:
            parts = re.split(r"^---\s*$", content, maxsplit=2, flags=re.MULTILINE)
            if len(parts) >= 3:
                try:
                    fm = yaml.safe_load(parts[1])
                    if isinstance(fm, dict):
                        # Type
                        c_type = fm.get("type", "Unknown")
                        types_dist[c_type] = types_dist.get(c_type, 0) + 1

                        # Status
                        st = fm.get("status", "stable")
                        statuses_dist[st] = statuses_dist.get(st, 0) + 1

                        # Trust Tier
                        verified = fm.get("verified", [])
                        if not verified:
                            trust_tiers["unverified"] += 1
                        else:
                            has_human = any(
                                isinstance(v, dict) and str(v.get("by", "")).startswith("human:")
                                for v in verified
                            )
                            if has_human:
                                trust_tiers["human-reviewed"] += 1
                            else:
                                trust_tiers["machine-confirmed"] += 1

                        # Stale status
                        stale_after = fm.get("stale_after")
                        if stale_after:
                            try:
                                # Simple ISO date parsing
                                s_str = str(stale_after).replace("Z", "+00:00")
                                s_dt = datetime.fromisoformat(s_str)
                                if s_dt.tzinfo is None:
                                    s_dt = s_dt.replace(tzinfo=timezone.utc)
                                if now_utc >= s_dt:
                                    stale_count += 1
                            except Exception:
                                pass

                        # Sources count
                        srcs = fm.get("sources", [])
                        if isinstance(srcs, list):
                            sources_count += len(srcs)
                except Exception:
                    pass

    return {
        "total_files": total_files,
        "concepts_count": concepts_count,
        "reserved_count": reserved_count,
        "types_dist": types_dist,
        "statuses_dist": statuses_dist,
        "trust_tiers": trust_tiers,
        "stale_count": stale_count,
        "sources_count": sources_count
    }

def main():
    wiki_dir_arg = sys.argv[1] if len(sys.argv) > 1 else "wiki"
    wiki_root = Path(wiki_dir_arg).resolve()

    if not wiki_root.exists() or not wiki_root.is_dir():
        print(f"Error: Path '{wiki_root}' does not exist.", file=sys.stderr)
        sys.exit(1)

    stats = compute_okf_stats(wiki_root)

    print("==========================================")
    print("      OKF v0.2 BUNDLE METRICS REPORT      ")
    print("==========================================")
    print(f"Directory:          {wiki_root}")
    print(f"Total Markdown Files:{stats['total_files']}")
    print(f"OKF Concepts:       {stats['concepts_count']}")
    print(f"Reserved Files:     {stats['reserved_count']} (index.md, log.md)")
    print(f"Total Source Links: {stats['sources_count']}")
    print(f"Stale Concepts:     {stats['stale_count']}")
    print("\n--- Type Distribution ---")
    for t_name, count in sorted(stats["types_dist"].items(), key=lambda x: x[1], reverse=True):
        print(f"  - {t_name}: {count}")

    print("\n--- Trust Tiers ---")
    for tier, count in stats["trust_tiers"].items():
        print(f"  - {tier}: {count}")

    print("\n--- Lifecycle Status ---")
    for st, count in stats["statuses_dist"].items():
        print(f"  - {st}: {count}")

    print("==========================================")

if __name__ == "__main__":
    main()
