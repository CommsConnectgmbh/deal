'use client'
import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useLang } from '@/contexts/LanguageContext'
import Link from 'next/link'

const TABS = [
  { href: '/app/home',    icon: '🏠', key: 'nav.home'    },
  { href: '/app/deals',   icon: '🤝', key: 'nav.deals'   },
  { href: '/app/rivals',  icon: '⚡', key: 'nav.rivals'  },
  { href: '/app/profile', icon: '👑', key: 'nav.profile'  },
  { href: '/app/shop',    icon: '💎', key: 'nav.shop'    },
]

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const { t } = useLang()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!loading && !user) router.replace('/auth/login')
  }, [user, loading, router])

  if (loading || !user) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100dvh', background:'#060606' }}>
      <div style={{ width:40, height:40, border:'2px solid transparent', borderTopColor:'#FFB800', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  return (
    <div style={{ maxWidth:430, margin:'0 auto', minHeight:'100dvh', background:'#060606', display:'flex', flexDirection:'column', position:'relative' }}>
      {/* Content */}
      <div style={{ flex:1, overflowY:'auto', paddingBottom:80 }}>
        {children}
      </div>

      {/* Bottom Tab Bar */}
      <nav style={{ position:'fixed', bottom:0, left:'50%', transform:'translateX(-50%)', width:'100%', maxWidth:430, background:'rgba(6,6,6,0.95)', backdropFilter:'blur(20px)', borderTop:'1px solid rgba(255,184,0,0.1)', display:'flex', paddingBottom:'env(safe-area-inset-bottom)', zIndex:100 }}>
        {TABS.map(tab => {
          const active = pathname === tab.href
          return (
            <Link key={tab.href} href={tab.href} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'10px 0', textDecoration:'none', gap:4, position:'relative' }}>
              <span style={{ fontSize:20, opacity: active ? 1 : 0.4 }}>{tab.icon}</span>
              <span className="font-display" style={{ fontSize:8, letterSpacing:1, color: active ? '#FFB800' : 'rgba(240,236,228,0.3)', transition:'color 0.2s' }}>
                {t(tab.key).toUpperCase()}
              </span>
              {active && <div style={{ width:4, height:4, borderRadius:2, background:'#FFB800', position:'absolute', bottom:8 }}/>}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
