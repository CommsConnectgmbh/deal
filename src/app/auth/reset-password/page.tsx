'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import { useLang } from '@/contexts/LanguageContext'

const inputStyle: React.CSSProperties = {
  width:'100%', padding:'14px 16px', background:'var(--bg-elevated)', border:'1px solid var(--border-subtle)', borderRadius:10, color:'var(--text-primary)', fontSize:16, outline:'none'
}
const labelStyle: React.CSSProperties = {
  display:'block', fontFamily:'var(--font-display)', fontSize:9, letterSpacing:2, color:'var(--text-secondary)', marginBottom:8
}

export default function ResetPasswordPage() {
  const { t } = useLang()
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // Supabase sets the session from the URL hash on load
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: any) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  const handle = async () => {
    if (!password || !confirm) { setError(t('auth.fillAll')); return }
    if (password !== confirm) { setError(t('auth.passwordMismatch')); return }
    if (password.length < 8) { setError(t('auth.passwordTooShort')); return }
    setError(''); setLoading(true)
    try {
      const { error: err } = await supabase.auth.updateUser({ password })
      if (err) throw err
      setDone(true)
      setTimeout(() => router.replace('/auth/login'), 3000)
    } catch (e: unknown) {
      const err = e as Error
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight:'100dvh', background:'var(--bg-base)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'24px', maxWidth:430, margin:'0 auto' }}>
      <div style={{ textAlign:'center', marginBottom:32 }}>
        <Image src="/logo.png" alt="DealBuddy" width={100} height={100} style={{ borderRadius:20 }} />
        <p className="font-display" style={{ fontSize:9, letterSpacing:5, color:'var(--gold-primary)', marginTop:12, opacity:0.8 }}>
          {t('auth.resetPasswordTitle').toUpperCase()}
        </p>
      </div>

      <div style={{ width:'100%', background:'var(--bg-surface)', borderRadius:16, border:'1px solid var(--border-subtle)', padding:24 }}>
        {done ? (
          <div style={{ textAlign:'center' }}>
            <p style={{ fontSize:40, marginBottom:16 }}>✅</p>
            <p className='font-display' style={{ fontSize:14, color:'var(--gold-primary)', marginBottom:12, letterSpacing:1 }}>
              {t('auth.passwordUpdated')}
            </p>
            <p style={{ fontSize:14, color:'var(--text-secondary)', lineHeight:1.6 }}>
              {t('auth.passwordUpdatedText')}
            </p>
          </div>
        ) : !ready ? (
          <div style={{ textAlign:'center', padding:'20px 0' }}>
            <div style={{ width:32, height:32, border:'2px solid transparent', borderTopColor:'var(--gold-primary)', borderRadius:'50%', animation:'spin 0.8s linear infinite', margin:'0 auto 16px' }}/>
            <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
            <p style={{ color:'var(--text-secondary)', fontSize:14 }}>
              {t('auth.saving')}
            </p>
          </div>
        ) : (
          <>
            {error && (
              <div style={{ background:'rgba(248,113,113,0.1)', border:'1px solid rgba(248,113,113,0.3)', borderRadius:8, padding:12, marginBottom:16 }}>
                <p style={{ color:'var(--status-error)', fontSize:14 }}>{error}</p>
              </div>
            )}
            <div style={{ marginBottom:16 }}>
              <label style={labelStyle}>{t('auth.newPassword').toUpperCase()}</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={t('auth.newPasswordPlaceholder')}
                style={inputStyle}
              />
            </div>
            <div style={{ marginBottom:24 }}>
              <label style={labelStyle}>{t('auth.confirmPassword').toUpperCase()}</label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder={t('auth.confirmPasswordPlaceholder')}
                style={inputStyle}
                onKeyDown={e => e.key === 'Enter' && handle()}
              />
            </div>
            <button
              onClick={handle}
              disabled={loading}
              style={{ width:'100%', padding:18, borderRadius:12, border:'none', cursor:'pointer', background:'linear-gradient(135deg, var(--gold-dim), var(--gold-primary), var(--gold-bright))', color:'var(--text-inverse)', fontFamily:'var(--font-display)', fontSize:12, fontWeight:700, letterSpacing:3 }}
            >
              {loading ? t('auth.saving') : t('auth.savePassword')}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
