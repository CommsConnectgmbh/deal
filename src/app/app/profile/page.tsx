'use client'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useLang } from '@/contexts/LanguageContext'
import Image from 'next/image'

const ARCHETYPES: Record<string, { icon: string; color: string }> = {
  closer:    { icon: '🤝', color: '#FFB800' },
  duelist:   { icon: '⚔️', color: '#f87171' },
  architect: { icon: '🏗️', color: '#60a5fa' },
  comeback:  { icon: '🔥', color: '#fb923c' },
  founder:   { icon: '👑', color: '#FFB800' },
  icon:      { icon: '💎', color: '#a78bfa' },
}
export default function ProfilePage() {
  const { profile, signOut } = useAuth()
  const { t, lang, setLang } = useLang()
  const router = useRouter()
  const archetype = profile?.primary_archetype || 'founder'
  const archetypeData = ARCHETYPES[archetype] || ARCHETYPES.founder
  const level = profile?.level ?? 1
  const xp = profile?.xp ?? 0
  const xpForLevel = level * 100
  const xpProgress = Math.min((xp % xpForLevel) / xpForLevel * 100, 100)
  const bpLevel = profile?.battle_pass_level ?? 1
  const bpProgress = Math.min(bpLevel / 30 * 100, 100)
  const initials = (profile?.display_name || profile?.username || 'U').slice(0, 2).toUpperCase()
  const handleLogout = async () => {
    await signOut()
    router.replace('/auth/login')
  }
  return (
    <div style={{ minHeight:'100dvh', background:'#060606', paddingTop:60 }}>
      <div style={{ padding:'0 20px 24px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <h1 className='font-display' style={{ fontSize:28, color:'#f0ece4' }}>{t('profile.title')}</h1>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <button onClick={() => router.push('/app/discover')} style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:8, color:'rgba(240,236,228,0.6)', cursor:'pointer', fontSize:16, padding:'6px 10px' }}>🔍</button>
          <button onClick={() => router.push('/app/settings')} style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:8, color:'rgba(240,236,228,0.6)', cursor:'pointer', fontSize:16, padding:'6px 10px' }}>⚙️</button>
        </div>
      </div>
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', padding:'0 20px 28px' }}>
        <div style={{ position:'relative', marginBottom:16 }}>
          <div style={{ width:90, height:90, borderRadius:'50%', background:'linear-gradient(135deg, #CC8800, #FFB800, #FFE566)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 0 0 3px #FFB800, 0 0 24px rgba(255,184,0,0.4)' }}>
            <span className='font-display' style={{ fontSize:28, color:'#000', fontWeight:700 }}>{initials}</span>
          </div>
          <div style={{ position:'absolute', bottom:-4, right:-4, width:28, height:28, borderRadius:'50%', background:'#111', border:'2px solid #060606', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14 }}>
            {archetypeData.icon}
          </div>
        </div>
        <h2 className='font-display' style={{ fontSize:20, color:'#f0ece4', marginBottom:4 }}>{profile?.display_name || profile?.username}</h2>
        <p style={{ fontSize:13, color:'rgba(240,236,228,0.4)', marginBottom:8 }}>@{profile?.username}</p>
        <div style={{ padding:'4px 14px', borderRadius:20, background:`${archetypeData.color}18`, border:`1px solid ${archetypeData.color}44` }}>
          <span className='font-display' style={{ fontSize:9, letterSpacing:2, color:archetypeData.color }}>{archetypeData.icon} {t(`profile.archetypes.${archetype}`).toUpperCase()}</span>
        </div>
      </div>
      <div style={{ margin:'0 16px 20px', background:'#111', borderRadius:14, border:'1px solid rgba(255,184,0,0.1)', padding:'16px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
          <div>
            <span className='font-display' style={{ fontSize:9, letterSpacing:2, color:'rgba(240,236,228,0.4)' }}>{t('profile.level').toUpperCase()}</span>
            <p className='font-display' style={{ fontSize:32, color:'#FFB800', lineHeight:1 }}>{level}</p>
          </div>
          <div style={{ textAlign:'right' }}>
            <span className='font-display' style={{ fontSize:8, letterSpacing:2, color:'rgba(240,236,228,0.3)' }}>SEASON 1 · THE FOUNDERS ERA</span>
            <p style={{ fontSize:12, color:'rgba(240,236,228,0.4)', marginTop:2 }}>{xp % xpForLevel} / {xpForLevel} XP</p>
          </div>
        </div>
        <div style={{ height:4, background:'rgba(255,255,255,0.06)', borderRadius:2, overflow:'hidden' }}>
          <div style={{ height:'100%', width:`${xpProgress}%`, background:'linear-gradient(90deg, #CC8800, #FFB800, #FFE566)', borderRadius:2, transition:'width 0.5s' }}/>
        </div>
      </div>
      <div style={{ display:'flex', gap:8, margin:'0 16px 20px' }}>
        {[
          { label:t('profile.wins'), val:profile?.wins ?? 0, color:'#4ade80' },
          { label:t('profile.deals'), val:profile?.deals_total ?? 0, color:'#60a5fa' },
          { label:t('profile.streak'), val:profile?.streak ?? 0, color:'#fb923c' },
          { label:t('profile.coins'), val:profile?.coins ?? 0, color:'#FFB800', img:true },
        ].map(s => (
          <div key={s.label} style={{ flex:1, background:'#111', borderRadius:10, border:'1px solid rgba(255,255,255,0.05)', padding:'10px 6px', textAlign:'center' }}>
            {s.img ? <Image src='/coin.png' alt='coin' width={20} height={20} style={{ margin:'0 auto 4px' }} /> : null}
            <p className='font-display' style={{ fontSize:s.img ? 14 : 20, color:s.color, marginBottom:4 }}>{s.val}</p>
            <p className='font-display' style={{ fontSize:7, letterSpacing:1, color:'rgba(240,236,228,0.3)' }}>{s.label.toUpperCase()}</p>
          </div>
        ))}
      </div>
      <div style={{ margin:'0 16px 20px', background:'#111', borderRadius:14, border:'1px solid rgba(255,184,0,0.15)', padding:'16px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
          <span className='font-display' style={{ fontSize:11, letterSpacing:2, color:'#FFB800' }}>{t('profile.battlePass').toUpperCase()}</span>
          <div style={{ padding:'3px 10px', borderRadius:10, background: profile?.battle_pass_premium ? 'rgba(255,184,0,0.15)' : 'rgba(255,255,255,0.05)', border:`1px solid ${profile?.battle_pass_premium ? 'rgba(255,184,0,0.3)' : 'rgba(255,255,255,0.08)'}` }}>
            <span className='font-display' style={{ fontSize:8, color: profile?.battle_pass_premium ? '#FFB800' : 'rgba(240,236,228,0.3)' }}>{profile?.battle_pass_premium ? t('profile.premiumTrack').toUpperCase() : t('profile.freeTrack').toUpperCase()}</span>
          </div>
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
          <span className='font-display' style={{ fontSize:9, color:'rgba(240,236,228,0.4)' }}>{t('profile.passLevel').toUpperCase()} {bpLevel}/30</span>
          <span className='font-display' style={{ fontSize:9, color:'rgba(240,236,228,0.3)' }}>{30 - bpLevel} {lang === 'de' ? 'verbleibend' : 'remaining'}</span>
        </div>
        <div style={{ height:6, background:'rgba(255,255,255,0.06)', borderRadius:3, overflow:'hidden' }}>
          <div style={{ height:'100%', width:`${bpProgress}%`, background:'linear-gradient(90deg, #CC8800, #FFB800, #FFE566)', borderRadius:3, transition:'width 0.5s' }}/>
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', marginTop:8 }}>
          {Array.from({length:10}, (_,i) => i * 3 + 3).map(lvl => (
            <div key={lvl} style={{ width:6, height:6, borderRadius:'50%', background: bpLevel >= lvl ? '#FFB800' : 'rgba(255,255,255,0.1)' }}/>
          ))}
        </div>
        <button onClick={() => router.push('/app/battlepass')} style={{ width:'100%', marginTop:14, padding:'10px', borderRadius:8, border:'1px solid rgba(255,184,0,0.2)', background:'rgba(255,184,0,0.06)', color:'#FFB800', fontFamily:'Cinzel, serif', fontSize:10, letterSpacing:2, cursor:'pointer' }}>
          {t('profile.battlePass').toUpperCase()} →
        </button>
      </div>
      <div style={{ margin:'0 16px 100px', background:'#111', borderRadius:14, border:'1px solid rgba(255,255,255,0.05)', overflow:'hidden' }}>
        <button onClick={() => router.push('/app/settings')} style={{ width:'100%', padding:'16px', background:'transparent', border:'none', borderBottom:'1px solid rgba(255,255,255,0.04)', cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span style={{ fontSize:15, color:'#f0ece4' }}>⚙️ {t('profile.settings')}</span>
          <span style={{ color:'rgba(240,236,228,0.3)' }}>›</span>
        </button>
        <button onClick={() => router.push('/app/discover')} style={{ width:'100%', padding:'16px', background:'transparent', border:'none', borderBottom:'1px solid rgba(255,255,255,0.04)', cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span style={{ fontSize:15, color:'#f0ece4' }}>🔍 {t('profile.discover')}</span>
          <span style={{ color:'rgba(240,236,228,0.3)' }}>›</span>
        </button>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'14px 16px', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
          <span style={{ fontSize:15, color:'#f0ece4' }}>🌐 {t('profile.language')}</span>
          <div style={{ display:'flex', background:'#1a1a1a', borderRadius:8, overflow:'hidden', border:'1px solid rgba(255,255,255,0.08)' }}>
            {(['de','en'] as const).map(l => (
              <button key={l} onClick={() => setLang(l)} style={{ padding:'6px 16px', border:'none', cursor:'pointer', background: lang === l ? 'linear-gradient(135deg, #CC8800, #FFB800)' : 'transparent', color: lang === l ? '#000' : 'rgba(240,236,228,0.4)', fontFamily:'Cinzel, serif', fontSize:11, fontWeight:700, letterSpacing:1, transition:'all 0.2s' }}>
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <button onClick={handleLogout} style={{ width:'100%', padding:'16px', background:'rgba(248,113,113,0.05)', border:'none', cursor:'pointer', color:'#f87171', fontFamily:'Cinzel, serif', fontSize:12, letterSpacing:2, textAlign:'center' }}>
          {t('auth.logout').toUpperCase()}
        </button>
      </div>
    </div>
  )
}