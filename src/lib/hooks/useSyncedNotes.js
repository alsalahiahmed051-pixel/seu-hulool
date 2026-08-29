'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

const KEY = 'notes'

function lsGet() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {} } catch { return {} }
}
function lsSet(obj) {
  try { localStorage.setItem(KEY, JSON.stringify(obj)) } catch { /* ignore */ }
}

/**
 * Drop-in replacement for useStored("notes", {}). Notes are an object
 * keyed by course-name string -> text, so they sync to a name-keyed
 * `app_notes` table (same reasoning as favorites).
 *
 * Same safety model: localStorage is the instant UI truth; Supabase is
 * best-effort for logged-in users with every call wrapped. On login the
 * two are merged (server wins for a key present on both; local-only
 * keys are kept and pushed up).
 */
export function useSyncedNotes() {
  const supabase = createClient()
  // Empty on the first render so server and client markup match; saved notes
  // are adopted right after mount. See useSyncedSetting for why.
  const [notes, setNotesState] = useState({})
  const hydrated = useRef(false)
  const userIdRef = useRef(null)

  useEffect(() => { hydrated.current = true; setNotesState(lsGet()) }, [])

  useEffect(() => { if (hydrated.current) lsSet(notes) }, [notes])

  const pushToServer = useCallback(async (obj) => {
    const uid = userIdRef.current
    if (!uid) return
    try {
      await supabase.from('app_notes').delete().eq('user_id', uid)
      const rows = Object.entries(obj)
        .filter(([, content]) => content && String(content).trim())
        .map(([subject, content]) => ({ user_id: uid, subject, content }))
      if (rows.length) await supabase.from('app_notes').insert(rows)
    } catch { /* ignore */ }
  }, [supabase])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user || cancelled) return
        userIdRef.current = user.id
        const { data } = await supabase.from('app_notes').select('subject, content').eq('user_id', user.id)
        if (cancelled || !data) return
        const local = lsGet()
        const merged = { ...local }
        data.forEach(r => { merged[r.subject] = r.content }) // server wins per key
        setNotesState(merged)
        if (Object.keys(merged).length !== data.length) pushToServer(merged)
      } catch { /* ignore */ }
    })()
    return () => { cancelled = true }
  }, [supabase, pushToServer])

  const setNotes = useCallback((updater) => {
    setNotesState(prev => {
      const next = typeof updater === 'function' ? updater(prev || {}) : updater
      pushToServer(next)
      return next
    })
  }, [pushToServer])

  return [notes, setNotes]
}
