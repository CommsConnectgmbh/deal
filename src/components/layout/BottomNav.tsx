'use client'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { Home, Zap, Trophy, User, Plus } from 'lucide-react'

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
    <nav style={{
      position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
      width: '100%', maxWidth: 430,
      background: 'var(--bg-deepest)', backdropFilter: 'blur(20px)',
      borderTop: '1px solid var(--border-subtle)',
      display: 'flex', alignItems: 'flex-end',
      paddingBottom: 'env(safe-area-inset-bottom)',
      zIndex: 100, overflow: 'visible',
    }}>
      {slots.map((slot, idx) => {
        if (slot === 'fab') {
          return (
            <div key="fab" style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
              <motion.button
                onClick={() => router.push(createHref)}
                whileTap={{ scale: 0.92 }}
                whileHover={{ scale: 1.04 }}
                transition={{ type: 'spring', stiffness: 400, damping: 18 }}
                style={{
                  position: 'relative',
                  width: 60, height: 60, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #1a1a1a, #2a2a2a, #1a1a1a)',
                  border: '2px solid rgba(245, 158, 11, 0.35)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.6), 0 0 16px rgba(245, 158, 11, 0.25)',
                  padding: 0,
                  marginTop: -20, marginBottom: 4,
                  flexShrink: 0,
                }}
                aria-label="Create"
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
                  border: '2px solid var(--bg-deepest)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--text-inverse)',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
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
            style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              padding: '10px 0', textDecoration: 'none', gap: 3,
              position: 'relative',
            }}
          >
            <motion.div
              animate={{ scale: active ? 1.08 : 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 20 }}
              style={{
                display: 'inline-flex',
                color: active ? 'var(--gold-primary)' : 'var(--text-muted)',
                transition: 'color 0.2s',
              }}
            >
              <Icon size={22} strokeWidth={active ? 2.4 : 2} />
            </motion.div>
            <span className="font-display" style={{
              fontSize: 9, letterSpacing: 1,
              color: active ? 'var(--gold-primary)' : 'var(--text-muted)',
              transition: 'color 0.2s',
            }}>
              {slot.label}
            </span>
            {active && (
              <motion.span
                layoutId="bottom-nav-dot"
                style={{
                  position: 'absolute',
                  bottom: 4,
                  width: 4, height: 4, borderRadius: '50%',
                  background: 'var(--gold-primary)',
                }}
                transition={{ type: 'spring', stiffness: 400, damping: 28 }}
              />
            )}
          </Link>
        )
      })}
    </nav>
  )
}
