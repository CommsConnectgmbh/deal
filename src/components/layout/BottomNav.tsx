'use client'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { Home, Zap, Trophy, User, Plus } from 'lucide-react'
import type { CSSProperties } from 'react'
import { useHideOnScroll } from '@/lib/cc/useHideOnScroll'

type IconKey = 'home' | 'blitz' | 'tippen' | 'profile'

const ICONS: Record<IconKey, React.ComponentType<{ size?: number; strokeWidth?: number }>> = {
  home: Home,
  blitz: Zap,
  tippen: Trophy,
  profile: User,
}

export interface BottomNavTab {
  key: IconKey
  href: string
  label: string
}

interface Props {
  tabs: BottomNavTab[]
  createHref?: string
}

export default function BottomNav({ tabs, createHref = '/app/deals/create' }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  // The app scrolls inside `.app-content` (body is overflow:hidden), so the
  // hide-on-scroll listener must attach there — not to the window.
  const hidden = useHideOnScroll({
    target: () => document.querySelector<HTMLElement>('.app-content'),
    getScrollTop: () =>
      document.querySelector<HTMLElement>('.app-content')?.scrollTop ?? 0,
  })

  const isActive = (href: string) => {
    if (href === '/app/profile') {
      return pathname === '/app/profile'
        || pathname === '/app/profile/followers'
        || pathname === '/app/profile/following'
    }
    return pathname === href || pathname.startsWith(href + '/')
  }

  const slots: (BottomNavTab | 'fab')[] = [
    tabs[0],
    tabs[1],
    'fab',
    tabs[2],
    tabs[3],
  ]

  return (
    <nav
      data-theme="light"
      className={`ccnav${hidden ? ' ccnav--hidden' : ''}`}
      style={{
        // DealBuddy gold accent drives active tabs; surface stays light glass.
        ['--ccnav-accent' as string]: 'var(--gold-primary)',
        ['--ccnav-ink' as string]: 'var(--text-muted)',
      } as CSSProperties}
      aria-label="Hauptnavigation"
    >
      <div className="ccnav__row">
        {slots.map((slot) => {
          if (slot === 'fab') {
            return (
              <div key="fab" className="ccnav__fab-slot">
                <motion.button
                  onClick={() => router.push(createHref)}
                  whileTap={{ scale: 0.92 }}
                  whileHover={{ scale: 1.04 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 18 }}
                  style={{
                    position: 'relative',
                    width: 60, height: 60, borderRadius: '50%',
                    background: '#0F0F11',
                    border: '2px solid var(--gold-glow)', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: 'var(--shadow-md), var(--shadow-gold)',
                    padding: 0,
                    marginTop: -20, marginBottom: 4,
                    flexShrink: 0,
                  }}
                  aria-label="Neuer Tipp"
                >
                  <img
                    src="/logo.png"
                    alt=""
                    style={{
                      width: 54, height: 54, objectFit: 'contain',
                      borderRadius: '50%',
                    }}
                  />
                  <span style={{
                    position: 'absolute',
                    bottom: -2, right: -2,
                    width: 22, height: 22, borderRadius: '50%',
                    background: 'var(--gold-primary)',
                    border: '2px solid var(--bg-base)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--text-inverse)',
                    boxShadow: 'var(--shadow-sm)',
                  }}>
                    <Plus size={12} strokeWidth={3} />
                  </span>
                </motion.button>
              </div>
            )
          }

          const Icon = ICONS[slot.key]
          const active = isActive(slot.href)

          return (
            <Link
              key={slot.href}
              href={slot.href}
              prefetch={false}
              className={`ccnav__tab${active ? ' is-active' : ''}`}
            >
              <motion.div
                animate={{ scale: active ? 1.08 : 1 }}
                transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                style={{ display: 'inline-flex' }}
              >
                <Icon size={22} strokeWidth={active ? 2.4 : 2} />
              </motion.div>
              <span className="font-display" style={{ fontSize: 9, letterSpacing: 1 }}>
                {slot.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
