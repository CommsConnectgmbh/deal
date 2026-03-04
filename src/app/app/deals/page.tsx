'use client'
import { useState, useEffect, useRef, Suspense } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useLang } from '@/contexts/LanguageContext'
import { supabase } from '@/lib/supabase'
import { useSearchParams } from 'next/navigation'
import AvatarDisplay from '@/components/AvatarDisplay'
import DealCard from '@/components/DealCard'

const CATEGORIES = [
  { id:'fitness', icon:'🏋️', label:'Fitness'  },
  { id:'gaming',  icon:'🎮', label:'Gaming'   },
  { id:'wissen',  icon:'📚', label:'Wissen'   },
  { id:'social',  icon:'🍺', label:'Social'   },
  { id:'custom',  icon:'🎯', label:'Custom'   },
]
const STAKE_SUGGESTIONS = [
  'Kasten Bier 🍺','Abendessen zahlen 🍽️','Peinliches Foto posten 📸',
  '20 Liegestütze 💪','Autowäsche 🚗','Runde ausgeben 🥂',
]
const TEMPLATES = [
  { label:'Wer schafft mehr…', value:'Wer schafft mehr ' },
  { label:'Wer hat recht?',    value:'Wer hat recht: ' },
  { label:'[Team] vs [Team]',  value:' vs ' },
  { label:'Wer kommt zuerst…', value:'Wer kommt zuerst zu ' },
  { label:'Verlierer muss…',   value:'Der Verlierer muss ' },
]
const MILESTONE_LORE: Record<number, string> = {
  5:  '"Dein erster Schritt zur Legende."',
  10: '"Die Rivalität wächst."',
  15: '"Respekt wird verdient, nicht geschenkt."',
  20: '"Auf dem Weg zur Unsterblichkeit."',
  25: '"Fast am Gipfel. Gib nicht auf."',
  30: '"LEGENDE. Du hast Season 1 gemeistert."',
}

const inputStyle: React.CSSProperties = {
  width:'100%', padding:'14px 16px', background:'#1a1a1a',
  border:'1px solid rgba(255,184,0,0.2)', borderRadius:10, color:'#f0ece4',
  fontSize:16, fontFamily:'Crimson Text, serif', outline:'none',
  boxSizing:'border-box',
}

