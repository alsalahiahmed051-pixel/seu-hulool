'use client'

/**
 * Client-side Web Push helpers.
 *
 * Registers the /sw.js service worker, subscribes the browser to push using
 * the server's public VAPID key, and mirrors the subscription to the server
 * so admin broadcasts can reach the device while the app is closed.
 *
 * All functions are defensive: unsupported browsers, denied permission, or an
 * unconfigured server simply resolve to a falsy/handled result.
 */

export function pushSupported() {
  return typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

export async function registerServiceWorker() {
  if (!pushSupported()) return null
  try { return await navigator.serviceWorker.register('/sw.js') }
  catch { return null }
}

async function serverConfig() {
  try {
    const res = await fetch('/api/push/subscribe')
    if (!res.ok) return { configured: false, publicKey: '' }
    return await res.json()
  } catch { return { configured: false, publicKey: '' } }
}

// Current permission/subscription state, for rendering a toggle.
export async function pushState() {
  if (!pushSupported()) return { supported: false, subscribed: false, permission: 'unsupported' }
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = reg ? await reg.pushManager.getSubscription() : null
  return { supported: true, subscribed: Boolean(sub), permission: Notification.permission }
}

/**
 * Opt the browser in: requests permission, subscribes, and saves to server.
 * `profile` (optional) attaches track/plan so broadcasts can be targeted.
 * Returns { ok, reason }.
 */
export async function enablePush(profile) {
  if (!pushSupported()) return { ok: false, reason: 'unsupported' }
  const cfg = await serverConfig()
  if (!cfg.configured || !cfg.publicKey) return { ok: false, reason: 'server' }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return { ok: false, reason: 'denied' }

  const reg = (await navigator.serviceWorker.getRegistration()) || (await registerServiceWorker())
  if (!reg) return { ok: false, reason: 'sw' }
  await navigator.serviceWorker.ready

  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(cfg.publicKey),
    })
  }

  try {
    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription: sub.toJSON(),
        track: profile?.track || null,
        plan: profile?.plan || null,
        name: profile?.name || null,
      }),
    })
  } catch { return { ok: false, reason: 'save' } }
  return { ok: true }
}

// Opt out: unsubscribe locally and forget on the server.
export async function disablePush() {
  if (!pushSupported()) return { ok: true }
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = reg ? await reg.pushManager.getSubscription() : null
  if (sub) {
    const endpoint = sub.endpoint
    try { await sub.unsubscribe() } catch {}
    try {
      await fetch('/api/push/subscribe', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint }),
      })
    } catch {}
  }
  return { ok: true }
}
