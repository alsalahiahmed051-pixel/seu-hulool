'use client'

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
  const clearAndReload = () => {
    try {
      localStorage.removeItem('seu_hulool_v2')
      localStorage.removeItem('seu_favorites')
      localStorage.removeItem('seu_notes')
    } catch { /* ignore */ }
    window.location.href = '/'
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
        {error?.message && (
          <div style={{
            marginTop: 18, fontSize: 11, color: 'rgba(255,255,255,.45)', direction: 'ltr',
            textAlign: 'left', wordBreak: 'break-word', lineHeight: 1.6,
          }}>{String(error.message).slice(0, 300)}</div>
        )}
      </div>
    </div>
  )
}
