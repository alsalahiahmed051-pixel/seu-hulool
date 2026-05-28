'use client'
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  Home, Search, Star, Calculator, Bell, Moon, Sun, ChevronRight,
  ChevronDown, Book, FileText, MessageCircle, Phone, Play, Pause,
  RotateCcw, Award, TrendingUp, Users, CheckCircle, X, Plus,
  Minus, Calendar, ArrowLeft, GraduationCap, Eye, Download,
  Bookmark, Zap, BarChart2, BookOpen, AlarmClock, Monitor,
  Briefcase, Globe, Code, Trophy, Flag, Coffee, Target,
  Heart, Clock, Layers, Activity, Wifi, Settings, User,
  Volume2, VolumeX, Flame, Edit3, Check, Trash2, Save,
  Sparkles, Lock, Send, ChevronLeft, Share2, History,
  PenLine, Compass, Lightbulb, Shield, ArrowUpRight, Hash,
  ExternalLink, Link2, GraduationCap as GradCap, Mail, Library,
  CreditCard, HelpCircle, Newspaper, Radio, Building2
} from "lucide-react";

/* ══════════════════════════════════════════════════════════════
   PERSISTENT STORAGE — safe localStorage with in-memory fallback
   ══════════════════════════════════════════════════════════════ */
const STORE_KEY = "seu_hulool_v2";
const memCache = {};
const storage = {
  get(key, fallback) {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        const raw = window.localStorage.getItem(STORE_KEY);
        const data = raw ? JSON.parse(raw) : {};
        return key in data ? data[key] : fallback;
      }
    } catch (e) {}
    return key in memCache ? memCache[key] : fallback;
  },
  set(key, value) {
    memCache[key] = value;
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        const raw = window.localStorage.getItem(STORE_KEY);
        const data = raw ? JSON.parse(raw) : {};
        data[key] = value;
        window.localStorage.setItem(STORE_KEY, JSON.stringify(data));
      }
    } catch (e) {}
  },
  clear() {
    Object.keys(memCache).forEach(k => delete memCache[k]);
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.removeItem(STORE_KEY);
      }
    } catch (e) {}
  },
};

function useStored(key, initial) {
  const [val, setVal] = useState(() => storage.get(key, initial));
  useEffect(() => { storage.set(key, val); }, [key, val]);
  return [val, setVal];
}

/* ══════════════════════════════════════════════════════════════
   DESIGN TOKENS
   ══════════════════════════════════════════════════════════════ */
const P = {
  navy: "#001f5a", navyDeep: "#000b24",
  blue: "#0038b8", blue2: "#1a56db", blueLight: "#60a5fa",
  gold: "#c8a84b", goldLight: "#fef3c7", goldRich: "#d4af37",
  green: "#059669", greenLight: "#10b981",
  red: "#dc2626", orange: "#d97706", orangeLight: "#fb923c",
  purple: "#6d28d9", purpleLight: "#a78bfa",
  cyan: "#0891b2", pink: "#db2777",
};

const T = (d) => ({
  bg: d ? "#050a16" : "#eef3ff",
  bgMesh: d
    ? "radial-gradient(ellipse 70% 50% at 50% -10%, rgba(26,86,219,0.20) 0%, transparent 60%), radial-gradient(ellipse 50% 40% at 0% 100%, rgba(200,168,75,0.08) 0%, transparent 50%), radial-gradient(ellipse 50% 40% at 100% 60%, rgba(109,40,217,0.06) 0%, transparent 50%), #050a16"
    : "radial-gradient(ellipse 70% 50% at 50% -10%, rgba(26,86,219,0.12) 0%, transparent 60%), radial-gradient(ellipse 50% 40% at 100% 100%, rgba(200,168,75,0.08) 0%, transparent 50%), #eef3ff",
  s1: d ? "#0a1426" : "#ffffff",
  s2: d ? "#0f1c33" : "#f5f8ff",
  s3: d ? "#15243f" : "#eaf0ff",
  s4: d ? "#1e3055" : "#dde6f7",
  bd: d ? "#1c2e48" : "#d8e3f5",
  tx: d ? "#e4ecf8" : "#0a1428",
  mu: d ? "#7d97b8" : "#5a6e8a",
  dim: d ? "#3a5270" : "#9aaac0",
  sh: d ? "0 8px 40px rgba(0,0,0,.55), 0 2px 10px rgba(0,0,0,.3)" : "0 8px 40px rgba(0,50,140,.10), 0 2px 10px rgba(0,50,140,.05)",
  shSm: d ? "0 4px 16px rgba(0,0,0,.4)" : "0 4px 16px rgba(0,50,140,.07)",
  grad: d ? `linear-gradient(135deg,#0c1829,#162540)` : `linear-gradient(135deg,#f5f8ff,#eaf0ff)`,
  hero: d
    ? `linear-gradient(135deg, #001030 0%, #002470 45%, #1a1f7a 100%)`
    : `linear-gradient(135deg, #001f5a 0%, #003299 55%, #1a56db 100%)`,
});

/* ══════════════════════════════════════════════════════════════
   DATA
   ══════════════════════════════════════════════════════════════ */
const ICON_MAP = {
  "حاسب": Monitor, "مهارات أكاديمية": BookOpen, "إنجليزي": Globe, "رياضيات": Calculator,
  "مهارات اتصال": MessageCircle, "إدارة أعمال": Briefcase, "محاسبة": BarChart2,
  "مالية": TrendingUp, "تجارة إلكترونية": Zap, "إعلام إلكتروني": Wifi, "قانون": Flag,
  "لغة إنجليزية وترجمة": Globe, "علوم إنسانية": Award, "علوم أساسية": Activity,
  "معلوماتية صحية": Monitor, "صحة عامة": Heart, "إدارة رعاية صحية": Users,
  "ماجستير تنفيذي": Trophy, "تقنية معلومات": Code, "علوم حاسب": Monitor,
  "برامج تطبيقية متنوعة": Layers,
};
const getIcon = (name) => ICON_MAP[name] || BookOpen;

const TREE = {
  preparatory: {
    label: "السنة الأولى المشتركة (CFY)", icon: GraduationCap, color: P.blue2,
    plans: {
      a: { label: "الفصل الأول", subjects: ["مهارات اللغة الإنجليزية 1", "مهارات الحاسب", "مهارات أكاديمية"] },
      b: { label: "الفصل الثاني", subjects: ["مهارات اللغة الإنجليزية 2", "الرياضيات", "مهارات الاتصال والتواصل"] },
    },
  },
  bachelor: {
    label: "بكالوريوس", icon: Award, color: P.purple,
    colleges: [
      { id: "admin", label: "العلوم الإدارية والمالية", icon: Briefcase, color: "#1d4ed8", programs: ["إدارة أعمال", "محاسبة", "تمويل", "تجارة إلكترونية"] },
      { id: "theory", label: "العلوم والدراسات النظرية", icon: BookOpen, color: "#0369a1", programs: ["إعلام رقمي", "قانون", "لغة إنجليزية وترجمة"] },
      { id: "health", label: "العلوم الصحية", icon: Heart, color: "#be123c", programs: ["معلوماتية صحية", "صحة عامة"] },
      { id: "cs", label: "الحوسبة والمعلوماتية", icon: Code, color: "#065f46", programs: ["تقنية معلومات", "علوم حاسب", "علوم البيانات"] },
      { id: "applied", label: "الكلية التطبيقية", icon: Layers, color: "#92400e", programs: ["برامج الكلية التطبيقية"] },
    ],
  },
  diploma: {
    label: "دبلوم", icon: FileText, color: P.green,
    programs: ["دبلوم إدارة الأعمال", "دبلوم المحاسبة", "دبلوم تقنية المعلومات", "دبلوم اللغة الإنجليزية للأعمال"],
  },
  graduate: {
    label: "دراسات عليا", icon: Trophy, color: P.gold,
    programs: ["ماجستير إدارة الأعمال (MBA)", "ماجستير المحاسبة المهنية", "ماجستير القانون", "ماجستير تقنية المعلومات", "ماجستير علوم الحاسب", "ماجستير المعلوماتية الصحية", "ماجستير الصحة العامة", "ماجستير الإعلام الرقمي"],
  },
};

const ALL_COURSES = (() => {
  const out = new Set();
  Object.values(TREE.preparatory.plans).forEach(p => p.subjects.forEach(s => out.add(s)));
  TREE.bachelor.colleges.forEach(c => c.programs.forEach(p => out.add(p)));
  TREE.diploma.programs.forEach(p => out.add(p));
  TREE.graduate.programs.forEach(p => out.add(p));
  return [...out];
})();

const TIPS = [
  "راجع ملاحظاتك يومياً بدلاً من الدراسة المكثفة قبل الاختبار",
  "استخدم تقنية بومودورو: 25 دقيقة دراسة ثم 5 دقائق راحة",
  "اشرح المادة لشخص آخر — أفضل طريقة لترسيخ الفهم",
  "حوّل ملاحظاتك إلى خرائط ذهنية لتسهيل المراجعة",
  "ابدأ بالأسئلة السهلة في الاختبار لبناء الثقة",
  "النوم الكافي ليلة الاختبار يرفع الأداء أكثر من المذاكرة المتأخرة",
  "اشرب الماء بانتظام أثناء الدراسة — الجفاف يقلّل التركيز",
  "خصّص مكاناً ثابتاً للدراسة — يساعد دماغك على الدخول في وضع التركيز سريعاً",
];

const NOTIFS_SEED = [
  { id: 1, title: "تجميعات جديدة", text: "رُفعت تجميعات فاينل لمادة إدارة الأعمال ف2 1447", time: "منذ 5 دقائق", read: false, Icon: Book },
  { id: 2, title: "تحديث الخطة الدراسية", text: "تم تحديث خطة السنة الأولى المشتركة (CFY) للفصل الثاني", time: "منذ ساعة", read: false, Icon: FileText },
  { id: 3, title: "إعلان الاختبارات", text: "جداول الاختبارات النهائية ف2 1447 متاحة على Blackboard", time: "منذ يومين", read: true, Icon: Calendar },
  { id: 4, title: "ملخص شامل", text: "ملخص وحدات 1-6 لمادة مهارات الاتصال والتواصل", time: "منذ 3 أيام", read: true, Icon: Star },
];

const FILES = {
  collections: (s) => [
    { name: `تجميع نهاية الفصل الثاني 1445 – ${s}`, sz: "2.4 MB", views: 2180, dl: 843, date: "1445/08/12", r: 4.9 },
    { name: `بنك أسئلة مع الإجابات النموذجية – ${s}`, sz: "3.1 MB", views: 3540, dl: 1421, date: "1445/07/20", r: 5.0 },
    { name: `تجميع ميدترم الفصل الأول 1444 – ${s}`, sz: "1.8 MB", views: 1205, dl: 490, date: "1444/12/18", r: 4.7 },
    { name: `ملخص شامل للوحدات 1-6 – ${s}`, sz: "4.0 MB", views: 2870, dl: 1103, date: "1445/06/30", r: 4.8 },
  ],
  plans: (s) => [
    { name: `الخطة الدراسية الكاملة الفصل الثاني 1445 – ${s}`, sz: "0.9 MB", views: 960, dl: 380, date: "1445/06/01", r: 4.6 },
    { name: `جدول الوحدات والمحاضرات – ${s}`, sz: "0.5 MB", views: 720, dl: 290, date: "1445/06/01", r: 4.5 },
    { name: `توصيف المقرر الرسمي – ${s}`, sz: "1.2 MB", views: 540, dl: 210, date: "1445/05/15", r: 4.7 },
  ],
  curriculum: (s) => [
    { name: `محتوى المقرر الكامل – ${s}`, sz: "8.5 MB", views: 1830, dl: 720, date: "1445/06/05", r: 4.8 },
    { name: `وحدة 1 – ${s} (المحاضرات والشرائح)`, sz: "2.1 MB", views: 2410, dl: 960, date: "1445/06/08", r: 4.9 },
    { name: `وحدة 2 – ${s} (تطبيقات وأنشطة)`, sz: "1.9 MB", views: 1980, dl: 810, date: "1445/06/15", r: 4.7 },
    { name: `نموذج مشروع نهاية الفصل – ${s}`, sz: "0.7 MB", views: 1120, dl: 540, date: "1445/06/20", r: 4.6 },
  ],
  programs: (s) => [
    { name: `نظرة عامة على برنامج ${s}`, sz: "1.4 MB", views: 880, dl: 260, date: "1445/04/10", r: 4.5 },
    { name: `دليل شروط القبول والتسجيل – ${s}`, sz: "0.8 MB", views: 1340, dl: 440, date: "1445/04/10", r: 4.6 },
    { name: `جدول الرسوم الدراسية 1445-1446`, sz: "0.3 MB", views: 2100, dl: 800, date: "1445/05/01", r: 4.4 },
  ],
};

const SECTIONS = [
  { id: "collections", Icon: Bookmark, label: "تجميعات وملخصات", color: "#1d4ed8", desc: "تجميعات الاختبارات والملخصات الشاملة" },
  { id: "plans", Icon: Calendar, label: "الخطط الدراسية", color: "#6d28d9", desc: "الخطة الكاملة وجدول الوحدات والتوصيف" },
  { id: "curriculum", Icon: Layers, label: "المقررات الدراسية", color: "#065f46", desc: "المحتوى الكامل والواجبات والمشاريع" },
  { id: "programs", Icon: Award, label: "البرامج والتخصصات", color: "#b45309", desc: "نظرة عامة وشروط القبول والرسوم" },
  { id: "flashcards", Icon: Hash, label: "بطاقات تعليمية", color: "#0891b2", desc: "أنشئ بطاقات سؤال وجواب للمراجعة" },
  { id: "notes", Icon: PenLine, label: "ملاحظاتي الشخصية", color: "#6d28d9", desc: "اكتب ملاحظاتك الخاصة عن هذه المادة" },
  { id: "ai", Icon: Sparkles, label: "اسأل الذكاء الاصطناعي", color: P.blue2, desc: "مساعد ذكي يجيب عن أي سؤال" },
  { id: "support", Icon: Phone, label: "الدعم الفني", color: "#be123c", desc: "تواصل معنا وروابط الدعم الرسمية" },
];

const GRADE_SCALE = [
  { label: "A+", min: 95, pts: 5.00, color: "#059669" }, { label: "A", min: 90, pts: 4.75, color: "#059669" },
  { label: "B+", min: 85, pts: 4.50, color: "#0369a1" }, { label: "B", min: 80, pts: 4.00, color: "#0369a1" },
  { label: "C+", min: 75, pts: 3.50, color: "#d97706" }, { label: "C", min: 70, pts: 3.00, color: "#d97706" },
  { label: "D+", min: 65, pts: 2.50, color: "#ea580c" }, { label: "D", min: 60, pts: 2.00, color: "#ea580c" },
  { label: "F", min: 0, pts: 0.00, color: "#dc2626" },
];
const scoreToGrade = (s) => GRADE_SCALE.find(g => s >= g.min) || GRADE_SCALE[GRADE_SCALE.length - 1];

const ACHIEVEMENTS = [
  { id: "first_visit", title: "بداية الرحلة", desc: "افتح أول مادة", icon: Compass, color: P.blue2, check: (s) => (s.viewed?.length || 0) >= 1 },
  { id: "explorer", title: "المستكشف", desc: "افتح 5 مواد", icon: Globe, color: P.purple, check: (s) => (s.viewed?.length || 0) >= 5 },
  { id: "bookworm", title: "عاشق الكتب", desc: "افتح 15 مادة", icon: BookOpen, color: P.green, check: (s) => (s.viewed?.length || 0) >= 15 },
  { id: "collector", title: "المجمّع", desc: "أضف 5 مواد للمفضلة", icon: Star, color: P.gold, check: (s) => (s.favorites?.length || 0) >= 5 },
  { id: "focused", title: "التركيز", desc: "أكمل 5 جلسات بومودورو", icon: Target, color: P.red, check: (s) => (s.totalSessions || 0) >= 5 },
  { id: "dedicated", title: "المثابر", desc: "أكمل 25 جلسة بومودورو", icon: Flame, color: P.orange, check: (s) => (s.totalSessions || 0) >= 25 },
  { id: "marathon", title: "الماراثون", desc: "أكمل 100 جلسة بومودورو", icon: Trophy, color: P.gold, check: (s) => (s.totalSessions || 0) >= 100 },
  { id: "calc_pro", title: "الحاسب الذكي", desc: "احسب معدلك 5 مرات", icon: Calculator, color: P.cyan, check: (s) => (s.gpaCalcs || 0) >= 5 },
  { id: "streak3", title: "3 أيام متتالية", desc: "حافظ على سلسلة 3 أيام", icon: Flame, color: P.orangeLight, check: (s) => (s.streak || 0) >= 3 },
  { id: "streak7", title: "أسبوع كامل", desc: "حافظ على سلسلة 7 أيام", icon: Flame, color: P.red, check: (s) => (s.streak || 0) >= 7 },
  { id: "note_taker", title: "كاتب الملاحظات", desc: "أضف ملاحظة لمادة", icon: PenLine, color: P.purple, check: (s) => Object.keys(s.notes || {}).length >= 1 },
  { id: "ai_friend", title: "صديق الذكاء", desc: "تحدث مع المساعد الذكي", icon: Sparkles, color: P.blueLight, check: (s) => (s.aiChats || 0) >= 1 },
];

