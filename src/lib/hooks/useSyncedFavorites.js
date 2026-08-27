'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

const KEY = 'favorites'

function lsGet() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]') } catch { return [] }
}
function lsSet(arr) {
  try { localStorage.setItem(KEY, JSON.stringify(arr)) } catch { /* ignore */ }
}

/**
 * Drop-in replacement for useStored("favorites", []). Favorites are an
 * array of course-name strings (that's how the whole UI identifies
 * courses), so they sync to a name-keyed `app_favorites` table rather
 * than the UUID-based `favorites` table.
 *
 * Safe by default: localStorage is the instant UI truth; Supabase is a
 * best-effort enhancement for logged-in users, and every call is
 * wrapped so a missing table / no session / network error just falls
 * back to localStorage silently. On login the two sets are merged
 * (union) so nothing a user starred anonymously is lost.
 */
export function useSyncedFavorites() {
  const supabase = createClient()
  const [favorites, setFavState] = useState(() => lsGet())
  const userIdRef = useRef(null)

  useEffect(() => { lsSet(favorites) }, [favorites])

  // Replace the server's copy with the full current list (idempotent,
  // tiny data). Fire-and-forget; errors ignored.
  const pushToServer = useCallback(async (list) => {
    const uid = userIdRef.current
    if (!uid) return
    try {
      await supabase.from('app_favorites').delete().eq('user_id', uid)
      if (list.length) {
        await supabase.from('app_favorites').insert(list.map(subject => ({ user_id: uid, subject })))
      }
    } catch { /* ignore */ }
  }, [supabase])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user || cancelled) return
        userIdRef.current = user.id
        const { data } = await supabase.from('app_favorites').select('subject').eq('user_id', user.id)
        if (cancelled || !data) return
        const server = data.map(r => r.subject)
        const local = lsGet()
        const merged = Array.from(new Set([...server, ...local]))
        setFavState(merged)
        // If local had extras the server didn't, sync the union up.
        if (merged.length !== server.length) pushToServer(merged)
      } catch { /* ignore */ }
    })()
    return () => { cancelled = true }
  }, [supabase, pushToServer])

  const setFavorites = useCallback((updater) => {
    setFavState(prev => {
      const next = typeof updater === 'function' ? updater(prev || []) : updater
      pushToServer(next)
      return next
    })
  }, [pushToServer])

  return [favorites, setFavorites]
}
