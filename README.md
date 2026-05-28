# حلول SEU — الباك-إند والإطار الكامل

منصة طلابية مستقلة للجامعة السعودية الإلكترونية. هذا الإطار جاهز للنشر ويُشغّل:

- 🔐 مصادقة كاملة (بريد + جوجل)
- 🗄️ قاعدة بيانات PostgreSQL مع Row Level Security
- 📦 تخزين ملفات آمن عبر Supabase Storage
- 🤖 وكيل آمن لـ Claude API مع rate limiting وتتبّع التكلفة
- 📡 إشعارات realtime
- 📱 PWA قابل للتثبيت على الجوّال

---

## 1. المتطلّبات

- Node.js 18.17+
- حساب Supabase (مجاني) — https://supabase.com
- مفتاح Anthropic API — https://console.anthropic.com
- (اختياري لكن مُوصى به) حساب Upstash Redis للـ rate limiting — https://upstash.com

---

## 2. الإعداد خطوة بخطوة

### أ) أنشئ مشروع Supabase

1. سجّل في https://supabase.com → "New Project"
2. اختر اسم المشروع، كلمة المرور، والمنطقة الأقرب (`eu-central-1` لطلاب السعودية)
3. انتظر دقيقتين حتى يجهز

### ب) شغّل ملفات الـ SQL بالترتيب

اذهب إلى **SQL Editor** في لوحة Supabase ونفّذ الملفات بهذا الترتيب:

```
supabase/migrations/001_initial_schema.sql   ← الجداول والـ functions
supabase/migrations/002_rls_policies.sql     ← سياسات الأمان
supabase/migrations/003_seed_data.sql        ← البيانات الأولية للمواد
```

انسخ محتوى كل ملف، الصقه في SQL Editor، اضغط Run.

### ج) أنشئ مستودعات Storage

في تبويب **Storage**:
1. الـ migration `002` يُنشئ المستودعات تلقائياً، لكن تأكّد من وجود:
   - `course-files` (خاص — للـ PDFs)
   - `avatars` (عام — للصور الشخصية)
2. إذا لم تُنشأ تلقائياً، أنشئها يدوياً بالأذونات المذكورة في الـ SQL.

### د) فعّل تسجيل الدخول عبر جوجل (اختياري)

في **Authentication → Providers → Google**:
1. اتبع التعليمات لإنشاء OAuth Client في Google Cloud Console
2. الصق `Client ID` و `Client Secret` في Supabase
3. أضف رابط الإعادة `https://YOUR_PROJECT.supabase.co/auth/v1/callback`

---

## 3. إعداد المشروع محلياً

```bash
# 1. انسخ المشروع وادخل المجلد
git clone <your-repo-url>
cd seu-hulool

# 2. ثبّت الحزم
npm install

# 3. أنشئ ملف البيئة
cp .env.example .env.local
# افتحه واملأ القيم
```

### تعبئة `.env.local`

من **Supabase Dashboard → Settings → API**:
```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...     # ⚠️ سرّي
```

من **Anthropic Console**:
```env
ANTHROPIC_API_KEY=sk-ant-api03-...
```

من **Upstash** (اختياري):
```env
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
```

### شغّل المشروع

```bash
npm run dev
```

افتح http://localhost:3000

---

## 4. أول تجربة

1. **سجّل حساباً جديداً** عبر `/signup`
2. **افتح SQL Editor** في Supabase ونفّذ:
   ```sql
   UPDATE profiles SET role = 'admin'
   WHERE id = (SELECT id FROM auth.users WHERE email = '[email protected]');
   ```
   لتصبح أنت المسؤول
3. ادخل **Storage → course-files** وارفع ملف PDF تجريبي
4. ادخل **Table Editor → files** وأضف صفّاً بـ:
   - `course_id` = id إحدى المواد
   - `storage_path` = اسم الملف الذي رفعته
   - `category` = `collections`
   - `is_approved` = `true`
5. سترى الملف في الواجهة جاهزاً للتنزيل بروابط موقّعة

---

## 5. بنية المشروع

```
seu-hulool/
├── src/
│   ├── app/
│   │   ├── layout.jsx              ← الـ root layout بالـ RTL
│   │   ├── page.jsx                ← الصفحة الرئيسية (حماية auth)
│   │   ├── login/page.jsx          ← تسجيل الدخول
│   │   ├── signup/page.jsx         ← التسجيل الجديد
│   │   ├── reset-password/page.jsx ← إعادة تعيين كلمة المرور
│   │   ├── auth/callback/route.js  ← معالج OAuth
│   │   └── api/chat/route.js       ← 🔥 وكيل Claude الآمن
│   │
│   ├── components/
│   │   ├── AuthShell.jsx           ← هيكل صفحات auth
│   │   └── HuloolApp.jsx           ← التطبيق الرئيسي (ضع كود الواجهة هنا)
│   │
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.js           ← عميل المتصفح
│   │   │   ├── server.js           ← عميل الخادم + admin
│   │   │   └── middleware.js       ← تحديث الجلسات
│   │   ├── hooks/
│   │   │   ├── useFavorites.js     ← المفضلات
│   │   │   ├── useNote.js          ← الملاحظات الشخصية
│   │   │   ├── useSessions.js      ← جلسات البومودورو + الإحصائيات
│   │   │   ├── useCourses.js       ← المواد والملفات
│   │   │   ├── useNotifications.js ← الإشعارات الـ realtime
│   │   │   └── useProfile.js       ← الملف الشخصي والإعدادات
│   │   ├── chat-client.js          ← streaming من /api/chat
│   │   └── rate-limit.js           ← Upstash rate limiter
│   │
│   └── middleware.js               ← حماية المسارات
│
├── supabase/migrations/
│   ├── 001_initial_schema.sql
│   ├── 002_rls_policies.sql
│   └── 003_seed_data.sql
│
└── public/
    └── manifest.json               ← PWA
```

