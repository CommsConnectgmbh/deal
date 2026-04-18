'use client'
import { useState, useEffect } from 'react'

const STORAGE_KEY = 'dealbuddy-theme'

export function useTheme() {
  const [theme, setTheme] = useState<'dark' | 'light'>('light')

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'light' || saved === 'dark') {
      setTheme(saved)
      document.documentElement.setAttribute('data-theme', saved)
    }
  }, [])

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light'
    setTheme(next)
    document.documentElement.setAttribute('data-theme', next)
    localStorage.setItem(STORAGE_KEY, next)
  }

  return { theme, toggleTheme }
}

/**
 * Inline script to prevent flash-of-wrong-theme.
 * Light is now the default; only opt-in dark is applied here.
 */
export function ThemeScript() {
  const script = `
    (function() {
      try {
        var t = localStorage.getItem('${STORAGE_KEY}');
        if (t === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
      } catch(e) {}
    })()
  `
  return <script dangerouslySetInnerHTML={{ __html: script }} />
}
