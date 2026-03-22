'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useLang } from '@/contexts/LanguageContext'
import { supabase } from '@/lib/supabase'
import AvatarFrame from '@/components/AvatarFrame'
import CoinIcon from '@/components/CoinIcon'
import CardRevealAnimation from '@/components/CardRevealAnimation'
import EquipCelebration from '@/components/EquipCelebration'
import FrameShopCard from '@/components/FrameShopCard'
import {
  getEquippedCard, getUserDNA,
  getArchetypeShopItems, getUserOwnedArchetypes,
  type EquippedCard, type AvatarDNA, type ArchetypeShopItem,
  ARCHETYPE_ICONS, ARCHETYPE_COLORS,
} from '@/lib/card-helpers'
import {
  fetchAllFrameDefinitions, fetchUserOwnedFrames, fetchFrameProgress,
  resolveFrameState,
  type FrameDefinition, type FrameProgress as FrameProgressType, type FrameUIState,
} from '@/lib/frame-progress'

/* ── Tab type ─────────────────────────────────────────────── */
type EditorTab = 'archetypes' | 'frames' | 'inventory'

const TAB_CONFIG: { key: EditorTab; label: string; icon: string }[] = [
  { key: 'archetypes', label: 'ARCHETYPEN', icon: '\u{1F432}' },
  { key: 'frames', label: 'RAHMEN', icon: '\u{1F48E}' },
  { key: 'inventory', label: 'INVENTAR', icon: '\u{1F392}' },
]

const DNA_LABELS: Record<string, Record<string, string>> = {
  gender: { male: 'Mannlich', female: 'Weiblich' },
  origin: { european: 'European', african: 'African', east_asian: 'East Asian', south_asian: 'South Asian', latin: 'Latin', middle_eastern: 'Middle East' },
  hair: { short: 'Kurz', long: 'Lang', curly: 'Lockig', buzz: 'Buzz Cut', ponytail: 'Pferdeschwanz', braided: 'Geflochten' },
  style: { business_suit: 'Business', luxury_blazer: 'Luxury Blazer', streetwear_hoodie: 'Streetwear', tech_founder: 'Tech Founder', cyberpunk_jacket: 'Cyberpunk', fantasy_armor: 'Fantasy Armor' },
}