function DealsContent() {
  const { profile } = useAuth()
  const { t } = useLang()
  const searchParams = useSearchParams()

  const [tab, setTab] = useState<'mine'|'community'>('mine')
  const [deals, setDeals] = useState<any[]>([])
  const [communityDeals, setCommunityDeals] = useState<any[]>([])
  const [avatarMap, setAvatarMap] = useState<Record<string, any>>({})
  const [createOpen, setCreateOpen] = useState(false)
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({ title:'', stake:'', isPublic:false, category:'custom' })
  const [inviteSearch, setInviteSearch] = useState('')
  const [inviteResults, setInviteResults] = useState<any[]>([])
  const [selectedFriend, setSelectedFriend] = useState<any>(null)
  const [selectedFriendAvatar, setSelectedFriendAvatar] = useState<any>(null)
  const [myAvatar, setMyAvatar] = useState<any>(null)
  const [declareTarget, setDeclareTarget] = useState<any>(null)
  const [editTarget, setEditTarget] = useState<any>(null)
  const [editForm, setEditForm] = useState({ title:'', stake:'' })
  const [deleteTarget, setDeleteTarget] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [stakeIdx, setStakeIdx] = useState(0)

  // Auto-open create modal when navigating with ?new=1 (FAB button)
  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setCreateOpen(true)
    }
  }, [])

  useEffect(() => {
    const t = setInterval(() => setStakeIdx(i => (i + 1) % STAKE_SUGGESTIONS.length), 3000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (profile) {
      fetchDeals()
      fetchCommunity()
      loadMyAvatar()
    }
  }, [profile])

  const loadMyAvatar = async () => {
    if (!profile) return
    const { data } = await supabase.from('avatar_config').select('*').eq('user_id', profile.id).single()
    setMyAvatar(data || null)
  }

  const fetchAvatars = async (userIds: string[]) => {
    if (!userIds.length) return
    const unique = [...new Set(userIds)]
    const { data } = await supabase.from('avatar_config').select('*').in('user_id', unique)
    if (data) {
      const map: Record<string, any> = {}
      data.forEach((cfg: any) => { map[cfg.user_id] = cfg })
      setAvatarMap(prev => ({ ...prev, ...map }))
    }
  }

  const fetchDeals = async () => {
    const { data } = await supabase.from('bets')
      .select('*, creator:creator_id(id,username,display_name,level,streak), opponent:opponent_id(id,username,display_name,level,streak)')
      .or(`creator_id.eq.${profile!.id},opponent_id.eq.${profile!.id}`)
      .order('created_at', { ascending: false })
    const d = data || []
    setDeals(d)
    const ids = d.flatMap((deal: any) => [deal.creator_id, deal.opponent_id].filter(Boolean))
    fetchAvatars(ids)
  }

  const fetchCommunity = async () => {
    const { data } = await supabase.from('bets')
      .select('*, creator:creator_id(id,username,display_name,level,streak), opponent:opponent_id(id,username,display_name,level,streak)')
      .eq('is_public', true).eq('status', 'open').neq('creator_id', profile!.id)
      .order('created_at', { ascending: false }).limit(20)
    const d = data || []
    setCommunityDeals(d)
    const ids = d.flatMap((deal: any) => [deal.creator_id, deal.opponent_id].filter(Boolean))
    fetchAvatars(ids)
  }

  const resetCreate = () => {
    setCreateOpen(false); setForm({ title:'', stake:'', isPublic:false, category:'custom' }); setStep(1)
    setSelectedFriend(null); setSelectedFriendAvatar(null); setInviteSearch(''); setInviteResults([])
  }

  const createDeal = async () => {
    if (!form.title || !form.stake) return
    setLoading(true)
    await supabase.from('bets').insert({
      creator_id: profile!.id,
      title: form.title,
      stake: form.stake,
      is_public: selectedFriend ? false : form.isPublic,
      status: selectedFriend ? 'pending' : 'open',
      opponent_id: selectedFriend ? selectedFriend.id : null,
      category: form.category,
    })
    resetCreate(); fetchDeals(); setLoading(false)
  }

  const searchFriends = async (q: string) => {
    setInviteSearch(q)
    if (!q) { setInviteResults([]); return }
    const { data } = await supabase.from('profiles').select('id,username,display_name,level').ilike('username', `%${q}%`).neq('id', profile!.id).limit(6)
    setInviteResults(data || [])
  }

  const selectFriend = async (friend: any) => {
    setSelectedFriend(friend)
    setInviteResults([])
    setInviteSearch(friend.username)
    const { data } = await supabase.from('avatar_config').select('*').eq('user_id', friend.id).single()
    setSelectedFriendAvatar(data || null)
  }

  const editDeal = async () => {
    if (!editTarget || !editForm.title || !editForm.stake) return
    setLoading(true)
    await supabase.from('bets').update({ title: editForm.title, stake: editForm.stake }).eq('id', editTarget.id)
    setEditTarget(null); fetchDeals(); setLoading(false)
  }

  const deleteDeal = async () => {
    if (!deleteTarget) return
    await supabase.from('bets').update({ status: 'cancelled' }).eq('id', deleteTarget.id)
    setDeleteTarget(null); fetchDeals()
  }

  const declareResult = async (betId: string, winnerId: string) => {
    await supabase.from('bets').update({ status:'pending_confirmation', winner_id:winnerId, confirmed_winner_id:winnerId }).eq('id', betId)
    setDeclareTarget(null); fetchDeals()
  }

  const displayDeals = tab === 'mine' ? deals : communityDeals

  return (
    <div style={{ minHeight:'100dvh', background:'#060606', color:'#F0ECE4' }}>
      {/* Header */}
      <div style={{ padding:'60px 20px 16px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <h1 style={{ fontFamily:'Cinzel,serif', fontSize:22, color:'#F0ECE4', fontWeight:700, letterSpacing:2 }}>DEALS</h1>
        <button
          onClick={() => setCreateOpen(true)}
          style={{ padding:'10px 20px', borderRadius:10, border:'none', cursor:'pointer', background:'linear-gradient(135deg,#CC8800,#FFB800)', color:'#000', fontFamily:'Cinzel,serif', fontSize:11, fontWeight:700, letterSpacing:2 }}
        >⚡ NEUER DEAL</button>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', margin:'0 16px 16px', background:'#111', borderRadius:10, padding:4 }}>
        {(['mine','community'] as const).map(k => (
          <button key={k} onClick={() => setTab(k)} style={{
            flex:1, padding:'10px', borderRadius:8, border: tab===k ? '1px solid rgba(255,184,0,0.25)' : '1px solid transparent',
            background: tab===k ? 'rgba(255,184,0,0.12)' : 'transparent',
            color: tab===k ? '#FFB800' : 'rgba(240,236,228,0.4)',
            fontFamily:'Cinzel,serif', fontSize:11, letterSpacing:1, cursor:'pointer',
          }}>
            {k === 'mine' ? 'MEINE DEALS' : 'COMMUNITY'}
          </button>
        ))}
      </div>

      {/* Deal List */}
      <div style={{ padding:'0 16px 100px', display:'flex', flexDirection:'column', gap:12 }}>
        {displayDeals.length === 0 ? (
          <div style={{ textAlign:'center', padding:'60px 0' }}>
            <div style={{ fontSize:48, marginBottom:12 }}>⚡</div>
            <p style={{ fontFamily:'Cinzel,serif', fontSize:16, color:'rgba(240,236,228,0.4)', marginBottom:8 }}>Noch keine Deals</p>
            <p style={{ fontSize:14, color:'rgba(240,236,228,0.3)' }}>Fordere jemanden heraus!</p>
          </div>
        ) : displayDeals.map((deal: any) => (
          <div key={deal.id} style={{ position:'relative' }}>
            <DealCard
              deal={deal}
              creatorAvatar={avatarMap[deal.creator_id] || null}
              opponentAvatar={avatarMap[deal.opponent_id] || null}
              showReactions={true}
            />
            {deal.creator_id === profile?.id && deal.status === 'open' && (
              <div style={{ position:'absolute', top:12, right:12, display:'flex', gap:6, zIndex:10 }}>
                <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEditTarget(deal); setEditForm({ title:deal.title, stake:deal.stake||'' }) }}
                  style={{ background:'rgba(0,0,0,0.6)', border:'none', borderRadius:6, padding:'4px 8px', cursor:'pointer', fontSize:14 }}>✏️</button>
                <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDeleteTarget(deal) }}
                  style={{ background:'rgba(0,0,0,0.6)', border:'none', borderRadius:6, padding:'4px 8px', cursor:'pointer', fontSize:14 }}>🗑️</button>
              </div>
            )}
            {deal.status === 'active' && (deal.creator_id === profile?.id || deal.opponent_id === profile?.id) && (
              <button onClick={() => setDeclareTarget(deal)}
                style={{ width:'100%', marginTop:-4, padding:'10px', borderRadius:'0 0 12px 12px', border:'none', borderTop:'1px solid #1a1a1a', background:'rgba(255,184,0,0.08)', color:'#FFB800', fontFamily:'Cinzel,serif', fontSize:10, letterSpacing:1, cursor:'pointer' }}>
                ⚔️ ERGEBNIS MELDEN
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Create Deal Modal */}
      {createOpen && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.92)', display:'flex', alignItems:'flex-end', zIndex:200 }} onClick={resetCreate}>
          <div style={{ width:'100%', maxWidth:480, margin:'0 auto', background:'#0D0D18', borderRadius:'24px 24px 0 0', border:'1px solid rgba(255,184,0,0.2)', maxHeight:'92dvh', overflowY:'auto', paddingBottom:40 }} onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'center', padding:'12px 0 0' }}><div style={{ width:36, height:4, borderRadius:2, background:'#333' }} /></div>
            <div style={{ display:'flex', justifyContent:'center', gap:6, padding:'16px 0 8px' }}>
              {[1,2,3].map(n => (<div key={n} style={{ width: step===n ? 24 : 8, height:4, borderRadius:2, background: step>=n ? '#FFB800' : '#222', transition:'all 0.3s' }} />))}
            </div>
            {step === 1 && (<div style={{ padding:'0 20px' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:16, marginBottom:24, padding:'16px 0' }}>
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
                    <AvatarDisplay config={myAvatar} size={64} archetype={profile?.primary_archetype || 'founder'} />
                    <span style={{ fontSize:11, color:'#888' }}>@{profile?.username}</span>
                  </div>
                  <span style={{ fontFamily:'Cinzel,serif', fontSize:28, fontWeight:900, color:'#FFB800', textShadow:'0 0 20px #FFB80066', letterSpacing:3 }}>VS</span>
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
                    {selectedFriend ? (<>
                        <AvatarDisplay config={selectedFriendAvatar} size={64} archetype='duelist' />
                        <span style={{ fontSize:11, color:'#888' }}>@{selectedFriend.username}</span>
                      </>) : (<div style={{ width:64, height:64, borderRadius:'50%', border:'2px dashed #333', background:'#111', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:4 }}>
                        <span style={{ fontSize:22, color:'#333' }}>?</span>
                      </div>)}
                    {!selectedFriend && <span style={{ fontSize:11, color:'#444' }}>Gegner wählen</span>}
                  </div>
                </div>
                <p style={{ fontSize:11, color:'#555', marginBottom:8, fontFamily:'Cinzel,serif', letterSpacing:1 }}>SCHNELL STARTEN:</p>
                <div style={{ display:'flex', gap:6, overflowX:'auto', marginBottom:16, paddingBottom:4, scrollbarWidth:'none' }}>
                  {TEMPLATES.map((tpl, i) => (<button key={i} onClick={() => setForm(f => ({ ...f, title: tpl.value }))} style={{ flexShrink:0, padding:'6px 12px', borderRadius:20, border:'1px solid #333', background:'#111', color:'#888', fontSize:11, cursor:'pointer', whiteSpace:'nowrap' }}>{tpl.label}</button>))}
                </div>
                <label style={{ display:'block', fontSize:10, fontFamily:'Cinzel,serif', letterSpacing:2, color:'rgba(240,236,228,0.4)', marginBottom:8 }}>DEAL TITEL *</label>
                <div style={{ position:'relative', marginBottom:4 }}>
                  <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value.slice(0, 60) }))} placeholder='"Wer schafft mehr Liegestütze?"' style={inputStyle} />
                  <span style={{ position:'absolute', right:12, bottom:14, fontSize:11, color:'#444' }}>{form.title.length}/60</span>
                </div>
                <label style={{ display:'block', fontSize:10, fontFamily:'Cinzel,serif', letterSpacing:2, color:'rgba(240,236,228,0.4)', marginBottom:8, marginTop:16 }}>EINSATZ *</label>
                <input value={form.stake} onChange={e => setForm(f => ({ ...f, stake: e.target.value }))} placeholder={STAKE_SUGGESTIONS[stakeIdx]} style={inputStyle} />
                <label style={{ display:'block', fontSize:10, fontFamily:'Cinzel,serif', letterSpacing:2, color:'rgba(240,236,228,0.4)', marginBottom:10, marginTop:16 }}>KATEGORIE</label>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:16 }}>
                  {CATEGORIES.map(cat => (<button key={cat.id} onClick={() => setForm(f => ({ ...f, category: cat.id }))} style={{ padding:'6px 14px', borderRadius:20, border: form.category===cat.id ? '1.5px solid #FFB800' : '1px solid #222', background: form.category===cat.id ? 'rgba(255,184,0,0.12)' : '#111', color: form.category===cat.id ? '#FFB800' : '#666', fontSize:12, cursor:'pointer' }}>{cat.icon} {cat.label}</button>))}
                </div>
                {!selectedFriend && (
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20, padding:'12px 16px', background:'#111', borderRadius:10, border:'1px solid #1a1a1a' }}>
                    <div>
                      <p style={{ fontFamily:'Cinzel,serif', fontSize:12, color:'#ccc' }}>Öffentlicher Deal</p>
                      <p style={{ fontSize:11, color:'#555' }}>Im Community Feed sichtbar</p>
                    </div>
                    <button onClick={() => setForm(f => ({ ...f, isPublic: !f.isPublic }))} style={{ width:44, height:24, borderRadius:12, border:'none', cursor:'pointer', background: form.isPublic ? '#FFB800' : '#333', position:'relative', transition:'background 0.2s' }}>
                      <div style={{ position:'absolute', top:3, left: form.isPublic ? 22 : 3, width:18, height:18, borderRadius:'50%', background:'#000', transition:'left 0.2s' }} />
                    </button>
                  </div>
                )}
                <button onClick={() => setStep(2)} disabled={!form.title || !form.stake} style={{ width:'100%', padding:18, borderRadius:12, border:'none', cursor: !form.title || !form.stake ? 'not-allowed' : 'pointer', background: !form.title || !form.stake ? '#222' : 'linear-gradient(135deg,#CC8800,#FFB800)', color: !form.title || !form.stake ? '#555' : '#000', fontFamily:'Cinzel,serif', fontSize:12, fontWeight:700, letterSpacing:3 }}>WEITER →</button>
              </div>)}
            {step === 2 && (<div style={{ padding:'0 20px' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:16, marginBottom:24, padding:'16px 0' }}>
                  <AvatarDisplay config={myAvatar} size={60} archetype={profile?.primary_archetype || 'founder'} />
                  <span style={{ fontFamily:'Cinzel,serif', fontSize:24, color:'#FFB800', fontWeight:900, letterSpacing:3 }}>VS</span>
                  {selectedFriend ? (<AvatarDisplay config={selectedFriendAvatar} size={60} archetype='duelist' />) : (<div style={{ width:60, height:60, borderRadius:'50%', border:'2px dashed #333', background:'#111', display:'flex', alignItems:'center', justifyContent:'center' }}><span style={{ fontSize:20, color:'#444' }}>?</span></div>)}
                </div>
                <div style={{ background:'#111', borderRadius:12, padding:'12px', marginBottom:16, border:'1px solid #1a1a1a' }}>
                  <p style={{ color:'#888', fontSize:12, marginBottom:4 }}>Deal: <span style={{ color:'#F0ECE4' }}>{form.title}</span></p>
                  <p style={{ color:'#888', fontSize:12 }}>Einsatz: <span style={{ color:'#FFB800' }}>{form.stake}</span></p>
                </div>
                <label style={{ display:'block', fontSize:10, fontFamily:'Cinzel,serif', letterSpacing:2, color:'rgba(240,236,228,0.4)', marginBottom:8 }}>GEGNER SUCHEN</label>
                <input value={inviteSearch} onChange={e => searchFriends(e.target.value)} placeholder="Username suchen…" style={inputStyle} />
                {inviteResults.length > 0 && (<div style={{ background:'#111', borderRadius:10, border:'1px solid #222', marginTop:8, overflow:'hidden' }}>
                  {inviteResults.map((u: any) => (
                    <button key={u.id} onClick={() => selectFriend(u)} style={{ width:'100%', padding:'12px 16px', background:'transparent', border:'none', borderBottom:'1px solid #1a1a1a', cursor:'pointer', display:'flex', alignItems:'center', gap:10, textAlign:'left' }}>
                      <div style={{ width:32, height:32, borderRadius:'50%', background:'#222', display:'flex', alignItems:'center', justifyContent:'center', color:'#FFB800', fontSize:14, fontWeight:700 }}>
                        {u.display_name?.[0] || u.username?.[0] || '?'}
                      </div>
                      <div><p style={{ color:'#F0ECE4', fontSize:13, fontWeight:600 }}>{u.display_name}</p><p style={{ color:'#666', fontSize:11 }}>@{u.username} · Lv. {u.level || 1}</p></div>
                      {selectedFriend?.id === u.id && <span style={{ marginLeft:'auto', color:'#FFB800' }}>✓</span>}
                    </button>
                  ))}
                </div>)}
                {selectedFriend && (<div style={{ marginTop:12, padding:'10px 14px', background:'rgba(255,184,0,0.08)', borderRadius:10, border:'1px solid rgba(255,184,0,0.2)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <span style={{ color:'#FFB800', fontSize:13 }}>✓ @{selectedFriend.username}</span>
                  <button onClick={() => { setSelectedFriend(null); setSelectedFriendAvatar(null); setInviteSearch('') }} style={{ background:'none', border:'none', color:'#666', cursor:'pointer', fontSize:16 }}>✕</button>
                </div>)}
                <div style={{ display:'flex', gap:10, marginTop:20 }}>
                  <button onClick={() => setStep(1)} style={{ flex:1, padding:16, borderRadius:12, border:'1px solid #222', background:'transparent', color:'#888', fontFamily:'Cinzel,serif', fontSize:11, cursor:'pointer' }}>← ZURÜCK</button>
                  <button onClick={() => setStep(3)} style={{ flex:2, padding:16, borderRadius:12, border:'none', cursor:'pointer', background:'linear-gradient(135deg,#CC8800,#FFB800)', color:'#000', fontFamily:'Cinzel,serif', fontSize:12, fontWeight:700, letterSpacing:2 }}>WEITER →</button>
                </div>
              </div>)}
            {step === 3 && (<div style={{ padding:'0 20px' }}>
                <h3 style={{ fontFamily:'Cinzel,serif', fontSize:18, color:'#FFB800', textAlign:'center', marginBottom:24 }}>⚔️ DEAL BESTÄTIGEN</h3>
                <div style={{ background:'#111', borderRadius:16, border:'1px solid rgba(255,184,0,0.2)', padding:20, marginBottom:20 }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-around', marginBottom:16 }}>
                    <div style={{ textAlign:'center' }}>
                      <AvatarDisplay config={myAvatar} size={56} archetype={profile?.primary_archetype || 'founder'} />
                      <p style={{ fontSize:11, color:'#888', marginTop:6 }}>@{profile?.username}</p>
                    </div>
                    <span style={{ fontFamily:'Cinzel,serif', fontSize:22, color:'#FFB800', fontWeight:900 }}>VS</span>
                    <div style={{ textAlign:'center' }}>
                      {selectedFriend ? (<><AvatarDisplay config={selectedFriendAvatar} size={56} archetype='duelist' /><p style={{ fontSize:11, color:'#888', marginTop:6 }}>@{selectedFriend.username}</p></>) : (<div style={{ width:56, height:56, borderRadius:'50%', border:'2px dashed #333', background:'#0A0A0A', display:'flex', alignItems:'center', justifyContent:'center' }}><span style={{ color:'#666', fontSize:18 }}>?</span></div>)}
                    </div>
                  </div>
                  <p style={{ color:'#F0ECE4', fontSize:15, fontWeight:700, textAlign:'center', marginBottom:8 }}>"{form.title}"</p>
                  <p style={{ color:'#F59E0B', fontSize:13, textAlign:'center' }}>🎯 {form.stake}</p>
                  {form.category && (<p style={{ color:'#555', fontSize:12, textAlign:'center', marginTop:6 }}>{CATEGORIES.find(c => c.id === form.category)?.icon} {CATEGORIES.find(c => c.id === form.category)?.label}</p>)}
                </div>
                <div style={{ display:'flex', gap:10 }}>
                  <button onClick={() => setStep(2)} style={{ flex:1, padding:16, borderRadius:12, border:'1px solid #222', background:'transparent', color:'#888', fontFamily:'Cinzel,serif', fontSize:11, cursor:'pointer' }}>← ZURÜCK</button>
                  <button onClick={createDeal} disabled={loading} style={{ flex:2, padding:18, borderRadius:12, border:'none', cursor:'pointer', background:'linear-gradient(135deg,#CC8800,#FFB800)', color:'#000', fontFamily:'Cinzel,serif', fontSize:13, fontWeight:700, letterSpacing:2 }}>{loading ? '...' : '⚡ DEAL ERSTELLEN'}</button>
                </div>
                <button onClick={resetCreate} style={{ width:'100%', padding:14, marginTop:10, borderRadius:12, border:'1px solid #1a1a1a', background:'transparent', color:'#555', fontFamily:'Cinzel,serif', fontSize:11, cursor:'pointer' }}>ABBRECHEN</button>
              </div>)}
          </div>
        </div>
      )}

      {/* Declare Winner Modal */}
      {declareTarget && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.88)', display:'flex', alignItems:'flex-end', zIndex:300 }} onClick={() => setDeclareTarget(null)}>
          <div style={{ width:'100%', maxWidth:480, margin:'0 auto', background:'#111', borderRadius:'20px 20px 0 0', border:'1px solid rgba(255,184,0,0.2)', padding:'24px 20px 48px' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontFamily:'Cinzel,serif', fontSize:18, color:'#FFB800', textAlign:'center', marginBottom:8 }}>⚔️ WER HAT GEWONNEN?</h3>
            <p style={{ textAlign:'center', color:'rgba(240,236,228,0.5)', fontSize:14, marginBottom:24 }}>{declareTarget.title}</p>
            {[declareTarget.creator, declareTarget.opponent].filter(Boolean).map((p: any) => (
              <button key={p.id} onClick={() => declareResult(declareTarget.id, p.id)} style={{ width:'100%', padding:16, borderRadius:12, border:'none', cursor:'pointer', background:'linear-gradient(135deg,#CC8800,#FFB800)', color:'#000', fontFamily:'Cinzel,serif', fontSize:12, fontWeight:700, letterSpacing:2, marginBottom:10 }}>🏆 @{p.username}</button>
            ))}
            <button onClick={() => setDeclareTarget(null)} style={{ width:'100%', padding:14, borderRadius:12, border:'1px solid #222', background:'transparent', color:'#666', fontFamily:'Cinzel,serif', fontSize:11, cursor:'pointer', marginTop:4 }}>ABBRECHEN</button>
          </div></div>)}

      {/* Edit Modal */}
      {editTarget && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.88)', display:'flex', alignItems:'flex-end', zIndex:300 }} onClick={() => setEditTarget(null)}>
          <div style={{ width:'100%', maxWidth:480, margin:'0 auto', background:'#111', borderRadius:'20px 20px 0 0', border:'1px solid rgba(255,184,0,0.2)', padding:'24px 20px 48px' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontFamily:'Cinzel,serif', fontSize:18, color:'#FFB800', textAlign:'center', marginBottom:24 }}>DEAL BEARBEITEN</h3>
            <label style={{ display:'block', fontSize:10, fontFamily:'Cinzel,serif', letterSpacing:2, color:'#888', marginBottom:8 }}>TITEL</label>
            <input value={editForm.title} onChange={e => setEditForm(f => ({...f, title:e.target.value}))} style={inputStyle} />
            <label style={{ display:'block', fontSize:10, fontFamily:'Cinzel,serif', letterSpacing:2, color:'#888', marginBottom:8, marginTop:16 }}>EINSATZ</label>
            <input value={editForm.stake} onChange={e => setEditForm(f => ({...f, stake:e.target.value}))} style={inputStyle} />
            <button onClick={editDeal} disabled={loading} style={{ width:'100%', padding:18, marginTop:20, borderRadius:12, border:'none', cursor:'pointer', background:'linear-gradient(135deg,#CC8800,#FFB800)', color:'#000', fontFamily:'Cinzel,serif', fontSize:12, fontWeight:700, letterSpacing:3 }}>{loading ? '...' : 'SPEICHERN'}</button>
            <button onClick={() => setEditTarget(null)} style={{ width:'100%', padding:14, marginTop:10, borderRadius:12, border:'1px solid #222', background:'transparent', color:'#666', fontFamily:'Cinzel,serif', fontSize:11, cursor:'pointer' }}>ABBRECHEN</button>
          </div></div>)}

      {/* Delete Modal */}
      {deleteTarget && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.88)', display:'flex', alignItems:'flex-end', zIndex:300 }} onClick={() => setDeleteTarget(null)}>
          <div style={{ width:'100%', maxWidth:480, margin:'0 auto', background:'#111', borderRadius:'20px 20px 0 0', border:'1px solid rgba(255,255,255,0.08)', padding:'24px 20px 48px' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontFamily:'Cinzel,serif', fontSize:18, color:'#f87171', textAlign:'center', marginBottom:8 }}>DEAL LÖSCHEN?</h3>
            <p style={{ textAlign:'center', color:'rgba(240,236,228,0.5)', fontSize:14, marginBottom:24 }}>{deleteTarget.title}</p>
            <button onClick={deleteDeal} style={{ width:'100%', padding:16, borderRadius:12, border:'1px solid rgba(248,113,113,0.3)', background:'rgba(248,113,113,0.1)', color:'#f87171', fontFamily:'Cinzel,serif', fontSize:12, letterSpacing:2, cursor:'pointer', marginBottom:10 }}>LÖSCHEN</button>
            <button onClick={() => setDeleteTarget(null)} style={{ width:'100%', padding:14, borderRadius:12, border:'1px solid #222', background:'transparent', color:'#666', fontFamily:'Cinzel,serif', fontSize:11, cursor:'pointer' }}>ABBRECHEN</button>
          </div></div>)}
    </div>
  )
}

export default function DealsPage() {
  return (
    <Suspense fallback={<div style={{ minHeight:'100dvh', background:'#060606' }} />}>
      <DealsContent />
    </Suspense>
  )
}
