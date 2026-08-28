'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * Reads an admin-editable content blob (site_content[key].data) for
 * public display. Returns { data, loading }. `data` is null until
 * loaded, or if there's no row / an error — callers fall back to their
 * hardcoded default so the page never breaks before the admin has saved
 * anything (or before the migration is applied).
 */
export function useSiteContent(key) {
  const supabase = createClient()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { data: row } = await supabase
          .from('site_content')
          .select('data')
          .eq('key', key)
          .maybeSingle()
        if (!cancelled && row && row.data) setData(row.data)
      } catch { /* ignore — caller uses its default */ }
      finally { if (!cancelled) setLoading(false) }
    })()
    return () => { cancelled = true }
  }, [supabase, key])

  return { data, loading }
}
