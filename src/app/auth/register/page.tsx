'use client'
import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import Image from 'next/image'
import Link from 'next/link'
import { trackSignupStarted, trackSignupCompleted, trackScreenView } from '@/lib/analytics'
import { useLang } from '@/contexts/LanguageContext'

const inputStyle = (hasError: boolean): React.CSSProperties => ({
  width: '100%', padding: '14px 16px', background: 'var(--bg-elevated)',
  border: `1px solid ${hasError ? 'rgba(248,113,113,0.5)' : 'var(--border-subtle)'}`,
  borderRadius: 10, color: 'var(--text-primary)', fontSize: 16,
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
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [emailErr, setEmailErr] = useState('')
  const [codeErr, setCodeErr] = useState('')
  const [ageAccepted, setAgeAccepted] = useState(false)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [consentErr, setConsentErr] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resendIn, setResendIn] = useState(0)
  const { requestEmailOtp, verifyEmailOtp } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const referralCode = useRef<string | null>(null)
  const pendingAcceptDealId = useRef<string | null>(null)
  const codeInputRef = useRef<HTMLInputElement>(null)
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

  useEffect(() => {
    if (resendIn <= 0) return
    const id = setInterval(() => setResendIn(s => Math.max(0, s - 1)), 1000)
    return () => clearInterval(id)
  }, [resendIn])

  useEffect(() => {
    if (step === 'code') {
      setTimeout(() => codeInputRef.current?.focus(), 50)
    }
  }, [step])

  const mapError = (msg: string): string => {
    if (msg.includes('Token has expired')) return t('auth.otpErrorExpired')
    if (msg.includes('invalid') && msg.toLowerCase().includes('otp')) return t('auth.otpErrorInvalid')
    if (msg.includes('Invalid token')) return t('auth.otpErrorInvalid')
    if (msg.includes('Email rate limit') || msg.includes('Too many requests')) return t('auth.errorTooManyRequests')
    if (msg.includes('invalid email')) return t('auth.errorEmailInvalid')
    if (msg.includes('network')) return t('auth.errorNetwork')
    return msg
  }

  const validateEmail = (v: string) => {
    if (!v) return t('auth.errorEmailRequired')
    if (!/\S+@\S+\.\S+/.test(v)) return t('auth.errorEmailInvalid')
    return ''
  }

  const sendCode = async () => {
    const eErr = validateEmail(email)
    setEmailErr(eErr)
    if (eErr) return

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
      await requestEmailOtp(email.trim())
      setStep('code')
      setResendIn(30)
    } catch (e: unknown) {
      setError(mapError((e as Error).message))
    } finally {
      setLoading(false)
    }
  }

  const resend = async () => {
    if (resendIn > 0 || loading) return
    setError('')
    setLoading(true)
    try {
      await requestEmailOtp(email.trim())
      setResendIn(30)
      setCode('')
      setCodeErr('')
    } catch (e: unknown) {
      setError(mapError((e as Error).message))
    } finally {
      setLoading(false)
    }
  }

  const verify = async (raw?: string) => {
    const value = (raw ?? code).replace(/\D/g, '')
    if (value.length !== 6) {
      setCodeErr(t('auth.otpErrorInvalid'))
      return
    }
    setCodeErr('')
    setError('')
    setLoading(true)
    try {
      const { user, isNewUser } = await verifyEmailOtp(email.trim(), value)
      trackSignupCompleted(isNewUser ? 'email_otp_new' : 'email_otp_returning')

      if (isNewUser) {
        // Founder grant: belt + suspenders (DB trigger handles it too)
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
        } catch { /* non-fatal */ }

        if (referralCode.current) {
          try {
            const { data: referrer } = await supabase
              .from('profiles')
              .select('id')
              .eq('invite_code', referralCode.current)
              .single()
            if (referrer) {
              await supabase.from('profiles').update({
                referred_by: referrer.id,
              }).eq('id', user.id)
              await supabase.from('wallet_ledger').insert({
                user_id: referrer.id,
                delta: 50,
                reason: 'referral_bonus',
                reference_id: user.id,
              })
              try { await supabase.rpc('add_coins', { p_user_id: referrer.id, p_amount: 50 }) } catch { /* noop */ }
            }
            localStorage.removeItem('dealbuddy_referral')
          } catch { /* non-fatal */ }
        }
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

      router.replace(isNewUser ? '/app/avatar-card/create' : '/app/home')
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

        {step === 'email' ? (
          <>
            <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>{t('auth.otpHint')}</p>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>{t('auth.email').toUpperCase()}</label>
              <input
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); if (emailErr) setEmailErr('') }}
                onBlur={() => setEmailErr(validateEmail(email))}
                onKeyDown={e => e.key === 'Enter' && sendCode()}
                placeholder={t('auth.emailPlaceholder')}
                style={inputStyle(!!emailErr)}
                autoComplete="email"
                inputMode="email"
                autoCapitalize="none"
                spellCheck={false}
                autoFocus
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
              onClick={sendCode}
              disabled={loading}
              style={{ width: '100%', padding: 18, borderRadius: 12, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', background: loading ? 'var(--gold-subtle)' : 'linear-gradient(135deg, var(--gold-dim), var(--gold-primary), var(--gold-bright))', color: 'var(--text-inverse)', fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 700, letterSpacing: 3, opacity: loading ? 0.7 : 1 }}
            >
              {loading ? t('auth.otpSending').toUpperCase() : t('auth.otpSendCode').toUpperCase()}
            </button>

            <div style={{ textAlign: 'center', marginTop: 20, fontSize: 14, color: 'var(--text-secondary)' }}>
              {t('auth.hasAccount')}{' '}
              <Link href="/auth/login" style={{ color: 'var(--gold-primary)', fontWeight: 600 }}>{t('auth.login')}</Link>
            </div>
          </>
        ) : (
          <>
            <p style={{ textAlign: 'center', fontSize: 14, color: 'var(--text-primary)', marginBottom: 6, fontFamily: 'var(--font-display)' }}>
              {t('auth.otpSentTitle')}
            </p>
            <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>
              {t('auth.otpSentTo').replace('{email}', email)}
            </p>
            <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', marginBottom: 20 }}>
              {t('auth.otpCheckInbox')}
            </p>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>{t('auth.otpCodeLabel').toUpperCase()}</label>
              <input
                ref={codeInputRef}
                type="text"
                value={code}
                onChange={e => {
                  const v = e.target.value.replace(/\D/g, '').slice(0, 6)
                  setCode(v)
                  if (codeErr) setCodeErr('')
                  if (v.length === 6) verify(v)
                }}
                onKeyDown={e => e.key === 'Enter' && verify()}
                placeholder={t('auth.otpCodePlaceholder')}
                style={{ ...inputStyle(!!codeErr), textAlign: 'center', fontSize: 24, letterSpacing: 8, fontFamily: 'var(--font-display)' }}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
              />
              {codeErr && <p style={{ color: 'var(--status-error)', fontSize: 12, marginTop: 6 }}>{codeErr}</p>}
            </div>

            <button
              onClick={() => verify()}
              disabled={loading || code.length !== 6}
              style={{ width: '100%', padding: 18, borderRadius: 12, border: 'none', cursor: (loading || code.length !== 6) ? 'not-allowed' : 'pointer', background: (loading || code.length !== 6) ? 'var(--gold-subtle)' : 'linear-gradient(135deg, var(--gold-dim), var(--gold-primary), var(--gold-bright))', color: 'var(--text-inverse)', fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 700, letterSpacing: 3, opacity: (loading || code.length !== 6) ? 0.7 : 1 }}
            >
              {loading ? t('auth.otpVerifying').toUpperCase() : t('auth.otpVerify').toUpperCase()}
            </button>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20 }}>
              <button
                onClick={() => { setStep('email'); setCode(''); setCodeErr(''); setError('') }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13 }}
              >
                ← {t('auth.otpChangeEmail')}
              </button>
              <button
                onClick={resend}
                disabled={resendIn > 0 || loading}
                style={{ background: 'none', border: 'none', cursor: (resendIn > 0 || loading) ? 'not-allowed' : 'pointer', color: (resendIn > 0 || loading) ? 'var(--text-muted)' : 'var(--gold-primary)', fontSize: 13, fontWeight: 600 }}
              >
                {resendIn > 0 ? t('auth.otpResendIn').replace('{sec}', String(resendIn)) : t('auth.otpResend')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
