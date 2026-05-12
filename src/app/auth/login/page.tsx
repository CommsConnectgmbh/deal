'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import Image from 'next/image'
import Link from 'next/link'
import { trackLoginCompleted, trackScreenView } from '@/lib/analytics'
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

export default function LoginPage() {
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [emailErr, setEmailErr] = useState('')
  const [codeErr, setCodeErr] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resendIn, setResendIn] = useState(0)
  const { requestEmailOtp, verifyEmailOtp } = useAuth()
  const router = useRouter()
  const codeInputRef = useRef<HTMLInputElement>(null)
  const { t } = useLang()

  useEffect(() => { trackScreenView('login') }, [])

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
    if (msg.includes('User not found')) return t('auth.errorUserNotFound')
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
      const { isNewUser } = await verifyEmailOtp(email.trim(), value)
      trackLoginCompleted()
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
          {t('auth.loginTitle').toUpperCase()}
        </p>
      </div>

      <div style={{ width: '100%', background: 'var(--bg-surface)', borderRadius: 16, border: '1px solid var(--border-subtle)', padding: 24 }}>
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

            <button
              onClick={sendCode}
              disabled={loading}
              style={{ width: '100%', padding: 18, borderRadius: 12, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', background: loading ? 'var(--gold-subtle)' : 'linear-gradient(135deg, var(--gold-dim), var(--gold-primary), var(--gold-bright))', color: 'var(--text-inverse)', fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 700, letterSpacing: 3, opacity: loading ? 0.7 : 1 }}
            >
              {loading ? t('auth.otpSending').toUpperCase() : t('auth.otpSendCode').toUpperCase()}
            </button>

            <div style={{ textAlign: 'center', marginTop: 20, fontSize: 14, color: 'var(--text-secondary)' }}>
              {t('auth.noAccount')}{' '}
              <Link href="/auth/register" style={{ color: 'var(--gold-primary)', fontWeight: 600 }}>{t('auth.register')}</Link>
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

      <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', marginTop: 24, lineHeight: 1.6 }}>
        {t('auth.termsAgreement')}
      </p>
    </div>
  )
}
