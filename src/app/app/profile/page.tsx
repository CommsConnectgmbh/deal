'use client'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useLang } from '@/contexts/LanguageContext'
import Image from 'next/image'
import AvatarDisplay, { AvatarConfig } from '@/components/AvatarDisplay'
import { supabase } from '@/lib/supabase'

const ARCHETYPES: Record<string, { icon: string; color: string }> = {
  closer:    { icon: '🤝', color: '#FFB800' },
  duelist:   { icon: '⚔️', color: '#f87171' },
  architect: { icon: '🏗️', color: '#60a5fa' },
  comeback:  { icon: '🔥', color: '#fb923c' },
  founder:   { icon: '👑', color: '#FFB800' },
  icon:      { icon: '💎', color: '#a78bfa' },
}

interface SocialUser {
  id: string
  username: string
  display_name: string
  level: number
  primary_archetype?: string
}

export default function ProfilePage() {
  const { profile, signOut } = useAuth()
  const { t, lang, setLang } = useLang()
  const router = useRouter()
  const [avatarConfig, setAvatarConfig] = useState<AvatarConfig | null>(null)
  const [unreadNotifs, setUnreadNotifs] = useState(0)
  const [followerCount, setFollowerCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)

  // Follow modal
  const [followModal, setFollowModal] = useState<'followers' | 'following' | null>(null)
  const [followModalList, setFollowModalList] = useState<SocialUser[]>([])
  const [followModalLoading, setFollowModalLoading] = useState(false)

  const archetype = profile?.primary_archetype || 'founder'

  useEffect(() => {
    if (!profile) return
    loadData()
  }, [profile])

  const loadData = useCallback(async () => {
    if (!profile) return
    const [avatarRes, notifsRes, profileRes] = await Promise.all([
      supabase.from('avatar_config').select('*').eq('user_id', profile.id).single(),
      supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', profile.id).eq('read', false),
      supabase.from('profiles').select('follower_count, following_count').eq('id', profile.id).single(),
    ])
    if (avatarRes.data) {
      setAvatarConfig({ body: avatarRes.data.body, hair: avatarRes.data.hair, outfit: avatarRes.data.outfit, accessory: avatarRes.data.accessory })
    }
    setUnreadNotifs(notifsRes.count || 0)
    if (profileRes.data) {
      setFollowerCount(profileRes.data.follower_count || 0)
      setFollowingCount(profileRes.data.following_count || 0)
    }
  }, [profile])

  const openFollowModal = async (type: 'followers' | 'following') => {
    setFollowModal(type)
    setFollowModalLoading(true)
    setFollowModalList([])
    let data: SocialUser[] = []
    if (type === 'followers') {
      const { data: rows } = await supabase
        .from('follows')
        .select('follower_id, profiles!follows_follower_id_fkey(id, username, display_name, level, primary_archetype)')
        .eq('following_id', profile!.id)
        .eq('status', 'accepted')
        .limit(50)
      data = (rows || []).map((r: any) => r.profiles).filter(Boolean)
    } else {
      const { data: rows } = await supabase
        .from('follows')
        .select('following_id, profiles!follows_following_id_fkey(id, username, display_name, level, primary_archetype)')
        .eq('follower_id', profile!.id)
        .eq('status', 'accepted')
        .limit(50)
      data = (rows || []).map((r: any) => r.profiles).filter(Boolean)
    }
    setFollowModalList(data)
    setFollowModalLoading(false)
  }

  const archetypeData = ARCHETYPES[archetype] || ARCHETYPES.founder
  const level = profile?.level ?? 1
  const xp = profile?.xp ?? 0
  const xpForLevel = level * 100
  const xpProgress = Math.min((xp % xpForLevel) / xpForLevel * 100, 100)
  const bpLevel = profile?.battle_pass_level ?? 1
  const bpProgress = Math.min(bpLevel / 30 * 100, 100)
  const initials = (profile?.display_name || profile?.username || 'U').slice(0, 2).toUpperCase()

  const handleLogout = async () => {
    await signOut()
    router.replace('/auth/login')
  }

  return (
    <div style={{ minHeight: '100dvh', background: '#060606', paddingTop: 60 }}>

      {/* Follow Modal */}
      {followModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }}
          onClick={() => setFollowModal(null)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ width: '100%', background: '#111', borderRadius: '20px 20px 0 0', border: '1px solid rgba(255,255,255,0.08)', maxHeight: '70vh', display: 'flex', flexDirection: 'column' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px 12px' }}>
              <span className="font-display" style={{ fontSize: 13, letterSpacing: 2, color: '#f0ece4' }}>
                {followModal === 'followers'
                  ? (lang === 'de' ? 'FOLLOWER' : 'FOLLOWERS')
                  : (lang === 'de' ? 'FOLGE ICH' : 'FOLLOWING')}
              </span>
              <button onClick={() => setFollowModal(null)} style={{ background: 'none', border: 'none', color: 'rgba(240,236,228,0.4)', fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>×</button>
            </div>
            <div style={{ overflowY: 'auto', flex: 1, padding: '0 16px 32px' }}>
              {followModalLoading && (
                <div style={{ textAlign: 'center', padding: 40, color: 'rgba(240,236,228,0.4)' }}>···</div>
              )}
              {!followModalLoading && followModalList.length === 0 && (
                <div style={{ textAlign: 'center', padding: 40 }}>
                  <p style={{ fontSize: 13, color: 'rgba(240,236,228,0.4)' }}>
                    {lang === 'de' ? 'Noch niemand hier.' : 'Nobody here yet.'}
                  </p>
                </div>
              )}
              {followModalList.map(user => (
                <div
                  key={user.id}
                  onClick={() => { setFollowModal(null); router.push(`/app/profile/${user.username}`) }}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer' }}
                >
                  <AvatarDisplay config={null} archetype={user.primary_archetype || 'founder'} size={38} initials={(user.display_name || user.username || 'U').slice(0,2).toUpperCase()} />
                  <div>
                    <p style={{ fontSize: 14, color: '#f0ece4', fontWeight: 600 }}>{user.display_name || user.username}</p>
                    <p style={{ fontSize: 11, color: 'rgba(240,236,228,0.4)' }}>@{user.username} · Lv.{user.level}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ padding: '0 20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 className="font-display" style={{ fontSize: 28, color: '#f0ece4' }}>{t('profile.title')}</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Notifications bell */}
          <button
            onClick={() => router.push('/app/notifications')}
            style={{ position: 'relative', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: 'rgba(240,236,228,0.6)', cursor: 'pointer', fontSize: 16, padding: '6px 10px' }}
          >
            🔔
            {unreadNotifs > 0 && (
              <span style={{ position: 'absolute', top: -4, right: -4, minWidth: 16, height: 16, borderRadius: 8, background: '#f87171', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Cinzel, serif', fontSize: 8, color: '#fff', fontWeight: 700, padding: '0 3px' }}>
                {unreadNotifs > 9 ? '9+' : unreadNotifs}
              </span>
            )}
          </button>
          <button onClick={() => router.push('/app/discover')} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: 'rgba(240,236,228,0.6)', cursor: 'pointer', fontSize: 16, padding: '6px 10px' }}>🔍</button>
          <button onClick={() => router.push('/app/settings')} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: 'rgba(240,236,228,0.6)', cursor: 'pointer', fontSize: 16, padding: '6px 10px' }}>⚙️</button>
        </div>
      </div>

      {/* Avatar + name */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 20px 20px' }}>
        <div style={{ position: 'relative', marginBottom: 8 }}>
          <AvatarDisplay config={avatarConfig} archetype={archetype} size={96} initials={initials} />
        </div>
        <button
          onClick={() => router.push('/app/avatar')}
          style={{ marginBottom: 12, padding: '4px 14px', borderRadius: 16, background: 'rgba(255,184,0,0.08)', border: '1px solid rgba(255,184,0,0.2)', color: 'rgba(255,184,0,0.7)', fontFamily: 'Cinzel, serif', fontSize: 9, letterSpacing: 1, cursor: 'pointer' }}
        >
          {t('avatar.editAvatar').toUpperCase()} ✏️
        </button>
        <h2 className="font-display" style={{ fontSize: 20, color: '#f0ece4', marginBottom: 4 }}>{profile?.display_name || profile?.username}</h2>
        <p style={{ fontSize: 13, color: 'rgba(240,236,228,0.4)', marginBottom: 10 }}>@{profile?.username}</p>

        {/* Follower / Following counts */}
        <div style={{ display: 'flex', gap: 24, marginBottom: 12 }}>
          <button
            onClick={() => openFollowModal('followers')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'center', padding: 0 }}
          >
            <p className="font-display" style={{ fontSize: 18, color: '#f0ece4', marginBottom: 2 }}>{followerCount}</p>
            <p style={{ fontFamily: 'Cinzel, serif', fontSize: 8, letterSpacing: 2, color: 'rgba(240,236,228,0.35)' }}>
              {lang === 'de' ? 'FOLLOWER' : 'FOLLOWERS'}
            </p>
          </button>
          <div style={{ width: 1, background: 'rgba(255,255,255,0.06)', alignSelf: 'stretch' }} />
          <button
            onClick={() => openFollowModal('following')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'center', padding: 0 }}
          >
            <p className="font-display" style={{ fontSize: 18, color: '#f0ece4', marginBottom: 2 }}>{followingCount}</p>
            <p style={{ fontFamily: 'Cinzel, serif', fontSize: 8, letterSpacing: 2, color: 'rgba(240,236,228,0.35)' }}>
              {lang === 'de' ? 'FOLGE ICH' : 'FOLLOWING'}
            </p>
          </button>
        </div>

        <div style={{ padding: '4px 14px', borderRadius: 20, background: `${archetypeData.color}18`, border: `1px solid ${archetypeData.color}44` }}>
          <span className="font-display" style={{ fontSize: 9, letterSpacing: 2, color: archetypeData.color }}>{archetypeData.icon} {t(`profile.archetypes.${archetype}`).toUpperCase()}</span>
        </div>
      </div>

      {/* Level / XP */}
      <div style={{ margin: '0 16px 20px', background: '#111', borderRadius: 14, border: '1px solid rgba(255,184,0,0.1)', padding: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div>
            <span className="font-display" style={{ fontSize: 9, letterSpacing: 2, color: 'rgba(240,236,228,0.4)' }}>{t('profile.level').toUpperCase()}</span>
            <p className="font-display" style={{ fontSize: 32, color: '#FFB800', lineHeight: 1 }}>{level}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span className="font-display" style={{ fontSize: 8, letterSpacing: 2, color: 'rgba(240,236,228,0.3)' }}>SEASON 1 · THE FOUNDERS ERA</span>
            <p style={{ fontSize: 12, color: 'rgba(240,236,228,0.4)', marginTop: 2 }}>{xp % xpForLevel} / {xpForLevel} XP</p>
          </div>
        </div>
        <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${xpProgress}%`, background: 'linear-gradient(90deg, #CC8800, #FFB800, #FFE566)', borderRadius: 2, transition: 'width 0.5s' }} />
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 8, margin: '0 16px 20px' }}>
        {[
          { label: t('profile.wins'),   val: profile?.wins ?? 0,        color: '#4ade80' },
          { label: t('profile.deals'),  val: profile?.deals_total ?? 0, color: '#60a5fa' },
          { label: t('profile.streak'), val: profile?.streak ?? 0,      color: '#fb923c' },
          { label: t('profile.coins'),  val: profile?.coins ?? 0,       color: '#FFB800', img: true },
        ].map(s => (
          <div key={s.label} style={{ flex: 1, background: '#111', borderRadius: 10, border: '1px solid rgba(255,255,255,0.05)', padding: '10px 6px', textAlign: 'center' }}>
            {s.img ? <Image src="/coin.png" alt="coin" width={20} height={20} style={{ margin: '0 auto 4px' }} /> : null}
            <p className="font-display" style={{ fontSize: s.img ? 14 : 20, color: s.color, marginBottom: 4 }}>{s.val}</p>
            <p className="font-display" style={{ fontSize: 7, letterSpacing: 1, color: 'rgba(240,236,228,0.3)' }}>{s.label.toUpperCase()}</p>
          </div>
        ))}
      </div>

      {/* Battle Pass */}
      <div style={{ margin: '0 16px 20px', background: '#111', borderRadius: 14, border: '1px solid rgba(255,184,0,0.15)', padding: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span className="font-display" style={{ fontSize: 11, letterSpacing: 2, color: '#FFB800' }}>{t('profile.battlePass').toUpperCase()}</span>
          <div style={{ padding: '3px 10px', borderRadius: 10, background: profile?.battle_pass_premium ? 'rgba(255,184,0,0.15)' : 'rgba(255,255,255,0.05)', border: `1px solid ${profile?.battle_pass_premium ? 'rgba(255,184,0,0.3)' : 'rgba(255,255,255,0.08)'}` }}>
            <span className="font-display" style={{ fontSize: 8, color: profile?.battle_pass_premium ? '#FFB800' : 'rgba(240,236,228,0.3)' }}>{profile?.battle_pass_premium ? t('profile.premiumTrack').toUpperCase() : t('profile.freeTrack').toUpperCase()}</span>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span className="font-display" style={{ fontSize: 9, color: 'rgba(240,236,228,0.4)' }}>{t('profile.passLevel').toUpperCase()} {bpLevel}/30</span>
          <span className="font-display" style={{ fontSize: 9, color: 'rgba(240,236,228,0.3)' }}>{30 - bpLevel} {lang === 'de' ? 'verbleibend' : 'remaining'}</span>
        </div>
        <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${bpProgress}%`, background: 'linear-gradient(90deg, #CC8800, #FFB800, #FFE566)', borderRadius: 3, transition: 'width 0.5s' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
          {Array.from({ length: 10 }, (_, i) => i * 3 + 3).map(lvl => (
            <div key={lvl} style={{ width: 6, height: 6, borderRadius: '50%', background: bpLevel >= lvl ? '#FFB800' : 'rgba(255,255,255,0.1)' }} />
          ))}
        </div>
        <button onClick={() => router.push('/app/battlepass')} style={{ width: '100%', marginTop: 14, padding: '10px', borderRadius: 8, border: '1px solid rgba(255,184,0,0.2)', background: 'rgba(255,184,0,0.06)', color: '#FFB800', fontFamily: 'Cinzel, serif', fontSize: 10, letterSpacing: 2, cursor: 'pointer' }}>
          {t('profile.battlePass').toUpperCase()} →
        </button>
      </div>

      {/* ── Quick Access Grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, margin: '0 16px 16px' }}>
        {[
          { label: 'BELOHNUNGEN', icon: '🎁', href: '/app/rewards', badge: true },
          { label: 'CHALLENGES',  icon: '⚔️', href: '/app/challenges' },
          { label: 'MEILENSTEINE',icon: '🏆', href: '/app/milestones' },
          { label: 'RANGLISTE',   icon: '📊', href: '/app/leaderboard' },
          { label: 'EINLADEN',    icon: '🔗', href: '/app/invite' },
          { label: 'BATTLE PASS', icon: '⭐', href: '/app/battlepass' },
        ].map(item => (
          <button key={item.href} onClick={() => router.push(item.href)}
            style={{ position: 'relative', padding: '14px 12px', background: '#111', borderRadius: 14, border: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 22 }}>{item.icon}</span>
            <span style={{ fontFamily: 'Cinzel, serif', fontSize: 10, letterSpacing: 1, color: 'rgba(240,236,228,0.7)', fontWeight: 700 }}>{item.label}</span>
            <span style={{ marginLeft: 'auto', color: 'rgba(240,236,228,0.2)', fontSize: 14 }}>›</span>
          </button>
        ))}
      </div>

      {/* Menu */}
      <div style={{ margin: '0 16px 100px', background: '#111', borderRadius: 14, border: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden' }}>
        <button onClick={() => router.push('/app/notifications')} style={{ width: '100%', padding: '16px', background: 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 15, color: '#f0ece4', display: 'flex', alignItems: 'center', gap: 8 }}>
            🔔 {lang === 'de' ? 'Benachrichtigungen' : 'Notifications'}
            {unreadNotifs > 0 && (
              <span style={{ minWidth: 18, height: 18, borderRadius: 9, background: '#f87171', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Cinzel, serif', fontSize: 9, color: '#fff', fontWeight: 700, padding: '0 4px' }}>
                {unreadNotifs > 9 ? '9+' : unreadNotifs}
              </span>
            )}
          </span>
          <span style={{ color: 'rgba(240,236,228,0.3)' }}>›</span>
        </button>
        <button onClick={() => router.push('/app/chat')} style={{ width: '100%', padding: '16px', background: 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 15, color: '#f0ece4' }}>💬 {lang === 'de' ? 'Nachrichten' : 'Messages'}</span>
          <span style={{ color: 'rgba(240,236,228,0.3)' }}>›</span>
        </button>
        <button onClick={() => router.push('/app/settings')} style={{ width: '100%', padding: '16px', background: 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 15, color: '#f0ece4' }}>⚙️ {t('profile.settings')}</span>
          <span style={{ color: 'rgba(240,236,228,0.3)' }}>›</span>
        </button>
        <button onClick={() => router.push('/app/discover')} style={{ width: '100%', padding: '16px', background: 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 15, color: '#f0ece4' }}>🔍 {t('profile.discover')}</span>
          <span style={{ color: 'rgba(240,236,228,0.3)' }}>›</span>
        </button>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          <span style={{ fontSize: 15, color: '#f0ece4' }}>🌐 {t('profile.language')}</span>
          <div style={{ display: 'flex', background: '#1a1a1a', borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
            {(['de', 'en'] as const).map(l => (
              <button key={l} onClick={() => setLang(l)} style={{ padding: '6px 16px', border: 'none', cursor: 'pointer', background: lang === l ? 'linear-gradient(135deg, #CC8800, #FFB800)' : 'transparent', color: lang === l ? '#000' : 'rgba(240,236,228,0.4)', fontFamily: 'Cinzel, serif', fontSize: 11, fontWeight: 700, letterSpacing: 1, transition: 'all 0.2s' }}>
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <button onClick={handleLogout} style={{ width: '100%', padding: '16px', background: 'rgba(248,113,113,0.05)', border: 'none', cursor: 'pointer', color: '#f87171', fontFamily: 'Cinzel, serif', fontSize: 12, letterSpacing: 2, textAlign: 'center' }}>
          {t('auth.logout').toUpperCase()}
        </button>
      </div>
    </div>
  )
}
