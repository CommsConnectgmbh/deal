'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useLang } from '@/contexts/LanguageContext'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

const STATUS_COLORS: Record<string, string> = {
  open: '#60a5fa', pending: '#FFB800', active: '#4ade80',
  completed: 'rgba(240,236,228,0.3)', cancelled: '#f87171', frozen: '#a78bfa'
}
const inputStyle: React.CSSProperties = {
  width:'100%', padding:'14px 16px', background:'#1a1a1a', border:'1px solid rgba(255,184,0,0.15)', borderRadius:10, color:'#f0ece4', fontSize:16, fontFamily:'Crimson Text, serif', outline:'none', marginBottom:4
}

export default function DealsPage() {
  const { profile } = useAuth()
  const { t } = useLang()
  const [tab, setTab] = useState<'mine'|'community'>('mine')
  const [deals, setDeals] = useState<any[]>([])
  const [communityDeals, setCommunityDeals] = useState<any[]>([])
  const [createOpen, setCreateOpen] = useState(false)
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({ title:'', stake:'', isPublic:false })
  const [inviteSearch, setInviteSearch] = useState('')
  const [inviteResults, setInviteResults] = useState<any[]>([])
  const [selectedFriend, setSelectedFriend] = useState<any>(null)
  const [declareTarget, setDeclareTarget] = useState<any>(null)
  const [editTarget, setEditTarget] = useState<any>(null)
  const [editForm, setEditForm] = useState({ title:'', stake:'' })
  const [deleteTarget, setDeleteTarget] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [totalOwed] = useState(0)
  const [totalOwe] = useState(0)

  useEffect(() => { if (profile) { fetchDeals(); fetchCommunity() } }, [profile])

  const fetchDeals = async () => {
    const { data } = await supabase.from('bets')
      .select('*, creator:creator_id(id,username,display_name), opponent:opponent_id(id,username,display_name), winner:winner_id(id,username)')
      .or(`creator_id.eq.${profile!.id},opponent_id.eq.${profile!.id}`)
      .order('created_at', { ascending: false })
    setDeals(data || [])
  }

  const fetchCommunity = async () => {
    const { data } = await supabase.from('bets')
      .select('*, creator:creator_id(id,username,display_name)')
      .eq('is_public', true).eq('status', 'open').neq('creator_id', profile!.id)
      .order('created_at', { ascending: false }).limit(20)
    setCommunityDeals(data || [])
  }

  const resetCreate = () => {
    setCreateOpen(false); setForm({ title:'', stake:'', isPublic:false }); setStep(1)
    setSelectedFriend(null); setInviteSearch(''); setInviteResults([])
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
      category: 'custom',
    })
    resetCreate(); fetchDeals(); setLoading(false)
  }

  const searchFriends = async (q: string) => {
    setInviteSearch(q)
    if (!q) { setInviteResults([]); return }
    const { data } = await supabase.from('profiles').select('id,username,display_name,level').ilike('username', `%${q}%`).neq('id', profile!.id).limit(5)
    setInviteResults(data || [])
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
    await supabase.from('bets').update({ status:'completed', winner_id:winnerId }).eq('id', betId)
    setDeclareTarget(null); fetchDeals()
  }

  const displayDeals = tab === 'mine' ? deals : communityDeals
  const netBalance = totalOwed - totalOwe

  return (
    <div style={{ minHeight:'100dvh', background:'#060606' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'60px 20px 16px' }}>
        <h1 className='font-display' style={{ fontSize:28, color:'#f0ece4' }}>{t('deals.title')}</h1>
        <button onClick={() => setCreateOpen(true)} style={{ padding:'10px 20px', borderRadius:10, border:'none', cursor:'pointer', background:'linear-gradient(135deg, #CC8800, #FFB800)', color:'#000', fontFamily:'Cinzel, serif', fontSize:11, fontWeight:700, letterSpacing:2 }}>
          {t('deals.newDeal')}
        </button>
      </div>

      <div style={{ display:'flex', gap:8, padding:'0 16px 16px' }}>
        {[
          { label:t('deals.youGet'), val:`+€${totalOwed.toFixed(2)}`, color:'#4ade80' },
          { label:t('deals.youOwe'), val:`-€${totalOwe.toFixed(2)}`, color:'#f87171' },
          { label:t('deals.netto'), val:`${netBalance>=0?'+':''}€${Math.abs(netBalance).toFixed(2)}`, color: netBalance>=0 ? '#4ade80' : '#f87171' },
        ].map(item => (
          <div key={item.label} style={{ flex:1, background:'#111', borderRadius:10, border:'1px solid rgba(255,255,255,0.05)', padding:'10px 6px', textAlign:'center' }}>
            <p className='font-display' style={{ fontSize:7, color:'rgba(240,236,228,0.4)', marginBottom:4, letterSpacing:1 }}>{item.label.toUpperCase()}</p>
            <p className='font-display' style={{ fontSize:14, color:item.color }}>{item.val}</p>
          </div>
        ))}
      </div>

      <div style={{ display:'flex', margin:'0 16px 16px', background:'#111', borderRadius:10, padding:4 }}>
        {(['mine','community'] as const).map(k => (
          <button key={k} onClick={() => setTab(k)} style={{ flex:1, padding:'10px', borderRadius:8, border: tab===k ? '1px solid rgba(255,184,0,0.25)' : '1px solid transparent', background: tab===k ? 'rgba(255,184,0,0.12)' : 'transparent', color: tab===k ? '#FFB800' : 'rgba(240,236,228,0.4)', fontFamily:'Cinzel, serif', fontSize:11, letterSpacing:1, cursor:'pointer' }}>
            {t(`deals.${k === 'mine' ? 'mine' : 'community'}`).toUpperCase()}
          </button>
        ))}
      </div>

      <div style={{ padding:'0 16px 100px' }}>
        {displayDeals.length === 0 ? (
          <div style={{ textAlign:'center', padding:'60px 0' }}>
            <div style={{ fontSize:48, marginBottom:12 }}>🤝</div>
            <p className='font-display' style={{ fontSize:16, color:'rgba(240,236,228,0.4)', marginBottom:8 }}>{t('deals.noBets')}</p>
            <p style={{ fontSize:14, color:'rgba(240,236,228,0.3)' }}>{t('deals.noBetsText')}</p>
          </div>
        ) : displayDeals.map((deal:any) => {
          const sc = STATUS_COLORS[deal.status] || '#60a5fa'
          const canEdit = deal.creator_id === profile?.id && deal.status === 'open'
          return (
            <div key={deal.id} style={{ background:'#111', borderRadius:14, border:'1px solid rgba(255,255,255,0.05)', padding:'16px', marginBottom:12 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                <div style={{ padding:'3px 10px', borderRadius:20, border:`1px solid ${sc}44`, background:`${sc}18` }}>
                  <span className='font-display' style={{ fontSize:9, letterSpacing:1.5, color:sc }}>{t(`deals.status.${deal.status}`)}</span>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ color:'rgba(240,236,228,0.5)', fontSize:13 }}>{deal.stake || '—'}</span>
                  {canEdit && <>
                    <button onClick={() => { setEditTarget(deal); setEditForm({ title:deal.title, stake:deal.stake||'' }) }} style={{ background:'none', border:'none', cursor:'pointer', fontSize:16, padding:'2px 4px', lineHeight:1 }}>✏️</button>
                    <button onClick={() => setDeleteTarget(deal)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:16, padding:'2px 4px', lineHeight:1 }}>🗑️</button>
                  </>}
                </div>
              </div>
              <Link href={`/app/deals/${deal.id}`} style={{ textDecoration:'none' }}>
                <p style={{ color:'#f0ece4', fontSize:16, fontWeight:600, marginBottom:12 }}>{deal.title}</p>
              </Link>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ fontSize:13, color:'rgba(240,236,228,0.5)' }}>@{deal.creator?.username}</span>
                <span className='font-display' style={{ fontSize:10, color:'#CC8800' }}>VS</span>
                <span style={{ fontSize:13, color: deal.status === 'pending' ? '#FFB800' : 'rgba(240,236,228,0.5)' }}>
                  {deal.opponent ? `@${deal.opponent.username}` : (deal.status === 'pending' ? t('deals.pendingInvite') : '...')}
                </span>
              </div>
              {deal.status === 'completed' && deal.winner && (
                <div style={{ marginTop:10, padding:'8px 12px', background:'rgba(255,184,0,0.06)', borderRadius:8, border:'1px solid rgba(255,184,0,0.15)', textAlign:'center' }}>
                  <span style={{ fontSize:12, color:'#FFB800' }}>🏆 @{deal.winner?.username} hat gewonnen</span>
                </div>
              )}
              {deal.status === 'active' && (deal.creator_id === profile?.id || deal.opponent_id === profile?.id) && (
                <button onClick={() => setDeclareTarget(deal)} style={{ marginTop:12, width:'100%', padding:'10px', borderRadius:8, border:'1px solid rgba(255,184,0,0.25)', background:'transparent', color:'#FFB800', fontFamily:'Cinzel, serif', fontSize:10, letterSpacing:1, cursor:'pointer' }}>
                  {t('deals.declareResult').toUpperCase()}
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* Declare winner modal */}
      {declareTarget && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', display:'flex', alignItems:'flex-end', zIndex:200 }} onClick={() => setDeclareTarget(null)}>
          <div style={{ width:'100%', maxWidth:430, margin:'0 auto', background:'#111', borderRadius:'20px 20px 0 0', border:'1px solid rgba(255,184,0,0.15)', padding:'24px 20px 48px' }} onClick={e => e.stopPropagation()}>
            <h3 className='font-display' style={{ fontSize:18, color:'#FFB800', textAlign:'center', marginBottom:8 }}>{t('deals.whoWon')}</h3>
            <p style={{ textAlign:'center', color:'rgba(240,236,228,0.5)', fontSize:14, marginBottom:24 }}>{declareTarget.title}</p>
            {[declareTarget.creator, declareTarget.opponent].filter(Boolean).map((p:any) => (
              <button key={p.id} onClick={() => declareResult(declareTarget.id, p.id)} style={{ width:'100%', padding:16, borderRadius:12, border:'none', cursor:'pointer', background:'linear-gradient(135deg, #CC8800, #FFB800)', color:'#000', fontFamily:'Cinzel, serif', fontSize:12, fontWeight:700, letterSpacing:2, marginBottom:10 }}>
                @{p.username}
              </button>
            ))}
            <button onClick={() => setDeclareTarget(null)} style={{ width:'100%', padding:14, borderRadius:12, border:'1px solid rgba(255,255,255,0.1)', background:'transparent', color:'rgba(240,236,228,0.5)', fontFamily:'Cinzel, serif', fontSize:11, letterSpacing:1, cursor:'pointer', marginTop:4 }}>{t('deals.cancel').toUpperCase()}</button>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editTarget && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', display:'flex', alignItems:'flex-end', zIndex:200 }} onClick={() => setEditTarget(null)}>
          <div style={{ width:'100%', maxWidth:430, margin:'0 auto', background:'#111', borderRadius:'20px 20px 0 0', border:'1px solid rgba(255,184,0,0.15)', padding:'24px 20px 48px' }} onClick={e => e.stopPropagation()}>
            <h3 className='font-display' style={{ fontSize:18, color:'#FFB800', textAlign:'center', marginBottom:24 }}>{t('deals.editDeal')}</h3>
            <label className='font-display' style={{ display:'block', fontSize:9, letterSpacing:2, color:'rgba(240,236,228,0.5)', marginBottom:8 }}>{t('deals.whatBet').toUpperCase()}</label>
            <input value={editForm.title} onChange={e => setEditForm(f => ({...f, title:e.target.value}))} style={inputStyle} />
            <label className='font-display' style={{ display:'block', fontSize:9, letterSpacing:2, color:'rgba(240,236,228,0.5)', marginBottom:8, marginTop:12 }}>{t('deals.stake').toUpperCase()}</label>
            <input value={editForm.stake} onChange={e => setEditForm(f => ({...f, stake:e.target.value}))} style={inputStyle} />
            <button onClick={editDeal} disabled={loading} style={{ width:'100%', padding:18, marginTop:20, borderRadius:12, border:'none', cursor:'pointer', background:'linear-gradient(135deg, #CC8800, #FFB800)', color:'#000', fontFamily:'Cinzel, serif', fontSize:12, fontWeight:700, letterSpacing:3 }}>{loading ? '...' : t('deals.save')}</button>
            <button onClick={() => setEditTarget(null)} style={{ width:'100%', padding:14, marginTop:10, borderRadius:12, border:'1px solid rgba(255,255,255,0.1)', background:'transparent', color:'rgba(240,236,228,0.5)', fontFamily:'Cinzel, serif', fontSize:11, cursor:'pointer' }}>{t('deals.cancel').toUpperCase()}</button>
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      {deleteTarget && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', display:'flex', alignItems:'flex-end', zIndex:200 }} onClick={() => setDeleteTarget(null)}>
          <div style={{ width:'100%', maxWidth:430, margin:'0 auto', background:'#111', borderRadius:'20px 20px 0 0', border:'1px solid rgba(255,255,255,0.08)', padding:'24px 20px 48px' }} onClick={e => e.stopPropagation()}>
            <h3 className='font-display' style={{ fontSize:18, color:'#f87171', textAlign:'center', marginBottom:8 }}>{t('deals.deleteConfirmTitle')}</h3>
            <p style={{ textAlign:'center', color:'rgba(240,236,228,0.5)', fontSize:14, marginBottom:8 }}>{deleteTarget.title}</p>
            <p style={{ textAlign:'center', color:'rgba(240,236,228,0.3)', fontSize:12, marginBottom:24 }}>{t('deals.deleteConfirmText')}</p>
            <button onClick={deleteDeal} style={{ width:'100%', padding:16, borderRadius:12, border:'1px solid rgba(248,113,113,0.3)', background:'rgba(248,113,113,0.1)', color:'#f87171', fontFamily:'Cinzel, serif', fontSize:12, letterSpacing:2, cursor:'pointer', marginBottom:10 }}>
              {t('deals.confirmDelete').toUpperCase()}
            </button>
            <button onClick={() => setDeleteTarget(null)} style={{ width:'100%', padding:14, borderRadius:12, border:'1px solid rgba(255,255,255,0.1)', background:'transparent', color:'rgba(240,236,228,0.5)', fontFamily:'Cinzel, serif', fontSize:11, cursor:'pointer' }}>{t('deals.cancel').toUpperCase()}</button>
          </div>
        </div>
      )}

      {/* Create deal modal */}
      {createOpen && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', display:'flex', alignItems:'flex-end', zIndex:200 }} onClick={resetCreate}>
          <div style={{ width:'100%', maxWidth:430, margin:'0 auto', background:'#111', borderRadius:'20px 20px 0 0', border:'1px solid rgba(255,184,0,0.15)', padding:'24px 20px 48px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'center', gap:6, marginBottom:20 }}>
              {[1,2,3].map(n => (
                <div key={n} style={{ width: step===n ? 24 : 8, height:4, borderRadius:2, background: step>=n ? '#FFB800' : 'rgba(255,255,255,0.1)', transition:'all 0.3s' }}/>
              ))}
            </div>
            <h3 className='font-display' style={{ fontSize:18, color:'#FFB800', textAlign:'center', marginBottom:24 }}>{t('deals.newDealTitle')}</h3>

            {step === 1 ? (
              <>
                <label className='font-display' style={{ display:'block', fontSize:9, letterSpacing:2, color:'rgba(240,236,228,0.5)', marginBottom:8 }}>{t('deals.whatBet').toUpperCase()}</label>
                <input value={form.title} onChange={e => setForm(f => ({...f, title:e.target.value}))} placeholder={t('deals.betPlaceholder')} style={inputStyle} autoFocus />
                <button onClick={() => form.title && setStep(2)} style={{ width:'100%', padding:18, marginTop:20, borderRadius:12, border:'none', cursor:'pointer', background: form.title ? 'linear-gradient(135deg, #CC8800, #FFB800)' : '#333', color: form.title ? '#000' : 'rgba(255,255,255,0.3)', fontFamily:'Cinzel, serif', fontSize:12, fontWeight:700, letterSpacing:3 }}>{t('deals.next')}</button>
              </>
            ) : step === 2 ? (
              <>
                <label className='font-display' style={{ display:'block', fontSize:9, letterSpacing:2, color:'rgba(240,236,228,0.5)', marginBottom:8 }}>{t('deals.stake').toUpperCase()}</label>
                <input value={form.stake} onChange={e => setForm(f => ({...f, stake:e.target.value}))} placeholder={t('deals.stakePlaceholder')} style={inputStyle} autoFocus />
                <button onClick={() => setForm(f => ({...f, isPublic:!f.isPublic}))} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', width:'100%', marginTop:16, background:'none', border:'none', cursor:'pointer', padding:0 }}>
                  <span className='font-display' style={{ fontSize:11, color:'#f0ece4', letterSpacing:1 }}>{t('deals.publicDeal').toUpperCase()}</span>
                  <div style={{ width:48, height:26, borderRadius:13, background: form.isPublic ? '#CC8800' : 'rgba(255,255,255,0.1)', display:'flex', alignItems:'center', padding:3, transition:'background 0.2s' }}>
                    <div style={{ width:20, height:20, borderRadius:'50%', background:'white', marginLeft: form.isPublic ? 'auto' : 0, transition:'margin 0.2s' }}/>
                  </div>
                </button>
                <button onClick={() => form.stake && setStep(3)} style={{ width:'100%', padding:18, marginTop:20, borderRadius:12, border:'none', cursor:'pointer', background: form.stake ? 'linear-gradient(135deg, #CC8800, #FFB800)' : '#333', color: form.stake ? '#000' : 'rgba(255,255,255,0.3)', fontFamily:'Cinzel, serif', fontSize:12, fontWeight:700, letterSpacing:3 }}>{t('deals.next')}</button>
                <button onClick={() => setStep(1)} style={{ width:'100%', padding:14, marginTop:10, borderRadius:12, border:'1px solid rgba(255,255,255,0.1)', background:'transparent', color:'rgba(240,236,228,0.5)', fontFamily:'Cinzel, serif', fontSize:11, cursor:'pointer' }}>{t('deals.back').toUpperCase()}</button>
              </>
            ) : (
              <>
                <label className='font-display' style={{ display:'block', fontSize:9, letterSpacing:2, color:'rgba(240,236,228,0.5)', marginBottom:8 }}>{t('deals.inviteFriend').toUpperCase()}</label>
                {selectedFriend ? (
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 16px', background:'rgba(255,184,0,0.08)', border:'1px solid rgba(255,184,0,0.25)', borderRadius:10, marginBottom:12 }}>
                    <span style={{ color:'#FFB800', fontSize:15 }}>@{selectedFriend.username}</span>
                    <button onClick={() => setSelectedFriend(null)} style={{ background:'none', border:'none', color:'rgba(240,236,228,0.4)', cursor:'pointer', fontSize:22, lineHeight:1 }}>×</button>
                  </div>
                ) : (
                  <>
                    <input value={inviteSearch} onChange={e => searchFriends(e.target.value)} placeholder={t('deals.searchFriend')} style={{...inputStyle, marginBottom:8}} autoFocus />
                    {inviteResults.map((u: any) => (
                      <div key={u.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 0', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
                        <div>
                          <p style={{ color:'#f0ece4', fontSize:14 }}>@{u.username}</p>
                          <p style={{ color:'rgba(240,236,228,0.4)', fontSize:12 }}>Level {u.level || 1}</p>
                        </div>
                        <button onClick={() => { setSelectedFriend(u); setInviteSearch(''); setInviteResults([]) }} style={{ padding:'8px 14px', borderRadius:8, border:'1px solid rgba(255,184,0,0.3)', background:'transparent', color:'#FFB800', fontFamily:'Cinzel, serif', fontSize:10, letterSpacing:1, cursor:'pointer' }}>
                          + EINLADEN
                        </button>
                      </div>
                    ))}
                  </>
                )}
                <button onClick={createDeal} disabled={loading || !form.stake} style={{ width:'100%', padding:18, marginTop:20, borderRadius:12, border:'none', cursor:'pointer', background:'linear-gradient(135deg, #CC8800, #FFB800, #FFE566)', color:'#000', fontFamily:'Cinzel, serif', fontSize:12, fontWeight:700, letterSpacing:3 }}>
                  {loading ? '...' : t('deals.create')}
                </button>
                <button onClick={() => setStep(2)} style={{ width:'100%', padding:14, marginTop:10, borderRadius:12, border:'1px solid rgba(255,255,255,0.1)', background:'transparent', color:'rgba(240,236,228,0.5)', fontFamily:'Cinzel, serif', fontSize:11, cursor:'pointer' }}>{t('deals.back').toUpperCase()}</button>
              </>
            )}
            <button onClick={resetCreate} style={{ width:'100%', padding:14, marginTop:10, borderRadius:12, border:'1px solid rgba(255,255,255,0.06)', background:'transparent', color:'rgba(240,236,228,0.3)', fontFamily:'Cinzel, serif', fontSize:11, cursor:'pointer' }}>{t('deals.cancel').toUpperCase()}</button>
          </div>
        </div>
      )}
    </div>
  )
}
