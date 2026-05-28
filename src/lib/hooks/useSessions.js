'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * Manages study sessions (Pomodoro log).
 *
 * Returns:
 *   sessions: array of all sessions
 *   todayCount, todayMinutes
 *   weekCount
 *   streak: days in a row
 *   activeDays: dates where user had at least one session
 *   logSession({ subject, duration_minutes, course_id? })
 */
export function useSessions() {
  const supabase = createClient()
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSessions([]); setLoading(false); return }

    const ninetyDaysAgo = new Date()
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

    const { data } = await supabase
      .from('sessions')
      .select('id, subject, duration_minutes, session_date, completed_at')
      .eq('user_id', user.id)
      .gte('session_date', ninetyDaysAgo.toISOString().slice(0, 10))
      .order('completed_at', { ascending: false })

    setSessions(data || [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  const logSession = useCallback(async ({ subject, duration_minutes, course_id }) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'not_authenticated' }

    const { data, error } = await supabase
      .from('sessions')
      .insert({
        user_id: user.id,
        subject: subject || null,
        duration_minutes,
        course_id: course_id || null,
        session_date: new Date().toISOString().slice(0, 10),
      })
      .select()
      .single()

    if (error) return { error: error.message }

    setSessions(prev => [data, ...prev])
    return { data }
  }, [supabase])

  // Derived stats
  const today = new Date().toISOString().slice(0, 10)
  const todaySessions = sessions.filter(s => s.session_date === today)
  const todayCount = todaySessions.length
  const todayMinutes = todaySessions.reduce((a, s) => a + s.duration_minutes, 0)

  const last7Days = (() => {
    const out = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i)
      out.push(d.toISOString().slice(0, 10))
    }
    return out
  })()
  const weekCount = sessions.filter(s => last7Days.includes(s.session_date)).length

  const activeDays = [...new Set(sessions.map(s => s.session_date))]

  const streak = (() => {
    const dates = new Set(activeDays)
    let count = 0
    const d = new Date()
    while (true) {
      const key = d.toISOString().slice(0, 10)
      if (dates.has(key)) { count++; d.setDate(d.getDate() - 1) }
      else if (count === 0 && key === today) {
        // allow yesterday if today is empty
        d.setDate(d.getDate() - 1)
        if (dates.has(d.toISOString().slice(0, 10))) { count++; d.setDate(d.getDate() - 1) }
        else break
      } else break
    }
    return count
  })()

  return {
    sessions, loading,
    todayCount, todayMinutes, weekCount,
    streak, activeDays,
    logSession,
    refresh: load,
  }
}
