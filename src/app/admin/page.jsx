import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ShieldAlert } from 'lucide-react'
import { getAdminUser } from '@/lib/supabase/server'
import AdminPanelClient from '@/components/AdminPanelClient'

const DEMO_MODE =
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder')

export const metadata = {
  title: 'لوحة التحكم | حلول',
}

export default async function AdminPage() {
  if (DEMO_MODE) {
    return (
      <ForbiddenScreen
        title="لوحة التحكم غير متاحة"
        message="لم يتم إعداد Supabase لهذا المشروع بعد."
      />
    )
  }

  const admin = await getAdminUser()

  if (!admin) {
    // Distinguish "not logged in at all" from "logged in but not admin"
    // so a regular student doesn't just see a confusing dead end.
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) redirect('/login?next=/admin')

    return (
      <ForbiddenScreen
        title="غير مصرح لك بالدخول"
        message="هذه الصفحة مخصصة لمسؤولي المنصة فقط. حسابك الحالي ليس لديه صلاحية admin."
      />
    )
  }

  return (
    <AdminPanelClient
      adminName={admin.profile.full_name}
      adminEmail={admin.user.email}
    />
  )
}

function ForbiddenScreen({ title, message }) {
  return (
    <div dir="rtl" style={{
      minHeight: '100vh', background: '#050a16', color: '#e4ecf8',
      fontFamily: "'Tajawal','Cairo',sans-serif",
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }}>
      <div style={{ textAlign: 'center', maxWidth: 380 }}>
        <div style={{
          width: 60, height: 60, borderRadius: 18,
          background: 'linear-gradient(135deg,#001f5a,#0038b8)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 16,
        }}>
          <ShieldAlert size={26} color="#fff" />
        </div>
        <h1 style={{ fontSize: 20, fontWeight: 900, marginBottom: 8 }}>{title}</h1>
        <p style={{ fontSize: 13, color: '#7d97b8', lineHeight: 1.8, marginBottom: 20 }}>{message}</p>
        <Link href="/" style={{ color: '#60a5fa', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
          الرجوع للصفحة الرئيسية
        </Link>
      </div>
    </div>
  )
}
