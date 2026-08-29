import webpush from 'web-push'
import { createAdminClient } from '@/lib/supabase/server'

/**
 * Server-side Web Push helper.
 *
 * Requires three env vars (generate once with `npx web-push generate-vapid-keys`):
 *   NEXT_PUBLIC_VAPID_PUBLIC_KEY  — public key, also shipped to the browser
 *   VAPID_PUBLIC_KEY              — same public key (server side)
 *   VAPID_PRIVATE_KEY            — private key, server only
 *   VAPID_SUBJECT (optional)     — mailto: or https URL contact, defaults below
 *
 * When the keys are absent every function no-ops gracefully, so the rest of
 * the app keeps working without push configured.
 */

const PUBLIC = process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''
const PRIVATE = process.env.VAPID_PRIVATE_KEY || ''
const SUBJECT = process.env.VAPID_SUBJECT || 'mailto:support@hulool.app'

export function pushConfigured() {
  return Boolean(PUBLIC && PRIVATE)
}

let configured = false
function ensureConfigured() {
  if (configured || !pushConfigured()) return pushConfigured()
  webpush.setVapidDetails(SUBJECT, PUBLIC, PRIVATE)
  configured = true
  return true
}

// Does an audience tag apply to a subscription row? Mirrors the client-side
// audienceMatches(): 'all' → everyone; 'track:X' → that track;
// 'plan:X|Y' → that track + plan.
function subMatchesAudience(sub, audience) {
  if (!audience || audience === 'all') return true
  if (audience.startsWith('track:')) return sub.track === audience.slice(6)
  if (audience.startsWith('plan:')) {
    const [tr, pl] = audience.slice(5).split('|')
    return sub.track === tr && sub.plan === pl
  }
  return true
}

/**
 * Sends a push notification to every stored subscription that matches the
 * audience. Prunes subscriptions the push service reports as gone (404/410).
 * Returns { sent, failed, skipped } — safe to ignore.
 */
export async function sendPushToAudience({ title, body, url = '/', audience = 'all' }) {
  if (!ensureConfigured()) return { sent: 0, failed: 0, skipped: true }

  const db = createAdminClient()
  const { data: subs, error } = await db
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth, track, plan')
  if (error || !subs?.length) return { sent: 0, failed: 0, skipped: false }

  const payload = JSON.stringify({ title, body, url, tag: 'hulool-broadcast' })
  const targets = subs.filter((s) => subMatchesAudience(s, audience))
  const stale = []
  let sent = 0
  let failed = 0

  await Promise.all(
    targets.map(async (s) => {
      const subscription = { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }
      try {
        await webpush.sendNotification(subscription, payload)
        sent++
      } catch (e) {
        failed++
        if (e?.statusCode === 404 || e?.statusCode === 410) stale.push(s.id)
      }
    })
  )

  if (stale.length) await db.from('push_subscriptions').delete().in('id', stale)
  return { sent, failed, skipped: false }
}
