#!/usr/bin/env python3
"""
Clean and normalize mcp_skills.csv.

- Rename `discovered_at` -> `first_seen`
- Normalize `first_seen` to ISO 8601 UTC (e.g. 2024-01-01T12:34:56Z).
  Tries, in order:
    1. large numeric epoch (ns / us / ms / s)
    2. ISO date / datetime strings
  Falls back to the current UTC time only if both fail.
- Ensure a `category` column exists, default "other".
- Atomically overwrite mcp_skills.csv.
"""

import csv
import os
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path

CSV_PATH = Path(__file__).parent / "mcp_skills.csv"

if len(sys.argv) > 1:
    CSV_PATH = Path(sys.argv[1])


def to_iso_utc(value: str) -> tuple[str, str]:
    """Return (iso_string, source) where source is 'epoch' | 'iso' | 'fallback'."""
    s = (value or "").strip()
    if not s:
        return _now_iso(), "fallback"

    # 1) numeric epoch — auto-detect unit by magnitude
    if s.lstrip("-").isdigit():
        try:
            n = int(s)
            # Heuristic unit detection: seconds ~10 digits, ms ~13, us ~16, ns ~19.
            # Pick divisor so the result lands in a plausible year range.
            for divisor in (1, 1_000, 1_000_000, 1_000_000_000):
                secs = n / divisor
                # Accept 1970-01-01 .. 2100-01-01 as "plausible"
                if 0 <= secs <= 4_102_444_800:
                    return (
                        datetime.fromtimestamp(secs, tz=timezone.utc)
                        .strftime("%Y-%m-%dT%H:%M:%SZ"),
                        "epoch",
                    )
        except (ValueError, OverflowError, OSError):
            pass

    # 2) ISO date or datetime
    try:
        # fromisoformat handles "2024-01-01", "2024-01-01T12:34:56",
        # "2024-01-01T12:34:56+00:00", etc.
        dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        else:
            dt = dt.astimezone(timezone.utc)
        return dt.strftime("%Y-%m-%dT%H:%M:%SZ"), "iso"
    except ValueError:
        pass

    # 3) fallback
    return _now_iso(), "fallback"


def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def main() -> int:
    if not CSV_PATH.exists():
        print(f"ERROR: {CSV_PATH} not found", file=sys.stderr)
        return 1

    with open(CSV_PATH, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        fieldnames = list(reader.fieldnames or [])
        rows = list(reader)

    if not fieldnames:
        print("ERROR: CSV has no header", file=sys.stderr)
        return 1

    # --- rename ---
    renamed = False
    if "discovered_at" in fieldnames and "first_seen" not in fieldnames:
        fieldnames = [("first_seen" if c == "discovered_at" else c) for c in fieldnames]
        for row in rows:
            row["first_seen"] = row.pop("discovered_at", "")
        renamed = True
    elif "first_seen" in fieldnames:
        # already renamed on a previous run — idempotent
        renamed = False
    else:
        # neither column — create empty first_seen so normalization still runs
        fieldnames.append("first_seen")
        for row in rows:
            row["first_seen"] = ""

    # --- normalize first_seen ---
    source_counts = {"epoch": 0, "iso": 0, "fallback": 0}
    for row in rows:
        iso, source = to_iso_utc(row.get("first_seen", ""))
        row["first_seen"] = iso
        source_counts[source] += 1

    # --- ensure category ---
    category_created = False
    if "category" not in fieldnames:
        fieldnames.append("category")
        category_created = True
    for row in rows:
        if not row.get("category"):
            row["category"] = "other"

    # --- atomic write ---
    tmp_fd, tmp_path = tempfile.mkstemp(
        prefix=".mcp_skills_", suffix=".csv.tmp", dir=str(CSV_PATH.parent)
    )
    try:
        with os.fdopen(tmp_fd, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
            writer.writeheader()
            writer.writerows(rows)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp_path, CSV_PATH)
    except Exception:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
        raise

    # --- report ---
    print(f"Rows processed: {len(rows)}")
    print(f"Rename 'discovered_at' -> 'first_seen': "
          f"{'done' if renamed else 'not needed (already renamed or missing)'}")
    print(f"Date conversion: epoch={source_counts['epoch']} "
          f"iso={source_counts['iso']} fallback={source_counts['fallback']}")
    print(f"Column 'category': "
          f"{'created (default \"other\")' if category_created else 'already present'}")
    print(f"Wrote: {CSV_PATH}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