/* ══════════════════════════════════════════════════════════════
   UTILITIES
   ══════════════════════════════════════════════════════════════ */
const fmt = (n) => n >= 1000 ? (n / 1000).toFixed(1) + "K" : n;
const todayKey = () => new Date().toISOString().slice(0, 10);
const last7Days = () => {
  const out = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
};

function useCountUp(target, dur = 1200) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let start = 0, step = target / 60, raf;
    const run = () => {
      start = Math.min(start + step, target); setV(Math.floor(start));
      if (start < target) raf = requestAnimationFrame(run);
    };
    raf = requestAnimationFrame(run);
    return () => cancelAnimationFrame(raf);
  }, [target, dur]);
  return v;
}

function playBell() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type = "sine"; o.frequency.value = 880;
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.2);
    o.start(); o.stop(ctx.currentTime + 1.3);
    setTimeout(() => ctx.close(), 1500);
  } catch (e) {}
}

/* ══════════════════════════════════════════════════════════════
   TOAST SYSTEM
   ══════════════════════════════════════════════════════════════ */
function useToasts() {
  const [list, setList] = useState([]);
  const push = useCallback((msg, kind = "info") => {
    const id = Date.now() + Math.random();
    setList(l => [...l, { id, msg, kind }]);
    setTimeout(() => setList(l => l.filter(t => t.id !== id)), 3000);
  }, []);
  return { list, push };
}

function ToastStack({ list }) {
  return (
    <div style={{
      position: "fixed", bottom: 90, left: 0, right: 0, zIndex: 300,
      display: "flex", flexDirection: "column", alignItems: "center", gap: 8, pointerEvents: "none"
    }}>
      {list.map(t => {
        const colors = { info: P.blue2, success: P.green, warn: P.orange, error: P.red };
        const Icon = t.kind === "success" ? CheckCircle : t.kind === "error" ? X : t.kind === "warn" ? Lightbulb : Bell;
        return (
          <div key={t.id} style={{
            background: "rgba(15,28,51,.96)", color: "#fff", padding: "10px 18px",
            borderRadius: 24, fontSize: 13, fontWeight: 600, boxShadow: "0 8px 30px rgba(0,0,0,.4)",
            border: `1px solid ${colors[t.kind]}50`, display: "flex", alignItems: "center", gap: 8,
            animation: "toastIn .25s ease", backdropFilter: "blur(12px)",
          }}>
            <Icon size={15} color={colors[t.kind]} />
            <span>{t.msg}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   REUSABLE COMPONENTS
   ══════════════════════════════════════════════════════════════ */
function Btn({ children, onClick, variant = "primary", size = "md", style = {}, disabled }) {
  const base = { border: "none", cursor: disabled ? "not-allowed" : "pointer", fontFamily: "inherit", fontWeight: 700, transition: "all .2s", display: "flex", alignItems: "center", gap: 6, justifyContent: "center" };
  const variants = {
    primary: { background: `linear-gradient(135deg,${P.blue},${P.blue2})`, color: "#fff", boxShadow: `0 4px 16px ${P.blue}50` },
    ghost: { background: "transparent", color: P.blue2, border: `1.5px solid ${P.blue2}40` },
    gold: { background: `linear-gradient(135deg,${P.gold},#e8bf5c)`, color: "#fff", boxShadow: `0 4px 16px ${P.gold}40` },
    danger: { background: "#dc2626", color: "#fff" },
    soft: { background: "rgba(26,86,219,.12)", color: P.blue2 },
  };
  const sizes = {
    sm: { padding: "6px 14px", borderRadius: 20, fontSize: 12 },
    md: { padding: "10px 20px", borderRadius: 24, fontSize: 14 },
    lg: { padding: "14px 32px", borderRadius: 28, fontSize: 16 },
  };
  return (
    <button onClick={onClick} disabled={disabled} style={{ ...base, ...variants[variant], ...sizes[size], ...style }}
      onMouseEnter={e => !disabled && (e.currentTarget.style.filter = "brightness(1.1)")}
      onMouseLeave={e => (e.currentTarget.style.filter = "brightness(1)")}>{children}</button>
  );
}

function StatCard({ Icon, value, suffix = "", label, color, t }) {
  const v = useCountUp(value);
  return (
    <div style={{
      background: t.s1, borderRadius: 16, padding: "16px 14px", border: `1px solid ${t.bd}`,
      boxShadow: t.shSm, textAlign: "center", position: "relative", overflow: "hidden",
    }}>
      <div style={{ position: "absolute", top: -20, right: -20, width: 60, height: 60, borderRadius: "50%", background: `${color}10` }} />
      <div style={{ width: 40, height: 40, borderRadius: 12, background: `${color}18`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 10px", position: "relative" }}>
        <Icon size={20} color={color} strokeWidth={2.5} />
      </div>
      <div style={{ fontSize: 22, fontWeight: 900, color: color, letterSpacing: -0.5, position: "relative" }}>{v.toLocaleString()}{suffix}</div>
      <div style={{ fontSize: 11, color: t.mu, marginTop: 4, fontWeight: 500, position: "relative" }}>{label}</div>
    </div>
  );
}

function FileItem({ name, sz, views, dl, date, r, t, onToast }) {
  const [dlAnim, setDlAnim] = useState(false);
  return (
    <div style={{
      background: t.s2, borderRadius: 12, padding: "12px 14px", border: `1px solid ${t.bd}`,
      display: "flex", flexDirection: "column", gap: 8, cursor: "pointer", transition: "all .2s",
    }}
      onMouseEnter={e => e.currentTarget.style.borderColor = P.blue2 + "60"}
      onMouseLeave={e => e.currentTarget.style.borderColor = t.bd}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: `${P.blue}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>
          <FileText size={16} color={P.blue2} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: t.tx, lineHeight: 1.5, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{name}</div>
          <div style={{ fontSize: 11, color: t.mu, marginTop: 3 }}>PDF • {sz} • {date}</div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: t.mu }}><Eye size={11} /> {fmt(views)}</span>
        <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: t.mu }}><Download size={11} /> {fmt(dl)}</span>
        <div style={{ display: "flex", gap: 2, marginRight: "auto" }}>
          {[1, 2, 3, 4, 5].map(i => <span key={i} style={{ fontSize: 10, color: i <= Math.round(r) ? P.gold : "#ccc" }}>★</span>)}
        </div>
        <button
          onClick={() => { setDlAnim(true); onToast?.("بدأ التحميل…", "success"); setTimeout(() => setDlAnim(false), 1500); }}
          style={{
            background: dlAnim ? `${P.green}20` : `${P.blue}15`, border: "none", borderRadius: 8,
            padding: "5px 10px", cursor: "pointer", fontSize: 11, fontWeight: 700,
            color: dlAnim ? P.green : P.blue2, display: "flex", alignItems: "center", gap: 4, transition: "all .3s",
          }}>
          <Download size={11} />{dlAnim ? "✓ تم" : "تحميل"}
        </button>
      </div>
    </div>
  );
}

function EmptyState({ Icon, title, desc, action, t }) {
  return (
    <div style={{ textAlign: "center", padding: "50px 20px", animation: "fadeUp .4s ease" }}>
      <div style={{
        width: 72, height: 72, borderRadius: "50%", background: t.s2, display: "flex",
        alignItems: "center", justifyContent: "center", margin: "0 auto 16px", border: `1px solid ${t.bd}`,
      }}>
        <Icon size={30} color={t.dim} />
      </div>
      <h3 style={{ color: t.tx, fontSize: 17, fontWeight: 700, marginBottom: 8 }}>{title}</h3>
      <p style={{ color: t.mu, fontSize: 13, lineHeight: 1.7, marginBottom: action ? 16 : 0 }}>{desc}</p>
      {action}
    </div>
  );
}

function ConfirmDialog({ open, title, desc, onConfirm, onClose, danger, t }) {
  if (!open) return null;
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 250,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
      backdropFilter: "blur(4px)", animation: "fadeIn .2s ease",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: t.s1, borderRadius: 20, padding: 24, maxWidth: 360, width: "100%",
        border: `1px solid ${t.bd}`, boxShadow: t.sh, animation: "scaleIn .25s ease",
      }}>
        <div style={{ width: 48, height: 48, borderRadius: 14, background: `${danger ? P.red : P.blue2}15`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
          {danger ? <Trash2 size={22} color={P.red} /> : <Shield size={22} color={P.blue2} />}
        </div>
        <h3 style={{ fontSize: 17, fontWeight: 800, color: t.tx, marginBottom: 6 }}>{title}</h3>
        <p style={{ fontSize: 13, color: t.mu, lineHeight: 1.7, marginBottom: 18 }}>{desc}</p>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn variant="ghost" onClick={onClose} style={{ flex: 1 }}>إلغاء</Btn>
          <Btn variant={danger ? "danger" : "primary"} onClick={() => { onConfirm(); onClose(); }} style={{ flex: 1 }}>تأكيد</Btn>
        </div>
      </div>
    </div>
  );
}

function StreakWeek({ activeDays, t }) {
  const days = last7Days();
  const labels = ["أحد", "اثن", "ثلا", "أرب", "خمي", "جمع", "سبت"];
  return (
    <div style={{ display: "flex", gap: 6, justifyContent: "space-between" }}>
      {days.map((d) => {
        const isToday = d === todayKey();
        const active = activeDays.includes(d);
        const dow = new Date(d).getDay();
        return (
          <div key={d} style={{ textAlign: "center", flex: 1 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10, margin: "0 auto",
              background: active ? `linear-gradient(135deg,${P.orange},${P.orangeLight})` : t.s3,
              border: isToday ? `2px solid ${P.gold}` : `1px solid ${t.bd}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: active ? `0 4px 12px ${P.orange}40` : "none", transition: "all .3s",
            }}>
              {active && <Flame size={15} color="#fff" />}
            </div>
            <div style={{ fontSize: 9, color: isToday ? P.gold : t.mu, marginTop: 4, fontWeight: isToday ? 700 : 500 }}>{labels[dow]}</div>
          </div>
        );
      })}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   AI CHAT
   ══════════════════════════════════════════════════════════════ */
function AIChat({ subject, t, onChat }) {
  const [msgs, setMsgs] = useState([
    { r: "a", text: `مرحباً! أنا مساعدك الذكي لمادة **${subject}**.\nاسألني عن الاختبارات، الواجبات، المعدل، المحاضرات، أو أي شيء آخر.` }
  ]);
  const [inp, setInp] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);

  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), [msgs]);

  const suggestions = ["كيف أستعد للاختبار النهائي؟", "ما هي الوحدات المهمة؟", "كيف يُحتسب المعدل؟", "ما نوع الأسئلة في الميدترم؟"];

  const send = async (q) => {
    const text = (q || inp).trim();
    if (!text || loading) return;
    setInp("");
    const newMsgs = [...msgs, { r: "u", text }];
    setMsgs(newMsgs);
    setLoading(true);
    onChat?.();
    try {
      const history = newMsgs.slice(1).map(m => ({ role: m.r === "u" ? "user" : "assistant", content: m.text }));
      const res = await fetch("/api/ai", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, messages: history }),
      });
      const d = await res.json();
      setMsgs(m => [...m, { r: "a", text: d.text || d.error || "عذراً، حدث خطأ. حاول مجدداً." }]);
    } catch {
      setMsgs(m => [...m, { r: "a", text: "⚠️ تعذّر الاتصال — تحقق من الشبكة وأعد المحاولة." }]);
    }
    setLoading(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: 480, borderRadius: 20, overflow: "hidden", border: `1px solid ${t.bd}`, boxShadow: t.sh }}>
      <div style={{ background: `linear-gradient(135deg,${P.navy},${P.blue})`, padding: "14px 18px", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
        <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(255,255,255,.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Sparkles size={20} color={P.gold} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ color: "#fff", fontWeight: 800, fontSize: 14 }}>مساعد {subject} الذكي</div>
          <div style={{ color: P.gold, fontSize: 11, display: "flex", alignItems: "center", gap: 4, marginTop: 1 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ade80", boxShadow: "0 0 6px #4ade80", display: "inline-block" }} />
            متصل الآن
          </div>
        </div>
        <div style={{ background: "rgba(255,255,255,.1)", borderRadius: 8, padding: "4px 10px", fontSize: 10, color: "rgba(255,255,255,.7)" }}>Claude AI</div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 12, background: t.s1 }}>
        {msgs.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: m.r === "u" ? "flex-start" : "flex-end", animation: "fadeUp .3s ease" }}>
            {m.r === "a" && <div style={{ width: 28, height: 28, borderRadius: "50%", background: `${P.blue}20`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginLeft: 8 }}>
              <Sparkles size={13} color={P.blue2} /></div>}
            <div style={{
              maxWidth: "82%", padding: "10px 14px", lineHeight: 1.75, fontSize: 13.5,
              borderRadius: m.r === "u" ? "18px 4px 18px 18px" : "4px 18px 18px 18px",
              background: m.r === "u" ? `linear-gradient(135deg,${P.blue},${P.blue2})` : `${t.s3}`,
              color: m.r === "u" ? "#fff" : t.tx, boxShadow: t.shSm, whiteSpace: "pre-wrap",
              border: `1px solid ${m.r === "u" ? "transparent" : t.bd}`,
            }}>
              {m.text.split("**").map((p, j) => j % 2 === 1 ? <strong key={j}>{p}</strong> : p)}
            </div>
          </div>
        ))}
        {loading && <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <div style={{ background: t.s3, border: `1px solid ${t.bd}`, padding: "12px 16px", borderRadius: "4px 18px 18px 18px", display: "flex", gap: 5, alignItems: "center" }}>
            {[0, 1, 2].map(i => <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: P.blue2, animation: `bounce .9s ${i * .15}s infinite` }} />)}
          </div>
        </div>}
        <div ref={endRef} />
      </div>

      {msgs.length <= 2 && <div style={{ padding: "0 12px 10px", display: "flex", gap: 6, flexWrap: "wrap", background: t.s1 }}>
        {suggestions.map((s, i) => (
          <button key={i} onClick={() => send(s)} style={{
            background: t.s2, border: `1px solid ${t.bd}`, borderRadius: 20,
            padding: "5px 12px", fontSize: 11, color: t.mu, cursor: "pointer",
            fontFamily: "inherit", transition: "all .2s",
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = P.blue2; e.currentTarget.style.color = P.blue2; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = t.bd; e.currentTarget.style.color = t.mu; }}>
            {s}
          </button>
        ))}
      </div>}

      <div style={{ padding: 12, background: t.s1, borderTop: `1px solid ${t.bd}`, display: "flex", gap: 8, flexShrink: 0 }}>
        <input value={inp} onChange={e => setInp(e.target.value)} onKeyDown={e => e.key === "Enter" && send()}
          placeholder={`اسأل عن ${subject}...`} style={{
            flex: 1, border: `1.5px solid ${t.bd}`, borderRadius: 24, padding: "10px 16px",
            fontSize: 13.5, outline: "none", direction: "rtl", fontFamily: "inherit",
            color: t.tx, background: t.s2, transition: "border-color .2s",
          }}
          onFocus={e => e.target.style.borderColor = P.blue2} onBlur={e => e.target.style.borderColor = t.bd} />
        <button onClick={() => send()} disabled={loading || !inp.trim()} style={{
          background: loading || !inp.trim() ? "#ccc" : `linear-gradient(135deg,${P.blue},${P.blue2})`,
          border: "none", borderRadius: 24, padding: "10px 18px", cursor: "pointer",
          color: "#fff", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6,
          fontSize: 13, fontWeight: 700, transition: "all .2s",
        }}>
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   NOTES EDITOR (per course)
   ══════════════════════════════════════════════════════════════ */
