'use client'
import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useLang } from '@/contexts/LanguageContext'
import { supabase } from '@/lib/supabase'

const RARITY_COLORS = {
  common:    '#9ca3af',
  rare:      '#60a5fa',
  epic:      '#a78bfa',
  legendary: '#FFB800',
}

type ShopTab = 'frames' | 'badges' | 'cards' | 'coins'

const STATIC_FRAMES = [
  { id:'founder_carbon', name:'Founder Carbon', rarity:'legendary', coin_price:0, is_purchasable:false, icon:'🖤', desc:'Nur Season 1 Gründer' },
  { id:'midas_touch',    name:'The Midas Touch', rarity:'legendary', coin_price:500, is_purchasable:true, icon:'✨', desc:'Goldener Rahmen mit Funken' },
  { id:'samurai_blade',  name:'Samurai Blade', rarity:'epic', coin_price:250, is_purchasable:true, icon:'⚔️', desc:'Scharfer epischer Rahmen' },
  { id:'epic_frame_v1',  name:'Eclipse', rarity:'epic', coin_price:250, is_purchasable:true, icon:'🌑', desc:'Mondfinsternis-Rahmen' },
  { id:'blue_steel',     name:'Blue Steel', rarity:'rare', coin_price:100, is_purchasable:true, icon:'🔷', desc:'Klassisch & clean' },
  { id:'rare_frame_v1',  name:'Iron Curtain', rarity:'rare', coin_price:100, is_purchasable:true, icon:'🪨', desc:'Seltener Schutzrahmen' },
  { id:'rare_frame_v2',  name:'Shadow Edge', rarity:'rare', coin_price:100, is_purchasable:true, icon:'🌑', desc:'Dunkler Seltener Rahmen' },
  { id:'stone_cold',     name:'Stone Cold', rarity:'common', coin_price:50, is_purchasable:true, icon:'⬜', desc:'Minimalistisch' },
]
const STATIC_BADGES = [
  { id:'season1_founder', name:'Season 1 Founder', rarity:'legendary', coin_price:0, is_purchasable:false, icon:'👑', desc:'Erstes Kapitel' },
  { id:'untouchable',     name:'Untouchable', rarity:'epic', coin_price:0, is_purchasable:false, icon:'🛡️', desc:'10 Siege in Folge' },
  { id:'epic_badge_v1',   name:'Rival King', rarity:'epic', coin_price:0, is_purchasable:false, icon:'⚔️', desc:'Legendary Rival' },
  { id:'the_architect',   name:'The Architect', rarity:'rare', coin_price:0, is_purchasable:false, icon:'🏗️', desc:'50 Deals erstellt' },
  { id:'rare_badge_v1',   name:'Contender', rarity:'rare', coin_price:0, is_purchasable:false, icon:'🥊', desc:'Season Contender' },
]
const STATIC_CARDS = [
  { id:'rare_card_v1',  name:'Obsidian Card', rarity:'rare', coin_price:100, is_purchasable:true, icon:'🃏', desc:'Seltene schwarze Card-Skin' },
  { id:'epic_card_v1',  name:'Gold Rush', rarity:'epic', coin_price:250, is_purchasable:true, icon:'🏆', desc:'Epische Gold Card-Skin' },
]

