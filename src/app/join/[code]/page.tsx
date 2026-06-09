'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

type Status = 'loading' | 'self' | 'duel' | 'register' | 'unknown'

export default function JoinInvitePage() {
  const params = useParams()
  const router = useRouter()
  const { user, profile, loading } = useAuth()
  const [status, setStatus] = useState<Status>('loading')
  const [senderName, setSenderName] = useState<string | null>(null)
  const code = (params?.code as string | undefined)?.toUpperCase()

  useEffect(() => {
    if (!code || loading) return

    let cancelled = false
    ;(async () => {
      const { data: sender } = await supabase
        .from('profiles')
        .select('id, username, display_name')
        .eq('invite_code', code)
        .maybeSingle()

      if (cancelled) return

      if (user && profile) {
        if (!sender) {
          setStatus('unknown')
          setTimeout(() => router.replace('/app/home'), 1500)
          return
        }
        if (sender.id === profile.id) {
          setStatus('self')
          setTimeout(() => router.replace('/app/home'), 1500)
          return
        }
        setSenderName(sender.display_name || sender.username)
        setStatus('duel')
        setTimeout(() => {
          router.replace(`/app/deals/create?opponent=${encodeURIComponent(sender.username)}`)
        }, 1200)
        return
      }

      localStorage.setItem('dealbuddy_referral', code)
      if (sender) setSenderName(sender.display_name || sender.username)
      setStatus('register')
      setTimeout(() => router.replace('/auth/register'), 1500)
    })()

    return () => { cancelled = true }
  }, [code, loading, user, profile, router])

  const headline =
    status === 'duel'     ? `Duell gegen ${senderName}!` :
    status === 'register' ? 'Einladung angenommen!' :
    status === 'self'     ? 'Das ist dein eigener Code' :
    status === 'unknown'  ? 'Einladung ungültig' :
                            'Lade…'

  const sub =
    status === 'duel'     ? 'Weiterleitung zum Challenge-Erstellen…' :
    status === 'register' ? 'Weiterleitung zur Registrierung…' :
    status === 'self'     ? 'Du kannst dich nicht selbst einladen.' :
    status === 'unknown'  ? 'Dieser Code ist nicht (mehr) gültig.' :
                            'Einen Moment…'

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
      <div style={{ fontSize: 64, marginBottom: 24 }}>
        {status === 'duel' ? '⚔️' : status === 'unknown' ? '⚠️' : '🎉'}
      </div>
      <h1 className="font-display" style={{
        fontSize: 28,
        color: 'var(--gold-primary)',
        marginBottom: 12,
        letterSpacing: 2,
      }}>
        {headline}
      </h1>
      <p style={{
        fontSize: 16,
        color: 'var(--text-secondary)',
        fontFamily: 'var(--font-body)',
        marginBottom: 24,
      }}>
        {sub}
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
