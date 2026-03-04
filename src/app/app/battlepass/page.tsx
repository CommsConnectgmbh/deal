'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
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

const REWARD_ICONS: Record<string, string> = {
  frame: '🖼️', badge: '🏅', card_skin: '🃏', coins: '🪙',
  title: '🏷️', avatar_item: '👤', xp: '⭐',
}
const REWARD_COLORS: Record<string, string> = {
  frame: '#60a5fa', badge: '#c084fc', card_skin: '#34d399',
  coins: '#FFB800', title: '#f97316', avatar_item: '#a78bfa', xp: '#FFB800',
}
const MILESTONE_TIERS = [5, 10, 15, 20, 25, 30]
const MILESTONE_LORE: Record<number, string> = {
  5:  'Dein erster Schritt zur Legende.',
  10: 'Die Rivalität wächst.',
  15: 'Respekt wird verdient, nicht geschenkt.',
  20: 'Auf dem Weg zur Unsterblichkeit.',
  25: 'Fast am Gipfel. Gib nicht auf.',
  30: 'LEGENDE. Du hast Season 1 gemeistert.',
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

  const [rewards, setRewards]   = useState<BPReward[]>([])
  const [userBP,  setUserBP]    = useState<UserBP | null>(null)
  const [claiming, setClaiming] = useState<string | null>(null)
  const [toast,   setToast]     = useState<string | null>(null)
  const [milestoneModal, setMilestoneModal] = useState<number | null>(null)
  const [claimAnim, setClaimAnim] = useState<string | null>(null)
  const sliderRef  = useRef<HTMLDivElement>(null)
  const SEASON_ID  = 1

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
      setUserBP(prev => prev ? { ...prev, claimed_rewards: newClaimed } : prev)
      setClaimAnim(key)
      setTimeout(() => setClaimAnim(null), 800)
      const label = reward.reward_type === 'coins'
        ? `🪙 +${reward.reward_amount} Coins erhalten!`
        : `🎁 ${reward.reward_value?.replace(/_/g,' ')} freigeschaltet!`
      setToast(label)
      setTimeout(() => setToast(null), 3000)
      await refreshProfile()
    } catch (e) { console.error(e) }
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
          fontSize: isMile ? 11 : 9, fontFamily:'Cinzel,serif', fontWeight:700,
          color: isMile ? '#FFB800' : isPast ? '#4ade80' : isCurr ? '#FFB800' : '#444',
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
      return <div style={{ width: isMile ? 104 : 84, height: isMile ? 120 : 100, borderRadius:10, background:'#0A0A0A', border:'1px solid #1a1a1a', opacity:0.3 }} />
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
          border: isCurr && !isPremium ? `2px solid #FFB800` :
                  claimed             ? `1.5px solid #4ade8055` :
                  earned              ? `1.5px solid ${rColor}55` :
                  isPremium && !userBP?.premium_unlocked ? `1px dashed #33333380` :
                                        `1px solid #1a1a1a`,
          background: isMile && earned && !claimed ? `${rColor}12` :
                      claimed          ? `rgba(74,222,128,0.06)` :
                      earned           ? `${rColor}08` :
                                         `#0D0D0D`,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: 6, cursor: earned && !claimed ? 'pointer' : 'default',
          position: 'relative', overflow: 'hidden',
          boxShadow: isCurr && !isPremium ? `0 0 16px #FFB80044` :
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
            border:'2px solid #FFB800',
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
          color: claimed ? '#4ade80' : earned ? rColor : '#444',
          fontFamily: 'Cinzel,serif',
        }}>
          {reward.reward_type === 'coins'
            ? `${reward.reward_amount}🪙`
            : (reward.reward_value || reward.reward_type).replace(/_/g,' ').slice(0,12)}
        </span>

        {/* Claim button for earned */}
        {earned && !claimed && (
          <div style={{
            background: isPremium && !userBP?.premium_unlocked ? 'transparent' :
                        `linear-gradient(135deg, #CC8800, #FFB800)`,
            borderRadius:6, padding:'2px 8px',
            fontSize:8, fontWeight:700, color:'#000', fontFamily:'Cinzel,serif',
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
    <div style={{ minHeight:'100dvh', background:'#060606', color:'#F0ECE4', paddingBottom:40 }}>
      {/* CSS Animations */}
      <style>{`
        @keyframes pulse { 0%,100%{opacity:0.4} 50%{opacity:0.9} }
        @keyframes claimPop { 0%{transform:scale(1)} 50%{transform:scale(1.08)} 100%{transform:scale(1)} }
      `}</style>

      {/* Toast */}
      {toast && (
        <div style={{ position:'fixed', top:80, left:'50%', transform:'translateX(-50%)', background:'linear-gradient(135deg,#CC8800,#FFB800)', borderRadius:12, padding:'10px 20px', zIndex:300, whiteSpace:'nowrap', boxShadow:'0 8px 24px rgba(255,184,0,0.3)' }}>
          <span style={{ fontFamily:'Cinzel,serif', fontSize:12, color:'#000', fontWeight:700 }}>{toast}</span>
        </div>
      )}

      {/* Header */}
      <div style={{ padding:'56px 20px 0', display:'flex', alignItems:'center', gap:12 }}>
        <button onClick={() => router.back()} style={{ background:'none', border:'none', color:'#666', cursor:'pointer', fontSize:22, padding:0 }}>‹</button>
        <div style={{ flex:1 }}>
          <p style={{ fontFamily:'Cinzel,serif', fontSize:10, letterSpacing:3, color:'#FFB80088', marginBottom:2 }}>SEASON 1 · THE FOUNDERS ERA</p>
          <h1 style={{ fontFamily:'Cinzel,serif', fontSize:20, color:'#F0ECE4', fontWeight:700 }}>BATTLE PASS</h1>
        </div>
        <div style={{ textAlign:'right' }}>
          <p style={{ fontSize:10, color:'#555', marginBottom:2 }}>Endet in</p>
          <p style={{ fontFamily:'Cinzel,serif', fontSize:14, color:'#FFB800', fontWeight:700 }}>{getDaysLeft()}T</p>
        </div>
      </div>

      {/* XP Progress */}
      <div style={{ margin:'16px 16px 0', background:'#111', borderRadius:14, border:'1px solid rgba(255,184,0,0.1)', padding:'14px 16px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
          <span style={{ fontFamily:'Cinzel,serif', fontSize:11, letterSpacing:2, color:'#888' }}>
            TIER {currentTier}
          </span>
          <span style={{ fontFamily:'Cinzel,serif', fontSize:11, color:'#FFB800' }}>
            {xpInTier} / 500 XP → Tier {currentTier + 1}
          </span>
        </div>
        <div style={{ height:6, background:'#1a1a1a', borderRadius:3, overflow:'hidden' }}>
          <div style={{ height:'100%', width:`${xpProgress}%`, background:'linear-gradient(90deg,#CC8800,#FFB800)', borderRadius:3, transition:'width 0.6s ease' }} />
        </div>
        <p style={{ fontSize:11, color:'#444', marginTop:6 }}>
          Gesamt-Saison-XP: <span style={{ color:'#FFB80088' }}>{userBP?.season_xp || 0}</span>
        </p>
      </div>

      {/* Premium Banner */}
      {!userBP?.premium_unlocked && (
        <div style={{ margin:'12px 16px 0', background:'linear-gradient(135deg,rgba(255,184,0,0.06),rgba(255,229,102,0.03))', borderRadius:14, border:'1px solid rgba(255,184,0,0.15)', padding:'14px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
          <div>
            <p style={{ fontFamily:'Cinzel,serif', fontSize:13, color:'#FFB800', marginBottom:4 }}>⭐ PREMIUM FREISCHALTEN</p>
            <p style={{ fontSize:12, color:'#555', marginBottom:4 }}>Exklusive Rewards auf allen 30 Tiers</p>
            <p style={{ fontSize:16, color:'#FFB800', fontWeight:700 }}>€9,99</p>
          </div>
          <button
            onClick={() => router.push('/app/shop?section=premium')}
            style={{ flexShrink:0, padding:'12px 16px', borderRadius:10, border:'none', cursor:'pointer', background:'linear-gradient(135deg,#CC8800,#FFB800)', color:'#000', fontFamily:'Cinzel,serif', fontSize:10, fontWeight:700, letterSpacing:1 }}
          >FREISCHALTEN</button>
        </div>
      )}

      {/* Track Labels */}
      <div style={{ display:'flex', justifyContent:'center', gap:32, padding:'20px 16px 10px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <div style={{ width:8, height:8, borderRadius:'50%', background:'#4ade80' }} />
          <span style={{ fontFamily:'Cinzel,serif', fontSize:9, color:'#666', letterSpacing:1 }}>FREE TRACK</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <div style={{ width:8, height:8, borderRadius:'50%', background:'#FFB800' }} />
          <span style={{ fontFamily:'Cinzel,serif', fontSize:9, color: userBP?.premium_unlocked ? '#FFB800' : '#444', letterSpacing:1 }}>⭐ PREMIUM TRACK</span>
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
        {[['✦ Milestone', '#FFB800'], ['✅ Geclaimt', '#4ade80'], ['🔒 Gesperrt', '#444']].map(([label, color]) => (
          <div key={label} style={{ display:'flex', alignItems:'center', gap:4 }}>
            <span style={{ fontSize:10 }}>{(label as string).split(' ')[0]}</span>
            <span style={{ fontFamily:'Cinzel,serif', fontSize:9, color: color as string }}>{(label as string).split(' ').slice(1).join(' ')}</span>
          </div>
        ))}
      </div>

      {/* Milestone Modal */}
      {milestoneModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.88)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:300, padding:'0 24px' }} onClick={() => setMilestoneModal(null)}>
          <div style={{ background:'#111', borderRadius:20, border:'1.5px solid rgba(255,184,0,0.3)', padding:'32px 24px', textAlign:'center', maxWidth:320, width:'100%' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontFamily:'Cinzel,serif', fontSize:32, color:'#FFB800', marginBottom:8 }}>✦</div>
            <p style={{ fontFamily:'Cinzel,serif', fontSize:18, color:'#FFB800', marginBottom:16, letterSpacing:2 }}>TIER {milestoneModal}</p>
            <p style={{ fontSize:15, color:'#F0ECE4', fontStyle:'italic', lineHeight:1.6, marginBottom:24 }}>
              "{MILESTONE_LORE[milestoneModal]}"
            </p>
            <button onClick={() => setMilestoneModal(null)}
              style={{ padding:'10px 24px', borderRadius:10, border:'1px solid #333', background:'transparent', color:'#888', fontFamily:'Cinzel,serif', fontSize:11, cursor:'pointer' }}>
              SCHLIESSEN
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
