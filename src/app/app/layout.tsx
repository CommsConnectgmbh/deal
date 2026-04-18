'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { usePresence } from '@/hooks/usePresence'
import { CelebrationProvider } from '@/contexts/CelebrationContext'
import StreakLoginHandler from '@/components/StreakLoginHandler'
import { useLang } from '@/contexts/LanguageContext'
import BottomNav, { type BottomNavTab } from '@/components/layout/BottomNav'


export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, profile } = useAuth()
  const router   = useRouter()
  const pathname = usePathname()
  const { t } = useLang()

  const TABS: BottomNavTab[] = [
    { key: 'home',    href: '/app/home',    label: t('nav.home')    },
    { key: 'blitz',   href: '/app/blitz',   label: t('nav.blitz')   },
    { key: 'tippen',  href: '/app/tippen',  label: t('nav.tippen')  },
    { key: 'profile', href: '/app/profile', label: t('nav.profile') },
  ]

  // Online presence tracking
  usePresence(profile?.id)

  const [unreadMsgs,   setUnreadMsgs]   = useState(0)
  const [unreadNotifs, setUnreadNotifs] = useState(0)
  const [globalRank, setGlobalRank] = useState(0)

  const fetchBadges = useCallback(async () => {
    if (!profile) return
    const [msgRes, notifRes, rankRes] = await Promise.all([
      supabase
        .from('conversations')
        .select('unread_1, unread_2, participant_1')
        .or(`participant_1.eq.${profile.id},participant_2.eq.${profile.id}`),
      supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', profile.id)
        .eq('read', false),
      supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .gt('wins', profile.wins || 0),
    ])
    if (msgRes.data) {
      const total = msgRes.data.reduce((sum: number, c: any) => {
        return sum + (c.participant_1 === profile.id ? (c.unread_1 || 0) : (c.unread_2 || 0))
      }, 0)
      setUnreadMsgs(total)
    }
    setUnreadNotifs(notifRes.count || 0)
    setGlobalRank((rankRes.count || 0) + 1)
  }, [profile])

  useEffect(() => {
    if (profile) fetchBadges()
  }, [profile, fetchBadges])

  // Realtime badge updates
  useEffect(() => {
    if (!profile) return
    const ch = supabase
      .channel('layout_badge_updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, fetchBadges)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications',
          filter: `user_id=eq.${profile.id}` }, fetchBadges)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [profile, fetchBadges])

  useEffect(() => {
    if (!loading && !user) router.replace('/auth/login')
  }, [user, loading, router])

  useEffect(() => {
    if (!loading && user && profile && profile.onboarding_completed === false && pathname !== '/app/welcome') {
      router.replace('/app/welcome')
    }
  }, [user, loading, profile, pathname, router])

  if (loading || !user) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', background: 'var(--bg-base)' }}>
      <div style={{ width: 40, height: 40, border: '2px solid transparent', borderTopColor: 'var(--gold-primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}/>
    </div>
  )

  // W/L + Streak + Rank + Reliability for top bar
  const wins = profile?.wins ?? 0
  const losses = profile?.losses ?? 0
  const streak = profile?.streak ?? 0
  const level = profile?.level ?? 1
  const reliabilityScore = (profile as any)?.reliability_score
  const reliabilityColor = (profile as any)?.reliability_color
  const scoreDisplay = reliabilityScore != null ? `${Math.round(reliabilityScore * 100)}%` : '—'
  const scoreColorVal = reliabilityColor === 'green' ? '#22C55E' : reliabilityColor === 'yellow' ? '#EAB308' : reliabilityColor === 'red' ? '#EF4444' : 'var(--text-muted)'

  return (
    <div style={{ maxWidth: 430, margin: '0 auto', minHeight: '100dvh', background: 'var(--bg-base)', display: 'flex', flexDirection: 'column', position: 'relative' }}>

      {/* Top Bar — KD/Rank instead of DealBuddy text */}
      <div style={{
        position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 430, zIndex: 100,
        background: 'var(--bg-deepest)', backdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--border-subtle)',
        padding: 'env(safe-area-inset-top) 0 0',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px' }}>

          {/* Left: Notification bell */}
          <Link href="/app/notifications" style={{ textDecoration: 'none', position: 'relative', display: 'inline-flex' }}>
            <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-md)', background: 'var(--bg-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 18 }}>{'\u{1F514}'}</span>
            </div>
            {unreadNotifs > 0 && (
              <div style={{ position: 'absolute', top: -2, right: -2, minWidth: 16, height: 16, borderRadius: 8, background: 'var(--gold-primary)', border: '2px solid var(--bg-deepest)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px' }}>
                <span className="font-display" style={{ fontSize: 8, fontWeight: 700, color: 'var(--text-inverse)' }}>{unreadNotifs > 9 ? '9+' : unreadNotifs}</span>
              </div>
            )}
          </Link>

          {/* Center: W/L · Level · #Rank → links to leaderboard */}
          <Link href="/app/leaderboard" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            {/* W/L */}
            <div style={{ textAlign: 'center' }}>
              <span style={{
                fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700,
                color: 'var(--gold-primary)', letterSpacing: 1,
              }}>
                {wins}<span style={{ color: 'var(--text-muted)', fontSize: 12 }}>/</span>{losses}
              </span>
              <span style={{
                fontFamily: 'var(--font-display)', fontSize: 7, letterSpacing: 2,
                color: 'var(--text-muted)', display: 'block', marginTop: -2,
              }}>
                W/L
              </span>
            </div>

            {/* Divider */}
            <div style={{ width: 1, height: 22, background: 'var(--border-subtle)' }} />

            {/* Level */}
            <div style={{ textAlign: 'center' }}>
              <span style={{
                fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700,
                color: 'var(--gold-primary)', letterSpacing: 0.5,
              }}>
                {level}
              </span>
              <span style={{
                fontFamily: 'var(--font-display)', fontSize: 7, letterSpacing: 2,
                color: 'var(--text-muted)', display: 'block', marginTop: -2,
              }}>
                {t('nav.level')}
              </span>
            </div>

            {/* Divider */}
            <div style={{ width: 1, height: 22, background: 'var(--border-subtle)' }} />

            {/* Global rank position */}
            <div style={{ textAlign: 'center' }}>
              <span style={{
                fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700,
                color: 'var(--text-primary)', letterSpacing: 0.5,
              }}>
                #{globalRank || '\u2013'}
              </span>
              <span style={{
                fontFamily: 'var(--font-display)', fontSize: 7, letterSpacing: 2,
                color: 'var(--text-muted)', display: 'block', marginTop: -2,
              }}>
                {t('nav.rank')}
              </span>
            </div>

            {/* Divider */}
            <div style={{ width: 1, height: 22, background: 'var(--border-subtle)' }} />

            {/* Reliability Score */}
            <div style={{ textAlign: 'center' }}>
              <span style={{
                fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700,
                color: scoreColorVal, letterSpacing: 0.5,
              }}>
                {scoreDisplay}
              </span>
              <span style={{
                fontFamily: 'var(--font-display)', fontSize: 7, letterSpacing: 2,
                color: 'var(--text-muted)', display: 'block', marginTop: -2,
              }}>
                {t('nav.score')}
              </span>
            </div>
          </Link>

          {/* Right: Chat/Messages */}
          <Link href="/app/chat" style={{ textDecoration: 'none', display: 'inline-flex', position: 'relative' }}>
            <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-md)', background: 'var(--bg-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 18 }}>{'\u{1F4AC}'}</span>
            </div>
            {unreadMsgs > 0 && (
              <div style={{ position: 'absolute', top: -2, right: -2, minWidth: 16, height: 16, borderRadius: 8, background: 'var(--gold-primary)', border: '2px solid var(--bg-deepest)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px' }}>
                <span className="font-display" style={{ fontSize: 8, fontWeight: 700, color: 'var(--text-inverse)' }}>{unreadMsgs > 9 ? '9+' : unreadMsgs}</span>
              </div>
            )}
          </Link>
        </div>
      </div>

      {/* Streak Login Handler (invisible, runs on app load) */}
      {profile && <StreakLoginHandler userId={profile.id} />}

      {/* Page Content */}
      <div style={{ flex: 1, paddingTop: 68, paddingBottom: 84 }}>
        <CelebrationProvider>
          <div key={pathname} className="page-enter">
            {children}
          </div>
        </CelebrationProvider>
      </div>

      <BottomNav tabs={TABS} createHref="/app/deals/create" />
    </div>
  )
}
