'use client'
import { useState, useEffect, Suspense } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useLang } from '@/contexts/LanguageContext'
import { supabase } from '@/lib/supabase'
import { useSearchParams, useRouter } from 'next/navigation'
import FeedDealCard from '@/components/feed/FeedDealCard'
import InteractionBar from '@/components/InteractionBar'
import CommentSheet from '@/components/CommentSheet'
import DealChallengeWidget from '@/components/DealChallengeWidget'
import { trackDealCancelled, trackResultSubmitted, trackScreenView } from '@/lib/analytics'

const inputStyle: React.CSSProperties = {
  width:'100%', padding:'14px 16px', background:'var(--bg-elevated)',
  border:'1px solid var(--border-subtle)', borderRadius:10, color:'var(--text-primary)',
  fontSize:16, fontFamily:'var(--font-body)', outline:'none',
  boxSizing:'border-box',
}

function DealsContent() {
  const { profile } = useAuth()
  const { t } = useLang()
  const searchParams = useSearchParams()
  const router = useRouter()

  const [deals, setDeals] = useState<any[]>([])
  const [declareTarget, setDeclareTarget] = useState<any>(null)
  const [editTarget, setEditTarget] = useState<any>(null)
  const [editForm, setEditForm] = useState({ title:'', stake:'' })
  const [deleteTarget, setDeleteTarget] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [commentDealId, setCommentDealId] = useState<string | null>(null)
  const [commentSheetOpen, setCommentSheetOpen] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Redirect ?new=1 or ?opponent=... to the new create page
  useEffect(() => {
    const isNew = searchParams.get('new') === '1'
    const opponent = searchParams.get('opponent')
    if (isNew && opponent) {
      router.replace(`/app/deals/create?opponent=${opponent}`)
    } else if (isNew) {
      router.replace('/app/deals/create')
    } else if (opponent) {
      router.replace(`/app/deals/create?opponent=${opponent}`)
    }
  }, [searchParams, router])

  useEffect(() => { trackScreenView('deals') }, [])

  useEffect(() => {
    if (profile) fetchDeals()
  }, [profile])

  const fetchDeals = async () => {
    const { data } = await supabase.from('challenges')
      .select('*, creator:creator_id(id,username,display_name,level,streak,active_frame,is_founder,avatar_url), opponent:opponent_id(id,username,display_name,level,streak,active_frame,is_founder,avatar_url)')
      .or(`creator_id.eq.${profile!.id},opponent_id.eq.${profile!.id}`)
      .order('created_at', { ascending: false })
    setDeals(data || [])
  }

  const editDeal = async () => {
    if (!editTarget || !editForm.title || !editForm.stake) return
    setLoading(true)
    try {
      const { error } = await supabase.from('challenges').update({ title: editForm.title, stake: editForm.stake }).eq('id', editTarget.id)
      if (error) throw error
      setEditTarget(null); fetchDeals()
    } catch (_err) { /* edit error */ }
    setLoading(false)
  }

  const deleteDeal = async () => {
    if (!deleteTarget) return
    setLoading(true)
    try {
      const { error } = await supabase.from('challenges').update({ status: 'cancelled' }).eq('id', deleteTarget.id)
      if (error) throw error
      trackDealCancelled(deleteTarget.id)
      setDeleteTarget(null); fetchDeals()
    } catch (_err) { /* delete error */ }
    setLoading(false)
  }

  const declareResult = async (challengeId: string, winnerId: string) => {
    setLoading(true)
    try {
      const { error } = await supabase.from('challenges').update({ status:'pending_confirmation', proposed_winner_id:winnerId, winner_proposed_by:profile!.id }).eq('id', challengeId)
      if (error) throw error
      trackResultSubmitted(challengeId)
      setDeclareTarget(null); fetchDeals()
    } catch (_err) { /* declare error */ }
    setLoading(false)
  }

  return (
    <div style={{ minHeight:'100dvh', background:'var(--bg-base)', color:'var(--text-primary)' }}>
      {/* Header */}
      <div style={{ padding:'60px 20px 16px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <h1 style={{ fontFamily:'var(--font-display)', fontSize:22, color:'var(--text-primary)', fontWeight:700, letterSpacing:2 }}>{t('home.myDeals').toUpperCase()}</h1>
        <button
          onClick={() => router.push('/app/deals/create')}
          style={{ padding:'10px 20px', borderRadius:10, border:'none', cursor:'pointer', background:'linear-gradient(135deg, var(--gold-dim), var(--gold-primary))', color:'var(--text-inverse)', fontFamily:'var(--font-display)', fontSize:11, fontWeight:700, letterSpacing:2 }}
        >{'\u{26A1}'} {t('home.newDeal').toUpperCase()}</button>
      </div>

      {/* Deal List */}
      <div style={{ padding:'0 16px 100px', display:'flex', flexDirection:'column', gap:12 }}>
        {deals.length === 0 ? (
          <div style={{ textAlign:'center', padding:'60px 0' }}>
            <div style={{ fontSize:48, marginBottom:12 }}>{'\u26A1'}</div>
            <p style={{ fontFamily:'var(--font-display)', fontSize:16, color:'var(--text-secondary)', marginBottom:8 }}>{t('home.noDealsYet')}</p>
            <p style={{ fontSize:14, color:'var(--text-muted)' }}>{t('home.challengeFriend')}</p>
          </div>
        ) : deals.map((deal: any) => (
          <div key={deal.id} style={{ position:'relative' }}>
            <div style={{ borderRadius: 16, overflow: 'hidden' }}>
              <FeedDealCard
                deal={deal}
                expanded={expandedId === deal.id}
                onToggleExpand={() => setExpandedId(expandedId === deal.id ? null : deal.id)}
                feedEvents={[]}
                feedMedia={{}}
                challengeQuotes={{}}
                onCommentOpen={(dealId) => { setCommentDealId(dealId); setCommentSheetOpen(true) }}
                userId={profile?.id || ''}
              />
            </div>
            {deal.status === 'active' && (deal.creator_id === profile?.id || deal.opponent_id === profile?.id) && (
              <button onClick={() => setDeclareTarget(deal)}
                style={{ width:'100%', marginTop:-4, padding:'10px', borderRadius:'0 0 12px 12px', border:'none', borderTop:'1px solid var(--bg-elevated)', background:'var(--gold-subtle)', color:'var(--gold-primary)', fontFamily:'var(--font-display)', fontSize:10, letterSpacing:1, cursor:'pointer' }}>
                {'\u2694\uFE0F'} {t('deals.reportResultBtn')}
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Declare Winner Modal */}
      {declareTarget && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.88)', display:'flex', alignItems:'flex-end', zIndex:300 }} onClick={() => setDeclareTarget(null)}>
          <div style={{ width:'100%', maxWidth:480, margin:'0 auto', background:'var(--bg-surface)', borderRadius:'20px 20px 0 0', border:'1px solid var(--border-subtle)', padding:'24px 20px 48px' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontFamily:'var(--font-display)', fontSize:18, color:'var(--gold-primary)', textAlign:'center', marginBottom:8 }}>{'\u2694\uFE0F'} {t('deals.proposeResult')}</h3>
            <p style={{ textAlign:'center', color:'var(--text-secondary)', fontSize:14, marginBottom:4 }}>{declareTarget.title}</p>
            <p style={{ textAlign:'center', color:'var(--text-muted)', fontSize:11, marginBottom:24 }}>{t('deals.opponentMustConfirm')}</p>
            {[declareTarget.creator, declareTarget.opponent].filter(Boolean).map((p: any) => (
              <button key={p.id} onClick={() => declareResult(declareTarget.id, p.id)} disabled={loading} style={{ width:'100%', padding:16, borderRadius:12, border:'none', cursor: loading ? 'wait' : 'pointer', background:'linear-gradient(135deg, var(--gold-dim), var(--gold-primary))', color:'var(--text-inverse)', fontFamily:'var(--font-display)', fontSize:12, fontWeight:700, letterSpacing:2, marginBottom:10, opacity: loading ? 0.6 : 1 }}>{loading ? '...' : `\u{1F3C6} @${p.username}`}</button>
            ))}
            <button onClick={() => setDeclareTarget(null)} style={{ width:'100%', padding:14, borderRadius:12, border:'1px solid var(--bg-elevated)', background:'transparent', color:'var(--text-muted)', fontFamily:'var(--font-display)', fontSize:11, cursor:'pointer', marginTop:4 }}>{t('common.cancel')}</button>
          </div></div>)}

      {/* Edit Modal */}
      {editTarget && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.88)', display:'flex', alignItems:'flex-end', zIndex:300 }} onClick={() => setEditTarget(null)}>
          <div style={{ width:'100%', maxWidth:480, margin:'0 auto', background:'var(--bg-surface)', borderRadius:'20px 20px 0 0', border:'1px solid var(--border-subtle)', padding:'24px 20px 48px' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontFamily:'var(--font-display)', fontSize:18, color:'var(--gold-primary)', textAlign:'center', marginBottom:24 }}>{t('deals.editTitle')}</h3>
            <label style={{ display:'block', fontSize:10, fontFamily:'var(--font-display)', letterSpacing:2, color:'var(--text-muted)', marginBottom:8 }}>{t('deals.titleLabel')}</label>
            <input value={editForm.title} onChange={e => setEditForm(f => ({...f, title:e.target.value}))} style={inputStyle} />
            <label style={{ display:'block', fontSize:10, fontFamily:'var(--font-display)', letterSpacing:2, color:'var(--text-muted)', marginBottom:8, marginTop:16 }}>{t('deals.stakeLabel')}</label>
            <input value={editForm.stake} onChange={e => setEditForm(f => ({...f, stake:e.target.value}))} style={inputStyle} />
            <button onClick={editDeal} disabled={loading} style={{ width:'100%', padding:18, marginTop:20, borderRadius:12, border:'none', cursor:'pointer', background:'linear-gradient(135deg, var(--gold-dim), var(--gold-primary))', color:'var(--text-inverse)', fontFamily:'var(--font-display)', fontSize:12, fontWeight:700, letterSpacing:3 }}>{loading ? '...' : t('deals.saveBtn')}</button>
            <button onClick={() => setEditTarget(null)} style={{ width:'100%', padding:14, marginTop:10, borderRadius:12, border:'1px solid var(--bg-elevated)', background:'transparent', color:'var(--text-muted)', fontFamily:'var(--font-display)', fontSize:11, cursor:'pointer' }}>{t('common.cancel')}</button>
          </div></div>)}

      {/* Delete Modal */}
      {deleteTarget && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.88)', display:'flex', alignItems:'flex-end', zIndex:300 }} onClick={() => setDeleteTarget(null)}>
          <div style={{ width:'100%', maxWidth:480, margin:'0 auto', background:'var(--bg-surface)', borderRadius:'20px 20px 0 0', border:'1px solid var(--border-subtle)', padding:'24px 20px 48px' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontFamily:'var(--font-display)', fontSize:18, color:'var(--status-error)', textAlign:'center', marginBottom:8 }}>{t('deals.deleteTitle')}</h3>
            <p style={{ textAlign:'center', color:'var(--text-secondary)', fontSize:14, marginBottom:24 }}>{deleteTarget.title}</p>
            <button onClick={deleteDeal} disabled={loading} style={{ width:'100%', padding:16, borderRadius:12, border:'1px solid rgba(248,113,113,0.3)', background:'rgba(248,113,113,0.1)', color:'var(--status-error)', fontFamily:'var(--font-display)', fontSize:12, letterSpacing:2, cursor: loading ? 'wait' : 'pointer', marginBottom:10, opacity: loading ? 0.6 : 1 }}>{loading ? '...' : t('deals.deleteBtn')}</button>
            <button onClick={() => setDeleteTarget(null)} style={{ width:'100%', padding:14, borderRadius:12, border:'1px solid var(--bg-elevated)', background:'transparent', color:'var(--text-muted)', fontFamily:'var(--font-display)', fontSize:11, cursor:'pointer' }}>{t('common.cancel')}</button>
          </div></div>)}

      {/* Comment Sheet */}
      {commentDealId && (
        <CommentSheet dealId={commentDealId} open={commentSheetOpen} onClose={() => { setCommentSheetOpen(false); setCommentDealId(null) }} />
      )}
    </div>
  )
}

export default function DealsPage() {
  return (
    <Suspense fallback={<div style={{ minHeight:'100dvh', background:'var(--bg-base)' }} />}>
      <DealsContent />
    </Suspense>
  )
}
