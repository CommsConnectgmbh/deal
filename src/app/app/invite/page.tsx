'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

interface Referral {
  id: string
  referred_id: string
  completed: boolean
  reward_granted: boolean
  created_at: string
  profiles: { username: string; display_name: string; level: number } | null
}

export default function InvitePage() {
  const { profile } = useAuth()
  const router = useRouter()
  const [referrals, setReferrals]   = useState<Referral[]>([])
  const [copied,    setCopied]      = useState(false)
  const [loading,   setLoading]     = useState(true)

  useEffect(() => { if (profile) fetchReferrals() }, [profile])

  const fetchReferrals = async () => {
    if (!profile) return
    setLoading(true)
    const { data } = await supabase
      .from('referrals')
      .select('*, profiles!referrals_referred_id_fkey(username, display_name, level)')
      .eq('referrer_id', profile.id)
      .order('created_at', { ascending: false })
    setReferrals((data || []) as Referral[])
    setLoading(false)
  }

  const inviteCode = profile?.invite_code || '–'
  const inviteLink = `https://app.deal-buddy.app/auth/register?ref=${inviteCode}`

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(inviteCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback
    }
  }

  const shareLink = async () => {
    const text = `🏆 Tritt DealBuddy bei und messe dich mit mir! Benutze meinen Code: ${inviteCode}\n${inviteLink}`
    if (navigator.share) {
      await navigator.share({ title: 'DealBuddy Einladung', text, url: inviteLink })
    } else {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const completedCount = referrals.filter(r => r.completed).length
  const pendingCount   = referrals.filter(r => !r.completed).length

  return (
    <div style={{ minHeight: '100dvh', background: '#060606', color: '#F0ECE4', paddingBottom: 100 }}>

      {/* Header */}
      <div style={{ padding: '56px 20px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: 22 }}>‹</button>
        <h1 style={{ fontFamily: 'Cinzel,serif', fontSize: 20, color: '#F0ECE4', fontWeight: 700 }}>EINLADEN</h1>
      </div>

      {/* Hero */}
      <div style={{ margin: '0 16px 24px', background: 'linear-gradient(135deg, rgba(255,184,0,0.08), rgba(255,184,0,0.03))', borderRadius: 20, border: '1.5px solid rgba(255,184,0,0.2)', padding: '28px 24px', textAlign: 'center' }}>
        <p style={{ fontSize: 48, marginBottom: 12 }}>🎁</p>
        <p style={{ fontFamily: 'Cinzel,serif', fontSize: 16, color: '#FFB800', fontWeight: 700, marginBottom: 8 }}>FREUNDE EINLADEN</p>
        <p style={{ fontSize: 14, color: '#888', lineHeight: 1.6, marginBottom: 4 }}>
          Lade Freunde ein und erhalte Belohnungen sobald sie ihren ersten Deal abschließen.
        </p>
        <p style={{ fontSize: 13, color: '#FFB800' }}>🪙 <strong>500 Coins</strong> pro erfolgreichem Invite</p>
      </div>

      {/* Invite Code */}
      <div style={{ margin: '0 16px 16px' }}>
        <p style={{ fontFamily: 'Cinzel,serif', fontSize: 10, color: '#555', letterSpacing: 2, marginBottom: 8 }}>DEIN INVITE-CODE</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1, background: '#111', borderRadius: 12, border: '1px solid rgba(255,184,0,0.2)', padding: '14px 16px', display: 'flex', alignItems: 'center' }}>
            <span style={{ fontFamily: 'Cinzel,serif', fontSize: 18, color: '#FFB800', fontWeight: 700, letterSpacing: 3 }}>
              {inviteCode}
            </span>
          </div>
          <button
            onClick={copyCode}
            style={{ padding: '0 20px', borderRadius: 12, border: 'none', cursor: 'pointer', background: copied ? '#4ade80' : '#FFB800', color: '#000', fontFamily: 'Cinzel,serif', fontSize: 11, fontWeight: 700, flexShrink: 0, transition: 'background 0.2s' }}>
            {copied ? '✓' : '📋'}
          </button>
        </div>
      </div>

      {/* Share button */}
      <div style={{ margin: '0 16px 24px' }}>
        <button
          onClick={shareLink}
          style={{ width: '100%', padding: '14px', borderRadius: 12, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#CC8800,#FFB800)', color: '#000', fontFamily: 'Cinzel,serif', fontSize: 13, fontWeight: 700, letterSpacing: 1 }}>
          🔗 LINK TEILEN
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 8, margin: '0 16px 24px' }}>
        {[
          { label: 'Gesamt', val: referrals.length, color: '#888' },
          { label: 'Aktiv', val: completedCount, color: '#4ade80' },
          { label: 'Ausstehend', val: pendingCount, color: '#FFB800' },
        ].map(s => (
          <div key={s.label} style={{ flex: 1, background: '#111', borderRadius: 12, border: '1px solid #1a1a1a', padding: '14px 8px', textAlign: 'center' }}>
            <p style={{ fontFamily: 'Cinzel,serif', fontSize: 22, color: s.color, fontWeight: 700 }}>{s.val}</p>
            <p style={{ fontSize: 10, color: '#444', marginTop: 4 }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Referral list */}
      <div style={{ padding: '0 16px' }}>
        <p style={{ fontFamily: 'Cinzel,serif', fontSize: 10, color: '#555', letterSpacing: 2, marginBottom: 10 }}>EINGELADENE NUTZER</p>
        {loading ? (
          <p style={{ textAlign: 'center', color: '#444', padding: 40 }}>Lädt…</p>
        ) : referrals.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <p style={{ fontSize: 32, marginBottom: 12 }}>👥</p>
            <p style={{ fontFamily: 'Cinzel,serif', fontSize: 13, color: '#555' }}>Noch keine Einladungen</p>
            <p style={{ fontSize: 12, color: '#333', marginTop: 6 }}>Teile deinen Code und lade Freunde ein!</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {referrals.map(r => {
              const user = r.profiles
              return (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: '#111', borderRadius: 12, border: `1px solid ${r.completed ? 'rgba(74,222,128,0.2)' : '#1a1a1a'}` }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#222', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: '#FFB800', flexShrink: 0 }}>
                    {(user?.display_name || user?.username || '?')[0]}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#F0ECE4' }}>{user?.display_name || user?.username || 'Unbekannt'}</p>
                    <p style={{ fontSize: 11, color: '#555' }}>@{user?.username} · Lv.{user?.level || 1}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    {r.completed ? (
                      <span style={{ fontSize: 11, color: '#4ade80', fontFamily: 'Cinzel,serif' }}>✅ AKTIV</span>
                    ) : (
                      <span style={{ fontSize: 11, color: '#666' }}>⏳ Ausstehend</span>
                    )}
                    {r.reward_granted && (
                      <p style={{ fontSize: 10, color: '#FFB800', marginTop: 2 }}>🪙 +500</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* How it works */}
      <div style={{ margin: '24px 16px 0', background: '#0A0A0A', borderRadius: 16, border: '1px solid #1a1a1a', padding: '20px' }}>
        <p style={{ fontFamily: 'Cinzel,serif', fontSize: 11, color: '#555', letterSpacing: 2, marginBottom: 16 }}>WIE ES FUNKTIONIERT</p>
        {[
          { step: '1', text: 'Teile deinen persönlichen Invite-Code' },
          { step: '2', text: 'Dein Freund registriert sich mit deinem Code' },
          { step: '3', text: 'Er schließt seinen ersten Deal ab' },
          { step: '4', text: 'Du erhältst automatisch 🪙 500 Coins' },
        ].map(s => (
          <div key={s.step} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(255,184,0,0.1)', border: '1px solid rgba(255,184,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ fontFamily: 'Cinzel,serif', fontSize: 11, color: '#FFB800', fontWeight: 700 }}>{s.step}</span>
            </div>
            <p style={{ fontSize: 13, color: '#888', lineHeight: 1.4 }}>{s.text}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
