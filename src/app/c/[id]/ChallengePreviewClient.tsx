'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface ChallengeData {
  id: string
  title: string
  description: string | null
  amount: string
  status: string
  isOpen: boolean
  deadline: string | null
  creator: { username: string; displayName: string; reliabilityScore: number | null } | null
  opponent: { username: string; displayName: string } | null
}

export default function ChallengePreviewClient({ challenge }: { challenge: ChallengeData }) {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState('')

  // Eingeloggte User direkt in die App leiten
  useEffect(() => {
    supabase.auth.getSession().then(({ data }: any) => {
      if (data.session) {
        if (challenge.isOpen) {
          // Direkt zur Challenge mit Join-Intent
          router.replace(`/app/deals/${challenge.id}?action=join`)
        } else {
          router.replace(`/app/deals/${challenge.id}`)
        }
      } else {
        setChecking(false)
      }
    })
  }, [challenge.id, challenge.isOpen, router])

  if (checking) {
    return (
      <div style={{
        minHeight: '100vh', background: 'var(--bg-base)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          width: 32, height: 32, border: '3px solid var(--gold-glow)',
          borderTopColor: 'var(--gold-primary)', borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  const creatorName = challenge.creator?.displayName || challenge.creator?.username || '???'

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg-base)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '24px 16px',
    }}>
      {/* Logo */}
      <div style={{ marginBottom: 32, textAlign: 'center' }}>
        <h1 style={{
          fontFamily: 'Oswald, sans-serif', fontSize: 22, fontWeight: 800,
          letterSpacing: 3, color: 'var(--gold-primary)',
        }}>
          DEALBUDDY
        </h1>
        <p style={{
          fontSize: 10, letterSpacing: 2, color: 'var(--text-muted)',
          fontFamily: 'Oswald, sans-serif', marginTop: 2,
        }}>
          COMPETE · WIN · REIGN
        </p>
      </div>

      {/* Challenge Card */}
      <div style={{
        width: '100%', maxWidth: 400, borderRadius: 16,
        overflow: 'hidden', border: '1px solid var(--border-subtle)',
        background: 'var(--bg-elevated)',
        boxShadow: '0 8px 32px var(--gold-subtle)',
      }}>
        {/* Header Badge */}
        <div style={{
          padding: '10px 16px', textAlign: 'center',
          background: 'linear-gradient(135deg, var(--gold-subtle), transparent)',
          borderBottom: '1px solid var(--border-subtle)',
        }}>
          <span style={{
            fontFamily: 'Oswald, sans-serif', fontSize: 11, fontWeight: 700,
            color: 'var(--gold-primary)', letterSpacing: 2,
          }}>
            {challenge.isOpen ? 'OFFENE CHALLENGE' : challenge.status.toUpperCase()}
          </span>
        </div>

        {/* Title */}
        <div style={{ padding: '20px 20px 8px', textAlign: 'center' }}>
          <h2 style={{
            fontFamily: 'Oswald, sans-serif', fontSize: 22, fontWeight: 800,
            color: 'var(--text-primary)', letterSpacing: 1.5,
            textTransform: 'uppercase', lineHeight: 1.3, margin: 0,
          }}>
            {challenge.title}
          </h2>
          {challenge.description && (
            <p style={{
              fontFamily: 'Georgia, serif', fontSize: 14, color: 'var(--text-secondary)',
              marginTop: 8, lineHeight: 1.5,
            }}>
              {challenge.description}
            </p>
          )}
        </div>

        {/* Challenger Info */}
        <div style={{
          padding: '12px 20px', textAlign: 'center',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--gold-subtle), transparent)',
            border: '1px solid var(--gold-glow)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16,
          }}>
            ⚔️
          </div>
          <div>
            <span style={{
              fontFamily: 'Oswald, sans-serif', fontSize: 14, fontWeight: 600,
              color: 'var(--text-primary)', letterSpacing: 0.5,
            }}>
              @{challenge.creator?.username}
            </span>
            <span style={{
              fontFamily: 'Oswald, sans-serif', fontSize: 11,
              color: 'var(--gold-primary)', marginLeft: 6,
            }}>
              fordert dich heraus!
            </span>
          </div>
        </div>

        {/* Stats Row */}
        <div style={{
          display: 'flex', gap: 8, padding: '8px 20px 16px',
          justifyContent: 'center', flexWrap: 'wrap',
        }}>
          <div style={{
            padding: '6px 14px', borderRadius: 20,
            background: 'var(--gold-subtle)',
            border: '1px solid var(--gold-glow)',
          }}>
            <span style={{
              fontFamily: 'Oswald, sans-serif', fontSize: 12, fontWeight: 600,
              color: 'var(--gold-primary)', letterSpacing: 0.5,
            }}>
              🏆 {challenge.amount}
            </span>
          </div>
          {challenge.deadline && (
            <div style={{
              padding: '6px 14px', borderRadius: 20,
              background: 'var(--bg-overlay)',
              border: '1px solid var(--border-subtle)',
            }}>
              <span style={{
                fontFamily: 'Oswald, sans-serif', fontSize: 12,
                color: 'var(--text-secondary)', letterSpacing: 0.5,
              }}>
                ⏰ {challenge.deadline}
              </span>
            </div>
          )}
        </div>

        {error && (
          <div style={{ padding: '0 20px 12px', textAlign: 'center' }}>
            <span style={{ fontSize: 13, color: '#EF4444' }}>{error}</span>
          </div>
        )}

        {/* CTA Buttons */}
        <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {challenge.isOpen ? (
            <button
              onClick={() => router.push(`/auth/register?redirect=/app/deals/${challenge.id}?action=join`)}
              disabled={joining}
              style={{
                width: '100%', padding: 16, borderRadius: 12,
                border: 'none', cursor: 'pointer',
                background: 'linear-gradient(135deg, var(--gold-dim), var(--gold-primary), var(--gold-bright))',
                color: 'var(--text-inverse)',
                fontFamily: 'Oswald, sans-serif', fontSize: 14,
                fontWeight: 700, letterSpacing: 2,
                boxShadow: '0 4px 20px var(--gold-glow)',
                opacity: joining ? 0.6 : 1,
              }}
            >
              CHALLENGE ANNEHMEN
            </button>
          ) : (
            <button
              onClick={() => router.push(`/auth/login?redirect=/app/deals/${challenge.id}`)}
              style={{
                width: '100%', padding: 16, borderRadius: 12,
                border: 'none', cursor: 'pointer',
                background: 'linear-gradient(135deg, var(--gold-dim), var(--gold-primary))',
                color: 'var(--text-inverse)',
                fontFamily: 'Oswald, sans-serif', fontSize: 13,
                fontWeight: 700, letterSpacing: 2,
              }}
            >
              AUF DEALBUDDY ANSEHEN
            </button>
          )}

          <button
            onClick={() => router.push('/auth/register')}
            style={{
              width: '100%', padding: 12, borderRadius: 12,
              border: '1px solid var(--gold-glow)',
              background: 'transparent', cursor: 'pointer',
              color: 'var(--gold-primary)',
              fontFamily: 'Oswald, sans-serif', fontSize: 12,
              fontWeight: 600, letterSpacing: 1.5,
            }}
          >
            KOSTENLOS REGISTRIEREN
          </button>
        </div>
      </div>

      {/* In der App öffnen */}
      <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, width: '100%', maxWidth: 400 }}>
        <button
          onClick={() => {
            const deepLink = `dealbuddy://c/${challenge.id}`
            const universalLink = `https://dealbuddy.app/c/${challenge.id}`
            // Versuche zuerst den Custom Scheme, dann Universal Link
            const timeout = setTimeout(() => {
              // App nicht installiert -> App Store Fallback
              window.location.href = /android/i.test(navigator.userAgent)
                ? 'https://play.google.com/store/apps/details?id=de.dealbuddy.app'
                : 'https://apps.apple.com/app/dealbuddy/id0000000000'
            }, 1500)
            window.addEventListener('blur', () => clearTimeout(timeout), { once: true })
            window.location.href = deepLink
          }}
          style={{
            width: '100%', padding: 14, borderRadius: 12,
            border: '1px solid var(--gold-glow)',
            background: 'var(--gold-subtle)',
            cursor: 'pointer',
            color: 'var(--gold-primary)',
            fontFamily: 'Oswald, sans-serif', fontSize: 13,
            fontWeight: 700, letterSpacing: 2,
          }}
        >
          IN DER APP ÖFFNEN
        </button>
        <p style={{
          fontSize: 11, color: 'var(--text-muted)',
          letterSpacing: 1, fontFamily: 'Oswald, sans-serif',
        }}>
          Auch als App für iOS & Android verfügbar
        </p>
      </div>
    </div>
  )
}
