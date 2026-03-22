'use client'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import AvatarFrame, { FrameRarity } from '@/components/AvatarFrame'
import { getEquippedCard, type EquippedCard } from '@/lib/card-helpers'
import CoinIcon from '@/components/CoinIcon'
import ProfileImage from '@/components/ProfileImage'
import ProfileImageLightbox from '@/components/ProfileImageLightbox'
import { useLang } from '@/contexts/LanguageContext'
import { supabase } from '@/lib/supabase'

/* ─── Helpers ─── */
function mapFrameRarity(frameName?: string | null): FrameRarity {
  if (!frameName) return 'common'
  if (frameName.includes('founder')) return 'founder'
  if (frameName.includes('legendary')) return 'legendary'
  if (frameName.includes('epic')) return 'epic'
  if (frameName.includes('rare')) return 'rare'
  return 'common'
}

function daysSince(dateStr?: string | null): number {
  if (!dateStr) return 0
  const diff = Date.now() - new Date(dateStr).getTime()
  return Math.max(1, Math.floor(diff / 86400000))
}

const ARCHETYPES: Record<string, { icon: string; color: string }> = {
  closer:    { icon: '\u{1F91D}', color: 'var(--gold-primary)' },
  duelist:   { icon: '\u{2694}\u{FE0F}', color: 'var(--status-error)' },
  architect: { icon: '\u{1F3D7}\u{FE0F}', color: 'var(--status-info)' },
  comeback:  { icon: '\u{1F525}', color: 'var(--status-warning)' },
  founder:   { icon: '\u{1F451}', color: 'var(--gold-primary)' },
  icon:      { icon: '\u{1F48E}', color: '#a78bfa' },
}

const RANK_TIERS = [
  { min: 0,  title: 'RECRUIT',      icon: '\u{1F396}\u{FE0F}', color: '#6b7280' },
  { min: 3,  title: 'CONTENDER',    icon: '\u{2694}\u{FE0F}',  color: '#60a5fa' },
  { min: 10, title: 'VETERAN',      icon: '\u{1F3AF}',         color: '#a78bfa' },
  { min: 25, title: 'ELITE',        icon: '\u{1F525}',         color: '#f97316' },
  { min: 50, title: 'LEGEND',       icon: '\u{1F451}',         color: 'var(--gold-primary)' },
  { min: 100,title: 'MYTHIC',       icon: '\u{1F48E}',         color: '#ec4899' },
]

function getRank(wins: number) {
  let rank = RANK_TIERS[0]
  for (const t of RANK_TIERS) { if (wins >= t.min) rank = t }
  const nextIdx = RANK_TIERS.indexOf(rank) + 1
  const next = nextIdx < RANK_TIERS.length ? RANK_TIERS[nextIdx] : null
  const progress = next ? Math.min(((wins - rank.min) / (next.min - rank.min)) * 100, 100) : 100
  return { ...rank, next, progress, winsToNext: next ? next.min - wins : 0 }
}

const DAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

/* ─── Types ─── */
interface StreakData { current_streak: number; longest_streak: number; last_login_date: string | null; login_cycle_day: number }
interface RivalData { rival_id: string; total_deals: number; profiles?: { username: string } }

/* ═══════════════════════════════════════════════════════════════
   PROFILE PAGE — Viral Competitive Trophy Page
   ═══════════════════════════════════════════════════════════════ */