---

## 6. دمج كود الواجهة الكامل

عندك ملف `seu-portal-pro-v2.jsx` من المرحلة السابقة. هذا ما يلزم تعديله:

| القديم (في `seu-portal-pro-v2.jsx`) | الجديد |
|---|---|
| `useStored('favorites', [])` | `useFavorites()` |
| `useStored('notes', {})` | `useNote(courseId)` (لكل مادة) |
| `useStored('sessionLog', [])` | `useSessions()` |
| ثابت `TREE` المكتوب في الكود | `useCourseTree()` |
| ثابت `FILES` | `useCourseFiles(courseId)` |
| `useStored('notifs', NOTIFS_SEED)` | `useNotifications()` |
| `useStored('dark', true)` + `useStored('weeklyGoal', 15)` | `useProfile()` + `updateProfile()` |
| `fetch('https://api.anthropic.com/...')` في `AIChat` | `streamChat()` من `@/lib/chat-client` |
| التنزيل الوهمي للملفات | `downloadFile(id)` من `useCourseFiles` |

افتح `src/components/HuloolApp.jsx` — التعليقات في أعلاه تشرح كل خطوة بالتفصيل.

---

## 7. النشر على Vercel

```bash
npm i -g vercel
vercel
```

بعد النشر الأول:
1. اذهب إلى **Vercel Dashboard → Project → Settings → Environment Variables**
2. أضف **كل** المتغيرات من `.env.local`
3. أعد النشر

### إعدادات Supabase للإنتاج

في **Supabase → Authentication → URL Configuration**:
- **Site URL**: `https://your-domain.com`
- **Redirect URLs**: `https://your-domain.com/auth/callback`

---

## 8. تفعيل أيقونة التطبيق على الجوّال

أنشئ أيقونات بهذه الأحجام وضعها في `public/icons/`:
- `icon-192.png` (192×192)
- `icon-512.png` (512×512)

استخدم https://maskable.app لإنشاء أيقونات قابلة للقناع المناسبة لـ Android.

---

## 9. الترقية المستقبلية

### بحث ذكي بالعربية
الـ schema يستخدم `pg_trgm` للبحث الضبابي. للبحث الأقوى، أضف **Meilisearch** أو **Typesense**.

### الدفع (للنسخة Premium)
- **Moyasar** أو **Tap** للدفع السعودي (مدى، فيزا)
- **Stripe** للدفع الدولي
- أنشئ جدول `subscriptions` وأضف `is_premium` boolean في `profiles`

### لوحة تحكم Admin
المسار `/admin` محجوز. أنشئ صفحة فيه تتحقق من `profile.role === 'admin'` وتعرض:
- رفع ملفات PDF + ربطها بالمواد
- إدارة الموادّ والكليات
- بثّ إشعارات
- إحصائيات الاستخدام

---

## 10. الأمان — Checklist قبل الإطلاق

- [ ] لم تعرض `SUPABASE_SERVICE_ROLE_KEY` أو `ANTHROPIC_API_KEY` في الـ frontend
- [ ] فعّلت RLS على **كل** الجداول
- [ ] اختبرت تسجيل دخول مستخدم آخر — هل يستطيع رؤية بيانات مستخدم آخر؟
- [ ] فعّلت Email rate limiting في Supabase (Settings → Auth)
- [ ] فعّلت Upstash للـ rate limiting في `/api/chat`
- [ ] حدّدت كمية tokens القصوى في طلبات Claude
- [ ] فعّلت Sentry أو ما يشبهه لتتبع الأخطاء
- [ ] أضفت صفحات `/terms` و `/privacy` (مطلوب لـ Google OAuth)
- [ ] أضفت طريقة للإبلاغ عن محتوى مخالف لحقوق الجامعة

---

## ترخيص

استخدم هذا الإطار كما تشاء. إن نشرت المنصة:
- وضّح أنها **منصة طلابية مستقلة** (ليست رسمية من SEU)
- ألتزم بـ نظام حماية البيانات الشخصية السعودي (PDPL)
- ضع وسيلة تواصل لإزالة المحتوى عند طلب أصحاب الحقوق

بالتوفيق 🚀
