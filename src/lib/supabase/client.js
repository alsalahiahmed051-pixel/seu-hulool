'use client'

import { createBrowserClient } from '@supabase/ssr'

/**
 * Browser Supabase client.
 * Use inside Client Components (anything with "use client" at top).
 *
 * Example:
 *   const supabase = createClient()
 *   const { data } = await supabase.from('courses').select()
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
}
