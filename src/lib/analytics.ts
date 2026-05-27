// PostHog Analytics – DealBuddy Event Tracking
// Kostenlos bis 1M Events/Monat auf EU Cloud
// posthog-js is lazy-loaded to avoid blocking initial page load (~350KB savings)
//
// DSGVO: Strict Opt-In. PostHog is initialized ONLY when the user has explicitly
// granted consent via the cookie banner (localStorage `db_analytics_consent` === 'granted').
// All track()/identify() calls become no-ops when consent has not been granted.

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY || ''
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://eu.i.posthog.com'

export const ANALYTICS_CONSENT_KEY = 'db_analytics_consent'
export type AnalyticsConsent = 'granted' | 'denied' | null

let initialized = false
let posthogInstance: unknown = null
let loadingPromise: Promise<unknown> | null = null

interface PostHogLike {
  init: (key: string, options: Record<string, unknown>) => void
  identify: (id: string, properties?: Record<string, unknown>) => void
  reset: () => void
  capture: (event: string, properties?: Record<string, unknown>) => void
  opt_out_capturing?: () => void
}

function getPostHog(): Promise<PostHogLike> {
  if (posthogInstance) return Promise.resolve(posthogInstance as PostHogLike)
  if (loadingPromise) return loadingPromise as Promise<PostHogLike>
  loadingPromise = import('posthog-js').then((mod) => {
    posthogInstance = mod.default
    return posthogInstance as PostHogLike
  })
  return loadingPromise as Promise<PostHogLike>
}

/**
 * Read current consent value from localStorage. SSR-safe.
 */
export function getAnalyticsConsent(): AnalyticsConsent {
  if (typeof window === 'undefined') return null
  const v = window.localStorage.getItem(ANALYTICS_CONSENT_KEY)
  if (v === 'granted' || v === 'denied') return v
  return null
}

/**
 * Persist consent decision and (de)activate analytics accordingly.
 * - 'granted': initializes PostHog if not yet running
 * - 'denied': stops further tracking; existing instance opts out of capturing
 */
export function setAnalyticsConsent(value: 'granted' | 'denied'): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(ANALYTICS_CONSENT_KEY, value)
  if (value === 'granted') {
    initAnalytics()
  } else {
    initialized = false
    if (posthogInstance) {
      const ph = posthogInstance as PostHogLike
      try {
        ph.opt_out_capturing?.()
      } catch {
        /* no-op */
      }
    }
  }
}

export function initAnalytics() {
  if (initialized || !POSTHOG_KEY || typeof window === 'undefined') return
  if (getAnalyticsConsent() !== 'granted') return
  initialized = true
  getPostHog().then((posthog) => {
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      capture_pageview: true,
      capture_pageleave: true,
      persistence: 'localStorage',
      autocapture: true,
      // DSGVO: Cookie-less tracking
      disable_cookie: true,
      disable_session_recording: true,
    })
  })
}

export function identifyUser(userId: string, properties?: Record<string, unknown>) {
  if (!POSTHOG_KEY) return
  if (getAnalyticsConsent() !== 'granted') return
  getPostHog().then((posthog) => posthog.identify(userId, properties))
}

export function resetUser() {
  if (!POSTHOG_KEY) return
  if (getAnalyticsConsent() !== 'granted') return
  getPostHog().then((posthog) => posthog.reset())
}

// ─── Event Tracking Helper ──────────────────────────────────────────────────

export function track(event: string, properties?: Record<string, unknown>) {
  if (!POSTHOG_KEY) return
  if (getAnalyticsConsent() !== 'granted') return
  getPostHog().then((posthog) => posthog.capture(event, properties))
}

// ─── Pre-defined Events (alle aus dem Fragenkatalog) ────────────────────────

// Auth & Onboarding
export const trackSignupStarted = () => track('signup_started')
export const trackSignupCompleted = (method: string) => track('signup_completed', { method })
export const trackOnboardingCompleted = () => track('onboarding_completed')
export const trackProfileCreated = (username: string) => track('profile_created', { username })
export const trackLoginCompleted = () => track('login_completed')

// Deals / Core Loop
export const trackDealCreated = (dealType: string) => track('deal_created', { deal_type: dealType })
export const trackDealSent = (dealId: string) => track('deal_sent', { deal_id: dealId })
export const trackDealAccepted = (dealId: string) => track('deal_accepted', { deal_id: dealId })
export const trackResultSubmitted = (dealId: string) => track('result_submitted', { deal_id: dealId })
export const trackResultConfirmed = (dealId: string, won: boolean) => track('result_confirmed', { deal_id: dealId, won })
export const trackDealCancelled = (dealId: string) => track('deal_cancelled', { deal_id: dealId })

// Social
export const trackFirstFriendAdded = () => track('first_friend_added')
export const trackFollowUser = (targetId: string) => track('follow_user', { target_id: targetId })
export const trackUnfollowUser = (targetId: string) => track('unfollow_user', { target_id: targetId })

// Tippgruppen
export const trackTipGroupCreated = (groupId: string) => track('tip_group_created', { group_id: groupId })
export const trackTipSubmitted = (groupId: string) => track('tip_submitted', { group_id: groupId })

// Shop & Economy
export const trackShopOpened = () => track('shop_opened')
export const trackItemPurchased = (item: string, coins: number, method: 'coins' | 'stripe') =>
  track('item_purchased', { item, coins, method })
export const trackStripeCheckoutStarted = (product: string, amount: number) =>
  track('stripe_checkout_started', { product, amount_cents: amount })
export const trackCoinsPurchased = (product: string, coins: number) =>
  track('coins_purchased', { product, coins })

// Battle Pass
export const trackBattlePassOpened = () => track('battle_pass_opened')
export const trackBattlePassRewardClaimed = (tier: number) => track('bp_reward_claimed', { tier })
export const trackPremiumPassPurchased = () => track('premium_pass_purchased')

// Cards & Frames
export const trackFramePurchased = (frameId: string, coins: number) =>
  track('frame_purchased', { frame_id: frameId, coins })
export const trackPackOpened = (packId: string) => track('pack_opened', { pack_id: packId })
export const trackCardViewed = (cardId: string) => track('card_viewed', { card_id: cardId })

// Viral & Share
export const trackShareClicked = (contentType: string, method: string) =>
  track('share_clicked', { content_type: contentType, method })
export const trackInviteSent = (method: string) => track('invite_sent', { method })
export const trackInviteAccepted = (code: string) => track('invite_accepted', { code })

// Engagement
export const trackPushOpened = (tag: string) => track('push_opened', { tag })
export const trackStreakClaimed = (day: number) => track('streak_claimed', { day })
export const trackDailyChallengeCompleted = (challengeId: string) =>
  track('daily_challenge_completed', { challenge_id: challengeId })
export const trackMilestoneClaimed = (milestoneId: string) =>
  track('milestone_claimed', { milestone_id: milestoneId })
export const trackRewardClaimed = (rewardType: string) => track('reward_claimed', { reward_type: rewardType })

// Navigation / Screens
export const trackScreenView = (screen: string) => track('screen_view', { screen })
