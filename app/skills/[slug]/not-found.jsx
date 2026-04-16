import Link from 'next/link'

export const metadata = { title: 'Skill not found' }

export default function NotFound() {
  return (
    <div className="empty">
      <h1>Skill not found</h1>
      <p>We couldn&rsquo;t find that skill in the catalog.</p>
      <p style={{ marginTop: 16 }}>
        <Link href="/">← Back to catalog</Link>
      </p>
    </div>
  )
}
