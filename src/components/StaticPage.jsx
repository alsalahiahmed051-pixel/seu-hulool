'use client'

import Link from 'next/link'
import { ArrowRight, GraduationCap } from 'lucide-react'

export default function StaticPage({ title, updatedAt, children }) {
  return (
    <div dir="rtl" style={{
      minHeight: '100vh',
      background: '#050a16',
      fontFamily: "'Tajawal','Cairo',sans-serif",
      color: '#e4ecf8',
    }}>
      <div style={{
        maxWidth: 760,
        margin: '0 auto',
        padding: '32px 20px 80px',
      }}>
        <Link href="/" style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          color: '#7d97b8', textDecoration: 'none', fontSize: 13,
          fontWeight: 700, marginBottom: 28,
        }}>
          <ArrowRight size={16} />
          الرجوع إلى حلول
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 8 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 14,
            background: 'linear-gradient(135deg,#043d2a,#066b45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <GraduationCap size={22} color="#fff" />
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 900, margin: 0 }}>{title}</h1>
        </div>
        {updatedAt && (
          <p style={{ color: '#7d97b8', fontSize: 12, margin: '0 0 32px' }}>
            آخر تحديث: {updatedAt}
          </p>
        )}

        <div style={{
          background: '#0a1426',
          border: '1px solid #1c2e48',
          borderRadius: 20,
          padding: '28px 26px',
          lineHeight: 2,
          fontSize: 14.5,
          color: '#c7d3e8',
        }}>
          {children}
        </div>
      </div>
    </div>
  )
}

export function Section({ title, children }) {
  return (
    <section style={{ marginBottom: 26 }}>
      <h2 style={{ fontSize: 16.5, fontWeight: 800, color: '#e4ecf8', margin: '0 0 10px' }}>{title}</h2>
      <div>{children}</div>
    </section>
  )
}
