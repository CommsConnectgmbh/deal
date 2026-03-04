'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

const STATUS_COLORS: Record<string, string> = {
  open: '#60a5fa', pending: '#FFB800', active: '#4ade80',
  pending_confirmation: '#a78bfa',
  completed: 'rgba(240,236,228,0.3)', cancelled: '#f87171',
}

const STATUS_LABEL: Record<string, string> = {
  open: 'Offen', pending: 'Ausstehend', active: 'Aktiv',
  pending_confirmation: 'Bestätigung', completed: 'Abgeschlossen',
  cancelled: 'Abgebrochen', disputed: 'Streit',
}

const REACTIONS = [
  { type: 'fire',    emoji: '🔥' },
  { type: 'funny',   emoji: '😂' },
  { type: 'shocked', emoji: '😮' },
  { type: 'savage',  emoji: '🤯' },
]

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'gerade eben'
  if (m < 60) return `vor ${m} Min.`
  const h = Math.floor(m / 60)
  if (h < 24) return `vor ${h} Std.`
  const d = Math.floor(h / 24)
  return `vor ${d} Tag${d !== 1 ? 'en' : ''}`
}

function xpForLevel(level: number) {
  return Math.floor(250 * Math.pow(level, 1.35))
}

interface FeedItem {
  id: string
  type: 'deal_invite' | 'deal_update' | 'deal_completed' | 'community'
  title: string
  subtitle: string
  status?: string
  dealId?: string
  time: string
  actor?: string
  isPending?: boolean
}

