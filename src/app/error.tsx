'use client'
import { useLang } from '@/contexts/LanguageContext'

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  const { t } = useLang()
  return (
    <div style={{
      minHeight: '100vh', background: '#060606', display: 'flex',
      flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '2rem', fontFamily: 'Oswald, sans-serif',
    }}>
      <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>&#x26A0;&#xFE0F;</div>
      <h1 style={{ color: '#FFB800', fontSize: '1.5rem', marginBottom: '0.5rem' }}>
        {t('common.somethingWentWrong')}
      </h1>
      <p style={{ color: '#888', fontSize: '0.9rem', textAlign: 'center', marginBottom: '1.5rem', maxWidth: 360 }}>
        {error.message || t('common.unexpectedError')}
      </p>
      <button
        onClick={reset}
        style={{
          background: '#FFB800', color: '#000', border: 'none', borderRadius: 12,
          padding: '14px 32px', fontSize: '1rem', fontWeight: 700, cursor: 'pointer',
          fontFamily: 'Oswald, sans-serif', textTransform: 'uppercase',
        }}
      >
        {t('common.tryAgain')}
      </button>
    </div>
  )
}
