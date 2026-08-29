'use client'
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLiveNotifications } from "@/lib/hooks/useLiveNotifications";
import { useSyncedSetting } from "@/lib/hooks/useSyncedSetting";
import { useSyncedFavorites } from "@/lib/hooks/useSyncedFavorites";
import { useSyncedNotes } from "@/lib/hooks/useSyncedNotes";
import { useSiteContent } from "@/lib/hooks/useSiteContent";
import { pushSupported, pushState, enablePush, disablePush, registerServiceWorker } from "@/lib/push-client";
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
  Mic, MicOff, FileQuestion, BarChart, Brain, FileBarChart, LogOut,
  Instagram, Youtube, Twitter, Ghost, LogIn,
  List, LayoutGrid, MapPin,
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
  // Always render `initial` first so the server HTML and the browser's first
  // paint agree — reading localStorage during render makes them diverge for
  // anyone with saved data, and React then aborts hydration (the app dies
  // with "a client-side exception has occurred"). The stored value is adopted
  // right after mount, and only then do we start writing back.
  const [val, setVal] = useState(initial);
  const hydrated = useRef(false);
  useEffect(() => {
    const stored = storage.get(key, initial);
    hydrated.current = true;
    setVal(stored);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => { if (hydrated.current) storage.set(key, val); }, [key, val]);
  return [val, setVal];
}

/* ══════════════════════════════════════════════════════════════
   DESIGN TOKENS
   ══════════════════════════════════════════════════════════════ */
// Brand identity: Saudi-flavoured white + deep green. The primary keys
// (navy/blue/blue2/blueLight) carry green values so every existing usage
// turns green; gold stays as the elegant secondary accent.
const P = {
  navy: "#043d2a", navyDeep: "#021f15",
  blue: "#066b45", blue2: "#0a8a58", blueLight: "#34d399",
  gold: "#c8a84b", goldLight: "#fef3c7", goldRich: "#d4af37",
  green: "#059669", greenLight: "#10b981",
  red: "#dc2626", orange: "#d97706", orangeLight: "#fb923c",
  purple: "#0f766e", purpleLight: "#5eead4",
  cyan: "#0891b2", pink: "#db2777",
};

// Admin-selectable colour themes. Each recolours the primary brand (buttons,
// icons, headers), the page background/mesh and the hero gradients. Neutrals
// (cards, text) stay clean. Applied by mutating P + parametrising T.
const THEME_PRESETS = [
  { id: "green", name: "أخضر", sw: "#0a8a58",
    brand: { navy: "#043d2a", navyDeep: "#021f15", blue: "#066b45", blue2: "#0a8a58", blueLight: "#34d399" },
    rgb: "10,138,88", bgL: "#eef5f0", bgD: "#101d16",
    heroL: "linear-gradient(135deg, #043d2a 0%, #066b45 55%, #0a8a58 100%)",
    heroD: "linear-gradient(135deg, #05130d 0%, #0a3d29 45%, #0e5638 100%)" },
  { id: "blue", name: "أزرق", sw: "#2563eb",
    brand: { navy: "#0a2a6b", navyDeep: "#04143a", blue: "#1746b0", blue2: "#2563eb", blueLight: "#60a5fa" },
    rgb: "37,99,235", bgL: "#eef2fb", bgD: "#101829",
    heroL: "linear-gradient(135deg, #0a2a6b 0%, #1746b0 55%, #2563eb 100%)",
    heroD: "linear-gradient(135deg, #050b1c 0%, #0c2352 45%, #123084 100%)" },
  { id: "purple", name: "بنفسجي", sw: "#7c3aed",
    brand: { navy: "#3b1673", navyDeep: "#1f0a3f", blue: "#6d28d9", blue2: "#7c3aed", blueLight: "#a78bfa" },
    rgb: "124,58,237", bgL: "#f3effb", bgD: "#171227",
    heroL: "linear-gradient(135deg, #3b1673 0%, #6d28d9 55%, #7c3aed 100%)",
    heroD: "linear-gradient(135deg, #0f0720 0%, #2e1259 45%, #43209a 100%)" },
  { id: "gold", name: "ذهبي", sw: "#c8a84b",
    brand: { navy: "#5c4708", navyDeep: "#2e2404", blue: "#a3811a", blue2: "#c8a84b", blueLight: "#e6c964" },
    rgb: "200,168,75", bgL: "#f7f3e8", bgD: "#1e1810",
    heroL: "linear-gradient(135deg, #5c4708 0%, #a3811a 55%, #c8a84b 100%)",
    heroD: "linear-gradient(135deg, #120e04 0%, #3d3008 45%, #5c4708 100%)" },
  { id: "rose", name: "وردي", sw: "#e11d48",
    brand: { navy: "#7a132f", navyDeep: "#3f0a19", blue: "#be123c", blue2: "#e11d48", blueLight: "#fb7185" },
    rgb: "225,29,72", bgL: "#fbeef1", bgD: "#241019",
    heroL: "linear-gradient(135deg, #7a132f 0%, #be123c 55%, #e11d48 100%)",
    heroD: "linear-gradient(135deg, #1a0710 0%, #560d22 45%, #7a132f 100%)" },
  { id: "teal", name: "فيروزي", sw: "#0891b2",
    brand: { navy: "#0a4a5c", navyDeep: "#04262e", blue: "#0e7490", blue2: "#0891b2", blueLight: "#22d3ee" },
    rgb: "8,145,178", bgL: "#e9f5f8", bgD: "#0d1c24",
    heroL: "linear-gradient(135deg, #0a4a5c 0%, #0e7490 55%, #0891b2 100%)",
    heroD: "linear-gradient(135deg, #04121a 0%, #0a3a4a 45%, #0e5a70 100%)" },
];
const getPreset = (id) => THEME_PRESETS.find(p => p.id === id) || THEME_PRESETS[0];
// Mutate the shared P so every P.blue/blue2/navy usage recolours at once.
const applyBrand = (preset) => { Object.assign(P, preset.brand); };

const T = (d, br = THEME_PRESETS[0]) => ({
  bg: d ? br.bgD : br.bgL,
  bgMesh: d
    ? `radial-gradient(ellipse 80% 60% at 50% -5%, rgba(${br.rgb},0.20) 0%, transparent 55%), radial-gradient(ellipse 55% 45% at 5% 95%, rgba(200,168,75,0.10) 0%, transparent 45%), radial-gradient(ellipse 50% 40% at 95% 55%, rgba(${br.rgb},0.08) 0%, transparent 45%), ${br.bgD}`
    : `radial-gradient(ellipse 70% 50% at 50% -10%, rgba(${br.rgb},0.10) 0%, transparent 60%), radial-gradient(ellipse 50% 40% at 100% 100%, rgba(200,168,75,0.07) 0%, transparent 50%), ${br.bgL}`,
  s1: d ? "#18231e" : "#ffffff",
  s2: d ? "#20302a" : "#f5f7f6",
  s3: d ? "#2a3d35" : "#eaeeec",
  s4: d ? "#354b41" : "#dbe3df",
  bd: d ? "rgba(150,175,162,0.20)" : "#dde3e0",
  tx: d ? "#f2f7f4" : "#0c1712",
  mu: d ? "#a9bdb2" : "#4b5a53",
  dim: d ? "#728a7f" : "#8a978f",
  sh: d ? "0 10px 40px rgba(0,0,0,.65), 0 2px 12px rgba(0,0,0,.45)" : "0 8px 40px rgba(0,0,0,.08), 0 2px 10px rgba(0,0,0,.04)",
  shSm: d ? "0 4px 18px rgba(0,0,0,.5), 0 1px 4px rgba(0,0,0,.3)" : "0 4px 16px rgba(0,0,0,.06)",
  grad: d ? `linear-gradient(135deg,#18231e,#20302a)` : `linear-gradient(135deg,#f5f7f6,#eaeeec)`,
  hero: d ? br.heroD : br.heroL,
  inp: d ? "#0f1a16" : "#ffffff",
});

