'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useLang } from '@/contexts/LanguageContext'
import { supabase } from '@/lib/supabase'

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

const RARITY_COLORS: Record<string, string> = {
  frame: '#60a5fa',
  badge: '#c084fc',
  card_skin: '#34d399',
  coins: '#FFB800',
  title: '#f97316'
}

const REWARD_ICONS: Record<string, string> = {
  frame: '🖼️',
  badge: '🏅',
  card_skin: '🃏',
  coins: '🪙',
  title: '🏷️'
}

function xpForTier(tier: number): number {
  // Each tier requires 500 XP
  return tier * 500
}

export default function BattlePassPage() {
  const { profile, refreshProfile } = useAuth()
  const { t, lang } = useLang()
  const router = useRouter()
  const [rewards, setRewards] = useState<BPReward[]>([])
  const [userBP, setUserBP] = useState<UserBP | null>(null)
  const [claiming, setClaiming] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const SEASON_ID = 1

  useEffect(() => {
    if (profile) {
      fetchRewards()
      fetchUserBP()
    }
  }, [profile])

  const fetchRewards = async () => {
    const { data } = await supabase
      .from('battle_pass_rewards')
      .select('*')
      .eq('season_id', SEASON_ID)
      .order('level', { ascending: true })
    setRewards(data || [])
  }

  const fetchUserBP = async () => {
    const { data } = await supabase
      .from('user_battlepass')
      .select('*')
      .eq('user_id', profile!.id)
      .eq('season_id', SEASON_ID)
      .single()
    if (data) {
      setUserBP({
        ...data,
        claimed_rewards: data.claimed_rewards || []
      })
    } else {
      // Create record if not exists
      const { data: newBP } = await supabase
        .from('user_battlepass')
        .upsert({ user_id: profile!.id, season_id: SEASON_ID }, { onConflict: 'user_id,season_id' })
        .select()
        .single()
      if (newBP) setUserBP({ ...newBP, claimed_rewards: [] })
    }
  }

  const currentTier = userBP ? Math.floor((userBP.season_xp || 0) / 500) : 0
  const currentXP = userBP?.season_xp || 0
  const xpInTier = currentXP % 500
  const xpProgress = (xpInTier / 500) * 100

  const rewardKey = (r: BPReward) => `${r.level}_${r.track}`

  const isClaimed = (r: BPReward) => (userBP?.claimed_rewards || []).includes(rewardKey(r))
  const isEarned = (r: BPReward) => {
    if (r.track === 'premium' && !userBP?.premium_unlocked) return false
    return currentTier >= r.level
  }

  const claimReward = async (reward: BPReward) => {
    const key = rewardKey(reward)
    if (isClaimed(reward) || !isEarned(reward)) return
    setClaiming(key)
    try {
      // Add to inventory or credit coins
      if (reward.reward_type === 'coins' && reward.reward_amount) {
        await supabase.from('wallet_ledger').insert({
          user_id: profile!.id,
          delta: reward.reward_amount,
          reason: 'battlepass_reward',
          reference_id: key
        })
        await supabase.from('profiles')
          .update({ coins: (profile?.coins || 0) + reward.reward_amount })
          .eq('id', profile!.id)
      } else if (reward.reward_value) {
        // Add to user inventory
        await supabase.from('user_inventory').upsert({
          user_id: profile!.id,
          cosmetic_id: reward.reward_value,
          source: 'battlepass'
        }, { onConflict: 'user_id,cosmetic_id' })
      }

      // Mark as claimed
      const newClaimed = [...(userBP?.claimed_rewards || []), key]
      await supabase.from('user_battlepass')
        .update({ claimed_rewards: newClaimed })
        .eq('user_id', profile!.id)
        .eq('season_id', SEASON_ID)

      setUserBP(prev => prev ? { ...prev, claimed_rewards: newClaimed } : prev)

      const label = reward.reward_type === 'coins'
        ? `+${reward.reward_amount} ${t('battlepass.coinsAdded')}`
        : t(`battlepass.${reward.reward_type}Unlocked`)
      setToast(label)
      setTimeout(() => setToast(null), 3000)
      await refreshProfile()
    } catch (e) {
      console.error('claim error', e)
    }
    setClaiming(null)
  }

  const buyPremium = async () => {
    // Redirect to shop for Stripe purchase
    router.push('/app/shop?section=premium')
  }

  // Group rewards by tier
  const tiers = Array.from({ length: 30 }, (_, i) => i + 1)

  return (
    <div style={{ minHeight:'100dvh', background:'#060606', paddingTop:60, paddingBottom:40 }}>
      {/* Toast */}
      {toast && (
        <div style={{ position:'fixed', top:80, left:'50%', transform:'translateX(-50%)', background:'linear-gradient(135deg, #CC8800, #FFB800)', borderRadius:12, padding:'10px 20px', zIndex:300, whiteSpace:'nowrap', boxShadow:'0 8px 24px rgba(255,184,0,0.3)' }}>
          <span style={{ fontFamily:'Cinzel, serif', fontSize:12, color:'#000', fontWeight:700 }}>🎁 {toast}</span>
        </div>
      )}

      {/* Header */}
      <div style={{ padding:'0 20px 16px', display:'flex', alignItems:'center', gap:12 }}>
        <button onClick={() => router.back()} style={{ background:'none', border:'none', color:'rgba(240,236,228,0.5)', cursor:'pointer', fontSize:20, padding:0 }}>←</button>
        <div>
          <h1 className='font-display' style={{ fontSize:20, color:'#f0ece4' }}>{t('battlepass.title')}</h1>
          <p style={{ fontSize:12, color:'rgba(240,236,228,0.4)' }}>{t('battlepass.season')} · {t('battlepass.seasonName')}</p>
        </div>
      </div>

      {/* XP Progress */}
      <div style={{ margin:'0 16px 16px', background:'#111', borderRadius:14, border:'1px solid rgba(255,184,0,0.1)', padding:16 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
          <span className='font-display' style={{ fontSize:11, letterSpacing:2, color:'rgba(240,236,228,0.5)' }}>
            {t('battlepass.tier')} {currentTier}
          </span>
          <span className='font-display' style={{ fontSize:11, letterSpacing:1, color:'#FFB800' }}>
            {xpInTier} / 500 XP
          </span>
        </div>
        <div style={{ height:6, background:'rgba(255,255,255,0.08)', borderRadius:3, overflow:'hidden' }}>
          <div style={{ height:'100%', width:`${xpProgress}%`, background:'linear-gradient(90deg, #CC8800, #FFB800)', borderRadius:3, transition:'width 0.5s ease' }}/>
        </div>
        <p style={{ fontSize:12, color:'rgba(240,236,228,0.3)', marginTop:6, textAlign:'right' }}>
          {t('battlepass.xpToNext')} {currentTier + 1}: {500 - xpInTier} XP
        </p>
      </div>

      {/* Premium Banner */}
      {!userBP?.premium_unlocked && (
        <div style={{ margin:'0 16px 16px', background:'linear-gradient(135deg, rgba(255,184,0,0.08), rgba(255,229,102,0.05))', borderRadius:14, border:'1px solid rgba(255,184,0,0.2)', padding:16, display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
          <div>
            <p className='font-display' style={{ fontSize:13, color:'#FFB800', marginBottom:4 }}>⭐ {t('battlepass.premiumBanner')}</p>
            <p style={{ fontSize:12, color:'rgba(240,236,228,0.5)' }}>{t('battlepass.premiumBannerText')}</p>
            <p style={{ fontSize:16, color:'#FFB800', fontWeight:700, marginTop:4 }}>{t('battlepass.premiumPrice')}</p>
          </div>
          <button
            onClick={buyPremium}
            style={{ flexShrink:0, padding:'12px 16px', borderRadius:10, border:'none', cursor:'pointer', background:'linear-gradient(135deg, #CC8800, #FFB800)', color:'#000', fontFamily:'Cinzel, serif', fontSize:10, fontWeight:700, letterSpacing:1 }}
          >
            {t('battlepass.getPremium').toUpperCase()}
          </button>
        </div>
      )}

      {/* Track Header */}
      <div style={{ display:'flex', padding:'0 16px', marginBottom:8, gap:8 }}>
        <div style={{ flex:1, textAlign:'center', fontFamily:'Cinzel, serif', fontSize:9, letterSpacing:2, color:'rgba(240,236,228,0.5)', padding:'6px', borderBottom:'2px solid rgba(255,255,255,0.1)' }}>
          {t('battlepass.freeTrack').toUpperCase()}
        </div>
        <div style={{ width:40, textAlign:'center', fontFamily:'Cinzel, serif', fontSize:9, letterSpacing:1, color:'rgba(240,236,228,0.3)', padding:'6px' }}>#</div>
        <div style={{ flex:1, textAlign:'center', fontFamily:'Cinzel, serif', fontSize:9, letterSpacing:2, color: userBP?.premium_unlocked ? '#FFB800' : 'rgba(240,236,228,0.3)', padding:'6px', borderBottom:`2px solid ${userBP?.premium_unlocked ? 'rgba(255,184,0,0.4)' : 'rgba(255,255,255,0.06)'}` }}>
          ⭐ {t('battlepass.premiumTrack').toUpperCase()}
        </div>
      </div>

      {/* Tiers */}
      {tiers.map(tier => {
        const freeReward = rewards.find(r => r.level === tier && r.track === 'free')
        const premReward = rewards.find(r => r.level === tier && r.track === 'premium')
        const isMilestone = [5, 10, 15, 20, 25, 30].includes(tier)

        const RewardCell = ({ reward, isPremium }: { reward?: BPReward; isPremium?: boolean }) => {
          if (!reward) return <div style={{ flex:1 }}/>
          const earned = isEarned(reward)
          const claimed = isClaimed(reward)
          const key = rewardKey(reward)
          const color = earned ? (RARITY_COLORS[reward.reward_type] || '#f0ece4') : 'rgba(240,236,228,0.2)'

          return (
            <button
              onClick={() => earned && !claimed && claimReward(reward)}
              disabled={!earned || claimed || claiming === key}
              style={{
                flex:1, padding:'10px 8px', borderRadius:10, cursor: earned && !claimed ? 'pointer' : 'default',
                background: claimed ? 'rgba(74,222,128,0.08)' : earned ? `${color}12` : 'rgba(255,255,255,0.03)',
                border: `1px solid ${claimed ? 'rgba(74,222,128,0.2)' : earned ? `${color}30` : 'rgba(255,255,255,0.05)'}`,
                textAlign:'center', position:'relative'
              }}
            >
              <div style={{ fontSize:18, marginBottom:3, filter: earned ? 'none' : 'grayscale(1) opacity(0.3)' }}>
                {REWARD_ICONS[reward.reward_type] || '🎁'}
              </div>
              <p style={{ fontSize:9, color: claimed ? '#4ade80' : earned ? color : 'rgba(240,236,228,0.3)', fontFamily:'Cinzel, serif', letterSpacing:0.5 }}>
                {claimed ? '✓' : !earned ? '🔒' : reward.reward_type === 'coins' ? `${reward.reward_amount}` : reward.reward_value ? reward.reward_value.replace(/_/g,' ').slice(0,10) : reward.reward_type}
              </p>
              {claiming === key && (
                <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.5)', borderRadius:10 }}>
                  <div style={{ width:16, height:16, border:'2px solid transparent', borderTopColor:'#FFB800', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>
                </div>
              )}
            </button>
          )
        }

        return (
          <div
            key={tier}
            style={{
              display:'flex', alignItems:'stretch', gap:8, padding:'4px 16px',
              background: isMilestone ? 'rgba(255,184,0,0.02)' : 'transparent',
              borderTop: isMilestone ? '1px solid rgba(255,184,0,0.08)' : 'none',
              borderBottom: isMilestone ? '1px solid rgba(255,184,0,0.08)' : 'none'
            }}
          >
            <RewardCell reward={freeReward} />
            <div style={{
              width:40, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
              flexDirection:'column', gap:2
            }}>
              <span className='font-display' style={{
                fontSize: isMilestone ? 12 : 10, color: currentTier >= tier ? '#FFB800' : 'rgba(240,236,228,0.25)',
                fontWeight: isMilestone ? 700 : 400
              }}>
                {tier}
              </span>
              {isMilestone && <span style={{ fontSize:8, color:'rgba(255,184,0,0.5)' }}>★</span>}
            </div>
            <RewardCell reward={premReward} isPremium />
          </div>
        )
      })}

      <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
    </div>
  )
}
