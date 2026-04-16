'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'

// Render a placeholder on the server and until next-themes hydrates, so the
// icon doesn't flicker from the wrong theme on first paint.
export default function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const label = !mounted
    ? 'Toggle theme'
    : resolvedTheme === 'dark'
    ? 'Switch to light mode'
    : 'Switch to dark mode'

  const toggle = () => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')

  return (
    <button
      className="theme-toggle"
      onClick={toggle}
      aria-label={label}
      title={label}
      type="button"
    >
      {mounted && resolvedTheme === 'dark' ? (
        // Sun
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      ) : (
        // Moon
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  )
}
