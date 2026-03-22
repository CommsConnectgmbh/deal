'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const STATUS_COLORS: Record<string, string> = {
  open: '#F59E0B', pending: '#F97316', active: '#22C55E',
  pending_confirmation: '#F97316', completed: '#3B82F6',
  cancelled: '#EF4444', disputed: '#EF4444', frozen: '#6B6E76',
}

interface DealPreview {
  id: string
  title: string
  stake: string
  status: string
  statusLabel: string
  deadline: string | null
  createdAt: string
  creator: { username: string; displayName: string } | null
  opponent: { username: string; displayName: string } | null
  winnerName: string | null
}

export default function DealPreviewClient({ deal }: { deal: DealPreview }) {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const sc = STATUS_COLORS[deal.status] || '#F59E0B'

  // If logged in, redirect to app deal page
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        router.replace(`/app/deals/${deal.id}`)
      } else {
        setChecking(false)
      }
    })
  }, [deal.id, router])

  if (checking) {
    return (
      <div style={{
        minHeight: '100vh', background: '#080808',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          width: 32, height: 32, border: '3px solid rgba(245,158,11,0.2)',
          borderTopColor: '#F59E0B', borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  const creatorName = deal.creator?.displayName || deal.creator?.username || '???'
  const opponentName = deal.opponent?.displayName || deal.opponent?.username || null

  const deadlineText = deal.deadline
    ? new Date(deal.deadline).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' })
    : null

  return (
    <div style={{
      minHeight: '100vh', background: '#080808',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '24px 16px',
    }}>
      {/* Logo */}
      <div style={{
        marginBottom: 32, textAlign: 'center',
      }}>
        <h1 style={{
          fontFamily: 'Oswald, sans-serif', fontSize: 22, fontWeight: 800,
          letterSpacing: 3, color: '#F59E0B',
        }}>
          DEALBUDDY
        </h1>
        <p style={{
          fontSize: 10, letterSpacing: 2, color: '#6B6E76',
          fontFamily: 'Oswald, sans-serif', marginTop: 2,
        }}>
          COMPETE · WIN · REIGN
        </p>
      </div>

      {/* Deal Card */}
      <div style={{
        width: '100%', maxWidth: 400, borderRadius: 16,
        overflow: 'hidden', border: `1px solid ${sc}30`,
        background: '#16171B',
        boxShadow: `0 8px 32px ${sc}15`,
      }}>
        {/* Status Bar */}
        <div style={{
          padding: '10px 16px', textAlign: 'center',
          background: `linear-gradient(135deg, ${sc}20, ${sc}08)`,
          borderBottom: `1px solid ${sc}20`,
        }}>
          <span style={{
            fontFamily: 'Oswald, sans-serif', fontSize: 11, fontWeight: 700,
            color: sc, letterSpacing: 2,
          }}>
            {deal.statusLabel}
          </span>
        </div>

        {/* Title */}
        <div style={{ padding: '20px 20px 12px', textAlign: 'center' }}>
          <h2 style={{
            fontFamily: 'Oswald, sans-serif', fontSize: 20, fontWeight: 800,
            color: '#F2F3F5', letterSpacing: 1.5,
            textTransform: 'uppercase', lineHeight: 1.3,
          }}>
            {deal.title}
          </h2>
        </div>

        {/* VS Section */}
        <div style={{
          padding: '8px 20px 16px', textAlign: 'center',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
          }}>
            {/* Creator */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: 'linear-gradient(135deg, #F59E0B20, #F59E0B08)',
                border: '1px solid #F59E0B30',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14,
              }}>
                ⚔️
              </div>
              <span style={{
                fontFamily: 'Oswald, sans-serif', fontSize: 13, fontWeight: 600,
                color: '#F2F3F5', letterSpacing: 0.5,
              }}>
                @{deal.creator?.username || '???'}
              </span>
            </div>

            {opponentName ? (
              <>
                <span style={{
                  fontFamily: 'Oswald, sans-serif', fontSize: 10,
                  color: '#6B6E76', letterSpacing: 2,
                }}>VS</span>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <span style={{
                    fontFamily: 'Oswald, sans-serif', fontSize: 13, fontWeight: 600,
                    color: '#F2F3F5', letterSpacing: 0.5,
                  }}>
                    @{deal.opponent?.username || '???'}
                  </span>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: 'linear-gradient(135deg, #EF444420, #EF444408)',
                    border: '1px solid #EF444430',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14,
                  }}>
                    🛡️
                  </div>
                </div>
              </>
            ) : (
              <span style={{
                fontFamily: 'Oswald, sans-serif', fontSize: 11,
                color: '#F59E0B', letterSpacing: 1,
              }}>
                · Gegner gesucht!
              </span>
            )}
          </div>
        </div>

        {/* Details */}
        <div style={{
          display: 'flex', gap: 8, padding: '0 20px 16px',
          justifyContent: 'center', flexWrap: 'wrap',
        }}>
          {/* Stake */}
          <div style={{
            padding: '6px 12px', borderRadius: 20,
            background: 'rgba(245,158,11,0.08)',
            border: '1px solid rgba(245,158,11,0.15)',
          }}>
            <span style={{
              fontFamily: 'Oswald, sans-serif', fontSize: 11, fontWeight: 600,
              color: '#F59E0B', letterSpacing: 0.5,
            }}>
              🏆 {deal.stake}
            </span>
          </div>

          {/* Deadline */}
          {deadlineText && (
            <div style={{
              padding: '6px 12px', borderRadius: 20,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}>
              <span style={{
                fontFamily: 'Oswald, sans-serif', fontSize: 11,
                color: '#A1A3A9', letterSpacing: 0.5,
              }}>
                ⏰ {deadlineText}
              </span>
            </div>
          )}
        </div>

        {/* Winner Banner (completed deals) */}
        {deal.winnerName && (
          <div style={{
            margin: '0 20px 16px', padding: '12px 16px',
            borderRadius: 12,
            background: 'linear-gradient(135deg, rgba(34,197,94,0.12), rgba(34,197,94,0.04))',
            border: '1px solid rgba(34,197,94,0.2)',
            textAlign: 'center',
          }}>
            <span style={{
              fontFamily: 'Oswald, sans-serif', fontSize: 12, fontWeight: 700,
              color: '#22C55E', letterSpacing: 1.5,
            }}>
              🏆 GEWINNER: {deal.winnerName.toUpperCase()}
            </span>
          </div>
        )}

        {/* CTA */}
        <div style={{ padding: '0 20px 20px' }}>
          <button
            onClick={() => router.push('/auth/login?redirect=/app/deals/' + deal.id)}
            style={{
              width: '100%', padding: 16, borderRadius: 12,
              border: 'none', cursor: 'pointer',
              background: 'linear-gradient(135deg, #B45309, #F59E0B)',
              color: '#0F0F11',
              fontFamily: 'Oswald, sans-serif', fontSize: 13,
              fontWeight: 700, letterSpacing: 2,
              boxShadow: '0 4px 20px rgba(245,158,11,0.25)',
              transition: 'transform 0.15s, box-shadow 0.15s',
            }}
          >
            AUF DEALBUDDY ÖFFNEN
          </button>
        </div>
      </div>

      {/* Footer */}
      <p style={{
        marginTop: 24, fontSize: 11, color: '#6B6E76',
        letterSpacing: 1, fontFamily: 'Oswald, sans-serif',
      }}>
        Jetzt kostenlos registrieren und mitmachen!
      </p>
    </div>
  )
}
