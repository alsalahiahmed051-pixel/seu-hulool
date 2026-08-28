'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Upload, Trash2, FileText, CheckCircle, Eye, GraduationCap, AlertCircle,
  RefreshCw, LogOut, Lock, Database, HardDrive, Users, Bell, BookOpen,
  Building2, LayoutGrid, Plus, X, Edit3, Send, Shield, Activity, TrendingUp,
  Link2, Save,
} from 'lucide-react'

const P = {
  navy: '#001f5a', blue: '#0038b8', blue2: '#1a56db',
  gold: '#c8a84b', green: '#059669', red: '#dc2626', purple: '#7c3aed', orange: '#ea580c',
}

const TRACKS = [
  { id: 'preparatory', label: 'السنة التحضيرية' },
  { id: 'bachelor', label: 'بكالوريوس' },
  { id: 'diploma', label: 'دبلوم' },
  { id: 'graduate', label: 'دراسات عليا' },
]

const FILE_COURSES = [
  { group: 'السنة التحضيرية - خطة أ', items: ['حاسب', 'مهارات أكاديمية', 'إنجليزي'] },
  { group: 'السنة التحضيرية - خطة ب', items: ['رياضيات', 'مهارات اتصال', 'إنجليزي'] },
  { group: 'إدارة أعمال ومالية', items: ['إدارة أعمال', 'محاسبة', 'مالية', 'تجارة إلكترونية'] },
  { group: 'علوم نظرية', items: ['إعلام إلكتروني', 'قانون', 'لغة إنجليزية وترجمة', 'علوم إنسانية', 'علوم أساسية'] },
  { group: 'علوم صحية', items: ['معلوماتية صحية', 'صحة عامة', 'إدارة رعاية صحية'] },
  { group: 'حوسبة ومعلوماتية', items: ['تقنية معلومات', 'علوم حاسب'] },
]

const CATEGORIES = [
  { id: 'collections', label: 'تجميعات وملخصات' },
  { id: 'plans', label: 'الخطط الدراسية' },
  { id: 'curriculum', label: 'المقررات الدراسية' },
  { id: 'programs', label: 'البرامج والتخصصات' },
]

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
  input: { width: '100%', border: '1.5px solid #1c2e48', borderRadius: 10, padding: '9px 12px', fontSize: 13, background: '#0f1c33', color: '#e4ecf8', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', direction: 'rtl' },
  card: { background: '#0a1426', borderRadius: 18, padding: 20, border: '1px solid #1c2e48', marginBottom: 16 },
  label: { fontSize: 12, color: '#7d97b8', marginBottom: 5, display: 'block', fontWeight: 600 },
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
  { id: 'notifications', label: 'الإشعارات', Icon: Bell },
  { id: 'links', label: 'الروابط', Icon: Link2 },
  { id: 'users', label: 'المستخدمون', Icon: Users },
]

