import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { ShieldAlert } from 'lucide-react'
import { createClient, getAdminUser } from '@/lib/supabase/server'
import { isPinConfigured, verifyPinCookie } from '@/lib/admin-pin'
import AdminPanelClient from '@/components/AdminPanelClient'
import AdminPinGate from '@/components/AdminPinGate'

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

  // Second factor: the admin PIN, but only if one has been configured.
  const pinConfigured = isPinConfigured()
  if (pinConfigured) {
    const store = await cookies()
    const ok = verifyPinCookie(admin.user.id, store.get('admin_pin')?.value)
    if (!ok) {
      return <AdminPinGate adminName={admin.profile.full_name} />
    }
  }

  return (
    <AdminPanelClient
      adminName={admin.profile.full_name}
      adminEmail={admin.user.email}
      pinConfigured={pinConfigured}
    />
  )
}

function ForbiddenScreen({ title, message }) {
  return (
    <div dir="rtl" style={{
      minHeight: '100vh', background: '#050a16', color: '#e4ecf8',
      fontFamily: "'Tajawal','Cairo',sans-serif",
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div style={{ textAlign: 'center', maxWidth: 380 }}>
        <div style={{
          width: 60, height: 60, borderRadius: 18,
          background: 'linear-gradient(135deg,#043d2a,#066b45)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16,
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
