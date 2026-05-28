'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

export function useProfile() {
  const supabase = createClient()
  const [profile, setProfile] = useState(null)
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setUser(user)

    if (!user) { setProfile(null); setLoading(false); return }

    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    setProfile(data)
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    load()
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => load())
    return () => subscription.unsubscribe()
  }, [load, supabase])

  const updateProfile = useCallback(async (updates) => {
    if (!user) return { error: 'not_authenticated' }
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single()
    if (error) return { error: error.message }
    setProfile(data)
    return { data }
  }, [user, supabase])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setProfile(null)
    setUser(null)
  }, [supabase])

  return { profile, user, loading, updateProfile, signOut, isAdmin: profile?.role === 'admin' || profile?.role === 'moderator' }
}
