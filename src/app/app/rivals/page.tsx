'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useLang } from '@/contexts/LanguageContext'
import { supabase } from '@/lib/supabase'

export default function RivalsPage() {
  const { profile } = useAuth()
  const { t } = useLang()
  const [rivalries, setRivalries] = useState<any[]>([])
  const [addOpen, setAddOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  useEffect(() => {
    if (!profile) return
    supabase.from('rivalries')
      .select('*, rival:rival_id(id,username,display_name,level,active_frame)')
      .eq('user_id', profile.id)
      .order('rivalry_intensity', { ascending: false })
      .then(({ data }) => setRivalries(data || []))
  }, [profile])
  const searchUsers = async (q: string) => {
    if (!q) { setSearchResults([]); return }
    const { data } = await supabase.from('profiles').select('id,username,display_name,level').ilike('username', `%${q}%`).neq('id', profile!.id).limit(5)
    setSearchResults(data || [])
  }
  const sendFriendRequest = async (rivalId: string) => {
    await supabase.from('rivalries').upsert({ user_id: profile!.id, rival_id: rivalId, rivalry_intensity: 0, wins: 0, losses: 0 })
    setAddOpen(false); setSearch('')
  }
  const initials = (name: string) => (name || 'U').slice(0, 2).toUpperCase()
  return (
    <div style={{ minHeight:'100dvh', background:'#060606', paddingTop:60 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'0 20px 24px' }}>
        <h1 className='font-display' style={{ fontSize:28, color:'#f0ece4' }}>{t('rivals.title')}</h1>
        <button onClick={() => setAddOpen(true)} style={{ padding:'10px 16px', borderRadius:10, border:'1px solid rgba(255,184,0,0.3)', background:'transparent', color:'#FFB800', fontFamily:'Cinzel, serif', fontSize:10, letterSpacing:1, cursor:'pointer' }}>+ {t('rivals.addFriend').toUpperCase()}</button>
      </div>
      <div style={{ padding:'0 16px 100px' }}>
        {rivalries.length === 0 ? (
          <div style={{ textAlign:'center', padding:'80px 0' }}>
            <div style={{ fontSize:56, marginBottom:16 }}>⚡</div>
            <p className='font-display' style={{ fontSize:18, color:'rgba(240,236,228,0.4)', marginBottom:8 }}>{t('rivals.noRivals')}</p>
            <p style={{ fontSize:14, color:'rgba(240,236,228,0.3)', lineHeight:1.6 }}>{t('rivals.noRivalsText')}</p>
          </div>
        ) : rivalries.map((r: any) => {
          const intensity = r.rivalry_intensity || 0
          const isHeated = intensity >= 50
          return (
            <div key={r.id} style={{ background:'#111', borderRadius:14, border:`1px solid ${isHeated ? 'rgba(255,184,0,0.25)' : 'rgba(255,255,255,0.05)'}`, padding:'16px', marginBottom:12 }}>
              <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:12 }}>
                <div style={{ width:48, height:48, borderRadius:'50%', background:'linear-gradient(135deg, #CC8800, #FFB800)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <span className='font-display' style={{ fontSize:16, color:'#000', fontWeight:700 }}>{initials(r.rival?.username || '')}</span>
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span className='font-display' style={{ fontSize:14, color:'#f0ece4' }}>@{r.rival?.username}</span>
                    {isHeated && <span style={{ fontSize:11 }}>{t('rivals.heated')}</span>}
                  </div>
                  <span style={{ fontSize:12, color:'rgba(240,236,228,0.4)' }}>Level {r.rival?.level || 1}</span>
                </div>
                <div style={{ textAlign:'right' }}>
                  <span style={{ fontSize:13, color:'#4ade80' }}>{r.wins || 0}W</span>
                  <span style={{ fontSize:13, color:'rgba(240,236,228,0.3)', margin:'0 4px' }}>/</span>
                  <span style={{ fontSize:13, color:'#f87171' }}>{r.losses || 0}L</span>
                </div>
              </div>
              <div>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                  <span className='font-display' style={{ fontSize:8, letterSpacing:1, color:'rgba(240,236,228,0.3)' }}>{t('rivals.intensity').toUpperCase()}</span>
                  <span className='font-display' style={{ fontSize:8, color: isHeated ? '#FFB800' : 'rgba(240,236,228,0.3)' }}>{intensity}/100</span>
                </div>
                <div style={{ height:3, background:'rgba(255,255,255,0.06)', borderRadius:2, overflow:'hidden' }}>
                  <div style={{ height:'100%', width:`${intensity}%`, background: isHeated ? 'linear-gradient(90deg, #CC8800, #FFB800)' : '#60a5fa', borderRadius:2, transition:'width 0.5s' }}/>
                </div>
              </div>
            </div>
          )
        })}
      </div>
      {addOpen && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', display:'flex', alignItems:'flex-end', zIndex:200 }} onClick={() => setAddOpen(false)}>
          <div style={{ width:'100%', maxWidth:430, margin:'0 auto', background:'#111', borderRadius:'20px 20px 0 0', border:'1px solid rgba(255,184,0,0.15)', padding:'24px 20px 48px' }} onClick={e => e.stopPropagation()}>
            <h3 className='font-display' style={{ fontSize:18, color:'#FFB800', textAlign:'center', marginBottom:20 }}>{t('rivals.addFriend')}</h3>
            <input value={search} onChange={e => { setSearch(e.target.value); searchUsers(e.target.value) }} placeholder={t('rivals.searchUser')} style={{ width:'100%', padding:'14px 16px', background:'#1a1a1a', border:'1px solid rgba(255,184,0,0.15)', borderRadius:10, color:'#f0ece4', fontSize:16, outline:'none', marginBottom:16 }} autoFocus />
            {searchResults.map((u: any) => (
              <div key={u.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 0', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
                <div>
                  <p style={{ color:'#f0ece4', fontSize:14 }}>@{u.username}</p>
                  <p style={{ color:'rgba(240,236,228,0.4)', fontSize:12 }}>Level {u.level || 1}</p>
                </div>
                <button onClick={() => sendFriendRequest(u.id)} style={{ padding:'8px 16px', borderRadius:8, border:'none', cursor:'pointer', background:'linear-gradient(135deg, #CC8800, #FFB800)', color:'#000', fontFamily:'Cinzel, serif', fontSize:10, fontWeight:700, letterSpacing:1 }}>{t('rivals.sendRequest').toUpperCase()}</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}