'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import AuthShell, { Input, SubmitBtn, ErrorBox } from '@/components/AuthShell'
import Link from 'next/link'

export default function ResetPasswordPage() {
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/profile/security`,
    })
    setLoading(false)
    if (error) return setError('تعذّر إرسال الرابط. تحقق من البريد وحاول مجدداً.')
    setSent(true)
  }

  if (sent) {
    return (
      <AuthShell title="تم إرسال الرابط" subtitle="">
        <div style={{ textAlign: 'center', padding: '8px 0' }}>
          <div style={{
            width: 64, height: 64, borderRadius: 18,
            background: 'rgba(5,150,105,.15)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 16, fontSize: 32,
          }}>✉️</div>
          <p style={{ color: '#e4ecf8', fontSize: 14, lineHeight: 1.8, marginBottom: 18 }}>
            إذا كان البريد مسجلاً، فقد أرسلنا لك رابط إعادة تعيين كلمة المرور.
          </p>
          <Link href="/login" style={{ color: '#60a5fa', fontSize: 13, textDecoration: 'none' }}>
            العودة لتسجيل الدخول
          </Link>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title="إعادة تعيين كلمة المرور"
      subtitle="أدخل بريدك وسنرسل لك رابطاً لإعادة تعيين كلمة المرور"
      footer={
        <Link href="/login" style={{ color: '#60a5fa', fontWeight: 700, textDecoration: 'none' }}>
          العودة لتسجيل الدخول
        </Link>
      }
    >
      <ErrorBox message={error} />

      <form onSubmit={handleSubmit}>
        <Input
          label="البريد الإلكتروني"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="[email protected]"
          dir="ltr"
          style={{ textAlign: 'left' }}
        />
        <SubmitBtn loading={loading} type="submit">
          إرسال رابط إعادة التعيين
        </SubmitBtn>
      </form>
    </AuthShell>
  )
}