export default function ProfilePage() {
  const { profile, signOut } = useAuth()
  const router = useRouter()
  const { t } = useLang()

  const [followerCount, setFollowerCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [streakData, setStreakData] = useState<StreakData | null>(null)
  const [topRival, setTopRival] = useState<RivalData | null>(null)
  const [createdAt, setCreatedAt] = useState<string | null>(null)
  const [bpTiers, setBpTiers] = useState<{ tier: number; claimed: boolean }[]>([])
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [profileImages, setProfileImages] = useState<any[]>([])
  const [myDeals, setMyDeals] = useState<any[]>([])
  const [dealsLoading, setDealsLoading] = useState(true)
  const [equippedCard, setEquippedCard] = useState<EquippedCard | null>(null)
  const [globalRank, setGlobalRank] = useState(0)
  const [editingStatus, setEditingStatus] = useState(false)
  const [statusDraft, setStatusDraft] = useState('')

  const loadProfileImages = useCallback(async () => {
    if (!profile) return
    const { data } = await supabase
      .from('profile_images')
      .select('id, user_id, storage_path, public_url, created_at')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
    setProfileImages(data || [])
  }, [profile])

  useEffect(() => { loadProfileImages() }, [loadProfileImages])

  const archetype = profile?.primary_archetype || 'founder'
  const archetypeData = ARCHETYPES[archetype] || ARCHETYPES.founder
  const level = profile?.level ?? 1
  const xp = profile?.xp ?? 0
  const xpForLevel = level * 100
  const xpProgress = Math.min((xp % xpForLevel) / xpForLevel * 100, 100)
  const wins = profile?.wins ?? 0
  const losses = profile?.losses ?? 0
  const streak = profile?.streak ?? 0
  const dealsTotal = profile?.deals_total ?? 0
  const winRate = dealsTotal > 0 ? Math.round((wins / dealsTotal) * 100) : 0
  const kdRatio = losses > 0 ? (wins / losses).toFixed(1) : wins > 0 ? `${wins}.0` : '0.0'
  const bpLevel = profile?.battle_pass_level ?? 1
  const rank = getRank(wins)

  /* ─── Load all data ─── */
  useEffect(() => { if (profile) { loadAllData(); loadMyDeals() } }, [profile])

  const loadAllData = useCallback(async () => {
    if (!profile) return
    getEquippedCard(profile.id).then(card => setEquippedCard(card))
    const [profileRes, streakRes, rivalRes, rankRes] = await Promise.all([
      supabase.from('profiles').select('follower_count, following_count, created_at').eq('id', profile.id).single(),
      supabase.from('user_login_streaks').select('current_streak, longest_streak, last_login_date, login_cycle_day').eq('user_id', profile.id).single(),
      supabase.from('rivalries').select('rival_id, total_deals, profiles:rival_id(username)').eq('user_id', profile.id).order('total_deals', { ascending: false }).limit(1).single(),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).gt('wins', profile.wins || 0),
    ])
    if (profileRes.data) {
      setFollowerCount(profileRes.data.follower_count || 0)
      setFollowingCount(profileRes.data.following_count || 0)
      setCreatedAt(profileRes.data.created_at)
    }
    setStreakData(streakRes.data || null)
    setTopRival(rivalRes.data as any || null)
    setGlobalRank((rankRes.count || 0) + 1)

    const { data: bpData } = await supabase.from('battle_pass_rewards').select('tier').order('tier', { ascending: true }).limit(10)
    if (bpData) { setBpTiers(bpData.map((r: any) => ({ tier: r.tier, claimed: r.tier <= bpLevel }))) }
  }, [profile, bpLevel])

  const loadMyDeals = useCallback(async () => {
    if (!profile) return
    setDealsLoading(true)
    const { data } = await supabase
      .from('bets')
      .select('id, title, stake, status, category, created_at, creator_id, opponent_id, creator:creator_id(username, display_name, avatar_url), opponent:opponent_id(username, display_name, avatar_url)')
      .or(`creator_id.eq.${profile.id},opponent_id.eq.${profile.id}`)
      .order('created_at', { ascending: false })
      .limit(20)
    setMyDeals(data || [])
    setDealsLoading(false)
  }, [profile])

  const handleLogout = async () => { await signOut(); router.replace('/auth/login') }

  /* Calendar */
  const today = new Date().getDay()
  const todayIdx = today === 0 ? 6 : today - 1

  const sectionStyle = {
    background: 'var(--bg-deepest)', border: '1px solid var(--border-subtle)',
    borderRadius: 14, padding: 16, marginBottom: 12,
  }

  /* ═══ RENDER ═══ */
  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg-base)', paddingTop: 60, paddingBottom: 120 }}>

      {/* ═══ HEADER ═══ */}
      <div style={{ padding: '0 20px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, color: 'var(--text-primary)', letterSpacing: 2 }}>{t('profile.title').toUpperCase()}</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={() => router.push('/app/discover')} style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border-subtle)', borderRadius: 8, color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 16, padding: '6px 10px' }}>
            {'\u{1F50D}'}
          </button>
          <button onClick={() => router.push('/app/notifications')} style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border-subtle)', borderRadius: 8, color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 16, padding: '6px 10px', position: 'relative' }}>
            {'\u{1F514}'}
          </button>
          <button onClick={() => router.push('/app/settings')} style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border-subtle)', borderRadius: 8, color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 16, padding: '6px 10px' }}>{'\u{2699}\u{FE0F}'}</button>
        </div>
      </div>

      {/* ═══ AVATAR + IDENTITY ═══ */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 20px 12px' }}>
        <div onClick={() => setLightboxOpen(true)} style={{ cursor: 'pointer', position: 'relative', marginBottom: 8 }}>
          <ProfileImage size={76} avatarUrl={profile?.avatar_url} name={profile?.display_name || profile?.username} goldBorder />
          {profileImages.length > 1 && (
            <div style={{ display: 'flex', gap: 3, justifyContent: 'center', marginTop: 4 }}>
              {profileImages.slice(0, 5).map((_, i) => (
                <div key={i} style={{ width: 5, height: 5, borderRadius: 3, background: i === 0 ? 'var(--gold-primary)' : 'var(--text-muted)' }} />
              ))}
            </div>
          )}
        </div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--text-primary)', marginBottom: 2 }}>{profile?.display_name || profile?.username}</h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>@{profile?.username}</p>

        {/* Status text */}
        {editingStatus ? (
          <input
            autoFocus
            maxLength={60}
            value={statusDraft}
            onChange={e => setStatusDraft(e.target.value)}
            onBlur={async () => {
              setEditingStatus(false)
              const trimmed = statusDraft.trim()
              if (trimmed !== (profile?.status_text || '')) {
                await supabase.from('profiles').update({ status_text: trimmed || null, status_updated_at: new Date().toISOString() }).eq('id', profile!.id)
              }
            }}
            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
            placeholder={t('profile.statusPlaceholder')}
            style={{
              background: 'transparent', border: 'none', borderBottom: '1px solid var(--gold-primary)',
              color: 'rgba(255,255,255,0.7)', fontStyle: 'italic', fontFamily: 'var(--font-body)',
              fontSize: 12, textAlign: 'center', outline: 'none', width: '80%', maxWidth: 260,
              padding: '4px 0', marginBottom: 8,
            }}
          />
        ) : (
          <p
            onClick={() => { setStatusDraft(profile?.status_text || ''); setEditingStatus(true) }}
            style={{
              fontSize: 12, color: profile?.status_text ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.25)',
              fontStyle: 'italic', fontFamily: 'var(--font-body)', cursor: 'pointer',
              marginBottom: 8, padding: '2px 0',
            }}
          >
            {profile?.status_text || t('profile.setStatus')}
          </p>
        )}

        {/* Follower / Following */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          <button onClick={() => router.push('/app/profile/followers')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--text-primary)', fontFamily: 'var(--font-body)', fontSize: 13 }}>
            <strong>{followerCount}</strong> <span style={{ color: 'var(--text-muted)' }}>{t('rivals.followers')}</span>
          </button>
          <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{'\u00B7'}</span>
          <button onClick={() => router.push('/app/profile/following')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--text-primary)', fontFamily: 'var(--font-body)', fontSize: 13 }}>
            <strong>{followingCount}</strong> <span style={{ color: 'var(--text-muted)' }}>{t('rivals.following')}</span>
          </button>
        </div>

        {/* Archetype badge */}
        <div style={{ padding: '4px 14px', borderRadius: 20, background: `${archetypeData.color}18`, border: `1px solid ${archetypeData.color}44` }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 9, letterSpacing: 2, color: archetypeData.color }}>{archetypeData.icon} {archetype.toUpperCase()}</span>
        </div>

        {/* SHARE + EINLADEN */}
        <div style={{ display: 'flex', gap: 10, marginTop: 14, width: '100%', maxWidth: 320 }}>
          <button
            onClick={() => {
              const url = `https://app.deal-buddy.app/app/profile/${profile?.username}`
              if (navigator.share) {
                navigator.share({ title: `@${profile?.username} auf DealBuddy`, text: `${rank.icon} ${rank.title} \u2022 ${wins}W/${losses}L \u2022 K/D: ${kdRatio} \u2022 ${'\u{1F525}'}${streak} Streak`, url })
              } else { navigator.clipboard.writeText(url); alert(t('profile.linkCopied')) }
            }}
            style={{
              flex: 1, padding: '10px 14px', borderRadius: 12, cursor: 'pointer',
              background: 'linear-gradient(135deg, var(--gold-dim), var(--gold-primary))',
              color: 'var(--text-inverse)', fontFamily: 'var(--font-display)',
              fontSize: 10, fontWeight: 700, letterSpacing: 1.5, border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              boxShadow: '0 4px 12px rgba(245,158,11,0.25)',
            }}
          >
            {'\u{1F4E4}'} {t('profile.shareProfile').toUpperCase()}
          </button>
          <button onClick={() => router.push('/app/invite')} style={{
            flex: 1, padding: '10px 14px', borderRadius: 12, cursor: 'pointer',
            background: 'var(--bg-surface)', border: '1px solid var(--gold-glow)',
            color: 'var(--gold-primary)', fontFamily: 'var(--font-display)',
            fontSize: 10, fontWeight: 700, letterSpacing: 1.5,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
            {'\u{1F381}'} {t('profile.invite').toUpperCase()}
          </button>
        </div>

        {/* SHOP Button */}
        <button onClick={() => router.push('/app/shop')} style={{
          width: '100%', maxWidth: 320, marginTop: 10, padding: '10px 14px', borderRadius: 12, cursor: 'pointer',
          background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
          color: 'var(--text-primary)', fontFamily: 'var(--font-display)',
          fontSize: 10, fontWeight: 700, letterSpacing: 1.5,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}>
          {'\u{1F6CD}\u{FE0F}'} {t('nav.shop').toUpperCase()}
        </button>
      </div>

      <div style={{ padding: '0 16px' }}>

        {/* ═══ BATTLE CARD — HERO SECTION ═══ */}
        {equippedCard?.imageUrl ? (
          <div onClick={() => router.push('/app/avatar')} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer',
            padding: '16px 0', marginBottom: 12,
          }}>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 10, letterSpacing: 3, color: 'var(--gold-primary)', marginBottom: 14 }}>{t('profile.battleCard').toUpperCase()}</p>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <AvatarFrame
                frameType={(profile?.active_frame as any) || 'none'}
                imageUrl={equippedCard.imageUrl}
                size="lg"
                username={profile?.username}
                level={profile?.level}
                streak={profile?.streak}
                serialNumber={equippedCard.serialDisplay}
                showInfo
              />
            </div>
          </div>
        ) : (
          <div
            onClick={() => router.push('/app/avatar-card/create')}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer',
              padding: '16px 0', marginBottom: 12,
            }}
          >
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 10, letterSpacing: 3, color: 'var(--gold-primary)', marginBottom: 16 }}>{t('profile.battleCard').toUpperCase()}</p>
            <div style={{
              width: 140, height: 200, borderRadius: 16,
              background: 'linear-gradient(135deg, rgba(205,127,50,0.15), rgba(205,127,50,0.05))',
              border: '2px dashed rgba(255,184,0,0.3)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 12, marginBottom: 16,
            }}>
              <span style={{ fontSize: 44 }}>{'\u{1F3B4}'}</span>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 8, letterSpacing: 2, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{t('profile.noCard')}</span>
            </div>
            <button style={{
              padding: '14px 32px', borderRadius: 12, border: 'none',
              background: 'linear-gradient(135deg, var(--gold-dim), var(--gold-primary))',
              color: 'var(--text-inverse)', fontFamily: 'var(--font-display)', fontSize: 12,
              fontWeight: 700, letterSpacing: 2, cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(245,158,11,0.35)',
            }}>
              {t('profile.createCard').toUpperCase()}
            </button>
          </div>
        )}

        {/* ═══ STATS ═══ */}
        <div style={sectionStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 10, letterSpacing: 2, color: 'var(--text-muted)' }}>{t('profile.stats').toUpperCase()}</p>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 10, letterSpacing: 1, color: 'var(--gold-primary)' }}>#{globalRank}</span>
          </div>

          {/* Stat grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
            {[
              { label: 'SCORE', val: profile?.reliability_score != null ? `${Math.round((profile.reliability_score as number) * 100)}%` : '—', color: profile?.reliability_color === 'green' ? '#22C55E' : profile?.reliability_color === 'yellow' ? '#EAB308' : profile?.reliability_color === 'red' ? '#EF4444' : 'var(--text-muted)' },
              { label: 'DEALS', val: dealsTotal, color: 'var(--status-info)' },
              { label: 'WIN%', val: `${winRate}%`, color: '#4ade80' },
              { label: 'STREAK', val: streak, color: 'var(--status-warning)', icon: '\u{1F525}' },
              { label: 'COINS', val: profile?.coins ?? 0, color: 'var(--gold-primary)', isCoin: true },
            ].map(s => (
              <div key={s.label} onClick={s.isCoin ? () => router.push('/app/shop?section=coins') : undefined} style={{
                background: 'var(--bg-overlay)', borderRadius: 10, border: '1px solid var(--border-subtle)',
                padding: '10px 4px', textAlign: 'center', cursor: s.isCoin ? 'pointer' : 'default',
              }}>
                {s.isCoin && <CoinIcon size={16} style={{ margin: '0 auto 2px', display: 'block' }} />}
                <p style={{ fontFamily: 'var(--font-display)', fontSize: 15, color: s.color, marginBottom: 2 }}>
                  {s.icon || ''}{s.val}
                </p>
                <p style={{ fontFamily: 'var(--font-display)', fontSize: 7, letterSpacing: 1, color: 'var(--text-muted)' }}>{s.label}</p>
              </div>
            ))}
          </div>

          {/* Rival + Member since */}
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-body)', textAlign: 'center' }}>
            {t('profile.rival')}: <strong style={{ color: 'var(--gold-primary)' }}>{topRival?.profiles?.username ? `@${(topRival.profiles as any).username}` : '-'}</strong>
            {' \u00B7 '}{t('profile.bestStreak')}: <strong style={{ color: 'var(--text-primary)' }}>{streakData?.longest_streak ?? streak}</strong>
            {' \u00B7 '}{daysSince(createdAt)}{t('profile.daysActive')}
          </div>
        </div>

        {/* ═══ SEASON 1 + BATTLE PASS (combined) ═══ */}
        <div style={sectionStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 10, letterSpacing: 2, color: 'var(--text-muted)' }}>{t('battlepass.season').toUpperCase()}</p>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 10, color: 'var(--gold-primary)' }}>{t('profile.level')} {level}</span>
          </div>

          {/* XP bar */}
          <div style={{ height: 6, background: 'var(--border-subtle)', borderRadius: 3, overflow: 'hidden', marginBottom: 6 }}>
            <div style={{ height: '100%', width: `${xpProgress}%`, background: 'linear-gradient(90deg, var(--gold-dim), var(--gold-primary), var(--gold-bright))', borderRadius: 3, transition: 'width 0.5s' }} />
          </div>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 10, color: 'var(--text-muted)', marginBottom: 12, textAlign: 'right' }}>{xp % xpForLevel}/{xpForLevel} XP</p>

          {/* Streak + Calendar row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--status-warning)' }}>{'\u{1F525}'} {streakData?.current_streak ?? streak} {t('profile.dayStreak')}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 4, marginBottom: 16 }}>
            {DAY_LABELS.map((day, i) => {
              const isToday = i === todayIdx
              const isPast = i < todayIdx
              let icon = '\u{2591}'
              let bg = 'var(--bg-overlay)'
              let color = 'var(--text-muted)'
              if (isToday) { icon = '\u{1F525}'; bg = 'var(--status-warning)22'; color = 'var(--status-warning)' }
              else if (isPast) { icon = '\u{2705}'; bg = 'var(--status-active)18'; color = 'var(--status-active)' }
              return (
                <div key={day} style={{ flex: 1, textAlign: 'center', padding: '6px 0', borderRadius: 8, background: bg, border: isToday ? '1px solid var(--status-warning)' : '1px solid transparent' }}>
                  <p style={{ fontFamily: 'var(--font-display)', fontSize: 7, letterSpacing: 1, color: 'var(--text-muted)', marginBottom: 2 }}>{day}</p>
                  <p style={{ fontSize: 12 }}>{icon}</p>
                </div>
              )
            })}
          </div>

          {/* ── Battle Pass (integrated) ── */}
          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: 10, letterSpacing: 2, color: 'var(--gold-primary)' }}>{t('profile.battlePass').toUpperCase()}</p>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 8, color: profile?.battle_pass_premium ? 'var(--gold-primary)' : 'var(--text-muted)', padding: '3px 8px', borderRadius: 8, background: profile?.battle_pass_premium ? 'var(--gold-subtle)' : 'var(--bg-overlay)', border: `1px solid ${profile?.battle_pass_premium ? 'var(--gold-glow)' : 'var(--border-subtle)'}` }}>
                {profile?.battle_pass_premium ? 'PREMIUM' : 'FREE'}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 6, WebkitOverflowScrolling: 'touch' }}>
              {(bpTiers.length > 0 ? bpTiers : Array.from({ length: 10 }, (_, i) => ({ tier: i + 1, claimed: i + 1 <= bpLevel }))).map((t, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                  <div style={{
                    minWidth: 44, padding: '6px 4px', borderRadius: 8, textAlign: 'center',
                    background: t.claimed ? 'var(--gold-subtle)' : 'var(--bg-overlay)',
                    border: `1px solid ${t.claimed ? 'var(--gold-glow)' : 'var(--border-subtle)'}`,
                  }}>
                    <p style={{ fontFamily: 'var(--font-display)', fontSize: 7, color: t.claimed ? 'var(--gold-primary)' : 'var(--text-muted)', letterSpacing: 0.5 }}>{t.tier}</p>
                    <p style={{ fontSize: 11, marginTop: 1 }}>{t.claimed ? '\u{2705}' : '\u{1F512}'}</p>
                  </div>
                  {i < (bpTiers.length > 0 ? bpTiers.length : 10) - 1 && <span style={{ color: 'var(--text-muted)', fontSize: 8 }}>{'\u{2192}'}</span>}
                </div>
              ))}
            </div>
            <button onClick={() => router.push('/app/battlepass')} style={{ width: '100%', marginTop: 8, padding: 7, borderRadius: 8, border: '1px solid var(--gold-glow)', background: 'var(--gold-subtle)', color: 'var(--gold-primary)', fontFamily: 'var(--font-display)', fontSize: 9, letterSpacing: 2, cursor: 'pointer' }}>
              {t('profile.battlePass').toUpperCase()} {'\u{203A}'}
            </button>
          </div>
        </div>

        {/* ═══ MEINE DEALS ═══ */}
        <div style={sectionStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 10, letterSpacing: 2, color: 'var(--text-muted)' }}>{t('profile.myDeals').toUpperCase()}</p>
            <button onClick={() => router.push('/app/deals')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gold-primary)', fontFamily: 'var(--font-display)', fontSize: 9, letterSpacing: 1 }}>{t('profile.seeAll').toUpperCase()} {'\u{203A}'}</button>
          </div>

          {dealsLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 16 }}>
              <div style={{ width: 24, height: 24, border: '2px solid transparent', borderTopColor: 'var(--gold-primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            </div>
          ) : myDeals.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 20 }}>
              <p style={{ fontSize: 24, marginBottom: 6 }}>{'\u{2694}\u{FE0F}'}</p>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text-secondary)' }}>{t('profile.noDealsYet')}</p>
            </div>
          ) : (
            <>
              {(['active', 'open', 'pending', 'pending_confirmation', 'completed'] as const).map(status => {
                const statusDeals = myDeals.filter((d: any) => d.status === status)
                if (statusDeals.length === 0) return null
                const statusLabels: Record<string, string> = { active: t('profile.statusActive').toUpperCase(), open: t('profile.statusOpen').toUpperCase(), pending: t('profile.statusPending').toUpperCase(), pending_confirmation: t('profile.statusConfirmation').toUpperCase(), completed: t('profile.statusCompleted').toUpperCase() }
                const statusColors: Record<string, string> = { active: '#4ade80', open: '#FFB800', pending: '#f97316', pending_confirmation: '#a78bfa', completed: '#60a5fa' }
                return (
                  <div key={status} style={{ marginBottom: 8 }}>
                    <p style={{ fontFamily: 'var(--font-display)', fontSize: 8, letterSpacing: 2, color: statusColors[status] || 'var(--text-muted)', marginBottom: 4 }}>
                      {statusLabels[status] || status.toUpperCase()} ({statusDeals.length})
                    </p>
                    {statusDeals.slice(0, 3).map((deal: any) => {
                      const isCreator = deal.creator_id === profile?.id
                      const otherUser = isCreator ? deal.opponent : deal.creator
                      return (
                        <div key={deal.id} onClick={() => router.push(`/app/deals/${deal.id}`)} style={{
                          display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 10, marginBottom: 4,
                          background: 'var(--bg-overlay)', border: `1px solid ${statusColors[status] || 'var(--border-subtle)'}22`, cursor: 'pointer',
                        }}>
                          <ProfileImage size={28} avatarUrl={otherUser?.avatar_url} name={otherUser?.display_name || otherUser?.username || '?'} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{deal.title}</p>
                            <p style={{ fontSize: 10, color: 'var(--text-muted)' }}>vs @{otherUser?.username || t('deals.status.open')}</p>
                          </div>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{'\u{203A}'}</span>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </>
          )}
        </div>

        {/* ═══ LOGOUT (subtle, bottom) ═══ */}
        <button onClick={handleLogout} style={{
          width: '100%', padding: 12, marginTop: 20, borderRadius: 10,
          background: 'transparent', border: '1px solid rgba(239,68,68,0.15)',
          color: 'var(--status-error)', fontFamily: 'var(--font-display)',
          fontSize: 10, letterSpacing: 2, cursor: 'pointer', opacity: 0.7,
        }}>
          {t('auth.logout').toUpperCase()}
        </button>
      </div>

      <ProfileImageLightbox
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        images={profileImages}
        onImagesChanged={loadProfileImages}
        isOwnProfile={true}
      />
    </div>
  )
}
