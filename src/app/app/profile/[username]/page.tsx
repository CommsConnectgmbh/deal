'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useLang } from '@/contexts/LanguageContext'
import { supabase } from '@/lib/supabase'

export default function PublicProfilePage() {
  const { username } = useParams()
  const { profile: myProfile } = useAuth()
  const { t, lang } = useLang()
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [followStatus, setFollowStatus] = useState<'none' | 'pending' | 'accepted'>('none')
  const [loading, setLoading] = useState(true)
  const [followLoading, setFollowLoading] = useState(false)

  useEffect(() => {
    if (username) fetchUser()
  }, [username])

  const fetchUser = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('username', username)
      .single()

    if (data) {
      setUser(data)
      // Check if this is my own profile
      if (data.id === myProfile?.id) {
        router.replace('/app/profile')
        return
      }
      // Check follow status
      const { data: followData } = await supabase
        .from('follows')
        .select('status')
        .eq('follower_id', myProfile!.id)
        .eq('following_id', data.id)
        .single()
      if (followData) setFollowStatus(followData.status as any)
    }
    setLoading(false)
  }

  const follow = async () => {
    if (!user || !myProfile) return
    setFollowLoading(true)
    const status = user.is_private ? 'pending' : 'accepted'
    await supabase.from('follows').upsert({
      follower_id: myProfile.id,
      following_id: user.id,
      status
    }, { onConflict: 'follower_id,following_id' })
    setFollowStatus(status as any)
    setFollowLoading(false)
  }

  const unfollow = async () => {
    if (!user || !myProfile) return
    setFollowLoading(true)
    await supabase.from('follows')
      .delete()
      .eq('follower_id', myProfile.id)
      .eq('following_id', user.id)
    setFollowStatus('none')
    setFollowLoading(false)
  }

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100dvh', background:'#060606' }}>
      <div style={{ width:32, height:32, border:'2px solid transparent', borderTopColor:'#FFB800', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>
      <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
    </div>
  )

  if (!user) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100dvh', background:'#060606' }}>
      <p style={{ color:'rgba(240,236,228,0.4)' }}>User not found</p>
    </div>
  )

  const isPrivate = user.is_private && followStatus !== 'accepted'
  const isDeleted = !!user.deleted_at

  return (
    <div style={{ minHeight:'100dvh', background:'#060606', paddingTop:60, paddingBottom:40 }}>
      <div style={{ padding:'0 20px 20px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <button onClick={() => router.back()} style={{ background:'none', border:'none', color:'rgba(240,236,228,0.5)', cursor:'pointer', fontSize:20, padding:0 }}>←</button>
          <h1 className='font-display' style={{ fontSize:20, color:'#f0ece4' }}>{t('profile.publicProfile')}</h1>
        </div>
      </div>

      {isDeleted ? (
        <div style={{ padding:'40px 24px', textAlign:'center' }}>
          <p style={{ fontSize:40, marginBottom:16 }}>👻</p>
          <p style={{ color:'rgba(240,236,228,0.4)', fontSize:14 }}>
            {lang === 'de' ? 'Dieses Konto wurde gelöscht.' : 'This account has been deleted.'}
          </p>
        </div>
      ) : (
        <>
          {/* Avatar + Name */}
          <div style={{ textAlign:'center', padding:'0 24px 24px' }}>
            <div style={{ width:80, height:80, borderRadius:'50%', background:'linear-gradient(135deg, #CC8800, #FFB800)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 12px', border: user.is_private ? '2px solid rgba(255,255,255,0.1)' : '2px solid rgba(255,184,0,0.3)' }}>
              <span className='font-display' style={{ fontSize:28, color:'#000', fontWeight:700 }}>
                {(user.username || 'U').slice(0,2).toUpperCase()}
              </span>
            </div>
            <h2 style={{ fontSize:20, color:'#f0ece4', fontWeight:700, marginBottom:4 }}>
              {user.display_name || user.username}
            </h2>
            <p style={{ fontSize:14, color:'rgba(240,236,228,0.4)', marginBottom:12 }}>@{user.username}</p>
            {user.is_private && (
              <div style={{ display:'inline-flex', alignItems:'center', gap:6, background:'rgba(255,255,255,0.05)', borderRadius:20, padding:'4px 14px', marginBottom:12 }}>
                <span style={{ fontSize:12 }}>🔒</span>
                <span style={{ fontSize:11, color:'rgba(240,236,228,0.4)', fontFamily:'Cinzel, serif' }}>
                  {t('profile.privateProfile').toUpperCase()}
                </span>
              </div>
            )}

            {/* Follow Button */}
            <div style={{ marginTop:8 }}>
              {followStatus === 'accepted' ? (
                <button onClick={unfollow} disabled={followLoading} style={{ padding:'12px 28px', borderRadius:10, border:'1px solid rgba(255,255,255,0.1)', background:'transparent', color:'rgba(240,236,228,0.5)', fontFamily:'Cinzel, serif', fontSize:11, letterSpacing:1, cursor:'pointer' }}>
                  {followLoading ? '...' : t('profile.unfollow').toUpperCase()}
                </button>
              ) : followStatus === 'pending' ? (
                <button disabled style={{ padding:'12px 28px', borderRadius:10, border:'1px solid rgba(255,184,0,0.2)', background:'rgba(255,184,0,0.06)', color:'rgba(255,184,0,0.5)', fontFamily:'Cinzel, serif', fontSize:11, letterSpacing:1 }}>
                  {t('profile.followPending').toUpperCase()}
                </button>
              ) : (
                <button onClick={follow} disabled={followLoading} style={{ padding:'12px 28px', borderRadius:10, border:'none', background:'linear-gradient(135deg, #CC8800, #FFB800)', color:'#000', fontFamily:'Cinzel, serif', fontSize:11, fontWeight:700, letterSpacing:1, cursor:'pointer' }}>
                  {followLoading ? '...' : t('profile.follow').toUpperCase()}
                </button>
              )}
            </div>
          </div>

          {/* Stats or private notice */}
          {isPrivate ? (
            <div style={{ margin:'0 24px', textAlign:'center', padding:'32px 20px', background:'#111', borderRadius:14, border:'1px solid rgba(255,255,255,0.06)' }}>
              <p style={{ fontSize:32, marginBottom:12 }}>🔒</p>
              <p style={{ fontSize:14, color:'rgba(240,236,228,0.4)', lineHeight:1.6 }}>
                {t('profile.privateProfileText')}
              </p>
            </div>
          ) : (
            <>
              {/* Stats */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, margin:'0 16px 16px' }}>
                {[
                  { label: lang === 'de' ? 'Siege' : 'Wins', value: user.wins || 0 },
                  { label: 'Deals', value: user.deals_total || 0 },
                  { label: 'Level', value: user.level || 1 },
                ].map(stat => (
                  <div key={stat.label} style={{ background:'#111', borderRadius:12, border:'1px solid rgba(255,255,255,0.06)', padding:'14px 8px', textAlign:'center' }}>
                    <p className='font-display' style={{ fontSize:22, color:'#FFB800', marginBottom:4 }}>{stat.value}</p>
                    <p style={{ fontSize:11, color:'rgba(240,236,228,0.4)', fontFamily:'Cinzel, serif', letterSpacing:1 }}>{stat.label.toUpperCase()}</p>
                  </div>
                ))}
              </div>

              {/* Archetype */}
              {user.primary_archetype && (
                <div style={{ margin:'0 16px', background:'#111', borderRadius:12, border:'1px solid rgba(255,184,0,0.1)', padding:'14px 16px', display:'flex', alignItems:'center', gap:12 }}>
                  <span style={{ fontSize:24 }}>⚡</span>
                  <div>
                    <p style={{ fontSize:11, color:'rgba(240,236,228,0.4)', fontFamily:'Cinzel, serif', letterSpacing:2 }}>{t('profile.archetype').toUpperCase()}</p>
                    <p style={{ fontSize:15, color:'#FFB800', marginTop:2 }}>
                      {t(`profile.archetypes.${user.primary_archetype}`)}
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
