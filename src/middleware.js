import { updateSession } from '@/lib/supabase/middleware'
import { NextResponse } from 'next/server'
import { REQUIRE_LOGIN } from '@/lib/auth-config'

// Reachable without a session. `/verify` is where a brand-new account lands
// to enter its emailed code — it has a user row but no session yet, so it
// must not redirect to login. `/update-password` was missing, which made its
// own "الرابط منتهي الصلاحية" screen unreachable: middleware sent expired
// recovery links to a bare login page instead of the explanation.
const PUBLIC_ROUTES = [
  '/login',
  '/signup',
  '/verify',
  '/reset-password',
  '/update-password',
  '/auth/callback',
  '/terms',
  '/privacy',
]

const DEMO_MODE =
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder')

export async function middleware(request) {
  if (DEMO_MODE) return NextResponse.next()

  const { pathname } = request.nextUrl
  const { response, user } = await updateSession(request)

  const isPublic = PUBLIC_ROUTES.some((route) => pathname.startsWith(route))

  if (REQUIRE_LOGIN && !user && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  // Deliberately not redirecting a signed-in user away from /login: that made
  // it impossible to reach the page to switch accounts without signing out
  // first, and it fired whether or not login was required.

  return response
}

export const config = {
  matcher: [
    // API routes and share links are excluded on purpose. The matcher used to
    // catch them, so with REQUIRE_LOGIN on, every fetch() would have been
    // answered with a 302 to an HTML login page and every JSON parse would
    // have failed — downloads, the assistant, identity, subscriptions, all of
    // it. Those routes authenticate themselves, individually and explicitly.
    '/((?!api/|f/|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)',
  ],
}
