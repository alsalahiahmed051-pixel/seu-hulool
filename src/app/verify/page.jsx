'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import AuthShell, { SubmitBtn, ErrorBox } from '@/components/AuthShell'

const RESEND_SECONDS = 60

function VerifyForm() {
  const router = useRouter()
  const search = useSearchParams()
  const supabase = createClient()
  const email = (search.get('email') || '').trim()

  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [cooldown, setCooldown] = useState(0)
  const inputRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  // A resend button with no cooldown invites a student to hammer it, and
  // Supabase answers the third press with a rate-limit error that reads like
  // the account is broken.
  useEffect(() => {
    if (cooldown <= 0) return
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(id)
  }, [cooldown])

  const submit = async (e) => {
    e?.preventDefault()
    setError(null); setNotice(null)
    const token = code.replace(/\D/g, '')
    if (token.length !== 6) { setError('الرمز مكوّن من ٦ أرقام'); return }
    setLoading(true)

    const { error: err } = await supabase.auth.verifyOtp({ email, token, type: 'signup' })
    setLoading(false)

    if (err) {
      const m = err.message || ''
      setError(
        /expired/i.test(m) ? 'انتهت صلاحية الرمز — اطلب رمزاً جديداً'
          : /invalid|incorrect|token/i.test(m) ? 'الرمز غير صحيح — تحقّق منه وأعد المحاولة'
            : 'تعذّر التحقق. حاول مجدداً.'
      )
      return
    }
    router.push('/')
    router.refresh()
  }

  const resend = async () => {
    if (cooldown > 0) return
    setError(null); setNotice(null)
    const { error: err } = await supabase.auth.resend({ type: 'signup', email })
    if (err) {
      setError(/rate|seconds|too many/i.test(err.message || '')
        ? 'انتظر قليلاً قبل طلب رمز جديد'
        : 'تعذّر إرسال رمز جديد')
      return
    }
    setCooldown(RESEND_SECONDS)
    setNotice('أرسلنا رمزاً جديداً إلى بريدك')
  }

  if (!email) {
    return (
      <AuthShell title="رابط غير مكتمل" subtitle="لم نعرف أي بريد نتحقق منه.">
        <Link href="/signup" style={{ color: '#60a5fa', fontWeight: 700, textDecoration: 'none' }}>
          ارجع لإنشاء الحساب
        </Link>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title="تأكيد بريدك"
      subtitle={`أرسلنا رمزاً من ٦ أرقام إلى ${email}`}
      footer={
        <>
          البريد خطأ؟{' '}
          <Link href="/signup" style={{ color: '#60a5fa', fontWeight: 700, textDecoration: 'none' }}>
            أنشئ الحساب من جديد
          </Link>
        </>
      }
    >
      <form onSubmit={submit}>
        <ErrorBox message={error} />
        {notice && (
          <div style={{ background: 'rgba(10,138,88,.12)', border: '1px solid rgba(10,138,88,.4)', borderRadius: 10, padding: '10px 12px', marginBottom: 14, fontSize: 13, color: '#4ade80' }}>
            {notice}
          </div>
        )}

        <label style={{ display: 'block', fontSize: 13, color: '#94a3b8', fontWeight: 700, marginBottom: 8 }}>
          الرمز
        </label>
        <input
          ref={inputRef}
          value={code}
          onChange={(e) => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(null) }}
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="000000"
          style={{
            width: '100%', boxSizing: 'border-box', background: '#050a16',
            border: `1.5px solid ${error ? '#dc2626' : '#1e293b'}`, borderRadius: 12,
            padding: '14px 16px', fontSize: 26, fontWeight: 800, color: '#e2e8f0',
            letterSpacing: '0.4em', textAlign: 'center', direction: 'ltr',
            outline: 'none', fontFamily: 'monospace',
          }}
          onFocus={(e) => { if (!error) e.target.style.borderColor = '#0a8a58' }}
          onBlur={(e) => { if (!error) e.target.style.borderColor = '#1e293b' }}
        />

        <SubmitBtn loading={loading} disabled={code.length !== 6} style={{ marginTop: 16 }}>
          تأكيد
        </SubmitBtn>

        <button
          type="button"
          onClick={resend}
          disabled={cooldown > 0}
          style={{
            width: '100%', background: 'none', border: 'none', marginTop: 14,
            cursor: cooldown > 0 ? 'default' : 'pointer', fontFamily: 'inherit',
            fontSize: 13, fontWeight: 700, color: cooldown > 0 ? '#475569' : '#60a5fa',
          }}
        >
          {cooldown > 0 ? `يمكنك طلب رمز جديد بعد ${cooldown} ثانية` : 'لم يصلك الرمز؟ أرسله مرة أخرى'}
        </button>

        <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.8, marginTop: 16, textAlign: 'center' }}>
          تحقّق من مجلد الرسائل غير المرغوب فيها (Spam) — تصل الرسالة أحياناً هناك.
        </div>
      </form>
    </AuthShell>
  )
}

export default function VerifyPage() {
  return (
    <Suspense>
      <VerifyForm />
    </Suspense>
  )
}
