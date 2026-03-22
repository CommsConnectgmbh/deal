'use client'
import { useAuth } from '@/contexts/AuthContext'
import { useLang } from '@/contexts/LanguageContext'
import ProfileImage from '@/components/ProfileImage'
import type { CreateDealState } from '@/lib/createDealReducer'
import { CATEGORIES } from '@/lib/createDealReducer'

interface Props {
  state: CreateDealState
}

export default function DealPreviewCard({ state }: Props) {
  const { profile } = useAuth()
  const { t, lang } = useLang()
  const cat = CATEGORIES.find(c => c.value === state.category)

  return (
    <div style={{
      borderRadius: 16, overflow: 'hidden',
      border: '1px solid var(--border-subtle)',
      background: 'var(--bg-surface)',
    }}>
      {/* Arena preview */}
      <div style={{
        position: 'relative', width: '100%',
        aspectRatio: '16 / 10',
        backgroundImage: 'url(/deal.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: 'rgba(0,0,0,0.15)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: '40%',
          background: 'linear-gradient(to bottom, transparent 0%, rgba(17,17,17,0.9) 100%)',
          pointerEvents: 'none',
        }} />

        {/* Fighters */}
        <div style={{
          position: 'relative', zIndex: 2,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          height: '100%', padding: '0 10%',
        }}>
          {/* Creator */}
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', gap: 6,
          }}>
            <ProfileImage
              size={48}
              avatarUrl={profile?.avatar_url}
              name={profile?.username}
            />
            <span style={{
              fontFamily: 'Cinzel,serif', fontSize: 10, fontWeight: 900,
              color: '#FFB800', letterSpacing: 1.5, textTransform: 'uppercase',
              textShadow: '0 0 12px rgba(255,184,0,0.3)',
            }}>
              @{profile?.username || '?'}
            </span>
          </div>

          {/* VS */}
          <div style={{
            flex: '0 0 60px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{
              fontFamily: 'Cinzel,serif', fontSize: 24, fontWeight: 900,
              color: '#FFB800',
              textShadow: '0 0 20px rgba(255,184,0,0.4), 0 0 40px rgba(255,184,0,0.2)',
              letterSpacing: 4,
            }}>VS</span>
          </div>

          {/* Opponent */}
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', gap: 6,
          }}>
            {state.opponent ? (
              <>
                <ProfileImage
                  size={48}
                  avatarUrl={state.opponent.avatar_url}
                  name={state.opponent.username}
                />
                <span style={{
                  fontFamily: 'Cinzel,serif', fontSize: 10, fontWeight: 900,
                  color: '#3B82F6', letterSpacing: 1.5, textTransform: 'uppercase',
                  textShadow: '0 0 12px rgba(59,130,246,0.3)',
                }}>
                  @{state.opponent.username}
                </span>
              </>
            ) : (
              <>
                <div style={{
                  width: 48, height: 48, borderRadius: '50%',
                  border: '2px dashed rgba(255,184,0,0.3)',
                  background: 'rgba(6,6,6,0.5)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ fontSize: 20, opacity: 0.4 }}>?</span>
                </div>
                <span style={{
                  fontFamily: 'Cinzel,serif', fontSize: 9, fontWeight: 700,
                  color: 'rgba(255,255,255,0.35)', letterSpacing: 1,
                  textTransform: 'uppercase',
                }}>
                  {state.mode === 'open_challenge' ? t('components.open') : t('components.opponent')}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Info section */}
      <div style={{ padding: '12px 16px' }}>
        {/* Title */}
        <p style={{
          fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700,
          color: 'var(--text-primary)', margin: '0 0 6px',
          letterSpacing: 0.5, textAlign: 'center',
        }}>
          {state.title || t('components.dealPreviewTitle')}
        </p>

        {/* Stake */}
        {state.stake && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            marginBottom: 8,
          }}>
            <span style={{ fontSize: 12 }}>{'\u{1F3C6}'}</span>
            <span style={{
              fontFamily: 'var(--font-display)', fontSize: 11,
              color: '#FFB800', fontWeight: 800, letterSpacing: 1,
              textTransform: 'uppercase',
            }}>
              {state.stake}
            </span>
          </div>
        )}

        {/* Detail chips */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 6,
          justifyContent: 'center',
        }}>
          {cat && (
            <span style={{
              padding: '3px 8px', borderRadius: 6,
              background: 'rgba(255,184,0,0.06)',
              border: '1px solid rgba(255,184,0,0.15)',
              fontSize: 9, color: 'var(--text-muted)',
              fontFamily: 'var(--font-body)',
            }}>
              {cat.icon} {cat.label}
            </span>
          )}
          {state.deadline && (
            <span style={{
              padding: '3px 8px', borderRadius: 6,
              background: 'rgba(255,184,0,0.06)',
              border: '1px solid rgba(255,184,0,0.15)',
              fontSize: 9, color: 'var(--text-muted)',
              fontFamily: 'var(--font-body)',
            }}>
              {'\u23F0'} {new Date(state.deadline).toLocaleDateString(lang === 'de' ? 'de-DE' : lang === 'fr' ? 'fr-FR' : lang === 'es' ? 'es-ES' : lang === 'it' ? 'it-IT' : 'en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <span style={{
            padding: '3px 8px', borderRadius: 6,
            background: 'rgba(255,184,0,0.06)',
            border: '1px solid rgba(255,184,0,0.15)',
            fontSize: 9, color: 'var(--text-muted)',
            fontFamily: 'var(--font-body)',
          }}>
            {state.visibility === 'private' ? '\u{1F512}' : state.visibility === 'friends' ? '\u{1F465}' : '\u{1F310}'} {state.visibility === 'private' ? t('components.private') : state.visibility === 'friends' ? t('components.friends') : t('components.public')}
          </span>
        </div>
      </div>
    </div>
  )
}
