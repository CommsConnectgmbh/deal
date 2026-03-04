'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useLang } from '@/contexts/LanguageContext'
import { supabase } from '@/lib/supabase'
import AvatarDisplay, { AvatarConfig, AvatarItemIcon, RARITY_COLORS } from '@/components/AvatarDisplay'

type AvatarSlot = 'body' | 'hair' | 'outfit' | 'accessory'

interface AvatarItem {
  id: string
  slot: AvatarSlot
  name: string
  description: string
  rarity: 'common' | 'rare' | 'epic' | 'legendary'
  price_coins: number
  icon_emoji: string
  is_default: boolean
}

const SLOT_LABELS: Record<AvatarSlot, { de: string; en: string }> = {
  body:      { de: 'KÖRPER',     en: 'BODY'    },
  hair:      { de: 'HAARE',      en: 'HAIR'    },
  outfit:    { de: 'OUTFIT',     en: 'OUTFIT'  },
  accessory: { de: 'ACCESSOIRE', en: 'ACC.'    },
}

export default function AvatarPage() {
  const { profile, refreshProfile } = useAuth()
  const { t, lang } = useLang()
  const router = useRouter()

  const [activeSlot, setActiveSlot] = useState<AvatarSlot>('body')
  const [allItems,   setAllItems]   = useState<AvatarItem[]>([])
  const [owned,      setOwned]      = useState<string[]>([])
  const [config,     setConfig]     = useState<AvatarConfig>({
    body: 'body_default', hair: 'hair_default', outfit: 'outfit_default', accessory: 'acc_none',
  })
  const [toast,      setToast]      = useState<string | null>(null)
  const [busy,       setBusy]       = useState<string | null>(null)

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }, [])

  useEffect(() => { if (profile) fetchData() }, [profile])

  const fetchData = async () => {
    if (!profile) return
    const [itemsRes, invRes, cfgRes] = await Promise.all([
      supabase.from('avatar_items').select('*').order('rarity'),
      supabase.from('user_avatar_inventory').select('item_id').eq('user_id', profile.id),
      supabase.from('avatar_config').select('*').eq('user_id', profile.id).single(),
    ])
    setAllItems((itemsRes.data || []) as AvatarItem[])
    setOwned((invRes.data || []).map((r: any) => r.item_id))

    if (cfgRes.data) {
      setConfig({
        body:      cfgRes.data.body      || 'body_default',
        hair:      cfgRes.data.hair      || 'hair_default',
        outfit:    cfgRes.data.outfit    || 'outfit_default',
        accessory: cfgRes.data.accessory || 'acc_none',
      })
    } else {
      const def = { body: 'body_default', hair: 'hair_default', outfit: 'outfit_default', accessory: 'acc_none' }
      await supabase.from('avatar_config').upsert({ user_id: profile.id, ...def })
      setConfig(def)
    }
  }

  // ─── Equip: updates state immediately for live preview, then persists ──────
  const equipItem = async (item: AvatarItem) => {
    if (!profile) return
    const next = { ...config, [item.slot]: item.id }
    setConfig(next) // ← immediate preview update
    setBusy(item.id)
    await supabase.from('avatar_config').upsert(
      { user_id: profile.id, ...next, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    )
    showToast(`✓ ${item.name} ${lang === 'de' ? 'ausgerüstet' : 'equipped'}`)
    setBusy(null)
  }

  // ─── Buy ──────────────────────────────────────────────────────────────────
  const buyItem = async (item: AvatarItem) => {
    if (!profile) return
    const coins = profile.coins ?? 0
    if (coins < item.price_coins) { showToast(lang === 'de' ? 'Nicht genug Coins!' : 'Not enough coins!'); return }
    setBusy(item.id)
    try {
      await Promise.all([
        supabase.from('profiles').update({ coins: coins - item.price_coins }).eq('id', profile.id),
        supabase.from('wallet_ledger').insert({
          user_id: profile.id, delta: -item.price_coins,
          reason: 'avatar_purchase', reference_id: item.id,
        }),
        supabase.from('user_avatar_inventory').upsert(
          { user_id: profile.id, item_id: item.id },
          { onConflict: 'user_id,item_id' }
        ),
      ])
      setOwned(prev => [...prev, item.id])
      await refreshProfile()
      showToast(`🎉 ${item.name} ${lang === 'de' ? 'erhalten!' : 'unlocked!'}`)
    } catch (e) { console.error(e) }
    setBusy(null)
  }

  const slotItems  = allItems.filter(i => i.slot === activeSlot)
  const equipped   = config[activeSlot] || ''
  const coins      = profile?.coins ?? 0
  const archetype  = profile?.primary_archetype || 'founder'

  // Determine the highest rarity equipped item for the preview ring
  const equippedItems = allItems.filter(i =>
    i.id === config.body || i.id === config.hair ||
    i.id === config.outfit || i.id === config.accessory
  )
  const rarityOrder = { common: 0, rare: 1, epic: 2, legendary: 3 }
  const topRarity = equippedItems.reduce((best, i) =>
    (rarityOrder[i.rarity] ?? 0) > (rarityOrder[best as keyof typeof rarityOrder] ?? 0) ? i.rarity : best,
    'common' as string
  )
  const previewGlow = RARITY_COLORS[topRarity as keyof typeof RARITY_COLORS] || RARITY_COLORS.common

  return (
    <div style={{ minHeight: '100dvh', background: '#060606', paddingTop: 60, paddingBottom: 100 }}>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 80, left: '50%', transform: 'translateX(-50%)',
          background: 'linear-gradient(135deg, #CC8800, #FFB800)',
          borderRadius: 12, padding: '10px 20px', zIndex: 300,
          whiteSpace: 'nowrap', boxShadow: '0 8px 24px rgba(255,184,0,0.3)',
        }}>
          <span style={{ fontFamily: 'Cinzel, serif', fontSize: 12, color: '#000', fontWeight: 700 }}>{toast}</span>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 20px 20px' }}>
        <button onClick={() => router.back()} style={{ background: 'transparent', border: 'none', color: 'rgba(240,236,228,0.6)', fontSize: 24, cursor: 'pointer' }}>‹</button>
        <h1 className="font-display" style={{ fontSize: 20, color: '#f0ece4', letterSpacing: 2 }}>
          {lang === 'de' ? 'AVATAR' : 'AVATAR'}
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#111', borderRadius: 20, padding: '4px 12px', border: '1px solid rgba(255,184,0,0.15)' }}>
          <span style={{ fontSize: 13 }}>🪙</span>
          <span className="font-display" style={{ fontSize: 13, color: '#FFB800' }}>{coins.toLocaleString()}</span>
        </div>
      </div>

      {/* ── Full-body avatar preview ────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 20px 28px' }}>
        {/* Outer glow ring */}
        <div style={{
          padding: 3,
          borderRadius: 24,
          background: `linear-gradient(135deg, ${previewGlow}80, ${previewGlow}20)`,
          boxShadow: `0 0 40px ${previewGlow}35`,
        }}>
          <AvatarDisplay
            config={config}
            archetype={archetype}
            size={110}
            showFullBody
            initials={(profile?.display_name || profile?.username || 'U').slice(0, 2).toUpperCase()}
          />
        </div>
        {/* Name + rarity label */}
        <p className="font-display" style={{ marginTop: 14, fontSize: 11, color: previewGlow, letterSpacing: 2, opacity: 0.9 }}>
          {topRarity.toUpperCase()}
        </p>
        <p style={{ marginTop: 2, fontSize: 12, color: 'rgba(240,236,228,0.4)', fontFamily: 'Crimson Text, serif' }}>
          {profile?.display_name || profile?.username || '—'}
        </p>
      </div>

      {/* ── Slot Tabs ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', margin: '0 16px 20px', background: '#111', borderRadius: 12, padding: 4, gap: 2 }}>
        {(['body', 'hair', 'outfit', 'accessory'] as AvatarSlot[]).map(slot => {
          const active = activeSlot === slot
          return (
            <button
              key={slot}
              onClick={() => setActiveSlot(slot)}
              style={{
                flex: 1, padding: '10px 4px', borderRadius: 8, cursor: 'pointer',
                border: active ? '1px solid rgba(255,184,0,0.25)' : '1px solid transparent',
                background: active ? 'rgba(255,184,0,0.10)' : 'transparent',
                color: active ? '#FFB800' : 'rgba(240,236,228,0.35)',
                fontFamily: 'Cinzel, serif', fontSize: 9, letterSpacing: 0.6,
              }}
            >
              {SLOT_LABELS[slot][lang === 'de' ? 'de' : 'en']}
            </button>
          )
        })}
      </div>

      {/* ── Items Grid ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: '0 16px' }}>
        {slotItems.map(item => {
          const rc        = RARITY_COLORS[item.rarity]
          const isOwned   = owned.includes(item.id) || item.is_default
          const isEquip   = equipped === item.id
          const canBuy    = !isOwned && item.price_coins > 0
          const isEarned  = !isOwned && item.price_coins === 0 && !item.is_default
          const isLoading = busy === item.id

          return (
            <div
              key={item.id}
              onClick={() => isOwned && !isEquip ? equipItem(item) : undefined}
              style={{
                background: isEquip ? `${rc}10` : '#111',
                borderRadius: 16,
                border: isEquip
                  ? `1.5px solid ${rc}70`
                  : `1px solid ${rc}28`,
                boxShadow: isEquip
                  ? `0 0 18px ${rc}28, inset 0 0 30px ${rc}08`
                  : 'none',
                padding: '18px 12px 14px',
                textAlign: 'center',
                position: 'relative',
                overflow: 'hidden',
                cursor: isOwned && !isEquip ? 'pointer' : 'default',
                transition: 'border-color 0.2s, box-shadow 0.2s',
              }}
            >
              {/* Equipped badge */}
              {isEquip && (
                <div style={{
                  position: 'absolute', top: 8, right: 8,
                  background: `${rc}22`, borderRadius: 6, padding: '2px 8px',
                  border: `1px solid ${rc}50`,
                }}>
                  <span className="font-display" style={{ fontSize: 7, color: rc, letterSpacing: 1 }}>✓ ON</span>
                </div>
              )}
              {/* Owned but not equipped */}
              {isOwned && !isEquip && (
                <div style={{
                  position: 'absolute', top: 8, right: 8,
                  background: 'rgba(74,222,128,0.12)', borderRadius: 6, padding: '2px 8px',
                  border: '1px solid rgba(74,222,128,0.25)',
                }}>
                  <span className="font-display" style={{ fontSize: 7, color: '#4ade80', letterSpacing: 0.5 }}>
                    {lang === 'de' ? 'OWNED' : 'OWNED'}
                  </span>
                </div>
              )}

              {/* SVG item icon */}
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10, minHeight: activeSlot === 'outfit' ? 56 : 56 }}>
                <AvatarItemIcon
                  itemId={item.id}
                  slot={item.slot}
                  size={activeSlot === 'outfit' ? 48 : 52}
                  rarity={item.rarity}
                />
              </div>

              {/* Item name */}
              <p className="font-display" style={{ fontSize: 11, color: '#f0ece4', marginBottom: 4, lineHeight: 1.3, letterSpacing: 0.5 }}>
                {item.name}
              </p>

              {/* Rarity badge */}
              <div style={{
                display: 'inline-block', padding: '2px 8px', borderRadius: 10, marginBottom: 8,
                background: `${rc}14`, border: `1px solid ${rc}40`,
              }}>
                <span className="font-display" style={{ fontSize: 7, letterSpacing: 1, color: rc }}>
                  {item.rarity.toUpperCase()}
                </span>
              </div>

              {/* Action button */}
              {isEquip ? (
                <div style={{
                  width: '100%', padding: '8px', borderRadius: 8,
                  background: `${rc}14`, color: rc,
                  fontFamily: 'Cinzel, serif', fontSize: 9, letterSpacing: 1, textAlign: 'center',
                  border: `1px solid ${rc}40`,
                }}>
                  ✓ {lang === 'de' ? 'AUSGERÜSTET' : 'EQUIPPED'}
                </div>
              ) : isOwned ? (
                <button
                  onClick={e => { e.stopPropagation(); equipItem(item) }}
                  disabled={isLoading}
                  style={{
                    width: '100%', padding: '8px', borderRadius: 8, cursor: 'pointer',
                    border: '1px solid rgba(74,222,128,0.35)',
                    background: 'rgba(74,222,128,0.08)', color: '#4ade80',
                    fontFamily: 'Cinzel, serif', fontSize: 9, letterSpacing: 1,
                    opacity: isLoading ? 0.5 : 1,
                  }}
                >
                  {isLoading ? '···' : lang === 'de' ? 'AUSRÜSTEN' : 'EQUIP'}
                </button>
              ) : canBuy ? (
                <button
                  onClick={e => { e.stopPropagation(); buyItem(item) }}
                  disabled={isLoading || coins < item.price_coins}
                  style={{
                    width: '100%', padding: '8px', borderRadius: 8,
                    cursor: coins >= item.price_coins ? 'pointer' : 'not-allowed',
                    border: `1px solid ${rc}40`, background: `${rc}12`, color: rc,
                    fontFamily: 'Cinzel, serif', fontSize: 9, letterSpacing: 1,
                    opacity: isLoading || coins < item.price_coins ? 0.45 : 1,
                  }}
                >
                  {isLoading ? '···' : `🪙 ${item.price_coins}`}
                </button>
              ) : isEarned ? (
                <div style={{
                  width: '100%', padding: '8px', borderRadius: 8, textAlign: 'center',
                  border: '1px solid rgba(255,255,255,0.05)',
                  color: 'rgba(240,236,228,0.2)', fontFamily: 'Cinzel, serif', fontSize: 9,
                }}>
                  {lang === 'de' ? 'VERDIENST' : 'EARNED'}
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
