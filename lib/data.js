import fs from 'node:fs/promises'
import path from 'node:path'

// All loaders are async + cached per module instance. In a Next build they run
// at generation time; at request time (ISR path) they hit the filesystem once
// per cold start and reuse the in-memory copy thereafter.

const DATA_DIR = path.join(process.cwd(), 'data')

let _all = null
let _bySlug = null
let _top = null

async function readJson(file) {
  const buf = await fs.readFile(path.join(DATA_DIR, file), 'utf8')
  return JSON.parse(buf)
}

export async function getAllSkills() {
  if (_all) return _all
  _all = await readJson('skills.json')
  return _all
}

export async function getSkillBySlug(slug) {
  if (!_bySlug) {
    const all = await getAllSkills()
    _bySlug = new Map(all.map(s => [s.slug, s]))
  }
  return _bySlug.get(slug) || null
}

export async function getTopSlugs() {
  if (_top) return _top
  _top = await readJson('top-slugs.json')
  return _top
}

export function categoryLabel(slug) {
  // Best-effort humanisation for display. Keeps the data layer dumb.
  return (slug || 'other')
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}
