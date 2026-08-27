'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

function lsGet(key, initial) {
  try {
    const v = localStorage.getItem(key)
    return v == null ? initial : JSON.parse(v)
  } catch { return initial }
}
function lsSet(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)) } catch { /* ignore */ }
}

/**
 * A drop-in replacement for useStored(key, initial) that ALSO syncs a
 * single scalar preference to the user's `profiles` row when they're
 * logged in — so settings follow them across devices.
 *
 * Design (safe by default):
 *   - localStorage is always the instant UI source of truth (no flash,
 *     works offline, works for anonymous visitors since login is optional)
 *   - on mount, if logged in, the profile value is pulled down once
 *   - each change is written through to the profile (fire-and-forget)
 *   - every Supabase call is wrapped so a failure never breaks the app
 *
 * Returns the same [value, setValue] tuple as useStored.
 */
export function useSyncedSetting(localKey, column, initial) {
  const supabase = createClient()
  const [val, setValState] = useState(() => lsGet(localKey, initial))
  const userIdRef = useRef(null)

  useEffect(() => { lsSet(localKey, val) }, [localKey, val])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user || cancelled) return
        userIdRef.current = user.id
        const { data } = await supabase.from('profiles').select(column).eq('id', user.id).maybeSingle()
        if (cancelled || !data) return
        const remote = data[column]
        if (remote != null) setValState(remote)
      } catch { /* ignore — localStorage stays authoritative */ }
    })()
    return () => { cancelled = true }
  }, [supabase, column])

  const setVal = useCallback((updater) => {
    setValState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      if (userIdRef.current) {
        supabase.from('profiles')
          .update({ [column]: next })
          .eq('id', userIdRef.current)
          .then(() => {}, () => {})
      }
      return next
    })
  }, [supabase, column])

  return [val, setVal]
}
