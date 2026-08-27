import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { REQUIRE_LOGIN } from '@/lib/auth-config'

const DEMO_MODE =
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder')

export default async function HomePage() {
  if (!DEMO_MODE && REQUIRE_LOGIN) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')
  }

  const HuloolApp = (await import('@/components/HuloolApp')).default
  return <HuloolApp />
}