function NotesEditor({ subject, notes, setNotes, t, onToast }) {
  const [text, setText] = useState(notes[subject] || "");
  const [saved, setSaved] = useState(false);
  useEffect(() => { setText(notes[subject] || ""); setSaved(false); }, [subject]);

  const save = () => {
    setNotes(prev => ({ ...prev, [subject]: text }));
    setSaved(true);
    onToast?.("تم حفظ ملاحظاتك", "success");
    setTimeout(() => setSaved(false), 2000);
  };
  const clear = () => {
    setText("");
    setNotes(prev => { const c = { ...prev }; delete c[subject]; return c; });
    onToast?.("تم مسح الملاحظات", "info");
  };

  return (
    <div>
      <textarea
        value={text} onChange={e => setText(e.target.value)}
        placeholder={`اكتب ملاحظاتك عن مادة ${subject}…`}
        style={{
          width: "100%", minHeight: 160, border: `1.5px solid ${t.bd}`, borderRadius: 14,
          padding: "12px 14px", fontSize: 13.5, color: t.tx, background: t.s2,
          fontFamily: "inherit", direction: "rtl", outline: "none", resize: "vertical", lineHeight: 1.8,
          boxSizing: "border-box", transition: "border-color .2s",
        }}
        onFocus={e => e.target.style.borderColor = P.blue2}
        onBlur={e => e.target.style.borderColor = t.bd} />
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <Btn variant="primary" size="sm" onClick={save} style={{ flex: 1 }}>
          {saved ? <><Check size={14} /> محفوظ</> : <><Save size={14} /> حفظ</>}
        </Btn>
        {text && <Btn variant="ghost" size="sm" onClick={clear}>
          <Trash2 size={13} /> مسح
        </Btn>}
      </div>
      <div style={{ fontSize: 11, color: t.dim, marginTop: 8, textAlign: "center" }}>
        {text.length} حرف • ملاحظاتك محفوظة محلياً
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   GPA CALCULATOR (with saved semesters + target calculator)
   ══════════════════════════════════════════════════════════════ */
function GPACalc({ t, onCalc, semesters, setSemesters, onToast }) {
  const [courses, setCourses] = useState(() => storage.get("gpaCourses", [
    { name: "مادة 1", score: 85, hrs: 3 }, { name: "مادة 2", score: 90, hrs: 3 }, { name: "مادة 3", score: 75, hrs: 2 },
  ]));
  const [showTarget, setShowTarget] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [targetGPA, setTargetGPA] = useState(4.5);
  const [extraHrs, setExtraHrs] = useState(12);

  useEffect(() => { storage.set("gpaCourses", courses); onCalc?.(); }, [courses]);

  const addCourse = () => setCourses(c => [...c, { name: `مادة ${c.length + 1}`, score: 80, hrs: 3 }]);
  const removeCourse = (i) => setCourses(c => c.filter((_, j) => j !== i));
  const update = (i, k, v) => setCourses(c => c.map((x, j) => j === i ? { ...x, [k]: v } : x));

  const totalHrs = courses.reduce((a, c) => a + c.hrs, 0);
  const totalPts = courses.reduce((a, c) => a + (scoreToGrade(c.score).pts * c.hrs), 0);
  const gpa = totalHrs > 0 ? (totalPts / totalHrs).toFixed(2) : "0.00";
  const gpaColor = gpa >= 4.5 ? "#059669" : gpa >= 3.5 ? "#0369a1" : gpa >= 2.5 ? "#d97706" : "#dc2626";

  const targetPts = targetGPA * (totalHrs + extraHrs);
  const neededPts = targetPts - totalPts;
  const neededAvgPoint = extraHrs > 0 ? neededPts / extraHrs : 0;
  const neededGrade = GRADE_SCALE.find(g => g.pts <= neededAvgPoint) || GRADE_SCALE[0];
  const achievable = neededAvgPoint <= 5.00 && neededAvgPoint >= 0;

  const saveSemester = () => {
    const name = `الفصل ${semesters.length + 1}`;
    setSemesters([...semesters, { name, courses, gpa, totalHrs, date: new Date().toLocaleDateString("ar-SA") }]);
    onToast?.(`تم حفظ ${name}`, "success");
  };
  const loadSemester = (sem) => { setCourses(sem.courses); setShowSaved(false); onToast?.(`تم تحميل ${sem.name}`, "info"); };
  const deleteSemester = (i) => setSemesters(s => s.filter((_, j) => j !== i));

  return (
    <div style={{ animation: "fadeUp .4s ease" }}>
      <div style={{
        background: `linear-gradient(135deg,${P.navy},${P.blue})`, borderRadius: 20,
        padding: "24px", marginBottom: 16, textAlign: "center", position: "relative", overflow: "hidden",
      }}>
        <div style={{ position: "absolute", top: -40, left: -40, width: 160, height: 160, borderRadius: "50%", background: `${gpaColor}20` }} />
        <div style={{ position: "relative" }}>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,.6)", marginBottom: 4 }}>معدلك التراكمي</div>
          <div style={{ fontSize: 56, fontWeight: 900, color: gpaColor, textShadow: `0 0 30px ${gpaColor}60`, lineHeight: 1 }}>{gpa}</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,.5)", marginTop: 4 }}>من 5.00 • {totalHrs} ساعة</div>
          <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
            {GRADE_SCALE.map(g => (
              <div key={g.label} style={{ background: `${g.color}25`, border: `1px solid ${g.color}40`, borderRadius: 8, padding: "3px 8px", fontSize: 10, color: "#fff", fontWeight: 700 }}>
                {g.label}: {g.pts.toFixed(2)}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <Btn variant="soft" size="sm" onClick={() => setShowTarget(s => !s)} style={{ flex: 1 }}>
          <Target size={13} /> هدف
        </Btn>
        <Btn variant="soft" size="sm" onClick={saveSemester} style={{ flex: 1 }}>
          <Save size={13} /> حفظ الفصل
        </Btn>
        <Btn variant="soft" size="sm" onClick={() => setShowSaved(s => !s)} style={{ flex: 1 }}>
          <History size={13} /> محفوظ ({semesters.length})
        </Btn>
      </div>

      {showTarget && (
        <div style={{
          background: t.s1, borderRadius: 16, padding: 16, marginBottom: 16,
          border: `1.5px solid ${P.gold}40`, animation: "fadeUp .3s ease",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <Target size={16} color={P.gold} />
            <div style={{ fontSize: 13, fontWeight: 800, color: t.tx }}>حاسبة المعدل المستهدف</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: t.mu, marginBottom: 4 }}>المعدل المستهدف</div>
              <input type="number" step="0.1" min="0" max="5" value={targetGPA}
                onChange={e => setTargetGPA(+e.target.value)}
                style={{ width: "100%", border: `1px solid ${t.bd}`, borderRadius: 8, padding: "8px 10px", fontSize: 13, background: t.s2, color: t.tx, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: t.mu, marginBottom: 4 }}>الساعات القادمة</div>
              <input type="number" min="1" max="60" value={extraHrs}
                onChange={e => setExtraHrs(+e.target.value)}
                style={{ width: "100%", border: `1px solid ${t.bd}`, borderRadius: 8, padding: "8px 10px", fontSize: 13, background: t.s2, color: t.tx, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
            </div>
          </div>
          <div style={{
            background: achievable ? `${P.green}15` : `${P.red}15`, borderRadius: 12, padding: 12,
            border: `1px solid ${achievable ? P.green : P.red}40`, textAlign: "center",
          }}>
            {achievable ? (
              <>
                <div style={{ fontSize: 12, color: P.green, fontWeight: 700, marginBottom: 4 }}>✓ ممكن تحقيقه</div>
                <div style={{ fontSize: 13, color: t.tx, lineHeight: 1.7 }}>
                  تحتاج معدل تقديري <strong style={{ color: neededGrade.color }}>{neededGrade.label}</strong>
                  {" "}({neededAvgPoint.toFixed(2)} من 5.00) في الـ {extraHrs} ساعة القادمة
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 12, color: P.red, fontWeight: 700, marginBottom: 4 }}>⚠️ غير قابل للتحقيق</div>
                <div style={{ fontSize: 12, color: t.mu, lineHeight: 1.6 }}>
                  جرّب رفع عدد الساعات أو خفّض المعدل المستهدف
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {showSaved && (
        <div style={{ background: t.s1, borderRadius: 16, padding: 12, marginBottom: 16, border: `1px solid ${t.bd}`, animation: "fadeUp .3s ease" }}>
          {semesters.length === 0 ? (
            <div style={{ textAlign: "center", padding: "20px 10px", color: t.mu, fontSize: 13 }}>
              لا توجد فصول محفوظة بعد
            </div>
          ) : semesters.map((sem, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
              borderRadius: 10, background: t.s2, marginBottom: 6,
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: t.tx }}>{sem.name}</div>
                <div style={{ fontSize: 11, color: t.mu }}>{sem.date} • {sem.totalHrs} ساعة</div>
              </div>
              <div style={{ fontSize: 16, fontWeight: 900, color: P.blue2, minWidth: 50, textAlign: "center" }}>{sem.gpa}</div>
              <button onClick={() => loadSemester(sem)} style={{ background: `${P.blue2}15`, border: "none", borderRadius: 8, padding: "5px 10px", cursor: "pointer", color: P.blue2, fontSize: 11, fontWeight: 700, fontFamily: "inherit" }}>تحميل</button>
              <button onClick={() => deleteSemester(i)} style={{ background: `${P.red}15`, border: "none", borderRadius: 8, padding: 6, cursor: "pointer", display: "flex", color: P.red }}><X size={12} /></button>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
        {courses.map((c, i) => {
          const g = scoreToGrade(c.score);
          return (
            <div key={i} style={{ background: t.s1, borderRadius: 14, padding: "14px", border: `1px solid ${t.bd}`, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input value={c.name} onChange={e => update(i, "name", e.target.value)}
                  style={{ flex: 1, border: `1px solid ${t.bd}`, borderRadius: 8, padding: "7px 10px", fontSize: 13, background: t.s2, color: t.tx, fontFamily: "inherit", direction: "rtl", outline: "none" }} />
                <div style={{ background: `${g.color}20`, borderRadius: 8, padding: "4px 10px", fontSize: 12, fontWeight: 800, color: g.color, minWidth: 36, textAlign: "center" }}>{g.label}</div>
                <button onClick={() => removeCourse(i)} style={{ background: "#dc262615", border: "none", borderRadius: 8, padding: 6, cursor: "pointer", color: "#dc2626", display: "flex" }}>
                  <X size={14} />
                </button>
              </div>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: t.mu, marginBottom: 4 }}>الدرجة: {c.score}</div>
                  <input type="range" min={0} max={100} value={c.score}
                    onChange={e => update(i, "score", +e.target.value)}
                    style={{ width: "100%", accentColor: g.color }} />
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 11, color: t.mu, marginBottom: 4 }}>الساعات</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <button onClick={() => update(i, "hrs", Math.max(1, c.hrs - 1))}
                      style={{ background: t.s3, border: `1px solid ${t.bd}`, borderRadius: 6, width: 26, height: 26, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: t.tx }}>
                      <Minus size={12} />
                    </button>
                    <span style={{ fontWeight: 800, color: t.tx, minWidth: 20, textAlign: "center" }}>{c.hrs}</span>
                    <button onClick={() => update(i, "hrs", Math.min(6, c.hrs + 1))}
                      style={{ background: t.s3, border: `1px solid ${t.bd}`, borderRadius: 6, width: 26, height: 26, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: t.tx }}>
                      <Plus size={12} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <Btn onClick={addCourse} variant="ghost" style={{ width: "100%" }}>
        <Plus size={15} /> إضافة مادة
      </Btn>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   POMODORO TIMER (with history + sound + custom durations)
   ══════════════════════════════════════════════════════════════ */
function PomodoroTimer({ t, sessionLog, setSessionLog, totalSessions, setTotalSessions, soundOn, onToast }) {
  const [mode, setMode] = useState("work");
  const [secs, setSecs] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [subject, setSubject] = useStored("pomoSubject", "المذاكرة");
  const [customWork, setCustomWork] = useStored("pomoCustomWork", 25);
  const [showSettings, setShowSettings] = useState(false);
  const timerRef = useRef(null);
  const DURATIONS = { work: customWork * 60, short: 5 * 60, long: 15 * 60 };
  const todaySessions = sessionLog.filter(s => s.date === todayKey()).length;
  const todayMins = sessionLog.filter(s => s.date === todayKey()).reduce((a, s) => a + s.dur, 0);

  useEffect(() => { setSecs(DURATIONS[mode]); }, [customWork]);

  useEffect(() => {
    if (running) {
      timerRef.current = setInterval(() => setSecs(s => {
        if (s <= 1) {
          clearInterval(timerRef.current); setRunning(false);
          if (soundOn) playBell();
          if (mode === "work") {
            setTotalSessions(n => n + 1);
            setSessionLog(l => [...l, { date: todayKey(), dur: customWork, subject, t: Date.now() }]);
            onToast?.("🎉 جلسة دراسة مكتملة!", "success");
          } else {
            onToast?.("⏰ انتهى وقت الراحة", "info");
          }
          return 0;
        }
        return s - 1;
      }), 1000);
    } else clearInterval(timerRef.current);
    return () => clearInterval(timerRef.current);
  }, [running, mode, customWork, subject, soundOn]);

  const changeMode = (m) => { clearInterval(timerRef.current); setRunning(false); setMode(m); setSecs(DURATIONS[m]); };
  const reset = () => { clearInterval(timerRef.current); setRunning(false); setSecs(DURATIONS[mode]); };
  const mm = String(Math.floor(secs / 60)).padStart(2, "0");
  const ss = String(secs % 60).padStart(2, "0");
  const prog = 1 - secs / DURATIONS[mode];
  const r = 58, circ = 2 * Math.PI * r;
  const modeColor = mode === "work" ? P.blue2 : mode === "short" ? P.green : P.gold;

  return (
    <div style={{ animation: "fadeUp .4s ease" }}>
      <div style={{
        background: `linear-gradient(135deg,${P.navy},${P.blue})`, borderRadius: 20,
        padding: "28px 24px", marginBottom: 16, textAlign: "center", position: "relative", overflow: "hidden",
      }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 140, height: 140, borderRadius: "50%", background: `${modeColor}15` }} />
        <div style={{ position: "relative" }}>
          <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 24 }}>
            {[["work", "⚡ دراسة"], ["short", "☕ راحة"], ["long", "🌿 راحة طويلة"]].map(([m, l]) => (
              <button key={m} onClick={() => changeMode(m)} style={{
                background: mode === m ? "rgba(255,255,255,.2)" : "transparent",
                border: `1px solid rgba(255,255,255,${mode === m ? .4 : .15})`, borderRadius: 20,
                padding: "5px 12px", cursor: "pointer", fontSize: 11, color: "rgba(255,255,255,.9)", fontFamily: "inherit"
              }}>
                {l}
              </button>
            ))}
          </div>

          <div style={{ position: "relative", display: "inline-block", marginBottom: 16 }}>
            <svg width={140} height={140} style={{ transform: "rotate(-90deg)" }}>
              <circle cx={70} cy={70} r={r} fill="none" stroke="rgba(255,255,255,.1)" strokeWidth={8} />
              <circle cx={70} cy={70} r={r} fill="none" stroke={modeColor} strokeWidth={8}
                strokeDasharray={circ} strokeDashoffset={circ * (1 - prog)} strokeLinecap="round"
                style={{ transition: "stroke-dashoffset .9s linear" }} />
            </svg>
            <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", textAlign: "center" }}>
              <div style={{ fontSize: 30, fontWeight: 900, color: "#fff", fontFamily: "monospace", letterSpacing: 2 }}>{mm}:{ss}</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,.5)", marginTop: 2 }}>{mode === "work" ? "دراسة" : mode === "short" ? "راحة" : "راحة طويلة"}</div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, justifyContent: "center", alignItems: "center" }}>
            <button onClick={reset} style={{
              background: "rgba(255,255,255,.1)", border: "none", borderRadius: "50%",
              width: 40, height: 40, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,.7)"
            }}>
              <RotateCcw size={16} />
            </button>
            <button onClick={() => setRunning(rv => !rv)} style={{
              background: running ? "#dc2626" : `${modeColor}`, border: "none", borderRadius: 24,
              padding: "12px 32px", cursor: "pointer", color: "#fff", fontSize: 15, fontWeight: 800,
              fontFamily: "inherit", display: "flex", alignItems: "center", gap: 8, boxShadow: `0 4px 20px ${modeColor}50`
            }}>
              {running ? <><Pause size={16} />إيقاف</> : <><Play size={16} />بدء</>}
            </button>
            <button onClick={() => setShowSettings(s => !s)} style={{
              background: "rgba(255,255,255,.1)", border: "none", borderRadius: "50%",
              width: 40, height: 40, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,.7)"
            }}>
              <Settings size={16} />
            </button>
          </div>
        </div>
      </div>

      {showSettings && (
        <div style={{ background: t.s1, borderRadius: 14, padding: 14, marginBottom: 12, border: `1px solid ${t.bd}`, animation: "fadeUp .3s ease" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: t.tx, marginBottom: 10 }}>إعدادات المؤقت</div>
          <div style={{ fontSize: 11, color: t.mu, marginBottom: 6 }}>مدة جلسة الدراسة: {customWork} دقيقة</div>
          <input type="range" min={10} max={60} step={5} value={customWork}
            onChange={e => setCustomWork(+e.target.value)}
            style={{ width: "100%", accentColor: P.blue2 }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: t.dim, marginTop: 4 }}>
            <span>10د</span><span>60د</span>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
        <div style={{ background: t.s1, borderRadius: 14, padding: "14px", border: `1px solid ${t.bd}`, textAlign: "center" }}>
          <div style={{ fontSize: 26, fontWeight: 900, color: P.blue2 }}>{todaySessions}</div>
          <div style={{ fontSize: 11, color: t.mu }}>جلسات اليوم</div>
        </div>
        <div style={{ background: t.s1, borderRadius: 14, padding: "14px", border: `1px solid ${t.bd}`, textAlign: "center" }}>
          <div style={{ fontSize: 26, fontWeight: 900, color: P.gold }}>{todayMins}</div>
          <div style={{ fontSize: 11, color: t.mu }}>دقيقة دراسة</div>
        </div>
      </div>

      <div style={{ background: t.s1, borderRadius: 14, padding: "12px 14px", border: `1px solid ${t.bd}`, marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: t.mu, marginBottom: 6 }}>مادة الدراسة الحالية</div>
        <input value={subject} onChange={e => setSubject(e.target.value)}
          style={{
            width: "100%", border: `1.5px solid ${t.bd}`, borderRadius: 10, padding: "8px 12px",
            fontSize: 13, background: t.s2, color: t.tx, fontFamily: "inherit", direction: "rtl",
            outline: "none", boxSizing: "border-box",
          }} />
      </div>

      {sessionLog.length > 0 && (
        <div style={{ background: t.s1, borderRadius: 14, padding: 14, border: `1px solid ${t.bd}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
            <History size={14} color={t.mu} />
            <div style={{ fontSize: 12, fontWeight: 700, color: t.tx }}>آخر الجلسات</div>
            <div style={{ marginRight: "auto", fontSize: 11, color: t.dim }}>الإجمالي: {totalSessions}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 200, overflowY: "auto" }}>
            {[...sessionLog].reverse().slice(0, 8).map((s, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: t.s2, borderRadius: 10 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: `${P.blue2}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Clock size={13} color={P.blue2} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: t.tx }}>{s.subject}</div>
                  <div style={{ fontSize: 10, color: t.mu }}>{new Date(s.t).toLocaleString("ar-SA", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })}</div>
                </div>
                <div style={{ fontSize: 12, color: P.green, fontWeight: 700 }}>{s.dur}د</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   COURSE PAGE
   ══════════════════════════════════════════════════════════════ */
/* ══════════════════════════════════════════════════════════════
   REAL FILE ITEM (uploaded via admin)
   ══════════════════════════════════════════════════════════════ */
function RealFileItem({ file, t, onToast }) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      window.open(file.url, "_blank", "noopener,noreferrer");
      onToast?.({ msg: "جارٍ فتح الملف...", icon: "✓" });
    } finally {
      setTimeout(() => setDownloading(false), 1200);
    }
  };

  return (
    <div style={{
      background: `${P.blue2}08`, border: `1.5px solid ${P.blue2}30`,
      borderRadius: 14, padding: "12px 14px",
      display: "flex", alignItems: "center", gap: 12,
    }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: `${P.blue2}20`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <FileText size={18} color={P.blue2} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
          <span style={{ background: P.blue2, color: "#fff", fontSize: 9, fontWeight: 800, borderRadius: 4, padding: "1px 5px" }}>جديد</span>
          <div style={{ fontSize: 13, fontWeight: 700, color: t.tx, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.name}</div>
        </div>
        <div style={{ fontSize: 11, color: t.mu }}>{file.sizeLabel} • {new Date(file.uploadedAt).toLocaleDateString("ar-SA")}</div>
      </div>
      <button onClick={handleDownload} style={{
        background: `linear-gradient(135deg,${P.blue},${P.blue2})`,
        border: "none", borderRadius: 9, padding: "7px 12px",
        cursor: "pointer", color: "#fff", fontSize: 11, fontWeight: 700,
        fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5, flexShrink: 0,
      }}>
        <Download size={12} /> {downloading ? "جارٍ..." : "فتح"}
      </button>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   FLASHCARDS COMPONENT
   ══════════════════════════════════════════════════════════════ */
function FlashCards({ subject, t }) {
  const key = `fc_${subject}`;
  const [cards, setCards] = useStored(key, []);
  const [mode, setMode] = useState("list"); // list | add | review
  const [q, setQ] = useState(""); const [a, setA] = useState("");
  const [idx, setIdx] = useState(0); const [flipped, setFlipped] = useState(false);

  const addCard = () => {
    if (!q.trim() || !a.trim()) return;
    setCards(c => [...c, { id: Date.now(), q: q.trim(), a: a.trim() }]);
    setQ(""); setA("");
  };
  const del = (id) => setCards(c => c.filter(x => x.id !== id));
  const next = () => { setFlipped(false); setIdx(i => (i + 1) % cards.length); };
  const prev = () => { setFlipped(false); setIdx(i => (i - 1 + cards.length) % cards.length); };

  if (mode === "review" && cards.length > 0) {
    const card = cards[idx];
    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <button onClick={() => { setMode("list"); setIdx(0); setFlipped(false); }}
            style={{ background: t.s2, border: `1px solid ${t.bd}`, borderRadius: 8, padding: "5px 12px", cursor: "pointer", color: t.mu, fontSize: 12, fontFamily: "inherit" }}>
            ← رجوع
          </button>
          <span style={{ fontSize: 12, color: t.mu }}>{idx + 1} / {cards.length}</span>
        </div>
        <div onClick={() => setFlipped(f => !f)} style={{
          background: flipped ? `${P.green}12` : t.s2, border: `2px solid ${flipped ? P.green : t.bd}`,
          borderRadius: 18, padding: 28, textAlign: "center", cursor: "pointer",
          minHeight: 140, display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", transition: "all .3s", marginBottom: 14,
        }}>
          <div style={{ fontSize: 10, color: t.mu, marginBottom: 8 }}>{flipped ? "الجواب" : "السؤال"} — اضغط للقلب</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: t.tx, lineHeight: 1.6 }}>
            {flipped ? card.a : card.q}
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={prev} style={{ flex: 1, background: t.s2, border: `1px solid ${t.bd}`, borderRadius: 12, padding: 10, cursor: "pointer", color: t.tx, fontSize: 13, fontFamily: "inherit" }}>السابق</button>
          <button onClick={next} style={{ flex: 1, background: `linear-gradient(135deg,${P.blue},${P.blue2})`, border: "none", borderRadius: 12, padding: 10, cursor: "pointer", color: "#fff", fontSize: 13, fontFamily: "inherit", fontWeight: 700 }}>التالي</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {mode === "add" ? (
        <div>
          <button onClick={() => setMode("list")} style={{ background: t.s2, border: `1px solid ${t.bd}`, borderRadius: 8, padding: "5px 12px", cursor: "pointer", color: t.mu, fontSize: 12, fontFamily: "inherit", marginBottom: 14 }}>← رجوع</button>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <textarea placeholder="السؤال..." value={q} onChange={e => setQ(e.target.value)} rows={2}
              style={{ border: `1px solid ${t.bd}`, borderRadius: 10, padding: 10, fontSize: 13, background: t.s2, color: t.tx, fontFamily: "inherit", resize: "vertical", outline: "none" }} />
            <textarea placeholder="الجواب..." value={a} onChange={e => setA(e.target.value)} rows={2}
              style={{ border: `1px solid ${t.bd}`, borderRadius: 10, padding: 10, fontSize: 13, background: t.s2, color: t.tx, fontFamily: "inherit", resize: "vertical", outline: "none" }} />
            <button onClick={addCard} disabled={!q.trim() || !a.trim()}
              style={{ background: `linear-gradient(135deg,${P.blue},${P.blue2})`, border: "none", borderRadius: 10, padding: "10px", color: "#fff", fontFamily: "inherit", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: (!q.trim() || !a.trim()) ? .5 : 1 }}>
              إضافة البطاقة
            </button>
          </div>
        </div>
      ) : (
        <div>
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            <button onClick={() => setMode("add")} style={{ flex: 1, background: `${P.blue2}15`, border: `1px solid ${P.blue2}40`, borderRadius: 10, padding: 9, cursor: "pointer", color: P.blue2, fontSize: 12, fontFamily: "inherit", fontWeight: 700 }}>+ بطاقة جديدة</button>
            {cards.length > 0 && <button onClick={() => { setIdx(0); setFlipped(false); setMode("review"); }} style={{ flex: 1, background: `${P.green}15`, border: `1px solid ${P.green}40`, borderRadius: 10, padding: 9, cursor: "pointer", color: P.green, fontSize: 12, fontFamily: "inherit", fontWeight: 700 }}>▶ مراجعة ({cards.length})</button>}
          </div>
          {cards.length === 0 ? (
            <div style={{ textAlign: "center", padding: "20px 0", color: t.mu, fontSize: 13 }}>لا توجد بطاقات بعد — أضف سؤالاً وجواباً</div>
          ) : (
            cards.map(c => (
              <div key={c.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 12px", background: t.s2, borderRadius: 10, border: `1px solid ${t.bd}`, marginBottom: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: t.mu, marginBottom: 2 }}>س: {c.q}</div>
                  <div style={{ fontSize: 12, color: t.tx }}>ج: {c.a}</div>
                </div>
                <button onClick={() => del(c.id)} style={{ background: `${P.red}15`, border: "none", borderRadius: 7, padding: 6, cursor: "pointer", color: P.red, display: "flex" }}><X size={12} /></button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function CoursePage({ subject, onBack, favorites, toggleFav, notes, setNotes, t, onChat, onToast }) {
  const [open, setOpen] = useState(null);
  const [realFiles, setRealFiles] = useState({});
  const [realLoading, setRealLoading] = useState(true);
  const Icon = getIcon(subject);
  const isFav = favorites.includes(subject);
  const hasNotes = !!(notes[subject] && notes[subject].trim());

  useEffect(() => {
    setRealLoading(true);
    fetch(`/api/files?course=${encodeURIComponent(subject)}`)
      .then(r => r.json())
      .then(data => {
        if (data.files) {
          const grouped = { collections: [], plans: [], curriculum: [], programs: [] };
          data.files.forEach(f => { if (grouped[f.category]) grouped[f.category].push(f); });
          setRealFiles(grouped);
        }
      })
      .catch(() => {})
      .finally(() => setRealLoading(false));
  }, [subject]);

  const fileData = {
    collections: FILES.collections(subject), plans: FILES.plans(subject),
    curriculum: FILES.curriculum(subject), programs: FILES.programs(subject),
  };

  return (
    <div style={{ animation: "fadeUp .35s ease" }}>
      <div style={{
        background: t.hero, borderRadius: 22, padding: "24px", marginBottom: 20,
        position: "relative", overflow: "hidden",
      }}>
        <div style={{ position: "absolute", top: -40, left: -40, width: 160, height: 160, borderRadius: "50%", background: "rgba(255,255,255,.03)" }} />
        <div style={{ position: "absolute", bottom: -20, right: 40, width: 100, height: 100, borderRadius: "50%", background: `${P.gold}12` }} />
        <button onClick={onBack} style={{
          background: "rgba(255,255,255,.12)", border: "none", color: "rgba(255,255,255,.8)",
          padding: "7px 14px", borderRadius: 20, cursor: "pointer", fontSize: 12,
          display: "flex", alignItems: "center", gap: 6, marginBottom: 18, fontFamily: "inherit",
        }}>
          <ArrowLeft size={13} /> رجوع
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{
            width: 60, height: 60, borderRadius: 18, background: "rgba(255,255,255,.12)",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            border: "1.5px solid rgba(255,255,255,.2)",
          }}>
            <Icon size={28} color="#fff" strokeWidth={1.5} />
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ color: "#fff", margin: 0, fontSize: 22, fontWeight: 900 }}>{subject}</h2>
            <div style={{ color: P.gold, fontSize: 12, marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
              <Award size={12} /> الجامعة السعودية الإلكترونية
            </div>
          </div>
          <button onClick={() => toggleFav(subject)} style={{
            background: isFav ? `${P.gold}25` : "rgba(255,255,255,.1)",
            border: `1.5px solid ${isFav ? P.gold : "rgba(255,255,255,.2)"}`, borderRadius: 12,
            padding: 10, cursor: "pointer", transition: "all .2s", display: "flex",
          }}>
            <Star size={18} color={isFav ? P.gold : "rgba(255,255,255,.6)"} fill={isFav ? P.gold : "none"} />
          </button>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {SECTIONS.map((sec) => {
          const isOpen = open === sec.id;
          const showBadge = sec.id === "notes" && hasNotes;
          return (
            <div key={sec.id} style={{
              background: t.s1, borderRadius: 16, border: `1px solid ${isOpen ? sec.color + "50" : t.bd}`,
              overflow: "hidden", transition: "all .3s", boxShadow: isOpen ? `0 4px 20px ${sec.color}15` : t.shSm,
            }}>
              <button onClick={() => setOpen(isOpen ? null : sec.id)} style={{
                width: "100%", background: "none", border: "none", padding: "16px",
                cursor: "pointer", display: "flex", alignItems: "center", gap: 12,
                fontFamily: "inherit", textAlign: "right",
              }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: `${sec.color}15`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, position: "relative" }}>
                  <sec.Icon size={19} color={sec.color} strokeWidth={2.5} />
                  {showBadge && <div style={{ position: "absolute", top: -3, right: -3, width: 10, height: 10, borderRadius: "50%", background: P.green, border: `2px solid ${t.s1}` }} />}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: t.tx }}>{sec.label}</div>
                  <div style={{ fontSize: 11, color: t.mu, marginTop: 1 }}>{sec.desc}</div>
                </div>
                <div style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform .3s", color: t.dim }}>
                  <ChevronDown size={18} />
                </div>
              </button>

              {isOpen && (
                <div style={{ padding: "0 16px 16px", animation: "fadeUp .3s ease" }}>
                  <div style={{ height: 1, background: t.bd, marginBottom: 14 }} />
                  {sec.id === "ai" && <AIChat subject={subject} t={t} onChat={onChat} />}
                  {sec.id === "notes" && <NotesEditor subject={subject} notes={notes} setNotes={setNotes} t={t} onToast={onToast} />}
                  {sec.id === "flashcards" && <FlashCards subject={subject} t={t} />}
                  {sec.id === "support" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {[
                        { Icon: Phone, label: "الهاتف الموحد", val: "011-2613500", color: "#059669", href: "tel:0112613500" },
                        { Icon: MessageCircle, label: "Blackboard", val: "lms.seu.edu.sa", color: P.blue2, href: "https://lms.seu.edu.sa" },
                        { Icon: Globe, label: "البوابة الأكاديمية", val: "erpgate.seu.edu.sa", color: P.purple, href: "https://erpgate.seu.edu.sa" },
                      ].map((item, i) => (
                        <a key={i} href={item.href} target="_blank" rel="noopener noreferrer" style={{
                          display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
                          background: t.s2, borderRadius: 12, border: `1px solid ${t.bd}`, cursor: "pointer",
                          textDecoration: "none",
                        }}>
                          <div style={{ width: 36, height: 36, borderRadius: 10, background: `${item.color}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <item.Icon size={16} color={item.color} />
                          </div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: t.tx }}>{item.label}</div>
                            <div style={{ fontSize: 12, color: item.color }}>{item.val}</div>
                          </div>
                        </a>
                      ))}
                    </div>
                  )}
                  {["collections", "plans", "curriculum", "programs"].includes(sec.id) && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {(realFiles[sec.id] || []).map((f, i) => (
                        <RealFileItem key={`real-${i}`} file={f} t={t} onToast={onToast} />
                      ))}
                      {(realFiles[sec.id] || []).length === 0 && !realLoading && (
                        <div style={{ fontSize: 12, color: t.mu, textAlign: "center", padding: "6px 0 10px", borderBottom: `1px dashed ${t.bd}`, marginBottom: 8 }}>
                          لا توجد ملفات حقيقية بعد
                        </div>
                      )}
                      {fileData[sec.id].map((f, i) => <FileItem key={i} {...f} t={t} onToast={onToast} />)}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   HOME PAGE
   ══════════════════════════════════════════════════════════════ */
const SEU_CALENDAR = [
  { label: "الاختبارات النهائية — الفصل الثاني 1447", date: "2026-06-07", color: P.red, icon: "🔥" },
  { label: "نتائج الفصل الثاني 1447", date: "2026-06-28", color: P.green, icon: "🏆" },
  { label: "التسجيل للفصل الأول 1448", date: "2026-07-20", color: P.purple, icon: "📋" },
  { label: "بداية الفصل الأول 1448", date: "2026-09-06", color: P.blue2, icon: "🎓" },
  { label: "اختبارات الميدترم — الفصل الأول 1448", date: "2026-10-25", color: P.gold, icon: "📝" },
  { label: "الاختبارات النهائية — الفصل الأول 1448", date: "2026-12-13", color: P.red, icon: "🔥" },
];

function AcademicCalendar({ t }) {
  const now = new Date();
  const upcoming = SEU_CALENDAR
    .map(e => ({ ...e, days: Math.ceil((new Date(e.date) - now) / 86400000) }))
    .filter(e => e.days > -7)
    .slice(0, 4);

  return (
    <div style={{ background: t.s1, borderRadius: 18, padding: 16, border: `1px solid ${t.bd}`, marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: t.tx, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
        <Calendar size={14} color={P.blue2} /> التقويم الأكاديمي 1447/1448
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {upcoming.map((e, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 16, flexShrink: 0 }}>{e.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: t.tx }}>{e.label}</div>
              <div style={{ fontSize: 11, color: t.mu }}>{new Date(e.date).toLocaleDateString("ar-SA", { month: "long", day: "numeric" })}</div>
            </div>
            <div style={{
              background: e.days <= 0 ? `${P.green}20` : e.days <= 14 ? `${P.red}20` : `${e.color}15`,
              color: e.days <= 0 ? P.green : e.days <= 14 ? P.red : e.color,
              borderRadius: 8, padding: "3px 8px", fontSize: 11, fontWeight: 800, flexShrink: 0,
            }}>
              {e.days <= 0 ? "انتهى" : e.days === 1 ? "غداً" : `${e.days} يوم`}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function HomePage({ setActiveTab, openCourse, t, recent, streak, activeDays, weeklyGoal, weekProgress, achievements, sessionLog, semesters }) {
  const hour = new Date().getHours();
  const greeting = hour < 5 ? "طاب ليلك" : hour < 12 ? "صباح الخير" : hour < 17 ? "مساء الخير" : "طاب مساؤك";
  const tip = TIPS[Math.floor(Date.now() / 86400000) % TIPS.length];
  const examDays = Math.ceil((new Date("2026-06-07") - new Date()) / (1000 * 60 * 60 * 24));
  const unlocked = ACHIEVEMENTS.filter(a => a.check(achievements));
  const goalPct = Math.min(100, Math.round((weekProgress / Math.max(1, weeklyGoal)) * 100));
  const weekMins = (sessionLog || []).filter(s => {
    const d = new Date(); d.setDate(d.getDate() - 6);
    return new Date(s.date || s.completed_at || Date.now()) >= d;
  }).reduce((a, s) => a + (s.dur || s.duration_minutes || s.duration || 25), 0);
  const lastGpa = semesters?.length ? semesters[semesters.length - 1]?.gpa : null;

  return (
    <div style={{ animation: "fadeUp .4s ease" }}>
      <div style={{ background: t.hero, borderRadius: 22, padding: "22px", marginBottom: 16, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -60, right: -60, width: 200, height: 200, borderRadius: "50%", background: "rgba(255,255,255,.03)" }} />
        <div style={{ position: "absolute", bottom: -30, left: -20, width: 120, height: 120, borderRadius: "50%", background: `${P.gold}10` }} />
        <div style={{ color: "rgba(255,255,255,.6)", fontSize: 12, marginBottom: 4 }}>{greeting} 👋</div>
        <h1 style={{ color: "#fff", fontSize: 24, fontWeight: 900, margin: "0 0 6px", lineHeight: 1.3 }}>
          مرحباً في <span style={{ color: P.gold }}>حلول</span>
        </h1>
        <p style={{ color: "rgba(255,255,255,.65)", fontSize: 13, margin: 0, lineHeight: 1.7 }}>
          بوابتك الأكاديمية الذكية للجامعة السعودية الإلكترونية
        </p>
        <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
          <Btn onClick={() => setActiveTab("explore")} size="sm" variant="gold">
            <Target size={13} /> ابدأ الاستكشاف
          </Btn>
          <button onClick={() => setActiveTab("gpa")} style={{
            background: "rgba(255,255,255,.1)", border: "none", borderRadius: 20,
            padding: "6px 14px", cursor: "pointer", fontSize: 12, color: "rgba(255,255,255,.8)",
            fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5,
          }}>
            <Calculator size={12} /> احسب معدلك
          </button>
        </div>
      </div>

      <div style={{ background: t.s1, borderRadius: 18, padding: 16, marginBottom: 16, border: `1px solid ${t.bd}`, boxShadow: t.shSm }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 12, background: `linear-gradient(135deg,${P.orange},${P.orangeLight})`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 4px 12px ${P.orange}40` }}>
            <Flame size={18} color="#fff" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: t.tx }}>سلسلة الدراسة</div>
            <div style={{ fontSize: 11, color: t.mu }}>{streak > 0 ? `${streak} يوم متواصل! استمر 🔥` : "ابدأ سلسلتك اليوم"}</div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, color: P.orange }}>{streak}</div>
        </div>
        <StreakWeek activeDays={activeDays} t={t} />
      </div>

      <div style={{ background: t.s1, borderRadius: 18, padding: 16, marginBottom: 16, border: `1px solid ${t.bd}`, boxShadow: t.shSm, display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ position: "relative", width: 60, height: 60 }}>
          <svg width={60} height={60} style={{ transform: "rotate(-90deg)" }}>
            <circle cx={30} cy={30} r={26} fill="none" stroke={t.s3} strokeWidth={5} />
            <circle cx={30} cy={30} r={26} fill="none" stroke={P.green} strokeWidth={5}
              strokeDasharray={2 * Math.PI * 26} strokeDashoffset={2 * Math.PI * 26 * (1 - goalPct / 100)}
              strokeLinecap="round" style={{ transition: "stroke-dashoffset .8s ease" }} />
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 900, color: P.green }}>{goalPct}%</div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: t.tx }}>هدف الأسبوع</div>
          <div style={{ fontSize: 12, color: t.mu, marginTop: 2 }}>{weekProgress} / {weeklyGoal} جلسة هذا الأسبوع</div>
          <div style={{ fontSize: 11, color: P.green, marginTop: 4, fontWeight: 700 }}>
            {goalPct >= 100 ? "🎉 تم تحقيق الهدف!" : `يتبقى ${Math.max(0, weeklyGoal - weekProgress)} جلسة`}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10, marginBottom: 16 }}>
        <StatCard Icon={Book} value={4200} suffix="+" label="مادة دراسية" color={P.blue2} t={t} />
        <StatCard Icon={Bookmark} value={12800} suffix="+" label="تجميع وملخص" color={P.gold} t={t} />
        <StatCard Icon={Users} value={98000} suffix="+" label="طالب نشط" color={P.green} t={t} />
        <StatCard Icon={Trophy} value={unlocked.length} suffix={`/${ACHIEVEMENTS.length}`} label="إنجازاتك" color={P.orange} t={t} />
      </div>

      {recent.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: t.tx, display: "flex", alignItems: "center", gap: 6 }}>
              <History size={15} color={t.mu} /> آخر ما تصفّحت
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4 }}>
            {recent.slice(0, 8).map((s, i) => {
              const SIcon = getIcon(s);
              return (
                <button key={i} onClick={() => openCourse(s)} style={{
                  background: t.s1, border: `1px solid ${t.bd}`, borderRadius: 14, padding: "12px 14px",
                  cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 10,
                  minWidth: 160, flexShrink: 0, transition: "all .2s",
                }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = P.blue2}
                  onMouseLeave={e => e.currentTarget.style.borderColor = t.bd}>
                  <div style={{ width: 32, height: 32, borderRadius: 10, background: `${P.blue2}15`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <SIcon size={16} color={P.blue2} />
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: t.tx, textAlign: "right" }}>{s}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Quick Stats Bar */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 16,
      }}>
        {[
          { label: "دقائق هذا الأسبوع", value: weekMins || 0, color: P.blue2, suffix: "د" },
          { label: "يوم للاختبارات", value: Math.max(0, examDays), color: examDays <= 14 ? P.red : P.gold, suffix: "" },
          { label: "آخر معدل", value: lastGpa ? lastGpa.toFixed(2) : "—", color: P.green, suffix: "" },
        ].map(({ label, value, color, suffix }) => (
          <div key={label} style={{ background: t.s1, borderRadius: 14, padding: "12px 10px", border: `1px solid ${t.bd}`, textAlign: "center" }}>
            <div style={{ fontSize: 20, fontWeight: 900, color, lineHeight: 1 }}>{value}{suffix}</div>
            <div style={{ fontSize: 10, color: t.mu, marginTop: 3, lineHeight: 1.3 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Academic Calendar */}
      <AcademicCalendar t={t} />

      <div style={{
        background: `linear-gradient(135deg,${P.goldLight},#fef9f0)`, borderRadius: 18,
        padding: "16px", marginBottom: 16, border: `1.5px solid ${P.gold}30`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <Lightbulb size={16} color={P.gold} />
          <span style={{ fontSize: 12, fontWeight: 700, color: P.gold }}>نصيحة اليوم</span>
        </div>
        <p style={{ margin: 0, fontSize: 13.5, color: "#5a4010", lineHeight: 1.7, fontWeight: 500 }}>{tip}</p>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: t.tx, marginBottom: 12 }}>وصول سريع</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
          {[
            { Icon: BookOpen, label: "تجميعات", tab: "explore", color: "#1d4ed8" },
            { Icon: Calculator, label: "المعدل", tab: "gpa", color: P.purple },
            { Icon: AlarmClock, label: "مؤقت", tab: "timer", color: "#065f46" },
            { Icon: Star, label: "المفضلة", tab: "fav", color: P.gold },
            { Icon: GraduationCap, label: "مسارك", tab: "explore", color: "#be123c" },
            { Icon: Trophy, label: "الإنجازات", tab: "profile", color: P.orange },
          ].map(({ Icon, label, tab, color }, i) => (
            <button key={i} onClick={() => setActiveTab(tab)} style={{
              background: t.s1, border: `1px solid ${t.bd}`, borderRadius: 14, padding: "14px 10px",
              cursor: "pointer", textAlign: "center", transition: "all .22s", boxShadow: t.shSm, fontFamily: "inherit",
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = color; e.currentTarget.style.transform = "translateY(-2px)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = t.bd; e.currentTarget.style.transform = "none"; }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: `${color}15`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 8px" }}>
                <Icon size={18} color={color} strokeWidth={2} />
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: t.tx }}>{label}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   SEARCH RESULTS (modal overlay)
   ══════════════════════════════════════════════════════════════ */
function SearchResults({ query, onCourse, onClose, t }) {
  const q = query.trim().toLowerCase();
  const results = q ? ALL_COURSES.filter(c => c.toLowerCase().includes(q)) : [];
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 200,
      backdropFilter: "blur(6px)", animation: "fadeIn .2s ease",
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: t.bgMesh, maxWidth: 620, margin: "60px auto 0", borderRadius: 22,
        padding: 20, border: `1px solid ${t.bd}`, boxShadow: t.sh,
        maxHeight: "70vh", overflowY: "auto", animation: "scaleIn .25s ease",
      }}>
        {!q ? (
          <div style={{ textAlign: "center", padding: 20 }}>
            <Search size={36} color={t.dim} style={{ margin: "0 auto 10px" }} />
            <div style={{ fontSize: 14, color: t.mu }}>ابحث عن مادة أو تخصص…</div>
          </div>
        ) : results.length === 0 ? (
          <div style={{ textAlign: "center", padding: 30 }}>
            <div style={{ fontSize: 14, color: t.mu }}>لا توجد نتائج لـ "{query}"</div>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 12, color: t.mu, marginBottom: 12 }}>
              {results.length} نتيجة
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {results.map((s, i) => {
                const SIcon = getIcon(s);
                return (
                  <button key={i} onClick={() => { onCourse(s); onClose(); }} style={{
                    background: t.s1, border: `1px solid ${t.bd}`, borderRadius: 12,
                    padding: "12px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12,
                    fontFamily: "inherit", textAlign: "right", transition: "all .2s",
                  }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = P.blue2; e.currentTarget.style.background = t.s2; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = t.bd; e.currentTarget.style.background = t.s1; }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: `${P.blue2}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <SIcon size={16} color={P.blue2} />
                    </div>
                    <div style={{ flex: 1, fontSize: 13.5, fontWeight: 700, color: t.tx }}>{s}</div>
                    <ChevronLeft size={15} color={t.dim} />
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   EXPLORE (with breadcrumbs)
   ══════════════════════════════════════════════════════════════ */
function ExplorePage({ onCourse, t }) {
  const [step, setStep] = useState("root");
  const [path, setPath] = useState(null);
  const [sub, setSub] = useState(null);

  const PCard = ({ Icon, label, sub, color, onClick }) => (
    <button onClick={onClick} style={{
      background: t.s1, border: `1px solid ${t.bd}`, borderRadius: 18, padding: "18px 16px",
      cursor: "pointer", textAlign: "right", transition: "all .22s", boxShadow: t.shSm,
      fontFamily: "inherit", width: "100%",
    }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = color + "70"; e.currentTarget.style.background = t.s2; e.currentTarget.style.transform = "translateY(-2px)"; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = t.bd; e.currentTarget.style.background = t.s1; e.currentTarget.style.transform = "none"; }}>
      <div style={{ width: 44, height: 44, borderRadius: 14, background: `${color}18`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12, border: `1px solid ${color}25` }}>
        <Icon size={22} color={color} strokeWidth={1.8} />
      </div>
      <div style={{ fontSize: 14, fontWeight: 800, color: t.tx, marginBottom: 4 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: t.mu, lineHeight: 1.5 }}>{sub}</div>}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", marginTop: 10 }}>
        <div style={{ background: `${color}18`, border: `1px solid ${color}30`, borderRadius: 20, padding: "3px 10px", fontSize: 11, color, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
          استكشف <ChevronLeft size={11} />
        </div>
      </div>
    </button>
  );

  const back = () => {
    if (step === "level3") setStep("level2");
    else if (step === "level2") { setStep("root"); setPath(null); setSub(null); }
  };

  const crumbs = [{ label: "المسارات", onClick: () => { setStep("root"); setPath(null); setSub(null); } }];
  if (step !== "root" && path) crumbs.push({ label: TREE[path]?.label, onClick: () => { setStep("level2"); setSub(null); } });
  if (step === "level3" && path === "bachelor" && sub) {
    const col = TREE.bachelor.colleges.find(c => c.id === sub);
    if (col) crumbs.push({ label: col.label });
  } else if (step === "level3" && path === "preparatory" && sub) {
    crumbs.push({ label: TREE.preparatory.plans[sub].label });
  }

  return (
    <div style={{ animation: "fadeUp .35s ease" }}>
      {step !== "root" && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
          <button onClick={back} style={{
            background: t.s2, border: `1px solid ${t.bd}`, borderRadius: 20, padding: "6px 12px",
            cursor: "pointer", fontSize: 12, color: t.mu, fontFamily: "inherit",
            display: "flex", alignItems: "center", gap: 5,
          }}>
            <ArrowLeft size={12} /> رجوع
          </button>
          {crumbs.map((c, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <button onClick={c.onClick} disabled={!c.onClick} style={{
                background: "none", border: "none", color: i === crumbs.length - 1 ? t.tx : t.mu,
                fontSize: 11, cursor: c.onClick ? "pointer" : "default", fontFamily: "inherit",
                fontWeight: i === crumbs.length - 1 ? 700 : 500, padding: "4px 6px",
              }}>{c.label}</button>
              {i < crumbs.length - 1 && <ChevronLeft size={10} color={t.dim} />}
            </div>
          ))}
        </div>
      )}

      {step === "root" && <>
        <h2 style={{ fontSize: 20, fontWeight: 900, color: t.tx, marginBottom: 16 }}>اختر مسارك</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <PCard Icon={TREE.preparatory.icon} label={TREE.preparatory.label} sub="الفصل الأول والثاني" color={TREE.preparatory.color} onClick={() => { setPath("preparatory"); setStep("level2"); }} />
          <PCard Icon={TREE.bachelor.icon} label={TREE.bachelor.label} sub="5 كليات" color={TREE.bachelor.color} onClick={() => { setPath("bachelor"); setStep("level2"); }} />
          <PCard Icon={TREE.diploma.icon} label={TREE.diploma.label} sub="4 برامج" color={TREE.diploma.color} onClick={() => { setPath("diploma"); setStep("level2"); }} />
          <PCard Icon={TREE.graduate.icon} label={TREE.graduate.label} sub="8 برامج ماجستير" color={TREE.graduate.color} onClick={() => { setPath("graduate"); setStep("level2"); }} />
        </div>
      </>}

      {step === "level2" && path === "preparatory" && <>
        <h2 style={{ fontSize: 20, fontWeight: 900, color: t.tx, marginBottom: 16 }}>السنة الأولى المشتركة (CFY)</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <PCard Icon={BookOpen} label="الخطة (أ)" sub="حاسب • مهارات أكاديمية • إنجليزي" color={P.blue2} onClick={() => { setSub("a"); setStep("level3"); }} />
          <PCard Icon={BookOpen} label="الخطة (ب)" sub="رياضيات • مهارات اتصال • إنجليزي" color={P.purple} onClick={() => { setSub("b"); setStep("level3"); }} />
        </div>
      </>}

      {step === "level2" && path === "bachelor" && <>
        <h2 style={{ fontSize: 20, fontWeight: 900, color: t.tx, marginBottom: 16 }}>اختر كليتك</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {TREE.bachelor.colleges.map(c => (
            <PCard key={c.id} Icon={c.icon} label={c.label} sub={`${c.programs.length} تخصصات`} color={c.color} onClick={() => { setSub(c.id); setStep("level3"); }} />
          ))}
        </div>
      </>}

      {step === "level2" && (path === "diploma" || path === "graduate") && <>
        <h2 style={{ fontSize: 20, fontWeight: 900, color: t.tx, marginBottom: 16 }}>
          {path === "diploma" ? "برامج الدبلوم" : "برامج الدراسات العليا"}
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
          {TREE[path].programs.map((p, i) => {
            const Icon = TREE[path].icon;
            const colors = ["#1d4ed8", "#6d28d9", "#065f46", "#be123c", "#b45309", "#0369a1", "#92400e", "#047857", "#7c3aed"];
            return (
              <button key={i} onClick={() => onCourse(p)} style={{
                background: t.s1, border: `1px solid ${t.bd}`, borderRadius: 14, padding: "14px 16px",
                cursor: "pointer", textAlign: "right", display: "flex", alignItems: "center", gap: 12,
                fontFamily: "inherit", transition: "all .2s",
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = colors[i % colors.length] + "60"; e.currentTarget.style.background = t.s2; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = t.bd; e.currentTarget.style.background = t.s1; }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: `${colors[i % colors.length]}15`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Icon size={18} color={colors[i % colors.length]} />
                </div>
                <div style={{ flex: 1, fontSize: 13.5, fontWeight: 700, color: t.tx }}>{p}</div>
                <ChevronLeft size={15} color={t.dim} />
              </button>
            );
          })}
        </div>
      </>}

      {step === "level3" && path === "preparatory" && <>
        <h2 style={{ fontSize: 20, fontWeight: 900, color: t.tx, marginBottom: 16 }}>
          {sub === "a" ? "مواد الفصل الأول" : "مواد الفصل الثاني"}
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          {TREE.preparatory.plans[sub].subjects.map((s, i) => {
            const SIcon = getIcon(s);
            const colors = [P.blue2, P.purple, "#065f46"];
            return (
              <button key={i} onClick={() => onCourse(s)} style={{
                background: t.s1, border: `1px solid ${t.bd}`, borderRadius: 16, padding: "18px 12px",
                cursor: "pointer", textAlign: "center", transition: "all .22s", fontFamily: "inherit",
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = colors[i] + "70"; e.currentTarget.style.transform = "translateY(-2px)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = t.bd; e.currentTarget.style.transform = "none"; }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: `${colors[i]}18`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 10px" }}>
                  <SIcon size={22} color={colors[i]} strokeWidth={1.8} />
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: t.tx }}>{s}</div>
              </button>
            );
          })}
        </div>
      </>}

      {step === "level3" && path === "bachelor" && (() => {
        const col = TREE.bachelor.colleges.find(c => c.id === sub);
        return col && (
          <>
            <h2 style={{ fontSize: 20, fontWeight: 900, color: t.tx, marginBottom: 16 }}>{col.label}</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {col.programs.map((p, i) => {
                const PIcon = getIcon(p);
                return (
                  <button key={i} onClick={() => onCourse(p)} style={{
                    background: t.s1, border: `1px solid ${t.bd}`, borderRadius: 16, padding: "18px 14px",
                    cursor: "pointer", textAlign: "right", transition: "all .22s", fontFamily: "inherit",
                  }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = col.color + "70"; e.currentTarget.style.transform = "translateY(-2px)"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = t.bd; e.currentTarget.style.transform = "none"; }}>
                    <div style={{ width: 42, height: 42, borderRadius: 12, background: `${col.color}18`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
                      <PIcon size={20} color={col.color} strokeWidth={1.8} />
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: t.tx }}>{p}</div>
                  </button>
                );
              })}
            </div>
          </>
        );
      })()}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   FAVORITES PAGE
   ══════════════════════════════════════════════════════════════ */
function FavoritesPage({ favorites, onCourse, toggleFav, t }) {
  if (!favorites.length) {
    return <EmptyState
      Icon={Star}
      title="لا توجد مفضلة"
      desc="أضف المواد التي تهمك بالضغط على أيقونة ⭐ في صفحة المادة"
      t={t} />;
  }
  return (
    <div style={{ animation: "fadeUp .4s ease" }}>
      <h2 style={{ fontSize: 20, fontWeight: 900, color: t.tx, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
        <Star size={18} color={P.gold} fill={P.gold} /> المفضلة ({favorites.length})
      </h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {favorites.map((s, i) => {
          const SIcon = getIcon(s);
          return (
            <div key={i} style={{
              background: t.s1, borderRadius: 16, padding: "14px 16px", border: `1px solid ${t.bd}`,
              display: "flex", alignItems: "center", gap: 12, transition: "all .2s", boxShadow: t.shSm,
            }}
              onMouseEnter={e => e.currentTarget.style.borderColor = P.gold + "50"}
              onMouseLeave={e => e.currentTarget.style.borderColor = t.bd}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: `${P.gold}15`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <SIcon size={22} color={P.gold} strokeWidth={1.8} />
              </div>
              <div style={{ flex: 1, fontSize: 14, fontWeight: 700, color: t.tx, cursor: "pointer" }} onClick={() => onCourse(s)}>{s}</div>
              <button onClick={() => onCourse(s)} style={{
                background: `${P.blue2}15`, border: "none", borderRadius: 10, padding: "7px 14px",
                cursor: "pointer", fontSize: 12, color: P.blue2, fontFamily: "inherit", fontWeight: 600,
                display: "flex", alignItems: "center", gap: 4,
              }}>
                <Eye size={13} /> فتح
              </button>
              <button onClick={() => toggleFav(s)} style={{
                background: "#dc262610", border: "none", borderRadius: 10, padding: 8,
                cursor: "pointer", display: "flex", color: "#dc2626",
              }}>
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   PROFILE / STATS PAGE
   ══════════════════════════════════════════════════════════════ */
function ProfilePage({ t, achievements, recent, favorites, totalSessions, sessionLog, streak, openCourse, openSettings }) {
  const unlocked = ACHIEVEMENTS.filter(a => a.check(achievements));
  const totalMins = sessionLog.reduce((a, s) => a + s.dur, 0);
  const totalHours = Math.floor(totalMins / 60);

  const days = last7Days();
  const dayLabels = ["أحد", "اثن", "ثلا", "أرب", "خمي", "جمع", "سبت"];
  const weekData = days.map(d => sessionLog.filter(s => s.date === d).reduce((a, s) => a + s.dur, 0));
  const maxMin = Math.max(...weekData, 30);

  return (
    <div style={{ animation: "fadeUp .4s ease" }}>
      <div style={{
        background: t.hero, borderRadius: 22, padding: 24, marginBottom: 16,
        position: "relative", overflow: "hidden",
      }}>
        <div style={{ position: "absolute", top: -50, right: -50, width: 180, height: 180, borderRadius: "50%", background: "rgba(255,255,255,.04)" }} />
        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 20, background: `linear-gradient(135deg,${P.gold},#e8bf5c)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: `0 8px 24px ${P.gold}50`,
          }}>
            <User size={32} color="#fff" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: "#fff" }}>طالب SEU</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,.7)", marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>
              <Trophy size={12} color={P.gold} /> {unlocked.length} إنجاز • {totalHours} ساعة دراسة
            </div>
          </div>
          <button onClick={openSettings} style={{
            background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.18)",
            borderRadius: 12, padding: 10, cursor: "pointer", display: "flex", color: "#fff",
          }}>
            <Settings size={18} />
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 16 }}>
        <StatCard Icon={Flame} value={streak} suffix="" label="سلسلة أيام" color={P.orange} t={t} />
        <StatCard Icon={Target} value={totalSessions} suffix="" label="جلسات بومودورو" color={P.blue2} t={t} />
        <StatCard Icon={Star} value={favorites.length} suffix="" label="مادة مفضلة" color={P.gold} t={t} />
      </div>

      <div style={{ background: t.s1, borderRadius: 18, padding: 16, marginBottom: 16, border: `1px solid ${t.bd}`, boxShadow: t.shSm }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: t.tx, display: "flex", alignItems: "center", gap: 6 }}>
            <BarChart2 size={16} color={P.blue2} /> دقائق الدراسة هذا الأسبوع
          </div>
          <div style={{ fontSize: 11, color: t.mu }}>{weekData.reduce((a, b) => a + b, 0)}د إجمالي</div>
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 110 }}>
          {weekData.map((v, i) => {
            const h = Math.max(4, (v / maxMin) * 100);
            const dow = new Date(days[i]).getDay();
            const isToday = days[i] === todayKey();
            return (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <div style={{ fontSize: 9, color: t.dim, fontWeight: 600 }}>{v}</div>
                <div style={{
                  width: "100%", height: `${h}%`, borderRadius: 8,
                  background: isToday ? `linear-gradient(180deg,${P.gold},${P.orange})` : `linear-gradient(180deg,${P.blue2},${P.blue})`,
                  transition: "height .8s ease", boxShadow: isToday ? `0 4px 12px ${P.gold}40` : "none", minHeight: 4,
                }} />
                <div style={{ fontSize: 10, color: isToday ? P.gold : t.mu, fontWeight: isToday ? 700 : 500 }}>{dayLabels[dow]}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: t.tx, display: "flex", alignItems: "center", gap: 6 }}>
            <Trophy size={16} color={P.gold} /> الإنجازات
          </div>
          <div style={{ fontSize: 11, color: t.mu }}>{unlocked.length} / {ACHIEVEMENTS.length}</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
          {ACHIEVEMENTS.map(a => {
            const ok = a.check(achievements);
            return (
              <div key={a.id} style={{
                background: t.s1, borderRadius: 14, padding: 12, border: `1px solid ${ok ? a.color + "50" : t.bd}`,
                textAlign: "center", opacity: ok ? 1 : 0.5, transition: "all .3s",
                position: "relative", overflow: "hidden",
              }}>
                {ok && <div style={{ position: "absolute", top: -10, right: -10, width: 40, height: 40, borderRadius: "50%", background: `${a.color}15` }} />}
                <div style={{
                  width: 40, height: 40, borderRadius: 12, background: ok ? `${a.color}18` : t.s2,
                  display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 8px",
                  position: "relative",
                }}>
                  {ok ? <a.icon size={20} color={a.color} /> : <Lock size={16} color={t.dim} />}
                </div>
                <div style={{ fontSize: 11, fontWeight: 800, color: ok ? t.tx : t.mu, marginBottom: 2 }}>{a.title}</div>
                <div style={{ fontSize: 9, color: t.mu, lineHeight: 1.4 }}>{a.desc}</div>
              </div>
            );
          })}
        </div>
      </div>

      {recent.length > 0 && (
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: t.tx, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
            <History size={15} color={t.mu} /> النشاط الأخير
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {recent.slice(0, 5).map((s, i) => {
              const SIcon = getIcon(s);
              return (
                <button key={i} onClick={() => openCourse(s)} style={{
                  background: t.s1, border: `1px solid ${t.bd}`, borderRadius: 12, padding: "10px 12px",
                  cursor: "pointer", display: "flex", alignItems: "center", gap: 10,
                  fontFamily: "inherit", textAlign: "right", transition: "all .2s",
                }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = P.blue2 + "60"}
                  onMouseLeave={e => e.currentTarget.style.borderColor = t.bd}>
                  <div style={{ width: 32, height: 32, borderRadius: 10, background: `${P.blue2}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <SIcon size={15} color={P.blue2} />
                  </div>
                  <div style={{ flex: 1, fontSize: 13, fontWeight: 700, color: t.tx }}>{s}</div>
                  <ChevronLeft size={14} color={t.dim} />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   NOTIFICATIONS PANEL
   ══════════════════════════════════════════════════════════════ */
function NotifPanel({ t, onClose, notifs, setNotifs }) {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200, display: "flex",
      flexDirection: "column", justifyContent: "flex-end",
      background: "rgba(0,0,0,.4)", backdropFilter: "blur(4px)", animation: "fadeIn .25s ease",
    }} onClick={onClose}>
      <div style={{
        background: t.s1, borderRadius: "24px 24px 0 0", padding: "20px", maxHeight: "80vh",
        overflowY: "auto", boxShadow: "0 -4px 40px rgba(0,0,0,.3)", animation: "slideUp .3s ease",
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h3 style={{ fontSize: 16, fontWeight: 800, color: t.tx, margin: 0 }}>الإشعارات</h3>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setNotifs(n => n.map(x => ({ ...x, read: true })))} style={{
              background: t.s2, border: "none", borderRadius: 10, padding: "6px 12px",
              cursor: "pointer", fontSize: 11, color: t.mu, fontFamily: "inherit",
            }}>قراءة الكل</button>
            <button onClick={onClose} style={{
              background: t.s2, border: "none", borderRadius: 10, padding: 6,
              cursor: "pointer", display: "flex", color: t.mu,
            }}><X size={16} /></button>
          </div>
        </div>
        {notifs.map(n => (
          <div key={n.id} onClick={() => setNotifs(ns => ns.map(x => x.id === n.id ? { ...x, read: true } : x))} style={{
            display: "flex", gap: 12, padding: "12px", borderRadius: 14, marginBottom: 8, cursor: "pointer",
            background: n.read ? t.s1 : t.s2, border: `1px solid ${n.read ? t.bd : P.blue2 + "30"}`, transition: "all .2s",
          }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: `${P.blue}15`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <n.Icon size={16} color={P.blue2} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: t.tx, display: "flex", alignItems: "center", gap: 6 }}>
                {n.title}{!n.read && <span style={{ width: 7, height: 7, borderRadius: "50%", background: P.blue2, display: "inline-block" }} />}
              </div>
              <div style={{ fontSize: 12, color: t.mu, marginTop: 2, lineHeight: 1.5 }}>{n.text}</div>
              <div style={{ fontSize: 10, color: t.dim, marginTop: 4 }}>{n.time}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   SETTINGS PANEL
   ══════════════════════════════════════════════════════════════ */
function SettingsPanel({ t, onClose, dark, setDark, soundOn, setSoundOn, weeklyGoal, setWeeklyGoal, onReset, onToast }) {
  const [showConfirm, setShowConfirm] = useState(false);
  const Row = ({ Icon, label, desc, children, color = P.blue2 }) => (
    <div style={{
      background: t.s2, borderRadius: 14, padding: "14px 16px", marginBottom: 8,
      display: "flex", alignItems: "center", gap: 12,
    }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: `${color}15`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon size={16} color={color} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: t.tx }}>{label}</div>
        {desc && <div style={{ fontSize: 11, color: t.mu, marginTop: 2 }}>{desc}</div>}
      </div>
      {children}
    </div>
  );
  const Toggle = ({ on, onChange }) => (
    <button onClick={() => onChange(!on)} style={{
      width: 44, height: 24, borderRadius: 12, background: on ? P.blue2 : t.s4,
      border: "none", cursor: "pointer", position: "relative", transition: "background .2s",
    }}>
      <div style={{
        position: "absolute", top: 2, [on ? "right" : "left"]: 2,
        width: 20, height: 20, borderRadius: "50%", background: "#fff",
        transition: "all .25s", boxShadow: "0 2px 4px rgba(0,0,0,.2)",
      }} />
    </button>
  );

  return (
    <>
      <div style={{
        position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,.5)",
        backdropFilter: "blur(4px)", animation: "fadeIn .25s ease",
        display: "flex", flexDirection: "column", justifyContent: "flex-end",
      }} onClick={onClose}>
        <div style={{
          background: t.s1, borderRadius: "24px 24px 0 0", padding: 20,
          maxHeight: "85vh", overflowY: "auto", animation: "slideUp .3s ease",
        }} onClick={e => e.stopPropagation()}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
            <h3 style={{ fontSize: 17, fontWeight: 800, color: t.tx, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
              <Settings size={18} color={P.blue2} /> الإعدادات
            </h3>
            <button onClick={onClose} style={{ background: t.s2, border: "none", borderRadius: 10, padding: 6, cursor: "pointer", display: "flex", color: t.mu }}>
              <X size={16} />
            </button>
          </div>

          <Row Icon={dark ? Moon : Sun} label="المظهر" desc={dark ? "الوضع الليلي" : "الوضع النهاري"}>
            <Toggle on={dark} onChange={setDark} />
          </Row>

          <Row Icon={soundOn ? Volume2 : VolumeX} label="أصوات المؤقت" desc="تنبيه صوتي عند انتهاء الجلسة" color={P.green}>
            <Toggle on={soundOn} onChange={setSoundOn} />
          </Row>

          <div style={{ background: t.s2, borderRadius: 14, padding: "14px 16px", marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: `${P.orange}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Target size={16} color={P.orange} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: t.tx }}>الهدف الأسبوعي</div>
                <div style={{ fontSize: 11, color: t.mu, marginTop: 2 }}>{weeklyGoal} جلسة بومودورو/أسبوع</div>
              </div>
            </div>
            <input type="range" min={3} max={50} value={weeklyGoal}
              onChange={e => setWeeklyGoal(+e.target.value)}
              style={{ width: "100%", accentColor: P.orange }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: t.dim, marginTop: 4 }}>
              <span>3</span><span>50</span>
            </div>
          </div>

          <div style={{ height: 1, background: t.bd, margin: "16px 0" }} />

          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 4px", marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: t.tx }}>حول التطبيق</div>
              <div style={{ fontSize: 11, color: t.mu, marginTop: 2 }}>حلول SEU • الإصدار 2.0</div>
            </div>
            <div style={{ background: `${P.blue2}15`, borderRadius: 8, padding: "3px 8px", fontSize: 10, color: P.blue2, fontWeight: 700 }}>PRO</div>
          </div>

          <Btn variant="danger" onClick={() => setShowConfirm(true)} style={{ width: "100%" }}>
            <Trash2 size={14} /> إعادة تعيين كل البيانات
          </Btn>
        </div>
      </div>

      <ConfirmDialog
        open={showConfirm}
        title="إعادة تعيين البيانات"
        desc="سيتم حذف جميع المفضلات والملاحظات والإحصائيات والإعدادات. هل أنت متأكد؟"
        onConfirm={() => { onReset(); onClose(); onToast?.("تم إعادة تعيين جميع البيانات", "info"); }}
        onClose={() => setShowConfirm(false)}
        danger
        t={t}
      />
    </>
  );
}

/* ══════════════════════════════════════════════════════════════
   ONBOARDING
   ══════════════════════════════════════════════════════════════ */
function Onboarding({ onClose, t }) {
  const [step, setStep] = useState(0);
  const steps = [
    { Icon: Sparkles, color: P.blue2, title: "مرحباً في حلول", desc: "بوابتك الأكاديمية الذكية للجامعة السعودية الإلكترونية. كل ما تحتاجه للدراسة في مكان واحد." },
    { Icon: BookOpen, color: P.purple, title: "تجميعات وملخصات", desc: "ادخل إلى تجميعات الاختبارات، الخطط الدراسية، والملاحظات الشاملة لكل مادة." },
    { Icon: Sparkles, color: P.gold, title: "مساعد ذكي", desc: "اسأل الذكاء الاصطناعي عن أي شيء يخص مادتك واحصل على إجابات فورية." },
    { Icon: Trophy, color: P.orange, title: "تتبّع تقدّمك", desc: "احسب معدلك، استخدم مؤقت بومودورو، واجمع الإنجازات أثناء رحلتك الأكاديمية." },
  ];
  const s = steps[step];
  const last = step === steps.length - 1;
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,.6)",
      backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center",
      padding: 20, animation: "fadeIn .3s ease",
    }}>
      <div style={{
        background: t.s1, borderRadius: 24, padding: 28, maxWidth: 380, width: "100%",
        textAlign: "center", boxShadow: t.sh, border: `1px solid ${t.bd}`, animation: "scaleIn .35s ease",
      }}>
        <div style={{
          width: 80, height: 80, borderRadius: 24, background: `linear-gradient(135deg,${s.color},${s.color}aa)`,
          display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 18px",
          boxShadow: `0 8px 28px ${s.color}40`,
        }}>
          <s.Icon size={40} color="#fff" strokeWidth={1.6} />
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 900, color: t.tx, marginBottom: 10 }}>{s.title}</h2>
        <p style={{ fontSize: 14, color: t.mu, lineHeight: 1.8, marginBottom: 22 }}>{s.desc}</p>
        <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 20 }}>
          {steps.map((_, i) => (
            <div key={i} style={{
              width: i === step ? 24 : 8, height: 8, borderRadius: 4,
              background: i === step ? s.color : t.s3, transition: "all .3s",
            }} />
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {step > 0 && <Btn variant="ghost" onClick={() => setStep(step - 1)} style={{ flex: 1 }}>
            السابق
          </Btn>}
          <Btn variant="primary" onClick={() => last ? onClose() : setStep(step + 1)} style={{ flex: 1 }}>
            {last ? <><CheckCircle size={15} /> ابدأ</> : <>التالي <ChevronLeft size={15} /></>}
          </Btn>
        </div>
        <button onClick={onClose} style={{
          background: "none", border: "none", color: t.dim, fontSize: 12,
          cursor: "pointer", marginTop: 16, fontFamily: "inherit",
        }}>
          تخطي
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   SEU LINKS PAGE
   ══════════════════════════════════════════════════════════════ */
const SEU_LINKS = [
  {
    group: "البوابات الأساسية",
    color: P.blue2,
    items: [
      { label: "نظام التعلم الإلكتروني (Blackboard)", desc: "المقررات والواجبات والدرجات", url: "https://lms.seu.edu.sa", Icon: Monitor, color: "#1d4ed8" },
      { label: "بوابة الطالب (ERP Gate)", desc: "الجداول والسجلات والخدمات الأكاديمية", url: "https://erpgate.seu.edu.sa", Icon: GraduationCap, color: "#6d28d9" },
      { label: "تسجيل الدخول الموحد (SSO)", desc: "الدخول لجميع أنظمة الجامعة", url: "https://sso.seu.edu.sa/SEUSSO/pages/login.jsp", Icon: Building2, color: "#065f46" },
      { label: "الموقع الرسمي للجامعة", desc: "الأخبار والإعلانات الرسمية", url: "https://www.seu.edu.sa", Icon: Globe, color: "#0369a1" },
    ],
  },
  {
    group: "الخدمات الأكاديمية",
    color: P.purple,
    items: [
      { label: "المكتبة الرقمية السعودية (SDL)", desc: "الكتب والمراجع والأبحاث الأكاديمية", url: "https://sdl.edu.sa/SDLPortal/ar/login.aspx", Icon: BookOpen, color: "#be123c" },
      { label: "البريد الإلكتروني الجامعي", desc: "بريد @seu.edu.sa عبر Office 365", url: "https://sso.seu.edu.sa/SEUOffice365SSO/pages/login.jsp", Icon: Mail, color: "#0369a1" },
      { label: "بوابة القبول والتسجيل", desc: "التسجيل وقبول الطلاب الجدد", url: "https://admission.seu.edu.sa", Icon: CheckCircle, color: "#0891b2" },
      { label: "التقويم الأكاديمي", desc: "مواعيد الفصول والاختبارات والتسجيل", url: "https://www.seu.edu.sa/en/academic-calendar/1448/", Icon: Calendar, color: "#d97706" },
    ],
  },
  {
    group: "الخدمات المالية والإدارية",
    color: P.green,
    items: [
      { label: "الرسوم الدراسية والدفع", desc: "سداد الرسوم وعرض الكشوف", url: "https://erpgate.seu.edu.sa", Icon: CreditCard, color: "#059669" },
      { label: "خدمات وحدة التسجيل", desc: "إضافة/حذف/اعتراض على المقررات", url: "https://www.seu.edu.sa/aasa/ar/registeration/", Icon: FileText, color: "#c8a84b" },
      { label: "الكلية التطبيقية", desc: "بوابة طلاب الكلية التطبيقية", url: "https://ac.seu.edu.sa/ar/login", Icon: Award, color: "#92400e" },
    ],
  },
  {
    group: "الدعم والتواصل",
    color: "#be123c",
    items: [
      { label: "مركز الدعم الفني", desc: "هاتف: 011-2613500", url: "tel:0112613500", Icon: Phone, color: "#be123c" },
      { label: "الأسئلة الشائعة (FAQ)", desc: "إجابات على أبرز الاستفسارات", url: "https://www.seu.edu.sa/ar/faqs/", Icon: HelpCircle, color: "#ea580c" },
      { label: "حساب الجامعة في X", desc: "@Saudi_EUni", url: "https://x.com/Saudi_EUni", Icon: Radio, color: "#1d4ed8" },
      { label: "تطبيق SEU على المتجر", desc: "تحميل تطبيق الجوال الرسمي", url: "https://play.google.com/store/apps/details?id=com.seu.services", Icon: Newspaper, color: "#065f46" },
    ],
  },
];

function SEULinksPage({ t }) {
  const [copied, setCopied] = useState(null);

  const openLink = (url, label) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const copyPhone = (e) => {
    e.stopPropagation();
    navigator.clipboard?.writeText("0112613500").then(() => {
      setCopied("phone");
      setTimeout(() => setCopied(null), 2000);
    });
  };

  return (
    <div style={{ animation: "fadeUp .4s ease" }}>
      {/* Header */}
      <div style={{
        background: `linear-gradient(135deg, #001030 0%, #002470 45%, #1a1f7a 100%)`,
        borderRadius: 22, padding: "22px 20px", marginBottom: 20,
        position: "relative", overflow: "hidden",
      }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 160, height: 160, borderRadius: "50%", background: "rgba(255,255,255,.03)" }} />
        <div style={{ position: "absolute", bottom: -20, left: -10, width: 100, height: 100, borderRadius: "50%", background: `${P.gold}10` }} />
        <div style={{ display: "flex", alignItems: "center", gap: 14, position: "relative" }}>
          <div style={{
            width: 52, height: 52, borderRadius: 16,
            background: "linear-gradient(135deg,#001f5a,#0038b8)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: `0 6px 20px ${P.blue}50`,
          }}>
            <GraduationCap size={24} color="#fff" />
          </div>
          <div>
            <div style={{ color: "#fff", fontSize: 18, fontWeight: 900, lineHeight: 1.2 }}>روابط الجامعة السعودية الإلكترونية</div>
            <div style={{ color: P.gold, fontSize: 11, marginTop: 4 }}>Saudi Electronic University — SEU</div>
          </div>
        </div>
        <div style={{
          marginTop: 16, background: "rgba(255,255,255,.07)", borderRadius: 12,
          padding: "10px 14px", display: "flex", alignItems: "center", gap: 10,
        }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#4ade80", boxShadow: "0 0 8px #4ade80", flexShrink: 0 }} />
          <div style={{ color: "rgba(255,255,255,.8)", fontSize: 12, lineHeight: 1.6 }}>
            جميع الروابط تفتح الموقع الرسمي — تأكد من تسجيل دخولك بالحساب الجامعي
          </div>
        </div>
      </div>

      {/* Quick access numbers */}
      <div style={{
        background: t.s1, borderRadius: 16, padding: 14, marginBottom: 16,
        border: `1px solid ${t.bd}`, display: "flex", gap: 10,
      }}>
        <div style={{ flex: 1, textAlign: "center" }}>
          <div style={{ fontSize: 11, color: t.mu, marginBottom: 2 }}>الدعم الفني</div>
          <div style={{ fontSize: 16, fontWeight: 900, color: P.blue2, direction: "ltr" }}>011-2613500</div>
        </div>
        <div style={{ width: 1, background: t.bd }} />
        <div style={{ flex: 1, textAlign: "center" }}>
          <div style={{ fontSize: 11, color: t.mu, marginBottom: 2 }}>ساعات الدعم</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: t.tx }}>8 ص – 8 م</div>
        </div>
        <div style={{ width: 1, background: t.bd }} />
        <div style={{ flex: 1, textAlign: "center" }}>
          <div style={{ fontSize: 11, color: t.mu, marginBottom: 2 }}>أيام العمل</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: t.tx }}>الأحد – الخميس</div>
        </div>
      </div>

      {/* Link groups */}
      {SEU_LINKS.map((group, gi) => (
        <div key={gi} style={{ marginBottom: 18 }}>
          <div style={{
            fontSize: 12, fontWeight: 800, color: group.color,
            marginBottom: 10, paddingRight: 4,
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <div style={{ width: 3, height: 14, borderRadius: 2, background: group.color }} />
            {group.group}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {group.items.map((item, ii) => (
              <button key={ii} onClick={() => openLink(item.url, item.label)}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "13px 14px", background: t.s1, borderRadius: 14,
                  border: `1px solid ${t.bd}`, cursor: "pointer", width: "100%",
                  textAlign: "right", fontFamily: "inherit",
                  transition: "all .2s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = item.color + "60"; e.currentTarget.style.background = item.color + "08"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = t.bd; e.currentTarget.style.background = t.s1; }}
              >
                <div style={{
                  width: 42, height: 42, borderRadius: 12, flexShrink: 0,
                  background: item.color + "18",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <item.Icon size={18} color={item.color} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: t.tx, marginBottom: 2 }}>{item.label}</div>
                  <div style={{ fontSize: 11, color: t.mu }}>{item.desc}</div>
                </div>
                <ExternalLink size={14} color={t.dim} style={{ flexShrink: 0 }} />
              </button>
            ))}
          </div>
        </div>
      ))}

      {/* Footer note */}
      <div style={{
        background: `${P.blue2}10`, border: `1px solid ${P.blue2}25`,
        borderRadius: 12, padding: "12px 14px", marginBottom: 8,
        display: "flex", gap: 10, alignItems: "flex-start",
      }}>
        <Shield size={16} color={P.blue2} style={{ flexShrink: 0, marginTop: 1 }} />
        <div style={{ fontSize: 12, color: t.mu, lineHeight: 1.7 }}>
          هذه الروابط تأخذك للمواقع الرسمية للجامعة السعودية الإلكترونية. لا تشارك كلمة مرورك مع أي طرف آخر.
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN APP
   ══════════════════════════════════════════════════════════════ */
export default function App() {
  const [dark, setDark] = useStored("dark", true);
  const [tab, setTab] = useState("home");
  const [course, setCourse] = useState(null);
  const [favorites, setFavorites] = useStored("favorites", []);
  const [notifs, setNotifs] = useStored("notifs", NOTIFS_SEED);
  const [notes, setNotes] = useStored("notes", {});
  const [recent, setRecent] = useStored("recent", []);
  const [totalSessions, setTotalSessions] = useStored("totalSessions", 0);
  const [sessionLog, setSessionLog] = useStored("sessionLog", []);
  const [gpaCalcs, setGpaCalcs] = useStored("gpaCalcs", 0);
  const [aiChats, setAiChats] = useStored("aiChats", 0);
  const [semesters, setSemesters] = useStored("semesters", []);
  const [soundOn, setSoundOn] = useStored("soundOn", true);
  const [weeklyGoal, setWeeklyGoal] = useStored("weeklyGoal", 15);
  const [seen, setSeen] = useStored("onboarded", false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showOnboard, setShowOnboard] = useState(!seen);
  const t = T(dark);
  const toasts = useToasts();
  const unread = notifs.filter(n => !n.read).length;

  const activeDays = useMemo(() => {
    const dates = new Set(sessionLog.map(s => s.date));
    return [...dates];
  }, [sessionLog]);

  const streak = useMemo(() => {
    const dates = new Set(sessionLog.map(s => s.date));
    let count = 0;
    const d = new Date();
    while (true) {
      const key = d.toISOString().slice(0, 10);
      if (dates.has(key)) { count++; d.setDate(d.getDate() - 1); }
      else if (count === 0 && key === todayKey()) {
        d.setDate(d.getDate() - 1);
        if (dates.has(d.toISOString().slice(0, 10))) { count++; d.setDate(d.getDate() - 1); }
        else break;
      } else break;
    }
    return count;
  }, [sessionLog]);

  const prevStreakRef = useRef(null);
  useEffect(() => {
    if (prevStreakRef.current === null) { prevStreakRef.current = streak; return; }
    const prev = prevStreakRef.current;
    prevStreakRef.current = streak;
    const milestones = { 3: "🔥 3 أيام متواصلة! استمر!", 7: "⚡ أسبوع كامل! أنت رائع!", 14: "💪 أسبوعان! إنجاز حقيقي!", 30: "🏆 شهر كامل! أسطوري!" };
    if (streak > prev && milestones[streak]) toasts.push(milestones[streak], "success");
  }, [streak]);

  const weekProgress = useMemo(() => {
    const days = last7Days();
    return sessionLog.filter(s => days.includes(s.date)).length;
  }, [sessionLog]);

  const openCourse = (s) => {
    setCourse(s);
    setTab("course");
    setRecent(prev => [s, ...prev.filter(x => x !== s)].slice(0, 12));
  };

  const toggleFav = (s) => {
    setFavorites(prev => {
      const exists = prev.includes(s);
      toasts.push(exists ? `أُزيلت ${s} من المفضلة` : `أُضيفت ${s} للمفضلة`, exists ? "info" : "success");
      return exists ? prev.filter(x => x !== s) : [...prev, s];
    });
  };

  const resetAll = () => {
    storage.clear();
    setDark(true); setFavorites([]); setNotifs(NOTIFS_SEED); setNotes({}); setRecent([]);
    setTotalSessions(0); setSessionLog([]); setGpaCalcs(0); setAiChats(0); setSemesters([]);
    setSoundOn(true); setWeeklyGoal(15); setSeen(false);
    setTab("home"); setCourse(null);
  };

  const finishOnboard = () => { setSeen(true); setShowOnboard(false); };

  const achievementsState = { viewed: recent, favorites, totalSessions, gpaCalcs, streak, notes, aiChats };

  const TABS = [
    { id: "home", Icon: Home, label: "الرئيسية" },
    { id: "explore", Icon: Compass, label: "استكشاف" },
    { id: "fav", Icon: Star, label: "المفضلة" },
    { id: "links", Icon: Link2, label: "روابط SEU" },
    { id: "timer", Icon: AlarmClock, label: "مؤقت" },
    { id: "profile", Icon: User, label: "حسابي" },
  ];

  return (
    <div dir="rtl" style={{
      fontFamily: "'Tajawal','Cairo',sans-serif", minHeight: "100vh",
      background: t.bgMesh, color: t.tx, paddingBottom: 80,
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&family=Reem+Kufi:wght@500;700&display=swap');
        @keyframes fadeUp { from { opacity:0; transform:translateY(18px) } to { opacity:1; transform:translateY(0) } }
        @keyframes fadeIn { from { opacity:0 } to { opacity:1 } }
        @keyframes slideUp { from { transform:translateY(100%) } to { transform:translateY(0) } }
        @keyframes scaleIn { from { opacity:0; transform:scale(.92) } to { opacity:1; transform:scale(1) } }
        @keyframes bounce { 0%,80%,100% { transform:translateY(0) } 40% { transform:translateY(-7px) } }
        @keyframes pulse { 0%,100% { opacity:.5 } 50% { opacity:.85 } }
        @keyframes toastIn { from { opacity:0; transform:translateY(20px) } to { opacity:1; transform:translateY(0) } }
        * { box-sizing:border-box; margin:0; padding:0 }
        ::-webkit-scrollbar { width:5px; height:5px }
        ::-webkit-scrollbar-thumb { background:${P.blue}40; border-radius:3px }
        ::-webkit-scrollbar-track { background:transparent }
        #bottom-nav::-webkit-scrollbar { display:none }
        input[type=range] { -webkit-appearance:none; height:5px; border-radius:3px; background:${t.bd}; outline:none }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance:none; width:16px; height:16px; border-radius:50%; cursor:pointer; background:${P.blue2}; box-shadow:0 2px 6px rgba(0,0,0,.3) }
      `}</style>

      {/* HEADER */}
      <div style={{
        position: "sticky", top: 0, zIndex: 100,
        background: dark ? "rgba(7,16,31,.92)" : "rgba(238,243,255,.92)",
        backdropFilter: "blur(16px)", borderBottom: `1px solid ${t.bd}`,
        padding: "12px 16px", display: "flex", alignItems: "center", gap: 10,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 12,
          background: `linear-gradient(135deg,${P.navy},${P.blue})`,
          display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
          boxShadow: `0 4px 12px ${P.blue}40`,
        }} onClick={() => { setTab("home"); setCourse(null); }}>
          <GraduationCap size={18} color="#fff" strokeWidth={2} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 900, color: t.tx, lineHeight: 1 }}>حلول</div>
          <div style={{ fontSize: 10, color: t.mu }}>SEU • الجامعة السعودية الإلكترونية</div>
        </div>
        <button onClick={() => setSearchOpen(true)} style={{
          background: t.s2, border: `1px solid ${t.bd}`, borderRadius: 10,
          padding: 8, cursor: "pointer", display: "flex", color: t.mu,
        }}>
          <Search size={16} />
        </button>
        <button onClick={() => setDark(d => !d)} title={dark ? "الوضع النهاري" : "الوضع الليلي"} style={{
          background: dark ? `${P.gold}18` : `${P.blue2}15`,
          border: `1px solid ${dark ? P.gold + "40" : P.blue2 + "40"}`,
          borderRadius: 10, padding: 8, cursor: "pointer", display: "flex",
          color: dark ? P.gold : P.blue2, transition: "all .25s",
        }}>
          {dark ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <button onClick={() => setNotifOpen(true)} style={{
          position: "relative", background: t.s2, border: `1px solid ${t.bd}`,
          borderRadius: 10, padding: 8, cursor: "pointer", display: "flex", color: t.mu,
        }}>
          <Bell size={16} />
          {unread > 0 && <span style={{
            position: "absolute", top: -4, right: -4, width: 16, height: 16, borderRadius: "50%",
            background: P.blue2, display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 9, fontWeight: 900, color: "#fff",
          }}>{unread}</span>}
        </button>
      </div>

      {/* MAIN */}
      <div style={{ maxWidth: 620, margin: "0 auto", padding: "18px 16px" }}>
        {tab === "home" && <HomePage
          setActiveTab={(t) => { setTab(t); setCourse(null); }}
          openCourse={openCourse} t={t} recent={recent} streak={streak}
          activeDays={activeDays} weeklyGoal={weeklyGoal} weekProgress={weekProgress}
          achievements={achievementsState} sessionLog={sessionLog} semesters={semesters} />}

        {tab === "explore" && !course && <ExplorePage onCourse={openCourse} t={t} />}

        {tab === "course" && course && <CoursePage
          subject={course} favorites={favorites} toggleFav={toggleFav}
          notes={notes} setNotes={setNotes} t={t}
          onChat={() => setAiChats(c => c + 1)} onToast={toasts.push}
          onBack={() => { setCourse(null); setTab("explore"); }} />}

        {tab === "fav" && <FavoritesPage favorites={favorites} onCourse={openCourse} toggleFav={toggleFav} t={t} />}

        {tab === "links" && <SEULinksPage t={t} />}

        {tab === "gpa" && (
          <div style={{ animation: "fadeUp .4s ease" }}>
            <h2 style={{ fontSize: 20, fontWeight: 900, color: t.tx, marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
              <Calculator size={20} color={P.blue2} /> حاسبة المعدل الأكاديمي
            </h2>
            <GPACalc t={t} onCalc={() => setGpaCalcs(c => c + 1)}
              semesters={semesters} setSemesters={setSemesters} onToast={toasts.push} />
          </div>
        )}

        {tab === "timer" && (
          <div style={{ animation: "fadeUp .4s ease" }}>
            <h2 style={{ fontSize: 20, fontWeight: 900, color: t.tx, marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
              <AlarmClock size={20} color={P.blue2} /> مؤقت الدراسة
            </h2>
            <PomodoroTimer t={t} sessionLog={sessionLog} setSessionLog={setSessionLog}
              totalSessions={totalSessions} setTotalSessions={setTotalSessions}
              soundOn={soundOn} onToast={toasts.push} />
          </div>
        )}

        {tab === "profile" && <ProfilePage
          t={t} achievements={achievementsState} recent={recent}
          favorites={favorites} totalSessions={totalSessions}
          sessionLog={sessionLog} streak={streak}
          openCourse={openCourse} openSettings={() => setSettingsOpen(true)} />}
      </div>

      {/* BOTTOM NAV */}
      <div id="bottom-nav" style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 100,
        background: dark ? "rgba(7,16,31,.95)" : "rgba(255,255,255,.95)",
        backdropFilter: "blur(20px)", borderTop: `1px solid ${t.bd}`,
        overflowX: "auto", WebkitOverflowScrolling: "touch",
        scrollbarWidth: "none", padding: "8px 8px 12px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 2, minWidth: "max-content", margin: "0 auto", justifyContent: "center" }}>
        {TABS.map(({ id, Icon, label }) => {
          const active = id === "explore" ? (tab === "explore" || tab === "course") : tab === id;
          return (
            <button key={id} onClick={() => { setTab(id); if (id !== "explore") setCourse(null); }}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                background: "none", border: "none", cursor: "pointer", padding: "4px 10px",
                transition: "all .2s", fontFamily: "inherit", flexShrink: 0,
              }}>
              <div style={{
                width: 36, height: 36, borderRadius: 12,
                background: active ? `linear-gradient(135deg,${P.blue},${P.blue2})` : "transparent",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all .25s", boxShadow: active ? `0 4px 14px ${P.blue}50` : "none",
              }}>
                <Icon size={18} color={active ? "#fff" : t.dim} strokeWidth={active ? 2.5 : 1.8} />
              </div>
              <span style={{ fontSize: 10, fontWeight: active ? 700 : 500, color: active ? P.blue2 : t.dim, whiteSpace: "nowrap" }}>{label}</span>
            </button>
          );
        })}
        </div>
      </div>

      {/* PANELS / MODALS */}
      {notifOpen && <NotifPanel t={t} onClose={() => setNotifOpen(false)} notifs={notifs} setNotifs={setNotifs} />}
      {settingsOpen && <SettingsPanel t={t} onClose={() => setSettingsOpen(false)}
        dark={dark} setDark={setDark} soundOn={soundOn} setSoundOn={setSoundOn}
        weeklyGoal={weeklyGoal} setWeeklyGoal={setWeeklyGoal}
        onReset={resetAll} onToast={toasts.push} />}
      {searchOpen && <SearchOverlay t={t} onClose={() => { setSearchOpen(false); setSearchQuery(""); }}
        query={searchQuery} setQuery={setSearchQuery} onCourse={openCourse} />}
      {showOnboard && <Onboarding onClose={finishOnboard} t={t} />}
      <ToastStack list={toasts.list} />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   SEARCH OVERLAY (with input bar)
   ══════════════════════════════════════════════════════════════ */
function SearchOverlay({ query, setQuery, onCourse, onClose, t }) {
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", zIndex: 220,
      backdropFilter: "blur(8px)", animation: "fadeIn .2s ease",
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        maxWidth: 620, margin: "60px auto 0", padding: "0 16px", animation: "scaleIn .25s ease",
      }}>
        <div style={{
          background: t.s1, borderRadius: 20, border: `1px solid ${t.bd}`,
          boxShadow: t.sh, overflow: "hidden",
        }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 10, padding: "14px 16px",
            borderBottom: `1px solid ${t.bd}`,
          }}>
            <Search size={18} color={t.mu} />
            <input ref={ref} value={query} onChange={e => setQuery(e.target.value)}
              placeholder="ابحث عن مادة، تخصص، أو برنامج..."
              style={{
                flex: 1, border: "none", outline: "none", fontSize: 14, color: t.tx,
                background: "transparent", fontFamily: "inherit", direction: "rtl",
              }} />
            {query && <button onClick={() => setQuery("")} style={{
              background: t.s2, border: "none", borderRadius: 8, padding: 4,
              cursor: "pointer", display: "flex", color: t.mu,
            }}><X size={14} /></button>}
            <button onClick={onClose} style={{
              background: t.s2, border: "none", borderRadius: 8, padding: "5px 10px",
              cursor: "pointer", fontSize: 11, color: t.mu, fontFamily: "inherit",
            }}>إلغاء</button>
          </div>

          <div style={{ padding: 12, maxHeight: "60vh", overflowY: "auto" }}>
            {!query.trim() ? (
              <div style={{ textAlign: "center", padding: "30px 20px" }}>
                <div style={{
                  width: 56, height: 56, borderRadius: "50%", background: t.s2,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  margin: "0 auto 12px",
                }}>
                  <Search size={26} color={t.dim} />
                </div>
                <div style={{ fontSize: 13, color: t.mu, marginBottom: 8 }}>ابدأ الكتابة للبحث</div>
                <div style={{ fontSize: 11, color: t.dim }}>أكثر من {ALL_COURSES.length} مادة وتخصص</div>
              </div>
            ) : (() => {
              const q = query.trim().toLowerCase();
              const results = ALL_COURSES.filter(c => c.toLowerCase().includes(q));
              if (!results.length) return (
                <div style={{ textAlign: "center", padding: 30, color: t.mu, fontSize: 13 }}>
                  لا توجد نتائج لـ "{query}"
                </div>
              );
              return (
                <>
                  <div style={{ fontSize: 11, color: t.mu, marginBottom: 8, padding: "0 4px" }}>
                    {results.length} نتيجة
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {results.map((s, i) => {
                      const SIcon = getIcon(s);
                      return (
                        <button key={i} onClick={() => { onCourse(s); onClose(); }} style={{
                          background: t.s2, border: `1px solid ${t.bd}`, borderRadius: 12,
                          padding: "11px 13px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12,
                          fontFamily: "inherit", textAlign: "right", transition: "all .2s",
                        }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = P.blue2; }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = t.bd; }}>
                          <div style={{ width: 34, height: 34, borderRadius: 10, background: `${P.blue2}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <SIcon size={15} color={P.blue2} />
                          </div>
                          <div style={{ flex: 1, fontSize: 13, fontWeight: 700, color: t.tx }}>{s}</div>
                          <ChevronLeft size={14} color={t.dim} />
                        </button>
                      );
                    })}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}
