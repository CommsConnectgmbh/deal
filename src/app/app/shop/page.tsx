'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useLang } from '@/contexts/LanguageContext'
import { supabase } from '@/lib/supabase'

const RARITY_COLORS = {
  common:    '#9ca3af',
  rare:      '#60a5fa',
  epic:      '#a78bfa',
  legendary: '#FFB800',
}

type ShopSection = 'featured' | 'avatar' | 'stylePacks' | 'mysteryBoxes' | 'cosmetics' | 'coins' | 'premium'

const STATIC_FRAMES = [
  { id:'founder_carbon', name:'Founder Carbon', rarity:'legendary', coin_price:0, is_purchasable:false, icon:'🖤', desc:'Nur Season 1 Gründer', type:'frame' as const },
  { id:'midas_touch',    name:'The Midas Touch', rarity:'legendary', coin_price:500, is_purchasable:true, icon:'✨', desc:'Goldener Rahmen', type:'frame' as const },
  { id:'samurai_blade',  name:'Samurai Blade', rarity:'epic', coin_price:250, is_purchasable:true, icon:'⚔️', desc:'Scharfer epischer Rahmen', type:'frame' as const },
  { id:'epic_frame_v1',  name:'Eclipse', rarity:'epic', coin_price:250, is_purchasable:true, icon:'🌑', desc:'Mondfinsternis', type:'frame' as const },
  { id:'blue_steel',     name:'Blue Steel', rarity:'rare', coin_price:100, is_purchasable:true, icon:'🔷', desc:'Klassisch & clean', type:'frame' as const },
  { id:'rare_frame_v1',  name:'Iron Curtain', rarity:'rare', coin_price:100, is_purchasable:true, icon:'🪨', desc:'Seltener Schutzrahmen', type:'frame' as const },
  { id:'stone_cold',     name:'Stone Cold', rarity:'common', coin_price:50, is_purchasable:true, icon:'⬜', desc:'Minimalistisch', type:'frame' as const },
]
const STATIC_BADGES = [
  { id:'season1_founder', name:'Season 1 Founder', rarity:'legendary', coin_price:0, is_purchasable:false, icon:'👑', desc:'Erstes Kapitel', type:'badge' as const },
  { id:'untouchable',     name:'Untouchable', rarity:'epic', coin_price:0, is_purchasable:false, icon:'🛡️', desc:'10 Siege in Folge', type:'badge' as const },
  { id:'the_architect',   name:'The Architect', rarity:'rare', coin_price:0, is_purchasable:false, icon:'🏗️', desc:'50 Deals erstellt', type:'badge' as const },
]
const STATIC_TITLES = [
  { id:'title_dealmaker', name:'The Dealmaker', rarity:'common', coin_price:50, is_purchasable:true, icon:'🤝', desc:'Classic Dealmaker Title', type:'title' as const },
  { id:'title_legend',    name:'Legend', rarity:'epic', coin_price:300, is_purchasable:true, icon:'⭐', desc:'Legendary Status Title', type:'title' as const },
  { id:'title_founder',   name:'Founding Member', rarity:'legendary', coin_price:0, is_purchasable:false, icon:'👑', desc:'Season 1 Founder Exclusive', type:'title' as const },
]
const STATIC_CARDS = [
  { id:'rare_card_v1',  name:'Obsidian Card', rarity:'rare', coin_price:100, is_purchasable:true, icon:'🃏', desc:'Rare Card Skin', type:'card' as const },
  { id:'epic_card_v1',  name:'Gold Rush', rarity:'epic', coin_price:250, is_purchasable:true, icon:'🏆', desc:'Epic Gold Card Skin', type:'card' as const },
]

const FEATURED_ITEMS = [
  STATIC_FRAMES[1],  // Midas Touch
  STATIC_TITLES[1],  // Legend
  STATIC_CARDS[1],   // Gold Rush
]

interface AvatarItem {
  id: string
  slot: string
  name: string
  description: string
  rarity: 'common' | 'rare' | 'epic' | 'legendary'
  price_coins: number
  icon_emoji: string
  is_default: boolean
}
interface StylePack {
  id: string
  name: string
  description: string
  price_coins: number
  icon_emoji: string
  rarity: string
  items?: string[]
}
interface RewardBox {
  id: string
  name: string
  price_coins: number
  price_cents?: number
  icon_emoji: string
  rarity: string
  description: string
  loot?: LootEntry[]
}
interface LootEntry {
  reward_type: string
  reward_value: string
  weight: number
}

type CosmeticsSubTab = 'frames' | 'badges' | 'titles' | 'cards'

