'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useLang } from '@/contexts/LanguageContext'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

const STATUS_COLORS: Record<string, string> = {
  open: '#60a5fa', pending: '#FFB800', active: '#4ade80',
  completed: 'rgba(240,236,228,0.3)', cancelled: '#f87171', frozen: '#a78bfa'
}
function getGreeting(t: (k: string) => string) {
  const h2 = new Date().getHours()
  if (h2 < 12) return t('home.greeting_morning')
  if (h2 < 18) return t('home.greeting_day')
  return t('home.greeting_evening')
}
function xpForLevel(level: number) { return level * 100 }
export default function HomePage() {
  const { profile } = useAuth()
  const { t } = useLang()
  const [deals, setDeals] = useState<any[]>([])
  const [pending, setPending] = useState<any[]>([])
  useEffect(() => {
    if (!profile) return
    supabase.from('bets')
      .select('*, creator:creator_id(username, display_name), opponent:opponent_id(username, display_name)')
      .or(`creator_id.eq.${profile.id},opponent_id.eq.${profile.id}`)
      .order('created_at', { ascending: false })
      .limit(4)
      .then(({ data }) => {
        setDeals(data || [])
        setPending((data || []).filter((d: any) => d.status === 'pending' && d.opponent_id === profile.id))
      })
  }, [profile])
  const netBalance = 0
  const isPositive = netBalance >= 0
  const activeDealCount = deals.filter(d => d.status === 'active').length
  const level = profile?.level ?? 1
  const xp = profile?.xp ?? 0
  const xpNeeded = xpForLevel(level)
  const xpProgress = Math.min((xp % xpNeeded) / xpNeeded * 100, 100)
  const initials = (profile?.display_name || profile?.username || 'U').slice(0, 2).toUpperCase()
  return (
    <div style={{ minHeight:'100dvh', background:'#060606', paddingTop:60 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'0 20px 16px' }}>
        <div>
          <p className='font-display' style={{ fontSize:18, color:'#f0ece4' }}>
            {getGreeting(t)}, <span style={{ color:'#FFB800' }}>{profile?.display_name?.split(' ')[0] || profile?.username}</span>
          </p>
          <p style={{ fontSize:12, color:'rgba(240,236,228,0.4)', marginTop:2 }}>
            {new Date().toLocaleDateString('de-DE', { weekday:'long', day:'numeric', month:'long' })}
          </p>
        </div>
        <div style={{ width:44, height:44, borderRadius:'50%', background:'linear-gradient(135deg, #CC8800, #FFB800)', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <span className='font-display' style={{ fontSize:14, color:'#000', fontWeight:700 }}>{initials}</span>
        </div>
      </div>
      <div style={{ margin:'0 16px 20px', borderRadius:16, overflow:'hidden', background: isPositive ? 'linear-gradient(135deg, rgba(255,184,0,0.1), rgba(255,184,0,0.03))' : 'linear-gradient(135deg, rgba(248,113,113,0.08), rgba(248,113,113,0.02))', border:`1px solid ${isPositive ? 'rgba(255,184,0,0.2)' : 'rgba(248,113,113,0.2)'}`, padding:'28px 24px', textAlign:'center' }}>
        <p className='font-display' style={{ fontSize:9, letterSpacing:4, color:'rgba(240,236,228,0.4)', marginBottom:8 }}>
          {t('home.balance').toUpperCase()}
        </p>
        <p className='font-display' style={{ fontSize:48, color: isPositive ? '#FFB800' : '#f87171', letterSpacing:-1, lineHeight:1 }}>
          {isPositive ? '+' : '-'}€{Math.abs(netBalance).toFixed(2)}
        </p>
        <p style={{ fontSize:12, color:'rgba(240,236,228,0.4)', marginTop:8, letterSpacing:1 }}>
          {activeDealCount > 0 ? `${activeDealCount} ${t("home.activeDeals")}` : t("home.noDeals")}
        </p>
      </div>
      <div style={{ display:'flex', gap:8, margin:'0 16px 20px' }}>
        {[
          { label: t('home.level'), value: String(profile?.level ?? 1) },
          { label: t('home.wins'), value: String(profile?.wins ?? 0) },
          { label: t('home.xpToday'), value: String(profile?.xp ?? 0) },
        ].map(stat => (
          <div key={stat.label} style={{ flex:1, background:'#111', borderRadius:12, border:'1px solid rgba(255,184,0,0.08)', padding:'12px 8px', textAlign:'center' }}>
            <p className='font-display' style={{ fontSize:9, letterSpacing:1, color:'rgba(240,236,228,0.4)', marginBottom:4 }}>{stat.label.toUpperCase()}</p>
            <p className='font-display' style={{ fontSize:20, color:'#FFB800' }}>{stat.value}</p>
          </div>
        ))}
      </div>
      <div style={{ margin:'0 16px 24px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
          <span className='font-display' style={{ fontSize:8, letterSpacing:2, color:'rgba(240,236,228,0.3)' }}>XP</span>
          <span className='font-display' style={{ fontSize:8, color:'rgba(240,236,228,0.3)' }}>{xp % xpForLevel(level)}/{xpForLevel(level)}</span>
        </div>
        <div style={{ height:3, background:'rgba(255,255,255,0.06)', borderRadius:2, overflow:'hidden' }}>
          <div style={{ height:'100%', width:`${xpProgress}%`, background:'linear-gradient(90deg, #CC8800, #FFB800)', borderRadius:2, transition:'width 0.5s ease' }}/>
        </div>
      </div>
      <div style={{ padding:'0 16px 24px' }}>
        <Link href='/app/deals' style={{ display:'block', textDecoration:'none' }}>
          <button style={{ width:'100%', padding:'18px', borderRadius:14, border:'none', cursor:'pointer', background:'linear-gradient(135deg, #CC8800, #FFB800, #FFE566)', color:'#000', fontFamily:'Cinzel, serif', fontSize:13, fontWeight:700, letterSpacing:3, display:'flex', alignItems:'center', justifyContent:'center', gap:10 }}>
            <span>🤝</span> {t('home.newDeal').toUpperCase()}
          </button>
        </Link>
      </div>
      {pending.length > 0 && (
        <div style={{ padding:'0 16px 24px' }}>
          <p className='font-display' style={{ fontSize:9, letterSpacing:3, color:'rgba(240,236,228,0.4)', marginBottom:12 }}>{t('home.openRequests').toUpperCase()}</p>
          {pending.slice(0,2).map((d: any) => (
            <Link key={d.id} href={`/app/deals/${d.id}`} style={{ textDecoration:'none' }}>
              <div style={{ background:'rgba(255,184,0,0.05)', border:'1px solid rgba(255,184,0,0.2)', borderRadius:12, padding:'14px 16px', marginBottom:8, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <p style={{ color:'#f0ece4', fontSize:14, fontWeight:600 }}>{d.title}</p>
                  <p style={{ color:'rgba(240,236,228,0.5)', fontSize:12, marginTop:2 }}>@{d.creator?.username} {t('home.challenged')}</p>
                </div>
                <span style={{ color:'#FFB800', fontSize:20 }}>→</span>
              </div>
            </Link>
          ))}
        </div>
      )}
      {deals.length > 0 ? (
        <div style={{ padding:'0 16px 32px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
            <p className='font-display' style={{ fontSize:9, letterSpacing:3, color:'rgba(240,236,228,0.4)' }}>{t('home.myDeals').toUpperCase()}</p>
            <Link href='/app/deals' style={{ fontSize:12, color:'#FFB800', textDecoration:'none' }}>{t('home.seeAll')}</Link>
          </div>
          <div style={{ borderRadius:12, border:'1px solid rgba(255,255,255,0.05)', overflow:'hidden' }}>
            {deals.map((d: any, i) => {
              const sc = STATUS_COLORS[d.status] || STATUS_COLORS.open
              return (
                <Link key={d.id} href={`/app/deals/${d.id}`} style={{ textDecoration:'none' }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 16px', background:'#111', borderBottom: i < deals.length-1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:12, flex:1 }}>
                      <div style={{ width:6, height:6, borderRadius:'50%', background:sc, flexShrink:0 }}/>
                      <div>
                        <p style={{ color:'#f0ece4', fontSize:14 }}>{d.title}</p>
                        <p style={{ color:'rgba(240,236,228,0.4)', fontSize:12, marginTop:2 }}>vs @{d.opponent?.username || '?'} · {d.stake || d.creator_amount || '—'}</p>
                      </div>
                    </div>
                    <span className='font-display' style={{ fontSize:8, letterSpacing:1, color:sc }}>
                      {d.status?.toUpperCase()}
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      ) : (
        <div style={{ textAlign:'center', padding:'32px 32px 64px' }}>
          <div style={{ fontSize:56, marginBottom:16 }}>🤝</div>
          <h3 className='font-display' style={{ fontSize:20, color:'#f0ece4', marginBottom:8 }}>{t('home.noDeals')}</h3>
          <p style={{ color:'rgba(240,236,228,0.4)', fontSize:15, lineHeight:1.6, whiteSpace:'pre-line', marginBottom:28 }}>{t('home.noDealsText')}</p>
          <Link href='/app/deals' style={{ textDecoration:'none' }}>
            <button style={{ padding:'16px 40px', borderRadius:12, border:'none', cursor:'pointer', background:'linear-gradient(135deg, #CC8800, #FFB800)', color:'#000', fontFamily:'Cinzel, serif', fontSize:11, fontWeight:700, letterSpacing:3 }}>
              {t('home.startNow').toUpperCase()}
            </button>
          </Link>
        </div>
      )}
    </div>
  )
}