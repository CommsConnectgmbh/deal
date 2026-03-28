'use client'
import { useReducer, useRef, useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { uploadDealMedia } from '@/lib/mediaUpload'
import { triggerPush } from '@/lib/sendPushNotification'
import { trackDealCreated, trackDealSent, trackScreenView } from '@/lib/analytics'
import ProfileImage from '@/components/ProfileImage'
import MediaEditor from '@/components/MediaEditor'
import { useLang } from '@/contexts/LanguageContext'

import {
  createDealReducer,
  initialState,
} from '@/lib/createDealReducer'

import StakePresets from '@/components/create-deal/StakePresets'
import DeadlinePresets from '@/components/create-deal/DeadlinePresets'
import OpponentModal from '@/components/create-deal/OpponentModal'
import TeamBuilder from '@/components/create-deal/TeamBuilder'

/* --- Quick challenge templates --- */
const CHALLENGE_CHIPS = [
  'Wer schafft mehr Liegestuetze?',
  'Wer hat Recht?',
  'Wer zuerst?',
  'Verlierer muss...',
  'Wette: Ich schaffe...',
]

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '14px 16px',
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 10, color: 'var(--text-primary)',
  fontSize: 16, fontFamily: 'var(--font-body)',
  outline: 'none', boxSizing: 'border-box',
}

function CreateDealContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { profile } = useAuth()
  const { t } = useLang()
  const [state, dispatch] = useReducer(createDealReducer, initialState)
  const mediaRef = useRef<HTMLInputElement>(null)
  const [showEditor, setShowEditor] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [titleErr, setTitleErr] = useState('')
  const [stakeErr, setStakeErr] = useState('')
  const [titleTouched, setTitleTouched] = useState(false)
  const [stakeTouched, setStakeTouched] = useState(false)

  // Track screen view
  useEffect(() => { trackScreenView('create_deal') }, [])

  // Handle rematch / clone / opponent query params
  useEffect(() => {
    if (!profile) return
    const rematchId = searchParams.get('rematch')
    const cloneId = searchParams.get('clone')
    const opponentUsername = searchParams.get('opponent')

    if (rematchId) {
      loadDealForRematch(rematchId)
    } else if (cloneId) {
      loadDealForClone(cloneId)
    } else if (opponentUsername) {
      loadOpponentByUsername(opponentUsername)
    }
  }, [profile, searchParams])

  async function loadDealForRematch(dealId: string) {
    const { data } = await supabase.from('bets')
      .select('*, creator:creator_id(id,username,display_name,level,avatar_url), opponent:opponent_id(id,username,display_name,level,avatar_url)')
      .eq('id', dealId).single()
    if (data) {
      const otherUser = data.creator_id === profile!.id ? data.opponent : data.creator
      dispatch({ type: 'APPLY_REMATCH', deal: { ...data, opponent: otherUser } })
    }
  }

  async function loadDealForClone(dealId: string) {
    const { data } = await supabase.from('bets')
      .select('id, title, stake, category')
      .eq('id', dealId).single()
    if (data) dispatch({ type: 'APPLY_CLONE', deal: data })
  }

  async function loadOpponentByUsername(username: string) {
    const { data } = await supabase.from('profiles')
      .select('id, username, display_name, level, avatar_url')
      .eq('username', username).single()
    if (data) {
      dispatch({ type: 'SET_OPPONENT', opponent: data })
    }
  }

  /* --- Validation --- */
  const validateTitle = (v: string): string => {
    if (!v.trim()) return t('deals.enterChallenge')
    if (v.trim().length < 3) return t('auth.errorMinThreeChars')
    if (v.trim().length > 100) return 'Max. 100 Zeichen'
    return ''
  }
  const validateStake = (v: string): string => {
    if (!v.trim()) return t('deals.stakeLabel') + ' ' + t('auth.errorUsernameRequired').toLowerCase()
    const num = Number(v.trim())
    if (!isNaN(num)) {
      if (num < 1) return 'Min. 1'
      if (num > 10000) return 'Max. 10.000'
    }
    if (v.trim().length < 2) return 'Min. 2 Zeichen'
    return ''
  }
  const canSubmit = state.title.trim().length >= 3 && state.stake.trim().length >= 2 && !validateTitle(state.title) && !validateStake(state.stake)

  /* --- Dynamic CTA text --- */
  const uploadPercent = state.uploadProgress?.match(/(\d+)%/)?.[1]
  const ctaText = () => {
    if (state.uploadProgress) return state.uploadProgress
    if (state.loading) return '...'
    return 'START CHALLENGE'
  }

  /* --- Submit --- */
  const createDeal = async () => {
    if (!profile) return
    const tErr = validateTitle(state.title)
    const sErr = validateStake(state.stake)
    setTitleErr(tErr); setStakeErr(sErr)
    setTitleTouched(true); setStakeTouched(true)
    if (tErr || sErr) return
    dispatch({ type: 'SET_LOADING', loading: true })

    try {
      // Opponent Filter Check
      if (state.opponent?.id) {
        const { data: opponentProfile } = await supabase
          .from('profiles')
          .select('opponent_filter_enabled, opponent_min_reliability, opponent_require_confirmation, display_name')
          .eq('id', state.opponent.id)
          .single()

        if (opponentProfile?.opponent_filter_enabled) {
          if (opponentProfile.opponent_require_confirmation) {
            // Manual confirmation required
          } else if (opponentProfile.opponent_min_reliability != null) {
            const { data: myProfile } = await supabase
              .from('profiles')
              .select('reliability_score')
              .eq('id', profile.id)
              .single()

            const myScorePct = myProfile?.reliability_score != null
              ? Math.round(myProfile.reliability_score * 100)
              : null

            if (myScorePct === null || myScorePct < opponentProfile.opponent_min_reliability) {
              dispatch({ type: 'SET_LOADING', loading: false })
              alert(
                t('deals.opponentFilterAlert').replace('{min}', String(opponentProfile.opponent_min_reliability))
                + ' ' + (myScorePct === null
                  ? t('deals.opponentFilterNoScore')
                  : t('deals.opponentFilterYourScore').replace('{score}', String(myScorePct)))
              )
              return
            }
          }
        }
      }

      const isOpen = !state.opponent

      const insertData: Record<string, any> = {
        creator_id: profile.id,
        title: state.title.trim(),
        description: state.description?.trim() || null,
        stake: state.stake.trim(),
        category: 'custom',
        is_public: state.visibility !== 'private',
        status: state.opponent ? 'pending' : 'open',
        opponent_id: state.opponent?.id || null,
        creator_side: null,
      }
      if (state.deadline) insertData.deadline = new Date(state.deadline).toISOString()

      const { data: newDeal } = await supabase.from('bets').insert(insertData).select('id').single()

      if (!newDeal?.id) throw new Error('Deal creation failed')

      trackDealCreated(isOpen ? 'open_challenge' : 'direct_challenge')
      if (state.opponent) trackDealSent(newDeal.id)

      // Upload media
      if (state.mediaFile) {
        dispatch({ type: 'SET_UPLOAD_PROGRESS', progress: t('deals.uploading').replace('{percent}', '0') })
        try {
          const { url, type } = await uploadDealMedia(state.mediaFile, newDeal.id, profile.id, (percent) => {
            dispatch({ type: 'SET_UPLOAD_PROGRESS', progress: percent < 100 ? t('deals.uploading').replace('{percent}', String(percent)) : t('deals.saving') })
          })
          dispatch({ type: 'SET_UPLOAD_PROGRESS', progress: t('deals.saving') })
          await supabase.from('bets').update({ media_url: url, media_type: type }).eq('id', newDeal.id)
          dispatch({ type: 'SET_UPLOAD_PROGRESS', progress: null })
        } catch (uploadErr: any) {
          console.error('Media upload error:', uploadErr)
          dispatch({ type: 'SET_UPLOAD_PROGRESS', progress: null })
          dispatch({ type: 'SET_MEDIA_ERROR', error: t('deals.uploadFailed').replace('{error}', uploadErr?.message || 'Unknown error') })
        }
      }

      // Create teams if team mode
      if (state.mode === 'team') {
        const teamAData = { deal_id: newDeal.id, team_name: state.teamA.name, team_color: state.teamA.color, team_side: 'a' }
        const teamBData = { deal_id: newDeal.id, team_name: state.teamB.name, team_color: state.teamB.color, team_side: 'b' }
        const [{ data: tA }, { data: tB }] = await Promise.all([
          supabase.from('deal_teams').insert(teamAData).select('id').single(),
          supabase.from('deal_teams').insert(teamBData).select('id').single(),
        ])

        const participants: any[] = [
          { deal_id: newDeal.id, user_id: profile.id, team_id: tA?.id, role: 'creator' },
        ]
        for (const m of state.teamA.members) {
          participants.push({ deal_id: newDeal.id, user_id: m.id, team_id: tA?.id, role: 'participant' })
        }
        for (const m of state.teamB.members) {
          participants.push({ deal_id: newDeal.id, user_id: m.id, team_id: tB?.id, role: 'participant' })
        }
        if (participants.length > 0) {
          await supabase.from('deal_participants').insert(participants)
        }
      }

      // Push notification to opponent
      if (state.opponent?.id && state.opponent.id !== profile.id) {
        triggerPush(
          state.opponent.id,
          `\u2694\uFE0F ${t('deals.newChallengeNotifTitle')}`,
          t('deals.newChallengeNotifBody').replace('{username}', profile.username),
          `/app/deals/${newDeal.id}`
        )
      }

      // Feed event for public deals
      if (state.visibility !== 'private') {
        await supabase.from('feed_events').insert({
          event_type: 'deal_created',
          user_id: profile.id,
          deal_id: newDeal.id,
          metadata: { title: state.title, stake: state.stake, mode: state.mode, category: state.category },
        })

        if (state.opponent?.id) {
          try {
            await supabase.from('feed_events').insert({
              event_type: 'challenge_invited',
              user_id: profile.id,
              deal_id: newDeal.id,
              metadata: { title: state.title, target_user: state.opponent.username },
            })
          } catch (_) { /* ignore */ }
        }

        if (state.parentDealId) {
          try {
            await supabase.from('feed_events').insert({
              event_type: 'rematch_started',
              user_id: profile.id,
              deal_id: newDeal.id,
              metadata: { title: state.title, parent_deal_id: state.parentDealId },
            })
          } catch (_) { /* ignore */ }
        }
      }

      router.replace(`/app/deals/created?id=${newDeal.id}`)

    } catch (err) {
      console.error('Create deal error:', err)
      dispatch({ type: 'SET_LOADING', loading: false })
    }
  }

  /* --- Media handling --- */
  const MAX_FILE_SIZE = 20 * 1024 * 1024
  const MAX_VIDEO_DURATION = 90

  const handleMediaSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    e.target.value = ''
    dispatch({ type: 'SET_MEDIA_ERROR', error: null })

    if (f.size > MAX_FILE_SIZE) {
      const sizeMB = Math.round(f.size / 1024 / 1024)
      dispatch({ type: 'SET_MEDIA_ERROR', error: t('deals.fileTooLarge').replace('{size}', String(sizeMB)) })
      return
    }

    const isVideo = f.type.startsWith('video/') || /\.(mp4|mov|webm|m4v|3gp|mpeg)$/i.test(f.name || '')

    if (isVideo) {
      let resolved = false
      const objectUrl = URL.createObjectURL(f)
      const video = document.createElement('video')
      video.preload = 'metadata'

      const accept = () => {
        if (resolved) return
        resolved = true
        URL.revokeObjectURL(objectUrl)
        dispatch({ type: 'SET_MEDIA', file: f, preview: URL.createObjectURL(f) })
      }

      video.onloadedmetadata = () => {
        if (resolved) return
        if (video.duration && video.duration > MAX_VIDEO_DURATION) {
          resolved = true
          URL.revokeObjectURL(objectUrl)
          const mins = Math.floor(video.duration / 60)
          const secs = Math.round(video.duration % 60)
          dispatch({ type: 'SET_MEDIA_ERROR', error: t('deals.videoTooLong').replace('{duration}', `${mins}:${secs.toString().padStart(2, '0')}`) })
          return
        }
        accept()
      }

      video.onerror = () => { accept() }

      setTimeout(() => {
        if (!resolved) {
          console.warn('Video metadata timeout — accepting file anyway')
          accept()
        }
      }, 3000)

      video.src = objectUrl
    } else {
      dispatch({ type: 'SET_MEDIA', file: f, preview: URL.createObjectURL(f) })
    }
  }

  if (!profile) return <div style={{ minHeight: '100dvh', background: 'var(--bg-base)' }} />

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
      {/* ═══ HEADER ═══ */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '16px 20px',
        borderBottom: '1px solid var(--border-subtle)',
        background: 'var(--bg-base)',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <button
          onClick={() => router.back()}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-primary)', fontSize: 20, padding: 0,
            display: 'flex', alignItems: 'center',
          }}
        >
          {'\u2190'}
        </button>
        <h1 style={{
          margin: 0, fontFamily: 'var(--font-display)',
          fontSize: 14, letterSpacing: 3, color: 'var(--text-primary)',
        }}>
          NEW DEAL
        </h1>
      </div>

      {/* ═══ FORM BODY ═══ */}
      <div style={{ padding: '20px 20px 20px', display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* ── CHALLENGE ── */}
        <div>
          <label style={{
            display: 'block', fontSize: 10, fontFamily: 'var(--font-display)',
            letterSpacing: 2, color: 'var(--text-secondary)', marginBottom: 8,
          }}>
            CHALLENGE *
          </label>
          <div style={{ position: 'relative' }}>
            <input
              value={state.title}
              onChange={e => {
                dispatch({ type: 'SET_FIELD', field: 'title', value: e.target.value.slice(0, 100) })
                if (titleTouched) setTitleErr(validateTitle(e.target.value.slice(0, 100)))
              }}
              onBlur={() => { setTitleTouched(true); setTitleErr(validateTitle(state.title)) }}
              placeholder="Wer schafft mehr Liegestuetze?"
              style={{
                ...inputStyle,
                fontSize: 18,
                padding: '16px 16px',
                border: titleErr ? '1px solid var(--status-error)' : inputStyle.border,
              }}
              autoFocus
            />
            <span style={{
              position: 'absolute', right: 12, bottom: titleErr ? 30 : 16,
              fontSize: 11, color: 'var(--text-muted)',
            }}>
              {state.title.length}/100
            </span>
          </div>
          {titleErr && <p style={{ color: 'var(--status-error)', fontSize: 12, margin: '4px 0 0' }}>{titleErr}</p>}

          {/* Quick template chips */}
          <div style={{
            display: 'flex', gap: 6, overflowX: 'auto',
            marginTop: 10, paddingBottom: 4, scrollbarWidth: 'none',
          }}>
            {CHALLENGE_CHIPS.map((chip) => (
              <button
                key={chip}
                onClick={() => dispatch({ type: 'SET_FIELD', field: 'title', value: chip })}
                style={{
                  flexShrink: 0, padding: '6px 12px', borderRadius: 20,
                  border: state.title === chip ? '1.5px solid var(--gold-primary)' : '1px solid var(--border-subtle)',
                  background: state.title === chip ? 'rgba(255,184,0,0.08)' : 'var(--bg-surface)',
                  color: state.title === chip ? 'var(--gold-primary)' : 'var(--text-muted)',
                  fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap',
                  fontFamily: 'var(--font-body)',
                }}
              >
                {chip}
              </button>
            ))}
          </div>
        </div>

        {/* ── STAKE ── */}
        <StakePresets
          value={state.stake}
          onChange={v => {
            dispatch({ type: 'SET_FIELD', field: 'stake', value: v })
            if (stakeTouched) setStakeErr(validateStake(v))
          }}
          error={stakeErr}
          onBlur={() => { setStakeTouched(true); setStakeErr(validateStake(state.stake)) }}
          onKeyDown={e => { if (e.key === 'Enter' && canSubmit) createDeal() }}
        />

        {/* ── OPPONENT ── */}
        <div>
          <label style={{
            display: 'block', fontSize: 10, fontFamily: 'var(--font-display)',
            letterSpacing: 2, color: 'var(--text-secondary)', marginBottom: 10,
          }}>
            GEGNER
          </label>
          {state.opponent ? (
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 16px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 12,
              }}
            >
              <ProfileImage size={44} avatarUrl={state.opponent.avatar_url} name={state.opponent.username} />
              <div style={{ flex: 1 }}>
                <p style={{
                  margin: 0, color: 'var(--text-primary)',
                  fontSize: 14, fontWeight: 600, fontFamily: 'var(--font-body)',
                }}>
                  {state.opponent.display_name}
                </p>
                <p style={{
                  margin: 0, color: 'var(--text-muted)',
                  fontSize: 12, fontFamily: 'var(--font-body)',
                }}>
                  @{state.opponent.username}
                </p>
              </div>
              <button
                onClick={() => dispatch({ type: 'SET_OPPONENT', opponent: null })}
                style={{
                  background: 'none', border: 'none',
                  color: 'var(--text-muted)', cursor: 'pointer',
                  fontSize: 16, padding: 4,
                }}
              >
                {'\u2715'}
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Freund herausfordern */}
              <button
                onClick={() => dispatch({ type: 'SET_SHOW_OPPONENT_MODAL', show: true })}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 16px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 12,
                  cursor: 'pointer',
                  width: '100%',
                  textAlign: 'left',
                  transition: 'border-color 0.2s',
                }}
              >
                <div style={{
                  width: 40, height: 40, borderRadius: '50%',
                  background: 'rgba(255,184,0,0.08)',
                  border: '1.5px solid var(--gold-primary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--gold-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{
                    margin: 0, color: 'var(--gold-primary)',
                    fontSize: 14, fontWeight: 600, fontFamily: 'var(--font-display)',
                    letterSpacing: 0.5,
                  }}>
                    Freund herausfordern
                  </p>
                </div>
                <span style={{ color: 'var(--text-muted)', fontSize: 16 }}>{'\u203A'}</span>
              </button>

              {/* Info text */}
              <p style={{
                margin: 0, padding: '0 4px',
                color: 'var(--text-muted)',
                fontSize: 12, fontFamily: 'var(--font-body)',
                lineHeight: 1.4,
              }}>
                Oder erstelle den Deal offen - du kannst ihn danach per WhatsApp teilen
              </p>
            </div>
          )}
        </div>

        {/* ── VISIBILITY (always visible) ── */}
        <div>
          <label style={{
            display: 'block', fontSize: 10, fontFamily: 'var(--font-display)',
            letterSpacing: 2, color: 'var(--text-secondary)', marginBottom: 8,
          }}>
            {t('deals.visibility')}
          </label>
          <div style={{ display: 'flex', gap: 6 }}>
            {[
              { value: 'public' as const, icon: '\u{1F310}', label: t('deals.visibilityPublic') },
              { value: 'friends' as const, icon: '\u{1F465}', label: t('deals.visibilityFriends') },
              { value: 'private' as const, icon: '\u{1F512}', label: t('deals.visibilityPrivate') },
            ].map(v => {
              const active = state.visibility === v.value
              return (
                <button
                  key={v.value}
                  onClick={() => dispatch({ type: 'SET_FIELD', field: 'visibility', value: v.value })}
                  style={{
                    flex: 1, padding: '10px 8px', borderRadius: 10,
                    border: active ? '1.5px solid var(--gold-primary)' : '1px solid var(--border-subtle)',
                    background: active ? 'rgba(255,184,0,0.06)' : 'var(--bg-surface)',
                    cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  }}
                >
                  <span style={{ fontSize: 16 }}>{v.icon}</span>
                  <span style={{
                    fontSize: 9, fontFamily: 'var(--font-display)',
                    letterSpacing: 1, color: active ? 'var(--gold-primary)' : 'var(--text-muted)',
                  }}>
                    {v.label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* ── MEDIA UPLOAD (single button) ── */}
        <div>
          {state.mediaPreview ? (
            <div style={{ position: 'relative' }}>
              {state.mediaFile?.type.startsWith('video/') ? (
                <video
                  src={state.mediaPreview}
                  controls playsInline muted
                  style={{ width: '100%', borderRadius: 12, maxHeight: 220, objectFit: 'contain', background: '#000' }}
                />
              ) : (
                <img src={state.mediaPreview} alt="" style={{ width: '100%', borderRadius: 12, maxHeight: 220, objectFit: 'cover' }} />
              )}
              <button
                onClick={() => dispatch({ type: 'SET_MEDIA', file: null, preview: null })}
                style={{
                  position: 'absolute', top: 8, right: 8,
                  width: 28, height: 28, borderRadius: '50%',
                  background: 'rgba(0,0,0,0.7)', border: 'none',
                  color: 'var(--text-primary)', fontSize: 14,
                  cursor: 'pointer', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                {'\u2715'}
              </button>
              <button
                onClick={() => setShowEditor(true)}
                style={{
                  position: 'absolute', top: 8, right: 44,
                  height: 28, borderRadius: 14, paddingLeft: 10, paddingRight: 10,
                  background: 'rgba(255,184,0,0.85)', border: 'none',
                  color: '#060606', fontSize: 10, fontWeight: 800,
                  fontFamily: 'var(--font-display)', letterSpacing: 1,
                  cursor: 'pointer', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', gap: 4,
                }}
              >
                {'\u270F\uFE0F'} {t('editor.editMedia')}
              </button>
            </div>
          ) : (
            <button
              onClick={() => mediaRef.current?.click()}
              style={{
                width: '100%', padding: '14px 16px', borderRadius: 12,
                border: '1.5px dashed rgba(255,184,0,0.3)',
                background: 'rgba(255,184,0,0.03)',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              <span style={{ fontSize: 18 }}>{'\u{1F4F7}'}</span>
              <span style={{
                fontSize: 11, color: 'var(--gold-primary)', fontFamily: 'var(--font-display)',
                fontWeight: 700, letterSpacing: 1,
              }}>
                FOTO / VIDEO
              </span>
            </button>
          )}
          <input
            ref={mediaRef} type="file" accept="image/*,video/*"
            style={{ display: 'none' }}
            onChange={handleMediaSelect}
          />
          {state.mediaError && (
            <div style={{
              marginTop: 8, padding: '10px 14px', borderRadius: 10,
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
            }}>
              <p style={{ color: '#EF4444', fontSize: 12, margin: 0, fontFamily: 'var(--font-body)' }}>
                {state.mediaError}
              </p>
            </div>
          )}
        </div>

        {/* ── ADVANCED OPTIONS (accordion) ── */}
        <div>
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            style={{
              width: '100%', padding: '14px 16px', borderRadius: 12,
              border: showAdvanced ? '1.5px solid var(--gold-primary)' : '1.5px solid rgba(255,184,0,0.25)',
              background: showAdvanced ? 'rgba(255,184,0,0.06)' : 'rgba(255,184,0,0.02)',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}
          >
            <span style={{
              fontSize: 11, fontFamily: 'var(--font-display)',
              letterSpacing: 2, color: 'var(--gold-primary)',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              {'\u2699\uFE0F'} ERWEITERTE OPTIONEN
            </span>
            <span style={{
              fontSize: 14, color: 'var(--gold-primary)',
              transform: showAdvanced ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease',
            }}>
              {'\u25BC'}
            </span>
          </button>

          <div style={{
            overflow: 'hidden',
            display: 'grid',
            gridTemplateRows: showAdvanced ? '1fr' : '0fr',
            transition: 'grid-template-rows 0.3s ease',
          }}>
            <div style={{ minHeight: 0, overflow: 'hidden' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingTop: 16 }}>

                {/* Deadline */}
                <DeadlinePresets
                  value={state.deadline}
                  onChange={v => dispatch({ type: 'SET_FIELD', field: 'deadline', value: v })}
                />

                {/* Team Mode */}
                <div>
                  <label style={{
                    display: 'block', fontSize: 10, fontFamily: 'var(--font-display)',
                    letterSpacing: 2, color: 'var(--text-secondary)', marginBottom: 8,
                  }}>
                    MODUS
                  </label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {[
                      { value: '1v1' as const, label: '1 vs 1' },
                      { value: 'team' as const, label: 'Team vs Team' },
                    ].map(opt => {
                      const active = state.mode === opt.value
                      return (
                        <button
                          key={opt.value}
                          onClick={() => dispatch({ type: 'SET_MODE', mode: opt.value })}
                          style={{
                            flex: 1, padding: '10px 8px', borderRadius: 10,
                            border: active ? '1.5px solid var(--gold-primary)' : '1px solid var(--border-subtle)',
                            background: active ? 'rgba(255,184,0,0.06)' : 'var(--bg-surface)',
                            cursor: 'pointer',
                            fontSize: 12, fontFamily: 'var(--font-display)',
                            fontWeight: 700, letterSpacing: 1,
                            color: active ? 'var(--gold-primary)' : 'var(--text-muted)',
                          }}
                        >
                          {opt.label}
                        </button>
                      )
                    })}
                  </div>
                  {state.mode === 'team' && (
                    <div style={{ marginTop: 12 }}>
                      <TeamBuilder
                        teamA={state.teamA}
                        teamB={state.teamB}
                        onAddMember={(side, member) => dispatch({ type: 'ADD_TEAM_MEMBER', side, member })}
                        onRemoveMember={(side, userId) => dispatch({ type: 'REMOVE_TEAM_MEMBER', side, userId })}
                        onSetName={(side, name) => dispatch({ type: 'SET_TEAM_NAME', side, name })}
                        onSetColor={(side, color) => dispatch({ type: 'SET_TEAM_COLOR', side, color })}
                      />
                    </div>
                  )}
                </div>

                {/* Rules / Description */}
                <div>
                  <label style={{
                    display: 'block', fontSize: 10, fontFamily: 'var(--font-display)',
                    letterSpacing: 2, color: 'var(--text-secondary)', marginBottom: 8,
                  }}>
                    {t('deals.rulesLabel')}
                  </label>
                  <textarea
                    value={state.description || ''}
                    onChange={e => dispatch({ type: 'SET_FIELD', field: 'description', value: e.target.value })}
                    placeholder={t('deals.rulesPlaceholder')}
                    rows={3}
                    style={{
                      ...inputStyle,
                      resize: 'vertical', minHeight: 60,
                      fontFamily: 'var(--font-body)',
                    }}
                  />
                </div>

              </div>
            </div>
          </div>
        </div>

      </div>

      {/* ═══ FIXED BOTTOM CTA ═══ */}
      <div style={{
        position: 'sticky', bottom: 0, left: 0, right: 0,
        padding: '12px 20px', paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
        background: 'var(--bg-base)',
        borderTop: '1px solid var(--border-subtle)',
        zIndex: 10,
      }}>
        {/* Upload progress bar */}
        {uploadPercent && (
          <div style={{ marginBottom: 8 }}>
            <div style={{
              height: 6, borderRadius: 3, background: 'var(--bg-elevated)',
              overflow: 'hidden',
            }}>
              <div style={{
                height: '100%', width: `${uploadPercent}%`,
                background: 'linear-gradient(90deg, var(--gold-dim), var(--gold-primary), var(--gold-bright))',
                borderRadius: 3, transition: 'width 0.3s ease',
              }} />
            </div>
          </div>
        )}
        <button
          onClick={createDeal}
          disabled={state.loading || !canSubmit}
          style={{
            width: '100%', padding: 18, borderRadius: 12,
            border: 'none',
            cursor: state.loading ? 'wait' : canSubmit ? 'pointer' : 'not-allowed',
            background: canSubmit
              ? 'linear-gradient(135deg, var(--gold-dim), var(--gold-primary))'
              : 'var(--bg-elevated)',
            color: canSubmit ? 'var(--text-inverse)' : 'var(--text-muted)',
            fontFamily: 'var(--font-display)',
            fontSize: 13, fontWeight: 700, letterSpacing: 3,
            opacity: state.loading ? 0.6 : 1,
          }}
        >
          {ctaText()}
        </button>
      </div>

      {/* ═══ OPPONENT MODAL ═══ */}
      <OpponentModal
        show={state.showOpponentModal}
        onSelect={(p) => {
          dispatch({ type: 'SET_OPPONENT', opponent: p })
          dispatch({ type: 'SET_SHOW_OPPONENT_MODAL', show: false })
        }}
        onClose={() => dispatch({ type: 'SET_SHOW_OPPONENT_MODAL', show: false })}
      />

      {/* ═══ MEDIA EDITOR OVERLAY ═══ */}
      {showEditor && state.mediaFile && (
        <MediaEditor
          file={state.mediaFile}
          onDone={(editedFile, editedPreview) => {
            dispatch({ type: 'SET_MEDIA', file: editedFile, preview: editedPreview })
            setShowEditor(false)
          }}
          onCancel={() => setShowEditor(false)}
        />
      )}
    </div>
  )
}

export default function CreateDealPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100dvh', background: 'var(--bg-base)' }} />}>
      <CreateDealContent />
    </Suspense>
  )
}
