#!/usr/bin/env python3
"""
Download MCP skills from mcp.directory API and save to CSV.
- First run: fetches all skills and records discovery date
- Subsequent runs: adds only new skills (by ID), updates views/installs for existing
- Run daily via cron to keep the CSV updated
"""

import csv
import os
import tempfile
import urllib.request
import urllib.parse
import json
import time
from pathlib import Path
from datetime import datetime, timezone

API_URL = "https://mcp.directory/api/v1/skills"
OUTPUT_FILE = Path(__file__).parent / "mcp_skills.csv"
BATCH_SIZE = 100
REQUEST_DELAY = 0.5


def fetch_all_skills():
    """Fetch all skills with pagination, sorted by id ascending."""
    all_skills = []
    offset = 0

    # First request to get total count
    url = f"{API_URL}?limit=1&offset=0"
    with urllib.request.urlopen(url, timeout=30) as response:
        data = json.loads(response.read().decode())
    total = data["total"]
    print(f"Total skills to fetch: {total}")

    # Fetch in batches
    while offset < total:
        print(f"Fetching skills {offset} to {min(offset + BATCH_SIZE, total)}...")
        url = f"{API_URL}?limit={BATCH_SIZE}&offset={offset}"
        with urllib.request.urlopen(url, timeout=30) as response:
            data = json.loads(response.read().decode())
        skills = data.get("skills", [])

        if not skills:
            break

        all_skills.extend(skills)
        offset += BATCH_SIZE
        time.sleep(REQUEST_DELAY)

    # Sort by id ascending
    all_skills.sort(key=lambda s: s["id"])
    return all_skills


def read_existing_csv():
    """Read existing CSV, return (dict of slug -> row, list of fieldnames)."""
    existing = {}
    existing_fields = []
    if not OUTPUT_FILE.exists():
        return existing, existing_fields

    with open(OUTPUT_FILE, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        existing_fields = list(reader.fieldnames or [])
        for row in reader:
            slug = row.get("slug")
            if slug:
                existing[slug] = row

    return existing, existing_fields


# Base columns the scraper itself manages. Any OTHER columns present in the
# existing CSV (e.g. `description_improved` written by the admin panel) must
# be preserved verbatim for existing rows.
#
# Note: `first_seen` replaced the older `discovered_at`. We migrate old CSVs
# in place — see the legacy-column handling in `save_to_csv`.
BASE_FIELDS = ["name", "author", "description", "sourceUrl", "views", "installs", "slug", "first_seen"]
LEGACY_DATE_FIELD = "discovered_at"


def save_to_csv(skills, existing, existing_fields, now_iso):
    """Save skills to CSV. New skills get first_seen=now (ISO 8601 UTC), existing keep theirs.

    Preserves any extra columns (like `description_improved`) that already exist
    in the CSV but aren't managed by this scraper. Migrates legacy CSVs that
    still use the `discovered_at` column name by copying its value into
    `first_seen` and dropping the old column from the output.
    """
    # Build fieldnames: base fields + any extra columns found in existing CSV,
    # in a stable order (base first, extras in their original CSV order).
    # Drop the legacy date column so we don't end up with two date columns.
    extra_fields = [
        f for f in existing_fields
        if f not in BASE_FIELDS and f != LEGACY_DATE_FIELD
    ]
    fieldnames = BASE_FIELDS + extra_fields

    all_rows = []
    for skill in skills:
        slug = skill.get("slug", "")

        if slug in existing:
            # Start from existing row so extras (e.g. description_improved) are preserved.
            row = existing[slug].copy()
            # Migrate legacy date column: if the row has discovered_at but not
            # first_seen, promote the value. extrasaction='ignore' on write
            # will drop the leftover discovered_at key cleanly.
            if not row.get("first_seen") and row.get(LEGACY_DATE_FIELD):
                row["first_seen"] = row[LEGACY_DATE_FIELD]
            # Refresh volatile fields from API.
            row["views"] = skill.get("views", 0)
            row["installs"] = skill.get("installs", 0)
            # Don't overwrite description/name/author/sourceUrl for existing rows —
            # the admin-side improvements are keyed off the original description
            # snapshot, so changing it silently would desync downstream data.
        else:
            # New skill — fill base fields; extras default to empty string.
            row = {
                "name": skill.get("name", ""),
                "author": skill.get("author", ""),
                "description": skill.get("description", ""),
                "sourceUrl": skill.get("sourceUrl", ""),
                "views": skill.get("views", 0),
                "installs": skill.get("installs", 0),
                "slug": slug,
                "first_seen": now_iso,
            }
            for f in extra_fields:
                row[f] = ""

        all_rows.append(row)

    # Atomic write: dump to a temp file in the same dir, then rename.
    # `extrasaction="ignore"` is a belt-and-braces guard against unexpected keys.
    tmp_fd, tmp_path = tempfile.mkstemp(
        prefix=".mcp_skills_", suffix=".csv.tmp", dir=str(OUTPUT_FILE.parent)
    )
    try:
        with os.fdopen(tmp_fd, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
            writer.writeheader()
            for row in all_rows:
                writer.writerow(row)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp_path, OUTPUT_FILE)
    except Exception:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
        raise

    return len(all_rows)


def main():
    # ISO 8601 UTC, e.g. 2024-01-01T12:34:56Z — matches the format produced by
    # clean_mcp_skills.py so new rows sort and compare cleanly with old ones.
    now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    print(f"[{now_iso}] Starting MCP skills scraping...")

    existing, existing_fields = read_existing_csv()
    print(f"Existing skills in CSV: {len(existing)}")

    skills = fetch_all_skills()
    print(f"Fetched {len(skills)} skills from API")

    total = save_to_csv(skills, existing, existing_fields, now_iso)
    new_count = sum(1 for s in skills if s.get("slug") and s["slug"] not in existing)
    print(f"Saved {total} skills to {OUTPUT_FILE} ({new_count} new)")


if __name__ == "__main__":
    main()