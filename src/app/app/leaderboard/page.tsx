'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

type Period = 'week' | 'season' | 'alltime'
type Category = 'level' | 'streak' | 'wins' | 'deals'

const CAT_LABELS: Record<Category, string> = {
  level:'🏆 LEVEL', streak:'🔥 STREAK', wins:'⚔️ SIEGE', deals:'🎯 DEALS',
}
const VIEW_LABELS: Record<Period, string> = {
  week:'WOCHE', season:'SEASON', alltime:'ALLZEIT',
}

interface LBEntry {
  id: string
  username: string
  display_name: string
  level: number
  streak: number
  wins: number
  deals_total: number
  active_frame: string
  is_founder: boolean
  primary_archetype: string
}

const CROWN_ICONS = ['👑', '🥈', '🥉']

export default function LeaderboardPage() {
  const { profile } = useAuth()
  const router = useRouter()
  const [period,   setPeriod]   = useState<Period>('week')
  const [category, setCategory] = useState<Category>('level')
  const [entries,  setEntries]  = useState<LBEntry[]>([])
  const [myRank,   setMyRank]   = useState<number | null>(null)
  const [loading,  setLoading]  = useState(false)

  useEffect(() => { fetchLeaderboard() }, [category, period])

  const fetchLeaderboard = async () => {
    setLoading(true)
    // Map category to DB column
    const col: Record<Category, string> = { level:'level', streak:'streak', wins:'wins', deals:'deals_total' }
    const { data } = await supabase
      .from('profiles')
      .select('id,username,display_name,level,streak,wins,deals_total,active_frame,is_founder,primary_archetype')
      .order(col[category], { ascending: false })
      .limit(50)
    const d = data || []
    setEntries(d)
    const idx = d.findIndex((e: LBEntry) => e.id === profile?.id)
    setMyRank(idx >= 0 ? idx + 1 : null)
    setLoading(false)
  }

  const getScore = (e: LBEntry) => {
    if (category === 'level')  return `Lv. ${e.level}`
    if (category === 'streak') return `🔥 ${e.streak}`
    if (category === 'wins')   return `${e.wins} Siege`
    return `${e.deals_total} Deals`
  }

  return (
    <div style={{ minHeight:'100dvh', background:'#060606', color:'#F0ECE4', paddingBottom:100 }}>
      {/* Header */}
      <div style={{ padding:'56px 20px 16px', display:'flex', alignItems:'center', gap:12 }}>
        <button onClick={() => router.back()} style={{ background:'none', border:'none', color:'#666', cursor:'pointer', fontSize:22 }}>‹</button>
        <h1 style={{ fontFamily:'Cinzel,serif', fontSize:22, color:'#F0ECE4', fontWeight:700, flex:1 }}>RANGLISTE</h1>
      </div>

      {/* Period Tabs */}
      <div style={{ display:'flex', margin:'0 16px 12px', background:'#111', borderRadius:10, padding:4 }}>
        {(Object.keys(VIEW_LABELS) as Period[]).map(p => (
          <button key={p} onClick={() => setPeriod(p)}
            style={{ flex:1, padding:'8px', borderRadius:8, border: period===p ? '1px solid rgba(255,184,0,0.25)' : 'none', background: period===p ? 'rgba(255,184,0,0.12)' : 'transparent', color: period===p ? '#FFB800' : '#555', fontFamily:'Cinzel,serif', fontSize:10, letterSpacing:1, cursor:'pointer' }}>
            {VIEW_LABELS[p]}
          </button>
        ))}
      </div>

      {/* Category Tabs */}
      <div style={{ display:'flex', gap:6, padding:'0 16px 16px', overflowX:'auto', scrollbarWidth:'none' }}>
        {(Object.keys(CAT_LABELS) as Category[]).map(c => (
          <button key={c} onClick={() => setCategory(c)}
            style={{ flexShrink:0, padding:'6px 14px', borderRadius:20, border: category===c ? '1.5px solid #FFB800' : '1px solid #222', background: category===c ? 'rgba(255,184,0,0.12)' : '#111', color: category===c ? '#FFB800' : '#666', fontSize:11, fontFamily:'Cinzel,serif', cursor:'pointer', whiteSpace:'nowrap' }}>
            {CAT_LABELS[c]}
          </button>
        ))}
      </div>

      {/* My Rank Banner */}
      {myRank && (
        <div style={{ margin:'0 16px 16px', padding:'10px 16px', background:'rgba(255,184,0,0.06)', borderRadius:12, border:'1px solid rgba(255,184,0,0.2)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <span style={{ fontSize:13, color:'#888' }}>Deine Position</span>
          <span style={{ fontFamily:'Cinzel,serif', fontSize:16, color:'#FFB800', fontWeight:700 }}>#{myRank}</span>
        </div>
      )}

      {/* Top 3 Podium */}
      {entries.length >= 3 && !loading && (
        <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'center', gap:8, padding:'0 16px 20px' }}>
          {/* 2nd */}
          <div style={{ textAlign:'center', flex:1 }}>
            <div style={{ width:52, height:52, borderRadius:'50%', background:'#C0C0C020', border:'2px solid #C0C0C0', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 6px', fontSize:22 }}>🥈</div>
            <p style={{ fontSize:11, fontFamily:'Cinzel,serif', color:'#C0C0C0' }}>#{2}</p>
            <p style={{ fontSize:12, color:'#F0ECE4', fontWeight:600 }}>@{entries[1].username}</p>
            <p style={{ fontSize:11, color:'#888' }}>{getScore(entries[1])}</p>
            <div style={{ height:60, background:'#C0C0C015', borderRadius:'8px 8px 0 0', border:'1px solid #C0C0C030', marginTop:8 }} />
          </div>
          {/* 1st */}
          <div style={{ textAlign:'center', flex:1.2 }}>
            <div style={{ fontSize:10, color:'#FFB800', fontFamily:'Cinzel,serif', letterSpacing:1, marginBottom:4 }}>CHAMPION</div>
            <div style={{ width:64, height:64, borderRadius:'50%', background:'#FFB80020', border:'2px solid #FFB800', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 6px', fontSize:28, boxShadow:'0 0 20px #FFB80044' }}>👑</div>
            <p style={{ fontSize:11, fontFamily:'Cinzel,serif', color:'#FFB800' }}>#{1}</p>
            <p style={{ fontSize:13, color:'#F0ECE4', fontWeight:700 }}>@{entries[0].username}</p>
            <p style={{ fontSize:12, color:'#FFB800' }}>{getScore(entries[0])}</p>
            <div style={{ height:80, background:'#FFB80015', borderRadius:'8px 8px 0 0', border:'1px solid #FFB80030', marginTop:8 }} />
          </div>
          {/* 3rd */}
          <div style={{ textAlign:'center', flex:1 }}>
            <div style={{ width:52, height:52, borderRadius:'50%', background:'#CD7F3220', border:'2px solid #CD7F32', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 6px', fontSize:22 }}>🥉</div>
            <p style={{ fontSize:11, fontFamily:'Cinzel,serif', color:'#CD7F32' }}>#{3}</p>
            <p style={{ fontSize:12, color:'#F0ECE4', fontWeight:600 }}>@{entries[2].username}</p>
            <p style={{ fontSize:11, color:'#888' }}>{getScore(entries[2])}</p>
            <div style={{ height:44, background:'#CD7F3215', borderRadius:'8px 8px 0 0', border:'1px solid #CD7F3230', marginTop:8 }} />
          </div>
        </div>
      )}

      {/* Rest of list */}
      <div style={{ padding:'0 16px', display:'flex', flexDirection:'column', gap:8 }}>
        {loading ? (
          <p style={{ textAlign:'center', color:'#555', padding:40 }}>Lädt…</p>
        ) : entries.slice(3).map((e, i) => {
          const rank  = i + 4
          const isMe  = e.id === profile?.id
          return (
            <Link key={e.id} href={`/app/profile/${e.username}`} style={{ textDecoration:'none' }}>
              <div style={{
                display:'flex', alignItems:'center', gap:12, padding:'12px 16px',
                background: isMe ? 'rgba(255,184,0,0.08)' : '#111',
                borderRadius:12, border: isMe ? '1px solid rgba(255,184,0,0.3)' : '1px solid #1a1a1a',
              }}>
                <span style={{ fontFamily:'Cinzel,serif', fontSize:14, color: isMe ? '#FFB800' : '#555', width:28, textAlign:'center', flexShrink:0 }}>#{rank}</span>
                <div style={{ width:36, height:36, borderRadius:'50%', background:'#222', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:16, color:'#FFB800' }}>
                  {e.display_name?.[0] || e.username?.[0] || '?'}
                </div>
                <div style={{ flex:1 }}>
                  <p style={{ fontSize:13, fontWeight:700, color: isMe ? '#FFB800' : '#F0ECE4' }}>{e.display_name || e.username}</p>
                  <p style={{ fontSize:11, color:'#555' }}>@{e.username} {e.is_founder && '· 👑 Founder'}</p>
                </div>
                <div style={{ textAlign:'right' }}>
                  <p style={{ fontFamily:'Cinzel,serif', fontSize:14, color:'#FFB800', fontWeight:700 }}>{getScore(e)}</p>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
