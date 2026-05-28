-- ════════════════════════════════════════════════════════════════
-- SEED DATA — Colleges and Courses
-- Run after schema + RLS migrations
-- ════════════════════════════════════════════════════════════════

-- COLLEGES
INSERT INTO colleges (id, name_ar, name_en, icon, color, sort_order) VALUES
  ('admin',   'العلوم الإدارية والمالية',  'Administrative & Financial Sciences', 'Briefcase', '#1d4ed8', 1),
  ('theory',  'العلوم والدراسات النظرية',  'Theoretical Sciences',               'BookOpen',  '#0369a1', 2),
  ('health',  'العلوم الصحية',             'Health Sciences',                    'Heart',     '#be123c', 3),
  ('cs',      'الحوسبة والمعلوماتية',      'Computing & Informatics',           'Code',      '#065f46', 4),
  ('applied', 'الكلية التطبيقية',          'Applied College',                    'Layers',    '#92400e', 5)
ON CONFLICT (id) DO UPDATE SET
  name_ar = EXCLUDED.name_ar, name_en = EXCLUDED.name_en,
  icon = EXCLUDED.icon, color = EXCLUDED.color, sort_order = EXCLUDED.sort_order;

-- PREPARATORY YEAR — Plan A
INSERT INTO courses (slug, name_ar, track, plan, icon, color, credit_hours, level) VALUES
  ('prep-a-computing',      'حاسب',            'preparatory', 'a', 'Monitor',  '#1a56db', 3, 1),
  ('prep-a-academic',       'مهارات أكاديمية', 'preparatory', 'a', 'BookOpen', '#6d28d9', 3, 1),
  ('prep-a-english-a',      'إنجليزي - خطة أ', 'preparatory', 'a', 'Globe',    '#065f46', 6, 1)
ON CONFLICT (slug) DO NOTHING;

-- PREPARATORY YEAR — Plan B
INSERT INTO courses (slug, name_ar, track, plan, icon, color, credit_hours, level) VALUES
  ('prep-b-math',           'رياضيات',         'preparatory', 'b', 'Calculator',    '#1a56db', 3, 1),
  ('prep-b-communication',  'مهارات اتصال',    'preparatory', 'b', 'MessageCircle', '#6d28d9', 3, 1),
  ('prep-b-english-b',      'إنجليزي - خطة ب', 'preparatory', 'b', 'Globe',         '#065f46', 6, 1)
ON CONFLICT (slug) DO NOTHING;

-- BACHELOR — Administrative & Financial
INSERT INTO courses (slug, name_ar, track, college_id, icon, color) VALUES
  ('ba-business',     'إدارة أعمال',       'bachelor', 'admin', 'Briefcase', '#1d4ed8'),
  ('ba-accounting',   'محاسبة',            'bachelor', 'admin', 'BarChart2', '#1d4ed8'),
  ('ba-finance',      'مالية',             'bachelor', 'admin', 'TrendingUp','#1d4ed8'),
  ('ba-ecommerce',    'تجارة إلكترونية',   'bachelor', 'admin', 'Zap',       '#1d4ed8')
ON CONFLICT (slug) DO NOTHING;

-- BACHELOR — Theoretical Sciences
INSERT INTO courses (slug, name_ar, track, college_id, icon, color) VALUES
  ('ba-media',        'إعلام إلكتروني',         'bachelor', 'theory', 'Wifi',  '#0369a1'),
  ('ba-law',          'قانون',                  'bachelor', 'theory', 'Flag',  '#0369a1'),
  ('ba-english',      'لغة إنجليزية وترجمة',    'bachelor', 'theory', 'Globe', '#0369a1'),
  ('ba-humanities',   'علوم إنسانية',           'bachelor', 'theory', 'Award', '#0369a1'),
  ('ba-basic-sci',    'علوم أساسية',            'bachelor', 'theory', 'Activity','#0369a1')
ON CONFLICT (slug) DO NOTHING;

