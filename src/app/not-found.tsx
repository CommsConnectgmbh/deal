'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

const SUPPORTED_LANGS = ['de','en','fr','es','it','ru','ar','hi'] as const
type Lang = typeof SUPPORTED_LANGS[number]

function getStoredLang(): Lang {
  if (typeof window === 'undefined') return 'de'
  const stored = localStorage.getItem('db_lang')
  if (stored && SUPPORTED_LANGS.includes(stored as Lang)) return stored as Lang
  return 'de'
}

export default function NotFound() {
  const [labels, setLabels] = useState({ pageNotFound: 'Diese Seite existiert nicht.', backToHome: 'Zur Startseite' })

  useEffect(() => {
    const lang = getStoredLang()
    import(`../../messages/${lang}.json`).then(mod => {
      const common = mod.default?.common || mod.common
      if (common) {
        setLabels({
          pageNotFound: common.pageNotFound || labels.pageNotFound,
          backToHome: common.backToHome || labels.backToHome,
        })
      }
    }).catch(() => {})
  }, [])

  return (
    <div style={{
      minHeight: '100vh', background: '#060606', display: 'flex',
      flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '2rem', fontFamily: 'Oswald, sans-serif',
    }}>
      <div style={{ fontSize: '5rem', marginBottom: '0.5rem' }}>&#x1F50D;</div>
      <h1 style={{ color: '#FFB800', fontSize: '2rem', marginBottom: '0.5rem' }}>
        404
      </h1>
      <p style={{ color: '#888', fontSize: '1rem', marginBottom: '1.5rem' }}>
        {labels.pageNotFound}
      </p>
      <Link
        href="/app/home"
        style={{
          background: '#FFB800', color: '#000', border: 'none', borderRadius: 12,
          padding: '14px 32px', fontSize: '1rem', fontWeight: 700,
          textDecoration: 'none', fontFamily: 'Oswald, sans-serif', textTransform: 'uppercase',
        }}
      >
        {labels.backToHome}
      </Link>
    </div>
  )
}
