'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import AvatarDisplay, { AvatarConfig, AvatarItemIcon, RARITY_COLORS } from '@/components/AvatarDisplay'

type AvatarSlot = 'skin_tone' | 'hair' | 'headwear' | 'top' | 'bottom' | 'shoes' | 'accessory' | 'background'

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

const SLOT_LABELS: Record<AvatarSlot, string> = {
  skin_tone:  'HAUT',
  hair:       'HAARE',
  headwear:   'KOPF',
  top:        'TOP',
  bottom:     'HOSE',
  shoes:      'SCHUHE',
  accessory:  'ACC.',
  background: 'BG',
}

const SLOT_ICONS: Record<AvatarSlot, string> = {
  skin_tone:  '🏽',
  hair:       '💈',
  headwear:   '🧢',
  top:        '👕',
  bottom:     '👖',
  shoes:      '👟',
  accessory:  '💎',
  background: '🌑',
}

const ALL_SLOTS: AvatarSlot[] = ['skin_tone','hair','headwear','top','bottom','shoes','accessory','background']

export default function AvatarPage() {
  const { profile, refreshProfile } = useAuth()
  const router = useRouter()

  const [activeSlot, setActiveSlot] = useState<AvatarSlot>('skin_tone')
  const [allItems,   setAllItems]   = useState<AvatarItem[]>([])
  const [owned,      setOwned]      = useState<string[]>([])
  const [config,     setConfig]     = useState<AvatarConfig>({
    skin_tone: 'skin_medium',
    hair: 'hair_short_textured',
    headwear: null,
    top: 'top_tshirt',
    bottom: 'bottom_slim',
    shoes: 'shoes_sneaker',
    accessory: 'acc_none',
    background: 'bg_dark',
  })
  const [toast,    setToast]    = useState<string | null>(null)
  const [busy,     setBusy]     = useState<string | null>(null)
  const [saving,   setSaving]   = useState(false)

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }, [])

  useEffect(() => { if (profile) fetchData() }, [profile])

  const fetchData = async () => {
    if (!profile) return
    const [itemsRes, invRes, cfgRes] = await Promise.all([
      supabase.from('avatar_items').select('*').order('slot').order('price_coins'),
      supabase.from('user_avatar_inventory').select('item_id').eq('user_id', profile.id),
      supabase.from('avatar_config').select('*').eq('user_id', profile.id).single(),
    ])
    setAllItems((itemsRes.data || []) as AvatarItem[])

    const ownedIds = (invRes.data || []).map((r: any) => r.item_id)
    // Always mark defaults as owned
    const defaults = (itemsRes.data || []).filter((i: any) => i.is_default).map((i: any) => i.id)
    setOwned([...new Set([...ownedIds, ...defaults])])

    if (cfgRes.data) {
      setConfig({
        skin_tone:  cfgRes.data.skin_tone  || 'skin_medium',
        hair:       cfgRes.data.hair       || 'hair_short_textured',
        headwear:   cfgRes.data.headwear   || null,
        top:        cfgRes.data.top        || cfgRes.data.outfit || 'top_tshirt',
        bottom:     cfgRes.data.bottom     || 'bottom_slim',
        shoes:      cfgRes.data.shoes      || 'shoes_sneaker',
        accessory:  cfgRes.data.accessory  || 'acc_none',
        background: cfgRes.data.background || 'bg_dark',
      })
    }
  }

  const equip = useCallback((slot: AvatarSlot, itemId: string) => {
    setConfig(prev => ({
      ...prev,
      // Toggle headwear off if tapping same item
      [slot]: (slot === 'headwear' && prev.headwear === itemId) ? null : itemId,
    }))
  }, [])

  const buy = useCallback(async (item: AvatarItem) => {
    if (!profile) return
    if ((profile.coins || 0) < item.price_coins) {
      showToast('❌ Nicht genug Coins')
      return
    }
    setBusy(item.id)
    try {
      const newCoins = (profile.coins || 0) - item.price_coins
      await Promise.all([
        supabase.from('profiles').update({ coins: newCoins }).eq('id', profile.id),
        supabase.from('user_avatar_inventory').upsert({ user_id: profile.id, item_id: item.id }, { onConflict: 'user_id,item_id' }),
        supabase.from('wallet_ledger').insert({ user_id: profile.id, delta: -item.price_coins, reason: 'avatar_purchase', reference_id: item.id }),
      ])
      setOwned(prev => [...prev, item.id])
      await refreshProfile()
      showToast(`✅ ${item.name} gekauft!`)
      equip(item.slot, item.id)
    } catch (e) {
      showToast('❌ Fehler beim Kauf')
    } finally {
      setBusy(null)
    }
  }, [profile, refreshProfile, showToast, equip])

  const save = async () => {
    if (!profile) return
    setSaving(true)
    try {
      await supabase.from('avatar_config').upsert({
        user_id:    profile.id,
        skin_tone:  config.skin_tone,
        hair:       config.hair,
        headwear:   config.headwear,
        top:        config.top,
        bottom:     config.bottom,
        shoes:      config.shoes,
        accessory:  config.accessory,
        background: config.background,
        // keep legacy fields synced
        body:       config.skin_tone,
        outfit:     config.top,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })
      showToast('✅ Avatar gespeichert!')
    } catch {
      showToast('❌ Speichern fehlgeschlagen')
    } finally {
      setSaving(false)
    }
  }

  const slotItems = allItems.filter(i => i.slot === activeSlot)
  // headwear gets a "None" option
  const displayItems: (AvatarItem | { id: string; name: string; rarity: 'common'; price_coins: 0; slot: 'headwear'; is_default: true; description: string; icon_emoji: string })[] =
    activeSlot === 'headwear'
      ? [{ id: 'hw_none', name: 'Kein Kopfschmuck', rarity: 'common', price_coins: 0, slot: 'headwear', is_default: true, description: 'Standard', icon_emoji: '–' }, ...slotItems]
      : slotItems

  const currentEquipped = config[activeSlot === 'headwear' ? 'headwear' : activeSlot] as string | null | undefined

  return (
    <div style={{ minHeight:'100dvh', background:'#060606', color:'#F0ECE4', display:'flex', flexDirection:'column' }}>

      {/* Header */}
      <div style={{ padding:'16px 20px 8px', display:'flex', alignItems:'center', justifyContent:'space-between', borderBottom:'1px solid #1a1a1a' }}>
        <button onClick={() => router.back()} style={{ background:'none', border:'none', color:'#888', fontSize:22, cursor:'pointer' }}>‹</button>
        <span style={{ fontFamily:'Cinzel,serif', fontWeight:700, fontSize:16, letterSpacing:2, color:'#FFB800' }}>AVATAR EDITOR</span>
        <button
          onClick={save} disabled={saving}
          style={{ background: saving ? '#333' : '#FFB800', color:'#000', border:'none', borderRadius:8, padding:'6px 16px', fontWeight:700, fontSize:13, cursor:'pointer', fontFamily:'Cinzel,serif' }}
        >
          {saving ? '...' : 'SAVE'}
        </button>
      </div>

      {/* Preview */}
      <div style={{ display:'flex', justifyContent:'center', alignItems:'center', padding:'24px 0 16px', background:'#0A0A0A' }}>
        <AvatarDisplay config={config} archetype={profile?.primary_archetype || 'founder'} size={160} showFullBody streak={profile?.streak || 0} />
      </div>

      {/* Coins */}
      <div style={{ textAlign:'center', paddingBottom:12, fontSize:14, color:'#888' }}>
        <span style={{ color:'#FFB800', fontWeight:700 }}>🪙 {(profile?.coins || 0).toLocaleString()}</span> Coins
      </div>

      {/* Slot Tabs */}
      <div style={{ display:'flex', overflowX:'auto', gap:4, padding:'0 12px 12px', scrollbarWidth:'none' }}>
        {ALL_SLOTS.map(slot => {
          const isActive = slot === activeSlot
          const equipped = config[slot]
          const hasItem  = equipped && equipped !== 'acc_none' && equipped !== 'bg_dark' && equipped !== 'skin_medium'
          return (
            <button
              key={slot}
              onClick={() => setActiveSlot(slot)}
              style={{
                flexShrink: 0,
                padding: '6px 12px',
                borderRadius: 20,
                border: isActive ? '1.5px solid #FFB800' : '1.5px solid #222',
                background: isActive ? '#FFB80015' : '#111',
                color: isActive ? '#FFB800' : '#666',
                fontSize: 10,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'Cinzel,serif',
                letterSpacing: 1,
                position: 'relative',
                whiteSpace: 'nowrap',
              }}
            >
              {SLOT_ICONS[slot]} {SLOT_LABELS[slot]}
              {hasItem && !isActive && (
                <span style={{ position:'absolute', top:-2, right:-2, width:6, height:6, borderRadius:'50%', background:'#FFB800' }} />
              )}
            </button>
          )
        })}
      </div>

      {/* Items Grid */}
      <div style={{ flex:1, overflowY:'auto', padding:'0 12px 120px' }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:10 }}>
          {displayItems.map((item) => {
            const isOwned    = item.id === 'hw_none' || item.is_default || owned.includes(item.id)
            const isEquipped = (activeSlot === 'headwear' && item.id === 'hw_none')
              ? !config.headwear
              : currentEquipped === item.id
            const rc = RARITY_COLORS[item.rarity as keyof typeof RARITY_COLORS] || '#9ca3af'
            const isBuying   = busy === item.id

            return (
              <div
                key={item.id}
                onClick={() => {
                  if (item.id === 'hw_none') { equip('headwear', ''); return }
                  if (isOwned) equip(activeSlot, item.id)
                }}
                style={{
                  background: isEquipped ? `${rc}18` : '#111',
                  borderRadius: 12,
                  border: isEquipped ? `1.5px solid ${rc}` : `1px solid ${isOwned ? '#222' : '#1a1a1a'}`,
                  padding: '12px 8px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 6,
                  cursor: isOwned ? 'pointer' : 'default',
                  opacity: isOwned ? 1 : 0.6,
                  position: 'relative',
                  boxShadow: isEquipped ? `0 0 12px ${rc}44` : 'none',
                  transition: 'all 0.15s',
                }}
              >
                {/* Rarity dot */}
                <div style={{ position:'absolute', top:6, right:8, width:6, height:6, borderRadius:'50%', background:rc, boxShadow:`0 0 4px ${rc}` }} />

                {/* Item icon */}
                <div style={{ opacity: isOwned ? 1 : 0.4 }}>
                  <AvatarItemIcon itemId={item.id} slot={item.slot} size={52} rarity={item.rarity} />
                </div>

                {/* Name */}
                <span style={{ fontSize:10, fontWeight:600, textAlign:'center', color: isEquipped ? rc : '#ccc', lineHeight:1.2 }}>{item.name}</span>

                {/* Rarity label */}
                <span style={{ fontSize:8, color:rc, fontFamily:'Cinzel,serif', letterSpacing:1, textTransform:'uppercase' }}>{item.rarity}</span>

                {/* Status */}
                {item.id === 'hw_none' ? (
                  <span style={{ fontSize:9, color: !config.headwear ? '#FFB800' : '#555' }}>
                    {!config.headwear ? '✓ KEIN' : 'KEIN'}
                  </span>
                ) : isEquipped ? (
                  <span style={{ fontSize:9, color:'#FFB800', fontWeight:700, fontFamily:'Cinzel,serif' }}>✓ AKTIV</span>
                ) : isOwned ? (
                  <span style={{ fontSize:9, color:'#4ade80' }}>✓ BESESSEN</span>
                ) : (
                  <button
                    onClick={(e) => { e.stopPropagation(); buy(item as AvatarItem) }}
                    disabled={isBuying}
                    style={{
                      background: (profile?.coins || 0) >= item.price_coins ? '#FFB800' : '#333',
                      color: (profile?.coins || 0) >= item.price_coins ? '#000' : '#666',
                      border: 'none', borderRadius: 6, padding:'3px 8px',
                      fontSize:9, fontWeight:700, cursor:'pointer', fontFamily:'Cinzel,serif',
                    }}
                  >
                    {isBuying ? '...' : `🪙 ${item.price_coins}`}
                  </button>
                )}

                {/* Lock overlay */}
                {!isOwned && (
                  <div style={{ position:'absolute', top:0, left:0, right:0, bottom:0, borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.3)' }}>
                    <span style={{ fontSize:18 }}>🔒</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position:'fixed', bottom:100, left:'50%', transform:'translateX(-50%)',
          background:'#1A1A2E', border:'1px solid #FFB80044', borderRadius:12,
          padding:'10px 20px', color:'#FFB800', fontWeight:600, fontSize:13,
          zIndex:999, whiteSpace:'nowrap', boxShadow:'0 4px 20px rgba(0,0,0,0.5)',
        }}>{toast}</div>
      )}
    </div>
  )
}
