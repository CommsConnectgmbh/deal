import { supabase } from '@/lib/supabase'

/**
 * Trigger a push notification to a user via the send-push edge function.
 * Fails silently if user has no subscription.
 */
export async function triggerPush(
  userId: string,
  title: string,
  body: string,
  url?: string,
  tag?: string
) {
  try {
    await supabase.functions.invoke('send-push', {
      body: {
        user_id: userId,
        title,
        body,
        url: url || '/app/home',
        tag: tag || 'dealbuddy',
      },
    })
  } catch (e) {
    // Push is best-effort, don't break the app
    console.warn('Push notification failed:', e)
  }
}
