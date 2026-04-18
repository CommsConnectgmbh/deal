'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import CoinIcon from '@/components/CoinIcon'
import { useLang } from '@/contexts/LanguageContext'

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
  const { t } = useLang()
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
    const text = `🏆 ${t('invite.shareText')} ${inviteCode}\n${inviteLink}`
    if (navigator.share) {
      await navigator.share({ title: 'DealBuddy', text, url: inviteLink })
    } else {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const completedCount = referrals.filter(r => r.completed).length
  const pendingCount   = referrals.filter(r => !r.completed).length

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg-base)', color: 'var(--text-primary)', paddingBottom: 100 }}>

      {/* Header */}
      <div style={{ padding: '56px 20px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 22 }}>‹</button>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--text-primary)', fontWeight: 700 }}>{t('invite.title')}</h1>
      </div>

      {/* Hero */}
      <div style={{ margin: '0 16px 24px', background: 'linear-gradient(135deg, var(--gold-subtle), rgba(255,184,0,0.03))', borderRadius: 20, border: '1.5px solid var(--gold-glow)', padding: '28px 24px', textAlign: 'center' }}>
        <p style={{ fontSize: 48, marginBottom: 12 }}>🎁</p>
        <p style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: 'var(--gold-primary)', fontWeight: 700, marginBottom: 8 }}>{t('invite.inviteFriends')}</p>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 4 }}>
          {t('invite.inviteText')}
        </p>
        <p style={{ fontSize: 13, color: 'var(--gold-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}><CoinIcon size={14} /> <strong>500 Coins</strong> {t('invite.coinsPerInvite')}</p>
      </div>

      {/* Invite Code */}
      <div style={{ margin: '0 16px 16px' }}>
        <p style={{ fontFamily: 'var(--font-display)', fontSize: 10, color: 'var(--text-muted)', letterSpacing: 2, marginBottom: 8 }}>{t('invite.yourInviteCode')}</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1, background: 'var(--bg-surface)', borderRadius: 12, border: '1px solid var(--gold-glow)', padding: '14px 16px', display: 'flex', alignItems: 'center' }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--gold-primary)', fontWeight: 700, letterSpacing: 3 }}>
              {inviteCode}
            </span>
          </div>
          <button
            onClick={copyCode}
            style={{ padding: '0 20px', borderRadius: 12, border: 'none', cursor: 'pointer', background: copied ? 'var(--status-active)' : 'var(--gold-primary)', color: 'var(--text-inverse)', fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 700, flexShrink: 0, transition: 'background 0.2s' }}>
            {copied ? '✓' : '📋'}
          </button>
        </div>
      </div>

      {/* Share buttons */}
      <div style={{ margin: '0 16px 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* WhatsApp */}
        <button
          onClick={() => {
            const text = `⚔️ ${t('invite.shareText')} ${inviteCode}\n${inviteLink}`
            window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
          }}
          style={{ width: '100%', padding: '14px', borderRadius: 12, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, #128C7E, #25D366)', color: 'var(--text-inverse)', fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, letterSpacing: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          💬 {t('invite.shareWhatsapp')}
        </button>
        {/* General share */}
        <button
          onClick={shareLink}
          style={{ width: '100%', padding: '14px', borderRadius: 12, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, var(--gold-dim), var(--gold-primary))', color: 'var(--text-inverse)', fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, letterSpacing: 1 }}>
          🔗 {t('invite.shareLink')}
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 8, margin: '0 16px 24px' }}>
        {[
          { label: t('invite.total'), val: referrals.length, color: 'var(--text-secondary)' },
          { label: t('invite.active'), val: completedCount, color: 'var(--status-active)' },
          { label: t('invite.pending'), val: pendingCount, color: 'var(--gold-primary)' },
        ].map(s => (
          <div key={s.label} style={{ flex: 1, background: 'var(--bg-surface)', borderRadius: 12, border: '1px solid var(--bg-elevated)', padding: '14px 8px', textAlign: 'center' }}>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: s.color, fontWeight: 700 }}>{s.val}</p>
            <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Referral list */}
      <div style={{ padding: '0 16px' }}>
        <p style={{ fontFamily: 'var(--font-display)', fontSize: 10, color: 'var(--text-muted)', letterSpacing: 2, marginBottom: 10 }}>{t('invite.invitedUsers')}</p>
        {loading ? (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>{t('invite.loading')}</p>
        ) : referrals.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <p style={{ fontSize: 32, marginBottom: 12 }}>👥</p>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 13, color: 'var(--text-muted)' }}>{t('invite.noInvites')}</p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>{t('invite.noInvitesSub')}</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {referrals.map(r => {
              const user = r.profiles
              return (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--bg-surface)', borderRadius: 12, border: `1px solid ${r.completed ? 'rgba(74,222,128,0.2)' : 'var(--bg-elevated)'}` }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: 'var(--gold-primary)', flexShrink: 0 }}>
                    {(user?.display_name || user?.username || '?')[0]}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{user?.display_name || user?.username || t('invite.unknown')}</p>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>@{user?.username} · Lv.{user?.level || 1}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    {r.completed ? (
                      <span style={{ fontSize: 11, color: 'var(--status-active)', fontFamily: 'var(--font-display)' }}>✅ {t('invite.statusActive')}</span>
                    ) : (
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>⏳ {t('invite.statusPending')}</span>
                    )}
                    {r.reward_granted && (
                      <p style={{ fontSize: 10, color: 'var(--gold-primary)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 2 }}><CoinIcon size={12} /> +500</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* How it works */}
      <div style={{ margin: '24px 16px 0', background: 'var(--bg-base)', borderRadius: 16, border: '1px solid var(--bg-elevated)', padding: '20px' }}>
        <p style={{ fontFamily: 'var(--font-display)', fontSize: 11, color: 'var(--text-muted)', letterSpacing: 2, marginBottom: 16 }}>{t('invite.howItWorks')}</p>
        {[
          { step: '1', text: t('invite.step1'), showCoin: false },
          { step: '2', text: t('invite.step2'), showCoin: false },
          { step: '3', text: t('invite.step3'), showCoin: false },
          { step: '4', text: t('invite.step4'), showCoin: true },
        ].map(s => (
          <div key={s.step} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--gold-subtle)', border: '1px solid var(--gold-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 11, color: 'var(--gold-primary)', fontWeight: 700 }}>{s.step}</span>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.4, display: 'flex', alignItems: 'center', gap: 4 }}>{s.showCoin && <CoinIcon size={14} />}{s.text}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
