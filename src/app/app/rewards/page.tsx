'use client'
import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useLang } from '@/contexts/LanguageContext'
import { supabase } from '@/lib/supabase'
import CoinIcon from '@/components/CoinIcon'
import { trackRewardClaimed, trackStreakClaimed, trackDailyChallengeCompleted, trackScreenView } from '@/lib/analytics'

type Tab = 'daily' | 'streak' | 'season'

interface DailyReward {
  id: string
  day_number: number
  reward_type: string
  reward_ref: string | null
  reward_amount: number | null
  name: string
  rarity: string
}
interface UserDailyLogin {
  current_day: number
  last_login_date: string | null
  total_logins: number
}
interface SeasonChallenge {
  id: string
  title: string
  description: string
  requirement_type: string
  requirement_count: number
  reward_type: string
  reward_ref: string | null
  reward_amount: number | null
  reward_rarity: string
}
interface UserSeasonChallenge {
  challenge_id: string
  progress: number
  completed: boolean
  claimed: boolean
}
interface StreakReward {
  id: string
  streak_count: number
  reward_type: string
  reward_ref: string | null
  reward_amount: number | null
  name: string
  rarity: string
}
interface UserStreakReward {
  streak_reward_id: string
  claimed: boolean
}

const RARITY_COLORS: Record<string, string> = {
  common: '#9CA3AF', rare: '#3B82F6', epic: '#8B5CF6', legendary: '#F59E0B',
}

