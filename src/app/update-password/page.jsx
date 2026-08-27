'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AuthShell, { Input, SubmitBtn, ErrorBox } from '@/components/AuthShell'

export default function UpdatePasswordPage() {
  const router = useRouter()
  const supabase = createClient()

  const [ready, setReady] = useState(false)
  const [hasSession, setHasSession] = useState(false)
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setHasSession(!!user)
      setReady(true)
    })
  }, [supabase])

  const validate = () => {
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
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (error) {
      setError('تعذّر تحديث كلمة المرور. جرّب طلب رابط إعادة تعيين جديد.')
      return
    }
    setSuccess(true)
    setTimeout(() => {
      router.push('/')
      router.refresh()
    }, 1500)
  }

  if (!ready) {
    return <div style={{ minHeight: '100vh', background: '#050a16' }} />
  }

  if (!hasSession) {
    return (
      <AuthShell title="الرابط منتهي الصلاحية" subtitle="">
        <p style={{ color: '#e4ecf8', fontSize: 14, lineHeight: 1.8, marginBottom: 18, textAlign: 'center' }}>
          رابط إعادة تعيين كلمة المرور منتهي أو تم استخدامه من قبل.
          <br />اطلب رابطاً جديداً وحاول مجدداً.
        </p>
        <SubmitBtn onClick={() => router.push('/reset-password')}>
          طلب رابط جديد
        </SubmitBtn>
      </AuthShell>
    )
  }

  if (success) {
    return (
      <AuthShell title="تم التحديث بنجاح" subtitle="">
        <div style={{ textAlign: 'center', padding: '8px 0' }}>
          <div style={{
            width: 64, height: 64, borderRadius: 18,
            background: 'rgba(5,150,105,.15)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 16, fontSize: 32,
          }}>✓</div>
          <p style={{ color: '#e4ecf8', fontSize: 14, lineHeight: 1.8 }}>
            تحدّثت كلمة المرور، جارٍ نقلك للتطبيق...
          </p>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title="كلمة مرور جديدة"
      subtitle="أدخل كلمة المرور الجديدة لحسابك"
    >
      <ErrorBox message={error} />

      <form onSubmit={handleSubmit}>
        <Input
          label="كلمة المرور الجديدة"
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
        <SubmitBtn loading={loading} type="submit">
          حفظ كلمة المرور
        </SubmitBtn>
      </form>
    </AuthShell>
  )
}
