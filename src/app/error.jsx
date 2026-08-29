'use client'

import { useState, useEffect } from 'react'

/**
 * App-level error boundary.
 *
 * Without this, any thrown render error shows Next's bare "Application error:
 * a client-side exception has occurred" on a blank page — the visitor is stuck
 * and we learn nothing. This keeps the visitor in the product: a readable
 * Arabic message, a retry, and a "clear saved data" escape hatch for the case
 * where a corrupt local record is what breaks rendering.
 */
export default function GlobalError({ error, reset }) {
  const [copied, setCopied] = useState(false)

  // Everything needed to identify the fault in one paste.
  const details = [
    error?.message || 'unknown error',
    error?.digest ? `digest: ${error.digest}` : '',
    error?.stack || '',
    `ua: ${typeof navigator !== 'undefined' ? navigator.userAgent : ''}`,
  ].filter(Boolean).join('\n')

  useEffect(() => {
    // Surface it in the console too, for anyone who opens devtools.
    console.error('[hulool] render error:', error)
  }, [error])

  const copyDetails = async () => {
    try { await navigator.clipboard.writeText(details); setCopied(true); setTimeout(() => setCopied(false), 2000) }
    catch { /* clipboard blocked — the text is visible below anyway */ }
  }

  const clearAndReload = async () => {
    // Wipe everything that can make one device behave differently from a
    // fresh one: saved app state, and any service worker / cache left behind
    // by an earlier deploy.
    try {
      localStorage.clear()
      sessionStorage.clear()
    } catch { /* ignore */ }
    try {
      const regs = await navigator.serviceWorker?.getRegistrations?.()
      if (regs) await Promise.all(regs.map(r => r.unregister()))
    } catch { /* ignore */ }
    try {
      if (typeof caches !== 'undefined') {
        const keys = await caches.keys()
        await Promise.all(keys.map(k => caches.delete(k)))
      }
    } catch { /* ignore */ }
    window.location.replace('/')
  }

  return (
    <div dir="rtl" style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24, background: 'linear-gradient(160deg,#04120c,#063a27 60%,#05130d)',
      fontFamily: "'Tajawal','Cairo',sans-serif",
    }}>
      <div style={{
        maxWidth: 430, width: '100%', background: 'rgba(255,255,255,.06)', borderRadius: 22,
        border: '1px solid rgba(255,255,255,.12)', padding: 26, textAlign: 'center', color: '#fff',
      }}>
        <div style={{ fontSize: 40, marginBottom: 10 }}>⚠️</div>
        <h1 style={{ fontSize: 20, fontWeight: 900, margin: '0 0 8px' }}>حدث خطأ غير متوقع</h1>
        <p style={{ fontSize: 13.5, lineHeight: 1.8, color: 'rgba(255,255,255,.72)', margin: '0 0 20px' }}>
          واجه التطبيق مشكلة أثناء العرض. جرّب إعادة المحاولة — وإن تكرّرت المشكلة فامسح البيانات
          المحفوظة على هذا الجهاز وأعد الفتح.
        </p>
        <div style={{ display: 'flex', gap: 10, flexDirection: 'column' }}>
          <button onClick={() => reset()} style={{
            padding: '13px', borderRadius: 14, border: 'none', cursor: 'pointer',
            background: 'linear-gradient(135deg,#c8a84b,#d4af37)', color: '#3a2e05',
            fontSize: 15, fontWeight: 900, fontFamily: 'inherit',
          }}>إعادة المحاولة</button>
          <button onClick={clearAndReload} style={{
            padding: '11px', borderRadius: 14, cursor: 'pointer',
            background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.16)',
            color: 'rgba(255,255,255,.85)', fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
          }}>مسح البيانات المحفوظة وإعادة الفتح</button>
        </div>
        {error && (
          <>
            <button onClick={copyDetails} style={{
              marginTop: 16, padding: '9px 14px', borderRadius: 12, cursor: 'pointer',
              background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.14)',
              color: 'rgba(255,255,255,.75)', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', width: '100%',
            }}>{copied ? 'تم النسخ ✓' : '📋 نسخ تفاصيل الخطأ (لإرسالها للمطوّر)'}</button>
            <pre style={{
              marginTop: 12, fontSize: 10.5, color: 'rgba(255,255,255,.45)', direction: 'ltr',
              textAlign: 'left', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.55,
              maxHeight: 150, overflowY: 'auto', margin: '12px 0 0',
            }}>{details.slice(0, 900)}</pre>
          </>
        )}
      </div>
    </div>
  )
}
