'use client'

/**
 * ═══════════════════════════════════════════════════════════════════
 *  HuloolApp — Main client component
 * ═══════════════════════════════════════════════════════════════════
 *
 * Drop the contents of your existing `seu-portal-pro-v2.jsx` here,
 * BUT replace these things:
 *
 * 1. Remove the `storage` and `useStored` helpers — they're no longer
 *    needed because everything persists in Supabase now.
 *
 * 2. Replace state hooks with the Supabase-backed hooks:
 *
 *    OLD: const [favorites, setFavorites] = useStored('favorites', [])
 *    NEW: const { favorites, toggle: toggleFav, isFavorite } = useFavorites()
 *
 *    OLD: const [notes, setNotes] = useStored('notes', {})
 *    NEW: per-course: const { text, setText, saving } = useNote(courseId)
 *
 *    OLD: sessionLog from useStored
 *    NEW: const { sessions, streak, weekCount, logSession, ... } = useSessions()
 *
 *    OLD: TREE constant
 *    NEW: const { tree, all, loading } = useCourseTree()
 *
 *    OLD: FILES constant
 *    NEW: const { files, downloadFile, rateFile } = useCourseFiles(courseId)
 *
 *    OLD: NOTIFS_SEED + useStored('notifs', ...)
 *    NEW: const { notifications, unreadCount, markRead, markAllRead } = useNotifications()
 *
 *    OLD: direct fetch('https://api.anthropic.com/v1/messages', ...)
 *    NEW: import { streamChat } from '@/lib/chat-client'
 *         streamChat({ subject, messages, courseId, onChunk, onDone, onError })
 *
 *    OLD: dark, setDark, weeklyGoal etc. from useStored
 *    NEW: const { profile, updateProfile, signOut } = useProfile()
 *         then: updateProfile({ dark_mode: true, weekly_goal: 20 })
 *
 * 3. File downloads: use the returned signed URL from downloadFile():
 *      const { url } = await downloadFile(fileId)
 *      window.open(url, '_blank')
 *
 * 4. Add a sign-out button somewhere using `signOut()` from useProfile.
 * ═══════════════════════════════════════════════════════════════════
 */

import { useState } from 'react'
import { useFavorites } from '@/lib/hooks/useFavorites'
import { useNote } from '@/lib/hooks/useNote'
import { useSessions } from '@/lib/hooks/useSessions'
import { useCourseTree, useCourseFiles, useViewCourse } from '@/lib/hooks/useCourses'
import { useNotifications } from '@/lib/hooks/useNotifications'
import { useProfile } from '@/lib/hooks/useProfile'
import { streamChat } from '@/lib/chat-client'
import { LogOut } from 'lucide-react'

// TEMPORARY PLACEHOLDER — replace with your full refactored app
export default function HuloolApp() {
  const { profile, signOut, loading: profileLoading } = useProfile()
  const { favorites, toggle: toggleFav } = useFavorites()
  const { sessions, streak, weekCount, logSession } = useSessions()
  const { tree, loading: treeLoading } = useCourseTree()
  const { notifications, unreadCount } = useNotifications()

  if (profileLoading || treeLoading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#050a16',
        color: '#e4ecf8',
      }}>
        جارٍ التحميل...
      </div>
    )
  }

  return (
    <div dir="rtl" style={{
      minHeight: '100vh',
      background: '#050a16',
      color: '#e4ecf8',
      fontFamily: "'Tajawal',sans-serif",
      padding: 20,
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 24,
      }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 900 }}>مرحباً، {profile?.full_name || 'طالب'}</div>
          <div style={{ fontSize: 12, color: '#7d97b8', marginTop: 4 }}>
            {profile?.role === 'admin' && '🛡️ مسؤول • '}
            {favorites.length} مادة مفضلة • {streak} يوم متواصل • {weekCount} جلسة هذا الأسبوع
            {unreadCount > 0 && ` • ${unreadCount} إشعار جديد`}
          </div>
        </div>
        <button onClick={signOut} style={{
          background: '#1c2e48', color: '#e4ecf8', border: 'none',
          borderRadius: 12, padding: '8px 14px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'inherit',
        }}>
          <LogOut size={14} /> خروج
        </button>
      </div>

      <div style={{
        background: '#0a1426',
        borderRadius: 16,
        padding: 20,
        border: '1px solid #1c2e48',
        lineHeight: 1.8,
      }}>
        <h2 style={{ fontSize: 16, fontWeight: 800, marginBottom: 12 }}>🎉 الباك-إند يعمل!</h2>
        <p style={{ fontSize: 13, color: '#7d97b8' }}>
          تم تسجيل دخولك بنجاح وكل البيانات تأتي من قاعدة بيانات Supabase حقيقية.
        </p>
        <p style={{ fontSize: 13, color: '#7d97b8', marginTop: 8 }}>
          الخطوة التالية: ادمج كود الواجهة الكامل من <code style={{ background: '#15243f', padding: '2px 6px', borderRadius: 4 }}>seu-portal-pro-v2.jsx</code> هنا،
          واستبدل استخدامات <code style={{ background: '#15243f', padding: '2px 6px', borderRadius: 4 }}>useStored</code> بالخطافات من <code style={{ background: '#15243f', padding: '2px 6px', borderRadius: 4 }}>@/lib/hooks/*</code> (راجع التعليقات في أعلى هذا الملف).
        </p>
      </div>
    </div>
  )
}
