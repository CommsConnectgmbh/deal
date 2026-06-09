'use client'
import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import Image from 'next/image'
import Link from 'next/link'
import { trackSignupStarted, trackSignupCompleted, trackScreenView } from '@/lib/analytics'
import { useLang } from '@/contexts/LanguageContext'

type Step = 'form' | 'code'

const inputStyle = (hasError: boolean): React.CSSProperties => ({
  width: '100%', padding: '14px 16px', background: 'var(--bg-elevated)',
  border: `1px solid ${hasError ? 'rgba(248,113,113,0.5)' : 'var(--border-subtle)'}`,
  borderRadius: 10, color: 'var(--text-primary)', fontSize: 16,
  outline: 'none',
})
const codeInputStyle = (hasError: boolean): React.CSSProperties => ({
  width: '100%', padding: '18px 16px', background: 'var(--bg-elevated)',
  border: `1px solid ${hasError ? 'rgba(248,113,113,0.5)' : 'var(--border-subtle)'}`,
  borderRadius: 12, color: 'var(--text-primary)', fontSize: 28,
  letterSpacing: '0.4em', textAlign: 'center', fontFamily: 'var(--font-mono, monospace)',
  outline: 'none',
})
const labelStyle: React.CSSProperties = {
  display: 'block', fontFamily: 'var(--font-display)', fontSize: 9,
  letterSpacing: 2, color: 'var(--text-secondary)', marginBottom: 8,
}

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterForm />
    </Suspense>
  )
}