// Icon names the admin can assign to a link (must match LINK_ICONS in
// seu-portal-pro-v2.jsx). Stored as a name string in site_content.
const LINK_ICON_NAMES = [
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

  const page = { minHeight: '100vh', background: '#050a16', color: '#e4ecf8', fontFamily: "'Tajawal','Cairo',sans-serif", direction: 'rtl', padding: '16px 14px 40px' }

  return (
    <div style={page}>
      <div style={{ maxWidth: 860, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          <div style={{ width: 44, height: 44, borderRadius: 13, background: `linear-gradient(135deg,${P.navy},${P.blue})`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <GraduationCap size={22} color="#fff" />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h1 style={{ fontSize: 19, fontWeight: 900, margin: 0 }}>لوحة تحكم حلول</h1>
            <p style={{ fontSize: 11.5, color: '#7d97b8', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{adminName || adminEmail}</p>
          </div>
          {pinConfigured && (
            <button onClick={handleLock} title="قفل اللوحة" style={S.iconBtn('#7d97b8')}><Lock size={16} /></button>
          )}
          <button onClick={handleSignOut} title="تسجيل الخروج" style={S.iconBtn(P.red)}><LogOut size={16} /></button>
        </div>

        {!pinConfigured && (
          <div style={{ background: '#1c1608', border: '1px solid #c8a84b40', borderRadius: 12, padding: '12px 14px', marginBottom: 16, display: 'flex', gap: 10, fontSize: 12, color: '#e8d9a8', lineHeight: 1.7 }}>
            <Shield size={16} color={P.gold} style={{ flexShrink: 0, marginTop: 2 }} />
            <div>لتفعيل طبقة الحماية الإضافية (رمز PIN)، أضف متغيّر <strong style={{ color: P.gold }}>ADMIN_PIN</strong> في Vercel → Settings → Environment Variables (اختر رقماً سرياً)، ثم أعد النشر.</div>
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 18, overflowX: 'auto', paddingBottom: 4 }}>
          {TABS.map(({ id, label, Icon }) => (
            <button key={id} onClick={() => setTab(id)} style={{
              flexShrink: 0, padding: '8px 14px', borderRadius: 11,
              background: tab === id ? `linear-gradient(135deg,${P.blue},${P.blue2})` : '#0f1c33',
              border: `1px solid ${tab === id ? P.blue2 : '#1c2e48'}`,
              color: tab === id ? '#fff' : '#7d97b8', cursor: 'pointer', fontFamily: 'inherit',
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
        {tab === 'notifications' && <NotificationsTab flash={flash} />}
        {tab === 'links' && <LinksTab flash={flash} />}
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
          <div key={label} style={{ background: '#0a1426', border: '1px solid #1c2e48', borderRadius: 14, padding: '16px 14px', textAlign: 'center' }}>
            <Icon size={18} color={color} style={{ marginBottom: 8 }} />
            <div style={{ fontSize: 24, fontWeight: 900, color }}>{value ?? 0}</div>
            <div style={{ fontSize: 11, color: '#7d97b8', marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ══════════════ FILES ══════════════ */
function FilesTab({ flash }) {
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [blobEnabled, setBlobEnabled] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [course, setCourse] = useState('')
  const [category, setCategory] = useState('collections')
  const [displayName, setDisplayName] = useState('')
  const [selected, setSelected] = useState(null)
  const fileRef = useRef(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await apiJSON('/api/files')
    setFiles(data.files || [])
    setBlobEnabled(!!data.blobEnabled)
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  async function upload(e) {
    e.preventDefault()
    if (!selected || !course) return
    setUploading(true)
    const form = new FormData()
    form.append('file', selected)
    form.append('courseName', course)
    form.append('category', category)
    form.append('displayName', displayName || selected.name.replace(/\.pdf$/i, ''))
    const res = await fetch('/api/upload', { method: 'POST', body: form })
    const d = await res.json().catch(() => ({}))
    setUploading(false)
    if (d.ok) {
      flash('تم رفع الملف بنجاح')
      setSelected(null); setDisplayName('')
      if (fileRef.current) fileRef.current.value = ''
      load()
    } else flash(d.error || 'فشل الرفع', 'error')
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
        <div style={{ ...S.card, background: '#1c0a0a', border: '1px solid #dc262640', display: 'flex', gap: 10, fontSize: 12, color: '#f0a8a8', lineHeight: 1.7 }}>
          <AlertCircle size={16} color={P.red} style={{ flexShrink: 0, marginTop: 2 }} />
          <div>Vercel Blob غير مضبوط — أضف <strong>BLOB_READ_WRITE_TOKEN</strong> في Vercel لتفعيل رفع الملفات.</div>
        </div>
      )}

      {blobEnabled && (
        <form onSubmit={upload} style={S.card}>
          <h3 style={{ fontSize: 14, fontWeight: 800, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}><Upload size={15} color={P.blue2} /> رفع ملف جديد</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div>
              <label style={S.label}>المادة</label>
              <select value={course} onChange={e => setCourse(e.target.value)} required style={S.input}>
                <option value="">— اختر —</option>
                {FILE_COURSES.map(g => <optgroup key={g.group} label={g.group}>{g.items.map(i => <option key={i} value={i}>{i}</option>)}</optgroup>)}
              </select>
            </div>
            <div>
              <label style={S.label}>التصنيف</label>
              <select value={category} onChange={e => setCategory(e.target.value)} style={S.input}>
                {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
          </div>
          <label style={S.label}>اسم الملف (اختياري)</label>
          <input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="مثال: تجميع نهائي 1446" style={{ ...S.input, marginBottom: 10 }} />
          <div onClick={() => fileRef.current?.click()} style={{ border: '2px dashed #1c2e48', borderRadius: 10, padding: 16, textAlign: 'center', cursor: 'pointer', marginBottom: 12 }}>
            <input ref={fileRef} type="file" accept=".pdf,application/pdf" style={{ display: 'none' }} onChange={e => { setSelected(e.target.files[0]); setDisplayName(e.target.files[0]?.name?.replace(/\.pdf$/i, '') || '') }} />
            {selected ? (
              <div><CheckCircle size={22} color={P.green} /><div style={{ fontSize: 12, fontWeight: 700, marginTop: 4 }}>{selected.name}</div><div style={{ fontSize: 11, color: '#7d97b8' }}>{fmtSize(selected.size)}</div></div>
            ) : (
              <div><Upload size={22} color="#3a5270" /><div style={{ fontSize: 12, color: '#7d97b8', marginTop: 4 }}>اضغط لاختيار PDF (حد 20MB)</div></div>
            )}
          </div>
          <button type="submit" disabled={uploading || !selected || !course} style={{ ...S.btn(), width: '100%', opacity: (uploading || !selected || !course) ? 0.5 : 1 }}>
            {uploading ? <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> جارٍ الرفع...</> : <><Upload size={14} /> رفع الملف</>}
          </button>
        </form>
      )}

      <div style={S.card}>
        <h3 style={{ fontSize: 14, fontWeight: 800, marginBottom: 12 }}>الملفات المرفوعة ({files.length})</h3>
        {loading ? <Loader /> : files.length === 0 ? <Empty text="لا توجد ملفات بعد" /> : files.map(f => (
          <div key={f.id} style={rowStyle}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: `${P.blue2}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><FileText size={15} color={P.blue2} /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={ellipsis}>{f.name}</div>
              <div style={{ fontSize: 11, color: '#7d97b8' }}>{f.courseName} • {f.sizeLabel} • {fmtDate(f.uploadedAt)}</div>
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
            <div style={{ fontSize: 12, color: P.gold, fontWeight: 800, marginBottom: 6 }}>{tr.label}</div>
            {list.map(c => (
              <div key={c.id} style={rowStyle}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: `${c.color || P.blue2}22`, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={ellipsis}>{c.name_ar} {!c.is_active && <span style={{ fontSize: 10, color: P.red }}>(مخفية)</span>}</div>
                  <div style={{ fontSize: 11, color: '#7d97b8' }}>{c.college_id || '—'} • مشاهدات: {c.view_count || 0}</div>
                </div>
                <button onClick={() => toggleActive(c)} title={c.is_active ? 'إخفاء' : 'إظهار'} style={S.iconBtn(c.is_active ? P.green : '#7d97b8')}><Eye size={14} /></button>
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
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#e4ecf8', cursor: 'pointer' }}>
        <input type="checkbox" checked={f.is_active} onChange={e => set('is_active', e.target.checked)} /> ظاهرة للطلاب
      </label>
    </Modal>
  )
}

/* ══════════════ COLLEGES ══════════════ */
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
            <div style={{ fontSize: 11, color: '#7d97b8' }}>{c.id}</div>
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
  const [sending, setSending] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await apiJSON('/api/admin/notifications')
    setItems(data.notifications || [])
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  async function send(e) {
    e.preventDefault()
    if (!title.trim() || !body.trim()) return
    setSending(true)
    const { ok, data } = await apiJSON('/api/admin/notifications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, body, type }) })
    setSending(false)
    if (ok) { flash('تم بث الإشعار لكل الطلاب'); setTitle(''); setBody(''); load() }
    else flash(data.error || 'فشل الإرسال', 'error')
  }

  async function remove(n) {
    if (!confirm('حذف هذا الإشعار؟')) return
    await apiJSON('/api/admin/notifications', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: n.id }) })
    flash('تم الحذف'); load()
  }

  const typeColors = { info: P.blue2, announcement: P.gold, warning: P.orange, success: P.green }

  return (
    <div>
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
        <div style={{ fontSize: 11, color: '#7d97b8', marginBottom: 12, lineHeight: 1.6 }}>
          «إعلان» و«تنبيه» يظهران كشريط بارز أعلى الموقع لكل الطلاب (قابل للإغلاق)، بينما «معلومة» و«خبر جيد» تظهر فقط عند فتح زر الجرس.
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
              <div style={{ fontSize: 13, fontWeight: 700, color: '#e4ecf8' }}>{n.title}</div>
              <div style={{ fontSize: 11.5, color: '#9db0c8', lineHeight: 1.6 }}>{n.body}</div>
              <div style={{ fontSize: 10, color: '#7d97b8', marginTop: 2 }}>{fmtDate(n.created_at)}</div>
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
      <button onClick={resetDefaults} style={S.btn('#7d97b8')}><RefreshCw size={14} /> الافتراضي</button>
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
        <div key={gi} style={{ ...S.card, borderColor: '#26436e' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ width: 12, height: 12, borderRadius: 4, background: g.color || P.blue2, flexShrink: 0 }} />
            <h3 style={{ fontSize: 14, fontWeight: 800, margin: 0, flex: 1 }}>مجموعة {gi + 1}</h3>
            <button onClick={() => moveGroup(gi, -1)} disabled={gi === 0} title="لأعلى" style={{ ...S.iconBtn('#7d97b8'), opacity: gi === 0 ? 0.4 : 1 }}>▲</button>
            <button onClick={() => moveGroup(gi, 1)} disabled={gi === content.groups.length - 1} title="لأسفل" style={{ ...S.iconBtn('#7d97b8'), opacity: gi === content.groups.length - 1 ? 0.4 : 1 }}>▼</button>
            <button onClick={() => removeGroup(gi)} title="حذف المجموعة" style={S.iconBtn(P.red)}><Trash2 size={14} /></button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, marginBottom: 12 }}>
            <div><label style={S.label}>اسم المجموعة</label><input value={g.group} onChange={e => setGroup(gi, { group: e.target.value })} style={S.input} /></div>
            <div><label style={S.label}>اللون</label><input type="color" value={g.color || '#1a56db'} onChange={e => setGroup(gi, { color: e.target.value })} style={{ ...S.input, padding: 4, width: 52, height: 38 }} /></div>
          </div>

          {g.items.map((it, ii) => (
            <div key={ii} style={{ background: '#0f1c33', border: '1px solid #1c2e48', borderRadius: 11, padding: 12, marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#9db0c8', flex: 1 }}>رابط {ii + 1}</span>
                <button onClick={() => moveItem(gi, ii, -1)} disabled={ii === 0} style={{ ...S.iconBtn('#7d97b8'), opacity: ii === 0 ? 0.4 : 1 }}>▲</button>
                <button onClick={() => moveItem(gi, ii, 1)} disabled={ii === g.items.length - 1} style={{ ...S.iconBtn('#7d97b8'), opacity: ii === g.items.length - 1 ? 0.4 : 1 }}>▼</button>
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

  const roleBadge = { admin: { t: 'مسؤول', c: P.gold }, moderator: { t: 'مشرف', c: P.purple }, student: { t: 'طالب', c: '#7d97b8' } }

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
              <div style={{ fontSize: 11, color: '#7d97b8', direction: 'ltr', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email || '—'}</div>
            </div>
            <select
              value={u.role || 'student'}
              onChange={e => changeRole(u, e.target.value)}
              disabled={u.email === adminEmail}
              title={u.email === adminEmail ? 'لا يمكنك تغيير صلاحيتك أنت' : ''}
              style={{ ...S.input, width: 'auto', padding: '6px 8px', fontSize: 12, opacity: u.email === adminEmail ? 0.6 : 1 }}>
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
const rowStyle = { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: '#0f1c33', borderRadius: 11, border: '1px solid #1c2e48', marginBottom: 8 }
const ellipsis = { fontSize: 13, fontWeight: 700, color: '#e4ecf8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }

function SectionHeader({ title, onRefresh, action }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14, gap: 10 }}>
      <h2 style={{ fontSize: 16, fontWeight: 800, margin: 0, flex: 1 }}>{title}</h2>
      {action && <button onClick={action.onClick} style={S.btn(P.green)}><Plus size={14} /> {action.label}</button>}
      {onRefresh && <button onClick={onRefresh} style={S.iconBtn('#7d97b8')}><RefreshCw size={15} /></button>}
    </div>
  )
}
function MiniStat({ label, value, Icon, color }) {
  return (
    <div style={{ background: '#0a1426', border: '1px solid #1c2e48', borderRadius: 12, padding: '12px', textAlign: 'center' }}>
      <Icon size={16} color={color} style={{ marginBottom: 5 }} />
      <div style={{ fontSize: 16, fontWeight: 900, color }}>{value}</div>
      <div style={{ fontSize: 10.5, color: '#7d97b8' }}>{label}</div>
    </div>
  )
}
function Loader() {
  return <div style={{ textAlign: 'center', padding: 30, color: '#7d97b8', fontSize: 13 }}><RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} /><div style={{ marginTop: 8 }}>جارٍ التحميل...</div></div>
}
function Empty({ text }) {
  return <div style={{ textAlign: 'center', padding: 30, color: '#7d97b8', fontSize: 13 }}>{text}</div>
}
function Modal({ title, children, onClose, onSubmit }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#0a1426', borderRadius: '20px 20px 0 0', padding: 22, width: '100%', maxWidth: 480, maxHeight: '88vh', overflowY: 'auto', border: '1px solid #1c2e48' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>{title}</h3>
          <button onClick={onClose} style={S.iconBtn('#7d97b8')}><X size={16} /></button>
        </div>
        <form onSubmit={e => { e.preventDefault(); onSubmit() }}>
          {children}
          <button type="submit" style={{ ...S.btn(), width: '100%', marginTop: 16 }}>حفظ</button>
        </form>
      </div>
    </div>
  )
}
