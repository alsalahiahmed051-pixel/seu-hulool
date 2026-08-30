'use client'

import { createBrowserClient } from '@supabase/ssr'

/**
 * Browser Supabase client.
 * Use inside Client Components (anything with "use client" at top).
 *
 * Example:
 *   const supabase = createClient()
 *   const { data } = await supabase.from('courses').select()
 *
 * When the keys are absent this returns an inert stand-in rather than
 * throwing — see below.
 */

const NOT_CONFIGURED = {
  message: 'Supabase is not configured (NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY are unset)',
  code: 'not_configured',
}

/**
 * A query builder that answers every call with "no data".
 *
 * `supabase.from(...)` is used as a chain — `.select().eq().order().limit()`,
 * `.delete().eq()`, `.upsert()` — and awaited at an arbitrary point in that
 * chain, so the stand-in has to be both endlessly chainable and thenable.
 * Every branch resolves to the same `{ data: null, error }` the callers
 * already handle, because each one wraps its Supabase calls so a failure
 * degrades to local-only behaviour.
 */
function inertQuery() {
  return new Proxy(function () {}, {
    get(_target, prop) {
      // Awaiting anywhere along the chain ends it.
      if (prop === 'then') return (resolve) => resolve({ data: null, error: NOT_CONFIGURED })
      if (prop === 'catch' || prop === 'finally') return () => inertQuery()
      return () => inertQuery()
    },
    apply() { return inertQuery() },
  })
}

/**
 * Stands in for the client when no project is configured.
 *
 * Without this, `createBrowserClient` throws the moment it is called. It is
 * called during *render* (useSyncedSetting and the auth pages both do), so on
 * a deployment without the keys the throw happened while Next was prerendering
 * — taking down `/`, `/login`, `/reset-password` and `/update-password` at
 * build time rather than at request time. The site itself has worked without
 * an account since the login system was removed, so "no project configured"
 * is a supported state and must not be a build failure.
 *
 * The shapes here match what callers destructure: `data.user` from getUser,
 * `data.subscription.unsubscribe` from onAuthStateChange.
 */
function makeInertClient() {
  return {
    auth: {
      getUser: async () => ({ data: { user: null }, error: NOT_CONFIGURED }),
      getSession: async () => ({ data: { session: null }, error: NOT_CONFIGURED }),
      signOut: async () => ({ error: null }),
      signInWithPassword: async () => ({ data: { user: null, session: null }, error: NOT_CONFIGURED }),
      signInWithOAuth: async () => ({ data: null, error: NOT_CONFIGURED }),
      resetPasswordForEmail: async () => ({ data: null, error: NOT_CONFIGURED }),
      updateUser: async () => ({ data: { user: null }, error: NOT_CONFIGURED }),
      exchangeCodeForSession: async () => ({ data: { session: null }, error: NOT_CONFIGURED }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
    from: () => inertQuery(),
    rpc: () => inertQuery(),
    channel: () => {
      const ch = { on: () => ch, subscribe: () => ch, unsubscribe: () => {} }
      return ch
    },
    removeChannel: () => {},
  }
}

/**
 * One instance, reused.
 *
 * `createClient()` is called during render (useSyncedSetting does), and hooks
 * hold the result in effect dependency arrays — `[load, supabase]`. The real
 * `createBrowserClient` returns the same instance for the same key, so those
 * effects settle. A fresh object per call does not: the effect re-runs, sets
 * state, re-renders, and calls this again — a render loop that locks the page.
 */
let inert = null
const inertClient = () => (inert ??= makeInertClient())

/** True when a real project is configured. Placeholder values don't count. */
export function supabaseConfigured() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  return !!url && !!key && !url.includes('placeholder')
}

export function createClient() {
  if (!supabaseConfigured()) return inertClient()
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
}