-- BACHELOR — Health Sciences
INSERT INTO courses (slug, name_ar, track, college_id, icon, color) VALUES
  ('ba-health-info',   'معلوماتية صحية',         'bachelor', 'health', 'Monitor', '#be123c'),
  ('ba-public-health', 'صحة عامة',               'bachelor', 'health', 'Heart',   '#be123c'),
  ('ba-health-admin',  'إدارة رعاية صحية',       'bachelor', 'health', 'Users',   '#be123c')
ON CONFLICT (slug) DO NOTHING;

-- BACHELOR — Computing
INSERT INTO courses (slug, name_ar, track, college_id, icon, color) VALUES
  ('ba-it', 'تقنية معلومات', 'bachelor', 'cs', 'Code',    '#065f46'),
  ('ba-cs', 'علوم حاسب',     'bachelor', 'cs', 'Monitor', '#065f46')
ON CONFLICT (slug) DO NOTHING;

-- DIPLOMAS
INSERT INTO courses (slug, name_ar, track, icon, color) VALUES
  ('dip-marketing',   'دبلوم التسويق والمبيعات',       'diploma', 'Briefcase', '#059669'),
  ('dip-accounting',  'دبلوم المحاسبة التطبيقي',       'diploma', 'BarChart2', '#059669'),
  ('dip-it',          'دبلوم تقنية المعلومات',         'diploma', 'Code',      '#059669'),
  ('dip-office',      'دبلوم الإدارة المكتبية',        'diploma', 'FileText',  '#059669'),
  ('dip-english',     'دبلوم اللغة الإنجليزية للأعمال','diploma', 'Globe',     '#059669'),
  ('dip-secretary',   'دبلوم السكرتارية التنفيذية',    'diploma', 'Users',     '#059669')
ON CONFLICT (slug) DO NOTHING;

-- GRADUATE PROGRAMS
INSERT INTO courses (slug, name_ar, track, icon, color) VALUES
  ('grad-mba',          'ماجستير إدارة الأعمال (MBA)',  'graduate', 'Trophy', '#c8a84b'),
  ('grad-accounting',   'ماجستير المحاسبة المهنية',     'graduate', 'BarChart2','#c8a84b'),
  ('grad-law',          'ماجستير القانون',              'graduate', 'Flag',   '#c8a84b'),
  ('grad-it',           'ماجستير تقنية المعلومات',      'graduate', 'Code',   '#c8a84b'),
  ('grad-cs',           'ماجستير علوم الحاسب',          'graduate', 'Monitor','#c8a84b'),
  ('grad-health-info',  'ماجستير المعلوماتية الصحية',   'graduate', 'Heart',  '#c8a84b'),
  ('grad-public-health','ماجستير الصحة العامة',         'graduate', 'Users',  '#c8a84b'),
  ('grad-quality',      'ماجستير تنفيذي في الجودة',     'graduate', 'Award',  '#c8a84b'),
  ('grad-media',        'ماجستير الإعلام الإلكتروني',   'graduate', 'Wifi',   '#c8a84b')
ON CONFLICT (slug) DO NOTHING;

-- A few sample broadcast notifications
INSERT INTO notifications (user_id, type, title, body) VALUES
  (NULL, 'announcement', 'مرحباً في حلول', 'منصة طلابية مستقلة لطلاب الجامعة السعودية الإلكترونية. ابدأ باستكشاف المسارات والمواد.'),
  (NULL, 'info', 'تحديث الخطط الدراسية', 'تم تحديث خطط السنة التحضيرية للفصل الحالي. تفقد قسم الخطط الدراسية لكل مادة.');

-- ════════════════════════════════════════════════════════════════
-- HOW TO PROMOTE YOURSELF TO ADMIN (run this AFTER you sign up)
-- ════════════════════════════════════════════════════════════════
-- UPDATE profiles SET role = 'admin' WHERE id = (SELECT id FROM auth.users WHERE email = '[email protected]');
