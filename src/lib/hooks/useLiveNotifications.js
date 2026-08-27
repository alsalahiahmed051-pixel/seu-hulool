'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * Live notifications adapter for the main app UI.
 *
 * Reads broadcast notifications (user_id IS NULL, sent from the admin
 * panel) plus the logged-in user's own notifications from Supabase, and
 * exposes them in the exact shape the existing NotifPanel/bell expect:
 *   [{ id, title, text, time, iconKey, read }]
 *
 * Read-state is tracked in localStorage (broadcasts have no per-user
 * read flag in the DB, and anonymous visitors have no account) — so the
 * hook returns a `setNotifs(updater)` that only ever persists which ids
 * the viewer has marked read. It never mutates the DB-owned list.
 *
 * Works for anonymous visitors too: they can still read broadcasts
 * (the RLS policy allows `user_id IS NULL` for everyone). New broadcasts
 * arrive live via a realtime subscription.
 */

const READ_KEY = 'notif_read_ids'
// Keys must exist in the app's NOTIF_ICONS map (book/file/calendar/star/bell).
const TYPE_ICON = { announcement: 'bell', info: 'file', warning: 'bell', success: 'star' }

function getReadIds() {
  try { return new Set(JSON.parse(localStorage.getItem(READ_KEY) || '[]')) } catch { return new Set() }
}
function saveReadIds(set) {
  try { localStorage.setItem(READ_KEY, JSON.stringify([...set])) } catch { /* ignore */ }
}
function timeAgo(iso) {
  try {
    const d = new Date(iso)
    const diff = (Date.now() - d.getTime()) / 1000
    if (diff < 60) return 'الآن'
    if (diff < 3600) return `قبل ${Math.floor(diff / 60)} دقيقة`
    if (diff < 86400) return `قبل ${Math.floor(diff / 3600)} ساعة`
    return d.toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' })
  } catch { return '' }
}

export function useLiveNotifications() {
  const supabase = createClient()
  const [raw, setRaw] = useState([])
  const [readIds, setReadIds] = useState(() => new Set())

  useEffect(() => { setReadIds(getReadIds()) }, [])

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    let query = supabase
      .from('notifications')
      .select('id, type, title, body, created_at')
      .order('created_at', { ascending: false })
      .limit(50)
    query = user ? query.or(`user_id.eq.${user.id},user_id.is.null`) : query.is('user_id', null)
    const { data } = await query
    setRaw(data || [])
  }, [supabase])

  useEffect(() => {
    load()
    const channel = supabase
      .channel('notif_live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (payload) => {
        // Only surface broadcasts (or this user's own) — realtime doesn't
        // apply RLS to the payload, so filter client-side.
        if (payload.new?.user_id == null) setRaw(prev => [payload.new, ...prev])
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [load, supabase])

  const notifs = raw.map(n => ({
    id: n.id,
    type: n.type || 'info',
    title: n.title,
    text: n.body,
    time: timeAgo(n.created_at),
    iconKey: TYPE_ICON[n.type] || 'bell',
    read: readIds.has(n.id),
  }))

  // Compatible with the existing setNotifs(updater) calls, which only ever
  // flip read:true on some/all items. We derive the new read-id set from
  // whatever the updater returns and persist it.
  const setNotifs = useCallback((updater) => {
    const currentView = raw.map(n => ({ id: n.id, read: getReadIds().has(n.id) }))
    const next = typeof updater === 'function' ? updater(currentView) : (Array.isArray(updater) ? updater : currentView)
    setReadIds(prev => {
      const newSet = new Set(prev)
      next.forEach(n => { if (n && n.read && n.id != null) newSet.add(n.id) })
      saveReadIds(newSet)
      return newSet
    })
  }, [raw])

  return [notifs, setNotifs]
}
