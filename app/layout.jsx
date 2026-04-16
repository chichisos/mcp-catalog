import './globals.css'
import Providers from './components/Providers'
import ThemeToggle from './components/ThemeToggle'
import Link from 'next/link'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://example.com'

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'MCP Skills Catalog',
    template: '%s – MCP Skills Catalog',
  },
  description:
    'A searchable catalog of AI skills for the Model Context Protocol (MCP). Browse by category, author, or popularity.',
  openGraph: {
    type: 'website',
    siteName: 'MCP Skills Catalog',
  },
  twitter: { card: 'summary' },
  robots: { index: true, follow: true },
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>
          <header className="site-header">
            <div className="container header-inner">
              <Link href="/" className="brand">
                <span className="brand-mark" aria-hidden>◆</span>
                <span>MCP Skills</span>
              </Link>
              <ThemeToggle />
            </div>
          </header>
          <main className="container main">{children}</main>
          <footer className="site-footer">
            <div className="container">
              <small>
                Public catalog of MCP skills. Data sourced from{' '}
                <a href="https://mcp.directory" rel="noopener">mcp.directory</a>.
              </small>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  )
}
