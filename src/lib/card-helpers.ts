import { supabase } from '@/lib/supabase'

/* ═══════════════════════════════════════════════════════════════
   Card Helpers — Shared queries, types, and utilities
   for the new card_catalog system
   ═══════════════════════════════════════════════════════════════ */

/* ── Types ──────────────────────────────────────────────────── */

export interface CardCatalogRow {
  id: string
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
  card_code: string
  serial_number: string
  serial_display: string | null
  image_url: string | null
  is_claimed: boolean
  is_available: boolean
  season: string
  created_at: string
}

export interface UserCardRow {
  id: string
  user_id: string
  card_id: string
  is_equipped: boolean
  obtained_from: string
  obtained_at: string
}

export interface UserCardWithCatalog extends UserCardRow {
  card_catalog: CardCatalogRow
}

export interface EquippedCard {
  userCardId: string
  cardId: string
  frame: string
  rarity: string
  imageUrl: string | null
  serialDisplay: string | null
  cardCode: string
  gender: string
  origin: string
  hair: string
  style: string
  accessory: string
  effect: string
  archetype: string | null
  age: string
  obtainedFrom: string
  obtainedAt: string
}

export interface AvatarDNA {
  user_id: string
  gender: string
  origin: string
  hair: string
  style: string
  current_accessory: string
  current_effect: string
  current_frame: string
  created_at: string
  updated_at: string
}

export interface UnlockedItem {
  user_id: string
  item_type: 'accessory' | 'effect' | 'frame'
  item_code: string
  unlocked_via: string
  unlocked_at: string
}

export interface ItemPrice {
  item_type: 'accessory' | 'effect' | 'frame'
  item_code: string
  price_coins: number
  display_name: string
  display_icon: string | null
  sort_order: number
}

/* ── Rarity config ─────────────────────────────────────────── */

export const RARITY_COLORS: Record<string, string> = {
  common: '#9CA3AF',
  rare: '#3B82F6',
  epic: '#8B5CF6',
  legendary: '#F59E0B',
  founder: '#F59E0B',
  event: '#EC4899',
}

export const RARITY_LABELS: Record<string, string> = {
  common: 'COMMON',
  rare: 'RARE',
  epic: 'EPIC',
  legendary: 'LEGENDARY',
  founder: 'FOUNDER',
  event: 'EVENT',
}

export const FRAME_COLORS: Record<string, string> = {
  bronze: '#CD7F32', silver: '#C0C0C0', gold: '#F59E0B',
  emerald: '#22C55E', sapphire: '#3B82F6', ruby: '#EF4444',
  amethyst: '#8B5CF6', topaz: '#F97316', crystal: '#8B5CF6',
  obsidian: '#6B7280', dealer: '#10B981', winner: '#EAB308',
  legend: '#FBBF24', icon: '#A78BFA', hero: '#60A5FA',
  founder: '#F59E0B', futties: '#EC4899', neon: '#34D399',
  celestial: '#E0E7FF', player_of_the_week: '#FBBF24',
}

/* ── Fallback card image ───────────────────────────────────── */

export function getCardImageUrl(card: { image_url?: string | null; rarity?: string }): string {
  if (card.image_url) return card.image_url
  const rarity = card.rarity || 'common'
  const mapped = rarity === 'legendary' ? 'legendary'
    : rarity === 'founder' ? 'founder'
    : rarity === 'epic' ? 'epic'
    : rarity === 'rare' ? 'rare'
    : 'common'
  return `/cards/card-${mapped}.webp?v=1`
}

/* ── Map frame name to rarity (for backward compat) ────────── */

export function frameToRarity(frame: string): string {
  const map: Record<string, string> = {
    bronze: 'common', silver: 'common',
    gold: 'rare',
    emerald: 'epic', sapphire: 'epic', ruby: 'epic', amethyst: 'epic', topaz: 'epic',
    legend: 'legendary', icon: 'legendary', obsidian: 'legendary',
    founder: 'founder', hero: 'founder',
    futties: 'event', neon: 'event', celestial: 'event', player_of_the_week: 'event',
  }
  return map[frame] || 'common'
}

