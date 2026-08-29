import { updateSession } from '@/lib/supabase/middleware'
import { NextResponse } from 'next/server'
import { REQUIRE_LOGIN } from '@/lib/auth-config'

const PUBLIC_ROUTES = [
  '/login',
  '/reset-password',
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

  const isPublic = PUBLIC_ROUTES.some((route) =>
    pathname.startsWith(route)
  )

  if (REQUIRE_LOGIN && !user && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  if (user && pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)',
  ],
}
