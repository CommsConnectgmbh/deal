'use client'
import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useLang } from '@/contexts/LanguageContext'
import { supabase } from '@/lib/supabase'
import ProfileImage from '@/components/ProfileImage'
import { triggerPush } from '@/lib/sendPushNotification'
import CommentSheet from '@/components/CommentSheet'
import ProofUploadSheet from '@/components/ProofUploadSheet'
import ShareCardGenerator from '@/components/ShareCardGenerator'
import WinCardShare from '@/components/WinCardShare'
import CoinIcon from '@/components/CoinIcon'
import InteractionBar from '@/components/InteractionBar'
import DealBetWidget from '@/components/DealBetWidget'
import { trackDealAccepted, trackResultSubmitted, trackResultConfirmed, trackScreenView, trackShareClicked } from '@/lib/analytics'
import { uploadDealMedia as uploadDealMediaUtil } from '@/lib/mediaUpload'

/* ─── Constants ─── */
const STATUS_COLORS: Record<string, string> = {
  open: '#FFB800', pending: '#f97316', active: '#4ade80',
  pending_confirmation: '#a78bfa', completed: '#9ca3af',
  cancelled: '#9ca3af', disputed: '#ef4444', frozen: '#6b7280',
}
const STATUS_LABELS: Record<string, string> = {
  open: 'OFFEN', pending: 'EINGELADEN', active: 'AKTIV',
  pending_confirmation: 'BESTÄTIGUNG', completed: 'ABGESCHLOSSEN',
  cancelled: 'ABGEBROCHEN', disputed: 'DISPUTE', frozen: 'EINGEFROREN',
}
/* ─── Countdown Hook ─── */
function useCountdown(deadline: string | null | undefined) {
  const [remaining, setRemaining] = useState('')
  const [isExpired, setIsExpired] = useState(false)
  const [isUrgent, setIsUrgent] = useState(false)
  useEffect(() => {
    if (!deadline) return
    const tick = () => {
      const diff = new Date(deadline).getTime() - Date.now()
      if (diff <= 0) { setRemaining('Abgelaufen'); setIsExpired(true); return }
      const d = Math.floor(diff / 86400000)
      const h = Math.floor((diff % 86400000) / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      setIsUrgent(diff < 3600000)
      if (d > 0) setRemaining(`Endet in ${d} ${d === 1 ? 'Tag' : 'Tagen'}`)
      else if (h > 0) setRemaining(`Noch ${h} ${h === 1 ? 'Stunde' : 'Stunden'}`)
      else setRemaining(`Noch ${m} Min.`)
    }
    tick()
    const iv = setInterval(tick, 1000)
    return () => clearInterval(iv)
  }, [deadline])
  return { remaining, isExpired, isUrgent }
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'gerade eben'
  if (m < 60) return `${m} Min.`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} Std.`
  const d = Math.floor(h / 24)
  return `${d} Tag${d !== 1 ? 'e' : ''}`
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '14px 16px', background: 'var(--bg-elevated)',
  border: '1px solid var(--border-subtle)', borderRadius: 10,
  color: 'var(--text-primary)', fontSize: 16, fontFamily: 'var(--font-body)',
  outline: 'none', marginBottom: 4, boxSizing: 'border-box',
}
const btnPrimary: React.CSSProperties = {
  width: '100%', padding: 18, borderRadius: 12, border: 'none', cursor: 'pointer',
  background: 'linear-gradient(135deg, var(--gold-dim), var(--gold-primary))', color: 'var(--text-inverse)',
  fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 700, letterSpacing: 2,
}
const btnOutline: React.CSSProperties = {
  width: '100%', padding: 14, borderRadius: 12, border: '1px solid var(--border-subtle)',
  background: 'transparent', color: 'var(--text-secondary)',
  fontFamily: 'var(--font-display)', fontSize: 11, cursor: 'pointer',
}

/* ═══════════════════════════════════════════ */
export default function DealDetailPage() {
  const { id } = useParams()
  const { profile } = useAuth()
  const { t, lang } = useLang()
  const router = useRouter()

  const [deal, setDeal] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [xpToast, setXpToast] = useState<{ xp: number; coins: number } | null>(null)
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [commentCount, setCommentCount] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState({ title: '', stake: '' })
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [proposeOpen, setProposeOpen] = useState(false)
  const [resolveOpen, setResolveOpen] = useState(false)
  const [proofOpen, setProofOpen] = useState(false)
  const [proofType, setProofType] = useState<'winner_proof' | 'dispute_proof'>('winner_proof')
  const [pendingWinnerId, setPendingWinnerId] = useState<string | null>(null)
  const [proofs, setProofs] = useState<any[]>([])
  const [proofPreview, setProofPreview] = useState<{ url: string; type: string } | null>(null)
  const [shareCardOpen, setShareCardOpen] = useState(false)
  const [showShareCard, setShowShareCard] = useState(false)
  const [dealResult, setDealResult] = useState<any>(null)
  const [autoConfirmCountdown, setAutoConfirmCountdown] = useState('')
  const [dealMedia, setDealMedia] = useState<any[]>([])
  const [mediaUploading, setMediaUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadStatus, setUploadStatus] = useState<string | null>(null)
  const [mediaPreview, setMediaPreview] = useState<{ url: string; type: string } | null>(null)
  const [postedToProfile, setPostedToProfile] = useState(false)
  const [storyPosted, setStoryPosted] = useState(false)
  const [storyConfirmOpen, setStoryConfirmOpen] = useState(false)
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false)
  const [confirmAcceptCancelOpen, setConfirmAcceptCancelOpen] = useState(false)
  const [confirmHardDeleteOpen, setConfirmHardDeleteOpen] = useState(false)
  const mediaInputRef = useRef<HTMLInputElement>(null)
  const { remaining: countdownRemaining, isExpired: countdownExpired, isUrgent: countdownUrgent } = useCountdown(deal?.deadline)
  const [actionToast, setActionToast] = useState<string | null>(null)
  const [actionToastType, setActionToastType] = useState<'success' | 'error'>('success')
  const [fulfillment, setFulfillment] = useState<{
    id: string; status: string; entitled_user_id: string; obligated_user_id: string;
  } | null>(null)
  const [fulfillmentLoading, setFulfillmentLoading] = useState(false)

  const showActionToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setActionToast(msg); setActionToastType(type)
  }

  useEffect(() => {
    if (actionToast) { const t = setTimeout(() => setActionToast(null), 3000); return () => clearTimeout(t) }
  }, [actionToast])

  useEffect(() => { trackScreenView('deal_detail'); fetchDeal(); fetchProofs(); fetchDealMedia() }, [id])

  // Auto-confirm countdown timer
  useEffect(() => {
    if (!dealResult?.auto_confirm_at) return
    const update = () => {
      const remaining = new Date(dealResult.auto_confirm_at).getTime() - Date.now()
      if (remaining <= 0) {
        setAutoConfirmCountdown('Auto-Bestätigung fällig')
        return
      }
      const hours = Math.floor(remaining / 3600000)
      const mins = Math.floor((remaining % 3600000) / 60000)
      setAutoConfirmCountdown(`Auto-Bestätigung in ${hours}h ${mins}m`)
    }
    update()
    const interval = setInterval(update, 60000)
    return () => clearInterval(interval)
  }, [dealResult])

  const fetchProofs = async () => {
    const { data } = await supabase.from('deal_proofs')
      .select('*')
      .eq('deal_id', id)
      .order('created_at', { ascending: true })
    setProofs(data || [])
  }

  const fetchDeal = async () => {
    const { data } = await supabase.from('bets')
      .select('*, creator:creator_id(id,username,display_name,level,streak,active_frame,is_founder,avatar_url), opponent:opponent_id(id,username,display_name,level,streak,active_frame,is_founder,avatar_url), winner:winner_id(id,username), proposed_winner:proposed_winner_id(id,username)')
      .eq('id', id).single()
    setDeal(data)
    // Check per-user story posted status
    if (data && profile) {
      const { count } = await supabase.from('feed_events')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', profile.id)
        .eq('deal_id', data.id)
        .in('event_type', ['win_story', 'deal_story'])
      if (count && count > 0) setStoryPosted(true)
    }

    // Also load deal result if pending confirmation
    if (data?.status === 'pending_confirmation') {
      const { data: resultData } = await supabase
        .from('deal_results')
        .select('*')
        .eq('deal_id', data.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      setDealResult(resultData)
    }

    // Fetch fulfillment status
    const { data: bfData } = await supabase
      .from('bet_fulfillment')
      .select('id, status, entitled_user_id, obligated_user_id')
      .eq('bet_id', id)
      .maybeSingle()
    if (bfData) setFulfillment(bfData)
  }

  const fetchDealMedia = async () => {
    const { data } = await supabase.from('deal_media')
      .select('*')
      .eq('deal_id', id as string)
      .order('created_at', { ascending: true })
    setDealMedia(data || [])
  }

  const uploadDealMedia = async (file: File) => {
    if (!profile || !deal) return
    setMediaUploading(true)
    setUploadProgress(0)
    setUploadError(null)

    // Wake Lock — Bildschirm bleibt an während Upload
    let wakeLock: any = null
    try {
      if ('wakeLock' in navigator) {
        wakeLock = await (navigator as any).wakeLock.request('screen')
      }
    } catch (_) { /* Wake Lock nicht verfügbar — kein Problem */ }

    try {
      // Use signed URL upload (bypasses Vercel 4.5 MB limit)
      const result = await uploadDealMediaUtil(
        file,
        id as string,
        profile.id,
        (percent) => setUploadProgress(percent),
        (msg) => setUploadStatus(msg)
      )
      // bets table uses 'image'/'video', deal_media uses 'photo'/'video'
      const betsMediaType = result.type === 'video' ? 'video' : 'image'
      const dealMediaType = result.type === 'video' ? 'video' : 'photo'
      // Insert DB record into deal_media
      await supabase.from('deal_media').insert({
        deal_id: id as string,
        user_id: profile.id,
        media_type: dealMediaType,
        media_url: result.url,
      })
      // Insert feed event
      await supabase.from('feed_events').insert({
        event_type: 'deal_media_added',
        user_id: profile.id,
        deal_id: id as string,
        metadata: { media_url: result.url, media_type: betsMediaType },
      })
      // Set as deal's main media if none exists yet (so it shows in feed cards + stories)
      if (!deal.media_url) {
        await supabase.from('bets').update({
          media_url: result.url,
          media_type: betsMediaType,
          shared_as_story_at: new Date().toISOString(),
        }).eq('id', id)
      } else {
        // Auto-post as story
        await supabase.from('bets').update({ shared_as_story_at: new Date().toISOString() }).eq('id', id)
      }
      setUploadProgress(100)
      fetchDealMedia()
    } catch (err: any) {
      console.error('Media upload error:', err)
      setUploadError(err?.message || 'Upload fehlgeschlagen')
      showActionToast(err?.message || 'Upload fehlgeschlagen', 'error')
    }

    // Wake Lock freigeben
    if (wakeLock) { try { await wakeLock.release() } catch (_) {} }

    setMediaUploading(false)
    if (mediaInputRef.current) mediaInputRef.current.value = ''
  }

  /* ─── Actions ─── */
  const accept = async () => {
    if (!profile) return
    setLoading(true)
    try {
      const update: any = { status: 'active' }
      if (deal.status === 'open') update.opponent_id = profile.id
      // Auto-post as story when deal is accepted (both participants see it)
      if (deal.is_public !== false) {
        update.shared_as_story_at = new Date().toISOString()
      }
      const { error } = await supabase.from('bets').update(update).eq('id', id)
      if (error) throw error
      // Push notification to creator
      if (deal.creator_id !== profile.id) {
        triggerPush(deal.creator_id, '🤝 Deal angenommen!', `@${profile.username} hat deinen Deal angenommen!`, `/app/deals/${id}`)
      }
      // Feed events for public deals
      if (deal.is_public) {
        await supabase.from('feed_events').insert({
          event_type: 'deal_accepted',
          user_id: profile.id,
          deal_id: id as string,
          metadata: { title: deal.title },
        })
        // challenge_joined for open challenges
        if (deal.status === 'open') {
          try {
            await supabase.from('feed_events').insert({
              event_type: 'challenge_joined',
              user_id: profile.id,
              deal_id: id as string,
              metadata: { title: deal.title },
            })
          } catch (_) { /* ignore */ }
        }
      }
      trackDealAccepted(id as string)
      if (navigator.vibrate) navigator.vibrate(10)
      showActionToast('Deal angenommen! ⚔️')
      fetchDeal()
    } catch (_err) {
      showActionToast('Fehler beim Annehmen. Bitte versuche es erneut.', 'error')
    }
    setLoading(false)
  }

  const proposeWinner = async (winnerId: string) => {
    // Open proof upload first, then propose after proof is uploaded
    setPendingWinnerId(winnerId)
    setProofType('winner_proof')
    setProofOpen(true)
    setProposeOpen(false)
    setResolveOpen(false)
  }

  const completePropose = async () => {
    if (!pendingWinnerId || !profile) return
    setLoading(true)
    try {
      const { error } = await supabase.from('bets').update({
        status: 'pending_confirmation', proposed_winner_id: pendingWinnerId,
        winner_proposed_by: profile.id,
      }).eq('id', id)
      if (error) throw error
      trackResultSubmitted(id as string)
      // Feed event: result_proposed
      supabase.from('feed_events').insert({
        event_type: 'result_proposed',
        user_id: profile.id,
        deal_id: id,
        metadata: { title: deal.title },
      }).then(() => {})
      // Notify the other participant
      const otherId = deal.creator_id === profile.id ? deal.opponent_id : deal.creator_id
      if (otherId) triggerPush(otherId, '🏆 Ergebnis gemeldet', `@${profile.username} hat ein Ergebnis vorgeschlagen`, `/app/deals/${id}`)
      showActionToast('Ergebnis gemeldet')
      setPendingWinnerId(null)
      fetchDeal()
      fetchProofs()
    } catch (_err) {
      showActionToast('Fehler beim Melden', 'error')
    }
    setLoading(false)
  }

  const confirmWinner = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('confirm-winner', { body: { deal_id: id } })
      if (error) throw error
      trackResultConfirmed(id as string, deal.proposed_winner_id === profile?.id)
      if (data?.xp_winner !== undefined) {
        const isWinner = deal.proposed_winner_id === profile?.id
        setXpToast({ xp: isWinner ? (data.xp_winner || 0) : (data.xp_loser || 50), coins: isWinner ? 30 : 5 })
        setTimeout(() => setXpToast(null), 4000)
      }
      fetchDeal()
    } catch {
      await supabase.from('bets').update({
        status: 'completed', winner_id: deal.proposed_winner_id,
        confirmed_at: new Date().toISOString(),
      }).eq('id', id)
      fetchDeal()
    }
    setLoading(false)
  }

  const disputeWinner = async () => {
    setProofType('dispute_proof')
    setProofOpen(true)
  }

  const completeDispute = async () => {
    setLoading(true)
    try {
      const { error } = await supabase.from('bets').update({ status: 'disputed', proposed_winner_id: null, winner_proposed_by: null }).eq('id', id)
      if (error) throw error
      // Feed event: deal_disputed
      if (profile) {
        supabase.from('feed_events').insert({
          event_type: 'deal_disputed',
          user_id: profile.id,
          deal_id: id,
          metadata: { title: deal.title },
        }).then(() => {})
      }
      // Notify the other participant
      if (profile) {
        const otherId = deal.creator_id === profile.id ? deal.opponent_id : deal.creator_id
        if (otherId) triggerPush(otherId, '⚔️ Dispute!', `@${profile.username} hat das Ergebnis angefochten`, `/app/deals/${id}`)
      }
      showActionToast('Dispute eingereicht')
      fetchDeal()
      fetchProofs()
    } catch (_err) {
      showActionToast('Fehler beim Dispute', 'error')
    }
    setLoading(false)
  }

  const editDeal = async () => {
    if (!editForm.title || !editForm.stake) return
    setLoading(true)
    try {
      const { error } = await supabase.from('bets').update({ title: editForm.title, stake: editForm.stake }).eq('id', id)
      if (error) throw error
      setEditOpen(false)
      showActionToast('Deal aktualisiert')
      fetchDeal()
    } catch (_err) {
      showActionToast('Fehler beim Speichern', 'error')
    }
    setLoading(false)
  }

  const deleteDeal = async () => {
    setLoading(true)
    try {
      const { error } = await supabase.from('bets').update({ status: 'cancelled' }).eq('id', id)
      if (error) throw error
      router.back()
    } catch (_err) {
      showActionToast('Fehler beim Abbrechen', 'error')
      setLoading(false)
    }
  }

  const hardDelete = async () => {
    await supabase.from('deal_likes').delete().eq('deal_id', id as string)
    await supabase.from('deal_reposts').delete().eq('original_deal_id', id as string)
    await supabase.from('deal_comments').delete().eq('deal_id', id as string)
    await supabase.from('deal_side_bets').delete().eq('deal_id', id as string)
    await supabase.from('deal_actions').delete().eq('deal_id', id as string)
    await supabase.from('bets').delete().eq('id', id as string)
    router.push('/app/deals')
  }

  const requestCancel = async () => {
    if (!profile) return
    setLoading(true)
    try {
      const { error } = await supabase.from('bets').update({
        frozen_by: profile.id, freeze_reason: 'cancel_request',
        frozen_at: new Date().toISOString(),
      }).eq('id', id)
      if (error) throw error
      // Notify the other participant
      const otherId = deal.creator_id === profile.id ? deal.opponent_id : deal.creator_id
      if (otherId) triggerPush(otherId, '⏸️ Abbruch angefragt', `@${profile.username} möchte den Deal abbrechen`, `/app/deals/${id}`)
      showActionToast('Abbruch angefragt')
      fetchDeal()
    } catch (_err) {
      showActionToast('Fehler bei Abbruch-Anfrage', 'error')
    }
    setLoading(false)
  }
  const acceptCancel = async () => {
    setLoading(true)
    try {
      const { error } = await supabase.from('bets').update({ status: 'cancelled', frozen_by: null, freeze_reason: null, frozen_at: null }).eq('id', id)
      if (error) throw error
      showActionToast('Deal abgebrochen')
      fetchDeal()
    } catch (_err) {
      showActionToast('Fehler beim Abbrechen', 'error')
    }
    setLoading(false)
  }
  const rejectCancel = async () => {
    setLoading(true)
    try {
      const { error } = await supabase.from('bets').update({ frozen_by: null, freeze_reason: null, frozen_at: null }).eq('id', id)
      if (error) throw error
      showActionToast('Abbruch abgelehnt')
      fetchDeal()
    } catch (_err) {
      showActionToast('Fehler beim Ablehnen', 'error')
    }
    setLoading(false)
  }

  const handleFulfillment = async (status: 'fulfilled' | 'unfulfilled') => {
    if (!profile || fulfillmentLoading) return
    setFulfillmentLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/fulfillment', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ betId: deal.id, status }),
      })
      if (res.ok) {
        setFulfillment(prev => prev ? { ...prev, status } : null)
      }
    } catch (err) {
      console.error('Fulfillment error:', err)
    }
    setFulfillmentLoading(false)
  }

  const shareDeal = async () => {
    const url = `https://app.deal-buddy.app/deal/${id}`
    try {
      if (navigator.share) await navigator.share({ title: `DealBuddy: ${deal.title}`, text: deal.title, url })
      else { await navigator.clipboard.writeText(url); alert('Link kopiert! 🔗') }
    } catch {}
    setMenuOpen(false)
  }

  const postToProfile = async () => {
    if (!profile || !deal || postedToProfile) return
    try {
      await supabase.from('profile_posts').insert({
        user_id: profile.id,
        post_type: 'deal',
        deal_id: deal.id,
        caption: deal.title,
        media_url: deal.media_url || null,
        media_type: deal.media_type || null,
        is_public: deal.is_public ?? true,
      })
      await supabase.from('feed_events').insert({
        event_type: 'profile_post',
        user_id: profile.id,
        deal_id: deal.id,
        metadata: { post_type: 'deal', title: deal.title },
      })
      setPostedToProfile(true)
      if (navigator.vibrate) navigator.vibrate(10)
    } catch (_err) {
      // post to profile error
    }
  }

  const askShareAsStory = () => {
    if (storyPosted) return
    setStoryConfirmOpen(true)
  }

  const confirmShareAsStory = async () => {
    setStoryConfirmOpen(false)
    if (!profile || !deal || storyPosted) return
    try {
      await supabase.from('feed_events').insert({
        event_type: 'deal_story',
        user_id: profile.id,
        deal_id: deal.id,
        metadata: { title: deal.title, stake: deal.stake },
      })
      await supabase.from('bets').update({ shared_as_story_at: new Date().toISOString() }).eq('id', id)
      trackShareClicked('deal_story', 'feed')
      setStoryPosted(true)
      setDeal((prev: any) => prev ? { ...prev, shared_as_story_at: new Date().toISOString() } : prev)
      if (navigator.vibrate) navigator.vibrate(10)
    } catch (_err) {
      // share as story error
    }
  }

  /* ─── Loading state ─── */
  if (!deal) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', background: 'var(--bg-base)' }}>
      <div style={{ width: 32, height: 32, border: '2px solid transparent', borderTopColor: 'var(--gold-primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
    </div>
  )

  /* ─── Derived state ─── */
  const sc = STATUS_COLORS[deal.status] || 'var(--text-muted)'
  const isCreator = deal.creator_id === profile?.id
  const isOpponent = deal.opponent_id === profile?.id
  const isParticipant = isCreator || isOpponent
  const isCompleted = deal.status === 'completed' && (deal.winner_id || deal.confirmed_winner_id)
  const isDisputed = deal.status === 'disputed'
  const cancelRequested = deal.frozen_by && deal.freeze_reason === 'cancel_request'
  const iRequestedCancel = cancelRequested && deal.frozen_by === profile?.id
  const theyRequestedCancel = cancelRequested && deal.frozen_by !== profile?.id
  const iProposedWinner = deal.status === 'pending_confirmation' && deal.winner_proposed_by === profile?.id
  const theyProposedWinner = deal.status === 'pending_confirmation' && deal.winner_proposed_by !== profile?.id && isParticipant
  const creatorWon = isCompleted && (deal.confirmed_winner_id === deal.creator_id || deal.winner_id === deal.creator_id)
  const opponentWon = isCompleted && (deal.confirmed_winner_id === deal.opponent_id || deal.winner_id === deal.opponent_id)
  const requesterUsername = cancelRequested ? (deal.frozen_by === deal.creator_id ? deal.creator?.username : deal.opponent?.username) : ''
  const proposerUsername = deal.winner_proposed_by === deal.creator_id ? deal.creator?.username : deal.opponent?.username

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg-base)', paddingBottom: 100 }}>
      {/* XP Toast */}
      {xpToast && (
        <div style={{ position: 'fixed', top: 80, left: '50%', transform: 'translateX(-50%)', background: 'linear-gradient(135deg, var(--gold-dim), var(--gold-primary))', borderRadius: 12, padding: '12px 24px', zIndex: 300, display: 'flex', gap: 16, alignItems: 'center', boxShadow: '0 8px 32px rgba(255,184,0,0.4)' }}>
          <span style={{ fontSize: 14, fontFamily: 'var(--font-display)', color: 'var(--text-inverse)', fontWeight: 700 }}>+{xpToast.xp} XP</span>
          <span style={{ fontSize: 14, fontFamily: 'var(--font-display)', color: 'var(--text-inverse)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>+{xpToast.coins} <CoinIcon size={14} /></span>
        </div>
      )}

      {/* Action Toast */}
      {actionToast && (
        <div style={{
          position: 'fixed', bottom: 100, left: '50%', transform: 'translateX(-50%)',
          background: actionToastType === 'error' ? 'rgba(239,68,68,0.95)' : 'linear-gradient(135deg, var(--gold-dim), var(--gold-primary))',
          borderRadius: 12, padding: '12px 24px', zIndex: 300, boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          animation: 'fadeInUp 0.3s ease',
        }}>
          <span style={{ fontSize: 13, fontFamily: 'var(--font-display)', color: actionToastType === 'error' ? '#fff' : 'var(--text-inverse)', fontWeight: 700, letterSpacing: 1 }}>{actionToast}</span>
        </div>
      )}
      <style>{`@keyframes fadeInUp{from{opacity:0;transform:translateX(-50%) translateY(10px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}`}</style>

      {/* ═══ HEADER ═══ */}
      <div style={{ padding: '12px 20px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 20, padding: 0 }}>←</button>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 14, color: 'var(--text-primary)', letterSpacing: 2 }}>DEAL</h1>
        {/* ⋮ Three-dot Menu */}
        <div style={{ position: 'relative' }}>
          <button onClick={() => setMenuOpen(!menuOpen)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 22, padding: '0 4px', lineHeight: 1 }}>⋮</button>
          {menuOpen && (
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setMenuOpen(false)} />
              <div style={{ position: 'absolute', top: 30, right: 0, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 12, minWidth: 200, zIndex: 50, overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.6)' }}>
                {isCreator && (deal.status === 'open' || deal.status === 'pending') && (
                  <button onClick={() => { setMenuOpen(false); setEditForm({ title: deal.title, stake: deal.stake || '' }); setEditOpen(true) }}
                    style={{ width: '100%', padding: '12px 16px', background: 'none', border: 'none', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-primary)', fontSize: 13, textAlign: 'left', cursor: 'pointer', display: 'flex', gap: 8, alignItems: 'center' }}>
                    ✏️ Bearbeiten
                  </button>
                )}
                {isCreator && ['open', 'pending'].includes(deal.status) && (
                  <button onClick={() => { setMenuOpen(false); setDeleteOpen(true) }}
                    style={{ width: '100%', padding: '12px 16px', background: 'none', border: 'none', borderBottom: '1px solid var(--border-subtle)', color: 'var(--status-error)', fontSize: 13, textAlign: 'left', cursor: 'pointer', display: 'flex', gap: 8, alignItems: 'center' }}>
                    ❌ Abbrechen
                  </button>
                )}
                {isCreator && deal.status === 'cancelled' && (
                  <button onClick={() => { setMenuOpen(false); setConfirmHardDeleteOpen(true) }}
                    style={{ width: '100%', padding: '12px 16px', background: 'none', border: 'none', borderBottom: '1px solid var(--border-subtle)', color: 'var(--status-error)', fontSize: 13, textAlign: 'left', cursor: 'pointer', display: 'flex', gap: 8, alignItems: 'center' }}>
                    🗑️ Endgültig löschen
                  </button>
                )}
                <button onClick={() => { setMenuOpen(false); navigator.clipboard.writeText(`https://app.deal-buddy.app/deal/${deal.id}`); }}
                  style={{ width: '100%', padding: '12px 16px', background: 'none', border: 'none', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-primary)', fontSize: 13, textAlign: 'left', cursor: 'pointer', display: 'flex', gap: 8, alignItems: 'center' }}>
                  🔗 Link kopieren
                </button>
                {typeof navigator !== 'undefined' && navigator.share && (
                  <button onClick={async () => { setMenuOpen(false); try { await navigator.share({ title: deal.title, url: `https://app.deal-buddy.app/deal/${deal.id}` }) } catch {} }}
                    style={{ width: '100%', padding: '12px 16px', background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: 13, textAlign: 'left', cursor: 'pointer', display: 'flex', gap: 8, alignItems: 'center' }}>
                    📤 Teilen
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ═══ DEAL CARD — same style as Home Feed ═══ */}
      <div style={{ margin: '0 16px', position: 'relative', paddingTop: 10 }}>

        {/* ═══ BADGE — oben links ═══ */}
        <div style={{
          position: 'absolute', top: -4, left: 16, zIndex: 5,
          padding: '4px 10px 5px',
          background: `linear-gradient(135deg, ${sc}E8, ${sc}DD)`,
          color: '#060606', fontFamily: 'var(--font-display)',
          fontSize: 7, fontWeight: 800, letterSpacing: 1.5,
          borderRadius: '6px 6px 0 0',
          boxShadow: `0 -3px 10px ${sc}40`,
          lineHeight: 1,
        }}>
          {STATUS_LABELS[deal.status] || deal.status.toUpperCase()}
        </div>

        <div style={{ borderRadius: 14, overflow: 'hidden', background: '#111' }}>

          {/* ═══ TITLE BAR ═══ */}
          <div style={{
            width: '100%', padding: '10px 16px', textAlign: 'center',
            background: `linear-gradient(135deg, ${sc}12, ${sc}06)`,
          }}>
            <p style={{
              fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 900,
              color: sc, letterSpacing: 1.5, textTransform: 'uppercase' as const,
              margin: 0, lineHeight: 1.3,
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical' as const,
              textShadow: `0 0 12px ${sc}25`,
            }}>
              {deal.title}
            </p>
          </div>

          {/* ═══ MEDIA + BEGEGNUNG LESEZEICHEN ═══ */}
          <div style={{ position: 'relative' }}>
            {/* Lesezeichen oben links */}
            <div style={{
              position: 'absolute', top: 0, left: 12, zIndex: 2,
              background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)',
              padding: '3px 8px', borderRadius: '0 0 6px 6px',
              fontFamily: 'var(--font-body)', fontSize: 10, fontWeight: 700, color: '#fff',
              boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <span>{'\u2694\uFE0F'}</span>
              <span
                onClick={() => deal.creator?.username && router.push(`/app/profile/${deal.creator.username}`)}
                style={{ cursor: 'pointer', color: creatorWon ? '#4ade80' : '#fff' }}
              >
                {creatorWon && '\u{1F451} '}{deal.creator?.display_name || deal.creator?.username || '?'}
              </span>
              {deal.opponent ? (
                <>
                  <span style={{ color: 'rgba(255,255,255,0.5)' }}>vs</span>
                  <span
                    onClick={() => deal.opponent?.username && router.push(`/app/profile/${deal.opponent.username}`)}
                    style={{ cursor: 'pointer', color: opponentWon ? '#4ade80' : '#fff' }}
                  >
                    {opponentWon && '\u{1F451} '}{deal.opponent?.display_name || deal.opponent?.username}
                  </span>
                </>
              ) : (
                <span style={{ color: sc }}>· sucht Gegner</span>
              )}
            </div>

            {deal.media_url ? (
              deal.media_type === 'video' ? (
                <video
                  src={deal.media_url} autoPlay muted playsInline loop controls preload="auto"
                  style={{ width: '100%', maxHeight: '55vh', objectFit: 'cover', display: 'block', background: '#000' }}
                />
              ) : (
                <img
                  src={deal.media_url} alt=""
                  onClick={() => setMediaPreview({ url: deal.media_url, type: 'photo' })}
                  style={{ width: '100%', maxHeight: '45vh', objectFit: 'cover', display: 'block', cursor: 'pointer' }}
                />
              )
            ) : (
              <div style={{ height: 28 }} />
            )}
          </div>

          {/* ═══ EINSATZ — mittig, gerahmt ═══ */}
          {(deal.stake || deal.deadline) && (
            <div style={{
              padding: '8px 12px',
              display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8,
            }}>
              {deal.stake && (
                <span style={{
                  fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 900,
                  color: '#ffffff', letterSpacing: 1,
                  borderRadius: 8, padding: '6px 16px',
                  background: 'rgba(255,255,255,0.06)',
                  textShadow: 'none',
                }}>
                  {'\uD83C\uDFC6'} {deal.stake}
                </span>
              )}
              {deal.deadline && !countdownExpired && ['active', 'pending', 'open', 'pending_confirmation'].includes(deal.status) && (
                <span style={{
                  fontSize: 9, fontWeight: 600, color: countdownUrgent ? '#EF4444' : 'rgba(255,255,255,0.4)',
                  animation: countdownUrgent ? 'pulse-timer 1.5s ease-in-out infinite' : 'none',
                }}>
                  {'\u23F3'} {countdownRemaining}
                </span>
              )}
            </div>
          )}

        </div>
      </div>

      {/* ═══ PER-PARTY MEDIA GALLERY (Story Circles) — OUTSIDE card container so always visible ═══ */}
      {(() => {
        const creatorMedia: { id: string; url: string; type: string }[] = []
        const opponentMedia: { id: string; url: string; type: string }[] = []
        // deal.media_url is already shown in the card above — only show additional uploads here
        for (const m of dealMedia) {
          const entry = { id: m.id, url: m.media_url, type: m.media_type }
          if (m.user_id === deal.opponent_id) opponentMedia.push(entry)
          else creatorMedia.push(entry)
        }
        const allowedStatuses = ['active', 'pending_confirmation', 'open', 'pending', 'completed']
        const canUploadCreator = isCreator && allowedStatuses.includes(deal.status)
        const canUploadOpponent = isOpponent && allowedStatuses.includes(deal.status)
        // Show if there's media or user can upload
        if (!deal.opponent && !canUploadCreator && creatorMedia.length === 0) return null

        const renderCircle = (m: { id: string; url: string; type: string }) => (
          <div key={m.id} onClick={() => setMediaPreview({ url: m.url, type: m.type })}
            style={{ flexShrink: 0, width: 52, height: 52, borderRadius: '50%', overflow: 'hidden', border: '2.5px solid var(--gold-primary)', cursor: 'pointer', position: 'relative', boxShadow: '0 0 8px rgba(255,184,0,0.25)', background: '#000' }}>
            {m.type === 'video' ? (
              <>
                <video src={m.url} autoPlay muted loop playsInline preload="auto" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.25)' }}>
                  <span style={{ fontSize: 12, color: '#fff' }}>{'\u25B6'}</span>
                </div>
              </>
            ) : (
              <img src={m.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            )}
          </div>
        )

        const renderUploadArea = (hasMedia: boolean) => (
          <div style={{ width: '100%' }}>
            <button
              onClick={() => mediaInputRef.current?.click()}
              disabled={mediaUploading}
              style={{
                width: '100%', padding: hasMedia ? '8px 12px' : '14px 12px',
                borderRadius: 10,
                border: '2px dashed rgba(255,184,0,0.3)',
                background: 'rgba(255,184,0,0.03)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                cursor: mediaUploading ? 'wait' : 'pointer',
                color: 'var(--gold-primary)',
                transition: 'border-color 0.2s, background 0.2s',
              }}
            >
              {mediaUploading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, width: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 14, height: 14, border: '2px solid transparent', borderTopColor: 'var(--gold-primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                    <span style={{ fontSize: 10, fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: 1 }}>
                      {uploadStatus || (uploadProgress < 100 ? `${uploadProgress}%` : 'FERTIG')}
                    </span>
                  </div>
                  {/* Progress bar */}
                  <div style={{ width: '100%', height: 4, borderRadius: 2, background: 'rgba(255,184,0,0.15)', overflow: 'hidden' }}>
                    <div style={{
                      width: `${uploadProgress}%`, height: '100%', borderRadius: 2,
                      background: 'linear-gradient(90deg, #FFB800, #ff8c00)',
                      transition: 'width 0.3s ease',
                    }} />
                  </div>
                </div>
              ) : (
                <>
                  <span style={{ fontSize: 18, lineHeight: 1 }}>{'\uD83D\uDCF7'}</span>
                  <span style={{
                    fontSize: 10, fontFamily: 'var(--font-display)', fontWeight: 700,
                    letterSpacing: 1.5, textTransform: 'uppercase' as const,
                  }}>
                    {hasMedia ? '+ WEITERE' : 'FOTO / VIDEO HOCHLADEN'}
                  </span>
                </>
              )}
            </button>
            {uploadError && !mediaUploading && (
              <p style={{ fontSize: 10, color: '#ef4444', textAlign: 'center', marginTop: 4, fontFamily: 'var(--font-body)' }}>{uploadError}</p>
            )}
          </div>
        )

        const renderEmptyPlaceholder = () => (
          <div style={{
            width: '100%', padding: '10px', borderRadius: 8,
            border: '1px dashed var(--border-subtle)', background: 'var(--bg-elevated)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.3,
          }}>
            <span style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-display)', letterSpacing: 1 }}>KEINE MEDIEN</span>
          </div>
        )

        return (
          <div style={{ margin: '6px 16px 0', padding: '10px 12px', background: 'var(--bg-surface)', borderRadius: 12, border: '1px solid var(--border-subtle)' }}>
            <input ref={mediaInputRef} type="file" accept="image/*,video/*" style={{ display: 'none' }}
              onChange={e => { const file = e.target.files?.[0]; if (file) uploadDealMedia(file) }} />
            <div style={{ display: 'flex', gap: 0 }}>
              {/* Creator side */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <p style={{ fontSize: 7, fontFamily: 'var(--font-display)', letterSpacing: 2, color: 'var(--text-muted)', textTransform: 'uppercase' as const, margin: 0 }}>@{deal.creator?.username}</p>
                {creatorMedia.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
                    {creatorMedia.map(renderCircle)}
                  </div>
                )}
                {canUploadCreator ? renderUploadArea(creatorMedia.length > 0) : creatorMedia.length === 0 && renderEmptyPlaceholder()}
              </div>
              {/* Divider + Opponent side — only if opponent exists */}
              {deal.opponent && (
                <>
                  <div style={{ width: 1, background: 'var(--border-subtle)', margin: '0 8px', alignSelf: 'stretch' }} />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                    <p style={{ fontSize: 7, fontFamily: 'var(--font-display)', letterSpacing: 2, color: 'var(--text-muted)', textTransform: 'uppercase' as const, margin: 0 }}>@{deal.opponent?.username || 'GEGNER'}</p>
                    {opponentMedia.length > 0 && (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
                        {opponentMedia.map(renderCircle)}
                      </div>
                    )}
                    {canUploadOpponent ? renderUploadArea(opponentMedia.length > 0) : opponentMedia.length === 0 && renderEmptyPlaceholder()}
                  </div>
                </>
              )}
            </div>
          </div>
        )
      })()}

      {/* ═══ TIME + EXPIRED (compact) ═══ */}
      <div style={{ margin: '4px 16px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        {deal.deadline && countdownExpired && ['active', 'pending', 'open'].includes(deal.status) && (
          <span style={{ fontSize: 10, fontFamily: 'var(--font-display)', letterSpacing: 1, color: 'var(--status-error)' }}>ABGELAUFEN</span>
        )}
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{timeAgo(deal.created_at)}</span>
      </div>

      {/* ═══ ACTIONS ═══ */}
      <div style={{ margin: '8px 16px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Accept deal */}
        {((deal.status === 'open' && !isParticipant) || (deal.status === 'pending' && isOpponent)) && (
          <button onClick={accept} disabled={loading} style={{ ...btnPrimary, opacity: loading ? 0.6 : 1 }}>
            {loading ? '...' : 'DEAL ANNEHMEN \uD83E\uDD1D'}
          </button>
        )}

        {/* Cancel request banner */}
        {(deal.status === 'active' || deal.status === 'pending_confirmation') && cancelRequested && isParticipant && (
          <div style={{ padding: '14px', background: 'rgba(248,113,113,0.06)', borderRadius: 12, border: '1px solid rgba(248,113,113,0.2)' }}>
            {iRequestedCancel ? (
              <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>{'\u23F3'} Abbruch angefragt {'\u2013'} warte auf Zustimmung...</p>
            ) : theyRequestedCancel ? (
              <>
                <p style={{ textAlign: 'center', color: 'var(--status-error)', fontSize: 13, marginBottom: 12 }}>@{requesterUsername} m{'\u00F6'}chte diesen Deal abbrechen</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setConfirmAcceptCancelOpen(true)} style={{ flex: 1, padding: '11px', borderRadius: 8, border: '1px solid rgba(248,113,113,0.35)', background: 'rgba(248,113,113,0.1)', color: 'var(--status-error)', fontFamily: 'var(--font-display)', fontSize: 10, letterSpacing: 1, cursor: 'pointer' }}>ABBRUCH AKZEPTIEREN</button>
                  <button onClick={rejectCancel} style={{ flex: 1, padding: '11px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-secondary)', fontFamily: 'var(--font-display)', fontSize: 10, letterSpacing: 1, cursor: 'pointer' }}>ABLEHNEN</button>
                </div>
              </>
            ) : null}
          </div>
        )}

        {/* Propose winner */}
        {deal.status === 'active' && isParticipant && !cancelRequested && (
          <>
            <button onClick={() => setProposeOpen(true)} disabled={loading} style={btnPrimary}>ERGEBNIS MELDEN {'\uD83C\uDFC6'}</button>
            <button onClick={() => setConfirmCancelOpen(true)} disabled={loading} style={{ ...btnOutline, opacity: loading ? 0.6 : 1 }}>{loading ? '...' : 'ABBRUCH ANFRAGEN'}</button>
          </>
        )}

        {/* Auto-confirm countdown */}
        {autoConfirmCountdown && deal?.status === 'pending_confirmation' && (
          <div style={{
            padding: '8px 16px', background: 'var(--gold-subtle)', borderRadius: 8,
            border: '1px solid var(--gold-glow)', marginBottom: 12, textAlign: 'center',
          }}>
            <p style={{ fontSize: 12, color: 'var(--gold-primary)', fontFamily: 'var(--font-display)', letterSpacing: 1 }}>
              {'\u23F3'} {autoConfirmCountdown}
            </p>
          </div>
        )}

        {/* Pending confirmation */}
        {deal.status === 'pending_confirmation' && isParticipant && !cancelRequested && (
          <>
            {iProposedWinner ? (
              <div style={{ padding: '16px', background: 'rgba(249,115,22,0.06)', borderRadius: 12, border: '1px solid rgba(249,115,22,0.2)', textAlign: 'center' }}>
                <p style={{ fontSize: 22, marginBottom: 8 }}>{'\u23F3'}</p>
                <p style={{ fontFamily: 'var(--font-display)', fontSize: 11, letterSpacing: 2, color: 'var(--status-warning)', marginBottom: 6 }}>WARTE AUF BEST{'\u00C4'}TIGUNG</p>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Du hast vorgeschlagen: @{deal.proposed_winner?.username} hat gewonnen</p>
              </div>
            ) : theyProposedWinner ? (
              <>
                <div style={{ padding: '14px', background: 'rgba(249,115,22,0.06)', borderRadius: 12, border: '1px solid rgba(249,115,22,0.2)', textAlign: 'center', marginBottom: 4 }}>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>@{proposerUsername} sagt:</p>
                  <p style={{ fontSize: 16, color: 'var(--gold-primary)', fontWeight: 700 }}>@{deal.proposed_winner?.username} hat gewonnen</p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={confirmWinner} disabled={loading} style={{ flex: 1, padding: '16px', borderRadius: 12, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, #166534, #16a34a)', color: 'var(--text-primary)', fontFamily: 'var(--font-display)', fontSize: 11, letterSpacing: 1.5, fontWeight: 700 }}>
                    {loading ? '...' : 'BEST\u00C4TIGEN \u2713'}
                  </button>
                  <button onClick={disputeWinner} disabled={loading} style={{ flex: 1, padding: '16px', borderRadius: 12, border: '1px solid rgba(248,113,113,0.3)', background: 'rgba(248,113,113,0.08)', color: 'var(--status-error)', fontFamily: 'var(--font-display)', fontSize: 11, letterSpacing: 1.5, cursor: 'pointer' }}>
                    DISPUTE {'\u2717'}
                  </button>
                </div>
              </>
            ) : null}
          </>
        )}

        {/* Disputed */}
        {deal.status === 'disputed' && isParticipant && (
          <>
            <div style={{ padding: '14px', background: 'rgba(239,68,68,0.06)', borderRadius: 12, border: '1px solid rgba(239,68,68,0.2)', textAlign: 'center' }}>
              <p style={{ fontSize: 20, marginBottom: 6 }}>{'\u2694\uFE0F'}</p>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: 11, letterSpacing: 2, color: 'var(--status-error)', marginBottom: 4 }}>STREIT</p>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Einigt euch, wer gewonnen hat</p>
            </div>
            <button onClick={() => setResolveOpen(true)} style={{ ...btnPrimary, background: 'linear-gradient(135deg, #991b1b, var(--status-error))' }}>STREIT L{'\u00D6'}SEN {'\u2694\uFE0F'}</button>
          </>
        )}
      </div>

      {/* ═══ WINNER BANNER + CONFETTI ═══ */}
      {deal.status === 'completed' && (deal.winner_id || deal.confirmed_winner_id) && (() => {
        const effectiveWinnerId = deal.confirmed_winner_id || deal.winner_id
        const winnerUsername = effectiveWinnerId === deal.creator_id ? deal.creator?.username : deal.opponent?.username
        const iAmWinner = effectiveWinnerId === profile?.id
        return (
        <div style={{ margin: '12px 16px 0', textAlign: 'center', padding: iAmWinner ? '24px 16px' : '16px', background: iAmWinner ? 'linear-gradient(135deg, rgba(255,184,0,0.15), rgba(255,140,0,0.08))' : 'var(--gold-subtle)', borderRadius: 14, border: iAmWinner ? '2px solid rgba(255,184,0,0.4)' : '1px solid var(--border-subtle)', position: 'relative', overflow: 'hidden' }}>
          {iAmWinner && Array.from({ length: 16 }).map((_, i) => (
            <div key={i} style={{
              position: 'absolute', top: -10, left: `${(i * 6.5) + 2}%`,
              width: i % 3 === 0 ? 8 : 6, height: i % 3 === 0 ? 8 : 6,
              borderRadius: i % 2 === 0 ? '50%' : 2,
              background: ['#FFB800', '#FF6B35', '#22C55E', '#3B82F6', '#A855F7', '#EC4899'][i % 6],
              animation: `confettiFall ${1.8 + (i % 5) * 0.4}s ease-in ${i * 0.12}s forwards`,
              opacity: 0,
            }} />
          ))}
          <p style={{ fontSize: iAmWinner ? 32 : 20, marginBottom: 6, position: 'relative', zIndex: 1 }}>{'\uD83D\uDC51'}</p>
          <p style={{ fontSize: iAmWinner ? 18 : 14, color: 'var(--gold-primary)', fontFamily: iAmWinner ? 'var(--font-display)' : 'inherit', fontWeight: iAmWinner ? 700 : 400, letterSpacing: iAmWinner ? 2 : 0, position: 'relative', zIndex: 1 }}>
            {iAmWinner ? 'DU HAST GEWONNEN!' : `@${winnerUsername} hat gewonnen!`}
          </p>
          {iAmWinner && (
            <style>{`
              @keyframes confettiFall {
                0% { opacity: 1; transform: translateY(0) rotate(0deg); }
                100% { opacity: 0; transform: translateY(120px) rotate(${360 + Math.random() * 360}deg); }
              }
              @keyframes pulse-timer {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.6; }
              }
            `}</style>
          )}
        </div>
        )
      })()}

      {/* ═══ REVANCHE + SHARE (completed deals) ═══ */}
      {deal.status === 'completed' && isParticipant && (() => {
        const opponentUsername = deal.creator_id === profile?.id
          ? deal.opponent?.username
          : deal.creator?.username
        const effectiveWinnerId = deal.confirmed_winner_id || deal.winner_id
        const isWinner = effectiveWinnerId === profile?.id
        return (
          <div style={{ margin: '8px 16px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button onClick={() => router.push(`/app/deals/create?rematch=${deal.id}`)}
              style={{ width: '100%', padding: 16, borderRadius: 12, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, var(--gold-dim), var(--gold-primary))', color: 'var(--text-inverse)', fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 700, letterSpacing: 2, boxShadow: '0 4px 20px rgba(255,184,0,0.25)' }}>
              REVANCHE {'\u2694\uFE0F'}
            </button>
            {isWinner && (
              <button onClick={() => setShowShareCard(true)}
                style={{ width: '100%', padding: 16, borderRadius: 12, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, #166534, #22c55e)', color: '#fff', fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 700, letterSpacing: 2, boxShadow: '0 4px 20px rgba(34,197,94,0.3)' }}>
                SIEG TEILEN {'\uD83C\uDFC6'}
              </button>
            )}
            {typeof window !== 'undefined' && navigator.share && (
              <button onClick={async () => { try { await navigator.share({ title: `DealBuddy: ${deal.title}`, text: isWinner ? 'Ich hab gewonnen! \uD83C\uDFC6' : `${effectiveWinnerId === deal.creator_id ? deal.creator?.username : deal.opponent?.username} hat gewonnen!`, url: `https://app.deal-buddy.app/deal/${deal.id}` }) } catch {} }}
                style={{ width: '100%', padding: 14, borderRadius: 12, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-secondary)', fontFamily: 'var(--font-display)', fontSize: 11, cursor: 'pointer', letterSpacing: 1.5 }}>
                TEILEN {'\uD83D\uDCE4'}
              </button>
            )}
          </div>
        )
      })()}

      {/* ═══ FULFILLMENT CHECK — only for winner with pending fulfillment ═══ */}
        {fulfillment && fulfillment.status === 'pending_fulfillment' && profile?.id === fulfillment.entitled_user_id && (
          <div style={{
            margin: '0 16px 16px', padding: '16px', borderRadius: 14,
            background: 'linear-gradient(135deg, rgba(255,184,0,0.08), rgba(255,184,0,0.03))',
            border: '1px solid rgba(255,184,0,0.2)',
          }}>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 11, letterSpacing: 1, color: 'var(--gold-primary)', marginBottom: 6 }}>
              EINSATZ ERHALTEN?
            </p>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'var(--font-body)', lineHeight: 1.5, marginBottom: 14 }}>
              Hat dein Gegner den Einsatz eingelöst?
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => handleFulfillment('fulfilled')}
                disabled={fulfillmentLoading}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
                  background: 'linear-gradient(135deg, #22C55E, #16A34A)',
                  color: '#fff', fontFamily: 'var(--font-display)', fontSize: 10, fontWeight: 700, letterSpacing: 1,
                }}
              >
                ✅ JA, ERHALTEN
              </button>
              <button
                onClick={() => handleFulfillment('unfulfilled')}
                disabled={fulfillmentLoading}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
                  background: 'linear-gradient(135deg, #EF4444, #DC2626)',
                  color: '#fff', fontFamily: 'var(--font-display)', fontSize: 10, fontWeight: 700, letterSpacing: 1,
                }}
              >
                ❌ NEIN
              </button>
            </div>
          </div>
        )}
        {fulfillment && fulfillment.status === 'fulfilled' && profile?.id === fulfillment.entitled_user_id && (
          <div style={{
            margin: '0 16px 16px', padding: '12px 16px', borderRadius: 14,
            background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)',
            textAlign: 'center',
          }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 10, letterSpacing: 1, color: '#22C55E' }}>
              ✅ EINSATZ ALS ERHALTEN BESTÄTIGT
            </span>
          </div>
        )}
        {fulfillment && fulfillment.status === 'unfulfilled' && profile?.id === fulfillment.entitled_user_id && (
          <div style={{
            margin: '0 16px 16px', padding: '12px 16px', borderRadius: 14,
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
            textAlign: 'center',
          }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 10, letterSpacing: 1, color: '#EF4444' }}>
              ❌ EINSATZ NICHT ERHALTEN
            </span>
          </div>
        )}

      {/* ═══ COMMUNITY TIPPS + InteractionBar — wie Home Feed, ein Container ═══ */}
      <div style={{ margin: '12px 16px 16px', borderRadius: 14, overflow: 'visible', border: '1px solid var(--border-subtle)', background: 'var(--bg-surface)' }}>
        <DealBetWidget
          dealId={deal.id}
          creatorId={deal.creator_id}
          opponentId={deal.opponent_id}
          creatorName={deal.creator?.username || '?'}
          opponentName={deal.opponent?.username || '?'}
          dealStatus={deal.status}
          winnerId={deal.confirmed_winner_id || deal.winner_id}
          creatorAvatarUrl={deal.creator?.avatar_url}
          opponentAvatarUrl={deal.opponent?.avatar_url}
        />
        <InteractionBar
          dealId={deal.id as string}
          dealTitle={deal.title}
          dealStatus={deal.status}
          onCommentOpen={() => setCommentsOpen(true)}
        />
      </div>

      {/* ═══ MODALS ═══ */}
      <CommentSheet dealId={id as string} open={commentsOpen} onClose={() => setCommentsOpen(false)} onCountChange={setCommentCount} />
      <ProofUploadSheet
        dealId={id as string}
        proofType={proofType}
        open={proofOpen}
        onClose={() => { setProofOpen(false); setPendingWinnerId(null) }}
        onComplete={() => {
          if (proofType === 'winner_proof') completePropose()
          else completeDispute()
        }}
      />
      <ShareCardGenerator
        deal={{
          id: deal.id,
          title: deal.title,
          stake: deal.stake,
          status: deal.status,
          creator: deal.creator,
          opponent: deal.opponent,
          confirmed_winner_id: deal.confirmed_winner_id || deal.winner_id,
          creator_id: deal.creator_id,
        }}
        open={shareCardOpen}
        onClose={() => setShareCardOpen(false)}
      />

      {/* Proofs section */}
      {proofs.length > 0 && (
        <div style={{ margin: '12px 16px 0' }}>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 9, letterSpacing: 3, color: 'var(--text-secondary)', marginBottom: 10 }}>BEWEISE</p>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
            {proofs.map(p => (
              <div key={p.id} onClick={() => setProofPreview({ url: p.media_url, type: p.media_type || 'image' })} style={{
                flexShrink: 0, width: 100, borderRadius: 10, overflow: 'hidden',
                border: `1px solid ${p.proof_type === 'winner_proof' ? 'var(--border-subtle)' : 'rgba(239,68,68,0.2)'}`,
                cursor: 'pointer',
              }}>
                {p.media_type === 'image' ? (
                  <img src={p.media_url} alt="Beweis" style={{ width: '100%', height: 80, objectFit: 'cover', display: 'block' }} />
                ) : (
                  <div style={{ width: '100%', height: 80, background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: 24 }}>🎥</span>
                  </div>
                )}
                <div style={{ padding: '4px 6px', background: 'var(--bg-base)' }}>
                  <p style={{ fontSize: 8, fontFamily: 'var(--font-display)', letterSpacing: 1, color: p.proof_type === 'winner_proof' ? 'var(--gold-primary)' : 'var(--status-error)' }}>
                    {p.proof_type === 'winner_proof' ? 'BEWEIS' : 'GEGEN'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Proof preview overlay */}
      {proofPreview && (
        <div onClick={() => setProofPreview(null)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500,
        }}>
          {proofPreview.type === 'video' ? (
            <video
              src={proofPreview.url}
              controls
              autoPlay
              playsInline
              style={{ maxWidth: '90%', maxHeight: '85vh', borderRadius: 8, background: '#000' }}
              onClick={e => e.stopPropagation()}
            />
          ) : (
            <img src={proofPreview.url} alt="Beweis" style={{ maxWidth: '90%', maxHeight: '85vh', borderRadius: 8 }} />
          )}
          <button onClick={() => setProofPreview(null)} style={{ position: 'absolute', top: 20, right: 20, background: 'var(--bg-overlay)', border: 'none', color: 'var(--text-primary)', width: 40, height: 40, borderRadius: '50%', fontSize: 20, cursor: 'pointer' }}>{'\u2715'}</button>
        </div>
      )}

      {/* Media gallery fullscreen preview */}
      {mediaPreview && (
        <div onClick={() => setMediaPreview(null)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500,
        }}>
          {mediaPreview.type === 'video' ? (
            <video
              src={mediaPreview.url}
              controls
              autoPlay
              playsInline
              style={{ maxWidth: '90%', maxHeight: '85vh', borderRadius: 8, background: '#000' }}
              onClick={e => e.stopPropagation()}
            />
          ) : (
            <img src={mediaPreview.url} alt="" style={{ maxWidth: '90%', maxHeight: '85vh', borderRadius: 8 }} />
          )}
          <button onClick={() => setMediaPreview(null)} style={{ position: 'absolute', top: 20, right: 20, background: 'var(--bg-overlay)', border: 'none', color: 'var(--text-primary)', width: 40, height: 40, borderRadius: '50%', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>
      )}

      {/* Propose Winner Modal */}
      {(proposeOpen || resolveOpen) && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'flex-end', zIndex: 200 }} onClick={() => { setProposeOpen(false); setResolveOpen(false) }}>
          <div style={{ width: '100%', maxWidth: 430, margin: '0 auto', background: 'var(--bg-surface)', borderRadius: '20px 20px 0 0', border: '1px solid var(--border-subtle)', padding: '24px 20px 48px' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--gold-primary)', textAlign: 'center', marginBottom: 6 }}>
              {resolveOpen ? 'Streit lösen' : 'Wer hat gewonnen?'}
            </h3>
            <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 24 }}>Wähle den Gewinner</p>
            {[deal.creator, deal.opponent].filter(Boolean).map((p: any) => (
              <button key={p.id} onClick={() => proposeWinner(p.id)} disabled={loading}
                style={{ width: '100%', padding: 18, borderRadius: 12, border: '1px solid var(--border-subtle)', background: p.id === profile?.id ? 'var(--gold-subtle)' : 'var(--bg-overlay)', color: 'var(--gold-primary)', fontFamily: 'var(--font-display)', fontSize: 13, letterSpacing: 2, marginBottom: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                <ProfileImage size={28} avatarUrl={p.avatar_url} name={p.username} />
                {p.id === profile?.id ? `ICH (@${p.username})` : `@${p.username}`}
              </button>
            ))}
            <button onClick={() => { setProposeOpen(false); setResolveOpen(false) }} style={btnOutline}>ABBRECHEN</button>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'flex-end', zIndex: 200 }} onClick={() => setEditOpen(false)}>
          <div style={{ width: '100%', maxWidth: 430, margin: '0 auto', background: 'var(--bg-surface)', borderRadius: '20px 20px 0 0', border: '1px solid var(--border-subtle)', padding: '24px 20px 48px' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--gold-primary)', textAlign: 'center', marginBottom: 24 }}>DEAL BEARBEITEN</h3>
            <label style={{ display: 'block', fontSize: 10, fontFamily: 'var(--font-display)', letterSpacing: 2, color: 'var(--text-muted)', marginBottom: 8 }}>TITEL</label>
            <input value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} style={inputStyle} />
            <label style={{ display: 'block', fontSize: 10, fontFamily: 'var(--font-display)', letterSpacing: 2, color: 'var(--text-muted)', marginBottom: 8, marginTop: 16 }}>EINSATZ</label>
            <input value={editForm.stake} onChange={e => setEditForm(f => ({ ...f, stake: e.target.value }))} style={inputStyle} />
            <button onClick={editDeal} disabled={loading} style={{ ...btnPrimary, marginTop: 20 }}>{loading ? '...' : 'SPEICHERN'}</button>
            <button onClick={() => setEditOpen(false)} style={{ ...btnOutline, marginTop: 10 }}>ABBRECHEN</button>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'flex-end', zIndex: 200 }} onClick={() => setDeleteOpen(false)}>
          <div style={{ width: '100%', maxWidth: 430, margin: '0 auto', background: 'var(--bg-surface)', borderRadius: '20px 20px 0 0', border: '1px solid var(--border-subtle)', padding: '24px 20px 48px' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--status-error)', textAlign: 'center', marginBottom: 8 }}>DEAL ABBRECHEN?</h3>
            <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14, marginBottom: 8 }}>{deal.title}</p>
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, marginBottom: 24 }}>Der Deal wird abgebrochen.</p>
            <button onClick={deleteDeal} style={{ width: '100%', padding: 16, borderRadius: 12, border: '1px solid rgba(248,113,113,0.3)', background: 'rgba(248,113,113,0.1)', color: 'var(--status-error)', fontFamily: 'var(--font-display)', fontSize: 12, letterSpacing: 2, cursor: 'pointer', marginBottom: 10 }}>ABBRECHEN BESTÄTIGEN</button>
            <button onClick={() => setDeleteOpen(false)} style={btnOutline}>ZURÜCK</button>
          </div>
        </div>
      )}


      {/* Confirm Cancel Request Modal */}
      {confirmCancelOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'flex-end', zIndex: 200 }} onClick={() => setConfirmCancelOpen(false)}>
          <div style={{ width: '100%', maxWidth: 430, margin: '0 auto', background: 'var(--bg-surface)', borderRadius: '20px 20px 0 0', border: '1px solid var(--border-subtle)', padding: '24px 20px 48px' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: '#f97316', textAlign: 'center', marginBottom: 8 }}>ABBRUCH ANFRAGEN?</h3>
            <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14, marginBottom: 8 }}>{deal?.title}</p>
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, marginBottom: 24 }}>Dein Gegner muss dem Abbruch zustimmen.</p>
            <button onClick={() => { setConfirmCancelOpen(false); requestCancel() }} style={{ width: '100%', padding: 16, borderRadius: 12, border: '1px solid rgba(249,115,22,0.3)', background: 'rgba(249,115,22,0.1)', color: '#f97316', fontFamily: 'var(--font-display)', fontSize: 12, letterSpacing: 2, cursor: 'pointer', marginBottom: 10 }}>JA, ABBRUCH ANFRAGEN</button>
            <button onClick={() => setConfirmCancelOpen(false)} style={btnOutline}>ZURÜCK</button>
          </div>
        </div>
      )}

      {/* Confirm Accept Cancel Modal */}
      {confirmAcceptCancelOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'flex-end', zIndex: 200 }} onClick={() => setConfirmAcceptCancelOpen(false)}>
          <div style={{ width: '100%', maxWidth: 430, margin: '0 auto', background: 'var(--bg-surface)', borderRadius: '20px 20px 0 0', border: '1px solid var(--border-subtle)', padding: '24px 20px 48px' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--status-error)', textAlign: 'center', marginBottom: 8 }}>ABBRUCH AKZEPTIEREN?</h3>
            <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14, marginBottom: 8 }}>{deal?.title}</p>
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, marginBottom: 24 }}>Der Deal wird endgültig abgebrochen. Diese Aktion kann nicht rückgängig gemacht werden.</p>
            <button onClick={() => { setConfirmAcceptCancelOpen(false); acceptCancel() }} style={{ width: '100%', padding: 16, borderRadius: 12, border: '1px solid rgba(248,113,113,0.3)', background: 'rgba(248,113,113,0.1)', color: 'var(--status-error)', fontFamily: 'var(--font-display)', fontSize: 12, letterSpacing: 2, cursor: 'pointer', marginBottom: 10 }}>JA, ABBRUCH AKZEPTIEREN</button>
            <button onClick={() => setConfirmAcceptCancelOpen(false)} style={btnOutline}>ZURÜCK</button>
          </div>
        </div>
      )}

      {/* Confirm Hard Delete Modal */}
      {confirmHardDeleteOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'flex-end', zIndex: 200 }} onClick={() => setConfirmHardDeleteOpen(false)}>
          <div style={{ width: '100%', maxWidth: 430, margin: '0 auto', background: 'var(--bg-surface)', borderRadius: '20px 20px 0 0', border: '1px solid var(--border-subtle)', padding: '24px 20px 48px' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--status-error)', textAlign: 'center', marginBottom: 8 }}>ENDGÜLTIG LÖSCHEN?</h3>
            <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14, marginBottom: 8 }}>{deal?.title}</p>
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, marginBottom: 24 }}>Der Deal wird unwiderruflich gelöscht. Alle Daten gehen verloren.</p>
            <button onClick={() => { setConfirmHardDeleteOpen(false); hardDelete() }} style={{ width: '100%', padding: 16, borderRadius: 12, border: '1px solid rgba(248,113,113,0.3)', background: 'rgba(248,113,113,0.1)', color: 'var(--status-error)', fontFamily: 'var(--font-display)', fontSize: 12, letterSpacing: 2, cursor: 'pointer', marginBottom: 10 }}>JA, ENDGÜLTIG LÖSCHEN</button>
            <button onClick={() => setConfirmHardDeleteOpen(false)} style={btnOutline}>ZURÜCK</button>
          </div>
        </div>
      )}

      {/* WinCardShare overlay */}
      {showShareCard && deal && (
        <WinCardShare
          open={showShareCard}
          onClose={() => setShowShareCard(false)}
          dealTitle={deal.title}
          stake={deal.stake || ''}
          winner={{
            username: deal.confirmed_winner_id === deal.creator_id ? deal.creator?.username : deal.opponent?.username,
            display_name: deal.confirmed_winner_id === deal.creator_id ? deal.creator?.display_name : deal.opponent?.display_name,
            avatar_url: deal.confirmed_winner_id === deal.creator_id ? deal.creator?.avatar_url : deal.opponent?.avatar_url,
          }}
          loser={{
            username: deal.confirmed_winner_id === deal.creator_id ? deal.opponent?.username : deal.creator?.username,
            display_name: deal.confirmed_winner_id === deal.creator_id ? deal.opponent?.display_name : deal.creator?.display_name,
            avatar_url: deal.confirmed_winner_id === deal.creator_id ? deal.opponent?.avatar_url : deal.creator?.avatar_url,
          }}
          dealId={deal.id}
        />
      )}

      {/* Global animations */}
      <style>{`
        @keyframes pulse-timer {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
      `}</style>
    </div>
  )
}