/* ── Queries ───────────────────────────────────────────────── */

export async function getEquippedCard(userId: string): Promise<EquippedCard | null> {
  const { data, error } = await supabase
    .from('user_cards')
    .select('*, card_catalog(*)')
    .eq('user_id', userId)
    .eq('is_equipped', true)
    .single()

  if (error || !data?.card_catalog) return null

  const c = data.card_catalog as CardCatalogRow
  return {
    userCardId: data.id,
    cardId: c.id,
    frame: c.frame,
    rarity: c.rarity,
    imageUrl: c.image_url,
    serialDisplay: c.serial_display,
    cardCode: c.card_code,
    gender: c.gender,
    origin: c.origin,
    hair: c.hair,
    style: c.style,
    accessory: c.accessory,
    effect: c.effect,
    archetype: c.archetype,
    age: c.age,
    obtainedFrom: data.obtained_from,
    obtainedAt: data.obtained_at,
  }
}

export async function getUserCards(userId: string): Promise<UserCardWithCatalog[]> {
  const { data, error } = await supabase
    .from('user_cards')
    .select('*, card_catalog(*)')
    .eq('user_id', userId)
    .not('card_id', 'is', null)
    .order('obtained_at', { ascending: false })

  if (error || !data) return []
  return data as UserCardWithCatalog[]
}

export async function getUserDNA(userId: string): Promise<AvatarDNA | null> {
  const { data, error } = await supabase
    .from('user_avatar_dna')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error || !data) return null
  return data as AvatarDNA
}

export async function getUnlockedItems(userId: string): Promise<UnlockedItem[]> {
  const { data, error } = await supabase
    .from('user_unlocked_items')
    .select('*')
    .eq('user_id', userId)

  if (error || !data) return []
  return data as UnlockedItem[]
}

export async function getItemPrices(): Promise<ItemPrice[]> {
  const { data, error } = await supabase
    .from('card_item_prices')
    .select('*')
    .order('sort_order')

  if (error || !data) return []
  return data as ItemPrice[]
}

/* ── Archetype types & helpers ──────────────────────────── */

export interface ArchetypeShopItem {
  id: string
  name: string
  description: string
  icon_emoji: string
  icon_image_url: string | null
  price_coins: number
  rarity: string
  sort_order: number
  is_active: boolean
}

export interface UserOwnedArchetype {
  user_id: string
  archetype: string
  purchased_at: string
}

export const ARCHETYPE_ICONS: Record<string, string> = {
  founder: '\u{1F3D7}\uFE0F',
  trader: '\u{1F4CA}',
  hacker: '\u{1F4BB}',
  visionary: '\u{1F52E}',
  strategist: '\u265F\uFE0F',
  hustler: '\u{1F4B0}',
  maverick: '\u{1F3AF}',
  titan: '\u26A1',
  dragon: '\u{1F432}',
}

export const ARCHETYPE_COLORS: Record<string, string> = {
  founder: '#F59E0B',
  trader: '#3B82F6',
  hacker: '#22C55E',
  visionary: '#8B5CF6',
  strategist: '#6B7280',
  hustler: '#EF4444',
  maverick: '#EC4899',
  titan: '#F97316',
  dragon: '#FBBF24',
  base: '#9CA3AF',
}

export const ARCHETYPE_LABELS: Record<string, string> = {
  founder: 'FOUNDER',
  trader: 'TRADER',
  hacker: 'HACKER',
  visionary: 'VISIONARY',
  strategist: 'STRATEGIST',
  hustler: 'HUSTLER',
  maverick: 'MAVERICK',
  titan: 'TITAN',
  dragon: 'DRAGON',
}

export async function getArchetypeShopItems(): Promise<ArchetypeShopItem[]> {
  const { data, error } = await supabase
    .from('archetype_shop_items')
    .select('*')
    .eq('is_active', true)
    .order('sort_order')

  if (error || !data) return []
  return data as ArchetypeShopItem[]
}

export async function getUserOwnedArchetypes(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('user_owned_archetypes')
    .select('archetype')
    .eq('user_id', userId)

  if (error || !data) return []
  return data.map((d: any) => d.archetype)
}
