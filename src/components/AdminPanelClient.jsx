'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { COURSE_GROUPS, CATALOGUE, levelsOf, isCourseCode, titleOf, COURSE_CATEGORIES, PROGRAM_CATEGORIES } from '@/lib/courses'
import {
  Upload, Trash2, FileText, CheckCircle, Eye, GraduationCap, AlertCircle,
  RefreshCw, LogOut, Lock, Database, HardDrive, Users, Bell, BookOpen,
  Building2, LayoutGrid, Plus, X, Edit3, Send, Shield, Activity, TrendingUp,
  Link2, Save, Moon, Sun, Palette, Check, CalendarDays, CreditCard, MessageCircle,
  Sparkles,
  Layers,
} from 'lucide-react'

// Colour themes the admin can apply site-wide (must mirror THEME_PRESETS in
// seu-portal-pro-v2.jsx). Only the id is stored in site_content['theme'].
const THEME_PRESETS = [
  { id: 'green', name: 'أخضر', sw: '#0a8a58' },
  { id: 'blue', name: 'أزرق', sw: '#2563eb' },
  { id: 'purple', name: 'بنفسجي', sw: '#7c3aed' },
  { id: 'gold', name: 'ذهبي', sw: '#c8a84b' },
  { id: 'rose', name: 'وردي', sw: '#e11d48' },
  { id: 'teal', name: 'فيروزي', sw: '#0891b2' },
]

// Admin theme tokens — mapped onto CSS variables so a single toggle swaps
// the whole panel between white and deep-green night mode.
const THEME = {
  light: {
    '--bg': '#eef5f0', '--card': '#ffffff', '--soft': '#f3f9f5',
    '--bd': '#d3e6da', '--bd2': '#c3ddce', '--tx': '#082016',
    '--mu': '#425f52', '--mu2': '#5a7a6a', '--dim': '#93b0a1',
    '--warnBg': '#fbf6e7', '--warnTx': '#7a6320',
    '--errBg': '#fdecec', '--errTx': '#b91c1c',
  },
  dark: {
    '--bg': '#08130d', '--card': '#0f1d16', '--soft': '#16281e',
    '--bd': 'rgba(90,175,130,0.20)', '--bd2': '#274a38', '--tx': '#eefaf3',
    '--mu': '#9ccbb2', '--mu2': '#85bfa0', '--dim': '#5a8571',
    '--warnBg': '#1c1608', '--warnTx': '#e8d9a8',
    '--errBg': '#1c0a0a', '--errTx': '#f0a8a8',
  },
}

const P = {
  navy: '#043d2a', blue: '#066b45', blue2: '#0a8a58',
  gold: '#c8a84b', green: '#059669', red: '#dc2626', purple: '#0f766e', orange: '#ea580c',
}

const TRACKS = [
  { id: 'preparatory', label: 'السنة التحضيرية' },
  { id: 'bachelor', label: 'بكالوريوس' },
  { id: 'diploma', label: 'دبلوم' },
  { id: 'graduate', label: 'دراسات عليا' },
]

// The upload dropdown reads the shared catalogue, so its names are exactly
// the ones the site looks for. They used to be a separate hand-written list
// and had drifted apart, which is why uploads never appeared.
const FILE_COURSES = COURSE_GROUPS

/**
 * What a file can be filed as, decided by what was picked.
 *
 * A course has slides, summaries and past papers; a programme has a study plan
 * and admission terms. Offering all of both put «تجميعات الفاينل» on a
 * programme and «شروط القبول» on STAT101, and the owner had to know which of
 * the ten was meaningful. The legacy bucket is filtered out for new uploads —
 * it exists to keep old files visible, not to file new ones into.
 */
// Mirrors the server's cap and its accepted types, so the picker offers
// exactly what /api/upload will issue a token for.
const MAX_UPLOAD = 200 * 1024 * 1024
const ACCEPT_EXT = '.pdf,.pptx,.ppt,.docx,.doc,.xlsx,.xls,.png,.jpg,.jpeg,.webp,.zip'

const CATEGORY_LABEL = Object.fromEntries(
  [...COURSE_CATEGORIES, ...PROGRAM_CATEGORIES].map(c => [c.id, c.label])
)

const categoriesFor = (course) => {
  const list = !course || isCourseCode(course) ? COURSE_CATEGORIES : PROGRAM_CATEGORIES
  return list.filter(c => !c.legacy)
}

