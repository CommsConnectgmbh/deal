'use client'
import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useLang } from '@/contexts/LanguageContext'
import { supabase } from '@/lib/supabase'
import CoinIcon from '@/components/CoinIcon'
import AvatarFrame, { FrameType } from '@/components/AvatarFrame'
import {
  getUserCards, getEquippedCard, getCardImageUrl,
  FRAME_COLORS, RARITY_COLORS, RARITY_LABELS,
  ARCHETYPE_ICONS, ARCHETYPE_COLORS, ARCHETYPE_LABELS,
  type UserCardWithCatalog, type EquippedCard,
} from '@/lib/card-helpers'

/* ── Config ──────────────────────────────────────────────────── */

const RARITY_ICONS: Record<string, string> = {
  common: '\u{1F0CF}', rare: '\u{1F947}', epic: '\u{1F48E}',
  legendary: '\u2B50', founder: '\u{1F451}', event: '\u{1F389}',
}
const RARITY_ORDER = ['common', 'rare', 'epic', 'legendary', 'founder', 'event']

type SortMode = 'newest' | 'rarity'

/* ── Flat card type for display ──────────────────────────────── */
interface FlatCard {
  userCardId: string
  cardId: string
  frame: string
  rarity: string
  gender: string
  origin: string
  hair: string
  style: string
  accessory: string
  effect: string
  archetype: string | null
  age: string
  imageUrl: string | null
  serialDisplay: string | null
  cardCode: string
  isEquipped: boolean
  obtainedFrom: string
  obtainedAt: string
}

function flattenCard(uc: UserCardWithCatalog): FlatCard {
  const c = uc.card_catalog
  return {
    userCardId: uc.id,
    cardId: c.id,
    frame: c.frame,
    rarity: c.rarity,
    gender: c.gender,
    origin: c.origin,
    hair: c.hair,
    style: c.style,
    accessory: c.accessory,
    effect: c.effect,
    archetype: c.archetype,
    age: c.age,
    imageUrl: c.image_url,
    serialDisplay: c.serial_display,
    cardCode: c.card_code,
    isEquipped: uc.is_equipped,
    obtainedFrom: uc.obtained_from,
    obtainedAt: uc.obtained_at,
  }
}

function cardName(card: FlatCard): string {
  if (card.archetype) {
    const label = ARCHETYPE_LABELS[card.archetype] || card.archetype.toUpperCase()
    return `The ${label.charAt(0)}${label.slice(1).toLowerCase()}`
  }
  return 'Base Card'
}

/* ── Page ───────────────────────────────────────────────────── */

