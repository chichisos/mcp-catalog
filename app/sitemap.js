import { getAllSkills } from '@/lib/data'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://example.com'

// Next.js renders this to /sitemap.xml automatically. For 8k+ URLs this is
// well under the 50k/50MB limits — no sharding needed.
export default async function sitemap() {
  const all = await getAllSkills()
  const now = new Date().toISOString()

  const entries = [
    {
      url: `${SITE_URL}/`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 1.0,
    },
  ]

  for (const s of all) {
    entries.push({
      url: `${SITE_URL}/skills/${s.slug}`,
      lastModified: s.first_seen || now,
      changeFrequency: 'weekly',
      priority: 0.7,
    })
  }

  return entries
}
