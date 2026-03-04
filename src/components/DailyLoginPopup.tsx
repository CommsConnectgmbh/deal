'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

interface DailyReward {
  id: string
  day_number: number
  reward_type: string
  reward_amount: number | null
  reward_ref: string | null
  name: string
  rarity: string
}

interface UserLogin {
  current_day: number
  last_login_date: string | null
  total_logins: number
}

const RARITY_COLORS: Record<string, string> = {
  common:'#9CA3AF', rare:'#3B82F6', epic:'#8B5CF6', legendary:'#F59E0B',
}

export default function DailyLoginPopup({ onClose }: { onClose: () => void }) {
  const { profile, refreshProfile } = useAuth()
  const [rewards,   setRewards]   = useState<DailyReward[]>([])
  const [userLogin, setUserLogin] = useState<UserLogin | null>(null)
  const [claiming,  setClaiming]  = useState(false)
  const [claimed,   setClaimed]   = useState(false)
  const [showAnim,  setShowAnim]  = useState(false)

  useEffect(() => {
    if (profile) fetchData()
  }, [profile])

  const fetchData = async () => {
    const [rwRes, ulRes] = await Promise.all([
      supabase.from('daily_login_rewards').select('*').order('day_number'),
      supabase.from('user_daily_login').select('*').eq('user_id', profile!.id).single(),
    ])
    setRewards(rwRes.data || [])
    if (ulRes.data) setUserLogin(ulRes.data)
  }

  const today = new Date().toISOString().split('T')[0]
  const alreadyClaimed = userLogin?.last_login_date === today
  const currentDay = userLogin?.current_day || 1
  const todayReward = rewards.find(r => r.day_number === currentDay)

  const claimLogin = async () => {
    if (!profile || claiming || alreadyClaimed) return
    setClaiming(true)
    try {
      const lastDate = userLogin?.last_login_date
      const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1)
      const yesterdayStr = yesterday.toISOString().split('T')[0]
      const isConsecutive = lastDate === yesterdayStr
      const nextDay = isConsecutive ? Math.min(7, (userLogin?.current_day || 1) + 1) : 1
      const reward = rewards.find(r => r.day_number === currentDay)

      // Grant reward
      if (reward?.reward_type === 'coins' && reward.reward_amount) {
        await supabase.from('wallet_ledger').insert({
          user_id: profile.id, delta: reward.reward_amount,
          reason: 'level_up', reference_id: `daily_${today}`,
        })
        await supabase.from('profiles')
          .update({ coins: (profile.coins || 0) + reward.reward_amount }).eq('id', profile.id)
      } else if (reward?.reward_ref) {
        await supabase.from('user_inventory').upsert({
          user_id: profile.id, cosmetic_id: reward.reward_ref, source: 'earned',
        }, { onConflict: 'user_id,cosmetic_id' })
      }

      // Update login record
      await supabase.from('user_daily_login').upsert({
        user_id: profile.id,
        current_day: nextDay > 7 ? 1 : (isConsecutive ? Math.min(7, currentDay) : 1),
        last_login_date: today,
        total_logins: (userLogin?.total_logins || 0) + 1,
      }, { onConflict: 'user_id' })

      await refreshProfile()
      setShowAnim(true)
      setTimeout(() => { setClaimed(true); setShowAnim(false) }, 1000)
    } catch (e) { console.error(e) }
    setClaiming(false)
  }

  if (!todayReward && !claiming) return null

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.88)', display:'flex', alignItems:'flex-end', justifyContent:'center', zIndex:500, padding:'0 0 0 0' }}>
      <div style={{ width:'100%', maxWidth:480, background:'#0D0D18', borderRadius:'24px 24px 0 0', border:'1px solid rgba(255,184,0,0.2)', padding:'24px 24px 48px' }}>

        {/* Drag handle */}
        <div style={{ display:'flex', justifyContent:'center', marginBottom:20 }}>
          <div style={{ width:36, height:4, borderRadius:2, background:'#333' }} />
        </div>

        {/* Title */}
        <div style={{ textAlign:'center', marginBottom:20 }}>
          <p style={{ fontFamily:'Cinzel,serif', fontSize:10, letterSpacing:3, color:'#FFB80088', marginBottom:4 }}>TÄGLICHER LOGIN</p>
          <h2 style={{ fontFamily:'Cinzel,serif', fontSize:20, color:'#F0ECE4', fontWeight:700 }}>
            {alreadyClaimed || claimed ? '✅ Schon abgeholt!' : `Tag ${currentDay} von 7`}
          </h2>
          <p style={{ fontSize:13, color:'#555', marginTop:4 }}>
            {(userLogin?.total_logins || 0)} Tage in Folge eingeloggt
          </p>
        </div>

        {/* 7-Day Calendar */}
        <div style={{ display:'flex', gap:6, justifyContent:'center', marginBottom:24 }}>
          {rewards.map(r => {
            const isPast    = r.day_number < currentDay
            const isCurrent = r.day_number === currentDay
            const isFuture  = r.day_number > currentDay
            const rc = RARITY_COLORS[r.rarity] || '#9CA3AF'

            return (
              <div key={r.day_number} style={{
                flex:1, borderRadius:10,
                border: isCurrent ? `2px solid ${rc}` : isPast ? '1px solid #4ade8033' : '1px solid #1a1a1a',
                background: isCurrent ? `${rc}15` : isPast ? '#0D0D18' : '#0A0A0A',
                padding:'8px 4px', textAlign:'center',
                boxShadow: isCurrent ? `0 0 12px ${rc}33` : 'none',
                animation: isCurrent && !claimed && !alreadyClaimed ? 'pulse 1.5s ease-in-out infinite' : 'none',
              }}>
                <p style={{ fontSize:8, fontFamily:'Cinzel,serif', color: isCurrent ? rc : isPast ? '#4ade80' : '#444', marginBottom:4 }}>T{r.day_number}</p>
                <p style={{ fontSize:14 }}>{isPast ? '✅' : isCurrent ? (r.reward_type === 'coins' ? '🪙' : '🎁') : '🔒'}</p>
                <p style={{ fontSize:8, color: isCurrent ? rc : '#444', marginTop:4 }}>
                  {r.reward_type === 'coins' ? `${r.reward_amount}` : '🎁'}
                </p>
              </div>
            )
          })}
        </div>

        {/* Today's Reward */}
        {todayReward && (
          <div style={{ background:'#111', borderRadius:14, border:'1px solid rgba(255,184,0,0.15)', padding:'16px', marginBottom:20, textAlign:'center' }}>
            <p style={{ fontSize:11, color:'#555', marginBottom:8, fontFamily:'Cinzel,serif', letterSpacing:1 }}>HEUTE'S REWARD</p>
            <p style={{ fontSize:28, marginBottom:8 }}>
              {showAnim ? '✨' : todayReward.reward_type === 'coins' ? '🪙' : '🎁'}
            </p>
            <p style={{ fontFamily:'Cinzel,serif', fontSize:16, color:'#FFB800', fontWeight:700 }}>
              {todayReward.reward_type === 'coins' ? `+${todayReward.reward_amount} Coins` : todayReward.name}
            </p>
          </div>
        )}

        {/* CTA */}
        {!alreadyClaimed && !claimed ? (
          <button onClick={claimLogin} disabled={claiming}
            style={{ width:'100%', padding:18, borderRadius:14, border:'none', cursor:'pointer', background:'linear-gradient(135deg,#CC8800,#FFB800)', color:'#000', fontFamily:'Cinzel,serif', fontSize:14, fontWeight:700, letterSpacing:2 }}>
            {claiming ? '...' : '🎁 ABHOLEN'}
          </button>
        ) : (
          <button onClick={onClose}
            style={{ width:'100%', padding:18, borderRadius:14, border:'1px solid #222', cursor:'pointer', background:'transparent', color:'#888', fontFamily:'Cinzel,serif', fontSize:13, letterSpacing:2 }}>
            ✅ SCHLIESSEN
          </button>
        )}

        <style>{`@keyframes pulse { 0%,100%{opacity:0.6} 50%{opacity:1} }`}</style>
      </div>
    </div>
  )
}
