'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useLang, LANGUAGES } from '@/contexts/LanguageContext'
import { supabase } from '@/lib/supabase'
import ProfileImage from '@/components/ProfileImage'
import PhotoUploadSheet from '@/components/PhotoUploadSheet'
import { isPushSupported, subscribeToPush, unsubscribeFromPush } from '@/lib/pushNotifications'
import { useTheme } from '@/hooks/useTheme'

const inputStyle: React.CSSProperties = {
  width:'100%', padding:'12px 16px', background:'var(--bg-elevated)', border:'1px solid var(--gold-glow)', borderRadius:10, color:'var(--text-primary)', fontSize:15, fontFamily:'var(--font-body)', outline:'none'
}
const sectionTitle: React.CSSProperties = {
  fontFamily:'var(--font-display)', fontSize:9, letterSpacing:3, color:'var(--text-secondary)', marginBottom:12, marginTop:4
}
const card: React.CSSProperties = {
  background:'var(--bg-surface)', borderRadius:12, border:'1px solid var(--border-subtle)', padding:'16px', marginBottom:12
}

export default function SettingsPage() {
  const { profile, user, signOut, refreshProfile } = useAuth()
  const { t, lang, setLang } = useLang()
  const { theme, toggleTheme } = useTheme()
  const router = useRouter()

  const [displayName, setDisplayName] = useState(profile?.display_name || '')
  const [bio, setBio] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileSaved, setProfileSaved] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteInput, setDeleteInput] = useState('')
  const [deletingAccount, setDeletingAccount] = useState(false)
  const [resetSent, setResetSent]       = useState(false)
  const [sendingReset, setSendingReset] = useState(false)
  const [pushEnabled, setPushEnabled]   = useState(false)
  const [pushLoading, setPushLoading]   = useState(false)
  const [photoSheetOpen, setPhotoSheetOpen] = useState(false)
  const [allowStoryDm, setAllowStoryDm] = useState(true)
  const [displayNameError, setDisplayNameError] = useState('')
  const [usernameInput, setUsernameInput] = useState(profile?.username || '')
  const [usernameError, setUsernameError] = useState('')
  const [opponentFilterEnabled, setOpponentFilterEnabled] = useState(false)
  const [opponentMinReliability, setOpponentMinReliability] = useState<number | null>(null)
  const [opponentRequireConfirmation, setOpponentRequireConfirmation] = useState(false)

  // Sync state from profile when it loads
  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || '')
      setUsernameInput(profile.username || '')
      setBio(profile.bio || '')
      setIsPrivate(profile.is_private || false)
      setAllowStoryDm(profile.allow_story_dm !== false)
      setOpponentFilterEnabled((profile as any).opponent_filter_enabled || false)
      setOpponentMinReliability((profile as any).opponent_min_reliability ?? null)
      setOpponentRequireConfirmation((profile as any).opponent_require_confirmation || false)
    }
  }, [profile?.id])

  useEffect(() => {
    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }
    // Check if user already has push subscription in DB
    if (profile) {
      supabase.from('push_subscriptions')
        .select('id').eq('user_id', profile.id).limit(1)
        .then(({ data }: any) => setPushEnabled(!!(data && data.length > 0)))
    }
  }, [profile?.id])

  const saveProfile = async () => {
    if (!displayName.trim()) return
    setDisplayNameError('')
    setUsernameError('')
    setSavingProfile(true)

    // Validate username
    const cleanUsername = usernameInput.trim().toLowerCase()
    if (cleanUsername !== (profile?.username || '')) {
      if (!cleanUsername || cleanUsername.length < 3) {
        setUsernameError(t('settings.usernameMin'))
        setSavingProfile(false)
        return
      }
      if (cleanUsername.length > 20) {
        setUsernameError(t('settings.usernameMax'))
        setSavingProfile(false)
        return
      }
      if (!/^[a-z0-9_]+$/.test(cleanUsername)) {
        setUsernameError(t('settings.usernameChars'))
        setSavingProfile(false)
        return
      }
      // Check if username is taken
      const { data: unameExists } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', cleanUsername)
        .neq('id', profile!.id)
        .is('deleted_at', null)
        .limit(1)
      if (unameExists && unameExists.length > 0) {
        setUsernameError(t('settings.usernameTaken'))
        setSavingProfile(false)
        return
      }
    }

    // Check for duplicate display_name
    if (displayName.trim() !== (profile?.display_name || '')) {
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .ilike('display_name', displayName.trim())
        .neq('id', profile!.id)
        .is('deleted_at', null)
        .limit(1)
      if (existing && existing.length > 0) {
        setDisplayNameError(t('settings.displayNameTaken'))
        setSavingProfile(false)
        return
      }
    }

    const updates: Record<string, unknown> = { display_name: displayName.trim() }
    if (cleanUsername !== (profile?.username || '')) updates.username = cleanUsername
    if (bio !== undefined) updates.bio = bio
    updates.is_private = isPrivate
    updates.allow_story_dm = allowStoryDm
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

  const togglePush = async (enable: boolean) => {
    if (!profile || pushLoading) return
    setPushLoading(true)
    try {
      if (enable) {
        if (!isPushSupported()) {
          alert(t('settings.pushNotSupported'))
          setPushLoading(false); return
        }
        // Register SW first
        if ('serviceWorker' in navigator) {
          await navigator.serviceWorker.register('/sw.js')
        }
        const success = await subscribeToPush(profile.id)
        if (success) {
          setPushEnabled(true)
        } else {
          // Permission denied or failed
          alert(t('settings.pushDenied'))
        }
      } else {
        await unsubscribeFromPush(profile.id)
        setPushEnabled(false)
      }
    } catch (_e) { /* push toggle error */ }
    setPushLoading(false)
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
        <p style={{ fontSize:15, color:'var(--text-primary)' }}>{label}</p>
        {sub && <p style={{ fontSize:12, color:'var(--text-secondary)', marginTop:2 }}>{sub}</p>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        style={{
          width:48, height:26, borderRadius:13, border:'none', cursor:'pointer',
          background: checked ? 'var(--gold-primary)' : 'var(--border-default)',
          position:'relative', transition:'background 0.2s', flexShrink:0,
          boxShadow: 'inset 0 0 0 1px var(--border-subtle)'
        }}
      >
        <span style={{
          position:'absolute', top:3, left: checked ? 25 : 3,
          width:20, height:20, borderRadius:'50%', background:'var(--text-inverse)',
          transition:'left 0.2s', display:'block',
          boxShadow:'0 1px 3px rgba(0,0,0,0.15)'
        }}/>
      </button>
    </div>
  )

  return (
    <div style={{ minHeight:'100dvh', background:'var(--bg-base)', paddingTop:60, paddingBottom:40 }}>
      {/* Header */}
      <div style={{ padding:'0 20px 20px', display:'flex', alignItems:'center', gap:12 }}>
        <button onClick={() => router.back()} style={{ background:'none', border:'none', color:'var(--text-secondary)', cursor:'pointer', fontSize:20, padding:0 }}>←</button>
        <h1 className='font-display' style={{ fontSize:20, color:'var(--text-primary)' }}>{t('settings.title')}</h1>
      </div>

      <div style={{ padding:'0 16px' }}>

        {/* Profile Photo Section */}
        <p style={sectionTitle}>{t('settings.profilePhoto')}</p>
        <div style={{ ...card, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <ProfileImage
            size={80}
            avatarUrl={profile?.avatar_url}
            name={profile?.display_name || profile?.username}
            goldBorder
          />
          <button
            onClick={() => setPhotoSheetOpen(true)}
            style={{
              padding: '10px 24px', borderRadius: 10,
              border: '1px solid var(--gold-glow)',
              background: 'var(--gold-subtle)',
              color: 'var(--gold-primary)', fontFamily: 'var(--font-display)',
              fontSize: 10, letterSpacing: 2, cursor: 'pointer',
            }}
          >
            {t('settings.adjustPhoto')}
          </button>
        </div>

        {/* Appearance / Theme Section */}
        <p style={sectionTitle}>{t('settings.appearance')}</p>
        <div style={card}>
          <ToggleRow
            label={t('settings.darkMode')}
            sub={t('settings.darkModeSub')}
            checked={theme === 'dark'}
            onChange={() => toggleTheme()}
          />
        </div>

        {/* Account Section */}
        <p style={sectionTitle}>{t('settings.account').toUpperCase()}</p>
        <div style={card}>
          <div style={{ marginBottom:14 }}>
            <label style={{ display:'block', fontFamily:'var(--font-display)', fontSize:9, letterSpacing:2, color:'var(--text-secondary)', marginBottom:8 }}>
              USERNAME
            </label>
            <input
              value={usernameInput}
              onChange={e => { setUsernameInput(e.target.value.toLowerCase()); setUsernameError('') }}
              placeholder={t('settings.usernamePlaceholder')}
              autoCapitalize="none"
              style={{ ...inputStyle, border: usernameError ? '1px solid var(--status-error)' : '1px solid var(--gold-glow)' }}
            />
            {usernameError
              ? <p style={{ fontSize: 12, color: 'var(--status-error)', marginTop: 6 }}>{usernameError}</p>
              : <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  {t('settings.usernameHandle')}
                </p>
            }
          </div>
          <div style={{ marginBottom:14 }}>
            <label style={{ display:'block', fontFamily:'var(--font-display)', fontSize:9, letterSpacing:2, color:'var(--text-secondary)', marginBottom:8 }}>
              {t('settings.displayName').toUpperCase()}
            </label>
            <input
              value={displayName}
              onChange={e => { setDisplayName(e.target.value); setDisplayNameError('') }}
              placeholder={t('settings.displayNamePlaceholder')}
              style={{ ...inputStyle, border: displayNameError ? '1px solid var(--status-error)' : '1px solid var(--gold-glow)' }}
            />
            {displayNameError && (
              <p style={{ fontSize: 12, color: 'var(--status-error)', marginTop: 6 }}>{displayNameError}</p>
            )}
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              {t('settings.displayNameShown')}
            </p>
          </div>
          <div style={{ marginBottom:16 }}>
            <label style={{ display:'block', fontFamily:'var(--font-display)', fontSize:9, letterSpacing:2, color:'var(--text-secondary)', marginBottom:8 }}>
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
            style={{ width:'100%', padding:14, borderRadius:10, border:'none', cursor:'pointer', background: profileSaved ? 'var(--status-active)' : 'linear-gradient(135deg, var(--gold-dim), var(--gold-primary))', color:'var(--text-inverse)', fontFamily:'var(--font-display)', fontSize:11, fontWeight:700, letterSpacing:2 }}
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
          <div style={{ borderTop: '1px solid var(--border-subtle)', marginTop: 12, paddingTop: 12 }}>
            <ToggleRow
              label={t('settings.allowStoryDm')}
              sub={t('settings.storyDmText')}
              checked={allowStoryDm}
              onChange={async (v) => {
                setAllowStoryDm(v)
                await supabase.from('profiles').update({ allow_story_dm: v }).eq('id', profile!.id)
              }}
            />
          </div>
        </div>

        {/* Opponent Filter Section */}
        <p style={sectionTitle}>{t('settings.opponentFilter')}</p>
        <div style={card}>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'var(--font-body)', lineHeight: 1.5, marginBottom: 16 }}>
            {t('settings.opponentFilterDesc')}
          </p>

          {/* Option 1: No filter */}
          <div onClick={() => {
            setOpponentFilterEnabled(false)
            setOpponentRequireConfirmation(false)
            supabase.from('profiles').update({
              opponent_filter_enabled: false,
              opponent_require_confirmation: false,
            }).eq('id', profile!.id)
          }} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', cursor: 'pointer', borderBottom: '1px solid var(--border-subtle)' }}>
            <div style={{
              width: 20, height: 20, borderRadius: '50%',
              border: `2px solid ${!opponentFilterEnabled ? 'var(--gold-primary)' : 'var(--text-muted)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {!opponentFilterEnabled && (
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--gold-primary)' }} />
              )}
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 14, color: 'var(--text-primary)' }}>{t('settings.acceptEveryone')}</p>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{t('settings.acceptEveryoneSub')}</p>
            </div>
          </div>

          {/* Option 2: Min reliability */}
          <div onClick={() => {
            setOpponentFilterEnabled(true)
            setOpponentRequireConfirmation(false)
            const minVal = opponentMinReliability || 75
            setOpponentMinReliability(minVal)
            supabase.from('profiles').update({
              opponent_filter_enabled: true,
              opponent_min_reliability: minVal,
              opponent_require_confirmation: false,
            }).eq('id', profile!.id)
          }} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 0', cursor: 'pointer', borderBottom: '1px solid var(--border-subtle)' }}>
            <div style={{
              width: 20, height: 20, borderRadius: '50%', marginTop: 2,
              border: `2px solid ${opponentFilterEnabled && !opponentRequireConfirmation ? 'var(--gold-primary)' : 'var(--text-muted)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {opponentFilterEnabled && !opponentRequireConfirmation && (
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--gold-primary)' }} />
              )}
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 14, color: 'var(--text-primary)' }}>{t('settings.minReliability')}</p>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{t('settings.minReliabilitySub')}</p>
            </div>
          </div>

          {/* Slider for min reliability */}
          {opponentFilterEnabled && !opponentRequireConfirmation && (
            <div style={{ padding: '12px 0 8px', paddingLeft: 32 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('settings.minScore')}</span>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: 'var(--gold-primary)' }}>
                  {opponentMinReliability || 75}%
                </span>
              </div>
              <input
                type="range"
                min={50}
                max={95}
                step={5}
                value={opponentMinReliability || 75}
                onChange={(e) => {
                  const val = parseInt(e.target.value)
                  setOpponentMinReliability(val)
                  supabase.from('profiles').update({
                    opponent_min_reliability: val,
                  }).eq('id', profile!.id)
                }}
                style={{ width: '100%', accentColor: 'var(--gold-primary)' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-display)', letterSpacing: 1 }}>
                <span>50%</span><span>95%</span>
              </div>
            </div>
          )}

          {/* Option 3: Manual confirmation */}
          <div onClick={() => {
            setOpponentFilterEnabled(true)
            setOpponentRequireConfirmation(true)
            supabase.from('profiles').update({
              opponent_filter_enabled: true,
              opponent_require_confirmation: true,
            }).eq('id', profile!.id)
          }} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', cursor: 'pointer' }}>
            <div style={{
              width: 20, height: 20, borderRadius: '50%',
              border: `2px solid ${opponentRequireConfirmation ? 'var(--gold-primary)' : 'var(--text-muted)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {opponentRequireConfirmation && (
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--gold-primary)' }} />
              )}
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 14, color: 'var(--text-primary)' }}>{t('settings.manualConfirm')}</p>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{t('settings.manualConfirmSub')}</p>
            </div>
          </div>
        </div>

        {/* Language Section */}
        <p style={sectionTitle}>{t('settings.language').toUpperCase()}</p>
        <div style={card}>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {LANGUAGES.map(l => (
              <button
                key={l.code}
                onClick={() => setLang(l.code)}
                style={{
                  display:'flex', alignItems:'center', gap:12,
                  padding:'12px 16px', borderRadius:10, cursor:'pointer',
                  border: lang === l.code ? '1px solid var(--gold-glow)' : '1px solid var(--border-subtle)',
                  background: lang === l.code ? 'var(--gold-subtle)' : 'transparent',
                  transition: 'all 0.15s',
                }}
              >
                <span style={{ fontSize: 22 }}>{l.flag}</span>
                <span style={{
                  fontFamily:'var(--font-display)', fontSize:13, letterSpacing:1, flex:1, textAlign:'left',
                  color: lang === l.code ? 'var(--gold-primary)' : 'var(--text-secondary)',
                  fontWeight: lang === l.code ? 700 : 400,
                }}>
                  {l.label}
                </span>
                {lang === l.code && (
                  <span style={{ color:'var(--gold-primary)', fontSize:14 }}>{'\u2713'}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Security Section */}
        <p style={sectionTitle}>{t('settings.security').toUpperCase()}</p>
        <div style={card}>
          <p style={{ fontSize:15, color:'var(--text-primary)', marginBottom:4 }}>{t('settings.changePassword')}</p>
          <p style={{ fontSize:12, color:'var(--text-secondary)', marginBottom:14 }}>{t('settings.changePasswordText')}</p>
          {resetSent ? (
            <p style={{ fontSize:14, color:'var(--status-active)', textAlign:'center', padding:'10px 0' }}>✓ {t('settings.emailSent')}</p>
          ) : (
            <button
              onClick={sendPasswordReset}
              disabled={sendingReset}
              style={{ width:'100%', padding:12, borderRadius:10, border:'1px solid var(--gold-glow)', background:'transparent', color:'var(--text-primary)', fontFamily:'var(--font-display)', fontSize:10, letterSpacing:1, cursor:'pointer' }}
            >
              {sendingReset ? t('auth.sending') : t('settings.sendPasswordReset').toUpperCase()}
            </button>
          )}
        </div>

        {/* Push Notifications */}
        <p style={sectionTitle}>{t('settings.notifications').toUpperCase()}</p>
        <div style={card}>
          <ToggleRow
            label={t('settings.pushLabel')}
            sub={t('settings.pushSub')}
            checked={pushEnabled}
            onChange={togglePush}
          />
          {pushLoading && (
            <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 10, textAlign: 'center', fontFamily: 'var(--font-display)', letterSpacing: 1 }}>
              {t('settings.pushSetting')}
            </p>
          )}
        </div>

        {/* Community */}
        <p style={sectionTitle}>COMMUNITY</p>
        <a
          href="https://discord.gg/gJkzFzZdS2"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            ...card,
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            textDecoration: 'none',
            color: 'inherit',
            border: '1px solid #5865F2',
            background: 'linear-gradient(135deg, rgba(88,101,242,0.18), rgba(88,101,242,0.04))',
          }}
        >
          <div style={{ fontSize: 28, lineHeight: 1 }}>💬</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>
              Deal Buddy Discord
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Community, Support, Beta & Insider-Drops
            </div>
          </div>
          <div style={{ fontSize: 20, color: '#5865F2' }}>→</div>
        </a>

        {/* Danger Zone */}
        <p style={sectionTitle}>{t('settings.dangerZone').toUpperCase()}</p>
        <div style={{ ...card, border:'1px solid color-mix(in srgb, var(--status-error) 15%, transparent)' }}>
          <p style={{ fontSize:15, color:'var(--status-error)', marginBottom:4 }}>{t('settings.deleteAccount')}</p>
          <p style={{ fontSize:12, color:'var(--text-secondary)', marginBottom:14 }}>{t('settings.deleteAccountText')}</p>
          <button
            onClick={() => setDeleteOpen(true)}
            style={{ width:'100%', padding:12, borderRadius:10, border:'1px solid color-mix(in srgb, var(--status-error) 30%, transparent)', background:'color-mix(in srgb, var(--status-error) 8%, transparent)', color:'var(--status-error)', fontFamily:'var(--font-display)', fontSize:10, letterSpacing:1, cursor:'pointer' }}
          >
            {t('settings.deleteAccount').toUpperCase()}
          </button>
        </div>
      </div>

      {/* Photo Upload Sheet */}
      <PhotoUploadSheet
        open={photoSheetOpen}
        onClose={() => setPhotoSheetOpen(false)}
      />

      {/* Delete Account Modal */}
      {deleteOpen && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.9)', display:'flex', alignItems:'flex-end', zIndex:300 }} onClick={() => setDeleteOpen(false)}>
          <div style={{ width:'100%', maxWidth:430, margin:'0 auto', background:'var(--bg-surface)', borderRadius:'20px 20px 0 0', border:'1px solid color-mix(in srgb, var(--status-error) 20%, transparent)', padding:'24px 20px 48px' }} onClick={e => e.stopPropagation()}>
            <h3 className='font-display' style={{ fontSize:18, color:'var(--status-error)', textAlign:'center', marginBottom:8 }}>
              {t('settings.deleteAccountTitle')}
            </h3>
            <p style={{ textAlign:'center', fontSize:13, color:'var(--text-secondary)', marginBottom:20 }}>
              {t('settings.typeToConfirm')}
            </p>
            <input
              value={deleteInput}
              onChange={e => setDeleteInput(e.target.value)}
              placeholder={t('settings.deleteConfirmWord')}
              style={{ ...inputStyle, border:'1px solid color-mix(in srgb, var(--status-error) 30%, transparent)', marginBottom:16 }}
            />
            <button
              onClick={deleteAccount}
              disabled={deletingAccount || deleteInput !== t('settings.deleteConfirmWord')}
              style={{
                width:'100%', padding:16, borderRadius:12, border:'none', cursor: deleteInput === t('settings.deleteConfirmWord') ? 'pointer' : 'default',
                background: deleteInput === t('settings.deleteConfirmWord') ? '#dc2626' : 'color-mix(in srgb, var(--status-error) 10%, transparent)',
                color: deleteInput === t('settings.deleteConfirmWord') ? 'var(--text-inverse)' : 'color-mix(in srgb, var(--status-error) 40%, transparent)',
                fontFamily:'var(--font-display)', fontSize:12, letterSpacing:2, marginBottom:10
              }}
            >
              {deletingAccount ? '...' : t('settings.deleteAccountConfirm').toUpperCase()}
            </button>
            <button onClick={() => setDeleteOpen(false)} style={{ width:'100%', padding:14, borderRadius:12, border:'1px solid var(--border-subtle)', background:'transparent', color:'var(--text-secondary)', fontFamily:'var(--font-display)', fontSize:11, cursor:'pointer' }}>
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
