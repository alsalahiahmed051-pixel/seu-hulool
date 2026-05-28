'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * Manages personal notes for a specific course.
 * Auto-saves with debounce (1.2 sec after last keystroke).
 *
 * Returns:
 *   text, setText, saving, lastSavedAt
 */
export function useNote(courseId) {
  const supabase = createClient()
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState(null)
  const [loaded, setLoaded] = useState(false)
  const debounceRef = useRef(null)
  const lastSavedTextRef = useRef('')

  // Load on mount
  useEffect(() => {
    if (!courseId) return
    let cancelled = false

    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoaded(true); return }

      const { data } = await supabase
        .from('notes')
        .select('content, updated_at')
        .eq('user_id', user.id)
        .eq('course_id', courseId)
        .maybeSingle()

      if (cancelled) return
      if (data) {
        setText(data.content)
        lastSavedTextRef.current = data.content
        setLastSavedAt(new Date(data.updated_at))
      }
      setLoaded(true)
    }
    load()
    return () => { cancelled = true }
  }, [courseId, supabase])

  // Debounced save
  useEffect(() => {
    if (!loaded || !courseId) return
    if (text === lastSavedTextRef.current) return

    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setSaving(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setSaving(false); return }

      if (text.trim() === '') {
        await supabase
          .from('notes')
          .delete()
          .eq('user_id', user.id)
          .eq('course_id', courseId)
      } else {
        await supabase
          .from('notes')
          .upsert({
            user_id: user.id,
            course_id: courseId,
            content: text,
          }, { onConflict: 'user_id,course_id' })
      }

      lastSavedTextRef.current = text
      setLastSavedAt(new Date())
      setSaving(false)
    }, 1200)

    return () => clearTimeout(debounceRef.current)
  }, [text, courseId, loaded, supabase])

  const saveNow = useCallback(async () => {
    clearTimeout(debounceRef.current)
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    if (text.trim() === '') {
      await supabase.from('notes').delete().eq('user_id', user.id).eq('course_id', courseId)
    } else {
      await supabase.from('notes').upsert({
        user_id: user.id, course_id: courseId, content: text,
      }, { onConflict: 'user_id,course_id' })
    }
    lastSavedTextRef.current = text
    setLastSavedAt(new Date())
    setSaving(false)
  }, [text, courseId, supabase])

  return { text, setText, saving, lastSavedAt, loaded, saveNow }
}
