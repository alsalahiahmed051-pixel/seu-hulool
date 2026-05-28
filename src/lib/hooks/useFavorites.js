'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * Manages user's favorite courses.
 *
 * Returns:
 *   favorites: array of course objects { id, slug, name_ar, icon, color, ... }
 *   loading: boolean
 *   toggle(courseId): adds/removes — returns { action: 'added'|'removed' }
 *   isFavorite(courseId): boolean
 */
export function useFavorites() {
  const supabase = createClient()
  const [favorites, setFavorites] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setFavorites([])
      setLoading(false)
      return
    }
    const { data, error } = await supabase
      .from('favorites')
      .select('course_id, courses(id, slug, name_ar, icon, color, track)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (!error && data) {
      setFavorites(data.map(r => r.courses).filter(Boolean))
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    load()

    const channel = supabase.channel('favorites_changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'favorites' },
        () => load()
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [load, supabase])

  const toggle = useCallback(async (courseId) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'not_authenticated' }

    const exists = favorites.some(f => f.id === courseId)
    if (exists) {
      const { error } = await supabase
        .from('favorites')
        .delete()
        .eq('user_id', user.id)
        .eq('course_id', courseId)
      if (error) return { error: error.message }
      setFavorites(prev => prev.filter(f => f.id !== courseId))
      return { action: 'removed' }
    } else {
      const { error } = await supabase
        .from('favorites')
        .insert({ user_id: user.id, course_id: courseId })
      if (error) return { error: error.message }
      await load()
      return { action: 'added' }
    }
  }, [favorites, supabase, load])

  const isFavorite = useCallback(
    (courseId) => favorites.some(f => f.id === courseId),
    [favorites]
  )

  return { favorites, loading, toggle, isFavorite, refresh: load }
}