export default function CardsPage() {
  const { profile, refreshProfile } = useAuth()
  const { t } = useLang()
  const router = useRouter()

  const [filter, setFilter] = useState<string>('alle')
  const [sort, setSort] = useState<SortMode>('newest')
  const [cards, setCards] = useState<FlatCard[]>([])
  const [equippedCard, setEquippedCard] = useState<EquippedCard | null>(null)
  const [selectedCard, setSelectedCard] = useState<FlatCard | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const showToast = useCallback((msg: string) => {
    setToast(msg); setTimeout(() => setToast(null), 3500)
  }, [])

  /* ── Data fetch ────────────────────────────────────────────── */

  useEffect(() => { if (profile) fetchAllData() }, [profile])

  const fetchAllData = async () => {
    if (!profile) return
    setLoading(true)
    const [rawCards, equipped] = await Promise.all([
      getUserCards(profile.id),
      getEquippedCard(profile.id),
    ])
    setCards(rawCards.filter(uc => uc.card_catalog).map(flattenCard))
    setEquippedCard(equipped)
    setLoading(false)
  }

  /* ── Derived ───────────────────────────────────────────────── */

  const filteredCards = cards
    .filter(c => {
      if (filter === 'alle') return true
      if (filter === 'base') return !c.archetype
      // Check if it's an archetype filter
      if (Object.keys(ARCHETYPE_LABELS).includes(filter)) return c.archetype === filter
      // Rarity filter
      return c.rarity === filter
    })
    .sort((a, b) => {
      if (sort === 'rarity') {
        return RARITY_ORDER.indexOf(b.rarity) - RARITY_ORDER.indexOf(a.rarity)
      }
      return new Date(b.obtainedAt).getTime() - new Date(a.obtainedAt).getTime()
    })

  // Count by rarity for filter badges
  const rarityCounts: Record<string, number> = {}
  cards.forEach(c => { rarityCounts[c.rarity] = (rarityCounts[c.rarity] || 0) + 1 })

  // Count by archetype for filter badges
  const archetypeCounts: Record<string, number> = { base: 0 }
  cards.forEach(c => {
    if (c.archetype) {
      archetypeCounts[c.archetype] = (archetypeCounts[c.archetype] || 0) + 1
    } else {
      archetypeCounts.base = (archetypeCounts.base || 0) + 1
    }
  })

  /* ── Actions ───────────────────────────────────────────────── */

  const equipCard = async (userCardId: string) => {
    if (!profile) return
    try {
      // 1. First UN-EQUIP all cards (avoids unique constraint "idx_one_equipped" violation)
      const { error: unequipErr } = await supabase.from('user_cards').update({ is_equipped: false }).eq('user_id', profile.id).eq('is_equipped', true)
      if (unequipErr) throw unequipErr
      // 2. Then EQUIP the selected card
      const { error: equipErr } = await supabase.from('user_cards').update({ is_equipped: true }).eq('id', userCardId).eq('user_id', profile.id)
      if (equipErr) throw equipErr
      // 3. Update equipped_card_image_url on profile
      const card = cards.find(c => c.userCardId === userCardId)
      const { error: profileErr } = await supabase.from('profiles').update({ equipped_card_image_url: card?.imageUrl || null }).eq('id', profile.id)
      if (profileErr) throw profileErr
      showToast('\u2713 ' + t('cards.cardEquipped'))
    } catch (err) {
      console.error('Equip error:', err)
      showToast('\u274c ' + t('cards.errorEquipping'))
    }
    await refreshProfile()
    await fetchAllData()
    setSelectedCard(null)
  }

  /* ── Render helpers ────────────────────────────────────────── */

  const renderCardMini = (card: FlatCard) => {
    const fColor = FRAME_COLORS[card.frame] || '#9CA3AF'
    const imgSrc = getCardImageUrl({ image_url: card.imageUrl, rarity: card.rarity })
    const isEquipped = card.isEquipped
    const isActualImage = card.imageUrl && !card.imageUrl.includes('card-common') && !card.imageUrl.includes('card-rare') && !card.imageUrl.includes('card-epic') && !card.imageUrl.includes('card-legendary') && !card.imageUrl.includes('card-founder')

    return (
      <div key={card.userCardId}
        onClick={() => setSelectedCard(card)}
        style={{
          position: 'relative',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 12, padding: '6px', textAlign: 'center',
          cursor: 'pointer',
        }}
      >
        {isEquipped && <div style={{ position: 'absolute', top: 3, right: 3, background: 'var(--gold-primary)', color: '#000', fontSize: 8, fontWeight: 800, borderRadius: 3, padding: '1px 4px', zIndex: 3 }}>{'\u2713'}</div>}

        {/* Card thumbnail */}
        <div style={{
          width: '100%', aspectRatio: '2/3', borderRadius: 8, overflow: 'hidden',
          background: '#0a0a0a',
          display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 4,
        }}>
          {isActualImage ? (
            <img src={imgSrc} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <span style={{ fontSize: 20, opacity: 0.5 }}>{RARITY_ICONS[card.rarity] || '\u{1F0CF}'}</span>
              <span style={{ fontSize: 6, fontWeight: 700, color: fColor, textTransform: 'uppercase', letterSpacing: 1 }}>{card.frame.replace(/_/g, ' ')}</span>
            </div>
          )}
        </div>

        {/* Archetype badge */}
        {card.archetype && (() => {
          const aColor = ARCHETYPE_COLORS[card.archetype] || '#9CA3AF'
          return (
            <div style={{ position: 'absolute', top: 3, left: 3, background: `${aColor}cc`, color: '#fff', fontSize: 6, fontWeight: 800, borderRadius: 3, padding: '1px 4px', zIndex: 3, letterSpacing: 0.5, textTransform: 'uppercase' }}>
              {ARCHETYPE_ICONS[card.archetype] || '🎭'}
            </div>
          )
        })()}

        <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {cardName(card)}
        </div>
        <div style={{ fontSize: 7, fontWeight: 700, color: fColor, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 1 }}>
          {card.frame.replace(/_/g, ' ')}
        </div>
        {card.serialDisplay && <div style={{ fontSize: 6, color: fColor, fontFamily: "'JetBrains Mono',monospace", marginTop: 1 }}>{card.serialDisplay}</div>}
      </div>
    )
  }

  const renderDetailSheet = () => {
    if (!selectedCard) return null
    const fColor = FRAME_COLORS[selectedCard.frame] || '#9CA3AF'
    const rColor = RARITY_COLORS[selectedCard.rarity] || '#9CA3AF'
    const imgSrc = getCardImageUrl({ image_url: selectedCard.imageUrl, rarity: selectedCard.rarity })

    return (
      <>
        <div onClick={() => setSelectedCard(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9998 }} />
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: 'var(--bg-surface)', borderRadius: '20px 20px 0 0',
          padding: '24px 20px 36px', zIndex: 9999,
          animation: 'slideUp 0.3s ease', maxHeight: '75vh', overflowY: 'auto',
        }}>
          <div style={{ width: 40, height: 4, background: 'rgba(255,255,255,0.2)', borderRadius: 2, margin: '0 auto 20px' }} />

          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
            <AvatarFrame
              frameType={(profile?.active_frame as any) || 'none'}
              imageUrl={imgSrc}
              size="lg"
              serialNumber={selectedCard.serialDisplay}
            />
          </div>

          <div className="font-display" style={{ fontSize: 18, fontWeight: 800, color: '#fff', textAlign: 'center', marginBottom: 4 }}>
            {cardName(selectedCard)}
          </div>
          {selectedCard.archetype && (() => {
            const aColor = ARCHETYPE_COLORS[selectedCard.archetype] || '#9CA3AF'
            return (
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '3px 10px', borderRadius: 8,
                  background: `${aColor}22`, border: `1px solid ${aColor}44`,
                  fontSize: 10, color: aColor, fontWeight: 700,
                  fontFamily: "'Oswald',sans-serif", letterSpacing: 1,
                }}>
                  {ARCHETYPE_ICONS[selectedCard.archetype]} {ARCHETYPE_LABELS[selectedCard.archetype]}
                </span>
              </div>
            )
          })()}
          <div style={{ fontSize: 11, color: fColor, fontWeight: 700, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 4 }}>
            {selectedCard.frame.replace(/_/g, ' ')}
          </div>
          <div style={{ fontSize: 10, color: rColor, fontWeight: 600, textAlign: 'center', marginBottom: 16 }}>
            {RARITY_LABELS[selectedCard.rarity] || selectedCard.rarity.toUpperCase()}
          </div>

          {/* Card attributes */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
            {[selectedCard.gender, selectedCard.origin, selectedCard.hair, selectedCard.style, selectedCard.accessory !== 'none' ? selectedCard.accessory : null, selectedCard.effect !== 'none' ? selectedCard.effect : null].filter(Boolean).map((attr, i) => (
              <span key={i} style={{
                padding: '3px 10px', borderRadius: 8,
                background: 'var(--bg-overlay)', border: '1px solid var(--border-subtle)',
                fontSize: 9, color: 'var(--text-secondary)',
                fontFamily: "'Oswald',sans-serif", letterSpacing: 1,
                textTransform: 'uppercase',
              }}>
                {(attr as string).replace(/_/g, ' ')}
              </span>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 16, fontSize: 11, color: 'var(--text-muted)', marginBottom: 20 }}>
            {selectedCard.serialDisplay && <span>{selectedCard.serialDisplay}</span>}
            <span>{t('cards.obtained')}: {new Date(selectedCard.obtainedAt).toLocaleDateString('de-DE')}</span>
            <span>{selectedCard.obtainedFrom}</span>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => equipCard(selectedCard.userCardId)}
              style={{
                flex: 1, padding: '14px 0', borderRadius: 12, border: 'none',
                background: selectedCard.isEquipped ? 'rgba(255,255,255,0.1)' : 'var(--gold-primary)',
                color: selectedCard.isEquipped ? 'var(--text-secondary)' : '#000',
                fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
              }}>{selectedCard.isEquipped ? `\u2713 ${t('cards.equipped')}` : t('cards.equip')}</button>
          </div>
        </div>
      </>
    )
  }

  /* ── Main render ───────────────────────────────────────────── */

  if (!profile) {
    return <div style={{ minHeight: '100vh', background: 'var(--bg-base)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>Laden...</div>
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', paddingBottom: 100 }}>
      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUp { from { transform: translateY(100%) } to { transform: translateY(0) } }
      `}</style>

      {/* Header */}
      <div style={{ padding: '16px 16px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => router.back()} style={{
          background: 'rgba(255,255,255,0.06)', border: 'none', color: 'var(--text-primary)',
          width: 36, height: 36, borderRadius: 10, fontSize: 18, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit',
        }}>{'\u2190'}</button>
        <div className="font-display" style={{ flex: 1, fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: 1 }}>{t('cards.title')}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: '6px 12px' }}>
          <CoinIcon size={16} />
          <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--gold-primary)' }}>{(profile.coins ?? 0).toLocaleString('de-DE')}</span>
        </div>
      </div>

      <div style={{ padding: '0 16px' }}>
        {/* Equipped card section */}
        {equippedCard && (
          <div style={{
            marginTop: 16, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
            borderRadius: 16, padding: 16, textAlign: 'center', marginBottom: 16,
          }}>
            <div className="font-display" style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: 2, marginBottom: 12 }}>
              {t('cards.equippedCard')}
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
              <AvatarFrame
                frameType={(profile.active_frame as any) || 'none'}
                imageUrl={equippedCard.imageUrl}
                size="md"
                username={profile.username}
                level={profile.level}
                streak={profile.streak}
                serialNumber={equippedCard.serialDisplay}
                showInfo
              />
            </div>
            <button onClick={() => router.push('/app/avatar-card/upgrade')} style={{
              padding: '10px 20px', borderRadius: 10, border: 'none',
              background: 'var(--gold-primary)', color: '#000',
              fontFamily: "'Oswald',sans-serif", fontSize: 12, fontWeight: 700,
              letterSpacing: 1.5, cursor: 'pointer', boxShadow: 'var(--shadow-gold)',
            }}>{t('cards.customizeCard')}</button>
          </div>
        )}
        {!equippedCard && !loading && (
          <div style={{
            marginTop: 16, background: 'var(--bg-surface)', border: '1px dashed var(--border-default)',
            borderRadius: 16, padding: 20, textAlign: 'center', marginBottom: 16,
          }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>{'\u{1F3B4}'}</div>
            <div className="font-display" style={{ fontSize: 13, color: 'var(--text-primary)', letterSpacing: 1, marginBottom: 8 }}>
              {t('cards.createYourCard')}
            </div>
            <button onClick={() => router.push('/app/avatar-card/create')} style={{
              padding: '10px 20px', borderRadius: 10, border: 'none',
              background: 'var(--gold-primary)', color: '#000',
              fontFamily: "'Oswald',sans-serif", fontSize: 12, fontWeight: 700,
              letterSpacing: 1.5, cursor: 'pointer', boxShadow: 'var(--shadow-gold)',
            }}>
              {t('cards.createNow')}
            </button>
          </div>
        )}

        {/* Stats + progress */}
        {cards.length > 0 && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>
                {cards.length} {t('cards.cardsCollected')}
              </span>
            </div>

            {/* Evolution timeline */}
            <div style={{ marginBottom: 16, overflowX: 'auto', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
              <div style={{ display: 'flex', gap: 4, minWidth: 'max-content', paddingBottom: 4 }}>
                {[...cards]
                  .sort((a, b) => new Date(a.obtainedAt).getTime() - new Date(b.obtainedAt).getTime())
                  .map((card, i) => {
                    const rc = RARITY_COLORS[card.rarity] || '#9CA3AF'
                    return (
                      <div key={card.userCardId} style={{
                        display: 'flex', alignItems: 'center', gap: 2,
                      }}>
                        <div style={{
                          width: 24, height: 24, borderRadius: 6,
                          background: `${rc}33`, border: `1px solid ${rc}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 10,
                        }}>
                          {RARITY_ICONS[card.rarity] || '\u{1F0CF}'}
                        </div>
                        {i < cards.length - 1 && (
                          <div style={{ width: 8, height: 2, background: 'var(--border-subtle)' }} />
                        )}
                      </div>
                    )
                  })}
              </div>
            </div>

            {/* Filter row — Archetype-based */}
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 8, scrollbarWidth: 'none' }}>
              <button onClick={() => setFilter('alle')} style={{
                padding: '6px 12px', borderRadius: 8, border: 'none',
                background: filter === 'alle' ? 'var(--gold-primary)' : 'rgba(255,255,255,0.06)',
                color: filter === 'alle' ? '#000' : 'var(--text-secondary)',
                fontWeight: 700, fontSize: 10, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, fontFamily: 'inherit',
              }}>ALLE ({cards.length})</button>
              {archetypeCounts.base > 0 && (
                <button onClick={() => setFilter('base')} style={{
                  padding: '6px 12px', borderRadius: 8,
                  background: filter === 'base' ? 'rgba(156,163,175,0.22)' : 'rgba(255,255,255,0.06)',
                  color: filter === 'base' ? '#9CA3AF' : 'var(--text-muted)',
                  fontWeight: 700, fontSize: 10, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, fontFamily: 'inherit',
                  border: filter === 'base' ? '1px solid rgba(156,163,175,0.44)' : '1px solid transparent',
                }}>{'\u{1F0CF}'} BASE ({archetypeCounts.base})</button>
              )}
              {Object.keys(ARCHETYPE_LABELS).map(arch => {
                const count = archetypeCounts[arch] || 0
                if (count === 0) return null
                const aColor = ARCHETYPE_COLORS[arch] || '#9CA3AF'
                const aIcon = ARCHETYPE_ICONS[arch] || '🎭'
                return (
                  <button key={arch} onClick={() => setFilter(arch)} style={{
                    padding: '6px 12px', borderRadius: 8,
                    background: filter === arch ? `${aColor}22` : 'rgba(255,255,255,0.06)',
                    color: filter === arch ? aColor : 'var(--text-muted)',
                    fontWeight: 700, fontSize: 10, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, fontFamily: 'inherit',
                    border: filter === arch ? `1px solid ${aColor}44` : '1px solid transparent',
                  }}>{aIcon} {ARCHETYPE_LABELS[arch]} ({count})</button>
                )
              })}
            </div>

            {/* Sort */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, marginTop: 4 }}>
              {[
                { key: 'newest' as SortMode, label: t('cards.newest') },
                { key: 'rarity' as SortMode, label: t('cards.rarity') },
              ].map(s => (
                <button key={s.key} onClick={() => setSort(s.key)} style={{
                  padding: '4px 10px', borderRadius: 6, border: 'none',
                  background: sort === s.key ? 'rgba(255,255,255,0.1)' : 'transparent',
                  color: sort === s.key ? 'var(--text-primary)' : 'var(--text-muted)',
                  fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                }}>{s.label}</button>
              ))}
            </div>

            {/* Card grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {filteredCards.map(card => renderCardMini(card))}
            </div>

            {filteredCards.length === 0 && (
              <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                {t('cards.noneInCategory')}
              </div>
            )}
          </>
        )}

        {cards.length === 0 && !loading && equippedCard === null && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: 13 }}>
            {t('cards.createAvatarHint')}
          </div>
        )}

        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
            <div style={{ width: 24, height: 24, border: '2px solid transparent', borderTopColor: 'var(--gold-primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          </div>
        )}
      </div>

      {selectedCard && renderDetailSheet()}

      {toast && (
        <div style={{
          position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--bg-surface)', color: 'var(--text-primary)',
          padding: '10px 20px', borderRadius: 12, fontSize: 13, fontWeight: 700,
          boxShadow: '0 4px 20px rgba(0,0,0,0.5)', zIndex: 10001,
          border: '1px solid rgba(255,255,255,0.1)', animation: 'fadeIn 0.2s ease', whiteSpace: 'nowrap',
        }}>{toast}</div>
      )}
    </div>
  )
}