export default function HomePage() {
  const { profile } = useAuth()
  const router = useRouter()
  const [feedItems, setFeedItems]         = useState<FeedItem[]>([])
  const [communityDeals, setCommunityDeals] = useState<any[]>([])
  const [spotlight, setSpotlight]         = useState<any>(null)
  const [loading, setLoading]             = useState(true)
  const [dailyAvailable, setDailyAvailable] = useState(false)
  const [reactions, setReactions]         = useState<Record<string, Record<string, number>>>({})
  const [myReactions, setMyReactions]     = useState<Record<string, string>>({})

  useEffect(() => {
    if (!profile) return
    loadData()
    checkDailyReward()
    // Register service worker for push notifications
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }
  }, [profile])

  const checkDailyReward = async () => {
    if (!profile) return
    const today = new Date().toISOString().slice(0, 10)
    const { data } = await supabase
      .from('user_daily_login')
      .select('last_login_date')
      .eq('user_id', profile.id)
      .single()
    setDailyAvailable(!data?.last_login_date || data.last_login_date < today)
  }

  const fetchReactions = async (dealIds: string[]) => {
    if (!dealIds.length || !profile) return
    const { data } = await supabase
      .from('deal_reactions')
      .select('deal_id, reaction, user_id')
      .in('deal_id', dealIds)
    if (!data) return
    const counts: Record<string, Record<string, number>> = {}
    const mine: Record<string, string> = {}
    for (const r of data) {
      if (!counts[r.deal_id]) counts[r.deal_id] = {}
      counts[r.deal_id][r.reaction] = (counts[r.deal_id][r.reaction] || 0) + 1
      if (r.user_id === profile.id) mine[r.deal_id] = r.reaction
    }
    setReactions(counts)
    setMyReactions(mine)
  }

  const toggleReaction = async (dealId: string, reaction: string) => {
    if (!profile) return
    const current = myReactions[dealId]
    if (current === reaction) {
      await supabase.from('deal_reactions').delete()
        .eq('deal_id', dealId).eq('user_id', profile.id)
      setMyReactions(prev => { const n = { ...prev }; delete n[dealId]; return n })
      setReactions(prev => ({
        ...prev,
        [dealId]: { ...(prev[dealId] || {}), [reaction]: Math.max(0, (prev[dealId]?.[reaction] || 0) - 1) }
      }))
    } else {
      await supabase.from('deal_reactions').upsert(
        { deal_id: dealId, user_id: profile.id, reaction },
        { onConflict: 'deal_id,user_id' }
      )
      setMyReactions(prev => ({ ...prev, [dealId]: reaction }))
      setReactions(prev => {
        const n = { ...prev, [dealId]: { ...(prev[dealId] || {}) } }
        if (current) n[dealId][current] = Math.max(0, (n[dealId][current] || 0) - 1)
        n[dealId][reaction] = (n[dealId][reaction] || 0) + 1
        return n
      })
    }
  }

  const loadData = async () => {
    setLoading(true)
    try {
      const [myRes, communityRes, spotlightRes] = await Promise.all([
        supabase
          .from('bets')
          .select('*, creator:creator_id(username, display_name), opponent:opponent_id(username, display_name)')
          .or(`creator_id.eq.${profile!.id},opponent_id.eq.${profile!.id}`)
          .order('created_at', { ascending: false })
          .limit(10),
        supabase
          .from('bets')
          .select('*, creator:creator_id(username, display_name), opponent:opponent_id(username, display_name)')
          .eq('status', 'open')
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('weekly_spotlight')
          .select('*, bets!weekly_spotlight_deal_id_fkey(id, title, creator:creator_id(username))')
          .eq('is_active', true)
          .gte('expires_at', new Date().toISOString())
          .order('featured_at', { ascending: false })
          .limit(1),
      ])

      const deals = myRes.data || []
      setCommunityDeals(communityRes.data || [])
      setSpotlight(spotlightRes.data?.[0] || null)

      // Build feed from my deals
      const feed: FeedItem[] = []
      for (const d of deals) {
        const isMine = d.creator_id === profile!.id
        const other  = isMine ? d.opponent?.username || '?' : d.creator?.username || '?'

        if (d.status === 'pending' && !isMine) {
          feed.push({
            id: d.id + '_invite', type: 'deal_invite',
            title: d.title,
            subtitle: `@${d.creator?.username} hat dich herausgefordert`,
            status: 'pending', dealId: d.id, time: d.created_at,
            actor: d.creator?.username, isPending: true,
          })
        } else if (d.status === 'completed') {
          const won = d.winner_id === profile!.id
          feed.push({
            id: d.id + '_done', type: 'deal_completed',
            title: won ? `Gewonnen gegen @${other}` : `Verloren gegen @${other}`,
            subtitle: d.title, status: 'completed', dealId: d.id,
            time: d.confirmed_at || d.updated_at || d.created_at, actor: other,
          })
        } else if (d.status === 'active' || d.status === 'pending_confirmation') {
          feed.push({
            id: d.id + '_active', type: 'deal_update',
            title: d.title, subtitle: `vs @${other}`,
            status: d.status, dealId: d.id,
            time: d.accepted_at || d.created_at, actor: other,
          })
        }
      }
      feed.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      setFeedItems(feed)

      // Fetch reactions for all deals
      fetchReactions(deals.map((d: any) => d.id))
    } finally {
      setLoading(false)
    }
  }

  const level     = profile?.level ?? 1
  const xp        = profile?.xp ?? 0
  const xpNeeded  = xpForLevel(level)
  const xpProgress = Math.min((xp % xpNeeded) / xpNeeded * 100, 100)

  const pendingInvites = feedItems.filter(f => f.isPending)
  const otherFeed      = feedItems.filter(f => !f.isPending)

  return (
    <div style={{ minHeight: '100dvh', background: '#060606' }}>

      {/* ── Stats Row ── */}
      <div style={{ padding: '16px 16px 0' }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          {[
            { label: 'LEVEL', value: profile?.level ?? 1, color: '#FFB800' },
            { label: 'SIEGE', value: profile?.wins ?? 0,  color: '#4ade80' },
            { label: 'DEALS', value: profile?.deals_total ?? 0, color: '#60a5fa' },
            { label: 'COINS', value: profile?.coins ?? 0, color: '#FFB800' },
          ].map(s => (
            <div key={s.label} style={{ flex: 1, background: '#111', borderRadius: 10, border: '1px solid rgba(255,184,0,0.07)', padding: '10px 6px', textAlign: 'center' }}>
              <p className="font-display" style={{ fontSize: 7, letterSpacing: 1, color: 'rgba(240,236,228,0.4)', marginBottom: 4 }}>{s.label}</p>
              <p className="font-display" style={{ fontSize: 16, color: s.color }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* XP Bar */}
        <div style={{ marginBottom: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
            <span className="font-display" style={{ fontSize: 7, letterSpacing: 2, color: 'rgba(240,236,228,0.3)' }}>XP · LEVEL {level}</span>
            <span className="font-display" style={{ fontSize: 7, color: 'rgba(240,236,228,0.3)' }}>{xp % xpNeeded}/{xpNeeded}</span>
          </div>
          <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${xpProgress}%`, background: 'linear-gradient(90deg, #CC8800, #FFB800)', borderRadius: 2, transition: 'width 0.5s ease' }} />
          </div>
        </div>
      </div>

      {/* ── Daily Reward Banner ── */}
      {dailyAvailable && (
        <div style={{ padding: '12px 16px 0' }}>
          <button
            onClick={() => router.push('/app/rewards')}
            style={{ width: '100%', background: 'rgba(255,184,0,0.07)', border: '1px solid rgba(255,184,0,0.25)', borderRadius: 14, padding: '12px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 24 }}>🎁</span>
            <div style={{ flex: 1, textAlign: 'left' }}>
              <p style={{ fontFamily: 'Cinzel, serif', fontSize: 11, color: '#FFB800', fontWeight: 700, letterSpacing: 1 }}>TÄGLICHE BELOHNUNG VERFÜGBAR</p>
              <p style={{ fontSize: 11, color: '#666', marginTop: 2 }}>Tippe zum Abholen</p>
            </div>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#FFB800', boxShadow: '0 0 8px #FFB800' }} />
          </button>
        </div>
      )}

      {/* ── Weekly Spotlight ── */}
      {spotlight?.bets && (
        <div style={{ padding: '12px 16px 0' }}>
          <Link href={`/app/deals/${spotlight.bets.id}`} style={{ textDecoration: 'none' }}>
            <div style={{ background: 'linear-gradient(135deg, rgba(255,184,0,0.1), rgba(255,184,0,0.03))', border: '1px solid rgba(255,184,0,0.25)', borderRadius: 14, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(255,184,0,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: 22 }}>🏅</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontFamily: 'Cinzel, serif', fontSize: 8, letterSpacing: 2, color: '#FFB800', marginBottom: 3 }}>⭐ DEAL DER WOCHE</p>
                <p style={{ fontSize: 13, color: '#f0ece4', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{spotlight.bets.title}</p>
                {spotlight.title && (
                  <p style={{ fontSize: 11, color: 'rgba(240,236,228,0.5)', marginTop: 1 }}>{spotlight.title}</p>
                )}
              </div>
              <span style={{ fontSize: 18, color: '#FFB800', flexShrink: 0 }}>›</span>
            </div>
          </Link>
        </div>
      )}

      {/* ── Pending Invites (pinned) ── */}
      {pendingInvites.length > 0 && (
        <div style={{ padding: '16px 16px 0' }}>
          <p className="font-display" style={{ fontSize: 8, letterSpacing: 3, color: '#FFB800', marginBottom: 10 }}>
            HERAUSFORDERUNGEN · {pendingInvites.length}
          </p>
          {pendingInvites.map(item => (
            <Link key={item.id} href={`/app/deals/${item.dealId}`} style={{ textDecoration: 'none' }}>
              <div style={{ background: 'rgba(255,184,0,0.06)', border: '1px solid rgba(255,184,0,0.25)', borderRadius: 14, padding: '16px', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', animation: 'pulse 2s infinite' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 16 }}>🤝</span>
                    <p style={{ color: '#f0ece4', fontSize: 14, fontWeight: 600 }}>{item.title}</p>
                  </div>
                  <p style={{ color: 'rgba(240,236,228,0.5)', fontSize: 12 }}>{item.subtitle} · {timeAgo(item.time)}</p>
                </div>
                <div style={{ background: '#FFB800', borderRadius: 8, padding: '8px 14px', marginLeft: 12 }}>
                  <span style={{ color: '#000', fontSize: 12, fontFamily: 'Cinzel, serif', fontWeight: 700 }}>ANSEHEN</span>
                </div>
              </div>
            </Link>
          ))}
          <style>{'@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.85} }'}</style>
        </div>
      )}

      {/* ── Feed ── */}
      <div style={{ padding: '16px 16px 0' }}>
        <p className="font-display" style={{ fontSize: 8, letterSpacing: 3, color: 'rgba(240,236,228,0.4)', marginBottom: 10 }}>
          MEIN FEED
        </p>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <div style={{ width: 28, height: 28, border: '2px solid transparent', borderTopColor: '#FFB800', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} />
            <style>{'@keyframes spin { to { transform: rotate(360deg); } }'}</style>
          </div>
        ) : otherFeed.length === 0 && pendingInvites.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 24px' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🤝</div>
            <p className="font-display" style={{ fontSize: 16, color: '#f0ece4', marginBottom: 8 }}>Noch keine Deals</p>
            <p style={{ color: 'rgba(240,236,228,0.4)', fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
              Fordere einen Freund heraus und starte deinen ersten Deal.
            </p>
            <Link href="/app/deals?new=1" style={{ textDecoration: 'none' }}>
              <button style={{ padding: '14px 32px', borderRadius: 12, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, #CC8800, #FFB800)', color: '#000', fontFamily: 'Cinzel, serif', fontSize: 11, fontWeight: 700, letterSpacing: 3 }}>
                DEAL ERSTELLEN
              </button>
            </Link>
          </div>
        ) : (
          <div>
            {otherFeed.map(item => {
              const sc   = STATUS_COLORS[item.status || ''] || 'rgba(240,236,228,0.3)'
              const icon = item.type === 'deal_completed'
                ? (item.title.startsWith('Gewonnen') ? '🏆' : '😔')
                : item.type === 'deal_update' ? '⚡' : '🤝'
              const dealReactions = item.dealId ? reactions[item.dealId] || {} : {}
              const myR           = item.dealId ? myReactions[item.dealId] : undefined

              return (
                <div key={item.id} style={{ marginBottom: 8, borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <Link href={`/app/deals/${item.dealId}`} style={{ textDecoration: 'none' }}>
                    <div style={{ background: '#111', padding: '14px 16px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 20 }}>
                        {icon}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ color: '#f0ece4', fontSize: 14, fontWeight: 600, lineHeight: 1.3, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.title}
                        </p>
                        <p style={{ color: 'rgba(240,236,228,0.5)', fontSize: 12 }}>{item.subtitle}</p>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                        <span style={{ fontSize: 10, color: sc, fontFamily: 'Cinzel, serif', letterSpacing: 0.5 }}>
                          {STATUS_LABEL[item.status || ''] || item.status}
                        </span>
                        <span style={{ fontSize: 10, color: 'rgba(240,236,228,0.3)' }}>{timeAgo(item.time)}</span>
                      </div>
                    </div>
                  </Link>
                  {/* Reaction row */}
                  {item.dealId && (
                    <div style={{ display: 'flex', gap: 4, padding: '8px 14px', background: '#0d0d0d', borderTop: '1px solid rgba(255,255,255,0.03)' }}>
                      {REACTIONS.map(r => {
                        const count    = dealReactions[r.type] || 0
                        const isActive = myR === r.type
                        return (
                          <button
                            key={r.type}
                            onClick={(e) => { e.stopPropagation(); e.preventDefault(); toggleReaction(item.dealId!, r.type) }}
                            style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '4px 8px', borderRadius: 8, border: isActive ? '1px solid rgba(255,184,0,0.4)' : '1px solid rgba(255,255,255,0.05)', background: isActive ? 'rgba(255,184,0,0.1)' : 'rgba(255,255,255,0.02)', cursor: 'pointer', transition: 'all 0.15s' }}
                          >
                            <span style={{ fontSize: 14 }}>{r.emoji}</span>
                            {count > 0 && (
                              <span style={{ fontSize: 10, color: isActive ? '#FFB800' : 'rgba(240,236,228,0.35)', fontFamily: 'Cinzel, serif' }}>{count}</span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Community Deals ── */}
      {communityDeals.length > 0 && (
        <div style={{ padding: '16px 16px 32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <p className="font-display" style={{ fontSize: 8, letterSpacing: 3, color: 'rgba(240,236,228,0.4)' }}>COMMUNITY DEALS</p>
            <Link href="/app/deals" style={{ fontSize: 12, color: '#FFB800', textDecoration: 'none' }}>Alle →</Link>
          </div>
          <div style={{ borderRadius: 14, border: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden' }}>
            {communityDeals.map((d: any, i) => (
              <Link key={d.id} href={`/app/deals/${d.id}`} style={{ textDecoration: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', background: '#111', borderBottom: i < communityDeals.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#60a5fa', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ color: '#f0ece4', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.title}</p>
                      <p style={{ color: 'rgba(240,236,228,0.4)', fontSize: 11, marginTop: 2 }}>@{d.creator?.username}</p>
                    </div>
                  </div>
                  <span style={{ color: '#60a5fa', fontSize: 11, fontFamily: 'Cinzel, serif', marginLeft: 8 }}>JOIN</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
