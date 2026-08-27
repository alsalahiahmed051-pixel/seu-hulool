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
  const [otp, setOtp] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [otpError, setOtpError] = useState(null)
  const [resending, setResending] = useState(false)
  const [resendMsg, setResendMsg] = useState(null)

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

  const handleVerify = async (e) => {
    e.preventDefault()
    setOtpError(null)
    if (!/^\d{6}$/.test(otp)) {
      setOtpError('أدخل الرمز المكوّن من 6 أرقام')
      return
    }
    setVerifying(true)
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: 'signup',
    })
    setVerifying(false)

    if (error) {
      setOtpError('الرمز غير صحيح أو منتهي الصلاحية. تأكد منه أو أعد الإرسال.')
      return
    }
    router.push('/')
    router.refresh()
  }

  const handleResend = async () => {
    setResending(true)
    setResendMsg(null)
    const { error } = await supabase.auth.resend({ type: 'signup', email })
    setResending(false)
    setResendMsg(error ? 'تعذّر إعادة الإرسال، حاول بعد قليل' : 'تم إرسال رمز جديد ✓')
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
          <p style={{ color: '#e4ecf8', fontSize: 14, lineHeight: 1.8, marginBottom: 22 }}>
            أرسلنا رمز تحقق مكوّن من 6 أرقام إلى <strong style={{ color: '#60a5fa', direction: 'ltr', display: 'inline-block' }}>{email}</strong>
          </p>

          <ErrorBox message={otpError} />

          <form onSubmit={handleVerify}>
            <Input
              label="رمز التحقق"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              required
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              dir="ltr"
              style={{ textAlign: 'center', letterSpacing: 8, fontSize: 22, fontWeight: 800 }}
            />
            <SubmitBtn loading={verifying} type="submit">
              تأكيد والدخول
            </SubmitBtn>
          </form>

          <div style={{ marginTop: 18, fontSize: 12, color: '#7d97b8' }}>
            لم يصلك الرمز؟{' '}
            <button
              onClick={handleResend}
              disabled={resending}
              type="button"
              style={{
                background: 'none', border: 'none', padding: 0,
                color: '#60a5fa', fontWeight: 700, cursor: resending ? 'wait' : 'pointer',
                fontFamily: 'inherit', fontSize: 12,
              }}
            >
              {resending ? 'جارٍ الإرسال...' : 'إعادة الإرسال'}
            </button>
            {resendMsg && <div style={{ marginTop: 6, color: '#7d97b8' }}>{resendMsg}</div>}
          </div>

          <div style={{ marginTop: 18 }}>
            <Link href="/login" style={{ color: '#7d97b8', fontSize: 12, textDecoration: 'none' }}>
              العودة لتسجيل الدخول
            </Link>
          </div>
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
