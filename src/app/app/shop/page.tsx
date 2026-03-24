'use client'
import React, { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useLang } from '@/contexts/LanguageContext'
import { supabase } from '@/lib/supabase'
import { trackShopOpened, trackStripeCheckoutStarted, trackItemPurchased, trackFramePurchased, trackPackOpened, trackScreenView } from '@/lib/analytics'
import dynamic from 'next/dynamic'
import CoinIcon from '@/components/CoinIcon'

const PackReveal = dynamic(() => import('@/components/PackReveal'), { ssr: false })
const CardRevealAnimation = dynamic(() => import('@/components/CardRevealAnimation'), { ssr: false })
const EquipCelebration = dynamic(() => import('@/components/EquipCelebration'), { ssr: false })
import FrameShopCard from '@/components/FrameShopCard'
import {
  fetchAllFrameDefinitions, fetchFrameProgress, fetchUserOwnedFrames,
  fetchFramePacks, fetchPackLootTable, resolveFrameState,
  type FrameDefinition, type FrameProgress, type FramePackDef, type FrameUIState, type PackLootEntry,
} from '@/lib/frame-progress'
import {
  getArchetypeShopItems, getUserOwnedArchetypes,
  ARCHETYPE_ICONS, ARCHETYPE_COLORS,
  type ArchetypeShopItem,
} from '@/lib/card-helpers'

type ShopSection = 'featured' | 'coins' | 'frames' | 'packs' | 'archetypes' | 'inventory'

const RARITY_COLORS: Record<string, string> = {
  common: '#9ca3af', rare: '#3b82f6', epic: '#a855f7',
  legendary: '#f59e0b', founder: '#f59e0b', event: '#ec4899',
}

