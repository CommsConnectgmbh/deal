'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

export default function JoinInvitePage() {
  const params = useParams()
  const router = useRouter()
  const [saved, setSaved] = useState(false)
  const code = params?.code as string | undefined

  useEffect(() => {
    if (!code) return
    localStorage.setItem('dealbuddy_referral', code)
    setSaved(true)
    const t = setTimeout(() => {
      router.replace('/auth/register')
    }, 1500)
    return () => clearTimeout(t)
  }, [code, router])

  return (
    <div style={{
      minHeight: '100dvh',
      background: 'var(--bg-base)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      maxWidth: 430,
      margin: '0 auto',
      textAlign: 'center',
      padding: '40px 24px',
    }}>
      <div style={{ fontSize: 64, marginBottom: 24 }}>{'\uD83C\uDF89'}</div>
      <h1 className="font-display" style={{
        fontSize: 28,
        color: 'var(--gold-primary)',
        marginBottom: 12,
        letterSpacing: 2,
      }}>
        {saved ? 'Einladung angenommen!' : 'Lade...'}
      </h1>
      <p style={{
        fontSize: 16,
        color: 'var(--text-secondary)',
        fontFamily: 'var(--font-body)',
        marginBottom: 24,
      }}>
        Weiterleitung zur Registrierung...
      </p>
      <div style={{
        width: 40, height: 40, borderRadius: '50%',
        border: '3px solid var(--border-subtle)',
        borderTopColor: 'var(--gold-primary)',
        animation: 'spin 0.8s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