function fmtSize(b) {
  if (!b) return '—'
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB'
  return (b / (1024 * 1024)).toFixed(1) + ' MB'
}
function fmtDate(iso) {
  try { return new Date(iso).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' }) }
  catch { return iso }
}

const S = {
  input: { width: '100%', border: '1.5px solid var(--bd)', borderRadius: 10, padding: '9px 12px', fontSize: 13, background: 'var(--soft)', color: 'var(--tx)', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', direction: 'rtl' },
  card: { background: 'var(--card)', borderRadius: 18, padding: 20, border: '1px solid var(--bd)', marginBottom: 16 },
  label: { fontSize: 13, color: 'var(--mu)', marginBottom: 5, display: 'block', fontWeight: 600 },
  btn: (color = P.blue2) => ({ padding: '9px 18px', borderRadius: 10, border: 'none', background: `linear-gradient(135deg,${color},${color}cc)`, color: '#fff', fontSize: 13, fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, justifyContent: 'center' }),
  iconBtn: (color) => ({ background: `${color}18`, border: 'none', borderRadius: 8, padding: 7, cursor: 'pointer', color, display: 'flex' }),
}

async function apiJSON(url, opts) {
  const res = await fetch(url, opts)
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, data }
}

const TABS = [
  { id: 'overview', label: 'نظرة عامة', Icon: LayoutGrid },
  { id: 'files', label: 'الملفات', Icon: FileText },
  { id: 'courses', label: 'المواد', Icon: BookOpen },
  { id: 'colleges', label: 'الكليات', Icon: Building2 },
  { id: 'plans', label: 'الخطط الدراسية', Icon: Layers },
  { id: 'notifications', label: 'الإشعارات', Icon: Bell },
  { id: 'links', label: 'الروابط', Icon: Link2 },
  { id: 'calendar', label: 'التقويم', Icon: CalendarDays },
  { id: 'theme', label: 'الثيم', Icon: Palette },
  { id: 'students', label: 'الطلاب', Icon: GraduationCap },
  { id: 'requests', label: 'طلبات المسار', Icon: Send },
  { id: 'subs', label: 'الاشتراكات', Icon: CreditCard },
  { id: 'messages', label: 'الرسائل', Icon: MessageCircle },
  { id: 'bot', label: 'البوت', Icon: Sparkles },
  { id: 'users', label: 'المستخدمون', Icon: Users },
]

// Audience targeting options shared by notifications and calendar events.
// Values mirror audienceMatches() in seu-portal-pro-v2.jsx.
const AUDIENCE_OPTIONS = [
  { v: 'all', l: 'كل الطلاب' },
  { v: 'track:تحضيري', l: 'مسار: التحضيري' },
  { v: 'track:تخصص', l: 'مسار: التخصص' },
  { v: 'track:دبلوم', l: 'مسار: الدبلوم' },
  { v: 'track:دراسات عليا', l: 'مسار: الدراسات العليا' },
  { v: 'plan:تحضيري|خطة أ', l: 'التحضيري — خطة أ' },
  { v: 'plan:تحضيري|خطة ب', l: 'التحضيري — خطة ب' },
]

// Short label shown on a sent announcement so the admin sees who it targets.
// Matches the wording students see in the app.
function audienceBadge(aud) {
  if (!aud || aud === 'all') return ''
  if (aud.startsWith('track:')) return `لطلاب ${aud.slice(6)}`
  if (aud.startsWith('plan:')) { const [tr, pl] = aud.slice(5).split('|'); return `لطلاب ${tr} — ${pl}` }
  return ''
}

// Icons an admin can assign to a calendar event (mirror CAL_ICONS in the app).
const CAL_ICON_NAMES = ['Flame', 'Trophy', 'FileText', 'GraduationCap', 'PenLine', 'Calendar', 'Award', 'Bell', 'Star', 'BookOpen', 'CheckCircle', 'CreditCard']
const CAL_SEED = {
  events: [
    { label: 'الاختبارات النهائية — الفصل الثاني 1447', date: '2026-06-07', color: '#dc2626', icon: 'Flame' },
    { label: 'نتائج الفصل الثاني 1447', date: '2026-06-28', color: '#059669', icon: 'Trophy' },
    { label: 'التسجيل للفصل الأول 1448', date: '2026-07-20', color: '#7c3aed', icon: 'FileText' },
    { label: 'بداية الفصل الأول 1448', date: '2026-09-06', color: '#2563eb', icon: 'GraduationCap' },
    { label: 'اختبارات الميدترم — الفصل الأول 1448', date: '2026-10-25', color: '#c8a84b', icon: 'PenLine' },
    { label: 'الاختبارات النهائية — الفصل الأول 1448', date: '2026-12-13', color: '#dc2626', icon: 'Flame' },
  ],
}

// Icon names the admin can assign to a link (must match LINK_ICONS in
// seu-portal-pro-v2.jsx). Stored as a name string in site_content.
const LINK_ICON_NAMES = [
  'WhatsApp', 'Telegram', 'Twitter', 'Instagram', 'Youtube', 'Snapchat', 'Group',
  'Monitor', 'GraduationCap', 'Building2', 'Globe', 'BookOpen', 'Mail',
  'CheckCircle', 'Calendar', 'CreditCard', 'FileText', 'Award', 'Phone',
  'HelpCircle', 'Radio', 'Newspaper', 'Link2', 'Shield', 'Star', 'Bell',
]

// Seed shown in the editor before the admin has saved anything — mirrors
// DEFAULT_LINKS on the public page so editing starts from the live content.
const LINKS_SEED = {
  header: {
    title: 'روابط الجامعة السعودية الإلكترونية',
    subtitle: 'Saudi Electronic University — SEU',
    note: 'جميع الروابط تفتح الموقع الرسمي — تأكد من تسجيل دخولك بالحساب الجامعي',
  },
  quick: { phone: '011-2613500', hours: '8 ص – 8 م', days: 'الأحد – الخميس' },
  groups: [
    { group: 'البوابات الأساسية', color: '#1a56db', items: [
      { label: 'نظام التعلم الإلكتروني (Blackboard)', desc: 'المقررات والواجبات والدرجات', url: 'https://lms.seu.edu.sa', icon: 'Monitor', color: '#1d4ed8' },
      { label: 'بوابة الطالب (ERP Gate)', desc: 'الجداول والسجلات والخدمات الأكاديمية', url: 'https://erpgate.seu.edu.sa', icon: 'GraduationCap', color: '#6d28d9' },
      { label: 'تسجيل الدخول الموحد (SSO)', desc: 'الدخول لجميع أنظمة الجامعة', url: 'https://sso.seu.edu.sa/SEUSSO/pages/login.jsp', icon: 'Building2', color: '#065f46' },
      { label: 'الموقع الرسمي للجامعة', desc: 'الأخبار والإعلانات الرسمية', url: 'https://www.seu.edu.sa', icon: 'Globe', color: '#0369a1' },
    ]},
    { group: 'الخدمات الأكاديمية', color: '#7c3aed', items: [
      { label: 'المكتبة الرقمية السعودية (SDL)', desc: 'الكتب والمراجع والأبحاث الأكاديمية', url: 'https://sdl.edu.sa/SDLPortal/ar/login.aspx', icon: 'BookOpen', color: '#be123c' },
      { label: 'البريد الإلكتروني الجامعي', desc: 'بريد @seu.edu.sa عبر Office 365', url: 'https://sso.seu.edu.sa/SEUOffice365SSO/pages/login.jsp', icon: 'Mail', color: '#0369a1' },
      { label: 'بوابة القبول والتسجيل', desc: 'التسجيل وقبول الطلاب الجدد', url: 'https://admission.seu.edu.sa', icon: 'CheckCircle', color: '#0891b2' },
      { label: 'التقويم الأكاديمي', desc: 'مواعيد الفصول والاختبارات والتسجيل', url: 'https://www.seu.edu.sa/en/academic-calendar/1448/', icon: 'Calendar', color: '#d97706' },
    ]},
    { group: 'الخدمات المالية والإدارية', color: '#059669', items: [
      { label: 'الرسوم الدراسية والدفع', desc: 'سداد الرسوم وعرض الكشوف', url: 'https://erpgate.seu.edu.sa', icon: 'CreditCard', color: '#059669' },
      { label: 'خدمات وحدة التسجيل', desc: 'إضافة/حذف/اعتراض على المقررات', url: 'https://www.seu.edu.sa/aasa/ar/registeration/', icon: 'FileText', color: '#c8a84b' },
      { label: 'الكلية التطبيقية', desc: 'بوابة طلاب الكلية التطبيقية', url: 'https://ac.seu.edu.sa/ar/login', icon: 'Award', color: '#92400e' },
    ]},
    { group: 'الدعم والتواصل', color: '#be123c', items: [
      { label: 'مركز الدعم الفني', desc: 'هاتف: 011-2613500', url: 'tel:0112613500', icon: 'Phone', color: '#be123c' },
      { label: 'الأسئلة الشائعة (FAQ)', desc: 'إجابات على أبرز الاستفسارات', url: 'https://www.seu.edu.sa/ar/faqs/', icon: 'HelpCircle', color: '#ea580c' },
      { label: 'حساب الجامعة في X', desc: '@Saudi_EUni', url: 'https://x.com/Saudi_EUni', icon: 'Radio', color: '#1d4ed8' },
      { label: 'تطبيق SEU على المتجر', desc: 'تحميل تطبيق الجوال الرسمي', url: 'https://play.google.com/store/apps/details?id=com.seu.services', icon: 'Newspaper', color: '#065f46' },
    ]},
  ],
  footer: 'هذه الروابط تأخذك للمواقع الرسمية للجامعة السعودية الإلكترونية. لا تشارك كلمة مرورك مع أي طرف آخر.',
}

export default function AdminPanelClient({ adminName, adminEmail, pinConfigured }) {
  const router = useRouter()
  const [tab, setTab] = useState('overview')
  const [toast, setToast] = useState(null)
  const [dark, setDark] = useState(false)

  // Restore the admin's saved theme choice (default: light/white).
  useEffect(() => {
    try { setDark(localStorage.getItem('admin_dark') === '1') } catch {}
  }, [])
  const toggleTheme = useCallback(() => {
    setDark(d => {
      const next = !d
      try { localStorage.setItem('admin_dark', next ? '1' : '0') } catch {}
      return next
    })
  }, [])

  const flash = useCallback((text, type = 'success') => {
    setToast({ text, type })
    setTimeout(() => setToast(null), 3000)
  }, [])

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  async function handleLock() {
    await fetch('/api/admin/verify-pin', { method: 'DELETE' })
    router.refresh()
  }

  const page = { minHeight: '100vh', background: 'var(--bg)', color: 'var(--tx)', fontFamily: "'Tajawal','Cairo',sans-serif", direction: 'rtl', padding: '16px 14px 40px', transition: 'background .25s ease, color .25s ease' }

  return (
    <div style={{ ...THEME[dark ? 'dark' : 'light'], ...page }}>
      <div style={{ maxWidth: 860, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          <div style={{ width: 44, height: 44, borderRadius: 13, background: `linear-gradient(135deg,${P.navy},${P.blue})`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <GraduationCap size={22} color="#fff" />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h1 style={{ fontSize: 19, fontWeight: 900, margin: 0 }}>لوحة تحكم حلول</h1>
            <p style={{ fontSize: 11.5, color: 'var(--mu)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{adminName || adminEmail}</p>
          </div>
          <button onClick={toggleTheme} title={dark ? 'الوضع النهاري' : 'الوضع الليلي'} style={S.iconBtn(dark ? P.gold : '#6b8c7d')}>{dark ? <Sun size={16} /> : <Moon size={16} />}</button>
          {pinConfigured && (
            <button onClick={handleLock} title="قفل اللوحة" style={S.iconBtn('#6b8c7d')}><Lock size={16} /></button>
          )}
          <button onClick={handleSignOut} title="تسجيل الخروج" style={S.iconBtn(P.red)}><LogOut size={16} /></button>
        </div>

        {!pinConfigured && (
          <div style={{ background: 'var(--warnBg)', border: '1px solid #c8a84b55', borderRadius: 12, padding: '12px 14px', marginBottom: 16, display: 'flex', gap: 10, fontSize: 13, color: 'var(--warnTx)', lineHeight: 1.7 }}>
            <Shield size={16} color={P.gold} style={{ flexShrink: 0, marginTop: 2 }} />
            <div>لتفعيل طبقة الحماية الإضافية (رمز PIN)، أضف متغيّر <strong style={{ color: P.gold }}>ADMIN_PIN</strong> في Vercel → Settings → Environment Variables (اختر رقماً سرياً)، ثم أعد النشر.</div>
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 18, overflowX: 'auto', paddingBottom: 4 }}>
          {TABS.map(({ id, label, Icon }) => (
            <button key={id} onClick={() => setTab(id)} style={{
              flexShrink: 0, padding: '8px 14px', borderRadius: 11,
              background: tab === id ? `linear-gradient(135deg,${P.blue},${P.blue2})` : 'var(--soft)',
              border: `1px solid ${tab === id ? P.blue2 : 'var(--bd)'}`,
              color: tab === id ? '#fff' : 'var(--mu)', cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 12.5, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>

        {tab === 'overview' && <OverviewTab flash={flash} />}
        {tab === 'files' && <FilesTab flash={flash} />}
        {tab === 'courses' && <CoursesTab flash={flash} />}
        {tab === 'colleges' && <CollegesTab flash={flash} />}
        {tab === 'plans' && <PlansTab flash={flash} />}
        {tab === 'notifications' && <NotificationsTab flash={flash} />}
        {tab === 'links' && <LinksTab flash={flash} />}
        {tab === 'calendar' && <CalendarTab flash={flash} />}
        {tab === 'theme' && <ThemeTab flash={flash} />}
        {tab === 'students' && <StudentsTab flash={flash} />}
        {tab === 'requests' && <TrackRequestsTab flash={flash} />}
        {tab === 'subs' && <SubscriptionsTab flash={flash} />}
        {tab === 'messages' && <MessagesTab flash={flash} />}
        {tab === 'bot' && <BotTab flash={flash} />}
        {tab === 'users' && <UsersTab flash={flash} adminEmail={adminEmail} />}
      </div>

      {toast && (
        <div style={{
          position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)',
          background: toast.type === 'error' ? P.red : P.green, color: '#fff',
          padding: '10px 20px', borderRadius: 12, fontSize: 13, fontWeight: 700,
          boxShadow: '0 8px 24px rgba(0,0,0,.4)', zIndex: 100, maxWidth: '90%',
        }}>{toast.text}</div>
      )}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

/* ══════════════ OVERVIEW ══════════════ */
function OverviewTab({ flash }) {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { ok, data } = await apiJSON('/api/admin/stats')
    if (ok) setStats(data.counts)
    else flash(data.error || 'تعذّر تحميل الإحصائيات', 'error')
    setLoading(false)
  }, [flash])
  useEffect(() => { load() }, [load])

  if (loading) return <Loader />

  const cards = [
    { label: 'المستخدمون', value: stats?.users, Icon: Users, color: P.blue2 },
    { label: 'مسجّلون هذا الأسبوع', value: stats?.newUsers, Icon: TrendingUp, color: P.green },
    { label: 'المسؤولون', value: stats?.admins, Icon: Shield, color: P.gold },
    { label: 'المواد', value: stats?.courses, Icon: BookOpen, color: P.purple },
    { label: 'المواد الفعّالة', value: stats?.activeCourses, Icon: CheckCircle, color: P.green },
    { label: 'الكليات', value: stats?.colleges, Icon: Building2, color: P.blue2 },
    { label: 'جلسات المذاكرة', value: stats?.sessions, Icon: Activity, color: P.orange },
    { label: 'رسائل المساعد', value: stats?.chatMessages, Icon: Bell, color: P.blue },
    { label: 'المفضلات', value: stats?.favorites, Icon: TrendingUp, color: P.red },
  ]

  return (
    <div>
      <SectionHeader title="نظرة عامة على المنصة" onRefresh={load} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 12 }}>
        {cards.map(({ label, value, Icon, color }) => (
          <div key={label} style={{ background: 'var(--card)', border: '1px solid var(--bd)', borderRadius: 14, padding: '16px 14px', textAlign: 'center' }}>
            <Icon size={18} color={color} style={{ marginBottom: 8 }} />
            <div style={{ fontSize: 24, fontWeight: 900, color }}>{value ?? 0}</div>
            <div style={{ fontSize: 12, color: 'var(--mu)', marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ══════════════ FILES ══════════════ */
/**
 * Pick the course a file belongs to by walking the study plan: مسار → تخصص →
 * مستوى → مقرر.
 *
 * The flat dropdown that came before could only name a *programme* ("إدارة
 * أعمال"), so every summary for every one of that programme's twenty-eight
 * courses landed in the same bucket, and a student opening MGT101 found nothing
 * — the course pages are keyed by code. This walks the same plan the student
 * walks in «مساري ← خطتي الدراسية», so what the owner files under is exactly
 * what the student's screen asks for.
 *
 * Published plans (`plans`) win over the built-in ones, matching the site: a
 * level the owner added in «الخطط الدراسية» is pickable here the moment it is
 * saved, with no deploy.
 *
 * Declared at module scope, not inside FilesTab. A component redefined inside a
 * render gets a new identity every keystroke, and React then throws the subtree
 * away and rebuilds it — which is how the services page ended up jumping to the
 * top on every click.
 */
function CoursePicker({ value, onChange, plans }) {
  const [track, setTrack] = useState('bachelor')
  const [program, setProgram] = useState('')
  const [level, setLevel] = useState('')

  // The programmes on offer for the chosen track, flat — the college grouping
  // matters to a student choosing a future, not to an owner filing a PDF.
  const programs = track === 'bachelor'
    ? CATALOGUE.bachelor.colleges.flatMap(c => c.programs)
    : (CATALOGUE[track]?.programs || [])

  const planOf = (pr) => {
    const live = plans && plans[pr]
    if (Array.isArray(live) && live.length) return live
    const built = levelsOf(pr)
    return built ? Object.entries(built).map(([label, courses]) => ({ label, courses })) : null
  }
  const plan = program ? planOf(program) : null
  const codes = (plan || []).find(l => l.label === level)?.courses || []

  // Changing anything higher up invalidates what is below it, including the
  // course already chosen — silently keeping a code from the previous programme
  // is how a file ends up filed under a course nobody in that plan sits.
  const pickTrack = (v) => { setTrack(v); setProgram(''); setLevel(''); onChange('') }
  const pickProgram = (v) => { setProgram(v); setLevel(''); onChange('') }
  const pickLevel = (v) => { setLevel(v); onChange('') }

  const half = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }

  return (
    <div>
      <div style={half}>
        <div>
          <label style={S.label}>المسار</label>
          <select value={track} onChange={e => pickTrack(e.target.value)} style={S.input}>
            {TRACKS.filter(t => t.id !== 'preparatory').map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label style={S.label}>التخصص</label>
          <select value={program} onChange={e => pickProgram(e.target.value)} style={S.input}>
            <option value="">— اختر —</option>
            {programs.map(p => {
              const has = !!planOf(p)
              return <option key={p} value={p}>{has ? p : `${p} (بلا خطة)`}</option>
            })}
          </select>
        </div>
      </div>

      {program && !plan && (
        <div style={{ fontSize: 12.5, color: 'var(--warnTx)', background: 'var(--warnBg)', border: '1px solid var(--bd)', borderRadius: 10, padding: '9px 11px', marginBottom: 10, lineHeight: 1.7 }}>
          لا توجد خطة محفوظة لـ«{program}» بعد. أضفها من تبويب «الخطط الدراسية» لتظهر مستوياتها ومقرراتها هنا.
        </div>
      )}

      {plan && (
        <div style={half}>
          <div>
            <label style={S.label}>المستوى</label>
            <select value={level} onChange={e => pickLevel(e.target.value)} style={S.input}>
              <option value="">— اختر —</option>
              {plan.map(l => <option key={l.label} value={l.label}>{l.label}</option>)}
            </select>
          </div>
          <div>
            <label style={S.label}>المقرر</label>
            <select value={value} onChange={e => onChange(e.target.value)} disabled={!level} style={{ ...S.input, opacity: level ? 1 : 0.55 }}>
              <option value="">{level ? '— اختر —' : 'اختر المستوى أولاً'}</option>
              {codes.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
      )}
    </div>
  )
}

function FilesTab({ flash }) {
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [blobEnabled, setBlobEnabled] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [course, setCourse] = useState('')
  // 'plan' walks مسار → تخصص → مستوى → مقرر; 'catalog' is the old flat list,
  // kept for what has no course code: prep-year subjects, and the plan/programme
  // sheets that belong to a programme as a whole rather than to one of its
  // courses.
  const [pickMode, setPickMode] = useState('plan')
  const [plans, setPlans] = useState({})
  const [category, setCategory] = useState('slides')
  const [displayName, setDisplayName] = useState('')
  const [selected, setSelected] = useState([])
  // Progress across a whole batch, so «٧ من ٣٠» is visible, not just one bar.
  const [batch, setBatch] = useState(null)
  const fileRef = useRef(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await apiJSON('/api/files')
    setFiles(data.files || [])
    setBlobEnabled(!!data.blobEnabled)
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  // The owner's own published plans, so the picker offers the levels they
  // actually saved rather than only the ones compiled into the app.
  useEffect(() => {
    apiJSON('/api/admin/program-plans').then(({ data }) => {
      const map = {}
      ;(data?.plans || []).forEach(p => { map[p.program] = p.levels })
      setPlans(map)
    }).catch(() => {})
  }, [])

  // Keep the type valid for what was picked. A course's types and a
  // programme's types share no ids, so switching between them would otherwise
  // leave a type selected that the list no longer offers — the <select> shows
  // blank and the upload files under a type the owner never saw.
  useEffect(() => {
    const allowed = categoriesFor(course).map(c => c.id)
    if (!allowed.includes(category)) setCategory(allowed[0])
  }, [course, category])

  // What is already filed under the chosen course. Answers "did I upload this
  // one already?" before the upload, not after it.
  const existing = course ? files.filter(f => f.courseName === course) : []

  /**
   * Upload every chosen file, one after another, under the same course + type.
   *
   * It used to take exactly one file. The library has 292 courses and each
   * wants slides, a summary and two past papers — that is a four-step dance
   * per course, roughly a thousand times, and it is the reason the shelves are
   * empty. Now the picker takes a whole folder's worth and they go up in
   * sequence.
   *
   * Sequential rather than parallel on purpose: each upload is a signed
   * handshake plus a large transfer, and firing thirty at once on a phone's
   * connection is how they all slow down and some time out. One at a time is
   * slower on paper and finishes sooner in practice.
   *
   * One failure does not sink the batch — it is recorded and the rest continue,
   * because losing 29 good uploads to one bad file is the worst outcome here.
   */
  async function upload(e) {
    e.preventDefault()
    if (!selected.length || !course) return

    const tooBig = selected.filter(f => f.size > MAX_UPLOAD)
    if (tooBig.length) {
      flash(`${tooBig.length} ملف يتجاوز الحد (${fmtSize(MAX_UPLOAD)}): ${tooBig[0].name}`, 'error')
      return
    }

    setUploading(true)
    setProgress(0)
    setBatch({ done: 0, total: selected.length, failed: [] })
    const { upload: blobUpload } = await import('@vercel/blob/client')
    const failed = []

    for (let i = 0; i < selected.length; i++) {
      const file = selected[i]
      setBatch(b => ({ ...b, done: i, current: file.name }))
      setProgress(0)
      try {
        const blob = await blobUpload(file.name, file, {
          // Private, matching how every existing file is stored: served through
          // /api/download rather than reachable at a raw URL.
          access: 'private',
          handleUploadUrl: '/api/upload',
          // The file's own type. It was pinned to application/pdf, so a PPTX
          // uploaded as a PDF and then would not open for the student.
          contentType: file.type || 'application/octet-stream',
          onUploadProgress: ({ percentage }) => setProgress(Math.round(percentage)),
        })
        const { ok, data } = await apiJSON('/api/files', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            blobUrl: blob.url,
            courseName: course,
            category,
            // The typed name applies only when one file was chosen; naming
            // thirty files the same thing would make the shelf unreadable.
            name: (selected.length === 1 && displayName.trim())
              ? displayName.trim()
              : file.name.replace(/\.[^.]+$/, ''),
            size: file.size,
          }),
        })
        if (!ok) throw new Error(data.error || 'تعذّر حفظ بيانات الملف')
      } catch (err) {
        failed.push({ name: file.name, why: err.message || 'فشل' })
      }
    }

    setBatch({ done: selected.length, total: selected.length, failed })
    setUploading(false)
    setProgress(0)
    const okCount = selected.length - failed.length
    if (!failed.length) flash(okCount === 1 ? 'تم رفع الملف' : `تم رفع ${okCount} ملفات`)
    else flash(`رُفع ${okCount} وفشل ${failed.length} — ${failed[0].name}: ${failed[0].why}`, 'error')

    if (okCount > 0) {
      setSelected([]); setDisplayName('')
      if (fileRef.current) fileRef.current.value = ''
      load()
    }
  }

  async function remove(f) {
    if (!confirm(`حذف "${f.name}"؟`)) return
    await fetch('/api/files', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: f.id, blobUrl: f.blobUrl }) })
    flash('تم الحذف')
    load()
  }

  const totalSize = files.reduce((a, f) => a + (f.size || 0), 0)

  return (
    <div>
      <SectionHeader title="إدارة الملفات" onRefresh={load} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 16 }}>
        <MiniStat label="إجمالي الملفات" value={files.length} Icon={Database} color={P.blue2} />
        <MiniStat label="حجم التخزين" value={fmtSize(totalSize)} Icon={HardDrive} color={P.gold} />
        <MiniStat label="حالة Blob" value={blobEnabled ? 'مفعّل' : 'معطّل'} Icon={CheckCircle} color={blobEnabled ? P.green : P.red} />
      </div>

      {!blobEnabled && (
        <div style={{ ...S.card, background: 'var(--errBg)', border: '1px solid #dc262655', display: 'flex', gap: 10, fontSize: 13, color: 'var(--errTx)', lineHeight: 1.7 }}>
          <AlertCircle size={16} color={P.red} style={{ flexShrink: 0, marginTop: 2 }} />
          <div>Vercel Blob غير مضبوط — أضف <strong>BLOB_READ_WRITE_TOKEN</strong> في Vercel لتفعيل رفع الملفات.</div>
        </div>
      )}

      {blobEnabled && (
        <form onSubmit={upload} style={S.card}>
          <h3 style={{ fontSize: 14, fontWeight: 800, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}><Upload size={15} color={P.blue2} /> رفع ملف جديد</h3>

          <div style={{ display: 'flex', gap: 7, marginBottom: 12 }}>
            {[
              { id: 'plan', label: 'حسب الخطة الدراسية' },
              { id: 'catalog', label: 'حسب الكتالوج' },
            ].map(m => (
              <button key={m.id} type="button" onClick={() => { setPickMode(m.id); setCourse('') }} style={{
                padding: '7px 13px', borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit',
                fontSize: 12.5, fontWeight: 700,
                background: pickMode === m.id ? 'var(--brand)' : 'var(--soft)',
                color: pickMode === m.id ? '#fff' : 'var(--tx)',
                border: `1.5px solid ${pickMode === m.id ? 'var(--brand)' : 'var(--bd)'}`,
              }}>{m.label}</button>
            ))}
          </div>

          {pickMode === 'plan' ? (
            <CoursePicker value={course} onChange={setCourse} plans={plans} />
          ) : (
            <div style={{ marginBottom: 10 }}>
              <label style={S.label}>المادة / البرنامج</label>
              <select value={course} onChange={e => setCourse(e.target.value)} style={S.input}>
                <option value="">— اختر —</option>
                {/* Named, not bare: the prep year moved to real codes, and a
                    list reading «CS001 · CI001» tells the owner nothing about
                    which is which. The value stays the code — that is what a
                    file is filed under. */}
                {FILE_COURSES.map(g => (
                  <optgroup key={g.group} label={g.group}>
                    {g.items.map(i => {
                      const n = titleOf(i)
                      return <option key={i} value={i}>{n && n !== i ? `${i} — ${n}` : i}</option>
                    })}
                  </optgroup>
                ))}
              </select>
            </div>
          )}

          <div style={{ marginBottom: 10 }}>
            <label style={S.label}>نوع الملف</label>
            <select value={category} onChange={e => setCategory(e.target.value)} style={S.input}>
              {categoriesFor(course).map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
            <div style={{ fontSize: 11.5, color: 'var(--mu2)', marginTop: 5 }}>
              {categoriesFor(course).find(c => c.id === category)?.desc || ''}
            </div>
          </div>

          {course && (
            <div style={{ fontSize: 12.5, color: 'var(--mu)', background: 'var(--soft)', border: '1px solid var(--bd)', borderRadius: 10, padding: '9px 11px', marginBottom: 10, lineHeight: 1.7 }}>
              سيُرفع تحت <strong style={{ color: 'var(--tx)' }}>{course}</strong> — وهذا ما تفتحه صفحة المقرر عند الطالب.
              {' '}{existing.length ? `يوجد ${existing.length} ملف مرفوع له.` : 'لا توجد ملفات له بعد.'}
            </div>
          )}

          {selected.length > 1 ? (
            <div style={{ fontSize: 12, color: 'var(--mu2)', marginBottom: 10, lineHeight: 1.7 }}>
              كل ملف يحتفظ باسمه — الاسم اليدوي متاح عند اختيار ملف واحد فقط.
            </div>
          ) : (
            <>
              <label style={S.label}>اسم الملف (اختياري)</label>
              <input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="مثال: تجميع نهائي 1446" style={{ ...S.input, marginBottom: 10 }} />
            </>
          )}
          <div onClick={() => fileRef.current?.click()} style={{ border: '2px dashed var(--bd)', borderRadius: 10, padding: 16, textAlign: 'center', cursor: 'pointer', marginBottom: 12 }}>
            <input ref={fileRef} type="file" accept={ACCEPT_EXT} multiple style={{ display: 'none' }} onChange={e => {
              const list = Array.from(e.target.files || [])
              setSelected(list)
              setBatch(null)
              // The name field is only meaningful for a single file; with many,
              // each keeps its own, so offering one name to type would be a lie.
              setDisplayName(list.length === 1 ? list[0].name.replace(/\.[^.]+$/, '') : '')
            }} />
            {selected.length ? (
              <div>
                <CheckCircle size={22} color={P.green} />
                <div style={{ fontSize: 13, fontWeight: 700, marginTop: 4 }}>
                  {selected.length === 1 ? selected[0].name : `${selected.length} ملفات مختارة`}
                </div>
                <div style={{ fontSize: 12, color: 'var(--mu)' }}>
                  {fmtSize(selected.reduce((a, f) => a + f.size, 0))}
                </div>
              </div>
            ) : (
              <div><Upload size={22} color="var(--dim)" /><div style={{ fontSize: 13, color: 'var(--mu)', marginTop: 4 }}>اضغط لاختيار ملف — PDF أو عرض أو مستند أو صورة (حتى 200MB)</div></div>
            )}
          </div>
          <button type="submit" disabled={uploading || !selected.length || !course} style={{ ...S.btn(), width: '100%', opacity: (uploading || !selected.length || !course) ? 0.5 : 1 }}>
            {uploading
              ? <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />
                  {batch && batch.total > 1 ? ` ${batch.done + 1} من ${batch.total} — ` : ' جارٍ الرفع '}
                  {progress > 0 ? `${progress}%` : '...'}</>
              : <><Upload size={14} /> {selected.length > 1 ? `رفع ${selected.length} ملفات` : 'رفع الملف'}</>}
          </button>

          {batch && !uploading && batch.failed.length > 0 && (
            <div style={{ marginTop: 10, background: 'var(--errBg)', border: '1px solid #dc262655', borderRadius: 10, padding: '10px 12px', fontSize: 12, color: 'var(--errTx)', lineHeight: 1.8 }}>
              فشل {batch.failed.length} من {batch.total}. البقية رُفعت.
              <ul style={{ margin: '6px 0 0', paddingInlineStart: 18 }}>
                {batch.failed.slice(0, 5).map(f => <li key={f.name}>{f.name} — {f.why}</li>)}
              </ul>
            </div>
          )}
        </form>
      )}

      <div style={S.card}>
        <h3 style={{ fontSize: 14, fontWeight: 800, marginBottom: 12 }}>الملفات المرفوعة ({files.length})</h3>
        {loading ? <Loader /> : files.length === 0 ? <Empty text="لا توجد ملفات بعد" /> : files.map(f => (
          <div key={f.id} style={rowStyle}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: `${P.blue2}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><FileText size={15} color={P.blue2} /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={ellipsis}>{f.name}</div>
              <div style={{ fontSize: 12, color: 'var(--mu)' }}>
                {f.courseName} • {CATEGORY_LABEL[f.category] || f.category} • {f.sizeLabel} • {fmtDate(f.uploadedAt)}
              </div>
            </div>
            <a href={`/api/download?url=${encodeURIComponent(f.blobUrl)}`} target="_blank" rel="noopener noreferrer" style={{ ...S.iconBtn(P.blue2), textDecoration: 'none' }}><Eye size={14} /></a>
            <button onClick={() => remove(f)} style={S.iconBtn(P.red)}><Trash2 size={14} /></button>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ══════════════ COURSES ══════════════ */
function CoursesTab({ flash }) {
  const [courses, setCourses] = useState([])
  const [colleges, setColleges] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null) // course object or {} for new

  const load = useCallback(async () => {
    setLoading(true)
    const [c, col] = await Promise.all([apiJSON('/api/admin/courses'), apiJSON('/api/admin/colleges')])
    setCourses(c.data.courses || [])
    setColleges(col.data.colleges || [])
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  async function save(form) {
    const isNew = !form.id
    const { ok, data } = await apiJSON('/api/admin/courses', {
      method: isNew ? 'POST' : 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (ok) { flash(isNew ? 'تمت إضافة المادة' : 'تم التحديث'); setEditing(null); load() }
    else flash(data.error || 'فشل الحفظ', 'error')
  }

  async function remove(c) {
    if (!confirm(`حذف مادة "${c.name_ar}"؟ سيُحذف كل ما يرتبط بها.`)) return
    const { ok, data } = await apiJSON('/api/admin/courses', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: c.id }) })
    if (ok) { flash('تم الحذف'); load() } else flash(data.error || 'فشل الحذف', 'error')
  }

  async function toggleActive(c) {
    await apiJSON('/api/admin/courses', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: c.id, is_active: !c.is_active }) })
    load()
  }

  if (loading) return <Loader />

  return (
    <div>
      <SectionHeader title={`المواد (${courses.length})`} onRefresh={load} action={{ label: 'إضافة مادة', onClick: () => setEditing({}) }} />
      {TRACKS.map(tr => {
        const list = courses.filter(c => c.track === tr.id)
        if (list.length === 0) return null
        return (
          <div key={tr.id} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 13, color: P.gold, fontWeight: 800, marginBottom: 6 }}>{tr.label}</div>
            {list.map(c => (
              <div key={c.id} style={rowStyle}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: `${c.color || P.blue2}22`, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={ellipsis}>{c.name_ar} {!c.is_active && <span style={{ fontSize: 11.5, color: P.red }}>(مخفية)</span>}</div>
                  <div style={{ fontSize: 12, color: 'var(--mu)' }}>{c.college_id || '—'} • مشاهدات: {c.view_count || 0}</div>
                </div>
                <button onClick={() => toggleActive(c)} title={c.is_active ? 'إخفاء' : 'إظهار'} style={S.iconBtn(c.is_active ? P.green : 'var(--mu)')}><Eye size={14} /></button>
                <button onClick={() => setEditing(c)} style={S.iconBtn(P.blue2)}><Edit3 size={14} /></button>
                <button onClick={() => remove(c)} style={S.iconBtn(P.red)}><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        )
      })}
      {courses.length === 0 && <Empty text="لا توجد مواد" />}

      {editing && <CourseModal course={editing} colleges={colleges} onSave={save} onClose={() => setEditing(null)} />}
    </div>
  )
}

function CourseModal({ course, colleges, onSave, onClose }) {
  const [f, setF] = useState({
    id: course.id, name_ar: course.name_ar || '', name_en: course.name_en || '',
    track: course.track || 'bachelor', college_id: course.college_id || '',
    plan: course.plan || '', color: course.color || '#1a56db', credit_hours: course.credit_hours || '',
    is_active: course.is_active !== false,
  })
  const set = (k, v) => setF(s => ({ ...s, [k]: v }))
  return (
    <Modal title={course.id ? 'تعديل مادة' : 'إضافة مادة'} onClose={onClose} onSubmit={() => onSave(f)}>
      <label style={S.label}>اسم المادة *</label>
      <input value={f.name_ar} onChange={e => set('name_ar', e.target.value)} style={{ ...S.input, marginBottom: 10 }} required />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        <div><label style={S.label}>المسار *</label>
          <select value={f.track} onChange={e => set('track', e.target.value)} style={S.input}>{TRACKS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}</select>
        </div>
        <div><label style={S.label}>الكلية</label>
          <select value={f.college_id} onChange={e => set('college_id', e.target.value)} style={S.input}><option value="">— بدون —</option>{colleges.map(c => <option key={c.id} value={c.id}>{c.name_ar}</option>)}</select>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        <div><label style={S.label}>الخطة (أ/ب للتحضيري)</label><input value={f.plan} onChange={e => set('plan', e.target.value)} placeholder="a أو b" style={S.input} /></div>
        <div><label style={S.label}>اللون</label><input type="color" value={f.color} onChange={e => set('color', e.target.value)} style={{ ...S.input, padding: 4, height: 38 }} /></div>
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--tx)', cursor: 'pointer' }}>
        <input type="checkbox" checked={f.is_active} onChange={e => set('is_active', e.target.checked)} /> ظاهرة للطلاب
      </label>
    </Modal>
  )
}

/* ══════════════ COLLEGES ══════════════ */
/**
 * The study-plan editor.
 *
 * The plan for إدارة أعمال was compiled into the app because it was the only one
 * transcribed; every other programme needed the same treatment and a deploy for
 * each. Only the owner holds those lists, so this is the screen that lets them
 * enter one without me — which is the only way all of them ever get filled in.
 *
 * A whole programme saves in one write: the editor holds the entire plan on
 * screen, so patching level-by-level would let two open tabs interleave into a
 * plan neither person typed.
 */
function PlansTab({ flash }) {
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [program, setProgram] = useState('')
  const [levels, setLevels] = useState([])
  const [saving, setSaving] = useState(false)

  // Every programme the catalogue knows, so the owner picks rather than types a
  // name that would never match what students are filed under.
  const allPrograms = []
  CATALOGUE.bachelor.colleges.forEach(c => c.programs.forEach(pr => allPrograms.push({ program: pr, college: c.label })))
  CATALOGUE.diploma.programs.forEach(pr => allPrograms.push({ program: pr, college: 'دبلوم' }))
  CATALOGUE.graduate.programs.forEach(pr => allPrograms.push({ program: pr, college: 'دراسات عليا' }))

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await apiJSON('/api/admin/program-plans')
    setPlans(data.plans || [])
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const openProgram = (pr) => {
    setProgram(pr)
    const found = plans.find(x => x.program === pr)
    if (found && Array.isArray(found.levels) && found.levels.length) {
      setLevels(found.levels.map(l => ({ label: l.label, courses: (l.courses || []).join('، ') })))
      return
    }
    // Nothing saved yet: open on the plan the app already ships for this
    // programme rather than on an empty form. It is what the student is being
    // shown right now, so editing from it is editing what they see — and a
    // programme with no built-in plan still opens blank, as before.
    const built = levelsOf(pr)
    setLevels(built
      ? Object.entries(built).map(([label, courses]) => ({ label, courses: courses.join('، ') }))
      : [{ label: 'المستوى الثالث', courses: '' }])
  }

  const save = async () => {
    if (!program) return
    setSaving(true)
    const payload = levels
      .map(l => ({
        label: (l.label || '').trim(),
        // Accept Arabic or Latin commas, spaces or new lines between codes —
        // the owner is pasting from a bot, not filling in a form.
        courses: (l.courses || '').split(/[،,\n\s]+/).map(c => c.trim()).filter(Boolean),
      }))
      .filter(l => l.label)
    const { ok, data } = await apiJSON('/api/admin/program-plans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ program, levels: payload }),
    })
    setSaving(false)
    flash(ok ? `حُفظت خطة ${program}` : (data.error || 'تعذّر الحفظ'), ok ? 'success' : 'error')
    if (ok) load()
  }

  const removePlan = async () => {
    if (!program || !confirm(`حذف خطة ${program} نهائياً؟`)) return
    const { ok, data } = await apiJSON(`/api/admin/program-plans?program=${encodeURIComponent(program)}`, { method: 'DELETE' })
    flash(ok ? 'حُذفت الخطة' : (data.error || 'تعذّر الحذف'), ok ? 'success' : 'error')
    if (ok) { setProgram(''); setLevels([]); load() }
  }

  const inp = { width: '100%', padding: '9px 11px', borderRadius: 10, border: '1px solid var(--bd)', background: 'var(--soft)', color: 'var(--tx)', fontFamily: 'inherit', fontSize: 13, outline: 'none', boxSizing: 'border-box' }

  if (loading) return <div style={S.card}>جارِ التحميل…</div>

  return (
    <div>
      <div style={S.card}>
        <h3 style={{ margin: '0 0 4px', fontSize: 16 }}>الخطط الدراسية</h3>
        <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--mu)', lineHeight: 1.7 }}>
          اختر التخصص، ثم اكتب مستوياته ومواد كل مستوى. تُعرض للطالب في «مساري ← خطتي الدراسية»،
          وكل مادة يضغطها تفتح صفحتها.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
          {allPrograms.map(({ program: pr, college }) => {
            // A programme counts as covered whether its plan is saved here or
            // shipped with the app — both reach the student, and a red dot on a
            // programme students already see a plan for would be a lie.
            const has = plans.some(x => x.program === pr && (x.levels || []).length) || !!levelsOf(pr)
            const on = program === pr
            return (
              <button key={pr} onClick={() => openProgram(pr)} title={college} style={{
                padding: '7px 12px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
                fontSize: 12.5, fontWeight: 700,
                background: on ? 'var(--brand)' : 'var(--soft)',
                color: on ? '#fff' : 'var(--tx)',
                border: `1.5px solid ${on ? 'var(--brand)' : 'var(--bd)'}`,
              }}>
                {has && !on && <span style={{ color: '#16a34a', marginLeft: 5 }}>●</span>}
                {pr}
              </button>
            )
          })}
        </div>
      </div>

      {program && (
        <div style={S.card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 10, flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0, fontSize: 15 }}>خطة: {program}</h3>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setLevels(l => [...l, { label: `المستوى ${l.length + 3}`, courses: '' }])}
                style={{ padding: '7px 12px', borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, background: 'var(--soft)', color: 'var(--tx)', border: '1px solid var(--bd)' }}>
                + مستوى
              </button>
              <button onClick={removePlan}
                style={{ padding: '7px 12px', borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, background: 'transparent', color: '#dc2626', border: '1px solid #dc262655' }}>
                حذف الخطة
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {levels.map((lv, i) => (
              <div key={i} style={{ border: '1px solid var(--bd)', borderRadius: 12, padding: 12, background: 'var(--soft)' }}>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <input value={lv.label} placeholder="اسم المستوى"
                    onChange={e => setLevels(ls => ls.map((x, j) => j === i ? { ...x, label: e.target.value } : x))}
                    style={{ ...inp, flex: 1 }} />
                  <button onClick={() => setLevels(ls => ls.filter((_, j) => j !== i))}
                    style={{ padding: '0 12px', borderRadius: 9, cursor: 'pointer', background: 'transparent', color: '#dc2626', border: '1px solid #dc262655', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700 }}>
                    حذف
                  </button>
                </div>
                <textarea value={lv.courses} rows={2}
                  placeholder="رموز المواد — افصلها بفاصلة أو مسافة  مثل: STAT101، LAW101، ECON101"
                  onChange={e => setLevels(ls => ls.map((x, j) => j === i ? { ...x, courses: e.target.value } : x))}
                  style={{ ...inp, resize: 'vertical', direction: 'ltr', textAlign: 'left', fontFamily: 'monospace' }} />
              </div>
            ))}
          </div>

          <button onClick={save} disabled={saving} style={{
            marginTop: 14, width: '100%', padding: '11px', borderRadius: 12, cursor: saving ? 'wait' : 'pointer',
            background: 'var(--brand)', color: '#fff', border: 'none', fontFamily: 'inherit', fontSize: 14, fontWeight: 800,
          }}>
            {saving ? 'جارِ الحفظ…' : 'حفظ الخطة'}
          </button>
        </div>
      )}
    </div>
  )
}

function CollegesTab({ flash }) {
  const [colleges, setColleges] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await apiJSON('/api/admin/colleges')
    setColleges(data.colleges || [])
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  async function save(form) {
    const isNew = !colleges.find(c => c.id === form.id) || form._new
    const { ok, data } = await apiJSON('/api/admin/colleges', {
      method: form._new ? 'POST' : 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (ok) { flash(form._new ? 'تمت إضافة الكلية' : 'تم التحديث'); setEditing(null); load() }
    else flash(data.error || 'فشل الحفظ', 'error')
  }

  async function remove(c) {
    if (!confirm(`حذف كلية "${c.name_ar}"؟`)) return
    const { ok, data } = await apiJSON('/api/admin/colleges', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: c.id }) })
    if (ok) { flash('تم الحذف'); load() } else flash(data.error || 'فشل الحذف', 'error')
  }

  if (loading) return <Loader />

  return (
    <div>
      <SectionHeader title={`الكليات (${colleges.length})`} onRefresh={load} action={{ label: 'إضافة كلية', onClick: () => setEditing({ _new: true }) }} />
      {colleges.length === 0 ? <Empty text="لا توجد كليات" /> : colleges.map(c => (
        <div key={c.id} style={rowStyle}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: `${c.color || P.blue2}22`, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={ellipsis}>{c.name_ar}</div>
            <div style={{ fontSize: 12, color: 'var(--mu)' }}>{c.id}</div>
          </div>
          <button onClick={() => setEditing(c)} style={S.iconBtn(P.blue2)}><Edit3 size={14} /></button>
          <button onClick={() => remove(c)} style={S.iconBtn(P.red)}><Trash2 size={14} /></button>
        </div>
      ))}
      {editing && <CollegeModal college={editing} onSave={save} onClose={() => setEditing(null)} />}
    </div>
  )
}

function CollegeModal({ college, onSave, onClose }) {
  const [f, setF] = useState({
    _new: !!college._new, id: college.id || '', name_ar: college.name_ar || '',
    name_en: college.name_en || '', color: college.color || '#1d4ed8',
    description: college.description || '', sort_order: college.sort_order || 0,
  })
  const set = (k, v) => setF(s => ({ ...s, [k]: v }))
  return (
    <Modal title={college._new ? 'إضافة كلية' : 'تعديل كلية'} onClose={onClose} onSubmit={() => onSave(f)}>
      {college._new && (<><label style={S.label}>المعرّف (إنجليزي، بدون مسافات) *</label>
        <input value={f.id} onChange={e => set('id', e.target.value)} placeholder="cs" style={{ ...S.input, marginBottom: 10, direction: 'ltr', textAlign: 'left' }} required /></>)}
      <label style={S.label}>اسم الكلية *</label>
      <input value={f.name_ar} onChange={e => set('name_ar', e.target.value)} style={{ ...S.input, marginBottom: 10 }} required />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div><label style={S.label}>اللون</label><input type="color" value={f.color} onChange={e => set('color', e.target.value)} style={{ ...S.input, padding: 4, height: 38 }} /></div>
        <div><label style={S.label}>الترتيب</label><input type="number" value={f.sort_order} onChange={e => set('sort_order', e.target.value)} style={S.input} /></div>
      </div>
    </Modal>
  )
}

/* ══════════════ NOTIFICATIONS ══════════════ */
function NotificationsTab({ flash }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [type, setType] = useState('announcement')
  const [audience, setAudience] = useState('all')
  const [sending, setSending] = useState(false)

  const [push, setPush] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await apiJSON('/api/admin/notifications')
    setItems(data.notifications || [])
    setPush(data.push || null)
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  async function send(e) {
    e.preventDefault()
    if (!title.trim() || !body.trim()) return
    setSending(true)
    const { ok, data } = await apiJSON('/api/admin/notifications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, body, type, audience }) })
    setSending(false)
    if (ok) { flash('تم بث الإشعار'); setTitle(''); setBody(''); load() }
    else flash(data.error || 'فشل الإرسال', 'error')
  }

  async function remove(n) {
    if (!confirm('حذف هذا الإشعار؟')) return
    await apiJSON('/api/admin/notifications', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: n.id }) })
    flash('تم الحذف'); load()
  }

  const typeColors = { info: P.blue2, announcement: P.gold, warning: P.orange, success: P.green }

  // Traffic-light for device (push) notifications: green when a broadcast will
  // actually reach phones, amber when a setup step is still missing.
  const pushCard = () => {
    if (!push) return null
    const ok = push.configured && push.tableReady
    const col = ok ? P.green : P.gold
    const title = !push.configured
      ? 'إشعارات الجهاز غير مفعّلة'
      : !push.tableReady
        ? 'ينقص جدول الاشتراكات'
        : `إشعارات الجهاز مفعّلة — ${push.devices} جهاز مشترك`
    const env = push.env || {}
    const anyEnv = Object.values(env).some(Boolean)
    const hint = !push.configured
      ? (anyEnv
          // Some keys are visible but not the required pair — a specific gap.
          ? 'بعض المفاتيح غير مقروءة. راجع القائمة تحت، وتأكّد أنها مضافة لبيئة Production.'
          // Nothing at all is visible: either never added, or added after the
          // running build was made — Vercel only picks them up on a new deploy.
          : 'الخادم لا يرى أي مفتاح. إن كنت أضفتها بالفعل فالسبب أن النشر الحالي أقدم منها — أعد النشر من Vercel ← Deployments ← ⋯ ← Redeploy.')
      : !push.tableReady
        ? 'شغّل migration 011_push_subscriptions.sql في Supabase.'
        : push.devices === 0
          ? 'لا أجهزة مشتركة بعد — افتح الموقع، اضغط زر الجرس، وفعّل «إشعارات الجهاز».'
          : 'كل إعلان ترسله سيصل هذه الأجهزة حتى لو كان التطبيق مغلقاً.'
    return (
      <div style={{ ...S.card, borderRight: `3px solid ${col}`, display: 'flex', gap: 11 }}>
        <Bell size={17} color={col} style={{ flexShrink: 0, marginTop: 2 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--tx)' }}>{title}</div>
          <div style={{ fontSize: 11.5, color: 'var(--mu)', lineHeight: 1.7, marginTop: 3 }}>{hint}</div>
          {!push.configured && (
            <div style={{ marginTop: 9, display: 'flex', flexDirection: 'column', gap: 3 }}>
              {Object.entries(env).map(([name, present]) => (
                <div key={name} style={{ fontSize: 11, fontFamily: 'monospace', direction: 'ltr', textAlign: 'left', color: present ? P.green : P.red }}>
                  {present ? '✓' : '✗'} {name}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div>
      {pushCard()}
      <form onSubmit={send} style={S.card}>
        <h3 style={{ fontSize: 14, fontWeight: 800, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}><Send size={15} color={P.blue2} /> بث إشعار لكل الطلاب</h3>
        <label style={S.label}>العنوان *</label>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="مثال: تحديث الخطط الدراسية" style={{ ...S.input, marginBottom: 10 }} required />
        <label style={S.label}>النص *</label>
        <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="اكتب محتوى الإشعار..." rows={3} style={{ ...S.input, marginBottom: 10, resize: 'vertical' }} required />
        <label style={S.label}>النوع</label>
        <select value={type} onChange={e => setType(e.target.value)} style={{ ...S.input, marginBottom: 6 }}>
          <option value="announcement">إعلان — شريط بارز أعلى الموقع + الجرس</option>
          <option value="warning">تنبيه — شريط أحمر أعلى الموقع + الجرس</option>
          <option value="info">معلومة — في زر الجرس فقط</option>
          <option value="success">خبر جيد — في زر الجرس فقط</option>
        </select>
        <label style={S.label}>الجمهور المستهدف</label>
        <select value={audience} onChange={e => setAudience(e.target.value)} style={{ ...S.input, marginBottom: 6 }}>
          {AUDIENCE_OPTIONS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
        </select>
        <div style={{ fontSize: 12, color: 'var(--mu)', marginBottom: 12, lineHeight: 1.6 }}>
          «إعلان» و«تنبيه» يظهران كشريط بارز أعلى الموقع (قابل للإغلاق)، بينما «معلومة» و«خبر جيد» تظهر عند فتح زر الجرس.
          <br />
          الموقع عام، فالإعلان يصل الجميع — واختيار جمهور محدّد يضيف وسماً واضحاً على الإعلان مثل «لطلاب خطة أ».
        </div>
        <button type="submit" disabled={sending || !title.trim() || !body.trim()} style={{ ...S.btn(), width: '100%', opacity: (sending || !title.trim() || !body.trim()) ? 0.5 : 1 }}>
          {sending ? 'جارٍ الإرسال...' : <><Send size={14} /> بث الإشعار</>}
        </button>
      </form>

      <div style={S.card}>
        <h3 style={{ fontSize: 14, fontWeight: 800, marginBottom: 12 }}>الإشعارات المرسلة ({items.length})</h3>
        {loading ? <Loader /> : items.length === 0 ? <Empty text="لا توجد إشعارات مرسلة" /> : items.map(n => (
          <div key={n.id} style={rowStyle}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: typeColors[n.type] || P.blue2, flexShrink: 0, marginTop: 6 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--tx)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                {n.title}
                {audienceBadge(n.audience) && (
                  <span style={{ fontSize: 10.5, fontWeight: 800, color: P.gold, background: `${P.gold}20`, borderRadius: 6, padding: '1px 7px' }}>{audienceBadge(n.audience)}</span>
                )}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--mu2)', lineHeight: 1.6 }}>{n.body}</div>
              <div style={{ fontSize: 11.5, color: 'var(--mu)', marginTop: 2 }}>{fmtDate(n.created_at)}</div>
            </div>
            <button onClick={() => remove(n)} style={S.iconBtn(P.red)}><Trash2 size={14} /></button>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ══════════════ LINKS PAGE EDITOR ══════════════ */
function LinksTab({ flash }) {
  const [content, setContent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { ok, data } = await apiJSON('/api/admin/site-content?key=links')
    // Deep-clone the seed so edits never mutate the module-level default.
    const seed = JSON.parse(JSON.stringify(LINKS_SEED))
    if (ok && data.data) {
      setContent({
        header: { ...seed.header, ...(data.data.header || {}) },
        quick: { ...seed.quick, ...(data.data.quick || {}) },
        groups: Array.isArray(data.data.groups) ? data.data.groups : seed.groups,
        footer: typeof data.data.footer === 'string' ? data.data.footer : seed.footer,
      })
    } else {
      setContent(seed)
    }
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  async function save() {
    setSaving(true)
    const { ok, data } = await apiJSON('/api/admin/site-content', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'links', data: content }),
    })
    setSaving(false)
    if (ok) flash('تم حفظ صفحة الروابط — ستظهر التعديلات للطلاب فوراً')
    else flash(data.error || 'فشل الحفظ', 'error')
  }

  function resetDefaults() {
    if (!confirm('استرجاع المحتوى الافتراضي؟ سيُستبدل ما تراه الآن (لن يُحفظ حتى تضغط حفظ).')) return
    setContent(JSON.parse(JSON.stringify(LINKS_SEED)))
  }

  if (loading || !content) return <Loader />

  const setHeader = (k, v) => setContent(c => ({ ...c, header: { ...c.header, [k]: v } }))
  const setQuick = (k, v) => setContent(c => ({ ...c, quick: { ...c.quick, [k]: v } }))
  const setFooter = (v) => setContent(c => ({ ...c, footer: v }))

  const setGroup = (gi, patch) => setContent(c => {
    const groups = c.groups.map((g, i) => i === gi ? { ...g, ...patch } : g)
    return { ...c, groups }
  })
  const removeGroup = (gi) => {
    if (!confirm('حذف هذه المجموعة وكل روابطها؟')) return
    setContent(c => ({ ...c, groups: c.groups.filter((_, i) => i !== gi) }))
  }
  const addGroup = () => setContent(c => ({
    ...c, groups: [...c.groups, { group: 'مجموعة جديدة', color: '#1a56db', items: [] }],
  }))
  const moveGroup = (gi, dir) => setContent(c => {
    const groups = [...c.groups]
    const nj = gi + dir
    if (nj < 0 || nj >= groups.length) return c
    ;[groups[gi], groups[nj]] = [groups[nj], groups[gi]]
    return { ...c, groups }
  })

  const setItem = (gi, ii, patch) => setContent(c => {
    const groups = c.groups.map((g, i) => {
      if (i !== gi) return g
      const items = g.items.map((it, j) => j === ii ? { ...it, ...patch } : it)
      return { ...g, items }
    })
    return { ...c, groups }
  })
  const removeItem = (gi, ii) => setContent(c => {
    const groups = c.groups.map((g, i) => i === gi ? { ...g, items: g.items.filter((_, j) => j !== ii) } : g)
    return { ...c, groups }
  })
  const addItem = (gi) => setContent(c => {
    const groups = c.groups.map((g, i) => i === gi
      ? { ...g, items: [...g.items, { label: 'رابط جديد', desc: '', url: 'https://', icon: 'Link2', color: g.color || '#1a56db' }] }
      : g)
    return { ...c, groups }
  })
  const moveItem = (gi, ii, dir) => setContent(c => {
    const groups = c.groups.map((g, i) => {
      if (i !== gi) return g
      const items = [...g.items]
      const nj = ii + dir
      if (nj < 0 || nj >= items.length) return g
      ;[items[ii], items[nj]] = [items[nj], items[ii]]
      return { ...g, items }
    })
    return { ...c, groups }
  })

  const saveBar = (
    <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
      <button onClick={save} disabled={saving} style={{ ...S.btn(P.green), flex: 1, opacity: saving ? 0.5 : 1 }}>
        {saving ? <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> جارٍ الحفظ...</> : <><Save size={14} /> حفظ ونشر</>}
      </button>
      <button onClick={resetDefaults} style={S.btn('var(--mu)')}><RefreshCw size={14} /> الافتراضي</button>
    </div>
  )

  return (
    <div>
      <SectionHeader title="تحرير صفحة الروابط" onRefresh={load} />
      {saveBar}

      {/* Header text */}
      <div style={S.card}>
        <h3 style={{ fontSize: 14, fontWeight: 800, marginBottom: 12 }}>العنوان والوصف</h3>
        <label style={S.label}>العنوان الرئيسي</label>
        <input value={content.header.title} onChange={e => setHeader('title', e.target.value)} style={{ ...S.input, marginBottom: 10 }} />
        <label style={S.label}>العنوان الفرعي</label>
        <input value={content.header.subtitle} onChange={e => setHeader('subtitle', e.target.value)} style={{ ...S.input, marginBottom: 10 }} />
        <label style={S.label}>ملاحظة أعلى الصفحة</label>
        <textarea value={content.header.note} onChange={e => setHeader('note', e.target.value)} rows={2} style={{ ...S.input, resize: 'vertical' }} />
      </div>

      {/* Quick contact */}
      <div style={S.card}>
        <h3 style={{ fontSize: 14, fontWeight: 800, marginBottom: 12 }}>معلومات التواصل السريعة</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div><label style={S.label}>رقم الدعم</label><input value={content.quick.phone} onChange={e => setQuick('phone', e.target.value)} style={{ ...S.input, direction: 'ltr', textAlign: 'right' }} /></div>
          <div><label style={S.label}>ساعات العمل</label><input value={content.quick.hours} onChange={e => setQuick('hours', e.target.value)} style={S.input} /></div>
          <div style={{ gridColumn: '1 / -1' }}><label style={S.label}>أيام العمل</label><input value={content.quick.days} onChange={e => setQuick('days', e.target.value)} style={S.input} /></div>
        </div>
      </div>

      {/* Groups */}
      {content.groups.map((g, gi) => (
        <div key={gi} style={{ ...S.card, borderColor: 'var(--bd2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ width: 12, height: 12, borderRadius: 4, background: g.color || P.blue2, flexShrink: 0 }} />
            <h3 style={{ fontSize: 14, fontWeight: 800, margin: 0, flex: 1 }}>مجموعة {gi + 1}</h3>
            <button onClick={() => moveGroup(gi, -1)} disabled={gi === 0} title="لأعلى" style={{ ...S.iconBtn('#6b8c7d'), opacity: gi === 0 ? 0.4 : 1 }}>▲</button>
            <button onClick={() => moveGroup(gi, 1)} disabled={gi === content.groups.length - 1} title="لأسفل" style={{ ...S.iconBtn('#6b8c7d'), opacity: gi === content.groups.length - 1 ? 0.4 : 1 }}>▼</button>
            <button onClick={() => removeGroup(gi)} title="حذف المجموعة" style={S.iconBtn(P.red)}><Trash2 size={14} /></button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, marginBottom: 12 }}>
            <div><label style={S.label}>اسم المجموعة</label><input value={g.group} onChange={e => setGroup(gi, { group: e.target.value })} style={S.input} /></div>
            <div><label style={S.label}>اللون</label><input type="color" value={g.color || '#1a56db'} onChange={e => setGroup(gi, { color: e.target.value })} style={{ ...S.input, padding: 4, width: 52, height: 38 }} /></div>
          </div>

          {g.items.map((it, ii) => (
            <div key={ii} style={{ background: 'var(--soft)', border: '1px solid var(--bd)', borderRadius: 11, padding: 12, marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--mu2)', flex: 1 }}>رابط {ii + 1}</span>
                <button onClick={() => moveItem(gi, ii, -1)} disabled={ii === 0} style={{ ...S.iconBtn('#6b8c7d'), opacity: ii === 0 ? 0.4 : 1 }}>▲</button>
                <button onClick={() => moveItem(gi, ii, 1)} disabled={ii === g.items.length - 1} style={{ ...S.iconBtn('#6b8c7d'), opacity: ii === g.items.length - 1 ? 0.4 : 1 }}>▼</button>
                <button onClick={() => removeItem(gi, ii)} style={S.iconBtn(P.red)}><Trash2 size={13} /></button>
              </div>
              <label style={S.label}>الاسم</label>
              <input value={it.label} onChange={e => setItem(gi, ii, { label: e.target.value })} style={{ ...S.input, marginBottom: 8 }} />
              <label style={S.label}>الوصف</label>
              <input value={it.desc} onChange={e => setItem(gi, ii, { desc: e.target.value })} style={{ ...S.input, marginBottom: 8 }} />
              <label style={S.label}>الرابط (URL)</label>
              <input value={it.url} onChange={e => setItem(gi, ii, { url: e.target.value })} style={{ ...S.input, marginBottom: 8, direction: 'ltr', textAlign: 'left' }} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10 }}>
                <div><label style={S.label}>الأيقونة</label>
                  <select value={it.icon} onChange={e => setItem(gi, ii, { icon: e.target.value })} style={S.input}>
                    {LINK_ICON_NAMES.map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div><label style={S.label}>اللون</label><input type="color" value={it.color || '#1a56db'} onChange={e => setItem(gi, ii, { color: e.target.value })} style={{ ...S.input, padding: 4, width: 52, height: 38 }} /></div>
              </div>
            </div>
          ))}
          <button onClick={() => addItem(gi)} style={{ ...S.btn(P.blue2), width: '100%', marginTop: 4 }}><Plus size={14} /> إضافة رابط</button>
        </div>
      ))}

      <button onClick={addGroup} style={{ ...S.btn(P.purple), width: '100%', marginBottom: 16 }}><Plus size={14} /> إضافة مجموعة جديدة</button>

      {/* Footer */}
      <div style={S.card}>
        <h3 style={{ fontSize: 14, fontWeight: 800, marginBottom: 12 }}>نص أسفل الصفحة</h3>
        <textarea value={content.footer} onChange={e => setFooter(e.target.value)} rows={3} style={{ ...S.input, resize: 'vertical' }} />
      </div>

      {saveBar}
    </div>
  )
}

/* ══════════════ CALENDAR ══════════════ */
function CalendarTab({ flash }) {
  const [events, setEvents] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { ok, data } = await apiJSON('/api/admin/site-content?key=calendar')
    const seed = JSON.parse(JSON.stringify(CAL_SEED))
    setEvents(ok && Array.isArray(data.data?.events) && data.data.events.length ? data.data.events : seed.events)
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  async function save() {
    setSaving(true)
    const { ok, data } = await apiJSON('/api/admin/site-content', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'calendar', data: { events } }),
    })
    setSaving(false)
    if (ok) flash('تم حفظ التقويم — سيظهر للطلاب فوراً')
    else flash(data.error || 'فشل الحفظ', 'error')
  }

  if (loading || !events) return <Loader />

  const set = (i, patch) => setEvents(evs => evs.map((e, j) => j === i ? { ...e, ...patch } : e))
  const removeEv = (i) => setEvents(evs => evs.filter((_, j) => j !== i))
  const addEv = () => setEvents(evs => [...evs, { label: 'حدث جديد', date: new Date().toISOString().slice(0, 10), color: '#2563eb', icon: 'Calendar' }])
  const sorted = [...events].map((e, i) => ({ e, i })).sort((a, b) => (a.e.date || '').localeCompare(b.e.date || ''))

  return (
    <div>
      <SectionHeader title="التقويم الأكاديمي" onRefresh={load} action={{ label: 'إضافة حدث', onClick: addEv }} />
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button onClick={save} disabled={saving} style={{ ...S.btn(P.green), flex: 1, opacity: saving ? 0.5 : 1 }}>
          {saving ? <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> جارٍ الحفظ...</> : <><Save size={14} /> حفظ ونشر</>}
        </button>
      </div>
      {events.length === 0 ? <Empty text="لا أحداث — أضف أول حدث" /> : sorted.map(({ e, i }) => (
        <div key={i} style={{ ...S.card, padding: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ width: 12, height: 12, borderRadius: 4, background: e.color || P.blue2, flexShrink: 0 }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--mu)', flex: 1 }}>حدث</span>
            <button onClick={() => removeEv(i)} style={S.iconBtn(P.red)}><Trash2 size={14} /></button>
          </div>
          <label style={S.label}>العنوان</label>
          <input value={e.label} onChange={ev => set(i, { label: ev.target.value })} style={{ ...S.input, marginBottom: 10 }} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 10 }}>
            <div><label style={S.label}>التاريخ</label><input type="date" value={e.date} onChange={ev => set(i, { date: ev.target.value })} style={S.input} /></div>
            <div><label style={S.label}>الأيقونة</label>
              <select value={e.icon} onChange={ev => set(i, { icon: ev.target.value })} style={S.input}>
                {CAL_ICON_NAMES.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div><label style={S.label}>اللون</label><input type="color" value={e.color || '#2563eb'} onChange={ev => set(i, { color: ev.target.value })} style={{ ...S.input, padding: 4, width: 52, height: 38 }} /></div>
          </div>
          <label style={{ ...S.label, marginTop: 10 }}>يظهر لـ</label>
          <select value={e.audience || 'all'} onChange={ev => set(i, { audience: ev.target.value })} style={S.input}>
            {AUDIENCE_OPTIONS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
          </select>
        </div>
      ))}
      <button onClick={addEv} style={{ ...S.btn(P.blue2), width: '100%', marginBottom: 16 }}><Plus size={14} /> إضافة حدث</button>
    </div>
  )
}

/* ══════════════ TRACK CHANGE REQUESTS ══════════════ */
/**
 * The reply box on a pending request.
 *
 * Module scope, not nested inside TrackRequestsTab: a component declared
 * inside another is a new type on every render, so React would unmount and
 * remount this textarea on each keystroke and focus would be lost after every
 * character. That exact bug already happened once in this file with PayField.
 */
function RequestReply({ req, busy, onAnswer }) {
  const [reply, setReply] = useState(req.admin_reply || '')
  return (
    <div style={{ marginTop: 4 }}>
      <textarea
        value={reply}
        onChange={e => setReply(e.target.value)}
        rows={2}
        placeholder="اكتب ردّك للطالب — يمكنك الإرسال دون البتّ في الطلب"
        style={{
          width: '100%', boxSizing: 'border-box', background: 'var(--bg)',
          border: '1px solid var(--bd)', borderRadius: 10, padding: '9px 11px',
          fontSize: 12.5, color: 'var(--tx)', fontFamily: 'inherit',
          direction: 'rtl', outline: 'none', resize: 'vertical', marginBottom: 8,
        }}
      />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={() => onAnswer(req, 'pending', reply)} disabled={busy || !reply.trim()}
          style={{ ...S.btn(P.blue2), flex: 1, opacity: reply.trim() ? 1 : 0.5 }}>
          <Send size={14} /> أرسل ردّاً فقط
        </button>
        <button onClick={() => onAnswer(req, 'approved', reply)} disabled={busy} style={{ ...S.btn(P.green), flex: 1 }}>
          <CheckCircle size={14} /> موافقة
        </button>
        <button onClick={() => onAnswer(req, 'rejected', reply)} disabled={busy} style={{ ...S.btn(P.red), flex: 1 }}>
          رفض
        </button>
      </div>
    </div>
  )
}

function TrackRequestsTab({ flash }) {
  const [items, setItems] = useState([])
  const [tableReady, setTableReady] = useState(true)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await apiJSON('/api/admin/track-requests')
    setItems(data.requests || [])
    setTableReady(data.tableReady !== false)
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  // status 'pending' means "answer them, decide later" — the owner asked to be
  // able to write back and ask what they meant before approving anything. A
  // window.prompt could not do that: it only appeared as part of deciding.
  async function answer(req, status, reply) {
    setBusy(req.id)
    const { ok, data } = await apiJSON('/api/admin/track-requests', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: req.id, status, reply }),
    })
    setBusy(null)
    if (ok) {
      flash(status === 'approved' ? 'تمت الموافقة' : status === 'rejected' ? 'تم الرفض' : 'أُرسل ردّك')
      load()
    } else flash(data.error || 'تعذّر الحفظ', 'error')
  }

  async function remove(req) {
    if (!confirm('حذف هذا الطلب؟')) return
    await apiJSON('/api/admin/track-requests', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: req.id }),
    })
    flash('تم الحذف'); load()
  }

  const statusMeta = {
    pending: { label: 'بانتظار الرد', color: P.gold },
    approved: { label: 'موافق عليه', color: P.green },
    rejected: { label: 'مرفوض', color: P.red },
  }
  const pending = items.filter(r => r.status === 'pending').length

  return (
    <div>
      <SectionHeader title={`طلبات تغيير المسار${pending ? ` (${pending} بانتظارك)` : ''}`} onRefresh={load} />

      {!tableReady && (
        <div style={{ ...S.card, background: 'var(--warnBg)', border: '1px solid #c8a84b55', display: 'flex', gap: 10, fontSize: 12, color: 'var(--warnTx)', lineHeight: 1.7 }}>
          <AlertCircle size={16} color={P.gold} style={{ flexShrink: 0, marginTop: 2 }} />
          <div>لعرض الطلبات شغّل migration <strong>012_track_requests.sql</strong> في Supabase.</div>
        </div>
      )}

      {loading ? <Loader /> : items.length === 0 ? <Empty text="لا توجد طلبات" /> : items.map(r => {
        const meta = statusMeta[r.status] || statusMeta.pending
        return (
          <div key={r.id} style={{ ...S.card, borderRight: `3px solid ${meta.color}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--tx)' }}>{r.student_name}</span>
              <span style={{ fontSize: 11.5, color: 'var(--mu)', fontFamily: 'monospace', direction: 'ltr' }}>{r.student_id}</span>
              <span style={{ fontSize: 10.5, fontWeight: 800, color: meta.color, background: `${meta.color}18`, borderRadius: 6, padding: '2px 8px' }}>{meta.label}</span>
              <span style={{ fontSize: 11, color: 'var(--mu)', marginRight: 'auto' }}>{fmtDate(r.created_at)}</span>
            </div>
            {r.current_track && <div style={{ fontSize: 12, color: 'var(--mu2)', marginBottom: 6 }}>المسار الحالي: {r.current_track}</div>}
            <div style={{ fontSize: 12.5, color: 'var(--tx)', lineHeight: 1.8, background: 'var(--bg)', borderRadius: 10, padding: '10px 12px', marginBottom: 10 }}>{r.reason}</div>
            {r.admin_reply && (
              <div style={{ fontSize: 12, color: 'var(--mu2)', lineHeight: 1.7, marginBottom: 10 }}>
                <strong style={{ color: 'var(--tx)' }}>ردّك:</strong> {r.admin_reply}
              </div>
            )}
            {r.status === 'pending' && (
              <RequestReply req={r} busy={busy === r.id} onAnswer={answer} />
            )}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
              <button onClick={() => remove(r)} style={S.iconBtn(P.red)}><Trash2 size={14} /></button>
            </div>
          </div>
        )
      })}

      <div style={{ ...S.card, fontSize: 11.5, color: 'var(--mu)', lineHeight: 1.8 }}>
        المسار مثبَّت 15 يوماً بعد تأكيده. «أرسل ردّاً فقط» يوصل رسالتك للطالب ويترك الطلب معلّقاً — للسؤال أو طلب توضيح قبل أن تقرّر. الموافقة تسجّل قرارك، ثم يعيد الطالب اختيار مساره من صفحة حسابه.
      </div>
    </div>
  )
}

/* ══════════════ SUPPORT MESSAGES ══════════════ */
/**
 * What students write to you.
 *
 * There was no route from a student to the site owner at all — the only
 * contact details anywhere were the university's switchboard, which is not
 * who you tell that a file is missing.
 */
/**
 * The reply box on a conversation.
 *
 * Module scope, like RequestReply and for the same reason: a component
 * declared inside another is a new type on every render, so React remounts
 * the textarea on each keystroke and focus is lost after every letter. That
 * bug has already happened twice in this file.
 */
function ThreadReply({ thread, busy, onSend }) {
  const [text, setText] = useState('')
  return (
    <div style={{ marginTop: 10 }}>
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        rows={2}
        placeholder="اكتب ردّك — يصل الطالب داخل الموقع مباشرة"
        style={{
          width: '100%', boxSizing: 'border-box', background: 'var(--bg)',
          border: '1px solid var(--bd)', borderRadius: 10, padding: '9px 11px',
          fontSize: 12.5, color: 'var(--tx)', fontFamily: 'inherit',
          direction: 'rtl', outline: 'none', resize: 'vertical', marginBottom: 8,
        }}
      />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          onClick={async () => { const ok = await onSend(thread, text); if (ok) setText('') }}
          disabled={busy || !text.trim()}
          style={{ ...S.btn(P.green), flex: 1, opacity: text.trim() ? 1 : 0.5 }}>
          <Send size={14} /> إرسال الرد
        </button>
      </div>
    </div>
  )
}

/* ══════════════ BOT ══════════════ */
/**
 * Run the site by describing what you want.
 *
 * The bot never writes on its own. It says what it would do, in plain Arabic,
 * and waits. That is not caution for its own sake: a language model reading
 * "اختبارات الميدترم بعد أسبوعين" will sometimes produce the wrong date, and
 * the difference between catching that and not is whether a human saw the line
 * before it became a calendar every student reads.
 */
function BotTab({ flash }) {
  const [text, setText] = useState('')
  const [thinking, setThinking] = useState(false)
  const [proposal, setProposal] = useState(null)   // { actions, preview, errors }
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState(null)       // { done, failed }

  async function propose() {
    if (!text.trim()) return
    setThinking(true); setProposal(null); setResult(null)
    const { ok, data } = await apiJSON('/api/admin/bot', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text.trim() }),
    })
    setThinking(false)
    if (!ok) { flash(data.error || 'تعذّر الفهم', 'error'); return }
    setProposal(data)
  }

  async function run() {
    setRunning(true)
    const { ok, data } = await apiJSON('/api/admin/bot', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm: true, actions: proposal.actions }),
    })
    setRunning(false)
    if (!ok) { flash(data.error || 'تعذّر التنفيذ', 'error'); return }
    setResult(data)
    setProposal(null)
    setText('')
    flash(data.failed?.length ? 'نُفِّذ بعضها' : 'تم التنفيذ', data.failed?.length ? 'error' : 'success')
  }

  const box = {
    width: '100%', boxSizing: 'border-box', background: 'var(--bg)',
    border: '1px solid var(--bd)', borderRadius: 10, padding: '11px 13px',
    fontSize: 13, color: 'var(--tx)', fontFamily: 'inherit',
    direction: 'rtl', outline: 'none', resize: 'vertical',
  }

  return (
    <div>
      <SectionHeader title="البوت" />

      <div style={S.card}>
        <div style={{ fontSize: 12, color: 'var(--mu)', lineHeight: 1.85, marginBottom: 12 }}>
          اكتب ما تريد بلغتك، وسأعرض عليك ما سأفعله قبل أن أفعله. مثال:
          <br /><span style={{ color: 'var(--tx)' }}>«أضف اختبارات الميدترم لطلاب التحضيري يوم ٢٥ أكتوبر ٢٠٢٦»</span>
          <br /><span style={{ color: 'var(--tx)' }}>«أرسل إعلاناً لكل الطلاب أن التسجيل يفتح غداً»</span>
        </div>
        <textarea value={text} onChange={e => setText(e.target.value)} rows={3}
          placeholder="اكتب طلبك…" style={{ ...box, marginBottom: 10 }} />
        <button onClick={propose} disabled={thinking || !text.trim()}
          style={{ ...S.btn(P.blue2), width: '100%', opacity: text.trim() ? 1 : 0.5 }}>
          <Sparkles size={14} /> {thinking ? 'أفكّر…' : 'اعرض ما ستفعله'}
        </button>
      </div>

      {proposal && (
        <div style={{ ...S.card, borderColor: `${P.gold}55` }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--tx)', marginBottom: 10 }}>
            سأفعل هذا — راجعه قبل التأكيد
          </div>

          {(proposal.preview || []).map((line, i) => (
            <div key={i} style={{
              display: 'flex', gap: 9, alignItems: 'flex-start',
              background: 'var(--s2)', border: '1px solid var(--bd)',
              borderRadius: 10, padding: '10px 12px', marginBottom: 8,
            }}>
              <span style={{ color: P.green, fontWeight: 900, flexShrink: 0 }}>{i + 1}</span>
              <span style={{ fontSize: 12.5, color: 'var(--tx)', lineHeight: 1.8 }}>{line}</span>
            </div>
          ))}

          {(proposal.errors || []).map((e, i) => (
            <div key={i} style={{
              fontSize: 12, color: P.red, background: `${P.red}0d`,
              border: `1px solid ${P.red}30`, borderRadius: 10,
              padding: '9px 11px', marginBottom: 8, lineHeight: 1.7,
            }}>{e}</div>
          ))}

          {(proposal.actions || []).length > 0 ? (
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button onClick={run} disabled={running} style={{ ...S.btn(P.green), flex: 2 }}>
                <CheckCircle size={14} /> {running ? 'جارٍ التنفيذ…' : 'نفّذ'}
              </button>
              <button onClick={() => setProposal(null)} style={{ ...S.btn(P.red), flex: 1 }}>
                إلغاء
              </button>
            </div>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--mu)', lineHeight: 1.8 }}>
              لا يوجد إجراء قابل للتنفيذ — أعد صياغة طلبك.
            </div>
          )}
        </div>
      )}

      {result && (
        <div style={S.card}>
          {(result.done || []).map((line, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 7 }}>
              <CheckCircle size={15} color={P.green} style={{ flexShrink: 0, marginTop: 2 }} />
              <span style={{ fontSize: 12.5, color: 'var(--tx)', lineHeight: 1.75 }}>{line}</span>
            </div>
          ))}
          {(result.failed || []).map((line, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 7 }}>
              <X size={15} color={P.red} style={{ flexShrink: 0, marginTop: 2 }} />
              <span style={{ fontSize: 12.5, color: P.red, lineHeight: 1.75 }}>{line}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ ...S.card, fontSize: 11.5, color: 'var(--mu)', lineHeight: 1.85 }}>
        البوت لا يكتب شيئاً قبل تأكيدك. ويقتصر على ما تستطيع فعله من اللوحة نفسها:
        إضافة أحداث للتقويم، وإرسال إعلانات. لا يحذف ولا يعدّل ولا يمسّ حسابات الطلاب.
      </div>
    </div>
  )
}

/* ══════════════ MESSAGES ══════════════ */
/**
 * Both sides of every conversation.
 *
 * The old tab could only answer by opening the student's mail client — which
 * meant the reply left the site, needed an address the student may never have
 * given, and never appeared anywhere they would look. Replies land in their
 * inbox now, in the same thread as the question.
 *
 * Threads waiting on you sort first; that ordering comes from the API so the
 * queue is the same whichever way it is read.
 */
function MessagesTab({ flash }) {
  const [threads, setThreads] = useState([])
  const [tableReady, setTableReady] = useState(true)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(null)
  const [openId, setOpenId] = useState(null)
  const [filter, setFilter] = useState('waiting')

  const load = useCallback(async () => {
    setLoading(true)
    const { ok, data } = await apiJSON('/api/admin/messages')
    if (ok) { setThreads(data.threads || []); setTableReady(data.tableReady !== false) }
    else flash(data.error || 'تعذّر التحميل', 'error')
    setLoading(false)
  }, [flash])
  useEffect(() => { load() }, [load])

  async function send(thread, body) {
    if (!body.trim()) return false
    setBusy(thread.id)
    const { ok, data } = await apiJSON('/api/admin/messages', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ threadId: thread.id, body }),
    })
    setBusy(null)
    if (ok) { flash('وصل ردّك للطالب'); load(); return true }
    flash(data.error || 'تعذّر الإرسال', 'error')
    return false
  }

  async function mark(thread, status) {
    setBusy(thread.id)
    const { ok } = await apiJSON('/api/admin/messages', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ threadId: thread.id, status }),
    })
    setBusy(null)
    if (ok) load()
  }

  async function remove(thread) {
    if (!confirm('حذف هذه المحادثة وكل رسائلها؟')) return
    const { ok } = await apiJSON(`/api/admin/messages?id=${thread.id}`, { method: 'DELETE' })
    if (ok) { flash('حُذفت المحادثة'); load() }
  }

  const waiting = threads.filter(t => t.admin_unread > 0).length
  const shown = filter === 'waiting' ? threads.filter(t => t.admin_unread > 0)
    : filter === 'open' ? threads.filter(t => t.status === 'open')
      : threads

  if (loading) return <div style={S.card}>جارٍ التحميل…</div>
  if (!tableReady) return (
    <div style={{ ...S.card, lineHeight: 1.9 }}>
      جدول الرسائل غير موجود بعد — شغّل الترحيل <code>019_messages.sql</code>.
    </div>
  )

  const KIND = {
    support: { label: 'رسالة', color: P.blue2 },
    subscription: { label: 'اشتراك', color: P.gold },
    track: { label: 'مسار', color: P.purple },
    system: { label: 'من الإدارة', color: P.green },
  }

  return (
    <div>
      <SectionHeader title={`الرسائل${waiting ? ` (${waiting} بانتظارك)` : ''}`} onRefresh={load} />

      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {[['waiting', `بانتظارك (${waiting})`], ['open', 'مفتوحة'], ['all', `الكل (${threads.length})`]].map(([id, label]) => (
          <button key={id} onClick={() => setFilter(id)} style={{
            background: filter === id ? `${P.blue2}18` : 'var(--s2)',
            border: `1.5px solid ${filter === id ? P.blue2 : 'var(--bd)'}`,
            borderRadius: 9, padding: '7px 12px', cursor: 'pointer', fontFamily: 'inherit',
            fontSize: 12.5, fontWeight: 800, color: filter === id ? P.blue2 : 'var(--mu)',
          }}>{label}</button>
        ))}
      </div>

      {shown.length === 0 && (
        <div style={{ ...S.card, color: 'var(--mu)' }}>
          {filter === 'waiting' ? 'لا شيء ينتظر ردّك.' : 'لا محادثات.'}
        </div>
      )}

      {shown.map(t => {
        const k = KIND[t.kind] || KIND.support
        const expanded = openId === t.id
        const last = (t.messages || [])[t.messages.length - 1]
        return (
          <div key={t.id} style={{ ...S.card, borderColor: t.admin_unread > 0 ? `${P.blue2}55` : 'var(--bd)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 10.5, fontWeight: 800, color: k.color, background: `${k.color}15`, borderRadius: 6, padding: '2px 7px' }}>{k.label}</span>
              {t.admin_unread > 0 && (
                <span style={{ fontSize: 10.5, fontWeight: 800, color: '#fff', background: P.blue2, borderRadius: 6, padding: '2px 7px' }}>
                  {t.admin_unread} جديدة
                </span>
              )}
              {t.status === 'closed' && (
                <span style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--mu)', background: 'var(--s2)', borderRadius: 6, padding: '2px 7px' }}>مغلقة</span>
              )}
              <span style={{ marginRight: 'auto', fontSize: 11, color: 'var(--mu2)' }}>
                {new Date(t.last_message_at).toLocaleString('ar-SA')}
              </span>
            </div>

            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--tx)', marginBottom: 3 }}>
              {t.student_name || 'طالب'}{t.student_id ? ` · ${t.student_id}` : ''}{t.email ? ` · ${t.email}` : ''}
            </div>

            {!expanded && last && (
              <div style={{ fontSize: 12, color: 'var(--mu)', lineHeight: 1.7, marginBottom: 10 }}>
                {last.sender === 'admin' ? 'أنت: ' : ''}{String(last.body).slice(0, 140)}
              </div>
            )}

            {expanded && (
              <div style={{ marginBottom: 10 }}>
                {(t.messages || []).map(m => (
                  <div key={m.id} style={{
                    background: m.sender === 'admin' ? `${P.green}0d` : 'var(--s2)',
                    border: `1px solid ${m.sender === 'admin' ? `${P.green}30` : 'var(--bd)'}`,
                    borderRadius: 10, padding: '9px 11px', marginBottom: 7,
                  }}>
                    <div style={{ fontSize: 10.5, fontWeight: 800, color: m.sender === 'admin' ? P.green : 'var(--mu2)', marginBottom: 3 }}>
                      {m.sender === 'admin' ? 'أنت' : (t.student_name || 'الطالب')} · {new Date(m.created_at).toLocaleString('ar-SA')}
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--tx)', lineHeight: 1.85, whiteSpace: 'pre-wrap' }}>{m.body}</div>
                  </div>
                ))}
                <ThreadReply thread={t} busy={busy === t.id} onSend={send} />
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={() => setOpenId(expanded ? null : t.id)} style={{ ...S.btn(P.blue2), flex: 1 }}>
                <Eye size={14} /> {expanded ? 'إخفاء' : `فتح المحادثة (${(t.messages || []).length})`}
              </button>
              {t.status === 'open' ? (
                <button onClick={() => mark(t, 'closed')} disabled={busy === t.id} style={{ ...S.btn(P.green), flex: 1 }}>
                  <CheckCircle size={14} /> إغلاق
                </button>
              ) : (
                <button onClick={() => mark(t, 'open')} disabled={busy === t.id} style={{ ...S.btn(P.gold), flex: 1 }}>
                  إعادة فتح
                </button>
              )}
              <button onClick={() => remove(t)} style={S.iconBtn(P.red)}><Trash2 size={14} /></button>
            </div>
          </div>
        )
      })}

      <div style={{ ...S.card, fontSize: 11.5, color: 'var(--mu)', lineHeight: 1.8 }}>
        ردّك يصل الطالب داخل الموقع في صندوق رسائله، ويستطيع أن يردّ عليك في المحادثة نفسها — لم يعد الردّ يحتاج بريداً ولا يغادر الموقع.
      </div>
    </div>
  )
}