export default function AvatarCardUpgrade() {
  const router = useRouter()
  const { profile, refreshProfile } = useAuth()
  const { t } = useLang()

  const [equippedCard, setEquippedCard] = useState<EquippedCard | null>(null)
  const [dna, setDna] = useState<AvatarDNA | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<EditorTab>('archetypes')
  const [toast, setToast] = useState('')
  const [revealCard, setRevealCard] = useState<any>(null)

  // Archetype state
  const [archetypeItems, setArchetypeItems] = useState<ArchetypeShopItem[]>([])
  const [ownedArchetypes, setOwnedArchetypes] = useState<string[]>([])
  const [buyingArchetype, setBuyingArchetype] = useState<string | null>(null)
  const [confirmArchetype, setConfirmArchetype] = useState<ArchetypeShopItem | null>(null)

  // Frame state
  const [frameDefs, setFrameDefs] = useState<FrameDefinition[]>([])
  const [ownedFrames, setOwnedFrames] = useState<string[]>([])
  const [frameProgressMap, setFrameProgressMap] = useState<Map<string, FrameProgressType>>(new Map())
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [confirmFrame, setConfirmFrame] = useState<FrameDefinition | null>(null)
  const [confirmFrameState, setConfirmFrameState] = useState<FrameUIState>('locked')
  const [justPurchased, setJustPurchased] = useState<FrameDefinition | null>(null)

  const coins = profile?.coins ?? 0

  const loadData = useCallback(async () => {
    if (!profile) return
    const [card, avatarDna, archItems, archOwned, fDefs, fOwned, fProgress] = await Promise.all([
      getEquippedCard(profile.id),
      getUserDNA(profile.id),
      getArchetypeShopItems(),
      getUserOwnedArchetypes(profile.id),
      fetchAllFrameDefinitions(),
      fetchUserOwnedFrames(profile.id),
      fetchFrameProgress(profile.id),
    ])
    setEquippedCard(card)
    setDna(avatarDna)
    setArchetypeItems(archItems)
    setOwnedArchetypes(archOwned)
    setFrameDefs(fDefs)
    setOwnedFrames(fOwned)
    setFrameProgressMap(fProgress)
    setLoading(false)
  }, [profile])

  useEffect(() => { if (profile) loadData() }, [profile, loadData])

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  /* ── Archetype actions ─────────────────────────────────── */
  const purchaseArchetype = async (item: ArchetypeShopItem) => {
    if (!profile || buyingArchetype) return
    if (coins < item.price_coins) { showToast('Nicht genug Coins!'); return }
    setBuyingArchetype(item.id)
    setConfirmArchetype(null)
    try {
      const { data: cardId, error: rpcErr } = await supabase.rpc('purchase_archetype_card', {
        p_user_id: profile.id, p_archetype: item.id,
      })
      if (rpcErr) throw rpcErr
      const { data: card } = await supabase.from('card_catalog').select('*').eq('id', cardId).single()
      await refreshProfile()
      await loadData()
      if (card) setRevealCard(card)
    } catch (err: any) { showToast(err.message || 'Fehler beim Kauf') }
    setBuyingArchetype(null)
  }

  /* ── Frame actions ─────────────────────────────────────── */
  const extractEdgeFnError = (error: any, fallback: string): string => {
    if (!error) return fallback
    const msg = error.message || ''
    try { const parsed = JSON.parse(msg); if (parsed.error) return parsed.error } catch { /* noop */ }
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
      if (error) throw new Error(extractEdgeFnError(error, 'Fehler beim Ausrüsten'))
      if (data?.error) throw new Error(data.error)
      await refreshProfile()
      await loadData()
      showToast('Rahmen ausgerüstet!')
    } catch (e: any) { showToast(e.message || 'Fehler') }
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
      if (error) throw new Error(extractEdgeFnError(error, 'Fehler beim Kauf'))
      if (data?.error) throw new Error(data.error)
      await refreshProfile()
      await loadData()
      setJustPurchased(frame)
    } catch (e: any) { showToast(e.message || 'Fehler beim Kauf') }
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
      if (error) throw new Error(extractEdgeFnError(error, 'Fehler beim Einlosen'))
      if (data?.error) throw new Error(data.error)
      await refreshProfile()
      await loadData()
      showToast('Rahmen eingelost!')
    } catch (e: any) { showToast(e.message || 'Fehler') }
    setActionLoading(null)
  }

  /* ── Frame helpers ─────────────────────────────────────── */
  const getState = (f: FrameDefinition): FrameUIState =>
    resolveFrameState(f, ownedFrames, profile?.active_frame || null, frameProgressMap.get(f.id), coins, profile?.is_founder || false)

  const shopFrames = frameDefs.filter(f => f.category === 'shop')
  const prestigeFrames = frameDefs.filter(f => f.category === 'prestige')
  const eventFrames = frameDefs.filter(f => f.category === 'event')

  const handleRevealComplete = async () => {
    setRevealCard(null)
    await loadData()
  }

  // Reveal animation overlay
  if (revealCard) {
    return (
      <CardRevealAnimation
        card={{
          image_url: revealCard.image_url,
          frame: revealCard.frame,
          rarity: revealCard.rarity,
          serial_display: revealCard.serial_display,
        }}
        onComplete={handleRevealComplete}
      />
    )
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100dvh', background: 'var(--bg-base)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Laden...</div>
      </div>
    )
  }

  if (!equippedCard || !dna) {
    return (
      <div style={{ minHeight: '100dvh', background: 'var(--bg-base)', padding: '80px 20px', textAlign: 'center' }}>
        <h1 className="font-display" style={{ fontSize: 18, color: 'var(--text-primary)', marginBottom: 12 }}>KEINE AVATAR-KARTE</h1>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 24 }}>{t('avatar.createCardFirst')}</p>
        <button onClick={() => router.push('/app/avatar-card/create')} style={{
          padding: '14px 32px', borderRadius: 12, border: 'none',
          background: 'var(--gold-primary)', color: 'var(--text-inverse)',
          fontFamily: "'Oswald',sans-serif", fontSize: 13, fontWeight: 700,
          letterSpacing: 2, cursor: 'pointer', boxShadow: 'var(--shadow-gold)',
        }}>AVATAR ERSTELLEN</button>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg-base)', paddingBottom: 120 }}>
      <style>{`@keyframes pulse-glow{0%,100%{opacity:0.7}50%{opacity:1}}`}</style>

      {/* Header */}
      <div style={{
        padding: '16px 20px 12px', display: 'flex', alignItems: 'center', gap: 12,
        borderBottom: '1px solid var(--bg-elevated)',
      }}>
        <button onClick={() => router.back()} style={{
          background: 'none', border: 'none', color: 'var(--text-secondary)',
          fontSize: 20, cursor: 'pointer', padding: 4,
        }}>&larr;</button>
        <h1 className="font-display" style={{
          fontSize: 16, color: 'var(--gold-primary)', letterSpacing: 2, flex: 1,
        }}>KARTEN-EDITOR</h1>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'var(--bg-surface)', borderRadius: 20,
          padding: '5px 12px', border: '1px solid rgba(255,184,0,0.15)',
        }}>
          <CoinIcon size={16} />
          <span className="font-display" style={{ fontSize: 13, color: 'var(--gold-primary)' }}>
            {coins.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Equipped Card Preview */}
      <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 0 16px' }}>
        <AvatarFrame
          frameType="none"
          imageUrl={equippedCard.imageUrl}
          size="lg"
          username={profile?.username}
          level={profile?.level}
          serialNumber={equippedCard.serialDisplay}
          showInfo
        />
      </div>

      {/* DNA badges */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 5, flexWrap: 'wrap', padding: '0 16px', marginBottom: 20 }}>
        {(['gender', 'origin', 'hair', 'style'] as const).map(key => {
          const val = dna[key]
          const label = DNA_LABELS[key]?.[val] || val.replace(/_/g, ' ')
          return (
            <span key={key} style={{
              padding: '2px 8px', borderRadius: 6,
              background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
              fontSize: 8, color: 'var(--text-muted)',
              fontFamily: "'Oswald',sans-serif", letterSpacing: 1,
              textTransform: 'uppercase',
            }}>
              {label}
            </span>
          )
        })}
      </div>

      {/* Tab Bar */}
      <div style={{ display: 'flex', gap: 6, padding: '0 16px', marginBottom: 16 }}>
        {TAB_CONFIG.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              flex: 1, padding: '10px 4px', borderRadius: 10,
              border: activeTab === tab.key ? '1px solid var(--gold-glow)' : '1px solid var(--border-subtle)',
              background: activeTab === tab.key ? 'var(--gold-subtle)' : 'var(--bg-surface)',
              color: activeTab === tab.key ? 'var(--gold-primary)' : 'var(--text-secondary)',
              fontFamily: "'Oswald',sans-serif", fontSize: 10, fontWeight: 600,
              letterSpacing: 1, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
            }}
          >
            <span>{tab.icon}</span> {tab.label}
          </button>
        ))}
      </div>

      {/* ══ ARCHETYPEN TAB ══════════════════════════════════ */}
      {activeTab === 'archetypes' && (
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
                {dragonOwned && <div style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(74,222,128,0.15)', borderRadius: 8, padding: '4px 10px', border: '1px solid rgba(74,222,128,0.3)' }}><span className='font-display' style={{ fontSize: 9, color: 'var(--status-active)' }}>{'\u2713'} FREIGESCHALTET</span></div>}
                <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 16 }}>
                  <div style={{ fontSize: 52, filter: 'drop-shadow(0 0 16px rgba(251,191,36,0.6))' }}>{'\u{1F432}'}</div>
                  <div style={{ flex: 1 }}>
                    <p className='font-display' style={{ fontSize: 18, color: '#FBBF24', marginBottom: 4 }}>THE DRAGON</p>
                    <p style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>Der ultimative Archetyp. Nur fur Legends — Level 100 und 100 Deals.</p>
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
                      {levelOk && <p style={{ fontSize: 9, color: 'var(--status-active)', marginTop: 4, textAlign: 'center' }}>{'\u2713'}</p>}
                    </div>
                    <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 10, padding: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span className='font-display' style={{ fontSize: 9, color: dealsOk ? 'var(--status-active)' : 'var(--text-secondary)' }}>DEALS</span>
                        <span style={{ fontSize: 10, color: dealsOk ? 'var(--status-active)' : '#FBBF24', fontFamily: "'JetBrains Mono', monospace" }}>{userDeals}/100</span>
                      </div>
                      <div style={{ width: '100%', height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                        <div style={{ width: `${pctDeals}%`, height: '100%', borderRadius: 3, background: dealsOk ? 'var(--status-active)' : 'linear-gradient(90deg, #FBBF24, #F59E0B)' }} />
                      </div>
                      {dealsOk && <p style={{ fontSize: 9, color: 'var(--status-active)', marginTop: 4, textAlign: 'center' }}>{'\u2713'}</p>}
                    </div>
                  </div>
                )}
                {canClaim && (
                  <button onClick={() => setConfirmArchetype(dragon)} style={{ width: '100%', padding: 14, borderRadius: 12, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, #FBBF24, #F59E0B)', color: '#000', fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 700, letterSpacing: 2, marginTop: 14 }}>
                    {'\u{1F432}'} DRAGON FREISCHALTEN
                  </button>
                )}
              </div>
            )
          })()}

          {/* Purchasable Archetypes */}
          <p className='font-display' style={{ fontSize: 9, letterSpacing: 3, color: 'var(--text-secondary)', marginBottom: 8 }}>{'\u{1F3AD}'} ARCHETYPEN · JE 1.000 COINS</p>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.5 }}>Wahle deinen Archetyp und erhalte eine einzigartige Trading Card.</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
            {archetypeItems.filter(a => a.id !== 'dragon').map(item => {
              const owned = ownedArchetypes.includes(item.id)
              const aColor = ARCHETYPE_COLORS[item.id] || '#9CA3AF'
              const aIcon = item.icon_emoji || ARCHETYPE_ICONS[item.id] || '\u{1F3AD}'
              return (
                <div key={item.id} style={{ background: 'var(--bg-surface)', borderRadius: 14, border: `1px solid ${owned ? 'rgba(74,222,128,0.3)' : aColor + '33'}`, padding: '16px 14px', textAlign: 'center', position: 'relative' }}>
                  {owned && <div style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(74,222,128,0.15)', borderRadius: 6, padding: '2px 8px', border: '1px solid rgba(74,222,128,0.3)' }}><span className='font-display' style={{ fontSize: 7, color: 'var(--status-active)' }}>{'\u2713'}</span></div>}
                  <div style={{ fontSize: 36, marginBottom: 8, filter: `drop-shadow(0 0 8px ${aColor})` }}>{aIcon}</div>
                  <p className='font-display' style={{ fontSize: 12, color: 'var(--text-primary)', marginBottom: 4 }}>{item.name}</p>
                  <p style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 10, lineHeight: 1.4, minHeight: 28 }}>{item.description}</p>
                  {owned ? (
                    <div style={{ width: '100%', padding: '8px', borderRadius: 8, background: 'rgba(74,222,128,0.08)', color: 'var(--status-active)', fontFamily: 'var(--font-display)', fontSize: 9, textAlign: 'center' }}>{'\u2713'} IN SAMMLUNG</div>
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

      {/* ══ RAHMEN TAB ══════════════════════════════════════ */}
      {activeTab === 'frames' && (
        <div style={{ padding: '0 16px' }}>
          {shopFrames.length > 0 && (
            <>
              <p className='font-display' style={{ fontSize: 9, letterSpacing: 3, color: 'var(--text-secondary)', marginBottom: 12 }}>{'\u{1F48E}'} SHOP RAHMEN</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 24 }}>
                {shopFrames.map(f => <FrameShopCard key={f.id} frame={f} state={getState(f)} progress={frameProgressMap.get(f.id)} onAction={handleFrameAction} loading={actionLoading === f.id} />)}
              </div>
            </>
          )}

          {prestigeFrames.length > 0 && (
            <>
              <p className='font-display' style={{ fontSize: 9, letterSpacing: 3, color: '#a78bfa', marginBottom: 12 }}>{'\u{1F396}\uFE0F'} PRESTIGE RAHMEN</p>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.5 }}>Diese Rahmen musst du dir verdienen!</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 24 }}>
                {prestigeFrames.map(f => <FrameShopCard key={f.id} frame={f} state={getState(f)} progress={frameProgressMap.get(f.id)} onAction={handleFrameAction} loading={actionLoading === f.id} />)}
              </div>
            </>
          )}

          {eventFrames.length > 0 && (
            <>
              <p className='font-display' style={{ fontSize: 9, letterSpacing: 3, color: '#f472b6', marginBottom: 12 }}>{'\u{1F3AA}'} EVENT RAHMEN</p>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.5 }}>Zeitlich begrenzte Rahmen!</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 24 }}>
                {eventFrames.map(f => <FrameShopCard key={f.id} frame={f} state={getState(f)} progress={frameProgressMap.get(f.id)} onAction={handleFrameAction} loading={actionLoading === f.id} />)}
              </div>
            </>
          )}
        </div>
      )}

      {/* ══ INVENTAR TAB ════════════════════════════════════ */}
      {activeTab === 'inventory' && (
        <div style={{ padding: '0 16px' }}>
          <p className='font-display' style={{ fontSize: 9, letterSpacing: 3, color: 'var(--text-secondary)', marginBottom: 12 }}>{'\u{1F48E}'} DEINE RAHMEN</p>
          {frameDefs.filter(f => ownedFrames.includes(f.id)).length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', marginBottom: 24 }}>
              <p style={{ fontSize: 32, marginBottom: 8 }}>{'\u{1F5BC}\uFE0F'}</p>
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('avatar.noFramesYet')}</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 24 }}>
              {frameDefs.filter(f => ownedFrames.includes(f.id)).map(f => <FrameShopCard key={f.id} frame={f} state={getState(f)} progress={frameProgressMap.get(f.id)} onAction={handleFrameAction} loading={actionLoading === f.id} />)}
            </div>
          )}

          {ownedArchetypes.length > 0 && (
            <>
              <p className='font-display' style={{ fontSize: 9, letterSpacing: 3, color: 'var(--text-secondary)', marginBottom: 12, marginTop: 8 }}>{'\u{1F3AD}'} DEINE ARCHETYPEN</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
                {archetypeItems.filter(a => ownedArchetypes.includes(a.id)).map(item => {
                  const aColor = ARCHETYPE_COLORS[item.id] || '#9CA3AF'
                  const aIcon = item.icon_emoji || ARCHETYPE_ICONS[item.id] || '\u{1F3AD}'
                  return (
                    <div key={item.id} style={{ background: 'var(--bg-surface)', borderRadius: 14, border: '1px solid rgba(74,222,128,0.3)', padding: '16px 14px', textAlign: 'center' }}>
                      <div style={{ fontSize: 36, marginBottom: 8, filter: `drop-shadow(0 0 8px ${aColor})` }}>{aIcon}</div>
                      <p className='font-display' style={{ fontSize: 12, color: 'var(--text-primary)', marginBottom: 4 }}>{item.name}</p>
                      <div style={{ width: '100%', padding: '8px', borderRadius: 8, background: 'rgba(74,222,128,0.08)', color: 'var(--status-active)', fontFamily: 'var(--font-display)', fontSize: 9, textAlign: 'center' }}>{'\u2713'} IN SAMMLUNG</div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* Archetype Purchase Confirmation Modal */}
      {confirmArchetype && (() => {
        const notEnough = coins < confirmArchetype.price_coins
        const missing = confirmArchetype.price_coins - coins
        const aColor = ARCHETYPE_COLORS[confirmArchetype.id] || '#9CA3AF'
        const aIcon = confirmArchetype.icon_emoji || ARCHETYPE_ICONS[confirmArchetype.id] || '\u{1F3AD}'
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'flex-end', zIndex: 200 }} onClick={() => setConfirmArchetype(null)}>
            <div style={{ width: '100%', maxWidth: 430, margin: '0 auto', background: 'var(--bg-surface)', borderRadius: '20px 20px 0 0', border: `1px solid ${notEnough ? 'rgba(248,113,113,0.2)' : aColor + '33'}`, padding: '24px 20px 48px' }} onClick={e => e.stopPropagation()}>
              <div style={{ textAlign: 'center', fontSize: 52, marginBottom: 12, filter: `drop-shadow(0 0 12px ${aColor})` }}>{aIcon}</div>
              <h3 className="font-display" style={{ fontSize: 18, color: notEnough ? 'var(--status-error)' : aColor, textAlign: 'center', marginBottom: 8 }}>
                {notEnough ? 'Nicht genug Coins' : `${confirmArchetype.name} kaufen?`}
              </h3>

              {notEnough ? (
                <>
                  <div style={{ background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.15)', borderRadius: 12, padding: 16, marginBottom: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-display)' }}>DEINE COINS</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 16, color: 'var(--status-error)', fontFamily: 'var(--font-display)', fontWeight: 700 }}><CoinIcon size={15} /> {coins.toLocaleString()}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-display)' }}>PREIS</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 16, color: aColor, fontFamily: 'var(--font-display)', fontWeight: 700 }}><CoinIcon size={15} /> {confirmArchetype.price_coins.toLocaleString()}</span>
                    </div>
                    <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-display)' }}>ES FEHLEN</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 18, color: 'var(--status-error)', fontFamily: 'var(--font-display)', fontWeight: 700 }}><CoinIcon size={16} /> {missing.toLocaleString()}</span>
                    </div>
                  </div>
                  <button onClick={() => { setConfirmArchetype(null); router.push('/app/shop?section=coins') }} style={{ width: '100%', padding: 16, borderRadius: 12, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, var(--gold-dim), var(--gold-primary))', color: 'var(--text-inverse)', fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 700, letterSpacing: 2, marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <CoinIcon size={15} /> COINS KAUFEN
                  </button>
                </>
              ) : (
                <>
                  <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>
                    Du erhaltst eine einzigartige {confirmArchetype.name} Trading Card.
                  </p>
                  <p style={{ textAlign: 'center', fontSize: 14, color: 'var(--text-secondary)', marginBottom: 20 }}>
                    Kosten: <strong style={{ color: aColor, display: 'inline-flex', alignItems: 'center', gap: 3 }}>{confirmArchetype.price_coins.toLocaleString()} <CoinIcon size={14} /></strong>
                  </p>
                  <button onClick={() => purchaseArchetype(confirmArchetype)} disabled={buyingArchetype !== null} style={{ width: '100%', padding: 16, borderRadius: 12, border: 'none', cursor: 'pointer', background: `linear-gradient(135deg, ${aColor}cc, ${aColor})`, color: '#fff', fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 700, letterSpacing: 2, marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    {buyingArchetype ? 'WIRD GEKAUFT...' : <><CoinIcon size={14} /> {confirmArchetype.price_coins.toLocaleString()} VERWENDEN</>}
                  </button>
                </>
              )}

              <button onClick={() => setConfirmArchetype(null)} style={{ width: '100%', padding: 14, borderRadius: 12, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-secondary)', fontFamily: 'var(--font-display)', fontSize: 11, cursor: 'pointer' }}>
                {t('common.cancel')}
              </button>
            </div>
          </div>
        )
      })()}

      {/* Frame Purchase Confirmation Modal */}
      {confirmFrame && (() => {
        const notEnough = confirmFrameState === 'not_eligible'
        const missing = confirmFrame.coin_price - coins
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'flex-end', zIndex: 200 }} onClick={() => setConfirmFrame(null)}>
            <div style={{ width: '100%', maxWidth: 430, margin: '0 auto', background: 'var(--bg-surface)', borderRadius: '20px 20px 0 0', border: `1px solid ${notEnough ? 'rgba(248,113,113,0.2)' : confirmFrame.frame_color + '33'}`, padding: '24px 20px 48px' }} onClick={e => e.stopPropagation()}>
              <div style={{ textAlign: 'center', fontSize: 52, marginBottom: 12, filter: `drop-shadow(0 0 12px ${confirmFrame.frame_color})` }}>{confirmFrame.icon_emoji}</div>
              <h3 className="font-display" style={{ fontSize: 18, color: notEnough ? 'var(--status-error)' : confirmFrame.frame_color, textAlign: 'center', marginBottom: 8 }}>
                {notEnough ? 'Nicht genug Coins' : `${confirmFrame.name_de} kaufen?`}
              </h3>

              {notEnough ? (
                <>
                  <div style={{ background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.15)', borderRadius: 12, padding: 16, marginBottom: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-display)' }}>DEINE COINS</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 16, color: 'var(--status-error)', fontFamily: 'var(--font-display)', fontWeight: 700 }}><CoinIcon size={15} /> {coins.toLocaleString()}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-display)' }}>PREIS</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 16, color: confirmFrame.frame_color, fontFamily: 'var(--font-display)', fontWeight: 700 }}><CoinIcon size={15} /> {confirmFrame.coin_price.toLocaleString()}</span>
                    </div>
                    <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-display)' }}>ES FEHLEN</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 18, color: 'var(--status-error)', fontFamily: 'var(--font-display)', fontWeight: 700 }}><CoinIcon size={16} /> {missing.toLocaleString()}</span>
                    </div>
                  </div>
                  <button onClick={() => { setConfirmFrame(null); router.push('/app/shop?section=coins') }} style={{ width: '100%', padding: 16, borderRadius: 12, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, var(--gold-dim), var(--gold-primary))', color: 'var(--text-inverse)', fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 700, letterSpacing: 2, marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <CoinIcon size={15} /> COINS KAUFEN
                  </button>
                </>
              ) : (
                <>
                  <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
                    Kosten: <strong style={{ color: confirmFrame.frame_color, display: 'inline-flex', alignItems: 'center', gap: 3 }}>{confirmFrame.coin_price.toLocaleString()} <CoinIcon size={14} /></strong>
                  </p>
                  <button onClick={() => purchaseFrame(confirmFrame)} disabled={!!actionLoading} style={{ width: '100%', padding: 16, borderRadius: 12, border: 'none', cursor: 'pointer', background: `linear-gradient(135deg, ${confirmFrame.frame_color}cc, ${confirmFrame.frame_color})`, color: '#fff', fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 700, letterSpacing: 2, marginBottom: 10 }}>
                    {actionLoading ? 'WIRD GEKAUFT...' : <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><CoinIcon size={14} /> {confirmFrame.coin_price.toLocaleString()} VERWENDEN</span>}
                  </button>
                </>
              )}

              <button onClick={() => setConfirmFrame(null)} style={{ width: '100%', padding: 14, borderRadius: 12, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-secondary)', fontFamily: 'var(--font-display)', fontSize: 11, cursor: 'pointer' }}>
                {t('common.cancel')}
              </button>
            </div>
          </div>
        )
      })()}

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

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 100, left: '50%', transform: 'translateX(-50%)',
          padding: '10px 20px', borderRadius: 10, zIndex: 9999,
          background: toast.includes('Fehler') || toast.includes('Nicht genug') ? 'rgba(239,68,68,0.9)' : 'rgba(34,197,94,0.9)',
          color: '#fff', fontSize: 13, fontWeight: 700,
          boxShadow: 'var(--shadow-lg)', whiteSpace: 'nowrap',
        }}>{toast}</div>
      )}
    </div>
  )
}
