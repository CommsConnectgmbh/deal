'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import CoinIcon from '@/components/CoinIcon'

interface Challenge {
  id: string
  title: string
  description: string
  requirement_type: string
  requirement_count: number
  xp_reward: number
  coin_reward: number
}

interface Progress {
  id: string
  challenge_id: string
  progress: number
  completed: boolean
  claimed: boolean
}

export default function DailyChallengesWidget() {
  const { profile, refreshProfile } = useAuth()
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [progressMap, setProgressMap] = useState<Record<string, Progress>>({})
  const [claiming, setClaiming] = useState<string | null>(null)
  const [countdown, setCountdown] = useState('')
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchData = useCallback(async () => {
    if (!profile) return

    const today = new Date().toISOString().split('T')[0]

    const [chRes, prRes] = await Promise.all([
      supabase
        .from('daily_challenges')
        .select('*')
        .eq('day_date', today)
        .order('xp_reward'),
      supabase
        .from('user_daily_progress')
        .select('*')
        .eq('user_id', profile.id),
    ])

    const ch = chRes.data || []
    setChallenges(ch)

    // Build progress map keyed by challenge_id
    const map: Record<string, Progress> = {}
    if (prRes.data) {
      const challengeIds = new Set(ch.map((c: Challenge) => c.id))
      for (const p of prRes.data) {
        if (challengeIds.has(p.challenge_id)) {
          map[p.challenge_id] = p
        }
      }
    }
    setProgressMap(map)
  }, [profile])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Countdown to midnight
  useEffect(() => {
    const tick = () => {
      const now = new Date()
      const midnight = new Date(now)
      midnight.setHours(24, 0, 0, 0)
      const diff = midnight.getTime() - now.getTime()
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setCountdown(
        `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      )
    }
    tick()
    timerRef.current = setInterval(tick, 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  const claimReward = async (challenge: Challenge) => {
    if (!profile || claiming) return
    setClaiming(challenge.id)
    try {
      // Award XP
      if (challenge.xp_reward > 0) {
        await supabase.from('xp_events').insert({
          user_id: profile.id,
          xp: challenge.xp_reward,
          reason: 'daily_challenge',
          reference_id: challenge.id,
        })
        await supabase.from('profiles').update({
          xp: (profile.xp || 0) + challenge.xp_reward,
        }).eq('id', profile.id)
      }

      // Award coins
      if (challenge.coin_reward > 0) {
        await supabase.from('wallet_ledger').insert({
          user_id: profile.id,
          delta: challenge.coin_reward,
          reason: 'daily_challenge',
          reference_id: challenge.id,
        })
        await supabase.from('profiles').update({
          coins: (profile.coins || 0) + challenge.coin_reward,
        }).eq('id', profile.id)
      }

      // Mark claimed
      const prog = progressMap[challenge.id]
      if (prog) {
        await supabase.from('user_daily_progress').update({ claimed: true }).eq('id', prog.id)
      }

      await refreshProfile()
      await fetchData()
    } catch (e) {
      console.error('Claim error:', e)
    }
    setClaiming(null)
  }

  if (challenges.length === 0) return null

  return (
    <div style={{
      background: 'var(--bg-surface)',
      borderRadius: 16,
      border: '1px solid var(--border-subtle)',
      padding: '16px',
      marginBottom: 16,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <span style={{
          fontFamily: 'var(--font-display)',
          fontSize: 11,
          letterSpacing: 3,
          color: 'var(--gold-primary)',
          fontWeight: 700,
        }}>
          DAILY CHALLENGES
        </span>
        <span style={{
          fontFamily: 'var(--font-body)',
          fontSize: 11,
          color: 'var(--text-muted)',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}>
          <span style={{ fontSize: 12 }}>&#9201;</span>
          Reset in {countdown}
        </span>
      </div>

      {/* Challenge list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {challenges.map(ch => {
          const prog = progressMap[ch.id]
          const current = prog?.progress || 0
          const total = ch.requirement_count
          const completed = prog?.completed || false
          const claimed = prog?.claimed || false
          const pct = Math.min(100, total > 0 ? Math.round((current / total) * 100) : 0)

          return (
            <div key={ch.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {/* Title row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14 }}>
                    {claimed ? '\u2705' : completed ? '\u2705' : '\u2B1C'}
                  </span>
                  <span style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: 13,
                    color: claimed ? 'var(--text-muted)' : 'var(--text-primary)',
                    textDecoration: claimed ? 'line-through' : 'none',
                  }}>
                    {ch.title}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: 11,
                    color: 'var(--text-muted)',
                  }}>
                    {current}/{total}
                  </span>
                  <span style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 11,
                    color: 'var(--gold-primary)',
                    fontWeight: 600,
                  }}>
                    +{ch.xp_reward}XP
                    {ch.coin_reward > 0 && <> +{ch.coin_reward}<CoinIcon size={12} /></>}
                  </span>
                </div>
              </div>

              {/* Progress bar */}
              <div style={{
                width: '100%',
                height: 6,
                borderRadius: 3,
                background: 'var(--bg-deepest)',
                overflow: 'hidden',
              }}>
                <div style={{
                  width: `${pct}%`,
                  height: '100%',
                  borderRadius: 3,
                  background: completed
                    ? 'var(--status-active)'
                    : 'linear-gradient(90deg, var(--gold-dim), var(--gold-primary))',
                  transition: 'width 0.4s ease',
                }} />
              </div>

              {/* Claim button */}
              {completed && !claimed && (
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => claimReward(ch)}
                    disabled={claiming === ch.id}
                    style={{
                      padding: '6px 16px',
                      borderRadius: 8,
                      border: 'none',
                      background: 'linear-gradient(135deg, var(--gold-dim), var(--gold-primary))',
                      color: 'var(--text-inverse)',
                      fontFamily: 'var(--font-display)',
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: 2,
                      cursor: 'pointer',
                      opacity: claiming === ch.id ? 0.6 : 1,
                    }}
                  >
                    {claiming === ch.id ? '...' : 'EINL\u00D6SEN'}
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
