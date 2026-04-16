import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getSkillBySlug, getTopSlugs, categoryLabel } from '@/lib/data'

// ISR strategy:
// - generateStaticParams returns the top-N slugs, so the most-trafficked
//   pages are baked at build time (fast first paint, no cold-start cost).
// - dynamicParams: true lets Next render any other slug on demand.
// - revalidate: once a day is plenty — the source CSV changes rarely.
export const dynamicParams = true
export const revalidate = 86400

export async function generateStaticParams() {
  const top = await getTopSlugs()
  return top.map(slug => ({ slug }))
}

export async function generateMetadata({ params }) {
  const { slug } = await params
  const skill = await getSkillBySlug(slug)
  if (!skill) return { title: 'Not found' }

  // The spec says <title> must be "{name} – AI Skill" and meta description
  // must use description_improved. We truncate the description to 160 chars
  // because search engines typically won't display more than that.
  const desc = (skill.description_improved || skill.description || '')
    .replace(/\s+/g, ' ')
    .trim()
  const metaDesc = desc.length > 160 ? desc.slice(0, 157) + '…' : desc

  return {
    // `absolute` bypasses the layout's "%s – MCP Skills Catalog" template,
    // so the final title is exactly "{name} – AI Skill" per the spec.
    title: { absolute: `${skill.name} – AI Skill` },
    description: metaDesc,
    alternates: { canonical: `/skills/${skill.slug}` },
    openGraph: {
      title: `${skill.name} – AI Skill`,
      description: metaDesc,
      url: `/skills/${skill.slug}`,
      type: 'article',
    },
    twitter: {
      card: 'summary',
      title: `${skill.name} – AI Skill`,
      description: metaDesc,
    },
  }
}

const numFmt = new Intl.NumberFormat('en-US')

export default async function SkillPage({ params }) {
  const { slug } = await params
  const skill = await getSkillBySlug(slug)
  if (!skill) notFound()

  const desc = skill.description_improved || skill.description || ''
  const firstSeen = skill.first_seen
    ? new Date(skill.first_seen).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : null

  // JSON-LD: helps search engines understand the page as a structured entity.
  // SoftwareApplication is the closest-fitting schema for an AI "skill".
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: skill.name,
    description: desc,
    applicationCategory: categoryLabel(skill.category),
    author: skill.author ? { '@type': 'Person', name: skill.author } : undefined,
    url: skill.sourceUrl || undefined,
  }

  return (
    <article className="detail">
      <Link href="/" className="back-link">← Back to catalog</Link>
      <div className="eyebrow">
        <span className="badge">{skill.category || 'other'}</span>
        {firstSeen && <span>First seen {firstSeen}</span>}
      </div>
      <h1>{skill.name}</h1>
      {skill.author && <div className="byline">by {skill.author}</div>}

      <h2 className="sr-only" style={{ position: 'absolute', left: -9999 }}>
        About this skill
      </h2>
      <div className="body">{desc || 'No description available.'}</div>

      <section className="detail-meta" aria-label="Metadata">
        <div>
          <div className="label">Views</div>
          <div className="value">{numFmt.format(skill.views || 0)}</div>
        </div>
        <div>
          <div className="label">Installs</div>
          <div className="value">{numFmt.format(skill.installs || 0)}</div>
        </div>
        <div>
          <div className="label">Category</div>
          <div className="value">{categoryLabel(skill.category)}</div>
        </div>
        <div>
          <div className="label">Source</div>
          <div className="value">
            {skill.sourceUrl ? (
              <a href={skill.sourceUrl} target="_blank" rel="noopener noreferrer">
                View source ↗
              </a>
            ) : (
              '—'
            )}
          </div>
        </div>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </article>
  )
}
