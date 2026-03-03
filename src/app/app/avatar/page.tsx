'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useLang } from '@/contexts/LanguageContext'
import { supabase } from '@/lib/supabase'
import AvatarDisplay, { AvatarConfig } from '@/components/AvatarDisplay'

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

const RARITY_COLORS = {
  common:    '#9ca3af',
  rare:      '#60a5fa',
  epic:      '#a78bfa',
  legendary: '#FFB800',
}

const SLOT_LABELS: Record<AvatarSlot, string> = {
  body: 'Body',
  hair: 'Hair',
  outfit: 'Outfit',
  accessory: 'Accessory'
}

export default function AvatarPage() {
  const { profile, refreshProfile } = useAuth()
  const { t, lang } = useLang()
  const router = useRouter()

  const [activeSlot, setActiveSlot] = useState<AvatarSlot>('body')
  const [allItems, setAllItems] = useState<AvatarItem[]>([])
  const [owned, setOwned] = useState<string[]>([])
  const [avatarConfig, setAvatarConfig] = useState<AvatarConfig>({})
  const [toast, setToast] = useState<string | null>(null)
  const [buying, setBuying] = useState<string | null>(null)
  const [equipping, setEquipping] = useState<string | null>(null)

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }, [])

  useEffect(() => {
    if (!profile) return
    fetchData()
  }, [profile])

  const fetchData = async () => {
    if (!profile) return

    const [itemsRes, invRes, configRes] = await Promise.all([
      supabase.from('avatar_items').select('*').order('rarity'),
      supabase.from('user_avatar_inventory').select('item_id').eq('user_id', profile.id),
      supabase.from('avatar_config').select('*').eq('user_id', profile.id).single()
    ])

    setAllItems((itemsRes.data || []) as AvatarItem[])
    setOwned((invRes.data || []).map((r: any) => r.item_id))

    if (configRes.data) {
      setAvatarConfig({
        body: configRes.data.body,
        hair: configRes.data.hair,
        outfit: configRes.data.outfit,
        accessory: configRes.data.accessory,
      })
    } else {
      // Create default config if none exists
      const defaultConfig = { body: 'body_default', hair: 'hair_default', outfit: 'outfit_default', accessory: 'acc_none' }
      await supabase.from('avatar_config').upsert({ user_id: profile.id, ...defaultConfig })
      setAvatarConfig(defaultConfig)
    }
  }

  const equipItem = async (item: AvatarItem) => {
    if (!profile) return
    setEquipping(item.id)
    const newConfig = { ...avatarConfig, [item.slot]: item.id }
    await supabase.from('avatar_config').upsert({
      user_id: profile.id,
      ...newConfig,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' })
    setAvatarConfig(newConfig)
    showToast(`✓ ${item.name} ${t('avatar.equipped')}`)
    setEquipping(null)
  }

  const buyItem = async (item: AvatarItem) => {
    if (!profile) return
    const coins = profile.coins ?? 0
    if (coins < item.price_coins) { showToast(t('avatar.notEnoughCoins')); return }
    setBuying(item.id)
    try {
      await supabase.from('profiles').update({ coins: coins - item.price_coins }).eq('id', profile.id)
      await supabase.from('wallet_ledger').insert({
        user_id: profile.id,
        delta: -item.price_coins,
        reason: 'avatar_purchase',
        reference_id: item.id
      })
      await supabase.from('user_avatar_inventory').upsert({
        user_id: profile.id,
        item_id: item.id
      }, { onConflict: 'user_id,item_id' })
      setOwned(prev => [...prev, item.id])
      await refreshProfile()
      showToast(`🎉 ${item.name} ${lang === 'de' ? 'erhalten!' : 'unlocked!'}`)
    } catch (e) { console.error(e) }
    setBuying(null)
  }

  const slotItems = allItems.filter(i => i.slot === activeSlot)
  const equipped = avatarConfig[activeSlot] || ''
  const coins = profile?.coins ?? 0
  const archetype = profile?.primary_archetype || 'founder'

  return (
    <div style={{ minHeight: '100dvh', background: '#060606', paddingTop: 60, paddingBottom: 100 }}>
      {toast && (
        <div style={{ position: 'fixed', top: 80, left: '50%', transform: 'translateX(-50%)', background: 'linear-gradient(135deg, #CC8800, #FFB800)', borderRadius: 12, padding: '10px 20px', zIndex: 300, whiteSpace: 'nowrap', boxShadow: '0 8px 24px rgba(255,184,0,0.3)' }}>
          <span style={{ fontFamily: 'Cinzel, serif', fontSize: 12, color: '#000', fontWeight: 700 }}>{toast}</span>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 20px 16px' }}>
        <button onClick={() => router.back()} style={{ background: 'transparent', border: 'none', color: 'rgba(240,236,228,0.6)', fontSize: 24, cursor: 'pointer' }}>‹</button>
        <h1 className='font-display' style={{ fontSize: 22, color: '#f0ece4' }}>{t('avatar.title')}</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#111', borderRadius: 20, padding: '4px 12px', border: '1px solid rgba(255,184,0,0.15)' }}>
          <span style={{ fontSize: 13 }}>🪙</span>
          <span className='font-display' style={{ fontSize: 13, color: '#FFB800' }}>{coins.toLocaleString()}</span>
        </div>
      </div>

      {/* Avatar Preview */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 20px 24px' }}>
        <AvatarDisplay
          config={avatarConfig}
          archetype={archetype}
          size={120}
          initials={(profile?.display_name || profile?.username || 'U').slice(0, 2).toUpperCase()}
        />
        <p style={{ marginTop: 12, fontSize: 13, color: 'rgba(240,236,228,0.5)', fontFamily: 'Cinzel, serif', letterSpacing: 1 }}>
          {t('avatar.myAvatar')}
        </p>
      </div>

      {/* Slot Tabs */}
      <div style={{ display: 'flex', margin: '0 16px 16px', background: '#111', borderRadius: 10, padding: 4, gap: 2 }}>
        {(['body', 'hair', 'outfit', 'accessory'] as AvatarSlot[]).map(slot => (
          <button
            key={slot}
            onClick={() => setActiveSlot(slot)}
            style={{
              flex: 1,
              padding: '10px 4px',
              borderRadius: 8,
              border: activeSlot === slot ? '1px solid rgba(255,184,0,0.25)' : '1px solid transparent',
              background: activeSlot === slot ? 'rgba(255,184,0,0.12)' : 'transparent',
              color: activeSlot === slot ? '#FFB800' : 'rgba(240,236,228,0.4)',
              fontFamily: 'Cinzel, serif',
              fontSize: 9,
              letterSpacing: 0.5,
              cursor: 'pointer'
            }}
          >
            {(lang === 'de' ? { body: 'KÖRPER', hair: 'HAARE', outfit: 'OUTFIT', accessory: 'ACCESSOIRE' } : { body: 'BODY', hair: 'HAIR', outfit: 'OUTFIT', accessory: 'ACC.' })[slot]}
          </button>
        ))}
      </div>

      {/* Items Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: '0 16px' }}>
        {slotItems.map(item => {
          const rc = RARITY_COLORS[item.rarity]
          const isOwned = owned.includes(item.id)
          const isEquipped = equipped === item.id
          const canBuy = !isOwned && item.price_coins > 0
          const isEarned = !isOwned && item.price_coins === 0 && !item.is_default

          return (
            <div
              key={item.id}
              style={{
                background: '#111',
                borderRadius: 14,
                border: `1px solid ${isEquipped ? 'rgba(255,184,0,0.4)' : rc + '33'}`,
                padding: '16px 12px',
                textAlign: 'center',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              {isEquipped && (
                <div style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(255,184,0,0.2)', borderRadius: 6, padding: '2px 8px', border: '1px solid rgba(255,184,0,0.4)' }}>
                  <span className='font-display' style={{ fontSize: 7, color: '#FFB800' }}>✓ ON</span>
                </div>
              )}
              {isOwned && !isEquipped && (
                <div style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(74,222,128,0.15)', borderRadius: 6, padding: '2px 8px', border: '1px solid rgba(74,222,128,0.3)' }}>
                  <span className='font-display' style={{ fontSize: 7, color: '#4ade80' }}>{t('avatar.owned').toUpperCase()}</span>
                </div>
              )}

              <div style={{ fontSize: 36, marginBottom: 10, filter: `drop-shadow(0 0 8px ${rc})` }}>
                {item.icon_emoji}
              </div>
              <p className='font-display' style={{ fontSize: 11, color: '#f0ece4', marginBottom: 4, lineHeight: 1.3 }}>{item.name}</p>
              <div style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 10, background: `${rc}18`, border: `1px solid ${rc}44`, marginBottom: 10 }}>
                <span className='font-display' style={{ fontSize: 7, letterSpacing: 1, color: rc }}>{item.rarity.toUpperCase()}</span>
              </div>
              <p style={{ fontSize: 11, color: 'rgba(240,236,228,0.4)', marginBottom: 12, lineHeight: 1.4 }}>{item.description}</p>

              {isEquipped ? (
                <div style={{ width: '100%', padding: '8px', borderRadius: 8, background: 'rgba(255,184,0,0.08)', color: '#FFB800', fontFamily: 'Cinzel, serif', fontSize: 9, letterSpacing: 1, textAlign: 'center', border: '1px solid rgba(255,184,0,0.3)' }}>
                  ✓ {t('avatar.equipped').toUpperCase()}
                </div>
              ) : isOwned ? (
                <button
                  onClick={() => equipItem(item)}
                  disabled={equipping === item.id}
                  style={{ width: '100%', padding: '8px', borderRadius: 8, border: '1px solid rgba(74,222,128,0.3)', background: 'rgba(74,222,128,0.08)', color: '#4ade80', fontFamily: 'Cinzel, serif', fontSize: 9, letterSpacing: 1, cursor: 'pointer' }}
                >
                  {equipping === item.id ? '...' : t('avatar.equip').toUpperCase()}
                </button>
              ) : canBuy ? (
                <button
                  onClick={() => buyItem(item)}
                  disabled={buying === item.id}
                  style={{ width: '100%', padding: '8px', borderRadius: 8, border: `1px solid ${rc}44`, background: `${rc}15`, color: rc, fontFamily: 'Cinzel, serif', fontSize: 9, letterSpacing: 1, cursor: coins >= item.price_coins ? 'pointer' : 'default', opacity: coins >= item.price_coins ? 1 : 0.5 }}
                >
                  {buying === item.id ? '...' : `🪙 ${item.price_coins}`}
                </button>
              ) : isEarned ? (
                <div style={{ width: '100%', padding: '8px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(240,236,228,0.25)', fontFamily: 'Cinzel, serif', fontSize: 9, textAlign: 'center' }}>
                  {lang === 'de' ? 'VERDIENT' : 'EARNED'}
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
