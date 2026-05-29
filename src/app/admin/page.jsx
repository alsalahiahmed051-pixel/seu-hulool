'use client'
import { useState, useEffect, useRef } from 'react'
import {
  Upload, Trash2, FileText, CheckCircle, X, Eye,
  Download, Lock, GraduationCap, AlertCircle, RefreshCw,
  Database, HardDrive
} from 'lucide-react'

const P = {
  navy: "#001f5a", blue: "#0038b8", blue2: "#1a56db",
  gold: "#c8a84b", green: "#059669", red: "#dc2626",
}

const ALL_COURSES = [
  { group: "السنة التحضيرية - خطة أ", items: ["حاسب", "مهارات أكاديمية", "إنجليزي"] },
  { group: "السنة التحضيرية - خطة ب", items: ["رياضيات", "مهارات اتصال", "إنجليزي"] },
  { group: "إدارة أعمال ومالية", items: ["إدارة أعمال", "محاسبة", "مالية", "تجارة إلكترونية"] },
  { group: "علوم نظرية", items: ["إعلام إلكتروني", "قانون", "لغة إنجليزية وترجمة", "علوم إنسانية", "علوم أساسية"] },
  { group: "علوم صحية", items: ["معلوماتية صحية", "صحة عامة", "إدارة رعاية صحية"] },
  { group: "حوسبة ومعلوماتية", items: ["تقنية معلومات", "علوم حاسب"] },
  { group: "دبلوم", items: ["دبلوم التسويق والمبيعات", "دبلوم المحاسبة التطبيقي", "دبلوم تقنية المعلومات", "دبلوم الإدارة المكتبية", "دبلوم اللغة الإنجليزية للأعمال", "دبلوم السكرتارية التنفيذية"] },
  { group: "دراسات عليا", items: ["ماجستير إدارة الأعمال (MBA)", "ماجستير المحاسبة المهنية", "ماجستير القانون", "ماجستير تقنية المعلومات", "ماجستير علوم الحاسب", "ماجستير المعلوماتية الصحية", "ماجستير الصحة العامة", "ماجستير تنفيذي في الجودة", "ماجستير الإعلام الإلكتروني"] },
]

const CATEGORIES = [
  { id: "collections", label: "تجميعات وملخصات" },
  { id: "plans", label: "الخطط الدراسية" },
  { id: "curriculum", label: "المقررات الدراسية" },
  { id: "programs", label: "البرامج والتخصصات" },
]

function formatSize(bytes) {
  if (!bytes) return '—'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' })
  } catch { return iso }
}

