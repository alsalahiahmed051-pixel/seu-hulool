'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Lock } from 'lucide-react'

const P = { navy: '#043d2a', blue: '#066b45', blue2: '#0a8a58', red: '#dc2626' }

export default function AdminPinGate({ adminName }) {
  const router = useRouter()
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const res = await fetch('/api/admin/verify-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin }),
    })
    setLoading(false)
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError(d.error || 'الرمز غير صحيح')
      setPin('')
      return
    }
    router.refresh()
  }

  return (
    <div dir="rtl" style={{
      minHeight: '100vh', background: '#050a16', color: '#e4ecf8',
      fontFamily: "'Tajawal','Cairo',sans-serif",
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div style={{ width: '100%', maxWidth: 380, textAlign: 'center' }}>
        <div style={{
          width: 64, height: 64, borderRadius: 18,
          background: `linear-gradient(135deg,${P.navy},${P.blue})`,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16,
        }}>
          <Lock size={28} color="#fff" />
        </div>
        <h1 style={{ fontSize: 20, fontWeight: 900, marginBottom: 6 }}>رمز لوحة التحكم</h1>
        <p style={{ fontSize: 13, color: '#7d97b8', marginBottom: 24 }}>
          مرحباً {adminName || 'مسؤول'} — أدخل رمز الأدمن الخاص للمتابعة
        </p>

        <form onSubmit={submit}>
          <input
            type="password"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="••••••"
            autoFocus
            style={{
              width: '100%', border: `1.5px solid ${error ? P.red : '#1c2e48'}`,
              borderRadius: 12, padding: '12px 14px', fontSize: 22, fontWeight: 800,
              background: '#0f1c33', color: '#e4ecf8', textAlign: 'center',
              letterSpacing: 8, outline: 'none', boxSizing: 'border-box', marginBottom: 12,
            }}
          />
          {error && <div style={{ color: P.red, fontSize: 13, marginBottom: 12 }}>{error}</div>}
          <button type="submit" disabled={loading || !pin} style={{
            width: '100%', padding: '12px', borderRadius: 12, border: 'none',
            background: loading ? '#1c2e48' : `linear-gradient(135deg,${P.blue},${P.blue2})`,
            color: '#fff', fontSize: 14, fontWeight: 800, fontFamily: 'inherit',
            cursor: loading || !pin ? 'not-allowed' : 'pointer', opacity: !pin ? 0.6 : 1,
          }}>
            {loading ? 'جارٍ التحقق...' : 'دخول'}
          </button>
        </form>
      </div>
    </div>
  )
}
