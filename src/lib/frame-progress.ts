/**
 * frame-progress.ts — V11 Store Redesign
 * Utilities for fetching frame definitions, progress, and resolving UI state
 */

import { supabase } from './supabase'

/* ─── Types ─── */

export interface FrameDefinition {
  id: string
  name_de: string
  name_en: string
  description_de: string | null
  description_en: string | null
  icon_emoji: string
  rarity: string
  category: 'shop' | 'prestige' | 'event'
  coin_price: number
  sort_order: number
  is_animated: boolean
  frame_color: string
  frame_glow: string
  prestige_condition: any
  event_condition: any
  event_id: string | null
  is_active: boolean
}

export interface FrameProgress {
  frame_id: string
  current_value: number
  target_value: number
  progress_pct: number
  is_claimable: boolean
}

export interface FramePackDef {
  id: string
  name_de: string
  name_en: string
  description_de: string | null
  description_en: string | null
  icon_emoji: string
  coin_price: number
  sort_order: number
  rarity: string
  is_active: boolean
}

export interface PackLootEntry {
  reward_type: string
  reward_value: string
  weight: number
}

export type FrameUIState =
  | 'buyable'
  | 'owned'
  | 'equipped'
  | 'locked'
  | 'in_progress'
  | 'claimable'
  | 'event_active'
  | 'event_expired'
  | 'founder_only'
  | 'not_eligible'

/* ─── Fetchers ─── */

export async function fetchAllFrameDefinitions(): Promise<FrameDefinition[]> {
  const { data } = await supabase
    .from('frame_definitions')
    .select('*')
    .eq('is_active', true)
    .order('sort_order')
  return (data || []) as FrameDefinition[]
}

export async function fetchFrameProgress(userId: string): Promise<Map<string, FrameProgress>> {
  // Trigger server recompute first (ignore errors — progress is best-effort)
  try { await supabase.rpc('compute_frame_progress', { p_user_id: userId }) } catch (_) { /* noop */ }

  const { data } = await supabase
    .from('user_frame_progress')
    .select('*')
    .eq('user_id', userId)

  const map = new Map<string, FrameProgress>()
  for (const row of (data || [])) {
    map.set(row.frame_id, row as FrameProgress)
  }
  return map
}

export async function fetchUserOwnedFrames(userId: string): Promise<string[]> {
  const { data } = await supabase
    .from('user_unlocked_items')
    .select('item_code')
    .eq('user_id', userId)
    .eq('item_type', 'frame')

  const frames = (data || []).map((r: any) => r.item_code)
  if (!frames.includes('bronze')) frames.push('bronze')
  return frames
}

export async function fetchFramePacks(): Promise<FramePackDef[]> {
  const { data } = await supabase
    .from('frame_packs')
    .select('*')
    .eq('is_active', true)
    .order('sort_order')
  return (data || []) as FramePackDef[]
}

export async function fetchPackLootTable(packId: string): Promise<PackLootEntry[]> {
  const { data } = await supabase
    .from('frame_pack_loot_table')
    .select('reward_type, reward_value, weight')
    .eq('pack_id', packId)
  return (data || []) as PackLootEntry[]
}

/* ─── State Resolution ─── */

export function resolveFrameState(
  frame: FrameDefinition,
  ownedFrames: string[],
  activeFrame: string | null,
  progress: FrameProgress | undefined,
  userCoins: number,
  isFounder: boolean,
): FrameUIState {
  const isOwned = ownedFrames.includes(frame.id)

  if (isOwned && frame.id === activeFrame) return 'equipped'
  if (isOwned) return 'owned'

  if (frame.category === 'shop') {
    if (userCoins >= frame.coin_price) return 'buyable'
    return 'not_eligible'
  }

  if (frame.category === 'prestige') {
    if (frame.id === 'founder') {
      if (isFounder) return 'claimable'
      return 'founder_only'
    }
    if (progress?.is_claimable) return 'claimable'
    if (progress && progress.current_value > 0) return 'in_progress'
    return 'locked'
  }

  if (frame.category === 'event') {
    if (progress?.is_claimable) return 'claimable'
    if (progress && progress.current_value > 0) return 'event_active'
    // For now, events without progress show as locked
    return 'locked'
  }

  return 'locked'
}

/* ─── Action Text ─── */

export function getFrameActionText(state: FrameUIState, frame: FrameDefinition, progress?: FrameProgress, t?: (key: string) => string): string {
  const tr = t || ((k: string) => k)
  switch (state) {
    case 'buyable':
      return `${frame.coin_price} Coins`
    case 'owned':
      return tr('components.frameUnlocked')
    case 'equipped':
      return tr('components.frameEquipped')
    case 'locked':
      if (frame.category === 'prestige') {
        const cond = frame.prestige_condition
        if (cond?.type === 'challenge_wins') return tr('components.frameWinChallenges').replace('{target}', String(cond.target))
        if (cond?.type === 'challenges_created') return tr('components.frameCreateChallenges').replace('{target}', String(cond.target))
        if (cond?.type === 'win_streak') return tr('components.frameWinStreak').replace('{target}', String(cond.target))
        if (cond?.type === 'season_leaderboard_top') return tr('components.frameSeasonTop').replace('{target}', String(cond.target))
      }
      return tr('components.frameLocked')
    case 'in_progress':
      return `${progress?.current_value || 0}/${progress?.target_value || 0}`
    case 'claimable':
      return tr('components.frameRedeem')
    case 'event_active':
      return `${progress?.current_value || 0}/${progress?.target_value || 0}`
    case 'event_expired':
      return tr('components.frameEventOver')
    case 'founder_only':
      return tr('components.frameFounderOnly')
    case 'not_eligible':
      return tr('components.frameTooFewCoins')
    default:
      return ''
  }
}

/* ─── Motivation Text ─── */

export function getMotivationText(state: FrameUIState, frame: FrameDefinition, progress?: FrameProgress, t?: (key: string) => string): string {
  const tr = t || ((k: string) => k)
  if (state === 'in_progress' || state === 'event_active') {
    const pct = progress?.progress_pct || 0
    if (pct >= 80) return tr('components.motivationAlmostDone')
    if (pct >= 50) return tr('components.motivationHalfway')
    if (pct >= 25) return tr('components.motivationGoodProgress')
    return tr('components.motivationOnTheWay')
  }
  if (state === 'claimable') return tr('components.motivationReady')
  if (state === 'not_eligible') return tr('components.motivationEarnMore')
  if (state === 'founder_only') return tr('components.motivationFounderExclusive')
  return ''
}
