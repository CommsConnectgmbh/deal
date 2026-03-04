'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

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
  const [myDeals, setMyDeals] = useState<any[]>([])
  const [feedItems, setFeedItems] = useState<FeedItem[]>([])
  const [communityDeals, setCommunityDeals] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile) return
    loadData()
  }, [profile])

  const loadData = async () => {
    setLoading(true)
    try {
      const [myRes, communityRes] = await Promise.all([
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
      ])

      const deals = myRes.data || []
      setMyDeals(deals)
      setCommunityDeals(communityRes.data || [])

      // Build feed from my deals
      const feed: FeedItem[] = []
      for (const d of deals) {
        const isMine = d.creator_id === profile!.id
        const other = isMine ? d.opponent?.username || '?' : d.creator?.username || '?'

        if (d.status === 'pending' && !isMine) {
          feed.push({
            id: d.id + '_invite',
            type: 'deal_invite',
            title: d.title,
            subtitle: `@${d.creator?.username} hat dich herausgefordert`,
            status: 'pending',
            dealId: d.id,
            time: d.created_at,
            actor: d.creator?.username,
            isPending: true,
          })
        } else if (d.status === 'completed') {
          const won = d.winner_id === profile!.id
          feed.push({
            id: d.id + '_done',
            type: 'deal_completed',
            title: won ? `Gewonnen gegen @${other}` : `Verloren gegen @${other}`,
            subtitle: d.title,
            status: 'completed',
            dealId: d.id,
            time: d.confirmed_at || d.updated_at || d.created_at,
            actor: other,
          })
        } else if (d.status === 'active' || d.status === 'pending_confirmation') {
          feed.push({
            id: d.id + '_active',
            type: 'deal_update',
            title: d.title,
            subtitle: `vs @${other}`,
            status: d.status,
            dealId: d.id,
            time: d.accepted_at || d.created_at,
            actor: other,
          })
        }
      }
      // Sort by time, newest first
      feed.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      setFeedItems(feed)
    } finally {
      setLoading(false)
    }
  }

  const level = profile?.level ?? 1
  const xp = profile?.xp ?? 0
  const xpNeeded = xpForLevel(level)
  const xpProgress = Math.min((xp % xpNeeded) / xpNeeded * 100, 100)

  const pendingInvites = feedItems.filter(f => f.isPending)
  const otherFeed = feedItems.filter(f => !f.isPending)

  return (
    <div style={{ minHeight: '100dvh', background: '#060606' }}>

      {/* ── Stats Row ── */}
      <div style={{ padding: '16px 16px 0' }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          {[
            { label: 'LEVEL', value: profile?.level ?? 1, color: '#FFB800' },
            { label: 'SIEGE', value: profile?.wins ?? 0, color: '#4ade80' },
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
            <div style={{ height: '100%', width: `${xpProgress}%`, background: 'linear-gradient(90deg, #CC8800, #FFB800)', borderRadius: 2, transition: 'width 0.5s ease' }}/>
          </div>
        </div>
      </div>

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
            <div style={{ width: 28, height: 28, border: '2px solid transparent', borderTopColor: '#FFB800', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto' }}/>
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
              const sc = STATUS_COLORS[item.status || ''] || 'rgba(240,236,228,0.3)'
              const icon = item.type === 'deal_completed'
                ? (item.title.startsWith('Gewonnen') ? '🏆' : '😔')
                : item.type === 'deal_update' ? '⚡' : '🤝'

              return (
                <Link key={item.id} href={`/app/deals/${item.dealId}`} style={{ textDecoration: 'none' }}>
                  <div style={{ background: '#111', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 14, padding: '14px 16px', marginBottom: 8, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
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
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#60a5fa', flexShrink: 0 }}/>
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
