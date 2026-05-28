import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/**
 * Root page — checks auth and renders the main app.
 *
 * The main app component (HuloolApp) lives in /src/components/HuloolApp.jsx
 * — drop your seu-portal-pro-v2.jsx content there, refactored to use the
 * hooks from /lib/hooks/* instead of localStorage useStored().
 */
export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Lazy-import the client component to keep the bundle smaller
  const HuloolApp = (await import('@/components/HuloolApp')).default
  return <HuloolApp />
}
