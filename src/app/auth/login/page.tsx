'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import Image from 'next/image'
import Link from 'next/link'
import { trackLoginCompleted, trackScreenView } from '@/lib/analytics'
import { useLang } from '@/contexts/LanguageContext'

type Step = 'email' | 'code'

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

export default function LoginPage() {
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [emailErr, setEmailErr] = useState('')
  const [codeErr, setCodeErr] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { requestLoginCode, verifyLoginCode } = useAuth()
  const router = useRouter()
  const { t } = useLang()

  useEffect(() => { trackScreenView('login') }, [])

  const mapError = (msg: string): string => {
    if (msg.includes('Signups not allowed')) return 'Für diese E-Mail gibt es noch keinen Account. Bitte registrieren.'
    if (msg.includes('User not found') || msg.includes('not found')) return 'Für diese E-Mail gibt es noch keinen Account. Bitte registrieren.'
    if (msg.includes('Token has expired') || msg.includes('expired')) return 'Code abgelaufen. Bitte neuen Code anfordern.'
    if (msg.includes('Invalid') || msg.includes('invalid')) return 'Code ist falsch. Bitte prüfen — jede Ziffer zählt.'
    if (msg.includes('Email not confirmed')) return t('auth.errorEmailNotConfirmed')
    if (msg.includes('Too many requests') || msg.includes('rate limit')) return 'Zu viele Versuche — bitte einen Moment warten.'
    if (msg.includes('network')) return t('auth.errorNetwork')
    return msg
  }

  const validateEmail = (v: string) => {
    if (!v) return t('auth.errorEmailRequired')
    if (!/\S+@\S+\.\S+/.test(v)) return t('auth.errorEmailInvalid')
    return ''
  }

  const handleSendCode = async () => {
    const eErr = validateEmail(email)
    setEmailErr(eErr)
    if (eErr) return
    setError('')
    setLoading(true)
    try {
      await requestLoginCode(email.trim().toLowerCase())
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
      await verifyLoginCode(email.trim().toLowerCase(), c)
      trackLoginCompleted()
      router.replace('/app/home')
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
      await requestLoginCode(email.trim().toLowerCase())
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
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.6 }}>
              Anmelden mit 8-stelligem Code per E-Mail — kein Passwort nötig.
            </p>

            <div style={{ marginBottom: 24 }}>
              <label style={labelStyle}>{t('auth.email').toUpperCase()}</label>
              <input
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); if (emailErr) setEmailErr('') }}
                onBlur={() => setEmailErr(validateEmail(email))}
                placeholder={t('auth.emailPlaceholder')}
                style={inputStyle(!!emailErr)}
                onKeyDown={e => e.key === 'Enter' && handleSendCode()}
                autoComplete="email"
                inputMode="email"
                autoCapitalize="none"
                spellCheck={false}
                autoFocus
              />
              {emailErr && <p style={{ color: 'var(--status-error)', fontSize: 12, marginTop: 6 }}>{emailErr}</p>}
            </div>

            <button
              onClick={handleSendCode}
              disabled={loading}
              style={{ width: '100%', padding: 18, borderRadius: 12, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', background: loading ? 'var(--gold-subtle)' : 'linear-gradient(135deg, var(--gold-dim), var(--gold-primary), var(--gold-bright))', color: 'var(--text-inverse)', fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 700, letterSpacing: 3, opacity: loading ? 0.7 : 1 }}
            >
              {loading ? 'SENDE…' : 'CODE SENDEN'}
            </button>

            <div style={{ textAlign: 'center', marginTop: 20, fontSize: 14, color: 'var(--text-secondary)' }}>
              {t('auth.noAccount')}{' '}
              <Link href="/auth/register" style={{ color: 'var(--gold-primary)', fontWeight: 600 }}>{t('auth.register')}</Link>
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
              <label style={labelStyle}>LOGIN-CODE</label>
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
              {loading ? 'PRÜFE…' : 'ANMELDEN'}
            </button>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, fontSize: 12 }}>
              <button
                type="button"
                onClick={() => { setStep('email'); setCode(''); setError(''); setCodeErr('') }}
                disabled={loading}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', textDecoration: 'underline', fontSize: 12, padding: 0 }}
              >
                ← Andere E-Mail
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

            <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', marginTop: 20, lineHeight: 1.6 }}>
              Anmeldung läuft ausschließlich per 8-stelligem Code — kein Passwort.
            </p>
          </>
        )}
      </div>

      <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', marginTop: 24, lineHeight: 1.6 }}>
        {t('auth.termsAgreement')}
      </p>
    </div>
  )
}