export default function AdminPage() {
  const [authed, setAuthed] = useState(false)
  const [secret, setSecret] = useState('')
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState(null)
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(false)
  const [blobEnabled, setBlobEnabled] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState(null)
  const [course, setCourse] = useState('')
  const [category, setCategory] = useState('collections')
  const [displayName, setDisplayName] = useState('')
  const [selectedFile, setSelectedFile] = useState(null)
  const fileRef = useRef(null)

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? sessionStorage.getItem('admin_secret') : null
    if (saved) { setSecret(saved); setAuthed(true); loadFiles(saved) }
  }, [])

  async function handleLogin(e) {
    e.preventDefault()
    setAuthError(null)
    const res = await fetch('/api/files', { headers: { 'x-admin-secret': password } })
    if (res.status === 401) { setAuthError('كلمة المرور غير صحيحة'); return }
    const data = await res.json()
    sessionStorage.setItem('admin_secret', password)
    setSecret(password)
    setAuthed(true)
    setFiles(data.files || [])
    setBlobEnabled(data.blobEnabled)
  }

  async function loadFiles(sec) {
    setLoading(true)
    const res = await fetch('/api/files', { headers: { 'x-admin-secret': sec || secret } })
    const data = await res.json()
    setFiles(data.files || [])
    setBlobEnabled(data.blobEnabled)
    setLoading(false)
  }

  async function handleUpload(e) {
    e.preventDefault()
    if (!selectedFile || !course) return
    setUploading(true)
    setUploadMsg(null)
    const form = new FormData()
    form.append('file', selectedFile)
    form.append('courseName', course)
    form.append('category', category)
    form.append('displayName', displayName || selectedFile.name.replace('.pdf', '').replace('.PDF', ''))

    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'x-admin-secret': secret },
      body: form,
    })
    const data = await res.json()
    setUploading(false)
    if (data.ok) {
      setUploadMsg({ type: 'success', text: 'تم رفع الملف بنجاح ✓' })
      setSelectedFile(null)
      setDisplayName('')
      if (fileRef.current) fileRef.current.value = ''
      await loadFiles(secret)
    } else {
      setUploadMsg({ type: 'error', text: data.error || 'فشل الرفع' })
    }
  }

  async function handleDelete(file) {
    if (!confirm(`حذف "${file.name}"؟`)) return
    await fetch('/api/files', {
      method: 'DELETE',
      headers: { 'x-admin-secret': secret, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: file.id, blobUrl: file.blobUrl }),
    })
    await loadFiles(secret)
  }

  const s = {
    page: { minHeight: '100vh', background: '#050a16', color: '#e4ecf8', fontFamily: "'Tajawal','Cairo',sans-serif", direction: 'rtl', padding: 20 },
    card: { background: '#0a1426', borderRadius: 20, padding: 24, border: '1px solid #1c2e48', marginBottom: 20 },
    input: { width: '100%', border: '1.5px solid #1c2e48', borderRadius: 12, padding: '10px 14px', fontSize: 14, background: '#0f1c33', color: '#e4ecf8', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', direction: 'rtl' },
    btn: (color = P.blue2) => ({ padding: '10px 20px', borderRadius: 12, border: 'none', background: `linear-gradient(135deg,${color},${color}cc)`, color: '#fff', fontSize: 14, fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer' }),
    label: { fontSize: 12, color: '#7d97b8', marginBottom: 6, display: 'block', fontWeight: 600 },
  }

  if (!authed) return (
    <div style={{ ...s.page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ width: 60, height: 60, borderRadius: 18, background: `linear-gradient(135deg,${P.navy},${P.blue})`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <Lock size={26} color="#fff" />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 900, marginBottom: 6 }}>لوحة تحكم حلول</h1>
          <p style={{ fontSize: 13, color: '#7d97b8' }}>أدخل كلمة مرور المسؤول للمتابعة</p>
        </div>
        <form onSubmit={handleLogin}>
          <input type="password" placeholder="كلمة المرور" value={password} onChange={e => setPassword(e.target.value)}
            style={{ ...s.input, marginBottom: 12 }} required />
          {authError && <div style={{ color: P.red, fontSize: 13, marginBottom: 10, textAlign: 'center' }}>{authError}</div>}
          <button type="submit" style={{ ...s.btn(), width: '100%' }}>دخول</button>
        </form>
      </div>
    </div>
  )

  const totalSize = files.reduce((a, f) => a + (f.size || 0), 0)

  return (
    <div style={s.page}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
          <div style={{ width: 46, height: 46, borderRadius: 14, background: `linear-gradient(135deg,${P.navy},${P.blue})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <GraduationCap size={22} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 900, margin: 0 }}>لوحة تحكم حلول</h1>
            <p style={{ fontSize: 12, color: '#7d97b8', margin: 0 }}>إدارة ملفات الجامعة السعودية الإلكترونية</p>
          </div>
          <button onClick={() => loadFiles()} style={{ marginRight: 'auto', background: '#1c2e48', border: 'none', borderRadius: 10, padding: 8, cursor: 'pointer', color: '#7d97b8', display: 'flex' }}>
            <RefreshCw size={16} />
          </button>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'إجمالي الملفات', value: files.length, Icon: Database, color: P.blue2 },
            { label: 'حجم التخزين', value: formatSize(totalSize), Icon: HardDrive, color: P.gold },
            { label: 'حالة Blob', value: blobEnabled ? 'مفعّل' : 'غير مفعّل', Icon: CheckCircle, color: blobEnabled ? P.green : P.red },
          ].map(({ label, value, Icon, color }) => (
            <div key={label} style={{ background: '#0a1426', border: '1px solid #1c2e48', borderRadius: 14, padding: '14px 16px', textAlign: 'center' }}>
              <Icon size={18} color={color} style={{ marginBottom: 6 }} />
              <div style={{ fontSize: 18, fontWeight: 900, color }}>{value}</div>
              <div style={{ fontSize: 11, color: '#7d97b8' }}>{label}</div>
            </div>
          ))}
        </div>

        {!blobEnabled && (
          <div style={{ background: '#1c0a0a', border: '1px solid #dc262640', borderRadius: 14, padding: 16, marginBottom: 20, display: 'flex', gap: 12 }}>
            <AlertCircle size={18} color={P.red} style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: P.red, marginBottom: 4 }}>Vercel Blob غير مضبوط</div>
              <div style={{ fontSize: 12, color: '#9ca3af', lineHeight: 1.7 }}>
                لتفعيل رفع الملفات الحقيقية:<br />
                1. اذهب إلى <strong style={{ color: '#60a5fa' }}>Vercel Dashboard → Storage → Create Database → Blob</strong><br />
                2. انسخ <strong style={{ color: '#60a5fa' }}>BLOB_READ_WRITE_TOKEN</strong> وأضفه في Environment Variables<br />
                3. أعد النشر
              </div>
            </div>
          </div>
        )}

        {/* Upload Form */}
        {blobEnabled && (
          <div style={s.card}>
            <h2 style={{ fontSize: 16, fontWeight: 800, marginBottom: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Upload size={16} color={P.blue2} /> رفع ملف جديد
            </h2>
            <form onSubmit={handleUpload}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={s.label}>المادة / البرنامج</label>
                  <select value={course} onChange={e => setCourse(e.target.value)} required
                    style={{ ...s.input }}>
                    <option value="">— اختر المادة —</option>
                    {ALL_COURSES.map(g => (
                      <optgroup key={g.group} label={g.group}>
                        {g.items.map(item => <option key={item} value={item}>{item}</option>)}
                      </optgroup>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={s.label}>التصنيف</label>
                  <select value={category} onChange={e => setCategory(e.target.value)} style={{ ...s.input }}>
                    {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={s.label}>اسم الملف (اختياري)</label>
                <input value={displayName} onChange={e => setDisplayName(e.target.value)}
                  placeholder="مثال: تجميع نهاية الفصل الثاني 1446" style={{ ...s.input }} />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={s.label}>ملف PDF (حد 20 MB)</label>
                <div style={{ border: '2px dashed #1c2e48', borderRadius: 12, padding: 20, textAlign: 'center', cursor: 'pointer', background: selectedFile ? `${P.blue2}08` : 'transparent', transition: 'all .2s' }}
                  onClick={() => fileRef.current?.click()}>
                  <input ref={fileRef} type="file" accept=".pdf,application/pdf" style={{ display: 'none' }}
                    onChange={e => { setSelectedFile(e.target.files[0]); setDisplayName(e.target.files[0]?.name?.replace(/\.pdf$/i, '') || '') }} />
                  {selectedFile ? (
                    <div>
                      <CheckCircle size={24} color={P.green} style={{ marginBottom: 6 }} />
                      <div style={{ fontSize: 13, color: '#e4ecf8', fontWeight: 700 }}>{selectedFile.name}</div>
                      <div style={{ fontSize: 11, color: '#7d97b8' }}>{formatSize(selectedFile.size)}</div>
                    </div>
                  ) : (
                    <div>
                      <Upload size={24} color="#3a5270" style={{ marginBottom: 6 }} />
                      <div style={{ fontSize: 13, color: '#7d97b8' }}>اضغط لاختيار PDF</div>
                    </div>
                  )}
                </div>
              </div>
              {uploadMsg && (
                <div style={{ padding: '10px 14px', borderRadius: 10, marginBottom: 12, fontSize: 13, fontWeight: 700, background: uploadMsg.type === 'success' ? `${P.green}15` : `${P.red}15`, color: uploadMsg.type === 'success' ? P.green : P.red, border: `1px solid ${uploadMsg.type === 'success' ? P.green : P.red}40` }}>
                  {uploadMsg.text}
                </div>
              )}
              <button type="submit" disabled={uploading || !selectedFile || !course}
                style={{ ...s.btn(), opacity: (uploading || !selectedFile || !course) ? .5 : 1, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                {uploading ? <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> جارٍ الرفع...</> : <><Upload size={14} /> رفع الملف</>}
              </button>
            </form>
          </div>
        )}

        {/* File list */}
        <div style={s.card}>
          <h2 style={{ fontSize: 16, fontWeight: 800, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileText size={16} color={P.blue2} /> الملفات المرفوعة ({files.length})
          </h2>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 30, color: '#7d97b8' }}>جارٍ التحميل...</div>
          ) : files.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 30, color: '#7d97b8' }}>لا توجد ملفات مرفوعة بعد</div>
          ) : (
            files.map(f => (
              <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: '#0f1c33', borderRadius: 12, border: '1px solid #1c2e48', marginBottom: 8 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: `${P.blue2}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <FileText size={16} color={P.blue2} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#e4ecf8', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</div>
                  <div style={{ fontSize: 11, color: '#7d97b8' }}>{f.courseName} • {CATEGORIES.find(c => c.id === f.category)?.label} • {f.sizeLabel} • {formatDate(f.uploadedAt)}</div>
                </div>
                <a href={f.url} target="_blank" rel="noopener noreferrer"
                  style={{ background: `${P.blue2}15`, border: 'none', borderRadius: 8, padding: 7, cursor: 'pointer', color: P.blue2, display: 'flex', textDecoration: 'none' }}>
                  <Eye size={14} />
                </a>
                <button onClick={() => handleDelete(f)}
                  style={{ background: `${P.red}15`, border: 'none', borderRadius: 8, padding: 7, cursor: 'pointer', color: P.red, display: 'flex' }}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
