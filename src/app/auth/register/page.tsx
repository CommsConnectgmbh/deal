'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useLang } from '@/contexts/LanguageContext'
import Image from 'next/image'
import Link from 'next/link'

const inputStyle: React.CSSProperties = {
  width:'100%', padding:'14px 16px', background:'#1a1a1a', border:'1px solid rgba(255,184,0,0.15)', borderRadius:10, color:'#f0ece4', fontSize:16, fontFamily:'Crimson Text, serif', outline:'none'
}
const labelStyle: React.CSSProperties = {
  display:'block', fontFamily:'Cinzel, serif', fontSize:9, letterSpacing:2, color:'rgba(240,236,228,0.5)', marginBottom:8
}

export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { signUp } = useAuth()
  const { t } = useLang()
  const router = useRouter()

  const handle = async () => {
    if (!email || !password || !username) { setError(t('auth.fillAll')); return }
    setError(''); setLoading(true)
    try {
      await signUp(email, password, username)
      router.replace('/app/home')
    } catch (e: unknown) {
      const err = e as Error
      setError(err.message)
    } finally { setLoading(false) }
  }

  return (
    <div style={{ minHeight:'100dvh', background:'#060606', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'24px', maxWidth:430, margin:'0 auto' }}>
      <div style={{ textAlign:'center', marginBottom:32 }}>
        <Image src="/logo.png" alt="DealBuddy" width={100} height={100} style={{ borderRadius:20 }} />
        <p className="font-display" style={{ fontSize:9, letterSpacing:5, color:'#FFB800', marginTop:12, opacity:0.8 }}>
          SEASON 1 · THE FOUNDERS ERA
        </p>
      </div>

      <div style={{ width:'100%', background:'#111', borderRadius:16, border:'1px solid rgba(255,184,0,0.1)', padding:24 }}>
        <h2 className="font-display" style={{ fontSize:18, color:'#FFB800', textAlign:'center', marginBottom:20, letterSpacing:1 }}>
          {t('auth.registerTitle')}
        </h2>
        {error && (
          <div style={{ background:'rgba(248,113,113,0.1)', border:'1px solid rgba(248,113,113,0.3)', borderRadius:8, padding:12, marginBottom:16 }}>
            <p style={{ color:'#f87171', fontSize:14 }}>{error}</p>
          </div>
        )}
        <div style={{ marginBottom:16 }}>
          <label style={labelStyle}>{t('auth.username').toUpperCase()}</label>
          <input value={username} onChange={e => setUsername(e.target.value)} placeholder={t('auth.usernamePlaceholder')} style={inputStyle} />
        </div>
        <div style={{ marginBottom:16 }}>
          <label style={labelStyle}>{t('auth.email').toUpperCase()}</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder={t('auth.emailPlaceholder')} style={inputStyle} />
        </div>
        <div style={{ marginBottom:24 }}>
          <label style={labelStyle}>{t('auth.password').toUpperCase()}</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder={t('auth.passwordPlaceholder')} style={inputStyle} />
        </div>
        <button onClick={handle} disabled={loading} style={{ width:'100%', padding:18, borderRadius:12, border:'none', cursor:'pointer', background:'linear-gradient(135deg, #CC8800, #FFB800, #FFE566)', color:'#000', fontFamily:'Cinzel, serif', fontSize:12, fontWeight:700, letterSpacing:3 }}>
          {loading ? t('auth.registering') : t('auth.register')}
        </button>
        <div style={{ textAlign:'center', marginTop:20, fontSize:14, color:'rgba(240,236,228,0.5)' }}>
          {t('auth.hasAccount')}{' '}
          <Link href="/auth/login" style={{ color:'#FFB800' }}>{t('auth.login')}</Link>
        </div>
      </div>
    </div>
  )
}
