#!/usr/bin/env node
/**
 * Parse mcp_skills.csv and produce three artifacts:
 *
 *   data/skills.json          — full records, read at build time by RSC pages
 *   data/top-slugs.json       — top-N slugs by (views + installs), used by
 *                               generateStaticParams so the most-trafficked
 *                               pages are pre-rendered on build. The rest are
 *                               generated on first request via ISR.
 *   public/skills-index.json  — slim client-side search index. Only the fields
 *                               the catalog page needs, plus a 200-char snippet
 *                               of description_improved. Kept small on purpose
 *                               so the first-load cost is bearable at 8k+ rows.
 *
 * Runs via `prebuild` and `predev` in package.json, so the artifacts are
 * always in sync with the CSV before Next starts.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Papa from 'papaparse'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

// CSV lives under data/ in the repo so Vercel/CI builds pick it up without
// extra env plumbing. CSV_PATH can still override it for local dev if the
// operator wants to point at a fresh dump elsewhere on disk.
const DEFAULT_CSV = path.join(ROOT, 'data', 'mcp_skills.csv')
const CSV_PATH = process.env.CSV_PATH || DEFAULT_CSV
const TOP_N = parseInt(process.env.TOP_N_SSG || '500', 10)

const SNIPPET_LEN = 200

function parseCsv(filePath) {
  const text = fs.readFileSync(filePath, 'utf8')
  const result = Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
  })
  if (result.errors.length) {
    // Don't fail the build on stray parse warnings — print the first few
    // so we notice systematic issues, but let the pipeline continue.
    console.warn(`[build-data] ${result.errors.length} parse warnings`)
    for (const err of result.errors.slice(0, 3)) console.warn('  ', err.message)
  }
  return result.data
}

function toInt(v) {
  const n = parseInt(v, 10)
  return Number.isFinite(n) ? n : 0
}

function snippet(text, n = SNIPPET_LEN) {
  const s = (text || '').replace(/\s+/g, ' ').trim()
  return s.length <= n ? s : s.slice(0, n - 1).trimEnd() + '…'
}

function normalize(row) {
  const views = toInt(row.views)
  const installs = toInt(row.installs)
  return {
    slug: (row.slug || '').trim(),
    name: (row.name || '').trim(),
    author: (row.author || '').trim(),
    description: (row.description || '').trim(),
    description_improved: (row.description_improved || '').trim(),
    sourceUrl: (row.sourceUrl || '').trim(),
    category: (row.category || 'other').trim() || 'other',
    views,
    installs,
    first_seen: (row.first_seen || '').trim(),
    popularity: views + installs,
  }
}

function writeJson(relPath, data) {
  const full = path.join(ROOT, relPath)
  fs.mkdirSync(path.dirname(full), { recursive: true })
  fs.writeFileSync(full, JSON.stringify(data))
  return full
}

function main() {
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`[build-data] CSV not found: ${CSV_PATH}`)
    process.exit(1)
  }

  const rows = parseCsv(CSV_PATH).map(normalize).filter(r => r.slug)

  // Dedupe on slug (shouldn't happen, but be defensive — the site keys off it).
  const seen = new Set()
  const unique = []
  for (const r of rows) {
    if (seen.has(r.slug)) continue
    seen.add(r.slug)
    unique.push(r)
  }

  // Full dataset — server-only. Keep everything so the detail page has it all.
  writeJson('data/skills.json', unique)

  // Top-N by popularity — drives generateStaticParams. Ties broken by slug
  // so the choice is deterministic across builds.
  const topSlugs = [...unique]
    .sort((a, b) => b.popularity - a.popularity || a.slug.localeCompare(b.slug))
    .slice(0, TOP_N)
    .map(r => r.slug)
  writeJson('data/top-slugs.json', topSlugs)

  // Slim client-side index — what the catalog page searches and filters over.
  const slim = unique.map(r => ({
    slug: r.slug,
    name: r.name,
    author: r.author,
    category: r.category,
    views: r.views,
    installs: r.installs,
    snippet: snippet(r.description_improved || r.description),
  }))
  writeJson('public/skills-index.json', slim)

  console.log(
    `[build-data] ${unique.length} skills  |  top-${topSlugs.length} for SSG  |  index ~${(
      JSON.stringify(slim).length / 1024
    ).toFixed(1)} KB`,
  )
}

main()
