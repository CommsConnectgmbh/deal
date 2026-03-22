'use client'
import { useState, useEffect } from 'react'
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
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [emailErr, setEmailErr] = useState('')
  const [pwErr, setPwErr] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { signIn } = useAuth()
  const router = useRouter()
  const { t } = useLang()

  useEffect(() => { trackScreenView('login') }, [])

  const mapError = (msg: string): string => {
    if (msg.includes('Invalid login credentials')) return t('auth.errorInvalidCredentials')
    if (msg.includes('Email not confirmed')) return t('auth.errorEmailNotConfirmed')
    if (msg.includes('Too many requests')) return t('auth.errorTooManyRequests')
    if (msg.includes('User not found')) return t('auth.errorUserNotFound')
    if (msg.includes('network')) return t('auth.errorNetwork')
    return msg
  }

  const validateEmail = (v: string) => {
    if (!v) return t('auth.errorEmailRequired')
    if (!/\S+@\S+\.\S+/.test(v)) return t('auth.errorEmailInvalid')
    return ''
  }
  const validatePassword = (v: string) => {
    if (!v) return t('auth.errorPasswordRequired')
    if (v.length < 6) return t('auth.errorMinChars')
    return ''
  }

  const handle = async () => {
    const eErr = validateEmail(email)
    const pErr = validatePassword(password)
    setEmailErr(eErr)
    setPwErr(pErr)
    if (eErr || pErr) return
    setError('')
    setLoading(true)
    try {
      await signIn(email, password)
      trackLoginCompleted()
      router.replace('/app/home')
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

        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>{t('auth.email').toUpperCase()}</label>
          <input
            type="email"
            value={email}
            onChange={e => { setEmail(e.target.value); if (emailErr) setEmailErr('') }}
            onBlur={() => setEmailErr(validateEmail(email))}
            placeholder={t('auth.emailPlaceholder')}
            style={inputStyle(!!emailErr)}
            onKeyDown={e => e.key === 'Enter' && handle()}
          />
          {emailErr && <p style={{ color: 'var(--status-error)', fontSize: 12, marginTop: 6 }}>{emailErr}</p>}
        </div>

        <div style={{ marginBottom: 8 }}>
          <label style={labelStyle}>{t('auth.password').toUpperCase()}</label>
          <input
            type="password"
            value={password}
            onChange={e => { setPassword(e.target.value); if (pwErr) setPwErr('') }}
            onBlur={() => setPwErr(validatePassword(password))}
            placeholder="••••••••"
            style={inputStyle(!!pwErr)}
            onKeyDown={e => e.key === 'Enter' && handle()}
          />
          {pwErr
            ? <p style={{ color: 'var(--status-error)', fontSize: 12, marginTop: 6 }}>{pwErr}</p>
            : <p style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 6 }}>{t('auth.errorMinChars')}</p>
          }
        </div>

        <div style={{ textAlign: 'right', marginBottom: 24 }}>
          <Link href="/auth/forgot-password" style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
            {t('auth.forgotPassword')}
          </Link>
        </div>

        <button
          onClick={handle}
          disabled={loading}
          style={{ width: '100%', padding: 18, borderRadius: 12, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', background: loading ? 'var(--gold-subtle)' : 'linear-gradient(135deg, var(--gold-dim), var(--gold-primary), var(--gold-bright))', color: 'var(--text-inverse)', fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 700, letterSpacing: 3, opacity: loading ? 0.7 : 1 }}
        >
          {loading ? t('auth.loggingIn').toUpperCase() : t('auth.login').toUpperCase()}
        </button>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 14, color: 'var(--text-secondary)' }}>
          {t('auth.noAccount')}{' '}
          <Link href="/auth/register" style={{ color: 'var(--gold-primary)', fontWeight: 600 }}>{t('auth.register')}</Link>
        </div>
      </div>

      <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', marginTop: 24, lineHeight: 1.6 }}>
        {t('auth.termsAgreement')}
      </p>
    </div>
  )
}
