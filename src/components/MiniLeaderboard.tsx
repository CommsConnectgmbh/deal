'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import ProfileImage from '@/components/ProfileImage'

interface LeaderEntry {
  id: string; username: string; display_name: string | null
  avatar_url: string | null; wins: number; deals_total: number
  streak: number; level: number; is_founder?: boolean
}

export default function MiniLeaderboard() {
  const { profile } = useAuth()
  const router = useRouter()
  const [leaders, setLeaders] = useState<LeaderEntry[]>([])
  const [myRank, setMyRank] = useState<number>(0)
  const [showFull, setShowFull] = useState(false)
  const [sortBy, setSortBy] = useState<'wins' | 'deals_total'>('wins')
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const load = async () => {
      // Load top 20 by wins
      const { data } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, wins, deals_total, streak, level, is_founder')
        .gt('wins', 0)
        .order('wins', { ascending: false })
        .limit(20)

      const sorted = data || []
      setLeaders(sorted)

      // Find current user rank
      if (profile) {
        const idx = sorted.findIndex((l: any) => l.id === profile.id)
        if (idx >= 0) {
          setMyRank(idx + 1)
        } else {
          // User not in top 20, get approximate rank
          const { count } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .gt('wins', profile.wins || 0)
          setMyRank((count || 0) + 1)
        }
      }
      setLoaded(true)
    }
    load()
  }, [profile])

  if (!loaded) return null

  const topSorted = [...leaders].sort((a, b) => sortBy === 'wins' ? b.wins - a.wins : b.deals_total - a.deals_total)
  const top3 = topSorted.slice(0, 3)
  const kdRatio = profile ? (profile.wins && (profile.deals_total - profile.wins) > 0
    ? (profile.wins / (profile.deals_total - profile.wins)).toFixed(1)
    : profile.wins?.toString() || '0') : '0'

  // Compact bar — shows your rank + KD + tap to expand
  // Rendered as a small clickable bar
  return (
    <>
      {/* Compact bar */}
      <div
        onClick={() => setShowFull(true)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '6px 14px',
          background: 'linear-gradient(135deg, rgba(255,184,0,0.06), rgba(255,140,0,0.02))',
          borderBottom: '1px solid var(--border-subtle)',
          cursor: 'pointer',
        }}
      >
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 9, letterSpacing: 2, color: 'var(--gold-primary)', fontWeight: 700 }}>
          🏆 RANG #{myRank}
        </span>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>·</span>
        <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
          K/D: <strong style={{ color: 'var(--gold-primary)' }}>{kdRatio}</strong>
        </span>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>·</span>

        {/* Mini avatars of top 3 */}
        <div style={{ display: 'flex', marginLeft: 'auto' }}>
          {top3.map((l, i) => (
            <div key={l.id} style={{ marginLeft: i > 0 ? -8 : 0, zIndex: 3 - i, position: 'relative' }}>
              <ProfileImage size={20} avatarUrl={l.avatar_url} name={l.display_name || l.username} goldBorder={i === 0} />
            </div>
          ))}
        </div>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-display)', letterSpacing: 1 }}>TOP ›</span>
      </div>

      {/* Full leaderboard overlay */}
      {showFull && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 300, overflowY: 'auto' }} onClick={() => setShowFull(false)}>
          <div style={{ maxWidth: 420, margin: '0 auto', padding: '60px 16px 120px' }} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--gold-primary)', letterSpacing: 3 }}>🏆 LEADERBOARD</h2>
              <button onClick={() => setShowFull(false)} style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>

            {/* Sort tabs */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              {([
                { key: 'wins' as const, label: '🎯 MEISTE SIEGE' },
                { key: 'deals_total' as const, label: '⚔️ MEISTE DEALS' },
              ]).map(tab => (
                <button key={tab.key} onClick={() => setSortBy(tab.key)} style={{
                  flex: 1, padding: '10px 0', borderRadius: 10, cursor: 'pointer',
                  background: sortBy === tab.key ? 'linear-gradient(135deg, var(--gold-dim), var(--gold-primary))' : 'var(--bg-surface)',
                  border: sortBy === tab.key ? 'none' : '1px solid var(--border-subtle)',
                  color: sortBy === tab.key ? 'var(--text-inverse)' : 'var(--text-muted)',
                  fontFamily: 'var(--font-display)', fontSize: 9, fontWeight: 700, letterSpacing: 1.5,
                }}>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Your stats */}
            {profile && (
              <div style={{
                background: 'linear-gradient(135deg, rgba(255,184,0,0.08), rgba(255,140,0,0.03))',
                border: '1px solid rgba(255,184,0,0.2)', borderRadius: 14, padding: '14px 18px',
                marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <div style={{ position: 'relative' }}>
                  <ProfileImage size={44} avatarUrl={profile.avatar_url} name={profile.display_name || profile.username} goldBorder />
                  <div style={{ position: 'absolute', top: -4, left: -4, background: 'var(--gold-primary)', borderRadius: 8, padding: '1px 6px', fontSize: 8, fontFamily: 'var(--font-display)', fontWeight: 700, color: '#000' }}>#{myRank}</div>
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontFamily: 'var(--font-display)', fontSize: 13, color: 'var(--text-primary)', letterSpacing: 1 }}>@{profile.username}</p>
                  <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>🎯 {profile.wins || 0}W</span>
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>💀 {(profile.deals_total || 0) - (profile.wins || 0)}L</span>
                    <span style={{ fontSize: 11, color: 'var(--gold-primary)', fontWeight: 700 }}>K/D: {kdRatio}</span>
                    <span style={{ fontSize: 11, color: 'var(--status-warning)' }}>🔥{profile.streak || 0}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Leaderboard list */}
            {topSorted.slice(0, 20).map((entry, i) => {
              const isMe = entry.id === profile?.id
              const losses = entry.deals_total - entry.wins
              const kd = losses > 0 ? (entry.wins / losses).toFixed(1) : entry.wins.toString()
              return (
                <div
                  key={entry.id}
                  onClick={() => { setShowFull(false); router.push(`/app/profile/${entry.username}`) }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 16px', borderRadius: 12, marginBottom: 6,
                    background: isMe ? 'rgba(255,184,0,0.08)' : i < 3 ? 'var(--bg-surface)' : 'transparent',
                    border: isMe ? '1px solid rgba(255,184,0,0.3)' : i < 3 ? '1px solid var(--border-subtle)' : '1px solid transparent',
                    cursor: 'pointer', transition: 'all .15s',
                  }}
                >
                  <span style={{
                    width: 28, textAlign: 'center', fontFamily: 'var(--font-display)', fontSize: i < 3 ? 16 : 12,
                    color: i === 0 ? '#FFD700' : i === 1 ? '#C0C0C0' : i === 2 ? '#CD7F32' : 'var(--text-muted)',
                    fontWeight: 700,
                  }}>
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                  </span>
                  <ProfileImage size={36} avatarUrl={entry.avatar_url} name={entry.display_name || entry.username} goldBorder={i === 0} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontFamily: 'var(--font-display)', fontSize: 12, color: isMe ? 'var(--gold-primary)' : 'var(--text-primary)', letterSpacing: 0.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {entry.display_name || `@${entry.username}`}
                    </p>
                    <p style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                      Lvl {entry.level} · 🔥{entry.streak}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontFamily: 'var(--font-display)', fontSize: 14, color: 'var(--gold-primary)', fontWeight: 700 }}>
                      {sortBy === 'wins' ? entry.wins : entry.deals_total}
                    </p>
                    <p style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-display)', letterSpacing: 0.5 }}>
                      K/D: {kd}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </>
  )
}
