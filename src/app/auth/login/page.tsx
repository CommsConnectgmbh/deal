'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import Image from 'next/image'
import Link from 'next/link'

const inputStyle = (hasError: boolean): React.CSSProperties => ({
  width: '100%', padding: '14px 16px', background: '#1a1a1a',
  border: `1px solid ${hasError ? 'rgba(248,113,113,0.5)' : 'rgba(255,184,0,0.15)'}`,
  borderRadius: 10, color: '#f0ece4', fontSize: 16,
  fontFamily: 'Crimson Text, serif', outline: 'none',
})
const labelStyle: React.CSSProperties = {
  display: 'block', fontFamily: 'Cinzel, serif', fontSize: 9,
  letterSpacing: 2, color: 'rgba(240,236,228,0.5)', marginBottom: 8,
}

function mapError(msg: string): string {
  if (msg.includes('Invalid login credentials')) return 'E-Mail oder Passwort falsch'
  if (msg.includes('Email not confirmed')) return 'E-Mail-Adresse noch nicht bestätigt'
  if (msg.includes('Too many requests')) return 'Zu viele Versuche – bitte kurz warten'
  if (msg.includes('User not found')) return 'Kein Account mit dieser E-Mail gefunden'
  if (msg.includes('network')) return 'Netzwerkfehler – bitte Verbindung prüfen'
  return msg
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

  const validateEmail = (v: string) => {
    if (!v) return 'E-Mail ist erforderlich'
    if (!/\S+@\S+\.\S+/.test(v)) return 'Ungültige E-Mail-Adresse'
    return ''
  }
  const validatePassword = (v: string) => {
    if (!v) return 'Passwort ist erforderlich'
    if (v.length < 6) return 'Mindestens 6 Zeichen'
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
      router.replace('/app/home')
    } catch (e: unknown) {
      setError(mapError((e as Error).message))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100dvh', background: '#060606', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', maxWidth: 430, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <Image src="/logo.png" alt="DealBuddy" width={100} height={100} style={{ borderRadius: 20 }} />
        <p className="font-display" style={{ fontSize: 9, letterSpacing: 5, color: '#FFB800', marginTop: 12, opacity: 0.8 }}>
          WILLKOMMEN ZURÜCK
        </p>
      </div>

      <div style={{ width: '100%', background: '#111', borderRadius: 16, border: '1px solid rgba(255,184,0,0.1)', padding: 24 }}>
        {error && (
          <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 8, padding: '12px 14px', marginBottom: 16, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <span style={{ fontSize: 16, lineHeight: 1 }}>⚠️</span>
            <p style={{ color: '#f87171', fontSize: 14, lineHeight: 1.4 }}>{error}</p>
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>E-MAIL</label>
          <input
            type="email"
            value={email}
            onChange={e => { setEmail(e.target.value); if (emailErr) setEmailErr('') }}
            onBlur={() => setEmailErr(validateEmail(email))}
            placeholder="deine@email.de"
            style={inputStyle(!!emailErr)}
            onKeyDown={e => e.key === 'Enter' && handle()}
          />
          {emailErr && <p style={{ color: '#f87171', fontSize: 12, marginTop: 6 }}>{emailErr}</p>}
        </div>

        <div style={{ marginBottom: 8 }}>
          <label style={labelStyle}>PASSWORT</label>
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
            ? <p style={{ color: '#f87171', fontSize: 12, marginTop: 6 }}>{pwErr}</p>
            : <p style={{ color: 'rgba(240,236,228,0.3)', fontSize: 11, marginTop: 6 }}>Mindestens 6 Zeichen</p>
          }
        </div>

        <div style={{ textAlign: 'right', marginBottom: 24 }}>
          <Link href="/auth/forgot-password" style={{ color: 'rgba(240,236,228,0.4)', fontSize: 12 }}>
            Passwort vergessen?
          </Link>
        </div>

        <button
          onClick={handle}
          disabled={loading}
          style={{ width: '100%', padding: 18, borderRadius: 12, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', background: loading ? 'rgba(255,184,0,0.4)' : 'linear-gradient(135deg, #CC8800, #FFB800, #FFE566)', color: '#000', fontFamily: 'Cinzel, serif', fontSize: 12, fontWeight: 700, letterSpacing: 3, opacity: loading ? 0.7 : 1 }}
        >
          {loading ? 'EINLOGGEN...' : 'EINLOGGEN'}
        </button>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 14, color: 'rgba(240,236,228,0.5)' }}>
          Noch kein Account?{' '}
          <Link href="/auth/register" style={{ color: '#FFB800', fontWeight: 600 }}>Registrieren</Link>
        </div>
      </div>

      <p style={{ textAlign: 'center', fontSize: 11, color: 'rgba(240,236,228,0.2)', marginTop: 24, lineHeight: 1.6 }}>
        Mit dem Login stimmst du den Nutzungsbedingungen zu.
      </p>
    </div>
  )
}