/* ══════════════ AI SUBSCRIPTIONS + PAYMENT DETAILS ══════════════ */
/**
 * Two jobs in one tab, because they are the same job: what a student is told
 * to pay, and the requests that come back from telling them.
 *
 * The payment block is stored in site_content under "payment" and read
 * straight by the student's subscription sheet — nothing is hard-coded in the
 * app, so bank, name, IBAN, price and terms are all changed from here.
 */
/**
 * Defined at module level on purpose.
 *
 * It used to be declared inside SubscriptionsTab, which made it a brand-new
 * component type on every render: React then unmounted the old input and
 * mounted a fresh one for each keystroke, so the field lost focus after every
 * single character. Hoisting it keeps the element identity stable.
 */
function PayField({ label, k, value, onChange, placeholder, ltr, mono }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 11.5, color: 'var(--mu)', fontWeight: 700, marginBottom: 4 }}>{label}</div>
      <input value={value || ''} onChange={e => onChange(k, e.target.value)} placeholder={placeholder}
        style={{ ...S.input, direction: ltr ? 'ltr' : 'rtl', textAlign: ltr ? 'left' : 'right', fontFamily: mono ? 'monospace' : 'inherit' }} />
    </div>
  )
}

function SubscriptionsTab({ flash }) {
  const [pay, setPay] = useState({ title: '', price: '', bank: '', accountName: '', iban: '', terms: '', verifyNote: '' })
  const [savingPay, setSavingPay] = useState(false)
  // The prices of the assistant itself. Kept here rather than in the code
  // because the owner asked to be able to change them, and a number that
  // needs a deploy to adjust is a number nobody adjusts.
  const [pts, setPts] = useState({ free: 20, message: 1, image: 2 })
  const [savingPts, setSavingPts] = useState(false)
  const [items, setItems] = useState([])
  const [tableReady, setTableReady] = useState(true)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: subs }, { data: content }, { data: ptsRow }] = await Promise.all([
      apiJSON('/api/admin/subscriptions'),
      apiJSON('/api/admin/site-content?key=payment'),
      apiJSON('/api/admin/site-content?key=ai_points'),
    ])
    setItems(subs.requests || [])
    setTableReady(subs.tableReady !== false)
    if (content?.data && typeof content.data === 'object') setPay(p => ({ ...p, ...content.data }))
    if (ptsRow?.data && typeof ptsRow.data === 'object') setPts(p => ({ ...p, ...ptsRow.data }))
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  async function savePoints() {
    setSavingPts(true)
    const clean = {
      free: Math.max(0, Math.round(Number(pts.free) || 0)),
      message: Math.max(0, Math.round(Number(pts.message) || 0)),
      image: Math.max(0, Math.round(Number(pts.image) || 0)),
    }
    const { ok, data } = await apiJSON('/api/admin/site-content', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'ai_points', data: clean }),
    })
    setSavingPts(false)
    setPts(clean)
    flash(ok ? 'تم حفظ نقاط المساعد' : (data.error || 'تعذّر الحفظ'), ok ? 'success' : 'error')
  }

  async function savePayment() {
    setSavingPay(true)
    const { ok, data } = await apiJSON('/api/admin/site-content', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'payment', data: pay }),
    })
    setSavingPay(false)
    flash(ok ? 'تم حفظ بيانات الدفع' : (data.error || 'تعذّر الحفظ'), ok ? 'success' : 'error')
  }

  async function answer(req, status) {
    let days = 30
    if (status === 'approved') {
      const raw = window.prompt('مدة الاشتراك بالأيام:', '30')
      if (raw === null) return
      days = Math.min(365, Math.max(1, Number(raw) || 30))
    }
    const reply = window.prompt(status === 'approved' ? 'ردّك للطالب (اختياري):' : 'سبب الرفض (اختياري):')
    if (reply === null) return
    setBusy(req.id)
    const { ok, data } = await apiJSON('/api/admin/subscriptions', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: req.id, status, reply, days }),
    })
    setBusy(null)
    if (ok) { flash(status === 'approved' ? `فُعّل الاشتراك ${days} يوماً` : 'تم الرفض'); load() }
    else flash(data.error || 'تعذّر الحفظ', 'error')
  }

  async function remove(req) {
    if (!confirm('حذف هذا الطلب؟')) return
    await apiJSON('/api/admin/subscriptions', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: req.id }),
    })
    flash('تم الحذف'); load()
  }

  const statusMeta = {
    pending: { label: 'بانتظار الرد', color: P.gold },
    approved: { label: 'مفعّل', color: P.green },
    rejected: { label: 'مرفوض', color: P.red },
  }
  const pending = items.filter(r => r.status === 'pending').length
  const setField = (k, v) => setPay(p => ({ ...p, [k]: v }))

  return (
    <div>
      <SectionHeader title={`الاشتراكات${pending ? ` (${pending} بانتظارك)` : ''}`} onRefresh={load} />

      {!tableReady && (
        <div style={{ ...S.card, background: 'var(--warnBg)', border: '1px solid #c8a84b55', display: 'flex', gap: 10, fontSize: 12, color: 'var(--warnTx)', lineHeight: 1.7 }}>
          <AlertCircle size={16} color={P.gold} style={{ flexShrink: 0, marginTop: 2 }} />
          <div>لعرض الطلبات شغّل migration <strong>013_ai_subscriptions.sql</strong> في Supabase.</div>
        </div>
      )}

      <div style={S.card}>
        <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--tx)', marginBottom: 4 }}>نقاط المساعد الذكي</div>
        <div style={{ fontSize: 11.5, color: 'var(--mu)', lineHeight: 1.7, marginBottom: 12 }}>
          الطالب يبدأ كل مدة برصيد نقاط، وكل إجراء يخصم منه. الرصيد يتبع حسابه لا جهازه.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10, marginBottom: 12 }}>
          {[
            ['free', 'الرصيد المجاني'],
            ['message', 'سؤال عادي'],
            ['image', 'سؤال بصورة'],
          ].map(([k, label]) => (
            <div key={k}>
              <div style={{ fontSize: 11.5, color: 'var(--mu)', fontWeight: 700, marginBottom: 4 }}>{label}</div>
              <input type="number" min={0} value={pts[k]}
                onChange={e => setPts(p => ({ ...p, [k]: e.target.value }))}
                style={{
                  width: '100%', boxSizing: 'border-box', background: 'var(--bg)',
                  border: '1px solid var(--bd)', borderRadius: 10, padding: '9px 11px',
                  fontSize: 13, color: 'var(--tx)', fontFamily: 'inherit', direction: 'ltr',
                  textAlign: 'left', outline: 'none',
                }} />
            </div>
          ))}
        </div>
        <button onClick={savePoints} disabled={savingPts} style={{ ...S.btn(P.blue2), width: '100%' }}>
          <Save size={14} /> {savingPts ? 'جارٍ الحفظ…' : 'حفظ النقاط'}
        </button>
        <div style={{ fontSize: 11, color: 'var(--mu2)', lineHeight: 1.75, marginTop: 10 }}>
          مثال: رصيد {pts.free} يكفي {pts.message > 0 ? Math.floor(pts.free / pts.message) : '∞'} سؤالاً عادياً،
          أو {pts.image > 0 ? Math.floor(pts.free / pts.image) : '∞'} سؤالاً بصورة.
          <br />الاختبارات لا تُخصم من النقاط — لكل مستخدم اختبار تجريبي واحد ثم بالاشتراك.
        </div>
      </div>

      <div style={S.card}>
        <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--tx)', marginBottom: 4 }}>بيانات التحويل</div>
        <div style={{ fontSize: 11.5, color: 'var(--mu)', lineHeight: 1.7, marginBottom: 12 }}>
          يراها الطالب في صفحة الاشتراك. اتركها فارغة ولن تظهر بيانات مختلقة — ستظهر رسالة بأنها لم تُضبط بعد.
        </div>
        <PayField label="العنوان" k="title" value={pay.title} onChange={setField} placeholder="اشتراك المساعد الذكي" />
        <PayField label="المبلغ" k="price" value={pay.price} onChange={setField} placeholder="مثال: ٢٠ ريال / شهر" />
        <PayField label="البنك" k="bank" value={pay.bank} onChange={setField} placeholder="اسم البنك" />
        <PayField label="اسم الحساب" k="accountName" value={pay.accountName} onChange={setField} placeholder="الاسم كما يظهر في الحساب" />
        <PayField label="الآيبان" k="iban" value={pay.iban} onChange={setField} placeholder="SA00 0000 0000 0000 0000 0000" ltr mono />
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11.5, color: 'var(--mu)', fontWeight: 700, marginBottom: 4 }}>الشروط</div>
          <textarea value={pay.terms || ''} onChange={e => setPay(p => ({ ...p, terms: e.target.value }))} rows={3}
            placeholder="بعد التحويل أرفق صورة الإيصال…"
            style={{ ...S.input, resize: 'vertical', lineHeight: 1.8 }} />
        </div>
        <PayField label="مدة المراجعة المعلنة" k="verifyNote" value={pay.verifyNote} onChange={setField} placeholder="المراجعة يدوية — عادةً خلال ١٠ دقائق" />
        <button onClick={savePayment} disabled={savingPay} style={{ ...S.btn(P.blue2), width: '100%' }}>
          <CheckCircle size={14} /> {savingPay ? 'جارٍ الحفظ…' : 'حفظ بيانات الدفع'}
        </button>
      </div>

      {loading ? <Loader /> : items.length === 0 ? <Empty text="لا توجد طلبات اشتراك" /> : items.map(r => {
        const meta = statusMeta[r.status] || statusMeta.pending
        const expired = r.expires_at && new Date(r.expires_at).getTime() < Date.now()
        return (
          <div key={r.id} style={{ ...S.card, borderRight: `3px solid ${meta.color}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--tx)' }}>{r.student_name || '—'}</span>
              <span style={{ fontSize: 11.5, color: 'var(--mu)', fontFamily: 'monospace', direction: 'ltr' }}>{r.student_id}</span>
              <span style={{ fontSize: 10.5, fontWeight: 800, color: meta.color, background: `${meta.color}18`, borderRadius: 6, padding: '2px 8px' }}>
                {meta.label}{r.status === 'approved' && expired ? ' (منتهٍ)' : ''}
              </span>
              <span style={{ fontSize: 11, color: 'var(--mu)', marginRight: 'auto' }}>{fmtDate(r.created_at)}</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--mu2)', marginBottom: 6, direction: 'ltr', textAlign: 'right' }}>{r.email}</div>
            {r.note && <div style={{ fontSize: 12.5, color: 'var(--tx)', lineHeight: 1.8, background: 'var(--bg)', borderRadius: 10, padding: '10px 12px', marginBottom: 10 }}>{r.note}</div>}
            {r.receipt_url && (
              // Receipts are stored privately, so they open through the same
              // authorised proxy the course files use — the raw blob URL
              // returns 404 to a browser.
              <a href={`/api/download?url=${encodeURIComponent(r.receipt_url)}`} target="_blank" rel="noopener noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: P.blue2, textDecoration: 'none', marginBottom: 10, fontWeight: 700 }}>
                <FileText size={13} /> فتح الإيصال
              </a>
            )}
            {r.expires_at && (
              <div style={{ fontSize: 11.5, color: 'var(--mu)', marginBottom: 10 }}>ينتهي: {fmtDate(r.expires_at)}</div>
            )}
            {r.admin_reply && (
              <div style={{ fontSize: 12, color: 'var(--mu2)', lineHeight: 1.7, marginBottom: 10 }}>
                <strong style={{ color: 'var(--tx)' }}>ردّك:</strong> {r.admin_reply}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {r.status !== 'approved' && (
                <button onClick={() => answer(r, 'approved')} disabled={busy === r.id} style={{ ...S.btn(P.green), flex: 1 }}>
                  <CheckCircle size={14} /> تفعيل
                </button>
              )}
              {r.status !== 'rejected' && (
                <button onClick={() => answer(r, 'rejected')} disabled={busy === r.id} style={{ ...S.btn(P.red), flex: 1 }}>
                  {r.status === 'approved' ? 'إيقاف' : 'رفض'}
                </button>
              )}
              <button onClick={() => remove(r)} style={S.iconBtn(P.red)}><Trash2 size={14} /></button>
            </div>
          </div>
        )
      })}

      <div style={{ ...S.card, fontSize: 11.5, color: 'var(--mu)', lineHeight: 1.8 }}>
        التفعيل يمنح الجهاز أسئلة بلا حدّ حتى تاريخ الانتهاء، ثم يعود تلقائياً للحدّ المجاني — لا حاجة لإيقافه يدوياً. «إيقاف» يلغي الصلاحية فوراً.
      </div>
    </div>
  )
}

/* ══════════════ STUDENTS (sign-ups) ══════════════ */
function StudentsTab({ flash }) {
  const [students, setStudents] = useState([])
  const [tableReady, setTableReady] = useState(true)
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const { ok, data } = await apiJSON('/api/admin/students')
    if (ok) { setStudents(data.students || []); setTableReady(data.tableReady !== false) }
    else flash(data.error || 'تعذّر التحميل', 'error')
    setLoading(false)
  }, [flash])
  useEffect(() => { load() }, [load])

  async function remove(s) {
    if (!confirm(`حذف سجلّ "${s.full_name || 'بلا اسم'}"؟ سيتمكّن من اختيار مسار جديد.`)) return
    const { ok, data } = await apiJSON('/api/admin/students', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: s.device_id }),
    })
    if (ok) { flash('تم الحذف'); setStudents(xs => xs.filter(x => x.device_id !== s.device_id)) }
    else flash(data.error || 'فشل الحذف', 'error')
  }

  const filtered = students.filter(s => {
    if (!q.trim()) return true
    const v = q.trim().toLowerCase()
    return [s.full_name, s.student_id, s.email, s.track, s.plan]
      .some(f => (f || '').toLowerCase().includes(v))
  })
  const withEmail = students.filter(s => s.email).length

  return (
    <div>
      <SectionHeader title={`الطلاب (${students.length})`} onRefresh={load} />

      {!tableReady && (
        <div style={{ ...S.card, background: 'var(--warnBg)', border: '1px solid #c8a84b55', display: 'flex', gap: 10, fontSize: 12, color: 'var(--warnTx)', lineHeight: 1.7 }}>
          <AlertCircle size={16} color={P.gold} style={{ flexShrink: 0, marginTop: 2 }} />
          <div>لعرض الطلاب شغّل migration <strong>014_student_identities.sql</strong> في Supabase.</div>
        </div>
      )}

      {tableReady && (
        <div style={{ ...S.card, fontSize: 11.5, color: 'var(--mu)', lineHeight: 1.8 }}>
          يُسجَّل الطالب هنا تلقائياً عند حفظ ملفه — مرتبطاً بجهازه، لا بحساب.
          {withEmail > 0 && ` ${withEmail} منهم أدخلوا بريدهم عبر المساعد.`}
          {' '}الحذف يلغي تثبيت مساره ويسمح له باختيار مسار جديد فوراً.
        </div>
      )}

      <input value={q} onChange={e => setQ(e.target.value)} placeholder="بحث بالاسم أو الرقم الجامعي أو البريد..." style={{ ...S.input, marginBottom: 12 }} />

      {loading ? <Loader /> : filtered.length === 0 ? (
        <Empty text={students.length === 0 ? 'لا طلاب بعد — سيظهرون فور حفظ أول ملف شخصي' : 'لا نتائج للبحث'} />
      ) : filtered.map(s => {
        const days = s.confirmed_at
          ? Math.ceil((new Date(s.confirmed_at).getTime() + 15 * 86400000 - Date.now()) / 86400000) : 0
        return (
          <div key={s.device_id} style={{ ...S.card, display: 'flex', gap: 11, alignItems: 'flex-start' }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: `${P.blue2}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 15, fontWeight: 800, color: P.blue2 }}>
              {(s.full_name || '؟')[0]}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--tx)' }}>{s.full_name || '— بلا اسم —'}</span>
                {s.student_id && <span style={{ fontSize: 11.5, color: 'var(--mu)', fontFamily: 'monospace', direction: 'ltr' }}>{s.student_id}</span>}
                {days > 0 && (
                  <span style={{ fontSize: 10.5, fontWeight: 800, color: P.gold, background: `${P.gold}18`, borderRadius: 6, padding: '2px 7px' }}>
                    مسار مثبَّت {days} يوم
                  </span>
                )}
              </div>
              {s.email && <div style={{ fontSize: 11.5, color: P.blue2, direction: 'ltr', textAlign: 'right', marginTop: 3 }}>{s.email}</div>}
              <div style={{ fontSize: 11, color: 'var(--mu)', marginTop: 3 }}>
                {[s.track, s.college, s.plan].filter(Boolean).join(' — ') || 'بلا مسار'}
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--mu)', marginTop: 2 }}>
                آخر ظهور {fmtDate(s.last_seen)} · أول مرة {fmtDate(s.first_seen)}
              </div>
            </div>
            <button onClick={() => remove(s)} style={S.iconBtn(P.red)}><Trash2 size={14} /></button>
          </div>
        )
      })}
    </div>
  )
}

