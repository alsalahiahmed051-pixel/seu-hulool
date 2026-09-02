'use client'
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { CATALOGUE } from "@/lib/courses";
import { useLiveNotifications } from "@/lib/hooks/useLiveNotifications";
import { useSyncedSetting } from "@/lib/hooks/useSyncedSetting";
import { useAccount } from "@/lib/hooks/useAccount";
import { browseGate } from "@/lib/auth-config";
import { useSyncedFavorites } from "@/lib/hooks/useSyncedFavorites";
import { useSyncedNotes } from "@/lib/hooks/useSyncedNotes";
import { useSiteContent } from "@/lib/hooks/useSiteContent";
import { pushSupported, pushState, enablePush, disablePush, registerServiceWorker } from "@/lib/push-client";
import {
  Home, Search, Star, Calculator, Bell, Moon, Sun, ChevronRight,
  Image as ImageIcon,
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
  List, LayoutGrid, MapPin, Upload,
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
  // `ready` is state, not a ref, on purpose. A ref flipped by the reader
  // effect is already true when the writer effect runs later in the SAME
  // commit — where `val` is still `initial` — so the writer would stamp the
  // empty value over the saved one, and only put it back on the next render.
  // Batching both setState calls means the writer's first run already sees
  // the hydrated value, and storage is never briefly wrong.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setVal(storage.get(key, initial));
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => { if (ready) storage.set(key, val); }, [ready, key, val]);
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

