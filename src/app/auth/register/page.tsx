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

function PasswordStrengthInner({ password }: { password: string }) {
  const { t } = useLang()
  if (!password) return null
  const checks = [
    { label: t('auth.pwCheckMinChars'), ok: password.length >= 6 },
    { label: t('auth.pwCheckLetters'), ok: /[a-zA-Z]/.test(password) },
    { label: t('auth.pwCheckSpecial'), ok: /[0-9!@#$%^&*]/.test(password) },
  ]
  const score = checks.filter(c => c.ok).length
  const colors = ['var(--status-error)', 'var(--gold-primary)', '#4ade80']
  const labels = [t('auth.pwWeak'), t('auth.pwMedium'), t('auth.pwStrong')]
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i < score ? colors[score - 1] : 'var(--border-subtle)', transition: 'background 0.3s' }} />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {checks.map(c => (
            <span key={c.label} style={{ fontSize: 10, color: c.ok ? '#4ade80' : 'var(--text-muted)' }}>
              {c.ok ? '✓' : '○'} {c.label}
            </span>
          ))}
        </div>
        {score > 0 && <span style={{ fontSize: 10, color: colors[score - 1], fontFamily: 'var(--font-display)' }}>{labels[score - 1]}</span>}
      </div>
    </div>
  )
}

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterForm />
    </Suspense>
  )
}

function RegisterForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [emailErr, setEmailErr] = useState('')
  const [pwErr, setPwErr] = useState('')
  const [unErr, setUnErr] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { signUp } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const referralCode = useRef<string | null>(null)
  const { t } = useLang()

  // Track page view + capture referral code on mount
  useEffect(() => {
    trackScreenView('register')
    trackSignupStarted()
    // Referral: check URL param first, then localStorage (set by /join/[code])
    const urlRef = searchParams.get('ref') || searchParams.get('code')
    const storedRef = typeof window !== 'undefined' ? localStorage.getItem('dealbuddy_referral') : null
    referralCode.current = urlRef || storedRef || null
  }, [searchParams])

  const mapError = (msg: string): string => {
    if (msg.includes('already registered') || msg.includes('already exists')) return t('auth.errorAlreadyRegistered')
    if (msg.includes('Password should be')) return t('auth.errorPasswordTooShort')
    if (msg.includes('invalid email')) return t('auth.errorEmailInvalid')
    if (msg.includes('Database error')) return t('auth.errorDatabase')
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
  const validatePassword = (v: string) => {
    if (!v) return t('auth.errorPasswordRequired')
    if (v.length < 6) return t('auth.errorMinChars')
    return ''
  }

  const handle = async () => {
    const uErr = validateUsername(username)
    const eErr = validateEmail(email)
    const pErr = validatePassword(password)
    setUnErr(uErr)
    setEmailErr(eErr)
    setPwErr(pErr)
    if (uErr || eErr || pErr) return

    setError('')
    setLoading(true)
    try {
      await signUp(email, password, username)
      trackSignupCompleted('email')

      // After signUp, the user may need email confirmation OR be auto-confirmed
      // Try to grant founder items client-side (trigger does it too, belt+suspenders)
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
        } catch {
          // Non-fatal – trigger handles it too
        }

        // Referral tracking: link new user to referrer
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
              // Award referral bonus coins to referrer (50 coins)
              await supabase.from('wallet_ledger').insert({
                user_id: referrer.id,
                delta: 50,
                reason: 'referral_bonus',
                reference_id: user.id
              })
              try { await supabase.rpc('add_coins', { p_user_id: referrer.id, p_amount: 50 }) } catch { /* noop */ }
            }
            // Clear stored referral code
            localStorage.removeItem('dealbuddy_referral')
          } catch {
            // Non-fatal
          }
        }
      }

      // Redirect to avatar card creation for new users
      router.replace('/app/avatar-card/create')
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
        {/* Founder badge */}
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

        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>{t('auth.username').toUpperCase()}</label>
          <input
            value={username}
            onChange={e => { setUsername(e.target.value.toLowerCase()); if (unErr) setUnErr('') }}
            onBlur={() => setUnErr(validateUsername(username))}
            onKeyDown={e => e.key === 'Enter' && handle()}
            placeholder={t('auth.usernamePlaceholder')}
            style={inputStyle(!!unErr)}
            autoCapitalize="none"
          />
          {unErr
            ? <p style={{ color: 'var(--status-error)', fontSize: 12, marginTop: 6 }}>{unErr}</p>
            : <p style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 6 }}>{t('auth.usernameHint')}</p>
          }
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>{t('auth.email').toUpperCase()}</label>
          <input
            type="email"
            value={email}
            onChange={e => { setEmail(e.target.value); if (emailErr) setEmailErr('') }}
            onBlur={() => setEmailErr(validateEmail(email))}
            onKeyDown={e => e.key === 'Enter' && handle()}
            placeholder={t('auth.emailPlaceholder')}
            style={inputStyle(!!emailErr)}
          />
          {emailErr && <p style={{ color: 'var(--status-error)', fontSize: 12, marginTop: 6 }}>{emailErr}</p>}
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={labelStyle}>{t('auth.password').toUpperCase()}</label>
          <input
            type="password"
            value={password}
            onChange={e => { setPassword(e.target.value); if (pwErr) setPwErr('') }}
            onBlur={() => setPwErr(validatePassword(password))}
            onKeyDown={e => e.key === 'Enter' && handle()}
            placeholder={t('auth.errorMinChars')}
            style={inputStyle(!!pwErr)}
          />
          {pwErr
            ? <p style={{ color: 'var(--status-error)', fontSize: 12, marginTop: 6 }}>{pwErr}</p>
            : <PasswordStrengthInner password={password} />
          }
        </div>

        <button
          onClick={handle}
          disabled={loading}
          style={{ width: '100%', padding: 18, borderRadius: 12, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', background: loading ? 'var(--gold-subtle)' : 'linear-gradient(135deg, var(--gold-dim), var(--gold-primary), var(--gold-bright))', color: 'var(--text-inverse)', fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 700, letterSpacing: 3, opacity: loading ? 0.7 : 1 }}
        >
          {loading ? t('auth.registering').toUpperCase() : t('auth.registerTitle').toUpperCase()}
        </button>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 14, color: 'var(--text-secondary)' }}>
          {t('auth.hasAccount')}{' '}
          <Link href="/auth/login" style={{ color: 'var(--gold-primary)', fontWeight: 600 }}>{t('auth.login')}</Link>
        </div>
      </div>
    </div>
  )
}
