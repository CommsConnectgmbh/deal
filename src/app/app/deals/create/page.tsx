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
  CATEGORIES,
} from '@/lib/createDealReducer'

import CreateDealHeader from '@/components/create-deal/CreateDealHeader'
import TemplateCarousel from '@/components/create-deal/TemplateCarousel'
import StakePresets from '@/components/create-deal/StakePresets'
import CategoryPicker from '@/components/create-deal/CategoryPicker'
import DeadlinePresets from '@/components/create-deal/DeadlinePresets'
import ModeSelector from '@/components/create-deal/ModeSelector'
import OpponentSearch from '@/components/create-deal/OpponentSearch'
import TeamBuilder from '@/components/create-deal/TeamBuilder'

/* --- Quick templates (fallback when DB templates not loaded yet) --- */
const QUICK_TEMPLATE_KEYS = [
  { labelKey: 'deals.templateWhoDoesMore', valueKey: 'deals.templateWhoDoesMoreVal' },
  { labelKey: 'deals.templateWhoIsRight', valueKey: 'deals.templateWhoIsRightVal' },
  { labelKey: 'deals.templateTeamVsTeam', valueKey: 'deals.templateTeamVsTeamVal' },
  { labelKey: 'deals.templateWhoFirst', valueKey: 'deals.templateWhoFirstVal' },
  { labelKey: 'deals.templateLoserMust', valueKey: 'deals.templateLoserMustVal' },
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
  const [showAdvanced, setShowAdvanced] = useReducerCompat(false)
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
      dispatch({ type: 'SET_STEP', step: 'challenge' })
    }
  }

  /* --- Step logic --- */
  const stepNumber = state.step === 'gegner' ? 1 : state.step === 'challenge' ? 2 : 3
  const totalSteps = 3

  const goBack = () => {
    if (state.step === 'einsatz') dispatch({ type: 'SET_STEP', step: 'challenge' })
    else if (state.step === 'challenge') dispatch({ type: 'SET_STEP', step: 'gegner' })
    else router.back()
  }

  const goNext = () => {
    if (state.step === 'gegner') dispatch({ type: 'SET_STEP', step: 'challenge' })
    else if (state.step === 'challenge') {
      const tErr = validateTitle(state.title)
      setTitleErr(tErr); setTitleTouched(true)
      if (tErr) return
      dispatch({ type: 'SET_STEP', step: 'einsatz' })
    }
  }

  /* --- Validation per step --- */
  const validateTitle = (v: string): string => {
    if (!v.trim()) return t('deals.enterChallenge')
    if (v.trim().length < 3) return t('auth.errorMinThreeChars')
    if (v.trim().length > 100) return 'Max. 100 Zeichen'
    return ''
  }
  const validateStake = (v: string): string => {
    if (!v.trim()) return t('deals.stakeLabel') + ' ' + t('auth.errorUsernameRequired').toLowerCase()
    if (v.trim().length < 2) return 'Min. 2 Zeichen'
    return ''
  }
  const canGoToChallenge = state.mode !== '1v1' || state.opponent !== null
  const canGoToEinsatz = state.title.trim().length >= 3
  const canSubmit = state.title.trim().length >= 3 && state.stake.trim().length >= 2

  /* --- Dynamic CTA text --- */
  const uploadPercent = state.uploadProgress?.match(/(\d+)%/)?.[1]
  const ctaText = () => {
    if (state.uploadProgress) return state.uploadProgress
    if (state.loading) return '...'
    if (!state.opponent && state.mode !== 'team') return `${t('deals.publishChallenge')} \u26A1`
    if (state.mode === 'team') return `${t('deals.startTeamChallenge')} \u2694\uFE0F`
    return `${t('deals.startChallenge')} \u2694\uFE0F`
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
      // ── Opponent Filter Check ──
      if (state.opponent?.id) {
        const { data: opponentProfile } = await supabase
          .from('profiles')
          .select('opponent_filter_enabled, opponent_min_reliability, opponent_require_confirmation, display_name')
          .eq('id', state.opponent.id)
          .single()

        if (opponentProfile?.opponent_filter_enabled) {
          if (opponentProfile.opponent_require_confirmation) {
            // Manual confirmation required — deal will be 'pending', opponent sees notification
            // This is the default flow, no blocking needed
          } else if (opponentProfile.opponent_min_reliability != null) {
            // Check challenger's reliability score
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

      const isOpen = state.mode === 'open_challenge' || (!state.opponent && state.mode === '1v1')

      const insertData: Record<string, any> = {
        creator_id: profile.id,
        title: state.title.trim(),
        description: state.description?.trim() || null,
        stake: state.stake.trim(),
        category: state.category,
        is_public: state.visibility !== 'private',
        status: state.opponent ? 'pending' : 'open',
        opponent_id: state.opponent?.id || null,
        creator_side: state.creatorSide,
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

        // challenge_invited event when direct opponent is set
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

        // rematch_started event when this is a rematch
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

      router.push(`/app/deals/${newDeal.id}`)

    } catch (err) {
      console.error('Create deal error:', err)
      dispatch({ type: 'SET_LOADING', loading: false })
    }
  }

  /* --- Media handling --- */
  const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20 MB (Instagram Reels-style)
  const MAX_VIDEO_DURATION = 90 // 90 Sekunden (wie Instagram Reels)

  const handleMediaSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    e.target.value = ''
    dispatch({ type: 'SET_MEDIA_ERROR', error: null })

    // File size check
    if (f.size > MAX_FILE_SIZE) {
      const sizeMB = Math.round(f.size / 1024 / 1024)
      dispatch({ type: 'SET_MEDIA_ERROR', error: t('deals.fileTooLarge').replace('{size}', String(sizeMB)) })
      return
    }

    const isVideo = f.type.startsWith('video/') || /\.(mp4|mov|webm|m4v|3gp|mpeg)$/i.test(f.name || '')

    // Video duration check with timeout fallback
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

      video.onerror = () => {
        // Can't read metadata — accept anyway, let server handle it
        accept()
      }

      // Timeout: if metadata doesn't load within 3s, accept the video anyway
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
      <CreateDealHeader step={stepNumber} totalSteps={totalSteps} onBack={goBack} />

      <div style={{ padding: '16px 20px 120px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ====================================================
            STEP 1: Gegner & Modus
            ==================================================== */}
        {state.step === 'gegner' && (
          <>
            {/* VS Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 16, padding: '8px 0',
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <ProfileImage size={56} avatarUrl={profile.avatar_url} name={profile.username} />
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>@{profile.username}</span>
              </div>
              <span style={{
                fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 900,
                color: 'var(--gold-primary)',
                textShadow: '0 0 20px var(--gold-subtle)',
                letterSpacing: 3,
              }}>VS</span>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                {state.opponent ? (
                  <>
                    <ProfileImage size={56} avatarUrl={state.opponent.avatar_url} name={state.opponent.username} />
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>@{state.opponent.username}</span>
                  </>
                ) : (
                  <>
                    <div style={{
                      width: 56, height: 56, borderRadius: '50%',
                      border: '2px dashed var(--gold-primary)',
                      background: 'var(--bg-surface)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <span style={{ fontSize: 20, color: 'var(--gold-primary)' }}>?</span>
                    </div>
                    <span style={{ fontSize: 10, color: 'var(--gold-primary)' }}>
                      {t('deals.chooseOpponent')}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Mode Selector — always visible */}
            <ModeSelector
              selected={state.mode}
              onSelect={m => {
                dispatch({ type: 'SET_MODE', mode: m })
                // Clear opponent when switching to non-1v1
                if (m !== '1v1' && state.opponent) {
                  dispatch({ type: 'SET_OPPONENT', opponent: null })
                }
              }}
            />

            {/* Opponent Search (1v1 mode) */}
            {state.mode === '1v1' && (
              <OpponentSearch
                selected={state.opponent}
                onSelect={p => dispatch({ type: 'SET_OPPONENT', opponent: p })}
                onSkipToOpen={() => {
                  dispatch({ type: 'SET_MODE', mode: 'open_challenge' })
                }}
              />
            )}

            {/* Team mode hint */}
            {state.mode === 'team' && (
              <div style={{
                textAlign: 'center', padding: '24px 16px',
                background: 'var(--bg-surface)', borderRadius: 14,
                border: '1px solid var(--border-subtle)',
              }}>
                <span style={{ fontSize: 36, display: 'block', marginBottom: 8 }}>{'\u{1F46B}'}</span>
                <p style={{
                  fontFamily: 'var(--font-display)', fontSize: 13,
                  color: 'var(--gold-primary)', letterSpacing: 1, marginBottom: 6, margin: '0 0 6px',
                }}>
                  TEAM VS TEAM
                </p>
                <p style={{ color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.5, margin: 0 }}>
                  {t('deals.teamConfigStep3')}
                </p>
              </div>
            )}

            {/* Open challenge hint */}
            {state.mode === 'open_challenge' && (
              <div style={{
                textAlign: 'center', padding: '24px 16px',
                background: 'var(--bg-surface)', borderRadius: 14,
                border: '1px solid var(--border-subtle)',
              }}>
                <span style={{ fontSize: 36, display: 'block', marginBottom: 8 }}>{'\u{1F310}'}</span>
                <p style={{
                  fontFamily: 'var(--font-display)', fontSize: 13,
                  color: 'var(--gold-primary)', letterSpacing: 1, marginBottom: 6, margin: '0 0 6px',
                }}>
                  {t('deals.openChallenge').toUpperCase()}
                </p>
                <p style={{ color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.5, margin: 0 }}>
                  {t('deals.anyoneCanJoin')}
                </p>
              </div>
            )}

            {/* Continue button */}
            <button
              onClick={goNext}
              disabled={!canGoToChallenge}
              style={{
                width: '100%', padding: 18, borderRadius: 12,
                border: 'none',
                cursor: canGoToChallenge ? 'pointer' : 'not-allowed',
                background: canGoToChallenge
                  ? 'linear-gradient(135deg, var(--gold-dim), var(--gold-primary))'
                  : 'var(--bg-elevated)',
                color: canGoToChallenge ? 'var(--text-inverse)' : 'var(--text-muted)',
                fontFamily: 'var(--font-display)',
                fontSize: 12, fontWeight: 700, letterSpacing: 3,
              }}
            >
              {canGoToChallenge ? `${t('deals.navNext')} \u2192` : state.mode === '1v1' ? t('deals.selectOpponent') : `${t('deals.navNext')} \u2192`}
            </button>
          </>
        )}

        {/* ====================================================
            STEP 2: Challenge definieren
            ==================================================== */}
        {state.step === 'challenge' && (
          <>
            {/* Templates */}
            <TemplateCarousel
              onSelect={tpl => dispatch({ type: 'APPLY_TEMPLATE', template: tpl })}
              activeTemplateId={state.templateId}
            />

            {/* Quick title templates (fallback) */}
            <div style={{
              display: 'flex', gap: 6, overflowX: 'auto',
              paddingBottom: 4, scrollbarWidth: 'none',
            }}>
              {QUICK_TEMPLATE_KEYS.map((tpl, i) => (
                <button
                  key={i}
                  onClick={() => dispatch({ type: 'SET_FIELD', field: 'title', value: t(tpl.valueKey) })}
                  style={{
                    flexShrink: 0, padding: '6px 12px', borderRadius: 20,
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--bg-surface)',
                    color: 'var(--text-muted)', fontSize: 11,
                    cursor: 'pointer', whiteSpace: 'nowrap',
                  }}
                >
                  {t(tpl.labelKey)}
                </button>
              ))}
            </div>

            {/* Challenge Title */}
            <div>
              <label style={{
                display: 'block', fontSize: 10, fontFamily: 'var(--font-display)',
                letterSpacing: 2, color: 'var(--text-secondary)', marginBottom: 8,
              }}>
                {t('deals.challengeLabel')}
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  value={state.title}
                  onChange={e => { dispatch({ type: 'SET_FIELD', field: 'title', value: e.target.value.slice(0, 100) }); if (titleTouched) setTitleErr(validateTitle(e.target.value.slice(0, 100))) }}
                  onBlur={() => { setTitleTouched(true); setTitleErr(validateTitle(state.title)) }}
                  placeholder={t('deals.challengePlaceholder')}
                  style={{ ...inputStyle, border: titleErr ? '1px solid var(--status-error)' : inputStyle.border }}
                  autoFocus
                />
                <span style={{
                  position: 'absolute', right: 12, bottom: titleErr ? 30 : 14,
                  fontSize: 11, color: 'var(--text-muted)',
                }}>
                  {state.title.length}/100
                </span>
              </div>
              {titleErr && <p style={{ color: 'var(--status-error)', fontSize: 12, marginTop: 4, margin: '4px 0 0' }}>{titleErr}</p>}
            </div>

            {/* Category */}
            <CategoryPicker
              value={state.category}
              onChange={v => dispatch({ type: 'SET_FIELD', field: 'category', value: v })}
            />

            {/* Choose Side */}
            <div>
              <label style={{
                display: 'block', fontSize: 10, fontFamily: 'var(--font-display)',
                letterSpacing: 2, color: 'var(--text-secondary)', marginBottom: 8,
              }}>
                {t('deals.chooseSide')}
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[
                  { value: 'yes', labelKey: 'deals.sideYes' },
                  { value: 'no', labelKey: 'deals.sideNo' },
                ].map(side => {
                  const active = state.creatorSide === side.value
                  return (
                    <button
                      key={side.value}
                      onClick={() => dispatch({ type: 'SET_CREATOR_SIDE', side: active ? null : side.value })}
                      style={{
                        flex: 1, padding: '10px 16px', borderRadius: 10,
                        border: 'none',
                        background: active ? '#FFB800' : 'rgba(255,255,255,0.06)',
                        color: active ? '#060606' : 'rgba(255,255,255,0.5)',
                        fontFamily: 'var(--font-display)',
                        fontSize: 11, fontWeight: active ? 800 : 400,
                        letterSpacing: 1,
                        cursor: 'pointer',
                        transition: 'background 0.2s, color 0.2s',
                      }}
                    >
                      {t(side.labelKey)}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Optional Description */}
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

            {/* Nav buttons */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={goBack}
                style={{
                  flex: 1, padding: 16, borderRadius: 12,
                  border: '1px solid var(--bg-elevated)',
                  background: 'transparent',
                  color: 'var(--text-muted)',
                  fontFamily: 'var(--font-display)',
                  fontSize: 11, cursor: 'pointer',
                }}
              >
                {'\u2190'} {t('deals.navBack')}
              </button>
              <button
                onClick={goNext}
                disabled={!canGoToEinsatz}
                style={{
                  flex: 2, padding: 16, borderRadius: 12,
                  border: 'none',
                  cursor: canGoToEinsatz ? 'pointer' : 'not-allowed',
                  background: canGoToEinsatz
                    ? 'linear-gradient(135deg, var(--gold-dim), var(--gold-primary))'
                    : 'var(--bg-elevated)',
                  color: canGoToEinsatz ? 'var(--text-inverse)' : 'var(--text-muted)',
                  fontFamily: 'var(--font-display)',
                  fontSize: 12, fontWeight: 700, letterSpacing: 2,
                }}
              >
                {canGoToEinsatz ? `${t('deals.navNext')} \u2192` : t('deals.enterChallenge')}
              </button>
            </div>
          </>
        )}

        {/* ====================================================
            STEP 3: Einsatz & Optionen
            ==================================================== */}
        {state.step === 'einsatz' && (
          <>
            {/* Summary bar */}
            <div style={{
              background: 'var(--bg-surface)', borderRadius: 12,
              padding: 12, border: '1px solid var(--bg-elevated)',
            }}>
              <p style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 4, margin: '0 0 4px' }}>
                {state.opponent ? (
                  <>{t('deals.against')} <span style={{ color: 'var(--gold-primary)' }}>@{state.opponent.username}</span></>
                ) : state.mode === 'team' ? (
                  <span style={{ color: 'var(--gold-primary)' }}>Team vs Team</span>
                ) : (
                  <span style={{ color: 'var(--gold-primary)' }}>{t('deals.openChallenge')}</span>
                )}
              </p>
              <p style={{ color: 'var(--text-muted)', fontSize: 12, margin: 0 }}>
                {t('deals.challengeColon')} <span style={{ color: 'var(--text-primary)' }}>{state.title}</span>
              </p>
            </div>

            {/* Stake */}
            <StakePresets
              value={state.stake}
              onChange={v => { dispatch({ type: 'SET_FIELD', field: 'stake', value: v }); if (stakeTouched) setStakeErr(validateStake(v)) }}
              error={stakeErr}
              onBlur={() => { setStakeTouched(true); setStakeErr(validateStake(state.stake)) }}
              onKeyDown={e => { if (e.key === 'Enter') createDeal() }}
            />

            {/* Deadline */}
            <DeadlinePresets
              value={state.deadline}
              onChange={v => dispatch({ type: 'SET_FIELD', field: 'deadline', value: v })}
            />

            {/* Visibility */}
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

            {/* Media Upload */}
            <div>
              <label style={{
                display: 'flex', alignItems: 'center', gap: 6,
                fontSize: 10, fontFamily: 'var(--font-display)',
                letterSpacing: 2, color: 'var(--text-secondary)', marginBottom: 8,
              }}>
                {'\u{1F3AC}'} {t('deals.addMedia')}
              </label>
              {state.mediaPreview ? (
                <div style={{ position: 'relative', marginBottom: 4 }}>
                  {state.mediaFile?.type.startsWith('video/') ? (
                    <video
                      src={state.mediaPreview}
                      controls
                      playsInline
                      muted
                      style={{ width: '100%', borderRadius: 12, maxHeight: 220, objectFit: 'contain', background: '#000' }}
                    />
                  ) : (
                    <img src={state.mediaPreview} alt="" style={{ width: '100%', borderRadius: 12, maxHeight: 220, objectFit: 'cover' }} />
                  )}
                  {/* Remove button */}
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
                  {/* Edit button */}
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
                  <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 10 }}>{state.mediaFile?.type.startsWith('video/') ? '\u{1F3AC}' : '\u{1F4F8}'}</span>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>
                      {state.mediaFile?.name}
                    </span>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 10, width: '100%' }}>
                  {/* Kamera-Button */}
                  <button
                    onClick={() => document.getElementById('cameraCaptureInput')?.click()}
                    style={{
                      flex: 1, padding: '16px 12px', borderRadius: 14,
                      border: '2px dashed rgba(255,184,0,0.3)',
                      background: 'rgba(255,184,0,0.03)',
                      cursor: 'pointer', textAlign: 'center',
                      transition: 'border-color 0.2s, background 0.2s',
                    }}
                  >
                    <span style={{ fontSize: 26, display: 'block', marginBottom: 6 }}>{'\u{1F4F7}'}</span>
                    <p style={{
                      fontSize: 10, color: 'var(--gold-primary)', fontFamily: 'var(--font-display)',
                      fontWeight: 700, letterSpacing: 1, margin: 0,
                    }}>
                      KAMERA
                    </p>
                  </button>
                  {/* Galerie-Button */}
                  <button
                    onClick={() => mediaRef.current?.click()}
                    style={{
                      flex: 1, padding: '16px 12px', borderRadius: 14,
                      border: '2px dashed rgba(255,184,0,0.3)',
                      background: 'rgba(255,184,0,0.03)',
                      cursor: 'pointer', textAlign: 'center',
                      transition: 'border-color 0.2s, background 0.2s',
                    }}
                  >
                    <span style={{ fontSize: 26, display: 'block', marginBottom: 6 }}>{'\u{1F3AC}'}</span>
                    <p style={{
                      fontSize: 10, color: 'var(--gold-primary)', fontFamily: 'var(--font-display)',
                      fontWeight: 700, letterSpacing: 1, margin: 0,
                    }}>
                      GALERIE
                    </p>
                  </button>
                </div>
              )}
              {/* Galerie-Auswahl (ohne capture → zeigt Galerie) */}
              <input
                ref={mediaRef} type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm"
                style={{ display: 'none' }}
                onChange={handleMediaSelect}
              />
              {/* Kamera-Direktaufnahme (mit capture → öffnet Kamera) */}
              <input
                id="cameraCaptureInput" type="file" accept="image/*,video/*" capture="environment"
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

            {/* Advanced toggle */}
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              style={{
                width: '100%', padding: '12px 16px', borderRadius: 10,
                border: '1px solid var(--border-subtle)',
                background: 'var(--bg-surface)',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}
            >
              <span style={{
                fontSize: 10, fontFamily: 'var(--font-display)',
                letterSpacing: 2, color: 'var(--text-secondary)',
              }}>
                {t('deals.advancedOptions')}
              </span>
              <span style={{
                fontSize: 14, color: 'var(--text-muted)',
                transform: showAdvanced ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s ease',
              }}>
                {'\u25BC'}
              </span>
            </button>

            {/* Advanced options panel */}
            <div style={{
              overflow: 'hidden',
              display: 'grid',
              gridTemplateRows: showAdvanced ? '1fr' : '0fr',
              transition: 'grid-template-rows 0.3s ease',
            }}>
              <div style={{ minHeight: 0, overflow: 'hidden' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 4 }}>
                  {/* Open challenge settings */}
                  {state.mode === 'open_challenge' && (
                    <div>
                      <label style={{
                        display: 'block', fontSize: 10, fontFamily: 'var(--font-display)',
                        letterSpacing: 2, color: 'var(--text-secondary)', marginBottom: 8,
                      }}>
                        {t('deals.joinMode')}
                      </label>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {[
                          { value: 'open' as const, label: t('deals.joinModeOpen') },
                          { value: 'approval' as const, label: t('deals.joinModeApproval') },
                          { value: 'invite_only' as const, label: t('deals.joinModeInviteOnly') },
                        ].map(jm => {
                          const active = state.joinMode === jm.value
                          return (
                            <button
                              key={jm.value}
                              onClick={() => dispatch({ type: 'SET_FIELD', field: 'joinMode', value: jm.value })}
                              style={{
                                flex: 1, padding: '8px 6px', borderRadius: 8,
                                border: active ? '1.5px solid var(--gold-primary)' : '1px solid var(--border-subtle)',
                                background: active ? 'rgba(255,184,0,0.06)' : 'var(--bg-surface)',
                                cursor: 'pointer', fontSize: 10, fontFamily: 'var(--font-display)',
                                letterSpacing: 0.5, color: active ? 'var(--gold-primary)' : 'var(--text-muted)',
                              }}
                            >
                              {jm.label}
                            </button>
                          )
                        })}
                      </div>
                      <div style={{ marginTop: 10 }}>
                        <label style={{
                          display: 'block', fontSize: 10, fontFamily: 'var(--font-display)',
                          letterSpacing: 2, color: 'var(--text-secondary)', marginBottom: 6,
                        }}>
                          {t('deals.maxParticipants')}: {state.maxParticipants}
                        </label>
                        <input
                          type="range" min={2} max={20} value={state.maxParticipants}
                          onChange={e => dispatch({ type: 'SET_FIELD', field: 'maxParticipants', value: parseInt(e.target.value) })}
                          style={{ width: '100%', accentColor: 'var(--gold-primary)' }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Team builder (only in team mode) */}
                  {state.mode === 'team' && (
                    <TeamBuilder
                      teamA={state.teamA}
                      teamB={state.teamB}
                      onAddMember={(side, member) => dispatch({ type: 'ADD_TEAM_MEMBER', side, member })}
                      onRemoveMember={(side, userId) => dispatch({ type: 'REMOVE_TEAM_MEMBER', side, userId })}
                      onSetName={(side, name) => dispatch({ type: 'SET_TEAM_NAME', side, name })}
                      onSetColor={(side, color) => dispatch({ type: 'SET_TEAM_COLOR', side, color })}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Upload progress bar */}
            {uploadPercent && (
              <div style={{ marginBottom: -8 }}>
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

            {/* CTA + Nav buttons */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={goBack}
                disabled={!!state.uploadProgress}
                style={{
                  flex: 1, padding: 16, borderRadius: 12,
                  border: '1px solid var(--bg-elevated)',
                  background: 'transparent',
                  color: 'var(--text-muted)',
                  fontFamily: 'var(--font-display)',
                  fontSize: 11, cursor: state.uploadProgress ? 'not-allowed' : 'pointer',
                  opacity: state.uploadProgress ? 0.4 : 1,
                }}
              >
                {'\u2190'} {t('deals.navBack')}
              </button>
              <button
                onClick={createDeal}
                disabled={state.loading || !canSubmit}
                style={{
                  flex: 2, padding: 18, borderRadius: 12,
                  border: 'none',
                  cursor: state.loading ? 'wait' : canSubmit ? 'pointer' : 'not-allowed',
                  background: canSubmit
                    ? 'linear-gradient(135deg, var(--gold-dim), var(--gold-primary))'
                    : 'var(--bg-elevated)',
                  color: canSubmit ? 'var(--text-inverse)' : 'var(--text-muted)',
                  fontFamily: 'var(--font-display)',
                  fontSize: 12, fontWeight: 700, letterSpacing: 2,
                  opacity: state.loading ? 0.6 : 1,
                }}
              >
                {ctaText()}
              </button>
            </div>

            <button
              onClick={() => router.back()}
              style={{
                width: '100%', padding: 14, borderRadius: 12,
                border: '1px solid var(--bg-elevated)',
                background: 'transparent',
                color: 'var(--text-muted)',
                fontFamily: 'var(--font-display)',
                fontSize: 11, cursor: 'pointer',
              }}
            >
              {t('common.cancel')}
            </button>
          </>
        )}
      </div>

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

/* --- Simple state helper (avoids importing useState separately for booleans) --- */
function useReducerCompat(initial: boolean): [boolean, (v: boolean) => void] {
  const [val, setVal] = __useState(initial)
  return [val, setVal]
}
import { useState as __useState } from 'react'

export default function CreateDealPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100dvh', background: 'var(--bg-base)' }} />}>
      <CreateDealContent />
    </Suspense>
  )
}
