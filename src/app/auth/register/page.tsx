'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
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
  if (msg.includes('already registered') || msg.includes('already exists')) return 'Diese E-Mail ist bereits registriert'
  if (msg.includes('Password should be')) return 'Passwort muss mindestens 6 Zeichen lang sein'
  if (msg.includes('invalid email')) return 'Ungültige E-Mail-Adresse'
  if (msg.includes('Database error')) return 'Registrierungsfehler – bitte erneut versuchen oder Support kontaktieren'
  if (msg.includes('network')) return 'Netzwerkfehler – bitte Verbindung prüfen'
  return msg
}

function PasswordStrength({ password }: { password: string }) {
  if (!password) return null
  const checks = [
    { label: 'Min. 6 Zeichen', ok: password.length >= 6 },
    { label: 'Buchstaben', ok: /[a-zA-Z]/.test(password) },
    { label: 'Zahlen/Sonderzeichen', ok: /[0-9!@#$%^&*]/.test(password) },
  ]
  const score = checks.filter(c => c.ok).length
  const colors = ['#f87171', '#FFB800', '#4ade80']
  const labels = ['Schwach', 'Mittel', 'Stark']
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i < score ? colors[score - 1] : 'rgba(255,255,255,0.1)', transition: 'background 0.3s' }} />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {checks.map(c => (
            <span key={c.label} style={{ fontSize: 10, color: c.ok ? '#4ade80' : 'rgba(240,236,228,0.3)' }}>
              {c.ok ? '✓' : '○'} {c.label}
            </span>
          ))}
        </div>
        {score > 0 && <span style={{ fontSize: 10, color: colors[score - 1], fontFamily: 'Cinzel, serif' }}>{labels[score - 1]}</span>}
      </div>
    </div>
  )
}

export default function RegisterPage() {
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

  const validateUsername = (v: string) => {
    if (!v) return 'Benutzername ist erforderlich'
    if (v.length < 3) return 'Mindestens 3 Zeichen'
    if (v.length > 20) return 'Maximal 20 Zeichen'
    if (!/^[a-zA-Z0-9_]+$/.test(v)) return 'Nur Buchstaben, Zahlen und _'
    return ''
  }
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
      }

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
          SEASON 1 · THE FOUNDERS ERA
        </p>
      </div>

      <div style={{ width: '100%', background: '#111', borderRadius: 16, border: '1px solid rgba(255,184,0,0.1)', padding: 24 }}>
        {/* Founder badge */}
        <div style={{ background: 'rgba(255,184,0,0.06)', border: '1px solid rgba(255,184,0,0.2)', borderRadius: 10, padding: '10px 14px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>⚡</span>
          <div>
            <p style={{ color: '#FFB800', fontSize: 12, fontFamily: 'Cinzel, serif', fontWeight: 700 }}>Founder-Status</p>
            <p style={{ color: 'rgba(240,236,228,0.5)', fontSize: 11, marginTop: 2 }}>Limitierter Rahmen & Badge für die ersten 1.000</p>
          </div>
        </div>

        {error && (
          <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 8, padding: '12px 14px', marginBottom: 16, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <span style={{ fontSize: 16, lineHeight: 1 }}>⚠️</span>
            <p style={{ color: '#f87171', fontSize: 14, lineHeight: 1.4 }}>{error}</p>
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>BENUTZERNAME</label>
          <input
            value={username}
            onChange={e => { setUsername(e.target.value.toLowerCase()); if (unErr) setUnErr('') }}
            onBlur={() => setUnErr(validateUsername(username))}
            placeholder="dein_name"
            style={inputStyle(!!unErr)}
            autoCapitalize="none"
          />
          {unErr
            ? <p style={{ color: '#f87171', fontSize: 12, marginTop: 6 }}>{unErr}</p>
            : <p style={{ color: 'rgba(240,236,228,0.3)', fontSize: 11, marginTop: 6 }}>3–20 Zeichen · nur a-z, 0-9, _</p>
          }
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>E-MAIL</label>
          <input
            type="email"
            value={email}
            onChange={e => { setEmail(e.target.value); if (emailErr) setEmailErr('') }}
            onBlur={() => setEmailErr(validateEmail(email))}
            placeholder="deine@email.de"
            style={inputStyle(!!emailErr)}
          />
          {emailErr && <p style={{ color: '#f87171', fontSize: 12, marginTop: 6 }}>{emailErr}</p>}
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={labelStyle}>PASSWORT</label>
          <input
            type="password"
            value={password}
            onChange={e => { setPassword(e.target.value); if (pwErr) setPwErr('') }}
            onBlur={() => setPwErr(validatePassword(password))}
            placeholder="Mindestens 6 Zeichen"
            style={inputStyle(!!pwErr)}
          />
          {pwErr
            ? <p style={{ color: '#f87171', fontSize: 12, marginTop: 6 }}>{pwErr}</p>
            : <PasswordStrength password={password} />
          }
        </div>

        <button
          onClick={handle}
          disabled={loading}
          style={{ width: '100%', padding: 18, borderRadius: 12, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', background: loading ? 'rgba(255,184,0,0.4)' : 'linear-gradient(135deg, #CC8800, #FFB800, #FFE566)', color: '#000', fontFamily: 'Cinzel, serif', fontSize: 12, fontWeight: 700, letterSpacing: 3, opacity: loading ? 0.7 : 1 }}
        >
          {loading ? 'REGISTRIEREN...' : 'KONTO ERSTELLEN'}
        </button>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 14, color: 'rgba(240,236,228,0.5)' }}>
          Bereits registriert?{' '}
          <Link href="/auth/login" style={{ color: '#FFB800', fontWeight: 600 }}>Einloggen</Link>
        </div>
      </div>
    </div>
  )
}
