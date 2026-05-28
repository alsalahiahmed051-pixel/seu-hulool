'use client'

import { GraduationCap } from 'lucide-react'

export default function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div dir="rtl" style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
      background: 'radial-gradient(ellipse 70% 50% at 50% -10%, rgba(26,86,219,0.20) 0%, transparent 60%), radial-gradient(ellipse 50% 40% at 0% 100%, rgba(200,168,75,0.08) 0%, transparent 50%), #050a16',
      fontFamily: "'Tajawal',sans-serif",
    }}>
      <div style={{
        width: '100%',
        maxWidth: 420,
        background: '#0a1426',
        borderRadius: 24,
        padding: 32,
        border: '1px solid #1c2e48',
        boxShadow: '0 20px 80px rgba(0,0,0,.5)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            display: 'inline-flex',
            width: 56,
            height: 56,
            borderRadius: 18,
            background: 'linear-gradient(135deg,#001f5a,#0038b8)',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16,
            boxShadow: '0 8px 24px rgba(0,56,184,.4)',
          }}>
            <GraduationCap size={28} color="#fff" strokeWidth={2} />
          </div>
          <h1 style={{ color: '#e4ecf8', fontSize: 24, fontWeight: 900, margin: '0 0 6px' }}>{title}</h1>
          {subtitle && <p style={{ color: '#7d97b8', fontSize: 13, margin: 0, lineHeight: 1.6 }}>{subtitle}</p>}
        </div>

        {children}

        {footer && (
          <div style={{
            marginTop: 24,
            paddingTop: 20,
            borderTop: '1px solid #1c2e48',
            textAlign: 'center',
            fontSize: 13,
            color: '#7d97b8',
          }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

export function Input({ label, error, ...rest }) {
  return (
    <div style={{ marginBottom: 16 }}>
      {label && (
        <label style={{
          display: 'block',
          fontSize: 12,
          color: '#7d97b8',
          marginBottom: 6,
          fontWeight: 600,
        }}>{label}</label>
      )}
      <input
        {...rest}
        style={{
          width: '100%',
          border: `1.5px solid ${error ? '#dc2626' : '#1c2e48'}`,
          borderRadius: 12,
          padding: '11px 14px',
          fontSize: 14,
          background: '#0f1c33',
          color: '#e4ecf8',
          fontFamily: 'inherit',
          direction: 'rtl',
          outline: 'none',
          boxSizing: 'border-box',
          transition: 'border-color .2s',
        }}
        onFocus={(e) => (e.target.style.borderColor = '#1a56db')}
        onBlur={(e) => (e.target.style.borderColor = error ? '#dc2626' : '#1c2e48')}
      />
      {error && (
        <div style={{ fontSize: 11, color: '#dc2626', marginTop: 4 }}>{error}</div>
      )}
    </div>
  )
}

export function SubmitBtn({ loading, children, ...rest }) {
  return (
    <button
      {...rest}
      disabled={loading || rest.disabled}
      style={{
        width: '100%',
        padding: '12px 20px',
        borderRadius: 12,
        border: 'none',
        background: loading
          ? '#1c2e48'
          : 'linear-gradient(135deg,#0038b8,#1a56db)',
        color: '#fff',
        fontSize: 14,
        fontWeight: 800,
        fontFamily: 'inherit',
        cursor: loading ? 'wait' : 'pointer',
        boxShadow: loading ? 'none' : '0 6px 20px rgba(0,56,184,.4)',
        transition: 'all .2s',
        ...(rest.style || {}),
      }}>
      {loading ? 'جارٍ المعالجة...' : children}
    </button>
  )
}

export function ErrorBox({ message }) {
  if (!message) return null
  return (
    <div style={{
      background: 'rgba(220,38,38,.1)',
      border: '1px solid rgba(220,38,38,.3)',
      borderRadius: 10,
      padding: '10px 14px',
      fontSize: 13,
      color: '#fca5a5',
      marginBottom: 16,
    }}>
      {message}
    </div>
  )
}
