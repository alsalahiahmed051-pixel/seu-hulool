import { updateSession } from '@/lib/supabase/middleware'
import { NextResponse } from 'next/server'

const PUBLIC_ROUTES = ['/login', '/signup', '/reset-password', '/auth/callback']
const ADMIN_ROUTES = ['/admin']

export async function middleware(request) {
  const { pathname } = request.nextUrl
  const { response, user } = await updateSession(request)

  // Redirect to login if accessing protected route without auth
  const isPublic = PUBLIC_ROUTES.some(r => pathname.startsWith(r))
  if (!user && !isPublic && pathname !== '/') {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  // Redirect away from login/signup if already authenticated
  if (user && (pathname === '/login' || pathname === '/signup')) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  // Admin routes are checked again in the page itself (defense in depth)
  return response
}

export const config = {
  matcher: [
    // Match all routes except static assets and Next.js internals
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)',
  ],
}
