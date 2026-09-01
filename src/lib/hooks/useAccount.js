'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient, supabaseConfigured } from '@/lib/supabase/client'
import { toAppProfile, toDbProfile } from '@/lib/profile-map'

/**
 * The single owner of "who is this student".
 *
 * The app grew three identity systems in parallel: a localStorage blob, a
 * signed device cookie behind student_identities, and a name-plus-password
 * `students` table nothing ever called. This is the one that wins — a real
 * Supabase session, with the profile row behind it.
 *
 * When Supabase is not configured it falls back to the local profile rather
 * than reporting nobody. That is not a nicety: it is how the site behaves in
 * DEMO_MODE, how it builds without keys, and how every browser suite runs. A
 * hook that returned null there would take the whole app down locally.
 *
 * Returns { user, profile, loading, configured, saveProfile, signOut }.
 * `profile` is the app's shape, not the row's — see profile-map.js for why
 * those differ.
 */
export function useAccount({ localProfile, setLocalProfile }) {
  const configured = supabaseConfigured()
  const supabaseRef = useRef(null)
  if (!supabaseRef.current) supabaseRef.current = createClient()
  const supabase = supabaseRef.current

  const [user, setUser] = useState(null)
  const [row, setRow] = useState(null)
  const [loading, setLoading] = useState(configured)

  const load = useCallback(async () => {
    if (!configured) { setLoading(false); return }
    const { data: { user: u } } = await supabase.auth.getUser()
    if (!u) { setUser(null); setRow(null); setLoading(false); return }
    setUser(u)
    const { data } = await supabase
      .from('profiles').select('*').eq('id', u.id).maybeSingle()
    setRow(data || null)
    setLoading(false)
  }, [configured, supabase])

  useEffect(() => {
    let alive = true
    load()
    if (!configured) return
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      if (alive) load()
    })
    return () => { alive = false; subscription?.unsubscribe() }
  }, [configured, supabase, load])

  /**
   * Write profile changes.
   *
   * `patch` is in the app's vocabulary; toDbProfile decides which columns that
   * touches, and deliberately cannot touch student_code or role.
   */
  const saveProfile = useCallback(async (patch) => {
    // No session means the profile being edited is the local one, so that is
    // what the edit has to land on.
    if (!(configured && user)) {
      setLocalProfile?.(p => ({ ...(p || {}), ...patch }))
      return { ok: true, local: true }
    }
    const cols = toDbProfile(patch)
    if (Object.keys(cols).length === 0) return { ok: true }
    const { data, error } = await supabase
      .from('profiles').update({ ...cols, updated_at: new Date().toISOString() })
      .eq('id', user.id).select().maybeSingle()
    if (error) return { ok: false, error: error.message }
    if (data) setRow(data)
    return { ok: true }
  }, [configured, user, supabase, setLocalProfile])

  const signOut = useCallback(async () => {
    if (configured) await supabase.auth.signOut()
    // Clear the local copy too, or a signed-out student on a configured site
    // would still see the old profile from before accounts existed.
    setLocalProfile?.(null)
    setUser(null); setRow(null)
  }, [configured, supabase, setLocalProfile])

  // A session wins when there is one; otherwise the local profile still
  // stands. Not a hedge — a migration path. Supabase *is* configured in
  // production, so returning null for everyone without a session would have
  // wiped every existing student's profile the moment this deployed, before
  // any of them had the chance to sign up. They keep what they have until
  // they make an account, and the account takes over from there.
  const profile = (configured && user)
    ? toAppProfile(row, user.email || '')
    : (localProfile || null)

  /** True once the profile is a real account rather than a device-local one. */
  const signedIn = !!(configured && user)

  return { user, profile, loading, configured, signedIn, saveProfile, signOut, reload: load }
}
