'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * Real-time notifications.
 *
 * Returns:
 *   notifications, unreadCount, loading
 *   markRead(id), markAllRead()
 */
export function useNotifications() {
  const supabase = createClient()
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data } = await supabase
      .from('notifications')
      .select('*')
      .or(`user_id.eq.${user.id},user_id.is.null`)
      .order('created_at', { ascending: false })
      .limit(50)

    setNotifications(data || [])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    load()

    const channel = supabase
      .channel('notif_changes')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        (payload) => {
          // New notification arrived (for this user or broadcast)
          setNotifications(prev => [payload.new, ...prev])
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [load, supabase])

  const markRead = useCallback(async (id) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
      .eq('user_id', user.id)  // can't mark broadcasts as read in DB; handled client-side

    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, is_read: true } : n)
    )
  }, [supabase])

  const markAllRead = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false)

    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
  }, [supabase])

  const unreadCount = notifications.filter(n => !n.is_read).length

  return { notifications, unreadCount, loading, markRead, markAllRead, refresh: load }
}