function RegisterForm() {
  const [step, setStep] = useState<Step>('form')
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [code, setCode] = useState('')
  const [emailErr, setEmailErr] = useState('')
  const [unErr, setUnErr] = useState('')
  const [codeErr, setCodeErr] = useState('')
  const [ageAccepted, setAgeAccepted] = useState(false)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [consentErr, setConsentErr] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { requestSignupCode, verifySignupCode } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const referralCode = useRef<string | null>(null)
  const pendingAcceptDealId = useRef<string | null>(null)
  const { t } = useLang()

  useEffect(() => {
    trackScreenView('register')
    trackSignupStarted()
    const urlRef = searchParams.get('ref') || searchParams.get('code')
    const storedRef = typeof window !== 'undefined' ? localStorage.getItem('dealbuddy_referral') : null
    referralCode.current = urlRef || storedRef || null

    const urlAccept = searchParams.get('accept')
    const storedAccept = typeof window !== 'undefined' ? localStorage.getItem('dealbuddy_pending_accept') : null
    pendingAcceptDealId.current = urlAccept || storedAccept || null
  }, [searchParams])

  const mapError = (msg: string): string => {
    if (msg.includes('already registered') || msg.includes('already exists') || msg.includes('User already')) return t('auth.errorAlreadyRegistered')
    if (msg.includes('invalid email')) return t('auth.errorEmailInvalid')
    if (msg.includes('Token has expired') || msg.includes('expired')) return 'Code abgelaufen. Bitte neuen Code anfordern.'
    if (msg.includes('Invalid') || msg.includes('invalid')) return 'Code ist falsch. Bitte prüfen — jede Ziffer zählt.'
    if (msg.includes('Database error')) return t('auth.errorDatabase')
    if (msg.includes('Too many requests') || msg.includes('rate limit')) return 'Zu viele Versuche — bitte einen Moment warten.'
    if (msg.includes('network')) return t('auth.errorNetwork')
    return msg
  }

  const validateUsername = (v: string) => {
    if (!v) return t('auth.errorUsernameRequired')
    if (v.length < 3) return t('auth.errorMinThreeChars')
    if (v.length > 20) return t('auth.errorMaxTwentyChars')
    if (!/^[a-zA-Z0-9_]+$/.test(v)) return t('auth.errorUsernameChars')
    return ''
  }
  const validateEmail = (v: string) => {
    if (!v) return t('auth.errorEmailRequired')
    if (!/\S+@\S+\.\S+/.test(v)) return t('auth.errorEmailInvalid')
    return ''
  }

  const handleSendCode = async () => {
    const uErr = validateUsername(username)
    const eErr = validateEmail(email)
    setUnErr(uErr)
    setEmailErr(eErr)
    if (uErr || eErr) return

    if (!ageAccepted || !termsAccepted) {
      setConsentErr(
        !ageAccepted && !termsAccepted
          ? 'Bitte bestätige dein Alter und akzeptiere AGB & Datenschutz.'
          : !ageAccepted
            ? 'Du musst mindestens 18 Jahre alt sein.'
            : 'Bitte akzeptiere AGB & Datenschutz.'
      )
      return
    }
    setConsentErr('')
    setError('')
    setLoading(true)
    try {
      await requestSignupCode(email.trim().toLowerCase(), username.trim().toLowerCase())
      setStep('code')
    } catch (e: unknown) {
      setError(mapError((e as Error).message))
    } finally {
      setLoading(false)
    }
  }

  const handleVerify = async () => {
    const c = code.trim()
    if (c.length !== 8) {
      setCodeErr('Bitte den 8-stelligen Code aus der Mail eingeben.')
      return
    }
    setCodeErr('')
    setError('')
    setLoading(true)
    try {
      await verifySignupCode(email.trim().toLowerCase(), c)
      trackSignupCompleted('email')

      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        try {
          await supabase.from('user_inventory').upsert(
            [
              { user_id: user.id, cosmetic_id: 'founder_carbon', source: 'founder_grant' },
              { user_id: user.id, cosmetic_id: 'season1_founder', source: 'founder_grant' },
            ],
            { onConflict: 'user_id,cosmetic_id' }
          )
          await supabase.from('profiles').update({
            active_frame: 'founder_carbon',
            active_badge: 'season1_founder',
            is_founder: true,
          }).eq('id', user.id)
        } catch { /* trigger handles it too */ }

        if (referralCode.current) {
          try {
            const { data: referrer } = await supabase
              .from('profiles')
              .select('id')
              .eq('invite_code', referralCode.current)
              .single()
            if (referrer) {
              await supabase.from('profiles').update({
                referred_by: referrer.id
              }).eq('id', user.id)
              await supabase.from('wallet_ledger').insert({
                user_id: referrer.id,
                delta: 50,
                reason: 'referral_bonus',
                reference_id: user.id
              })
              try { await supabase.rpc('add_coins', { p_user_id: referrer.id, p_amount: 50 }) } catch { /* noop */ }
            }
            localStorage.removeItem('dealbuddy_referral')
          } catch { /* non-fatal */ }
        }

        if (pendingAcceptDealId.current) {
          try {
            const dealId = pendingAcceptDealId.current
            const { data: deal } = await supabase
              .from('challenges')
              .select('id, status, opponent_id, creator_id, is_public, title')
              .eq('id', dealId)
              .single()

            if (deal && deal.status === 'open' && !deal.opponent_id && deal.creator_id !== user.id) {
              const update: Record<string, unknown> = {
                status: 'active',
                opponent_id: user.id,
              }
              if (deal.is_public !== false) {
                update.shared_as_story_at = new Date().toISOString()
              }
              const { error: acceptErr } = await supabase
                .from('challenges')
                .update(update)
                .eq('id', dealId)
                .eq('status', 'open')
                .is('opponent_id', null)

              if (!acceptErr && deal.is_public) {
                try {
                  await supabase.from('feed_events').insert([
                    { event_type: 'deal_accepted', user_id: user.id, deal_id: dealId, metadata: { title: deal.title } },
                    { event_type: 'challenge_joined', user_id: user.id, deal_id: dealId, metadata: { title: deal.title } },
                  ])
                } catch { /* non-fatal */ }
              }
            }
            localStorage.removeItem('dealbuddy_pending_accept')
            localStorage.setItem('dealbuddy_skip_avatar_setup', '1')
            router.replace(`/app/deals/${dealId}`)
            return
          } catch { /* fall through */ }
        }
      }

      router.replace('/app/avatar-card/create')
    } catch (e: unknown) {
      setError(mapError((e as Error).message))
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    setError('')
    setLoading(true)
    try {
      await requestSignupCode(email.trim().toLowerCase(), username.trim().toLowerCase())
    } catch (e: unknown) {
      setError(mapError((e as Error).message))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg-base)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', maxWidth: 430, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <Image src="/logo.png" alt="DealBuddy" width={100} height={100} style={{ borderRadius: 20 }} />
        <p className="font-display" style={{ fontSize: 9, letterSpacing: 5, color: 'var(--gold-primary)', marginTop: 12, opacity: 0.8 }}>
          SEASON 1 · THE FOUNDERS ERA
        </p>
      </div>

      <div style={{ width: '100%', background: 'var(--bg-surface)', borderRadius: 16, border: '1px solid var(--border-subtle)', padding: 24 }}>
        <div style={{ background: 'var(--gold-subtle)', border: '1px solid var(--gold-glow)', borderRadius: 10, padding: '10px 14px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>⚡</span>
          <div>
            <p style={{ color: 'var(--gold-primary)', fontSize: 12, fontFamily: 'var(--font-display)', fontWeight: 700 }}>{t('auth.founderStatus')}</p>
            <p style={{ color: 'var(--text-secondary)', fontSize: 11, marginTop: 2 }}>{t('auth.founderDesc')}</p>
          </div>
        </div>

        {error && (
          <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 8, padding: '12px 14px', marginBottom: 16, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <span style={{ fontSize: 16, lineHeight: 1 }}>⚠️</span>
            <p style={{ color: 'var(--status-error)', fontSize: 14, lineHeight: 1.4 }}>{error}</p>
          </div>
        )}

        {step === 'form' ? (
          <>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>{t('auth.username').toUpperCase()}</label>
              <input
                value={username}
                onChange={e => { setUsername(e.target.value.toLowerCase()); if (unErr) setUnErr('') }}
                onBlur={() => setUnErr(validateUsername(username))}
                onKeyDown={e => e.key === 'Enter' && handleSendCode()}
                placeholder={t('auth.usernamePlaceholder')}
                style={inputStyle(!!unErr)}
                autoCapitalize="none"
                autoComplete="username"
                spellCheck={false}
              />
              {unErr
                ? <p style={{ color: 'var(--status-error)', fontSize: 12, marginTop: 6 }}>{unErr}</p>
                : <p style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 6 }}>{t('auth.usernameHint')}</p>
              }
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={labelStyle}>{t('auth.email').toUpperCase()}</label>
              <input
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); if (emailErr) setEmailErr('') }}
                onBlur={() => setEmailErr(validateEmail(email))}
                onKeyDown={e => e.key === 'Enter' && handleSendCode()}
                placeholder={t('auth.emailPlaceholder')}
                style={inputStyle(!!emailErr)}
                autoComplete="email"
                inputMode="email"
                autoCapitalize="none"
                spellCheck={false}
              />
              {emailErr && <p style={{ color: 'var(--status-error)', fontSize: 12, marginTop: 6 }}>{emailErr}</p>}
            </div>

            <div style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', fontSize: 13, lineHeight: 1.45, color: 'var(--text-secondary)' }}>
                <input
                  type="checkbox"
                  checked={ageAccepted}
                  onChange={e => { setAgeAccepted(e.target.checked); if (consentErr) setConsentErr('') }}
                  style={{ width: 18, height: 18, marginTop: 1, accentColor: 'var(--gold-primary)', cursor: 'pointer', flexShrink: 0 }}
                />
                <span>Ich bin mindestens <strong style={{ color: 'var(--text-primary)' }}>18 Jahre</strong> alt.</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', fontSize: 13, lineHeight: 1.45, color: 'var(--text-secondary)' }}>
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={e => { setTermsAccepted(e.target.checked); if (consentErr) setConsentErr('') }}
                  style={{ width: 18, height: 18, marginTop: 1, accentColor: 'var(--gold-primary)', cursor: 'pointer', flexShrink: 0 }}
                />
                <span>
                  Ich akzeptiere die{' '}
                  <Link href="/legal/terms" target="_blank" style={{ color: 'var(--gold-primary)', textDecoration: 'underline' }}>AGB</Link>
                  {' '}und die{' '}
                  <Link href="/legal/privacy" target="_blank" style={{ color: 'var(--gold-primary)', textDecoration: 'underline' }}>Datenschutzerklärung</Link>.
                </span>
              </label>
              {consentErr && (
                <p style={{ color: 'var(--status-error)', fontSize: 12, margin: 0 }}>{consentErr}</p>
              )}
            </div>

            <button
              onClick={handleSendCode}
              disabled={loading}
              style={{ width: '100%', padding: 18, borderRadius: 12, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', background: loading ? 'var(--gold-subtle)' : 'linear-gradient(135deg, var(--gold-dim), var(--gold-primary), var(--gold-bright))', color: 'var(--text-inverse)', fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 700, letterSpacing: 3, opacity: loading ? 0.7 : 1 }}
            >
              {loading ? 'SENDE…' : 'CODE SENDEN'}
            </button>

            <div style={{ textAlign: 'center', marginTop: 20, fontSize: 14, color: 'var(--text-secondary)' }}>
              {t('auth.hasAccount')}{' '}
              <Link href="/auth/login" style={{ color: 'var(--gold-primary)', fontWeight: 600 }}>{t('auth.login')}</Link>
            </div>
          </>
        ) : (
          <>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 6, lineHeight: 1.6 }}>
              Code gesendet an
            </p>
            <p style={{ fontSize: 14, color: 'var(--text-primary)', marginBottom: 20, fontWeight: 600 }}>
              {email}
            </p>

            <div style={{ marginBottom: 24 }}>
              <label style={labelStyle}>BESTÄTIGUNGS-CODE</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{8}"
                autoComplete="one-time-code"
                autoFocus
                maxLength={8}
                minLength={8}
                value={code}
                onChange={e => {
                  const v = e.target.value.replace(/\D/g, '').slice(0, 8)
                  setCode(v)
                  if (codeErr) setCodeErr('')
                }}
                placeholder="••••••••"
                style={codeInputStyle(!!codeErr)}
                onKeyDown={e => e.key === 'Enter' && handleVerify()}
              />
              {codeErr && <p style={{ color: 'var(--status-error)', fontSize: 12, marginTop: 6 }}>{codeErr}</p>}
            </div>

            <button
              onClick={handleVerify}
              disabled={loading || code.length !== 8}
              style={{ width: '100%', padding: 18, borderRadius: 12, border: 'none', cursor: loading || code.length !== 8 ? 'not-allowed' : 'pointer', background: loading || code.length !== 8 ? 'var(--gold-subtle)' : 'linear-gradient(135deg, var(--gold-dim), var(--gold-primary), var(--gold-bright))', color: 'var(--text-inverse)', fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 700, letterSpacing: 3, opacity: loading || code.length !== 8 ? 0.7 : 1 }}
            >
              {loading ? 'PRÜFE…' : t('auth.registerTitle').toUpperCase()}
            </button>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, fontSize: 12 }}>
              <button
                type="button"
                onClick={() => { setStep('form'); setCode(''); setError(''); setCodeErr('') }}
                disabled={loading}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', textDecoration: 'underline', fontSize: 12, padding: 0 }}
              >
                ← Zurück
              </button>
              <button
                type="button"
                onClick={handleResend}
                disabled={loading}
                style={{ background: 'none', border: 'none', color: 'var(--gold-primary)', cursor: 'pointer', textDecoration: 'underline', fontSize: 12, padding: 0 }}
              >
                Code nochmal senden
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