// Names come from the shared catalogue; only the icons and colours are local.
// Keeping the names in one module is what stops the admin panel and the site
// from drifting apart again — see src/lib/courses.js.
const TREE = {
  preparatory: {
    label: CATALOGUE.preparatory.label, icon: GraduationCap, color: P.blue2,
    plans: CATALOGUE.preparatory.plans,
  },
  bachelor: {
    label: CATALOGUE.bachelor.label, icon: Award, color: P.purple,
    colleges: CATALOGUE.bachelor.colleges.map(c => ({
      ...c,
      icon: { admin: Briefcase, theory: BookOpen, health: Heart, cs: Code, applied: Layers }[c.id] || BookOpen,
      color: { admin: "#1d4ed8", theory: "#0369a1", health: "#be123c", cs: "#065f46", applied: "#92400e" }[c.id] || P.blue2,
    })),
  },
  diploma: {
    label: CATALOGUE.diploma.label, icon: FileText, color: P.green,
    programs: CATALOGUE.diploma.programs,
  },
  graduate: {
    label: CATALOGUE.graduate.label, icon: Trophy, color: P.gold,
    programs: CATALOGUE.graduate.programs,
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

/*
 * There used to be a FILES table here: four fabricated PDFs per section,
 * templated from the subject name, complete with invented view counts,
 * download counts, Hijri dates and 4.9-star ratings. Every course showed the
 * same twelve, none of them existed, and tapping one did nothing.
 *
 * It is gone. The course page shows the files an admin actually uploaded, and
 * says plainly when a section is still empty. An empty shelf is honest; a
 * shelf of props is not.
 */

const SECTIONS = [
  { id: "collections", Icon: Bookmark, label: "تجميعات وملخصات", color: "#1d4ed8", desc: "تجميعات الاختبارات والملخصات الشاملة" },
  { id: "plans", Icon: Calendar, label: "الخطط الدراسية", color: "#6d28d9", desc: "الخطة الكاملة وجدول الوحدات والتوصيف" },
  { id: "curriculum", Icon: Layers, label: "المقررات الدراسية", color: "#065f46", desc: "المحتوى الكامل والواجبات والمشاريع" },
  { id: "programs", Icon: Award, label: "البرامج والتخصصات", color: "#b45309", desc: "نظرة عامة وشروط القبول والرسوم" },
  { id: "flashcards", Icon: Hash, label: "بطاقات تعليمية", color: "#0891b2", desc: "أنشئ بطاقات سؤال وجواب للمراجعة" },
  { id: "notes", Icon: PenLine, label: "ملاحظاتي الشخصية", color: "#6d28d9", desc: "اكتب ملاحظاتك الخاصة عن هذه المادة" },
  { id: "support", Icon: Phone, label: "الدعم الفني", color: "#be123c", desc: "تواصل معنا وروابط الدعم الرسمية" },
];
// Which sections hold uploaded files (the rest are tools or contact info).
const FILE_SECTIONS = ["collections", "plans", "curriculum", "programs"];
/**
 * Is this course a whole programme, or one subject inside the prep year?
 *
 * "البرامج والتخصصات" — admission requirements, fees, programme overview —
 * is meaningless on "مهارات الحاسب", which is a single first-year subject.
 * The section is dropped there rather than opening onto nothing.
 */
const PREP_SUBJECTS = new Set(Object.values(TREE.preparatory.plans).flatMap(p => p.subjects));
const isProgramme = (subject) => !PREP_SUBJECTS.has(subject);

const GRADE_SCALE = [
  { label: "A+", min: 95, pts: 5.00, color: "#059669" }, { label: "A", min: 90, pts: 4.75, color: "#059669" },
  { label: "B+", min: 85, pts: 4.50, color: "#0369a1" }, { label: "B", min: 80, pts: 4.00, color: "#0369a1" },
  { label: "C+", min: 75, pts: 3.50, color: "#d97706" }, { label: "C", min: 70, pts: 3.00, color: "#d97706" },
  { label: "D+", min: 65, pts: 2.50, color: "#ea580c" }, { label: "D", min: 60, pts: 2.00, color: "#ea580c" },
  { label: "F", min: 0, pts: 0.00, color: "#dc2626" },
];
const scoreToGrade = (s) => GRADE_SCALE.find(g => s >= g.min) || GRADE_SCALE[GRADE_SCALE.length - 1];


/* ══════════════════════════════════════════════════════════════
   UTILITIES
   ══════════════════════════════════════════════════════════════ */
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

/**
 * A ring that keeps going until someone acknowledges it, then stops on its own.
 *
 * The owner asked for thirty seconds of sound and then quiet. Two things make
 * that safe rather than maddening: a single module-level handle, so a second
 * notification replaces the first rather than ringing over it, and a hard
 * ceiling that fires even if nothing ever acknowledges it — an alarm with no
 * off switch is the one people disable permanently.
 */
let ringTimer = null;
let ringStopAt = 0;

export function stopRinging() {
  if (ringTimer) { clearInterval(ringTimer); ringTimer = null; }
  ringStopAt = 0;
}

// playChime, not playBell: this is the sound reminders already made, and
// changing what an alarm sounds like is not a side effect anyone asked for.
function startRinging(seconds = 30) {
  stopRinging();
  ringStopAt = Date.now() + seconds * 1000;
  playChime();
  ringTimer = setInterval(() => {
    if (Date.now() >= ringStopAt) { stopRinging(); return; }
    playChime();
  }, 3000);
}

// Touching the page at all counts as hearing it. An alarm that keeps sounding
// after you have picked up the phone is the reason people mute an app for good.
if (typeof window !== "undefined") {
  const ack = () => stopRinging();
  window.addEventListener("pointerdown", ack, { passive: true });
  window.addEventListener("keydown", ack);
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

// Two-tone chime for notifications — deliberately different from the single
// timer bell so a lecture reminder is recognisable without looking.
function playChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const tone = (freq, at, dur = 0.45) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type = "sine"; o.frequency.value = freq;
      const t0 = ctx.currentTime + at;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.28, t0 + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.start(t0); o.stop(t0 + dur + 0.05);
    };
    tone(880, 0);      // ding
    tone(1174.7, 0.18); // dong (a fourth up)
    setTimeout(() => ctx.close(), 1200);
  } catch { /* audio blocked until the user interacts — fine */ }
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
      // Above every full-screen sheet. At 300 these were painted *behind*
      // the settings panel (400), the assistant (500), the subscription sheet
      // (600), the support sheet (620) and the sign-in screen (800) — so every
      // confirmation and every error raised from inside one was invisible.
      // A failed subscription request looked like nothing happened at all.
      position: "fixed", bottom: 90, left: 0, right: 0, zIndex: 1000,
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

/* ══════════════════════════════════════════════════════════════
   RESET — say exactly what disappears, and offer the smaller option
   ══════════════════════════════════════════════════════════════ */
/**
 * "إعادة تعيين كل البيانات" used to be one red button behind a vague warning,
 * so nobody could tell what it actually did. It now lists what is on the
 * device with live counts and splits into two honest choices:
 *
 *   • study data only — favourites, notes, tasks, schedule, exams, statistics.
 *     The profile and the chosen track survive, which is what most people
 *     actually want when they say "start the semester fresh".
 *   • everything — the above plus the profile and the saved account.
 *
 * Neither clears the track lock stamp: a reset must not become a way around
 * the 15-day hold on changing tracks.
 */
function ResetDialog({ open, counts, onClose, onResetData, onResetAll, t }) {
  const [mode, setMode] = useState("data"); // data | all
  if (!open) return null;

  const rows = [
    { label: "المفضلة", n: counts.favorites, keep: false },
    { label: "الملاحظات", n: counts.notes, keep: false },
    { label: "المهام", n: counts.tasks, keep: false },
    { label: "المحاضرات في جدولك", n: counts.schedule, keep: false },
    { label: "الاختبارات", n: counts.exams, keep: false },
    { label: "جلسات التركيز والإحصائيات", n: counts.sessions, keep: false },
    { label: "ملفك الشخصي ومسارك", n: counts.profile, keep: mode === "data" },
  ];

  const Choice = ({ id, title, desc, color }) => (
    <button onClick={() => setMode(id)} style={{
      width: "100%", textAlign: "right", background: mode === id ? `${color}12` : t.s2,
      border: `1.5px solid ${mode === id ? color : t.bd}`, borderRadius: 14,
      padding: "12px 14px", cursor: "pointer", fontFamily: "inherit", marginBottom: 8,
      display: "flex", gap: 10, alignItems: "flex-start",
    }}>
      <div style={{
        width: 18, height: 18, borderRadius: "50%", flexShrink: 0, marginTop: 2,
        border: `2px solid ${mode === id ? color : t.dim}`,
        background: mode === id ? color : "transparent",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {mode === id && <Check size={11} color="#fff" strokeWidth={3.5} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: t.tx }}>{title}</div>
        <div style={{ fontSize: 11.5, color: t.mu, lineHeight: 1.65, marginTop: 3 }}>{desc}</div>
      </div>
    </button>
  );

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 250,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
      backdropFilter: "blur(4px)", animation: "fadeIn .2s ease",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: t.s1, borderRadius: 20, padding: 22, maxWidth: 380, width: "100%",
        maxHeight: "90vh", overflowY: "auto",
        border: `1px solid ${t.bd}`, boxShadow: t.sh, animation: "scaleIn .25s ease",
      }}>
        <div style={{ width: 46, height: 46, borderRadius: 14, background: `${P.red}15`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
          <Trash2 size={21} color={P.red} />
        </div>
        <h3 style={{ fontSize: 17, fontWeight: 900, color: t.tx, marginBottom: 6 }}>إعادة تعيين البيانات</h3>
        <p style={{ fontSize: 12.5, color: t.mu, lineHeight: 1.7, marginBottom: 16 }}>
          كل شيء محفوظ على هذا الجهاز وحده. اختر ما تريد حذفه:
        </p>

        <Choice id="data" color={P.orange}
          title="بيانات الدراسة فقط"
          desc="المفضلة والملاحظات والمهام والجدول والإحصائيات — مع الاحتفاظ باسمك ومسارك." />
        <Choice id="all" color={P.red}
          title="كل شيء"
          desc="ما سبق، بالإضافة إلى ملفك الشخصي والحساب المحفوظ على هذا الجهاز." />

        <div style={{ background: t.s2, borderRadius: 14, padding: "12px 14px", margin: "6px 0 14px" }}>
          {rows.map(r => (
            <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
              <span style={{ fontSize: 12.5, color: r.keep ? t.mu : t.tx, flex: 1, textDecoration: r.keep ? "none" : "none" }}>{r.label}</span>
              <span style={{ fontSize: 11.5, color: t.dim, fontFamily: "monospace" }}>{r.n}</span>
              <span style={{
                fontSize: 10.5, fontWeight: 800, borderRadius: 6, padding: "2px 7px",
                background: r.keep ? `${P.green}15` : `${P.red}12`, color: r.keep ? P.green : P.red,
              }}>{r.keep ? "يبقى" : "يُحذف"}</span>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: `${P.gold}0f`, border: `1px solid ${P.gold}35`, borderRadius: 10, padding: "10px 12px", marginBottom: 16 }}>
          <Lock size={14} color={P.gold} style={{ flexShrink: 0, marginTop: 2 }} />
          <span style={{ fontSize: 11.5, color: t.mu, lineHeight: 1.65 }}>
            قفل المسار ({TRACK_LOCK_DAYS} يوماً) لا يُلغى بإعادة التعيين — لتغيير مسارك أرسل طلباً للإدارة.
          </span>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <Btn variant="ghost" onClick={onClose} style={{ flex: 1 }}>إلغاء</Btn>
          <Btn variant="danger" onClick={() => { (mode === "all" ? onResetAll : onResetData)(); onClose(); }} style={{ flex: 1.4 }}>
            <Trash2 size={14} /> {mode === "all" ? "حذف كل شيء" : "إعادة التعيين"}
          </Btn>
        </div>
      </div>
    </div>
  );
}


/* ══════════════════════════════════════════════════════════════
   AI CHAT
   ══════════════════════════════════════════════════════════════ */
/* ══════════════════════════════════════════════════════════════
   CONTACT THE SITE — a message that reaches the admin panel
   ══════════════════════════════════════════════════════════════ */
const SUPPORT_TOPICS = ["سؤال", "مشكلة", "اقتراح", "ملف ناقص"];

/**
 * Writing to whoever runs the site.
 *
 * The only contact details anywhere were the university's switchboard, which
 * is not who you tell that a file is missing or a page is broken. No account
 * needed: name, ID and email are filled in from the profile when there is one
 * and left optional when there isn't.
 */
function SupportSheet({ t, onClose, profile, email, page, onToast }) {
  const [topic, setTopic] = useState("سؤال");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    if (!message.trim()) return;
    setSending(true);
    try {
      const res = await fetch("/api/support", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic, message: message.trim(), page,
          name: profile?.name, email,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) { setSent(true); onToast?.("وصلت رسالتك ✅", "success"); }
      else onToast?.(safeText(d.error, "تعذّر الإرسال"), "error");
    } catch { onToast?.("تعذّر الاتصال", "error"); }
    setSending(false);
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 620, background: t.bg, display: "flex", flexDirection: "column", animation: "fadeIn .2s ease" }}>
      <div style={{ background: t.hero, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
        <button onClick={onClose} style={{ background: "rgba(255,255,255,.14)", border: "1px solid rgba(255,255,255,.2)", borderRadius: 10, padding: "8px 13px", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit", fontSize: 13, fontWeight: 700 }}>
          <ArrowLeft size={15} /> رجوع
        </button>
        <div style={{ fontSize: 16, fontWeight: 900, color: "#fff", display: "flex", alignItems: "center", gap: 8 }}>
          <MessageCircle size={17} color={P.gold} /> تواصل معنا
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 16, maxWidth: 620, margin: "0 auto", width: "100%" }}>
        {sent ? (
          <div style={{ background: `${P.green}0d`, border: `1px solid ${P.green}40`, borderRadius: 16, padding: 20, textAlign: "center" }}>
            <Check size={30} color={P.green} style={{ marginBottom: 10 }} />
            <div style={{ fontSize: 15, fontWeight: 800, color: t.tx, marginBottom: 5 }}>وصلت رسالتك</div>
            <div style={{ fontSize: 12.5, color: t.mu, lineHeight: 1.8 }}>سنطّلع عليها قريباً{email ? ` ونرد على ${email}` : ""}.</div>
            <Btn variant="ghost" size="sm" onClick={onClose} style={{ width: "100%", marginTop: 16 }}>إغلاق</Btn>
          </div>
        ) : (
          <div style={{ background: t.s1, border: `1px solid ${t.bd}`, borderRadius: 16, padding: 16, boxShadow: t.shSm }}>
            <div style={{ fontSize: 11.5, color: t.mu, fontWeight: 700, marginBottom: 6 }}>الموضوع</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
              {SUPPORT_TOPICS.map(x => {
                const active = topic === x;
                return (
                  <button key={x} onClick={() => setTopic(x)} style={{
                    padding: "7px 13px", borderRadius: 10, cursor: "pointer", fontFamily: "inherit",
                    fontSize: 12.5, fontWeight: 700,
                    background: active ? `${P.blue2}18` : t.s2,
                    border: `1.5px solid ${active ? P.blue2 : t.bd}`, color: active ? P.blue2 : t.mu,
                  }}>{x}</button>
                );
              })}
            </div>

            <div style={{ fontSize: 11.5, color: t.mu, fontWeight: 700, marginBottom: 6 }}>رسالتك</div>
            <textarea value={message} onChange={e => setMessage(e.target.value)} rows={6} autoFocus
              placeholder="اكتب ما تريد قوله — كلما كان أوضح كان الرد أسرع"
              style={{ width: "100%", border: `1.5px solid ${t.bd}`, borderRadius: 12, padding: "12px 14px", fontSize: 13.5, background: t.s2, color: t.tx, fontFamily: "inherit", direction: "rtl", outline: "none", boxSizing: "border-box", resize: "vertical", lineHeight: 1.8, marginBottom: 12 }} />

            <div style={{ fontSize: 11.5, color: t.dim, lineHeight: 1.8, marginBottom: 14 }}>
              {profile?.name || email
                ? <>يُرسَل معها: {[profile?.name, email].filter(Boolean).join(" · ")}</>
                : "لم تُكمل ملفك — أرسل بريدك داخل الرسالة إن أردت ردّاً."}
            </div>

            <Btn variant="primary" onClick={submit} disabled={sending || !message.trim()} style={{ width: "100%" }}>
              <Send size={14} /> {sending ? "جارٍ الإرسال…" : "إرسال"}
            </Btn>
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════ MESSAGES ══════════════ */

/** How a thread labels itself, by what opened it. */
const THREAD_KINDS = {
  support:      { label: "رسالة",  color: P.blue2 },
  subscription: { label: "اشتراك", color: P.gold },
  track:        { label: "مسار",   color: "#7c3aed" },
  system:       { label: "من الإدارة", color: P.green },
};

const relTime = (iso) => {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return "الآن";
  if (m < 60) return `قبل ${m} د`;
  const h = Math.floor(m / 60);
  if (h < 24) return `قبل ${h} س`;
  const d = Math.floor(h / 24);
  return d === 1 ? "أمس" : `قبل ${d} يوم`;
};

/**
 * The student's side of the correspondence.
 *
 * This replaces a send-only form. The form could deliver a question and had
 * nowhere to deliver an answer, so every reply the owner wrote — and every
 * decision the site made about a person — arrived as silence. A student who
 * hears nothing asks again, which is why the old inbox filled with repeats.
 *
 * One surface for all of it on purpose: a rejected subscription and a
 * question about a missing file are both "something I need to hear about",
 * and splitting them across pages is how people miss things.
 */
function MessagesSheet({ t, onClose, profile, email, onToast, onUnread }) {
  const [threads, setThreads] = useState(null);
  const [open, setOpen] = useState(null);      // thread id being read
  const [composing, setComposing] = useState(false);
  const [topic, setTopic] = useState("سؤال");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/messages");
      const d = await r.json().catch(() => ({}));
      setThreads(d.threads || []);
      onUnread?.(d.unread || 0);
    } catch { setThreads([]); }
  }, [onUnread]);

  useEffect(() => { load(); }, [load]);

  const thread = threads?.find(x => x.id === open) || null;

  // Opening a conversation is reading it. Clearing the badge here rather than
  // on a button keeps the count honest: it says "things you have not looked
  // at", which is the only meaning anybody reads into it.
  useEffect(() => {
    if (!open) return;
    fetch("/api/messages", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threadId: open }),
    }).then(() => {
      setThreads(ts => (ts || []).map(x => x.id === open ? { ...x, student_unread: 0 } : x));
      onUnread?.((threads || []).reduce((n, x) => n + (x.id === open ? 0 : x.student_unread || 0), 0));
    }).catch(() => {});
    // `threads` is deliberately not a dependency: it changes on every load and
    // would re-fire this write in a loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const send = async () => {
    const body = draft.trim();
    if (!body) return;
    setSending(true);
    try {
      const r = await fetch("/api/messages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body, threadId: open || undefined, topic,
          name: profile?.name, email,
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        setDraft(""); setComposing(false);
        if (!open && d.threadId) setOpen(d.threadId);
        await load();
        onToast?.("أُرسلت رسالتك ✅", "success");
      } else onToast?.(safeText(d.error, "تعذّر الإرسال"), "error");
    } catch { onToast?.("تعذّر الاتصال", "error"); }
    setSending(false);
  };

  const header = (title, back) => (
    <div style={{ background: t.hero, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
      <button onClick={back} style={{ background: "rgba(255,255,255,.14)", border: "1px solid rgba(255,255,255,.2)", borderRadius: 10, padding: "8px 13px", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit", fontSize: 13, fontWeight: 700 }}>
        <ArrowLeft size={15} /> رجوع
      </button>
      <div style={{ fontSize: 16, fontWeight: 900, color: "#fff", display: "flex", alignItems: "center", gap: 8 }}>
        <Mail size={17} color={P.gold} /> {title}
      </div>
    </div>
  );

  const box = { width: "100%", boxSizing: "border-box", background: t.s2, border: `1.5px solid ${t.bd}`, borderRadius: 12, padding: "11px 13px", fontSize: 13.5, color: t.tx, fontFamily: "inherit", direction: "rtl", outline: "none", resize: "vertical" };

  /* ── one conversation ─────────────────────────────────────────── */
  if (thread) {
    const k = THREAD_KINDS[thread.kind] || THREAD_KINDS.support;
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 620, background: t.bg, display: "flex", flexDirection: "column", animation: "fadeIn .2s ease" }}>
        {header(safeText(thread.subject, "محادثة"), () => setOpen(null))}
        <div style={{ flex: 1, overflowY: "auto", padding: 16, maxWidth: 620, margin: "0 auto", width: "100%" }}>
          <div style={{ display: "inline-block", fontSize: 10.5, fontWeight: 800, color: k.color, background: `${k.color}15`, border: `1px solid ${k.color}35`, borderRadius: 7, padding: "3px 8px", marginBottom: 14 }}>
            {k.label}
          </div>
          {(thread.messages || []).map(m => {
            const mine = m.sender === "student";
            return (
              <div key={m.id} style={{ display: "flex", justifyContent: mine ? "flex-start" : "flex-end", marginBottom: 10 }}>
                <div style={{
                  maxWidth: "85%",
                  background: mine ? t.s2 : `${P.green}12`,
                  border: `1px solid ${mine ? t.bd : `${P.green}35`}`,
                  borderRadius: 14, padding: "10px 13px",
                }}>
                  <div style={{ fontSize: 10.5, fontWeight: 800, color: mine ? t.dim : P.green, marginBottom: 4 }}>
                    {mine ? "أنت" : "الإدارة"} · {relTime(m.created_at)}
                  </div>
                  <div style={{ fontSize: 13.5, color: t.tx, lineHeight: 1.9, whiteSpace: "pre-wrap" }}>
                    {safeText(m.body, "")}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ padding: 14, borderTop: `1px solid ${t.bd}`, background: t.s1, maxWidth: 620, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
          <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={2}
            placeholder="اكتب ردّك…" style={{ ...box, marginBottom: 8 }} />
          <Btn variant="primary" onClick={send} disabled={sending || !draft.trim()} style={{ width: "100%" }}>
            <Send size={14} /> {sending ? "جارٍ الإرسال…" : "إرسال"}
          </Btn>
        </div>
      </div>
    );
  }

  /* ── writing a new one ────────────────────────────────────────── */
  if (composing) {
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 620, background: t.bg, display: "flex", flexDirection: "column", animation: "fadeIn .2s ease" }}>
        {header("رسالة جديدة", () => setComposing(false))}
        <div style={{ flex: 1, overflowY: "auto", padding: 16, maxWidth: 620, margin: "0 auto", width: "100%" }}>
          <div style={{ fontSize: 11.5, color: t.mu, fontWeight: 700, marginBottom: 6 }}>الموضوع</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
            {SUPPORT_TOPICS.map(x => (
              <button key={x} onClick={() => setTopic(x)} style={{
                background: topic === x ? `${P.blue2}18` : t.s2,
                border: `1.5px solid ${topic === x ? P.blue2 : t.bd}`,
                borderRadius: 9, padding: "7px 12px", cursor: "pointer", fontFamily: "inherit",
                fontSize: 12.5, fontWeight: 800, color: topic === x ? P.blue2 : t.mu,
              }}>{x}</button>
            ))}
          </div>
          <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={6}
            placeholder="اكتب رسالتك…" style={{ ...box, marginBottom: 12 }} />
          <div style={{ fontSize: 11.5, color: t.dim, lineHeight: 1.8, marginBottom: 14 }}>
            {profile?.name || email
              ? <>يُرسَل معها: {[profile?.name, email].filter(Boolean).join(" · ")}</>
              : "لم تُكمل ملفك — الرد سيصلك هنا في هذه الصفحة على أي حال."}
          </div>
          <Btn variant="primary" onClick={send} disabled={sending || !draft.trim()} style={{ width: "100%" }}>
            <Send size={14} /> {sending ? "جارٍ الإرسال…" : "إرسال"}
          </Btn>
        </div>
      </div>
    );
  }

  /* ── the list ─────────────────────────────────────────────────── */
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 620, background: t.bg, display: "flex", flexDirection: "column", animation: "fadeIn .2s ease" }}>
      {header("الرسائل", onClose)}
      <div style={{ flex: 1, overflowY: "auto", padding: 16, maxWidth: 620, margin: "0 auto", width: "100%" }}>
        <Btn variant="gold" onClick={() => { setDraft(""); setComposing(true); }} style={{ width: "100%", marginBottom: 14 }}>
          <MessageCircle size={15} /> راسل الإدارة
        </Btn>

        {threads === null ? (
          <div style={{ fontSize: 13, color: t.mu, textAlign: "center", padding: 30 }}>جارٍ التحميل…</div>
        ) : threads.length === 0 ? (
          <div style={{ background: t.s1, border: `1px solid ${t.bd}`, borderRadius: 16, padding: 22, textAlign: "center" }}>
            <Mail size={26} color={t.dim} style={{ marginBottom: 10 }} />
            <div style={{ fontSize: 14, fontWeight: 800, color: t.tx, marginBottom: 5 }}>لا رسائل بعد</div>
            <div style={{ fontSize: 12.5, color: t.mu, lineHeight: 1.85 }}>
              أي سؤال أو مشكلة أو ملف ناقص — اكتب لنا. وكل ردّ على طلباتك يصلك هنا.
            </div>
          </div>
        ) : threads.map(x => {
          const k = THREAD_KINDS[x.kind] || THREAD_KINDS.support;
          const last = (x.messages || [])[x.messages.length - 1];
          return (
            <button key={x.id} onClick={() => setOpen(x.id)} style={{
              width: "100%", textAlign: "right", background: t.s1,
              border: `1.5px solid ${x.student_unread > 0 ? `${P.blue2}55` : t.bd}`,
              borderRadius: 14, padding: 14, marginBottom: 9, cursor: "pointer",
              fontFamily: "inherit", display: "block",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5 }}>
                <span style={{ fontSize: 10.5, fontWeight: 800, color: k.color, background: `${k.color}15`, borderRadius: 6, padding: "2px 7px" }}>{k.label}</span>
                {x.student_unread > 0 && (
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: P.blue2 }} />
                )}
                <span style={{ marginRight: "auto", fontSize: 11, color: t.dim }}>{relTime(x.last_message_at)}</span>
              </div>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: t.tx, marginBottom: 3 }}>
                {safeText(x.subject, "محادثة")}
              </div>
              {last && (
                <div style={{ fontSize: 12, color: t.mu, lineHeight: 1.7, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {last.sender === "admin" ? "الإدارة: " : "أنت: "}{safeText(last.body, "")}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * What a browsing visitor is told when they reach for something an account
 * unlocks. Named for what it is rather than "upgrade": nothing is being sold
 * here, and the free part of the site is genuinely free.
 */
function NeedAccountSheet({ t, what, onClose, accounts }) {
  const lines = {
    file: ["الملفات للطلاب المسجّلين", "التصفّح مفتوح للجميع — أما فتح الملفات وتحميلها فيحتاج حساباً. مجاني، ودقيقة واحدة."],
    ai: ["المساعد الذكي للطلاب المسجّلين", "أنشئ حسابك لتسأل المساعد عن موادك — ويحفظ لك مسارك وجدولك ومهامك أيضاً."],
    save: ["الحفظ يحتاج حساباً", "المفضلة والملاحظات والمهام والجدول تُحفظ في حسابك لتتبعك على أي جهاز."],
  }[what] || ["يحتاج حساباً", "أنشئ حسابك للاستفادة الكاملة من الموقع."];

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 700, background: "rgba(0,0,0,.6)", backdropFilter: "blur(6px)", display: "flex", alignItems: "flex-end", justifyContent: "center", animation: "fadeIn .2s ease" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: t.s1, borderRadius: "22px 22px 0 0", padding: "22px 18px 28px", width: "100%", maxWidth: 620, animation: "fadeUp .28s ease" }}>
        <div style={{ width: 38, height: 4, borderRadius: 2, background: t.bd, margin: "0 auto 16px" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <div style={{ width: 34, height: 34, borderRadius: 11, background: `${P.gold}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Lock size={17} color={P.gold} />
          </div>
          <div style={{ fontSize: 16, fontWeight: 900, color: t.tx }}>{lines[0]}</div>
        </div>
        <div style={{ fontSize: 13, color: t.mu, lineHeight: 1.9, marginBottom: 16 }}>{lines[1]}</div>
        {accounts ? (
          <>
            <Btn variant="gold" onClick={() => { window.location.href = "/signup"; }} style={{ width: "100%", marginBottom: 8 }}>
              <User size={15} /> إنشاء حساب مجاني
            </Btn>
            <Btn variant="ghost" onClick={() => { window.location.href = "/login"; }} style={{ width: "100%" }}>
              <LogIn size={15} /> لدي حساب — تسجيل الدخول
            </Btn>
          </>
        ) : (
          <Btn variant="gold" onClick={onClose} style={{ width: "100%" }}>
            <User size={15} /> أكمل ملفك من «حسابي»
          </Btn>
        )}
        <button onClick={onClose} style={{ width: "100%", background: "none", border: "none", marginTop: 12, cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, fontWeight: 700, color: t.mu }}>
          أكمل التصفّح
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   AI SUBSCRIPTION — payment details and the request
   ══════════════════════════════════════════════════════════════ */
// Shown until an admin saves real details in the panel. Deliberately blank
// where a real value belongs: inventing an IBAN would be worse than empty.
const DEFAULT_PAYMENT = {
  title: "اشتراك المساعد الذكي",
  price: "",
  bank: "",
  accountName: "",
  iban: "",
  terms: "بعد التحويل أرفق صورة الإيصال هنا. تُراجع الطلبات يدوياً وعادةً خلال ١٠ دقائق.",
  verifyNote: "المراجعة يدوية — عادةً خلال ١٠ دقائق",
};

/**
 * Where a receipt is stored: its own prefix, an ASCII-safe name.
 *
 * Arabic filenames off a phone survive the URL fine but are unreadable in the
 * store listing, and a name with no extension makes the browser guess at the
 * type later. Keep the extension, replace the rest with the date.
 */
function receiptPath(file) {
  const ext = (String(file.name || "").match(/\.[a-z0-9]{1,5}$/i)?.[0] || "").toLowerCase()
    || ({ "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp", "application/pdf": ".pdf" }[file.type] || "");
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `receipts/${stamp}-receipt${ext}`;
}

/**
 * Turn a failed receipt upload into something a student can act on.
 *
 * The Blob SDK collapses every refusal from our token route into the English
 * "Failed to retrieve the client token", so ask the route itself why.
 */
async function receiptError(e) {
  const msg = String(e?.message || "");
  if (e?.name === "TimeoutError" || /abort/i.test(msg)) {
    return "الرفع استغرق وقتاً طويلاً — تحقّق من الاتصال وأعد المحاولة، أو أرسل الطلب بملاحظة بدل الصورة";
  }
  if (/client token/i.test(msg)) {
    try {
      const d = await fetch("/api/receipt-upload").then(r => r.json());
      if (d && d.ok === false && d.reason) return d.reason;
    } catch { /* offline; fall through to the generic message */ }
    return "تعذّر بدء الرفع — أعد المحاولة، أو أرسل الطلب بملاحظة بدل الصورة";
  }
  return "تعذّر رفع الإيصال" + (msg ? ` (${msg})` : "");
}

/**
 * The sheet a student sees when the free questions run out.
 *
 * It says plainly what they get, what it costs, where to send it, and that a
 * human checks the receipt — no automatic payment, no card form, nothing that
 * pretends to be an instant purchase.
 */
function SubscribeSheet({ t, onClose, profile, email, onSaveEmail, gate, onToast }) {
  const { data: content } = useSiteContent("payment");
  const pay = { ...DEFAULT_PAYMENT, ...(content && typeof content === "object" ? content : {}) };
  // The draft is kept on the device, not just in this component's state.
  // Picking a photo sends the phone to its gallery app, and a phone short of
  // memory kills the browser while it is in the background — the "the whole
  // browser closes" report. Nothing we run can prevent that, but coming back
  // to an empty form afterwards is ours to prevent: an already-uploaded
  // receipt in particular must not have to be uploaded twice.
  const DRAFT = "subscribe_draft";
  const draft0 = storage.get(DRAFT, null) || {};
  const [note, setNote] = useState(draft0.note || "");
  // A student who never set an email in the assistant would otherwise send a
  // request we cannot answer. Ask for it here rather than sending them away.
  const [emailDraft, setEmailDraft] = useState(email || draft0.email || "");
  const savedEmail = looksLikeEmail(email) ? email : (looksLikeEmail(emailDraft) ? emailDraft.trim() : "");
  const [receipt, setReceipt] = useState(draft0.receipt || "");     // the stored blob URL
  const [receiptName, setReceiptName] = useState(draft0.receiptName || "");
  const [uploading, setUploading] = useState(0);  // 0 = idle, else percent
  const fileRef = useRef(null);
  const [sending, setSending] = useState(false);
  const [sendErr, setSendErr] = useState("");
  const [justSent, setJustSent] = useState(false);
  const [mine, setMine] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/subscription")
      .then(r => r.json())
      .then(d => setMine(d.request || null))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  // Written on every change rather than on unmount: a process the OS kills
  // never gets to unmount, which is exactly the case this protects against.
  useEffect(() => {
    if (justSent) return;
    storage.set(DRAFT, { note, receipt, receiptName, email: emailDraft });
  }, [note, receipt, receiptName, emailDraft, justSent]);

  /**
   * Send the picture straight to storage, then keep only its URL.
   *
   * Stored privately: a bank transfer screenshot must not be readable from a
   * guessable URL. The admin reads it back through /api/download, which is the
   * same authorised proxy the course files use.
   */
  const pickReceipt = async (file) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { onToast?.("الحجم أكبر من ٥ ميجابايت", "warn"); return; }
    setUploading(1);
    try {
      const { upload } = await import("@vercel/blob/client");
      const blob = await upload(receiptPath(file), file, {
        access: "private",
        contentType: file.type || undefined,   // a share sheet can drop the extension
        handleUploadUrl: "/api/receipt-upload",
        // Without this a stalled phone connection spins forever with no way
        // out — the "it keeps uploading and never finishes" report.
        abortSignal: AbortSignal.timeout(90_000),
        onUploadProgress: (p) => setUploading(Math.max(1, Math.round(p.percentage))),
      });
      setReceipt(blob.url);
      setReceiptName(file.name);
      onToast?.("تم إرفاق الإيصال ✅", "success");
    } catch (e) {
      onToast?.(await receiptError(e), "error");
    }
    setUploading(0);
  };

  const submit = async () => {
    setSending(true);
    setSendErr("");
    try {
      // Save a newly typed email so the assistant and any later request use
      // the same one — the student should type it once, not every time.
      if (savedEmail && savedEmail !== email) onSaveEmail?.(savedEmail);
      const res = await fetch("/api/subscription", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: profile?.name,
          email: savedEmail, note: note.trim(), receiptUrl: receipt.trim(),
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        onToast?.("وصل طلبك ✅", "success");
        // A toast disappears. This is the answer to "did it actually send?" —
        // it stays on screen, and survives closing and reopening the sheet
        // because the pending request comes back from the server.
        setJustSent(true);
        setMine({ status: "pending" });
        storage.set(DRAFT, null);   // sent — nothing left to recover
      }
      else {
        // Kept on screen, not only as a toast: a toast is gone in three
        // seconds, and the reason a request was refused is the one thing the
        // student needs to read twice.
        const why = safeText(d.error, `تعذّر إرسال الطلب (${res.status})`);
        setSendErr(why);
        onToast?.(why, "error");
      }
    } catch {
      setSendErr("تعذّر الاتصال بالخادم — تحقّق من اتصالك وأعد المحاولة");
      onToast?.("تعذّر الاتصال", "error");
    }
    setSending(false);
  };

  const Row = ({ label, value }) => value ? (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 0", borderBottom: `1px solid ${t.bd}` }}>
      <span style={{ fontSize: 12, color: t.mu, fontWeight: 700, flexShrink: 0 }}>{label}</span>
      <span style={{ flex: 1, fontSize: 12.5, color: t.tx, fontWeight: 700, textAlign: "left", direction: "ltr", overflow: "hidden", textOverflow: "ellipsis", fontFamily: label === "الآيبان" ? "monospace" : "inherit" }}>{value}</span>
      <button onClick={() => { try { navigator.clipboard.writeText(value); onToast?.("تم النسخ", "success"); } catch { } }}
        style={{ background: "none", border: "none", cursor: "pointer", color: P.blue2, display: "flex", padding: 2, flexShrink: 0 }}>
        <Copy size={13} />
      </button>
    </div>
  ) : null;

  const configured = pay.bank || pay.iban || pay.accountName || pay.price;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 600, background: t.bg, display: "flex", flexDirection: "column", animation: "fadeIn .2s ease" }}>
      <div style={{ background: t.hero, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
        <button onClick={onClose} style={{ background: "rgba(255,255,255,.14)", border: "1px solid rgba(255,255,255,.2)", borderRadius: 10, padding: "8px 13px", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit", fontSize: 13, fontWeight: 700 }}>
          <ArrowLeft size={15} /> رجوع
        </button>
        <div style={{ fontSize: 16, fontWeight: 900, color: "#fff", display: "flex", alignItems: "center", gap: 8 }}>
          <Sparkles size={17} color={P.gold} /> {safeText(pay.title, DEFAULT_PAYMENT.title)}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 16, maxWidth: 620, margin: "0 auto", width: "100%" }}>
        {gate && !gate.subscribed && (
          <div style={{ background: `${P.orange}10`, border: `1px solid ${P.orange}35`, borderRadius: 14, padding: "12px 14px", marginBottom: 14, display: "flex", gap: 10, alignItems: "flex-start" }}>
            <AlertTriangle size={16} color={P.orange} style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ fontSize: 12.5, color: t.tx, lineHeight: 1.75 }}>
              استخدمت {gate.used ?? gate.limit} من {gate.limit} أسئلة.
              {gate.resetAt ? ` تتجدّد مجاناً ${untilLabel(gate.resetAt)}` : ""} — أو اشترك للاستخدام بلا حدّ.
            </div>
          </div>
        )}

        {/* An answered request replaces the form: nothing to fill in twice. */}
        {mine && mine.status === "pending" && (
          <div style={{ background: justSent ? `${P.green}0d` : t.s1, border: `1px solid ${justSent ? `${P.green}45` : `${P.blue2}45`}`, borderRadius: 16, padding: 16, marginBottom: 14 }}>
            <div style={{ fontSize: 14.5, fontWeight: 900, color: justSent ? P.green : P.blue2, marginBottom: 6, display: "flex", alignItems: "center", gap: 7 }}>
              {justSent ? <><Check size={16} /> تم إرسال طلبك</> : "طلبك قيد المراجعة"}
            </div>
            <div style={{ fontSize: 12.5, color: t.tx, lineHeight: 1.9 }}>
              {justSent && <>وصل الطلب وهو الآن <b>قيد الانتظار</b> حتى يُراجَع ويُفعَّل.<br /></>}
              {safeText(pay.verifyNote, DEFAULT_PAYMENT.verifyNote)}
            </div>
            {justSent && (
              <div style={{ fontSize: 11.5, color: t.mu, lineHeight: 1.9, marginTop: 10, background: t.s2, borderRadius: 10, padding: "10px 12px" }}>
                أُرسل مع الطلب: {profile?.name || "—"} · {savedEmail || "—"}
                {receipt ? " · صورة الإيصال ✅" : " · بدون صورة إيصال"}
                <br />ستظهر حالة الطلب هنا، ويصلك الرد على بريدك.
              </div>
            )}
          </div>
        )}
        {loaded && mine && mine.status === "rejected" && (
          <div style={{ background: `${P.red}0d`, border: `1px solid ${P.red}35`, borderRadius: 16, padding: 16, marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: P.red, marginBottom: 5 }}>لم يُقبل الطلب</div>
            {mine.admin_reply && <div style={{ fontSize: 12.5, color: t.tx, lineHeight: 1.8 }}>{safeText(mine.admin_reply, "")}</div>}
            <div style={{ fontSize: 11.5, color: t.mu, marginTop: 6 }}>يمكنك إرسال طلب جديد بعد التصحيح.</div>
          </div>
        )}
        {loaded && mine && mine.status === "approved" && (
          <div style={{ background: `${P.green}0d`, border: `1px solid ${P.green}40`, borderRadius: 16, padding: 16, marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: P.green, marginBottom: 5 }}>اشتراكك مفعّل ✅</div>
            {mine.expires_at && <div style={{ fontSize: 12.5, color: t.mu }}>ينتهي في {calDate(String(mine.expires_at).slice(0, 10))}</div>}
          </div>
        )}

        {/* Payment details — whatever the admin saved */}
        <div style={{ background: t.s1, border: `1px solid ${t.bd}`, borderRadius: 16, padding: 16, marginBottom: 14, boxShadow: t.shSm }}>
          <div style={{ fontSize: 13.5, fontWeight: 800, color: t.tx, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
            <CreditCard size={15} color={P.green} /> بيانات التحويل
          </div>
          {configured ? (
            <>
              <Row label="المبلغ" value={safeText(pay.price, "")} />
              <Row label="البنك" value={safeText(pay.bank, "")} />
              <Row label="اسم الحساب" value={safeText(pay.accountName, "")} />
              <Row label="الآيبان" value={safeText(pay.iban, "")} />
            </>
          ) : (
            <div style={{ fontSize: 12.5, color: t.mu, lineHeight: 1.8, paddingTop: 6 }}>
              لم تُضَف بيانات التحويل بعد. تُضبط من لوحة التحكم ← الاشتراكات.
            </div>
          )}
          {pay.terms && (
            <div style={{ fontSize: 12, color: t.mu, lineHeight: 1.8, marginTop: 12, background: t.s2, borderRadius: 10, padding: "10px 12px" }}>
              {safeText(pay.terms, "")}
            </div>
          )}
        </div>

        {/* The request itself */}
        {(!mine || mine.status === "rejected") && (
          <div style={{ background: t.s1, border: `1px solid ${t.bd}`, borderRadius: 16, padding: 16, boxShadow: t.shSm }}>
            <div style={{ fontSize: 13.5, fontWeight: 800, color: t.tx, marginBottom: 10 }}>أرسل طلبك</div>

            {!profileComplete(profile) && (
              <div style={{ fontSize: 12, color: P.orange, background: `${P.orange}10`, border: `1px solid ${P.orange}30`, borderRadius: 10, padding: "9px 11px", marginBottom: 10, lineHeight: 1.7 }}>
                أكمل اسمك في «حسابي» أولاً — يُرسَل مع الطلب.
              </div>
            )}

            <div style={{ fontSize: 11.5, color: t.mu, fontWeight: 700, marginBottom: 5 }}>صورة الإيصال</div>
            <input ref={fileRef} type="file" accept="image/*,application/pdf" style={{ display: "none" }}
              onChange={e => { pickReceipt(e.target.files?.[0]); e.target.value = ""; }} />
            {receipt ? (
              <div style={{ display: "flex", alignItems: "center", gap: 9, background: `${P.green}0d`, border: `1px solid ${P.green}40`, borderRadius: 10, padding: "10px 12px", marginBottom: 12 }}>
                <Check size={15} color={P.green} style={{ flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 12.5, color: t.tx, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{receiptName || "الإيصال مرفق"}</span>
                <button onClick={() => { setReceipt(""); setReceiptName(""); }} style={{ background: "none", border: "none", cursor: "pointer", color: P.red, display: "flex", padding: 2, flexShrink: 0 }}>
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button onClick={() => fileRef.current?.click()} disabled={uploading > 0} style={{
                width: "100%", background: t.s2, border: `1.5px dashed ${uploading ? P.blue2 : t.bd}`, borderRadius: 10,
                padding: "16px 12px", cursor: uploading ? "wait" : "pointer", fontFamily: "inherit", marginBottom: 12,
                display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
              }}>
                <Upload size={19} color={uploading ? P.blue2 : t.mu} />
                <span style={{ fontSize: 12.5, fontWeight: 700, color: uploading ? P.blue2 : t.tx }}>
                  {uploading ? `جارٍ الرفع… ${uploading}%` : "اختر صورة الإيصال"}
                </span>
                <span style={{ fontSize: 11, color: t.dim }}>صورة أو PDF · حتى ٥ ميجابايت</span>
              </button>
            )}

            {/* Choosing a photo hands the phone to its gallery app, and a
                phone short of memory may close the browser while it is there.
                The receipt was never mandatory — a note is enough — so say so
                rather than leaving a student stuck at a step their device
                cannot complete. */}
            {!receipt && (
              <div style={{ fontSize: 11.5, color: t.mu, lineHeight: 1.8, marginBottom: 12, background: t.s2, borderRadius: 10, padding: "9px 11px" }}>
                لا تستطيع إرفاق صورة؟ اكتب في الملاحظة أدناه <strong style={{ color: t.tx }}>المبلغ وتاريخ التحويل وآخر ٤ أرقام من حسابك</strong> وأرسل — الإيصال ليس شرطاً.
              </div>
            )}

            <div style={{ fontSize: 11.5, color: t.mu, fontWeight: 700, marginBottom: 5 }}>ملاحظة (اختياري)</div>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={3} placeholder="أي تفاصيل تساعد في المراجعة"
              style={{ width: "100%", border: `1px solid ${t.bd}`, borderRadius: 10, padding: "10px 12px", fontSize: 13, background: t.s2, color: t.tx, fontFamily: "inherit", direction: "rtl", outline: "none", boxSizing: "border-box", resize: "vertical", marginBottom: 12 }} />

            {/* The email is how you answer them. If the assistant never asked
                for one, ask here rather than turning the request away. */}
            <div style={{ fontSize: 11.5, color: t.mu, fontWeight: 700, marginBottom: 5 }}>
              بريدك الإلكتروني {looksLikeEmail(email) ? "" : "— لتصلك نتيجة الطلب"}
            </div>
            <input type="email" inputMode="email" value={emailDraft} onChange={e => setEmailDraft(e.target.value)}
              placeholder="مثال: name@example.com" dir="ltr"
              style={{
                width: "100%", border: `1px solid ${emailDraft && !looksLikeEmail(emailDraft) ? `${P.orange}70` : t.bd}`,
                borderRadius: 10, padding: "10px 12px", fontSize: 13, background: t.s2, color: t.tx,
                fontFamily: "inherit", textAlign: "left", outline: "none", boxSizing: "border-box", marginBottom: 6,
              }} />
            {emailDraft && !looksLikeEmail(emailDraft) && (
              <div style={{ fontSize: 11, color: P.orange, marginBottom: 8 }}>تحقّق من صيغة البريد</div>
            )}

            <div style={{ fontSize: 11.5, color: t.dim, lineHeight: 1.7, margin: "8px 0 12px" }}>
              يُرسَل مع الطلب: {profile?.name || "اسمك"} · {savedEmail || "بريدك"}.
            </div>

            {sendErr && (
              <div style={{ background: `${P.red}0d`, border: `1px solid ${P.red}40`, borderRadius: 10, padding: "10px 12px", marginBottom: 10, display: "flex", gap: 8, alignItems: "flex-start" }}>
                <AlertTriangle size={15} color={P.red} style={{ flexShrink: 0, marginTop: 1 }} />
                <span style={{ fontSize: 12.5, color: t.tx, lineHeight: 1.7 }}>{sendErr}</span>
              </div>
            )}

            <Btn variant="primary" onClick={submit} style={{ width: "100%" }}
              disabled={sending || !profileComplete(profile) || !savedEmail || (!receipt.trim() && !note.trim())}>
              <Send size={14} /> {sending ? "جارٍ الإرسال…" : "إرسال الطلب"}
            </Btn>
            {!sending && !savedEmail && (
              <div style={{ fontSize: 11.5, color: t.mu, textAlign: "center", marginTop: 8 }}>أضف بريدك أعلاه لتتمكن من الإرسال</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Same shape check the server applies — enough to catch typos, not to verify. */
const looksLikeEmail = (v) => {
  const x = String(v || "").trim();
  return x.length >= 6 && x.length <= 160 && /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(x);
};
/** "خلال ٤٢ دقيقة" — how long until the allowance rolls over. */
const untilLabel = (resetAt) => {
  const mins = Math.max(0, Math.ceil((resetAt - Date.now()) / 60000));
  if (mins <= 0) return "الآن";
  if (mins < 60) return `خلال ${mins} دقيقة`;
  const h = Math.floor(mins / 60), m = mins % 60;
  return `خلال ${h} ساعة${m ? ` و${m} د` : ""}`;
};

function AIChat({ subject, t, onChat, standalone = true, files = null, seed = "", profile = null, onSubscribe = null, email = "", onSaveEmail = null }) {
  const histKey = `aiHistory_${subject.replace(/\s+/g, "_").slice(0, 40)}`;
  const mkId = () => Date.now() + Math.random();
  const makeDefault = () => ({ r: "a", id: mkId(), text: `مرحباً! أنا مساعدك الذكي لمادة **${subject}**.\nاسألني عن الاختبارات، الواجبات، الملخصات، أو أي شيء آخر.`, ts: Date.now() });
  const [msgs, setMsgs] = useState(() => {
    const stored = storage.get(histKey, null);
    if (stored && stored.length > 0) return stored.map(m => ({ ...m, id: m.id || mkId() }));
    return [makeDefault()];
  });
  // A caller can hand the chat an opening question (the study tip does).
  // It lands in the box rather than being sent, so the student can edit it
  // or change their mind — nothing is spent on their behalf.
  const [inp, setInp] = useState(seed || "");
  const [loading, setLoading] = useState(false);
  // The email is owned by App and passed in. Two useStored hooks on one key
  // is a race — each keeps its own copy of the value and the loser writes its
  // stale one back — so there is exactly one owner and this is a prop.
  const aiEmail = email;
  const setAiEmail = onSaveEmail || (() => {});
  const [askEmail, setAskEmail] = useState(false);
  const [emailDraft, setEmailDraft] = useState("");
  const [gate, setGate] = useState(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/ai/usage")
      .then(r => r.json())
      .then(d => {
        if (cancelled || !d) return;
        setGate({
          subscribed: !!d.subscribed, limit: d.limit ?? 5, used: d.used ?? 0,
          remaining: d.subscribed ? Infinity : (d.remaining ?? d.limit ?? 5),
          resetAt: d.resetAt || 0,
          blocked: !d.subscribed && (d.remaining ?? 1) <= 0,
          costs: d.costs || null,
        });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);
  const blocked = !!(gate && !gate.subscribed && gate.blocked && !askEmail);
  // "خلال ٤٢ دقيقة" has to keep counting down, and the window has to lift
  // itself when it elapses — otherwise a student who waits it out still sees
  // the block and has to guess that reloading fixes it.
  const [, tick] = useState(0);
  useEffect(() => {
    if (!blocked || !gate?.resetAt) return;
    const id = setInterval(() => {
      if (Date.now() >= gate.resetAt) {
        setGate(g => (g ? { ...g, blocked: false, used: 0, remaining: g.limit, resetAt: 0 } : g));
      } else {
        tick(n => n + 1);
      }
    }, 30_000);
    return () => clearInterval(id);
  }, [blocked, gate?.resetAt, gate?.limit]);

  const [menuId, setMenuId] = useState(null);
  const [copied, setCopied] = useState(false);
  const [fileContext, setFileContext] = useState(null);
  const [fileCount, setFileCount] = useState(0);
  const [fileSugs, setFileSugs] = useState([]);
  const [recording, setRecording] = useState(false);
  const [hasSpeech, setHasSpeech] = useState(false);
  const recogRef = useRef(null);
  const endRef = useRef(null);
  // A photo of a question, waiting to be sent with the next message.
  const [image, setImage] = useState(null);
  const fileRef = useRef(null);

  /**
   * Read a chosen photo into a data URL, shrinking it first.
   *
   * A modern phone camera produces 4–12MB, which base64 inflates by a third —
   * far past what the request will carry. Downscaling to 1280px keeps the
   * writing on a page of a textbook legible while bringing the payload to a
   * few hundred KB, and it happens here so the student never meets a size
   * error for doing the obvious thing.
   */
  const pickImage = (file) => {
    if (!file) return;
    if (!/^image\//.test(file.type)) { onToast?.("اختر صورة", "warn"); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const MAX = 1280;
        const scale = Math.min(1, MAX / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
        const c = document.createElement("canvas");
        c.width = w; c.height = h;
        c.getContext("2d").drawImage(img, 0, 0, w, h);
        try {
          setImage(c.toDataURL("image/jpeg", 0.82));
        } catch {
          setImage(String(reader.result || ""));
        }
      };
      img.onerror = () => setImage(String(reader.result || ""));
      img.src = String(reader.result || "");
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    setHasSpeech(!!(typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition)));
  }, []);

  useEffect(() => {
    if (msgs.length > 1) storage.set(histKey, msgs.slice(-20));
  }, [msgs]);
  // Body must be braced: React stores whatever an effect returns as its
  // cleanup and calls it on the next run/unmount. A concise body returns
  // scrollIntoView's result, and any browser that returns a non-undefined
  // value there makes React throw "destroy is not a function", which unmounts
  // the whole app.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

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
    if (idx < 0) return;
    const base = msgs.slice(0, idx);
    setMsgs(base);
    setMenuId(null);
    setTimeout(() => send(text, base), 50);
  };

  /**
   * Ask the same question again.
   *
   * Offered on the *answer*, because that is where you are standing when you
   * decide the answer was no good — the alternative is scrolling up to your own
   * message and re-sending it, which is the same act with extra steps. It walks
   * back to the question above this reply and re-asks it, dropping the reply so
   * the new one takes its place rather than stacking underneath.
   */
  const retryAnswer = (id) => {
    const idx = msgs.findIndex(m => m.id === id);
    if (idx < 1) return;
    let q = idx - 1;
    while (q >= 0 && msgs[q].r !== "u") q--;
    if (q < 0) return;
    const text = msgs[q].text;
    const base = msgs.slice(0, q);
    setMsgs(base);
    setMenuId(null);
    setTimeout(() => send(text, base), 50);
  };

  /**
   * Change what you asked, and ask that instead.
   *
   * Everything after the edited message goes: the replies below it answered a
   * question that no longer exists, and leaving them would make the thread read
   * as though the assistant had answered something nobody asked.
   */
  const editMsg = (id, text) => {
    setMenuId(null);
    const next = window.prompt("عدّل رسالتك:", text);
    if (next === null) return;
    const trimmed = next.trim();
    if (!trimmed || trimmed === text) return;
    const idx = msgs.findIndex(m => m.id === id);
    if (idx < 0) return;
    const base = msgs.slice(0, idx);
    setMsgs(base);
    setTimeout(() => send(trimmed, base), 50);
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

  /**
   * Send a question.
   *
   * `base` is the thread to append to. It exists because "ask this again from
   * here" — resend, edit, another answer — has to drop everything below the
   * point it rewinds to, and `msgs` in this closure is whatever it was when
   * this function was created. Truncating with setMsgs and then calling send
   * looked right and did nothing: send rebuilt the list from its own stale
   * copy and appended, so the old question and its answer stayed and the new
   * pair piled up underneath. Resend has been doing that since it was written.
   * Passing the base explicitly is what makes the rewind real.
   */
  const send = async (q, base) => {
    const text = (q || inp).trim();
    if (!text || loading) return;
    // The email is asked for once and kept locally; the server checks its
    // shape and records it, so there is no point sending a question without it.
    if (!looksLikeEmail(aiEmail)) { setAskEmail(true); return; }
    if (gate && gate.blocked) { onSubscribe?.(gate); return; }
    setInp("");
    // The picture belongs to this question only; clearing it here stops the
    // next, unrelated question from silently carrying it — and being charged
    // the image price for it.
    const sentImage = image;
    setImage(null);
    const newMsg = { r: "u", id: mkId(), text, ts: Date.now(), image: sentImage || undefined };
    const newMsgs = [...(base || msgs), newMsg];
    setMsgs(newMsgs);
    setLoading(true);
    onChat?.();
    try {
      const history = newMsgs.slice(1).map(m => ({ role: m.r === "u" ? "user" : "assistant", content: m.text }));
      const res = await fetch("/api/ai", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, messages: history, fileContext, email: aiEmail, image: sentImage || undefined }),
      });
      const d = await res.json();
      // The server is the authority on what is left; mirror whatever it says.
      if (d.subscribed || d.remaining != null || d.resetAt) {
        setGate({
          subscribed: !!d.subscribed,
          limit: d.limit ?? 5,
          used: d.used ?? 0,
          remaining: d.subscribed ? Infinity : (d.remaining ?? 0),
          resetAt: d.resetAt || 0,
          blocked: !d.subscribed && d.need === "subscription",
        });
      }
      if (d.need === "email") { setAskEmail(true); setLoading(false); return; }
      if (d.need === "subscription") { onSubscribe?.({ used: d.used, limit: d.limit, resetAt: d.resetAt }); setLoading(false); return; }
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
          {/* "مسح" read as deleting something of yours; it starts a fresh
              conversation, which is a different promise. */}
          <button onClick={clearChat} title="ابدأ محادثة جديدة" style={{ background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.2)", borderRadius: 8, padding: "5px 12px", fontSize: 12, color: "rgba(255,255,255,.8)", cursor: "pointer", fontFamily: "inherit", fontWeight: 600, flexShrink: 0, display: "flex", alignItems: "center", gap: 5 }}>
            <Plus size={13} /> محادثة جديدة
          </button>
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
                    <button style={menuBtnSt(false)} onMouseEnter={e => e.currentTarget.style.background = t.s2} onMouseLeave={e => e.currentTarget.style.background = "none"} onClick={() => editMsg(m.id, m.text)}>
                      <Edit3 size={14} color={P.gold} /> تعديل وإعادة الإرسال
                    </button>
                  )}
                  {isUser && !loading && (
                    <button style={menuBtnSt(false)} onMouseEnter={e => e.currentTarget.style.background = t.s2} onMouseLeave={e => e.currentTarget.style.background = "none"} onClick={() => resendMsg(m.id, m.text)}>
                      <RotateCcw size={14} color={P.green} /> إعادة الإرسال
                    </button>
                  )}
                  {!isUser && i > 0 && !loading && (
                    <button style={menuBtnSt(false)} onMouseEnter={e => e.currentTarget.style.background = t.s2} onMouseLeave={e => e.currentTarget.style.background = "none"} onClick={() => retryAnswer(m.id)}>
                      <RotateCcw size={14} color={P.green} /> إجابة أخرى
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

      {/* Email gate — asked once, then never again on this device */}
      {askEmail && (
        <div style={{ padding: "12px", background: t.s1, borderTop: `1px solid ${t.bd}`, flexShrink: 0, animation: "fadeUp .25s ease" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
            <Mail size={14} color={P.blue2} />
            <span style={{ fontSize: 13, fontWeight: 800, color: t.tx }}>بريدك الإلكتروني للمتابعة</span>
          </div>
          <div style={{ fontSize: 11.5, color: t.mu, lineHeight: 1.7, marginBottom: 9 }}>
            يُحفظ على جهازك ويُستخدم لطلبات الاشتراك — يُطلب مرة واحدة فقط.
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={emailDraft} onChange={e => setEmailDraft(e.target.value)} placeholder="you@example.com"
              onKeyDown={e => { if (e.key === "Enter" && looksLikeEmail(emailDraft)) { setAiEmail(emailDraft.trim()); setAskEmail(false); } }}
              style={{ flex: 1, border: `1.5px solid ${t.bd}`, borderRadius: 12, padding: "10px 14px", fontSize: 13, outline: "none", direction: "ltr", textAlign: "left", fontFamily: "inherit", color: t.tx, background: t.s2, minWidth: 0 }} />
            <Btn variant="primary" size="sm" disabled={!looksLikeEmail(emailDraft)}
              onClick={() => { setAiEmail(emailDraft.trim()); setAskEmail(false); }}>حفظ</Btn>
          </div>
        </div>
      )}

      {/* Counting down — a bar, so "3 of 5" reads at a glance rather than
          having to be parsed. The server's number, never a local guess. */}
      {gate && !gate.subscribed && !gate.blocked && !askEmail && (
        <div style={{ padding: "8px 12px", background: t.s1, borderTop: `1px solid ${t.bd}`, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
            <Sparkles size={12} color={gate.remaining <= 1 ? P.orange : t.mu} style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 11.5, color: gate.remaining <= 1 ? P.orange : t.mu, fontWeight: gate.remaining <= 1 ? 800 : 600, flex: 1, minWidth: 0 }}>
              {gate.remaining === 1 ? "بقي سؤال واحد" : `بقي ${gate.remaining} من ${gate.limit} أسئلة`}
            </span>
            {onSubscribe && (
              <button onClick={() => onSubscribe(gate)} style={{
                background: "transparent", border: `1px solid ${t.bd}`, borderRadius: 14,
                padding: "3px 11px", cursor: "pointer", fontFamily: "inherit",
                fontSize: 11.5, fontWeight: 800, color: P.blue2, flexShrink: 0,
              }}>اشتراك</button>
            )}
          </div>
          <div style={{ height: 3, borderRadius: 2, background: t.bd, overflow: "hidden" }}>
            <div style={{
              height: "100%", width: `${Math.max(0, Math.min(100, (gate.remaining / (gate.limit || 1)) * 100))}%`,
              background: gate.remaining <= 1 ? P.orange : P.blue2, borderRadius: 2, transition: "width .3s ease",
              marginRight: 0, marginLeft: "auto",
            }} />
          </div>
        </div>
      )}

      {/* Out of questions. This replaces the composer rather than sitting above
          it: a text box you can still type into, whose Send does nothing but
          reopen a sheet, reads as broken. Say what happened, when it comes
          back, and the one thing that lifts it now. */}
      {gate && !gate.subscribed && gate.blocked && !askEmail && (
        <div style={{ padding: "16px 14px", background: t.s1, borderTop: `1px solid ${t.bd}`, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 7 }}>
            <div style={{ width: 28, height: 28, borderRadius: 9, background: `${P.orange}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Sparkles size={15} color={P.orange} />
            </div>
            <div style={{ fontSize: 14, fontWeight: 900, color: t.tx }}>انتهت أسئلتك المجانية</div>
          </div>
          <div style={{ fontSize: 12.5, color: t.mu, lineHeight: 1.85, marginBottom: 12 }}>
            استخدمت {gate.limit} من {gate.limit} أسئلة.
            {gate.resetAt ? <> تعود مجاناً <strong style={{ color: t.tx }}>{untilLabel(gate.resetAt)}</strong>.</> : null}
            {onSubscribe ? " أو اشترك الآن وتسأل بلا حدّ." : ""}
          </div>
          {onSubscribe && (
            <Btn variant="primary" onClick={() => onSubscribe(gate)} style={{ width: "100%" }}>
              <Sparkles size={14} /> اشترك — أسئلة بلا حدّ
            </Btn>
          )}
        </div>
      )}
      {gate?.subscribed && (
        <div style={{ padding: "7px 12px", background: `${P.green}10`, borderTop: `1px solid ${t.bd}`, flexShrink: 0, display: "flex", alignItems: "center", gap: 7 }}>
          <Check size={12} color={P.green} />
          <span style={{ fontSize: 11.5, color: P.green, fontWeight: 800 }}>اشتراكك فعّال — أسئلة بلا حدّ</span>
        </div>
      )}

      {/* The attached photo, shown before it is sent. An attachment you cannot
          see is one you cannot tell you attached twice, or attached by mistake. */}
      {image && !blocked && (
        <div style={{ padding: "8px 12px", background: t.s1, borderTop: `1px solid ${t.bd}`, display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <img src={image} alt="الصورة المرفقة" style={{ width: 46, height: 46, objectFit: "cover", borderRadius: 10, border: `1px solid ${t.bd}` }} />
          <div style={{ flex: 1, minWidth: 0, fontSize: 12, color: t.mu, lineHeight: 1.6 }}>
            صورة مرفقة — اكتب سؤالك عنها
            {gate?.costs?.image ? <span style={{ color: t.dim }}> · {gate.costs.image} نقاط</span> : null}
          </div>
          <button onClick={() => setImage(null)} aria-label="إزالة الصورة" style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex", color: P.red }}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* Input — hidden while blocked, since the card above has taken its place */}
      <div style={{ padding: "10px 12px", background: t.s1, borderTop: `1px solid ${t.bd}`, display: blocked ? "none" : "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }}
          onChange={e => { pickImage(e.target.files?.[0]); e.target.value = ""; }} />
        <button onClick={() => fileRef.current?.click()} title="أرفق صورة سؤال" aria-label="أرفق صورة" style={{
          width: 44, height: 44, borderRadius: "50%", border: "none", cursor: "pointer",
          background: image ? `${P.gold}25` : t.s3,
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <ImageIcon size={17} color={image ? P.gold : t.mu} />
        </button>
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
//
// The types are grouped, because "كويز" and "واجب" are not the same kind of
// thing to a student: one is graded on a date you cannot move, the other is a
// deliverable with a window. The groups drive the picker, the filter chips,
// and the default importance.
const TASK_GROUPS = [
  { id: "اختبارات", label: "اختبارات", Icon: FileQuestion, color: P.red,   types: ["كويز", "ميدترم", "فاينل"] },
  { id: "واجبات",  label: "واجبات",  Icon: FileText,     color: P.blue2, types: ["واجب", "اسايمنت", "مشروع", "بروجكت", "مناقشة", "عرض"] },
];
const CUSTOM_TYPE = "يدوي";
const TASK_TYPES = [...TASK_GROUPS.flatMap(g => g.types), CUSTOM_TYPE];
const EXAM_TYPES = TASK_GROUPS[0].types;
const groupOf = (ty) => TASK_GROUPS.find(g => g.types.includes(ty))?.id || "واجبات";
const isExamType = (ty) => EXAM_TYPES.includes(ty);

const TASK_TYPE_META = {
  "كويز": { color: P.gold, Icon: Zap },
  "ميدترم": { color: P.red, Icon: Calendar },
  "فاينل": { color: "#b91c1c", Icon: Award },
  "واجب": { color: P.blue2, Icon: FileText },
  "اسايمنت": { color: P.purple, Icon: FileText },
  "مشروع": { color: P.orange, Icon: Briefcase },
  "بروجكت": { color: P.orange, Icon: Briefcase },
  "مناقشة": { color: P.cyan, Icon: MessageCircle },
  "عرض": { color: P.purple, Icon: Monitor },
  [CUSTOM_TYPE]: { color: P.green, Icon: PenLine },
};
const typeMeta = (ty) => TASK_TYPE_META[ty] || TASK_TYPE_META[CUSTOM_TYPE];

/**
 * Titles worth offering for a type, so the common case is one tap.
 *
 * Students name these things the same way every term — "الكويز الأول",
 * "الواجب الثاني" — and typing that on a phone keyboard in Arabic is the
 * slowest part of adding a task. The field stays free text underneath.
 */
const TITLE_SUGGESTIONS = {
  "كويز": ["الكويز الأول", "الكويز الثاني", "الكويز الثالث"],
  "ميدترم": ["اختبار منتصف الفصل"],
  "فاينل": ["الاختبار النهائي"],
  "واجب": ["الواجب الأول", "الواجب الثاني", "الواجب الثالث"],
  "اسايمنت": ["Assignment 1", "Assignment 2"],
  "مشروع": ["مشروع الفصل", "المرحلة الأولى", "التسليم النهائي"],
  "بروجكت": ["Project Phase 1", "Final Project"],
  "مناقشة": ["مناقشة الأسبوع", "الردّ على الزملاء"],
  "عرض": ["العرض التقديمي"],
};

/**
 * Importance, stated as what it actually does.
 *
 * "عالي / متوسط / منخفض" told nobody anything — it was a coloured dot with no
 * visible effect. These three sort within each due-date bucket and say so in
 * the form, so the choice has a consequence you can see.
 */
const IMPORTANCE = [
  { id: "مهم جداً", rank: 0, color: P.red,    desc: "يظهر أولاً" },
  { id: "عادي",     rank: 1, color: P.blue2,  desc: "الترتيب الافتراضي" },
  { id: "لاحقاً",   rank: 2, color: P.green,  desc: "ينزل لآخر القائمة" },
];
const impMeta = (id) => IMPORTANCE.find(i => i.id === id) || IMPORTANCE[1];
// Older tasks used the abstract scale; map it rather than lose the choice.
const LEGACY_IMPORTANCE = { "عالي": "مهم جداً", "متوسط": "عادي", "منخفض": "لاحقاً" };
const normImportance = (tk) => LEGACY_IMPORTANCE[tk?.importance || tk?.priority] || tk?.importance || "عادي";

/** How far ahead a task reminder fires. */
const TASK_LEAD_CHOICES = [
  { mins: 60, label: "قبل ساعة" },
  { mins: 180, label: "قبل ٣ ساعات" },
  { mins: 1440, label: "قبل يوم" },
  { mins: 2880, label: "قبل يومين" },
  { mins: 10080, label: "قبل أسبوع" },
];
const taskLead = (tk) => (tk?.leadMins == null ? 1440 : Number(tk.leadMins));
const leadLabel = (m) => TASK_LEAD_CHOICES.find(c => c.mins === Number(m))?.label || `قبل ${m} دقيقة`;

/**
 * A task's deadline as a real instant.
 *
 * Tasks carry a date and, optionally, a closing time — an assignment that
 * shuts at 23:59 is a different thing from one due "that day". With no time
 * given, end-of-day is the honest reading.
 */
const taskDueAt = (tk) => {
  if (!tk?.dueDate) return null;
  const mins = timeToMin(tk.dueTime);
  const d = new Date(`${tk.dueDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  d.setMinutes(mins == null ? 23 * 60 + 59 : mins);
  return d;
};
const taskOpenAt = (tk) => {
  if (!tk?.openDate) return null;
  const mins = timeToMin(tk.openTime);
  const d = new Date(`${tk.openDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  d.setMinutes(mins == null ? 0 : mins);
  return d;
};
/** Has this task's window not opened yet? */
const taskNotOpenYet = (tk) => {
  const o = taskOpenAt(tk);
  return !!o && o.getTime() > Date.now();
};
/** "٥ سبتمبر" or "٥ سبتمبر ١١:٥٩ م" — the clock only when one was set. */
const fmtTaskWhen = (d) => {
  if (!d) return "";
  const date = d.toLocaleDateString("ar-SA-u-ca-gregory", { month: "short", day: "numeric" });
  const atEndOfDay = d.getHours() === 23 && d.getMinutes() === 59;
  if (atEndOfDay) return date;
  return `${date} ${d.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}`;
};

function TasksHub({ t, tasks, setTasks, exams, setExams, onToast, profile }) {
  const [showAdd, setShowAdd] = useState(false);
  const [filter, setFilter] = useState("الكل");
  const blank = () => ({
    title: "", type: "واجب", customType: "",
    subject: "", subjectCustomOn: false,
    // The track comes from the profile — a student's tasks belong to the
    // track they are enrolled in, and re-picking it on every task was busywork.
    track: trackLabel(profile) || "", trackManual: false,
    openDate: "", openTime: "", dueDate: "", dueTime: "",
    importance: "عادي", remind: true, leadMins: 1440,
  });
  const [nt, setNt] = useState(blank);
  const patch = (p) => setNt(x => ({ ...x, ...p }));
  const today = todayKey();

  // Keep the auto-filled track in step with the profile until it's overridden.
  useEffect(() => {
    setNt(x => (x.trackManual ? x : { ...x, track: trackLabel(profile) || "" }));
  }, [profile]);

  // One-time migration: fold legacy exams into the unified tasks list.
  useEffect(() => {
    if (!exams || exams.length === 0) return;
    setTasks(ts => {
      const ids = new Set((ts || []).map(x => x.id));
      const mapped = exams.map(e => ({
        id: e.id || (Date.now() + Math.floor(Math.random() * 1000)),
        title: e.subject || "اختبار",
        type: e.type === "نهائي" ? "فاينل" : isExamType(e.type) ? e.type : e.type === "مشروع" ? "مشروع" : CUSTOM_TYPE,
        track: "", subject: e.subject || "", dueDate: e.date || "", importance: "مهم جداً", done: false,
      })).filter(m => !ids.has(m.id));
      return [...(ts || []), ...mapped];
    });
    setExams([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const add = () => {
    if (!nt.title.trim()) return;
    const finalType = nt.type === CUSTOM_TYPE && nt.customType.trim() ? nt.customType.trim() : nt.type;
    setTasks(ts => [...(ts || []), {
      id: Date.now(), done: false,
      title: nt.title.trim(), type: finalType,
      track: nt.track, subject: nt.subject,
      openDate: nt.openDate, openTime: nt.openTime,
      dueDate: nt.dueDate, dueTime: nt.dueTime,
      importance: nt.importance,
      remind: nt.remind !== false, leadMins: Number(nt.leadMins ?? 1440),
    }]);
    setNt(blank());
    setShowAdd(false);
    onToast?.("تمت الإضافة +15 XP", "success");
  };
  const toggle = (id) => setTasks(ts => (ts || []).map(tk => tk.id === id ? { ...tk, done: !tk.done } : tk));
  const remove = (id) => setTasks(ts => (ts || []).filter(tk => tk.id !== id));
  const toggleRemind = (id) => setTasks(ts => (ts || []).map(tk => tk.id === id ? { ...tk, remind: tk.remind === false } : tk));

  const all = useMemo(() => (tasks || []).map(tk => ({
    ...tk, type: tk.type || "واجب", importance: normImportance(tk),
  })), [tasks]);

  const bucketOf = (tk) => {
    if (tk.done) return "منجزة";
    if (!tk.dueDate) return "بلا موعد";
    if (tk.dueDate < today) return "متأخرة";
    if (tk.dueDate === today) return "اليوم";
    return "قادمة";
  };
  const BUCKET_ORDER = ["متأخرة", "اليوم", "قادمة", "بلا موعد", "منجزة"];
  const bucketCol = { "متأخرة": P.red, "اليوم": P.orange, "قادمة": P.blue2, "بلا موعد": t.mu, "منجزة": P.green };

  const counts = useMemo(() => {
    const c = { الكل: all.length, اختبارات: 0, واجبات: 0, متأخرة: 0, اليوم: 0, منجزة: 0 };
    all.forEach(tk => {
      if (tk.done) { c.منجزة++; return; }
      c[isExamType(tk.type) ? "اختبارات" : "واجبات"]++;
      const b = bucketOf(tk);
      if (b === "متأخرة") c.متأخرة++;
      if (b === "اليوم") c.اليوم++;
    });
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, today]);

  // Chips grow with the list: only "الكل" is always there, and a filter
  // appears once there is something to filter. An empty board shows one chip,
  // not six that all lead nowhere.
  const chips = useMemo(() => {
    const out = [{ id: "الكل", n: counts.الكل, color: P.blue2 }];
    if (counts.متأخرة) out.push({ id: "متأخرة", n: counts.متأخرة, color: P.red });
    if (counts.اليوم) out.push({ id: "اليوم", n: counts.اليوم, color: P.orange });
    if (counts.اختبارات) out.push({ id: "اختبارات", n: counts.اختبارات, color: P.red });
    if (counts.واجبات) out.push({ id: "واجبات", n: counts.واجبات, color: P.blue2 });
    if (counts.منجزة) out.push({ id: "منجزة", n: counts.منجزة, color: P.green });
    return out;
  }, [counts]);

  // A filter that no longer has anything behind it shouldn't strand the view.
  useEffect(() => {
    if (!chips.some(c => c.id === filter)) setFilter("الكل");
  }, [chips, filter]);

  const filtered = all.filter(tk => {
    switch (filter) {
      case "اختبارات": return !tk.done && isExamType(tk.type);
      case "واجبات": return !tk.done && !isExamType(tk.type);
      case "متأخرة": return bucketOf(tk) === "متأخرة";
      case "اليوم": return bucketOf(tk) === "اليوم";
      case "منجزة": return tk.done;
      default: return true;
    }
  });

  // Bucket first, then importance — so "مهم جداً" visibly earns its label —
  // then the actual deadline instant.
  const sorted = [...filtered].sort((a, b) => {
    const ba = BUCKET_ORDER.indexOf(bucketOf(a)), bb = BUCKET_ORDER.indexOf(bucketOf(b));
    if (ba !== bb) return ba - bb;
    const ia = impMeta(a.importance).rank, ib = impMeta(b.importance).rank;
    if (ia !== ib) return ia - ib;
    return (taskDueAt(a)?.getTime() ?? 8.64e15) - (taskDueAt(b)?.getTime() ?? 8.64e15);
  });
  const pending = all.filter(tk => !tk.done).length;

  const renderTask = (task) => {
    const m = typeMeta(task.type);
    const due = taskDueAt(task);
    const isOverdue = !task.done && due && due.getTime() < Date.now();
    const days = task.dueDate
      ? Math.ceil((new Date(task.dueDate + "T12:00:00") - new Date(today + "T00:00:00")) / 86400000) : null;
    const cc = days == null ? t.mu : days <= 1 ? P.red : days <= 4 ? P.orange : P.green;
    const imp = impMeta(task.importance);
    const notOpen = taskNotOpenYet(task);
    return (
      <div style={{
        display: "flex", alignItems: "center", gap: 9, padding: "10px 11px",
        background: isOverdue ? `${P.red}08` : t.s2, borderRadius: 11,
        border: `1px solid ${isOverdue ? P.red + "40" : t.bd}`, opacity: task.done ? 0.5 : 1,
        borderRight: `3px solid ${task.done ? P.green : m.color}`,
      }}>
        <button onClick={() => toggle(task.id)} title={task.done ? "إلغاء الإنجاز" : "تحديد كمنجزة"} style={{ background: task.done ? `${P.green}20` : t.s1, border: `1.5px solid ${task.done ? P.green : t.bd}`, borderRadius: 6, width: 22, height: 22, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {task.done && <Check size={12} color={P.green} />}
        </button>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: `${m.color}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <m.Icon size={14} color={m.color} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: t.tx, textDecoration: task.done ? "line-through" : "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 5 }}>
            {!task.done && task.importance === "مهم جداً" && <Flag size={11} color={P.red} style={{ flexShrink: 0 }} />}
            {task.title}
          </div>
          <div style={{ fontSize: 11, color: t.mu, display: "flex", gap: 6, marginTop: 2, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ color: m.color, fontWeight: 800 }}>{task.type}</span>
            {task.subject && <span>{task.subject}</span>}
            {notOpen && <span style={{ color: P.cyan, fontWeight: 700 }}>يفتح {fmtTaskWhen(taskOpenAt(task))}</span>}
            {due && <span style={{ direction: "ltr", fontVariantNumeric: "tabular-nums" }}>{fmtTaskWhen(due)}</span>}
            {isOverdue && !task.done && <span style={{ color: P.red, fontWeight: 700 }}>أُغلق</span>}
          </div>
        </div>
        {!task.done && days != null && !isOverdue && (
          <div style={{ background: `${cc}18`, color: cc, borderRadius: 8, padding: "3px 8px", fontSize: 11.5, fontWeight: 800, flexShrink: 0, whiteSpace: "nowrap" }}>
            {days === 0 ? "اليوم" : days === 1 ? "غداً" : `${days} يوم`}
          </div>
        )}
        {!task.done && task.dueDate && (
          <button onClick={() => toggleRemind(task.id)}
            title={task.remind === false ? "تفعيل التذكير" : `التذكير ${leadLabel(taskLead(task))}`}
            style={{ background: task.remind === false ? `${t.mu}15` : `${P.gold}18`, border: "none", borderRadius: 7, padding: 5, cursor: "pointer", color: task.remind === false ? t.mu : P.gold, display: "flex", flexShrink: 0 }}>
            <Bell size={12} />
          </button>
        )}
        <span title={`${imp.id} — ${imp.desc}`} style={{ width: 7, height: 7, borderRadius: "50%", background: imp.color, flexShrink: 0 }} />
        <button onClick={() => remove(task.id)} title="حذف" style={{ background: "none", border: "none", cursor: "pointer", color: t.dim, display: "flex", padding: 2 }}>
          <X size={12} />
        </button>
      </div>
    );
  };

  const fieldStyle = { border: `1px solid ${t.bd}`, borderRadius: 8, padding: "8px 10px", fontSize: 13, background: t.s1, color: t.tx, fontFamily: "inherit", outline: "none", width: "100%", boxSizing: "border-box" };
  const labelStyle = { fontSize: 11.5, color: t.mu, fontWeight: 700, marginBottom: 5 };
  const suggestions = TITLE_SUGGESTIONS[nt.type] || [];

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

      {all.length > 0 && (() => {
        const doneCount = all.filter(tk => tk.done).length;
        const pct = Math.round((doneCount / all.length) * 100);
        const barCol = pct === 100 ? P.green : pct >= 50 ? P.blue2 : P.orange;
        return (
          <div style={{ background: t.s2, borderRadius: 13, padding: "11px 13px", marginBottom: 12, border: `1px solid ${t.bd}` }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 7 }}>
              <span style={{ fontSize: 12, color: t.mu, fontWeight: 700 }}>أنجزت {doneCount} من {all.length}</span>
              <span style={{ fontSize: 13, fontWeight: 900, color: barCol }}>{pct}%</span>
            </div>
            <div style={{ height: 7, background: t.s3, borderRadius: 4, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${pct}%`, background: `linear-gradient(90deg,${barCol},${barCol}bb)`, borderRadius: 4, transition: "width .6s ease" }} />
            </div>
            {pct === 100 && <div style={{ fontSize: 11, fontWeight: 800, color: P.green, marginTop: 8 }}>🎉 أنجزت كل مهامك</div>}
          </div>
        );
      })()}

      {/* Filter chips — grow with the list */}
      <div style={{ display: "flex", gap: 6, marginBottom: 12, overflowX: "auto", paddingBottom: 2 }}>
        {chips.map(c => {
          const active = filter === c.id;
          return (
            <button key={c.id} onClick={() => setFilter(c.id)} style={{
              padding: "5px 12px", borderRadius: 20, cursor: "pointer", fontFamily: "inherit",
              fontSize: 12.5, fontWeight: 700, whiteSpace: "nowrap",
              background: active ? c.color : t.s2,
              border: `1px solid ${active ? c.color : t.bd}`, color: active ? "#fff" : t.mu,
            }}>{c.id} ({c.n})</button>
          );
        })}
      </div>

      {showAdd && (
        <div style={{ background: t.s2, borderRadius: 12, padding: 12, marginBottom: 12, animation: "fadeUp .3s ease" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>

            {/* Type — grouped, because an exam and an assignment behave differently */}
            <div>
              <div style={labelStyle}>النوع</div>
              {TASK_GROUPS.map(g => (
                <div key={g.id} style={{ marginBottom: 7 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 800, color: g.color, marginBottom: 5 }}>
                    <g.Icon size={11} /> {g.label}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {g.types.map(ty => {
                      const m = typeMeta(ty); const active = nt.type === ty;
                      return (
                        <button key={ty} onClick={() => patch({
                          type: ty,
                          // Exams are the thing you cannot miss; start them there.
                          importance: isExamType(ty) ? "مهم جداً" : "عادي",
                        })} style={{
                          display: "flex", alignItems: "center", gap: 5, padding: "6px 10px", borderRadius: 9, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700,
                          background: active ? `${m.color}18` : t.s1, border: `1.5px solid ${active ? m.color : t.bd}`, color: active ? m.color : t.mu,
                        }}><m.Icon size={12} /> {ty}</button>
                      );
                    })}
                  </div>
                </div>
              ))}
              <button onClick={() => patch({ type: CUSTOM_TYPE })} style={{
                display: "flex", alignItems: "center", gap: 5, padding: "6px 10px", borderRadius: 9, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700,
                background: nt.type === CUSTOM_TYPE ? `${P.green}18` : t.s1, border: `1.5px solid ${nt.type === CUSTOM_TYPE ? P.green : t.bd}`, color: nt.type === CUSTOM_TYPE ? P.green : t.mu,
              }}><PenLine size={12} /> نوع آخر (يدوي)</button>
              {nt.type === CUSTOM_TYPE && (
                <input autoFocus placeholder="اكتب النوع (مثال: تقرير معمل)" value={nt.customType} onChange={e => patch({ customType: e.target.value })}
                  style={{ ...fieldStyle, marginTop: 8, border: `1.5px solid ${P.green}`, direction: "rtl" }} />
              )}
            </div>

            {/* Title — pick a usual one or write your own */}
            <div>
              <div style={labelStyle}>العنوان</div>
              {suggestions.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 7 }}>
                  {suggestions.map(s => {
                    const active = nt.title === s;
                    return (
                      <button key={s} onClick={() => patch({ title: active ? "" : s })} style={{
                        padding: "5px 10px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700,
                        background: active ? `${P.blue2}18` : t.s1, border: `1.5px solid ${active ? P.blue2 : t.bd}`, color: active ? P.blue2 : t.mu,
                      }}>{s}</button>
                    );
                  })}
                </div>
              )}
              <input placeholder="أو اكتب عنواناً" value={nt.title} onChange={e => patch({ title: e.target.value })}
                style={{ ...fieldStyle, direction: "rtl" }} />
            </div>

            {/* Track — filled in from the profile, editable if this one differs */}
            <div>
              <div style={labelStyle}>المسار</div>
              {nt.trackManual ? (
                <input autoFocus placeholder="اكتب المسار" value={nt.track} onChange={e => patch({ track: e.target.value })}
                  style={{ ...fieldStyle, border: `1.5px solid ${P.purple}`, direction: "rtl" }} />
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 8, background: t.s1, border: `1px solid ${t.bd}`, borderRadius: 8, padding: "8px 10px" }}>
                  <GradCap size={13} color={P.purple} style={{ flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 12.5, fontWeight: 700, color: nt.track ? t.tx : t.dim, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {nt.track || "لم تختر مسارك بعد"}
                  </span>
                  <button onClick={() => patch({ trackManual: true, track: "" })} style={{ background: "none", border: "none", cursor: "pointer", color: P.purple, fontFamily: "inherit", fontSize: 11.5, fontWeight: 800, flexShrink: 0 }}>تغيير</button>
                </div>
              )}
              {nt.trackManual && (
                <button onClick={() => patch({ trackManual: false, track: trackLabel(profile) || "" })} style={{ marginTop: 6, background: "none", border: "none", cursor: "pointer", color: t.mu, fontFamily: "inherit", fontSize: 11.5, fontWeight: 700, padding: 0 }}>
                  ← استخدم مساري من ملفي
                </button>
              )}
            </div>

            <div>
              <div style={labelStyle}>المادة (اختياري)</div>
              <select value={nt.subjectCustomOn ? "__custom__" : nt.subject} onChange={e => {
                const v = e.target.value;
                if (v === "__custom__") patch({ subjectCustomOn: true, subject: "" });
                else patch({ subjectCustomOn: false, subject: v });
              }} style={{ ...fieldStyle, direction: "rtl" }}>
                <option value="">— بلا مادة —</option>
                {ALL_SUBJECTS_LIST.map(s => <option key={s} value={s}>{s}</option>)}
                <option value="__custom__">➕ مادة مخصصة…</option>
              </select>
              {nt.subjectCustomOn && (
                <input autoFocus placeholder="اكتب اسم المادة" value={nt.subject} onChange={e => patch({ subject: e.target.value })}
                  style={{ ...fieldStyle, marginTop: 7, border: `1.5px solid ${P.blue2}`, direction: "rtl" }} />
              )}
            </div>

            {/* The window: when it opens, when it closes */}
            <div>
              <div style={labelStyle}>يفتح (اختياري)</div>
              <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 8 }}>
                <input type="date" value={nt.openDate} onChange={e => patch({ openDate: e.target.value })} style={fieldStyle} />
                <input type="time" value={nt.openTime} onChange={e => patch({ openTime: e.target.value })} style={fieldStyle} />
              </div>
            </div>
            <div>
              <div style={labelStyle}>يُغلق</div>
              <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 8 }}>
                <input type="date" value={nt.dueDate} onChange={e => patch({ dueDate: e.target.value })} style={fieldStyle} />
                <input type="time" value={nt.dueTime} onChange={e => patch({ dueTime: e.target.value })} style={fieldStyle} />
              </div>
              {nt.dueDate && !nt.dueTime && (
                <div style={{ fontSize: 11, color: t.dim, marginTop: 5 }}>بلا وقت = نهاية اليوم (١١:٥٩ م)</div>
              )}
            </div>

            {/* Reminder */}
            {nt.dueDate && (
              <div>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: t.tx, cursor: "pointer", marginBottom: nt.remind !== false ? 7 : 0 }}>
                  <input type="checkbox" checked={nt.remind !== false} onChange={e => patch({ remind: e.target.checked })} style={{ accentColor: P.gold, width: 16, height: 16 }} />
                  <Bell size={14} color={P.gold} /> ذكّرني قبل الإغلاق
                </label>
                {nt.remind !== false && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {TASK_LEAD_CHOICES.map(({ mins, label }) => {
                      const active = Number(nt.leadMins) === mins;
                      return (
                        <button key={mins} onClick={() => patch({ leadMins: mins })} style={{
                          padding: "6px 11px", borderRadius: 9, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700,
                          background: active ? `${P.gold}20` : t.s1, border: `1.5px solid ${active ? P.gold : t.bd}`, color: active ? P.gold : t.mu,
                        }}>{label}</button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Importance — labelled by what it does */}
            <div>
              <div style={labelStyle}>الأهمية <span style={{ fontWeight: 600, color: t.dim }}>— تُرتِّب مهامك داخل كل مجموعة</span></div>
              <div style={{ display: "flex", gap: 6 }}>
                {IMPORTANCE.map(({ id, color, desc }) => {
                  const active = nt.importance === id;
                  return (
                    <button key={id} onClick={() => patch({ importance: id })} style={{
                      flex: 1, padding: "7px 4px", borderRadius: 9, cursor: "pointer", fontFamily: "inherit",
                      border: `1.5px solid ${active ? color : t.bd}`, background: active ? `${color}15` : t.s1,
                      color: active ? color : t.mu,
                    }}>
                      <div style={{ fontSize: 12.5, fontWeight: 800 }}>{id}</div>
                      <div style={{ fontSize: 9.5, fontWeight: 600, marginTop: 2, opacity: 0.9 }}>{desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <Btn variant="ghost" size="sm" onClick={() => { setNt(blank()); setShowAdd(false); }} style={{ flex: 1 }}>إلغاء</Btn>
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
          <div>{filter === "الكل" ? "لا مهام بعد، أضف مهمتك الأولى" : `لا شيء في «${filter}»`}</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 340, overflowY: "auto" }}>
          {(() => {
            let last = null;
            return sorted.slice(0, 20).map(task => {
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
// A lecture "room" is a link when it has a scheme OR simply looks like a
// domain — people paste "meet.google.com/abc" far more often than the full
// https:// form, and requiring the scheme hid the join button entirely.
const isUrl = (s) => {
  const v = (s || "").trim();
  if (!v) return false;
  if (/^https?:\/\//i.test(v)) return true;
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+(\/|$|\?)/i.test(v);
};
// Always hand the browser an absolute URL; a bare domain in href would be
// treated as a path on our own site and go nowhere.
const linkHref = (s) => {
  const v = (s || "").trim();
  return /^https?:\/\//i.test(v) ? v : "https://" + v.replace(/^\/+/, "");
};
const fmtCountdown = (mins) => {
  if (mins <= 0) return "الآن";
  if (mins < 60) return `خلال ${mins} دقيقة`;
  if (mins < 1440) { const h = Math.floor(mins / 60), mm = mins % 60; return `خلال ${h} ساعة${mm ? ` و${mm} د` : ""}`; }
  const d = Math.floor(mins / 1440); return `خلال ${d} يوم`;
};

/* ── Timetable geometry ───────────────────────────────────────
   The weekly grid puts time on the vertical axis, so a lecture's position
   and height have to come from real minutes. Everything below turns the
   stored "HH:MM" + duration into pixels.                                  */

const DURATION_CHOICES = [30, 50, 60, 90, 120, 180];
// Lectures saved before durations existed were all treated as a single slot.
const LECTURE_DEFAULT_MIN = 50;
const lectureMinutes = (lec) => {
  const d = Number(lec?.duration);
  return Number.isFinite(d) && d > 0 ? d : LECTURE_DEFAULT_MIN;
};
/** "HH:MM" → minutes past midnight, or null when unparseable. */
const timeToMin = (s) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec((s || "").trim());
  if (!m) return null;
  const h = +m[1], mi = +m[2];
  if (h > 23 || mi > 59) return null;
  return h * 60 + mi;
};
const minToTime = (n) => `${String(Math.floor(n / 60) % 24).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
const fmtDuration = (min) => {
  if (min < 60) return `${min} د`;
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `${h} س ${m} د` : `${h} ساعة`;
};

/**
 * The hour window the grid should draw.
 *
 * Fitting it to the lectures that exist keeps the timetable dense: a student
 * whose day runs 08:00–14:00 shouldn't scroll past an empty midnight. Falls
 * back to a normal teaching day when nothing is scheduled yet.
 */
function gridWindow(schedule) {
  let lo = Infinity, hi = -Infinity;
  (schedule || []).forEach(lec => {
    const start = timeToMin(lec.time);
    if (start == null) return;
    lo = Math.min(lo, start);
    hi = Math.max(hi, start + lectureMinutes(lec));
  });
  if (!Number.isFinite(lo)) return { from: 8 * 60, to: 16 * 60 };
  // Snap outward to whole hours so the labels line up with the rules.
  return { from: Math.floor(lo / 60) * 60, to: Math.max(Math.ceil(hi / 60) * 60, Math.floor(lo / 60) * 60 + 120) };
}

/**
 * Lay one day's lectures out, splitting the column between any that overlap.
 *
 * Two lectures at the same hour would otherwise draw on top of each other and
 * one would be invisible. Overlapping runs are grouped, and each member takes
 * an equal share of the width — the standard calendar treatment.
 */
function layoutDay(lecs) {
  const items = (lecs || [])
    .map(lec => {
      const start = timeToMin(lec.time);
      return start == null ? null : { lec, start, end: start + lectureMinutes(lec) };
    })
    .filter(Boolean)
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const out = [];
  let group = [], groupEnd = -Infinity;
  const flush = () => {
    group.forEach((it, i) => out.push({ ...it, cols: group.length, col: i }));
    group = []; groupEnd = -Infinity;
  };
  items.forEach(it => {
    if (group.length && it.start >= groupEnd) flush();
    group.push(it);
    groupEnd = Math.max(groupEnd, it.end);
  });
  flush();
  return out;
}

/**
 * The weekly timetable — time on the vertical axis, days across.
 *
 * The old "grid" was a column of cards per day, so an 08:00 lecture and a
 * 14:00 one sat in the same place and a three-hour gap looked identical to a
 * ten-minute one. Here every lecture is positioned and sized by real minutes,
 * which is the whole point of looking at a week at once: you see your gaps,
 * your long days, and where two things collide.
 */
function WeekGrid({ schedule, DAYS, DAY_COLORS, todayAr, nowTick, t }) {
  const PX_PER_MIN = 1.05;            // ~63px an hour: a 50-min lecture stays readable
  const HEAD = 42;                    // day-header height
  const { from, to } = useMemo(() => gridWindow(schedule), [schedule]);
  const height = (to - from) * PX_PER_MIN;
  const hours = [];
  for (let m = from; m <= to; m += 60) hours.push(m);

  const byDay = useMemo(() => {
    const map = {};
    DAYS.forEach(d => { map[d] = layoutDay((schedule || []).filter(l => l.day === d)); });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schedule, DAYS]);

  // The "now" line, drawn only when the current time is inside the window and
  // today is a column. nowTick re-runs this every 30s with the countdown.
  const nowMin = useMemo(() => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nowTick]);
  const showNow = DAYS.includes(todayAr) && nowMin >= from && nowMin <= to;

  // Only two or three columns fit on a phone, so today can start off-screen.
  // Bring it into view once, without the vertical jump scrollIntoView causes.
  //
  // Measured with getBoundingClientRect and moved with scrollBy on purpose:
  // scrollLeft in an RTL scroller runs from a negative minimum up to 0 in this
  // engine and 0..max in others, so any arithmetic on offsetLeft/scrollWidth
  // is convention-dependent and silently clamps to a no-op. Viewport rects and
  // a relative delta mean the same thing everywhere.
  const scrollerRef = useRef(null);
  const todayRef = useRef(null);
  useEffect(() => {
    const box = scrollerRef.current, col = todayRef.current;
    if (!box || !col) return;
    const b = box.getBoundingClientRect(), c = col.getBoundingClientRect();
    const delta = (c.left + c.width / 2) - (b.left + b.width / 2);
    if (Math.abs(delta) > 4) box.scrollBy({ left: delta, behavior: "smooth" });
  }, [todayAr]);

  return (
    <div style={{ marginBottom: 8 }}>
      <div ref={scrollerRef} style={{ overflowX: "auto", paddingBottom: 8, scrollbarWidth: "thin" }}>
        <div style={{ display: "flex", minWidth: "min-content", position: "relative" }}>
          {/* Time gutter — first in RTL flow, so it sits on the right. Sticky,
              because the days now scroll under it and times you can't see
              turn the whole grid back into guesswork. */}
          <div style={{
            width: 46, flexShrink: 0, position: "sticky", right: 0, zIndex: 4,
            paddingTop: HEAD, background: t.bg,
          }}>
            <div style={{ height, position: "relative" }}>
              {hours.map(m => (
                <div key={m} style={{
                  position: "absolute", top: (m - from) * PX_PER_MIN, insetInlineStart: 0, insetInlineEnd: 6,
                  transform: "translateY(-50%)", fontSize: 10.5, fontWeight: 700,
                  color: t.dim, textAlign: "left", direction: "ltr", fontVariantNumeric: "tabular-nums",
                }}>{minToTime(m)}</div>
              ))}
            </div>
          </div>

          {DAYS.map(day => {
            const isToday = day === todayAr;
            const dc = DAY_COLORS[day];
            const laid = byDay[day] || [];
            return (
              <div key={day} ref={isToday ? todayRef : undefined} style={{ width: 124, flexShrink: 0, marginInlineStart: 6 }}>
                <div style={{
                  height: HEAD, borderRadius: "10px 10px 0 0", display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center",
                  background: isToday ? dc : `${dc}18`, border: `1px solid ${isToday ? dc : dc + "30"}`, borderBottom: "none",
                }}>
                  <div style={{ fontSize: 12.5, fontWeight: 900, color: isToday ? "#fff" : dc }}>{day}</div>
                  <div style={{ fontSize: 9.5, color: isToday ? "rgba(255,255,255,.85)" : t.mu }}>
                    {isToday ? "اليوم" : laid.length ? `${laid.length} محاضرة` : "فارغ"}
                  </div>
                </div>

                <div style={{
                  position: "relative", height, background: isToday ? `${dc}0a` : t.s2,
                  border: `1px solid ${dc}30`, borderTop: "none", borderRadius: "0 0 10px 10px", overflow: "hidden",
                }}>
                  {/* Hour rules, so the eye can read a card's height as time */}
                  {hours.map(m => (
                    <div key={m} style={{
                      position: "absolute", top: (m - from) * PX_PER_MIN, left: 0, right: 0,
                      height: 1, background: t.bd, opacity: 0.55,
                    }} />
                  ))}

                  {isToday && showNow && (
                    <div style={{ position: "absolute", top: (nowMin - from) * PX_PER_MIN, left: 0, right: 0, height: 2, background: P.red, zIndex: 3 }}>
                      <div style={{ position: "absolute", insetInlineEnd: 0, top: -3, width: 8, height: 8, borderRadius: "50%", background: P.red }} />
                    </div>
                  )}

                  {laid.map(({ lec, start, end, cols, col }) => {
                    const online = lec.mode === "أونلاين";
                    const mc = online ? P.blue2 : P.green;
                    const mins = end - start;
                    const joinable = online && isUrl(lec.room);
                    // Overlapping lectures share the width instead of hiding
                    // one another; 2% gutters keep the split legible.
                    const w = 100 / cols;
                    // A flex column with the time and place fixed and the
                    // title free to shrink: on a short card the subject name
                    // truncates cleanly instead of the room being sliced in
                    // half at the bottom edge.
                    const card = (
                      <>
                        <div style={{ flexShrink: 0, lineHeight: 1.15, fontSize: 10, fontWeight: 900, color: mc, direction: "ltr", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                          {lec.time}–{minToTime(end)}
                        </div>
                        <div style={{
                          flex: "1 1 auto", minHeight: 0, margin: "1px 0",
                          fontSize: 11.5, fontWeight: 800, color: t.tx, lineHeight: 1.28,
                          overflow: "hidden", display: "-webkit-box", WebkitLineClamp: mins >= 90 ? 3 : 2, WebkitBoxOrient: "vertical",
                        }}>{lec.course}</div>
                        <div style={{ flexShrink: 0, lineHeight: 1.15, display: "flex", alignItems: "center", gap: 3, fontSize: 9, fontWeight: 800, color: mc, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                          {online ? <Monitor size={9} /> : <MapPin size={9} />}
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                            {online ? (joinable ? "دخول" : "أونلاين") : (lec.room && !isUrl(lec.room) ? lec.room : "حضوري")}
                          </span>
                        </div>
                      </>
                    );
                    const style = {
                      position: "absolute",
                      top: (start - from) * PX_PER_MIN + 1,
                      height: Math.max(mins * PX_PER_MIN - 2, 44),
                      insetInlineStart: `${col * w}%`, width: `calc(${w}% - 3px)`,
                      background: t.s1, border: `1px solid ${mc}40`, borderInlineEnd: `3px solid ${mc}`,
                      borderRadius: 7, padding: "3px 6px", overflow: "hidden",
                      textAlign: "right", fontFamily: "inherit", textDecoration: "none",
                      display: "flex", flexDirection: "column", boxSizing: "border-box", zIndex: 2,
                    };
                    return joinable ? (
                      <a key={lec.id} href={linkHref(lec.room)} target="_blank" rel="noopener noreferrer"
                        title={`${lec.course} — ${lec.time} (${fmtDuration(mins)}) — دخول المحاضرة`} style={{ ...style, cursor: "pointer" }}>
                        {card}
                      </a>
                    ) : (
                      <div key={lec.id} title={`${lec.course} — ${lec.time} (${fmtDuration(mins)})`} style={style}>
                        {card}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", fontSize: 11, color: t.mu, padding: "0 2px" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 9, height: 9, borderRadius: 2, background: P.green }} /> حضوري
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 9, height: 9, borderRadius: 2, background: P.blue2 }} /> أونلاين
        </span>
        {showNow && (
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 12, height: 2, background: P.red }} /> الآن
          </span>
        )}
        <span style={{ marginInlineStart: "auto", color: t.dim }}>ارتفاع البطاقة = مدة المحاضرة</span>
      </div>
    </div>
  );
}

function SchedulePage({ t, schedule, setSchedule, onToast }) {
  const [showAdd, setShowAdd] = useState(false);
  const [view, setView] = useSyncedSetting("scheduleView", "schedule_view", "list"); // list | grid
  const [newLec, setNewLec] = useState({ course: "", customCourse: false, day: "الأحد", time: "08:00", duration: LECTURE_DEFAULT_MIN, room: "", mode: "حضوري", remind: true, remindMin: 5 });
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

  // Off is a local preference, not a permission: a browser will not hand back
  // an already-granted permission, so "turn it off" has to mean "stop sending
  // them" rather than "revoke". And once a browser has been told no, asking
  // again silently does nothing — so say where the setting lives instead of
  // firing a request that cannot succeed and looks broken.
  const toggleNotifs = async () => {
    if (typeof Notification === "undefined") { onToast?.("متصفحك لا يدعم التنبيهات", "warn"); return; }
    if (notifPerm === "granted") {
      setNotifPerm("off");
      stopRinging();
      onToast?.("أُوقفت تنبيهات المحاضرات — اضغط مرة أخرى لإعادتها", "info");
      return;
    }
    if (notifPerm === "denied") {
      onToast?.("المتصفح يمنع التنبيهات — فعّلها من إعدادات الموقع في متصفحك", "warn");
      return;
    }
    if (notifPerm === "off") {
      // Permission is still granted underneath; this only lifts our own pause.
      setNotifPerm(Notification.permission);
      onToast?.("عادت تنبيهات المحاضرات ✅", "success");
      return;
    }
    try {
      const p = await Notification.requestPermission();
      setNotifPerm(p);
      onToast?.(p === "granted" ? "تم تفعيل التنبيهات ✅" : "لم يُمنح إذن التنبيهات", p === "granted" ? "success" : "warn");
    } catch { onToast?.("تعذّر تفعيل التنبيهات", "error"); }
  };

  const addLecture = () => {
    if (!newLec.course.trim()) return;
    setSchedule(s => [...(s || []), {
      ...newLec,
      remindMin: Number(newLec.remindMin ?? 5),
      duration: Number(newLec.duration) || LECTURE_DEFAULT_MIN,
      id: Date.now(),
    }]);
    setNewLec({ course: "", customCourse: false, day: "الأحد", time: "08:00", duration: LECTURE_DEFAULT_MIN, room: "", mode: "حضوري", remind: true, remindMin: 5 });
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
            <a href={linkHref(nextLec.lec.room)} target="_blank" rel="noopener noreferrer" style={{ marginTop: 10, display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,.15)", color: "#fff", borderRadius: 9, padding: "7px 14px", fontSize: 12.5, fontWeight: 700, textDecoration: "none" }}>
              <Play size={13} /> دخول المحاضرة
            </a>
          )}
        </div>
      )}

      {/* Notifications enable prompt */}
      {/* A switch, not a one-off prompt.
          This used to render only while permission was ungranted and then
          vanish for good: no way to turn reminders off afterwards, and no way
          back on for anyone who dismissed the browser dialog once. The owner's
          objection — that it tells you to go and enable something instead of
          letting you — was about exactly that. It stays put and reads its own
          state, so the answer to "are reminders on?" is always on screen. */}
      {notifPerm !== "unsupported" && (schedule || []).length > 0 && (() => {
        const on = notifPerm === "granted";
        const denied = notifPerm === "denied";
        return (
          <button onClick={toggleNotifs} style={{
            width: "100%", display: "flex", alignItems: "center", gap: 10, textAlign: "right",
            background: on ? `${P.green}12` : `${P.gold}12`,
            border: `1px solid ${on ? P.green + "45" : P.gold + "40"}`,
            color: t.tx, borderRadius: 12, padding: "11px 14px", marginBottom: 14,
            cursor: "pointer", fontFamily: "inherit",
          }}>
            <Bell size={16} color={on ? P.green : P.gold} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 800 }}>
                {on ? "تنبيهات المحاضرات مفعّلة" : "تنبيهات المحاضرات متوقّفة"}
              </div>
              <div style={{ fontSize: 11, color: t.mu, marginTop: 2, lineHeight: 1.5 }}>
                {on ? "اضغط للإيقاف" : denied ? "المتصفح رافضها — اضغط لمعرفة كيف تسمح بها" : "اضغط للتفعيل"}
              </div>
            </div>
            <div style={{
              width: 42, height: 24, borderRadius: 12, flexShrink: 0, position: "relative",
              background: on ? P.green : t.bd, transition: "background .2s",
            }}>
              <div style={{
                position: "absolute", top: 3, insetInlineStart: on ? 21 : 3,
                width: 18, height: 18, borderRadius: "50%", background: "#fff",
                transition: "inset-inline-start .2s",
              }} />
            </div>
          </button>
        );
      })()}

      {view === "list" && DAYS.map(day => {
        // Sort on parsed minutes: a lecture saved without a time would make
        // localeCompare throw on undefined.
        const dayLecs = (schedule || []).filter(l => l.day === day)
          .sort((a, b) => (timeToMin(a.time) ?? 1e9) - (timeToMin(b.time) ?? 1e9));
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
                      <span style={{ direction: "ltr", display: "inline-block", fontVariantNumeric: "tabular-nums" }}>
                        {lec.time}{timeToMin(lec.time) != null && `–${minToTime(timeToMin(lec.time) + lectureMinutes(lec))}`}
                      </span>
                      {` • ${fmtDuration(lectureMinutes(lec))}`}
                      {lec.room && !isUrl(lec.room) ? ` • ${lec.room}` : ""}
                    </div>
                  </div>
                  {online && isUrl(lec.room) && (
                    <a href={linkHref(lec.room)} target="_blank" rel="noopener noreferrer" title="دخول المحاضرة" style={{ background: `${P.blue2}18`, border: "none", borderRadius: 7, padding: 6, cursor: "pointer", color: P.blue2, display: "flex" }}>
                      <Play size={13} />
                    </a>
                  )}
                  <button onClick={() => toggleRemind(lec.id)} title={lec.remind === false ? "تفعيل التذكير" : `التذكير: ${remindLabel(lectureLead(lec))}`} style={{ background: lec.remind === false ? `${t.mu}15` : `${P.gold}18`, border: "none", borderRadius: 7, padding: 6, cursor: "pointer", color: lec.remind === false ? t.mu : P.gold, display: "flex" }}>
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
          <WeekGrid
            schedule={schedule} DAYS={DAYS} DAY_COLORS={DAY_COLORS}
            todayAr={todayAr} nowTick={nowTick} t={t}
          />
        )
      )}

      {showAdd ? (
        <div style={{ background: t.s1, borderRadius: 16, padding: 14, border: `1px solid ${t.bd}`, marginTop: 8, animation: "fadeUp .3s ease" }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: t.tx, marginBottom: 10 }}>إضافة محاضرة جديدة</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {/* Course: pick from the full catalogue, or type one that isn't in it */}
            <div style={{ fontSize: 11.5, color: t.mu, fontWeight: 700 }}>المادة</div>
            <select value={ALL_SUBJECTS_LIST.includes(newLec.course) ? newLec.course : (newLec.course ? "__custom" : "")}
              onChange={e => {
                const v = e.target.value;
                setNewLec(p => ({ ...p, course: v === "__custom" ? "" : v, customCourse: v === "__custom" }));
              }}
              style={{ border: `1px solid ${t.bd}`, borderRadius: 8, padding: "8px 10px", fontSize: 13, background: t.s2, color: t.tx, fontFamily: "inherit", direction: "rtl", outline: "none" }}>
              <option value="">اختر المادة…</option>
              {ALL_SUBJECTS_LIST.map(s => <option key={s} value={s}>{s}</option>)}
              <option value="__custom">✏️ مادة أخرى (كتابة يدوية)</option>
            </select>
            {(newLec.customCourse || (newLec.course && !ALL_SUBJECTS_LIST.includes(newLec.course))) && (
              <input autoFocus placeholder="اكتب اسم المادة" value={newLec.course} onChange={e => setNewLec(p => ({ ...p, course: e.target.value }))}
                style={{ border: `1.5px solid ${P.blue2}`, borderRadius: 8, padding: "8px 10px", fontSize: 13, background: t.s2, color: t.tx, fontFamily: "inherit", direction: "rtl", outline: "none" }} />
            )}
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
            {/* Duration drives the card's height in the weekly grid, so the
                week reads at a glance instead of every lecture looking equal. */}
            <div>
              <div style={{ fontSize: 11.5, color: t.mu, fontWeight: 700, marginBottom: 5 }}>
                المدة {timeToMin(newLec.time) != null && (
                  <span style={{ color: t.dim, fontWeight: 600 }}>
                    — تنتهي {minToTime(timeToMin(newLec.time) + (Number(newLec.duration) || LECTURE_DEFAULT_MIN))}
                  </span>
                )}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {DURATION_CHOICES.map(min => {
                  const active = (Number(newLec.duration) || LECTURE_DEFAULT_MIN) === min;
                  return (
                    <button key={min} onClick={() => setNewLec(p => ({ ...p, duration: min }))} style={{
                      padding: "6px 11px", borderRadius: 9, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700,
                      background: active ? `${P.blue2}18` : t.s2, border: `1.5px solid ${active ? P.blue2 : t.bd}`, color: active ? P.blue2 : t.mu,
                    }}>{fmtDuration(min)}</button>
                  );
                })}
              </div>
            </div>
            <input placeholder={newLec.mode === "أونلاين" ? "رابط المحاضرة (Zoom / Teams)" : "القاعة (اختياري)"} value={newLec.room} onChange={e => setNewLec(p => ({ ...p, room: e.target.value }))}
              style={{ border: `1px solid ${t.bd}`, borderRadius: 8, padding: "8px 10px", fontSize: 13, background: t.s2, color: t.tx, fontFamily: "inherit", direction: newLec.mode === "أونلاين" ? "ltr" : "rtl", textAlign: newLec.mode === "أونلاين" ? "left" : "right", outline: "none" }} />
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: t.tx, cursor: "pointer", padding: "2px 2px" }}>
              <input type="checkbox" checked={newLec.remind !== false} onChange={e => setNewLec(p => ({ ...p, remind: e.target.checked }))} style={{ accentColor: P.gold, width: 16, height: 16 }} />
              <Bell size={14} color={P.gold} /> ذكّرني بهذه المحاضرة
            </label>
            {newLec.remind !== false && (
              <div>
                <div style={{ fontSize: 11.5, color: t.mu, fontWeight: 700, marginBottom: 5 }}>متى يصلني التذكير؟</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {REMIND_CHOICES.map(({ min, label }) => {
                    const active = Number(newLec.remindMin ?? 5) === min;
                    return (
                      <button key={min} onClick={() => setNewLec(p => ({ ...p, remindMin: min }))} style={{
                        padding: "6px 11px", borderRadius: 9, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700,
                        background: active ? `${P.gold}20` : t.s2, border: `1.5px solid ${active ? P.gold : t.bd}`, color: active ? P.gold : t.mu,
                      }}>{label}</button>
                    );
                  })}
                </div>
              </div>
            )}
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
  // Prefer the short route when the file has an id; it is the same content
  // either way, but the tab a student opens then shows a tidy URL.
  const base = file.id ? `/f/${file.id}` : `/api/download?url=${encodeURIComponent(blobSrc)}`;
  const viewUrl = base;
  const dlUrl = file.id ? `/f/${file.id}?dl=1` : `/api/download?url=${encodeURIComponent(blobSrc)}&dl=1`;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 500, background: "#050a16", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "#0a1426", borderBottom: "1px solid #1c2e48", flexShrink: 0 }}>
        <button onClick={onClose} style={{ background: "rgba(255,255,255,.1)", border: "none", borderRadius: 8, padding: "7px 13px", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontFamily: "inherit", fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
          <ArrowLeft size={14} /> رجوع
        </button>
        <div style={{ flex: 1, color: "#e4ecf8", fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.name}</div>
        <a href={dlUrl} title="تحميل الملف" style={{ background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.18)", color: "#fff", borderRadius: 8, padding: "7px 11px", fontSize: 12.5, fontWeight: 700, textDecoration: "none", display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
          <Download size={12} /> تحميل
        </a>
      </div>

      <iframe src={viewUrl} style={{ flex: 1, border: "none", width: "100%", background: "#fff" }} title={file.name} />

      {/* Phone browsers frequently refuse to render a PDF inside an iframe and
          leave a blank panel with no explanation. This is always visible, so
          there is a way through rather than a dead end. */}
      <div style={{ flexShrink: 0, background: "#0a1426", borderTop: "1px solid #1c2e48", padding: "9px 14px", display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ flex: 1, fontSize: 11.5, color: "#8fa6c4", lineHeight: 1.6 }}>لا يظهر الملف؟ بعض المتصفحات لا تعرض PDF هنا.</span>
        <a href={viewUrl} target="_blank" rel="noopener noreferrer" style={{ background: `linear-gradient(135deg,${P.blue},${P.blue2})`, color: "#fff", borderRadius: 8, padding: "7px 13px", fontSize: 12.5, fontWeight: 800, textDecoration: "none", display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
          <ExternalLink size={12} /> افتح في تبويب
        </a>
      </div>
    </div>
  );
}

function RealFileItem({ file, t, onToast, canOpen = true, onNeedAccount = null }) {
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
    // Short and on our own domain — the old link embedded the whole encoded
    // storage URL, which wrapped in every chat app and published where the
    // file actually lives.
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const url = file.id ? `${origin}/f/${file.id}` : `${origin}/api/download?url=${encodeURIComponent(blobSrc)}`;
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
          {/* Browsing is open; taking the files home is not. The buttons stay
              visible rather than disappearing — a student should be able to see
              that the material is there and what it costs to reach it. */}
          <button onClick={() => canOpen ? setViewing(true) : onNeedAccount?.()} style={{ background: `${P.blue2}15`, border: `1px solid ${P.blue2}35`, borderRadius: 8, padding: "6px 10px", cursor: "pointer", color: P.blue2, fontSize: 12, fontWeight: 700, fontFamily: "inherit", display: "flex", alignItems: "center", gap: 4, opacity: canOpen ? 1 : 0.55 }}>
            {canOpen ? <Eye size={12} /> : <Lock size={12} />} قراءة
          </button>
          {canOpen ? (
            <a href={dlUrl} style={{ background: `linear-gradient(135deg,${P.blue},${P.blue2})`, borderRadius: 8, padding: "6px 10px", color: "#fff", fontSize: 12, fontWeight: 700, textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
              <Download size={12} /> تحميل
            </a>
          ) : (
            <button onClick={() => onNeedAccount?.()} style={{ background: `linear-gradient(135deg,${P.blue},${P.blue2})`, border: "none", borderRadius: 8, padding: "6px 10px", color: "#fff", fontSize: 12, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, opacity: 0.65 }}>
              <Lock size={12} /> تحميل
            </button>
          )}
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

function CoursePage({ subject, onBack, favorites, toggleFav, notes, setNotes, t, onChat, onToast, onAskAI, canOpenFiles = true, onNeedAccount = null }) {
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

  // Only the sections that mean something for this course. A prep-year
  // subject has no admission requirements or fee schedule to show.
  const sections = SECTIONS.filter(sec => sec.id !== "programs" || isProgramme(subject));

  // Your own cards for this subject, counted for the header badge. Read after
  // mount, never during render — reading storage while rendering is what made
  // the whole app die on hydration once already.
  const [cardCount, setCardCount] = useState(null);
  useEffect(() => { setCardCount((storage.get(`fc_${subject}`, []) || []).length); }, [subject, open]);

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
        {sections.map((sec) => {
          const isOpen = open === sec.id;
          const showBadge = sec.id === "notes" && hasNotes;
          // How many real files this section holds — so a student can see
          // what is worth opening instead of tapping through empty drawers.
          const fileCount = FILE_SECTIONS.includes(sec.id) ? (realFiles[sec.id] || []).length : null;
          // The personal tools show their state the same way, so you can see
          // whether you have anything here without opening them.
          const ownBadge = sec.id === "flashcards" ? (cardCount ? `${cardCount} بطاقة` : null)
            : sec.id === "notes" ? (hasNotes ? "مكتوبة" : null) : null;
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
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: t.tx, display: "flex", alignItems: "center", gap: 6 }}>
                    {sec.label}
                    {/* The count is the point: you can see which drawers have
                        something in them without opening all four. */}
                    {fileCount != null && !realLoading && (
                      <span style={{
                        fontSize: 10.5, fontWeight: 800, borderRadius: 6, padding: "1px 7px",
                        background: fileCount ? `${sec.color}18` : t.s2,
                        color: fileCount ? sec.color : t.dim,
                      }}>{fileCount || "فارغ"}</span>
                    )}
                    {ownBadge && (
                      <span style={{ fontSize: 10.5, fontWeight: 800, borderRadius: 6, padding: "1px 7px", background: `${P.green}18`, color: P.green }}>{ownBadge}</span>
                    )}
                  </div>
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
                  {FILE_SECTIONS.includes(sec.id) && (() => {
                    const all = realFiles[sec.id] || [];
                    const fq = (fileFilter[sec.id] || "").toLowerCase();
                    const shown = all.filter(f => !fq || f.name.toLowerCase().includes(fq));
                    if (realLoading) {
                      return <div style={{ textAlign: "center", padding: "18px 0", color: t.mu, fontSize: 13 }}>جارٍ التحميل…</div>;
                    }
                    if (all.length === 0) {
                      return (
                        <div style={{ textAlign: "center", padding: "18px 8px", color: t.mu, fontSize: 13, lineHeight: 1.8 }}>
                          <FileText size={24} color={t.dim} style={{ opacity: 0.5, marginBottom: 8 }} />
                          <div>لا ملفات في هذا القسم بعد</div>
                          <div style={{ fontSize: 11.5, color: t.dim, marginTop: 3 }}>تُضاف من لوحة التحكم فور توفّرها</div>
                        </div>
                      );
                    }
                    return (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {/* The search box only earns its space once there is
                            enough here to be worth searching. */}
                        {all.length > 3 && (
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
                        )}
                        {shown.map((f, i) => <RealFileItem key={f.id || `real-${i}`} file={f} t={t} onToast={onToast} canOpen={canOpenFiles} onNeedAccount={onNeedAccount} />)}
                        {shown.length === 0 && (
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
/**
 * Read the admin-managed academic calendar into renderable rows.
 *
 * Shared by the home strip and the calendar tab so there is one source and
 * one set of guards: an admin row can arrive with a missing or blank date, or
 * a label that is an object, and either would take the whole app down if it
 * reached React as a child.
 */
function useCalendarEvents() {
  const { data: content } = useSiteContent("calendar");
  return useMemo(() => {
    const now = new Date();
    return (Array.isArray(content?.events) && content.events.length ? content.events : DEFAULT_CALENDAR.events)
      .filter(e => e && typeof e === "object")
      .map(e => {
        const date = typeof e.date === "string" ? e.date : "";
        const ms = date ? new Date(date + "T00:00:00").getTime() : NaN;
        return { ...e, label: safeText(e.label, "حدث"), date, days: Number.isNaN(ms) ? 0 : Math.ceil((ms - now) / 86400000) };
      })
      .sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999"));
  }, [content]);
}

/**
 * The calendar as a full page — its own tab in the bottom nav.
 *
 * Everything is shown to everyone by default: an event tagged for another
 * plan is still a date this student may need to know, and hiding it was the
 * behaviour that got reverted earlier. What the plan buys you is a filter you
 * choose — "يخصّني" narrows to your track — and never a silent omission.
 */
function CalendarPage({ t, profile }) {
  const events = useCalendarEvents();
  const [mineOnly, setMineOnly] = useState(false);
  const mineCount = useMemo(
    () => events.filter(e => e.audience && e.audience !== "all" && audienceMatches(e.audience, profile)).length,
    [events, profile]);
  const shown = mineOnly ? events.filter(e => audienceMatches(e.audience, profile)) : events;

  return (
    <div style={{ animation: "fadeUp .4s ease" }}>
      <h2 style={{ fontSize: 20, fontWeight: 900, color: t.tx, marginBottom: 6, display: "flex", alignItems: "center", gap: 8 }}>
        <Calendar size={20} color={P.blue2} /> التقويم الأكاديمي
      </h2>
      <div style={{ fontSize: 12.5, color: t.mu, marginBottom: 14, lineHeight: 1.7 }}>
        مواعيد الفصل: التسجيل، الحذف والإضافة، الاختبارات، والإجازات.
      </div>

      {/* Only offered when the student has a track and some event is tagged
          for it — otherwise the toggle would filter nothing. */}
      {profile?.track && mineCount > 0 && (
        <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
          {[{ id: false, label: `الكل (${events.length})` }, { id: true, label: `يخصّني (${shownCountFor(events, profile)})` }].map(({ id, label }) => {
            const active = mineOnly === id;
            return (
              <button key={String(id)} onClick={() => setMineOnly(id)} style={{
                padding: "6px 14px", borderRadius: 20, cursor: "pointer", fontFamily: "inherit",
                fontSize: 12.5, fontWeight: 700, whiteSpace: "nowrap",
                background: active ? P.blue2 : t.s2, border: `1px solid ${active ? P.blue2 : t.bd}`,
                color: active ? "#fff" : t.mu,
              }}>{label}</button>
            );
          })}
        </div>
      )}

      {shown.length === 0
        ? <div style={{ textAlign: "center", color: t.mu, padding: "40px 0", fontSize: 13 }}>
            {events.length === 0 ? "لا أحداث في التقويم بعد" : "لا أحداث تخصّ مسارك"}
          </div>
        : <CalendarList t={t} events={shown} profile={profile} />}
    </div>
  );
}
/** How many events a student would see under the "يخصّني" filter. */
const shownCountFor = (events, profile) => events.filter(e => audienceMatches(e.audience, profile)).length;

/** The upcoming/past split, shared by the calendar page and the modal. */
function CalendarList({ t, events, profile }) {
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
          {audienceLabel(e.audience) && (() => {
            // An event aimed at this student's own track is worth spotting in
            // a long list, so it says "مسارك" instead of repeating the label.
            const mine = audienceMatches(e.audience, profile);
            return (
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10.5, fontWeight: 700,
                color: mine ? P.green : col, background: `${mine ? P.green : col}14`,
                border: mine ? `1px solid ${P.green}45` : "none",
                borderRadius: 7, padding: "2px 8px", marginTop: 6,
              }}>
                {mine && <Check size={10} />}
                {mine ? "مسارك" : `خاص بـ ${audienceLabel(e.audience)}`}
              </div>
            );
          })()}
        </div>
        <div style={{ background: chip.bg, color: chip.col, borderRadius: 9, padding: "4px 10px", fontSize: 11.5, fontWeight: 800, alignSelf: "flex-start", flexShrink: 0 }}>{chip.text}</div>
      </div>
    );
  };
  return (
    <>
      {upcoming.length > 0 && <div style={{ fontSize: 13, fontWeight: 800, color: t.mu, marginBottom: 10 }}>القادمة</div>}
      {upcoming.map(Row)}
      {past.length > 0 && <div style={{ fontSize: 13, fontWeight: 800, color: t.mu, margin: "18px 0 10px" }}>المنتهية</div>}
      {past.map(Row)}
    </>
  );
}

/**
 * The next few dates, as a strip on the home page.
 *
 * Public site: everyone sees every event. The audience tag stays only as an
 * informational badge ("خاص بـ خطة أ") — it never hides anything. "عرض الكل"
 * now goes to the calendar tab rather than a modal, so there is one full view.
 */
function AcademicCalendar({ t, onOpenAll }) {
  const events = useCalendarEvents();
  if (!events.length) return null;
  const upcoming = events.filter(e => e.days >= 0);
  const strip = (upcoming.length ? upcoming : events).slice(0, 8);

  return (
    <>
      <div style={{ background: t.s1, borderRadius: 18, padding: 16, border: `1px solid ${t.bd}`, marginBottom: 16, boxShadow: t.shSm }}>
        <button onClick={onOpenAll} style={{ width: "100%", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, padding: 0 }}>
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
              <button key={i} onClick={onOpenAll} style={{
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

function HomePage({ setActiveTab, openCourse, onOpenAI, t, weeklyGoal, semesters, schedule, tasks, setTasks, onToast, exams, setExams, profile }) {
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
  // Tips are drawn without repeating: the card starts as an invitation rather
  // than a fact nobody asked for, and every tip in the deck is shown once
  // before any comes round again. The deck is remembered across visits, so
  const [pwaPrompt, setPwaPrompt] = useState(null);
  // (A timer here used to force a tip on screen and swap it on the hour,
  //  which is exactly the "it just repeats at me" behaviour being fixed —
  //  the card is asked, not pushed, so the timer is gone.)
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
  const todayAr = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"][new Date().getDay()];
  const todayLectures = (schedule || []).filter(l => l.day === todayAr).sort((a, b) => a.time.localeCompare(b.time));
  const examDays = Math.ceil((new Date("2026-06-07") - new Date()) / (1000 * 60 * 60 * 24));

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
                {/* The primary pill said "اختر مسارك" even to someone whose
                    track was already picked and printed just above it. It now
                    says what it will actually do for you. */}
                <button onClick={() => setActiveTab("explore")} style={{ ...base, background: `linear-gradient(135deg,${P.gold},${P.goldRich})`, border: "none", color: "#3a2e05", fontWeight: 800, boxShadow: `0 6px 18px ${P.gold}44` }}>
                  <GradCap size={14} /> {profile?.track ? "تصفّح موادي" : "اختر مسارك"}
                </button>
                <button onClick={() => onOpenAI?.()} style={ghost}>
                  <Sparkles size={13} color={P.gold} /> اسأل المساعد
                </button>
                <button onClick={() => setActiveTab("gpa")} style={ghost}>
                  <Calculator size={13} /> احسب معدلي
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
      <TasksHub t={t} tasks={tasks} setTasks={setTasks} exams={exams} setExams={setExams} onToast={onToast} profile={profile} />


      {/* Pick up where you left off — the most likely next tap, and the one
          thing here the bottom nav cannot already do in one press. The old
          "وصول سريع" grid sent three of its six tiles to the same tab and the
          rest to tabs already sitting in the nav, so it was decoration. */}

      {/* Academic calendar strip — bottom */}
      <AcademicCalendar t={t} onOpenAll={() => setActiveTab("calendar")} />
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

  // Open on the student's own subjects, not on a picker they already answered.
  //
  // This is also the landing spot when you back out of a course, so it has to
  // be the deepest place their profile actually determines: the term's
  // subjects for تحضيري, and their college's programmes for تخصص — not the
  // list of five colleges they'd have to re-navigate every single time.
  useEffect(() => {
    const key = TRACK_TO_TREE[profile?.track];
    if (!key) return;
    setPath(key);
    if (key === "preparatory" && PLAN_TO_SUB[profile?.plan]) {
      setSub(PLAN_TO_SUB[profile.plan]); setStep("level3");
      return;
    }
    if (key === "bachelor" && profile?.college) {
      const col = TREE.bachelor.colleges.find(c => c.label === profile.college);
      if (col) { setSub(col.id); setStep("level3"); return; }
    }
    setStep("level2");
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

/**
 * Track → (college) → plan/programme, in one place.
 *
 * Shared by the profile editor and the first-run screen so both always offer
 * the same options; `draft` is the working profile and `set` patches it.
 */
function TrackPicker({ draft, set, t, disabled }) {
  const plans = planOptionsFor(draft.track, draft.college);
  const chip = (label, active, onClick, color) => (
    <button key={label} type="button" disabled={disabled} onClick={onClick} style={{
      padding: "8px 13px", borderRadius: 10, cursor: disabled ? "not-allowed" : "pointer",
      fontFamily: "inherit", fontSize: 12.5, fontWeight: 700, textAlign: "right",
      background: active ? `${color}18` : t.s2, border: `1.5px solid ${active ? color : t.bd}`,
      color: active ? color : t.mu, opacity: disabled ? 0.6 : 1,
    }}>{label}</button>
  );

  return (
    <>
      <label style={{ fontSize: 12, color: t.mu, fontWeight: 700, display: "block", marginBottom: 8 }}>المسار</label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
        {AUTH_TRACKS.map(({ id }) =>
          chip(id, draft.track === id, () => set({ track: id, college: "", plan: "" }), P.blue2))}
      </div>

      {trackNeedsCollege(draft.track) && (
        <>
          <label style={{ fontSize: 12, color: t.mu, fontWeight: 700, display: "block", marginBottom: 8 }}>القسم / الكلية</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
            {TRACK_COLLEGES.map(c =>
              chip(c.label, draft.college === c.label, () => set({ college: c.label, plan: "" }), P.purple))}
          </div>
        </>
      )}

      {plans.length > 0 && (
        <>
          <label style={{ fontSize: 12, color: t.mu, fontWeight: 700, display: "block", marginBottom: 8 }}>
            {draft.track === "تحضيري" ? "الخطة" : "البرنامج"}
          </label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
            {plans.map(pl => chip(pl, draft.plan === pl, () => set({ plan: pl }), P.green))}
          </div>
        </>
      )}
    </>
  );
}

/* ══════════════════════════════════════════════════════════════
   PROFILE / STATS PAGE
   ══════════════════════════════════════════════════════════════ */
function ProfilePage({ t, favorites, profile, setProfile, setActiveTab, onToast, onSignOut, trackLock, setTrackLock, tasks, schedule, notes, openCourse, openSettings, aiEmail = "", setAiEmail = null, savedAccount = null, onLogin = null, accounts = false, signedIn = false, studentCode = "", onMessages = null, msgUnread = 0 }) {
  // Not auto-opened: a visitor landing on حسابي gets the explanation above
  // and chooses, instead of being dropped into a form they didn't ask for.
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({
    name: profile?.name || "",
    email: profile?.email || aiEmail || "",
    // Empty, not "تحضيري": a preselected track made the plan chips (خطة أ/ب)
    // appear before the student had chosen anything.
    track: profile?.track || "",
    college: profile?.college || "",
    plan: profile?.plan || "",
  });
  const patch = (p) => setDraft(d => ({ ...d, ...p }));
  const [requesting, setRequesting] = useState(false);
  // The admin has always been able to write a reply; nothing ever showed it,
  // because a request row records a name and a number and neither identifies
  // the caller. It is keyed on the signed device cookie now, so this asks for
  // "my request" and gets an answer.
  const [myRequest, setMyRequest] = useState(null);
  useEffect(() => {
    let alive = true;
    fetch("/api/track-request")
      .then(r => r.json())
      .then(d => { if (alive) setMyRequest(d.request || null); })
      .catch(() => {});
    return () => { alive = false; };
  }, [requesting]);
  // The hold follows the stamp, which survives a sign-out and a data reset —
  // so re-creating the profile can't be used to escape it.
  const heldTrack = lockStampOf(profile) || trackLock;
  const lockDaysLeft = trackLockRemaining(heldTrack);

  // While the track is locked, a change goes to the admin as a request the
  // student explains, rather than silently editing the profile.
  const requestTrackChange = async () => {
    const reason = window.prompt("سبب تغيير المسار؟ (سيصل للإدارة مع اسمك)");
    if (reason == null) return;
    if (!reason.trim()) { onToast?.("اكتب سبب التغيير", "warn"); return; }
    setRequesting(true);
    try {
      const res = await fetch("/api/track-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: profile?.name || draft.name.trim(),
          currentTrack: trackLabel(heldTrack), reason: reason.trim(),
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) onToast?.("وصل طلبك للإدارة — سيتم الرد قريباً ✅", "success");
      else onToast?.(d.error || "تعذّر إرسال الطلب", "error");
    } catch { onToast?.("تعذّر الاتصال", "error"); }
    setRequesting(false);
  };
  // The track is fixed for 15 days after it is confirmed; name and ID stay
  // editable throughout.
  const trackLocked = lockDaysLeft > 0;

  const save = () => {
    if (!draft.name.trim()) { onToast?.("اكتب اسمك أولاً", "warn"); return; }
    if (draft.email.trim() && !looksLikeEmail(draft.email)) { onToast?.("صيغة البريد غير صحيحة", "warn"); return; }
    if (!draft.track) { onToast?.("اختر مسارك أولاً", "warn"); return; }
    if (!profileComplete(draft)) { onToast?.("أكمل اختيار مسارك", "warn"); return; }

    // A stamp left over from a sign-out or a reset still holds.
    if (lockConflicts(heldTrack, draft)) {
      onToast?.(`مسارك مثبَّت على «${trackLabel(heldTrack)}» — يتبقّى ${lockDaysLeft} يوم`, "warn");
      return;
    }

    const trackChanged = !heldTrack ||
      heldTrack.track !== draft.track || (heldTrack.college || "") !== (draft.college || "") || (heldTrack.plan || "") !== (draft.plan || "");
    if (trackChanged && !confirm(
      `تأكيد مسارك: ${trackLabel(draft)}\n\nبعد التأكيد لا يمكنك تغييره إلا بعد ${TRACK_LOCK_DAYS} يوماً، أو بإرسال طلب للإدارة.`
    )) return;

    const confirmedAt = trackChanged ? Date.now() : (heldTrack?.confirmedAt || Date.now());
    const next = {
      ...profile,
      name: draft.name.trim(),
      email: draft.email.trim(),
      track: draft.track,
      college: draft.college || "",
      plan: draft.plan || "",
      // Only restart the lock when the track actually changed.
      confirmedAt,
      created: profile?.created || Date.now(),
    };
    setProfile(next);
    if (next.email && next.email !== aiEmail) setAiEmail?.(next.email);
    setTrackLock?.(lockStampOf(next));
    setEditing(false);
    onToast?.("تم حفظ ملفك ✅", "success");

    // Record it server-side too, keyed on the signed device cookie. This is
    // what makes the track hold real: clearing the browser no longer hands
    // you a fresh profile. Best-effort — the profile is already saved
    // locally, so a server hiccup must not look like a failure to the student.
    fetch("/api/student/identity", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: next.name, email: next.email || aiEmail || "",
        track: next.track, college: next.college, plan: next.plan,
      }),
    })
      .then(r => r.json())
      .then(d => {
        if (d?.trackLocked && d.daysLeft) {
          onToast?.(`مسارك مثبَّت على «${trackLabel(d)}» — يتبقّى ${d.daysLeft} يوم`, "warn");
          setProfile(p => ({ ...p, track: d.track, college: d.college || "", plan: d.plan || "" }));
        }
      })
      .catch(() => {});
  };

  const initial = (profile?.name || "ط").trim()[0] || "ط";

  // One grid, not two. There were a row of links and a row of numbers, and
  // both listed المفضلة and مهامي — the same things counted in one place and
  // opened in another, so neither row was worth reading. A count you can tap
  // is both.
  const quickActions = [
    { Icon: CalendarDays, label: "جدولي", tab: "schedule", color: P.blue2, n: (schedule || []).length },
    { Icon: CheckCircle, label: "مهامي", tab: "home", color: P.green, n: (tasks || []).filter(x => !x.done).length },
    { Icon: Star, label: "المفضلة", tab: "fav", color: P.gold, n: favorites.length },
    { Icon: Compass, label: "استكشاف", tab: "explore", color: P.purple, n: null },
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
              {profile?.track && <span style={{ fontSize: 11.5, fontWeight: 800, color: "#3a2e05", background: P.gold, borderRadius: 7, padding: "2px 9px" }}>{trackLabel(profile)}</span>}
              {/* The site's own handle, assigned at signup and never editable
                  — it is what the admin quotes back when answering a request,
                  so it has to be somewhere the student can read it out. */}
              {studentCode && (
                <span title="رقمك في الموقع" style={{ fontSize: 11.5, fontWeight: 800, color: "#3a2e05", background: "rgba(255,255,255,.85)", borderRadius: 7, padding: "2px 8px", fontFamily: "monospace", direction: "ltr" }}>{studentCode}</span>
              )}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button onClick={() => { setDraft({ name: profile?.name || "", email: profile?.email || aiEmail || "", track: profile?.track || "", college: profile?.college || "", plan: profile?.plan || "" }); setEditing(true); }} title="تعديل الملف" style={{ background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.18)", borderRadius: 12, padding: 9, cursor: "pointer", display: "flex", color: "#fff" }}>
              <Edit3 size={16} />
            </button>
            <button onClick={openSettings} title="الإعدادات" style={{ background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.18)", borderRadius: 12, padding: 9, cursor: "pointer", display: "flex", color: "#fff" }}>
              <Settings size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* No profile yet: say what one adds rather than dropping straight into
          a form, so browsing doesn't feel like a locked door. */}
      {!editing && !profile && (
        <div style={{ background: t.s1, borderRadius: 18, padding: 18, marginBottom: 16, border: `1.5px solid ${P.gold}45`, boxShadow: t.shSm }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 7 }}>
            <Compass size={17} color={P.gold} />
            <div style={{ fontSize: 15, fontWeight: 900, color: t.tx }}>أنت تتصفّح بدون حساب</div>
          </div>
          <div style={{ fontSize: 12.5, color: t.mu, lineHeight: 1.85, marginBottom: 14 }}>
            كل شيء يعمل الآن: المواد، التقويم، الجدول، المساعد. الحساب يضيف
            <strong style={{ color: t.tx }}> مسارك وموادك ومهامك ومفضلتك</strong> — ويتبعك على أي جهاز.
          </div>
          {/* A real account now, with an email behind it. The device-local
              profile still opens for anyone who made one before accounts
              existed — it is offered second, not instead. */}
          {accounts ? (
            <>
              <Btn variant="gold" onClick={() => { window.location.href = "/signup"; }} style={{ width: "100%", marginBottom: 8 }}>
                <User size={15} /> إنشاء حساب
              </Btn>
              <Btn variant="ghost" onClick={() => { window.location.href = "/login"; }} style={{ width: "100%" }}>
                <LogIn size={15} /> لدي حساب — تسجيل الدخول
              </Btn>
            </>
          ) : savedAccount ? (
            <>
              <Btn variant="gold" onClick={() => onLogin?.()} style={{ width: "100%", marginBottom: 8 }}>
                <LogIn size={15} /> دخول إلى «{savedAccount.name}»
              </Btn>
              <Btn variant="ghost" onClick={() => setEditing(true)} style={{ width: "100%" }}>
                <Plus size={15} /> ملف جديد بدلاً منه
              </Btn>
            </>
          ) : (
            <Btn variant="gold" onClick={() => setEditing(true)} style={{ width: "100%" }}>
              <User size={15} /> إنشاء حساب
            </Btn>
          )}
          <div style={{ fontSize: 11, color: t.dim, textAlign: "center", marginTop: 10, lineHeight: 1.7 }}>
            {accounts
              ? "الاسم والبريد وكلمة المرور — ويصلك رمز تأكيد على بريدك."
              : savedAccount
                ? "حسابك محفوظ على هذا الجهاز."
                : "الاسم فقط — ويُحفظ على جهازك."}
          </div>
        </div>
      )}

      {/* A device profile is not an account, and until now there was no way to
          say so. The sign-in card above is gated on `!profile`, so everyone who
          made a profile before accounts existed — which is every current
          student — had no route to /login or /signup at all: they would have
          had to sign out first, destroying the profile, just to find the door.
          This is that door, and it keeps their profile while they walk through. */}
      {!editing && profile && accounts && !signedIn && (
        <div style={{ background: t.s1, borderRadius: 18, padding: 18, marginBottom: 16, border: `1.5px solid ${P.blue2}45`, boxShadow: t.shSm }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 7 }}>
            <LogIn size={17} color={P.blue2} />
            <div style={{ fontSize: 15, fontWeight: 900, color: t.tx }}>ملفك محفوظ على هذا الجهاز فقط</div>
          </div>
          <div style={{ fontSize: 12.5, color: t.mu, lineHeight: 1.85, marginBottom: 14 }}>
            لو مسحت بيانات المتصفح أو فتحت الموقع من جهاز آخر، لن تجده. الحساب
            <strong style={{ color: t.tx }}> يحفظه ببريدك</strong> ويتبعك على أي جهاز — وملفك الحالي يبقى كما هو.
          </div>
          <Btn variant="gold" onClick={() => { window.location.href = "/signup"; }} style={{ width: "100%", marginBottom: 8 }}>
            <User size={15} /> إنشاء حساب بالبريد
          </Btn>
          <Btn variant="ghost" onClick={() => { window.location.href = "/login"; }} style={{ width: "100%" }}>
            <LogIn size={15} /> لدي حساب — تسجيل الدخول
          </Btn>
          <div style={{ fontSize: 11, color: t.dim, textAlign: "center", marginTop: 10, lineHeight: 1.7 }}>
            يصلك رمز من ٦ أرقام على بريدك للتأكد منه.
          </div>
        </div>
      )}

      {/* What to do next.
          The owner's verdict on this page was that it proposes nothing — a
          wall of boxes reporting state, with no view about any of it. That is
          fair: everything here waited to be read. This is the page's one
          opinion, and it earns its place at the top by only appearing when
          there is genuinely something: an unread reply, a track never chosen,
          an email never added. When there is nothing it says so in a line and
          gets out of the way, because a permanent banner is furniture. */}
      {!editing && profile && (() => {
        const todo = [];
        if (msgUnread > 0) todo.push({
          Icon: Mail, color: P.gold,
          text: msgUnread === 1 ? "عندك رسالة لم تقرأها" : `عندك ${msgUnread} رسائل لم تقرأها`,
          cta: "افتح الرسائل", act: () => onMessages?.(),
        });
        if (!profile.track) todo.push({
          Icon: Compass, color: P.blue2,
          text: "لم تختر مسارك بعد — الموقع كله يتخصّص عليه",
          cta: "اختر مسارك", act: () => setEditing(true),
        });
        if (!(profile.email || aiEmail)) todo.push({
          Icon: Mail, color: P.purple,
          text: "أضف بريدك ليصلك ردّ الإدارة وتفعيل اشتراكك",
          cta: "أضف بريدك", act: () => setEditing(true),
        });
        if (todo.length === 0) return (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, padding: "10px 14px", background: `${P.green}0d`, border: `1px solid ${P.green}30`, borderRadius: 12 }}>
            <CheckCircle size={15} color={P.green} />
            <span style={{ fontSize: 12.5, color: t.mu, fontWeight: 700 }}>ملفك مكتمل ولا شيء ينتظرك.</span>
          </div>
        );
        return (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11.5, fontWeight: 800, color: t.mu, marginBottom: 7 }}>يحتاج انتباهك</div>
            {todo.map((x, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 11, marginBottom: 8,
                background: t.s1, border: `1.5px solid ${x.color}40`, borderRadius: 14, padding: "12px 14px",
              }}>
                <div style={{ width: 34, height: 34, borderRadius: 11, background: `${x.color}15`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <x.Icon size={16} color={x.color} />
                </div>
                <div style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: t.tx, lineHeight: 1.65, fontWeight: 700 }}>{x.text}</div>
                <button onClick={x.act} style={{
                  flexShrink: 0, background: `${x.color}18`, border: `1px solid ${x.color}45`, borderRadius: 10,
                  padding: "7px 11px", cursor: "pointer", fontFamily: "inherit",
                  fontSize: 11.5, fontWeight: 800, color: x.color,
                }}>{x.cta}</button>
              </div>
            ))}
          </div>
        );
      })()}

      {/* Settings, said out loud.
          It was a bare gear on a coloured header, one of two unlabelled icons
          — the owner's word for it was "lost". An icon is a reminder for
          someone who already knows the thing is there; it is not a way to
          find it. The gear stays for whoever has learned it; this is for
          everyone else. */}
      {!editing && (
        <div style={{ display: "flex", gap: 9, marginBottom: 16 }}>
          <button onClick={openSettings} style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
            background: t.s1, border: `1.5px solid ${t.bd}`, borderRadius: 14, padding: "13px 10px",
            cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 800, color: t.tx,
          }}>
            <Settings size={16} color={P.blue2} /> الإعدادات
          </button>
          <button onClick={() => onMessages?.()} style={{
            flex: 1, position: "relative", display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
            background: t.s1, border: `1.5px solid ${msgUnread > 0 ? `${P.gold}55` : t.bd}`,
            borderRadius: 14, padding: "13px 10px",
            cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 800, color: t.tx,
          }}>
            <Mail size={16} color={P.gold} /> الرسائل
            {msgUnread > 0 && (
              <span style={{
                minWidth: 18, height: 18, borderRadius: 9, padding: "0 4px", background: P.gold,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 900, color: "#1a1a1a",
              }}>{msgUnread > 9 ? "9+" : msgUnread}</span>
            )}
          </button>
        </div>
      )}

      {/* Setup / edit card (no email, no password) */}
      {editing && (
        <div style={{ background: t.s1, borderRadius: 18, padding: 18, marginBottom: 16, border: `1.5px solid ${P.gold}45`, boxShadow: t.shSm, animation: "fadeUp .3s ease" }}>
          <div style={{ fontSize: 15, fontWeight: 900, color: t.tx, marginBottom: 4 }}>{profile ? "تعديل ملفك الدراسي" : "أنشئ ملفك الدراسي"}</div>
          <div style={{ fontSize: 12, color: t.mu, marginBottom: 14, lineHeight: 1.7 }}>اسمك ومسارك — لتخصيص موادك وتقويمك ومهامك.</div>

          <label style={{ fontSize: 12, color: t.mu, fontWeight: 700, display: "block", marginBottom: 6 }}>الاسم</label>
          <input value={draft.name} onChange={e => patch({ name: e.target.value })} placeholder="اكتب اسمك"
            style={{ width: "100%", border: `1.5px solid ${t.bd}`, borderRadius: 10, padding: "10px 12px", fontSize: 14, background: t.s2, color: t.tx, fontFamily: "inherit", direction: "rtl", outline: "none", boxSizing: "border-box", marginBottom: 14 }} />

          {/* One place to set the email, shared with the assistant — it used
              to be asked for separately in the chat and nowhere else. */}
          <label style={{ fontSize: 12, color: t.mu, fontWeight: 700, display: "block", marginBottom: 6 }}>
            البريد الإلكتروني <span style={{ fontWeight: 600, color: t.dim }}>— للمساعد وطلبات الاشتراك</span>
          </label>
          <input value={draft.email} onChange={e => patch({ email: e.target.value })} placeholder="you@example.com" type="email"
            style={{ width: "100%", border: `1.5px solid ${draft.email && !looksLikeEmail(draft.email) ? P.red : t.bd}`, borderRadius: 10, padding: "10px 12px", fontSize: 14, background: t.s2, color: t.tx, fontFamily: "inherit", direction: "ltr", textAlign: "left", outline: "none", boxSizing: "border-box", marginBottom: draft.email && !looksLikeEmail(draft.email) ? 5 : 14 }} />
          {draft.email && !looksLikeEmail(draft.email) && (
            <div style={{ fontSize: 11.5, color: P.red, marginBottom: 12 }}>صيغة البريد غير صحيحة</div>
          )}

          {trackLocked ? (
            <div style={{ background: `${P.gold}12`, border: `1px solid ${P.gold}40`, borderRadius: 12, padding: "12px 14px", marginBottom: 14 }}>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: t.tx, marginBottom: 4 }}>مسارك: {trackLabel(heldTrack)}</div>
              <div style={{ fontSize: 11.5, color: t.mu, lineHeight: 1.7, marginBottom: 10 }}>
                مثبَّت لمدة {TRACK_LOCK_DAYS} يوماً — يتبقّى {lockDaysLeft} يوم. لتغييره قبل ذلك أرسل طلباً للإدارة.
              </div>

              {/* Where the admin's answer arrives. A request that vanishes into
                  silence is why students ask twice. */}
              {myRequest && (
                <div style={{
                  background: t.s2, borderRadius: 10, padding: "10px 12px", marginBottom: 10,
                  border: `1px solid ${myRequest.status === "approved" ? `${P.green}45` : myRequest.status === "rejected" ? `${P.red}40` : t.bd}`,
                }}>
                  <div style={{ fontSize: 11.5, fontWeight: 800, marginBottom: 4, color: myRequest.status === "approved" ? P.green : myRequest.status === "rejected" ? P.red : P.blue2 }}>
                    {myRequest.status === "approved" ? "وافقت الإدارة على طلبك ✅"
                      : myRequest.status === "rejected" ? "لم يُقبل طلبك"
                        : "طلبك قيد المراجعة"}
                  </div>
                  {myRequest.admin_reply ? (
                    <div style={{ fontSize: 12, color: t.tx, lineHeight: 1.8 }}>
                      <span style={{ color: t.mu, fontWeight: 700 }}>ردّ الإدارة: </span>
                      {safeText(myRequest.admin_reply, "")}
                    </div>
                  ) : (
                    <div style={{ fontSize: 11.5, color: t.mu, lineHeight: 1.7 }}>
                      {myRequest.status === "pending" ? "سيصلك الرد هنا." : ""}
                    </div>
                  )}
                  {myRequest.status === "approved" && (
                    <div style={{ fontSize: 11.5, color: t.mu, marginTop: 6, lineHeight: 1.7 }}>
                      يمكنك الآن اختيار مسارك من جديد.
                    </div>
                  )}
                </div>
              )}

              <button onClick={requestTrackChange} disabled={requesting} style={{
                width: "100%", background: t.s2, border: `1px solid ${P.gold}55`, borderRadius: 10,
                padding: "10px", cursor: requesting ? "wait" : "pointer", fontFamily: "inherit",
                fontSize: 12.5, fontWeight: 800, color: P.gold, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}>
                <Send size={13} /> {requesting ? "جارٍ الإرسال…" : myRequest?.status === "pending" ? "إرسال طلب آخر" : "طلب تغيير المسار"}
              </button>
            </div>
          ) : (
            <TrackPicker draft={draft} set={patch} t={t} />
          )}

          <div style={{ display: "flex", gap: 8 }}>
            {profile && <Btn variant="ghost" size="sm" onClick={() => setEditing(false)} style={{ flex: 1 }}>إلغاء</Btn>}
            <Btn variant="primary" size="sm" onClick={save} style={{ flex: 2 }} disabled={!draft.name.trim()}>
              <CheckCircle size={15} /> {profile ? "حفظ" : "تأكيد وإنشاء الملف"}
            </Btn>
          </div>
        </div>
      )}

      {/* Quick actions dashboard */}
      {!editing && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 16 }}>
          {quickActions.map(({ Icon, label, tab, color, n }) => (
            <button key={label} onClick={() => setActiveTab(tab)} style={{
              background: t.s1, border: `1px solid ${t.bd}`, borderRadius: 16, padding: "14px 6px",
              cursor: "pointer", fontFamily: "inherit", boxShadow: t.shSm, transition: "all .2s",
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6,
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = color; e.currentTarget.style.transform = "translateY(-2px)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = t.bd; e.currentTarget.style.transform = "none"; }}>
              <div style={{ width: 42, height: 42, borderRadius: 13, background: `${color}15`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon size={20} color={color} strokeWidth={2} />
              </div>
              {n !== null && (
                <div style={{ fontSize: 18, fontWeight: 900, color, lineHeight: 1 }}>{n}</div>
              )}
              <div style={{ fontSize: 11.5, fontWeight: 700, color: t.tx, textAlign: "center", lineHeight: 1.3 }}>{label}</div>
            </button>
          ))}
        </div>
      )}

      {/* My plan — the track spelled out, with its subjects and what's due */}
      {!editing && profile && (() => {
        const subjects = myTrackSubjects(profile);
        const openTasks = (tasks || []).filter(tk => !tk.done).length;
        const lectures = (schedule || []).length;
        return (
          <div style={{ background: t.s1, borderRadius: 18, padding: 16, marginBottom: 16, border: `1.5px solid ${P.gold}35`, boxShadow: t.shSm }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <GradCap size={16} color={P.gold} />
              <div style={{ fontSize: 14, fontWeight: 800, color: t.tx, flex: 1 }}>خطتي</div>
              {lockDaysLeft > 0 && (
                <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: P.gold, background: `${P.gold}15`, borderRadius: 7, padding: "3px 8px" }}>
                  <Lock size={10} /> {lockDaysLeft} يوم
                </span>
              )}
            </div>
            <div style={{ fontSize: 12.5, color: t.mu, marginBottom: 14 }}>{trackLabel(profile)}</div>

            {subjects.length > 0 && (
              <>
                <div style={{ fontSize: 11.5, color: t.dim, fontWeight: 700, marginBottom: 8 }}>
                  {subjects.length === 1 ? "مادتي" : `موادي (${subjects.length})`}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
                  {subjects.map(s => {
                    const SIcon = getIcon(s);
                    return (
                      <button key={s} onClick={() => openCourse(s)} style={{
                        background: t.s2, border: `1px solid ${t.bd}`, borderRadius: 12, padding: "10px 12px",
                        cursor: "pointer", display: "flex", alignItems: "center", gap: 10,
                        fontFamily: "inherit", textAlign: "right", transition: "all .2s",
                      }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = P.gold + "60"}
                        onMouseLeave={e => e.currentTarget.style.borderColor = t.bd}>
                        <div style={{ width: 30, height: 30, borderRadius: 9, background: `${P.gold}15`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <SIcon size={14} color={P.gold} />
                        </div>
                        <div style={{ flex: 1, fontSize: 13, fontWeight: 700, color: t.tx }}>{s}</div>
                        <ChevronLeft size={14} color={t.dim} />
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
              {[
                { label: "مهام مفتوحة", value: openTasks, tab: "home", color: P.green },
                { label: "محاضرات", value: lectures, tab: "schedule", color: P.blue2 },
                { label: "مفضلة", value: favorites.length, tab: "fav", color: P.gold },
              ].map(({ label, value, tab, color }) => (
                <button key={label} onClick={() => setActiveTab(tab)} style={{
                  background: t.s2, border: `1px solid ${t.bd}`, borderRadius: 12, padding: "10px 6px",
                  cursor: "pointer", fontFamily: "inherit", textAlign: "center", transition: "all .2s",
                }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = color}
                  onMouseLeave={e => e.currentTarget.style.borderColor = t.bd}>
                  <div style={{ fontSize: 18, fontWeight: 900, color }}>{value}</div>
                  <div style={{ fontSize: 11, color: t.mu, fontWeight: 600, marginTop: 2 }}>{label}</div>
                </button>
              ))}
            </div>
          </div>
        );
      })()}

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



      {!editing && profile && (
        <button onClick={() => onSignOut?.()} style={{
          width: "100%", marginTop: 4, background: t.s1, border: `1px solid ${t.bd}`, borderRadius: 12,
          padding: "12px", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700, color: t.mu,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        }}>
          <LogOut size={16} /> تسجيل الخروج
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
function SettingsPanel({ t, onClose, dark, setDark, soundOn, setSoundOn, notifSoundOn, setNotifSoundOn, weeklyGoal, setWeeklyGoal, onReset, onResetAll, resetCounts, profile, rememberAccount, setRememberAccount, onSignOut, onSupport, onToast }) {
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

          <Row Icon={notifSoundOn ? Volume2 : VolumeX} label="أصوات الإشعارات" desc="نغمة عند تذكير المحاضرات والإعلانات" color={P.gold}>
            <Toggle on={notifSoundOn} onChange={(v) => { setNotifSoundOn(v); if (v) playChime(); }} />
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

          {profile && (
            <>
              <Row Icon={Save} label="حفظ حسابي بعد تسجيل الخروج" color={P.gold}
                desc={rememberAccount
                  ? "عند العودة تظهر لك شاشة دخول باسمك ورقمك الجامعي"
                  : "تسجيل الخروج سيحذف ملفك من هذا الجهاز نهائياً"}>
                <Toggle on={rememberAccount} onChange={setRememberAccount} />
              </Row>

              <Btn variant="ghost" onClick={() => { onSignOut?.(); onClose(); }} style={{ width: "100%", marginBottom: 8 }}>
                <LogOut size={14} /> تسجيل الخروج
              </Btn>
            </>
          )}

          <Btn variant="ghost" onClick={() => { onSupport?.(); onClose(); }} style={{ width: "100%", marginBottom: 8 }}>
            <MessageCircle size={14} /> تواصل معنا
          </Btn>

          <Btn variant="danger" onClick={() => setShowConfirm(true)} style={{ width: "100%" }}>
            <Trash2 size={14} /> إعادة تعيين البيانات
          </Btn>
        </div>
      </div>

      <ResetDialog
        open={showConfirm}
        counts={resetCounts}
        onResetData={() => { onReset(); onClose(); onToast?.("تم مسح بيانات الدراسة — ملفك ومسارك كما هما", "info"); }}
        onResetAll={() => { onResetAll(); onClose(); onToast?.("تم حذف كل البيانات من هذا الجهاز", "info"); }}
        onClose={() => setShowConfirm(false)}
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

  // `skipWalkthrough` arrives from storage just after mount, so read it at
  // fire time through a ref. Capturing it in the effect closure would use the
  // pre-hydration `false` and replay the intro for returning students.
  const skipRef = useRef(skipWalkthrough);
  useEffect(() => { skipRef.current = skipWalkthrough; }, [skipWalkthrough]);

  useEffect(() => {
    if (phase === 0) {
      const timer = setTimeout(() => skipRef.current ? onClose() : setPhase(1), 3200);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      // The academic calendar lives in its own tab now, not as a link out.
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

// Admin-authored JSON reaches the page unvalidated, and React throws (taking
// the whole app down) if a value meant as text turns out to be an object.
// Coerce anything rendered as a child to a safe string, falling back to the
// default when the saved shape is not usable.
function safeText(v, fallback = "") {
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (v && typeof v === "object") {
    // Tolerate the common wrapper shapes ({note}/{text}/{title}) instead of
    // discarding content the admin actually wrote.
    const inner = v.note ?? v.text ?? v.title ?? v.label;
    if (typeof inner === "string" || typeof inner === "number") return String(inner);
  }
  return fallback;
}

function SEULinksPage({ t, content }) {
  const C = (content && typeof content === "object") ? content : DEFAULT_LINKS;
  const rawHeader = (C.header && typeof C.header === "object") ? C.header : DEFAULT_LINKS.header;
  const rawQuick = (C.quick && typeof C.quick === "object") ? C.quick : DEFAULT_LINKS.quick;
  const header = {
    title: safeText(rawHeader.title, DEFAULT_LINKS.header.title),
    subtitle: safeText(rawHeader.subtitle, DEFAULT_LINKS.header.subtitle),
  };
  const quick = {
    phone: safeText(rawQuick.phone, DEFAULT_LINKS.quick.phone),
    hours: safeText(rawQuick.hours, DEFAULT_LINKS.quick.hours),
    days: safeText(rawQuick.days, DEFAULT_LINKS.quick.days),
  };
  const groups = (Array.isArray(C.groups) ? C.groups : DEFAULT_LINKS.groups)
    .filter(g => g && typeof g === "object")
    .map(g => ({
      ...g,
      title: safeText(g.title),
      items: (Array.isArray(g.items) ? g.items : [])
        .filter(it => it && typeof it === "object")
        .map(it => ({ ...it, label: safeText(it.label), desc: safeText(it.desc) })),
    }));
  const footer = safeText(C.footer, DEFAULT_LINKS.footer);

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

/**
 * The second step of "choose your track": what a student picks after the
 * track itself. Derived from TREE so the picker can never drift from the
 * catalogue the rest of the app browses.
 *   تحضيري      → خطة أ / خطة ب
 *   تخصص        → college, then a program inside it
 *   دبلوم/عليا  → a program directly
 */
const TRACK_PLANS = {
  "تحضيري": ["خطة أ", "خطة ب"],
  "دبلوم": TREE.diploma.programs,
  "دراسات عليا": TREE.graduate.programs,
};
const TRACK_COLLEGES = TREE.bachelor.colleges.map(c => ({ label: c.label, programs: c.programs }));
const collegePrograms = (label) => TRACK_COLLEGES.find(c => c.label === label)?.programs || [];
// A track needs a college chosen first only for تخصص.
const trackNeedsCollege = (track) => track === "تخصص";
const planOptionsFor = (track, college) =>
  trackNeedsCollege(track) ? collegePrograms(college) : (TRACK_PLANS[track] || []);
/** Is this profile complete enough to be saved/confirmed? */
const profileComplete = (p) => {
  if (!p?.name?.trim() || !p?.track) return false;
  if (trackNeedsCollege(p.track) && !p.college) return false;
  // Only require a plan/programme when the chosen track actually offers one.
  return planOptionsFor(p.track, p.college).length === 0 || !!p.plan;
};
/** Human label for a chosen track, e.g. "تحضيري — خطة أ". */
const trackLabel = (p) => {
  if (!p?.track) return "";
  const parts = [p.track];
  if (p.college) parts.push(p.college);
  if (p.plan) parts.push(p.plan);
  return parts.join(" — ");
};

// A confirmed track is locked for this long; changing sooner needs a request.
const TRACK_LOCK_DAYS = 15;
const trackLockRemaining = (p) => {
  if (!p?.confirmedAt) return 0;
  const elapsed = Date.now() - Number(p.confirmedAt);
  const left = TRACK_LOCK_DAYS * 86400000 - elapsed;
  return left > 0 ? Math.ceil(left / 86400000) : 0;
};

/**
 * The subjects a student's own plan puts in front of them.
 *
 * تحضيري is the only track the catalogue breaks into subjects — خطة أ and
 * خطة ب are its two terms. Everywhere else the programme itself is the leaf
 * the rest of the app treats as a course, so that is what comes back.
 */
const myTrackSubjects = (p) => {
  if (!p?.track) return [];
  if (p.track === "تحضيري") {
    const idx = TRACK_PLANS["تحضيري"].indexOf(p.plan);
    const term = Object.values(TREE.preparatory.plans)[idx];
    return term?.subjects || [];
  }
  return p.plan ? [p.plan] : [];
};

/** The track+date stamp that outlives a sign-out or a data reset. */
const lockStampOf = (p) =>
  p?.confirmedAt ? { track: p.track, college: p.college || "", plan: p.plan || "", confirmedAt: p.confirmedAt } : null;

/**
 * Does `stamp` still hold this profile to a track?
 *
 * The stamp is kept separately from the profile on purpose: signing out or
 * resetting the data would otherwise be a one-tap way around the 15-day lock,
 * which is exactly what the lock exists to prevent.
 */
const lockConflicts = (stamp, draft) =>
  !!stamp && trackLockRemaining(stamp) > 0 &&
  (stamp.track !== draft.track || (stamp.college || "") !== (draft.college || "") || (stamp.plan || "") !== (draft.plan || ""));

// Kept for older code paths that referenced the flat plan map.
const AUTH_PLANS = TRACK_PLANS;

/* ══════════════════════════════════════════════════════════════
   RETURN VISIT — the screen a signed-out student comes back to
   ══════════════════════════════════════════════════════════════ */
/**
 * Shown only when an account was saved at sign-out ("حفظ حسابي"). The site
 * itself stays public — this is a local identity check, not authentication:
 * the data never left the device, so the ID match is a guard against the
 * wrong person on a shared phone, nothing more.
 */
function WelcomeBack({ saved, t, onEnter, onForget, onSkip }) {
  const [name, setName] = useState("");
  const [err, setErr] = useState("");


  // This screen was never authentication and pretending otherwise did harm.
  // The profile it guards is already sitting in this browser's storage —
  // anyone holding the phone has it whatever they type here. Checking a
  // university number only ever locked out the person who mistyped their own.
  // It picks up where they left off; that is the whole job.
  const submit = () => {
    if (!name.trim()) { setErr("اكتب اسمك"); return; }
    onEnter({ ...saved, name: name.trim() });
  };

  const field = {
    width: "100%", border: `1.5px solid ${t.bd}`, borderRadius: 12, padding: "12px 14px",
    fontSize: 15, background: t.s2, color: t.tx, fontFamily: "inherit", outline: "none", boxSizing: "border-box",
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 800, background: t.bg, overflowY: "auto",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }}>
      <div style={{ width: "100%", maxWidth: 380, animation: "fadeUp .4s ease" }}>
        <div style={{ textAlign: "center", marginBottom: 22 }}>
          <div style={{
            width: 72, height: 72, borderRadius: 24, margin: "0 auto 14px",
            background: `linear-gradient(135deg,${P.gold},#e8bf5c)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: `0 10px 28px ${P.gold}55`, fontSize: 32, fontWeight: 900, color: "#3a2e05",
          }}>
            {(saved.name || "ط").trim()[0] || "ط"}
          </div>
          <div style={{ fontSize: 21, fontWeight: 900, color: t.tx }}>أهلاً بعودتك</div>
          <div style={{ fontSize: 13, color: t.mu, marginTop: 6, lineHeight: 1.7 }}>
            تابع في ملفك المحفوظ على هذا الجهاز
          </div>
        </div>

        {/* One tap for the saved account — no typing needed */}
        <button onClick={() => onEnter(saved)} style={{
          width: "100%", background: t.s1, border: `1.5px solid ${P.gold}55`, borderRadius: 16,
          padding: "14px 16px", cursor: "pointer", fontFamily: "inherit", marginBottom: 14,
          display: "flex", alignItems: "center", gap: 12, textAlign: "right", boxShadow: t.shSm,
        }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: `${P.gold}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <User size={18} color={P.gold} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: t.tx, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{saved.name}</div>
            <div style={{ fontSize: 11.5, color: t.mu }}>{saved.track || "متابعة ملفك"}</div>
          </div>
          <span style={{ fontSize: 12, fontWeight: 800, color: P.gold, flexShrink: 0 }}>متابعة</span>
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "16px 0" }}>
          <div style={{ flex: 1, height: 1, background: t.bd }} />
          <span style={{ fontSize: 11.5, color: t.dim, fontWeight: 700 }}>أو اكتب اسماً آخر</span>
          <div style={{ flex: 1, height: 1, background: t.bd }} />
        </div>

        <label style={{ fontSize: 12, color: t.mu, fontWeight: 700, display: "block", marginBottom: 6 }}>الاسم</label>
        <input value={name} onChange={e => { setName(e.target.value); setErr(""); }} placeholder="اكتب اسمك"
          onKeyDown={e => e.key === "Enter" && submit()}
          style={{ ...field, direction: "rtl" }} />

        {err && (
          <div style={{ background: `${P.red}0d`, border: `1px solid ${P.red}35`, borderRadius: 10, padding: "10px 12px", marginTop: 12 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <AlertTriangle size={15} color={P.red} style={{ flexShrink: 0, marginTop: 1 }} />
              <span style={{ fontSize: 12.5, color: P.red, lineHeight: 1.6 }}>{err}</span>
            </div>
          </div>
        )}

        <Btn variant="primary" onClick={submit} style={{ width: "100%", marginTop: 16 }}>
          <LogIn size={15} /> دخول
        </Btn>

        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          {/* "Browse" is a real destination, not a way of giving up: the site
              is fully usable without a profile, so say so rather than making
              this look like the failure branch. */}
          <Btn variant="ghost" size="sm" onClick={onSkip} style={{ flex: 1.4 }}>
            <Compass size={13} /> تصفّح الموقع
          </Btn>
          <Btn variant="ghost" size="sm" onClick={() => { if (confirm(`حذف حساب «${saved.name}» المحفوظ على هذا الجهاز، والبدء بملف جديد؟`)) onForget(); }} style={{ flex: 1, color: P.red }}>
            <Plus size={13} /> ملف جديد
          </Btn>
        </div>

        <div style={{ fontSize: 11.5, color: t.dim, textAlign: "center", marginTop: 16, lineHeight: 1.8 }}>
          الموقع مفتوح للجميع بلا تسجيل — المواد والتقويم والجدول والمساعد تعمل كلها بلا حساب.
          <br />الملف الشخصي يضيف مسارك ومهامك ومفضلتك، ويُحفظ على جهازك.
        </div>
      </div>
    </div>
  );
}

// How early a lecture reminder fires. 0 means "when it starts", like an alarm.
const REMIND_CHOICES = [
  { min: 0, label: "عند البدء" },
  { min: 5, label: "قبل 5 د" },
  { min: 10, label: "قبل 10 د" },
  { min: 15, label: "قبل 15 د" },
  { min: 30, label: "قبل 30 د" },
  { min: 60, label: "قبل ساعة" },
];
const remindLabel = (m) => (REMIND_CHOICES.find(c => c.min === Number(m))?.label) || `قبل ${m} د`;
// Lectures saved before this existed keep the original 5-minute lead.
const lectureLead = (lec) => (lec.remindMin == null ? 5 : Number(lec.remindMin));

/**
 * Fires each lecture's reminder at its own lead time (while the app is open):
 * in-app toast + chime + a browser notification when permitted.
 */
function useLectureReminders(schedule, notifSoundOn, push) {
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
        const lead = lectureLead(lec);
        const diff = (h * 60 + m) - nowMin;
        const key = `${lec.id}_${dateKey}`;
        // "At start" still needs a small window so a tick can land inside it.
        const due = lead === 0 ? (diff <= 0 && diff > -2) : (diff > 0 && diff <= lead);
        if (due && !firedRef.current.has(key)) {
          firedRef.current.add(key);
          const where = lec.mode === "أونلاين" ? "أونلاين" : (lec.room || "");
          const when = diff <= 0 ? "تبدأ الآن" : `تبدأ خلال ${diff} دقيقة`;
          const body = `${lec.course} ${when}${where ? " • " + where : ""}`;
          push?.(`⏰ ${body}`, "warn");
          // Rings until acknowledged, capped at 30s. A single chime is missed
          // by anyone not already looking at the phone, which is most of the
          // reason a lecture reminder exists at all.
          if (notifSoundOn) startRinging(30);
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
  }, [schedule, notifSoundOn, push]);
}

/**
 * Fire a task's reminder once, at its chosen lead time before the deadline.
 *
 * Mirrors useLectureReminders, but a task's deadline is an instant rather than
 * a weekly slot, so the fired key is the task id alone: a deadline passes once.
 */
function useTaskReminders(tasks, notifSoundOn, push) {
  const firedRef = useRef(null);
  if (firedRef.current === null) firedRef.current = new Set();
  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      // Several tasks can come due together — especially on the first tick
      // after opening the app. One chime for the batch, not one per task.
      let chimed = false;
      (tasks || []).forEach(tk => {
        if (tk.done || tk.remind === false) return;
        const due = taskDueAt(tk);
        if (!due) return;
        const lead = taskLead(tk);
        const minsLeft = Math.round((due.getTime() - now) / 60000);
        // Inside the lead window and not yet past the deadline.
        if (minsLeft > lead || minsLeft < 0) return;
        const key = String(tk.id);
        if (firedRef.current.has(key)) return;
        firedRef.current.add(key);
        const when = minsLeft <= 0 ? "ينتهي الآن"
          : minsLeft < 60 ? `يُغلق خلال ${minsLeft} دقيقة`
          : minsLeft < 1440 ? `يُغلق خلال ${Math.round(minsLeft / 60)} ساعة`
          : `يُغلق خلال ${Math.round(minsLeft / 1440)} يوم`;
        const body = `${tk.type ? tk.type + ": " : ""}${tk.title} — ${when}`;
        push?.(`🔔 ${body}`, "warn");
        if (notifSoundOn && !chimed) { startRinging(30); chimed = true; }
        try {
          if (typeof Notification !== "undefined" && Notification.permission === "granted") {
            new Notification("تذكير مهمة — حلول", { body, icon: "/icons/icon-192.png", tag: key });
          }
        } catch {}
      });
    };
    tick();
    const iv = setInterval(tick, 60000);
    return () => clearInterval(iv);
  }, [tasks, notifSoundOn, push]);
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
  const [localProfile, setLocalProfile] = useStored("student_profile", null);
  // One owner of identity. A Supabase session wins when there is one; the
  // device-local profile still stands for anyone who has not made an account
  // yet, so nothing a current student has is lost the day this ships.
  const account = useAccount({ localProfile, setLocalProfile });
  const profile = account.profile;
  const setProfile = (next) => {
    const value = typeof next === "function" ? next(profile) : next;
    setLocalProfile(value);
    if (account.signedIn && value) account.saveProfile(value);
  };
  // Signing out keeps the account here (unless "حفظ حسابي" is off) so the
  // return visit can offer it back behind a name + ID screen.
  const [savedAccount, setSavedAccount] = useStored("saved_account", null);
  const [rememberAccount, setRememberAccount] = useStored("remember_account", true);
  const [signedOut, setSignedOut] = useStored("signed_out", false);
  // The track stamp lives outside the profile on purpose — see lockConflicts.
  const [trackLock, setTrackLock] = useStored("track_lock", null);
  const [gpaCalcs, setGpaCalcs] = useStored("gpaCalcs", 0);
  const [aiChats, setAiChats] = useStored("aiChats", 0);
  const [semesters, setSemesters] = useStored("semesters", []);
  const [soundOn, setSoundOn] = useSyncedSetting("soundOn", "sound_on", true);
  // Notification chime is its own switch: plenty of people want the lecture
  // reminder audible while keeping the study timer silent.
  const [notifSoundOn, setNotifSoundOn] = useSyncedSetting("notifSoundOn", "notif_sound_on", true);
  const [weeklyGoal, setWeeklyGoal] = useSyncedSetting("weeklyGoal", "weekly_goal", 15);
  const [seen, setSeen] = useSyncedSetting("onboarded", "onboarded", false);
  const [tasks, setTasks] = useStored("tasks", []);
  const [schedule, setSchedule] = useStored("schedule", []);
  const [exams, setExams] = useStored("exams", []);
  const [aiSubject, setAiSubject] = useState("عام");
  // The assistant's subject list, with the student's own plan lifted to the top.
  // Only ever a widening, never the default: the picker below shows the
  // student's own plan and nothing else until they ask for the rest.
  const [aiAllSubjects, setAiAllSubjects] = useState(false);
  const aiSubjectGroups = useMemo(() => {
    const mine = myTrackSubjects(profile).filter(s => ALL_COURSES.includes(s));
    return { mine, rest: ALL_COURSES.filter(c => !mine.includes(c)) };
  }, [profile]);
  const [aiGlobalTab, setAiGlobalTab] = useState("chat");
  const [aiClearKey, setAiClearKey] = useState(0);
  const clearGlobalAI = () => {
    const histKey = `aiHistory_${aiSubject.replace(/\s+/g, "_").slice(0, 40)}`;
    storage.set(histKey, null);
    setAiClearKey(k => k + 1);
  };
  const [notifOpen, setNotifOpen] = useState(false);
  const [messagesOpen, setMessagesOpen] = useState(false);
  const [msgUnread, setMsgUnread] = useState(0);

  // The badge has to be right before the sheet is ever opened, or a reply
  // waiting for someone is a reply they have no reason to go and look for.
  // Cheap enough to repeat: one indexed count, not a scan of the messages.
  useEffect(() => {
    let alive = true;
    const check = () => fetch("/api/messages")
      .then(r => r.json())
      .then(d => { if (alive) setMsgUnread(d.unread || 0); })
      .catch(() => {});
    check();
    const id = setInterval(check, 60_000);
    return () => { alive = false; clearInterval(id); };
  }, []);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAI, setShowAI] = useState(false);
  const [showOnboard, setShowOnboard] = useState(true);
  const t = T(dark, brandPreset);
  const toasts = useToasts();
  useLectureReminders(schedule, notifSoundOn, toasts.push);
  useTaskReminders(tasks, notifSoundOn, toasts.push);
  const unread = (notifs || []).filter(n => !n.read).length;
  const overdueTasks = useMemo(() => {
    const today = todayKey();
    return (tasks || []).filter(tk => !tk.done && tk.dueDate && tk.dueDate < today).length;
  }, [tasks]);


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
    const o = [showAI?'A':'',
               notifOpen?'N':'', settingsOpen?'S':'', searchOpen?'Q':''].join('');
    const state = { tab, course: course || null, o };
    const top = navHistoryRef.current[navHistoryRef.current.length - 1];
    if (!top || top.tab !== state.tab || top.course !== state.course || top.o !== state.o) {
      navHistoryRef.current.push(state);
      window.history.pushState(state, '');
    }
  }, [tab, course, showAI, notifOpen, settingsOpen, searchOpen]);

  const backHandlerRef = useRef(null);
  backHandlerRef.current = () => {
    if (navHistoryRef.current.length <= 1) return;
    skipNavPushRef.current = true;
    navHistoryRef.current.pop();
    const prev = navHistoryRef.current[navHistoryRef.current.length - 1];
    if (!prev) { skipNavPushRef.current = false; return; }
    // Close overlays that weren't open in previous state
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
  };

  // Public site: every feature is open to everyone, no account required.
  // A caller may hand the assistant an opening question (the study tip does).
  const [aiSeed, setAiSeed] = useState("");
  // The subscription sheet, opened from the assistant when the free
  // allowance runs out (or from the "اشتراك" chip at any time).
  const [subOpen, setSubOpen] = useState(null); // null | gate object
  const [supportOpen, setSupportOpen] = useState(false);
  const [aiEmail, setAiEmail] = useStored("ai_email", "");
  // Browsing is open; downloading, asking and saving are what an account is
  // for. One rule, in one place — see browseGate in auth-config.js for why it
  // is "has a profile" today and how it tightens to "has an account".
  const allowed = browseGate(profile, account.signedIn);
  const [needAccount, setNeedAccount] = useState(null);   // null | "file" | "ai" | "save"

  const requestAI = (seed) => {
    if (!allowed) { setNeedAccount("ai"); return; }
    setAiSeed(typeof seed === "string" ? seed : ""); setShowAI(true);
  };

  const toggleFav = (s) => {
    // "لا يُحفظ له شيء" — a favourite is saved state, so it needs the account
    // like everything else that persists.
    if (!allowed) { setNeedAccount("save"); return; }
    const exists = favorites.includes(s);
    toasts.push(exists ? `أُزيلت ${s} من المفضلة` : `أُضيفت ${s} للمفضلة`, exists ? "info" : "success");
    setFavorites(prev => (prev || []).includes(s) ? (prev || []).filter(x => x !== s) : [...(prev || []), s]);
  };

  /**
   * Wipe the study data but keep who the student is.
   *
   * This is the "start the semester fresh" reset. It deliberately leaves the
   * profile, the saved account, and the settings alone — losing your track to
   * clear a to-do list would be a surprise, and it would also hand everyone a
   * one-tap way past the 15-day track lock.
   */
  const resetStudyData = () => {
    setFavorites([]); setNotifs(NOTIFS_SEED); setNotes({});
    setTotalSessions(0); setSessionLog([]); setGpaCalcs(0); setAiChats(0); setSemesters([]);
    setTasks([]); setSchedule([]); setExams([]);
    setTab("home"); setCourse(null);
  };

  /** Everything above, plus the identity — the track lock stamp still stands. */
  const resetAll = () => {
    const stamp = lockStampOf(profile) || trackLock;
    storage.clear();
    resetStudyData();
    setDark(false); setSoundOn(true); setNotifSoundOn(true); setWeeklyGoal(15);
    setLocalProfile(null); setSavedAccount(null); setSignedOut(false); setRememberAccount(true);
    // Re-write the stamp after storage.clear() so the hold survives the wipe.
    // A fresh object matters: passing the same reference back wouldn't count as
    // a change, so nothing would be written and the cleared key would stay gone.
    setTrackLock(stamp ? { ...stamp } : null);
    setSeen(false); // a full wipe returns the device to its first-run state
  };

  /**
   * Sign out of the local profile. With "حفظ حسابي" on, the account is parked
   * in `saved_account` and the next visit opens on the name + ID screen; with
   * it off, the profile is gone from this device for good.
   */
  const signOut = async () => {
    // The hold outlives the sign-out: it is anchored on a stamp kept outside
    // the profile precisely so signing out cannot be used to escape it.
    setTrackLock(lockStampOf(profile) || trackLock);
    if (account.signedIn) {
      await account.signOut();
      toasts.push("تم تسجيل الخروج — يمكنك الدخول مرة أخرى من «حسابي»", "info");
    } else {
      if (rememberAccount && profile) {
        setSavedAccount(profile);
        setSignedOut(true);
        toasts.push("تم تسجيل الخروج — للدخول مرة أخرى افتح «حسابي»", "info");
      } else {
        setSavedAccount(null);
        setSignedOut(false);
        toasts.push("تم تسجيل الخروج وحُذف ملفك — يمكنك إنشاء حساب من «حسابي»", "info");
      }
      setLocalProfile(null);
    }
    setTab("home"); setCourse(null);
  };

  const resetCounts = useMemo(() => ({
    favorites: (favorites || []).length,
    notes: Object.keys(notes || {}).length,
    tasks: (tasks || []).length,
    schedule: (schedule || []).length,
    exams: (exams || []).length,
    profile: profile ? 1 : 0,
  }), [favorites, notes, tasks, schedule, exams, profile]);

  // After the welcome, land straight on the (public) site — no gate.
  const finishOnboard = () => { setSeen(true); setShowOnboard(false); };


  const TABS = [
    { id: "home", Icon: Home, label: "الرئيسية" },
    // Once a track is confirmed the explorer is scoped to it, so the label
    // "المسارات" (plural, all of them) stops being true.
    { id: "explore", Icon: Compass, label: profile?.track ? "مساري" : "المسارات" },
    { id: "schedule", Icon: CalendarDays, label: "جدولي" },
    // حسابي sits in the middle and is raised: it is the one tab that is about
    // you rather than about content, and the middle of a seven-tab row is the
    // easiest place to hit with a thumb.
    { id: "profile", Icon: CircleUser, label: "حسابي", raised: true },
    { id: "calendar", Icon: Calendar, label: "التقويم" },
    { id: "fav", Icon: Star, label: "المفضلة" },
    { id: "links", Icon: Link2, label: "روابط" },
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
        {/* Messages sit beside announcements, not inside settings. A reply is
            something addressed to you; an announcement is not, and burying the
            first behind a gear icon is how replies went unread. */}
        <button onClick={() => setMessagesOpen(true)} title="الرسائل" aria-label="الرسائل" style={{
          position: "relative", background: t.s2, border: `1px solid ${msgUnread > 0 ? `${P.gold}55` : t.bd}`,
          borderRadius: 10, padding: 8, cursor: "pointer", display: "flex",
          color: msgUnread > 0 ? P.gold : t.mu,
        }}>
          <Mail size={16} />
          {msgUnread > 0 && <span style={{
            position: "absolute", top: -4, right: -4, minWidth: 16, height: 16, borderRadius: 8,
            padding: "0 3px", background: P.gold, display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 11, fontWeight: 900, color: "#1a1a1a",
          }}>{msgUnread > 9 ? "9+" : msgUnread}</span>}
        </button>
        <button onClick={() => setNotifOpen(true)} title="الإشعارات" aria-label="الإشعارات" style={{
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
          openCourse={openCourse} onOpenAI={requestAI} t={t}
          weeklyGoal={weeklyGoal} semesters={semesters}
          schedule={schedule} tasks={tasks} setTasks={setTasks} onToast={toasts.push}
          exams={exams} setExams={setExams} profile={profile} />}

        {tab === "explore" && !course && <ExplorePage onCourse={openCourse} t={t} profile={profile} />}

        {tab === "schedule" && <SchedulePage t={t} schedule={schedule} setSchedule={setSchedule} onToast={toasts.push} />}

        {tab === "course" && course && <CoursePage
          subject={course} favorites={favorites} toggleFav={toggleFav}
          notes={notes} setNotes={setNotes} t={t}
          onChat={() => setAiChats(c => c + 1)} onToast={toasts.push}
          onAskAI={(subj) => { if (!allowed) { setNeedAccount("ai"); return; } setAiSubject(subj); setAiGlobalTab("chat"); setShowAI(true); }}
          canOpenFiles={allowed} onNeedAccount={() => setNeedAccount("file")}
          onBack={() => { setCourse(null); setTab("explore"); }} />}

        {tab === "fav" && <FavoritesPage favorites={favorites} onCourse={openCourse} toggleFav={toggleFav} t={t} />}

        {tab === "links" && <SEULinksPage t={t} content={linksContent} />}

        {tab === "calendar" && <CalendarPage t={t} profile={profile} />}

        {tab === "gpa" && (
          <div style={{ animation: "fadeUp .4s ease" }}>
            <h2 style={{ fontSize: 20, fontWeight: 900, color: t.tx, marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
              <Calculator size={20} color={P.blue2} /> حاسبة المعدل الأكاديمي
            </h2>
            <GPACalc t={t} onCalc={() => setGpaCalcs(c => c + 1)}
              semesters={semesters} setSemesters={setSemesters} onToast={toasts.push} />
            <SemesterChart semesters={semesters} t={t} />
          </div>
        )}

        {tab === "profile" && <ProfilePage
          t={t} favorites={favorites} profile={profile} setProfile={setProfile}
          setActiveTab={(id) => { setTab(id); setCourse(null); }} onToast={toasts.push}
          onSignOut={signOut} trackLock={trackLock} setTrackLock={setTrackLock}
          tasks={tasks} schedule={schedule} aiEmail={aiEmail} setAiEmail={setAiEmail}
          notes={notes} openCourse={openCourse} openSettings={() => setSettingsOpen(true)}
          savedAccount={savedAccount} onLogin={() => setSignedOut(true)}
          accounts={account.configured} signedIn={account.signedIn}
          onMessages={() => setMessagesOpen(true)} msgUnread={msgUnread}
          studentCode={profile?.studentCode || ""} />}
      </div>

      {/* Floating AI assistant button — reachable from any main tab */}
      {!showAI && !settingsOpen && !searchOpen && !notifOpen && !course && (
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
        overflowX: "auto", overflowY: "visible", WebkitOverflowScrolling: "touch",
        scrollbarWidth: "none", padding: "6px 8px 14px",
        boxShadow: dark ? "0 -1px 20px rgba(0,0,0,.5)" : "0 -1px 16px rgba(0,80,45,.08)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 2, minWidth: "max-content", margin: "0 auto", justifyContent: "center" }}>
        {TABS.map(({ id, Icon, label, raised }) => {
          const active = id === "explore" ? (tab === "explore" || tab === "course") : tab === id;
          const badge = id === "home" ? overdueTasks : 0;
          // The raised tab keeps a filled circle whether or not it is active,
          // so it reads as the anchor of the row rather than another chip.
          const filled = raised || active;
          return (
            <button key={id} onClick={() => { setTab(id); setCourse(null); }}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                background: "none", border: "none", cursor: "pointer", padding: "5px 4px",
                transition: "all .2s", fontFamily: "inherit", flexShrink: 0,
                marginTop: raised ? -14 : 0,
              }}>
              <div style={{
                width: raised ? 46 : 38, height: raised ? 46 : 31,
                borderRadius: raised ? "50%" : 12, position: "relative",
                background: filled ? `linear-gradient(135deg,${P.navy},${P.blue2})` : "transparent",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all .25s",
                border: raised ? `3px solid ${dark ? "rgba(8,19,13,.96)" : "rgba(255,255,255,.96)"}` : "none",
                boxShadow: raised
                  ? `0 4px 14px ${P.blue}66${active ? `, 0 0 0 2px ${P.gold}` : ""}`
                  : (active ? `0 3px 12px ${P.blue}55` : "none"),
              }}>
                <Icon size={raised ? 21 : 17} color={filled ? "#fff" : t.dim} strokeWidth={active ? 2.5 : 1.8} />
                {badge > 0 && <span style={{ position: "absolute", top: -3, right: -3, width: 14, height: 14, borderRadius: "50%", background: P.red, color: "#fff", fontSize: 10, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center" }}>{badge}</span>}
              </div>
              <span style={{ fontSize: 10.5, fontWeight: active || raised ? 800 : 500, color: active ? P.blue2 : (raised ? t.tx : t.dim), whiteSpace: "nowrap" }}>{label}</span>
            </button>
          );
        })}
        </div>
      </div>

      {/* PANELS / MODALS */}
      {notifOpen && <NotifPanel t={t} onClose={() => setNotifOpen(false)} notifs={notifs} setNotifs={setNotifs} profile={profile} onToast={toasts.push} />}
      {settingsOpen && <SettingsPanel t={t} onClose={() => setSettingsOpen(false)}
        dark={dark} setDark={setDark} soundOn={soundOn} setSoundOn={setSoundOn}
        notifSoundOn={notifSoundOn} setNotifSoundOn={setNotifSoundOn}
        weeklyGoal={weeklyGoal} setWeeklyGoal={setWeeklyGoal}
        onReset={resetStudyData} onResetAll={resetAll} resetCounts={resetCounts}
        profile={profile} rememberAccount={rememberAccount} setRememberAccount={setRememberAccount}
        onSignOut={signOut} onSupport={() => setMessagesOpen(true)} onToast={toasts.push} />}
      {messagesOpen && <MessagesSheet t={t} onClose={() => setMessagesOpen(false)}
        profile={profile} email={aiEmail || profile?.email || ""}
        onToast={toasts.push} onUnread={setMsgUnread} />}
      {searchOpen && <SearchOverlay t={t} onClose={() => { setSearchOpen(false); setSearchQuery(""); }}
        query={searchQuery} setQuery={setSearchQuery} onCourse={openCourse}
        onNavigate={(id) => { setTab(id); setCourse(null); }} />}
      {supportOpen && <SupportSheet t={t} onClose={() => setSupportOpen(false)}
        profile={profile} email={profile?.email || aiEmail} page={tab} onToast={toasts.push} />}

      {subOpen && <SubscribeSheet t={t} onClose={() => setSubOpen(null)} profile={profile}
        email={profile?.email || aiEmail} onSaveEmail={setAiEmail} gate={subOpen} onToast={toasts.push} />}

      {showOnboard && <Onboarding onClose={finishOnboard} skipWalkthrough={seen} t={t} />}

      {/* Came back after signing out with an account saved on this device */}
      {signedOut && savedAccount && !showOnboard && (
        <WelcomeBack
          saved={savedAccount} t={t}
          onEnter={(p) => {
            setProfile(p);
            setSavedAccount(p);
            setSignedOut(false);
            toasts.push(`أهلاً بعودتك ${p.name} 👋`, "success");
          }}
          onForget={() => {
            setSavedAccount(null); setSignedOut(false);
            toasts.push("حُذف الحساب المحفوظ من هذا الجهاز", "info");
          }}
          onSkip={() => setSignedOut(false)}
        />
      )}

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
              {/* The global panel keeps its own header, so the standalone
                  one's rename does not reach here. Same promise, same words:
                  "مسح" reads as deleting something of yours, which is not what
                  this does. */}
              <button onClick={clearGlobalAI} title="ابدأ محادثة جديدة" style={{ background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.2)", borderRadius: 8, padding: "5px 12px", fontSize: 12, color: "rgba(255,255,255,.8)", cursor: "pointer", fontFamily: "inherit", fontWeight: 600, flexShrink: 0, display: "flex", alignItems: "center", gap: 5 }}>
                <Plus size={13} /> محادثة جديدة
              </button>
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
                  {/* Bound to the student's plan, not merely sorted by it. A
                      تحضيري/خطة أ student was still handed all 22 catalogue
                      entries with their three lifted to the top; their own
                      three (plus عام) are the whole list now. Someone with no
                      plan chosen — anyone browsing — still gets everything,
                      and "كل المواد" below widens it back for the rest. */}
                  {aiSubjectGroups.mine.length > 0 && (
                    <optgroup label="موادي" style={{ background: "#0a3d29", color: "#fff" }}>
                      {aiSubjectGroups.mine.map(c => <option key={c} value={c} style={{ background: "#0a3d29", color: "#fff" }}>{c}</option>)}
                    </optgroup>
                  )}
                  {(aiSubjectGroups.mine.length === 0 || aiAllSubjects) && (
                    aiSubjectGroups.mine.length > 0 ? (
                      <optgroup label="كل المواد" style={{ background: "#0a3d29", color: "#fff" }}>
                        {aiSubjectGroups.rest.map(c => <option key={c} value={c} style={{ background: "#0a3d29", color: "#fff" }}>{c}</option>)}
                      </optgroup>
                    ) : (
                      aiSubjectGroups.rest.map(c => <option key={c} value={c} style={{ background: "#0a3d29", color: "#fff" }}>{c}</option>)
                    )
                  )}
                </select>
                <ChevronDown size={15} color="rgba(255,255,255,.7)" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
              </div>
              {/* myTrackSubjects returns one programme name for تخصص/دبلوم and
                  the three term subjects for تحضيري — so without this a
                  bachelor student's picker would hold two entries and no way
                  out of it. */}
              {aiSubjectGroups.mine.length > 0 && !aiAllSubjects && (
                <button onClick={() => setAiAllSubjects(true)} style={{
                  background: "none", border: "none", padding: "6px 2px 0", cursor: "pointer",
                  fontFamily: "inherit", fontSize: 11.5, fontWeight: 700, color: "rgba(255,255,255,.65)",
                }}>
                  تسأل عن مادة خارج خطتك؟ اعرض كل المواد
                </button>
              )}
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
              ? <AIChat key={`${aiSubject}-${aiClearKey}-${aiSeed ? "s" : ""}`} subject={aiSubject} t={t} onChat={() => setAiChats(c => c + 1)} standalone={false} seed={aiSeed}
                  profile={profile} onSubscribe={(g) => setSubOpen(g || {})}
                  email={aiEmail} onSaveEmail={setAiEmail} />
              : <div style={{ padding: 16, overflowY: "auto", height: "100%" }}><QuizMode key={aiSubject} subject={aiSubject} t={t} onToast={toasts.push} /></div>
            }
          </div>
        </div>
      )}
      {needAccount && (
        <NeedAccountSheet t={t} what={needAccount} accounts={account.configured}
          onClose={() => setNeedAccount(null)} />
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