// Strip markdown markers so AI text reads cleanly in plain containers
// (bold/italic/code unwrapped, headings & bullets tidied, stray * _ ` # removed).
function mdToText(s = "") {
  return String(s)
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\*([^*\n]+)\*/g, "$1")
    .replace(/_([^_\n]+)_/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*•]\s+/gm, "• ")
    .replace(/[*_`#]+/g, "");
}

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

// Each broadcast type gets its own color, icon, label — and its own place:
// announcement/warning surface as a prominent top banner AND in the bell;
// info/success live only in the bell.
const NOTIF_TYPE = {
  announcement: { color: P.gold,   Icon: Radio,         label: "إعلان",   banner: true },
  warning:      { color: P.orange, Icon: AlertTriangle, label: "تنبيه",   banner: true },
  info:         { color: P.blue2,  Icon: Bell,          label: "معلومة",  banner: false },
  success:      { color: P.green,  Icon: PartyPopper,   label: "خبر جيد", banner: false },
};
function notifMeta(type) { return NOTIF_TYPE[type] || NOTIF_TYPE.info; }

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
    soft: { background: "rgba(10,138,88,.12)", color: P.blue2 },
  };
  const sizes = {
    sm: { padding: "6px 14px", borderRadius: 20, fontSize: 13 },
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
      <div style={{ fontSize: 12, color: t.mu, marginTop: 4, fontWeight: 500, position: "relative" }}>{label}</div>
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
          <div style={{ fontSize: 12, color: t.mu, marginTop: 3 }}>PDF • {sz} • {date}</div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: t.mu }}><Eye size={11} /> {fmt(views)}</span>
        <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: t.mu }}><Download size={11} /> {fmt(dl)}</span>
        <div style={{ display: "flex", gap: 2, marginRight: "auto", alignItems: "center" }}>
          {[1, 2, 3, 4, 5].map(i => (
            <span key={i}
              onClick={() => rateFile(i)}
              onMouseEnter={() => setHoverRating(i)}
              onMouseLeave={() => setHoverRating(0)}
              style={{ fontSize: 13, color: i <= (hoverRating || Math.round(myRating > 0 ? displayRating : r)) ? P.gold : "#ccc", cursor: "pointer", transition: "color .1s" }}>★</span>
          ))}
        </div>
        <button
          onClick={() => { setDlAnim(true); onToast?.("بدأ التحميل…", "success"); setTimeout(() => setDlAnim(false), 1500); }}
          style={{
            background: dlAnim ? `${P.green}20` : `${P.blue}15`, border: "none", borderRadius: 8,
            padding: "5px 10px", cursor: "pointer", fontSize: 12, fontWeight: 700,
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
            <div style={{ fontSize: 11, color: isToday ? P.gold : t.mu, marginTop: 4, fontWeight: isToday ? 700 : 500 }}>{labels[dow]}</div>
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
    `📌 أهم مواضيع ${subject}`,
    "📝 لخّص لي بنقاط مختصرة",
    "🧠 اشرح لي بطريقة مبسطة",
    "🎯 كيف أستعد للاختبار النهائي؟",
    "❓ أنشئ لي اختبار قصير",
    "💡 أعطني أمثلة تطبيقية",
    "⏱️ خطة مذاكرة سريعة",
  ];
  const allSugs = [...fileSugs, ...defaultSugs];

  // Turn inline markdown into real formatting so no raw symbols (**, *, `,
  // _, #) ever show in the chat. Paired markers become bold/code; any stray
  // leftover markers are quietly removed.
  const stripMarks = (s) => s.replace(/[*_`#]+/g, "");
  const renderInline = (txt) => {
    const nodes = [];
    let key = 0, last = 0, m;
    const re = /\*\*([^*\n]+)\*\*|__([^_\n]+)__|\*([^*\n]+)\*|_([^_\n]+)_|`([^`\n]+)`/g;
    while ((m = re.exec(txt)) !== null) {
      if (m.index > last) nodes.push(stripMarks(txt.slice(last, m.index)));
      const bold = m[1] ?? m[2] ?? m[3] ?? m[4];
      if (bold != null) nodes.push(<strong key={key++} style={{ fontWeight: 800 }}>{bold}</strong>);
      else nodes.push(<code key={key++} style={{ background: t.s3, padding: "1px 6px", borderRadius: 6, fontSize: "0.92em", fontFamily: "ui-monospace,monospace", direction: "ltr", unicodeBidi: "embed" }}>{m[5]}</code>);
      last = re.lastIndex;
    }
    if (last < txt.length) nodes.push(stripMarks(txt.slice(last)));
    return nodes;
  };
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
            <div style={{ color: "#4ade80", fontSize: 12, display: "flex", alignItems: "center", gap: 4, marginTop: 1 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ade80", display: "inline-block", flexShrink: 0 }} />
              {fileCount > 0 ? `يستخدم ${fileCount} ملف من المادة` : "متصل الآن"}
            </div>
          </div>
          {fileCount > 0 && (
            <div style={{ background: "rgba(255,255,255,.15)", border: "1px solid rgba(255,255,255,.25)", borderRadius: 20, padding: "3px 10px", fontSize: 12, color: P.gold, fontWeight: 700, display: "flex", alignItems: "center", gap: 4, flexShrink: 0, whiteSpace: "nowrap" }}>
              <FileText size={11} /> {fileCount}
            </div>
          )}
          <button onClick={clearChat} style={{ background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.2)", borderRadius: 8, padding: "5px 12px", fontSize: 12, color: "rgba(255,255,255,.8)", cursor: "pointer", fontFamily: "inherit", fontWeight: 600, flexShrink: 0 }}>مسح</button>
        </div>
      )}

      {menuId && <div onClick={() => setMenuId(null)} style={{ position: "fixed", inset: 0, zIndex: 90 }} />}

      {copied && (
        <div style={{ position: "fixed", top: 80, left: "50%", transform: "translateX(-50%)", background: "rgba(15,28,51,.95)", color: "#fff", padding: "8px 18px", borderRadius: 20, fontSize: 13, fontWeight: 700, zIndex: 9999, pointerEvents: "none", display: "flex", alignItems: "center", gap: 6 }}>
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

              <div style={{ fontSize: 11.5, color: t.dim, marginTop: 3, paddingLeft: isUser ? 40 : 0, paddingRight: isUser ? 0 : 40 }}>
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
              borderRadius: 20, padding: "5px 13px", fontSize: 12,
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
        <div style={{ fontSize: 13, color: t.mu, marginBottom: 20, lineHeight: 1.7 }}>سيولّد الذكاء الاصطناعي 5 أسئلة اختيار من متعدد عن مادة {subject}</div>
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
        <div style={{ fontSize: 12, color: t.mu, marginBottom: 16 }}>+50 XP أُضيفت لرصيدك</div>
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
        <div style={{ fontSize: 13, color: t.mu }}>السؤال {current + 1} / {quiz.length}</div>
        <div style={{ fontSize: 13, color: P.green, fontWeight: 700 }}>{score} صحيح</div>
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
                <span style={{ fontSize: 12, fontWeight: 800, color: border }}>{optLetters[i]}</span>
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
  const [dirty, setDirty] = useState(false);
  const taRef = useRef(null);
  useEffect(() => { setText(notes[subject] || ""); setSaved(false); setDirty(false); }, [subject]);

  const persist = useCallback((val) => {
    setNotes(prev => {
      const next = { ...prev };
      if (val.trim()) next[subject] = val; else delete next[subject];
      return next;
    });
  }, [setNotes, subject]);

  // Autosave shortly after typing stops, so nothing is ever lost.
  useEffect(() => {
    if (!dirty) return;
    const id = setTimeout(() => { persist(text); setSaved(true); setDirty(false); setTimeout(() => setSaved(false), 1800); }, 900);
    return () => clearTimeout(id);
  }, [text, dirty, persist]);

  const save = () => { persist(text); setSaved(true); setDirty(false); onToast?.("تم حفظ ملاحظاتك", "success"); setTimeout(() => setSaved(false), 2000); };
  const clear = () => {
    if (!confirm("مسح كل ملاحظات هذه المادة؟")) return;
    setText(""); setDirty(false);
    setNotes(prev => { const c = { ...prev }; delete c[subject]; return c; });
    onToast?.("تم مسح الملاحظات", "info");
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); onToast?.("تم نسخ الملاحظات", "success"); }
    catch { onToast?.("تعذّر النسخ", "warn"); }
  };
  // Insert a snippet at the caret (bullet, heading, divider).
  const insert = (snippet) => {
    const ta = taRef.current;
    const pos = ta ? ta.selectionStart : text.length;
    const before = text.slice(0, pos);
    const needsNl = before && !before.endsWith("\n");
    const next = before + (needsNl ? "\n" : "") + snippet + text.slice(pos);
    setText(next); setDirty(true);
    requestAnimationFrame(() => { ta?.focus(); const c = (before + (needsNl ? "\n" : "") + snippet).length; ta?.setSelectionRange(c, c); });
  };

  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const lines = text.trim() ? text.trim().split("\n").length : 0;

  return (
    <div>
      {/* Quick insert helpers */}
      <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
        {[["• نقطة", "• "], ["✅ مهم", "✅ "], ["❓ سؤال", "❓ "], ["— فاصل", "————————\n"]].map(([label, snip]) => (
          <button key={label} onClick={() => insert(snip)} style={{
            background: t.s2, border: `1px solid ${t.bd}`, borderRadius: 8, padding: "5px 10px",
            cursor: "pointer", fontSize: 11.5, color: t.mu, fontFamily: "inherit", fontWeight: 700,
          }}>{label}</button>
        ))}
      </div>
      <textarea
        ref={taRef}
        value={text} onChange={e => { setText(e.target.value); setDirty(true); }}
        placeholder={`اكتب ملاحظاتك عن مادة ${subject}…`}
        style={{
          width: "100%", minHeight: 190, border: `1.5px solid ${t.bd}`, borderRadius: 14,
          padding: "12px 14px", fontSize: 13.5, color: t.tx, background: t.s2,
          fontFamily: "inherit", direction: "rtl", outline: "none", resize: "vertical", lineHeight: 1.9,
          boxSizing: "border-box", transition: "border-color .2s",
        }}
        onFocus={e => e.target.style.borderColor = P.blue2}
        onBlur={e => e.target.style.borderColor = t.bd} />
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <Btn variant="primary" size="sm" onClick={save} style={{ flex: 1 }}>
          {saved ? <><Check size={14} /> محفوظ</> : <><Save size={14} /> حفظ</>}
        </Btn>
        {text && <Btn variant="ghost" size="sm" onClick={copy}><Copy size={13} /> نسخ</Btn>}
        {text && <Btn variant="ghost" size="sm" onClick={clear}><Trash2 size={13} /> مسح</Btn>}
      </div>
      <div style={{ fontSize: 11.5, color: t.dim, marginTop: 8, textAlign: "center", display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
        <span>{words} كلمة</span><span>·</span><span>{lines} سطر</span><span>·</span>
        <span style={{ color: dirty ? P.orange : saved ? P.green : t.dim }}>
          {dirty ? "جارٍ الحفظ…" : saved ? "تم الحفظ تلقائياً ✓" : "يُحفظ تلقائياً"}
        </span>
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
          <div style={{ fontSize: 13, color: "rgba(255,255,255,.5)", marginTop: 4 }}>من 5.00 • {totalHrs} ساعة</div>
          <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
            {GRADE_SCALE.map(g => (
              <div key={g.label} style={{ background: `${g.color}25`, border: `1px solid ${g.color}40`, borderRadius: 8, padding: "3px 8px", fontSize: 11.5, color: "#fff", fontWeight: 700 }}>
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
              <div style={{ fontSize: 12, color: t.mu, marginBottom: 4 }}>المعدل المستهدف</div>
              <input type="number" step="0.1" min="0" max="5" value={targetGPA}
                onChange={e => setTargetGPA(+e.target.value)}
                style={{ width: "100%", border: `1px solid ${t.bd}`, borderRadius: 8, padding: "8px 10px", fontSize: 13, background: t.s2, color: t.tx, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: t.mu, marginBottom: 4 }}>الساعات القادمة</div>
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
                <div style={{ fontSize: 13, color: P.green, fontWeight: 700, marginBottom: 4 }}>✓ ممكن تحقيقه</div>
                <div style={{ fontSize: 13, color: t.tx, lineHeight: 1.7 }}>
                  تحتاج معدل تقديري <strong style={{ color: neededGrade.color }}>{neededGrade.label}</strong>
                  {" "}({neededAvgPoint.toFixed(2)} من 5.00) في الـ {extraHrs} ساعة القادمة
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 13, color: P.red, fontWeight: 700, marginBottom: 4, display: "flex", alignItems: "center", gap: 4 }}><AlertTriangle size={12} /> غير قابل للتحقيق</div>
                <div style={{ fontSize: 13, color: t.mu, lineHeight: 1.6 }}>
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
                <div style={{ fontSize: 12, color: t.mu }}>{sem.date} • {sem.totalHrs} ساعة</div>
              </div>
              <div style={{ fontSize: 16, fontWeight: 900, color: P.blue2, minWidth: 50, textAlign: "center" }}>{sem.gpa}</div>
              <button onClick={() => loadSemester(sem)} style={{ background: `${P.blue2}15`, border: "none", borderRadius: 8, padding: "5px 10px", cursor: "pointer", color: P.blue2, fontSize: 12, fontWeight: 700, fontFamily: "inherit" }}>تحميل</button>
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
                <div style={{ background: `${g.color}20`, borderRadius: 8, padding: "4px 10px", fontSize: 13, fontWeight: 800, color: g.color, minWidth: 36, textAlign: "center" }}>{g.label}</div>
                <button onClick={() => removeCourse(i)} style={{ background: "#dc262615", border: "none", borderRadius: 8, padding: 6, cursor: "pointer", color: "#dc2626", display: "flex" }}>
                  <X size={14} />
                </button>
              </div>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: t.mu, marginBottom: 4 }}>الدرجة: {c.score}</div>
                  <input type="range" min={0} max={100} value={c.score}
                    onChange={e => update(i, "score", +e.target.value)}
                    style={{ width: "100%", accentColor: g.color }} />
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 12, color: t.mu, marginBottom: 4 }}>الساعات</div>
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
                padding: "5px 12px", cursor: "pointer", fontSize: 12, color: "rgba(255,255,255,.9)", fontFamily: "inherit"
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
              <div style={{ fontSize: 12, color: "rgba(255,255,255,.5)", marginTop: 2 }}>{mode === "work" ? "دراسة" : mode === "short" ? "راحة" : "راحة طويلة"}</div>
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
          <div style={{ fontSize: 13, fontWeight: 700, color: t.tx, marginBottom: 10 }}>إعدادات المؤقت</div>
          <div style={{ fontSize: 12, color: t.mu, marginBottom: 6 }}>مدة جلسة الدراسة: {customWork} دقيقة</div>
          <input type="range" min={10} max={60} step={5} value={customWork}
            onChange={e => setCustomWork(+e.target.value)}
            style={{ width: "100%", accentColor: P.blue2 }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: t.dim, marginTop: 4 }}>
            <span>10د</span><span>60د</span>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
        <div style={{ background: t.s1, borderRadius: 14, padding: "14px", border: `1px solid ${t.bd}`, textAlign: "center" }}>
          <div style={{ fontSize: 26, fontWeight: 900, color: P.blue2 }}>{todaySessions}</div>
          <div style={{ fontSize: 12, color: t.mu }}>جلسات اليوم</div>
        </div>
        <div style={{ background: t.s1, borderRadius: 14, padding: "14px", border: `1px solid ${t.bd}`, textAlign: "center" }}>
          <div style={{ fontSize: 26, fontWeight: 900, color: P.gold }}>{todayMins}</div>
          <div style={{ fontSize: 12, color: t.mu }}>دقيقة دراسة</div>
        </div>
      </div>

      <div style={{ background: t.s1, borderRadius: 14, padding: "12px 14px", border: `1px solid ${t.bd}`, marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: t.mu, marginBottom: 6 }}>مادة الدراسة الحالية</div>
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
            <div style={{ fontSize: 13, fontWeight: 700, color: t.tx }}>آخر الجلسات</div>
            <div style={{ marginRight: "auto", fontSize: 12, color: t.dim }}>الإجمالي: {totalSessions}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 200, overflowY: "auto" }}>
            {[...sessionLog].reverse().slice(0, 8).map((s, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: t.s2, borderRadius: 10 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: `${P.blue2}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Clock size={13} color={P.blue2} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: t.tx }}>{s.subject}</div>
                  <div style={{ fontSize: 11.5, color: t.mu }}>{new Date(s.t).toLocaleString("ar-SA", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })}</div>
                </div>
                <div style={{ fontSize: 13, color: P.green, fontWeight: 700 }}>{s.dur}د</div>
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
      <div style={{ fontSize: 13, fontWeight: 800, color: t.tx, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
        <Calculator size={13} color={P.gold} /> حاسبة الدرجات
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: filledCount > 0 ? 10 : 0 }}>
        {fields.map(f => (
          <div key={f.id}>
            <div style={{ fontSize: 11.5, color: t.mu, marginBottom: 3 }}>{f.label} ({f.pct})</div>
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
            <span style={{ fontSize: 13, color: t.mu }}>المجموع الحالي</span>
            <span style={{ fontSize: 18, fontWeight: 900, color: totalColor }}>{total.toFixed(1)}</span>
          </div>
          {n90 !== null && (
            <div style={{ fontSize: 12, marginTop: 6, lineHeight: 1.6 }}>
              {n90 <= 100 && n90 >= 0
                ? <span style={{ color: P.blue2 }}>تحتاج <strong>{n90.toFixed(1)}</strong> في النهائي للممتاز (90+)</span>
                : n90 < 0 ? <span style={{ color: P.green }}>ممتاز مضمون حتى بدون النهائي!</span>
                : <span style={{ color: P.red }}>لا يمكن الممتاز حتى بنهائي كامل</span>}
            </div>
          )}
          {n60 !== null && n60 > 0 && n60 <= 100 && (
            <div style={{ fontSize: 12, color: P.orange, marginTop: 3 }}>
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
// Unified task/exam model. Every item lives in `tasks` with a `type`.
const TASK_TYPES = ["واجب", "اسايمنت", "مشروع", "مناقشة", "كويز", "ميدترم", "فاينل", "أخرى"];
const EXAM_TYPES = ["كويز", "ميدترم", "فاينل"];
const TASK_TRACKS = ["تحضيري", "تخصص", "دبلوم", "دراسات عليا"];
const TASK_TYPE_META = {
  "واجب": { color: P.blue2, Icon: FileText },
  "اسايمنت": { color: P.purple, Icon: FileText },
  "مشروع": { color: P.orange, Icon: Briefcase },
  "مناقشة": { color: P.cyan, Icon: MessageCircle },
  "كويز": { color: P.gold, Icon: Zap },
  "ميدترم": { color: P.red, Icon: Calendar },
  "فاينل": { color: "#b91c1c", Icon: Award },
  "أخرى": { color: P.green, Icon: CheckCircle },
};
const typeMeta = (ty) => TASK_TYPE_META[ty] || TASK_TYPE_META["أخرى"];

function TasksHub({ t, tasks, setTasks, exams, setExams, onToast, setXp, guest }) {
  const [showAdd, setShowAdd] = useState(false);
  const [filter, setFilter] = useState("الكل"); // الكل | اختبارات | مهام
  const [nt, setNt] = useState({ title: "", type: "واجب", customType: "", track: "", customTrackOn: false, subject: "", subjectCustomOn: false, dueDate: "", priority: "متوسط" });
  const today = todayKey();

  // One-time migration: fold legacy exams into the unified tasks list.
  useEffect(() => {
    if (!exams || exams.length === 0) return;
    setTasks(ts => {
      const ids = new Set((ts || []).map(x => x.id));
      const mapped = exams.map(e => ({
        id: e.id || (Date.now() + Math.floor(Math.random() * 1000)),
        title: e.subject || "اختبار",
        type: e.type === "نهائي" ? "فاينل" : e.type === "ميدترم" ? "ميدترم" : e.type === "مشروع" ? "مشروع" : (EXAM_TYPES.includes(e.type) ? e.type : "أخرى"),
        track: "", subject: e.subject || "", dueDate: e.date || "", priority: "عالي", done: false,
      })).filter(m => !ids.has(m.id));
      return [...(ts || []), ...mapped];
    });
    setExams([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const prioColor = { "عالي": P.red, "متوسط": P.orange, "منخفض": P.green };
  const add = () => {
    if (!nt.title.trim()) return;
    const finalType = nt.type === "أخرى" && nt.customType.trim() ? nt.customType.trim() : nt.type;
    setTasks(ts => [...(ts || []), { title: nt.title, type: finalType, track: nt.track, subject: nt.subject, dueDate: nt.dueDate, priority: nt.priority, id: Date.now(), done: false }]);
    setNt({ title: "", type: "واجب", customType: "", track: "", customTrackOn: false, subject: "", subjectCustomOn: false, dueDate: "", priority: "متوسط" });
    setShowAdd(false);
    const cur = storage.get("xp", 0); storage.set("xp", cur + 15); setXp?.(cur + 15);
    onToast?.("تمت الإضافة +15 XP", "success");
  };
  const toggle = (id) => setTasks(ts => (ts || []).map(tk => tk.id === id ? { ...tk, done: !tk.done } : tk));
  const remove = (id) => setTasks(ts => (ts || []).filter(tk => tk.id !== id));

  const all = (tasks || []).map(tk => ({ ...tk, type: tk.type || "واجب" }));
  const filtered = all.filter(tk => filter === "الكل" ? true : filter === "اختبارات" ? EXAM_TYPES.includes(tk.type) : !EXAM_TYPES.includes(tk.type));
  const sorted = [...filtered].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    return (a.dueDate || "9999").localeCompare(b.dueDate || "9999");
  });
  const pending = all.filter(tk => !tk.done).length;
  const examCount = all.filter(tk => EXAM_TYPES.includes(tk.type) && !tk.done).length;

  const chip = (label, active, onClick, count) => (
    <button onClick={onClick} style={{
      padding: "5px 12px", borderRadius: 20, cursor: "pointer", fontFamily: "inherit",
      fontSize: 12.5, fontWeight: 700, whiteSpace: "nowrap",
      background: active ? `linear-gradient(135deg,${P.blue},${P.blue2})` : t.s2,
      border: `1px solid ${active ? P.blue2 : t.bd}`, color: active ? "#fff" : t.mu,
    }}>{label}{count != null ? ` (${count})` : ""}</button>
  );

  // One task row — used by the grouped list below.
  const renderTask = (task) => {
    const m = typeMeta(task.type);
    const isOverdue = !task.done && task.dueDate && task.dueDate < today;
    const days = task.dueDate ? Math.ceil((new Date(task.dueDate + "T12:00:00") - new Date(today + "T00:00:00")) / 86400000) : null;
    const overdueDays = isOverdue ? Math.abs(days) : 0;
    const cc = days == null ? t.mu : days <= 1 ? P.red : days <= 4 ? P.orange : P.green;
    const pc = prioColor[task.priority] || P.orange;
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "10px 11px", background: isOverdue ? `${P.red}08` : t.s2, borderRadius: 11, border: `1px solid ${isOverdue ? P.red + "40" : t.bd}`, opacity: task.done ? 0.5 : 1, borderRight: `3px solid ${task.done ? P.green : m.color}` }}>
        <button onClick={() => toggle(task.id)} title={task.done ? "إلغاء الإنجاز" : "تحديد كمنجزة"} style={{ background: task.done ? `${P.green}20` : t.s1, border: `1.5px solid ${task.done ? P.green : t.bd}`, borderRadius: 6, width: 22, height: 22, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {task.done && <Check size={12} color={P.green} />}
        </button>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: `${m.color}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <m.Icon size={14} color={m.color} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: t.tx, textDecoration: task.done ? "line-through" : "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{task.title}</div>
          <div style={{ fontSize: 11, color: t.mu, display: "flex", gap: 6, marginTop: 2, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ color: m.color, fontWeight: 800 }}>{task.type}</span>
            {task.track && <span style={{ background: `${P.purple}15`, color: P.purple, borderRadius: 5, padding: "0 6px", fontWeight: 700 }}>{task.track}</span>}
            {task.subject && <span>{task.subject}</span>}
            {task.dueDate && <span>{new Date(task.dueDate + "T12:00:00").toLocaleDateString("ar-SA-u-ca-gregory", { month: "short", day: "numeric" })}</span>}
            {isOverdue && <span style={{ color: P.red, fontWeight: 700 }}>متأخر {overdueDays} يوم</span>}
          </div>
        </div>
        {!task.done && days != null && !isOverdue && (
          <div style={{ background: `${cc}18`, color: cc, borderRadius: 8, padding: "3px 8px", fontSize: 11.5, fontWeight: 800, flexShrink: 0, whiteSpace: "nowrap" }}>
            {days === 0 ? "اليوم" : days === 1 ? "غداً" : `${days} يوم`}
          </div>
        )}
        <div style={{ width: 7, height: 7, borderRadius: "50%", background: pc, flexShrink: 0 }} title={`أولوية ${task.priority}`} />
        <button onClick={() => remove(task.id)} title="حذف" style={{ background: "none", border: "none", cursor: "pointer", color: t.dim, display: "flex", padding: 2 }}>
          <X size={12} />
        </button>
      </div>
    );
  };

  return (
    <div style={{ background: t.s1, borderRadius: 18, padding: 16, marginBottom: 16, border: `1px solid ${t.bd}`, boxShadow: t.shSm }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: t.tx, display: "flex", alignItems: "center", gap: 7 }}>
          <div style={{ width: 28, height: 28, borderRadius: 9, background: `linear-gradient(135deg,${P.blue},${P.blue2})`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <CheckCircle size={15} color="#fff" />
          </div>
          مهامي
          {pending > 0 && <span style={{ fontSize: 11.5, fontWeight: 800, color: P.blue2, background: `${P.blue2}15`, borderRadius: 6, padding: "1px 7px" }}>{pending}</span>}
        </div>
        <button onClick={() => setShowAdd(s => !s)} style={{ background: `linear-gradient(135deg,${P.gold},${P.goldRich})`, border: "none", borderRadius: 9, padding: "6px 12px", cursor: "pointer", color: "#3a2e05", fontSize: 12.5, fontFamily: "inherit", display: "flex", alignItems: "center", gap: 4, fontWeight: 800 }}>
          <Plus size={13} /> إضافة
        </button>
      </div>

      {/* Progress summary — completion bar + at-a-glance counters */}
      {all.length > 0 && (() => {
        const doneCount = all.filter(tk => tk.done).length;
        const pct = Math.round((doneCount / all.length) * 100);
        const overdueCount = all.filter(tk => !tk.done && tk.dueDate && tk.dueDate < today).length;
        const todayCount = all.filter(tk => !tk.done && tk.dueDate === today).length;
        const barCol = pct === 100 ? P.green : pct >= 50 ? P.blue2 : P.orange;
        return (
          <div style={{ background: t.s2, borderRadius: 13, padding: "11px 13px", marginBottom: 12, border: `1px solid ${t.bd}` }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 7 }}>
              <span style={{ fontSize: 12, color: t.mu, fontWeight: 700 }}>أنجزت {doneCount} من {all.length}</span>
              <span style={{ fontSize: 13, fontWeight: 900, color: barCol }}>{pct}%</span>
            </div>
            <div style={{ height: 7, background: t.s3, borderRadius: 4, overflow: "hidden", marginBottom: 9 }}>
              <div style={{ height: "100%", width: `${pct}%`, background: `linear-gradient(90deg,${barCol},${barCol}bb)`, borderRadius: 4, transition: "width .6s ease" }} />
            </div>
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
              {overdueCount > 0 && <span style={{ fontSize: 11, fontWeight: 800, color: P.red, background: `${P.red}15`, borderRadius: 7, padding: "3px 9px" }}>⚠ متأخرة {overdueCount}</span>}
              {todayCount > 0 && <span style={{ fontSize: 11, fontWeight: 800, color: P.orange, background: `${P.orange}15`, borderRadius: 7, padding: "3px 9px" }}>اليوم {todayCount}</span>}
              {examCount > 0 && <span style={{ fontSize: 11, fontWeight: 800, color: P.purple, background: `${P.purple}15`, borderRadius: 7, padding: "3px 9px" }}>اختبارات {examCount}</span>}
              {pct === 100 && <span style={{ fontSize: 11, fontWeight: 800, color: P.green, background: `${P.green}15`, borderRadius: 7, padding: "3px 9px" }}>🎉 أنجزت كل مهامك</span>}
            </div>
          </div>
        );
      })()}

      {/* Filter chips */}
      <div style={{ display: "flex", gap: 6, marginBottom: 12, overflowX: "auto", paddingBottom: 2 }}>
        {chip("الكل", filter === "الكل", () => setFilter("الكل"), all.length)}
        {chip("اختبارات", filter === "اختبارات", () => setFilter("اختبارات"), examCount)}
        {chip("مهام", filter === "مهام", () => setFilter("مهام"))}
      </div>

      {showAdd && (
        <div style={{ background: t.s2, borderRadius: 12, padding: 12, marginBottom: 12, animation: "fadeUp .3s ease" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <input placeholder="العنوان (مطلوب)" value={nt.title} onChange={e => setNt(p => ({ ...p, title: e.target.value }))}
              style={{ border: `1px solid ${t.bd}`, borderRadius: 8, padding: "9px 11px", fontSize: 13, background: t.s1, color: t.tx, fontFamily: "inherit", direction: "rtl", outline: "none" }} />

            {/* Type selector */}
            <div>
              <div style={{ fontSize: 11.5, color: t.mu, fontWeight: 700, marginBottom: 5 }}>النوع</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {TASK_TYPES.map(ty => {
                  const m = typeMeta(ty); const active = nt.type === ty;
                  return (
                    <button key={ty} onClick={() => setNt(p => ({ ...p, type: ty }))} style={{
                      display: "flex", alignItems: "center", gap: 5, padding: "6px 10px", borderRadius: 9, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700,
                      background: active ? `${m.color}18` : t.s1, border: `1.5px solid ${active ? m.color : t.bd}`, color: active ? m.color : t.mu,
                    }}><m.Icon size={12} /> {ty}</button>
                  );
                })}
              </div>
              {nt.type === "أخرى" && (
                <input autoFocus placeholder="اكتب نوعاً مخصصاً (مثال: عرض تقديمي)" value={nt.customType} onChange={e => setNt(p => ({ ...p, customType: e.target.value }))}
                  style={{ marginTop: 8, width: "100%", border: `1.5px solid ${P.green}`, borderRadius: 8, padding: "8px 10px", fontSize: 13, background: t.s1, color: t.tx, fontFamily: "inherit", direction: "rtl", outline: "none", boxSizing: "border-box" }} />
              )}
            </div>

            {/* Track selector */}
            <div>
              <div style={{ fontSize: 11.5, color: t.mu, fontWeight: 700, marginBottom: 5 }}>المجال (اختياري)</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {TASK_TRACKS.map(tr => {
                  const active = !nt.customTrackOn && nt.track === tr;
                  return (
                    <button key={tr} onClick={() => setNt(p => ({ ...p, track: active ? "" : tr, customTrackOn: false }))} style={{
                      padding: "6px 10px", borderRadius: 9, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700,
                      background: active ? `${P.purple}18` : t.s1, border: `1.5px solid ${active ? P.purple : t.bd}`, color: active ? P.purple : t.mu,
                    }}>{tr}</button>
                  );
                })}
                <button onClick={() => setNt(p => ({ ...p, customTrackOn: !p.customTrackOn, track: "" }))} style={{
                  display: "flex", alignItems: "center", gap: 4, padding: "6px 10px", borderRadius: 9, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700,
                  background: nt.customTrackOn ? `${P.purple}18` : t.s1, border: `1.5px solid ${nt.customTrackOn ? P.purple : t.bd}`, color: nt.customTrackOn ? P.purple : t.mu,
                }}><Plus size={12} /> مخصص</button>
              </div>
              {nt.customTrackOn && (
                <input autoFocus placeholder="اكتب مجالاً مخصصاً (مثال: ماجستير إدارة)" value={nt.track} onChange={e => setNt(p => ({ ...p, track: e.target.value }))}
                  style={{ marginTop: 8, width: "100%", border: `1.5px solid ${P.purple}`, borderRadius: 8, padding: "8px 10px", fontSize: 13, background: t.s1, color: t.tx, fontFamily: "inherit", direction: "rtl", outline: "none", boxSizing: "border-box" }} />
              )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <select value={nt.subjectCustomOn ? "__custom__" : nt.subject} onChange={e => {
                const v = e.target.value;
                if (v === "__custom__") setNt(p => ({ ...p, subjectCustomOn: true, subject: "" }));
                else setNt(p => ({ ...p, subjectCustomOn: false, subject: v }));
              }}
                style={{ border: `1px solid ${t.bd}`, borderRadius: 8, padding: "8px 10px", fontSize: 13, background: t.s1, color: t.tx, fontFamily: "inherit", direction: "rtl", outline: "none" }}>
                <option value="">المادة (اختياري)</option>
                {ALL_SUBJECTS_LIST.map(s => <option key={s} value={s}>{s}</option>)}
                <option value="__custom__">➕ مادة مخصصة…</option>
              </select>
              <input type="date" value={nt.dueDate} onChange={e => setNt(p => ({ ...p, dueDate: e.target.value }))}
                style={{ border: `1px solid ${t.bd}`, borderRadius: 8, padding: "8px 10px", fontSize: 13, background: t.s1, color: t.tx, fontFamily: "inherit", outline: "none" }} />
            </div>
            {nt.subjectCustomOn && (
              <input autoFocus placeholder="اكتب اسم المادة" value={nt.subject} onChange={e => setNt(p => ({ ...p, subject: e.target.value }))}
                style={{ width: "100%", border: `1.5px solid ${P.blue2}`, borderRadius: 8, padding: "8px 10px", fontSize: 13, background: t.s1, color: t.tx, fontFamily: "inherit", direction: "rtl", outline: "none", boxSizing: "border-box" }} />
            )}

            <div style={{ display: "flex", gap: 6 }}>
              {["عالي", "متوسط", "منخفض"].map(p => (
                <button key={p} onClick={() => setNt(x => ({ ...x, priority: p }))} style={{ flex: 1, padding: "6px 4px", borderRadius: 8, border: `1.5px solid ${nt.priority === p ? prioColor[p] : t.bd}`, background: nt.priority === p ? `${prioColor[p]}15` : t.s1, color: nt.priority === p ? prioColor[p] : t.mu, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit", fontWeight: 700 }}>
                  {p}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Btn variant="ghost" size="sm" onClick={() => setShowAdd(false)} style={{ flex: 1 }}>إلغاء</Btn>
              <Btn variant="primary" size="sm" onClick={add} style={{ flex: 2 }} disabled={!nt.title.trim()}>
                <Plus size={14} /> إضافة
              </Btn>
            </div>
          </div>
        </div>
      )}

      {sorted.length === 0 ? (
        <div style={{ textAlign: "center", padding: "18px 0", color: t.dim, fontSize: 13 }}>
          <CheckCircle size={26} color={t.dim} style={{ opacity: 0.5, marginBottom: 6 }} />
          <div>{filter === "اختبارات" ? "لا اختبارات قادمة" : "لا مهام بعد، أضف مهمتك الأولى"}</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 340, overflowY: "auto" }}>
          {(() => {
            // Group headers appear as the list crosses into a new bucket.
            const bucketOf = (tk) => {
              if (tk.done) return "منجزة";
              if (!tk.dueDate) return "بلا موعد";
              if (tk.dueDate < today) return "متأخرة";
              if (tk.dueDate === today) return "اليوم";
              return "قادمة";
            };
            const bucketCol = { "متأخرة": P.red, "اليوم": P.orange, "قادمة": P.blue2, "بلا موعد": t.mu, "منجزة": P.green };
            let last = null;
            return sorted.slice(0, 12).map(task => {
              const b = bucketOf(task);
              const header = b !== last ? b : null;
              last = b;
              return (
                <div key={`g-${task.id}`}>
                  {header && (
                    <div style={{ fontSize: 11, fontWeight: 800, color: bucketCol[header], margin: "6px 2px 5px", display: "flex", alignItems: "center", gap: 5 }}>
                      <span style={{ width: 3, height: 10, borderRadius: 2, background: bucketCol[header] }} /> {header}
                    </div>
                  )}
                  {renderTask(task)}
                </div>
              );
            });
          })()}
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
        <span style={{ fontSize: 13, fontWeight: 700, color: barColor }}>{pct}%</span>
      </div>
      <div style={{ height: 8, background: t.s3, borderRadius: 4, overflow: "hidden", marginBottom: 5 }}>
        <div style={{ height: "100%", width: `${pct}%`, background: `linear-gradient(90deg,${barColor},${barColor}cc)`, borderRadius: 4, transition: "width .6s ease" }} />
      </div>
      <div style={{ fontSize: 12, color: t.mu }}>{todayMins} دقيقة من {goalMins} دقيقة</div>
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
              <span style={{ fontSize: 12, color: tc, fontWeight: 700, height: 16 }}>{trend || ""}</span>
              <span style={{ fontSize: 11.5, color: bc, fontWeight: 700 }}>{gpa.toFixed(2)}</span>
              <div style={{ width: "100%", height: `${barH}%`, borderRadius: "6px 6px 0 0", background: `linear-gradient(180deg,${bc},${bc}88)`, transition: "height .8s ease", minHeight: 8, boxShadow: `0 4px 12px ${bc}30` }} />
              <div style={{ fontSize: 11, color: t.mu, textAlign: "center", lineHeight: 1.3, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sem.name}</div>
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
const WEEK_ORDER = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const isUrl = (s) => /^https?:\/\//i.test((s || "").trim());
const fmtCountdown = (mins) => {
  if (mins <= 0) return "الآن";
  if (mins < 60) return `خلال ${mins} دقيقة`;
  if (mins < 1440) { const h = Math.floor(mins / 60), mm = mins % 60; return `خلال ${h} ساعة${mm ? ` و${mm} د` : ""}`; }
  const d = Math.floor(mins / 1440); return `خلال ${d} يوم`;
};

function SchedulePage({ t, schedule, setSchedule, onToast }) {
  const [showAdd, setShowAdd] = useState(false);
  const [view, setView] = useSyncedSetting("scheduleView", "schedule_view", "list"); // list | grid
  const [newLec, setNewLec] = useState({ course: "", day: "الأحد", time: "08:00", room: "", mode: "حضوري", remind: true });
  const [nowTick, setNowTick] = useState(0);
  const [notifPerm, setNotifPerm] = useState(typeof Notification !== "undefined" ? Notification.permission : "unsupported");
  const DAYS = ["السبت", "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس"];
  const DAY_COLORS = { "السبت": P.cyan, "الأحد": P.blue2, "الاثنين": P.purple, "الثلاثاء": P.green, "الأربعاء": P.orange, "الخميس": P.red };
  const todayAr = WEEK_ORDER[new Date().getDay()];

  // Keep the "next lecture" countdown live.
  useEffect(() => { const iv = setInterval(() => setNowTick(x => x + 1), 30000); return () => clearInterval(iv); }, []);

  const nextLec = useMemo(() => {
    const now = new Date();
    const todayIdx = now.getDay();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    let best = null;
    (schedule || []).forEach(lec => {
      const di = WEEK_ORDER.indexOf(lec.day);
      if (di < 0 || !lec.time) return;
      const [h, m] = lec.time.split(":").map(Number);
      if (isNaN(h)) return;
      const lecMin = h * 60 + m;
      let dayDelta = (di - todayIdx + 7) % 7;
      if (dayDelta === 0 && lecMin <= nowMin) dayDelta = 7;
      const total = dayDelta * 1440 + (lecMin - nowMin);
      if (!best || total < best.total) best = { lec, total, dayDelta };
    });
    return best;
  }, [schedule, nowTick]);

  const enableNotifs = async () => {
    if (typeof Notification === "undefined") { onToast?.("متصفحك لا يدعم التنبيهات", "warn"); return; }
    try {
      const p = await Notification.requestPermission();
      setNotifPerm(p);
      onToast?.(p === "granted" ? "تم تفعيل التنبيهات ✅" : "لم يتم منح إذن التنبيهات", p === "granted" ? "success" : "warn");
    } catch { onToast?.("تعذّر تفعيل التنبيهات", "error"); }
  };

  const addLecture = () => {
    if (!newLec.course.trim()) return;
    setSchedule(s => [...(s || []), { ...newLec, id: Date.now() }]);
    setNewLec({ course: "", day: "الأحد", time: "08:00", room: "", mode: "حضوري", remind: true });
    setShowAdd(false);
    onToast?.("تم إضافة المحاضرة", "success");
  };
  const removeLecture = (id) => setSchedule(s => (s || []).filter(l => l.id !== id));
  const toggleRemind = (id) => setSchedule(s => (s || []).map(l => l.id === id ? { ...l, remind: l.remind === false } : l));

  return (
    <div style={{ animation: "fadeUp .4s ease" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <h2 style={{ fontSize: 20, fontWeight: 900, color: t.tx, display: "flex", alignItems: "center", gap: 8 }}>
          <CalendarDays size={20} color={P.blue2} /> جدولي الأسبوعي
        </h2>
        <div style={{ display: "flex", background: t.s2, borderRadius: 11, padding: 3, border: `1px solid ${t.bd}` }}>
          {[{ id: "list", Icon: List, label: "قائمة" }, { id: "grid", Icon: LayoutGrid, label: "شبكة" }].map(({ id, Icon, label }) => {
            const active = view === id;
            return (
              <button key={id} onClick={() => setView(id)} style={{
                display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, fontWeight: 800,
                background: active ? P.blue2 : "transparent", color: active ? "#fff" : t.mu, border: "none",
              }}><Icon size={14} /> {label}</button>
            );
          })}
        </div>
      </div>

      {/* Next lecture countdown */}
      {nextLec && (
        <div style={{ background: t.hero, borderRadius: 16, padding: "14px 16px", marginBottom: 14, position: "relative", overflow: "hidden" }}>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,.75)", marginBottom: 3 }}>محاضرتك القادمة</div>
          <div style={{ fontSize: 16, fontWeight: 900, color: "#fff", marginBottom: 4 }}>{nextLec.lec.course}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12.5, color: P.gold, fontWeight: 800 }}>{fmtCountdown(nextLec.total)}</span>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,.7)" }}>• {nextLec.lec.day} {nextLec.lec.time}</span>
            <span style={{ fontSize: 11, fontWeight: 800, color: "#fff", background: (nextLec.lec.mode === "أونلاين" ? P.blue2 : P.green), borderRadius: 6, padding: "1px 8px" }}>{nextLec.lec.mode || "حضوري"}</span>
          </div>
          {nextLec.lec.mode === "أونلاين" && isUrl(nextLec.lec.room) && (
            <a href={nextLec.lec.room} target="_blank" rel="noopener noreferrer" style={{ marginTop: 10, display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,.15)", color: "#fff", borderRadius: 9, padding: "7px 14px", fontSize: 12.5, fontWeight: 700, textDecoration: "none" }}>
              <Play size={13} /> دخول المحاضرة
            </a>
          )}
        </div>
      )}

      {/* Notifications enable prompt */}
      {notifPerm !== "granted" && notifPerm !== "unsupported" && (schedule || []).length > 0 && (
        <button onClick={enableNotifs} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: `${P.gold}15`, border: `1px solid ${P.gold}40`, color: t.tx, borderRadius: 12, padding: "10px 14px", marginBottom: 14, cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, fontWeight: 700 }}>
          <Bell size={15} color={P.gold} /> فعّل التنبيه قبل المحاضرة بـ 5 دقائق
        </button>
      )}

      {view === "list" && DAYS.map(day => {
        const dayLecs = (schedule || []).filter(l => l.day === day).sort((a, b) => a.time.localeCompare(b.time));
        const isToday = day === todayAr;
        const dc = DAY_COLORS[day];
        return (
          <div key={day} style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <div style={{ width: 3, height: 16, borderRadius: 2, background: dc }} />
              <span style={{ fontSize: 13, fontWeight: 800, color: isToday ? dc : t.tx }}>{day}</span>
              {isToday && <span style={{ background: `${dc}20`, color: dc, borderRadius: 6, padding: "1px 8px", fontSize: 11.5, fontWeight: 800 }}>اليوم</span>}
              <span style={{ fontSize: 12, color: t.mu }}>({dayLecs.length})</span>
            </div>
            {dayLecs.length === 0 ? (
              <div style={{ fontSize: 12, color: t.dim, padding: "7px 12px", background: t.s2, borderRadius: 8, border: `1px dashed ${t.bd}` }}>لا محاضرات</div>
            ) : (
              dayLecs.map(lec => {
                const online = lec.mode === "أونلاين";
                const mc = online ? P.blue2 : P.green;
                return (
                <div key={lec.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: isToday ? `${dc}10` : t.s1, borderRadius: 10, border: `1px solid ${isToday ? dc + "40" : t.bd}`, marginBottom: 5 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: `${dc}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Clock size={13} color={dc} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: t.tx, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      {lec.course}
                      <span style={{ fontSize: 10, fontWeight: 800, color: mc, background: `${mc}18`, borderRadius: 5, padding: "1px 6px" }}>{lec.mode || "حضوري"}</span>
                    </div>
                    <div style={{ fontSize: 12, color: t.mu, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {lec.time}{lec.room && !isUrl(lec.room) ? ` • ${lec.room}` : ""}
                    </div>
                  </div>
                  {online && isUrl(lec.room) && (
                    <a href={lec.room} target="_blank" rel="noopener noreferrer" title="دخول المحاضرة" style={{ background: `${P.blue2}18`, border: "none", borderRadius: 7, padding: 6, cursor: "pointer", color: P.blue2, display: "flex" }}>
                      <Play size={13} />
                    </a>
                  )}
                  <button onClick={() => toggleRemind(lec.id)} title={lec.remind === false ? "تفعيل التذكير" : "التذكير مفعّل"} style={{ background: lec.remind === false ? `${t.mu}15` : `${P.gold}18`, border: "none", borderRadius: 7, padding: 6, cursor: "pointer", color: lec.remind === false ? t.mu : P.gold, display: "flex" }}>
                    <Bell size={13} />
                  </button>
                  <button onClick={() => removeLecture(lec.id)} style={{ background: `${P.red}15`, border: "none", borderRadius: 7, padding: 5, cursor: "pointer", color: P.red, display: "flex" }}>
                    <X size={12} />
                  </button>
                </div>
                );
              })
            )}
          </div>
        );
      })}
      {view === "grid" && (
        (schedule || []).length === 0 ? (
          <div style={{ fontSize: 13, color: t.mu, padding: "28px 16px", background: t.s1, borderRadius: 16, border: `1px dashed ${t.bd}`, textAlign: "center", marginBottom: 8 }}>
            لا محاضرات بعد — أضِف محاضراتك لتظهر في الشبكة الأسبوعية.
          </div>
        ) : (
          <div style={{ overflowX: "auto", paddingBottom: 8, marginBottom: 8, scrollbarWidth: "thin" }}>
            <div style={{ display: "flex", gap: 8, minWidth: "min-content" }}>
              {DAYS.map(day => {
                const dayLecs = (schedule || []).filter(l => l.day === day).sort((a, b) => a.time.localeCompare(b.time));
                const isToday = day === todayAr;
                const dc = DAY_COLORS[day];
                return (
                  <div key={day} style={{ width: 132, flexShrink: 0, display: "flex", flexDirection: "column" }}>
                    <div style={{ textAlign: "center", padding: "7px 4px", borderRadius: "10px 10px 0 0", background: isToday ? dc : `${dc}18`, border: `1px solid ${isToday ? dc : dc + "30"}`, borderBottom: "none" }}>
                      <div style={{ fontSize: 12.5, fontWeight: 900, color: isToday ? "#fff" : dc }}>{day}</div>
                      <div style={{ fontSize: 10, color: isToday ? "rgba(255,255,255,.85)" : t.mu, marginTop: 1 }}>{isToday ? "اليوم" : `${dayLecs.length} محاضرة`}</div>
                    </div>
                    <div style={{ flex: 1, background: t.s2, border: `1px solid ${dc}30`, borderTop: "none", borderRadius: "0 0 10px 10px", padding: 6, display: "flex", flexDirection: "column", gap: 6, minHeight: 90 }}>
                      {dayLecs.length === 0 ? (
                        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: t.dim }}>—</div>
                      ) : dayLecs.map(lec => {
                        const online = lec.mode === "أونلاين";
                        const mc = online ? P.blue2 : P.green;
                        const inner = (
                          <>
                            <div style={{ fontSize: 11.5, fontWeight: 900, color: mc, display: "flex", alignItems: "center", gap: 4 }}>
                              <Clock size={11} /> {lec.time}
                            </div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: t.tx, lineHeight: 1.35, margin: "3px 0" }}>{lec.course}</div>
                            <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 9.5, fontWeight: 800, color: mc }}>
                              {online ? <Monitor size={10} /> : <MapPin size={10} />}
                              {online ? "أونلاين" : (lec.room && !isUrl(lec.room) ? lec.room : "حضوري")}
                            </div>
                          </>
                        );
                        const cardStyle = { textAlign: "right", display: "block", width: "100%", background: t.s1, border: `1px solid ${mc}30`, borderRight: `3px solid ${mc}`, borderRadius: 8, padding: "7px 8px", textDecoration: "none", fontFamily: "inherit", cursor: online && isUrl(lec.room) ? "pointer" : "default" };
                        return online && isUrl(lec.room)
                          ? <a key={lec.id} href={lec.room} target="_blank" rel="noopener noreferrer" title="دخول المحاضرة" style={cardStyle}>{inner}</a>
                          : <div key={lec.id} style={cardStyle}>{inner}</div>;
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )
      )}

      {showAdd ? (
        <div style={{ background: t.s1, borderRadius: 16, padding: 14, border: `1px solid ${t.bd}`, marginTop: 8, animation: "fadeUp .3s ease" }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: t.tx, marginBottom: 10 }}>إضافة محاضرة جديدة</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <input placeholder="اسم المادة (مطلوب)" value={newLec.course} onChange={e => setNewLec(p => ({ ...p, course: e.target.value }))}
              style={{ border: `1px solid ${t.bd}`, borderRadius: 8, padding: "8px 10px", fontSize: 13, background: t.s2, color: t.tx, fontFamily: "inherit", direction: "rtl", outline: "none" }} />
            {/* Mode selector */}
            <div style={{ display: "flex", gap: 8 }}>
              {["حضوري", "أونلاين"].map(mode => {
                const active = newLec.mode === mode;
                const mc = mode === "أونلاين" ? P.blue2 : P.green;
                return (
                  <button key={mode} onClick={() => setNewLec(p => ({ ...p, mode }))} style={{
                    flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    background: active ? `${mc}18` : t.s2, border: `1.5px solid ${active ? mc : t.bd}`,
                    color: active ? mc : t.mu, borderRadius: 9, padding: "8px 10px", cursor: "pointer",
                    fontFamily: "inherit", fontSize: 13, fontWeight: 800,
                  }}>
                    {mode === "أونلاين" ? <Monitor size={14} /> : <Building2 size={14} />} {mode}
                  </button>
                );
              })}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <select value={newLec.day} onChange={e => setNewLec(p => ({ ...p, day: e.target.value }))}
                style={{ border: `1px solid ${t.bd}`, borderRadius: 8, padding: "8px 10px", fontSize: 13, background: t.s2, color: t.tx, fontFamily: "inherit", outline: "none" }}>
                {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <input type="time" value={newLec.time} onChange={e => setNewLec(p => ({ ...p, time: e.target.value }))}
                style={{ border: `1px solid ${t.bd}`, borderRadius: 8, padding: "8px 10px", fontSize: 13, background: t.s2, color: t.tx, fontFamily: "inherit", outline: "none" }} />
            </div>
            <input placeholder={newLec.mode === "أونلاين" ? "رابط المحاضرة (Zoom / Teams)" : "القاعة (اختياري)"} value={newLec.room} onChange={e => setNewLec(p => ({ ...p, room: e.target.value }))}
              style={{ border: `1px solid ${t.bd}`, borderRadius: 8, padding: "8px 10px", fontSize: 13, background: t.s2, color: t.tx, fontFamily: "inherit", direction: newLec.mode === "أونلاين" ? "ltr" : "rtl", textAlign: newLec.mode === "أونلاين" ? "left" : "right", outline: "none" }} />
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: t.tx, cursor: "pointer", padding: "2px 2px" }}>
              <input type="checkbox" checked={newLec.remind !== false} onChange={e => setNewLec(p => ({ ...p, remind: e.target.checked }))} style={{ accentColor: P.gold, width: 16, height: 16 }} />
              <Bell size={14} color={P.gold} /> تذكيري قبل المحاضرة بـ 5 دقائق
            </label>
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
        <button onClick={onClose} style={{ background: "rgba(255,255,255,.1)", border: "none", borderRadius: 8, padding: "7px 13px", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontFamily: "inherit", fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
          <ArrowLeft size={14} /> رجوع
        </button>
        <div style={{ flex: 1, color: "#e4ecf8", fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.name}</div>
        <a href={dlUrl} style={{ background: `linear-gradient(135deg,${P.blue},${P.blue2})`, color: "#fff", borderRadius: 8, padding: "7px 13px", fontSize: 13, fontWeight: 700, textDecoration: "none", display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
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
            <span style={{ background: P.blue2, color: "#fff", fontSize: 11, fontWeight: 800, borderRadius: 4, padding: "1px 5px", flexShrink: 0 }}>جديد</span>
            <div style={{ fontSize: 13, fontWeight: 700, color: t.tx, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.name}</div>
          </div>
          <div style={{ fontSize: 12, color: t.mu }}>{file.sizeLabel} • {new Date(file.uploadedAt).toLocaleDateString("ar-SA")}</div>
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
          {myRating > 0 && <span style={{ fontSize: 11.5, color: t.mu, marginRight: 4 }}>({myRating}/5)</span>}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={shareFile} style={{ background: `${P.purple}12`, border: `1px solid ${P.purple}25`, borderRadius: 8, padding: "6px 8px", cursor: "pointer", color: P.purple, display: "flex", alignItems: "center", gap: 3 }}>
            <Share2 size={12} />
          </button>
          <button onClick={() => setViewing(true)} style={{ background: `${P.blue2}15`, border: `1px solid ${P.blue2}35`, borderRadius: 8, padding: "6px 10px", cursor: "pointer", color: P.blue2, fontSize: 12, fontWeight: 700, fontFamily: "inherit", display: "flex", alignItems: "center", gap: 4 }}>
            <Eye size={12} /> قراءة
          </button>
          <a href={dlUrl} style={{ background: `linear-gradient(135deg,${P.blue},${P.blue2})`, borderRadius: 8, padding: "6px 10px", color: "#fff", fontSize: 12, fontWeight: 700, textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
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
  // Mark a card known/needs-review, then advance — simple spaced-repetition cue.
  const grade = (known) => {
    const card = cards[idx];
    if (card) setCards(cs => cs.map(c => c.id === card.id ? { ...c, known } : c));
    setFlipped(false);
    setIdx(i => (i + 1) % Math.max(1, cards.length));
  };
  const shuffle = () => {
    setCards(cs => { const a2 = [...cs]; for (let i = a2.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a2[i], a2[j]] = [a2[j], a2[i]]; } return a2; });
    setIdx(0); setFlipped(false);
  };

  if (mode === "review" && cards.length > 0) {
    const card = cards[idx];
    const knownCount = cards.filter(c => c.known).length;
    const pct = Math.round((knownCount / cards.length) * 100);
    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <button onClick={() => { setMode("list"); setIdx(0); setFlipped(false); }}
            style={{ background: t.s2, border: `1px solid ${t.bd}`, borderRadius: 8, padding: "6px 12px", cursor: "pointer", color: t.mu, fontSize: 13, fontFamily: "inherit", fontWeight: 700, display: "flex", alignItems: "center", gap: 5 }}>
            <ArrowLeft size={13} /> رجوع
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={shuffle} title="خلط البطاقات" style={{ background: t.s2, border: `1px solid ${t.bd}`, borderRadius: 8, padding: "6px 10px", cursor: "pointer", color: t.mu, fontSize: 12, fontFamily: "inherit", fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
              <RotateCcw size={12} /> خلط
            </button>
            <span style={{ fontSize: 13, color: t.mu, fontWeight: 700 }}>{idx + 1} / {cards.length}</span>
          </div>
        </div>
        {/* Mastery progress */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: t.mu, marginBottom: 4 }}>
            <span>أتقنت {knownCount} من {cards.length}</span><span style={{ color: P.green, fontWeight: 800 }}>{pct}%</span>
          </div>
          <div style={{ height: 6, background: t.s3, borderRadius: 3, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${pct}%`, background: `linear-gradient(90deg,${P.green},${P.greenLight})`, borderRadius: 3, transition: "width .4s ease" }} />
          </div>
        </div>
        <div onClick={() => setFlipped(f => !f)} style={{
          background: flipped ? `${P.green}12` : t.s2, border: `2px solid ${flipped ? P.green : t.bd}`,
          borderRadius: 18, padding: 28, textAlign: "center", cursor: "pointer",
          minHeight: 150, display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", transition: "all .3s", marginBottom: 12, position: "relative",
        }}>
          {card.known && <div style={{ position: "absolute", top: 10, right: 12, fontSize: 10.5, fontWeight: 800, color: P.green, background: `${P.green}18`, borderRadius: 6, padding: "2px 8px" }}>متقنة ✓</div>}
          <div style={{ fontSize: 11.5, color: t.mu, marginBottom: 8 }}>{flipped ? "الجواب" : "السؤال"} — اضغط للقلب</div>
          <div style={{ fontSize: 16.5, fontWeight: 700, color: t.tx, lineHeight: 1.7 }}>
            {flipped ? card.a : card.q}
          </div>
        </div>
        {/* Self-grade once flipped, else plain navigation */}
        {flipped ? (
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => grade(false)} style={{ flex: 1, background: `${P.orange}15`, border: `1.5px solid ${P.orange}45`, borderRadius: 12, padding: 11, cursor: "pointer", color: P.orange, fontSize: 13, fontFamily: "inherit", fontWeight: 800 }}>أحتاج مراجعة</button>
            <button onClick={() => grade(true)} style={{ flex: 1, background: `linear-gradient(135deg,${P.green},${P.greenLight})`, border: "none", borderRadius: 12, padding: 11, cursor: "pointer", color: "#fff", fontSize: 13, fontFamily: "inherit", fontWeight: 800 }}>أتقنتها ✓</button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={prev} style={{ flex: 1, background: t.s2, border: `1px solid ${t.bd}`, borderRadius: 12, padding: 10, cursor: "pointer", color: t.tx, fontSize: 13, fontFamily: "inherit", fontWeight: 700 }}>السابق</button>
            <button onClick={next} style={{ flex: 1, background: `linear-gradient(135deg,${P.blue},${P.blue2})`, border: "none", borderRadius: 12, padding: 10, cursor: "pointer", color: "#fff", fontSize: 13, fontFamily: "inherit", fontWeight: 700 }}>التالي</button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      {mode === "add" ? (
        <div>
          <button onClick={() => setMode("list")} style={{ background: t.s2, border: `1px solid ${t.bd}`, borderRadius: 8, padding: "5px 12px", cursor: "pointer", color: t.mu, fontSize: 13, fontFamily: "inherit", marginBottom: 14 }}>← رجوع</button>
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
            <button onClick={() => setMode("add")} style={{ flex: 1, background: `${P.blue2}15`, border: `1px solid ${P.blue2}40`, borderRadius: 10, padding: 9, cursor: "pointer", color: P.blue2, fontSize: 13, fontFamily: "inherit", fontWeight: 700 }}>+ بطاقة جديدة</button>
            {cards.length > 0 && <button onClick={() => { setIdx(0); setFlipped(false); setMode("review"); }} style={{ flex: 1, background: `${P.green}15`, border: `1px solid ${P.green}40`, borderRadius: 10, padding: 9, cursor: "pointer", color: P.green, fontSize: 13, fontFamily: "inherit", fontWeight: 700 }}>▶ مراجعة ({cards.length})</button>}
          </div>
          {cards.length === 0 ? (
            <div style={{ textAlign: "center", padding: "20px 0", color: t.mu, fontSize: 13 }}>لا توجد بطاقات بعد — أضف سؤالاً وجواباً</div>
          ) : (
            cards.map(c => (
              <div key={c.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 12px", background: t.s2, borderRadius: 10, border: `1px solid ${t.bd}`, borderRight: `3px solid ${c.known ? P.green : t.bd}`, marginBottom: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: t.mu, marginBottom: 2 }}>س: {c.q}</div>
                  <div style={{ fontSize: 13, color: t.tx }}>ج: {c.a}</div>
                </div>
                {c.known && <span style={{ fontSize: 10, fontWeight: 800, color: P.green, background: `${P.green}18`, borderRadius: 6, padding: "2px 7px", flexShrink: 0 }}>متقنة</span>}
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
        <div style={{ fontSize: 13, fontWeight: 800, color: t.tx, display: "flex", alignItems: "center", gap: 6 }}>
          <Activity size={13} color={P.blue2} /> تقدم الدراسة
        </div>
        <div style={{ fontSize: 13, fontWeight: 900, color: pct === 100 ? P.green : P.blue2 }}>
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
                : <span style={{ fontSize: 11.5, fontWeight: 700, color: t.dim }}>{u}</span>}
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

function CoursePage({ subject, onBack, favorites, toggleFav, notes, setNotes, t, onChat, onToast, onAskAI }) {
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
          padding: "7px 14px", borderRadius: 20, cursor: "pointer", fontSize: 13,
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
            <div style={{ color: P.gold, fontSize: 13, marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
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

      {onAskAI && (
        <button onClick={() => onAskAI(subject)} style={{
          width: "100%", background: `linear-gradient(135deg,${P.navy},${P.blue2})`, border: "none", borderRadius: 14,
          padding: "13px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 11, fontFamily: "inherit", marginBottom: 14,
        }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Sparkles size={18} color={P.gold} />
          </div>
          <div style={{ textAlign: "right", flex: 1 }}>
            <div style={{ fontSize: 13.5, fontWeight: 800, color: "#fff" }}>اسأل المساعد الذكي عن {subject}</div>
            <div style={{ fontSize: 11.5, color: "rgba(255,255,255,.7)" }}>شرح، تلخيص، حل أمثلة — بالعربية</div>
          </div>
          <ChevronLeft size={18} color="rgba(255,255,255,.6)" />
        </button>
      )}

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
                  <div style={{ fontSize: 12, color: t.mu, marginTop: 1 }}>{sec.desc}</div>
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
                            <div style={{ fontSize: 13, color: item.color }}>{item.val}</div>
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
                            style={{ flex: 1, border: "none", background: "transparent", outline: "none", fontSize: 13, color: t.tx, fontFamily: "inherit", direction: "rtl" }}
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
                          <div style={{ fontSize: 13, color: t.mu, textAlign: "center", padding: "6px 0 10px", borderBottom: `1px dashed ${t.bd}`, marginBottom: 8 }}>
                            لا توجد ملفات حقيقية بعد
                          </div>
                        )}
                        {filteredMock.map((f, i) => <FileItem key={i} {...f} t={t} onToast={onToast} />)}
                        {fq && filteredReal.length === 0 && filteredMock.length === 0 && (
                          <div style={{ textAlign: "center", padding: "16px 0", color: t.mu, fontSize: 13 }}>لا نتائج لـ «{fileFilter[sec.id]}»</div>
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
        <div style={{ textAlign: "center", padding: "16px 0", color: t.mu, fontSize: 13, lineHeight: 1.7 }}>
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
        <div style={{ fontSize: 12, color: t.mu }}>{totalMins} دقيقة هذا الأسبوع</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {sorted.map(([subject, mins]) => {
          const pct = Math.round((mins / maxMins) * 100);
          return (
            <div key={subject}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 13, color: t.tx, fontWeight: 600 }}>{subject}</span>
                <span style={{ fontSize: 12, color: t.mu }}>{mins}د</span>
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
          <div style={{ fontSize: 12, color: t.mu }}>{xp} XP{level.next ? ` / ${level.next}` : " (أقصى مستوى)"}</div>
        </div>
        <div style={{ fontSize: 22, fontWeight: 900, color: P.gold }}>{xp}</div>
      </div>
      {level.next && (
        <div>
          <div style={{ height: 6, background: t.s3, borderRadius: 3, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${progress}%`, background: `linear-gradient(90deg,${P.gold},${P.orange})`, borderRadius: 3, transition: "width .6s" }} />
          </div>
          <div style={{ fontSize: 11.5, color: t.mu, marginTop: 4 }}>
            {level.next - xp} XP للمستوى التالي
          </div>
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
          <div style={{ fontSize: 13, color: "rgba(255,255,255,.6)", marginTop: 4 }}>التقرير الشهري الأكاديمي</div>
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
              <div style={{ fontSize: 11.5, color: t.mu, marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>

        <div style={{ background: t.s2, borderRadius: 12, padding: 12, marginBottom: 16, border: `1px solid ${t.bd}` }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: t.tx, marginBottom: 4 }}>المادة الأكثر مذاكرة</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: P.blue2 }}>{topSubject}</div>
        </div>

        <div style={{ background: t.s1, borderRadius: 14, padding: 14, border: `1px solid ${t.bd}` }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: t.tx, marginBottom: 12 }}>دقائق الدراسة أسبوعياً</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 80 }}>
            {weeklyMins.map((v, i) => {
              const h = Math.max(4, (v / maxWeekMins) * 100);
              return (
                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                  <div style={{ fontSize: 11, color: t.dim }}>{v}</div>
                  <div style={{ width: "100%", height: `${h}%`, borderRadius: "4px 4px 0 0", background: `linear-gradient(180deg,${P.blue2},${P.blue})`, minHeight: 4 }} />
                  <div style={{ fontSize: 11, color: t.mu }}>أ{i + 1}</div>
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
const FOCUS_QUOTES = [
  "ركّز على خطوة واحدة الآن، والباقي يتبع.",
  "٢٥ دقيقة تركيز كامل تساوي ساعة من التشتّت.",
  "النجاح مجموع جهود صغيرة تتكرّر كل يوم.",
  "أغلق كل شيء… إلا هدفك.",
  "أنت أقرب مما تظن، أكمِل.",
  "الاستمرار أهم من الكمال.",
  "دقيقة تركيز الآن خير من ساعة ندم لاحقاً.",
];
const FOCUS_WORK = [25, 50, 90];
const FOCUS_BREAK = [5, 10, 15];
const FOCUS_SUGS = ["📝 لخّص الفكرة الرئيسية", "🧠 اشرح ببساطة", "💡 أعطني مثالاً", "❓ سؤال اختبار سريع"];

function FocusMode({ t, sessionLog, setSessionLog, totalSessions, setTotalSessions, soundOn, onToast, onClose, setXp }) {
  const [focusSubject, setFocusSubject] = useState(ALL_SUBJECTS_LIST[0] || "عام");
  const [mode, setMode] = useState("work"); // work | break
  const [workMin, setWorkMin] = useState(25);
  const [breakMin, setBreakMin] = useState(5);
  const [secs, setSecs] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [focusQ, setFocusQ] = useState("");
  const [focusA, setFocusA] = useState("");
  const [focusLoading, setFocusLoading] = useState(false);
  const [quoteIdx, setQuoteIdx] = useState(() => Math.floor(Math.random() * FOCUS_QUOTES.length));
  const [dayGoal, setDayGoal] = useStored("focusDayGoal", 4);
  const timerRef = useRef(null);

  const total = (mode === "work" ? workMin : breakMin) * 60;
  const mm = String(Math.floor(secs / 60)).padStart(2, "0");
  const ss = String(secs % 60).padStart(2, "0");
  const prog = total > 0 ? 1 - secs / total : 0;
  const r = 96; const circ = 2 * Math.PI * r;
  const modeColor = mode === "work" ? P.blue2 : P.green;
  const todaySessions = (sessionLog || []).filter(s => s.date === todayKey()).length;
  const todayMins = (sessionLog || []).filter(s => s.date === todayKey()).reduce((a, s) => a + (s.dur || 25), 0);

  useEffect(() => { const iv = setInterval(() => setQuoteIdx(i => (i + 1) % FOCUS_QUOTES.length), 12000); return () => clearInterval(iv); }, []);

  useEffect(() => {
    if (running) {
      timerRef.current = setInterval(() => setSecs(s => {
        if (s <= 1) {
          clearInterval(timerRef.current); setRunning(false);
          if (soundOn) playBell();
          if (mode === "work") {
            setTotalSessions(n => n + 1);
            setSessionLog(l => [...l, { date: todayKey(), dur: workMin, subject: focusSubject, t: Date.now() }]);
            const xp = storage.get("xp", 0); storage.set("xp", xp + 30); setXp(xp + 30);
            onToast?.("جلسة تركيز مكتملة! خذ راحة 🎉 +30 XP", "success");
            setMode("break"); return breakMin * 60;
          }
          onToast?.("انتهت الراحة — لنكمل 💪", "info");
          setMode("work"); return workMin * 60;
        }
        return s - 1;
      }), 1000);
    } else clearInterval(timerRef.current);
    return () => clearInterval(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, mode, workMin, breakMin, focusSubject, soundOn]);

  const changeMode = (m) => { clearInterval(timerRef.current); setRunning(false); setMode(m); setSecs((m === "work" ? workMin : breakMin) * 60); };
  const setPreset = (min) => { clearInterval(timerRef.current); setRunning(false); if (mode === "work") setWorkMin(min); else setBreakMin(min); setSecs(min * 60); };
  const reset = () => { clearInterval(timerRef.current); setRunning(false); setSecs(total); };

  const askAI = async (q) => {
    const query = (q || focusQ).trim();
    if (!query || focusLoading) return;
    setFocusQ(query); setFocusLoading(true); setFocusA("");
    try {
      const res = await fetch("/api/ai", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: focusSubject, messages: [{ role: "user", content: query }], fileContext: null }),
      });
      const d = await res.json();
      setFocusA(d.text || d.error || "لا توجد إجابة");
    } catch { setFocusA("تعذّر الاتصال"); }
    setFocusLoading(false);
  };

  const presetList = mode === "work" ? FOCUS_WORK : FOCUS_BREAK;
  const curMin = mode === "work" ? workMin : breakMin;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 450, overflowY: "auto",
      background: mode === "work"
        ? "radial-gradient(ellipse 90% 55% at 50% 0%, rgba(10,138,88,.28) 0%, transparent 60%), linear-gradient(180deg,#04120c,#02070f 60%,#04120c)"
        : "radial-gradient(ellipse 90% 55% at 50% 0%, rgba(5,150,105,.28) 0%, transparent 60%), linear-gradient(180deg,#04140d,#02100a 60%,#04140d)",
      display: "flex", flexDirection: "column", animation: "fadeIn .3s ease", transition: "background .6s ease" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 20px" }}>
        <button onClick={onClose} style={{ background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.18)", borderRadius: 10, padding: "8px 13px", cursor: "pointer", color: "#fff", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit", fontSize: 13, fontWeight: 700 }}>
          <ArrowLeft size={15} /> رجوع
        </button>
        <div style={{ flex: 1, fontSize: 16, fontWeight: 900, color: "#fff", display: "flex", alignItems: "center", gap: 8 }}>
          <Target size={18} color={P.gold} /> وضع التركيز
        </div>
        <button onClick={onClose} title="إغلاق" style={{ background: "rgba(255,255,255,.1)", border: "none", borderRadius: 10, padding: 9, cursor: "pointer", color: "#fff", display: "flex" }}>
          <X size={18} />
        </button>
      </div>

      <div style={{ flex: 1, padding: "8px 16px 32px", maxWidth: 460, margin: "0 auto", width: "100%" }}>
        {/* Today snapshot */}
        <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
          {[{ l: "جلسات اليوم", v: todaySessions, i: Flame }, { l: "دقائق اليوم", v: todayMins, i: Clock }, { l: "الإجمالي", v: totalSessions, i: Trophy }].map(({ l, v, i: Ic }) => (
            <div key={l} style={{ flex: 1, background: "rgba(255,255,255,.06)", borderRadius: 14, padding: "12px 8px", textAlign: "center", border: "1px solid rgba(255,255,255,.08)" }}>
              <Ic size={15} color={P.gold} style={{ marginBottom: 5 }} />
              <div style={{ fontSize: 19, fontWeight: 900, color: "#fff", lineHeight: 1 }}>{v}</div>
              <div style={{ fontSize: 10.5, color: "rgba(255,255,255,.55)", marginTop: 3 }}>{l}</div>
            </div>
          ))}
        </div>

        {/* Daily session goal — visual dots that fill as sessions complete */}
        <div style={{ background: "rgba(255,255,255,.05)", borderRadius: 14, padding: "11px 13px", marginBottom: 18, border: "1px solid rgba(255,255,255,.08)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 9 }}>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,.65)", fontWeight: 700 }}>هدف اليوم</span>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button onClick={() => setDayGoal(g => Math.max(1, g - 1))} style={{ background: "rgba(255,255,255,.1)", border: "none", borderRadius: 6, width: 22, height: 22, cursor: "pointer", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}><Minus size={11} /></button>
              <span style={{ fontSize: 12.5, fontWeight: 900, color: P.gold, minWidth: 44, textAlign: "center" }}>{todaySessions}/{dayGoal}</span>
              <button onClick={() => setDayGoal(g => Math.min(12, g + 1))} style={{ background: "rgba(255,255,255,.1)", border: "none", borderRadius: 6, width: 22, height: 22, cursor: "pointer", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}><Plus size={11} /></button>
            </div>
          </div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {Array.from({ length: dayGoal }).map((_, i) => (
              <div key={i} style={{
                flex: 1, minWidth: 14, height: 7, borderRadius: 4,
                background: i < todaySessions ? `linear-gradient(90deg,${P.gold},${P.goldRich})` : "rgba(255,255,255,.12)",
                boxShadow: i < todaySessions ? `0 0 8px ${P.gold}55` : "none", transition: "all .3s",
              }} />
            ))}
          </div>
          {todaySessions >= dayGoal && (
            <div style={{ fontSize: 11.5, color: P.gold, fontWeight: 800, marginTop: 8, textAlign: "center" }}>🎉 أنجزت هدف اليوم — أحسنت!</div>
          )}
        </div>

        {/* Mode + preset */}
        <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 12 }}>
          {[["work", "⚡ دراسة"], ["break", "☕ راحة"]].map(([m, l]) => (
            <button key={m} onClick={() => changeMode(m)} style={{ flex: 1, background: mode === m ? modeColor : "rgba(255,255,255,.06)", border: `1px solid ${mode === m ? modeColor : "rgba(255,255,255,.12)"}`, borderRadius: 12, padding: "9px", cursor: "pointer", fontSize: 13.5, fontWeight: 800, color: "#fff", fontFamily: "inherit" }}>{l}</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 18 }}>
          {presetList.map(min => (
            <button key={min} onClick={() => setPreset(min)} style={{ background: curMin === min ? "rgba(255,255,255,.2)" : "rgba(255,255,255,.05)", border: `1px solid rgba(255,255,255,${curMin === min ? .35 : .1})`, borderRadius: 20, padding: "5px 16px", cursor: "pointer", fontSize: 12.5, color: "#fff", fontFamily: "inherit", fontWeight: 700 }}>{min} د</button>
          ))}
        </div>

        {/* Big ring */}
        <div style={{ position: "relative", width: 220, height: 220, margin: "0 auto 8px" }}>
          <svg width={220} height={220} style={{ transform: "rotate(-90deg)" }}>
            <circle cx={110} cy={110} r={r} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth={10} />
            <circle cx={110} cy={110} r={r} fill="none" stroke={modeColor} strokeWidth={10}
              strokeDasharray={circ} strokeDashoffset={circ * (1 - prog)} strokeLinecap="round"
              style={{ transition: "stroke-dashoffset 1s linear", filter: `drop-shadow(0 0 10px ${modeColor})` }} />
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <div style={{ fontSize: 52, fontWeight: 900, color: "#fff", fontFamily: "monospace", letterSpacing: 1, lineHeight: 1 }}>{mm}:{ss}</div>
            <div style={{ fontSize: 12.5, color: "rgba(255,255,255,.6)", marginTop: 8 }}>{mode === "work" ? "وقت التركيز" : "استراحة"}</div>
            <div style={{ fontSize: 12, color: P.gold, fontWeight: 800, marginTop: 2 }}>{Math.round(prog * 100)}%</div>
          </div>
        </div>

        {/* Controls */}
        <div style={{ display: "flex", gap: 14, justifyContent: "center", marginBottom: 18 }}>
          <button onClick={reset} title="إعادة" style={{ background: "rgba(255,255,255,.1)", border: "none", borderRadius: "50%", width: 46, height: 46, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,.8)" }}>
            <RotateCcw size={17} />
          </button>
          <button onClick={() => setRunning(rv => !rv)} style={{ background: running ? P.red : `linear-gradient(135deg,${modeColor},${modeColor}cc)`, border: "none", borderRadius: 26, padding: "13px 40px", cursor: "pointer", color: "#fff", fontSize: 16, fontWeight: 800, fontFamily: "inherit", display: "flex", alignItems: "center", gap: 8, boxShadow: `0 8px 24px ${(running ? P.red : modeColor)}55` }}>
            {running ? <><Pause size={18} />إيقاف</> : <><Play size={18} />ابدأ</>}
          </button>
        </div>

        {/* Motivational quote */}
        <div style={{ textAlign: "center", color: "rgba(255,255,255,.7)", fontSize: 13.5, lineHeight: 1.8, marginBottom: 20, padding: "0 10px", minHeight: 44, transition: "opacity .4s" }}>
          « {FOCUS_QUOTES[quoteIdx]} »
        </div>

        {/* Subject */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,.5)", marginBottom: 6 }}>مادة الدراسة</div>
          <select value={focusSubject} onChange={e => setFocusSubject(e.target.value)}
            style={{ width: "100%", background: "rgba(255,255,255,.08)", color: "#fff", border: "1px solid rgba(255,255,255,.15)", borderRadius: 12, padding: "11px 14px", fontSize: 14, fontFamily: "inherit", direction: "rtl", outline: "none", fontWeight: 700 }}>
            {ALL_SUBJECTS_LIST.map(s => <option key={s} value={s} style={{ background: "#0a3d29" }}>{s}</option>)}
          </select>
        </div>

        {/* Quick AI */}
        <div style={{ background: "rgba(255,255,255,.05)", borderRadius: 16, padding: 16, border: "1px solid rgba(255,255,255,.08)" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,.85)", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
            <Sparkles size={14} color={P.gold} /> اسأل المساعد أثناء تركيزك
          </div>
          <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 10, scrollbarWidth: "none" }}>
            {FOCUS_SUGS.map(s => (
              <button key={s} onClick={() => askAI(s.replace(/^[^؀-ۿ]+/, ""))} style={{ whiteSpace: "nowrap", background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.15)", borderRadius: 18, padding: "5px 12px", fontSize: 12, color: "rgba(255,255,255,.85)", cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>{s}</button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={focusQ} onChange={e => setFocusQ(e.target.value)} onKeyDown={e => e.key === "Enter" && askAI()}
              placeholder="اكتب سؤالك..."
              style={{ flex: 1, background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 10, padding: "9px 12px", color: "#fff", fontSize: 13, fontFamily: "inherit", direction: "rtl", outline: "none" }} />
            <button onClick={() => askAI()} disabled={focusLoading || !focusQ.trim()} style={{ background: focusLoading || !focusQ.trim() ? "rgba(255,255,255,.1)" : `linear-gradient(135deg,${P.navy},${P.blue2})`, border: "none", borderRadius: 10, padding: "9px 15px", cursor: "pointer", color: "#fff", fontFamily: "inherit", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 5 }}>
              {focusLoading ? "…" : <Send size={13} />}
            </button>
          </div>
          {focusA && (
            <div style={{ background: "rgba(255,255,255,.06)", borderRadius: 10, padding: 12, fontSize: 13, color: "rgba(255,255,255,.85)", lineHeight: 1.8, maxHeight: 180, overflowY: "auto", whiteSpace: "pre-wrap", marginTop: 10 }}>
              {mdToText(focusA)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Icons an admin can pick for a calendar event (JSON stores the name).
const CAL_ICONS = { Flame, Trophy, FileText, GraduationCap, PenLine, Calendar, Award, Bell, Star, BookOpen, CheckCircle, CreditCard };
const CAL_ICON_NAMES = Object.keys(CAL_ICONS);

// Shared audience matcher — used by the calendar (and mirrors the notification
// filter). An event/announcement tagged with an audience shows only to the
// students it targets. Values:
//   undefined | 'all'          → everyone (guests included)
//   'track:<track>'            → any student in that track
//   'plan:<track>|<plan>'      → only that track+plan (e.g. تحضيري خطة أ)
// Guests (no profile) see only 'all'.
function audienceMatches(aud, profile) {
  if (!aud || aud === "all") return true;
  if (aud.startsWith("track:")) return profile?.track === aud.slice(6);
  if (aud.startsWith("plan:")) {
    const [tr, pl] = aud.slice(5).split("|");
    return profile?.track === tr && profile?.plan === pl;
  }
  return true;
}
// Short human label for an audience tag (used in badges).
function audienceLabel(aud) {
  if (!aud || aud === "all") return "";
  if (aud.startsWith("track:")) return aud.slice(6);
  if (aud.startsWith("plan:")) { const [tr, pl] = aud.slice(5).split("|"); return `${tr} · ${pl}`; }
  return "";
}
// Default academic calendar — admin edits override this via site_content.
const DEFAULT_CALENDAR = {
  events: [
    { label: "الاختبارات النهائية — الفصل الثاني 1447", date: "2026-06-07", color: "#dc2626", icon: "Flame" },
    { label: "نتائج الفصل الثاني 1447", date: "2026-06-28", color: "#059669", icon: "Trophy" },
    { label: "التسجيل للفصل الأول 1448", date: "2026-07-20", color: "#7c3aed", icon: "FileText" },
    { label: "بداية الفصل الأول 1448", date: "2026-09-06", color: "#2563eb", icon: "GraduationCap" },
    { label: "اختبارات الميدترم — الفصل الأول 1448", date: "2026-10-25", color: "#c8a84b", icon: "PenLine" },
    { label: "الاختبارات النهائية — الفصل الأول 1448", date: "2026-12-13", color: "#dc2626", icon: "Flame" },
  ],
};

// Bottom strip showing ALL calendar events horizontally; content comes from
// the admin panel (site_content['calendar']) with a built-in fallback.
// Formats an event's Hijri-free Gregorian date in Arabic.
function calDate(iso) {
  if (!iso) return "بدون تاريخ";
  try {
    const d = new Date(iso + "T00:00:00");
    if (Number.isNaN(d.getTime())) return String(iso);
    return d.toLocaleDateString("ar-SA-u-ca-gregory", { year: "numeric", month: "long", day: "numeric" });
  } catch { return String(iso); }
}
function calChip(days) {
  if (days <= 0) return { bg: `${P.green}20`, col: P.green, text: "انتهى" };
  if (days === 1) return { bg: `${P.red}20`, col: P.red, text: "غداً" };
  if (days <= 14) return { bg: `${P.red}18`, col: P.red, text: `${days} يوم` };
  return { bg: `${P.blue2}15`, col: P.blue2, text: `${days} يوم` };
}

// Full-screen calendar view opened from the home strip — a clean vertical
// timeline of every academic event (upcoming first, then finished).
function CalendarModal({ t, events, onClose }) {
  const upcoming = events.filter(e => e.days >= 0);
  const past = events.filter(e => e.days < 0);
  const Row = (e, i) => {
    const Ic = CAL_ICONS[e.icon] || Calendar;
    const col = e.color || P.blue2;
    const chip = calChip(e.days);
    return (
      <div key={i} style={{ display: "flex", gap: 12, padding: "13px 14px", background: t.s1, borderRadius: 14, border: `1px solid ${t.bd}`, borderRight: `3px solid ${col}`, marginBottom: 10, opacity: e.days < 0 ? 0.6 : 1 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: `${col}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: `1px solid ${col}30` }}>
          <Ic size={19} color={col} strokeWidth={2} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: t.tx, lineHeight: 1.5 }}>{e.label}</div>
          <div style={{ fontSize: 12, color: t.mu, marginTop: 3 }}>{calDate(e.date)}</div>
          {audienceLabel(e.audience) && (
            <div style={{ display: "inline-block", fontSize: 10.5, fontWeight: 700, color: col, background: `${col}14`, borderRadius: 7, padding: "2px 8px", marginTop: 6 }}>خاص بـ {audienceLabel(e.audience)}</div>
          )}
        </div>
        <div style={{ background: chip.bg, color: chip.col, borderRadius: 9, padding: "4px 10px", fontSize: 11.5, fontWeight: 800, alignSelf: "flex-start", flexShrink: 0 }}>{chip.text}</div>
      </div>
    );
  };
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 300, background: t.bg, display: "flex", flexDirection: "column", animation: "fadeIn .2s ease" }}>
      <div style={{ background: t.hero, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
        <button onClick={onClose} style={{ background: "rgba(255,255,255,.14)", border: "1px solid rgba(255,255,255,.2)", borderRadius: 10, padding: "8px 13px", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit", fontSize: 13, fontWeight: 700 }}>
          <ArrowLeft size={15} /> رجوع
        </button>
        <div style={{ fontSize: 17, fontWeight: 900, color: "#fff", display: "flex", alignItems: "center", gap: 8 }}>
          <Calendar size={18} color={P.gold} /> التقويم الأكاديمي
        </div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "16px", maxWidth: 620, margin: "0 auto", width: "100%" }}>
        {upcoming.length > 0 && <div style={{ fontSize: 13, fontWeight: 800, color: t.mu, marginBottom: 10 }}>القادمة</div>}
        {upcoming.map(Row)}
        {past.length > 0 && <div style={{ fontSize: 13, fontWeight: 800, color: t.mu, margin: "18px 0 10px" }}>المنتهية</div>}
        {past.map(Row)}
        {events.length === 0 && <div style={{ textAlign: "center", color: t.mu, padding: "40px 0", fontSize: 13 }}>لا أحداث في التقويم بعد</div>}
      </div>
    </div>
  );
}

function AcademicCalendar({ t, profile }) {
  const { data: content } = useSiteContent("calendar");
  const [open, setOpen] = useState(false);
  const now = new Date();
  // Public site: everyone sees every event. The audience tag stays only as an
  // informational badge ("خاص بـ خطة أ") — it never hides anything.
  // Admin-entered events may be missing or have a blank date; never let one
  // bad row throw (an exception here would blank the entire app).
  const events = (Array.isArray(content?.events) && content.events.length ? content.events : DEFAULT_CALENDAR.events)
    .filter(e => e && typeof e === "object")
    .map(e => {
      const date = typeof e.date === "string" ? e.date : "";
      const ms = date ? new Date(date + "T00:00:00").getTime() : NaN;
      return { ...e, date, days: Number.isNaN(ms) ? 0 : Math.ceil((ms - now) / 86400000) };
    })
    .sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999"));

  if (!events.length) return null;
  const upcoming = events.filter(e => e.days >= 0);
  const strip = (upcoming.length ? upcoming : events).slice(0, 8);

  return (
    <>
      {open && <CalendarModal t={t} events={events} onClose={() => setOpen(false)} />}
      <div style={{ background: t.s1, borderRadius: 18, padding: 16, border: `1px solid ${t.bd}`, marginBottom: 16, boxShadow: t.shSm }}>
        <button onClick={() => setOpen(true)} style={{ width: "100%", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, padding: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: t.tx, display: "flex", alignItems: "center", gap: 6 }}>
            <Calendar size={14} color={P.blue2} /> التقويم الأكاديمي
          </span>
          <span style={{ fontSize: 12, color: P.blue2, fontWeight: 700, display: "flex", alignItems: "center", gap: 3 }}>عرض الكل <ChevronLeft size={12} /></span>
        </button>
        <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 6, scrollbarWidth: "none" }}>
          {strip.map((e, i) => {
            const Ic = CAL_ICONS[e.icon] || Calendar;
            const col = e.color || P.blue2;
            const chip = calChip(e.days);
            return (
              <button key={i} onClick={() => setOpen(true)} style={{
                flexShrink: 0, width: 158, background: t.s2, borderRadius: 14, textAlign: "right", cursor: "pointer", fontFamily: "inherit",
                border: `1px solid ${col}25`, padding: 12, display: "flex", flexDirection: "column", gap: 8,
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: `${col}18`, display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${col}30` }}>
                    <Ic size={16} color={col} strokeWidth={2} />
                  </div>
                  <div style={{ background: chip.bg, color: chip.col, borderRadius: 8, padding: "3px 8px", fontSize: 11, fontWeight: 800 }}>{chip.text}</div>
                </div>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: t.tx, lineHeight: 1.5, minHeight: 36 }}>{e.label}</div>
                <div style={{ fontSize: 11.5, color: t.mu }}>{calDate(e.date)}</div>
                {audienceLabel(e.audience) && (
                  <div style={{ fontSize: 10, fontWeight: 700, color: col, background: `${col}14`, borderRadius: 7, padding: "2px 6px", alignSelf: "flex-start" }}>
                    خاص بـ {audienceLabel(e.audience)}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

function HomePage({ setActiveTab, openCourse, onOpenAI, t, recent, streak, activeDays, weeklyGoal, weekProgress, achievements, sessionLog, semesters, schedule, tasks, setTasks, onToast, exams, setExams, xp, setXp, profile, guest, onShowFocus, onShowReport }) {
  // Clock-dependent text is computed after mount only. Rendering it during SSR
  // would bake in the server's time/locale, which rarely matches the visitor's
  // and makes React fail hydration (the app then dies with a client-side
  // exception). Empty on the first paint, filled a tick later.
  const [clock, setClock] = useState({ greeting: "", todayStr: "" });
  useEffect(() => {
    const h = new Date().getHours();
    const greeting = h < 5 ? "طاب ليلك" : h < 12 ? "صباح الخير" : h < 17 ? "مساء الخير" : "طاب مساؤك";
    let todayStr = "";
    try { todayStr = new Date().toLocaleDateString("ar-SA-u-ca-gregory", { weekday: "long", day: "numeric", month: "long", year: "numeric" }); }
    catch { try { todayStr = new Date().toLocaleDateString("ar", { weekday: "long", day: "numeric", month: "long" }); } catch { todayStr = ""; } }
    setClock({ greeting, todayStr });
  }, []);
  const { greeting, todayStr } = clock;
  // Starts at 0 for a stable first render; the hour-based tip is picked after
  // mount (see the interval effect below) to stay hydration-safe.
  const [tipIdx, setTipIdx] = useState(0);
  const [pwaPrompt, setPwaPrompt] = useState(null);
  useEffect(() => {
    setTipIdx(Math.floor(Date.now() / 3600000) % TIPS.length);
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
        <div style={{ color: "rgba(255,255,255,.6)", fontSize: 13, marginBottom: 4 }}>{greeting} 👋</div>
        {todayStr && <div style={{ color: P.gold, fontSize: 12, marginBottom: 8, fontWeight: 600 }}>📅 {todayStr}</div>}
        <h1 style={{ color: "#fff", fontSize: 24, fontWeight: 900, margin: "0 0 6px", lineHeight: 1.3 }}>
          {profile?.name ? <>مرحباً <span style={{ color: P.gold }}>{profile.name}</span></> : <>مرحباً في <span style={{ color: P.gold }}>حلول</span></>}
        </h1>
        <p style={{ color: "rgba(255,255,255,.65)", fontSize: 13, margin: 0, lineHeight: 1.7 }}>
          {profile?.track ? `مسارك: ${profile.track}${profile.plan ? " — " + profile.plan : ""} • بوابتك الأكاديمية الذكية` : "بوابتك الأكاديمية الذكية للجامعة السعودية الإلكترونية"}
        </p>
        <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
          {(() => {
            // Uniform hero pills — one primary (gold, filled), the rest subtle
            // glass chips, all the same height/radius for a tidy row.
            const base = { height: 34, padding: "0 14px", borderRadius: 17, cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" };
            const ghost = { ...base, background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.16)", color: "rgba(255,255,255,.9)" };
            return (
              <>
                <button onClick={() => setActiveTab("explore")} style={{ ...base, background: `linear-gradient(135deg,${P.gold},${P.goldRich})`, border: "none", color: "#3a2e05", fontWeight: 800, boxShadow: `0 6px 18px ${P.gold}44` }}>
                  <GradCap size={14} /> اختر مسارك
                </button>
                <button onClick={onOpenAI} style={ghost}>
                  <Sparkles size={13} color={P.gold} /> المساعد الذكي
                </button>
                <button onClick={() => setActiveTab("gpa")} style={ghost}>
                  <Calculator size={13} /> احسب معدلك
                </button>
                {pwaPrompt && (
                  <button onClick={installPwa} style={{ ...base, background: `${P.green}22`, border: `1px solid ${P.green}55`, color: "#8ff0c0" }}>
                    <Download size={13} /> ثبّت التطبيق
                  </button>
                )}
              </>
            );
          })()}
        </div>
      </div>

      {/* Today's Lectures */}
      <div style={{ background: t.s1, borderRadius: 18, padding: 14, marginBottom: 14, border: `1px solid ${t.bd}`, boxShadow: t.shSm }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: t.tx, display: "flex", alignItems: "center", gap: 6 }}>
            <CalendarDays size={14} color={P.blue2} /> محاضرات اليوم
            <span style={{ fontSize: 12, color: t.mu, fontWeight: 500 }}>({todayAr})</span>
          </div>
          <button onClick={() => setActiveTab("schedule")} style={{ background: "none", border: "none", cursor: "pointer", color: P.blue2, fontSize: 12, fontFamily: "inherit", display: "flex", alignItems: "center", gap: 3, fontWeight: 700 }}>
            الجدول <ChevronLeft size={11} />
          </button>
        </div>
        {todayLectures.length === 0 ? (
          <div style={{ fontSize: 13, color: t.dim }}>لا محاضرات اليوم</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {todayLectures.map(lec => (
              <div key={lec.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: `${P.blue2}08`, borderRadius: 9, border: `1px solid ${P.blue2}20` }}>
                <div style={{ width: 26, height: 26, borderRadius: 7, background: `${P.blue2}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Clock size={12} color={P.blue2} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: t.tx }}>{lec.course}</div>
                  <div style={{ fontSize: 11.5, color: t.mu }}>{lec.time}{lec.room ? ` • ${lec.room}` : ""}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Unified tasks + exams hub */}
      <TasksHub t={t} tasks={tasks} setTasks={setTasks} exams={exams} setExams={setExams} onToast={onToast} setXp={setXp} guest={guest} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 16 }}>
        <StatCard Icon={Book} value={4200} suffix="+" label="مادة دراسية" color={P.blue2} t={t} />
        <StatCard Icon={Bookmark} value={6000} suffix="+" label="تجميع وملخص" color={P.gold} t={t} />
        <StatCard Icon={Users} value={5000} suffix="+" label="طالب نشط" color={P.green} t={t} />
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
                  <div style={{ fontSize: 13, fontWeight: 700, color: t.tx, textAlign: "right" }}>{s}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div style={{
        background: `linear-gradient(135deg, ${P.gold}14, ${P.gold}05)`, borderRadius: 18,
        padding: "16px", marginBottom: 16, border: `1.5px solid ${P.gold}40`,
        boxShadow: `0 4px 20px ${P.gold}12`, position: "relative", overflow: "hidden",
      }}>
        <div style={{ position: "absolute", top: -24, left: -14, width: 90, height: 90, borderRadius: "50%", background: `${P.gold}12`, pointerEvents: "none" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 34, height: 34, borderRadius: 11, background: `linear-gradient(135deg,${P.gold},${P.goldRich})`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 4px 12px ${P.gold}40` }}>
              <Lightbulb size={17} color="#3a2e05" />
            </div>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 900, color: t.tx }}>نصيحة دراسية</div>
              <div style={{ fontSize: 10.5, color: t.mu, fontWeight: 600 }}>{tipIdx + 1} من {TIPS.length}</div>
            </div>
          </div>
          <button
            onClick={() => setTipIdx(i => (i + 1) % TIPS.length)}
            style={{ background: `linear-gradient(135deg,${P.gold},${P.goldRich})`, border: "none", borderRadius: 20, padding: "6px 13px", cursor: "pointer", fontSize: 12, color: "#3a2e05", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5, fontWeight: 800 }}>
            <RotateCcw size={12} /> التالية
          </button>
        </div>
        <p style={{ margin: 0, fontSize: 14.5, color: t.tx, lineHeight: 1.85, fontWeight: 600, borderRight: `3px solid ${P.gold}`, paddingRight: 12, position: "relative" }}>{tip}</p>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: t.tx, marginBottom: 12 }}>وصول سريع</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
          {[
            { Icon: BookOpen, label: "تجميعات وملخصات", tab: "explore", color: P.blue2 },
            { Icon: FileText, label: "خطط دراسية", tab: "explore", color: P.purple },
            { Icon: GraduationCap, label: "المقررات", tab: "explore", color: "#be123c" },
            { Icon: Star, label: "المفضلة", tab: "fav", color: P.gold },
            { Icon: CalendarDays, label: "جدولي", tab: "schedule", color: P.green },
            { Icon: Link2, label: "روابط الجامعة", tab: "links", color: P.cyan },
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
              <div style={{ fontSize: 13, fontWeight: 700, color: t.tx }}>{label}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Academic calendar strip — bottom */}
      <AcademicCalendar t={t} profile={profile} />

      {/* Focus mode — bottom */}
      <button onClick={onShowFocus} style={{ width: "100%", background: `linear-gradient(135deg,${P.navy},${P.blue2})`, border: "none", borderRadius: 14, padding: "16px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12, fontFamily: "inherit", marginBottom: 8 }}>
        <Target size={22} color="#fff" />
        <div style={{ textAlign: "right", flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>وضع التركيز</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,.65)" }}>مؤقت دراسة + مساعد ذكي — كل ما تحتاجه للمذاكرة</div>
        </div>
        <ChevronLeft size={18} color="rgba(255,255,255,.6)" />
      </button>
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
            <div style={{ fontSize: 13, color: t.mu, marginBottom: 14 }}>{total} نتيجة</div>
            {groups.map((g, gi) => (
              <div key={gi} style={{ marginBottom: 14 }}>
                <div style={{
                  fontSize: 12, fontWeight: 800, color: g.color, marginBottom: 6,
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
const TRACK_TO_TREE = { "تحضيري": "preparatory", "تخصص": "bachelor", "دبلوم": "diploma", "دراسات عليا": "graduate" };
const PLAN_TO_SUB = { "خطة أ": "a", "خطة ب": "b" };

function ExplorePage({ onCourse, t, profile }) {
  const [step, setStep] = useState("root");
  const [path, setPath] = useState(null);
  const [sub, setSub] = useState(null);

  // Personalise: jump straight to the student's track (and plan) on first open.
  useEffect(() => {
    const key = TRACK_TO_TREE[profile?.track];
    if (!key) return;
    setPath(key);
    if (key === "preparatory" && PLAN_TO_SUB[profile?.plan]) {
      setSub(PLAN_TO_SUB[profile.plan]); setStep("level3");
    } else {
      setStep("level2");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      {sub && <div style={{ fontSize: 12, color: t.mu, lineHeight: 1.5 }}>{sub}</div>}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", marginTop: 10 }}>
        <div style={{ background: `${color}18`, border: `1px solid ${color}30`, borderRadius: 20, padding: "3px 10px", fontSize: 12, color, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
          استكشف <ChevronLeft size={11} />
        </div>
      </div>
    </button>
  );

  // Registered students are scoped to their own track — they can move within
  // it but not back up to "all tracks". Guests (no profile) browse freely.
  const lockedKey = TRACK_TO_TREE[profile?.track];

  const back = () => {
    if (step === "level3") setStep("level2");
    else if (step === "level2" && !lockedKey) { setStep("root"); setPath(null); setSub(null); }
  };

  const crumbs = lockedKey ? [] : [{ label: "المسارات", onClick: () => { setStep("root"); setPath(null); setSub(null); } }];
  if (step !== "root" && path) crumbs.push({ label: TREE[path]?.label, onClick: lockedKey ? undefined : () => { setStep("level2"); setSub(null); } });
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
          {!(lockedKey && step === "level2") && (
          <button onClick={back} style={{
            background: t.s2, border: `1px solid ${t.bd}`, borderRadius: 20, padding: "6px 12px",
            cursor: "pointer", fontSize: 13, color: t.mu, fontFamily: "inherit",
            display: "flex", alignItems: "center", gap: 5,
          }}>
            <ArrowLeft size={12} /> رجوع
          </button>
          )}
          {crumbs.map((c, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <button onClick={c.onClick} disabled={!c.onClick} style={{
                background: "none", border: "none", color: i === crumbs.length - 1 ? t.tx : t.mu,
                fontSize: 12, cursor: c.onClick ? "pointer" : "default", fontFamily: "inherit",
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
                <div style={{ fontSize: 13, fontWeight: 700, color: t.tx }}>{s}</div>
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
                cursor: "pointer", fontSize: 13, color: P.blue2, fontFamily: "inherit", fontWeight: 600,
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
function ProfilePage({ t, achievements, recent, favorites, totalSessions, sessionLog, streak, profile, setProfile, setActiveTab, onToast, onLogout, notes, openCourse, openSettings }) {
  const totalMins = sessionLog.reduce((a, s) => a + s.dur, 0);
  const totalHours = Math.floor(totalMins / 60);
  const [editing, setEditing] = useState(!profile);
  const [draft, setDraft] = useState({ name: profile?.name || "", track: profile?.track || "تحضيري", plan: profile?.plan || "" });
  const draftPlans = AUTH_PLANS[draft.track] || null;

  const save = () => {
    if (!draft.name.trim()) { onToast?.("اكتب اسمك أولاً", "warn"); return; }
    setProfile({ name: draft.name.trim(), track: draft.track || "تحضيري", plan: draft.plan || "", created: profile?.created || Date.now() });
    setEditing(false);
    onToast?.("تم حفظ ملفك ✅", "success");
  };

  const days = last7Days();
  const dayLabels = ["أحد", "اثن", "ثلا", "أرب", "خمي", "جمع", "سبت"];
  const weekData = days.map(d => sessionLog.filter(s => s.date === d).reduce((a, s) => a + s.dur, 0));
  const maxMin = Math.max(...weekData, 30);
  const initial = (profile?.name || "ط").trim()[0] || "ط";

  const quickActions = [
    { Icon: CalendarDays, label: "جدولي", tab: "schedule", color: P.blue2 },
    { Icon: CheckCircle, label: "مهامي", tab: "home", color: P.green },
    { Icon: Star, label: "المفضلة", tab: "fav", color: P.gold },
    { Icon: Compass, label: "استكشاف", tab: "explore", color: P.purple },
  ];

  return (
    <div style={{ animation: "fadeUp .4s ease" }}>
      {/* Identity hero */}
      <div style={{
        background: t.hero, borderRadius: 22, padding: 24, marginBottom: 16,
        position: "relative", overflow: "hidden",
      }}>
        <div style={{ position: "absolute", top: -50, right: -50, width: 180, height: 180, borderRadius: "50%", background: "rgba(255,255,255,.05)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: -30, left: -20, width: 120, height: 120, borderRadius: "50%", background: `${P.gold}12`, pointerEvents: "none" }} />
        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 66, height: 66, borderRadius: 22, background: `linear-gradient(135deg,${P.gold},#e8bf5c)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: `0 8px 24px ${P.gold}55`, fontSize: 30, fontWeight: 900, color: "#3a2e05",
          }}>
            {profile?.name ? initial : <User size={32} color="#3a2e05" />}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 19, fontWeight: 900, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{profile?.name || "طالب SEU"}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
              {profile?.track && <span style={{ fontSize: 11.5, fontWeight: 800, color: "#3a2e05", background: P.gold, borderRadius: 7, padding: "2px 9px" }}>{profile.track}{profile.plan ? ` — ${profile.plan}` : ""}</span>}
              <span style={{ fontSize: 12, color: "rgba(255,255,255,.7)", display: "flex", alignItems: "center", gap: 5 }}><Clock size={12} color={P.gold} /> {totalHours} ساعة دراسة</span>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button onClick={() => { setDraft({ name: profile?.name || "", track: profile?.track || "" }); setEditing(true); }} title="تعديل الملف" style={{ background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.18)", borderRadius: 12, padding: 9, cursor: "pointer", display: "flex", color: "#fff" }}>
              <Edit3 size={16} />
            </button>
            <button onClick={openSettings} title="الإعدادات" style={{ background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.18)", borderRadius: 12, padding: 9, cursor: "pointer", display: "flex", color: "#fff" }}>
              <Settings size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Setup / edit card (no email, no password) */}
      {editing && (
        <div style={{ background: t.s1, borderRadius: 18, padding: 18, marginBottom: 16, border: `1.5px solid ${P.gold}45`, boxShadow: t.shSm, animation: "fadeUp .3s ease" }}>
          <div style={{ fontSize: 15, fontWeight: 900, color: t.tx, marginBottom: 4 }}>{profile ? "تعديل ملفك الدراسي" : "أنشئ ملفك الدراسي"}</div>
          <div style={{ fontSize: 12, color: t.mu, marginBottom: 14, lineHeight: 1.7 }}>بدون بريد أو كلمة مرور — فقط اسمك ومسارك، ويُحفظ على جهازك.</div>
          <label style={{ fontSize: 12, color: t.mu, fontWeight: 700, display: "block", marginBottom: 6 }}>الاسم</label>
          <input value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} placeholder="اكتب اسمك"
            style={{ width: "100%", border: `1.5px solid ${t.bd}`, borderRadius: 10, padding: "10px 12px", fontSize: 14, background: t.s2, color: t.tx, fontFamily: "inherit", direction: "rtl", outline: "none", boxSizing: "border-box", marginBottom: 14 }} />
          <label style={{ fontSize: 12, color: t.mu, fontWeight: 700, display: "block", marginBottom: 8 }}>المسار / التخصص</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
            {AUTH_TRACKS.map(({ id: tr }) => {
              const active = draft.track === tr;
              return (
                <button key={tr} onClick={() => setDraft(d => ({ ...d, track: tr, plan: "" }))} style={{
                  padding: "8px 14px", borderRadius: 10, cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700,
                  background: active ? `${P.blue2}18` : t.s2, border: `1.5px solid ${active ? P.blue2 : t.bd}`, color: active ? P.blue2 : t.mu,
                }}>{tr}</button>
              );
            })}
          </div>
          {draftPlans && (
            <>
              <label style={{ fontSize: 12, color: t.mu, fontWeight: 700, display: "block", marginBottom: 8 }}>الخطة</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                {draftPlans.map(pl => {
                  const active = draft.plan === pl;
                  return (
                    <button key={pl} onClick={() => setDraft(d => ({ ...d, plan: pl }))} style={{
                      padding: "8px 14px", borderRadius: 10, cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700,
                      background: active ? `${P.purple}18` : t.s2, border: `1.5px solid ${active ? P.purple : t.bd}`, color: active ? P.purple : t.mu,
                    }}>{pl}</button>
                  );
                })}
              </div>
            </>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            {profile && <Btn variant="ghost" size="sm" onClick={() => setEditing(false)} style={{ flex: 1 }}>إلغاء</Btn>}
            <Btn variant="primary" size="sm" onClick={save} style={{ flex: 2 }} disabled={!draft.name.trim()}>
              <CheckCircle size={15} /> {profile ? "حفظ" : "إنشاء الملف"}
            </Btn>
          </div>
        </div>
      )}

      {/* Quick actions dashboard */}
      {!editing && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 16 }}>
          {quickActions.map(({ Icon, label, tab, color }) => (
            <button key={label} onClick={() => setActiveTab(tab)} style={{
              background: t.s1, border: `1px solid ${t.bd}`, borderRadius: 16, padding: "14px 6px",
              cursor: "pointer", textAlign: "center", fontFamily: "inherit", boxShadow: t.shSm, transition: "all .2s",
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = color; e.currentTarget.style.transform = "translateY(-2px)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = t.bd; e.currentTarget.style.transform = "none"; }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: `${color}15`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 7px" }}>
                <Icon size={19} color={color} strokeWidth={2} />
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: t.tx }}>{label}</div>
            </button>
          ))}
        </div>
      )}

      {/* Snapshot stats */}
      {!editing && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 16 }}>
          {[
            { Icon: Flame, label: "سلسلة أيام", value: streak || 0, color: P.orange },
            { Icon: Clock, label: "ساعات الدراسة", value: totalHours, color: P.blue2 },
            { Icon: Star, label: "المفضلة", value: favorites.length, color: P.gold },
          ].map(({ Icon, label, value, color }) => (
            <div key={label} style={{ background: t.s1, borderRadius: 16, padding: "14px 8px", border: `1px solid ${t.bd}`, textAlign: "center", boxShadow: t.shSm }}>
              <Icon size={17} color={color} style={{ marginBottom: 6 }} />
              <div style={{ fontSize: 20, fontWeight: 900, color, lineHeight: 1 }}>{value}</div>
              <div style={{ fontSize: 11, color: t.mu, marginTop: 3 }}>{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* My study plan — shows the subjects of the student's chosen plan */}
      {!editing && profile?.track && (() => {
        const planKey = profile.plan === "خطة ب" ? "b" : profile.plan === "خطة أ" ? "a" : null;
        let subjects = [];
        let heading = profile.track;
        if (profile.track === "تحضيري" && planKey) {
          subjects = TREE.preparatory.plans[planKey]?.subjects || [];
          heading = `التحضيري — ${profile.plan}`;
        }
        return (
          <div style={{ background: t.s1, borderRadius: 18, padding: 16, marginBottom: 16, border: `1.5px solid ${P.blue2}30`, boxShadow: t.shSm }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: t.tx, display: "flex", alignItems: "center", gap: 6 }}>
                <GraduationCap size={15} color={P.blue2} /> خطتي الدراسية
              </div>
              <span style={{ fontSize: 11, fontWeight: 800, color: P.blue2, background: `${P.blue2}14`, borderRadius: 8, padding: "2px 9px" }}>{heading}</span>
            </div>
            {subjects.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {subjects.map((s) => {
                  const SIcon = getIcon(s);
                  return (
                    <button key={s} onClick={() => openCourse(s)} style={{ background: t.s2, border: `1px solid ${t.bd}`, borderRadius: 12, padding: "11px 12px", cursor: "pointer", fontFamily: "inherit", textAlign: "right", display: "flex", alignItems: "center", gap: 10, transition: "all .2s" }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = P.blue2 + "55"}
                      onMouseLeave={e => e.currentTarget.style.borderColor = t.bd}>
                      <div style={{ width: 32, height: 32, borderRadius: 9, background: `${P.blue2}15`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <SIcon size={15} color={P.blue2} />
                      </div>
                      <div style={{ flex: 1, fontSize: 13, fontWeight: 700, color: t.tx }}>{s}</div>
                      <ChevronLeft size={14} color={t.dim} />
                    </button>
                  );
                })}
              </div>
            ) : (
              <button onClick={() => setActiveTab("explore")} style={{ width: "100%", background: t.s2, border: `1px dashed ${t.bd}`, borderRadius: 12, padding: "13px", cursor: "pointer", fontFamily: "inherit", color: t.mu, fontSize: 12.5, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <Compass size={14} color={P.blue2} /> استكشف مواد {profile.track} ومقرراته
              </button>
            )}
          </div>
        );
      })()}

      {/* All my notes in one place */}
      {!editing && (() => {
        const myNotes = Object.entries(notes || {}).filter(([, v]) => (v || "").trim());
        if (myNotes.length === 0) return null;
        return (
          <div style={{ background: t.s1, borderRadius: 18, padding: 16, marginBottom: 16, border: `1px solid ${t.bd}`, boxShadow: t.shSm }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: t.tx, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
              <PenLine size={15} color={P.purple} /> ملاحظاتي <span style={{ fontSize: 12, color: t.mu, fontWeight: 500 }}>({myNotes.length})</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {myNotes.map(([subject, text]) => (
                <button key={subject} onClick={() => openCourse(subject)} style={{
                  background: t.s2, border: `1px solid ${t.bd}`, borderRadius: 12, padding: "11px 12px",
                  cursor: "pointer", fontFamily: "inherit", textAlign: "right", transition: "all .2s",
                }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = P.purple + "55"}
                  onMouseLeave={e => e.currentTarget.style.borderColor = t.bd}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                    <div style={{ width: 7, height: 7, borderRadius: "50%", background: P.purple, flexShrink: 0 }} />
                    <div style={{ fontSize: 13, fontWeight: 800, color: t.tx, flex: 1 }}>{subject}</div>
                    <ChevronLeft size={14} color={t.dim} />
                  </div>
                  <div style={{ fontSize: 12, color: t.mu, lineHeight: 1.6, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{text}</div>
                </button>
              ))}
            </div>
          </div>
        );
      })()}

      {!editing && (
      <div style={{ background: t.s1, borderRadius: 18, padding: 16, marginBottom: 16, border: `1px solid ${t.bd}`, boxShadow: t.shSm }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: t.tx, display: "flex", alignItems: "center", gap: 6 }}>
            <BarChart2 size={16} color={P.blue2} /> دقائق الدراسة هذا الأسبوع
          </div>
          <div style={{ fontSize: 12, color: t.mu }}>{weekData.reduce((a, b) => a + b, 0)}د إجمالي</div>
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 110 }}>
          {weekData.map((v, i) => {
            const h = Math.max(4, (v / maxMin) * 100);
            const dow = new Date(days[i]).getDay();
            const isToday = days[i] === todayKey();
            return (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <div style={{ fontSize: 11, color: t.dim, fontWeight: 600 }}>{v}</div>
                <div style={{
                  width: "100%", height: `${h}%`, borderRadius: 8,
                  background: isToday ? `linear-gradient(180deg,${P.gold},${P.orange})` : `linear-gradient(180deg,${P.blue2},${P.blue})`,
                  transition: "height .8s ease", boxShadow: isToday ? `0 4px 12px ${P.gold}40` : "none", minHeight: 4,
                }} />
                <div style={{ fontSize: 11.5, color: isToday ? P.gold : t.mu, fontWeight: isToday ? 700 : 500 }}>{dayLabels[dow]}</div>
              </div>
            );
          })}
        </div>
      </div>
      )}

      {!editing && recent.length > 0 && (
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

      {!editing && profile && (
        <button onClick={() => { if (confirm("مسح ملفك الشخصي؟ (اسمك ومسارك المحفوظين على هذا الجهاز فقط)")) onLogout?.(); }} style={{
          width: "100%", marginTop: 4, background: `${P.red}0d`, border: `1px solid ${P.red}30`, borderRadius: 12,
          padding: "12px", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700, color: P.red,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        }}>
          <Trash2 size={16} /> مسح ملفي الشخصي
        </button>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   NOTIFICATION BANNER (announcements / warnings, top strip)
   ══════════════════════════════════════════════════════════════ */
function NotifBanner({ notifs, setNotifs, t }) {
  // The most recent unread banner-type broadcast (announcement/warning).
  const item = (notifs || []).find(n => notifMeta(n.type).banner && !n.read);
  if (!item) return null;
  const meta = notifMeta(item.type);
  const Icon = meta.Icon;
  const dismiss = (e) => {
    e.stopPropagation();
    setNotifs(ns => ns.map(x => x.id === item.id ? { ...x, read: true } : x));
  };
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10, padding: "10px 16px",
      background: `linear-gradient(90deg, ${meta.color}22, ${meta.color}0a)`,
      borderBottom: `1px solid ${meta.color}44`, animation: "fadeIn .3s ease",
    }}>
      <div style={{ width: 30, height: 30, borderRadius: 9, background: `${meta.color}22`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon size={15} color={meta.color} />
      </div>
      <div style={{ flex: 1, minWidth: 0, lineHeight: 1.4 }}>
        {item.audienceText && <span style={{ fontSize: 10.5, fontWeight: 800, color: "#3a2e05", background: P.gold, borderRadius: 6, padding: "1px 7px", marginLeft: 6 }}>{item.audienceText}</span>}
        <span style={{ fontSize: 12.5, fontWeight: 800, color: meta.color }}>{item.title}</span>
        <span style={{ fontSize: 12.5, color: t.tx, marginRight: 6 }}>— {item.text}</span>
      </div>
      <button onClick={dismiss} title="إغلاق" style={{ background: "transparent", border: "none", cursor: "pointer", color: t.mu, display: "flex", flexShrink: 0, padding: 2 }}>
        <X size={16} />
      </button>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   NOTIFICATIONS PANEL
   ══════════════════════════════════════════════════════════════ */
// Opt-in card for real device Push notifications (arrive when the app is
// closed). Hidden entirely when the browser can't do push or the server has
// no VAPID keys configured, so it never shows a dead control.
function PushToggle({ t, profile, onToast }) {
  const [state, setState] = useState(null); // {supported, subscribed, permission}
  const [serverOn, setServerOn] = useState(null); // null=checking, bool
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!pushSupported()) { if (alive) { setState({ supported: false }); setServerOn(false); } return; }
      try {
        const res = await fetch("/api/push/subscribe");
        const cfg = res.ok ? await res.json() : { configured: false };
        if (alive) setServerOn(Boolean(cfg.configured));
      } catch { if (alive) setServerOn(false); }
      const st = await pushState();
      if (alive) setState(st);
    })();
    return () => { alive = false; };
  }, []);

  if (state && !state.supported) return null;
  if (serverOn === false) return null;
  if (!state || serverOn === null) return null; // still checking — stay quiet

  const on = state.subscribed && state.permission === "granted";
  const toggle = async () => {
    setBusy(true);
    if (on) {
      await disablePush();
      setState(s => ({ ...s, subscribed: false }));
      onToast?.("أُوقفت إشعارات الجهاز", "info");
    } else {
      const r = await enablePush(profile);
      if (r.ok) { setState(s => ({ ...s, subscribed: true, permission: "granted" })); onToast?.("تم تفعيل إشعارات الجهاز 🔔", "success"); }
      else if (r.reason === "denied") onToast?.("لم يُمنح إذن الإشعارات من المتصفح", "warn");
      else onToast?.("تعذّر تفعيل الإشعارات", "warn");
    }
    setBusy(false);
  };

  return (
    <button onClick={toggle} disabled={busy} style={{
      width: "100%", display: "flex", alignItems: "center", gap: 11, textAlign: "right",
      background: on ? `${P.green}12` : t.s2, border: `1px solid ${on ? P.green + "45" : t.bd}`,
      borderRadius: 14, padding: "12px 14px", marginBottom: 14, cursor: "pointer", fontFamily: "inherit", opacity: busy ? 0.6 : 1,
    }}>
      <div style={{ width: 38, height: 38, borderRadius: 10, background: on ? `${P.green}20` : `${P.gold}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Bell size={17} color={on ? P.green : P.gold} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 800, color: t.tx }}>إشعارات الجهاز</div>
        <div style={{ fontSize: 11.5, color: t.mu, lineHeight: 1.5 }}>{on ? "مفعّلة — تصلك حتى والتطبيق مغلق" : "فعّلها لتصلك إعلانات حلول حتى والتطبيق مغلق"}</div>
      </div>
      <div style={{ width: 44, height: 25, borderRadius: 20, background: on ? P.green : t.bd, position: "relative", flexShrink: 0, transition: "background .2s" }}>
        <div style={{ width: 19, height: 19, borderRadius: "50%", background: "#fff", position: "absolute", top: 3, right: on ? 3 : 22, transition: "right .2s", boxShadow: "0 1px 3px rgba(0,0,0,.3)" }} />
      </div>
    </button>
  );
}

function NotifPanel({ t, onClose, notifs, setNotifs, profile, onToast }) {
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
              cursor: "pointer", fontSize: 12, color: t.mu, fontFamily: "inherit",
            }}>قراءة الكل</button>
            <button onClick={onClose} style={{
              background: t.s2, border: "none", borderRadius: 10, padding: 6,
              cursor: "pointer", display: "flex", color: t.mu,
            }}><X size={16} /></button>
          </div>
        </div>
        <PushToggle t={t} profile={profile} onToast={onToast} />
        {notifs.length === 0 && (
          <div style={{ textAlign: "center", padding: "30px 0", color: t.mu, fontSize: 13 }}>لا توجد إشعارات بعد</div>
        )}
        {notifs.map(n => {
          const meta = notifMeta(n.type);
          const NIcon = meta.Icon;
          return (
          <div key={n.id} onClick={() => setNotifs(ns => ns.map(x => x.id === n.id ? { ...x, read: true } : x))} style={{
            display: "flex", gap: 12, padding: "12px", borderRadius: 14, marginBottom: 8, cursor: "pointer",
            background: n.read ? t.s1 : t.s2, border: `1px solid ${n.read ? t.bd : meta.color + "40"}`,
            borderRight: `3px solid ${meta.color}`, transition: "all .2s",
          }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: `${meta.color}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <NIcon size={16} color={meta.color} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2, flexWrap: "wrap" }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: meta.color, background: `${meta.color}18`, borderRadius: 6, padding: "1px 7px" }}>{meta.label}</span>
                {n.audienceText && <span style={{ fontSize: 10.5, fontWeight: 700, color: P.gold, background: `${P.gold}18`, borderRadius: 6, padding: "1px 7px" }}>{n.audienceText}</span>}
                {!n.read && <span style={{ width: 7, height: 7, borderRadius: "50%", background: meta.color, display: "inline-block" }} />}
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: t.tx }}>{n.title}</div>
              <div style={{ fontSize: 13, color: t.mu, marginTop: 2, lineHeight: 1.5 }}>{n.text}</div>
              <div style={{ fontSize: 11.5, color: t.dim, marginTop: 4 }}>{n.time}</div>
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
        {desc && <div style={{ fontSize: 12, color: t.mu, marginTop: 2 }}>{desc}</div>}
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
                <div style={{ fontSize: 12, color: t.mu, marginTop: 2 }}>{weeklyGoal} جلسة بومودورو/أسبوع</div>
              </div>
            </div>
            <input type="range" min={3} max={50} value={weeklyGoal}
              onChange={e => setWeeklyGoal(+e.target.value)}
              style={{ width: "100%", accentColor: P.orange }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: t.dim, marginTop: 4 }}>
              <span>3</span><span>50</span>
            </div>
          </div>

          <div style={{ height: 1, background: t.bd, margin: "16px 0" }} />

          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 4px", marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: t.tx }}>حول التطبيق</div>
              <div style={{ fontSize: 12, color: t.mu, marginTop: 2 }}>حلول SEU • الإصدار 2.0</div>
            </div>
            <div style={{ background: `${P.blue2}15`, borderRadius: 8, padding: "3px 8px", fontSize: 11.5, color: P.blue2, fontWeight: 700 }}>PRO</div>
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
      { Icon: BookOpen, label: "تجميعات وملخصات" },
      { Icon: FileText, label: "خطط ومقررات" },
      { Icon: Sparkles, label: "مساعد ذكي" },
    ];
    return (
      <div style={{
        position: "fixed", inset: 0, zIndex: 400,
        background: "linear-gradient(160deg, #04120c 0%, #063a27 40%, #0a5c3a 70%, #05130d 100%)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        padding: 28, animation: "fadeIn .4s ease", overflow: "hidden",
      }}>
        {/* Background orbs */}
        <div style={{ position: "absolute", top: "10%", right: "15%", width: 260, height: 260, borderRadius: "50%", background: "radial-gradient(circle, rgba(10,138,88,.18) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: "15%", left: "10%", width: 200, height: 200, borderRadius: "50%", background: "radial-gradient(circle, rgba(200,168,75,.10) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: "55%", right: "5%", width: 140, height: 140, borderRadius: "50%", background: "radial-gradient(circle, rgba(52,211,153,.08) 0%, transparent 70%)", pointerEvents: "none" }} />

        {/* Logo */}
        <div style={{
          width: 96, height: 96, borderRadius: 28,
          background: "linear-gradient(135deg, #0a3d29, #0a8a58)",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 16px 60px rgba(10,138,88,.55), 0 4px 20px rgba(0,0,0,.5)",
          marginBottom: 24, animation: "scaleIn .6s ease",
          border: "1.5px solid rgba(255,255,255,.12)",
        }}>
          <GraduationCap size={50} color={P.gold} strokeWidth={1.6} />
        </div>

        <div style={{
          fontSize: 58, fontWeight: 900, color: "#fff", lineHeight: 1,
          marginBottom: 8, animation: "fadeUp .7s ease .1s backwards",
          letterSpacing: -1, textShadow: "0 4px 30px rgba(10,138,88,.6)",
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
          fontSize: 13, color: "rgba(255,255,255,.5)", marginBottom: 48,
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
              <span style={{ fontSize: 13, color: "rgba(255,255,255,.8)", fontWeight: 600 }}>{label}</span>
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
          color: t.dim, fontSize: 13, cursor: "pointer", marginTop: 14,
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
// Icons an admin can pick for a link (JSON stores the name; we map it here).
const LINK_ICONS = {
  Monitor, GraduationCap, Building2, Globe, BookOpen, Mail, CheckCircle,
  Calendar, CreditCard, FileText, Award, Phone, HelpCircle, Radio,
  Newspaper, Link2, Shield, Star, Bell,
  WhatsApp: MessageCircle, Telegram: Send, Twitter, Instagram, Youtube,
  Snapchat: Ghost, Group: Users,
};
const LINK_ICON_NAMES = Object.keys(LINK_ICONS);

// Auto-detect a link's platform from its URL, so WhatsApp/Telegram/social/site
// links get the right branded icon & colour without the admin picking one.
function detectPlatform(url) {
  const u = String(url || "").toLowerCase().trim();
  if (!u) return null;
  if (/wa\.me|whatsapp/.test(u)) return { Icon: MessageCircle, color: "#25D366" };
  if (/t\.me|telegram/.test(u)) return { Icon: Send, color: "#229ED9" };
  if (/twitter\.com|(^|\/\/)(x\.com)/.test(u)) return { Icon: Twitter, color: "#1d9bf0" };
  if (/instagram\.com|instagr\.am/.test(u)) return { Icon: Instagram, color: "#E4405F" };
  if (/youtube\.com|youtu\.be/.test(u)) return { Icon: Youtube, color: "#FF0000" };
  if (/snapchat\.com/.test(u)) return { Icon: Ghost, color: "#e6b800" };
  if (/^tel:/.test(u)) return { Icon: Phone, color: "#059669" };
  if (/^mailto:/.test(u)) return { Icon: Mail, color: "#0369a1" };
  return null;
}

// Default Links-page content. Admin edits override this via site_content.
const DEFAULT_LINKS = {
  header: {
    title: "روابط الجامعة السعودية الإلكترونية",
    subtitle: "Saudi Electronic University — SEU",
    note: "جميع الروابط تفتح الموقع الرسمي — تأكد من تسجيل دخولك بالحساب الجامعي",
  },
  quick: { phone: "011-2613500", hours: "8 ص – 8 م", days: "الأحد – الخميس" },
  groups: [
    { group: "البوابات الأساسية", color: P.blue2, items: [
      { label: "نظام التعلم الإلكتروني (Blackboard)", desc: "المقررات والواجبات والدرجات", url: "https://lms.seu.edu.sa", icon: "Monitor", color: "#1d4ed8" },
      { label: "بوابة الطالب (ERP Gate)", desc: "الجداول والسجلات والخدمات الأكاديمية", url: "https://erpgate.seu.edu.sa", icon: "GraduationCap", color: "#6d28d9" },
      { label: "تسجيل الدخول الموحد (SSO)", desc: "الدخول لجميع أنظمة الجامعة", url: "https://sso.seu.edu.sa/SEUSSO/pages/login.jsp", icon: "Building2", color: "#065f46" },
      { label: "الموقع الرسمي للجامعة", desc: "الأخبار والإعلانات الرسمية", url: "https://www.seu.edu.sa", icon: "Globe", color: "#0369a1" },
    ]},
    { group: "الخدمات الأكاديمية", color: P.purple, items: [
      { label: "المكتبة الرقمية السعودية (SDL)", desc: "الكتب والمراجع والأبحاث الأكاديمية", url: "https://sdl.edu.sa/SDLPortal/ar/login.aspx", icon: "BookOpen", color: "#be123c" },
      { label: "البريد الإلكتروني الجامعي", desc: "بريد @seu.edu.sa عبر Office 365", url: "https://sso.seu.edu.sa/SEUOffice365SSO/pages/login.jsp", icon: "Mail", color: "#0369a1" },
      { label: "بوابة القبول والتسجيل", desc: "التسجيل وقبول الطلاب الجدد", url: "https://admission.seu.edu.sa", icon: "CheckCircle", color: "#0891b2" },
      { label: "التقويم الأكاديمي", desc: "مواعيد الفصول والاختبارات والتسجيل", url: "https://www.seu.edu.sa/en/academic-calendar/1448/", icon: "Calendar", color: "#d97706" },
    ]},
    { group: "الخدمات المالية والإدارية", color: P.green, items: [
      { label: "الرسوم الدراسية والدفع", desc: "سداد الرسوم وعرض الكشوف", url: "https://erpgate.seu.edu.sa", icon: "CreditCard", color: "#059669" },
      { label: "خدمات وحدة التسجيل", desc: "إضافة/حذف/اعتراض على المقررات", url: "https://www.seu.edu.sa/aasa/ar/registeration/", icon: "FileText", color: "#c8a84b" },
      { label: "الكلية التطبيقية", desc: "بوابة طلاب الكلية التطبيقية", url: "https://ac.seu.edu.sa/ar/login", icon: "Award", color: "#92400e" },
    ]},
    { group: "الدعم والتواصل", color: "#be123c", items: [
      { label: "مركز الدعم الفني", desc: "هاتف: 011-2613500", url: "tel:0112613500", icon: "Phone", color: "#be123c" },
      { label: "الأسئلة الشائعة (FAQ)", desc: "إجابات على أبرز الاستفسارات", url: "https://www.seu.edu.sa/ar/faqs/", icon: "HelpCircle", color: "#ea580c" },
      { label: "حساب الجامعة في X", desc: "@Saudi_EUni", url: "https://x.com/Saudi_EUni", icon: "Radio", color: "#1d4ed8" },
      { label: "تطبيق SEU على المتجر", desc: "تحميل تطبيق الجوال الرسمي", url: "https://play.google.com/store/apps/details?id=com.seu.services", icon: "Newspaper", color: "#065f46" },
    ]},
  ],
  footer: "هذه الروابط تأخذك للمواقع الرسمية للجامعة السعودية الإلكترونية. لا تشارك كلمة مرورك مع أي طرف آخر.",
};

function SEULinksPage({ t, content }) {
  const C = content || DEFAULT_LINKS;
  const header = C.header || DEFAULT_LINKS.header;
  const quick = C.quick || DEFAULT_LINKS.quick;
  const groups = Array.isArray(C.groups) ? C.groups : DEFAULT_LINKS.groups;
  const footer = C.footer || DEFAULT_LINKS.footer;

  const openLink = (url) => {
    let u = String(url || "").trim();
    if (!u) return;
    // Admin may enter a bare domain (no scheme); make it absolute so it opens
    // the real site instead of a relative path on our own domain.
    if (!/^(https?:|tel:|mailto:)/i.test(u)) u = "https://" + u.replace(/^\/+/, "");
    window.open(u, "_blank", "noopener,noreferrer");
  };

  return (
    <div style={{ animation: "fadeUp .4s ease" }}>
      {/* Header */}
      <div style={{
        background: `linear-gradient(135deg, #04130d 0%, #0a3d29 45%, #0e5638 100%)`,
        borderRadius: 22, padding: "22px 20px", marginBottom: 20,
        position: "relative", overflow: "hidden",
      }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 160, height: 160, borderRadius: "50%", background: "rgba(255,255,255,.03)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: -20, left: -10, width: 100, height: 100, borderRadius: "50%", background: `${P.gold}10`, pointerEvents: "none" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 14, position: "relative" }}>
          <div style={{
            width: 52, height: 52, borderRadius: 16,
            background: "linear-gradient(135deg,#043d2a,#066b45)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: `0 6px 20px ${P.blue}50`,
          }}>
            <GraduationCap size={24} color="#fff" />
          </div>
          <div>
            <div style={{ color: "#fff", fontSize: 18, fontWeight: 900, lineHeight: 1.2 }}>{header.title}</div>
            <div style={{ color: P.gold, fontSize: 12, marginTop: 4 }}>{header.subtitle}</div>
          </div>
        </div>
        <div style={{
          marginTop: 16, background: "rgba(255,255,255,.07)", borderRadius: 12,
          padding: "10px 14px", display: "flex", alignItems: "center", gap: 10,
        }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#4ade80", boxShadow: "0 0 8px #4ade80", flexShrink: 0 }} />
          <div style={{ color: "rgba(255,255,255,.8)", fontSize: 13, lineHeight: 1.6 }}>
            {header.note}
          </div>
        </div>
      </div>

      {/* Quick access numbers */}
      <div style={{
        background: t.s1, borderRadius: 16, padding: 14, marginBottom: 16,
        border: `1px solid ${t.bd}`, display: "flex", gap: 10,
      }}>
        <div style={{ flex: 1, textAlign: "center" }}>
          <div style={{ fontSize: 12, color: t.mu, marginBottom: 2 }}>الدعم الفني</div>
          <div style={{ fontSize: 16, fontWeight: 900, color: P.blue2, direction: "ltr" }}>{quick.phone}</div>
        </div>
        <div style={{ width: 1, background: t.bd }} />
        <div style={{ flex: 1, textAlign: "center" }}>
          <div style={{ fontSize: 12, color: t.mu, marginBottom: 2 }}>ساعات الدعم</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: t.tx }}>{quick.hours}</div>
        </div>
        <div style={{ width: 1, background: t.bd }} />
        <div style={{ flex: 1, textAlign: "center" }}>
          <div style={{ fontSize: 12, color: t.mu, marginBottom: 2 }}>أيام العمل</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: t.tx }}>{quick.days}</div>
        </div>
      </div>

      {/* Link groups */}
      {groups.map((group, gi) => (
        <div key={gi} style={{ marginBottom: 18 }}>
          <div style={{
            fontSize: 13, fontWeight: 800, color: group.color,
            marginBottom: 10, paddingRight: 4,
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <div style={{ width: 3, height: 14, borderRadius: 2, background: group.color }} />
            {group.group}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {(group.items || []).map((item, ii) => {
              // Auto-branded icon/colour for known platforms; else the admin's choice.
              const det = detectPlatform(item.url);
              const ItemIcon = det?.Icon || LINK_ICONS[item.icon] || Link2;
              const col = det?.color || item.color || P.blue2;
              return (
              <button key={ii} onClick={() => openLink(item.url)}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "13px 14px", background: t.s1, borderRadius: 14,
                  border: `1px solid ${t.bd}`, cursor: "pointer", width: "100%",
                  textAlign: "right", fontFamily: "inherit",
                  transition: "all .2s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = col + "60"; e.currentTarget.style.background = col + "08"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = t.bd; e.currentTarget.style.background = t.s1; }}
              >
                <div style={{
                  width: 42, height: 42, borderRadius: 12, flexShrink: 0,
                  background: col + "18",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <ItemIcon size={18} color={col} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: t.tx, marginBottom: 2 }}>{item.label}</div>
                  <div style={{ fontSize: 12, color: t.mu }}>{item.desc}</div>
                </div>
                <ExternalLink size={14} color={t.dim} style={{ flexShrink: 0 }} />
              </button>
              );
            })}
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
        <div style={{ fontSize: 13, color: t.mu, lineHeight: 1.7 }}>
          {footer}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN APP
   ══════════════════════════════════════════════════════════════ */
const AUTH_TRACKS = [
  { id: "تحضيري", Icon: BookOpen, desc: "السنة الأولى المشتركة" },
  { id: "تخصص", Icon: GradCap, desc: "بكالوريوس التخصص" },
  { id: "دبلوم", Icon: Award, desc: "برامج الدبلوم" },
  { id: "دراسات عليا", Icon: Trophy, desc: "ماجستير ودراسات عليا" },
];
const AUTH_PLANS = { "تحضيري": ["خطة أ", "خطة ب"] };

// Fires a reminder 5 minutes before any lecture on the current day (while the
// app is open): in-app toast + sound + a browser notification if permitted.
function useLectureReminders(schedule, soundOn, push) {
  const firedRef = useRef(null);
  if (firedRef.current === null) firedRef.current = new Set();
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const today = WEEK_ORDER[now.getDay()];
      const nowMin = now.getHours() * 60 + now.getMinutes();
      const dateKey = now.toISOString().slice(0, 10);
      (schedule || []).forEach(lec => {
        if (lec.day !== today || !lec.time || lec.remind === false) return;
        const [h, m] = String(lec.time).split(":").map(Number);
        if (isNaN(h)) return;
        const diff = (h * 60 + m) - nowMin;
        const key = `${lec.id}_${dateKey}`;
        if (diff > 0 && diff <= 5 && !firedRef.current.has(key)) {
          firedRef.current.add(key);
          const where = lec.mode === "أونلاين" ? "أونلاين" : (lec.room || "");
          const body = `${lec.course} تبدأ خلال ${diff} دقيقة${where ? " • " + where : ""}`;
          push?.(`⏰ ${body}`, "warn");
          if (soundOn) playBell();
          try {
            if (typeof Notification !== "undefined" && Notification.permission === "granted") {
              new Notification("تذكير محاضرة — حلول", { body, icon: "/icons/icon-192.png", tag: key });
            }
          } catch {}
        }
      });
    };
    tick();
    const iv = setInterval(tick, 30000);
    return () => clearInterval(iv);
  }, [schedule, soundOn, push]);
}

export default function App() {
  // Settings sync to the user's profile when logged in (cross-device);
  // localStorage stays the instant source of truth for everyone.
  // New brand identity opens light (white + green); users can switch to the
  // deep-green dark mode from the moon toggle at any time.
  const [dark, setDark] = useSyncedSetting("dark", "dark_mode", false);
  const [tab, setTab] = useState("home");
  const [course, setCourse] = useState(null);
  // Favorites + notes sync per-user across devices (name-keyed tables),
  // falling back to localStorage when logged out.
  const [favorites, setFavorites] = useSyncedFavorites();
  // Live notifications: broadcasts sent from the admin panel + the user's
  // own, straight from Supabase (replaces the old localStorage mock).
  const [notifs, setNotifs] = useLiveNotifications();
  const [notes, setNotes] = useSyncedNotes();
  // Admin-editable Links page content (falls back to DEFAULT_LINKS).
  const { data: linksContent } = useSiteContent("links");
  const { data: themeContent } = useSiteContent("theme");
  const brandPreset = getPreset(themeContent?.preset);
  applyBrand(brandPreset); // recolour P for this render
  // Fully public site — no login/registration. `profile` is an OPTIONAL local
  // preference (name + track + plan) that only personalises the greeting and
  // the plan-scoped calendar; everything works with or without it.
  const [profile, setProfile] = useStored("student_profile", null);
  const [recent, setRecent] = useStored("recent", []);
  const [totalSessions, setTotalSessions] = useStored("totalSessions", 0);
  const [sessionLog, setSessionLog] = useStored("sessionLog", []);
  const [gpaCalcs, setGpaCalcs] = useStored("gpaCalcs", 0);
  const [aiChats, setAiChats] = useStored("aiChats", 0);
  const [semesters, setSemesters] = useStored("semesters", []);
  const [soundOn, setSoundOn] = useSyncedSetting("soundOn", "sound_on", true);
  const [weeklyGoal, setWeeklyGoal] = useSyncedSetting("weeklyGoal", "weekly_goal", 15);
  const [seen, setSeen] = useSyncedSetting("onboarded", "onboarded", false);
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
  const t = T(dark, brandPreset);
  const toasts = useToasts();
  useLectureReminders(schedule, soundOn, toasts.push);
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

  // Register the push service worker once so opted-in devices can receive
  // broadcasts while the app is closed. No-ops on unsupported browsers.
  useEffect(() => { registerServiceWorker(); }, []);

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

  // Public site: every feature is open to everyone, no account required.
  const requestAI = () => setShowAI(true);

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

  // After the welcome, land straight on the (public) site — no gate.
  const finishOnboard = () => { setSeen(true); setShowOnboard(false); };

  const achievementsState = { viewed: recent, favorites, totalSessions, gpaCalcs, streak, notes, aiChats };

  const TABS = [
    { id: "home", Icon: Home, label: "الرئيسية" },
    { id: "explore", Icon: Compass, label: "المسارات" },
    { id: "schedule", Icon: CalendarDays, label: "جدولي" },
    { id: "fav", Icon: Star, label: "المفضلة" },
    { id: "links", Icon: Link2, label: "روابط SEU" },
    { id: "profile", Icon: CircleUser, label: "حسابي" },
  ];

  return (
    <div dir="rtl" style={{
      fontFamily: "'Tajawal','Cairo',sans-serif", minHeight: "100vh",
      background: t.bgMesh, color: t.tx, paddingBottom: 80,
      transition: "background .3s ease, color .3s ease",
    }}>
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(18px) } to { opacity:1; transform:translateY(0) } }
        @keyframes fadeIn { from { opacity:0 } to { opacity:1 } }
        @keyframes slideUp { from { transform:translateY(100%) } to { transform:translateY(0) } }
        @keyframes scaleIn { from { opacity:0; transform:scale(.92) } to { opacity:1; transform:scale(1) } }
        @keyframes bounce { 0%,80%,100% { transform:translateY(0) } 40% { transform:translateY(-7px) } }
        @keyframes pulse { 0%,100% { opacity:.5 } 50% { opacity:.85 } }
        @keyframes toastIn { from { opacity:0; transform:translateY(20px) } to { opacity:1; transform:translateY(0) } }
        @keyframes splashBar { from { width:0% } to { width:100% } }
        @keyframes floatOrb { 0%,100% { transform:translateY(0) } 50% { transform:translateY(-12px) } }
        html { -webkit-text-size-adjust:100%; text-size-adjust:100%; -moz-text-size-adjust:100% }
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
        background: dark ? "rgba(8,19,13,.93)" : "rgba(238,245,240,.93)",
        backdropFilter: "blur(20px)", borderBottom: `1px solid ${t.bd}`,
        padding: "13px 16px", display: "flex", alignItems: "center", gap: 10,
        boxShadow: dark ? "0 1px 24px rgba(0,0,0,.45)" : "0 1px 16px rgba(0,80,45,.07)",
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
          <div style={{ fontSize: 11.5, color: t.mu }}>SEU • الجامعة السعودية الإلكترونية</div>
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
            fontSize: 11, fontWeight: 900, color: "#fff",
          }}>{unread}</span>}
        </button>
      </div>

      {/* Announcement / warning banner strip */}
      <NotifBanner notifs={notifs} setNotifs={setNotifs} t={t} />

      {/* MAIN */}
      <div style={{ maxWidth: 620, margin: "0 auto", padding: "18px 16px" }}>
        {tab === "home" && <HomePage
          setActiveTab={(id) => { setTab(id); setCourse(null); }}
          openCourse={openCourse} onOpenAI={requestAI} t={t} recent={recent} streak={streak}
          activeDays={activeDays} weeklyGoal={weeklyGoal} weekProgress={weekProgress}
          achievements={achievementsState} sessionLog={sessionLog} semesters={semesters}
          schedule={schedule} tasks={tasks} setTasks={setTasks} onToast={toasts.push}
          exams={exams} setExams={setExams} xp={xp} setXp={setXp} profile={profile}
          guest={false}
          onShowFocus={() => setShowFocus(true)} onShowReport={() => setShowMonthlyReport(true)} />}

        {tab === "explore" && !course && <ExplorePage onCourse={openCourse} t={t} profile={profile} />}

        {tab === "schedule" && <SchedulePage t={t} schedule={schedule} setSchedule={setSchedule} onToast={toasts.push} />}

        {tab === "course" && course && <CoursePage
          subject={course} favorites={favorites} toggleFav={toggleFav}
          notes={notes} setNotes={setNotes} t={t}
          onChat={() => setAiChats(c => c + 1)} onToast={toasts.push}
          onAskAI={(subj) => { setAiSubject(subj); setAiGlobalTab("chat"); setShowAI(true); }}
          onBack={() => { setCourse(null); setTab("explore"); }} />}

        {tab === "fav" && <FavoritesPage favorites={favorites} onCourse={openCourse} toggleFav={toggleFav} t={t} />}

        {tab === "links" && <SEULinksPage t={t} content={linksContent} />}

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

        {tab === "profile" && <ProfilePage
          t={t} achievements={achievementsState} recent={recent}
          favorites={favorites} totalSessions={totalSessions}
          sessionLog={sessionLog} streak={streak} profile={profile} setProfile={setProfile}
          setActiveTab={(id) => { setTab(id); setCourse(null); }} onToast={toasts.push}
          onLogout={() => { setProfile(null); toasts.push("تم مسح ملفك الشخصي", "info"); }}
          notes={notes} openCourse={openCourse} openSettings={() => setSettingsOpen(true)} />}
      </div>

      {/* Floating AI assistant button — reachable from any main tab */}
      {!showAI && !showFocus && !settingsOpen && !searchOpen && !notifOpen && !showMonthlyReport && !course && (
        <button onClick={requestAI} title="المساعد الذكي" aria-label="المساعد الذكي" style={{
          position: "fixed", bottom: 82, left: 16, zIndex: 90,
          width: 56, height: 56, borderRadius: "50%", border: "none", cursor: "pointer",
          background: `linear-gradient(135deg,${P.navy},${P.blue2})`,
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: `0 8px 24px ${P.blue}66, 0 2px 8px rgba(0,0,0,.3)`,
          animation: "floatOrb 3s ease-in-out infinite",
        }}>
          <Sparkles size={24} color={P.gold} />
          <span style={{ position: "absolute", top: 2, right: 2, width: 12, height: 12, borderRadius: "50%", background: "#4ade80", border: `2px solid ${P.navy}`, boxShadow: "0 0 6px #4ade80" }} />
        </button>
      )}

      {/* BOTTOM NAV */}
      <div id="bottom-nav" style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 100,
        background: dark ? "rgba(8,19,13,.96)" : "rgba(255,255,255,.96)",
        backdropFilter: "blur(24px)", borderTop: `1px solid ${t.bd}`,
        overflowX: "auto", WebkitOverflowScrolling: "touch",
        scrollbarWidth: "none", padding: "6px 8px 14px",
        boxShadow: dark ? "0 -1px 20px rgba(0,0,0,.5)" : "0 -1px 16px rgba(0,80,45,.08)",
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
                {badge > 0 && <span style={{ position: "absolute", top: -3, right: -3, width: 14, height: 14, borderRadius: "50%", background: P.red, color: "#fff", fontSize: 10, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center" }}>{badge}</span>}
              </div>
              <span style={{ fontSize: 11.5, fontWeight: active ? 800 : 500, color: active ? P.blue2 : t.dim, whiteSpace: "nowrap" }}>{label}</span>
            </button>
          );
        })}
        </div>
      </div>

      {/* PANELS / MODALS */}
      {notifOpen && <NotifPanel t={t} onClose={() => setNotifOpen(false)} notifs={notifs} setNotifs={setNotifs} profile={profile} onToast={toasts.push} />}
      {settingsOpen && <SettingsPanel t={t} onClose={() => setSettingsOpen(false)}
        dark={dark} setDark={setDark} soundOn={soundOn} setSoundOn={setSoundOn}
        weeklyGoal={weeklyGoal} setWeeklyGoal={setWeeklyGoal}
        onReset={resetAll} onToast={toasts.push} />}
      {searchOpen && <SearchOverlay t={t} onClose={() => { setSearchOpen(false); setSearchQuery(""); }}
        query={searchQuery} setQuery={setSearchQuery} onCourse={openCourse}
        onNavigate={(id) => { setTab(id); setCourse(null); }} />}
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
                <div style={{ fontSize: 12, color: "#4ade80", display: "flex", alignItems: "center", gap: 4, marginTop: 1 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ade80", boxShadow: "0 0 6px #4ade80", display: "inline-block" }} />
                  متصل — يجيب بالعربية
                </div>
              </div>
              <button onClick={clearGlobalAI} style={{ background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.2)", borderRadius: 8, padding: "5px 12px", fontSize: 12, color: "rgba(255,255,255,.8)", cursor: "pointer", fontFamily: "inherit", fontWeight: 600, flexShrink: 0 }}>مسح</button>
            </div>
            {/* Subject Selector + Tab Toggle */}
            <div style={{ padding: "6px 16px 10px", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,.08)", borderRadius: 6, padding: "3px 10px", flexShrink: 0 }}>
                <Book size={12} color="rgba(255,255,255,.7)" />
                <span style={{ fontSize: 12, color: "rgba(255,255,255,.7)", fontWeight: 600, whiteSpace: "nowrap" }}>المادة</span>
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
                  <option value="عام" style={{ background: "#0a3d29", color: "#fff" }}>🌐 عام — مساعد SEU</option>
                  {ALL_COURSES.map(c => <option key={c} value={c} style={{ background: "#0a3d29", color: "#fff" }}>{c}</option>)}
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
// Navigable destinations (pages/tools) so search finds "anything", not just
// subjects. Each has keywords to match loosely.
const SEARCH_PAGES = [
  { tab: "explore", label: "المسارات والتخصصات", Icon: Compass, color: "#0a8a58", kw: "مسار تخصص استكشاف كليات برامج تجميعات ملخصات خطط مقررات" },
  { tab: "schedule", label: "جدولي الأسبوعي", Icon: CalendarDays, color: "#0891b2", kw: "جدول محاضرات حصص مواعيد" },
  { tab: "gpa", label: "حاسبة المعدل", Icon: Calculator, color: "#2563eb", kw: "حساب معدل درجات gpa تراكمي فصلي" },
  { tab: "fav", label: "المفضلة", Icon: Star, color: "#c8a84b", kw: "مفضلة محفوظات نجمة" },
  { tab: "links", label: "روابط الجامعة", Icon: Link2, color: "#0891b2", kw: "روابط بلاك بورد بوابة sso بريد مكتبة رابط" },
  { tab: "profile", label: "حسابي", Icon: CircleUser, color: "#6d28d9", kw: "حساب ملف اعدادات بروفايل خطة تخصص" },
];

function SearchOverlay({ query, setQuery, onCourse, onClose, t, onNavigate }) {
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
              placeholder="ابحث عن أي شيء — مادة، تخصص، صفحة، أداة..."
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
              cursor: "pointer", fontSize: 12, color: t.mu, fontFamily: "inherit",
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
                <div style={{ fontSize: 12, color: t.dim }}>أكثر من {ALL_COURSES.length} مادة وتخصص</div>
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
              // Pages/tools that match the query (label or keywords).
              const pageHits = onNavigate ? SEARCH_PAGES.filter(p => p.label.toLowerCase().includes(q) || p.kw.includes(q)) : [];
              const total = groups.reduce((a, g) => a + g.items.length, 0) + pageHits.length;
              if (!total) return (
                <div style={{ textAlign: "center", padding: 30, color: t.mu, fontSize: 13 }}>
                  لا توجد نتائج لـ «{query}»
                </div>
              );
              return (
                <>
                  <div style={{ fontSize: 12, color: t.mu, marginBottom: 10, padding: "0 4px" }}>{total} نتيجة</div>
                  {pageHits.length > 0 && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 11.5, fontWeight: 800, color: t.mu, marginBottom: 5, display: "flex", alignItems: "center", gap: 4 }}>
                        <div style={{ width: 3, height: 10, borderRadius: 2, background: t.mu }} /> صفحات وأدوات
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                        {pageHits.map((p, i) => (
                          <button key={i} onClick={() => { onNavigate(p.tab); onClose(); }} style={{
                            background: t.s2, border: `1px solid ${t.bd}`, borderRadius: 11, padding: "10px 12px", cursor: "pointer",
                            display: "flex", alignItems: "center", gap: 10, fontFamily: "inherit", textAlign: "right",
                          }}>
                            <div style={{ width: 32, height: 32, borderRadius: 9, background: `${p.color}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <p.Icon size={15} color={p.color} />
                            </div>
                            <div style={{ flex: 1, fontSize: 13, fontWeight: 700, color: t.tx }}>{p.label}</div>
                            <ChevronLeft size={13} color={t.dim} />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {groups.map((g, gi) => (
                    <div key={gi} style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 11.5, fontWeight: 800, color: g.color, marginBottom: 5, display: "flex", alignItems: "center", gap: 4 }}>
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
