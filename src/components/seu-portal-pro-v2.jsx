'use client'
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLiveNotifications } from "@/lib/hooks/useLiveNotifications";
import {
  Home, Search, Star, Calculator, Bell, Moon, Sun, ChevronRight,
  ChevronDown, Book, FileText, MessageCircle, Phone, Play, Pause,
  RotateCcw, Award, TrendingUp, Users, CheckCircle, X, Plus, Copy,
  Minus, Calendar, ArrowLeft, GraduationCap, Eye, Download,
  Bookmark, Zap, BarChart2, BookOpen, AlarmClock, Monitor,
  Briefcase, Globe, Code, Trophy, Flag, Coffee, Target,
  Heart, Clock, Layers, Activity, Wifi, Settings, User,
  Volume2, VolumeX, Flame, Edit3, Check, Trash2, Save,
  Sparkles, Lock, Send, ChevronLeft, Share2, History,
  PenLine, Compass, Lightbulb, Shield, ArrowUpRight, Hash,
  ExternalLink, Link2, GraduationCap as GradCap, Mail, Library,
  CreditCard, HelpCircle, Newspaper, Radio, Building2,
  AlertTriangle, PartyPopper, Zap as Lightning, CalendarDays, CircleUser,
  Mic, MicOff, FileQuestion, BarChart, Brain, FileBarChart, LogOut
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
  bg: d ? "#070d1b" : "#eef3ff",
  bgMesh: d
    ? "radial-gradient(ellipse 80% 60% at 50% -5%, rgba(37,99,235,0.22) 0%, transparent 55%), radial-gradient(ellipse 55% 45% at 5% 95%, rgba(200,168,75,0.10) 0%, transparent 45%), radial-gradient(ellipse 50% 40% at 95% 55%, rgba(124,58,237,0.07) 0%, transparent 45%), #070d1b"
    : "radial-gradient(ellipse 70% 50% at 50% -10%, rgba(26,86,219,0.12) 0%, transparent 60%), radial-gradient(ellipse 50% 40% at 100% 100%, rgba(200,168,75,0.08) 0%, transparent 50%), #eef3ff",
  s1: d ? "#0e1828" : "#ffffff",
  s2: d ? "#162136" : "#f5f8ff",
  s3: d ? "#1e2e47" : "#eaf0ff",
  s4: d ? "#283d5e" : "#dde6f7",
  bd: d ? "rgba(99,130,175,0.16)" : "#d8e3f5",
  tx: d ? "#f0f4ff" : "#0a1428",
  mu: d ? "#8599bf" : "#5a6e8a",
  dim: d ? "#485d80" : "#9aaac0",
  sh: d ? "0 10px 40px rgba(0,0,0,.65), 0 2px 12px rgba(0,0,0,.45)" : "0 8px 40px rgba(0,50,140,.10), 0 2px 10px rgba(0,50,140,.05)",
  shSm: d ? "0 4px 18px rgba(0,0,0,.5), 0 1px 4px rgba(0,0,0,.3)" : "0 4px 16px rgba(0,50,140,.07)",
  grad: d ? `linear-gradient(135deg,#0e1828,#162136)` : `linear-gradient(135deg,#f5f8ff,#eaf0ff)`,
  hero: d
    ? `linear-gradient(135deg, #060c1a 0%, #0b1e42 45%, #142257 100%)`
    : `linear-gradient(135deg, #001f5a 0%, #003299 55%, #1a56db 100%)`,
  inp: d ? "#0e1828" : "#ffffff",
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

/* XP Level helper */
function getXpLevel(xp) {
  if (xp >= 5000) return { name: "أستاذ", stars: "⭐⭐⭐⭐⭐", next: null, min: 5000 };
  if (xp >= 3000) return { name: "خبير", stars: "⭐⭐⭐⭐", next: 5000, min: 3000 };
  if (xp >= 1500) return { name: "متقدم", stars: "⭐⭐⭐", next: 3000, min: 1500 };
  if (xp >= 500) return { name: "متوسط", stars: "⭐⭐", next: 1500, min: 500 };
  return { name: "مبتدئ", stars: "⭐", next: 500, min: 0 };
}

const ALL_SUBJECTS_LIST = (() => {
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
  "القراءة بالصوت العالي تُحسّن الحفظ بنسبة 50% مقارنةً بالقراءة الصامتة",
  "راجع الوحدة الجديدة بعد ساعة من تعلمها لترسيخها في الذاكرة طويلة المدى",
  "استخدم بطاقات التعلم (Flashcards) لحفظ التعريفات والمصطلحات بسرعة",
  "فصل الهاتف عنك أثناء الدراسة يرفع إنتاجيتك بنسبة 26% تقريباً",
  "كتابة الملاحظات بخط اليد تُحسّن الفهم العميق أكثر من الطباعة",
  "حل أسئلة الاختبارات القديمة هو أفضل طريقة للتحضير للاختبار",
  "ابدأ المشاريع مبكراً — يوم واحد إضافي يصنع فارقاً كبيراً",
  "ضع أهدافاً صغيرة لكل جلسة دراسية لتشعر بالإنجاز والدافعية",
  "لا تدرس وأنت متعب — خذ قيلولة 20 دقيقة ثم عد بتركيز كامل",
  "اربط المادة الجديدة بشيء تعرفه مسبقاً لتسهيل الاسترجاع",
  "أخذ استراحة رياضية 10 دقائق يُنشّط الدماغ ويرفع التركيز",
  "راجع المادة قبل النوم مباشرة — الدماغ يُعزّز المعلومات أثناء النوم",
  "اكتب ملخصاً بكلماتك الخاصة — هذا يُثبت أنك فهمت المادة حقاً",
  "المجموعات الدراسية فعّالة إذا كان لكل شخص دور واضح في النقاش",
  "تعلّم تقنية الإعادة الموزّعة: راجع بعد يوم، أسبوع، ثم شهر",
  "ثق بنفسك يوم الاختبار — التوتر الخفيف يزيد الأداء، الذعر يخفضه",
];

const NOTIF_ICONS = { book: Book, file: FileText, calendar: Calendar, star: Star, bell: Bell };

const NOTIFS_SEED = [
  { id: 1, title: "تجميعات جديدة", text: "رُفعت تجميعات فاينل لمادة إدارة الأعمال ف2 1447", time: "منذ 5 دقائق", read: false, iconKey: "book" },
  { id: 2, title: "تحديث الخطة الدراسية", text: "تم تحديث خطة السنة الأولى المشتركة (CFY) للفصل الثاني", time: "منذ ساعة", read: false, iconKey: "file" },
  { id: 3, title: "إعلان الاختبارات", text: "جداول الاختبارات النهائية ف2 1447 متاحة على Blackboard", time: "منذ يومين", read: true, iconKey: "calendar" },
  { id: 4, title: "ملخص شامل", text: "ملخص وحدات 1-6 لمادة مهارات الاتصال والتواصل", time: "منذ 3 أيام", read: true, iconKey: "star" },
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
      <div style={{ position: "absolute", top: -20, right: -20, width: 60, height: 60, borderRadius: "50%", background: `${color}10`, pointerEvents: "none" }} />
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
  const [myRating, setMyRating] = useState(() => (storage.get("ratings", {})[name] || 0));
  const [hoverRating, setHoverRating] = useState(0);
  const rateFile = (star) => {
    const ratings = storage.get("ratings", {});
    ratings[name] = star;
    storage.set("ratings", ratings);
    setMyRating(star);
    onToast?.(`قيّمت بـ ${star} نجوم`, "success");
  };
  const displayRating = myRating > 0 ? ((r + myRating) / 2) : r;
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
        <div style={{ display: "flex", gap: 2, marginRight: "auto", alignItems: "center" }}>
          {[1, 2, 3, 4, 5].map(i => (
            <span key={i}
              onClick={() => rateFile(i)}
              onMouseEnter={() => setHoverRating(i)}
              onMouseLeave={() => setHoverRating(0)}
              style={{ fontSize: 12, color: i <= (hoverRating || Math.round(myRating > 0 ? displayRating : r)) ? P.gold : "#ccc", cursor: "pointer", transition: "color .1s" }}>★</span>
          ))}
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
function AIChat({ subject, t, onChat, standalone = true, files = null }) {
  const histKey = `aiHistory_${subject.replace(/\s+/g, "_").slice(0, 40)}`;
  const mkId = () => Date.now() + Math.random();
  const makeDefault = () => ({ r: "a", id: mkId(), text: `مرحباً! أنا مساعدك الذكي لمادة **${subject}**.\nاسألني عن الاختبارات، الواجبات، الملخصات، أو أي شيء آخر.`, ts: Date.now() });
  const [msgs, setMsgs] = useState(() => {
    const stored = storage.get(histKey, null);
    if (stored && stored.length > 0) return stored.map(m => ({ ...m, id: m.id || mkId() }));
    return [makeDefault()];
  });
  const [inp, setInp] = useState("");
  const [loading, setLoading] = useState(false);
  const [menuId, setMenuId] = useState(null);
  const [copied, setCopied] = useState(false);
  const [fileContext, setFileContext] = useState(null);
  const [fileCount, setFileCount] = useState(0);
  const [fileSugs, setFileSugs] = useState([]);
  const [recording, setRecording] = useState(false);
  const [hasSpeech, setHasSpeech] = useState(false);
  const recogRef = useRef(null);
  const endRef = useRef(null);

  useEffect(() => {
    setHasSpeech(!!(typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition)));
  }, []);

  useEffect(() => {
    if (msgs.length > 1) storage.set(histKey, msgs.slice(-20));
  }, [msgs]);
  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), [msgs]);

  useEffect(() => {
    if (!files) return;
    const catNames = { collections: "تجميعات الاختبارات", plans: "خطط دراسية", curriculum: "مناهج ومقررات", programs: "وثائق المادة" };
    const catAr = { collections: "تجميعة", plans: "خطة", curriculum: "منهج", programs: "مقرر" };
    const allF = Object.entries(files).flatMap(([cat, arr]) => (arr || []).map(f => ({ ...f, cat })));
    if (allF.length === 0) return;
    setFileCount(allF.length);
    const sugs = [];
    for (const [cat, arr] of Object.entries(files)) {
      if ((arr || []).length > 0) sugs.push(`ما مواضيع ${catAr[cat] || cat} "${arr[0].name}"؟`);
    }
    if (allF.length > 1) sugs.push("ما أهم ما في الملفات المتاحة؟");
    setFileSugs(sugs.slice(0, 3));
    const lines = [`الملفات المتاحة في مادة "${subject}":`];
    for (const [cat, arr] of Object.entries(files)) {
      if ((arr || []).length > 0) lines.push(`• ${catNames[cat] || cat}: ${arr.map(f => f.name).join("، ")}`);
    }
    const textFiles = allF.filter(f => /\.(txt|md)$/i.test(f.name)).slice(0, 3);
    Promise.all(textFiles.map(async f => {
      try {
        const src = f.blobUrl || f.url;
        if (!src) return null;
        const r = await fetch(`/api/download?url=${encodeURIComponent(src)}`);
        if (!r.ok) return null;
        const text = await r.text();
        return `\nمحتوى "${f.name}":\n${text.slice(0, 600)}`;
      } catch { return null; }
    })).then(contents => {
      const valid = contents.filter(Boolean);
      if (valid.length > 0) lines.push(...valid);
      setFileContext(lines.join("\n"));
    }).catch(() => setFileContext(lines.join("\n")));
  }, [files]);

  const clearChat = () => { storage.set(histKey, null); setMsgs([makeDefault()]); setMenuId(null); };

  const fmtTime = (ts) => {
    if (!ts) return "";
    return new Date(ts).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit", hour12: true });
  };

  const deleteMsg = (id) => {
    setMsgs(ms => ms.length <= 1 ? ms : ms.filter(m => m.id !== id));
    setMenuId(null);
  };

  const copyMsg = (text) => {
    const plain = text.replace(/\*\*/g, "");
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(plain).catch(() => {});
    } else {
      try {
        const el = document.createElement("textarea");
        el.value = plain; document.body.appendChild(el); el.select();
        document.execCommand("copy"); document.body.removeChild(el);
      } catch {}
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    setMenuId(null);
  };

  const resendMsg = (id, text) => {
    const idx = msgs.findIndex(m => m.id === id);
    setMsgs(ms => ms.slice(0, idx));
    setMenuId(null);
    setTimeout(() => send(text), 50);
  };

  const defaultSugs = [
    `ما أهم مواضيع ${subject}؟`,
    "كيف أستعد للاختبار النهائي؟",
    "لخّص الوحدة الأولى",
    "ما نوع أسئلة الاختبار؟",
    "أعطني أمثلة تطبيقية",
    "نصائح للدراسة الفعّالة",
  ];
  const allSugs = [...fileSugs, ...defaultSugs];

  const renderInline = (txt) => txt.split("**").map((p, j) => j % 2 === 1 ? <strong key={j}>{p}</strong> : p);
  const renderMsg = (text) => text.split("\n").map((line, i) => {
    if (/^#{1,3}\s/.test(line)) {
      const lvl = (line.match(/^(#{1,3})\s/) || [[],[""]])[1].length;
      return <div key={i} style={{ fontWeight: 800, fontSize: lvl === 1 ? 15 : 14, marginTop: i > 0 ? 8 : 0, color: P.gold, lineHeight: 1.5 }}>{line.replace(/^#{1,3}\s/, "")}</div>;
    }
    const listM = line.match(/^[-•*]\s+(.+)/);
    if (listM) return <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginTop: 2 }}><span style={{ color: P.blue2, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>•</span><span style={{ flex: 1 }}>{renderInline(listM[1])}</span></div>;
    const numM = line.match(/^([١٢٣٤٥٦٧٨٩\d]+[.،):]\s*)(.+)/);
    if (numM) return <div key={i} style={{ display: "flex", gap: 8, marginTop: 2 }}><span style={{ color: P.blue2, fontWeight: 700, flexShrink: 0 }}>{numM[1]}</span><span style={{ flex: 1 }}>{renderInline(numM[2])}</span></div>;
    if (line.trim() === "") return <div key={i} style={{ height: 5 }} />;
    return <div key={i} style={{ lineHeight: 1.8 }}>{renderInline(line)}</div>;
  });

  const send = async (q) => {
    const text = (q || inp).trim();
    if (!text || loading) return;
    setInp("");
    const newMsg = { r: "u", id: mkId(), text, ts: Date.now() };
    const newMsgs = [...msgs, newMsg];
    setMsgs(newMsgs);
    setLoading(true);
    onChat?.();
    try {
      const history = newMsgs.slice(1).map(m => ({ role: m.r === "u" ? "user" : "assistant", content: m.text }));
      const res = await fetch("/api/ai", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, messages: history, fileContext }),
      });
      const d = await res.json();
      const errText = d.error
        ? d._debug?.length
          ? `${d.error}\n\n🔍 تفاصيل: ${d._debug.join(" | ")}`
          : d.error
        : null;
      setMsgs(m => [...m, { r: "a", id: mkId(), text: d.text || errText || "عذراً، حدث خطأ. حاول مجدداً.", ts: Date.now() }]);
    } catch {
      setMsgs(m => [...m, { r: "a", id: mkId(), text: "تعذّر الاتصال — تحقق من الشبكة وأعد المحاولة.", ts: Date.now() }]);
    }
    setLoading(false);
  };

  const toggleRecording = () => {
    if (recording) {
      recogRef.current?.stop();
      setRecording(false);
      return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const r = new SR();
    r.lang = "ar-SA";
    r.interimResults = false;
    r.onresult = (e) => { const t = e.results[0][0].transcript; setInp(prev => prev + t); };
    r.onend = () => setRecording(false);
    r.onerror = () => setRecording(false);
    recogRef.current = r;
    r.start();
    setRecording(true);
  };

  const menuBtnSt = (danger) => ({
    background: "none", border: "none", padding: "9px 14px", cursor: "pointer",
    fontSize: 13, color: danger ? P.red : t.tx, fontFamily: "inherit", fontWeight: 600,
    display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "right",
    borderRadius: 8, transition: "background .15s",
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", height: standalone ? 540 : "100%", borderRadius: standalone ? 20 : 0, overflow: "hidden", border: standalone ? `1px solid ${t.bd}` : "none", boxShadow: standalone ? t.sh : "none", background: t.s1 }}>

      {standalone && (
        <div style={{ background: `linear-gradient(135deg,${P.navy},${P.blue})`, padding: "14px 18px", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(255,255,255,.15)", display: "flex", alignItems: "center", justifyContent: "center", border: "1.5px solid rgba(255,255,255,.25)", flexShrink: 0 }}>
            <Sparkles size={20} color={P.gold} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: "#fff", fontWeight: 800, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>مساعد {subject}</div>
            <div style={{ color: "#4ade80", fontSize: 11, display: "flex", alignItems: "center", gap: 4, marginTop: 1 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ade80", display: "inline-block", flexShrink: 0 }} />
              {fileCount > 0 ? `يستخدم ${fileCount} ملف من المادة` : "متصل الآن"}
            </div>
          </div>
          {fileCount > 0 && (
            <div style={{ background: "rgba(255,255,255,.15)", border: "1px solid rgba(255,255,255,.25)", borderRadius: 20, padding: "3px 10px", fontSize: 11, color: P.gold, fontWeight: 700, display: "flex", alignItems: "center", gap: 4, flexShrink: 0, whiteSpace: "nowrap" }}>
              <FileText size={11} /> {fileCount}
            </div>
          )}
          <button onClick={clearChat} style={{ background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.2)", borderRadius: 8, padding: "5px 12px", fontSize: 11, color: "rgba(255,255,255,.8)", cursor: "pointer", fontFamily: "inherit", fontWeight: 600, flexShrink: 0 }}>مسح</button>
        </div>
      )}

      {menuId && <div onClick={() => setMenuId(null)} style={{ position: "fixed", inset: 0, zIndex: 90 }} />}

      {copied && (
        <div style={{ position: "fixed", top: 80, left: "50%", transform: "translateX(-50%)", background: "rgba(15,28,51,.95)", color: "#fff", padding: "8px 18px", borderRadius: 20, fontSize: 12, fontWeight: 700, zIndex: 9999, pointerEvents: "none", display: "flex", alignItems: "center", gap: 6 }}>
          <CheckCircle size={13} color={P.green} /> تم النسخ
        </div>
      )}

      {/* Messages area */}
      <div style={{ flex: 1, overflowY: "auto", padding: "14px 12px", display: "flex", flexDirection: "column", gap: 0, background: t.s1, minHeight: 0 }}>
        {msgs.map((m, i) => {
          const isUser = m.r === "u";
          const prevSame = i > 0 && msgs[i - 1].r === m.r;
          const isMenuOpen = menuId === m.id;
          return (
            <div key={m.id || i} style={{ display: "flex", flexDirection: "column", alignItems: isUser ? "flex-start" : "flex-end", marginTop: prevSame ? 3 : 14, animation: "fadeUp .3s ease" }}>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 8, maxWidth: "84%" }}>
                {!isUser && (
                  <div style={{ width: 30, height: 30, borderRadius: "50%", background: `linear-gradient(135deg,${P.navy},${P.blue2})`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, opacity: prevSame ? 0 : 1, boxShadow: `0 2px 8px ${P.blue}40` }}>
                    <Sparkles size={14} color={P.gold} />
                  </div>
                )}
                <div
                  onClick={() => setMenuId(isMenuOpen ? null : m.id)}
                  style={{
                    padding: "10px 14px", fontSize: 13.5,
                    borderRadius: isUser ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                    background: isUser ? `linear-gradient(135deg,${P.blue},${P.blue2})` : t.s2,
                    color: isUser ? "#fff" : t.tx,
                    boxShadow: isMenuOpen ? `0 0 0 2px ${P.blue2}, 0 6px 24px ${P.blue}40` : isUser ? `0 4px 16px ${P.blue}40` : `0 2px 8px rgba(0,0,0,.07)`,
                    border: isUser ? "none" : `1px solid ${isMenuOpen ? P.blue2 : t.bd}`,
                    cursor: "pointer", userSelect: "none", wordBreak: "break-word",
                    transition: "box-shadow .15s, border-color .15s",
                  }}>
                  {renderMsg(m.text)}
                </div>
                {isUser && (
                  <div style={{ width: 30, height: 30, borderRadius: "50%", background: `${P.blue2}20`, border: `1.5px solid ${P.blue2}40`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <CircleUser size={15} color={P.blue2} />
                  </div>
                )}
              </div>

              {isMenuOpen && (
                <div onClick={e => e.stopPropagation()} style={{
                  position: "absolute", [isUser ? "right" : "left"]: 46,
                  marginTop: 4,
                  background: t.bg, borderRadius: 14, boxShadow: `0 8px 32px rgba(0,0,0,.2)`,
                  border: `1px solid ${t.bd}`, padding: "5px 6px",
                  zIndex: 100, minWidth: 170, animation: "scaleIn .15s ease",
                }}>
                  <button style={menuBtnSt(false)} onMouseEnter={e => e.currentTarget.style.background = t.s2} onMouseLeave={e => e.currentTarget.style.background = "none"} onClick={() => copyMsg(m.text)}>
                    <Copy size={14} color={P.blue2} /> نسخ النص
                  </button>
                  {isUser && !loading && (
                    <button style={menuBtnSt(false)} onMouseEnter={e => e.currentTarget.style.background = t.s2} onMouseLeave={e => e.currentTarget.style.background = "none"} onClick={() => resendMsg(m.id, m.text)}>
                      <RotateCcw size={14} color={P.green} /> إعادة الإرسال
                    </button>
                  )}
                  {i > 0 && (
                    <button style={menuBtnSt(true)} onMouseEnter={e => e.currentTarget.style.background = `${P.red}10`} onMouseLeave={e => e.currentTarget.style.background = "none"} onClick={() => deleteMsg(m.id)}>
                      <Trash2 size={14} color={P.red} /> حذف
                    </button>
                  )}
                </div>
              )}

              <div style={{ fontSize: 10, color: t.dim, marginTop: 3, paddingLeft: isUser ? 40 : 0, paddingRight: isUser ? 0 : 40 }}>
                {fmtTime(m.ts)}{isUser && <span style={{ marginRight: 4, color: P.blue2 }}>✓✓</span>}
              </div>
            </div>
          );
        })}
        {loading && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", marginTop: 14 }}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
              <div style={{ width: 30, height: 30, borderRadius: "50%", background: `linear-gradient(135deg,${P.navy},${P.blue2})`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Sparkles size={14} color={P.gold} />
              </div>
              <div style={{ background: t.s2, border: `1px solid ${t.bd}`, padding: "12px 18px", borderRadius: "18px 18px 18px 4px", display: "flex", gap: 5, alignItems: "center" }}>
                {[0, 1, 2].map(i => <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: P.blue2, animation: `bounce .9s ${i * .15}s infinite` }} />)}
              </div>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Suggestions row — always visible, horizontally scrollable */}
      {!loading && (
        <div style={{ padding: "7px 12px 6px", display: "flex", gap: 6, overflowX: "auto", background: t.s1, borderTop: `1px solid ${t.bd}`, flexShrink: 0, scrollbarWidth: "none" }}>
          {allSugs.map((s, i) => (
            <button key={i} onClick={() => send(s)} style={{
              whiteSpace: "nowrap", background: i < fileSugs.length ? `${P.blue}10` : t.s2,
              border: `1px solid ${i < fileSugs.length ? P.blue2 + "50" : t.bd}`,
              borderRadius: 20, padding: "5px 13px", fontSize: 11,
              color: i < fileSugs.length ? P.blue2 : t.mu,
              cursor: "pointer", fontFamily: "inherit", transition: "all .2s", flexShrink: 0,
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = P.blue2; e.currentTarget.style.color = P.blue2; e.currentTarget.style.background = `${P.blue2}15`; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = i < fileSugs.length ? P.blue2 + "50" : t.bd; e.currentTarget.style.color = i < fileSugs.length ? P.blue2 : t.mu; e.currentTarget.style.background = i < fileSugs.length ? `${P.blue}10` : t.s2; }}>
              {i < fileSugs.length ? "📄 " : ""}{s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={{ padding: "10px 12px", background: t.s1, borderTop: `1px solid ${t.bd}`, display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
        <input value={inp} onChange={e => setInp(e.target.value)} onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
          placeholder={fileContext ? `اسأل عن ملفات ${subject}...` : `اسأل عن ${subject}...`}
          style={{ flex: 1, border: `1.5px solid ${t.bd}`, borderRadius: 24, padding: "10px 16px", fontSize: 13, outline: "none", direction: "rtl", fontFamily: "inherit", color: t.tx, background: t.s2, transition: "border-color .2s", minWidth: 0 }}
          onFocus={e => e.target.style.borderColor = P.blue2}
          onBlur={e => e.target.style.borderColor = t.bd} />
        {hasSpeech && (
          <button onClick={toggleRecording} style={{
            width: 44, height: 44, borderRadius: "50%", border: "none", cursor: "pointer",
            background: recording ? P.red : t.s3,
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            boxShadow: recording ? `0 0 0 3px ${P.red}40` : "none",
            transition: "all .2s",
            animation: recording ? "pulse 1.2s infinite" : "none",
          }}>
            {recording ? <MicOff size={17} color="#fff" /> : <Mic size={17} color={t.mu} />}
          </button>
        )}
        <button onClick={() => send()} disabled={loading || !inp.trim()} style={{
          width: 44, height: 44, borderRadius: "50%", border: "none", cursor: loading || !inp.trim() ? "not-allowed" : "pointer",
          background: loading || !inp.trim() ? t.s3 : `linear-gradient(135deg,${P.navy},${P.blue2})`,
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          boxShadow: loading || !inp.trim() ? "none" : `0 4px 14px ${P.blue}50`, transition: "all .2s",
        }}>
          <Send size={17} color={loading || !inp.trim() ? t.dim : "#fff"} />
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   AI QUIZ MODE
   ══════════════════════════════════════════════════════════════ */
function QuizMode({ subject, t, onToast }) {
  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(false);
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);

  const startQuiz = async () => {
    setLoading(true); setQuiz(null); setCurrent(0); setSelected(null); setScore(0); setDone(false);
    try {
      const res = await fetch("/api/ai-quiz", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subject }) });
      const d = await res.json();
      if (d.quiz && Array.isArray(d.quiz)) { setQuiz(d.quiz); }
      else { onToast?.(d.error || "تعذّر توليد الاختبار", "error"); }
    } catch { onToast?.("خطأ في الاتصال", "error"); }
    setLoading(false);
  };

  const choose = (idx) => {
    if (selected !== null) return;
    setSelected(idx);
    const isCorrect = idx === quiz[current].answer;
    if (isCorrect) setScore(s => s + 1);
  };

  const next = () => {
    if (current + 1 >= quiz.length) {
      setDone(true);
      const finalScore = selected === quiz[current].answer ? score + 1 : score;
      const existing = storage.get("quiz_scores", []);
      storage.set("quiz_scores", [...existing, { subject, score: finalScore, total: quiz.length, date: Date.now() }]);
      // Award XP
      const xp = storage.get("xp", 0);
      storage.set("xp", xp + 50);
      onToast?.(`+50 XP! أكملت الاختبار`, "success");
    } else {
      setCurrent(c => c + 1); setSelected(null);
    }
  };

  const finalScore = done ? (selected === quiz?.[quiz.length - 1]?.answer ? score : score) : score;

  if (!quiz && !loading) {
    return (
      <div style={{ textAlign: "center", padding: "30px 20px" }}>
        <div style={{ width: 64, height: 64, borderRadius: 18, background: `${P.purple}18`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", border: `1px solid ${P.purple}30` }}>
          <FileQuestion size={28} color={P.purple} />
        </div>
        <div style={{ fontSize: 15, fontWeight: 800, color: t.tx, marginBottom: 8 }}>اختبار بالذكاء الاصطناعي</div>
        <div style={{ fontSize: 12, color: t.mu, marginBottom: 20, lineHeight: 1.7 }}>سيولّد الذكاء الاصطناعي 5 أسئلة اختيار من متعدد عن مادة {subject}</div>
        <Btn variant="primary" onClick={startQuiz}>
          <Brain size={15} /> ابدأ اختبار جديد
        </Btn>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "40px 20px" }}>
        <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 14 }}>
          {[0,1,2].map(i => <div key={i} style={{ width: 10, height: 10, borderRadius: "50%", background: P.purple, animation: `bounce .9s ${i * .15}s infinite` }} />)}
        </div>
        <div style={{ fontSize: 13, color: t.mu }}>جارٍ توليد الأسئلة…</div>
      </div>
    );
  }

  if (done) {
    const pct = Math.round((finalScore / quiz.length) * 100);
    const msg = pct >= 80 ? "ممتاز! أداء رائع" : pct >= 60 ? "جيد! استمر" : "تحتاج مراجعة أكثر";
    const col = pct >= 80 ? P.green : pct >= 60 ? P.orange : P.red;
    return (
      <div style={{ textAlign: "center", padding: "20px 10px" }}>
        <div style={{ width: 80, height: 80, borderRadius: "50%", background: `${col}18`, border: `3px solid ${col}40`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
          <div style={{ fontSize: 24, fontWeight: 900, color: col }}>{finalScore}/{quiz.length}</div>
        </div>
        <div style={{ fontSize: 16, fontWeight: 800, color: t.tx, marginBottom: 6 }}>حصلت على {finalScore} من {quiz.length}</div>
        <div style={{ fontSize: 13, color: col, fontWeight: 700, marginBottom: 20 }}>{msg}</div>
        <div style={{ fontSize: 11, color: t.mu, marginBottom: 16 }}>+50 XP أُضيفت لرصيدك</div>
        <Btn variant="primary" onClick={startQuiz}>
          <RotateCcw size={14} /> إعادة الاختبار
        </Btn>
      </div>
    );
  }

  const q = quiz[current];
  const optLetters = ["أ", "ب", "ج", "د"];
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ fontSize: 12, color: t.mu }}>السؤال {current + 1} / {quiz.length}</div>
        <div style={{ fontSize: 12, color: P.green, fontWeight: 700 }}>{score} صحيح</div>
      </div>
      <div style={{ height: 4, background: t.s3, borderRadius: 2, marginBottom: 16, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${((current) / quiz.length) * 100}%`, background: `linear-gradient(90deg,${P.purple},${P.blue2})`, borderRadius: 2, transition: "width .4s" }} />
      </div>
      <div style={{ background: t.s2, borderRadius: 14, padding: 16, marginBottom: 14, border: `1px solid ${t.bd}` }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: t.tx, lineHeight: 1.7 }}>{q.q}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
        {q.options.map((opt, i) => {
          const isCorrect = i === q.answer;
          const isSelected = i === selected;
          let bg = t.s1; let border = t.bd; let color = t.tx;
          if (selected !== null) {
            if (isCorrect) { bg = `${P.green}18`; border = P.green; color = P.green; }
            else if (isSelected) { bg = `${P.red}18`; border = P.red; color = P.red; }
          }
          return (
            <button key={i} onClick={() => choose(i)} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
              background: bg, border: `1.5px solid ${border}`, borderRadius: 10,
              cursor: selected !== null ? "default" : "pointer", fontFamily: "inherit",
              textAlign: "right", transition: "all .2s",
            }}>
              <div style={{ width: 26, height: 26, borderRadius: 8, background: `${border}20`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: border }}>{optLetters[i]}</span>
              </div>
              <span style={{ fontSize: 13, color, flex: 1 }}>{opt}</span>
              {selected !== null && isCorrect && <CheckCircle size={16} color={P.green} />}
              {selected !== null && isSelected && !isCorrect && <X size={16} color={P.red} />}
            </button>
          );
        })}
      </div>
      {selected !== null && (
        <Btn variant="primary" onClick={next} style={{ width: "100%" }}>
          {current + 1 >= quiz.length ? "عرض النتيجة" : "السؤال التالي"} <ChevronLeft size={15} />
        </Btn>
      )}
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
  const COURSES_DEFAULT = [
    { name: "مادة 1", score: 85, hrs: 3 }, { name: "مادة 2", score: 90, hrs: 3 }, { name: "مادة 3", score: 75, hrs: 2 },
  ];
  const [courses, setCourses] = useState(() => {
    const stored = storage.get("gpaCourses", null);
    return Array.isArray(stored) ? stored : COURSES_DEFAULT;
  });
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

  const safeSemesters = semesters || [];
  const saveSemester = () => {
    const name = `الفصل ${safeSemesters.length + 1}`;
    setSemesters([...safeSemesters, { name, courses, gpa, totalHrs, date: new Date().toLocaleDateString("ar-SA") }]);
    onToast?.(`تم حفظ ${name}`, "success");
  };
  const loadSemester = (sem) => { setCourses(Array.isArray(sem.courses) ? sem.courses : COURSES_DEFAULT); setShowSaved(false); onToast?.(`تم تحميل ${sem.name}`, "info"); };
  const deleteSemester = (i) => setSemesters(s => (s || []).filter((_, j) => j !== i));

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
          <History size={13} /> محفوظ ({safeSemesters.length})
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
                <div style={{ fontSize: 12, color: P.red, fontWeight: 700, marginBottom: 4, display: "flex", alignItems: "center", gap: 4 }}><AlertTriangle size={12} /> غير قابل للتحقيق</div>
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
          {safeSemesters.length === 0 ? (
            <div style={{ textAlign: "center", padding: "20px 10px", color: t.mu, fontSize: 13 }}>
              لا توجد فصول محفوظة بعد
            </div>
          ) : safeSemesters.map((sem, i) => (
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
            onToast?.("جلسة دراسة مكتملة!", "success");
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
   GRADE CALC (per course)
   ══════════════════════════════════════════════════════════════ */
function GradeCalc({ subject, t }) {
  const key = `grades_${subject}`;
  const [gradesRaw, setGrades] = useStored(key, { activity: "", homework: "", midterm: "", final: "" });
  const grades = gradesRaw && typeof gradesRaw === "object" ? gradesRaw : { activity: "", homework: "", midterm: "", final: "" };
  const fields = [
    { id: "activity", label: "نشاط", pct: "15%", w: 0.15 },
    { id: "homework", label: "واجبات", pct: "15%", w: 0.15 },
    { id: "midterm", label: "ميدترم", pct: "30%", w: 0.30 },
    { id: "final", label: "نهائي", pct: "40%", w: 0.40 },
  ];
  const vals = {};
  fields.forEach(f => { vals[f.id] = parseFloat(grades[f.id]) || 0; });
  const filledCount = fields.filter(f => grades[f.id] !== "").length;
  const withoutFinal = vals.activity * 0.15 + vals.homework * 0.15 + vals.midterm * 0.30;
  const total = withoutFinal + vals.final * 0.40;
  const n90 = grades.final === "" ? (90 - withoutFinal) / 0.40 : null;
  const n60 = grades.final === "" ? (60 - withoutFinal) / 0.40 : null;
  const totalColor = total >= 90 ? P.green : total >= 60 ? P.orange : P.red;
  return (
    <div style={{ background: t.s1, borderRadius: 16, padding: "14px 16px", border: `1px solid ${t.bd}`, marginBottom: 10 }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: t.tx, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
        <Calculator size={13} color={P.gold} /> حاسبة الدرجات
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: filledCount > 0 ? 10 : 0 }}>
        {fields.map(f => (
          <div key={f.id}>
            <div style={{ fontSize: 10, color: t.mu, marginBottom: 3 }}>{f.label} ({f.pct})</div>
            <input type="number" min="0" max="100" step="0.5" placeholder="—"
              value={grades[f.id]}
              onChange={e => setGrades(g => ({ ...g, [f.id]: e.target.value }))}
              style={{ width: "100%", border: `1px solid ${t.bd}`, borderRadius: 8, padding: "7px 10px", fontSize: 13, background: t.s2, color: t.tx, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
          </div>
        ))}
      </div>
      {filledCount > 0 && (
        <div style={{ background: `${totalColor}12`, borderRadius: 10, padding: "10px 12px", border: `1px solid ${totalColor}30` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: t.mu }}>المجموع الحالي</span>
            <span style={{ fontSize: 18, fontWeight: 900, color: totalColor }}>{total.toFixed(1)}</span>
          </div>
          {n90 !== null && (
            <div style={{ fontSize: 11, marginTop: 6, lineHeight: 1.6 }}>
              {n90 <= 100 && n90 >= 0
                ? <span style={{ color: P.blue2 }}>تحتاج <strong>{n90.toFixed(1)}</strong> في النهائي للممتاز (90+)</span>
                : n90 < 0 ? <span style={{ color: P.green }}>ممتاز مضمون حتى بدون النهائي!</span>
                : <span style={{ color: P.red }}>لا يمكن الممتاز حتى بنهائي كامل</span>}
            </div>
          )}
          {n60 !== null && n60 > 0 && n60 <= 100 && (
            <div style={{ fontSize: 11, color: P.orange, marginTop: 3 }}>
              تحتاج على الأقل <strong>{n60.toFixed(1)}</strong> في النهائي للنجاح
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   TASK TRACKER
   ══════════════════════════════════════════════════════════════ */
function TaskTracker({ t, tasks, setTasks, onToast }) {
  const [showAdd, setShowAdd] = useState(false);
  const [newTask, setNewTask] = useState({ title: "", subject: "", dueDate: "", priority: "متوسط" });
  const today = todayKey();
  const addTask = () => {
    if (!newTask.title.trim()) return;
    setTasks(ts => [...(ts || []), { ...newTask, id: Date.now(), done: false }]);
    setNewTask({ title: "", subject: "", dueDate: "", priority: "متوسط" });
    setShowAdd(false);
    onToast?.("تم إضافة المهمة", "success");
  };
  const toggle = (id) => setTasks(ts => (ts || []).map(tk => tk.id === id ? { ...tk, done: !tk.done } : tk));
  const remove = (id) => setTasks(ts => (ts || []).filter(tk => tk.id !== id));
  const prioColor = { "عالي": P.red, "متوسط": P.orange, "منخفض": P.green };
  const sorted = [...(tasks || [])].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    return (a.dueDate || "9999").localeCompare(b.dueDate || "9999");
  });
  return (
    <div style={{ background: t.s1, borderRadius: 18, padding: 16, marginBottom: 16, border: `1px solid ${t.bd}`, boxShadow: t.shSm }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: t.tx, display: "flex", alignItems: "center", gap: 6 }}>
          <CheckCircle size={15} color={P.blue2} /> مهامي القادمة
        </div>
        <button onClick={() => setShowAdd(s => !s)} style={{ background: `${P.blue2}15`, border: "none", borderRadius: 8, padding: "5px 10px", cursor: "pointer", color: P.blue2, fontSize: 12, fontFamily: "inherit", display: "flex", alignItems: "center", gap: 4, fontWeight: 700 }}>
          <Plus size={12} /> مهمة
        </button>
      </div>
      {showAdd && (
        <div style={{ background: t.s2, borderRadius: 12, padding: 12, marginBottom: 12, animation: "fadeUp .3s ease" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <input placeholder="عنوان المهمة *" value={newTask.title} onChange={e => setNewTask(p => ({ ...p, title: e.target.value }))}
              style={{ border: `1px solid ${t.bd}`, borderRadius: 8, padding: "8px 10px", fontSize: 13, background: t.s1, color: t.tx, fontFamily: "inherit", direction: "rtl", outline: "none" }} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <input placeholder="المادة" value={newTask.subject} onChange={e => setNewTask(p => ({ ...p, subject: e.target.value }))}
                style={{ border: `1px solid ${t.bd}`, borderRadius: 8, padding: "8px 10px", fontSize: 13, background: t.s1, color: t.tx, fontFamily: "inherit", direction: "rtl", outline: "none" }} />
              <input type="date" value={newTask.dueDate} onChange={e => setNewTask(p => ({ ...p, dueDate: e.target.value }))}
                style={{ border: `1px solid ${t.bd}`, borderRadius: 8, padding: "8px 10px", fontSize: 13, background: t.s1, color: t.tx, fontFamily: "inherit", outline: "none" }} />
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {["عالي", "متوسط", "منخفض"].map(p => (
                <button key={p} onClick={() => setNewTask(nt => ({ ...nt, priority: p }))} style={{ flex: 1, padding: "6px 4px", borderRadius: 8, border: `1.5px solid ${newTask.priority === p ? prioColor[p] : t.bd}`, background: newTask.priority === p ? `${prioColor[p]}15` : t.s1, color: newTask.priority === p ? prioColor[p] : t.mu, fontSize: 12, cursor: "pointer", fontFamily: "inherit", fontWeight: 700 }}>
                  {p}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Btn variant="ghost" size="sm" onClick={() => setShowAdd(false)} style={{ flex: 1 }}>إلغاء</Btn>
              <Btn variant="primary" size="sm" onClick={addTask} style={{ flex: 2 }} disabled={!newTask.title.trim()}>
                <Plus size={14} /> إضافة
              </Btn>
            </div>
          </div>
        </div>
      )}
      {sorted.length === 0 ? (
        <div style={{ textAlign: "center", padding: "12px 0", color: t.dim, fontSize: 12 }}>لا مهام بعد — أضف مهمتك الأولى!</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 220, overflowY: "auto" }}>
          {sorted.slice(0, 6).map(task => {
            const isOverdue = !task.done && task.dueDate && task.dueDate < today;
            const overdueDays = isOverdue ? Math.ceil((new Date(today) - new Date(task.dueDate)) / 86400000) : 0;
            const pc = prioColor[task.priority] || P.orange;
            return (
              <div key={task.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 10px", background: isOverdue && !task.done ? `${P.red}08` : t.s2, borderRadius: 10, border: `1px solid ${isOverdue && !task.done ? P.red + "40" : t.bd}`, opacity: task.done ? 0.55 : 1 }}>
                <button onClick={() => toggle(task.id)} style={{ background: task.done ? `${P.green}20` : t.s1, border: `1.5px solid ${task.done ? P.green : t.bd}`, borderRadius: 6, width: 22, height: 22, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {task.done && <Check size={12} color={P.green} />}
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: t.tx, textDecoration: task.done ? "line-through" : "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{task.title}</div>
                  <div style={{ fontSize: 10, color: t.mu, display: "flex", gap: 6, marginTop: 1 }}>
                    {task.subject && <span>{task.subject}</span>}
                    {task.dueDate && <span>{new Date(task.dueDate + "T12:00:00").toLocaleDateString("ar-SA", { month: "short", day: "numeric" })}</span>}
                    {isOverdue && <span style={{ color: P.red, fontWeight: 700 }}>متأخر {overdueDays} يوم</span>}
                  </div>
                </div>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: pc, flexShrink: 0 }} />
                <button onClick={() => remove(task.id)} style={{ background: "none", border: "none", cursor: "pointer", color: t.dim, display: "flex", padding: 2 }}>
                  <X size={11} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   DAILY PROGRESS BAR
   ══════════════════════════════════════════════════════════════ */
function DailyProgress({ sessionLog, weeklyGoal, t }) {
  const todayMins = (sessionLog || []).filter(s => s.date === todayKey()).reduce((a, s) => a + (s.dur || 25), 0);
  const goalMins = Math.max(1, Math.round(weeklyGoal * 25 / 5));
  const pct = Math.min(100, Math.round((todayMins / goalMins) * 100));
  const barColor = pct < 30 ? P.red : pct < 70 ? P.orange : P.green;
  return (
    <div style={{ background: t.s1, borderRadius: 18, padding: 14, marginBottom: 14, border: `1px solid ${t.bd}`, boxShadow: t.shSm }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: t.tx, display: "flex", alignItems: "center", gap: 6 }}>
          <Activity size={14} color={barColor} /> إنجاز اليوم
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color: barColor }}>{pct}%</span>
      </div>
      <div style={{ height: 8, background: t.s3, borderRadius: 4, overflow: "hidden", marginBottom: 5 }}>
        <div style={{ height: "100%", width: `${pct}%`, background: `linear-gradient(90deg,${barColor},${barColor}cc)`, borderRadius: 4, transition: "width .6s ease" }} />
      </div>
      <div style={{ fontSize: 11, color: t.mu }}>{todayMins} دقيقة من {goalMins} دقيقة</div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   SEMESTER CHART
   ══════════════════════════════════════════════════════════════ */
function SemesterChart({ semesters, t }) {
  if (!semesters || semesters.length < 2) return null;
  const gpas = semesters.map(s => parseFloat(s.gpa) || 0);
  const maxGpa = Math.max(...gpas, 1);
  return (
    <div style={{ background: t.s1, borderRadius: 18, padding: 16, marginTop: 16, border: `1px solid ${t.bd}` }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: t.tx, marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}>
        <BarChart2 size={15} color={P.blue2} /> مقارنة الفصول
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 130 }}>
        {semesters.map((sem, i) => {
          const gpa = parseFloat(sem.gpa) || 0;
          const barH = Math.max(8, (gpa / maxGpa) * 90);
          const bc = gpa < 2 ? P.red : gpa < 3 ? P.orange : gpa < 3.5 ? P.gold : P.green;
          const prev = i > 0 ? parseFloat(semesters[i - 1].gpa) : null;
          const trend = prev === null ? null : gpa > prev + 0.05 ? "↑" : gpa < prev - 0.05 ? "↓" : "→";
          const tc = trend === "↑" ? P.green : trend === "↓" ? P.red : t.mu;
          return (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
              <span style={{ fontSize: 11, color: tc, fontWeight: 700, height: 16 }}>{trend || ""}</span>
              <span style={{ fontSize: 10, color: bc, fontWeight: 700 }}>{gpa.toFixed(2)}</span>
              <div style={{ width: "100%", height: `${barH}%`, borderRadius: "6px 6px 0 0", background: `linear-gradient(180deg,${bc},${bc}88)`, transition: "height .8s ease", minHeight: 8, boxShadow: `0 4px 12px ${bc}30` }} />
              <div style={{ fontSize: 9, color: t.mu, textAlign: "center", lineHeight: 1.3, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sem.name}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   SCHEDULE PAGE
   ══════════════════════════════════════════════════════════════ */
function SchedulePage({ t, schedule, setSchedule, onToast }) {
  const [showAdd, setShowAdd] = useState(false);
  const [newLec, setNewLec] = useState({ course: "", day: "الأحد", time: "08:00", room: "" });
  const DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس"];
  const DAY_COLORS = { "الأحد": P.blue2, "الاثنين": P.purple, "الثلاثاء": P.green, "الأربعاء": P.orange, "الخميس": P.red };
  const todayAr = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"][new Date().getDay()];
  const addLecture = () => {
    if (!newLec.course.trim()) return;
    setSchedule(s => [...(s || []), { ...newLec, id: Date.now() }]);
    setNewLec({ course: "", day: "الأحد", time: "08:00", room: "" });
    setShowAdd(false);
    onToast?.("تم إضافة المحاضرة", "success");
  };
  const removeLecture = (id) => setSchedule(s => (s || []).filter(l => l.id !== id));
  return (
    <div style={{ animation: "fadeUp .4s ease" }}>
      <h2 style={{ fontSize: 20, fontWeight: 900, color: t.tx, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
        <CalendarDays size={20} color={P.blue2} /> جدولي الأسبوعي
      </h2>
      {DAYS.map(day => {
        const dayLecs = (schedule || []).filter(l => l.day === day).sort((a, b) => a.time.localeCompare(b.time));
        const isToday = day === todayAr;
        const dc = DAY_COLORS[day];
        return (
          <div key={day} style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <div style={{ width: 3, height: 16, borderRadius: 2, background: dc }} />
              <span style={{ fontSize: 13, fontWeight: 800, color: isToday ? dc : t.tx }}>{day}</span>
              {isToday && <span style={{ background: `${dc}20`, color: dc, borderRadius: 6, padding: "1px 8px", fontSize: 10, fontWeight: 800 }}>اليوم</span>}
              <span style={{ fontSize: 11, color: t.mu }}>({dayLecs.length})</span>
            </div>
            {dayLecs.length === 0 ? (
              <div style={{ fontSize: 11, color: t.dim, padding: "7px 12px", background: t.s2, borderRadius: 8, border: `1px dashed ${t.bd}` }}>لا محاضرات</div>
            ) : (
              dayLecs.map(lec => (
                <div key={lec.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: isToday ? `${dc}10` : t.s1, borderRadius: 10, border: `1px solid ${isToday ? dc + "40" : t.bd}`, marginBottom: 5 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: `${dc}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Clock size={13} color={dc} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: t.tx }}>{lec.course}</div>
                    <div style={{ fontSize: 11, color: t.mu }}>{lec.time}{lec.room ? ` • ${lec.room}` : ""}</div>
                  </div>
                  <button onClick={() => removeLecture(lec.id)} style={{ background: `${P.red}15`, border: "none", borderRadius: 7, padding: 5, cursor: "pointer", color: P.red, display: "flex" }}>
                    <X size={12} />
                  </button>
                </div>
              ))
            )}
          </div>
        );
      })}
      {showAdd ? (
        <div style={{ background: t.s1, borderRadius: 16, padding: 14, border: `1px solid ${t.bd}`, marginTop: 8, animation: "fadeUp .3s ease" }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: t.tx, marginBottom: 10 }}>إضافة محاضرة جديدة</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <input placeholder="اسم المادة *" value={newLec.course} onChange={e => setNewLec(p => ({ ...p, course: e.target.value }))}
              style={{ border: `1px solid ${t.bd}`, borderRadius: 8, padding: "8px 10px", fontSize: 13, background: t.s2, color: t.tx, fontFamily: "inherit", direction: "rtl", outline: "none" }} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <select value={newLec.day} onChange={e => setNewLec(p => ({ ...p, day: e.target.value }))}
                style={{ border: `1px solid ${t.bd}`, borderRadius: 8, padding: "8px 10px", fontSize: 13, background: t.s2, color: t.tx, fontFamily: "inherit", outline: "none" }}>
                {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <input type="time" value={newLec.time} onChange={e => setNewLec(p => ({ ...p, time: e.target.value }))}
                style={{ border: `1px solid ${t.bd}`, borderRadius: 8, padding: "8px 10px", fontSize: 13, background: t.s2, color: t.tx, fontFamily: "inherit", outline: "none" }} />
            </div>
            <input placeholder="القاعة / الرابط (اختياري)" value={newLec.room} onChange={e => setNewLec(p => ({ ...p, room: e.target.value }))}
              style={{ border: `1px solid ${t.bd}`, borderRadius: 8, padding: "8px 10px", fontSize: 13, background: t.s2, color: t.tx, fontFamily: "inherit", direction: "rtl", outline: "none" }} />
            <div style={{ display: "flex", gap: 8 }}>
              <Btn variant="ghost" size="sm" onClick={() => setShowAdd(false)} style={{ flex: 1 }}>إلغاء</Btn>
              <Btn variant="primary" size="sm" onClick={addLecture} style={{ flex: 2 }} disabled={!newLec.course.trim()}>
                <Plus size={14} /> إضافة
              </Btn>
            </div>
          </div>
        </div>
      ) : (
        <Btn variant="gold" style={{ width: "100%", marginTop: 8 }} onClick={() => setShowAdd(true)}>
          <Plus size={15} /> إضافة محاضرة
        </Btn>
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
function PDFViewer({ file, onClose }) {
  const blobSrc = file.blobUrl || file.url || "";
  const viewUrl = `/api/download?url=${encodeURIComponent(blobSrc)}`;
  const dlUrl = `/api/download?url=${encodeURIComponent(blobSrc)}&dl=1`;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 500, background: "#050a16", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "#0a1426", borderBottom: "1px solid #1c2e48", flexShrink: 0 }}>
        <button onClick={onClose} style={{ background: "rgba(255,255,255,.1)", border: "none", borderRadius: 8, padding: "7px 13px", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontFamily: "inherit", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
          <ArrowLeft size={14} /> رجوع
        </button>
        <div style={{ flex: 1, color: "#e4ecf8", fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.name}</div>
        <a href={dlUrl} style={{ background: `linear-gradient(135deg,${P.blue},${P.blue2})`, color: "#fff", borderRadius: 8, padding: "7px 13px", fontSize: 12, fontWeight: 700, textDecoration: "none", display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
          <Download size={12} /> تحميل
        </a>
      </div>
      <iframe src={viewUrl} style={{ flex: 1, border: "none", width: "100%", background: "#fff" }} title={file.name} />
    </div>
  );
}

function RealFileItem({ file, t, onToast }) {
  const [viewing, setViewing] = useState(false);
  const ratingKey = `real_${file.id || file.name}`;
  const [myRating, setMyRating] = useState(() => (storage.get("ratings", {})[ratingKey] || 0));
  const [hoverRating, setHoverRating] = useState(0);
  const blobSrc = file.blobUrl || file.url || "";
  const dlUrl = `/api/download?url=${encodeURIComponent(blobSrc)}&dl=1`;

  const rateFile = (star) => {
    const ratings = storage.get("ratings", {});
    ratings[ratingKey] = star;
    storage.set("ratings", ratings);
    setMyRating(star);
    onToast?.(`قيّمت بـ ${star} نجوم`, "success");
  };

  const shareFile = () => {
    const url = `${typeof window !== "undefined" ? window.location.origin : ""}/api/download?url=${encodeURIComponent(blobSrc)}`;
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => onToast?.("تم نسخ رابط الملف", "success")).catch(() => onToast?.("تعذّر النسخ", "error"));
    } else {
      try {
        const el = document.createElement("textarea");
        el.value = url;
        document.body.appendChild(el);
        el.select();
        document.execCommand("copy");
        document.body.removeChild(el);
        onToast?.("تم نسخ رابط الملف", "success");
      } catch { onToast?.("تعذّر النسخ", "error"); }
    }
  };

  if (viewing) return <PDFViewer file={file} onClose={() => setViewing(false)} />;

  return (
    <div style={{ background: `${P.blue2}06`, border: `1.5px solid ${P.blue2}25`, borderRadius: 14, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: `${P.blue2}20`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <FileText size={18} color={P.blue2} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
            <span style={{ background: P.blue2, color: "#fff", fontSize: 9, fontWeight: 800, borderRadius: 4, padding: "1px 5px", flexShrink: 0 }}>جديد</span>
            <div style={{ fontSize: 13, fontWeight: 700, color: t.tx, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.name}</div>
          </div>
          <div style={{ fontSize: 11, color: t.mu }}>{file.sizeLabel} • {new Date(file.uploadedAt).toLocaleDateString("ar-SA")}</div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
          {[1, 2, 3, 4, 5].map(i => (
            <span key={i}
              onClick={() => rateFile(i)}
              onMouseEnter={() => setHoverRating(i)}
              onMouseLeave={() => setHoverRating(0)}
              style={{ fontSize: 15, color: i <= (hoverRating || myRating) ? P.gold : t.dim, cursor: "pointer", transition: "color .1s", lineHeight: 1 }}>★</span>
          ))}
          {myRating > 0 && <span style={{ fontSize: 10, color: t.mu, marginRight: 4 }}>({myRating}/5)</span>}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={shareFile} style={{ background: `${P.purple}12`, border: `1px solid ${P.purple}25`, borderRadius: 8, padding: "6px 8px", cursor: "pointer", color: P.purple, display: "flex", alignItems: "center", gap: 3 }}>
            <Share2 size={12} />
          </button>
          <button onClick={() => setViewing(true)} style={{ background: `${P.blue2}15`, border: `1px solid ${P.blue2}35`, borderRadius: 8, padding: "6px 10px", cursor: "pointer", color: P.blue2, fontSize: 11, fontWeight: 700, fontFamily: "inherit", display: "flex", alignItems: "center", gap: 4 }}>
            <Eye size={12} /> قراءة
          </button>
          <a href={dlUrl} style={{ background: `linear-gradient(135deg,${P.blue},${P.blue2})`, borderRadius: 8, padding: "6px 10px", color: "#fff", fontSize: 11, fontWeight: 700, textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
            <Download size={12} /> تحميل
          </a>
        </div>
      </div>
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

function CourseProgress({ subject, t }) {
  const UNITS = 6;
  const key = `progress_${subject}`;
  const [done, setDone] = useStored(key, []);
  const pct = Math.round((done.length / UNITS) * 100);
  const toggle = (u) => setDone(prev => prev.includes(u) ? prev.filter(x => x !== u) : [...prev, u]);
  return (
    <div style={{
      background: t.s1, borderRadius: 16, padding: "14px 16px", border: `1px solid ${t.bd}`,
      marginBottom: 10,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: t.tx, display: "flex", alignItems: "center", gap: 6 }}>
          <Activity size={13} color={P.blue2} /> تقدم الدراسة
        </div>
        <div style={{ fontSize: 12, fontWeight: 900, color: pct === 100 ? P.green : P.blue2 }}>
          {pct}%
        </div>
      </div>
      <div style={{ height: 5, background: t.s3, borderRadius: 3, overflow: "hidden", marginBottom: 10 }}>
        <div style={{
          height: "100%", width: `${pct}%`, borderRadius: 3, transition: "width .4s ease",
          background: pct === 100 ? `linear-gradient(90deg,${P.green},#34d399)` : `linear-gradient(90deg,${P.blue},${P.blue2})`,
        }} />
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        {Array.from({ length: UNITS }, (_, i) => {
          const u = i + 1;
          const checked = done.includes(u);
          return (
            <button key={u} onClick={() => toggle(u)} style={{
              flex: 1, height: 30, borderRadius: 8,
              background: checked ? `${P.blue2}22` : t.s2,
              border: `1.5px solid ${checked ? P.blue2 : t.bd}`,
              cursor: "pointer", transition: "all .2s",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {checked
                ? <CheckCircle size={13} color={P.blue2} />
                : <span style={{ fontSize: 10, fontWeight: 700, color: t.dim }}>{u}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AISection({ subject, t, onChat, files, onToast }) {
  const [aiTab, setAiTab] = useState("chat");
  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {[["chat", "محادثة", Sparkles], ["quiz", "اختبار", FileQuestion]].map(([id, label, Ic]) => (
          <button key={id} onClick={() => setAiTab(id)} style={{
            flex: 1, padding: "8px", borderRadius: 10,
            background: aiTab === id ? `linear-gradient(135deg,${P.blue},${P.blue2})` : t.s2,
            border: `1px solid ${aiTab === id ? P.blue2 : t.bd}`,
            color: aiTab === id ? "#fff" : t.mu, cursor: "pointer", fontFamily: "inherit",
            fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, transition: "all .2s",
          }}>
            <Ic size={14} /> {label}
          </button>
        ))}
      </div>
      {aiTab === "chat" && <AIChat subject={subject} t={t} onChat={onChat} files={files} />}
      {aiTab === "quiz" && <QuizMode subject={subject} t={t} onToast={onToast} />}
    </div>
  );
}

function CoursePage({ subject, onBack, favorites, toggleFav, notes, setNotes, t, onChat, onToast }) {
  const [open, setOpen] = useState(null);
  const [realFiles, setRealFiles] = useState({});
  const [realLoading, setRealLoading] = useState(true);
  const [fileFilter, setFileFilter] = useState({});
  const Icon = getIcon(subject);
  const isFav = (favorites || []).includes(subject);
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
        <div style={{ position: "absolute", top: -40, left: -40, width: 160, height: 160, borderRadius: "50%", background: "rgba(255,255,255,.03)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: -20, right: 40, width: 100, height: 100, borderRadius: "50%", background: `${P.gold}12`, pointerEvents: "none" }} />
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

      <CourseProgress subject={subject} t={t} />
      <GradeCalc subject={subject} t={t} />

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
                  {sec.id === "ai" && <AISection subject={subject} t={t} onChat={onChat} files={realFiles} onToast={onToast} />}
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
                  {["collections", "plans", "curriculum", "programs"].includes(sec.id) && (() => {
                    const fq = (fileFilter[sec.id] || "").toLowerCase();
                    const filteredReal = (realFiles[sec.id] || []).filter(f => !fq || f.name.toLowerCase().includes(fq));
                    const filteredMock = fileData[sec.id].filter(f => !fq || f.name.toLowerCase().includes(fq));
                    return (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, background: t.s2, borderRadius: 10, padding: "6px 12px", border: `1px solid ${t.bd}` }}>
                          <Search size={13} color={t.mu} />
                          <input
                            placeholder="ابحث في الملفات..."
                            value={fileFilter[sec.id] || ""}
                            onChange={e => setFileFilter(prev => ({ ...prev, [sec.id]: e.target.value }))}
                            style={{ flex: 1, border: "none", background: "transparent", outline: "none", fontSize: 12, color: t.tx, fontFamily: "inherit", direction: "rtl" }}
                          />
                          {fileFilter[sec.id] && (
                            <button onClick={() => setFileFilter(prev => ({ ...prev, [sec.id]: "" }))} style={{ background: "none", border: "none", cursor: "pointer", color: t.mu, display: "flex", padding: 2 }}>
                              <X size={12} />
                            </button>
                          )}
                        </div>
                        {filteredReal.map((f, i) => (
                          <RealFileItem key={`real-${i}`} file={f} t={t} onToast={onToast} />
                        ))}
                        {(realFiles[sec.id] || []).length === 0 && !realLoading && !fq && (
                          <div style={{ fontSize: 12, color: t.mu, textAlign: "center", padding: "6px 0 10px", borderBottom: `1px dashed ${t.bd}`, marginBottom: 8 }}>
                            لا توجد ملفات حقيقية بعد
                          </div>
                        )}
                        {filteredMock.map((f, i) => <FileItem key={i} {...f} t={t} onToast={onToast} />)}
                        {fq && filteredReal.length === 0 && filteredMock.length === 0 && (
                          <div style={{ textAlign: "center", padding: "16px 0", color: t.mu, fontSize: 12 }}>لا نتائج لـ «{fileFilter[sec.id]}»</div>
                        )}
                      </div>
                    );
                  })()}
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
/* ══════════════════════════════════════════════════════════════
   STUDY ANALYTICS (Feature 6)
   ══════════════════════════════════════════════════════════════ */
function StudyAnalytics({ sessionLog, t }) {
  const now = Date.now();
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
  const recent = (sessionLog || []).filter(s => {
    const ts = s.t || (s.date ? new Date(s.date).getTime() : 0);
    return ts >= weekAgo;
  });
  const totalMins = recent.reduce((a, s) => a + (s.dur || 25), 0);
  const bySubject = {};
  recent.forEach(s => {
    const subj = s.subject || "عام";
    bySubject[subj] = (bySubject[subj] || 0) + (s.dur || 25);
  });
  const sorted = Object.entries(bySubject).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxMins = sorted[0]?.[1] || 1;

  if (recent.length === 0) {
    return (
      <div style={{ background: t.s1, borderRadius: 18, padding: 16, marginTop: 16, border: `1px solid ${t.bd}` }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: t.tx, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
          <BarChart size={15} color={P.purple} /> إحصائيات المذاكرة
        </div>
        <div style={{ textAlign: "center", padding: "16px 0", color: t.mu, fontSize: 12, lineHeight: 1.7 }}>
          لم تسجّل أي جلسات مذاكرة هذا الأسبوع — استخدم مؤقت البومودورو
        </div>
      </div>
    );
  }
  return (
    <div style={{ background: t.s1, borderRadius: 18, padding: 16, marginTop: 16, border: `1px solid ${t.bd}` }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: t.tx, display: "flex", alignItems: "center", gap: 6 }}>
          <BarChart size={15} color={P.purple} /> إحصائيات المذاكرة
        </div>
        <div style={{ fontSize: 11, color: t.mu }}>{totalMins} دقيقة هذا الأسبوع</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {sorted.map(([subject, mins]) => {
          const pct = Math.round((mins / maxMins) * 100);
          return (
            <div key={subject}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: t.tx, fontWeight: 600 }}>{subject}</span>
                <span style={{ fontSize: 11, color: t.mu }}>{mins}د</span>
              </div>
              <div style={{ height: 6, background: t.s3, borderRadius: 3, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${pct}%`, background: `linear-gradient(90deg,${P.purple},${P.blue2})`, borderRadius: 3, transition: "width .6s" }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   XP BAR (Feature 8)
   ══════════════════════════════════════════════════════════════ */
function XPBar({ xp, t }) {
  const level = getXpLevel(xp);
  const progress = level.next ? Math.round(((xp - level.min) / (level.next - level.min)) * 100) : 100;
  return (
    <div style={{ background: t.s1, borderRadius: 16, padding: "14px 16px", border: `1px solid ${t.bd}`, boxShadow: t.shSm }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <div style={{ width: 38, height: 38, borderRadius: 12, background: `${P.gold}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Trophy size={18} color={P.gold} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: t.tx }}>{level.stars} {level.name}</div>
          <div style={{ fontSize: 11, color: t.mu }}>{xp} XP{level.next ? ` / ${level.next}` : " (أقصى مستوى)"}</div>
        </div>
        <div style={{ fontSize: 22, fontWeight: 900, color: P.gold }}>{xp}</div>
      </div>
      {level.next && (
        <div>
          <div style={{ height: 6, background: t.s3, borderRadius: 3, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${progress}%`, background: `linear-gradient(90deg,${P.gold},${P.orange})`, borderRadius: 3, transition: "width .6s" }} />
          </div>
          <div style={{ fontSize: 10, color: t.mu, marginTop: 4 }}>
            {level.next - xp} XP للمستوى التالي
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   EXAM COUNTDOWN WIDGET (Feature 2)
   ══════════════════════════════════════════════════════════════ */
function ExamCountdown({ exams, setExams, t, onToast, setXp }) {
  const [showAdd, setShowAdd] = useState(false);
  const [newExam, setNewExam] = useState({ subject: ALL_SUBJECTS_LIST[0] || "", date: "", type: "ميدترم" });
  const today = todayKey();

  const upcoming = (exams || []).filter(e => e.date >= today).sort((a, b) => a.date.localeCompare(b.date));

  const addExam = () => {
    if (!newExam.date) return;
    setExams(prev => [...(prev || []), { ...newExam, id: Date.now() }]);
    setNewExam({ subject: ALL_SUBJECTS_LIST[0] || "", date: "", type: "ميدترم" });
    setShowAdd(false);
    // Award XP
    const xp = storage.get("xp", 0);
    storage.set("xp", xp + 20);
    setXp(xp + 20);
    onToast?.("تم إضافة الاختبار +20 XP", "success");
  };

  const remove = (id) => setExams(prev => (prev || []).filter(e => e.id !== id));

  const countdownColor = (days) => days <= 3 ? P.red : days <= 7 ? P.orange : P.green;

  return (
    <div style={{ background: t.s1, borderRadius: 18, padding: 16, marginBottom: 16, border: `1px solid ${t.bd}`, boxShadow: t.shSm }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: t.tx, display: "flex", alignItems: "center", gap: 6 }}>
          <Calendar size={15} color={P.red} /> اختباراتي القادمة
        </div>
        <button onClick={() => setShowAdd(s => !s)} style={{ background: `${P.red}15`, border: "none", borderRadius: 8, padding: "5px 10px", cursor: "pointer", color: P.red, fontSize: 12, fontFamily: "inherit", display: "flex", alignItems: "center", gap: 4, fontWeight: 700 }}>
          <Plus size={12} /> اختبار
        </button>
      </div>
      {showAdd && (
        <div style={{ background: t.s2, borderRadius: 12, padding: 12, marginBottom: 12, animation: "fadeUp .3s ease" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <select value={newExam.subject} onChange={e => setNewExam(p => ({ ...p, subject: e.target.value }))}
              style={{ border: `1px solid ${t.bd}`, borderRadius: 8, padding: "8px 10px", fontSize: 13, background: t.s1, color: t.tx, fontFamily: "inherit", direction: "rtl", outline: "none" }}>
              {ALL_SUBJECTS_LIST.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <input type="date" value={newExam.date} onChange={e => setNewExam(p => ({ ...p, date: e.target.value }))}
                style={{ border: `1px solid ${t.bd}`, borderRadius: 8, padding: "8px 10px", fontSize: 13, background: t.s1, color: t.tx, fontFamily: "inherit", outline: "none" }} />
              <select value={newExam.type} onChange={e => setNewExam(p => ({ ...p, type: e.target.value }))}
                style={{ border: `1px solid ${t.bd}`, borderRadius: 8, padding: "8px 10px", fontSize: 13, background: t.s1, color: t.tx, fontFamily: "inherit", outline: "none" }}>
                {["ميدترم", "نهائي", "مشروع"].map(tp => <option key={tp} value={tp}>{tp}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Btn variant="ghost" size="sm" onClick={() => setShowAdd(false)} style={{ flex: 1 }}>إلغاء</Btn>
              <Btn variant="primary" size="sm" onClick={addExam} style={{ flex: 2 }} disabled={!newExam.date}>
                <Plus size={14} /> إضافة
              </Btn>
            </div>
          </div>
        </div>
      )}
      {upcoming.length === 0 ? (
        <div style={{ textAlign: "center", padding: "10px 0", color: t.dim, fontSize: 12 }}>لا اختبارات قادمة — أضف اختبارك الأول!</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {upcoming.slice(0, 5).map(exam => {
            const days = Math.ceil((new Date(exam.date) - new Date(today)) / 86400000);
            const cc = countdownColor(days);
            return (
              <div key={exam.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 10px", background: t.s2, borderRadius: 10, border: `1px solid ${t.bd}` }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: t.tx, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{exam.subject}</div>
                  <div style={{ fontSize: 10, color: t.mu, marginTop: 1 }}>{exam.type} • {new Date(exam.date + "T12:00:00").toLocaleDateString("ar-SA", { month: "short", day: "numeric" })}</div>
                </div>
                <div style={{ background: `${cc}18`, color: cc, borderRadius: 8, padding: "3px 8px", fontSize: 11, fontWeight: 800, flexShrink: 0 }}>
                  {days === 0 ? "اليوم!" : days === 1 ? "غداً" : `تبقى ${days} يوم`}
                </div>
                <button onClick={() => remove(exam.id)} style={{ background: "none", border: "none", cursor: "pointer", color: t.dim, display: "flex", padding: 2 }}>
                  <X size={11} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MONTHLY REPORT MODAL (Feature 7)
   ══════════════════════════════════════════════════════════════ */
function MonthlyReportModal({ t, sessionLog, tasks, semesters, onClose }) {
  const now = new Date();
  const monthNames = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
  const monthName = monthNames[now.getMonth()];

  const thisMonth = (sessionLog || []).filter(s => {
    const d = new Date(s.t || (s.date ? s.date + "T12:00:00" : Date.now()));
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const totalMonthMins = thisMonth.reduce((a, s) => a + (s.dur || 25), 0);
  const totalMonthHours = Math.floor(totalMonthMins / 60);

  const doneTasks = (tasks || []).filter(tk => tk.done).length;
  const lastGpa = semesters?.length ? parseFloat(semesters[semesters.length - 1]?.gpa || 0) : null;

  const bySubject = {};
  thisMonth.forEach(s => { const sub = s.subject || "عام"; bySubject[sub] = (bySubject[sub] || 0) + (s.dur || 25); });
  const topSubject = Object.entries(bySubject).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";

  const studyDays = new Set(thisMonth.map(s => s.date || new Date(s.t || Date.now()).toISOString().slice(0, 10))).size;

  // Weekly breakdown for this month
  const weeklyMins = [0, 0, 0, 0, 0];
  thisMonth.forEach(s => {
    const d = new Date(s.t || (s.date ? s.date + "T12:00:00" : Date.now()));
    const dayOfMonth = d.getDate();
    const weekIdx = Math.min(Math.floor((dayOfMonth - 1) / 7), 4);
    weeklyMins[weekIdx] += (s.dur || 25);
  });
  const maxWeekMins = Math.max(...weeklyMins, 1);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(0,0,0,.6)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, animation: "fadeIn .2s ease" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: t.s1, borderRadius: 24, padding: 24, maxWidth: 420, width: "100%", maxHeight: "85vh", overflowY: "auto", boxShadow: t.sh, border: `1px solid ${t.bd}`, animation: "scaleIn .25s ease" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ fontSize: 17, fontWeight: 900, color: t.tx, display: "flex", alignItems: "center", gap: 8 }}>
            <FileBarChart size={18} color={P.blue2} /> التقرير الشهري
          </div>
          <button onClick={onClose} style={{ background: t.s2, border: "none", borderRadius: 8, padding: 7, cursor: "pointer", display: "flex", color: t.mu }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ background: t.hero, borderRadius: 16, padding: 16, marginBottom: 16, textAlign: "center" }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: P.gold }}>{monthName} {now.getFullYear()}</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,.6)", marginTop: 4 }}>التقرير الشهري الأكاديمي</div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
          {[
            { label: "ساعات الدراسة", value: totalMonthHours + "س", color: P.blue2, Icon: Clock },
            { label: "مهام منجزة", value: doneTasks, color: P.green, Icon: CheckCircle },
            { label: "آخر معدل", value: lastGpa ? lastGpa.toFixed(2) : "—", color: P.gold, Icon: Trophy },
            { label: "أيام الدراسة", value: studyDays, color: P.purple, Icon: Calendar },
          ].map(({ label, value, color, Icon: Ic }) => (
            <div key={label} style={{ background: t.s2, borderRadius: 12, padding: 12, border: `1px solid ${t.bd}`, textAlign: "center" }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: `${color}18`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 8px" }}>
                <Ic size={15} color={color} />
              </div>
              <div style={{ fontSize: 18, fontWeight: 900, color }}>{value}</div>
              <div style={{ fontSize: 10, color: t.mu, marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>

        <div style={{ background: t.s2, borderRadius: 12, padding: 12, marginBottom: 16, border: `1px solid ${t.bd}` }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: t.tx, marginBottom: 4 }}>المادة الأكثر مذاكرة</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: P.blue2 }}>{topSubject}</div>
        </div>

        <div style={{ background: t.s1, borderRadius: 14, padding: 14, border: `1px solid ${t.bd}` }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: t.tx, marginBottom: 12 }}>دقائق الدراسة أسبوعياً</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 80 }}>
            {weeklyMins.map((v, i) => {
              const h = Math.max(4, (v / maxWeekMins) * 100);
              return (
                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                  <div style={{ fontSize: 9, color: t.dim }}>{v}</div>
                  <div style={{ width: "100%", height: `${h}%`, borderRadius: "4px 4px 0 0", background: `linear-gradient(180deg,${P.blue2},${P.blue})`, minHeight: 4 }} />
                  <div style={{ fontSize: 9, color: t.mu }}>أ{i + 1}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   FOCUS MODE OVERLAY (Feature 5)
   ══════════════════════════════════════════════════════════════ */
function FocusMode({ t, sessionLog, setSessionLog, totalSessions, setTotalSessions, soundOn, onToast, onClose, setXp }) {
  const [focusSubject, setFocusSubject] = useState(ALL_SUBJECTS_LIST[0] || "عام");
  const [mode, setMode] = useState("work");
  const [secs, setSecs] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [focusQ, setFocusQ] = useState("");
  const [focusA, setFocusA] = useState("");
  const [focusLoading, setFocusLoading] = useState(false);
  const timerRef = useRef(null);
  const DURATIONS = { work: 25 * 60, short: 5 * 60 };
  const mm = String(Math.floor(secs / 60)).padStart(2, "0");
  const ss = String(secs % 60).padStart(2, "0");
  const prog = 1 - secs / DURATIONS[mode];
  const r = 50; const circ = 2 * Math.PI * r;
  const modeColor = mode === "work" ? P.blue2 : P.green;

  useEffect(() => {
    if (running) {
      timerRef.current = setInterval(() => setSecs(s => {
        if (s <= 1) {
          clearInterval(timerRef.current); setRunning(false);
          if (soundOn) playBell();
          if (mode === "work") {
            setTotalSessions(n => n + 1);
            setSessionLog(l => [...l, { date: todayKey(), dur: 25, subject: focusSubject, t: Date.now() }]);
            const xp = storage.get("xp", 0);
            storage.set("xp", xp + 30);
            setXp(xp + 30);
            onToast?.("جلسة تركيز مكتملة! +30 XP", "success");
          }
          return 0;
        }
        return s - 1;
      }), 1000);
    } else clearInterval(timerRef.current);
    return () => clearInterval(timerRef.current);
  }, [running, mode, focusSubject, soundOn]);

  const changeMode = (m) => { clearInterval(timerRef.current); setRunning(false); setMode(m); setSecs(DURATIONS[m]); };

  const askAI = async () => {
    if (!focusQ.trim() || focusLoading) return;
    setFocusLoading(true); setFocusA("");
    try {
      const res = await fetch("/api/ai", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: focusSubject, messages: [{ role: "user", content: focusQ }], fileContext: null }),
      });
      const d = await res.json();
      setFocusA(d.text || d.error || "لا توجد إجابة");
    } catch { setFocusA("تعذّر الاتصال"); }
    setFocusLoading(false);
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 450, background: "rgba(2,6,18,.97)", display: "flex", flexDirection: "column", animation: "fadeIn .3s ease" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,.08)" }}>
        <div style={{ fontSize: 16, fontWeight: 900, color: "#fff", display: "flex", alignItems: "center", gap: 8 }}>
          <Target size={18} color={P.blue2} /> وضع التركيز
        </div>
        <button onClick={onClose} style={{ background: "rgba(255,255,255,.1)", border: "none", borderRadius: 8, padding: 8, cursor: "pointer", color: "#fff", display: "flex" }}>
          <X size={18} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "20px 16px", maxWidth: 480, margin: "0 auto", width: "100%" }}>
        {/* Subject selector */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,.5)", marginBottom: 6 }}>مادة الدراسة</div>
          <select value={focusSubject} onChange={e => setFocusSubject(e.target.value)}
            style={{ width: "100%", background: "rgba(255,255,255,.08)", color: "#fff", border: "1px solid rgba(255,255,255,.15)", borderRadius: 12, padding: "10px 14px", fontSize: 14, fontFamily: "inherit", direction: "rtl", outline: "none", fontWeight: 700 }}>
            {ALL_SUBJECTS_LIST.map(s => <option key={s} value={s} style={{ background: "#0b1e42" }}>{s}</option>)}
          </select>
        </div>

        {/* Pomodoro Timer */}
        <div style={{ background: "rgba(255,255,255,.04)", borderRadius: 20, padding: 24, marginBottom: 20, textAlign: "center", border: "1px solid rgba(255,255,255,.08)" }}>
          <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 20 }}>
            {[["work", "⚡ دراسة"], ["short", "☕ راحة"]].map(([m, l]) => (
              <button key={m} onClick={() => changeMode(m)} style={{ background: mode === m ? "rgba(255,255,255,.2)" : "transparent", border: `1px solid rgba(255,255,255,${mode === m ? .4 : .12})`, borderRadius: 20, padding: "5px 14px", cursor: "pointer", fontSize: 12, color: "rgba(255,255,255,.9)", fontFamily: "inherit" }}>{l}</button>
            ))}
          </div>
          <div style={{ position: "relative", display: "inline-block", marginBottom: 16 }}>
            <svg width={120} height={120} style={{ transform: "rotate(-90deg)" }}>
              <circle cx={60} cy={60} r={r} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth={7} />
              <circle cx={60} cy={60} r={r} fill="none" stroke={modeColor} strokeWidth={7}
                strokeDasharray={circ} strokeDashoffset={circ * (1 - prog)} strokeLinecap="round"
                style={{ transition: "stroke-dashoffset .9s linear" }} />
            </svg>
            <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", textAlign: "center" }}>
              <div style={{ fontSize: 28, fontWeight: 900, color: "#fff", fontFamily: "monospace" }}>{mm}:{ss}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <button onClick={() => { clearInterval(timerRef.current); setRunning(false); setSecs(DURATIONS[mode]); }} style={{ background: "rgba(255,255,255,.1)", border: "none", borderRadius: "50%", width: 38, height: 38, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,.7)" }}>
              <RotateCcw size={14} />
            </button>
            <button onClick={() => setRunning(rv => !rv)} style={{ background: running ? P.red : modeColor, border: "none", borderRadius: 22, padding: "10px 28px", cursor: "pointer", color: "#fff", fontSize: 14, fontWeight: 800, fontFamily: "inherit", display: "flex", alignItems: "center", gap: 7 }}>
              {running ? <><Pause size={15} />إيقاف</> : <><Play size={15} />بدء</>}
            </button>
          </div>
        </div>

        {/* Quick AI Question */}
        <div style={{ background: "rgba(255,255,255,.04)", borderRadius: 16, padding: 16, border: "1px solid rgba(255,255,255,.08)" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,.8)", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
            <Sparkles size={14} color={P.gold} /> اسأل سؤالاً سريعاً
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <input value={focusQ} onChange={e => setFocusQ(e.target.value)} onKeyDown={e => e.key === "Enter" && askAI()}
              placeholder="اكتب سؤالك..."
              style={{ flex: 1, background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 10, padding: "8px 12px", color: "#fff", fontSize: 12, fontFamily: "inherit", direction: "rtl", outline: "none" }} />
            <button onClick={askAI} disabled={focusLoading || !focusQ.trim()} style={{ background: focusLoading || !focusQ.trim() ? "rgba(255,255,255,.1)" : `linear-gradient(135deg,${P.navy},${P.blue2})`, border: "none", borderRadius: 10, padding: "8px 14px", cursor: "pointer", color: "#fff", fontFamily: "inherit", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 5 }}>
              {focusLoading ? "…" : <Send size={13} />}
            </button>
          </div>
          {focusA && (
            <div style={{ background: "rgba(255,255,255,.06)", borderRadius: 10, padding: 12, fontSize: 12, color: "rgba(255,255,255,.8)", lineHeight: 1.7, maxHeight: 150, overflowY: "auto" }}>
              {focusA}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const SEU_CALENDAR = [
  { label: "الاختبارات النهائية — الفصل الثاني 1447", date: "2026-06-07", color: P.red, CIcon: Flame },
  { label: "نتائج الفصل الثاني 1447", date: "2026-06-28", color: P.green, CIcon: Trophy },
  { label: "التسجيل للفصل الأول 1448", date: "2026-07-20", color: P.purple, CIcon: FileText },
  { label: "بداية الفصل الأول 1448", date: "2026-09-06", color: P.blue2, CIcon: GraduationCap },
  { label: "اختبارات الميدترم — الفصل الأول 1448", date: "2026-10-25", color: P.gold, CIcon: PenLine },
  { label: "الاختبارات النهائية — الفصل الأول 1448", date: "2026-12-13", color: P.red, CIcon: Flame },
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
            <div style={{
              width: 34, height: 34, borderRadius: 10, flexShrink: 0,
              background: `${e.color}18`, display: "flex", alignItems: "center", justifyContent: "center",
              border: `1px solid ${e.color}30`,
            }}>
              <e.CIcon size={16} color={e.color} strokeWidth={2} />
            </div>
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

function HomePage({ setActiveTab, openCourse, onOpenAI, t, recent, streak, activeDays, weeklyGoal, weekProgress, achievements, sessionLog, semesters, schedule, tasks, setTasks, onToast, exams, setExams, xp, setXp, onShowFocus, onShowReport }) {
  const hour = new Date().getHours();
  const greeting = hour < 5 ? "طاب ليلك" : hour < 12 ? "صباح الخير" : hour < 17 ? "مساء الخير" : "طاب مساؤك";
  const [tipIdx, setTipIdx] = useState(() => Math.floor(Date.now() / 3600000) % TIPS.length);
  const [pwaPrompt, setPwaPrompt] = useState(null);
  useEffect(() => {
    const iv = setInterval(() => setTipIdx(Math.floor(Date.now() / 3600000) % TIPS.length), 60000);
    return () => clearInterval(iv);
  }, []);
  useEffect(() => {
    const handler = (e) => { e.preventDefault(); setPwaPrompt(e); };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);
  const installPwa = () => {
    if (!pwaPrompt) return;
    pwaPrompt.prompt();
    pwaPrompt.userChoice.then(() => setPwaPrompt(null));
  };
  const tip = TIPS[tipIdx];
  const todayAr = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"][new Date().getDay()];
  const todayLectures = (schedule || []).filter(l => l.day === todayAr).sort((a, b) => a.time.localeCompare(b.time));
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
        <div style={{ position: "absolute", top: -60, right: -60, width: 200, height: 200, borderRadius: "50%", background: "rgba(255,255,255,.03)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: -30, left: -20, width: 120, height: 120, borderRadius: "50%", background: `${P.gold}10`, pointerEvents: "none" }} />
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
          <button onClick={onOpenAI} style={{
            background: `linear-gradient(135deg,${P.gold}22,${P.gold}44)`, border: `1px solid ${P.gold}60`,
            borderRadius: 20, padding: "6px 14px", cursor: "pointer", fontSize: 12,
            color: P.gold, fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5,
          }}>
            <Sparkles size={12} /> المساعد الذكي
          </button>
          {pwaPrompt && (
            <button onClick={installPwa} style={{
              background: `${P.green}25`, border: `1px solid ${P.green}50`,
              borderRadius: 20, padding: "6px 14px", cursor: "pointer", fontSize: 12,
              color: P.green, fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5,
            }}>
              <Download size={12} /> ثبّت التطبيق
            </button>
          )}
        </div>
      </div>

      {/* Today's Lectures */}
      <div style={{ background: t.s1, borderRadius: 18, padding: 14, marginBottom: 14, border: `1px solid ${t.bd}`, boxShadow: t.shSm }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: t.tx, display: "flex", alignItems: "center", gap: 6 }}>
            <CalendarDays size={14} color={P.blue2} /> محاضرات اليوم
            <span style={{ fontSize: 11, color: t.mu, fontWeight: 500 }}>({todayAr})</span>
          </div>
          <button onClick={() => setActiveTab("schedule")} style={{ background: "none", border: "none", cursor: "pointer", color: P.blue2, fontSize: 11, fontFamily: "inherit", display: "flex", alignItems: "center", gap: 3, fontWeight: 700 }}>
            الجدول <ChevronLeft size={11} />
          </button>
        </div>
        {todayLectures.length === 0 ? (
          <div style={{ fontSize: 12, color: t.dim }}>لا محاضرات اليوم</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {todayLectures.map(lec => (
              <div key={lec.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: `${P.blue2}08`, borderRadius: 9, border: `1px solid ${P.blue2}20` }}>
                <div style={{ width: 26, height: 26, borderRadius: 7, background: `${P.blue2}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Clock size={12} color={P.blue2} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: t.tx }}>{lec.course}</div>
                  <div style={{ fontSize: 10, color: t.mu }}>{lec.time}{lec.room ? ` • ${lec.room}` : ""}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Daily Progress */}
      <DailyProgress sessionLog={sessionLog} weeklyGoal={weeklyGoal} t={t} />

      {/* Exam Countdown */}
      <ExamCountdown exams={exams} setExams={setExams} t={t} onToast={onToast} setXp={setXp} />

      {/* Task Tracker */}
      <TaskTracker t={t} tasks={tasks} setTasks={setTasks} onToast={onToast} />

      <div style={{ background: t.s1, borderRadius: 18, padding: 16, marginBottom: 16, border: `1px solid ${t.bd}`, boxShadow: t.shSm }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 12, background: `linear-gradient(135deg,${P.orange},${P.orangeLight})`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 4px 12px ${P.orange}40` }}>
            <Flame size={18} color="#fff" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: t.tx }}>سلسلة الدراسة</div>
            <div style={{ fontSize: 11, color: t.mu }}>{streak > 0 ? `${streak} يوم متواصل! استمر` : "ابدأ سلسلتك اليوم"}</div>
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
            {goalPct >= 100 ? "تم تحقيق الهدف الأسبوعي!" : `يتبقى ${Math.max(0, weeklyGoal - weekProgress)} جلسة`}
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

      {/* XP Bar */}
      <div style={{ marginBottom: 16 }}>
        <XPBar xp={xp || 0} t={t} />
      </div>

      {/* Quick Stats Bar */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 8 }}>
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
      {/* Action Cards Row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
        <button onClick={onShowFocus} style={{ background: `linear-gradient(135deg,${P.navy},${P.blue2})`, border: "none", borderRadius: 14, padding: "14px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, fontFamily: "inherit" }}>
          <Target size={20} color="#fff" />
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#fff" }}>وضع التركيز</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,.6)" }}>مؤقت + ذكاء اصطناعي</div>
          </div>
        </button>
        <button onClick={onShowReport} style={{ background: `${P.purple}15`, border: `1px solid ${P.purple}30`, borderRadius: 14, padding: "14px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, fontFamily: "inherit" }}>
          <FileBarChart size={20} color={P.purple} />
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: t.tx }}>التقرير الشهري</div>
            <div style={{ fontSize: 10, color: t.mu }}>إحصائيات شاملة</div>
          </div>
        </button>
      </div>

      {/* Academic Calendar */}
      <AcademicCalendar t={t} />

      <div style={{
        background: t.s1, borderRadius: 18,
        padding: "16px", marginBottom: 16, border: `1.5px solid ${P.gold}40`,
        boxShadow: `0 4px 20px ${P.gold}15`,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 30, height: 30, borderRadius: 10, background: `${P.gold}20`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Lightbulb size={15} color={P.gold} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 800, color: P.gold }}>نصيحة الساعة</span>
          </div>
          <button
            onClick={() => setTipIdx(i => (i + 1) % TIPS.length)}
            style={{ background: `${P.gold}15`, border: `1px solid ${P.gold}35`, borderRadius: 20, padding: "5px 12px", cursor: "pointer", fontSize: 11, color: P.gold, fontFamily: "inherit", display: "flex", alignItems: "center", gap: 4, fontWeight: 700 }}>
            <RotateCcw size={11} /> التالية
          </button>
        </div>
        <p style={{ margin: 0, fontSize: 13.5, color: t.tx, lineHeight: 1.8, fontWeight: 500, paddingRight: 4, borderRight: `3px solid ${P.gold}`, paddingRight: 12 }}>{tip}</p>
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
  const groups = q ? (() => {
    const out = [];
    const cats = [
      { key: "preparatory", label: "السنة الأولى المشتركة", color: P.blue2 },
      { key: "bachelor", label: "بكالوريوس", color: P.purple },
      { key: "diploma", label: "دبلوم", color: P.green },
      { key: "graduate", label: "دراسات عليا", color: P.gold },
    ];
    cats.forEach(({ key, label, color }) => {
      let items = [];
      if (key === "preparatory") {
        items = Object.values(TREE.preparatory.plans).flatMap(p => p.subjects).filter(s => s.toLowerCase().includes(q));
      } else if (key === "bachelor") {
        items = TREE.bachelor.colleges.flatMap(c => c.programs).filter(s => s.toLowerCase().includes(q));
      } else if (key === "diploma") {
        items = TREE.diploma.programs.filter(s => s.toLowerCase().includes(q));
      } else {
        items = TREE.graduate.programs.filter(s => s.toLowerCase().includes(q));
      }
      if (items.length) out.push({ label, color, items });
    });
    return out;
  })() : [];
  const total = groups.reduce((a, g) => a + g.items.length, 0);

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
        ) : groups.length === 0 ? (
          <div style={{ textAlign: "center", padding: 30 }}>
            <div style={{ fontSize: 14, color: t.mu }}>لا توجد نتائج لـ «{query}»</div>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 12, color: t.mu, marginBottom: 14 }}>{total} نتيجة</div>
            {groups.map((g, gi) => (
              <div key={gi} style={{ marginBottom: 14 }}>
                <div style={{
                  fontSize: 11, fontWeight: 800, color: g.color, marginBottom: 6,
                  display: "flex", alignItems: "center", gap: 5,
                }}>
                  <div style={{ width: 3, height: 12, borderRadius: 2, background: g.color }} />
                  {g.label}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {g.items.map((s, i) => {
                    const SIcon = getIcon(s);
                    return (
                      <button key={i} onClick={() => { onCourse(s); onClose(); }} style={{
                        background: t.s1, border: `1px solid ${t.bd}`, borderRadius: 12,
                        padding: "11px 13px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10,
                        fontFamily: "inherit", textAlign: "right", transition: "all .2s",
                      }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = g.color + "60"; e.currentTarget.style.background = t.s2; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = t.bd; e.currentTarget.style.background = t.s1; }}>
                        <div style={{ width: 34, height: 34, borderRadius: 10, background: `${g.color}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <SIcon size={15} color={g.color} />
                        </div>
                        <div style={{ flex: 1, fontSize: 13, fontWeight: 700, color: t.tx }}>{s}</div>
                        <ChevronLeft size={14} color={t.dim} />
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
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
      desc="افتح أي مادة واضغط زر النجمة في أعلى الصفحة لإضافتها للمفضلة"
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
        <div style={{ position: "absolute", top: -50, right: -50, width: 180, height: 180, borderRadius: "50%", background: "rgba(255,255,255,.04)", pointerEvents: "none" }} />
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
        {notifs.map(n => {
          const NIcon = NOTIF_ICONS[n.iconKey] || (n.Icon && typeof n.Icon !== "string" ? n.Icon : Bell);
          return (
          <div key={n.id} onClick={() => setNotifs(ns => ns.map(x => x.id === n.id ? { ...x, read: true } : x))} style={{
            display: "flex", gap: 12, padding: "12px", borderRadius: 14, marginBottom: 8, cursor: "pointer",
            background: n.read ? t.s1 : t.s2, border: `1px solid ${n.read ? t.bd : P.blue2 + "30"}`, transition: "all .2s",
          }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: `${P.blue}15`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <NIcon size={16} color={P.blue2} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: t.tx, display: "flex", alignItems: "center", gap: 6 }}>
                {n.title}{!n.read && <span style={{ width: 7, height: 7, borderRadius: "50%", background: P.blue2, display: "inline-block" }} />}
              </div>
              <div style={{ fontSize: 12, color: t.mu, marginTop: 2, lineHeight: 1.5 }}>{n.text}</div>
              <div style={{ fontSize: 10, color: t.dim, marginTop: 4 }}>{n.time}</div>
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   SETTINGS PANEL
   ══════════════════════════════════════════════════════════════ */
function SettingsPanel({ t, onClose, dark, setDark, soundOn, setSoundOn, weeklyGoal, setWeeklyGoal, onReset, onToast }) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const router = useRouter();

  const handleSignOut = async () => {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    // Go to the home page, not /login — login is optional now, so the
    // user stays in the (now signed-out) app. If login is ever required
    // again, middleware redirects "/" to /login on its own.
    router.push("/");
    router.refresh();
  };
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

          <Btn variant="ghost" onClick={handleSignOut} disabled={signingOut} style={{ width: "100%", marginBottom: 8 }}>
            <LogOut size={14} /> {signingOut ? "جارٍ تسجيل الخروج..." : "تسجيل الخروج"}
          </Btn>

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
function Onboarding({ onClose, skipWalkthrough, t }) {
  const [phase, setPhase] = useState(0); // 0=splash, 1-3=walkthrough
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (phase === 0) {
      const timer = setTimeout(() => skipWalkthrough ? onClose() : setPhase(1), 3200);
      return () => clearTimeout(timer);
    }
  }, [phase]);

  const steps = [
    { Icon: BookOpen, color: P.blue2, title: "تجميعات وملخصات", desc: "وصول فوري لتجميعات الاختبارات، الخطط الدراسية، وملاحظات شاملة لكل مادة وبرنامج." },
    { Icon: Sparkles, color: P.gold, title: "مساعد ذكاء اصطناعي", desc: "اسأل المساعد الذكي عن أي شيء يخص مادتك — شرح، تلخيص، حل أمثلة — فوري ودقيق." },
    { Icon: Trophy, color: P.orange, title: "تتبّع تقدّمك", desc: "احسب معدلك، استخدم مؤقت بومودورو، تتبّع إنجازاتك وحافظ على سلسلة دراسة يومية." },
  ];

  if (phase === 0) {
    const features = [
      { Icon: Calculator, label: "حاسبة المعدل" },
      { Icon: AlarmClock, label: "مؤقت بومودورو" },
      { Icon: Sparkles, label: "ذكاء اصطناعي" },
    ];
    return (
      <div style={{
        position: "fixed", inset: 0, zIndex: 400,
        background: "linear-gradient(160deg, #04091a 0%, #06164a 40%, #0a2070 70%, #050d30 100%)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        padding: 28, animation: "fadeIn .4s ease", overflow: "hidden",
      }}>
        {/* Background orbs */}
        <div style={{ position: "absolute", top: "10%", right: "15%", width: 260, height: 260, borderRadius: "50%", background: "radial-gradient(circle, rgba(26,86,219,.18) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: "15%", left: "10%", width: 200, height: 200, borderRadius: "50%", background: "radial-gradient(circle, rgba(200,168,75,.10) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: "55%", right: "5%", width: 140, height: 140, borderRadius: "50%", background: "radial-gradient(circle, rgba(124,58,237,.08) 0%, transparent 70%)", pointerEvents: "none" }} />

        {/* Logo */}
        <div style={{
          width: 96, height: 96, borderRadius: 28,
          background: "linear-gradient(135deg, #0f2d7a, #1a56db)",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 16px 60px rgba(26,86,219,.55), 0 4px 20px rgba(0,0,0,.5)",
          marginBottom: 24, animation: "scaleIn .6s ease",
          border: "1.5px solid rgba(255,255,255,.12)",
        }}>
          <GraduationCap size={50} color={P.gold} strokeWidth={1.6} />
        </div>

        <div style={{
          fontSize: 58, fontWeight: 900, color: "#fff", lineHeight: 1,
          marginBottom: 8, animation: "fadeUp .7s ease .1s backwards",
          letterSpacing: -1, textShadow: "0 4px 30px rgba(26,86,219,.6)",
        }}>
          حلول
        </div>
        <div style={{
          fontSize: 14, color: P.gold, fontWeight: 700, marginBottom: 6,
          animation: "fadeUp .7s ease .2s backwards", letterSpacing: .5,
        }}>
          بوابة الطالب الذكية
        </div>
        <div style={{
          fontSize: 12, color: "rgba(255,255,255,.5)", marginBottom: 48,
          animation: "fadeUp .7s ease .3s backwards",
        }}>
          الجامعة السعودية الإلكترونية — SEU
        </div>

        {/* Feature pills */}
        <div style={{
          display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center",
          marginBottom: 48, animation: "fadeUp .7s ease .45s backwards",
        }}>
          {features.map(({ Icon: FIcon, label }, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 7,
              background: "rgba(255,255,255,.06)", backdropFilter: "blur(8px)",
              border: "1px solid rgba(255,255,255,.1)", borderRadius: 24,
              padding: "8px 16px",
            }}>
              <FIcon size={14} color={P.gold} />
              <span style={{ fontSize: 12, color: "rgba(255,255,255,.8)", fontWeight: 600 }}>{label}</span>
            </div>
          ))}
        </div>

        {/* Loading bar */}
        <div style={{
          width: 200, height: 4, background: "rgba(255,255,255,.1)", borderRadius: 2, overflow: "hidden",
          animation: "fadeUp .7s ease .5s backwards",
        }}>
          <div style={{
            height: "100%", background: `linear-gradient(90deg, ${P.blue2}, ${P.gold})`,
            borderRadius: 2, animation: "splashBar 3.2s ease forwards",
          }} />
        </div>
      </div>
    );
  }

  const s = steps[step];
  const last = step === steps.length - 1;
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 400, background: "rgba(0,0,0,.65)",
      backdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center",
      padding: 20, animation: "fadeIn .25s ease",
    }}>
      <div style={{
        background: t.s1, borderRadius: 26, padding: "30px 26px", maxWidth: 380, width: "100%",
        textAlign: "center", boxShadow: t.sh, border: `1px solid ${t.bd}`, animation: "scaleIn .3s ease",
      }}>
        {/* Step progress dots */}
        <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 24 }}>
          {steps.map((_, i) => (
            <div key={i} style={{
              width: i === step ? 28 : 8, height: 8, borderRadius: 4,
              background: i <= step ? s.color : t.s3, transition: "all .35s",
            }} />
          ))}
        </div>

        <div style={{
          width: 88, height: 88, borderRadius: 26,
          background: `linear-gradient(135deg, ${s.color}dd, ${s.color}88)`,
          display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px",
          boxShadow: `0 10px 36px ${s.color}45`,
          border: `1.5px solid ${s.color}40`,
        }}>
          <s.Icon size={44} color="#fff" strokeWidth={1.5} />
        </div>

        <h2 style={{ fontSize: 22, fontWeight: 900, color: t.tx, marginBottom: 10, lineHeight: 1.3 }}>{s.title}</h2>
        <p style={{ fontSize: 14, color: t.mu, lineHeight: 1.85, marginBottom: 26 }}>{s.desc}</p>

        <div style={{ display: "flex", gap: 8 }}>
          {step > 0 && (
            <button onClick={() => setStep(step - 1)} style={{
              flex: 1, background: t.s2, border: `1px solid ${t.bd}`, borderRadius: 14,
              padding: "12px 16px", cursor: "pointer", fontSize: 13, color: t.mu,
              fontFamily: "inherit", fontWeight: 700,
            }}>
              السابق
            </button>
          )}
          <button onClick={() => last ? onClose() : setStep(step + 1)} style={{
            flex: 2, background: `linear-gradient(135deg, ${s.color}, ${s.color}cc)`,
            border: "none", borderRadius: 14, padding: "12px 16px",
            cursor: "pointer", fontSize: 14, color: "#fff", fontFamily: "inherit",
            fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
            boxShadow: `0 6px 20px ${s.color}40`,
          }}>
            {last ? <><CheckCircle size={16} /> ابدأ الآن</> : <>التالي <ChevronLeft size={15} /></>}
          </button>
        </div>

        <span onClick={onClose} style={{
          color: t.dim, fontSize: 12, cursor: "pointer", marginTop: 14,
          display: "inline-block", userSelect: "none",
        }}>
          تخطي
        </span>
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
        <div style={{ position: "absolute", top: -40, right: -40, width: 160, height: 160, borderRadius: "50%", background: "rgba(255,255,255,.03)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: -20, left: -10, width: 100, height: 100, borderRadius: "50%", background: `${P.gold}10`, pointerEvents: "none" }} />
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
  // Live notifications: broadcasts sent from the admin panel + the user's
  // own, straight from Supabase (replaces the old localStorage mock).
  const [notifs, setNotifs] = useLiveNotifications();
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
  const [tasks, setTasks] = useStored("tasks", []);
  const [schedule, setSchedule] = useStored("schedule", []);
  const [exams, setExams] = useStored("exams", []);
  const [xp, setXp] = useStored("xp", 0);
  const [showFocus, setShowFocus] = useState(false);
  const [showMonthlyReport, setShowMonthlyReport] = useState(false);
  const [aiSubject, setAiSubject] = useState("عام");
  const [aiGlobalTab, setAiGlobalTab] = useState("chat");
  const [aiClearKey, setAiClearKey] = useState(0);
  const clearGlobalAI = () => {
    const histKey = `aiHistory_${aiSubject.replace(/\s+/g, "_").slice(0, 40)}`;
    storage.set(histKey, null);
    setAiClearKey(k => k + 1);
  };
  const [notifOpen, setNotifOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAI, setShowAI] = useState(false);
  const [showOnboard, setShowOnboard] = useState(true);
  const t = T(dark);
  const toasts = useToasts();
  const unread = (notifs || []).filter(n => !n.read).length;
  const overdueTasks = useMemo(() => {
    const today = todayKey();
    return (tasks || []).filter(tk => !tk.done && tk.dueDate && tk.dueDate < today).length;
  }, [tasks]);

  const activeDays = useMemo(() => {
    const dates = new Set((sessionLog || []).map(s => s.date));
    return [...dates];
  }, [sessionLog]);

  const streak = useMemo(() => {
    const dates = new Set((sessionLog || []).map(s => s.date));
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
    const milestones = { 3: "3 أيام متواصلة! استمر!", 7: "أسبوع كامل! أنت رائع!", 14: "أسبوعان! إنجاز حقيقي!", 30: "شهر كامل! أسطوري!" };
    if (streak > prev && milestones[streak]) toasts.push(milestones[streak], "success");
  }, [streak]);

  const weekProgress = useMemo(() => {
    const days = last7Days();
    return (sessionLog || []).filter(s => days.includes(s.date)).length;
  }, [sessionLog]);

  useEffect(() => {
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }, [tab]);

  // ── Comprehensive back-button / Android back gesture support ──
  // Tracks EVERY navigation change (tabs, overlays, courses) in a local stack
  // and in browser history so popstate fires correctly every time.
  const navHistoryRef   = useRef([]);
  const skipNavPushRef  = useRef(false);

  useEffect(() => {
    if (skipNavPushRef.current) { skipNavPushRef.current = false; return; }
    const o = [showMonthlyReport?'R':'', showFocus?'F':'', showAI?'A':'',
               notifOpen?'N':'', settingsOpen?'S':'', searchOpen?'Q':''].join('');
    const state = { tab, course: course || null, o };
    const top = navHistoryRef.current[navHistoryRef.current.length - 1];
    if (!top || top.tab !== state.tab || top.course !== state.course || top.o !== state.o) {
      navHistoryRef.current.push(state);
      window.history.pushState(state, '');
    }
  }, [tab, course, showMonthlyReport, showFocus, showAI, notifOpen, settingsOpen, searchOpen]);

  const backHandlerRef = useRef(null);
  backHandlerRef.current = () => {
    if (navHistoryRef.current.length <= 1) return;
    skipNavPushRef.current = true;
    navHistoryRef.current.pop();
    const prev = navHistoryRef.current[navHistoryRef.current.length - 1];
    if (!prev) { skipNavPushRef.current = false; return; }
    // Close overlays that weren't open in previous state
    if (showMonthlyReport && !prev.o.includes('R')) setShowMonthlyReport(false);
    if (showFocus        && !prev.o.includes('F')) setShowFocus(false);
    if (showAI           && !prev.o.includes('A')) setShowAI(false);
    if (notifOpen        && !prev.o.includes('N')) setNotifOpen(false);
    if (settingsOpen     && !prev.o.includes('S')) setSettingsOpen(false);
    if (searchOpen       && !prev.o.includes('Q')) { setSearchOpen(false); setSearchQuery(""); }
    // Restore tab and course
    if ((prev.course || null) !== (course || null)) setCourse(prev.course || null);
    if (prev.tab !== tab) setTab(prev.tab);
  };

  useEffect(() => {
    const fn = () => backHandlerRef.current?.();
    window.addEventListener('popstate', fn);
    return () => window.removeEventListener('popstate', fn);
  }, []);


  const openCourse = (s) => {
    setCourse(s);
    setTab("course");
    setRecent(prev => [s, ...(prev || []).filter(x => x !== s)].slice(0, 12));
  };

  const toggleFav = (s) => {
    const exists = favorites.includes(s);
    toasts.push(exists ? `أُزيلت ${s} من المفضلة` : `أُضيفت ${s} للمفضلة`, exists ? "info" : "success");
    setFavorites(prev => (prev || []).includes(s) ? (prev || []).filter(x => x !== s) : [...(prev || []), s]);
  };

  const resetAll = () => {
    storage.clear();
    setDark(true); setFavorites([]); setNotifs(NOTIFS_SEED); setNotes({}); setRecent([]);
    setTotalSessions(0); setSessionLog([]); setGpaCalcs(0); setAiChats(0); setSemesters([]);
    setSoundOn(true); setWeeklyGoal(15); setSeen(false);
    setTasks([]); setSchedule([]); setExams([]); setXp(0);
    setTab("home"); setCourse(null);
  };

  const finishOnboard = () => { setSeen(true); setShowOnboard(false); };

  const achievementsState = { viewed: recent, favorites, totalSessions, gpaCalcs, streak, notes, aiChats };

  const TABS = [
    { id: "home", Icon: Home, label: "الرئيسية" },
    { id: "explore", Icon: Compass, label: "استكشاف" },
    { id: "schedule", Icon: CalendarDays, label: "جدولي" },
    { id: "fav", Icon: Star, label: "المفضلة" },
    { id: "links", Icon: Link2, label: "روابط SEU" },
    { id: "timer", Icon: AlarmClock, label: "مؤقت" },
    { id: "profile", Icon: CircleUser, label: "حسابي" },
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
        @keyframes splashBar { from { width:0% } to { width:100% } }
        @keyframes floatOrb { 0%,100% { transform:translateY(0) } 50% { transform:translateY(-12px) } }
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
        background: dark ? "rgba(7,13,27,.93)" : "rgba(238,243,255,.93)",
        backdropFilter: "blur(20px)", borderBottom: `1px solid ${t.bd}`,
        padding: "13px 16px", display: "flex", alignItems: "center", gap: 10,
        boxShadow: dark ? "0 1px 24px rgba(0,0,0,.45)" : "0 1px 16px rgba(0,50,140,.07)",
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
          setActiveTab={(id) => { setTab(id); setCourse(null); }}
          openCourse={openCourse} onOpenAI={() => setShowAI(true)} t={t} recent={recent} streak={streak}
          activeDays={activeDays} weeklyGoal={weeklyGoal} weekProgress={weekProgress}
          achievements={achievementsState} sessionLog={sessionLog} semesters={semesters}
          schedule={schedule} tasks={tasks} setTasks={setTasks} onToast={toasts.push}
          exams={exams} setExams={setExams} xp={xp} setXp={setXp}
          onShowFocus={() => setShowFocus(true)} onShowReport={() => setShowMonthlyReport(true)} />}

        {tab === "explore" && !course && <ExplorePage onCourse={openCourse} t={t} />}

        {tab === "schedule" && <SchedulePage t={t} schedule={schedule} setSchedule={setSchedule} onToast={toasts.push} />}

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
            <SemesterChart semesters={semesters} t={t} />
            <StudyAnalytics sessionLog={sessionLog} t={t} />
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
        background: dark ? "rgba(7,13,27,.96)" : "rgba(255,255,255,.96)",
        backdropFilter: "blur(24px)", borderTop: `1px solid ${t.bd}`,
        overflowX: "auto", WebkitOverflowScrolling: "touch",
        scrollbarWidth: "none", padding: "6px 8px 14px",
        boxShadow: dark ? "0 -1px 20px rgba(0,0,0,.5)" : "0 -1px 16px rgba(0,50,140,.08)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 2, minWidth: "max-content", margin: "0 auto", justifyContent: "center" }}>
        {TABS.map(({ id, Icon, label }) => {
          const active = id === "explore" ? (tab === "explore" || tab === "course") : tab === id;
          const badge = id === "home" ? overdueTasks : 0;
          return (
            <button key={id} onClick={() => { setTab(id); setCourse(null); }}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                background: "none", border: "none", cursor: "pointer", padding: "5px 10px",
                transition: "all .2s", fontFamily: "inherit", flexShrink: 0,
              }}>
              <div style={{
                width: 40, height: 32, borderRadius: 12, position: "relative",
                background: active ? `linear-gradient(135deg,${P.navy},${P.blue2})` : "transparent",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all .25s",
                boxShadow: active ? `0 3px 12px ${P.blue}55` : "none",
              }}>
                <Icon size={17} color={active ? "#fff" : t.dim} strokeWidth={active ? 2.5 : 1.8} />
                {badge > 0 && <span style={{ position: "absolute", top: -3, right: -3, width: 14, height: 14, borderRadius: "50%", background: P.red, color: "#fff", fontSize: 8, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center" }}>{badge}</span>}
              </div>
              <span style={{ fontSize: 10, fontWeight: active ? 800 : 500, color: active ? P.blue2 : t.dim, whiteSpace: "nowrap" }}>{label}</span>
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
      {showOnboard && <Onboarding onClose={finishOnboard} skipWalkthrough={seen} t={t} />}
      {showAI && (
        <div style={{ position: "fixed", inset: 0, zIndex: 500, display: "flex", flexDirection: "column", background: t.bg }}>
          {/* WhatsApp-like header */}
          <div style={{ background: `linear-gradient(135deg,${P.navyDeep} 0%,${P.navy} 60%,${P.blue} 100%)`, flexShrink: 0, boxShadow: "0 2px 20px rgba(0,0,0,.4)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px 8px" }}>
              <button onClick={() => setShowAI(false)} style={{ background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.2)", borderRadius: 10, padding: "8px 14px", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit", fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                <ArrowLeft size={15} /> رجوع
              </button>
              <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(255,255,255,.13)", display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid rgba(255,255,255,.22)", flexShrink: 0 }}>
                <Sparkles size={22} color={P.gold} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 900, color: "#fff", letterSpacing: 0.2 }}>المساعد الذكي</div>
                <div style={{ fontSize: 11, color: "#4ade80", display: "flex", alignItems: "center", gap: 4, marginTop: 1 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ade80", boxShadow: "0 0 6px #4ade80", display: "inline-block" }} />
                  متصل — يجيب بالعربية
                </div>
              </div>
              <button onClick={clearGlobalAI} style={{ background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.2)", borderRadius: 8, padding: "5px 12px", fontSize: 11, color: "rgba(255,255,255,.8)", cursor: "pointer", fontFamily: "inherit", fontWeight: 600, flexShrink: 0 }}>مسح</button>
            </div>
            {/* Subject Selector + Tab Toggle */}
            <div style={{ padding: "6px 16px 10px", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,.08)", borderRadius: 6, padding: "3px 10px", flexShrink: 0 }}>
                <Book size={12} color="rgba(255,255,255,.7)" />
                <span style={{ fontSize: 11, color: "rgba(255,255,255,.7)", fontWeight: 600, whiteSpace: "nowrap" }}>المادة</span>
              </div>
              <div style={{ flex: 1, position: "relative" }}>
                <select
                  value={aiSubject}
                  onChange={e => { setAiSubject(e.target.value); setAiGlobalTab("chat"); }}
                  style={{
                    width: "100%", appearance: "none", WebkitAppearance: "none",
                    background: "rgba(255,255,255,.14)", color: "#fff",
                    border: "1.5px solid rgba(255,255,255,.28)", borderRadius: 22,
                    padding: "8px 36px 8px 16px", fontSize: 13, fontWeight: 700,
                    fontFamily: "inherit", outline: "none", cursor: "pointer",
                    direction: "rtl",
                  }}>
                  <option value="عام" style={{ background: "#0b1e42", color: "#fff" }}>🌐 عام — مساعد SEU</option>
                  {ALL_COURSES.map(c => <option key={c} value={c} style={{ background: "#0b1e42", color: "#fff" }}>{c}</option>)}
                </select>
                <ChevronDown size={15} color="rgba(255,255,255,.7)" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
              </div>
            </div>
            {/* Mode tabs */}
            <div style={{ display: "flex", gap: 8, padding: "0 16px 12px" }}>
              {[["chat", "محادثة", Sparkles], ["quiz", "اختبار", FileQuestion]].map(([id, label, Ic]) => (
                <button key={id} onClick={() => setAiGlobalTab(id)} style={{
                  flex: 1, padding: "7px 10px", borderRadius: 22,
                  background: aiGlobalTab === id ? "rgba(255,255,255,.22)" : "rgba(255,255,255,.07)",
                  border: `1.5px solid ${aiGlobalTab === id ? "rgba(255,255,255,.5)" : "rgba(255,255,255,.15)"}`,
                  color: aiGlobalTab === id ? "#fff" : "rgba(255,255,255,.6)",
                  cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  transition: "all .2s",
                }}>
                  <Ic size={14} /> {label}
                </button>
              ))}
            </div>
          </div>
          {/* Content fills remaining space */}
          <div style={{ flex: 1, overflow: "hidden" }}>
            {aiGlobalTab === "chat"
              ? <AIChat key={`${aiSubject}-${aiClearKey}`} subject={aiSubject} t={t} onChat={() => setAiChats(c => c + 1)} standalone={false} />
              : <div style={{ padding: 16, overflowY: "auto", height: "100%" }}><QuizMode key={aiSubject} subject={aiSubject} t={t} onToast={toasts.push} /></div>
            }
          </div>
        </div>
      )}
      {showFocus && (
        <FocusMode t={t} sessionLog={sessionLog} setSessionLog={setSessionLog}
          totalSessions={totalSessions} setTotalSessions={setTotalSessions}
          soundOn={soundOn} onToast={toasts.push} onClose={() => setShowFocus(false)}
          setXp={setXp} />
      )}
      {showMonthlyReport && (
        <MonthlyReportModal t={t} sessionLog={sessionLog} tasks={tasks} semesters={semesters}
          onClose={() => setShowMonthlyReport(false)} />
      )}
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
              const cats = [
                { key: "preparatory", label: "السنة الأولى المشتركة", color: P.blue2 },
                { key: "bachelor", label: "بكالوريوس", color: P.purple },
                { key: "diploma", label: "دبلوم", color: P.green },
                { key: "graduate", label: "دراسات عليا", color: P.gold },
              ];
              const groups = cats.map(({ key, label, color }) => {
                let items = [];
                if (key === "preparatory") items = Object.values(TREE.preparatory.plans).flatMap(p => p.subjects).filter(s => s.toLowerCase().includes(q));
                else if (key === "bachelor") items = TREE.bachelor.colleges.flatMap(c => c.programs).filter(s => s.toLowerCase().includes(q));
                else if (key === "diploma") items = TREE.diploma.programs.filter(s => s.toLowerCase().includes(q));
                else items = TREE.graduate.programs.filter(s => s.toLowerCase().includes(q));
                return { label, color, items };
              }).filter(g => g.items.length);
              const total = groups.reduce((a, g) => a + g.items.length, 0);
              if (!total) return (
                <div style={{ textAlign: "center", padding: 30, color: t.mu, fontSize: 13 }}>
                  لا توجد نتائج لـ «{query}»
                </div>
              );
              return (
                <>
                  <div style={{ fontSize: 11, color: t.mu, marginBottom: 10, padding: "0 4px" }}>{total} نتيجة</div>
                  {groups.map((g, gi) => (
                    <div key={gi} style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 10, fontWeight: 800, color: g.color, marginBottom: 5, display: "flex", alignItems: "center", gap: 4 }}>
                        <div style={{ width: 3, height: 10, borderRadius: 2, background: g.color }} />
                        {g.label}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                        {g.items.map((s, i) => {
                          const SIcon = getIcon(s);
                          return (
                            <button key={i} onClick={() => { onCourse(s); onClose(); }} style={{
                              background: t.s2, border: `1px solid ${t.bd}`, borderRadius: 11,
                              padding: "10px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10,
                              fontFamily: "inherit", textAlign: "right", transition: "all .2s",
                            }}
                              onMouseEnter={e => { e.currentTarget.style.borderColor = g.color + "60"; }}
                              onMouseLeave={e => { e.currentTarget.style.borderColor = t.bd; }}>
                              <div style={{ width: 32, height: 32, borderRadius: 9, background: `${g.color}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <SIcon size={14} color={g.color} />
                              </div>
                              <div style={{ flex: 1, fontSize: 13, fontWeight: 700, color: t.tx }}>{s}</div>
                              <ChevronLeft size={13} color={t.dim} />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}
