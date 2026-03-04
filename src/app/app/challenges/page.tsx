'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

interface WeeklyChallenge {
  id: string
  week_number: number
  title: string
  description: string | null
  requirement_type: string
  requirement_count: number
  reward_xp: number
  reward_coins: number
  start_date: string | null
  end_date: string | null
}
interface UserWeeklyChallenge {
  challenge_id: string
  progress: number
  completed: boolean
  claimed: boolean
}

function getDaysLeft(endDate: string | null) {
  if (!endDate) return null
  const diff = new Date(endDate).getTime() - Date.now()
  const d = Math.floor(diff / (1000 * 60 * 60 * 24))
  if (d < 0) return 'Abgelaufen'
  if (d === 0) return 'Heute'
  return `${d}T`
}

const REQ_ICONS: Record<string, string> = {
  deals_created: '📋', wins: '⚔️', follows: '👥', streak: '🔥', deals_any: '🤝',
}

export default function ChallengesPage() {
  const { profile, refreshProfile } = useAuth()
  const router = useRouter()

  const [challenges,     setChallenges]     = useState<WeeklyChallenge[]>([])
  const [userChallenges, setUserChallenges] = useState<UserWeeklyChallenge[]>([])
  const [claiming, setClaiming] = useState<string | null>(null)
  const [toast,    setToast]    = useState<string | null>(null)

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }, [])

  useEffect(() => { if (profile) fetchData() }, [profile])

  const fetchData = async () => {
    if (!profile) return
    const [cRes, ucRes] = await Promise.all([
      supabase
        .from('weekly_challenges')
        .select('*')
        .gte('end_date', new Date().toISOString())
        .order('week_number'),
      supabase
        .from('user_weekly_challenges')
        .select('*')
        .eq('user_id', profile.id),
    ])
    setChallenges(cRes.data || [])
    setUserChallenges(ucRes.data || [])
  }

  const getUserChallenge = (id: string) => userChallenges.find(u => u.challenge_id === id)

  const claim = async (ch: WeeklyChallenge) => {
    if (!profile || claiming) return
    const usc = getUserChallenge(ch.id)
    if (!usc?.completed || usc?.claimed) return
    setClaiming(ch.id)
    try {
      if (ch.reward_coins > 0) {
        await supabase.from('wallet_ledger').insert({
          user_id: profile.id, delta: ch.reward_coins, reason: 'weekly_challenge', reference_id: ch.id,
        })
        await supabase.from('profiles')
          .update({ coins: (profile.coins || 0) + ch.reward_coins })
          .eq('id', profile.id)
      }
      if (ch.reward_xp > 0) {
        await supabase.from('profiles')
          .update({ xp: (profile.xp || 0) + ch.reward_xp })
          .eq('id', profile.id)
      }
      await supabase.from('user_weekly_challenges').upsert(
        { user_id: profile.id, challenge_id: ch.id, claimed: true, progress: usc.progress, completed: true },
        { onConflict: 'user_id,challenge_id' }
      )
      setUserChallenges(prev =>
        prev.map(u => u.challenge_id === ch.id ? { ...u, claimed: true } : u)
      )
      const parts: string[] = []
      if (ch.reward_coins) parts.push(`🪙 ${ch.reward_coins} Coins`)
      if (ch.reward_xp)    parts.push(`⭐ ${ch.reward_xp} XP`)
      showToast(`✅ ${ch.title}: ${parts.join(' + ')}`)
      refreshProfile()
    } catch { showToast('❌ Fehler') }
    setClaiming(null)
  }

  // Group by week
  const weeks = [...new Set(challenges.map(c => c.week_number))].sort((a, b) => a - b)

  return (
    <div style={{ minHeight: '100dvh', background: '#060606', color: '#F0ECE4', paddingBottom: 100 }}>

      {toast && (
        <div style={{ position: 'fixed', top: 80, left: '50%', transform: 'translateX(-50%)', background: 'linear-gradient(135deg,#CC8800,#FFB800)', borderRadius: 12, padding: '10px 20px', zIndex: 300, whiteSpace: 'nowrap', fontFamily: 'Cinzel,serif', fontWeight: 700, color: '#000', fontSize: 12 }}>{toast}</div>
      )}

      {/* Header */}
      <div style={{ padding: '56px 20px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: 22 }}>‹</button>
        <div>
          <h1 style={{ fontFamily: 'Cinzel,serif', fontSize: 20, color: '#F0ECE4', fontWeight: 700 }}>CHALLENGES</h1>
          <p style={{ fontSize: 11, color: '#555', marginTop: 2 }}>Wöchentliche Aufgaben</p>
        </div>
      </div>

      {challenges.length === 0 ? (
        <div style={{ padding: '60px 32px', textAlign: 'center' }}>
          <p style={{ fontSize: 40, marginBottom: 16 }}>⚔️</p>
          <p style={{ fontFamily: 'Cinzel,serif', fontSize: 14, color: '#555', marginBottom: 8 }}>Keine aktiven Challenges</p>
          <p style={{ fontSize: 12, color: '#333' }}>Schau später wieder vorbei</p>
        </div>
      ) : (
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {weeks.map(week => {
            const weekChallenges = challenges.filter(c => c.week_number === week)
            const endDate = weekChallenges[0]?.end_date
            const daysLeft = getDaysLeft(endDate)
            const completedCount = weekChallenges.filter(c => getUserChallenge(c.id)?.completed).length

            return (
              <div key={week}>
                {/* Week header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 2, height: 16, background: '#FFB800', borderRadius: 1 }} />
                    <span style={{ fontFamily: 'Cinzel,serif', fontSize: 11, color: '#FFB800', letterSpacing: 2 }}>WOCHE {week}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 10, color: '#555' }}>{completedCount}/{weekChallenges.length} abgeschlossen</span>
                    {daysLeft && (
                      <span style={{ fontFamily: 'Cinzel,serif', fontSize: 10, color: '#888', padding: '2px 8px', background: '#111', borderRadius: 6, border: '1px solid #1a1a1a' }}>
                        ⏳ {daysLeft}
                      </span>
                    )}
                  </div>
                </div>

                {/* Challenges */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {weekChallenges.map(ch => {
                    const usc      = getUserChallenge(ch.id)
                    const progress = usc?.progress || 0
                    const completed = usc?.completed || false
                    const claimed  = usc?.claimed || false
                    const canClaim = completed && !claimed
                    const pct      = Math.min(100, (progress / ch.requirement_count) * 100)
                    const reqIcon  = REQ_ICONS[ch.requirement_type] || '🎯'

                    return (
                      <div key={ch.id} style={{
                        background: canClaim ? 'rgba(255,184,0,0.06)' : completed ? 'rgba(74,222,128,0.04)' : '#111',
                        borderRadius: 14,
                        border: canClaim ? '1.5px solid rgba(255,184,0,0.3)' : completed ? '1px solid rgba(74,222,128,0.2)' : '1px solid #1a1a1a',
                        padding: '14px 16px',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                          {/* Icon */}
                          <div style={{ width: 44, height: 44, borderRadius: 12, background: completed ? 'rgba(74,222,128,0.1)' : 'rgba(255,184,0,0.06)', border: `1.5px solid ${completed ? 'rgba(74,222,128,0.3)' : 'rgba(255,184,0,0.15)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 20 }}>
                            {claimed ? '✅' : reqIcon}
                          </div>

                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                              <span style={{ fontFamily: 'Cinzel,serif', fontSize: 13, color: completed ? '#4ade80' : '#F0ECE4', fontWeight: 700 }}>{ch.title}</span>
                            </div>
                            {ch.description && (
                              <p style={{ fontSize: 12, color: '#666', marginBottom: 8, lineHeight: 1.4 }}>{ch.description}</p>
                            )}

                            {/* Progress bar */}
                            <div style={{ height: 4, background: '#1a1a1a', borderRadius: 2, overflow: 'hidden', marginBottom: 4 }}>
                              <div style={{ height: '100%', width: `${pct}%`, background: claimed ? '#4ade8066' : 'linear-gradient(90deg,#CC8800,#FFB800)', borderRadius: 2, transition: 'width 0.5s' }} />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: 11, color: '#555' }}>
                                {progress} / {ch.requirement_count}
                              </span>
                              <span style={{ fontSize: 11, color: '#888' }}>
                                {ch.reward_coins > 0 && `🪙 ${ch.reward_coins}`}
                                {ch.reward_coins > 0 && ch.reward_xp > 0 && ' · '}
                                {ch.reward_xp > 0 && `⭐ ${ch.reward_xp} XP`}
                              </span>
                            </div>
                          </div>

                          {/* Claim */}
                          {canClaim && (
                            <button onClick={() => claim(ch)} disabled={!!claiming}
                              style={{ flexShrink: 0, padding: '8px 14px', borderRadius: 10, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#CC8800,#FFB800)', color: '#000', fontFamily: 'Cinzel,serif', fontSize: 10, fontWeight: 700, alignSelf: 'center' }}>
                              {claiming === ch.id ? '...' : 'CLAIM'}
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
