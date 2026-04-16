'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import Fuse from 'fuse.js'

const PAGE_SIZE = 30

// Formatters — instantiated once.
const numFmt = new Intl.NumberFormat('en-US')

function SkillCard({ s }) {
  return (
    <Link href={`/skills/${s.slug}`} className="card" prefetch={false}>
      <div>
        <span className="badge">{s.category || 'other'}</span>
      </div>
      <div className="card-title">{s.name || s.slug}</div>
      {s.snippet && <div className="card-snippet">{s.snippet}</div>}
      <div className="card-meta">
        <span className="card-author">{s.author || '—'}</span>
        <span>
          ★ {numFmt.format(s.views || 0)} · ⬇ {numFmt.format(s.installs || 0)}
        </span>
      </div>
    </Link>
  )
}

export default function CatalogClient({ initial, totalCount, categories, authors }) {
  // `initial` (50 top skills, rendered by the server) is what we paint until
  // the slim index finishes loading. This keeps LCP fast and SEO happy, and
  // avoids a jarring skeleton for users on slow networks.
  const [items, setItems] = useState(initial)
  const [loaded, setLoaded] = useState(false)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [author, setAuthor] = useState('')
  const [sort, setSort] = useState('popular') // popular | views | installs | name
  const [page, setPage] = useState(1)

  const fuseRef = useRef(null)

  // Lazy-load the full slim index. ~600 KB gzip-compressed over the wire.
  useEffect(() => {
    let cancelled = false
    fetch('/skills-index.json')
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (cancelled || !data) return
        setItems(data)
        setLoaded(true)
        fuseRef.current = new Fuse(data, {
          keys: [
            { name: 'name', weight: 0.6 },
            { name: 'snippet', weight: 0.3 },
            { name: 'slug', weight: 0.1 },
          ],
          threshold: 0.35,
          ignoreLocation: true,
          minMatchCharLength: 2,
        })
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  // Reset to page 1 whenever filters/search change
  useEffect(() => {
    setPage(1)
  }, [query, category, author, sort])

  const filtered = useMemo(() => {
    let rows = items

    // Full-text search only kicks in once Fuse is ready. Until then the input
    // is still responsive — we just fall back to a plain substring match.
    const q = query.trim()
    if (q) {
      if (fuseRef.current) {
        rows = fuseRef.current.search(q).map(r => r.item)
      } else {
        const ql = q.toLowerCase()
        rows = rows.filter(
          r =>
            r.name.toLowerCase().includes(ql) ||
            (r.snippet || '').toLowerCase().includes(ql),
        )
      }
    }

    if (category) rows = rows.filter(r => r.category === category)
    if (author) rows = rows.filter(r => r.author === author)

    // Don't re-sort when the user searched — Fuse already ranked by relevance.
    if (!q) {
      switch (sort) {
        case 'views':
          rows = [...rows].sort((a, b) => (b.views || 0) - (a.views || 0))
          break
        case 'installs':
          rows = [...rows].sort((a, b) => (b.installs || 0) - (a.installs || 0))
          break
        case 'name':
          rows = [...rows].sort((a, b) => a.name.localeCompare(b.name))
          break
        case 'popular':
        default:
          rows = [...rows].sort(
            (a, b) =>
              (b.views || 0) + (b.installs || 0) - ((a.views || 0) + (a.installs || 0)),
          )
      }
    }

    return rows
  }, [items, query, category, author, sort])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const slice = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  return (
    <>
      <div className="toolbar">
        <input
          type="search"
          placeholder={
            loaded ? `Search ${numFmt.format(items.length)} skills…` : 'Loading search…'
          }
          value={query}
          onChange={e => setQuery(e.target.value)}
          aria-label="Search skills"
        />
        <select
          value={category}
          onChange={e => setCategory(e.target.value)}
          aria-label="Filter by category"
        >
          <option value="">All categories</option>
          {categories.map(c => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={author}
          onChange={e => setAuthor(e.target.value)}
          aria-label="Filter by author"
        >
          <option value="">All authors</option>
          {authors.map(a => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <select
          value={sort}
          onChange={e => setSort(e.target.value)}
          aria-label="Sort"
          disabled={!!query.trim()}
          title={query.trim() ? 'Sorted by relevance while searching' : ''}
        >
          <option value="popular">Most popular</option>
          <option value="views">Most viewed</option>
          <option value="installs">Most installed</option>
          <option value="name">Name (A–Z)</option>
        </select>
      </div>

      <div className="result-count">
        {loaded
          ? `${numFmt.format(filtered.length)} of ${numFmt.format(totalCount)} shown`
          : `Showing top ${initial.length} (loading full index…)`}
      </div>

      {slice.length === 0 ? (
        <div className="empty">No skills match your filters.</div>
      ) : (
        <div className="grid">
          {slice.map(s => (
            <SkillCard key={s.slug} s={s} />
          ))}
        </div>
      )}

      {pageCount > 1 && (
        <nav className="pagination" aria-label="Pagination">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={safePage === 1}
            aria-label="Previous page"
          >
            ‹ Prev
          </button>
          <span style={{ color: 'var(--fg-muted)', fontSize: 13 }}>
            Page {safePage} / {pageCount}
          </span>
          <button
            onClick={() => setPage(p => Math.min(pageCount, p + 1))}
            disabled={safePage === pageCount}
            aria-label="Next page"
          >
            Next ›
          </button>
        </nav>
      )}
    </>
  )
}
