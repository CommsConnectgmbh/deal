'use client'
import { useState, useEffect } from 'react'

const STORAGE_KEY = 'dealbuddy-theme'

export function useTheme() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'light' || saved === 'dark') {
      setTheme(saved)
      document.documentElement.setAttribute('data-theme', saved)
    }
  }, [])

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.setAttribute('data-theme', next)
    localStorage.setItem(STORAGE_KEY, next)
  }

  return { theme, toggleTheme }
}

/**
 * Inline script to prevent flash-of-wrong-theme.
 * Rendered in <head> as a server component.
 */
export function ThemeScript() {
  const script = `
    (function() {
      try {
        var t = localStorage.getItem('${STORAGE_KEY}');
        if (t === 'light') document.documentElement.setAttribute('data-theme', 'light');
      } catch(e) {}
    })()
  `
  return <script dangerouslySetInnerHTML={{ __html: script }} />
}
