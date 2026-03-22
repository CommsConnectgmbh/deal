'use client'
import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import CoinIcon from '@/components/CoinIcon'
import { trackBattlePassOpened, trackBattlePassRewardClaimed, trackScreenView } from '@/lib/analytics'
import { useLang } from '@/contexts/LanguageContext'

interface BPReward {
  season_id: number
  level: number
  track: 'free' | 'premium'
  reward_type: string
  reward_value: string | null
  reward_amount: number | null
}

interface UserBP {
  season_xp: number
  current_tier: number
  premium_unlocked: boolean
  claimed_rewards: string[]
}

const REWARD_ICONS: Record<string, string> = {
  frame: '🖼️', badge: '🏅', card_skin: '🃏', coins: '🪙',
  title: '🏷️', avatar_item: '👤', xp: '⭐',
}
const REWARD_COLORS: Record<string, string> = {
  frame: 'var(--status-info)', badge: '#c084fc', card_skin: '#34d399',
  coins: 'var(--gold-primary)', title: 'var(--status-warning)', avatar_item: 'var(--rarity-epic)', xp: 'var(--gold-primary)',
}
const MILESTONE_TIERS = [5, 10, 15, 20, 25, 30]
const MILESTONE_LORE_KEYS: Record<number, string> = {
  5:  'battlepass.milestoneLore5',
  10: 'battlepass.milestoneLore10',
  15: 'battlepass.milestoneLore15',
  20: 'battlepass.milestoneLore20',
  25: 'battlepass.milestoneLore25',
  30: 'battlepass.milestoneLore30',
}

// Season countdown (hardcoded Season 1 end)
const SEASON_END = new Date('2025-09-01T00:00:00Z')
function getDaysLeft() {
  const diff = SEASON_END.getTime() - Date.now()
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)))
}

