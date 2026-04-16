import CatalogClient from './components/CatalogClient'
import { getAllSkills } from '@/lib/data'

export const metadata = {
  title: 'MCP Skills Catalog',
  description:
    'Browse a searchable catalog of AI skills for the Model Context Protocol (MCP). Filter by category, author, and popularity.',
  alternates: { canonical: '/' },
}

// Server component: we compute the initial slice + facet lists here so the
// first paint has meaningful content (good for SEO and LCP). The client
// component takes over for search/filter/pagination interactivity and lazily
// loads the slim index from /skills-index.json.
export default async function HomePage() {
  const all = await getAllSkills()

  // Sort by popularity (views + installs) descending so the most relevant
  // skills appear first out of the box.
  const sorted = [...all].sort(
    (a, b) => (b.views + b.installs) - (a.views + a.installs) || a.slug.localeCompare(b.slug),
  )

  const categories = Array.from(new Set(all.map(s => s.category))).sort()
  const authors = Array.from(new Set(all.map(s => s.author).filter(Boolean))).sort(
    (a, b) => a.localeCompare(b),
  )

  // Initial slice — 50 most popular — rendered server-side so search engines
  // see actual content. The client component will replace this once it boots.
  const initial = sorted.slice(0, 50).map(s => ({
    slug: s.slug,
    name: s.name,
    author: s.author,
    category: s.category,
    views: s.views,
    installs: s.installs,
    snippet: (s.description_improved || s.description || '').slice(0, 200),
  }))

  return (
    <>
      <section className="hero">
        <h1>MCP Skills Catalog</h1>
        <p>
          {all.length.toLocaleString()} AI skills for the Model Context Protocol.
          Search by name, filter by category or author.
        </p>
      </section>
      <CatalogClient
        initial={initial}
        totalCount={all.length}
        categories={categories}
        authors={authors}
      />
    </>
  )
}
