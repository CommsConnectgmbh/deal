'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import AvatarFrame, { FrameType } from '@/components/AvatarFrame'
import { getEquippedCard, getUserDNA, type EquippedCard, type AvatarDNA, FRAME_COLORS, RARITY_LABELS, RARITY_COLORS } from '@/lib/card-helpers'
import { useLang } from '@/contexts/LanguageContext'

export default function AvatarPage() {
  const { profile } = useAuth()
  const router = useRouter()
  const { t } = useLang()
  const DNA_LABELS: Record<string, Record<string, string>> = {
    gender: { male: t('avatar.genderMale'), female: t('avatar.genderFemale') },
    origin: { european: 'European', african: 'African', east_asian: 'East Asian', south_asian: 'South Asian', latin: 'Latin', middle_eastern: 'Middle East' },
    hair: { short: t('avatar.hairShort'), long: t('avatar.hairLong'), curly: t('avatar.hairCurly'), buzz: 'Buzz Cut', ponytail: t('avatar.hairPonytail'), braided: t('avatar.hairBraided') },
    style: { business_suit: 'Business', luxury_blazer: 'Luxury Blazer', streetwear_hoodie: 'Streetwear', tech_founder: 'Tech Founder', cyberpunk_jacket: 'Cyberpunk', fantasy_armor: 'Fantasy Armor' },
  }
  const [equippedCard, setEquippedCard] = useState<EquippedCard | null>(null)
  const [dna, setDna] = useState<AvatarDNA | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile) return
    loadData()
  }, [profile])

  const loadData = async () => {
    if (!profile) return
    const [card, avatarDna] = await Promise.all([
      getEquippedCard(profile.id),
      getUserDNA(profile.id),
    ])
    setEquippedCard(card)
    setDna(avatarDna)
    setLoading(false)
  }

  const frameType = (equippedCard?.frame as FrameType) || 'bronze'
  const fc = FRAME_COLORS[frameType] || '#CD7F32'
  const rc = RARITY_COLORS[equippedCard?.rarity || 'common'] || '#9CA3AF'

  if (loading) {
    return (
      <div style={{ minHeight: '100dvh', background: 'var(--bg-base)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>{t('components.loading')}</div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg-base)', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ padding: '16px 20px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--bg-elevated)' }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 22, cursor: 'pointer' }}>&lsaquo;</button>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, letterSpacing: 2, color: 'var(--gold-primary)' }}>{t('avatar.yourCard')}</span>
        <div style={{ width: 40 }} />
      </div>

      {!equippedCard ? (
        /* No avatar card yet */
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>{'\u{1F3B4}'}</div>
          <h2 className="font-display" style={{ fontSize: 18, color: 'var(--text-primary)', letterSpacing: 2, marginBottom: 12 }}>
            {t('avatar.noCard')}
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 28, lineHeight: 1.6 }}>
            {t('avatar.noCardDesc')}
          </p>
          <button
            onClick={() => router.push('/app/avatar-card/create')}
            style={{
              padding: '14px 32px', borderRadius: 12, border: 'none',
              background: 'var(--gold-primary)', color: 'var(--text-inverse)',
              fontFamily: "'Oswald',sans-serif", fontSize: 13, fontWeight: 700,
              letterSpacing: 2, cursor: 'pointer', boxShadow: 'var(--shadow-gold)',
            }}
          >
            {t('avatar.createAvatar')}
          </button>
        </div>
      ) : (
        <>
          {/* Card Preview */}
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '40px 0 24px' }}>
            <AvatarFrame
              frameType="none"
              imageUrl={equippedCard.imageUrl}
              size="lg"
              username={profile?.username}
              level={profile?.level}
              streak={profile?.streak || 0}
              serialNumber={equippedCard.serialDisplay}
              showInfo
            />
          </div>

          {/* Frame + Rarity info */}
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '5px 14px', borderRadius: 20,
              background: `${rc}15`, border: `1px solid ${rc}33`,
            }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 9, letterSpacing: 2, color: rc, textTransform: 'uppercase' }}>
                {RARITY_LABELS[equippedCard.rarity] || equippedCard.rarity} &middot; {frameType.replace(/_/g, ' ')}
              </span>
            </div>
          </div>

          {/* DNA badges */}
          {dna && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 6, flexWrap: 'wrap', padding: '0 20px', marginBottom: 20 }}>
              {(['gender', 'origin', 'hair', 'style'] as const).map(key => {
                const val = dna[key]
                const label = DNA_LABELS[key]?.[val] || val.replace(/_/g, ' ')
                return (
                  <span key={key} style={{
                    padding: '3px 10px', borderRadius: 8,
                    background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
                    fontSize: 9, color: 'var(--text-secondary)',
                    fontFamily: "'Oswald',sans-serif", letterSpacing: 1,
                    textTransform: 'uppercase',
                  }}>
                    {label}
                  </span>
                )
              })}
              {dna.current_accessory !== 'none' && (
                <span style={{
                  padding: '3px 10px', borderRadius: 8,
                  background: 'var(--gold-subtle)', border: '1px solid rgba(255,184,0,0.15)',
                  fontSize: 9, color: 'var(--gold-primary)',
                  fontFamily: "'Oswald',sans-serif", letterSpacing: 1,
                  textTransform: 'uppercase',
                }}>
                  {dna.current_accessory.replace(/_/g, ' ')}
                </span>
              )}
              {dna.current_effect !== 'none' && (
                <span style={{
                  padding: '3px 10px', borderRadius: 8,
                  background: 'var(--gold-subtle)', border: '1px solid rgba(255,184,0,0.15)',
                  fontSize: 9, color: 'var(--gold-primary)',
                  fontFamily: "'Oswald',sans-serif", letterSpacing: 1,
                  textTransform: 'uppercase',
                }}>
                  {dna.current_effect.replace(/_/g, ' ')}
                </span>
              )}
            </div>
          )}

          {/* Stats */}
          <div style={{
            display: 'flex', justifyContent: 'center', gap: 20, marginBottom: 28,
            fontSize: 12, color: 'var(--text-secondary)',
          }}>
            <span>W:{profile?.wins || 0}</span>
            <span>L:{profile?.losses || 0}</span>
            <span>{'\u{1F525}'}{profile?.streak || 0}</span>
            <span>LV.{profile?.level || 1}</span>
          </div>

          {/* Actions */}
          <div style={{ padding: '0 24px 120px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <button
              onClick={() => router.push('/app/avatar-card/upgrade')}
              style={{
                width: '100%', padding: '14px 0', borderRadius: 12, border: 'none',
                background: 'var(--gold-primary)', color: 'var(--text-inverse)',
                fontFamily: "'Oswald',sans-serif", fontSize: 13, fontWeight: 700,
                letterSpacing: 2, cursor: 'pointer', boxShadow: 'var(--shadow-gold)',
              }}
            >
              {t('avatar.customizeCard')}
            </button>
            <button
              onClick={() => router.push('/app/cards')}
              style={{
                width: '100%', padding: '14px 0', borderRadius: 12,
                border: '1px solid var(--border-default)',
                background: 'transparent', color: 'var(--text-secondary)',
                fontFamily: "'Oswald',sans-serif", fontSize: 13, fontWeight: 600,
                letterSpacing: 1.5, cursor: 'pointer',
              }}
            >
              {t('avatar.myCollection')}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
