'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AuthShell, { Input, SubmitBtn, ErrorBox } from '@/components/AuthShell'
import Link from 'next/link'

function LoginForm() {
  const router = useRouter()
  const search = useSearchParams()
  const next = search.get('next') || '/'
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  // A way in that does not need email to work. The owner hands a code over
  // directly — WhatsApp, in person — and the student types it here.
  const [mode, setMode] = useState('password')   // 'password' | 'code'
  const [code, setCode] = useState('')
  // /auth/callback redirects here with ?error=auth_failed when a code exchange
  // fails, and this page ignored it — a failed sign-in landed on a blank form
  // with no hint that anything had gone wrong.
  const [error, setError] = useState(
    search.get('error') === 'auth_failed'
      ? 'تعذّر إكمال تسجيل الدخول — حاول مرة أخرى'
      : null
  )

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)

    if (error) {
      const msg = error.message.includes('Invalid')
        ? 'البريد الإلكتروني أو كلمة المرور غير صحيحة'
        : 'حدث خطأ. حاول مجدداً.'
      setError(msg)
      return
    }

    router.push(next)
    router.refresh()
  }

  /**
   * Redeem a login code.
   *
   * The server checks the code and hands back a one-time token; the session is
   * created here, in the browser, by exchanging it. Nothing is emailed at any
   * point — which is the whole reason this exists.
   */
  const handleCode = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/login-code', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok || !d.tokenHash) {
        setLoading(false)
        setError(d.error || 'الكود غير صحيح أو منتهي')
        return
      }
      const { error: vErr } = await supabase.auth.verifyOtp({
        token_hash: d.tokenHash, type: 'magiclink',
      })
      setLoading(false)
      if (vErr) { setError('تعذّر إكمال الدخول — اطلب كوداً جديداً'); return }
      router.push(next)
      router.refresh()
    } catch {
      setLoading(false)
      setError('تعذّر الاتصال')
    }
  }

  const handleGoogle = async () => {
    setError(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    })
    if (error) setError('تعذّر تسجيل الدخول عبر جوجل')
  }

  return (
    <AuthShell
      title="تسجيل الدخول"
      subtitle="أهلاً بعودتك — ادخل لتجد مسارك وموادك ومهامك كما تركتها."
      footer={
        <>
          ليس لديك حساب؟{' '}
          <Link href="/signup" style={{ color: '#60a5fa', fontWeight: 700, textDecoration: 'none' }}>
            أنشئ حساباً
          </Link>
          <span style={{ color: '#334155', margin: '0 8px' }}>·</span>
          <Link href="/?browse=1" style={{ color: '#7d97b8', textDecoration: 'none' }}>
            تصفّح بدون حساب
          </Link>
        </>
      }
    >
      <ErrorBox message={error} />

      <button
        onClick={handleGoogle}
        type="button"
        style={{
          width: '100%', padding: '11px 16px', borderRadius: 12,
          border: '1.5px solid #1c2e48', background: '#0f1c33',
          color: '#e4ecf8', fontSize: 14, fontWeight: 700,
          fontFamily: 'inherit', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 10, marginBottom: 18, transition: 'all .2s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#0a8a58')}
        onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#1c2e48')}
      >
        <svg width="18" height="18" viewBox="0 0 18 18">
          <path fill="#4285F4" d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" />
          <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" />
          <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" />
          <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" />
        </svg>
        المتابعة عبر جوجل
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, fontSize: 11, color: '#3a5270' }}>
        <div style={{ flex: 1, height: 1, background: '#1c2e48' }} />
        أو
        <div style={{ flex: 1, height: 1, background: '#1c2e48' }} />
      </div>

      {mode === 'password' ? (
        <form onSubmit={handleSubmit}>
          <Input
            label="البريد الإلكتروني"
            type="email" required value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com" dir="ltr"
            style={{ textAlign: 'left' }}
          />
          <Input
            label="كلمة المرور"
            type="password" required value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••" minLength={8}
          />
          <div style={{ textAlign: 'left', marginBottom: 18 }}>
            <Link href="/reset-password" style={{ fontSize: 12, color: '#7d97b8', textDecoration: 'none' }}>
              نسيت كلمة المرور؟
            </Link>
          </div>
          <SubmitBtn loading={loading} type="submit">تسجيل الدخول</SubmitBtn>
        </form>
      ) : (
        <form onSubmit={handleCode}>
          <Input
            label="كود الدخول"
            type="text" required value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="SEU-XXXX-XXXX-XXXX" dir="ltr"
            style={{ textAlign: 'center', letterSpacing: 1, fontFamily: 'ui-monospace, monospace' }}
          />
          <div style={{ fontSize: 11.5, color: '#7d97b8', lineHeight: 1.8, marginBottom: 18 }}>
            كود تحصل عليه من إدارة الموقع. صالح لمرة واحدة، وينتهي بعد ٧ أيام.
          </div>
          <SubmitBtn loading={loading} type="submit">دخول بالكود</SubmitBtn>
        </form>
      )}

      <button
        type="button"
        onClick={() => { setError(null); setMode(mode === 'password' ? 'code' : 'password') }}
        style={{
          width: '100%', marginTop: 14, background: 'none', border: 'none',
          color: '#7d97b8', fontSize: 12.5, fontWeight: 700,
          fontFamily: 'inherit', cursor: 'pointer',
        }}
      >
        {mode === 'password' ? 'لدي كود دخول من الإدارة' : 'الدخول بالبريد وكلمة المرور'}
      </button>
    </AuthShell>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#050a16' }} />}>
      <LoginForm />
    </Suspense>
  )
}
