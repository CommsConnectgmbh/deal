'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import AvatarDisplay from '@/components/AvatarDisplay'

// Bottom nav tabs: HOME | DEALS | [+] FAB | RIVALEN | SHOP
const TABS = [
  { href: '/app/home',   icon: '🏠', label: 'HOME'    },
  { href: '/app/deals',  icon: '🤝', label: 'DEALS'   },
  { href: null,          icon: '+',  label: ''         }, // FAB placeholder
  { href: '/app/rivals', icon: '⚡', label: 'RIVALEN'  },
  { href: '/app/shop',   icon: '🛍', label: 'SHOP'    },
]

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, profile } = useAuth()
  const router   = useRouter()
  const pathname = usePathname()

  const [unreadMsgs,   setUnreadMsgs]   = useState(0)
  const [unreadNotifs, setUnreadNotifs] = useState(0)
  const [avatarConfig, setAvatarConfig] = useState<any>(null)

  const fetchBadges = useCallback(async () => {
    if (!profile) return
    const [msgRes, notifRes] = await Promise.all([
      supabase
        .from('conversations')
        .select('unread_1, unread_2, participant_1')
        .or(`participant_1.eq.${profile.id},participant_2.eq.${profile.id}`),
      supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', profile.id)
        .eq('read', false),
    ])
    if (msgRes.data) {
      const total = msgRes.data.reduce((sum: number, c: any) => {
        return sum + (c.participant_1 === profile.id ? (c.unread_1 || 0) : (c.unread_2 || 0))
      }, 0)
      setUnreadMsgs(total)
    }
    setUnreadNotifs(notifRes.count || 0)
  }, [profile])

  const fetchAvatar = useCallback(async () => {
    if (!profile) return
    const { data } = await supabase
      .from('avatar_config')
      .select('*')
      .eq('user_id', profile.id)
      .single()
    setAvatarConfig(data)
  }, [profile])

  useEffect(() => {
    if (profile) {
      fetchBadges()
      fetchAvatar()
    }
  }, [profile, fetchBadges, fetchAvatar])

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

  if (loading || !user) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', background: '#060606' }}>
      <div style={{ width: 40, height: 40, border: '2px solid transparent', borderTopColor: '#FFB800', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}/>
      <style>{'@keyframes spin { to { transform: rotate(360deg); } }'}</style>
    </div>
  )

  const isDealsNew = pathname === '/app/deals/new'
  const archetype = profile?.primary_archetype || 'default'

  return (
    <div style={{ maxWidth: 430, margin: '0 auto', minHeight: '100dvh', background: '#060606', display: 'flex', flexDirection: 'column', position: 'relative' }}>

      {/* ── Top Bar ── */}
      <div style={{
        position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 430, zIndex: 100,
        background: 'rgba(6,6,6,0.95)', backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,184,0,0.08)',
        padding: 'env(safe-area-inset-top) 0 0',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px' }}>

          {/* Left: Notification bell */}
          <Link href="/app/notifications" style={{ textDecoration: 'none', position: 'relative', display: 'inline-flex' }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 18 }}>🔔</span>
            </div>
            {unreadNotifs > 0 && (
              <div style={{ position: 'absolute', top: -2, right: -2, minWidth: 16, height: 16, borderRadius: 8, background: '#FFB800', border: '2px solid #060606', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px' }}>
                <span style={{ fontSize: 8, fontWeight: 700, color: '#000', fontFamily: 'Cinzel, serif' }}>{unreadNotifs > 9 ? '9+' : unreadNotifs}</span>
              </div>
            )}
          </Link>

          {/* Center: Logo */}
          <Link href="/app/home" style={{ textDecoration: 'none' }}>
            <p className="font-display" style={{ fontSize: 16, letterSpacing: 4, color: '#FFB800', fontWeight: 700 }}>DEALBUDDY</p>
          </Link>

          {/* Right: Chat + Avatar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Link href="/app/chat" style={{ textDecoration: 'none', position: 'relative', display: 'inline-flex' }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 18 }}>💬</span>
              </div>
              {unreadMsgs > 0 && (
                <div style={{ position: 'absolute', top: -2, right: -2, minWidth: 16, height: 16, borderRadius: 8, background: '#FFB800', border: '2px solid #060606', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px' }}>
                  <span style={{ fontSize: 8, fontWeight: 700, color: '#000', fontFamily: 'Cinzel, serif' }}>{unreadMsgs > 9 ? '9+' : unreadMsgs}</span>
                </div>
              )}
            </Link>

            <Link href="/app/profile" style={{ textDecoration: 'none' }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', overflow: 'hidden', border: '2px solid rgba(255,184,0,0.3)' }}>
                <AvatarDisplay config={avatarConfig} archetype={archetype} size={36} />
              </div>
            </Link>
          </div>
        </div>
      </div>

      {/* ── Page Content ── */}
      <div style={{ flex: 1, overflowY: 'auto', paddingTop: 68, paddingBottom: 84 }}>
        {children}
      </div>

      {/* ── Bottom Tab Bar ── */}
      <nav style={{
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 430,
        background: 'rgba(6,6,6,0.97)', backdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(255,184,0,0.1)',
        display: 'flex', alignItems: 'center',
        paddingBottom: 'env(safe-area-inset-bottom)',
        zIndex: 100,
      }}>
        {TABS.map((tab, idx) => {
          // Center FAB
          if (tab.href === null) {
            return (
              <div key="fab" style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', paddingTop: 6, paddingBottom: 6 }}>
                <button
                  onClick={() => router.push('/app/deals?new=1')}
                  style={{
                    width: 52, height: 52, borderRadius: '50%',
                    background: 'linear-gradient(135deg, #CC8800, #FFB800, #FFE566)',
                    border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 4px 20px rgba(255,184,0,0.4)',
                    fontSize: 26, color: '#000', fontWeight: 700,
                    transform: isDealsNew ? 'scale(0.95)' : 'scale(1)',
                    transition: 'transform 0.15s',
                  }}
                >
                  +
                </button>
              </div>
            )
          }

          const active = pathname === tab.href || pathname.startsWith(tab.href + '/')
          return (
            <Link
              key={tab.href}
              href={tab.href}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '10px 0', textDecoration: 'none', gap: 3, position: 'relative' }}
            >
              <span style={{ fontSize: 20, opacity: active ? 1 : 0.35, transition: 'opacity 0.2s' }}>{tab.icon}</span>
              <span className="font-display" style={{ fontSize: 7, letterSpacing: 1, color: active ? '#FFB800' : 'rgba(240,236,228,0.3)', transition: 'color 0.2s' }}>
                {tab.label}
              </span>
              {active && (
                <div style={{ width: 4, height: 4, borderRadius: 2, background: '#FFB800', position: 'absolute', bottom: 6 }}/>
              )}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