export default function ShopPage() {
  const { profile, refreshProfile } = useAuth()
  const { t, lang } = useLang()
  const searchParams = useSearchParams()
  const [tab, setTab] = useState<ShopTab>('frames')
  const [inventory, setInventory] = useState<string[]>([])
  const [equippedFrame, setEquippedFrame] = useState(profile?.active_frame || '')
  const [toast, setToast] = useState<string | null>(null)
  const [confirmItem, setConfirmItem] = useState<any | null>(null)
  const [buying, setBuying] = useState(false)
  const [stripeLoading, setStripeLoading] = useState<string | null>(null)

  const coins = profile?.coins ?? 0

  useEffect(() => {
    if (profile) {
      fetchInventory()
      setEquippedFrame(profile.active_frame || '')
    }
  }, [profile])

  useEffect(() => {
    const success = searchParams.get('success')
    const product = searchParams.get('product')
    const section = searchParams.get('section')
    if (success && product) {
      setToast(product === 'premium_pass' ? '⭐ Premium Battle Pass aktiviert!' : `🪙 ${t('shop.purchaseSuccess')}`)
      setTimeout(() => setToast(null), 5000)
    }
    if (section === 'premium') setTab('coins')
  }, [searchParams])

  const fetchInventory = async () => {
    const { data } = await supabase
      .from('user_inventory')
      .select('cosmetic_id')
      .eq('user_id', profile!.id)
    const owned = (data || []).map((r: any) => r.cosmetic_id)
    if (profile?.is_founder) {
      if (!owned.includes('founder_carbon')) owned.push('founder_carbon')
      if (!owned.includes('season1_founder')) owned.push('season1_founder')
    }
    setInventory(owned)
  }

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const equipItem = async (item: any) => {
    if (!profile) return
    const updates: Record<string, string> = { active_frame: item.id }
    if (item.type === 'frame') {
      setEquippedFrame(item.id)
    }
    await supabase.from('profiles').update(updates).eq('id', profile.id)
    await refreshProfile()
    showToast(`${t('shop.equipSuccess')} ${item.name}`)
  }

  const buyWithCoins = async (item: any) => {
    if (!profile) return
    if (coins < item.coin_price) { showToast(t('shop.notEnoughCoins')); return }
    setBuying(true)
    try {
      await supabase.from('profiles').update({ coins: coins - item.coin_price }).eq('id', profile.id)
      await supabase.from('wallet_ledger').insert({
        user_id: profile.id,
        delta: -item.coin_price,
        reason: 'equip_purchase',
        reference_id: item.id
      })
      await supabase.from('user_inventory').upsert({
        user_id: profile.id,
        cosmetic_id: item.id,
        source: 'purchase'
      }, { onConflict: 'user_id,cosmetic_id' })
      setInventory(prev => [...prev, item.id])
      await refreshProfile()
      setConfirmItem(null)
      showToast(`✓ ${item.name} ${t('shop.purchaseSuccessText')}`)
    } catch (e) { console.error(e) }
    setBuying(false)
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

  const isOwned = (id: string) => inventory.includes(id)
  const isEquipped = (id: string) => equippedFrame === id

  const getTabItems = () => {
    if (tab === 'frames') return STATIC_FRAMES.map(f => ({ ...f, type: 'frame' as const }))
    if (tab === 'badges') return STATIC_BADGES.map(b => ({ ...b, type: 'badge' as const }))
    if (tab === 'cards') return STATIC_CARDS.map(c => ({ ...c, type: 'card' as const }))
    return []
  }

  const tabLabels: Record<ShopTab, string> = {
    frames: t('shop.frames'),
    badges: t('shop.badges'),
    cards: t('shop.cards'),
    coins: '🪙 Coins'
  }

  return (
    <div style={{ minHeight:'100dvh', background:'#060606', paddingTop:60, paddingBottom:100 }}>
      {toast && (
        <div style={{ position:'fixed', top:80, left:'50%', transform:'translateX(-50%)', background:'linear-gradient(135deg, #CC8800, #FFB800)', borderRadius:12, padding:'10px 20px', zIndex:300, whiteSpace:'nowrap', boxShadow:'0 8px 24px rgba(255,184,0,0.3)' }}>
          <span style={{ fontFamily:'Cinzel, serif', fontSize:12, color:'#000', fontWeight:700 }}>{toast}</span>
        </div>
      )}

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'0 20px 20px' }}>
        <h1 className='font-display' style={{ fontSize:28, color:'#f0ece4' }}>{t('shop.title')}</h1>
        <div style={{ display:'flex', alignItems:'center', gap:6, background:'#111', borderRadius:20, padding:'6px 14px', border:'1px solid rgba(255,184,0,0.15)' }}>
          <span style={{ fontSize:14 }}>🪙</span>
          <span className='font-display' style={{ fontSize:14, color:'#FFB800' }}>{coins.toLocaleString()}</span>
        </div>
      </div>

      <div style={{ display:'flex', margin:'0 16px 16px', background:'#111', borderRadius:10, padding:4 }}>
        {(Object.keys(tabLabels) as ShopTab[]).map(k => (
          <button key={k} onClick={() => setTab(k)} style={{ flex:1, padding:'10px 4px', borderRadius:8, border: tab===k ? '1px solid rgba(255,184,0,0.25)' : '1px solid transparent', background: tab===k ? 'rgba(255,184,0,0.12)' : 'transparent', color: tab===k ? '#FFB800' : 'rgba(240,236,228,0.4)', fontFamily:'Cinzel, serif', fontSize:10, letterSpacing:0.5, cursor:'pointer' }}>
            {tabLabels[k].toUpperCase()}
          </button>
        ))}
      </div>

      {tab === 'coins' && (
        <div style={{ padding:'0 16px' }}>
          {!profile?.battle_pass_premium && (
            <div style={{ background:'linear-gradient(135deg, rgba(255,184,0,0.1), rgba(255,229,102,0.05))', borderRadius:14, border:'1px solid rgba(255,184,0,0.25)', padding:20, marginBottom:16 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
                <div>
                  <p className='font-display' style={{ fontSize:14, color:'#FFB800', marginBottom:4 }}>⭐ PREMIUM BATTLE PASS</p>
                  <p style={{ fontSize:12, color:'rgba(240,236,228,0.5)', lineHeight:1.5 }}>
                    {lang === 'de' ? 'Alle 30 Tiers · Exklusive Cosmetics · Season 1' : 'All 30 Tiers · Exclusive Cosmetics · Season 1'}
                  </p>
                </div>
                <span style={{ fontSize:20, color:'#FFB800', fontWeight:700, fontFamily:'Crimson Text, serif' }}>9,99€</span>
              </div>
              <button onClick={() => buyWithStripe('premium_pass')} disabled={!!stripeLoading} style={{ width:'100%', padding:16, borderRadius:12, border:'none', cursor:'pointer', background:'linear-gradient(135deg, #CC8800, #FFB800)', color:'#000', fontFamily:'Cinzel, serif', fontSize:12, fontWeight:700, letterSpacing:2 }}>
                {stripeLoading === 'premium_pass' ? t('shop.redirecting') : `${t('battlepass.getPremium').toUpperCase()} · 9,99€`}
              </button>
            </div>
          )}
          {profile?.battle_pass_premium && (
            <div style={{ background:'rgba(74,222,128,0.06)', borderRadius:14, border:'1px solid rgba(74,222,128,0.2)', padding:16, marginBottom:16, textAlign:'center' }}>
              <p style={{ fontSize:24, marginBottom:6 }}>⭐</p>
              <p className='font-display' style={{ fontSize:12, color:'#4ade80', letterSpacing:2 }}>{t('battlepass.premiumUnlocked')}</p>
            </div>
          )}
          <p style={{ fontFamily:'Cinzel, serif', fontSize:9, letterSpacing:3, color:'rgba(240,236,228,0.4)', marginBottom:12 }}>{t('shop.coinPacks').toUpperCase()}</p>
          {[
            { type:'coin_pack_small', coins:500, price:'4,99€', label:t('shop.coinPackSmall') },
            { type:'coin_pack_large', coins:1500, price:'9,99€', label:t('shop.coinPackLarge') }
          ].map(pack => (
            <div key={pack.type} style={{ background:'#111', borderRadius:14, border:'1px solid rgba(255,255,255,0.07)', padding:'16px', marginBottom:12, display:'flex', alignItems:'center', gap:16 }}>
              <div style={{ fontSize:36, flexShrink:0 }}>🪙</div>
              <div style={{ flex:1 }}>
                <p className='font-display' style={{ fontSize:14, color:'#FFB800', marginBottom:2 }}>{pack.coins.toLocaleString()} Coins</p>
                <p style={{ fontSize:12, color:'rgba(240,236,228,0.5)' }}>{pack.label}</p>
              </div>
              <button onClick={() => buyWithStripe(pack.type)} disabled={!!stripeLoading} style={{ flexShrink:0, padding:'12px 16px', borderRadius:10, border:'none', cursor:'pointer', background:'linear-gradient(135deg, #CC8800, #FFB800)', color:'#000', fontFamily:'Cinzel, serif', fontSize:11, fontWeight:700, letterSpacing:1 }}>
                {stripeLoading === pack.type ? '...' : pack.price}
              </button>
            </div>
          ))}
          <p style={{ fontSize:11, color:'rgba(240,236,228,0.25)', textAlign:'center', marginTop:16, fontFamily:'Cinzel, serif', letterSpacing:1 }}>
            🔒 {t('shop.stripeNote')}
          </p>
        </div>
      )}

      {tab !== 'coins' && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, padding:'0 16px' }}>
          {getTabItems().map((item: any) => {
            const rc = RARITY_COLORS[item.rarity as keyof typeof RARITY_COLORS]
            const owned = isOwned(item.id)
            const equipped = item.type === 'frame' && isEquipped(item.id)
            return (
              <div key={item.id} style={{ background:'#111', borderRadius:14, border:`1px solid ${equipped ? 'rgba(255,184,0,0.35)' : rc+'33'}`, padding:'16px 12px', textAlign:'center', position:'relative', overflow:'hidden' }}>
                {equipped && (
                  <div style={{ position:'absolute', top:8, right:8, background:'rgba(255,184,0,0.2)', borderRadius:6, padding:'2px 8px', border:'1px solid rgba(255,184,0,0.4)' }}>
                    <span className='font-display' style={{ fontSize:7, color:'#FFB800' }}>{t('shop.equipped').toUpperCase()}</span>
                  </div>
                )}
                {owned && !equipped && (
                  <div style={{ position:'absolute', top:8, right:8, background:'rgba(74,222,128,0.15)', borderRadius:6, padding:'2px 8px', border:'1px solid rgba(74,222,128,0.3)' }}>
                    <span className='font-display' style={{ fontSize:7, color:'#4ade80' }}>{t('shop.owned').toUpperCase()}</span>
                  </div>
                )}
                <div style={{ fontSize:36, marginBottom:10, filter:`drop-shadow(0 0 8px ${rc})` }}>{item.icon}</div>
                <p className='font-display' style={{ fontSize:11, color:'#f0ece4', marginBottom:4, lineHeight:1.3 }}>{item.name}</p>
                <div style={{ display:'inline-block', padding:'2px 8px', borderRadius:10, background:`${rc}18`, border:`1px solid ${rc}44`, marginBottom:10 }}>
                  <span className='font-display' style={{ fontSize:7, letterSpacing:1, color:rc }}>{t(`shop.rarity.${item.rarity}`).toUpperCase()}</span>
                </div>
                <p style={{ fontSize:12, color:'rgba(240,236,228,0.4)', marginBottom:12, lineHeight:1.4 }}>{item.desc}</p>
                {equipped ? (
                  <div style={{ width:'100%', padding:'8px', borderRadius:8, background:'rgba(255,184,0,0.08)', color:'#FFB800', fontFamily:'Cinzel, serif', fontSize:9, letterSpacing:1, textAlign:'center', border:'1px solid rgba(255,184,0,0.3)' }}>
                    ✓ {t('shop.equipped').toUpperCase()}
                  </div>
                ) : owned ? (
                  <button onClick={() => item.type === 'frame' ? equipItem(item) : undefined} style={{ width:'100%', padding:'8px', borderRadius:8, border:'1px solid rgba(74,222,128,0.3)', background:'rgba(74,222,128,0.08)', color:'#4ade80', fontFamily:'Cinzel, serif', fontSize:9, letterSpacing:1, cursor:'pointer' }}>
                    {t('shop.equip').toUpperCase()}
                  </button>
                ) : item.coin_price > 0 && item.is_purchasable ? (
                  <button onClick={() => setConfirmItem(item)} style={{ width:'100%', padding:'8px', borderRadius:8, border:`1px solid ${rc}44`, background:`${rc}15`, color:rc, fontFamily:'Cinzel, serif', fontSize:9, letterSpacing:1, cursor:'pointer' }}>
                    {item.coin_price} {t('shop.coins').toUpperCase()}
                  </button>
                ) : (
                  <div style={{ width:'100%', padding:'8px', borderRadius:8, border:'1px solid rgba(255,255,255,0.06)', color:'rgba(240,236,228,0.25)', fontFamily:'Cinzel, serif', fontSize:9, textAlign:'center' }}>
                    {lang === 'de' ? 'VERDIENT' : 'EARNED'}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {confirmItem && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', display:'flex', alignItems:'flex-end', zIndex:200 }} onClick={() => setConfirmItem(null)}>
          <div style={{ width:'100%', maxWidth:430, margin:'0 auto', background:'#111', borderRadius:'20px 20px 0 0', border:'1px solid rgba(255,184,0,0.15)', padding:'24px 20px 48px' }} onClick={e => e.stopPropagation()}>
            <div style={{ textAlign:'center', fontSize:48, marginBottom:12 }}>{confirmItem.icon}</div>
            <h3 className='font-display' style={{ fontSize:18, color:'#FFB800', textAlign:'center', marginBottom:8 }}>{t('shop.confirmPurchase')}</h3>
            <p style={{ textAlign:'center', fontSize:14, color:'rgba(240,236,228,0.6)', marginBottom:20 }}>
              {t('shop.confirmPurchaseText')} <strong style={{ color:'#FFB800' }}>{confirmItem.coin_price} 🪙</strong> {t('shop.confirmPurchaseCoins')}
            </p>
            {coins < confirmItem.coin_price && (
              <div style={{ background:'rgba(248,113,113,0.08)', border:'1px solid rgba(248,113,113,0.2)', borderRadius:10, padding:12, marginBottom:16, textAlign:'center' }}>
                <p style={{ color:'#f87171', fontSize:13 }}>{t('shop.notEnoughCoins')}</p>
                <p style={{ color:'rgba(240,236,228,0.4)', fontSize:12, marginTop:4 }}>
                  {lang === 'de' ? `${coins} / ${confirmItem.coin_price} Coins` : `${coins} / ${confirmItem.coin_price} coins`}
                </p>
              </div>
            )}
            <button onClick={() => buyWithCoins(confirmItem)} disabled={buying || coins < confirmItem.coin_price} style={{ width:'100%', padding:16, borderRadius:12, border:'none', cursor: coins >= confirmItem.coin_price ? 'pointer' : 'default', background: coins >= confirmItem.coin_price ? 'linear-gradient(135deg, #CC8800, #FFB800)' : 'rgba(255,184,0,0.1)', color: coins >= confirmItem.coin_price ? '#000' : 'rgba(255,184,0,0.4)', fontFamily:'Cinzel, serif', fontSize:12, fontWeight:700, letterSpacing:2, marginBottom:10 }}>
              {buying ? t('shop.processing') : `${t('shop.buy').toUpperCase()} · ${confirmItem.coin_price} 🪙`}
            </button>
            <button onClick={() => setConfirmItem(null)} style={{ width:'100%', padding:14, borderRadius:12, border:'1px solid rgba(255,255,255,0.1)', background:'transparent', color:'rgba(240,236,228,0.5)', fontFamily:'Cinzel, serif', fontSize:11, cursor:'pointer' }}>
              {lang === 'de' ? 'ABBRECHEN' : 'CANCEL'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
