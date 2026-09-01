'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import AuthShell, { Input, SubmitBtn, ErrorBox } from '@/components/AuthShell'

/**
 * Creating a student account.
 *
 * Name, email, password — nothing else. The track, the plan and the rest of
 * the profile are chosen inside the app afterwards, because asking a stranger
 * for six fields before they have seen anything is how you lose them.
 *
 * The university ID is not asked for at all: the site generates one
 * (SEU-26-XXXX) when the account is created.
 */
export default function SignUpPage() {
  const router = useRouter()
  const supabase = createClient()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [fieldErr, setFieldErr] = useState({})

  const validate = () => {
    const e = {}
    if (name.trim().length < 3) e.name = 'اكتب اسمك الكامل'
    if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email.trim())) e.email = 'بريد إلكتروني غير صحيح'
    if (password.length < 8) e.password = 'كلمة المرور ٨ أحرف على الأقل'
    else if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) e.password = 'اجمع بين حروف وأرقام'
    setFieldErr(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    if (!validate()) return
    setLoading(true)

    const addr = email.trim().toLowerCase()
    const { data, error: err } = await supabase.auth.signUp({
      email: addr,
      password,
      // The profiles trigger reads full_name from here, so the name is set
      // before the student ever opens the app.
      options: { data: { full_name: name.trim() } },
    })
    setLoading(false)

    if (err) {
      const m = err.message || ''
      setError(
        /already registered|already exists|User already/i.test(m)
          ? 'هذا البريد مسجّل بالفعل — سجّل الدخول بدلاً من ذلك'
          : /rate|too many|seconds/i.test(m)
            ? 'محاولات كثيرة — انتظر دقيقة ثم أعد المحاولة'
            : 'تعذّر إنشاء الحساب. حاول مجدداً.'
      )
      return
    }

    // With email confirmation on, signUp returns a user and no session; the
    // code goes to their inbox and they finish on /verify.
    if (data?.session) {
      router.push('/')
      router.refresh()
      return
    }
    router.push(`/verify?email=${encodeURIComponent(addr)}`)
  }

  return (
    <AuthShell
      title="أنشئ حسابك"
      subtitle="حساب واحد يحفظ مسارك وموادك ومهامك وجدولك — ويصلك عليه كل جديد."
      footer={
        <>
          لديك حساب؟{' '}
          <Link href="/login" style={{ color: '#60a5fa', fontWeight: 700, textDecoration: 'none' }}>
            سجّل الدخول
          </Link>
        </>
      }
    >
      {/* noValidate: `required` alone hands the student the browser's own
          bubble, which is in the browser's language rather than the page's and
          says nothing useful about the password rule. The per-field Arabic
          messages below are what should be shown, so native validation is
          turned off and validate() is the only gate. */}
      <form onSubmit={handleSubmit} noValidate>
        <ErrorBox message={error} />

        <Input
          label="الاسم الكامل"
          value={name}
          onChange={(e) => { setName(e.target.value); setFieldErr(f => ({ ...f, name: null })) }}
          error={fieldErr.name}
          placeholder="كما تريده أن يظهر في حسابك"
          autoComplete="name"
          required
        />

        <Input
          label="البريد الإلكتروني"
          type="email"
          dir="ltr"
          style={{ textAlign: 'left' }}
          value={email}
          onChange={(e) => { setEmail(e.target.value); setFieldErr(f => ({ ...f, email: null })) }}
          error={fieldErr.email}
          placeholder="name@example.com"
          autoComplete="email"
          required
        />

        <Input
          label="كلمة المرور"
          type="password"
          value={password}
          onChange={(e) => { setPassword(e.target.value); setFieldErr(f => ({ ...f, password: null })) }}
          error={fieldErr.password}
          placeholder="٨ أحرف على الأقل، حروف وأرقام"
          autoComplete="new-password"
          required
        />

        <SubmitBtn loading={loading} style={{ marginTop: 6 }}>
          إنشاء الحساب
        </SubmitBtn>

        <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.8, marginTop: 14, textAlign: 'center' }}>
          سنرسل لك <strong style={{ color: '#94a3b8' }}>رمزاً من ٦ أرقام</strong> للتأكد من بريدك.
          <br />
          رقمك الجامعي في الموقع يُنشأ تلقائياً.
        </div>
      </form>
    </AuthShell>
  )
}
