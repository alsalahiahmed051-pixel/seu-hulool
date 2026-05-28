import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * Handles redirects from Supabase auth flows:
 *   - Google/OAuth login → exchanges code for session
 *   - Email confirmation
 *   - Password reset
 */
export async function GET(request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') || '/'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
