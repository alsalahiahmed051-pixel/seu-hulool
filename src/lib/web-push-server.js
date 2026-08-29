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

// Read lazily rather than at module load: a value captured while the module
// is first evaluated can go stale, and reading on demand always reflects the
// environment the request is actually running in.
const publicKey = () => (process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '').trim()
const privateKey = () => (process.env.VAPID_PRIVATE_KEY || '').trim()
const subject = () => (process.env.VAPID_SUBJECT || 'mailto:support@hulool.app').trim()

export function pushConfigured() {
  return Boolean(publicKey() && privateKey())
}

/**
 * Which VAPID variables the running deployment can actually see.
 *
 * Reports presence only — never a key value — so an admin can tell "I never
 * added it" apart from "I added it but haven't redeployed", which is
 * otherwise indistinguishable from the outside.
 */
export function pushEnvStatus() {
  return {
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: Boolean((process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '').trim()),
    VAPID_PUBLIC_KEY: Boolean((process.env.VAPID_PUBLIC_KEY || '').trim()),
    VAPID_PRIVATE_KEY: Boolean(privateKey()),
    VAPID_SUBJECT: Boolean((process.env.VAPID_SUBJECT || '').trim()),
  }
}

let configured = false
function ensureConfigured() {
  if (configured || !pushConfigured()) return pushConfigured()
  webpush.setVapidDetails(subject(), publicKey(), privateKey())
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