export default function ShopPage() {
  const { profile, refreshProfile } = useAuth()
  const { t, lang } = useLang()
  const searchParams = useSearchParams()
  const router = useRouter()

  const [section, setSection] = useState<ShopSection>('featured')
  const [toast, setToast] = useState<string | null>(null)
  const [stripeLoading, setStripeLoading] = useState<string | null>(null)

  // Frame data
  const [frameDefs, setFrameDefs] = useState<FrameDefinition[]>([])
  const [ownedFrames, setOwnedFrames] = useState<string[]>([])
  const [frameProgress, setFrameProgress] = useState<Map<string, FrameProgress>>(new Map())
  const [framePacks, setFramePacks] = useState<FramePackDef[]>([])
  const [lootTables, setLootTables] = useState<Map<string, PackLootEntry[]>>(new Map())
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Frame pack opening
  const [packResult, setPackResult] = useState<any>(null)

  // Card pack data (preserved from old shop)
  const [packDefs, setPackDefs] = useState<any[]>([])
  const [packPurchases, setPackPurchases] = useState<any[]>([])
  const [packOpening, setPackOpening] = useState<string | null>(null)
  const [revealCards, setRevealCards] = useState<any[] | null>(null)
  const [revealPackType, setRevealPackType] = useState<string>('')

  // Archetype data
  const [archetypeItems, setArchetypeItems] = useState<ArchetypeShopItem[]>([])
  const [ownedArchetypes, setOwnedArchetypes] = useState<string[]>([])
  const [buyingArchetype, setBuyingArchetype] = useState<string | null>(null)
  const [confirmArchetype, setConfirmArchetype] = useState<ArchetypeShopItem | null>(null)
  const [archetypeRevealCard, setArchetypeRevealCard] = useState<any>(null)

  // Confirm modal
  const [confirmFrame, setConfirmFrame] = useState<FrameDefinition | null>(null)
  const [confirmFrameState, setConfirmFrameState] = useState<FrameUIState>('locked')

  // Equip prompt after purchase
  const [justPurchased, setJustPurchased] = useState<FrameDefinition | null>(null)

  // Pack history
  const [packHistory, setPackHistory] = useState<any[]>([])

  const coins = profile?.coins ?? 0

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }, [])

  /* ── Data Fetching ── */

  useEffect(() => { trackScreenView('shop'); trackShopOpened() }, [])

  useEffect(() => {
    if (profile) {
      loadFrameData()
      loadCardPackData()
      loadArchetypeData()
    }
  }, [profile])

  useEffect(() => {
    const success = searchParams.get('success')
    const product = searchParams.get('product')
    const sec = searchParams.get('section')
    const highlight = searchParams.get('highlight')
    if (success && product) {
      // Stripe Fallback-Fulfillment: Wenn der Webhook nicht ankam,
      // prüfe pending Transactions und creditiere Coins direkt
      fulfillPendingPurchase(product).then(() => {
        if (product === 'premium_pass') showToast('⭐ Premium Battle Pass aktiviert!')
        else showToast(`🪙 ${t('shop.purchaseSuccess')}`)
        refreshProfile()
      })
    }
    if (sec === 'coins') setSection('coins')
    if (sec === 'frames') setSection('frames')
    if (sec === 'archetypes') setSection('archetypes')
    if (sec === 'inventory') setSection('inventory')
    if (highlight) setSection('frames')
  }, [searchParams])

  // Stripe Fallback: Wenn Webhook fehlschlägt, Coins beim Redirect server-side gutschreiben
  const fulfillPendingPurchase = async (productType: string) => {
    if (!profile) return
    try {
      // Finde die neueste pending Transaction
      const { data: tx } = await supabase
        .from('stripe_transactions')
        .select('session_id, status')
        .eq('user_id', profile.id)
        .eq('product_type', productType)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (!tx) return // Webhook hat schon gegriffen

      // Server-side Verifizierung + Fulfillment (alles in einer Route)
      const { data: { session: authSession } } = await supabase.auth.getSession()
      const res = await fetch('/api/verify-stripe-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authSession?.access_token}`,
        },
        body: JSON.stringify({ session_id: tx.session_id }),
      })

      if (res.ok) {
        const { fulfilled, coins } = await res.json()
        if (fulfilled) console.log(`[Fallback] ${coins} coins fulfilled via API`)
      }
    } catch (err) {
      console.error('Fallback fulfillment error:', err)
    }
  }

  const loadFrameData = async () => {
    if (!profile) return
    const [defs, owned, progress, packs] = await Promise.all([
      fetchAllFrameDefinitions(),
      fetchUserOwnedFrames(profile.id),
      fetchFrameProgress(profile.id),
      fetchFramePacks(),
    ])
    setFrameDefs(defs)
    setOwnedFrames(owned)
    setFrameProgress(progress)
    setFramePacks(packs)

    const tables = new Map<string, PackLootEntry[]>()
    for (const p of packs) {
      const entries = await fetchPackLootTable(p.id)
      tables.set(p.id, entries)
    }
    setLootTables(tables)

    const { data: history } = await supabase
      .from('user_pack_history')
      .select('*')
      .eq('user_id', profile.id)
      .order('opened_at', { ascending: false })
      .limit(20)
    setPackHistory(history || [])
  }

  const loadCardPackData = async () => {
    if (!profile) return
    const [packsRes, purchasesRes] = await Promise.all([
      supabase.from('pack_definitions').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('pack_purchases').select('pack_id, purchased_at').eq('user_id', profile.id),
    ])
    setPackDefs(packsRes.data || [])
    setPackPurchases(purchasesRes.data || [])
  }

  const loadArchetypeData = async () => {
    if (!profile) return
    const [items, owned] = await Promise.all([
      getArchetypeShopItems(),
      getUserOwnedArchetypes(profile.id),
    ])
    setArchetypeItems(items)
    setOwnedArchetypes(owned)
  }

  /* ── Actions ── */

  /** Extract real error message from supabase.functions.invoke error */
  const extractEdgeFnError = (error: any, fallback: string): string => {
    if (!error) return fallback
    const msg = error.message || ''
    // supabase-js wraps non-2xx response body as error.message (raw JSON string)
    try {
      const parsed = JSON.parse(msg)
      if (parsed.error) return parsed.error
    } catch { /* not JSON, use as-is */ }
    // If generic "Edge Function returned a non-2xx status code", use fallback
    if (msg.includes('non-2xx') || msg.includes('Edge Function')) return fallback
    return msg || fallback
  }

  const handleFrameAction = (frame: FrameDefinition, state: FrameUIState) => {
    if (state === 'buyable' || state === 'not_eligible') {
      setConfirmFrame(frame)
      setConfirmFrameState(state)
    } else if (state === 'owned') {
      equipFrame(frame.id)
    } else if (state === 'claimable') {
      claimFrame(frame.id)
    }
  }

  const equipFrame = async (frameId: string) => {
    if (!profile || actionLoading) return
    setActionLoading(frameId)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const { data, error } = await supabase.functions.invoke('claim-frame', {
        body: { frame_id: frameId, action: 'equip' },
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
      })
      if (error) throw new Error(extractEdgeFnError(error, t('shop.errorEquipping')))
      if (data?.error) throw new Error(data.error)
      await refreshProfile()
      await loadFrameData()
      showToast(`✅ ${t('shop.equipSuccess')}`)
    } catch (e: any) {
      showToast(e.message || t('shop.errorGeneric'))
    }
    setActionLoading(null)
  }

  const purchaseFrame = async (frame: FrameDefinition) => {
    if (!profile || actionLoading) return
    setActionLoading(frame.id)
    setConfirmFrame(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const { data, error } = await supabase.functions.invoke('claim-frame', {
        body: { frame_id: frame.id },
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
      })
      if (error) throw new Error(extractEdgeFnError(error, t('shop.errorPurchase')))
      if (data?.error) throw new Error(data.error)
      trackFramePurchased(frame.id, frame.coin_price)
      await refreshProfile()
      await loadFrameData()
      setJustPurchased(frame)
    } catch (e: any) {
      showToast(e.message || t('shop.errorPurchase'))
    }
    setActionLoading(null)
  }

  const handleEquipAfterPurchase = async () => {
    if (!justPurchased) return
    const frameId = justPurchased.id
    setJustPurchased(null)
    await equipFrame(frameId)
  }

  const claimFrame = async (frameId: string) => {
    if (!profile || actionLoading) return
    setActionLoading(frameId)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const { data, error } = await supabase.functions.invoke('claim-frame', {
        body: { frame_id: frameId },
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
      })
      if (error) throw new Error(extractEdgeFnError(error, t('shop.errorRedeem')))
      if (data?.error) throw new Error(data.error)
      await refreshProfile()
      await loadFrameData()
      showToast(`🎖️ ${t('shop.errorRedeem')}`)
    } catch (e: any) {
      showToast(e.message || t('shop.errorGeneric'))
    }
    setActionLoading(null)
  }

  const openFramePack = async (packId: string) => {
    if (!profile || actionLoading) return
    setActionLoading(packId)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const { data, error } = await supabase.functions.invoke('open-frame-pack', {
        body: { pack_id: packId },
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
      })
      if (error) throw new Error(extractEdgeFnError(error, t('shop.errorOpening')))
      if (data?.error) throw new Error(data.error)
      trackPackOpened(packId)
      setPackResult(data)
      await refreshProfile()
      await loadFrameData()
    } catch (e: any) {
      showToast(e.message || 'Fehler beim Offnen')
    }
    setActionLoading(null)
  }

  const openCardPack = async (pack: any) => {
    if (!profile) return
    if (pack.price_coins > 0 && coins < pack.price_coins) { showToast(t('shop.notEnoughCoins')); return }
    setPackOpening(pack.id)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const { data, error } = await supabase.functions.invoke('open-card-pack', {
        body: { pack_id: pack.id },
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
      })
      if (error) throw new Error(extractEdgeFnError(error, t('shop.packError')))
      if (data?.error) throw new Error(data.error)
      if (data?.cards) {
        trackPackOpened(pack.id)
        setRevealCards(data.cards)
        setRevealPackType(pack.name || pack.pack_type)
        await refreshProfile()
        await loadCardPackData()
      } else showToast(t('shop.errorOpening'))
    } catch (e: any) { showToast(e.message || t('shop.packError')) }
    finally { setPackOpening(null) }
  }

  const purchaseArchetype = async (item: ArchetypeShopItem) => {
    if (!profile || buyingArchetype) return
    if (coins < item.price_coins) { showToast(t('shop.notEnoughCoins')); return }
    setBuyingArchetype(item.id)
    setConfirmArchetype(null)
    try {
      const { data: cardId, error: rpcErr } = await supabase.rpc('purchase_archetype_card', { p_user_id: profile.id, p_archetype: item.id })
      if (rpcErr) throw rpcErr
      const { data: card } = await supabase.from('card_catalog').select('*').eq('id', cardId).single()
      trackItemPurchased(item.id, item.price_coins, 'coins')
      await refreshProfile()
      await loadArchetypeData()
      if (card) setArchetypeRevealCard(card)
    } catch (err: any) { showToast(err.message || t('shop.errorPurchase')) }
    setBuyingArchetype(null)
  }

  const buyWithStripe = async (productType: string) => {
    if (!profile) return
    setStripeLoading(productType)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/create-stripe-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) },
        body: JSON.stringify({ product_type: productType })
      })
      const data = await res.json()
      if (data.url) {
        trackStripeCheckoutStarted(productType, 0)
        window.location.href = data.url
      } else showToast('⚠️ ' + (data.error || t('shop.stripeError')))
    } catch { showToast('⚠️ ' + t('shop.connectionError')) }
    setStripeLoading(null)
  }

  /* ── Helpers ── */

  const shopFrames = frameDefs.filter(f => f.category === 'shop')
  const prestigeFrames = frameDefs.filter(f => f.category === 'prestige')
  const eventFrames = frameDefs.filter(f => f.category === 'event')

  const getState = (f: FrameDefinition): FrameUIState =>
    resolveFrameState(f, ownedFrames, profile?.active_frame || null, frameProgress.get(f.id), coins, profile?.is_founder || false)

  const nextShopFrame = shopFrames.find(f => !ownedFrames.includes(f.id) && coins >= f.coin_price)
  const closestPrestige = [...prestigeFrames]
    .map(f => ({ frame: f, pct: frameProgress.get(f.id)?.progress_pct || 0 }))
    .filter(x => !ownedFrames.includes(x.frame.id) && x.pct > 0)
    .sort((a, b) => b.pct - a.pct)[0]

  const SECTIONS: { key: ShopSection; label: string; emoji: string }[] = [
    { key: 'featured',   label: 'FEATURED',   emoji: '⭐' },
    { key: 'coins',      label: 'COINS',      emoji: '🪙' },
    { key: 'frames',     label: 'RAHMEN',     emoji: '💎' },
    { key: 'packs',      label: 'PACKS',      emoji: '🃏' },
    { key: 'archetypes', label: 'ARCHETYPEN', emoji: '🐲' },
    { key: 'inventory',  label: 'INVENTAR',   emoji: '🎒' },
  ]

  const PACK_ICONS: Record<string, string> = { starter: '🎁', daily: '📦', premium: '💎', event: '🎪', founder: '👑' }

  /* ── Render ── */

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg-base)', paddingTop: 60, paddingBottom: 100 }}>
      <style>{`@keyframes pulse-glow{0%,100%{opacity:0.7}50%{opacity:1}}`}</style>

      {toast && (
        <div style={{ position: 'fixed', top: 80, left: '50%', transform: 'translateX(-50%)', background: 'linear-gradient(135deg, var(--gold-dim), var(--gold-primary))', borderRadius: 12, padding: '10px 20px', zIndex: 300, whiteSpace: 'nowrap', boxShadow: '0 8px 24px rgba(255,184,0,0.3)' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 12, color: 'var(--text-inverse)', fontWeight: 700 }}>{toast}</span>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 20px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => router.back()} style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: 4,
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="2" strokeLinecap="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <h1 className='font-display' style={{ fontSize: 26, color: 'var(--text-primary)' }}>{t('shop.title')}</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div onClick={() => router.push('/app/cards')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, background: 'var(--bg-surface)', borderRadius: 18, border: '1px solid rgba(255,184,0,0.15)', cursor: 'pointer' }}>
            <span style={{ fontSize: 16 }}>🃏</span>
          </div>
          <div onClick={() => setSection('coins')} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-surface)', borderRadius: 20, padding: '6px 14px', border: '1px solid rgba(255,184,0,0.15)', cursor: 'pointer' }}>
            <CoinIcon size={18} />
            <span className='font-display' style={{ fontSize: 14, color: 'var(--gold-primary)' }}>{coins.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
        <div style={{ display: 'flex', gap: 8, padding: '0 16px 12px', minWidth: 'max-content' }}>
          {SECTIONS.map(s => {
            const isCoins = s.key === 'coins'
            const isActive = section === s.key
            return (
              <button key={s.key} onClick={() => setSection(s.key)} style={{ padding: isCoins ? '8px 16px' : '8px 14px', borderRadius: 20, border: isActive ? '1px solid var(--gold-glow)' : isCoins ? '1px solid rgba(255,184,0,0.3)' : '1px solid var(--border-subtle)', background: isActive ? 'var(--gold-subtle)' : isCoins ? 'rgba(255,184,0,0.06)' : 'var(--bg-surface)', color: isActive ? 'var(--gold-primary)' : isCoins ? 'var(--gold-primary)' : 'var(--text-secondary)', fontFamily: 'var(--font-display)', fontSize: 10, letterSpacing: 0.5, cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', gap: 6, alignItems: 'center' }}>
                <span>{s.emoji}</span><span>{s.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ══════ FEATURED ══════ */}
      {section === 'featured' && (
        <div style={{ padding: '0 16px' }}>
          <p className='font-display' style={{ fontSize: 9, letterSpacing: 3, color: 'var(--text-secondary)', marginBottom: 16 }}>⭐ EMPFOHLEN FÜR DICH</p>

          {nextShopFrame && (
            <div style={{ background: 'linear-gradient(135deg, rgba(255,184,0,0.08), rgba(255,229,102,0.04))', borderRadius: 14, border: '1px solid rgba(255,184,0,0.2)', padding: 16, marginBottom: 14, display: 'flex', gap: 14, alignItems: 'center' }}>
              <div style={{ fontSize: 40, flexShrink: 0 }}>{nextShopFrame.icon_emoji}</div>
              <div style={{ flex: 1 }}>
                <p className='font-display' style={{ fontSize: 12, color: 'var(--gold-primary)', marginBottom: 4 }}>NÄCHSTER RAHMEN</p>
                <p style={{ fontSize: 14, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', marginBottom: 4 }}>{nextShopFrame.name_de}</p>
                <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8 }}>{nextShopFrame.description_de}</p>
                <button onClick={() => { setConfirmFrame(nextShopFrame); setConfirmFrameState('buyable') }} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, #FFB800, #FF8C00)', color: '#000', fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <CoinIcon size={13} /> {nextShopFrame.coin_price} KAUFEN
                </button>
              </div>
            </div>
          )}

          {closestPrestige && (
            <div style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.08), rgba(139,92,246,0.02))', borderRadius: 14, border: '1px solid rgba(139,92,246,0.2)', padding: 16, marginBottom: 14 }}>
              <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                <div style={{ fontSize: 40, flexShrink: 0 }}>{closestPrestige.frame.icon_emoji}</div>
                <div style={{ flex: 1 }}>
                  <p className='font-display' style={{ fontSize: 12, color: '#a78bfa', marginBottom: 4 }}>PRESTIGE FORTSCHRITT</p>
                  <p style={{ fontSize: 14, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', marginBottom: 6 }}>{closestPrestige.frame.name_de}</p>
                  <div style={{ width: '100%', height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.1)', overflow: 'hidden', marginBottom: 4 }}>
                    <div style={{ width: `${closestPrestige.pct}%`, height: '100%', borderRadius: 4, background: 'linear-gradient(90deg, #8b5cf6, #a78bfa)' }} />
                  </div>
                  <p style={{ fontSize: 10, color: '#9ca3af', fontFamily: "'JetBrains Mono', monospace" }}>
                    {frameProgress.get(closestPrestige.frame.id)?.current_value || 0}/{frameProgress.get(closestPrestige.frame.id)?.target_value || 0} ({Math.floor(closestPrestige.pct)}%)
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Coins CTA */}
          <div onClick={() => setSection('coins')} style={{ background: 'linear-gradient(135deg, rgba(255,184,0,0.1), rgba(255,184,0,0.04))', borderRadius: 14, border: '1px solid rgba(255,184,0,0.25)', padding: 16, marginBottom: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ flexShrink: 0, width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,184,0,0.12)', borderRadius: 12 }}>
              <CoinIcon size={28} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span className='font-display' style={{ fontSize: 18, color: 'var(--gold-primary)' }}>{coins.toLocaleString()} Coins</span>
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Tippe hier um Coins zu kaufen</p>
            </div>
            <div style={{ flexShrink: 0, padding: '8px 14px', borderRadius: 8, background: 'linear-gradient(135deg, var(--gold-dim), var(--gold-primary))', fontFamily: 'var(--font-display)', fontSize: 10, fontWeight: 700, color: 'var(--text-inverse)', letterSpacing: 1 }}>KAUFEN</div>
          </div>

          <div onClick={() => setSection('inventory')} style={{ background: 'var(--bg-surface)', borderRadius: 14, border: '1px solid var(--border-subtle)', padding: 16, textAlign: 'center', cursor: 'pointer', marginBottom: 14 }}>
            <div style={{ fontSize: 28, marginBottom: 6 }}>{'\u{1F392}'}</div>
            <p className='font-display' style={{ fontSize: 11, color: 'var(--text-primary)' }}>INVENTAR</p>
            <p style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>{ownedFrames.length} Rahmen</p>
          </div>
        </div>
      )}

      {/* ══════ COINS ══════ */}
      {section === 'coins' && (
        <div style={{ padding: '0 16px' }}>
          {/* Current Balance */}
          <div style={{ background: 'linear-gradient(135deg, rgba(255,184,0,0.12), rgba(255,229,102,0.04))', borderRadius: 16, border: '1px solid rgba(255,184,0,0.25)', padding: '24px 20px', marginBottom: 20, textAlign: 'center' }}>
            <p className='font-display' style={{ fontSize: 9, letterSpacing: 3, color: 'var(--text-secondary)', marginBottom: 10 }}>DEIN GUTHABEN</p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 6 }}>
              <CoinIcon size={32} />
              <span className='font-display' style={{ fontSize: 36, color: 'var(--gold-primary)', fontWeight: 700 }}>{coins.toLocaleString()}</span>
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>Buddy Coins</p>
          </div>

          {/* Coin Packs */}
          <p className='font-display' style={{ fontSize: 9, letterSpacing: 3, color: 'var(--text-secondary)', marginBottom: 14 }}>🪙 COIN PACKS KAUFEN</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
            {[
              { type: 'coin_pack_xs', coins: 500,   price: '2,99€',  badge: null,          perCoin: '0,60¢' },
              { type: 'coin_pack_sm', coins: 1200,  price: '5,99€',  badge: null,          perCoin: '0,50¢' },
              { type: 'coin_pack_md', coins: 2500,  price: '9,99€',  badge: 'BELIEBT',     perCoin: '0,40¢' },
              { type: 'coin_pack_lg', coins: 6000,  price: '19,99€', badge: 'BESTER WERT', perCoin: '0,33¢' },
              { type: 'coin_pack_xl', coins: 15000, price: '39,99€', badge: 'MEGA PACK',   perCoin: '0,27¢' },
            ].map(pack => (
              <div key={pack.type} style={{ background: 'var(--bg-surface)', borderRadius: 14, border: pack.badge === 'BESTER WERT' ? '1px solid rgba(255,184,0,0.4)' : '1px solid var(--border-subtle)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14, position: 'relative', overflow: 'hidden' }}>
                {pack.badge === 'BESTER WERT' && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, transparent, var(--gold-primary), transparent)' }} />}
                <div style={{ flexShrink: 0, width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,184,0,0.08)', borderRadius: 12 }}>
                  <CoinIcon size={30} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                    <span className='font-display' style={{ fontSize: 16, color: 'var(--gold-primary)', fontWeight: 700 }}>{pack.coins.toLocaleString()}</span>
                    {pack.badge && <span style={{ background: pack.badge === 'BESTER WERT' ? 'var(--gold-primary)' : pack.badge === 'MEGA PACK' ? 'linear-gradient(135deg, #a855f7, #7c3aed)' : 'rgba(255,184,0,0.2)', padding: '2px 7px', borderRadius: 5, fontFamily: 'var(--font-display)', fontSize: 7, color: pack.badge === 'BESTER WERT' ? 'var(--text-inverse)' : pack.badge === 'MEGA PACK' ? '#fff' : 'var(--gold-primary)', fontWeight: 700 }}>{pack.badge}</span>}
                  </div>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>~{pack.perCoin}/Coin</span>
                </div>
                <button onClick={() => buyWithStripe(pack.type)} disabled={!!stripeLoading} style={{ flexShrink: 0, padding: '12px 18px', borderRadius: 10, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, var(--gold-dim), var(--gold-primary))', color: 'var(--text-inverse)', fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 700, letterSpacing: 0.5, minWidth: 80, textAlign: 'center' }}>
                  {stripeLoading === pack.type ? '...' : pack.price}
                </button>
              </div>
            ))}
          </div>

          <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginBottom: 20, fontFamily: 'var(--font-display)', letterSpacing: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>🔒 {t('shop.stripeNoteFull')}</p>

          {/* Premium Battle Pass */}
          {!profile?.battle_pass_premium && (
            <div style={{ background: 'linear-gradient(135deg, rgba(255,184,0,0.12), rgba(255,229,102,0.06))', borderRadius: 14, border: '1px solid var(--gold-glow)', padding: 20, textAlign: 'center' }}>
              <p style={{ fontSize: 32, marginBottom: 8 }}>⭐</p>
              <p className='font-display' style={{ fontSize: 16, color: 'var(--gold-primary)', marginBottom: 8 }}>PREMIUM BATTLE PASS</p>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 14 }}>Alle 30 Tiers · Exklusive Cosmetics · Founder Status · Bonus XP</p>
              <button onClick={() => buyWithStripe('premium_pass')} disabled={!!stripeLoading} style={{ width: '100%', padding: 14, borderRadius: 12, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, var(--gold-dim), var(--gold-primary))', color: 'var(--text-inverse)', fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 700, letterSpacing: 2 }}>
                {stripeLoading === 'premium_pass' ? '...' : 'PREMIUM HOLEN · 9,99€'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ══════ FRAMES ══════ */}
      {section === 'frames' && (
        <div style={{ padding: '0 16px' }}>
          <p className='font-display' style={{ fontSize: 9, letterSpacing: 3, color: 'var(--text-secondary)', marginBottom: 12 }}>💎 SHOP RAHMEN</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 24 }}>
            {shopFrames.map(f => <FrameShopCard key={f.id} frame={f} state={getState(f)} progress={frameProgress.get(f.id)} onAction={handleFrameAction} loading={actionLoading === f.id} />)}
          </div>

          <p className='font-display' style={{ fontSize: 9, letterSpacing: 3, color: '#a78bfa', marginBottom: 12 }}>🎖️ PRESTIGE RAHMEN</p>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.5 }}>Diese Rahmen konnen nicht gekauft werden — du musst sie dir verdienen!</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 24 }}>
            {prestigeFrames.map(f => <FrameShopCard key={f.id} frame={f} state={getState(f)} progress={frameProgress.get(f.id)} onAction={handleFrameAction} loading={actionLoading === f.id} />)}
          </div>

          <p className='font-display' style={{ fontSize: 9, letterSpacing: 3, color: '#f472b6', marginBottom: 12 }}>🎪 EVENT RAHMEN</p>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.5 }}>Zeitlich begrenzte Rahmen — nur wahrend aktiver Events verfugbar!</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 24 }}>
            {eventFrames.map(f => <FrameShopCard key={f.id} frame={f} state={getState(f)} progress={frameProgress.get(f.id)} onAction={handleFrameAction} loading={actionLoading === f.id} />)}
          </div>
        </div>
      )}

      {/* ══════ CARD PACKS ══════ */}
      {section === 'packs' && (
        <div style={{ padding: '0 16px' }}>
          <p className='font-display' style={{ fontSize: 9, letterSpacing: 3, color: 'var(--text-secondary)', marginBottom: 16 }}>🃏 KARTEN PACKS</p>
          {packDefs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.5 }}>📦</div>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Keine Card Packs verfugbar</p>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>Bald kommen neue Packs!</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {packDefs.map(pack => {
                const notEnough = coins < pack.price_coins
                const isOpening = packOpening === pack.id
                const purchaseCount = packPurchases.filter((p: any) => p.pack_id === pack.id).length
                return (
                  <div key={pack.id} style={{ background: 'var(--bg-surface)', borderRadius: 16, border: `1px solid ${notEnough ? 'var(--border-subtle)' : 'rgba(255,184,0,0.2)'}`, padding: 16, position: 'relative', overflow: 'hidden' }}>
                    {pack.pack_type === 'elite' && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, transparent, #a855f7, transparent)' }} />}
                    {pack.pack_type === 'premium' && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, transparent, var(--gold-primary), transparent)' }} />}
                    <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                      <div style={{ flexShrink: 0, width: 56, height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center', background: pack.pack_type === 'elite' ? 'rgba(168,85,247,0.1)' : pack.pack_type === 'premium' ? 'rgba(255,184,0,0.1)' : 'rgba(255,255,255,0.04)', borderRadius: 14, fontSize: 32 }}>
                        {pack.icon_emoji || '📦'}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                          <span className='font-display' style={{ fontSize: 15, color: 'var(--text-primary)', fontWeight: 700 }}>{pack.name}</span>
                          {pack.pack_type === 'elite' && <span style={{ background: 'rgba(168,85,247,0.2)', padding: '2px 7px', borderRadius: 5, fontFamily: 'var(--font-display)', fontSize: 7, color: '#a855f7', fontWeight: 700 }}>GARANTIE</span>}
                        </div>
                        <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6, lineHeight: 1.4 }}>{pack.description}</p>
                        <div style={{ display: 'flex', gap: 12, fontSize: 10, color: 'var(--text-muted)' }}>
                          <span>🃏 {pack.cards_per_pack} {t('shop.cardsCount')}</span>
                          {purchaseCount > 0 && <span>📊 {purchaseCount}x geoffnet</span>}
                        </div>
                      </div>
                      <button
                        onClick={() => openCardPack(pack)}
                        disabled={isOpening || notEnough}
                        style={{
                          flexShrink: 0, padding: '12px 18px', borderRadius: 12, border: 'none',
                          cursor: notEnough ? 'not-allowed' : 'pointer',
                          background: notEnough ? 'rgba(255,255,255,0.06)' : 'linear-gradient(135deg, var(--gold-dim), var(--gold-primary))',
                          color: notEnough ? 'var(--text-muted)' : 'var(--text-inverse)',
                          fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 700,
                          letterSpacing: 0.5, minWidth: 90, textAlign: 'center',
                          opacity: isOpening ? 0.6 : 1,
                        }}
                      >
                        {isOpening ? '...' : (
                          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                            <CoinIcon size={13} /> {pack.price_coins.toLocaleString()}
                          </span>
                        )}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <div style={{ marginTop: 20, textAlign: 'center' }}>
            <button onClick={() => router.push('/app/cards')} style={{ padding: '12px 24px', borderRadius: 12, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-secondary)', fontFamily: 'var(--font-display)', fontSize: 11, cursor: 'pointer', letterSpacing: 1, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              🃏 MEINE SAMMLUNG ANZEIGEN
            </button>
          </div>
        </div>
      )}

      {/* ══════ ARCHETYPES ══════ */}
      {section === 'archetypes' && (
        <div style={{ padding: '0 16px' }}>
          {/* Dragon — Prestige / Earned Only */}
          {(() => {
            const dragon = archetypeItems.find(a => a.id === 'dragon')
            if (!dragon) return null
            const dragonOwned = ownedArchetypes.includes('dragon')
            const userLevel = profile?.level ?? 0
            const userDeals = profile?.deals_total ?? 0
            const levelOk = userLevel >= 100
            const dealsOk = userDeals >= 100
            const canClaim = levelOk && dealsOk && !dragonOwned
            const pctLevel = Math.min(100, Math.round((userLevel / 100) * 100))
            const pctDeals = Math.min(100, Math.round((userDeals / 100) * 100))
            return (
              <div style={{ background: 'linear-gradient(135deg, rgba(251,191,36,0.08), rgba(251,191,36,0.02))', borderRadius: 16, border: `1px solid ${dragonOwned ? 'rgba(74,222,128,0.3)' : 'rgba(251,191,36,0.25)'}`, padding: 20, marginBottom: 20, position: 'relative', overflow: 'hidden' }}>
                {dragonOwned && <div style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(74,222,128,0.15)', borderRadius: 8, padding: '4px 10px', border: '1px solid rgba(74,222,128,0.3)' }}><span className='font-display' style={{ fontSize: 9, color: 'var(--status-active)' }}>✓ FREIGESCHALTET</span></div>}
                <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 16 }}>
                  <div style={{ fontSize: 52, filter: 'drop-shadow(0 0 16px rgba(251,191,36,0.6))' }}>🐲</div>
                  <div style={{ flex: 1 }}>
                    <p className='font-display' style={{ fontSize: 18, color: '#FBBF24', marginBottom: 4 }}>THE DRAGON</p>
                    <p style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>Der ultimative Archetyp. Nur für Legends — Level 100 und 100 eingestellte Deals.</p>
                    <span style={{ display: 'inline-block', marginTop: 6, padding: '3px 10px', borderRadius: 6, background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.2)', fontFamily: 'var(--font-display)', fontSize: 8, color: '#FBBF24', letterSpacing: 1 }}>LEGENDARY · NICHT KAUFBAR</span>
                  </div>
                </div>
                {!dragonOwned && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 10, padding: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span className='font-display' style={{ fontSize: 9, color: levelOk ? 'var(--status-active)' : 'var(--text-secondary)' }}>LEVEL</span>
                        <span style={{ fontSize: 10, color: levelOk ? 'var(--status-active)' : '#FBBF24', fontFamily: "'JetBrains Mono', monospace" }}>{userLevel}/100</span>
                      </div>
                      <div style={{ width: '100%', height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                        <div style={{ width: `${pctLevel}%`, height: '100%', borderRadius: 3, background: levelOk ? 'var(--status-active)' : 'linear-gradient(90deg, #FBBF24, #F59E0B)' }} />
                      </div>
                      {levelOk && <p style={{ fontSize: 9, color: 'var(--status-active)', marginTop: 4, textAlign: 'center' }}>✓</p>}
                    </div>
                    <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 10, padding: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span className='font-display' style={{ fontSize: 9, color: dealsOk ? 'var(--status-active)' : 'var(--text-secondary)' }}>DEALS</span>
                        <span style={{ fontSize: 10, color: dealsOk ? 'var(--status-active)' : '#FBBF24', fontFamily: "'JetBrains Mono', monospace" }}>{userDeals}/100</span>
                      </div>
                      <div style={{ width: '100%', height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                        <div style={{ width: `${pctDeals}%`, height: '100%', borderRadius: 3, background: dealsOk ? 'var(--status-active)' : 'linear-gradient(90deg, #FBBF24, #F59E0B)' }} />
                      </div>
                      {dealsOk && <p style={{ fontSize: 9, color: 'var(--status-active)', marginTop: 4, textAlign: 'center' }}>✓</p>}
                    </div>
                  </div>
                )}
                {canClaim && (
                  <button onClick={() => setConfirmArchetype(dragon)} style={{ width: '100%', padding: 14, borderRadius: 12, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, #FBBF24, #F59E0B)', color: '#000', fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 700, letterSpacing: 2, marginTop: 14 }}>
                    🐲 DRAGON FREISCHALTEN
                  </button>
                )}
              </div>
            )
          })()}

          {/* Purchasable Archetypes */}
          <p className='font-display' style={{ fontSize: 9, letterSpacing: 3, color: 'var(--text-secondary)', marginBottom: 8 }}>🎭 ARCHETYPEN · JE 1.000 COINS</p>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.5 }}>Wähle deinen Archetyp und erhalte eine einzigartige Trading Card.</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
            {archetypeItems.filter(a => a.id !== 'dragon').map(item => {
              const owned = ownedArchetypes.includes(item.id)
              const aColor = ARCHETYPE_COLORS[item.id] || '#9CA3AF'
              const aIcon = item.icon_emoji || ARCHETYPE_ICONS[item.id] || '🎭'
              return (
                <div key={item.id} style={{ background: 'var(--bg-surface)', borderRadius: 14, border: `1px solid ${owned ? 'rgba(74,222,128,0.3)' : aColor + '33'}`, padding: '16px 14px', textAlign: 'center', position: 'relative' }}>
                  {owned && <div style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(74,222,128,0.15)', borderRadius: 6, padding: '2px 8px', border: '1px solid rgba(74,222,128,0.3)' }}><span className='font-display' style={{ fontSize: 7, color: 'var(--status-active)' }}>✓</span></div>}
                  <div style={{ fontSize: 36, marginBottom: 8, filter: `drop-shadow(0 0 8px ${aColor})` }}>{aIcon}</div>
                  <p className='font-display' style={{ fontSize: 12, color: 'var(--text-primary)', marginBottom: 4 }}>{item.name}</p>
                  <p style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 10, lineHeight: 1.4, minHeight: 28 }}>{item.description}</p>
                  {owned ? (
                    <div style={{ width: '100%', padding: '8px', borderRadius: 8, background: 'rgba(74,222,128,0.08)', color: 'var(--status-active)', fontFamily: 'var(--font-display)', fontSize: 9, textAlign: 'center' }}>✓ IN SAMMLUNG</div>
                  ) : (
                    <button onClick={() => setConfirmArchetype(item)} disabled={buyingArchetype !== null} style={{ width: '100%', padding: '8px', borderRadius: 8, border: `1px solid ${aColor}44`, background: `${aColor}15`, color: aColor, fontFamily: 'var(--font-display)', fontSize: 10, cursor: coins >= item.price_coins ? 'pointer' : 'default', opacity: coins >= item.price_coins ? 1 : 0.6, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                      {buyingArchetype === item.id ? '...' : <><CoinIcon size={13} /> {item.price_coins.toLocaleString()}</>}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ══════ INVENTORY ══════ */}
      {section === 'inventory' && (
        <div style={{ padding: '0 16px' }}>
          <p className='font-display' style={{ fontSize: 9, letterSpacing: 3, color: 'var(--text-secondary)', marginBottom: 12 }}>🎒 DEINE RAHMEN ({ownedFrames.length})</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 24 }}>
            {frameDefs.filter(f => ownedFrames.includes(f.id)).map(f => <FrameShopCard key={f.id} frame={f} state={getState(f)} progress={frameProgress.get(f.id)} onAction={handleFrameAction} loading={actionLoading === f.id} />)}
          </div>

          {frameDefs.filter(f => getState(f) === 'claimable').length > 0 && (
            <>
              <p className='font-display' style={{ fontSize: 9, letterSpacing: 3, color: '#22c55e', marginBottom: 12 }}>🎁 BEREIT ZUM EINLÖSEN</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 24 }}>
                {frameDefs.filter(f => getState(f) === 'claimable').map(f => <FrameShopCard key={f.id} frame={f} state='claimable' progress={frameProgress.get(f.id)} onAction={handleFrameAction} loading={actionLoading === f.id} />)}
              </div>
            </>
          )}

        </div>
      )}

      {/* ══════ MODALS ══════ */}

      {confirmFrame && (() => {
        const notEnough = confirmFrameState === 'not_eligible'
        const missing = confirmFrame.coin_price - coins
        const rc = confirmFrame.frame_color
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'flex-end', zIndex: 200 }} onClick={() => setConfirmFrame(null)}>
            <div style={{ width: '100%', maxWidth: 430, margin: '0 auto', background: 'var(--bg-surface)', borderRadius: '20px 20px 0 0', border: `1px solid ${notEnough ? 'rgba(248,113,113,0.2)' : rc + '33'}`, padding: '24px 20px 48px' }} onClick={e => e.stopPropagation()}>
              <div style={{ textAlign: 'center', fontSize: 48, marginBottom: 12 }}>{confirmFrame.icon_emoji}</div>
              <h3 className='font-display' style={{ fontSize: 18, color: notEnough ? 'var(--status-error)' : rc, textAlign: 'center', marginBottom: 4 }}>{confirmFrame.name_de}</h3>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center', marginBottom: 16 }}>{confirmFrame.description_de}</p>
              {notEnough ? (
                <>
                  <div style={{ background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.15)', borderRadius: 12, padding: 16, marginBottom: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-display)' }}>DEINE COINS</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 16, color: 'var(--status-error)', fontFamily: 'var(--font-display)', fontWeight: 700 }}><CoinIcon size={15} /> {coins.toLocaleString()}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-display)' }}>PREIS</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 16, color: rc, fontFamily: 'var(--font-display)', fontWeight: 700 }}><CoinIcon size={15} /> {confirmFrame.coin_price.toLocaleString()}</span>
                    </div>
                    <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 10, display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-display)' }}>ES FEHLEN</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 18, color: 'var(--status-error)', fontFamily: 'var(--font-display)', fontWeight: 700 }}><CoinIcon size={16} /> {missing.toLocaleString()}</span>
                    </div>
                  </div>
                  <button onClick={() => { setConfirmFrame(null); setSection('coins') }} style={{ width: '100%', padding: 16, borderRadius: 12, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, var(--gold-dim), var(--gold-primary))', color: 'var(--text-inverse)', fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 700, letterSpacing: 2, marginBottom: 10 }}>
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}><CoinIcon size={15} /> COINS KAUFEN</span>
                  </button>
                </>
              ) : (
                <>
                  <div style={{ background: `${rc}08`, border: `1px solid ${rc}22`, borderRadius: 12, padding: 16, marginBottom: 20, textAlign: 'center' }}>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>Rahmen wird dauerhaft freigeschaltet:</p>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><CoinIcon size={18} /><span className='font-display' style={{ fontSize: 20, color: rc, fontWeight: 700 }}>{confirmFrame.coin_price.toLocaleString()}</span></div>
                  </div>
                  <button onClick={() => purchaseFrame(confirmFrame)} disabled={!!actionLoading} style={{ width: '100%', padding: 16, borderRadius: 12, border: 'none', cursor: 'pointer', background: `linear-gradient(135deg, ${rc}cc, ${rc})`, color: '#000', fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 700, letterSpacing: 2, marginBottom: 10 }}>
                    {actionLoading ? '...' : <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>{confirmFrame.icon_emoji} FREISCHALTEN</span>}
                  </button>
                </>
              )}
              <button onClick={() => setConfirmFrame(null)} style={{ width: '100%', padding: 14, borderRadius: 12, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-secondary)', fontFamily: 'var(--font-display)', fontSize: 11, cursor: 'pointer' }}>{t('common.cancel')}</button>
            </div>
          </div>
        )
      })()}

      {confirmArchetype && (() => {
        const notEnough = coins < confirmArchetype.price_coins
        const missing = confirmArchetype.price_coins - coins
        const aColor = ARCHETYPE_COLORS[confirmArchetype.id] || '#9CA3AF'
        const aIcon = confirmArchetype.icon_emoji || ARCHETYPE_ICONS[confirmArchetype.id] || '🎭'
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'flex-end', zIndex: 200 }} onClick={() => setConfirmArchetype(null)}>
            <div style={{ width: '100%', maxWidth: 430, margin: '0 auto', background: 'var(--bg-surface)', borderRadius: '20px 20px 0 0', border: `1px solid ${notEnough ? 'rgba(248,113,113,0.2)' : aColor + '33'}`, padding: '24px 20px 48px' }} onClick={e => e.stopPropagation()}>
              <div style={{ textAlign: 'center', fontSize: 48, marginBottom: 12 }}>{aIcon}</div>
              <h3 className='font-display' style={{ fontSize: 18, color: notEnough ? 'var(--status-error)' : aColor, textAlign: 'center', marginBottom: 4 }}>{confirmArchetype.name}</h3>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center', marginBottom: 16 }}>{confirmArchetype.description}</p>
              {notEnough ? (
                <>
                  <div style={{ background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.15)', borderRadius: 12, padding: 16, marginBottom: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                      <span style={{ fontSize: 12, fontFamily: 'var(--font-display)', color: 'var(--text-secondary)' }}>ES FEHLEN</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 18, color: 'var(--status-error)', fontFamily: 'var(--font-display)', fontWeight: 700 }}><CoinIcon size={16} /> {missing.toLocaleString()}</span>
                    </div>
                  </div>
                  <button onClick={() => { setConfirmArchetype(null); setSection('coins') }} style={{ width: '100%', padding: 16, borderRadius: 12, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, var(--gold-dim), var(--gold-primary))', color: 'var(--text-inverse)', fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 700, letterSpacing: 2, marginBottom: 10 }}><span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}><CoinIcon size={15} /> COINS KAUFEN</span></button>
                </>
              ) : (
                <>
                  <div style={{ background: `${aColor}08`, border: `1px solid ${aColor}22`, borderRadius: 12, padding: 16, marginBottom: 20, textAlign: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><CoinIcon size={18} /><span className='font-display' style={{ fontSize: 20, color: aColor, fontWeight: 700 }}>{confirmArchetype.price_coins}</span></div>
                  </div>
                  <button onClick={() => purchaseArchetype(confirmArchetype)} disabled={buyingArchetype !== null} style={{ width: '100%', padding: 16, borderRadius: 12, border: 'none', cursor: 'pointer', background: `linear-gradient(135deg, ${aColor}cc, ${aColor})`, color: '#000', fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 700, letterSpacing: 2, marginBottom: 10 }}>
                    {buyingArchetype ? '...' : <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>{aIcon} KAUFEN</span>}
                  </button>
                </>
              )}
              <button onClick={() => setConfirmArchetype(null)} style={{ width: '100%', padding: 14, borderRadius: 12, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-secondary)', fontFamily: 'var(--font-display)', fontSize: 11, cursor: 'pointer' }}>{t('common.cancel')}</button>
            </div>
          </div>
        )
      })()}

      {packResult && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }} onClick={() => setPackResult(null)}>
          <div style={{ textAlign: 'center', padding: 32 }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>{packResult.reward?.type === 'frame' ? '🖼' : '🪙'}</div>
            <p className='font-display' style={{ fontSize: 22, color: 'var(--gold-primary)', marginBottom: 8 }}>
              {packResult.reward?.type === 'frame' ? `${packResult.reward.value.toUpperCase()} RAHMEN!` : `${packResult.reward?.qty} COINS!`}
            </p>
            {packResult.is_duplicate && <p style={{ fontSize: 13, color: '#f97316', marginBottom: 8, fontFamily: 'var(--font-display)' }}>DOPPELT — +{packResult.coins_refunded} Coins erstattet</p>}
            {packResult.pity_activated && <p style={{ fontSize: 11, color: '#a78bfa', marginBottom: 8 }}>🎯 Pity-Garantie aktiviert!</p>}
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 20 }}>Neues Guthaben: {packResult.new_balance?.toLocaleString()} Coins</p>
            <button onClick={() => setPackResult(null)} style={{ padding: '12px 32px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, var(--gold-dim), var(--gold-primary))', color: 'var(--text-inverse)', fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>WEITER</button>
          </div>
        </div>
      )}

      {revealCards && <PackReveal cards={revealCards} packType={revealPackType} onClose={() => setRevealCards(null)} />}

      {archetypeRevealCard && (
        <CardRevealAnimation
          card={{ image_url: archetypeRevealCard.image_url, frame: archetypeRevealCard.frame, rarity: archetypeRevealCard.rarity, serial_display: archetypeRevealCard.serial_display, card_code: archetypeRevealCard.card_code }}
          onComplete={() => { setArchetypeRevealCard(null); showToast('🎉 ' + t('shop.newCardInCollection')) }}
        />
      )}

      {/* Equip celebration after frame purchase */}
      {justPurchased && (
        <EquipCelebration
          title={justPurchased.name_de || justPurchased.name_en || 'Neuer Rahmen'}
          subtitle="FREIGESCHALTET!"
          emoji={justPurchased.icon_emoji || '💎'}
          color={justPurchased.frame_color || '#F59E0B'}
          cardImageUrl={profile?.equipped_card_image_url}
          onEquip={handleEquipAfterPurchase}
          onDismiss={() => setJustPurchased(null)}
        />
      )}
    </div>
  )
}
