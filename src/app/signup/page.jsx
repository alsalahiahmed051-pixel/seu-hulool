'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AuthShell, { Input, SubmitBtn, ErrorBox } from '@/components/AuthShell'
import Link from 'next/link'

export default function SignupPage() {
  const router = useRouter()
  const supabase = createClient()

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  const validate = () => {
    if (!fullName.trim() || fullName.trim().length < 3) return 'الاسم قصير جداً'
    if (!/^\S+@\S+\.\S+$/.test(email)) return 'البريد الإلكتروني غير صحيح'
    if (password.length < 8) return 'كلمة المرور يجب أن تكون 8 أحرف على الأقل'
    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      return 'كلمة المرور يجب أن تحتوي على حروف وأرقام'
    }
    if (password !== password2) return 'كلمتا المرور غير متطابقتين'
    return null
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    const v = validate()
    if (v) return setError(v)

    setLoading(true)
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName.trim() },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    setLoading(false)

    if (error) {
      const msg = error.message.includes('already')
        ? 'هذا البريد مسجل بالفعل. سجّل الدخول بدلاً من ذلك.'
        : 'حدث خطأ. حاول مجدداً.'
      setError(msg)
      return
    }
    setSuccess(true)
  }

  if (success) {
    return (
      <AuthShell title="تحقق من بريدك" subtitle="">
        <div style={{ textAlign: 'center', padding: '12px 0' }}>
          <div style={{
            width: 64, height: 64, borderRadius: 18,
            background: 'rgba(5,150,105,.15)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 16, fontSize: 32,
          }}>📧</div>
          <p style={{ color: '#e4ecf8', fontSize: 14, lineHeight: 1.8, marginBottom: 18 }}>
            أرسلنا رسالة تحقق إلى <strong style={{ color: '#60a5fa', direction: 'ltr', display: 'inline-block' }}>{email}</strong>
            <br />اضغط على الرابط في الرسالة لإكمال التسجيل.
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
      title="أنشئ حسابك"
      subtitle="انضم لآلاف الطلاب واستفد من كل ميزات حلول"
      footer={
        <>
          لديك حساب؟{' '}
          <Link href="/login" style={{ color: '#60a5fa', fontWeight: 700, textDecoration: 'none' }}>
            سجّل الدخول
          </Link>
        </>
      }
    >
      <ErrorBox message={error} />

      <form onSubmit={handleSubmit}>
        <Input
          label="الاسم الكامل"
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="أحمد المحمد"
          minLength={3}
        />
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
        <Input
          label="كلمة المرور"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="8 أحرف على الأقل (حروف وأرقام)"
          minLength={8}
        />
        <Input
          label="تأكيد كلمة المرور"
          type="password"
          required
          value={password2}
          onChange={(e) => setPassword2(e.target.value)}
          placeholder="••••••••"
          minLength={8}
        />

        <div style={{ fontSize: 11, color: '#7d97b8', marginBottom: 18, lineHeight: 1.7 }}>
          بإنشاء حسابك، توافق على{' '}
          <Link href="/terms" style={{ color: '#60a5fa', textDecoration: 'none' }}>شروط الاستخدام</Link>
          {' '}و{' '}
          <Link href="/privacy" style={{ color: '#60a5fa', textDecoration: 'none' }}>سياسة الخصوصية</Link>.
        </div>

        <SubmitBtn loading={loading} type="submit">
          إنشاء الحساب
        </SubmitBtn>
      </form>
    </AuthShell>
  )
}