export default function BattlePassPage() {
  const { profile, refreshProfile } = useAuth()
  const router = useRouter()
  const { t } = useLang()

  const [rewards, setRewards]   = useState<BPReward[]>([])
  const [userBP,  setUserBP]    = useState<UserBP | null>(null)
  const [claiming, setClaiming] = useState<string | null>(null)
  const [toast,   setToast]     = useState<React.ReactNode | null>(null)
  const [milestoneModal, setMilestoneModal] = useState<number | null>(null)
  const [claimAnim, setClaimAnim] = useState<string | null>(null)
  const sliderRef  = useRef<HTMLDivElement>(null)
  const SEASON_ID  = 1

  useEffect(() => { trackScreenView('battlepass'); trackBattlePassOpened() }, [])

  useEffect(() => {
    if (profile) { fetchRewards(); fetchUserBP() }
  }, [profile])

  const fetchRewards = async () => {
    const { data } = await supabase
      .from('battle_pass_rewards').select('*').eq('season_id', SEASON_ID).order('level')
    setRewards(data || [])
  }

  const fetchUserBP = async () => {
    const { data } = await supabase
      .from('user_battlepass').select('*')
      .eq('user_id', profile!.id).eq('season_id', SEASON_ID).single()
    if (data) {
      setUserBP({ ...data, claimed_rewards: data.claimed_rewards || [] })
    } else {
      const { data: newBP } = await supabase
        .from('user_battlepass')
        .upsert({ user_id: profile!.id, season_id: SEASON_ID }, { onConflict: 'user_id,season_id' })
        .select().single()
      if (newBP) setUserBP({ ...newBP, claimed_rewards: [] })
    }
  }

  const currentTier = userBP ? Math.floor((userBP.season_xp || 0) / 500) : 0
  const xpInTier    = (userBP?.season_xp || 0) % 500
  const xpProgress  = (xpInTier / 500) * 100

  const rewardKey = (r: BPReward) => `${r.level}_${r.track}`
  const isClaimed = (r: BPReward) => (userBP?.claimed_rewards || []).includes(rewardKey(r))
  const isEarned  = (r: BPReward) => {
    if (r.track === 'premium' && !userBP?.premium_unlocked) return false
    return currentTier >= r.level
  }

  // Auto-scroll to current tier on load
  useEffect(() => {
    if (userBP && sliderRef.current) {
      const CARD_W = 90
      const idx    = Math.max(0, currentTier - 1)
      const scroll = idx * (CARD_W + 8) - 40
      setTimeout(() => sliderRef.current?.scrollTo({ left: scroll, behavior: 'smooth' }), 400)
    }
  }, [userBP])

  const claimReward = async (reward: BPReward) => {
    const key = rewardKey(reward)
    if (isClaimed(reward) || !isEarned(reward) || claiming) return
    setClaiming(key)
    try {
      if (reward.reward_type === 'coins' && reward.reward_amount) {
        await supabase.from('wallet_ledger').insert({
          user_id: profile!.id, delta: reward.reward_amount,
          reason: 'battlepass_reward', reference_id: key,
        })
        await supabase.from('profiles')
          .update({ coins: (profile?.coins || 0) + reward.reward_amount }).eq('id', profile!.id)
      } else if (reward.reward_value) {
        await supabase.from('user_inventory').upsert({
          user_id: profile!.id, cosmetic_id: reward.reward_value, source: 'battlepass',
        }, { onConflict: 'user_id,cosmetic_id' })
      }
      const newClaimed = [...(userBP?.claimed_rewards || []), key]
      await supabase.from('user_battlepass')
        .update({ claimed_rewards: newClaimed })
        .eq('user_id', profile!.id).eq('season_id', SEASON_ID)
      trackBattlePassRewardClaimed(reward.level)
      setUserBP(prev => prev ? { ...prev, claimed_rewards: newClaimed } : prev)
      setClaimAnim(key)
      setTimeout(() => setClaimAnim(null), 800)
      if (reward.reward_type === 'coins') {
        setToast(<><CoinIcon size={14} /> +{reward.reward_amount} {t('battlepass.coinsReceived')}</>)
      } else {
        setToast(<>🎁 {reward.reward_value?.replace(/_/g,' ')} {t('battlepass.unlocked')}</>)
      }
      setTimeout(() => setToast(null), 3000)
      await refreshProfile()
    } catch (_e) { /* claim error */ }
    setClaiming(null)
  }

  const tiers = Array.from({ length: 30 }, (_, i) => i + 1)

  // ─── Tier Card ───────────────────────────────────────────────────────────────
  const TierCard = ({ tier }: { tier: number }) => {
    const freeR  = rewards.find(r => r.level === tier && r.track === 'free')
    const premR  = rewards.find(r => r.level === tier && r.track === 'premium')
    const isMile = MILESTONE_TIERS.includes(tier)
    const isCurr = tier === currentTier + 1
    const isPast = tier <= currentTier
    const cardW  = isMile ? 104 : 84

    return (
      <div style={{ display:'flex', flexDirection:'column', gap:6, alignItems:'center', flexShrink:0, width:cardW }}>
        {/* Tier number */}
        <div style={{
          fontSize: isMile ? 11 : 9, fontFamily:'var(--font-display)', fontWeight:700,
          color: isMile ? 'var(--gold-primary)' : isPast ? 'var(--status-active)' : isCurr ? 'var(--gold-primary)' : '#444',
          letterSpacing:1,
        }}>
          {isMile ? `✦ TIER ${tier}` : `T${tier}`}
        </div>

        {/* Free Track Card */}
        <TierSlot reward={freeR} tier={tier} isMile={isMile} isPast={isPast} isCurr={isCurr} />

        {/* Premium Track Card */}
        <TierSlot reward={premR} tier={tier} isMile={isMile} isPast={isPast} isCurr={isCurr} isPremium />
      </div>
    )
  }

  const TierSlot = ({
    reward, tier, isMile, isPast, isCurr, isPremium = false,
  }: {
    reward?: BPReward; tier: number; isMile: boolean
    isPast: boolean; isCurr: boolean; isPremium?: boolean
  }) => {
    if (!reward) {
      return <div style={{ width: isMile ? 104 : 84, height: isMile ? 120 : 100, borderRadius:10, background:'var(--bg-base)', border:'1px solid var(--bg-elevated)', opacity:0.3 }} />
    }
    const earned   = isEarned(reward)
    const claimed  = isClaimed(reward)
    const key      = rewardKey(reward)
    const rColor   = REWARD_COLORS[reward.reward_type] || '#888'
    const isAnimating = claimAnim === key

    return (
      <div
        onClick={() => earned && !claimed && claimReward(reward)}
        style={{
          width: isMile ? 104 : 84,
          height: isMile ? 120 : 100,
          borderRadius: 12,
          border: isCurr && !isPremium ? `2px solid var(--gold-primary)` :
                  claimed             ? `1.5px solid #4ade8055` :
                  earned              ? `1.5px solid ${rColor}55` :
                  isPremium && !userBP?.premium_unlocked ? `1px dashed #33333380` :
                                        `1px solid var(--bg-elevated)`,
          background: isMile && earned && !claimed ? `${rColor}12` :
                      claimed          ? `rgba(74,222,128,0.06)` :
                      earned           ? `${rColor}08` :
                                         `#0D0D0D`,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: 6, cursor: earned && !claimed ? 'pointer' : 'default',
          position: 'relative', overflow: 'hidden',
          boxShadow: isCurr && !isPremium ? `0 0 16px rgba(255,184,0,0.27)` :
                     isMile && earned && !claimed ? `0 0 12px ${rColor}33` : 'none',
          transition: 'all 0.2s',
          animation: isAnimating ? 'claimPop 0.8s ease' : 'none',
          opacity: !earned && !isPremium ? 0.5 : 1,
        }}
      >
        {/* Premium lock overlay */}
        {isPremium && !userBP?.premium_unlocked && (
          <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', borderRadius:12, zIndex:1 }}>
            <span style={{ fontSize:16 }}>🔒</span>
          </div>
        )}

        {/* Milestone star decoration */}
        {isMile && (
          <div style={{ position:'absolute', top:4, right:4, fontSize:9, color:`${rColor}88` }}>✦</div>
        )}

        {/* Pulse ring for current tier */}
        {isCurr && !isPremium && (
          <div style={{
            position:'absolute', inset:-2, borderRadius:13,
            border:'2px solid var(--gold-primary)',
            animation:'pulse 1.5s ease-in-out infinite',
            opacity:0.5, pointerEvents:'none',
          }} />
        )}

        {/* Icon */}
        <span style={{
          fontSize: isMile ? 22 : 18,
          filter: earned ? 'none' : 'grayscale(1) opacity(0.3)',
        }}>
          {claimed ? '✅' : REWARD_ICONS[reward.reward_type] || '🎁'}
        </span>

        {/* Label */}
        <span style={{
          fontSize: 8, textAlign:'center', lineHeight:1.2, padding:'0 4px',
          color: claimed ? 'var(--status-active)' : earned ? rColor : '#444',
          fontFamily: 'var(--font-display)',
        }}>
          {reward.reward_type === 'coins'
            ? <>{reward.reward_amount}<CoinIcon size={10} /></>
            : (reward.reward_value || reward.reward_type).replace(/_/g,' ').slice(0,12)}
        </span>

        {/* Claim button for earned */}
        {earned && !claimed && (
          <div style={{
            background: isPremium && !userBP?.premium_unlocked ? 'transparent' :
                        `linear-gradient(135deg, var(--gold-dim), var(--gold-primary))`,
            borderRadius:6, padding:'2px 8px',
            fontSize:8, fontWeight:700, color:'var(--text-inverse)', fontFamily:'var(--font-display)',
          }}>
            {claiming === key ? '...' : 'CLAIM'}
          </div>
        )}

        {/* Milestone tap to open lore */}
        {isMile && (
          <button
            onClick={(e) => { e.stopPropagation(); setMilestoneModal(tier) }}
            style={{ position:'absolute', bottom:4, right:4, background:'none', border:'none', cursor:'pointer', fontSize:10, color:`${rColor}66` }}
          >ℹ</button>
        )}
      </div>
    )
  }

  return (
    <div style={{ minHeight:'100dvh', background:'var(--bg-base)', color:'var(--text-primary)', paddingBottom:40 }}>
      {/* CSS Animations */}
      <style>{`
        @keyframes pulse { 0%,100%{opacity:0.4} 50%{opacity:0.9} }
        @keyframes claimPop { 0%{transform:scale(1)} 50%{transform:scale(1.08)} 100%{transform:scale(1)} }
      `}</style>

      {/* Toast */}
      {toast && (
        <div style={{ position:'fixed', top:80, left:'50%', transform:'translateX(-50%)', background:'linear-gradient(135deg,var(--gold-dim),var(--gold-primary))', borderRadius:12, padding:'10px 20px', zIndex:300, whiteSpace:'nowrap', boxShadow:'0 8px 24px rgba(255,184,0,0.3)' }}>
          <span style={{ fontFamily:'var(--font-display)', fontSize:12, color:'var(--text-inverse)', fontWeight:700 }}>{toast}</span>
        </div>
      )}

      {/* Header */}
      <div style={{ padding:'56px 20px 0', display:'flex', alignItems:'center', gap:12 }}>
        <button onClick={() => router.back()} style={{ background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer', fontSize:22, padding:0 }}>‹</button>
        <div style={{ flex:1 }}>
          <p style={{ fontFamily:'var(--font-display)', fontSize:10, letterSpacing:3, color:'rgba(255,184,0,0.53)', marginBottom:2 }}>SEASON 1 · THE FOUNDERS ERA</p>
          <h1 style={{ fontFamily:'var(--font-display)', fontSize:20, color:'var(--text-primary)', fontWeight:700 }}>BATTLE PASS</h1>
        </div>
        <div style={{ textAlign:'right' }}>
          <p style={{ fontSize:10, color:'var(--text-muted)', marginBottom:2 }}>{t('battlepass.endsIn')}</p>
          <p style={{ fontFamily:'var(--font-display)', fontSize:14, color:'var(--gold-primary)', fontWeight:700 }}>{getDaysLeft()}{t('battlepass.days')}</p>
        </div>
      </div>

      {/* XP Progress */}
      <div style={{ margin:'16px 16px 0', background:'var(--bg-surface)', borderRadius:14, border:'1px solid rgba(255,184,0,0.1)', padding:'14px 16px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
          <span style={{ fontFamily:'var(--font-display)', fontSize:11, letterSpacing:2, color:'var(--text-muted)' }}>
            TIER {currentTier}
          </span>
          <span style={{ fontFamily:'var(--font-display)', fontSize:11, color:'var(--gold-primary)' }}>
            {xpInTier} / 500 XP → Tier {currentTier + 1}
          </span>
        </div>
        <div style={{ height:6, background:'var(--bg-elevated)', borderRadius:3, overflow:'hidden' }}>
          <div style={{ height:'100%', width:`${xpProgress}%`, background:'linear-gradient(90deg,var(--gold-dim),var(--gold-primary))', borderRadius:3, transition:'width 0.6s ease' }} />
        </div>
        <p style={{ fontSize:11, color:'#444', marginTop:6 }}>
          {t('battlepass.totalSeasonXp')}: <span style={{ color:'rgba(255,184,0,0.53)' }}>{userBP?.season_xp || 0}</span>
        </p>
      </div>

      {/* Premium Banner */}
      {!userBP?.premium_unlocked && (
        <div style={{ margin:'12px 16px 0', background:'linear-gradient(135deg,rgba(255,184,0,0.06),rgba(255,229,102,0.03))', borderRadius:14, border:'1px solid rgba(255,184,0,0.15)', padding:'14px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
          <div>
            <p style={{ fontFamily:'var(--font-display)', fontSize:13, color:'var(--gold-primary)', marginBottom:4 }}>⭐ {t('battlepass.unlockPremiumTitle')}</p>
            <p style={{ fontSize:12, color:'var(--text-muted)', marginBottom:4 }}>{t('battlepass.exclusiveRewards')}</p>
            <p style={{ fontSize:16, color:'var(--gold-primary)', fontWeight:700 }}>€9,99</p>
          </div>
          <button
            onClick={() => router.push('/app/shop?section=premium')}
            style={{ flexShrink:0, padding:'12px 16px', borderRadius:10, border:'none', cursor:'pointer', background:'linear-gradient(135deg,var(--gold-dim),var(--gold-primary))', color:'var(--text-inverse)', fontFamily:'var(--font-display)', fontSize:10, fontWeight:700, letterSpacing:1 }}
          >{t('battlepass.unlock')}</button>
        </div>
      )}

      {/* Track Labels */}
      <div style={{ display:'flex', justifyContent:'center', gap:32, padding:'20px 16px 10px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <div style={{ width:8, height:8, borderRadius:'50%', background:'var(--status-active)' }} />
          <span style={{ fontFamily:'var(--font-display)', fontSize:9, color:'var(--text-muted)', letterSpacing:1 }}>FREE TRACK</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <div style={{ width:8, height:8, borderRadius:'50%', background:'var(--gold-primary)' }} />
          <span style={{ fontFamily:'var(--font-display)', fontSize:9, color: userBP?.premium_unlocked ? 'var(--gold-primary)' : '#444', letterSpacing:1 }}>⭐ PREMIUM TRACK</span>
        </div>
      </div>

      {/* ─── Horizontal Tier Slider ─── */}
      <div
        ref={sliderRef}
        style={{ display:'flex', gap:8, overflowX:'auto', padding:'8px 16px 16px', scrollbarWidth:'none', scrollSnapType:'x mandatory' }}
      >
        {tiers.map(tier => (
          <div key={tier} style={{ scrollSnapAlign:'start' }}>
            <TierCard tier={tier} />
          </div>
        ))}
        {/* End cap */}
        <div style={{ flexShrink:0, width:16 }} />
      </div>

      {/* Legend */}
      <div style={{ margin:'0 16px', display:'flex', gap:12, flexWrap:'wrap' }}>
        {[['✦ ' + t('battlepass.milestone'), 'var(--gold-primary)'], ['✅ ' + t('battlepass.legendClaimed'), 'var(--status-active)'], ['🔒 ' + t('battlepass.legendLocked'), '#444']].map(([label, color]) => (
          <div key={label} style={{ display:'flex', alignItems:'center', gap:4 }}>
            <span style={{ fontSize:10 }}>{(label as string).split(' ')[0]}</span>
            <span style={{ fontFamily:'var(--font-display)', fontSize:9, color: color as string }}>{(label as string).split(' ').slice(1).join(' ')}</span>
          </div>
        ))}
      </div>

      {/* Milestone Modal */}
      {milestoneModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.88)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:300, padding:'0 24px' }} onClick={() => setMilestoneModal(null)}>
          <div style={{ background:'var(--bg-surface)', borderRadius:20, border:'1.5px solid var(--gold-glow)', padding:'32px 24px', textAlign:'center', maxWidth:320, width:'100%' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontFamily:'var(--font-display)', fontSize:32, color:'var(--gold-primary)', marginBottom:8 }}>✦</div>
            <p style={{ fontFamily:'var(--font-display)', fontSize:18, color:'var(--gold-primary)', marginBottom:16, letterSpacing:2 }}>TIER {milestoneModal}</p>
            <p style={{ fontSize:15, color:'var(--text-primary)', fontStyle:'italic', lineHeight:1.6, marginBottom:24 }}>
              "{t(MILESTONE_LORE_KEYS[milestoneModal])}"
            </p>
            <button onClick={() => setMilestoneModal(null)}
              style={{ padding:'10px 24px', borderRadius:10, border:'1px solid #333', background:'transparent', color:'var(--text-muted)', fontFamily:'var(--font-display)', fontSize:11, cursor:'pointer' }}>
              {t('battlepass.close')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
