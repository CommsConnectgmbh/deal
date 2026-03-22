'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useLang } from '@/contexts/LanguageContext'

interface Props {
  groupId: string
  compact?: boolean
}

/**
 * Compact dropdown widget for predicting the tippgruppe winner.
 * Collapsed: shows summary bar with LIVE indicator + total tips.
 * Expanded: shows all members with animated vote bars, percentages, bet counts.
 * Supports 50+ members via scrollable expanded view.
 */
export default function TipGroupBetWidget({ groupId, compact = true }: Props) {
  const { profile } = useAuth()
  const { t } = useLang()
  const [myBet, setMyBet] = useState<{ predicted_winner_id: string; status: string } | null>(null)
  const [allMembers, setAllMembers] = useState<{ user_id: string; username: string; total_points: number }[]>([])
  const [betsByMember, setBetsByMember] = useState<Record<string, number>>({})
  const [totalBets, setTotalBets] = useState(0)
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [animatePulse, setAnimatePulse] = useState(false)

  useEffect(() => {
    if (!profile || !groupId) return
    const load = async () => {
      // Load my existing prediction
      const { data: myData } = await supabase
        .from('tip_group_winner_bets')
        .select('predicted_winner_id, status')
        .eq('group_id', groupId)
        .eq('user_id', profile.id)
        .maybeSingle()
      if (myData) setMyBet(myData)

      // Load ALL members (not just top 3 — needed for full dropdown)
      const { data: members } = await supabase
        .from('tip_group_members')
        .select('user_id, total_points, profiles(username)')
        .eq('group_id', groupId)
        .order('total_points', { ascending: false })
        .limit(50)

      setAllMembers((members || []).map((m: any) => ({
        user_id: m.user_id,
        username: m.profiles?.username || '?',
        total_points: m.total_points || 0,
      })))

      // Load all bets for this group
      const { data: allBets } = await supabase
        .from('tip_group_winner_bets')
        .select('predicted_winner_id')
        .eq('group_id', groupId)

      const counts: Record<string, number> = {}
      let total = 0
      for (const b of (allBets || [])) {
        counts[b.predicted_winner_id] = (counts[b.predicted_winner_id] || 0) + 1
        total++
      }
      setBetsByMember(counts)
      setTotalBets(total)
      setLoaded(true)
    }
    load()
  }, [groupId, profile])

  if (!loaded || allMembers.length === 0) return null

  const placeBet = async (winnerId: string) => {
    if (!profile || saving) return
    setSaving(true)
    const { error } = await supabase.from('tip_group_winner_bets').upsert({
      group_id: groupId,
      user_id: profile.id,
      predicted_winner_id: winnerId,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'group_id,user_id' })
    if (!error) {
      const wasNew = !myBet
      const oldPick = myBet?.predicted_winner_id
      setMyBet({ predicted_winner_id: winnerId, status: 'active' })
      setBetsByMember(prev => {
        const next = { ...prev }
        if (oldPick) next[oldPick] = Math.max(0, (next[oldPick] || 0) - 1)
        next[winnerId] = (next[winnerId] || 0) + 1
        return next
      })
      if (wasNew) setTotalBets(prev => prev + 1)
      setAnimatePulse(true)
      setTimeout(() => setAnimatePulse(false), 600)
    }
    setSaving(false)
  }

  const won = myBet?.status === 'won'
  const lost = myBet?.status === 'lost'
  const isResolved = won || lost

  // Find leader
  const leader = allMembers.reduce((best, m) => {
    const c = betsByMember[m.user_id] || 0
    return c > (betsByMember[best.user_id] || 0) ? m : best
  }, allMembers[0])
  const leaderBets = betsByMember[leader.user_id] || 0
  const leaderPct = totalBets > 0 ? Math.round((leaderBets / totalBets) * 100) : 0

  // My pick name
  const myPickName = myBet ? allMembers.find(m => m.user_id === myBet.predicted_winner_id)?.username || '?' : null

  // Medal colors
  const MEMBER_COLORS = ['#FFB800', '#94A3B8', '#CD7F32', '#8B5CF6', '#3B82F6', '#22C55E', '#EC4899', '#F97316']
  const MEDAL = ['🥇', '🥈', '🥉']
  const maxBets = Math.max(1, ...allMembers.map(m => betsByMember[m.user_id] || 0))

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        borderTop: '1px solid var(--border-subtle)',
        background: won ? 'rgba(34,197,94,0.04)' : lost ? 'rgba(239,68,68,0.03)' : 'rgba(255,184,0,0.02)',
      }}
    >
      {/* ── Collapsed summary bar (always visible) ── */}
      <button
        onClick={(e) => { e.stopPropagation(); e.preventDefault(); setExpanded(!expanded) }}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 8,
          padding: compact ? '10px 14px' : '12px 16px',
          background: 'none', border: 'none', cursor: 'pointer',
          transition: 'background 0.15s',
        }}
      >
        {/* LIVE dot + label */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flex: 1, minWidth: 0 }}>
          {isResolved ? (
            <span style={{
              fontSize: 9, fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: 1,
              color: won ? '#22C55E' : '#EF4444',
            }}>
              {won ? t('components.correctShort') : t('components.wrongShort')}
            </span>
          ) : (
            <>
              {totalBets > 0 && (
                <span style={{
                  display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
                  background: '#22C55E', flexShrink: 0,
                  boxShadow: '0 0 6px rgba(34,197,94,0.6)',
                  animation: 'tgb-pulse-dot 1.5s ease-in-out infinite',
                }} />
              )}
              <span style={{
                fontSize: 9, fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: 1,
                color: totalBets > 0 ? '#22C55E' : 'var(--text-muted)',
                whiteSpace: 'nowrap',
              }}>
                {totalBets > 0 ? t('components.liveWithTips').replace('{count}', String(totalBets)) : t('components.whoWinsQuestion')}
              </span>
            </>
          )}

          {/* Leader / my pick info */}
          {myBet && !isResolved && (
            <span style={{
              fontSize: 9, color: 'var(--gold-primary)', fontWeight: 600,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {t('components.yourTip')}: @{myPickName}
            </span>
          )}
          {!myBet && totalBets > 0 && (
            <span style={{
              fontSize: 9, color: 'var(--text-muted)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {t('components.leadsWithPct').replace('{name}', leader.username).replace('{pct}', String(leaderPct))}
            </span>
          )}
        </div>

        {/* Coin badge */}
        {!isResolved && (
          <span style={{
            fontSize: 8, padding: '2px 7px', borderRadius: 5, flexShrink: 0,
            background: 'rgba(245,158,11,0.1)', color: 'var(--gold-primary)',
            fontFamily: 'var(--font-display)', fontWeight: 700,
          }}>
            🪙 25
          </span>
        )}

        {/* Chevron */}
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round"
          style={{
            flexShrink: 0, transition: 'transform 0.2s',
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* ── Expanded dropdown panel ── */}
      {expanded && (
        <div style={{
          padding: '0 14px 12px',
          maxHeight: 280, overflowY: 'auto',
          transition: 'max-height 0.3s ease',
        }}>
          {/* Members vote bars */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, position: 'relative' }}>
            {allMembers.map((m, i) => {
              const memberBets = betsByMember[m.user_id] || 0
              const pct = totalBets > 0 ? Math.round((memberBets / totalBets) * 100) : 0
              const barWidth = totalBets > 0 ? Math.max(6, (memberBets / maxBets) * 100) : 20
              const isMyPick = myBet?.predicted_winner_id === m.user_id
              const color = MEMBER_COLORS[i % MEMBER_COLORS.length]
              const canBet = !saving && !isResolved
              const shortName = m.username.length > 12 ? m.username.slice(0, 12) + '…' : m.username

              return (
                <button
                  key={m.user_id}
                  onClick={canBet ? (e: React.MouseEvent) => { e.stopPropagation(); e.preventDefault(); placeBet(m.user_id) } : (e: React.MouseEvent) => { e.stopPropagation(); e.preventDefault() }}
                  disabled={!canBet}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '6px 10px', borderRadius: 8, cursor: canBet ? 'pointer' : 'default',
                    background: 'rgba(0,0,0,0.2)',
                    border: isMyPick ? `1.5px solid ${color}55` : '1.5px solid transparent',
                    position: 'relative', overflow: 'hidden',
                    transition: 'all 0.15s',
                  }}
                >
                  {/* Fill bar */}
                  <div style={{
                    position: 'absolute', top: 0, left: 0, bottom: 0,
                    width: `${barWidth}%`,
                    background: isMyPick
                      ? `linear-gradient(90deg, ${color}22, ${color}10)`
                      : `linear-gradient(90deg, ${color}12, ${color}06)`,
                    borderRadius: 8,
                    transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                  }} />

                  {/* Shimmer on my pick */}
                  {isMyPick && !isResolved && (
                    <div style={{
                      position: 'absolute', top: 0, left: '-100%', width: '200%', height: '100%',
                      background: `linear-gradient(90deg, transparent, ${color}08, transparent)`,
                      animation: 'tgb-shimmer 2s infinite',
                    }} />
                  )}

                  {/* Medal/rank + Name */}
                  <span style={{
                    fontSize: 10, fontWeight: 700, color: color,
                    fontFamily: 'var(--font-display)', whiteSpace: 'nowrap',
                    position: 'relative', zIndex: 1, minWidth: 80,
                    textAlign: 'left',
                  }}>
                    {i < 3 ? MEDAL[i] : `${i + 1}.`} @{shortName}
                  </span>

                  {/* Points */}
                  <span style={{
                    fontSize: 8, color: 'var(--text-muted)', position: 'relative', zIndex: 1,
                    whiteSpace: 'nowrap',
                  }}>
                    {m.total_points} {t('components.points')}
                  </span>

                  <div style={{ flex: 1 }} />

                  {/* My pick badge */}
                  {isMyPick && (
                    <span style={{
                      fontSize: 7, padding: '1px 5px', borderRadius: 4,
                      background: won ? 'rgba(34,197,94,0.2)' : lost ? 'rgba(239,68,68,0.15)' : `${color}20`,
                      color: won ? '#22C55E' : lost ? '#EF4444' : color,
                      fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: 0.5,
                      position: 'relative', zIndex: 1,
                    }}>
                      {won ? t('components.correct') : lost ? t('components.wrong') : t('components.yourTip')}
                    </span>
                  )}

                  {/* Bet count + pct */}
                  {totalBets > 0 && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      position: 'relative', zIndex: 1,
                    }}>
                      <span style={{ fontSize: 8, color: 'var(--text-muted)' }}>
                        {memberBets}
                      </span>
                      <span style={{
                        fontSize: 11, fontWeight: 800, color: color,
                        fontFamily: 'var(--font-display)',
                        minWidth: 28, textAlign: 'right',
                      }}>
                        {pct}%
                      </span>
                    </div>
                  )}
                </button>
              )
            })}

            {/* Pulse overlay */}
            {animatePulse && (
              <div style={{
                position: 'absolute', inset: 0, borderRadius: 8,
                border: '2px solid var(--gold-primary)',
                animation: 'tgb-pulse-border 0.6s ease-out',
                pointerEvents: 'none',
              }} />
            )}
          </div>

          {/* Hint text */}
          {!myBet && !isResolved && (
            <div style={{
              textAlign: 'center', marginTop: 6,
              fontSize: 9, color: 'var(--text-muted)', fontStyle: 'italic',
            }}>
              {t('components.tapToPredict')}
            </div>
          )}
        </div>
      )}

      {/* CSS Animations */}
      <style>{`
        @keyframes tgb-pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.3); }
        }
        @keyframes tgb-shimmer {
          0% { transform: translateX(-50%); }
          100% { transform: translateX(50%); }
        }
        @keyframes tgb-pulse-border {
          0% { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(1.01); }
        }
      `}</style>
    </div>
  )
}
