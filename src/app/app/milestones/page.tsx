'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

interface Milestone {
  id: string
  level_required: number
  reward_type: string
  reward_ref: string | null
  reward_amount: number | null
  name: string
  description: string
  rarity: 'common' | 'rare' | 'epic' | 'legendary'
}
interface UserMilestone {
  milestone_id: string
  claimed: boolean
  claimed_at: string | null
}

const RARITY_COLORS = { common:'#9CA3AF', rare:'#3B82F6', epic:'#8B5CF6', legendary:'#F59E0B' }
const REWARD_ICONS: Record<string, string> = { coins:'🪙', cosmetic:'🎁', avatar_item:'👤' }

export default function MilestonesPage() {
  const { profile, refreshProfile } = useAuth()
  const router = useRouter()
  const [milestones, setMilestones]   = useState<Milestone[]>([])
  const [userMiles,  setUserMiles]    = useState<UserMilestone[]>([])
  const [claiming,   setClaiming]     = useState<string | null>(null)
  const [toast,      setToast]        = useState<string | null>(null)

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000) }

  useEffect(() => { if (profile) fetchData() }, [profile])

  const fetchData = async () => {
    const [mRes, uRes] = await Promise.all([
      supabase.from('milestone_rewards').select('*').order('level_required'),
      supabase.from('user_milestones').select('*').eq('user_id', profile!.id),
    ])
    setMilestones(mRes.data || [])
    setUserMiles(uRes.data || [])
  }

  const getUserMilestone = (id: string) => userMiles.find(u => u.milestone_id === id)

  const claim = async (m: Milestone) => {
    if (!profile || claiming) return
    setClaiming(m.id)
    try {
      if (m.reward_type === 'coins' && m.reward_amount) {
        await supabase.from('wallet_ledger').insert({
          user_id: profile.id, delta: m.reward_amount,
          reason: 'level_up', reference_id: m.id,
        })
        await supabase.from('profiles').update({ coins: (profile.coins||0) + m.reward_amount }).eq('id', profile.id)
      } else if (m.reward_ref) {
        await supabase.from('user_inventory').upsert({
          user_id: profile.id, cosmetic_id: m.reward_ref, source: 'earned',
        }, { onConflict: 'user_id,cosmetic_id' })
      }
      await supabase.from('user_milestones').upsert({
        user_id: profile.id, milestone_id: m.id,
        claimed: true, claimed_at: new Date().toISOString(),
      }, { onConflict: 'user_id,milestone_id' })
      await supabase.from('notifications').insert({
        user_id: profile.id, type: 'milestone',
        title: `🎯 Meilenstein erreicht!`,
        body: `Du hast "${m.name}" erhalten.`,
      }).then(() => {})
      setUserMiles(prev => {
        const ex = prev.find(u => u.milestone_id === m.id)
        if (ex) return prev.map(u => u.milestone_id === m.id ? { ...u, claimed:true, claimed_at: new Date().toISOString() } : u)
        return [...prev, { milestone_id: m.id, claimed:true, claimed_at: new Date().toISOString() }]
      })
      showToast(`✅ ${m.name} erhalten!`)
      refreshProfile()
    } catch (e) { showToast('❌ Fehler') }
    setClaiming(null)
  }

  const level    = profile?.level || 1
  const claimed  = userMiles.filter(u => u.claimed).length
  const total    = milestones.length

  return (
    <div style={{ minHeight:'100dvh', background:'#060606', color:'#F0ECE4', paddingBottom:100 }}>
      {toast && (
        <div style={{ position:'fixed', top:80, left:'50%', transform:'translateX(-50%)', background:'linear-gradient(135deg,#CC8800,#FFB800)', borderRadius:12, padding:'10px 20px', zIndex:300, whiteSpace:'nowrap', fontFamily:'Cinzel,serif', fontWeight:700, color:'#000', fontSize:12 }}>{toast}</div>
      )}

      {/* Header */}
      <div style={{ padding:'56px 20px 16px', display:'flex', alignItems:'center', gap:12 }}>
        <button onClick={() => router.back()} style={{ background:'none', border:'none', color:'#666', cursor:'pointer', fontSize:22 }}>‹</button>
        <div style={{ flex:1 }}>
          <h1 style={{ fontFamily:'Cinzel,serif', fontSize:20, color:'#F0ECE4', fontWeight:700 }}>MEILENSTEINE</h1>
          <p style={{ fontSize:12, color:'#555', marginTop:2 }}>{claimed}/{total} abgeschlossen</p>
        </div>
      </div>

      {/* Level progress to next milestone */}
      {(() => {
        const nextM = milestones.find(m => m.level_required > level)
        if (!nextM) return null
        const pct = Math.min(100, ((level - (milestones.find(m => m.level_required < nextM.level_required && m.level_required <= level)?.level_required || 0)) / (nextM.level_required - (milestones.find(m => m.level_required < nextM.level_required && m.level_required <= level)?.level_required || 0))) * 100)
        return (
          <div style={{ margin:'0 16px 16px', background:'#111', borderRadius:14, border:'1px solid #1a1a1a', padding:'14px 16px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
              <span style={{ fontSize:12, color:'#888' }}>Nächster Meilenstein</span>
              <span style={{ fontFamily:'Cinzel,serif', fontSize:12, color:'#FFB800' }}>Level {nextM.level_required}</span>
            </div>
            <div style={{ height:4, background:'#1a1a1a', borderRadius:2, overflow:'hidden', marginBottom:6 }}>
              <div style={{ height:'100%', width:`${Math.max(5, (level/nextM.level_required)*100)}%`, background:'linear-gradient(90deg,#CC8800,#FFB800)', borderRadius:2 }} />
            </div>
            <p style={{ fontSize:11, color:'#555' }}>Du bist Level <span style={{ color:'#FFB800' }}>{level}</span> → Ziel: Level {nextM.level_required}</p>
          </div>
        )
      })()}

      {/* Milestones List */}
      <div style={{ padding:'0 16px', display:'flex', flexDirection:'column', gap:10 }}>
        {milestones.map(m => {
          const um      = getUserMilestone(m.id)
          const rc      = RARITY_COLORS[m.rarity]
          const reached = level >= m.level_required
          const claimed = um?.claimed || false
          const isCurr  = reached && !claimed

          return (
            <div key={m.id} style={{
              background: isCurr ? `${rc}0A` : '#111',
              borderRadius:14, border: isCurr ? `1.5px solid ${rc}55` : claimed ? '1px solid #4ade8022' : '1px solid #1a1a1a',
              padding:'16px',
              opacity: !reached && !claimed ? 0.6 : 1,
              boxShadow: isCurr ? `0 0 12px ${rc}22` : 'none',
            }}>
              <div style={{ display:'flex', alignItems:'center', gap:14 }}>
                {/* Level badge */}
                <div style={{
                  width:48, height:48, borderRadius:12, flexShrink:0,
                  background: reached ? `${rc}18` : '#0A0A0A',
                  border: `1.5px solid ${reached ? rc : '#222'}`,
                  display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:2,
                }}>
                  <span style={{ fontSize:8, color:rc, fontFamily:'Cinzel,serif', letterSpacing:0.5 }}>LVL</span>
                  <span style={{ fontFamily:'Cinzel,serif', fontSize:14, color:rc, fontWeight:700, lineHeight:1 }}>{m.level_required}</span>
                </div>

                {/* Info */}
                <div style={{ flex:1 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                    <span style={{ fontFamily:'Cinzel,serif', fontSize:13, color:'#F0ECE4', fontWeight:700 }}>{m.name}</span>
                    <span style={{ fontSize:9, color:rc, fontFamily:'Cinzel,serif', letterSpacing:1, padding:'1px 6px', background:`${rc}15`, borderRadius:4 }}>{m.rarity.toUpperCase()}</span>
                  </div>
                  <p style={{ fontSize:12, color:'#666', marginBottom:6, lineHeight:1.3 }}>{m.description}</p>
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <span style={{ fontSize:14 }}>{REWARD_ICONS[m.reward_type]}</span>
                    <span style={{ fontSize:12, color:'#888' }}>
                      {m.reward_type === 'coins' ? `${m.reward_amount} Coins` : m.reward_ref?.replace(/_/g,' ') || m.reward_type}
                    </span>
                  </div>
                </div>

                {/* Action */}
                <div style={{ flexShrink:0 }}>
                  {claimed ? (
                    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
                      <span style={{ fontSize:20 }}>✅</span>
                      <span style={{ fontSize:9, color:'#4ade80', fontFamily:'Cinzel,serif' }}>ERHALTEN</span>
                    </div>
                  ) : reached ? (
                    <button onClick={() => claim(m)} disabled={!!claiming}
                      style={{ padding:'8px 16px', borderRadius:10, border:'none', cursor:'pointer', background:`linear-gradient(135deg,${rc}88,${rc})`, color:'#000', fontFamily:'Cinzel,serif', fontSize:11, fontWeight:700 }}>
                      {claiming === m.id ? '...' : 'CLAIM'}
                    </button>
                  ) : (
                    <div style={{ textAlign:'center' }}>
                      <span style={{ fontSize:16 }}>🔒</span>
                      <p style={{ fontSize:9, color:'#444', marginTop:2 }}>Lv.{m.level_required}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Progress bar for "in progress" milestones */}
              {!reached && (
                <div style={{ marginTop:10 }}>
                  <div style={{ height:3, background:'#1a1a1a', borderRadius:2, overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${Math.min(100, (level / m.level_required) * 100)}%`, background:`${rc}66`, borderRadius:2 }} />
                  </div>
                  <p style={{ fontSize:10, color:'#444', marginTop:4 }}>Level {level} / {m.level_required}</p>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
