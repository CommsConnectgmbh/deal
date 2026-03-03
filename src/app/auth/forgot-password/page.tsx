'use client'
import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import { useLang } from '@/contexts/LanguageContext'

const inputStyle: React.CSSProperties = {
  width:'100%', padding:'14px 16px', background:'#1a1a1a', border:'1px solid rgba(255,184,0,0.15)', borderRadius:10, color:'#f0ece4', fontSize:16, fontFamily:'Crimson Text, serif', outline:'none'
}
const labelStyle: React.CSSProperties = {
  display:'block', fontFamily:'Cinzel, serif', fontSize:9, letterSpacing:2, color:'rgba(240,236,228,0.5)', marginBottom:8
}

export default function ForgotPasswordPage() {
  const { t } = useLang()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handle = async () => {
    if (!email) { setError(t('auth.fillAll')); return }
    setError(''); setLoading(true)
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`
      })
      if (err) throw err
      setSent(true)
    } catch (e: unknown) {
      const err = e as Error
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight:'100dvh', background:'#060606', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'24px', maxWidth:430, margin:'0 auto' }}>
      <div style={{ textAlign:'center', marginBottom:32 }}>
        <Image src="/logo.png" alt="DealBuddy" width={100} height={100} style={{ borderRadius:20 }} />
        <p className="font-display" style={{ fontSize:9, letterSpacing:5, color:'#FFB800', marginTop:12, opacity:0.8 }}>
          {t('auth.forgotPasswordTitle').toUpperCase()}
        </p>
      </div>

      <div style={{ width:'100%', background:'#111', borderRadius:16, border:'1px solid rgba(255,184,0,0.1)', padding:24 }}>
        {sent ? (
          <div style={{ textAlign:'center' }}>
            <p style={{ fontSize:40, marginBottom:16 }}>📬</p>
            <p className='font-display' style={{ fontSize:14, color:'#FFB800', marginBottom:12, letterSpacing:1 }}>
              {t('auth.resetSent')}
            </p>
            <p style={{ fontSize:14, color:'rgba(240,236,228,0.5)', marginBottom:24, lineHeight:1.6 }}>
              {t('auth.resetSentText')}
            </p>
            <Link href="/auth/login" style={{ display:'block', textAlign:'center', color:'rgba(240,236,228,0.5)', fontSize:14 }}>
              ← {t('auth.backToLogin')}
            </Link>
          </div>
        ) : (
          <>
            {error && (
              <div style={{ background:'rgba(248,113,113,0.1)', border:'1px solid rgba(248,113,113,0.3)', borderRadius:8, padding:12, marginBottom:16 }}>
                <p style={{ color:'#f87171', fontSize:14 }}>{error}</p>
              </div>
            )}
            <p style={{ fontSize:14, color:'rgba(240,236,228,0.5)', marginBottom:20, lineHeight:1.6 }}>
              {t('auth.forgotPasswordText')}
            </p>
            <div style={{ marginBottom:24 }}>
              <label style={labelStyle}>{t('auth.email').toUpperCase()}</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder={t('auth.emailPlaceholder')}
                style={inputStyle}
                onKeyDown={e => e.key === 'Enter' && handle()}
              />
            </div>
            <button
              onClick={handle}
              disabled={loading}
              style={{ width:'100%', padding:18, borderRadius:12, border:'none', cursor:'pointer', background:'linear-gradient(135deg, #CC8800, #FFB800, #FFE566)', color:'#000', fontFamily:'Cinzel, serif', fontSize:12, fontWeight:700, letterSpacing:3 }}
            >
              {loading ? t('auth.sending') : t('auth.sendReset')}
            </button>
            <div style={{ textAlign:'center', marginTop:20 }}>
              <Link href="/auth/login" style={{ color:'rgba(240,236,228,0.5)', fontSize:14 }}>
                ← {t('auth.backToLogin')}
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
