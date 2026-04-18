'use client'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { Home, Zap, Trophy, User, Bell, MessageCircle, Plus, Settings } from 'lucide-react'
import type { BottomNavTab } from './BottomNav'
import { useLang } from '@/contexts/LanguageContext'

const ICONS = { home: Home, blitz: Zap, tippen: Trophy, profile: User } as const

interface Props {
  tabs: BottomNavTab[]
  createHref?: string
  unreadMsgs: number
  unreadNotifs: number
  wins: number
  losses: number
  level: number
  globalRank: number
  scoreDisplay: string
  scoreColorVal: string
}

export default function DesktopSidebar({
  tabs, createHref = '/app/deals/create',
  unreadMsgs, unreadNotifs,
  wins, losses, level, globalRank, scoreDisplay, scoreColorVal,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const { t } = useLang()

  const isActive = (href: string) => {
    if (href === '/app/profile') {
      return pathname === '/app/profile'
        || pathname === '/app/profile/followers'
        || pathname === '/app/profile/following'
    }
    return pathname === href || pathname.startsWith(href + '/')
  }

  const NavLink = ({ href, label, Icon, badge }: { href: string; label: string; Icon: React.ComponentType<{ size?: number; strokeWidth?: number }>; badge?: number }) => {
    const active = isActive(href)
    return (
      <Link href={href} prefetch={false} style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '10px 14px', borderRadius: 10, textDecoration: 'none',
        background: active ? 'var(--gold-subtle)' : 'transparent',
        color: active ? 'var(--gold-primary)' : 'var(--text-primary)',
        fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700,
        letterSpacing: 1, transition: 'background 0.15s',
        position: 'relative',
      }}>
        <span style={{ position: 'relative', display: 'inline-flex' }}>
          <Icon size={22} strokeWidth={active ? 2.4 : 2} />
          {badge && badge > 0 ? (
            <span style={{
              position: 'absolute', top: -4, right: -6,
              minWidth: 14, height: 14, borderRadius: 7,
              background: 'var(--gold-primary)', color: 'var(--text-inverse)',
              fontSize: 8, fontWeight: 800, display: 'flex',
              alignItems: 'center', justifyContent: 'center', padding: '0 3px',
            }}>{badge > 9 ? '9+' : badge}</span>
          ) : null}
        </span>
        {label}
      </Link>
    )
  }

  return (
    <aside className="dt-only dt-flex" style={{
      position: 'fixed', top: 0, left: 0, bottom: 0,
      width: 245, padding: '20px 12px',
      background: 'var(--glass-bg)',
      backdropFilter: 'blur(24px) saturate(180%)',
      WebkitBackdropFilter: 'blur(24px) saturate(180%)',
      borderRight: '1px solid var(--glass-border)',
      flexDirection: 'column', gap: 4,
      zIndex: 100,
    }}>
      {/* Logo */}
      <Link href="/app/home" style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '4px 14px 22px', textDecoration: 'none',
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: 'var(--gold-primary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 14px rgba(245,158,11,0.35)',
          flexShrink: 0,
        }}>
          <img src="/logo.png" alt="" style={{ width: 30, height: 30, borderRadius: 6 }} />
        </div>
        <span style={{
          fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800,
          color: 'var(--text-primary)', letterSpacing: 1.2,
        }}>DealBuddy</span>
      </Link>

      {/* Stats strip — clickable → leaderboard */}
      <Link href="/app/leaderboard" style={{
        display: 'flex', justifyContent: 'space-between',
        padding: '10px 14px 14px', marginBottom: 6,
        borderBottom: '1px solid var(--border-subtle)',
        textDecoration: 'none',
      }}>
        <div style={{ textAlign: 'left' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: 'var(--gold-primary)' }}>
            {wins}<span style={{ color: 'var(--text-muted)', fontSize: 10 }}>/</span>{losses}
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 6, letterSpacing: 1.5, color: 'var(--text-muted)' }}>W/L</div>
        </div>
        <div style={{ textAlign: 'left' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: 'var(--gold-primary)' }}>{level}</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 6, letterSpacing: 1.5, color: 'var(--text-muted)' }}>{t('nav.level')}</div>
        </div>
        <div style={{ textAlign: 'left' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>#{globalRank || '\u2013'}</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 6, letterSpacing: 1.5, color: 'var(--text-muted)' }}>{t('nav.rank')}</div>
        </div>
        <div style={{ textAlign: 'left' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: scoreColorVal }}>{scoreDisplay}</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 6, letterSpacing: 1.5, color: 'var(--text-muted)' }}>{t('nav.score')}</div>
        </div>
      </Link>

      {/* Primary nav */}
      {tabs.map(tab => {
        const Icon = ICONS[tab.key as keyof typeof ICONS]
        return <NavLink key={tab.href} href={tab.href} label={tab.label} Icon={Icon} />
      })}

      {/* Create — gold accent */}
      <button onClick={() => router.push(createHref)} style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '10px 14px', borderRadius: 10, marginTop: 4,
        background: 'transparent', border: 'none', cursor: 'pointer',
        color: 'var(--gold-primary)', fontFamily: 'var(--font-display)',
        fontSize: 13, fontWeight: 800, letterSpacing: 1, textAlign: 'left',
      }}>
        <Plus size={22} strokeWidth={2.5} />
        {t('nav.create') || 'Erstellen'}
      </button>

      {/* Communication */}
      <NavLink href="/app/notifications" label={t('nav.notifications') || 'Benachrichtigungen'} Icon={Bell} badge={unreadNotifs} />
      <NavLink href="/app/chat" label={t('nav.messages') || 'Nachrichten'} Icon={MessageCircle} badge={unreadMsgs} />

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Settings at bottom */}
      <Link href="/app/settings" style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '10px 14px', borderRadius: 10, textDecoration: 'none',
        color: 'var(--text-secondary)', fontFamily: 'var(--font-display)',
        fontSize: 12, fontWeight: 700, letterSpacing: 1,
      }}>
        <Settings size={20} strokeWidth={2} />
        {t('nav.settings') || 'Einstellungen'}
      </Link>
    </aside>
  )
}
