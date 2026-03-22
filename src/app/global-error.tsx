'use client'

import { useEffect, useState } from 'react'

const SUPPORTED_LANGS = ['de','en','fr','es','it','ru','ar','hi'] as const
type Lang = typeof SUPPORTED_LANGS[number]

function getStoredLang(): Lang {
  if (typeof window === 'undefined') return 'de'
  const stored = localStorage.getItem('db_lang')
  if (stored && SUPPORTED_LANGS.includes(stored as Lang)) return stored as Lang
  return 'de'
}

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  const [labels, setLabels] = useState({
    criticalError: 'Kritischer Fehler',
    appLoadFailed: 'Die App konnte nicht geladen werden.',
    reloadApp: 'App neu laden',
  })

  useEffect(() => {
    const lang = getStoredLang()
    import(`../../messages/${lang}.json`).then(mod => {
      const common = mod.default?.common || mod.common
      if (common) {
        setLabels({
          criticalError: common.criticalError || labels.criticalError,
          appLoadFailed: common.appLoadFailed || labels.appLoadFailed,
          reloadApp: common.reloadApp || labels.reloadApp,
        })
      }
    }).catch(() => {})
  }, [])

  return (
    <html lang={getStoredLang()}>
      <body style={{ margin: 0, background: '#060606' }}>
        <div style={{
          minHeight: '100vh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', padding: '2rem',
          fontFamily: 'system-ui, sans-serif',
        }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>&#x1F4A5;</div>
          <h1 style={{ color: '#FFB800', fontSize: '1.5rem', marginBottom: '0.5rem' }}>
            {labels.criticalError}
          </h1>
          <p style={{ color: '#888', fontSize: '0.9rem', textAlign: 'center', marginBottom: '1.5rem' }}>
            {error.message || labels.appLoadFailed}
          </p>
          <button
            onClick={reset}
            style={{
              background: '#FFB800', color: '#000', border: 'none', borderRadius: 12,
              padding: '14px 32px', fontSize: '1rem', fontWeight: 700, cursor: 'pointer',
            }}
          >
            {labels.reloadApp}
          </button>
        </div>
      </body>
    </html>
  )
}
