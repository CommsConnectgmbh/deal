'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useLang } from '@/contexts/LanguageContext'
import { supabase } from '@/lib/supabase'
import ProfileImage from '@/components/ProfileImage'
import AvatarFrame from '@/components/AvatarFrame'
import ProfilePostGrid from '@/components/ProfilePostGrid'

const ARCHETYPES: Record<string, { icon: string; color: string }> = {
  closer:    { icon: '\u{1F91D}', color: 'var(--gold-primary)' },
  duelist:   { icon: '\u{2694}\u{FE0F}', color: 'var(--status-error)' },
  architect: { icon: '\u{1F3D7}\u{FE0F}', color: 'var(--status-info)' },
  comeback:  { icon: '\u{1F525}', color: 'var(--status-warning)' },
  founder:   { icon: '\u{1F451}', color: 'var(--gold-primary)' },
  icon:      { icon: '\u{1F48E}', color: '#a78bfa' },
}

type FollowStatus = 'none' | 'pending' | 'accepted'
type Modal = null | 'followers' | 'following' | 'options' | 'report'

interface FollowUser {
  id: string; username: string; display_name: string; level: number
}

function timeAgo(iso: string) {
  const d = Date.now() - new Date(iso).getTime()
  const m = Math.floor(d / 60000)
  if (m < 1)  return 'Gerade eben'
  if (m < 60) return `vor ${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `vor ${h}h`
  return `vor ${Math.floor(h / 24)}d`
}

export default function PublicProfilePage() {
  const { username } = useParams<{ username: string }>()
  const { profile: me } = useAuth()
  const { lang } = useLang()
  const router = useRouter()

  const [user,         setUser]         = useState<any>(null)
  const [followStatus, setFollowStatus] = useState<FollowStatus>('none')
  const [theirStatus,  setTheirStatus]  = useState<FollowStatus>('none')
  const [isBlocked,    setIsBlocked]    = useState(false)
  const [activity,     setActivity]     = useState<any[]>([])
  const [modal,        setModal]        = useState<Modal>(null)
  const [modalList,    setModalList]    = useState<FollowUser[]>([])
  const [loading,      setLoading]      = useState(true)
  const [fwLoading,    setFwLoading]    = useState(false)
  const [isFavorite,   setIsFavorite]   = useState(false)
  const [reportMsg,    setReportMsg]    = useState('')
  const [reportSent,   setReportSent]   = useState(false)
  const [publicDeals,  setPublicDeals]  = useState<any[]>([])
  const [inventory,    setInventory]    = useState<any[]>([])
  const [totalCosmetics, setTotalCosmetics] = useState(0)

  const fetchUser = useCallback(async () => {
    if (!me) return
    setLoading(true)
    const { data: u } = await supabase.from('profiles').select('*').eq('username', username).single()
    if (!u) { setLoading(false); return }
    if (u.id === me.id) { router.replace('/app/profile'); return }
    setUser(u)
    const [fwd, bwd, blocked, actRes, dealsRes, invRes, cosmeticCountRes] = await Promise.all([
      supabase.from('follows').select('status, is_favorite').eq('follower_id', me.id).eq('following_id', u.id).maybeSingle(),
      supabase.from('follows').select('status').eq('follower_id', u.id).eq('following_id', me.id).maybeSingle(),
      supabase.from('blocked_users').select('blocker_id').eq('blocker_id', me.id).eq('blocked_id', u.id).maybeSingle(),
      supabase.from('deal_actions').select('action, created_at, deal:deal_id(title, winner_id)').eq('user_id', u.id).order('created_at', { ascending: false }).limit(8),
      // Fetch ALL deals (not just public completed)
      supabase.from('bets')
        .select('id, title, stake, status, created_at, winner_id, creator_id, opponent_id, creator:creator_id(id,username,display_name,avatar_url), opponent:opponent_id(id,username,display_name,avatar_url)')
        .or(`creator_id.eq.${u.id},opponent_id.eq.${u.id}`)
        .order('created_at', { ascending: false })
        .limit(20),
      // Fetch inventory for Ruhmeshalle
      supabase.from('user_inventory').select('id, cosmetic_id, source, acquired_at, cosmetics(name, item_type, rarity, description)').eq('user_id', u.id).order('acquired_at', { ascending: false }).limit(20),
      supabase.from('cosmetics').select('id', { count: 'exact', head: true }),
    ])
    setFollowStatus((fwd.data?.status as FollowStatus) || 'none')
    setIsFavorite(!!fwd.data?.is_favorite)
    setTheirStatus((bwd.data?.status as FollowStatus) || 'none')
    setIsBlocked(!!blocked.data)
    setActivity(actRes.data || [])
    setPublicDeals(dealsRes.data || [])
    setInventory((invRes.data as any) || [])
    setTotalCosmetics(cosmeticCountRes.count || 18)
    setLoading(false)
  }, [me, username, router])

  useEffect(() => { fetchUser() }, [fetchUser])

  const follow = async () => {
    if (!user || !me) return
    setFwLoading(true)
    try {
      const status: FollowStatus = user.is_private ? 'pending' : 'accepted'
      const { error: followErr } = await supabase.from('follows').upsert({ follower_id: me.id, following_id: user.id, status }, { onConflict: 'follower_id,following_id' })
      if (followErr) { console.error('Follow error:', followErr); setFwLoading(false); return }
      try {
        await supabase.from('notifications').insert({
          user_id: user.id,
          type: user.is_private ? 'follow_request' : 'follow_accepted',
          title: me.display_name || me.username || '',
          body: user.is_private ? 'möchte dir folgen' : 'folgt dir jetzt',
          reference_id: user.is_private ? me.id : me.username,
        })
      } catch {}
      setFollowStatus(status)
      // Update follower count locally
      setUser((prev: any) => prev ? { ...prev, follower_count: (prev.follower_count ?? 0) + 1 } : prev)
    } catch (err) {
      console.error('Follow failed:', err)
    }
    setFwLoading(false)
  }

  const unfollow = async () => {
    if (!user || !me) return
    setFwLoading(true)
    const { error } = await supabase.from('follows').delete().eq('follower_id', me.id).eq('following_id', user.id)
    if (error) { console.error('Unfollow error:', error) }
    setFollowStatus('none')
    setUser((prev: any) => prev ? { ...prev, follower_count: Math.max(0, (prev.follower_count ?? 1) - 1) } : prev)
    setFwLoading(false)
  }

  const toggleFavorite = async () => {
    if (!user || !me) return
    const newVal = !isFavorite
    setIsFavorite(newVal)
    await supabase.from('follows').update({ is_favorite: newVal }).eq('follower_id', me.id).eq('following_id', user.id)
  }

  const startDM = async () => {
    if (!user || !me) return
    const [p1, p2] = [me.id, user.id].sort()
    // Try to find existing conversation first
    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .or(`and(participant_1.eq.${p1},participant_2.eq.${p2}),and(participant_1.eq.${p2},participant_2.eq.${p1})`)
      .maybeSingle()
    if (existing) { router.push(`/app/chat/${existing.id}`); return }
    // Create new conversation
    const { data, error } = await supabase
      .from('conversations')
      .insert({ participant_1: p1, participant_2: p2 })
      .select('id').single()
    if (error) { console.error('DM creation failed:', error); return }
    if (data) router.push(`/app/chat/${data.id}`)
  }

  const blockUser = async () => {
    if (!user || !me) return
    await supabase.from('blocked_users').upsert({ blocker_id: me.id, blocked_id: user.id })
    await supabase.from('follows').delete().or(`and(follower_id.eq.${me.id},following_id.eq.${user.id}),and(follower_id.eq.${user.id},following_id.eq.${me.id})`)
    setIsBlocked(true); setModal(null)
  }

  const sendReport = async () => {
    if (!user || !me || !reportMsg.trim()) return
    await supabase.from('notifications').insert({ user_id: me.id, type: 'report_sent', title: `Report: @${user.username}`, body: reportMsg.slice(0, 200), reference_id: user.id })
    setReportSent(true)
  }

  const openFollowModal = async (type: 'followers' | 'following') => {
    if (!user) return
    setModal(type); setModalList([])
    const srcCol = type === 'followers' ? 'following_id' : 'follower_id'
    const resCol = type === 'followers' ? 'follower_id'  : 'following_id'
    const { data } = await supabase.from('follows').select(resCol).eq(srcCol, user.id).eq('status', 'accepted')
    if (!data?.length) return
    const ids = data.map((f: any) => f[resCol])
    const { data: profiles } = await supabase.from('profiles').select('id, username, display_name, level').in('id', ids)
    setModalList((profiles || []) as FollowUser[])
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', background: 'var(--bg-base)' }}>
      <div style={{ width: 32, height: 32, border: '2px solid transparent', borderTopColor: 'var(--gold-primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
    </div>
  )
  if (!user) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', background: 'var(--bg-base)' }}>
      <p style={{ color: 'var(--text-secondary)' }}>Nutzer nicht gefunden</p>
    </div>
  )

  const canSeeContent = !user.is_private || followStatus === 'accepted'
  const isMutual      = followStatus === 'accepted' && theirStatus === 'accepted'
  const archetype = user.primary_archetype || 'founder'
  const archetypeData = ARCHETYPES[archetype] || ARCHETYPES.founder
  const bpLevel = user.battle_pass_level ?? 1

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg-base)', paddingTop: 60, paddingBottom: 60 }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px 16px' }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: 22, cursor: 'pointer', padding: '0 4px' }}>←</button>
        <span className="font-display" style={{ fontSize: 13, color: 'var(--text-secondary)', letterSpacing: 1 }}>@{user.username}</span>
        <button onClick={() => setModal('options')} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: 22, cursor: 'pointer', padding: '0 4px' }}>⋯</button>
      </div>

      {isBlocked ? (
        <div style={{ padding: '60px 32px', textAlign: 'center' }}>
          <p style={{ fontSize: 40, marginBottom: 16 }}>🚫</p>
          <p className="font-display" style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>Du hast diesen Nutzer blockiert.</p>
          <button onClick={async () => { await supabase.from('blocked_users').delete().eq('blocker_id', me!.id).eq('blocked_id', user.id); setIsBlocked(false) }} style={{ padding: '10px 24px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-secondary)', fontFamily: 'var(--font-display)', fontSize: 10, cursor: 'pointer' }}>
            ENTBLOCKIEREN
          </button>
        </div>
      ) : (
        <>
          {/* ── Avatar + Name ───────────────────────────────────────────────── */}
          <div style={{ textAlign: 'center', padding: '0 24px 20px' }}>
            <div style={{ display: 'inline-block', marginBottom: 12 }}>
              <ProfileImage size={80} avatarUrl={user.avatar_url} name={user.username} goldBorder />
            </div>
            <h2 style={{ fontSize: 20, color: 'var(--text-primary)', fontWeight: 700, marginBottom: 3 }}>
              {user.display_name || user.username}
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>@{user.username}</p>

            {/* Archetype badge */}
            <div style={{ padding: '4px 14px', borderRadius: 20, background: `${archetypeData.color}18`, border: `1px solid ${archetypeData.color}44`, marginBottom: 8 }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 9, letterSpacing: 2, color: archetypeData.color }}>{archetypeData.icon} {archetype.toUpperCase()}</span>
            </div>

            {user.is_private && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'var(--bg-overlay)', borderRadius: 20, padding: '3px 12px', marginBottom: 8 }}>
                <span style={{ fontSize: 10 }}>🔒</span>
                <span className="font-display" style={{ fontSize: 8, color: 'var(--text-secondary)', letterSpacing: 1 }}>PRIVAT</span>
              </div>
            )}

            {/* ── Follower / Following counts ─────────────────────────────── */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 32, margin: '12px 0 16px' }}>
              <button onClick={() => openFollowModal('followers')} style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'center', padding: 0 }}>
                <p className="font-display" style={{ fontSize: 20, color: 'var(--gold-primary)', marginBottom: 2 }}>{user.follower_count ?? 0}</p>
                <p className="font-display" style={{ fontSize: 8, color: 'var(--text-secondary)', letterSpacing: 1 }}>FOLLOWER</p>
              </button>
              <div style={{ width: 1, background: 'var(--border-subtle)' }} />
              <button onClick={() => openFollowModal('following')} style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'center', padding: 0 }}>
                <p className="font-display" style={{ fontSize: 20, color: 'var(--gold-primary)', marginBottom: 2 }}>{user.following_count ?? 0}</p>
                <p className="font-display" style={{ fontSize: 8, color: 'var(--text-secondary)', letterSpacing: 1 }}>FOLLOWS</p>
              </button>
            </div>

            {/* ── Action buttons ──────────────────────────────────────────── */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              {followStatus === 'accepted' ? (
                <>
                  <button onClick={unfollow} disabled={fwLoading} style={{ padding: '11px 22px', borderRadius: 10, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-secondary)', fontFamily: 'var(--font-display)', fontSize: 10, letterSpacing: 1, cursor: 'pointer' }}>
                    {fwLoading ? '···' : 'ENTFOLGEN'}
                  </button>
                  <button onClick={toggleFavorite} style={{
                    width: 42, height: 42, borderRadius: 10, border: 'none', cursor: 'pointer',
                    background: isFavorite ? 'var(--gold-subtle)' : 'var(--bg-surface)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill={isFavorite ? 'var(--gold-primary)' : 'none'} stroke={isFavorite ? 'var(--gold-primary)' : 'var(--text-muted)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                  </button>
                </>
              ) : followStatus === 'pending' ? (
                <button disabled style={{ padding: '11px 22px', borderRadius: 10, border: '1px solid var(--gold-glow)', background: 'var(--gold-subtle)', color: 'var(--gold-primary)', fontFamily: 'var(--font-display)', fontSize: 10, letterSpacing: 1, opacity: 0.5 }}>
                  ANGEFRAGT ⏳
                </button>
              ) : (
                <button onClick={follow} disabled={fwLoading} style={{ padding: '11px 22px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, var(--gold-dim), var(--gold-primary))', color: 'var(--text-inverse)', fontFamily: 'var(--font-display)', fontSize: 10, fontWeight: 700, letterSpacing: 1, cursor: 'pointer' }}>
                  {fwLoading ? '···' : theirStatus === 'accepted' ? '+ ZURÜCKFOLGEN' : '+ FOLGEN'}
                </button>
              )}
              {followStatus === 'accepted' && (
                <button onClick={startDM} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '11px 16px', borderRadius: 10, border: '1px solid var(--gold-glow)', background: 'var(--gold-subtle)', color: 'var(--gold-primary)', fontFamily: 'var(--font-display)', fontSize: 10, letterSpacing: 1, cursor: 'pointer' }}>
                  💬 NACHRICHT
                </button>
              )}
              {followStatus === 'accepted' && (
                <button onClick={() => router.push(`/app/deals/create?opponent=${username}`)} style={{
                  padding: '11px 22px', borderRadius: 10, border: 'none',
                  background: 'linear-gradient(135deg, var(--gold-dim), var(--gold-primary), var(--gold-bright))',
                  color: 'var(--text-inverse)', fontFamily: 'var(--font-display)', fontSize: 10,
                  fontWeight: 700, letterSpacing: 1, cursor: 'pointer',
                  boxShadow: '0 4px 16px rgba(245,158,11,0.3)',
                }}>
                  ⚔️ HERAUSFORDERN
                </button>
              )}
            </div>
            {theirStatus === 'accepted' && followStatus !== 'accepted' && (
              <p style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-body)', marginTop: 8 }}>Folgt dir</p>
            )}
          </div>

          {/* ── Private gate ────────────────────────────────────────────────── */}
          {!canSeeContent ? (
            <div style={{ margin: '0 24px', textAlign: 'center', padding: '32px 20px', background: 'var(--bg-surface)', borderRadius: 14, border: '1px solid var(--border-subtle)' }}>
              <p style={{ fontSize: 32, marginBottom: 12 }}>🔒</p>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, fontFamily: 'var(--font-body)' }}>
                {lang === 'de' ? 'Folge diesem Konto, um Inhalte zu sehen.' : 'Follow this account to see their content.'}
              </p>
            </div>
          ) : (
            <>
              {/* Stats grid (matches own profile) */}
              <div style={{ margin: '0 16px 12px' }}>
                <div style={{ background: 'var(--bg-deepest)', border: '1px solid var(--border-subtle)', borderRadius: 14, padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <p style={{ fontFamily: 'var(--font-display)', fontSize: 10, letterSpacing: 2, color: 'var(--text-muted)' }}>STATISTIKEN</p>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
                    {[
                      { label: 'DEALS', val: user.deals_total || 0, color: 'var(--status-info)' },
                      { label: 'WIN%', val: `${user.wins && user.deals_total ? Math.round((user.wins / user.deals_total) * 100) : 0}%`, color: '#4ade80' },
                      { label: 'STREAK', val: user.streak || 0, color: 'var(--status-warning)', icon: '\u{1F525}' },
                      { label: 'ZUVERL.', val: user.reliability_score != null ? `${Math.round((user.reliability_score as number) * 100)}%` : '—', color: user.reliability_color === 'green' ? '#22C55E' : user.reliability_color === 'yellow' ? '#EAB308' : user.reliability_color === 'red' ? '#EF4444' : 'var(--text-muted)' },
                      { label: 'LEVEL', val: user.level || 1, color: 'var(--gold-primary)' },
                    ].map(s => (
                      <div key={s.label} style={{
                        background: 'var(--bg-overlay)', borderRadius: 10, border: '1px solid var(--border-subtle)',
                        padding: '10px 4px', textAlign: 'center',
                      }}>
                        <p style={{ fontFamily: 'var(--font-display)', fontSize: 15, color: s.color, marginBottom: 2 }}>
                          {s.icon || ''}{s.val}
                        </p>
                        <p style={{ fontFamily: 'var(--font-display)', fontSize: 7, letterSpacing: 1, color: 'var(--text-muted)' }}>{s.label}</p>
                      </div>
                    ))}
                  </div>
                  {/* Rival + Best Streak */}
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-body)', textAlign: 'center' }}>
                    Siege: <strong style={{ color: 'var(--text-primary)' }}>{user.wins || 0}</strong>
                    {' \u00B7 '}Bester Streak: <strong style={{ color: 'var(--text-primary)' }}>{user.longest_streak || user.streak || 0}</strong>
                    {' \u00B7 '}Losses: <strong style={{ color: 'var(--text-primary)' }}>{user.losses || 0}</strong>
                  </div>
                </div>
              </div>

              {/* ── Battle Card ────────────────────────────── */}
              {user.equipped_card_image_url ? (
                <div style={{ margin: '0 16px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <p style={{ fontFamily: 'var(--font-display)', fontSize: 10, letterSpacing: 3, color: 'var(--gold-primary)', marginBottom: 14 }}>BATTLE CARD</p>
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <AvatarFrame
                      frameType={(user.active_frame as any) || 'none'}
                      imageUrl={user.equipped_card_image_url}
                      size="lg"
                      username={user.username}
                      level={user.level}
                      streak={user.streak}
                      showInfo
                    />
                  </div>
                </div>
              ) : (
                <div style={{ margin: '0 16px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <p style={{ fontFamily: 'var(--font-display)', fontSize: 10, letterSpacing: 3, color: 'var(--gold-primary)', marginBottom: 16 }}>BATTLE CARD</p>
                  <div style={{
                    width: 140, height: 200, borderRadius: 16,
                    background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.1)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}>
                    <span style={{ fontSize: 32, opacity: 0.3 }}>{'\u{1F0CF}'}</span>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: 8, color: 'var(--text-muted)', letterSpacing: 1 }}>NOCH KEINE KARTE</span>
                  </div>
                </div>
              )}

              {/* ── Season 1 + Battle Pass (combined) ──────────────────── */}
              {(() => {
                const level = user.level || 1
                const xp = user.xp || 0
                const xpForLevel = level * 100
                const xpProgress = Math.min((xp % xpForLevel) / xpForLevel * 100, 100)
                return (
                  <div style={{ margin: '0 16px 16px', background: 'var(--bg-deepest)', borderRadius: 14, border: '1px solid var(--border-subtle)', padding: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <p style={{ fontFamily: 'var(--font-display)', fontSize: 10, letterSpacing: 2, color: 'var(--text-muted)' }}>SEASON 1</p>
                      <span style={{ fontFamily: 'var(--font-display)', fontSize: 10, color: 'var(--gold-primary)' }}>Level {level}</span>
                    </div>

                    {/* XP bar */}
                    <div style={{ height: 6, background: 'var(--border-subtle)', borderRadius: 3, overflow: 'hidden', marginBottom: 6 }}>
                      <div style={{ height: '100%', width: `${xpProgress}%`, background: 'linear-gradient(90deg, var(--gold-dim), var(--gold-primary), var(--gold-bright))', borderRadius: 3, transition: 'width 0.5s' }} />
                    </div>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: 10, color: 'var(--text-muted)', marginBottom: 14, textAlign: 'right' }}>{xp % xpForLevel}/{xpForLevel} XP</p>

                    {/* Battle Pass preview */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <p style={{ fontFamily: 'var(--font-display)', fontSize: 10, letterSpacing: 2, color: 'var(--gold-primary)' }}>BATTLE PASS</p>
                      <span style={{ fontFamily: 'var(--font-display)', fontSize: 8, color: user.battle_pass_premium ? 'var(--gold-primary)' : 'var(--text-muted)', padding: '3px 8px', borderRadius: 8, background: user.battle_pass_premium ? 'var(--gold-subtle)' : 'var(--bg-overlay)', border: `1px solid ${user.battle_pass_premium ? 'var(--gold-glow)' : 'var(--border-subtle)'}` }}>
                        {user.battle_pass_premium ? 'PREMIUM' : 'FREE'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 6, WebkitOverflowScrolling: 'touch' }}>
                      {Array.from({ length: 10 }, (_, i) => ({ tier: i + 1, claimed: i + 1 <= bpLevel })).map((t, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                          <div style={{
                            minWidth: 44, padding: '6px 4px', borderRadius: 8, textAlign: 'center',
                            background: t.claimed ? 'var(--gold-subtle)' : 'var(--bg-overlay)',
                            border: `1px solid ${t.claimed ? 'var(--gold-glow)' : 'var(--border-subtle)'}`,
                          }}>
                            <p style={{ fontFamily: 'var(--font-display)', fontSize: 7, color: t.claimed ? 'var(--gold-primary)' : 'var(--text-muted)', letterSpacing: 0.5 }}>{t.tier}</p>
                            <p style={{ fontSize: 11, marginTop: 1 }}>{t.claimed ? '\u{2705}' : '\u{1F512}'}</p>
                          </div>
                          {i < 9 && <span style={{ color: 'var(--text-muted)', fontSize: 8 }}>{'\u{2192}'}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}

              {/* ── Deals List ─────────────────────────────────────────── */}
              <div style={{ margin: '0 16px 16px', background: 'var(--bg-deepest)', borderRadius: 14, border: '1px solid var(--border-subtle)', padding: 16 }}>
                <p style={{ fontFamily: 'var(--font-display)', fontSize: 10, letterSpacing: 2, color: 'var(--text-muted)', marginBottom: 12 }}>DEALS</p>
                {publicDeals.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 24 }}>
                    <p style={{ fontSize: 28, marginBottom: 6 }}>⚡</p>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text-secondary)' }}>Noch keine Deals</p>
                  </div>
                ) : (
                  <>
                    {(['active', 'open', 'pending', 'pending_confirmation', 'completed'] as const).map(status => {
                      const statusDeals = publicDeals.filter((d: any) => d.status === status)
                      if (statusDeals.length === 0) return null
                      const statusLabels: Record<string, string> = {
                        active: 'AKTIV', open: 'OFFEN', pending: 'EINGELADEN',
                        pending_confirmation: 'BEST\u00C4TIGUNG', completed: 'ABGESCHLOSSEN',
                      }
                      const statusColors: Record<string, string> = {
                        active: '#4ade80', open: '#FFB800', pending: '#f97316',
                        pending_confirmation: '#a78bfa', completed: '#60a5fa',
                      }
                      return (
                        <div key={status} style={{ marginBottom: 10 }}>
                          <p style={{ fontFamily: 'var(--font-display)', fontSize: 8, letterSpacing: 2, color: statusColors[status] || 'var(--text-muted)', marginBottom: 6 }}>
                            {statusLabels[status] || status.toUpperCase()} ({statusDeals.length})
                          </p>
                          {statusDeals.slice(0, 3).map((deal: any) => {
                            const isCreator = deal.creator_id === user.id
                            const otherUser = isCreator ? deal.opponent : deal.creator
                            return (
                              <div
                                key={deal.id}
                                onClick={() => router.push(`/app/deals/${deal.id}`)}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: 10,
                                  padding: '10px 12px', borderRadius: 10, marginBottom: 6,
                                  background: 'var(--bg-overlay)', border: `1px solid ${statusColors[status] || 'var(--border-subtle)'}22`,
                                  cursor: 'pointer',
                                }}
                              >
                                <ProfileImage size={32} avatarUrl={otherUser?.avatar_url} name={otherUser?.username || '?'} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {deal.title}
                                  </p>
                                  <p style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                                    vs @{otherUser?.username || 'Offen'} · {deal.stake}
                                  </p>
                                </div>
                                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{'\u203A'}</span>
                              </div>
                            )
                          })}
                        </div>
                      )
                    })}
                  </>
                )}
              </div>


              {/* Activity Feed */}
              {activity.length > 0 && (
                <div style={{ margin: '0 16px 16px' }}>
                  <p className="font-display" style={{ fontSize: 9, letterSpacing: 3, color: 'var(--text-muted)', marginBottom: 10 }}>AKTIVIT{'\u00C4'}T</p>
                  {activity.slice(0, 6).map((a: any, i: number) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                      <span style={{ fontSize: 18, width: 28, textAlign: 'center' }}>
                        {a.action === 'confirm_winner' ? '🏆' : a.action === 'accept' ? '🤝' : '📋'}
                      </span>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                          {a.action === 'confirm_winner' ? 'Deal abgeschlossen' : a.action === 'accept' ? 'Deal angenommen' : 'Deal erstellt'}
                          {a.deal?.title ? ` \u2013 ${a.deal.title}` : ''}
                        </p>
                        <p style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>{timeAgo(a.created_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Profile Posts */}
              <div style={{ borderTop: '1px solid var(--border-subtle)', marginTop: 16 }}>
                <ProfilePostGrid userId={user.id} isOwnProfile={false} />
              </div>
            </>
          )}
        </>
      )}

      {/* ── Followers / Following Modal ─────────────────────────────────────── */}
      {(modal === 'followers' || modal === 'following') && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 300, display: 'flex', alignItems: 'flex-end' }} onClick={() => setModal(null)}>
          <div style={{ width: '100%', maxWidth: 430, margin: '0 auto', background: 'var(--bg-surface)', borderRadius: '20px 20px 0 0', border: '1px solid var(--border-subtle)', padding: '20px 20px 48px', maxHeight: '70vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ width: 36, height: 4, background: 'var(--bg-overlay)', borderRadius: 2, margin: '0 auto 20px' }} />
            <p className="font-display" style={{ fontSize: 14, color: 'var(--text-primary)', textAlign: 'center', marginBottom: 16, letterSpacing: 1 }}>{modal === 'followers' ? 'FOLLOWER' : 'FOLLOWS'}</p>
            {modalList.length === 0
              ? <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, fontFamily: 'var(--font-body)', paddingTop: 20 }}>Niemand hier</p>
              : modalList.map(u => (
                <div key={u.id} onClick={() => { setModal(null); router.push(`/app/profile/${u.username}`) }} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer' }}>
                  <ProfileImage size={40} name={u.username} />
                  <div>
                    <p style={{ fontSize: 13, color: 'var(--text-primary)' }}>{u.display_name || u.username}</p>
                    <p style={{ fontSize: 11, color: 'var(--text-secondary)' }}>@{u.username} · Lv.{u.level}</p>
                  </div>
                </div>
              ))
            }
          </div>
        </div>
      )}

      {/* ── Options Sheet ───────────────────────────────────────────────────── */}
      {modal === 'options' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 300, display: 'flex', alignItems: 'flex-end' }} onClick={() => setModal(null)}>
          <div style={{ width: '100%', maxWidth: 430, margin: '0 auto', background: 'var(--bg-surface)', borderRadius: '20px 20px 0 0', border: '1px solid var(--border-subtle)', padding: '20px 20px 48px' }} onClick={e => e.stopPropagation()}>
            <div style={{ width: 36, height: 4, background: 'var(--bg-overlay)', borderRadius: 2, margin: '0 auto 20px' }} />
            {[
              { label: '🚩 MELDEN',     action: () => { setModal('report') }, color: 'var(--status-error)' },
              { label: '🚫 BLOCKIEREN', action: blockUser,                    color: 'var(--status-error)' },
            ].map(opt => (
              <button key={opt.label} onClick={opt.action} style={{ width: '100%', padding: '14px', borderRadius: 10, border: '1px solid var(--border-subtle)', background: 'transparent', color: opt.color, fontFamily: 'var(--font-display)', fontSize: 11, letterSpacing: 1, cursor: 'pointer', marginBottom: 8 }}>
                {opt.label}
              </button>
            ))}
            <button onClick={() => setModal(null)} style={{ width: '100%', padding: '14px', borderRadius: 10, border: 'none', background: 'var(--bg-overlay)', color: 'var(--text-secondary)', fontFamily: 'var(--font-display)', fontSize: 11, letterSpacing: 1, cursor: 'pointer' }}>
              ABBRECHEN
            </button>
          </div>
        </div>
      )}

      {/* ── Report Sheet ────────────────────────────────────────────────────── */}
      {modal === 'report' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 300, display: 'flex', alignItems: 'flex-end' }} onClick={() => setModal(null)}>
          <div style={{ width: '100%', maxWidth: 430, margin: '0 auto', background: 'var(--bg-surface)', borderRadius: '20px 20px 0 0', border: '1px solid var(--border-subtle)', padding: '20px 20px 48px' }} onClick={e => e.stopPropagation()}>
            <div style={{ width: 36, height: 4, background: 'var(--bg-overlay)', borderRadius: 2, margin: '0 auto 20px' }} />
            <p className="font-display" style={{ fontSize: 14, color: 'var(--text-primary)', textAlign: 'center', marginBottom: 16 }}>MELDEN</p>
            {reportSent ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <p style={{ fontSize: 32, marginBottom: 12 }}>✅</p>
                <p style={{ color: 'var(--status-active)', fontSize: 13 }}>Meldung eingereicht. Danke!</p>
              </div>
            ) : (
              <>
                <textarea value={reportMsg} onChange={e => setReportMsg(e.target.value)} placeholder="Warum meldest du diesen Nutzer?" rows={4} style={{ width: '100%', padding: '12px', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, color: 'var(--text-primary)', fontSize: 14, fontFamily: 'var(--font-body)', outline: 'none', resize: 'none', marginBottom: 12, boxSizing: 'border-box' }} />
                <button onClick={sendReport} disabled={!reportMsg.trim()} style={{ width: '100%', padding: '13px', borderRadius: 10, border: 'none', background: reportMsg.trim() ? 'linear-gradient(135deg, var(--gold-dim), var(--gold-primary))' : 'var(--bg-overlay)', color: reportMsg.trim() ? 'var(--text-inverse)' : 'var(--text-muted)', fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 700, letterSpacing: 1, cursor: reportMsg.trim() ? 'pointer' : 'default' }}>
                  SENDEN
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