export default function RewardsPage() {
  const { profile, refreshProfile } = useAuth()
  const { t } = useLang()
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('daily')

  const [dailyRewards,    setDailyRewards]    = useState<DailyReward[]>([])
  const [userDaily,       setUserDaily]       = useState<UserDailyLogin | null>(null)
  const [seasonChallenges,setSeasonChallenges]= useState<SeasonChallenge[]>([])
  const [userChallenges,  setUserChallenges]  = useState<UserSeasonChallenge[]>([])
  const [streakRewards,   setStreakRewards]   = useState<StreakReward[]>([])
  const [userStreakRewards,setUserStreakRewards]= useState<UserStreakReward[]>([])
  const [claiming, setClaiming] = useState<string | null>(null)
  const [toast,    setToast]    = useState<string | null>(null)

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }, [])

  useEffect(() => { trackScreenView('rewards') }, [])
  useEffect(() => { if (profile) fetchAll() }, [profile])

  const fetchAll = async () => {
    if (!profile) return
    const [drRes, udRes, scRes, ucRes, srRes, usrRes] = await Promise.all([
      supabase.from('daily_login_rewards').select('*').order('day_number'),
      supabase.from('user_daily_login').select('*').eq('user_id', profile.id).single(),
      supabase.from('season_challenges').select('*').eq('season_id', 1),
      supabase.from('user_season_challenges').select('*').eq('user_id', profile.id),
      supabase.from('streak_rewards').select('*').order('streak_count'),
      supabase.from('user_streak_rewards').select('*').eq('user_id', profile.id),
    ])
    setDailyRewards(drRes.data || [])
    setUserDaily(udRes.data || null)
    setSeasonChallenges(scRes.data || [])
    setUserChallenges(ucRes.data || [])
    setStreakRewards(srRes.data || [])
    setUserStreakRewards(usrRes.data || [])
  }

  const today = new Date().toISOString().slice(0, 10)
  const lastLogin = userDaily?.last_login_date
  const canClaimDaily = !lastLogin || lastLogin < today
  const currentDay = userDaily?.current_day || 1
  const todayReward = dailyRewards.find(r => r.day_number === currentDay)

  const claimDaily = async () => {
    if (!profile || !todayReward || !canClaimDaily || claiming) return
    setClaiming('daily')
    try {
      if (todayReward.reward_type === 'coins' && todayReward.reward_amount) {
        await supabase.from('wallet_ledger').insert({
          user_id: profile.id, delta: todayReward.reward_amount,
          reason: 'daily_login', reference_id: todayReward.id,
        })
        await supabase.from('profiles')
          .update({ coins: (profile.coins || 0) + todayReward.reward_amount })
          .eq('id', profile.id)
      } else if (todayReward.reward_ref) {
        await supabase.from('user_inventory').upsert(
          { user_id: profile.id, cosmetic_id: todayReward.reward_ref, source: 'daily_login' },
          { onConflict: 'user_id,cosmetic_id' }
        )
      }
      const nextDay = currentDay >= 7 ? 1 : currentDay + 1
      await supabase.from('user_daily_login').upsert({
        user_id: profile.id, current_day: nextDay,
        last_login_date: today,
        total_logins: (userDaily?.total_logins || 0) + 1,
      }, { onConflict: 'user_id' })
      setUserDaily(prev => prev
        ? { ...prev, last_login_date: today, current_day: nextDay, total_logins: (prev.total_logins || 0) + 1 }
        : null
      )
      trackRewardClaimed('daily_login')
      showToast(`✅ ${todayReward.name}!`)
      refreshProfile()
    } catch { showToast('❌ Fehler') }
    setClaiming(null)
  }

  const claimStreakReward = async (sr: StreakReward) => {
    if (!profile || claiming) return
    setClaiming(sr.id)
    try {
      if (sr.reward_type === 'coins' && sr.reward_amount) {
        await supabase.from('wallet_ledger').insert({
          user_id: profile.id, delta: sr.reward_amount, reason: 'streak_reward', reference_id: sr.id,
        })
        await supabase.from('profiles')
          .update({ coins: (profile.coins || 0) + sr.reward_amount }).eq('id', profile.id)
      } else if (sr.reward_ref) {
        await supabase.from('user_inventory').upsert(
          { user_id: profile.id, cosmetic_id: sr.reward_ref, source: 'streak_reward' },
          { onConflict: 'user_id,cosmetic_id' }
        )
      }
      await supabase.from('user_streak_rewards').upsert(
        { user_id: profile.id, streak_reward_id: sr.id, claimed: true, claimed_at: new Date().toISOString() },
        { onConflict: 'user_id,streak_reward_id' }
      )
      setUserStreakRewards(prev => [
        ...prev.filter(u => u.streak_reward_id !== sr.id),
        { streak_reward_id: sr.id, claimed: true },
      ])
      trackStreakClaimed(sr.streak_count)
      showToast(`🔥 ${sr.name} ${t('rewards.received')}`)
      refreshProfile()
    } catch { showToast('❌ Fehler') }
    setClaiming(null)
  }

  const claimChallenge = async (sc: SeasonChallenge) => {
    if (!profile || claiming) return
    setClaiming(sc.id)
    try {
      if (sc.reward_type === 'coins' && sc.reward_amount) {
        await supabase.from('wallet_ledger').insert({
          user_id: profile.id, delta: sc.reward_amount, reason: 'challenge_reward', reference_id: sc.id,
        })
        await supabase.from('profiles')
          .update({ coins: (profile.coins || 0) + sc.reward_amount }).eq('id', profile.id)
      } else if (sc.reward_ref) {
        await supabase.from('user_inventory').upsert(
          { user_id: profile.id, cosmetic_id: sc.reward_ref, source: 'challenge' },
          { onConflict: 'user_id,cosmetic_id' }
        )
      }
      const existing = userChallenges.find(u => u.challenge_id === sc.id)
      await supabase.from('user_season_challenges').upsert(
        { user_id: profile.id, challenge_id: sc.id, claimed: true, progress: existing?.progress || 0, completed: true },
        { onConflict: 'user_id,challenge_id' }
      )
      setUserChallenges(prev =>
        prev.map(u => u.challenge_id === sc.id ? { ...u, claimed: true } : u)
      )
      trackDailyChallengeCompleted(sc.id)
      showToast(`✅ ${sc.title} abgeschlossen!`)
      refreshProfile()
    } catch { showToast('❌ Fehler') }
    setClaiming(null)
  }

  const getUserChallenge    = (id: string) => userChallenges.find(u => u.challenge_id === id)
  const getUserStreakReward  = (id: string) => userStreakRewards.find(u => u.streak_reward_id === id)
  const currentStreak = profile?.streak || 0

  const TAB_LABELS: Record<Tab, string> = { daily: t('rewards.daily'), streak: t('rewards.streak'), season: t('rewards.season') }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg-base)', color: 'var(--text-primary)', paddingBottom: 100 }}>

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: 80, left: '50%', transform: 'translateX(-50%)', background: 'linear-gradient(135deg, var(--gold-dim), var(--gold-primary))', borderRadius: 12, padding: '10px 20px', zIndex: 300, whiteSpace: 'nowrap', fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--text-inverse)', fontSize: 12 }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div style={{ padding: '56px 20px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 22 }}>‹</button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--text-primary)', fontWeight: 700 }}>BELOHNUNGEN</h1>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Täglich · Streak · Saison</p>
        </div>
        {canClaimDaily && (
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--gold-primary)', boxShadow: '0 0 8px var(--gold-primary)' }} />
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', margin: '0 16px 20px', background: 'var(--bg-surface)', borderRadius: 10, padding: 4 }}>
        {(Object.keys(TAB_LABELS) as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ flex: 1, padding: '8px', borderRadius: 8, border: tab === t ? '1px solid var(--gold-glow)' : 'none', background: tab === t ? 'var(--gold-subtle)' : 'transparent', color: tab === t ? 'var(--gold-primary)' : 'var(--text-muted)', fontFamily: 'var(--font-display)', fontSize: 9, letterSpacing: 1, cursor: 'pointer' }}>
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {/* ── TÄGLICH ── */}
      {tab === 'daily' && (
        <div style={{ padding: '0 16px' }}>
          {/* Claim banner */}
          {canClaimDaily && todayReward ? (
            <div style={{ background: 'var(--gold-subtle)', borderRadius: 16, border: '1.5px solid var(--gold-glow)', padding: '24px 20px', marginBottom: 20, textAlign: 'center', boxShadow: '0 0 24px var(--gold-subtle)' }}>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: 10, color: 'var(--gold-dim)', letterSpacing: 3, marginBottom: 10 }}>TAG {currentDay} – BEREIT!</p>
              <p style={{ fontSize: 40, marginBottom: 8 }}>{todayReward.reward_type === 'coins' ? '🪙' : '🎁'}</p>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: 15, color: 'var(--text-primary)', marginBottom: 4 }}>{todayReward.name}</p>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
                {todayReward.reward_type === 'coins' ? `+${todayReward.reward_amount} Coins` : `${todayReward.reward_ref?.replace(/_/g, ' ')}`}
              </p>
              <button onClick={claimDaily} disabled={!!claiming}
                style={{ padding: '12px 40px', borderRadius: 12, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, var(--gold-dim), var(--gold-primary))', color: 'var(--text-inverse)', fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, letterSpacing: 1 }}>
                {claiming === 'daily' ? '...' : '🎁 ABHOLEN'}
              </button>
            </div>
          ) : (
            <div style={{ background: 'var(--bg-base)', borderRadius: 12, border: '1px solid var(--bg-elevated)', padding: '14px 16px', marginBottom: 20, textAlign: 'center' }}>
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>✅ Heute bereits abgeholt — morgen wieder!</p>
            </div>
          )}

          {/* 7-day calendar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginBottom: 20 }}>
            {dailyRewards.map(dr => {
              const isPast  = dr.day_number < currentDay && !!userDaily?.last_login_date && !canClaimDaily
              const isCurr  = dr.day_number === currentDay
              const rc      = RARITY_COLORS[dr.rarity] || '#9CA3AF'
              return (
                <div key={dr.day_number} style={{
                  background: isCurr && canClaimDaily ? 'var(--gold-subtle)' : isPast ? 'rgba(74,222,128,0.06)' : 'var(--bg-base)',
                  borderRadius: 10, border: isCurr && canClaimDaily ? '1.5px solid var(--gold-primary)' : isPast ? '1px solid rgba(74,222,128,0.25)' : '1px solid var(--bg-elevated)',
                  padding: '8px 3px', textAlign: 'center',
                }}>
                  <p style={{ fontSize: 8, color: isCurr ? 'var(--gold-primary)' : isPast ? 'var(--status-active)' : 'var(--text-muted)', fontFamily: 'var(--font-display)', marginBottom: 4 }}>T{dr.day_number}</p>
                  <p style={{ fontSize: 18 }}>{isPast ? '✅' : dr.reward_type === 'coins' ? '🪙' : '🎁'}</p>
                  <p style={{ fontSize: 8, color: rc, marginTop: 2 }}>
                    {dr.reward_type === 'coins' ? `${dr.reward_amount}` : ''}
                  </p>
                </div>
              )
            })}
          </div>

          <div style={{ textAlign: 'center', paddingBottom: 12 }}>
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>🗓️ Gesamt-Logins: <span style={{ color: 'var(--gold-primary)' }}>{userDaily?.total_logins || 0}</span></p>
          </div>
        </div>
      )}

      {/* ── STREAK ── */}
      {tab === 'streak' && (
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Streak banner */}
          <div style={{ background: 'rgba(251,146,60,0.06)', borderRadius: 14, border: '1px solid rgba(251,146,60,0.2)', padding: '20px', marginBottom: 8, textAlign: 'center' }}>
            <p style={{ fontSize: 44, marginBottom: 4 }}>🔥</p>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 36, color: 'var(--status-warning)', fontWeight: 700, lineHeight: 1 }}>{currentStreak}</p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>Aktuelle Gewinn-Serie</p>
          </div>

          {streakRewards.map(sr => {
            const usr      = getUserStreakReward(sr.id)
            const rc       = RARITY_COLORS[sr.rarity] || '#9CA3AF'
            const reached  = currentStreak >= sr.streak_count
            const claimed  = usr?.claimed || false
            const canClaim = reached && !claimed

            return (
              <div key={sr.id} style={{
                background: canClaim ? `${rc}0A` : 'var(--bg-surface)',
                borderRadius: 14, border: canClaim ? `1.5px solid ${rc}55` : claimed ? '1px solid rgba(74,222,128,0.2)' : '1px solid var(--bg-elevated)',
                padding: '14px 16px',
                opacity: !reached && !claimed ? 0.6 : 1,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 12, flexShrink: 0, background: reached ? `${rc}18` : 'var(--bg-base)', border: `1.5px solid ${reached ? rc : 'var(--border-subtle)'}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                    <span style={{ fontSize: 10 }}>🔥</span>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: 13, color: rc, fontWeight: 700 }}>{sr.streak_count}</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontFamily: 'var(--font-display)', fontSize: 13, color: 'var(--text-primary)', fontWeight: 700 }}>{sr.name}</span>
                      <span style={{ fontSize: 9, color: rc, fontFamily: 'var(--font-display)', padding: '1px 6px', background: `${rc}15`, borderRadius: 4 }}>{sr.rarity.toUpperCase()}</span>
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      {sr.reward_type === 'coins' ? <><CoinIcon size={12} /> {sr.reward_amount} Coins</> : <>🎁 {sr.reward_ref?.replace(/_/g, ' ')}</>}
                    </p>
                  </div>
                  <div style={{ flexShrink: 0 }}>
                    {claimed ? (
                      <span style={{ fontSize: 20 }}>✅</span>
                    ) : canClaim ? (
                      <button onClick={() => claimStreakReward(sr)} disabled={!!claiming}
                        style={{ padding: '8px 16px', borderRadius: 10, border: 'none', cursor: 'pointer', background: `linear-gradient(135deg,${rc}88,${rc})`, color: 'var(--text-inverse)', fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 700 }}>
                        {claiming === sr.id ? '...' : 'CLAIM'}
                      </button>
                    ) : (
                      <div style={{ textAlign: 'center' }}>
                        <span style={{ fontSize: 16 }}>🔒</span>
                        <p style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>🔥{sr.streak_count}</p>
                      </div>
                    )}
                  </div>
                </div>
                {!reached && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ height: 3, background: 'var(--bg-elevated)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.min(100, (currentStreak / sr.streak_count) * 100)}%`, background: `${rc}66`, borderRadius: 2 }} />
                    </div>
                    <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>🔥{currentStreak} / {sr.streak_count}</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── SAISON ── */}
      {tab === 'season' && (
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ padding: '10px 14px', background: 'var(--gold-subtle)', borderRadius: 10, border: '1px solid var(--gold-glow)', marginBottom: 4 }}>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 9, color: 'var(--gold-dim)', letterSpacing: 2 }}>SEASON 1 · THE FOUNDERS ERA</p>
          </div>

          {seasonChallenges.map(sc => {
            const usc      = getUserChallenge(sc.id)
            const rc       = RARITY_COLORS[sc.reward_rarity] || '#9CA3AF'
            const progress = usc?.progress || 0
            const completed = usc?.completed || false
            const claimed  = usc?.claimed || false
            const canClaim = completed && !claimed
            const pct      = Math.min(100, (progress / sc.requirement_count) * 100)

            return (
              <div key={sc.id} style={{
                background: canClaim ? `${rc}0A` : 'var(--bg-surface)',
                borderRadius: 14, border: canClaim ? `1.5px solid ${rc}55` : claimed ? '1px solid rgba(74,222,128,0.2)' : '1px solid var(--bg-elevated)',
                padding: '14px 16px',
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{ fontFamily: 'var(--font-display)', fontSize: 13, color: 'var(--text-primary)', fontWeight: 700 }}>{sc.title}</span>
                      <span style={{ fontSize: 9, color: rc, fontFamily: 'var(--font-display)', padding: '1px 6px', background: `${rc}15`, borderRadius: 4 }}>{sc.reward_rarity.toUpperCase()}</span>
                    </div>
                    {sc.description && (
                      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, lineHeight: 1.4 }}>{sc.description}</p>
                    )}
                    <div style={{ height: 4, background: 'var(--bg-elevated)', borderRadius: 2, overflow: 'hidden', marginBottom: 4 }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: claimed ? '#4ade8066' : `${rc}88`, borderRadius: 2, transition: 'width 0.5s' }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{progress} / {sc.requirement_count}</p>
                      <p style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        {sc.reward_type === 'coins' ? <><CoinIcon size={12} /> {sc.reward_amount}</> : <>🎁 {sc.reward_ref?.replace(/_/g, ' ')}</>}
                      </p>
                    </div>
                  </div>
                  <div style={{ flexShrink: 0, marginTop: 4 }}>
                    {claimed ? (
                      <span style={{ fontSize: 20 }}>✅</span>
                    ) : canClaim ? (
                      <button onClick={() => claimChallenge(sc)} disabled={!!claiming}
                        style={{ padding: '8px 14px', borderRadius: 10, border: 'none', cursor: 'pointer', background: `linear-gradient(135deg,${rc}88,${rc})`, color: 'var(--text-inverse)', fontFamily: 'var(--font-display)', fontSize: 10, fontWeight: 700 }}>
                        {claiming === sc.id ? '...' : 'CLAIM'}
                      </button>
                    ) : (
                      <span style={{ fontSize: 18 }}>🔒</span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
