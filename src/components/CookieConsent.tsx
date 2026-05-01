'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useLang } from '@/contexts/LanguageContext'
import {
  ANALYTICS_CONSENT_KEY,
  getAnalyticsConsent,
  setAnalyticsConsent,
} from '@/lib/analytics'

/**
 * Sticky bottom cookie consent banner. Mounts only when the user has not yet
 * decided. Implements DSGVO-conformant opt-in: PostHog analytics are NOT
 * initialized until the user explicitly clicks "Accept".
 */
export default function CookieConsent() {
  const { t } = useLang()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const decided = getAnalyticsConsent()
    if (decided === null) {
      // Defer paint slightly so the banner doesn't fight the splash/loading state
      const timer = setTimeout(() => setVisible(true), 800)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [])

  // Listen for changes from the settings toggle so the banner can re-appear if
  // the user resets consent from another tab.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === ANALYTICS_CONSENT_KEY && e.newValue === null) {
        setVisible(true)
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const accept = () => {
    setAnalyticsConsent('granted')
    setVisible(false)
  }

  const decline = () => {
    setAnalyticsConsent('denied')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label={t('consent.title')}
      style={{
        position: 'fixed',
        left: 12,
        right: 12,
        bottom: 12,
        zIndex: 1000,
        maxWidth: 520,
        margin: '0 auto',
        background: 'var(--bg-surface)',
        border: '1px solid var(--gold-glow)',
        borderRadius: 14,
        padding: '16px 18px',
        boxShadow: '0 10px 40px rgba(0,0,0,0.35)',
        color: 'var(--text-primary)',
        fontFamily: 'var(--font-body)',
      }}
    >
      <p
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 11,
          letterSpacing: 2,
          color: 'var(--gold-primary)',
          marginBottom: 8,
        }}
      >
        {t('consent.title')}
      </p>
      <p style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--text-secondary)', marginBottom: 12 }}>
        {t('consent.body')}{' '}
        <Link
          href="/legal/privacy"
          style={{ color: 'var(--gold-primary)', textDecoration: 'underline' }}
        >
          {t('consent.privacyLink')}
        </Link>
      </p>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={decline}
          style={{
            flex: 1,
            padding: '10px 14px',
            borderRadius: 10,
            border: '1px solid var(--border-subtle)',
            background: 'transparent',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-display)',
            fontSize: 11,
            letterSpacing: 1.5,
            cursor: 'pointer',
          }}
        >
          {t('consent.decline').toUpperCase()}
        </button>
        <button
          onClick={accept}
          style={{
            flex: 1,
            padding: '10px 14px',
            borderRadius: 10,
            border: 'none',
            background: 'linear-gradient(135deg, var(--gold-dim), var(--gold-primary))',
            color: 'var(--text-inverse)',
            fontFamily: 'var(--font-display)',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 1.5,
            cursor: 'pointer',
          }}
        >
          {t('consent.accept').toUpperCase()}
        </button>
      </div>
    </div>
  )
}
