'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useLang } from '@/contexts/LanguageContext'
import { supabase } from '@/lib/supabase'

const inputStyle: React.CSSProperties = {
  width:'100%', padding:'14px 16px', background:'#1a1a1a', border:'1px solid rgba(255,184,0,0.15)', borderRadius:10, color:'#f0ece4', fontSize:16, fontFamily:'Crimson Text, serif', outline:'none', marginBottom:4
}

export default function DealDetailPage() {
  const { id } = useParams()
  const { profile } = useAuth()
  const { t, lang } = useLang()
  const router = useRouter()
  const [deal, setDeal] = useState<any>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState({ title:'', stake:'' })
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [proposeOpen, setProposeOpen] = useState(false)
  const [resolveOpen, setResolveOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [xpToast, setXpToast] = useState<{ xp: number; coins: number } | null>(null)

  useEffect(() => { fetchDeal() }, [id])

  const fetchDeal = async () => {
    const { data } = await supabase.from('bets')
      .select('*, creator:creator_id(id,username,display_name), opponent:opponent_id(id,username,display_name), winner:winner_id(id,username), proposed_winner:proposed_winner_id(id,username)')
      .eq('id', id).single()
    setDeal(data)
  }

  if (!deal) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100dvh', background:'#060606' }}>
      <div style={{ width:32, height:32, border:'2px solid transparent', borderTopColor:'#FFB800', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>
      <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
    </div>
  )

  const STATUS_COLORS: Record<string,string> = {
    open:'#60a5fa', pending:'#FFB800', active:'#4ade80',
    completed:'rgba(240,236,228,0.3)', cancelled:'#f87171', frozen:'#a78bfa',
    pending_confirmation:'#f97316', disputed:'#ef4444'
  }
  const sc = STATUS_COLORS[deal.status] || '#60a5fa'
  const isCreator = deal.creator_id === profile?.id
  const isOpponent = deal.opponent_id === profile?.id
  const isParticipant = isCreator || isOpponent
  const cancelRequested = deal.frozen_by && deal.freeze_reason === 'cancel_request'
  const iRequestedCancel = cancelRequested && deal.frozen_by === profile?.id
  const theyRequestedCancel = cancelRequested && deal.frozen_by !== profile?.id

  // Double-confirmation state
  const iProposedWinner = deal.status === 'pending_confirmation' && deal.winner_proposed_by === profile?.id
  const theyProposedWinner = deal.status === 'pending_confirmation' && deal.winner_proposed_by !== profile?.id && isParticipant
  const isDisputed = deal.status === 'disputed'

  const accept = async () => {
    const update: any = { status: 'active' }
    if (deal.status === 'open') update.opponent_id = profile!.id
    await supabase.from('bets').update(update).eq('id', id)
    fetchDeal()
  }

  const proposeWinner = async (winnerId: string) => {
    setLoading(true)
    await supabase.from('bets').update({
      status: 'pending_confirmation',
      proposed_winner_id: winnerId,
      winner_proposed_by: profile!.id
    }).eq('id', id)
    setProposeOpen(false)
    setResolveOpen(false)
    setLoading(false)
    fetchDeal()
  }

  const confirmWinner = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('confirm-winner', {
        body: { deal_id: id }
      })
      if (error) throw error
      if (data?.xp_winner !== undefined) {
        const isWinner = deal.proposed_winner_id === profile?.id
        setXpToast({
          xp: isWinner ? (data.xp_winner || 0) : (data.xp_loser || 50),
          coins: isWinner ? 30 : 5
        })
        setTimeout(() => setXpToast(null), 4000)
      }
      fetchDeal()
    } catch (err) {
      console.error('confirm-winner error', err)
      // Fallback: direct DB update
      await supabase.from('bets').update({
        status: 'completed',
        winner_id: deal.proposed_winner_id,
        confirmed_at: new Date().toISOString()
      }).eq('id', id)
      fetchDeal()
    }
    setLoading(false)
  }

  const disputeWinner = async () => {
    await supabase.from('bets').update({
      status: 'disputed',
      proposed_winner_id: null,
      winner_proposed_by: null
    }).eq('id', id)
    fetchDeal()
  }

  const editDeal = async () => {
    if (!editForm.title || !editForm.stake) return
    setLoading(true)
    await supabase.from('bets').update({ title: editForm.title, stake: editForm.stake }).eq('id', id)
    setEditOpen(false); fetchDeal(); setLoading(false)
  }

  const deleteDeal = async () => {
    await supabase.from('bets').update({ status: 'cancelled' }).eq('id', id)
    router.back()
  }

  const requestCancel = async () => {
    await supabase.from('bets').update({
      frozen_by: profile!.id,
      freeze_reason: 'cancel_request',
      frozen_at: new Date().toISOString()
    }).eq('id', id)
    fetchDeal()
  }

  const acceptCancel = async () => {
    await supabase.from('bets').update({
      status: 'cancelled',
      frozen_by: null,
      freeze_reason: null,
      frozen_at: null
    }).eq('id', id)
    fetchDeal()
  }

  const rejectCancel = async () => {
    await supabase.from('bets').update({
      frozen_by: null,
      freeze_reason: null,
      frozen_at: null
    }).eq('id', id)
    fetchDeal()
  }

  const shareDeal = async () => {
    const shareUrl = `${window.location.origin}/app/deals/${id}`
    const shareData = {
      title: `DealBuddy: ${deal.title}`,
      text: `${t('deals.shareText')} – ${deal.title}`,
      url: shareUrl,
    }
    try {
      if (navigator.share) {
        await navigator.share(shareData)
      } else {
        await navigator.clipboard.writeText(shareUrl)
        alert(lang === 'de' ? 'Link kopiert! 🔗' : 'Link copied! 🔗')
      }
    } catch {
      // user cancelled share
    }
  }

  const requesterUsername = cancelRequested
    ? (deal.frozen_by === deal.creator_id ? deal.creator?.username : deal.opponent?.username)
    : ''

  const proposerUsername = deal.winner_proposed_by === deal.creator_id
    ? deal.creator?.username
    : deal.opponent?.username

  const btnPrimary: React.CSSProperties = {
    width:'100%', padding:18, borderRadius:12, border:'none', cursor:'pointer',
    background:'linear-gradient(135deg, #CC8800, #FFB800)', color:'#000',
    fontFamily:'Cinzel, serif', fontSize:12, fontWeight:700, letterSpacing:2
  }
  const btnOutline: React.CSSProperties = {
    width:'100%', padding:14, borderRadius:12, border:'1px solid rgba(255,255,255,0.1)',
    background:'transparent', color:'rgba(240,236,228,0.5)',
    fontFamily:'Cinzel, serif', fontSize:11, cursor:'pointer'
  }

  return (
    <div style={{ minHeight:'100dvh', background:'#060606', paddingTop:60 }}>
      {/* XP Toast */}
      {xpToast && (
        <div style={{ position:'fixed', top:80, left:'50%', transform:'translateX(-50%)', background:'linear-gradient(135deg, #CC8800, #FFB800)', borderRadius:12, padding:'12px 24px', zIndex:300, display:'flex', gap:16, alignItems:'center', boxShadow:'0 8px 32px rgba(255,184,0,0.4)' }}>
          <span style={{ fontSize:14, fontFamily:'Cinzel, serif', color:'#000', fontWeight:700 }}>+{xpToast.xp} XP</span>
          <span style={{ fontSize:14, fontFamily:'Cinzel, serif', color:'#000', fontWeight:700 }}>+{xpToast.coins} 🪙</span>
        </div>
      )}

      {/* Header */}
      <div style={{ padding:'0 20px 24px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <button onClick={() => router.back()} style={{ background:'none', border:'none', color:'rgba(240,236,228,0.5)', cursor:'pointer', fontSize:20, padding:0 }}>←</button>
          <h1 className='font-display' style={{ fontSize:20, color:'#f0ece4' }}>Deal</h1>
        </div>
        <button onClick={shareDeal} style={{ background:'none', border:'1px solid rgba(255,184,0,0.2)', borderRadius:8, color:'rgba(240,236,228,0.6)', cursor:'pointer', fontSize:12, padding:'8px 14px', fontFamily:'Cinzel, serif', letterSpacing:1 }}>
          {t('deals.share')}
        </button>
      </div>

      <div style={{ margin:'0 16px', background:'#111', borderRadius:14, border:`1px solid ${sc}33`, padding:'20px' }}>
        {/* Status + edit/delete row */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
          <div style={{ padding:'4px 12px', borderRadius:20, border:`1px solid ${sc}44`, background:`${sc}15`, display:'inline-block' }}>
            <span className='font-display' style={{ fontSize:9, letterSpacing:1.5, color:sc }}>
              {t(`deals.status.${deal.status}`) || deal.status.toUpperCase()}
            </span>
          </div>
          {isCreator && deal.status === 'open' && (
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={() => { setEditForm({ title:deal.title, stake:deal.stake||'' }); setEditOpen(true) }} style={{ background:'none', border:'none', cursor:'pointer', fontSize:20, padding:'2px 6px' }}>✏️</button>
              <button onClick={() => setDeleteOpen(true)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:20, padding:'2px 6px' }}>🗑️</button>
            </div>
          )}
        </div>

        <h2 style={{ fontSize:20, color:'#f0ece4', fontWeight:600, marginBottom:8 }}>{deal.title}</h2>
        {deal.stake && <p style={{ fontSize:15, color:'rgba(240,236,228,0.5)', marginBottom:20 }}>{lang === 'de' ? 'Einsatz:' : 'Stake:'} {deal.stake}</p>}

        {/* VS */}
        <div style={{ display:'flex', alignItems:'center', gap:12, padding:'16px 0', borderTop:'1px solid rgba(255,255,255,0.05)', borderBottom:'1px solid rgba(255,255,255,0.05)', marginBottom:20 }}>
          <div style={{ flex:1, textAlign:'center' }}>
            <div style={{ width:48, height:48, borderRadius:'50%', background:'linear-gradient(135deg, #CC8800, #FFB800)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 8px' }}>
              <span className='font-display' style={{ fontSize:16, color:'#000', fontWeight:700 }}>{(deal.creator?.username||'U').slice(0,2).toUpperCase()}</span>
            </div>
            <p style={{ fontSize:13, color:'#f0ece4' }}>@{deal.creator?.username}</p>
          </div>
          <span className='font-display' style={{ fontSize:14, color:'#CC8800' }}>VS</span>
          <div style={{ flex:1, textAlign:'center' }}>
            {deal.opponent ? (
              <>
                <div style={{ width:48, height:48, borderRadius:'50%', background:'rgba(255,255,255,0.1)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 8px' }}>
                  <span className='font-display' style={{ fontSize:16, color:'rgba(240,236,228,0.5)', fontWeight:700 }}>{(deal.opponent?.username||'U').slice(0,2).toUpperCase()}</span>
                </div>
                <p style={{ fontSize:13, color:'#f0ece4' }}>@{deal.opponent?.username}</p>
              </>
            ) : (
              <div style={{ padding:'16px 0', color:'rgba(240,236,228,0.3)', fontSize:13, fontStyle:'italic' }}>
                {deal.status === 'pending' ? t('deals.pendingInvite') : (lang === 'de' ? 'Offen...' : 'Open...')}
              </div>
            )}
          </div>
        </div>

        {/* Winner banner */}
        {deal.status === 'completed' && deal.winner_id && (
          <div style={{ textAlign:'center', padding:'14px', background:'rgba(255,184,0,0.06)', borderRadius:10, border:'1px solid rgba(255,184,0,0.2)', marginBottom:16 }}>
            <p style={{ fontSize:14, color:'#FFB800' }}>🏆 @{deal.winner?.username} {lang === 'de' ? 'hat gewonnen' : 'won'}</p>
          </div>
        )}

        {/* Accept open or pending-invited deal */}
        {((deal.status === 'open' && !isParticipant) || (deal.status === 'pending' && isOpponent)) && (
          <button onClick={accept} style={btnPrimary}>
            {lang === 'de' ? 'DEAL ANNEHMEN 🤝' : 'ACCEPT DEAL 🤝'}
          </button>
        )}

        {/* Cancel request banner */}
        {(deal.status === 'active' || deal.status === 'pending_confirmation') && cancelRequested && isParticipant && (
          <div style={{ padding:'14px', background:'rgba(248,113,113,0.06)', borderRadius:10, border:'1px solid rgba(248,113,113,0.2)', marginBottom:12 }}>
            {iRequestedCancel ? (
              <p style={{ textAlign:'center', color:'rgba(240,236,228,0.5)', fontSize:13 }}>
                {lang === 'de' ? '⏳ Abbruch angefragt – warte auf Zustimmung...' : '⏳ Cancel requested – waiting for consent...'}
              </p>
            ) : theyRequestedCancel ? (
              <>
                <p style={{ textAlign:'center', color:'#f87171', fontSize:13, marginBottom:12 }}>
                  @{requesterUsername} {lang === 'de' ? 'möchte diesen Deal abbrechen' : 'wants to cancel this deal'}
                </p>
                <div style={{ display:'flex', gap:8 }}>
                  <button onClick={acceptCancel} style={{ flex:1, padding:'11px', borderRadius:8, border:'1px solid rgba(248,113,113,0.35)', background:'rgba(248,113,113,0.1)', color:'#f87171', fontFamily:'Cinzel, serif', fontSize:10, letterSpacing:1, cursor:'pointer' }}>
                    {t('deals.acceptCancel').toUpperCase()}
                  </button>
                  <button onClick={rejectCancel} style={{ flex:1, padding:'11px', borderRadius:8, border:'1px solid rgba(255,255,255,0.1)', background:'transparent', color:'rgba(240,236,228,0.5)', fontFamily:'Cinzel, serif', fontSize:10, letterSpacing:1, cursor:'pointer' }}>
                    {t('deals.rejectCancel').toUpperCase()}
                  </button>
                </div>
              </>
            ) : null}
          </div>
        )}

        {/* ACTIVE: propose winner */}
        {deal.status === 'active' && isParticipant && !cancelRequested && (
          <div>
            <button onClick={() => setProposeOpen(true)} style={btnPrimary}>
              {t('deals.proposeWinner').toUpperCase()} 🏆
            </button>
            <button onClick={requestCancel} style={{ ...btnOutline, marginTop:10 }}>
              {t('deals.requestCancel').toUpperCase()}
            </button>
          </div>
        )}

        {/* PENDING_CONFIRMATION: waiting for other party */}
        {deal.status === 'pending_confirmation' && isParticipant && !cancelRequested && (
          <div>
            {iProposedWinner ? (
              <div style={{ padding:'16px', background:'rgba(249,115,22,0.06)', borderRadius:10, border:'1px solid rgba(249,115,22,0.2)', textAlign:'center' }}>
                <p style={{ fontSize:22, marginBottom:8 }}>⏳</p>
                <p className='font-display' style={{ fontSize:11, letterSpacing:2, color:'#f97316', marginBottom:6 }}>
                  {t('deals.pendingConfirmationTitle').toUpperCase()}
                </p>
                <p style={{ fontSize:13, color:'rgba(240,236,228,0.5)' }}>
                  {lang === 'de'
                    ? `Du hast vorgeschlagen: @${deal.proposed_winner?.username} hat gewonnen`
                    : `You proposed: @${deal.proposed_winner?.username} won`}
                </p>
              </div>
            ) : theyProposedWinner ? (
              <div>
                <div style={{ padding:'14px', background:'rgba(249,115,22,0.06)', borderRadius:10, border:'1px solid rgba(249,115,22,0.2)', textAlign:'center', marginBottom:12 }}>
                  <p style={{ fontSize:13, color:'rgba(240,236,228,0.7)', marginBottom:4 }}>
                    @{proposerUsername} {t('deals.pendingConfirmationText')}
                  </p>
                  <p style={{ fontSize:16, color:'#FFB800', fontWeight:700 }}>
                    @{deal.proposed_winner?.username} {t('deals.pendingConfirmationWon')}
                  </p>
                </div>
                <div style={{ display:'flex', gap:8 }}>
                  <button
                    onClick={confirmWinner}
                    disabled={loading}
                    style={{ flex:1, padding:'16px', borderRadius:12, border:'none', cursor:'pointer', background:'linear-gradient(135deg, #166534, #16a34a)', color:'#fff', fontFamily:'Cinzel, serif', fontSize:11, letterSpacing:1.5, fontWeight:700 }}
                  >
                    {loading ? '...' : t('deals.confirmWinner').toUpperCase()}
                  </button>
                  <button
                    onClick={disputeWinner}
                    disabled={loading}
                    style={{ flex:1, padding:'16px', borderRadius:12, border:'1px solid rgba(248,113,113,0.3)', background:'rgba(248,113,113,0.08)', color:'#f87171', fontFamily:'Cinzel, serif', fontSize:11, letterSpacing:1.5, cursor:'pointer' }}
                  >
                    {t('deals.disputeWinner').toUpperCase()}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* DISPUTED: resolve */}
        {deal.status === 'disputed' && isParticipant && (
          <div>
            <div style={{ padding:'14px', background:'rgba(239,68,68,0.06)', borderRadius:10, border:'1px solid rgba(239,68,68,0.2)', textAlign:'center', marginBottom:12 }}>
              <p style={{ fontSize:20, marginBottom:6 }}>⚔️</p>
              <p className='font-display' style={{ fontSize:11, letterSpacing:2, color:'#ef4444', marginBottom:4 }}>{t('deals.disputedTitle').toUpperCase()}</p>
              <p style={{ fontSize:13, color:'rgba(240,236,228,0.5)' }}>{t('deals.disputedText')}</p>
            </div>
            <button onClick={() => setResolveOpen(true)} style={{ ...btnPrimary, background:'linear-gradient(135deg, #991b1b, #ef4444)' }}>
              {t('deals.resolveDispute').toUpperCase()} ⚔️
            </button>
          </div>
        )}
      </div>

      {/* Propose Winner Modal */}
      {(proposeOpen || resolveOpen) && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', display:'flex', alignItems:'flex-end', zIndex:200 }} onClick={() => { setProposeOpen(false); setResolveOpen(false) }}>
          <div style={{ width:'100%', maxWidth:430, margin:'0 auto', background:'#111', borderRadius:'20px 20px 0 0', border:'1px solid rgba(255,184,0,0.15)', padding:'24px 20px 48px' }} onClick={e => e.stopPropagation()}>
            <h3 className='font-display' style={{ fontSize:18, color:'#FFB800', textAlign:'center', marginBottom:6 }}>
              {resolveOpen ? t('deals.resolveDispute') : t('deals.proposeWinnerTitle')}
            </h3>
            <p style={{ textAlign:'center', fontSize:13, color:'rgba(240,236,228,0.4)', marginBottom:24 }}>
              {t('deals.proposeWinnerText')}
            </p>
            {[deal.creator, deal.opponent].filter(Boolean).map((p: any) => (
              <button
                key={p.id}
                onClick={() => proposeWinner(p.id)}
                disabled={loading}
                style={{ width:'100%', padding:18, borderRadius:12, border:'1px solid rgba(255,184,0,0.2)', background: p.id === profile?.id ? 'rgba(255,184,0,0.12)' : 'rgba(255,255,255,0.04)', color:'#FFB800', fontFamily:'Cinzel, serif', fontSize:13, letterSpacing:2, marginBottom:10, cursor:'pointer' }}
              >
                {p.id === profile?.id ? `${t('deals.iWon').toUpperCase()} (${p.username})` : `@${p.username} ${t('deals.theyWon').toUpperCase()}`}
              </button>
            ))}
            <button onClick={() => { setProposeOpen(false); setResolveOpen(false) }} style={btnOutline}>
              {t('deals.cancel').toUpperCase()}
            </button>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editOpen && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', display:'flex', alignItems:'flex-end', zIndex:200 }} onClick={() => setEditOpen(false)}>
          <div style={{ width:'100%', maxWidth:430, margin:'0 auto', background:'#111', borderRadius:'20px 20px 0 0', border:'1px solid rgba(255,184,0,0.15)', padding:'24px 20px 48px' }} onClick={e => e.stopPropagation()}>
            <h3 className='font-display' style={{ fontSize:18, color:'#FFB800', textAlign:'center', marginBottom:24 }}>{t('deals.editDeal')}</h3>
            <label className='font-display' style={{ display:'block', fontSize:9, letterSpacing:2, color:'rgba(240,236,228,0.5)', marginBottom:8 }}>{t('deals.whatBet').toUpperCase()}</label>
            <input value={editForm.title} onChange={e => setEditForm(f => ({...f, title:e.target.value}))} style={inputStyle} />
            <label className='font-display' style={{ display:'block', fontSize:9, letterSpacing:2, color:'rgba(240,236,228,0.5)', marginBottom:8, marginTop:12 }}>{t('deals.stake').toUpperCase()}</label>
            <input value={editForm.stake} onChange={e => setEditForm(f => ({...f, stake:e.target.value}))} style={inputStyle} />
            <button onClick={editDeal} disabled={loading} style={{ ...btnPrimary, marginTop:20 }}>
              {loading ? '...' : t('deals.save')}
            </button>
            <button onClick={() => setEditOpen(false)} style={{ ...btnOutline, marginTop:10 }}>{t('deals.cancel').toUpperCase()}</button>
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      {deleteOpen && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', display:'flex', alignItems:'flex-end', zIndex:200 }} onClick={() => setDeleteOpen(false)}>
          <div style={{ width:'100%', maxWidth:430, margin:'0 auto', background:'#111', borderRadius:'20px 20px 0 0', border:'1px solid rgba(255,255,255,0.08)', padding:'24px 20px 48px' }} onClick={e => e.stopPropagation()}>
            <h3 className='font-display' style={{ fontSize:18, color:'#f87171', textAlign:'center', marginBottom:8 }}>{t('deals.deleteConfirmTitle')}</h3>
            <p style={{ textAlign:'center', color:'rgba(240,236,228,0.5)', fontSize:14, marginBottom:8 }}>{deal.title}</p>
            <p style={{ textAlign:'center', color:'rgba(240,236,228,0.3)', fontSize:12, marginBottom:24 }}>{t('deals.deleteConfirmText')}</p>
            <button onClick={deleteDeal} style={{ width:'100%', padding:16, borderRadius:12, border:'1px solid rgba(248,113,113,0.3)', background:'rgba(248,113,113,0.1)', color:'#f87171', fontFamily:'Cinzel, serif', fontSize:12, letterSpacing:2, cursor:'pointer', marginBottom:10 }}>
              {t('deals.confirmDelete').toUpperCase()}
            </button>
            <button onClick={() => setDeleteOpen(false)} style={btnOutline}>{t('deals.cancel').toUpperCase()}</button>
          </div>
        </div>
      )}
    </div>
  )
}
