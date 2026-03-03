'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useLang } from '@/contexts/LanguageContext'
import { supabase } from '@/lib/supabase'

const inputStyle: React.CSSProperties = {
  width:'100%', padding:'12px 16px', background:'#1a1a1a', border:'1px solid rgba(255,184,0,0.15)', borderRadius:10, color:'#f0ece4', fontSize:15, fontFamily:'Crimson Text, serif', outline:'none'
}
const sectionTitle: React.CSSProperties = {
  fontFamily:'Cinzel, serif', fontSize:9, letterSpacing:3, color:'rgba(240,236,228,0.4)', marginBottom:12, marginTop:4
}
const card: React.CSSProperties = {
  background:'#111', borderRadius:12, border:'1px solid rgba(255,255,255,0.06)', padding:'16px', marginBottom:12
}

export default function SettingsPage() {
  const { profile, user, signOut, refreshProfile } = useAuth()
  const { t, lang, setLang } = useLang()
  const router = useRouter()

  const [displayName, setDisplayName] = useState(profile?.display_name || '')
  const [bio, setBio] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileSaved, setProfileSaved] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteInput, setDeleteInput] = useState('')
  const [deletingAccount, setDeletingAccount] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [sendingReset, setSendingReset] = useState(false)

  const saveProfile = async () => {
    if (!displayName.trim()) return
    setSavingProfile(true)
    const updates: Record<string, unknown> = { display_name: displayName }
    if (bio !== undefined) updates.bio = bio
    updates.is_private = isPrivate
    await supabase.from('profiles').update(updates).eq('id', profile!.id)
    await refreshProfile()
    setProfileSaved(true)
    setTimeout(() => setProfileSaved(false), 2000)
    setSavingProfile(false)
  }

  const sendPasswordReset = async () => {
    if (!user?.email) return
    setSendingReset(true)
    await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${window.location.origin}/auth/reset-password`
    })
    setResetSent(true)
    setSendingReset(false)
  }

  const deleteAccount = async () => {
    if (deleteInput !== t('settings.deleteConfirmWord')) return
    setDeletingAccount(true)
    try {
      // Soft delete: anonymize profile
      await supabase.from('profiles').update({
        display_name: 'Gelöschter Nutzer',
        username: `deleted_${profile!.id.slice(0,8)}`,
        bio: null,
        avatar_url: null,
        deleted_at: new Date().toISOString()
      }).eq('id', profile!.id)
      await signOut()
      router.replace('/auth/login')
    } catch {
      setDeletingAccount(false)
    }
  }

  const ToggleRow = ({ label, sub, checked, onChange }: { label: string; sub?: string; checked: boolean; onChange: (v: boolean) => void }) => (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, padding:'4px 0' }}>
      <div style={{ flex:1 }}>
        <p style={{ fontSize:15, color:'#f0ece4' }}>{label}</p>
        {sub && <p style={{ fontSize:12, color:'rgba(240,236,228,0.4)', marginTop:2 }}>{sub}</p>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        style={{
          width:48, height:26, borderRadius:13, border:'none', cursor:'pointer',
          background: checked ? '#FFB800' : 'rgba(255,255,255,0.1)',
          position:'relative', transition:'background 0.2s', flexShrink:0
        }}
      >
        <span style={{
          position:'absolute', top:3, left: checked ? 25 : 3,
          width:20, height:20, borderRadius:'50%', background:'#fff',
          transition:'left 0.2s', display:'block'
        }}/>
      </button>
    </div>
  )

  return (
    <div style={{ minHeight:'100dvh', background:'#060606', paddingTop:60, paddingBottom:40 }}>
      {/* Header */}
      <div style={{ padding:'0 20px 20px', display:'flex', alignItems:'center', gap:12 }}>
        <button onClick={() => router.back()} style={{ background:'none', border:'none', color:'rgba(240,236,228,0.5)', cursor:'pointer', fontSize:20, padding:0 }}>←</button>
        <h1 className='font-display' style={{ fontSize:20, color:'#f0ece4' }}>{t('settings.title')}</h1>
      </div>

      <div style={{ padding:'0 16px' }}>

        {/* Account Section */}
        <p style={sectionTitle}>{t('settings.account').toUpperCase()}</p>
        <div style={card}>
          <div style={{ marginBottom:14 }}>
            <label style={{ display:'block', fontFamily:'Cinzel, serif', fontSize:9, letterSpacing:2, color:'rgba(240,236,228,0.4)', marginBottom:8 }}>
              {t('settings.displayName').toUpperCase()}
            </label>
            <input
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder={t('settings.displayNamePlaceholder')}
              style={inputStyle}
            />
          </div>
          <div style={{ marginBottom:16 }}>
            <label style={{ display:'block', fontFamily:'Cinzel, serif', fontSize:9, letterSpacing:2, color:'rgba(240,236,228,0.4)', marginBottom:8 }}>
              {t('settings.bio').toUpperCase()}
            </label>
            <textarea
              value={bio}
              onChange={e => setBio(e.target.value)}
              placeholder={t('settings.bioPlaceholder')}
              rows={3}
              style={{ ...inputStyle, resize:'none' }}
            />
          </div>
          <button
            onClick={saveProfile}
            disabled={savingProfile}
            style={{ width:'100%', padding:14, borderRadius:10, border:'none', cursor:'pointer', background: profileSaved ? '#16a34a' : 'linear-gradient(135deg, #CC8800, #FFB800)', color:'#000', fontFamily:'Cinzel, serif', fontSize:11, fontWeight:700, letterSpacing:2 }}
          >
            {savingProfile ? t('settings.saving') : profileSaved ? t('settings.saved') : t('settings.saveChanges').toUpperCase()}
          </button>
        </div>

        {/* Privacy Section */}
        <p style={sectionTitle}>{t('settings.privacy').toUpperCase()}</p>
        <div style={card}>
          <ToggleRow
            label={t('settings.privateAccount')}
            sub={t('settings.privateAccountText')}
            checked={isPrivate}
            onChange={setIsPrivate}
          />
        </div>

        {/* Language Section */}
        <p style={sectionTitle}>{t('settings.language').toUpperCase()}</p>
        <div style={card}>
          <div style={{ display:'flex', gap:8 }}>
            {(['de', 'en'] as const).map(l => (
              <button
                key={l}
                onClick={() => setLang(l)}
                style={{
                  flex:1, padding:'12px', borderRadius:10, border: lang === l ? '1px solid rgba(255,184,0,0.4)' : '1px solid rgba(255,255,255,0.08)', cursor:'pointer',
                  background: lang === l ? 'rgba(255,184,0,0.1)' : 'transparent',
                  color: lang === l ? '#FFB800' : 'rgba(240,236,228,0.5)',
                  fontFamily:'Cinzel, serif', fontSize:11, letterSpacing:1
                }}
              >
                {l === 'de' ? t('settings.languageDE') : t('settings.languageEN')}
              </button>
            ))}
          </div>
        </div>

        {/* Security Section */}
        <p style={sectionTitle}>{t('settings.security').toUpperCase()}</p>
        <div style={card}>
          <p style={{ fontSize:15, color:'#f0ece4', marginBottom:4 }}>{t('settings.changePassword')}</p>
          <p style={{ fontSize:12, color:'rgba(240,236,228,0.4)', marginBottom:14 }}>{t('settings.changePasswordText')}</p>
          {resetSent ? (
            <p style={{ fontSize:14, color:'#4ade80', textAlign:'center', padding:'10px 0' }}>✓ E-Mail gesendet!</p>
          ) : (
            <button
              onClick={sendPasswordReset}
              disabled={sendingReset}
              style={{ width:'100%', padding:12, borderRadius:10, border:'1px solid rgba(255,184,0,0.2)', background:'transparent', color:'rgba(240,236,228,0.7)', fontFamily:'Cinzel, serif', fontSize:10, letterSpacing:1, cursor:'pointer' }}
            >
              {sendingReset ? t('auth.sending') : t('settings.sendPasswordReset').toUpperCase()}
            </button>
          )}
        </div>

        {/* Danger Zone */}
        <p style={sectionTitle}>{t('settings.dangerZone').toUpperCase()}</p>
        <div style={{ ...card, border:'1px solid rgba(248,113,113,0.15)' }}>
          <p style={{ fontSize:15, color:'#f87171', marginBottom:4 }}>{t('settings.deleteAccount')}</p>
          <p style={{ fontSize:12, color:'rgba(240,236,228,0.4)', marginBottom:14 }}>{t('settings.deleteAccountText')}</p>
          <button
            onClick={() => setDeleteOpen(true)}
            style={{ width:'100%', padding:12, borderRadius:10, border:'1px solid rgba(248,113,113,0.3)', background:'rgba(248,113,113,0.08)', color:'#f87171', fontFamily:'Cinzel, serif', fontSize:10, letterSpacing:1, cursor:'pointer' }}
          >
            {t('settings.deleteAccount').toUpperCase()}
          </button>
        </div>
      </div>

      {/* Delete Account Modal */}
      {deleteOpen && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.9)', display:'flex', alignItems:'flex-end', zIndex:300 }} onClick={() => setDeleteOpen(false)}>
          <div style={{ width:'100%', maxWidth:430, margin:'0 auto', background:'#111', borderRadius:'20px 20px 0 0', border:'1px solid rgba(248,113,113,0.2)', padding:'24px 20px 48px' }} onClick={e => e.stopPropagation()}>
            <h3 className='font-display' style={{ fontSize:18, color:'#f87171', textAlign:'center', marginBottom:8 }}>
              {t('settings.deleteAccountTitle')}
            </h3>
            <p style={{ textAlign:'center', fontSize:13, color:'rgba(240,236,228,0.4)', marginBottom:20 }}>
              {t('settings.typeToConfirm')}
            </p>
            <input
              value={deleteInput}
              onChange={e => setDeleteInput(e.target.value)}
              placeholder={t('settings.deleteConfirmWord')}
              style={{ ...inputStyle, border:'1px solid rgba(248,113,113,0.3)', marginBottom:16 }}
            />
            <button
              onClick={deleteAccount}
              disabled={deletingAccount || deleteInput !== t('settings.deleteConfirmWord')}
              style={{
                width:'100%', padding:16, borderRadius:12, border:'none', cursor: deleteInput === t('settings.deleteConfirmWord') ? 'pointer' : 'default',
                background: deleteInput === t('settings.deleteConfirmWord') ? '#dc2626' : 'rgba(248,113,113,0.1)',
                color: deleteInput === t('settings.deleteConfirmWord') ? '#fff' : 'rgba(248,113,113,0.4)',
                fontFamily:'Cinzel, serif', fontSize:12, letterSpacing:2, marginBottom:10
              }}
            >
              {deletingAccount ? '...' : t('settings.deleteAccountConfirm').toUpperCase()}
            </button>
            <button onClick={() => setDeleteOpen(false)} style={{ width:'100%', padding:14, borderRadius:12, border:'1px solid rgba(255,255,255,0.1)', background:'transparent', color:'rgba(240,236,228,0.5)', fontFamily:'Cinzel, serif', fontSize:11, cursor:'pointer' }}>
              {lang === 'de' ? 'ABBRECHEN' : 'CANCEL'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