/* ══════════════ THEME ══════════════ */
function ThemeTab({ flash }) {
  const [preset, setPreset] = useState('green')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { ok, data } = await apiJSON('/api/admin/site-content?key=theme')
    if (ok && data.data?.preset) setPreset(data.data.preset)
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  async function save(id) {
    setSaving(true)
    setPreset(id)
    const { ok, data } = await apiJSON('/api/admin/site-content', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'theme', data: { preset: id } }),
    })
    setSaving(false)
    if (ok) flash('تم تطبيق الثيم — سيظهر للطلاب فوراً')
    else flash(data.error || 'فشل الحفظ', 'error')
  }

  if (loading) return <Loader />

  return (
    <div>
      <SectionHeader title="ثيم الموقع" onRefresh={load} />
      <div style={{ ...S.card }}>
        <p style={{ fontSize: 12.5, color: 'var(--mu)', lineHeight: 1.8, marginBottom: 14 }}>
          اختر لون هوية الموقع. يتغيّر لون الأزرار والأيقونات والهيدر وخلفيات الصفحات لكل الطلاب فورًا.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 12 }}>
          {THEME_PRESETS.map(p => {
            const active = preset === p.id
            return (
              <button key={p.id} onClick={() => save(p.id)} disabled={saving} style={{
                position: 'relative', display: 'flex', alignItems: 'center', gap: 10, padding: '14px 14px',
                borderRadius: 14, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'right',
                background: active ? `${p.sw}14` : 'var(--soft)',
                border: `2px solid ${active ? p.sw : 'var(--bd)'}`, color: 'var(--tx)',
              }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: `linear-gradient(135deg,${p.sw},${p.sw}bb)`, flexShrink: 0, boxShadow: `0 4px 12px ${p.sw}55` }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 800 }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--mu)' }}>{active ? 'مُطبّق حاليًا' : 'اضغط للتطبيق'}</div>
                </div>
                {active && <Check size={18} color={p.sw} />}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* ══════════════ USERS ══════════════ */
function UsersTab({ flash, adminEmail }) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const { ok, data } = await apiJSON('/api/admin/users')
    if (ok) setUsers(data.users || [])
    else flash(data.error || 'تعذّر التحميل', 'error')
    setLoading(false)
  }, [flash])
  useEffect(() => { load() }, [load])

  async function changeRole(u, role) {
    const { ok, data } = await apiJSON('/api/admin/users', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: u.id, role }) })
    if (ok) { flash('تم تحديث الصلاحية'); setUsers(us => us.map(x => x.id === u.id ? { ...x, role } : x)) }
    else flash(data.error || 'فشل التحديث', 'error')
  }

  const filtered = users.filter(u => {
    if (!q.trim()) return true
    const s = q.toLowerCase()
    return (u.full_name || '').toLowerCase().includes(s) || (u.email || '').toLowerCase().includes(s)
  })

  const roleBadge = { admin: { t: 'مسؤول', c: P.gold }, moderator: { t: 'مشرف', c: P.purple }, student: { t: 'طالب', c: 'var(--mu)' } }

  return (
    <div>
      <SectionHeader title={`المستخدمون (${users.length})`} onRefresh={load} />
      <input value={q} onChange={e => setQ(e.target.value)} placeholder="بحث بالاسم أو البريد..." style={{ ...S.input, marginBottom: 12 }} />
      {loading ? <Loader /> : filtered.length === 0 ? <Empty text="لا نتائج" /> : filtered.map(u => {
        const rb = roleBadge[u.role] || roleBadge.student
        return (
          <div key={u.id} style={rowStyle}>
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: `${rb.c}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 13, fontWeight: 800, color: rb.c }}>{(u.full_name || '؟')[0]}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={ellipsis}>{u.full_name || 'بدون اسم'}</div>
              <div style={{ fontSize: 12, color: 'var(--mu)', direction: 'ltr', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email || '—'}</div>
            </div>
            <select
              value={u.role || 'student'}
              onChange={e => changeRole(u, e.target.value)}
              disabled={u.email === adminEmail}
              title={u.email === adminEmail ? 'لا يمكنك تغيير صلاحيتك أنت' : ''}
              style={{ ...S.input, width: 'auto', padding: '6px 8px', fontSize: 13, opacity: u.email === adminEmail ? 0.6 : 1 }}>
              <option value="student">طالب</option>
              <option value="moderator">مشرف</option>
              <option value="admin">مسؤول</option>
            </select>
          </div>
        )
      })}
    </div>
  )
}

/* ══════════════ SHARED UI ══════════════ */
const rowStyle = { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--soft)', borderRadius: 11, border: '1px solid var(--bd)', marginBottom: 8 }
const ellipsis = { fontSize: 13, fontWeight: 700, color: 'var(--tx)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }

function SectionHeader({ title, onRefresh, action }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14, gap: 10 }}>
      <h2 style={{ fontSize: 16, fontWeight: 800, margin: 0, flex: 1 }}>{title}</h2>
      {action && <button onClick={action.onClick} style={S.btn(P.green)}><Plus size={14} /> {action.label}</button>}
      {onRefresh && <button onClick={onRefresh} style={S.iconBtn('#6b8c7d')}><RefreshCw size={15} /></button>}
    </div>
  )
}
function MiniStat({ label, value, Icon, color }) {
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--bd)', borderRadius: 12, padding: '12px', textAlign: 'center' }}>
      <Icon size={16} color={color} style={{ marginBottom: 5 }} />
      <div style={{ fontSize: 16, fontWeight: 900, color }}>{value}</div>
      <div style={{ fontSize: 11.5, color: 'var(--mu)' }}>{label}</div>
    </div>
  )
}
function Loader() {
  return <div style={{ textAlign: 'center', padding: 30, color: 'var(--mu)', fontSize: 13 }}><RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} /><div style={{ marginTop: 8 }}>جارٍ التحميل...</div></div>
}
function Empty({ text }) {
  return <div style={{ textAlign: 'center', padding: 30, color: 'var(--mu)', fontSize: 13 }}>{text}</div>
}
function Modal({ title, children, onClose, onSubmit }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--card)', borderRadius: '20px 20px 0 0', padding: 22, width: '100%', maxWidth: 480, maxHeight: '88vh', overflowY: 'auto', border: '1px solid var(--bd)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>{title}</h3>
          <button onClick={onClose} style={S.iconBtn('#6b8c7d')}><X size={16} /></button>
        </div>
        <form onSubmit={e => { e.preventDefault(); onSubmit() }}>
          {children}
          <button type="submit" style={{ ...S.btn(), width: '100%', marginTop: 16 }}>حفظ</button>
        </form>
      </div>
    </div>
  )
}