export default function ShopPage() {
  const { profile, refreshProfile } = useAuth()
  const { t, lang } = useLang()
  const searchParams = useSearchParams()
  const router = useRouter()

  const [section, setSection] = useState<ShopSection>('featured')
  const [cosSubTab, setCosSubTab] = useState<CosmeticsSubTab>('frames')
  const [inventory, setInventory] = useState<string[]>([])
  const [avatarInventory, setAvatarInventory] = useState<string[]>([])
  const [avatarConfig, setAvatarConfig] = useState<Record<string, string>>({})
  const [avatarItems, setAvatarItems] = useState<AvatarItem[]>([])
  const [stylePacks, setStylePacks] = useState<StylePack[]>([])
  const [rewardBoxes, setRewardBoxes] = useState<RewardBox[]>([])
  const [toast, setToast] = useState<string | null>(null)
  const [confirmItem, setConfirmItem] = useState<any | null>(null)
  const [boxResult, setBoxResult] = useState<any | null>(null)
  const [buying, setBuying] = useState<string | null>(null)
  const [stripeLoading, setStripeLoading] = useState<string | null>(null)
  const [avatarSlotFilter, setAvatarSlotFilter] = useState<string>('all')
  const [packOdds, setPackOdds] = useState<string | null>(null)

  const coins = profile?.coins ?? 0

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }, [])

  useEffect(() => {
    if (profile) {
      fetchInventory()
      fetchAvatarData()
      fetchShopData()
    }
  }, [profile])

  useEffect(() => {
    const success = searchParams.get('success')
    const product = searchParams.get('product')
    const sec = searchParams.get('section')
    if (success && product) {
      if (product === 'premium_pass') showToast('⭐ Premium Battle Pass aktiviert!')
      else if (product === 'legendary_box') showToast('🔥 Legendary Box eingelöst!')
      else showToast(`🪙 ${t('shop.purchaseSuccess')}`)
      refreshProfile()
    }
    if (sec === 'premium') setSection('premium')
    if (sec === 'coins') setSection('coins')
    if (sec === 'mysteryBoxes') setSection('mysteryBoxes')
  }, [searchParams])

  const fetchInventory = async () => {
    if (!profile) return
    const { data } = await supabase.from('user_inventory').select('cosmetic_id').eq('user_id', profile.id)
    const owned = (data || []).map((r: any) => r.cosmetic_id)
    if (profile.is_founder) {
      if (!owned.includes('founder_carbon')) owned.push('founder_carbon')
      if (!owned.includes('season1_founder')) owned.push('season1_founder')
      if (!owned.includes('title_founder')) owned.push('title_founder')
    }
    setInventory(owned)
  }

  const fetchAvatarData = async () => {
    if (!profile) return
    const [itemsRes, invRes, configRes] = await Promise.all([
      supabase.from('avatar_items').select('*').order('rarity'),
      supabase.from('user_avatar_inventory').select('item_id').eq('user_id', profile.id),
      supabase.from('avatar_config').select('*').eq('user_id', profile.id).single()
    ])
    setAvatarItems((itemsRes.data || []) as AvatarItem[])
    setAvatarInventory((invRes.data || []).map((r: any) => r.item_id))
    if (configRes.data) {
      setAvatarConfig({
        body: configRes.data.body,
        hair: configRes.data.hair,
        outfit: configRes.data.outfit,
        accessory: configRes.data.accessory,
      })
    }
  }

  const fetchShopData = async () => {
    const [packsRes, boxesRes] = await Promise.all([
      supabase.from('style_packs').select('*, style_pack_items(item_id)').eq('active', true),
      supabase.from('reward_boxes').select('*, reward_box_loot_table(reward_type,reward_value,weight)'),
    ])
    setStylePacks((packsRes.data || []).map((p: any) => ({
      ...p,
      items: (p.style_pack_items || []).map((i: any) => i.item_id)
    })))
    setRewardBoxes((boxesRes.data || []).map((b: any) => ({
      ...b,
      loot: b.reward_box_loot_table || []
    })))
  }

  const equipItem = async (item: any) => {
    if (!profile) return
    const field = item.type === 'frame' ? 'active_frame'
      : item.type === 'badge' ? 'active_badge'
      : item.type === 'title' ? 'active_title'
      : 'active_card'
    await supabase.from('profiles').update({ [field]: item.id }).eq('id', profile.id)
    await refreshProfile()
    showToast(`✓ ${item.name} ${t('shop.equipped')}`)
  }

  const buyWithCoins = async (item: any) => {
    if (!profile) return
    const price = item.coin_price ?? item.price_coins ?? 0
    if (coins < price) { showToast(t('shop.notEnoughCoins')); return }
    setBuying(item.id)
    try {
      await supabase.from('profiles').update({ coins: coins - price }).eq('id', profile.id)
      await supabase.from('wallet_ledger').insert({ user_id: profile.id, delta: -price, reason: 'cosmetic_purchase', reference_id: item.id })
      if (item.type === 'avatar_item') {
        await supabase.from('user_avatar_inventory').upsert({ user_id: profile.id, item_id: item.id }, { onConflict: 'user_id,item_id' })
        setAvatarInventory(prev => [...prev, item.id])
      } else {
        await supabase.from('user_inventory').upsert({ user_id: profile.id, cosmetic_id: item.id, source: 'purchase' }, { onConflict: 'user_id,cosmetic_id' })
        setInventory(prev => [...prev, item.id])
      }
      await refreshProfile()
      setConfirmItem(null)
      showToast(`✓ ${item.name} ${t('shop.purchaseSuccessText')}`)
    } catch (e) { console.error(e) }
    setBuying(null)
  }

  const buyWithStripe = async (productType: string) => {
    if (!profile) return
    setStripeLoading(productType)
    try {
      const res = await fetch('/api/create-stripe-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_type: productType, user_id: profile.id })
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
    } catch (e) { console.error(e) }
    setStripeLoading(null)
  }

  const openBox = async (box: any) => {
    if (!profile) return
    setBuying(box.id)
    setConfirmItem(null)
    try {
      const res = await supabase.functions.invoke('open-reward-box', { body: { box_id: box.id } })
      if (res.error) throw new Error(res.error.message)
      await refreshProfile()
      await fetchAvatarData()
      await fetchInventory()
      setBoxResult(res.data)
    } catch (e: any) {
      showToast(e.message || 'Error opening box')
    }
    setBuying(null)
  }

  const buyStylePack = async (pack: any) => {
    if (!profile) return
    setBuying(pack.id)
    setConfirmItem(null)
    try {
      const res = await supabase.functions.invoke('purchase-style-pack', { body: { pack_id: pack.id } })
      if (res.error) throw new Error(res.error.message)
      await refreshProfile()
      await fetchAvatarData()
      await fetchInventory()
      showToast(`🎁 ${pack.name} ${lang === 'de' ? 'erhalten!' : 'purchased!'}`)
    } catch (e: any) {
      showToast(e.message || 'Error purchasing pack')
    }
    setBuying(null)
  }

  const isOwned = (id: string) => inventory.includes(id)
  const isAvatarOwned = (id: string) => avatarInventory.includes(id)
  const isEquipped = (id: string, type: string) => {
    if (type === 'frame') return profile?.active_frame === id
    if (type === 'badge') return profile?.active_badge === id
    if (type === 'title') return (profile as any)?.active_title === id
    if (type === 'card') return (profile as any)?.active_card === id
    return false
  }

  const SECTIONS: { key: ShopSection; label: string; emoji: string }[] = [
    { key: 'featured',     label: t('shop.sections.featured'),     emoji: '⭐' },
    { key: 'avatar',       label: t('shop.sections.avatar'),       emoji: '🧑' },
    { key: 'stylePacks',   label: t('shop.sections.stylePacks'),   emoji: '🎁' },
    { key: 'mysteryBoxes', label: t('shop.sections.mysteryBoxes'), emoji: '📦' },
    { key: 'cosmetics',    label: t('shop.sections.cosmetics'),    emoji: '✨' },
    { key: 'coins',        label: t('shop.sections.coins'),        emoji: '🪙' },
    { key: 'premium',      label: t('shop.sections.premium'),      emoji: '👑' },
  ]

  const renderItem = (item: any) => {
    const rc = RARITY_COLORS[item.rarity as keyof typeof RARITY_COLORS] || '#9ca3af'
    const owned = item.type === 'avatar_item' ? isAvatarOwned(item.id) : isOwned(item.id)
    const equipped = isEquipped(item.id, item.type)
    const price = item.coin_price ?? item.price_coins ?? 0
    const canBuy = !owned && price > 0 && item.is_purchasable !== false

    return (
      <div key={item.id} style={{ background: '#111', borderRadius: 14, border: `1px solid ${equipped ? 'rgba(255,184,0,0.4)' : rc + '33'}`, padding: '14px 12px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        {equipped && <div style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(255,184,0,0.2)', borderRadius: 6, padding: '2px 8px', border: '1px solid rgba(255,184,0,0.4)' }}><span className='font-display' style={{ fontSize: 7, color: '#FFB800' }}>✓ ON</span></div>}
        {owned && !equipped && <div style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(74,222,128,0.15)', borderRadius: 6, padding: '2px 8px', border: '1px solid rgba(74,222,128,0.3)' }}><span className='font-display' style={{ fontSize: 7, color: '#4ade80' }}>{t('shop.owned').toUpperCase()}</span></div>}
        <div style={{ fontSize: 34, marginBottom: 8, filter: `drop-shadow(0 0 6px ${rc})` }}>{item.icon || item.icon_emoji}</div>
        <p className='font-display' style={{ fontSize: 10, color: '#f0ece4', marginBottom: 3, lineHeight: 1.3 }}>{item.name}</p>
        <div style={{ display: 'inline-block', padding: '2px 6px', borderRadius: 8, background: `${rc}18`, border: `1px solid ${rc}44`, marginBottom: 8 }}>
          <span className='font-display' style={{ fontSize: 7, letterSpacing: 1, color: rc }}>{item.rarity?.toUpperCase()}</span>
        </div>
        <p style={{ fontSize: 11, color: 'rgba(240,236,228,0.4)', marginBottom: 10, lineHeight: 1.3 }}>{item.desc || item.description}</p>
        {equipped ? (
          <div style={{ width: '100%', padding: '7px', borderRadius: 8, background: 'rgba(255,184,0,0.08)', color: '#FFB800', fontFamily: 'Cinzel, serif', fontSize: 8, textAlign: 'center', border: '1px solid rgba(255,184,0,0.3)' }}>✓ {t('shop.equipped').toUpperCase()}</div>
        ) : owned ? (
          <button onClick={() => item.type === 'avatar_item' ? router.push('/app/avatar') : equipItem(item)} style={{ width: '100%', padding: '7px', borderRadius: 8, border: '1px solid rgba(74,222,128,0.3)', background: 'rgba(74,222,128,0.08)', color: '#4ade80', fontFamily: 'Cinzel, serif', fontSize: 8, cursor: 'pointer' }}>{t('shop.equip').toUpperCase()}</button>
        ) : canBuy ? (
          <button onClick={() => setConfirmItem(item)} style={{ width: '100%', padding: '7px', borderRadius: 8, border: `1px solid ${rc}44`, background: `${rc}15`, color: rc, fontFamily: 'Cinzel, serif', fontSize: 8, cursor: coins >= price ? 'pointer' : 'default', opacity: coins >= price ? 1 : 0.6 }}>🪙 {price}</button>
        ) : (
          <div style={{ width: '100%', padding: '7px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(240,236,228,0.25)', fontFamily: 'Cinzel, serif', fontSize: 8, textAlign: 'center' }}>{lang === 'de' ? 'VERDIENT' : 'EARNED'}</div>
        )}
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100dvh', background: '#060606', paddingTop: 60, paddingBottom: 100 }}>
      {toast && (
        <div style={{ position: 'fixed', top: 80, left: '50%', transform: 'translateX(-50%)', background: 'linear-gradient(135deg, #CC8800, #FFB800)', borderRadius: 12, padding: '10px 20px', zIndex: 300, whiteSpace: 'nowrap', boxShadow: '0 8px 24px rgba(255,184,0,0.3)' }}>
          <span style={{ fontFamily: 'Cinzel, serif', fontSize: 12, color: '#000', fontWeight: 700 }}>{toast}</span>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 20px 12px' }}>
        <h1 className='font-display' style={{ fontSize: 26, color: '#f0ece4' }}>{t('shop.title')}</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#111', borderRadius: 20, padding: '6px 14px', border: '1px solid rgba(255,184,0,0.15)' }}>
          <span style={{ fontSize: 14 }}>🪙</span>
          <span className='font-display' style={{ fontSize: 14, color: '#FFB800' }}>{coins.toLocaleString()}</span>
        </div>
      </div>

      {/* Section Tabs */}
      <div style={{ overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
        <div style={{ display: 'flex', gap: 8, padding: '0 16px 12px', minWidth: 'max-content' }}>
          {SECTIONS.map(s => (
            <button key={s.key} onClick={() => setSection(s.key)} style={{ padding: '8px 14px', borderRadius: 20, border: section === s.key ? '1px solid rgba(255,184,0,0.5)' : '1px solid rgba(255,255,255,0.08)', background: section === s.key ? 'rgba(255,184,0,0.15)' : '#111', color: section === s.key ? '#FFB800' : 'rgba(240,236,228,0.5)', fontFamily: 'Cinzel, serif', fontSize: 10, letterSpacing: 0.5, cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', gap: 6, alignItems: 'center' }}>
              <span>{s.emoji}</span><span>{s.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── FEATURED ── */}
      {section === 'featured' && (
        <div style={{ padding: '0 16px' }}>
          <p className='font-display' style={{ fontSize: 9, letterSpacing: 3, color: 'rgba(240,236,228,0.4)', marginBottom: 16 }}>⭐ {t('shop.sections.featured').toUpperCase()}</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
            {FEATURED_ITEMS.map(item => renderItem(item))}
          </div>
          <div style={{ background: 'linear-gradient(135deg, rgba(167,139,250,0.1), rgba(96,165,250,0.05))', borderRadius: 14, border: '1px solid rgba(167,139,250,0.2)', padding: 16 }}>
            <p className='font-display' style={{ fontSize: 11, color: '#a78bfa', marginBottom: 6, letterSpacing: 2 }}>📦 MYSTERY BOXES</p>
            <p style={{ fontSize: 12, color: 'rgba(240,236,228,0.5)', marginBottom: 12, lineHeight: 1.5 }}>
              {lang === 'de' ? 'Öffne Mystery Boxes für zufällige Cosmetics, Coins & mehr!' : 'Open Mystery Boxes for random cosmetics, coins & more!'}
            </p>
            <button onClick={() => setSection('mysteryBoxes')} style={{ padding: '10px 20px', borderRadius: 10, border: '1px solid rgba(167,139,250,0.3)', background: 'rgba(167,139,250,0.1)', color: '#a78bfa', fontFamily: 'Cinzel, serif', fontSize: 10, cursor: 'pointer', letterSpacing: 1 }}>
              {lang === 'de' ? 'BOXES ANSEHEN →' : 'VIEW BOXES →'}
            </button>
          </div>
        </div>
      )}

      {/* ── AVATAR ── */}
      {section === 'avatar' && (
        <div style={{ padding: '0 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <p className='font-display' style={{ fontSize: 9, letterSpacing: 3, color: 'rgba(240,236,228,0.4)' }}>🧑 {t('shop.sections.avatar').toUpperCase()}</p>
            <button onClick={() => router.push('/app/avatar')} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(255,184,0,0.2)', background: 'rgba(255,184,0,0.06)', color: '#FFB800', fontFamily: 'Cinzel, serif', fontSize: 9, cursor: 'pointer' }}>EDITOR →</button>
          </div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 16, overflowX: 'auto', scrollbarWidth: 'none' }}>
            {['all', 'body', 'hair', 'outfit', 'accessory'].map(slot => (
              <button key={slot} onClick={() => setAvatarSlotFilter(slot)} style={{ padding: '6px 12px', borderRadius: 16, whiteSpace: 'nowrap', border: avatarSlotFilter === slot ? '1px solid rgba(255,184,0,0.4)' : '1px solid rgba(255,255,255,0.08)', background: avatarSlotFilter === slot ? 'rgba(255,184,0,0.12)' : 'transparent', color: avatarSlotFilter === slot ? '#FFB800' : 'rgba(240,236,228,0.4)', fontFamily: 'Cinzel, serif', fontSize: 9, cursor: 'pointer' }}>
                {slot === 'all' ? (lang === 'de' ? 'ALLE' : 'ALL') : slot.toUpperCase()}
              </button>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {avatarItems
              .filter(i => avatarSlotFilter === 'all' || i.slot === avatarSlotFilter)
              .map(item => renderItem({ ...item, type: 'avatar_item', icon: item.icon_emoji, desc: item.description, coin_price: item.price_coins, is_purchasable: !item.is_default }))}
          </div>
        </div>
      )}

      {/* ── STYLE PACKS ── */}
      {section === 'stylePacks' && (
        <div style={{ padding: '0 16px' }}>
          <p className='font-display' style={{ fontSize: 9, letterSpacing: 3, color: 'rgba(240,236,228,0.4)', marginBottom: 16 }}>🎁 {t('shop.sections.stylePacks').toUpperCase()}</p>
          {stylePacks.length === 0 ? (
            <p style={{ color: 'rgba(240,236,228,0.3)', textAlign: 'center', fontFamily: 'Cinzel, serif', fontSize: 11 }}>Loading...</p>
          ) : stylePacks.map(pack => {
            const rc = RARITY_COLORS[pack.rarity as keyof typeof RARITY_COLORS] || '#9ca3af'
            const allOwned = (pack.items || []).every((id: string) => inventory.includes(id) || avatarInventory.includes(id))
            return (
              <div key={pack.id} style={{ background: '#111', borderRadius: 14, border: `1px solid ${rc}33`, padding: 16, marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <span style={{ fontSize: 32, filter: `drop-shadow(0 0 8px ${rc})` }}>{pack.icon_emoji}</span>
                    <div>
                      <p className='font-display' style={{ fontSize: 13, color: '#f0ece4', marginBottom: 4 }}>{pack.name}</p>
                      <div style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 8, background: `${rc}18`, border: `1px solid ${rc}44` }}>
                        <span className='font-display' style={{ fontSize: 7, color: rc }}>{pack.rarity?.toUpperCase()}</span>
                      </div>
                    </div>
                  </div>
                  {allOwned ? (
                    <div style={{ background: 'rgba(74,222,128,0.1)', borderRadius: 8, padding: '4px 12px', border: '1px solid rgba(74,222,128,0.3)' }}>
                      <span style={{ color: '#4ade80', fontSize: 10, fontFamily: 'Cinzel, serif' }}>✓ {t('shop.stylePack.owned').toUpperCase()}</span>
                    </div>
                  ) : (
                    <span className='font-display' style={{ fontSize: 16, color: '#FFB800', fontWeight: 700 }}>🪙 {pack.price_coins}</span>
                  )}
                </div>
                <p style={{ fontSize: 12, color: 'rgba(240,236,228,0.5)', marginBottom: 12, lineHeight: 1.5 }}>{pack.description}</p>
                <p style={{ fontSize: 10, color: 'rgba(240,236,228,0.3)', marginBottom: 8, fontFamily: 'Cinzel, serif', letterSpacing: 1 }}>{t('shop.stylePack.contents').toUpperCase()}: {(pack.items || []).length} {t('shop.stylePack.items')}</p>
                {!allOwned && (
                  <button
                    onClick={() => setConfirmItem({ ...pack, type: 'style_pack', coin_price: pack.price_coins, icon: pack.icon_emoji })}
                    style={{ width: '100%', padding: '12px', borderRadius: 10, border: `1px solid ${rc}44`, background: `${rc}18`, color: rc, fontFamily: 'Cinzel, serif', fontSize: 10, cursor: coins >= pack.price_coins ? 'pointer' : 'default', opacity: coins >= pack.price_coins ? 1 : 0.6, letterSpacing: 1 }}
                  >
                    {buying === pack.id ? '...' : `🎁 ${t('shop.stylePack.buy').toUpperCase()} · 🪙 ${pack.price_coins}`}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── MYSTERY BOXES ── */}
      {section === 'mysteryBoxes' && (
        <div style={{ padding: '0 16px' }}>
          <p className='font-display' style={{ fontSize: 9, letterSpacing: 3, color: 'rgba(240,236,228,0.4)', marginBottom: 16 }}>📦 {t('shop.sections.mysteryBoxes').toUpperCase()}</p>
          {rewardBoxes.length === 0 ? (
            <p style={{ color: 'rgba(240,236,228,0.3)', textAlign: 'center', fontFamily: 'Cinzel, serif', fontSize: 11 }}>Loading...</p>
          ) : rewardBoxes.map(box => {
            const rc = RARITY_COLORS[box.rarity as keyof typeof RARITY_COLORS] || '#9ca3af'
            const totalWeight = (box.loot || []).reduce((s, l) => s + l.weight, 0)
            return (
              <div key={box.id} style={{ background: '#111', borderRadius: 14, border: `1px solid ${rc}33`, padding: 16, marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <span style={{ fontSize: 36, filter: `drop-shadow(0 0 10px ${rc})` }}>{box.icon_emoji}</span>
                    <div>
                      <p className='font-display' style={{ fontSize: 13, color: '#f0ece4', marginBottom: 4 }}>{box.name}</p>
                      <div style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 8, background: `${rc}18`, border: `1px solid ${rc}44` }}>
                        <span className='font-display' style={{ fontSize: 7, color: rc }}>{box.rarity?.toUpperCase()}</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p className='font-display' style={{ fontSize: 16, color: '#FFB800' }}>🪙 {box.price_coins}</p>
                    {box.price_cents && <p style={{ fontSize: 10, color: 'rgba(240,236,228,0.4)' }}>or {(box.price_cents / 100).toFixed(2)}€</p>}
                  </div>
                </div>
                <p style={{ fontSize: 12, color: 'rgba(240,236,228,0.5)', marginBottom: 12, lineHeight: 1.5 }}>{box.description}</p>
                <button onClick={() => setPackOdds(packOdds === box.id ? null : box.id)} style={{ background: 'transparent', border: 'none', color: 'rgba(240,236,228,0.4)', fontFamily: 'Cinzel, serif', fontSize: 9, cursor: 'pointer', marginBottom: 8, letterSpacing: 1 }}>
                  {packOdds === box.id ? '▲' : '▼'} {t('shop.rewardBox.odds').toUpperCase()}
                </button>
                {packOdds === box.id && (
                  <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: 10, marginBottom: 12 }}>
                    {(box.loot || []).map((l, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: i < (box.loot || []).length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                        <span style={{ fontSize: 11, color: 'rgba(240,236,228,0.5)' }}>{l.reward_type === 'coins' ? `🪙 ${l.reward_value}` : l.reward_value.replace(/_/g, ' ')}</span>
                        <span style={{ fontSize: 11, color: 'rgba(240,236,228,0.35)', fontFamily: 'Cinzel, serif' }}>{totalWeight > 0 ? ((l.weight / totalWeight) * 100).toFixed(1) : 0}%</span>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => setConfirmItem({ ...box, type: 'reward_box', coin_price: box.price_coins, icon: box.icon_emoji })}
                    disabled={buying === box.id}
                    style={{ flex: 1, padding: '12px', borderRadius: 10, border: `1px solid ${rc}44`, background: `${rc}18`, color: rc, fontFamily: 'Cinzel, serif', fontSize: 10, cursor: coins >= box.price_coins ? 'pointer' : 'default', opacity: coins >= box.price_coins ? 1 : 0.6, letterSpacing: 1 }}
                  >
                    {buying === box.id ? t('shop.rewardBox.opening') : `${t('shop.rewardBox.open')} · 🪙 ${box.price_coins}`}
                  </button>
                  {box.price_cents && (
                    <button onClick={() => buyWithStripe('legendary_box')} disabled={!!stripeLoading} style={{ padding: '12px 16px', borderRadius: 10, border: '1px solid rgba(255,184,0,0.3)', background: 'rgba(255,184,0,0.1)', color: '#FFB800', fontFamily: 'Cinzel, serif', fontSize: 10, cursor: 'pointer' }}>
                      {stripeLoading === 'legendary_box' ? '...' : `${(box.price_cents / 100).toFixed(2)}€`}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── COSMETICS ── */}
      {section === 'cosmetics' && (
        <div style={{ padding: '0 16px' }}>
          <p className='font-display' style={{ fontSize: 9, letterSpacing: 3, color: 'rgba(240,236,228,0.4)', marginBottom: 12 }}>✨ {t('shop.sections.cosmetics').toUpperCase()}</p>
          <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
            {(['frames', 'badges', 'titles', 'cards'] as CosmeticsSubTab[]).map(sub => (
              <button key={sub} onClick={() => setCosSubTab(sub)} style={{ flex: 1, padding: '8px 4px', borderRadius: 8, border: cosSubTab === sub ? '1px solid rgba(255,184,0,0.25)' : '1px solid rgba(255,255,255,0.06)', background: cosSubTab === sub ? 'rgba(255,184,0,0.1)' : 'transparent', color: cosSubTab === sub ? '#FFB800' : 'rgba(240,236,228,0.4)', fontFamily: 'Cinzel, serif', fontSize: 9, cursor: 'pointer' }}>
                {(lang === 'de' ? { frames: 'FRAMES', badges: 'BADGES', titles: 'TITEL', cards: 'CARDS' } : { frames: 'FRAMES', badges: 'BADGES', titles: 'TITLES', cards: 'CARDS' })[sub]}
              </button>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {cosSubTab === 'frames' && STATIC_FRAMES.map(i => renderItem(i))}
            {cosSubTab === 'badges' && STATIC_BADGES.map(i => renderItem(i))}
            {cosSubTab === 'titles' && STATIC_TITLES.map(i => renderItem(i))}
            {cosSubTab === 'cards' && STATIC_CARDS.map(i => renderItem(i))}
          </div>
        </div>
      )}

      {/* ── COINS ── */}
      {section === 'coins' && (
        <div style={{ padding: '0 16px' }}>
          <p className='font-display' style={{ fontSize: 9, letterSpacing: 3, color: 'rgba(240,236,228,0.4)', marginBottom: 16 }}>🪙 {t('shop.coinPacks').toUpperCase()}</p>
          {[
            { type: 'coin_pack_xs', coins: 500,   price: '2,99€', label: t('shop.coinPackXs'), badge: null },
            { type: 'coin_pack_sm', coins: 2000,  price: '9,99€', label: t('shop.coinPackSm'), badge: t('shop.mostPopular') },
            { type: 'coin_pack_md', coins: 4500,  price: '19,99€', label: t('shop.coinPackMd'), badge: t('shop.bestValue') },
            { type: 'coin_pack_lg', coins: 12000, price: '49,99€', label: t('shop.coinPackLg'), badge: null },
          ].map(pack => (
            <div key={pack.type} style={{ background: '#111', borderRadius: 14, border: '1px solid rgba(255,255,255,0.07)', padding: '16px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 16, position: 'relative', overflow: 'hidden' }}>
              {pack.badge && (
                <div style={{ position: 'absolute', top: 0, right: 0, background: '#FFB800', padding: '3px 10px', borderRadius: '0 14px 0 8px' }}>
                  <span style={{ fontFamily: 'Cinzel, serif', fontSize: 8, color: '#000', fontWeight: 700 }}>{pack.badge}</span>
                </div>
              )}
              <div style={{ fontSize: 36, flexShrink: 0 }}>🪙</div>
              <div style={{ flex: 1 }}>
                <p className='font-display' style={{ fontSize: 14, color: '#FFB800', marginBottom: 2 }}>{pack.coins.toLocaleString()} Coins</p>
                <p style={{ fontSize: 12, color: 'rgba(240,236,228,0.5)' }}>{pack.label}</p>
              </div>
              <button onClick={() => buyWithStripe(pack.type)} disabled={!!stripeLoading} style={{ flexShrink: 0, padding: '12px 16px', borderRadius: 10, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, #CC8800, #FFB800)', color: '#000', fontFamily: 'Cinzel, serif', fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>
                {stripeLoading === pack.type ? '...' : pack.price}
              </button>
            </div>
          ))}
          <p style={{ fontSize: 11, color: 'rgba(240,236,228,0.25)', textAlign: 'center', marginTop: 16, fontFamily: 'Cinzel, serif', letterSpacing: 1 }}>🔒 {t('shop.stripeNote')}</p>
        </div>
      )}

      {/* ── PREMIUM ── */}
      {section === 'premium' && (
        <div style={{ padding: '0 16px' }}>
          <p className='font-display' style={{ fontSize: 9, letterSpacing: 3, color: 'rgba(240,236,228,0.4)', marginBottom: 16 }}>👑 {t('shop.sections.premium').toUpperCase()}</p>
          {!profile?.battle_pass_premium ? (
            <div style={{ background: 'linear-gradient(135deg, rgba(255,184,0,0.12), rgba(255,229,102,0.06))', borderRadius: 14, border: '1px solid rgba(255,184,0,0.3)', padding: 20, marginBottom: 16 }}>
              <p style={{ fontSize: 40, textAlign: 'center', marginBottom: 12 }}>⭐</p>
              <p className='font-display' style={{ fontSize: 16, color: '#FFB800', textAlign: 'center', marginBottom: 8 }}>PREMIUM BATTLE PASS</p>
              <p style={{ fontSize: 13, color: 'rgba(240,236,228,0.6)', textAlign: 'center', lineHeight: 1.6, marginBottom: 16 }}>
                {lang === 'de' ? 'Alle 30 Tiers · Exklusive Cosmetics · Season 1 Founder Status · Bonus XP' : 'All 30 Tiers · Exclusive Cosmetics · Season 1 Founder Status · Bonus XP'}
              </p>
              <button onClick={() => buyWithStripe('premium_pass')} disabled={!!stripeLoading} style={{ width: '100%', padding: 16, borderRadius: 12, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, #CC8800, #FFB800)', color: '#000', fontFamily: 'Cinzel, serif', fontSize: 12, fontWeight: 700, letterSpacing: 2 }}>
                {stripeLoading === 'premium_pass' ? t('shop.redirecting') : `PREMIUM HOLEN · 9,99€`}
              </button>
            </div>
          ) : (
            <div style={{ background: 'rgba(74,222,128,0.06)', borderRadius: 14, border: '1px solid rgba(74,222,128,0.2)', padding: 20, marginBottom: 16, textAlign: 'center' }}>
              <p style={{ fontSize: 32, marginBottom: 8 }}>⭐</p>
              <p className='font-display' style={{ fontSize: 13, color: '#4ade80', letterSpacing: 2 }}>{t('battlepass.premiumUnlocked')}</p>
            </div>
          )}
          <div style={{ background: '#111', borderRadius: 14, border: '1px solid rgba(255,184,0,0.15)', padding: 16 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 36, filter: 'drop-shadow(0 0 10px #FFB800)' }}>🔥</span>
              <div>
                <p className='font-display' style={{ fontSize: 13, color: '#f0ece4', marginBottom: 4 }}>Legendary Mystery Box</p>
                <p style={{ fontSize: 12, color: 'rgba(240,236,228,0.5)' }}>{lang === 'de' ? 'Garantierter epischer oder legendärer Reward' : 'Guaranteed epic or legendary reward'}</p>
              </div>
            </div>
            <button onClick={() => buyWithStripe('legendary_box')} disabled={!!stripeLoading} style={{ width: '100%', padding: 14, borderRadius: 10, border: '1px solid rgba(255,184,0,0.3)', background: 'rgba(255,184,0,0.1)', color: '#FFB800', fontFamily: 'Cinzel, serif', fontSize: 11, cursor: 'pointer', letterSpacing: 1 }}>
              {stripeLoading === 'legendary_box' ? t('shop.redirecting') : `🔥 LEGENDARY BOX · 4,99€`}
            </button>
          </div>
        </div>
      )}

      {/* Confirm Purchase Modal */}
      {confirmItem && !boxResult && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'flex-end', zIndex: 200 }} onClick={() => setConfirmItem(null)}>
          <div style={{ width: '100%', maxWidth: 430, margin: '0 auto', background: '#111', borderRadius: '20px 20px 0 0', border: '1px solid rgba(255,184,0,0.15)', padding: '24px 20px 48px' }} onClick={e => e.stopPropagation()}>
            <div style={{ textAlign: 'center', fontSize: 48, marginBottom: 12 }}>{confirmItem.icon || confirmItem.icon_emoji}</div>
            <h3 className='font-display' style={{ fontSize: 18, color: '#FFB800', textAlign: 'center', marginBottom: 8 }}>
              {confirmItem.type === 'reward_box' ? (lang === 'de' ? 'Box öffnen?' : 'Open box?') : t('shop.confirmPurchase')}
            </h3>
            <p style={{ textAlign: 'center', fontSize: 14, color: 'rgba(240,236,228,0.6)', marginBottom: 20 }}>
              {t('shop.confirmPurchaseText')} <strong style={{ color: '#FFB800' }}>{confirmItem.coin_price} 🪙</strong> {confirmItem.type !== 'reward_box' && t('shop.confirmPurchaseCoins')}
            </p>
            {coins < confirmItem.coin_price && (
              <div style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 10, padding: 12, marginBottom: 16, textAlign: 'center' }}>
                <p style={{ color: '#f87171', fontSize: 13 }}>{t('shop.notEnoughCoins')}</p>
              </div>
            )}
            <button
              onClick={() => {
                if (confirmItem.type === 'reward_box') openBox(confirmItem)
                else if (confirmItem.type === 'style_pack') buyStylePack(confirmItem)
                else buyWithCoins(confirmItem)
              }}
              disabled={buying !== null || coins < confirmItem.coin_price}
              style={{ width: '100%', padding: 16, borderRadius: 12, border: 'none', cursor: coins >= confirmItem.coin_price ? 'pointer' : 'default', background: coins >= confirmItem.coin_price ? 'linear-gradient(135deg, #CC8800, #FFB800)' : 'rgba(255,184,0,0.1)', color: coins >= confirmItem.coin_price ? '#000' : 'rgba(255,184,0,0.4)', fontFamily: 'Cinzel, serif', fontSize: 12, fontWeight: 700, letterSpacing: 2, marginBottom: 10 }}
            >
              {buying ? t('shop.processing') : `${t('shop.buy').toUpperCase()} · ${confirmItem.coin_price} 🪙`}
            </button>
            <button onClick={() => setConfirmItem(null)} style={{ width: '100%', padding: 14, borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(240,236,228,0.5)', fontFamily: 'Cinzel, serif', fontSize: 11, cursor: 'pointer' }}>
              {lang === 'de' ? 'ABBRECHEN' : 'CANCEL'}
            </button>
          </div>
        </div>
      )}

      {/* Box Result Modal */}
      {boxResult && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 250, padding: 20 }}>
          <div style={{ background: '#111', borderRadius: 20, border: '1px solid rgba(255,184,0,0.3)', padding: 32, textAlign: 'center', maxWidth: 340, width: '100%', boxShadow: '0 0 60px rgba(255,184,0,0.2)' }}>
            <div style={{ fontSize: 64, marginBottom: 16, filter: 'drop-shadow(0 0 20px #FFB800)' }}>{boxResult.item_emoji}</div>
            <p className='font-display' style={{ fontSize: 10, letterSpacing: 3, color: 'rgba(240,236,228,0.4)', marginBottom: 8 }}>{t('shop.rewardBox.youGot').toUpperCase()}</p>
            <p className='font-display' style={{ fontSize: 22, color: '#FFB800', marginBottom: 8 }}>{boxResult.item_name}</p>
            <p style={{ fontSize: 13, color: 'rgba(240,236,228,0.5)', marginBottom: 24 }}>
              {boxResult.reward_type === 'coins' && (lang === 'de' ? `${boxResult.qty} Coins erhalten!` : `${boxResult.qty} coins credited!`)}
              {boxResult.reward_type === 'cosmetic' && (lang === 'de' ? 'Zu deinem Inventar hinzugefügt' : 'Added to your inventory')}
              {boxResult.reward_type === 'avatar_item' && (lang === 'de' ? 'Avatar Item freigeschaltet' : 'Avatar item unlocked')}
              {boxResult.reward_type === 'battle_pass_xp' && `${boxResult.qty} Battle Pass XP`}
            </p>
            <button onClick={() => setBoxResult(null)} style={{ width: '100%', padding: 16, borderRadius: 12, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, #CC8800, #FFB800)', color: '#000', fontFamily: 'Cinzel, serif', fontSize: 12, fontWeight: 700, letterSpacing: 2 }}>
              {lang === 'de' ? 'WEITER' : 'CONTINUE'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
