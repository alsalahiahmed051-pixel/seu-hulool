/**
 * The one list of course names, shared by the student site and the admin panel.
 *
 * These two used to keep separate lists, and they drifted: the admin uploaded
 * files under "حاسب", "رياضيات", "إنجليزي" while the site looked for "مهارات
 * الحاسب", "الرياضيات", "مهارات اللغة الإنجليزية 1". Since /api/files matches
 * the course name exactly, nine of the nineteen names in the upload dropdown —
 * including almost every prep-year subject — could never match a file, so
 * uploads simply never appeared. Nobody noticed, because the course page was
 * padding every section with fabricated PDFs.
 *
 * Both sides now import from here, so they cannot drift again.
 */

/**
 * The real course plan, level by level, as SEU actually publishes it.
 *
 * Until now a programme ("إدارة أعمال") was the leaf the whole app treated as a
 * course, so a student's own screen could not name a single subject they sit.
 * These are the course codes per level — the identifiers students actually use
 * with each other and on Blackboard.
 *
 * Transcribed from the twelve programme plans the owner supplied, each one
 * carrying the university's own structure URL. Only programmes whose plan has
 * been transcribed appear here; the rest fall back to the programme card, so
 * nothing is invented for a programme we do not have the plan for.
 *
 * Two conventions applied across all twelve, so a shared course is one course:
 *
 * - **ISLM, not ISLAM.** The four Islamic-studies courses appear as ISLM101‥104
 *   on the university's own Arabic pages (Accounting, Public Health). Three of
 *   the generated summaries write them "ISLAM1xx". They are the same course, and
 *   filing a summary under two spellings would hide it from half the students
 *   who sit it, so the university's spelling wins everywhere.
 * - **Rows with no code are left out.** Where a plan lists "مقرر اختياري" or a
 *   placeholder like `CS4xx`/`HCI4XX`, there is no course page to open and no
 *   file to file under it. The elective a student actually registers is named
 *   in their own schedule, not in the published plan.
 *
 * This is the seed and the offline fallback. `program_plans` in the database is
 * the copy the owner edits, and it wins wherever it has a plan — so a correction
 * is one save in the admin panel, not a deploy.
 */
export const PROGRAM_LEVELS = {
  // ── السنة الأولى المشتركة ───────────────────────────────────────────────
  // The prep year was the one track with no plan: its students got three cards
  // named «مهارات الحاسب» while every bachelor student got codes, a shelf, file
  // counts and search. Same courses, same codes — CS001 is CS001 on the bot and
  // on every one of the twelve plans that prints a prep year.
  //
  // Registered under both plan names because that is what a prep student's
  // profile holds; each sits one level, and both levels are shown so they can
  // see the term ahead.
  'خطة أ': {
    'المستوى الأول': ['ENG001', 'CS001', 'CI001'],
    'المستوى الثاني': ['ENG002', 'MATH001', 'COMM001'],
  },
  'خطة ب': {
    'المستوى الأول': ['ENG001', 'CS001', 'CI001'],
    'المستوى الثاني': ['ENG002', 'MATH001', 'COMM001'],
  },

  // ── العلوم الإدارية والمالية ────────────────────────────────────────────
  // The four share a college core at levels 3 and 4 and diverge after it.
  'إدارة أعمال': {
    'المستوى الثالث': ['ISLM101', 'STAT101', 'LAW101', 'ECON101', 'MGT101', 'ACCT101'],
    'المستوى الرابع': ['ISLM102', 'STAT201', 'FIN101', 'MGT201', 'MGT211', 'ECOM101'],
    'المستوى الخامس': ['ECON201', 'MIS201', 'ECOM201', 'MGT301', 'MGT311', 'MGT312'],
    'المستوى السادس': ['ISLM103', 'ACCT301', 'MGT321', 'MGT322', 'MGT323'],
    'المستوى السابع': ['ISLM104', 'MGT401', 'MGT324', 'MGT402', 'MGT403'],
    'المستوى الثامن': ['MGT404', 'MGT421', 'MGT422', 'MGT430'],
  },
  'محاسبة': {
    'المستوى الثالث': ['ISLM101', 'STAT101', 'LAW101', 'ECON101', 'MGT101', 'ACCT101'],
    'المستوى الرابع': ['ISLM102', 'STAT201', 'FIN101', 'MGT201', 'MGT211', 'ECOM101'],
    'المستوى الخامس': ['ECON201', 'MIS201', 'ECOM201', 'MGT301', 'MGT311', 'ACCT201'],
    'المستوى السادس': ['ISLM103', 'ACCT301', 'MGT321', 'MGT322', 'ACCT302'],
    'المستوى السابع': ['ISLM104', 'MGT401', 'ACCT401', 'ACCT403', 'ACCT402'],
    'المستوى الثامن': ['LAW401', 'ACCT322', 'ACCT422', 'ACCT430'],
  },
  'تمويل': {
    'المستوى الثالث': ['ISLM101', 'STAT101', 'LAW101', 'ECON101', 'MGT101', 'ACCT101'],
    'المستوى الرابع': ['ISLM102', 'STAT201', 'FIN101', 'MGT201', 'MGT211', 'ECOM101'],
    'المستوى الخامس': ['ECON201', 'MIS201', 'ECOM201', 'MGT301', 'MGT311', 'FIN201'],
    'المستوى السادس': ['ISLM103', 'ACCT301', 'MGT321', 'MGT322', 'FIN301'],
    'المستوى السابع': ['ISLM104', 'MGT401', 'FIN401', 'FIN402', 'FIN403'],
    'المستوى الثامن': ['FIN405', 'FIN406', 'FIN424', 'FIN408'],
  },
  'تجارة إلكترونية': {
    // Level 3 is the college core the other three programmes share. The supplied
    // summary printed level 4's six rows twice, under both headings — the one
    // place in the twelve where the document contradicts itself, and its own
    // level 4 is what it duplicated. Correctable in one save if this is wrong.
    'المستوى الثالث': ['ISLM101', 'STAT101', 'LAW101', 'ECON101', 'MGT101', 'ACCT101'],
    'المستوى الرابع': ['ISLM102', 'STAT201', 'FIN101', 'MGT201', 'MGT211', 'ECOM101'],
    'المستوى الخامس': ['ECON201', 'MIS201', 'ECOM201', 'MGT301', 'MGT311', 'ECOM301'],
    'المستوى السادس': ['ISLM103', 'ACCT301', 'MGT321', 'MGT322', 'IT401'],
    'المستوى السابع': ['ISLM104', 'MGT401', 'IT403', 'IT404', 'LAW402'],
    'المستوى الثامن': ['IT402', 'ECOM421', 'ECOM402', 'ECOM430'],
  },

  // ── العلوم والدراسات النظرية ────────────────────────────────────────────
  'قانون': {
    // Law is the one programme whose published plan starts at level 2.
    'المستوى الثاني': ['ISLM101', 'COM003', 'MATH003', 'LAW121', 'LAW122', 'LAW123'],
    'المستوى الثالث': ['ISLM102', 'LAW211', 'LAW212', 'LAW213', 'LAW214'],
    'المستوى الرابع': ['LAW221', 'LAW222', 'LAW223', 'LAW224', 'LAW225'],
    'المستوى الخامس': ['ISLM103', 'LAW311', 'LAW312', 'LAW313', 'LAW314', 'LAW315'],
    'المستوى السادس': ['ISLM104', 'LAW321', 'LAW322', 'LAW323', 'LAW324', 'LAW325'],
    'المستوى السابع': ['LAW411', 'LAW412', 'LAW413', 'LAW414', 'LAW415'],
    'المستوى الثامن': ['LAW421', 'LAW422', 'LAW423', 'LAW424', 'LAW425'],
  },
  'إعلام رقمي': {
    // Its codes are Arabic on the university's own page (علم ٢٠١), not Latin.
    // Written closed-up, because that is what has to match a file's course name.
    'المستوى الأول': ['عال003', 'نهج003', 'نجل003'],
    'المستوى الثاني': ['علم003', 'ريض003', 'علم101', 'علم102', 'علم103', 'عرب211'],
    'المستوى الثالث': ['سلم101', 'علم201', 'علم202', 'علم203', 'علم204', 'عرب260'],
    'المستوى الرابع': ['سلم102', 'علم205', 'علم206', 'علم207', 'علم208', 'ساس101'],
    'المستوى الخامس': ['سلم103', 'علم301', 'علم302', 'علم303', 'نطق101', 'تام202'],
    'المستوى السادس': ['سلم104', 'علم304', 'علم305', 'علم306', 'تجر333', 'نفس101'],
    'المستوى السابع': ['علم402', 'علم403', 'علم404', 'علم405', 'علم406', 'علم408'],
    'المستوى الثامن': ['علم401', 'علم407', 'علم409'],
  },
  'لغة إنجليزية وترجمة': {
    'المستوى الأول': ['علم001', 'ريض001', 'نجل001'],
    'المستوى الثاني': ['عال001', 'نهج001', 'نجل001'],
    'المستوى الثالث': ['سلم101', 'نجل201', 'نجل202', 'نجل210', 'نجل220', 'عرب211'],
    'المستوى الرابع': ['سلم102', 'نجل230', 'نجل231', 'نجل240', 'نجل250', 'عرب260'],
    'المستوى الخامس': ['سلم103', 'نجل301', 'نجل310', 'نجل320', 'نجل340', 'ترج330'],
    'المستوى السادس': ['سلم104', 'نجل350', 'نجل360', 'نجل380', 'ترج370', 'عرب221'],
    'المستوى السابع': ['نجل401', 'ترج410', 'ترج420', 'ترج430', 'ترج440', 'ترج450'],
    'المستوى الثامن': ['ترج460', 'ترج470', 'ترج480', 'ترج490', 'ترج499'],
  },

  // ── العلوم الصحية ───────────────────────────────────────────────────────
  'معلوماتية صحية': {
    'المستوى الأول': ['ENG001', 'CS001', 'CI001'],
    'المستوى الثاني': ['ENG002', 'MATH001', 'COMM001'],
    'المستوى الثالث': ['IT231', 'IT232', 'BIO101', 'PHC121', 'HCM101', 'HCM102'],
    'المستوى الرابع': ['ISLM101', 'IT244', 'IT245', 'BIO102', 'HCM113', 'PHC131'],
    'المستوى الخامس': ['ISLM102', 'IT351', 'IT352', 'IT353', 'PHC212', 'HCI111'],
    'المستوى السادس': ['IT361', 'IT362', 'HCM213', 'HCI112', 'HCI215', 'HCI216'],
    'المستوى السابع': ['ISLM103', 'IT475', 'IT476', 'HCI213', 'HCI214', 'HCI312'],
    'المستوى الثامن': ['ISLM104', 'HCI314', 'HCI315', 'HCI316'],
  },
  'صحة عامة': {
    'المستوى الأول': ['ENG001', 'CS001', 'COMM101'],
    'المستوى الثاني': ['ENG102', 'MATH001', 'CI001'],
    'المستوى الثالث': ['ISLM101', 'BIOL101', 'HCM101', 'HCM102', 'PHC101', 'PHC121'],
    'المستوى الرابع': ['BIOL102', 'BIOL103', 'HCM113', 'PHC131', 'PHC151', 'PHC181'],
    'المستوى الخامس': ['ISLM102', 'PHC212', 'PHC241', 'PHC261', 'PHC271', 'PHC281'],
    'المستوى السادس': ['ISLM103', 'HCM213', 'PHC215', 'PHC216', 'PHC231', 'PHC273', 'PHC274'],
    'المستوى السابع': ['PHC311', 'PHC312', 'PHC313', 'PHC331', 'PHC372', 'PHC373'],
    'المستوى الثامن': ['ISLM104', 'PHC314', 'PHC374'],
  },

  // ── الحوسبة والمعلوماتية ────────────────────────────────────────────────
  'تقنية معلومات': {
    'المستوى الأول': ['ENG001', 'CS001', 'CI001'],
    'المستوى الثاني': ['ENG002', 'MATH001', 'COMM001'],
    'المستوى الثالث': ['ISLM101', 'IT231', 'IT232', 'IT233', 'MATH150', 'SCI101'],
    'المستوى الرابع': ['IT241', 'IT244', 'IT245', 'ENG103', 'MATH251', 'SCI201'],
    // The plan prints this level's Islamic-studies row as "ISLM" with no number.
    // Placed at 103 to match Computer Science and Data Science, which put ISLM103
    // at the same level; worth a glance in the panel.
    'المستوى الخامس': ['ISLM103', 'IT342', 'IT351', 'IT354', 'IT361'],
    'المستوى السادس': ['IT451', 'IT452', 'IT453', 'IT454'],
    'المستوى السابع': ['IT476', 'IT487', 'IT488'],
    'المستوى الثامن': ['IT489'],
  },
  'علوم حاسب': {
    'المستوى الثالث': ['ISLM101', 'CS230', 'CS231', 'MATH150', 'ENG103', 'SCI101'],
    'المستوى الرابع': ['ISLM102', 'CS240', 'CS241', 'CS242', 'CS243', 'SCI201'],
    'المستوى الخامس': ['ISLM103', 'CS350', 'CS351', 'CS352', 'CS353', 'MATH251'],
    'المستوى السادس': ['CS360', 'CS361', 'CS362', 'CS363', 'CS364', 'STAT101'],
    'المستوى السابع': ['ISLM104', 'CS470', 'CS471', 'CS479'],
    'المستوى الثامن': ['CS480', 'CS481', 'CS489', 'CS499'],
  },
  'علوم البيانات': {
    'المستوى الثالث': ['ISLM101', 'DS230', 'DS231', 'MATH150', 'ENG103', 'SCI101'],
    'المستوى الرابع': ['ISLM102', 'DS240', 'DS242', 'DS243', 'MATH241', 'MATH251'],
    'المستوى الخامس': ['DS350', 'DS351', 'DS352', 'DS353', 'STAT202', 'SCI201'],
    'المستوى السادس': ['ISLM103', 'DS360', 'DS361', 'DS362', 'DS363', 'DS364'],
    'المستوى السابع': ['DS470', 'DS471', 'DS472', 'DS479'],
    'المستوى الثامن': ['ISLM104', 'DS480', 'DS481', 'DS489', 'DS499'],
  },
};

/** The levels for a programme, or null when its plan isn't transcribed yet. */
export const levelsOf = (program) => PROGRAM_LEVELS[program] || null;

/**
 * What each course code is actually called.
 *
 * A code alone is a filing key, not a subject: a student scanning their level
 * for "the statistics one" reads `الإحصاء`, not `STAT101`. Taken from the same
 * twelve plans as the levels above — no name is written here that is not
 * printed next to that code in one of them.
 *
 * Computer Science and Data Science are in English because their plans print
 * only English names; translating them would be inventing, and these are the
 * names those students see on Blackboard anyway. Where a code they share with
 * Information Technology has an Arabic name there (MATH150, SCI101, ENG103…),
 * the Arabic one is used for everybody.
 *
 * One genuine disagreement between two of the documents, left visible rather
 * than silently resolved: the Accounting plan lists FIN401 as «إدارة البنوك»
 * and FIN402 as «المؤسسات والأسواق المالية», while the Finance programme —
 * whose courses these are — swaps them. The Finance plan is followed here.
 */
export const COURSE_TITLES = {
  // السنة الأولى المشتركة
  ENG001: 'مهارات اللغة الإنجليزية', ENG002: 'مهارات اللغة الإنجليزية 2',
  ENG102: 'مهارات اللغة الإنجليزية', ENG103: 'الكتابة التقنية',
  CS001: 'أساسيات الحاسب', CI001: 'المهارات الأكاديمية',
  COMM001: 'مهارات الاتصال', COMM101: 'مهارات الاتصال', COM003: 'مهارات الاتصال',
  MATH001: 'أساسيات الرياضيات', MATH003: 'مقدمة في الرياضيات',

  // الثقافة الإسلامية — أربعة مقررات مشتركة بين كل البرامج
  ISLM101: 'الثقافة الإسلامية 1 (العقيدة الإسلامية)',
  ISLM102: 'الأخلاق وآداب المهنة في الإسلام',
  ISLM103: 'النظام الاقتصادي في الإسلام وقضاياه',
  ISLM104: 'النظام الاجتماعي وحقوق الإنسان في الإسلام',

  // جذع العلوم الإدارية والمالية
  STAT101: 'الإحصاء', STAT201: 'الأساليب الكمية',
  LAW101: 'البيئة القانونية للأعمال',
  ECON101: 'الاقتصاد الجزئي', ECON201: 'الاقتصاد الكلي',
  MGT101: 'مبادئ الإدارة', ACCT101: 'مبادئ المحاسبة',
  FIN101: 'مبادئ التمويل', MGT201: 'إدارة التسويق', MGT211: 'إدارة الموارد البشرية',
  ECOM101: 'التجارة الإلكترونية', ECOM201: 'مقدمة في الإدارة الإلكترونية',
  MIS201: 'إدارة نظم المعلومات', MGT301: 'السلوك التنظيمي',
  MGT311: 'مقدمة في إدارة العمليات', ACCT301: 'محاسبة التكاليف',
  MGT321: 'مقدمة في الأعمال الدولية', MGT322: 'إدارة سلسلة التوريد',
  MGT401: 'الإدارة الاستراتيجية',

  // إدارة أعمال
  MGT312: 'اتخاذ القرار وحل المشكلات', MGT323: 'إدارة المشاريع',
  MGT324: 'الإدارة العامة', MGT402: 'ريادة الأعمال', MGT403: 'إدارة المعرفة',
  MGT404: 'تصميم وتطوير المنظمات', MGT421: 'إدارة الاتصالات',
  MGT422: 'أخلاقيات الأعمال والمسؤولية الاجتماعية', MGT430: 'التدريب التعاوني',

  // محاسبة
  ACCT201: 'المحاسبة المالية', ACCT302: 'المحاسبة المالية المتقدمة',
  ACCT401: 'مبادئ وإجراءات التدقيق', ACCT402: 'مقدمة في نظم المعلومات المحاسبية',
  ACCT403: 'البحث والممارسة في المحاسبة', ACCT322: 'المحاسبة الإدارية',
  ACCT422: 'المحاسبة الضريبية والزكاة', ACCT430: 'التدريب الداخلي',
  LAW401: 'قانون الشركات',

  // تمويل
  FIN201: 'الإدارة المالية', FIN301: 'إدارة الاستثمار',
  FIN401: 'الأسواق والمؤسسات المالية', FIN402: 'التحليل المالي',
  FIN403: 'التمويل الدولي', FIN405: 'إدارة المخاطر المالية',
  FIN406: 'المشتقات المالية', FIN424: 'إدارة المحافظ الاستثمارية',
  FIN408: 'التخطيط المالي',

  // تجارة إلكترونية
  ECOM301: 'التسويق الإلكتروني', ECOM402: 'إدارة سلسلة التوريد الإلكترونية',
  ECOM421: 'استراتيجيات ونماذج الأعمال الإلكترونية', ECOM430: 'التدريب العملي',
  IT401: 'لغات الحاسب للأعمال', IT402: 'نظم المؤسسة المتكاملة',
  IT403: 'أساسيات قواعد البيانات', IT404: 'تصميم المواقع الإلكترونية',
  LAW402: 'قانون التجارة الإلكترونية',

  // قانون
  LAW121: 'المدخل لدراسة علم القانون', LAW122: 'القانون الدستوري',
  LAW123: 'علم الإجرام والعقاب', LAW211: 'المدخل لدراسة الفقه الإسلامي',
  LAW212: 'تاريخ القانون', LAW213: 'أحكام العقد', LAW214: 'القانون الإداري',
  LAW221: 'القانون الجزائي العام', LAW222: 'المسؤولية المدنية',
  LAW223: 'القانون التجاري', LAW224: 'القضاء والإثبات', LAW225: 'القانون الدولي العام',
  LAW311: 'قانون العمل والتأمينات الاجتماعية', LAW312: 'القضاء الإداري',
  LAW313: 'العقود المدنية', LAW314: 'المواريث والوصايا والوقف',
  LAW315: 'إجراءات التقاضي', LAW321: 'ضمانات الديون', LAW322: 'الملكية والأموال',
  LAW323: 'العقود التجارية وعمليات البنوك', LAW324: 'القانون الجزائي الخاص',
  LAW325: 'قانون الأسرة', LAW411: 'الأوراق التجارية', LAW412: 'الزكاة والضرائب',
  LAW413: 'العقود الإدارية', LAW414: 'أصول الفقه', LAW415: 'الملكية الفكرية',
  LAW421: 'الإجراءات الجزائية', LAW422: 'القانون الدولي الخاص',
  LAW423: 'قانون التنفيذ', LAW424: 'القانون البحري والجوي',
  LAW425: 'مبادئ البحث العلمي',

  // إعلام رقمي — رموزه عربية على صفحة الجامعة
  عال003: 'أساسيات الحاسب', نهج003: 'المهارات الأكاديمية',
  نجل003: 'مهارات اللغة الإنجليزية', علم003: 'مهارات الاتصال',
  ريض003: 'مقدمة في الرياضيات', علم101: 'مقدمة في الإعلام الرقمي',
  علم102: 'التصميم الغرافيكي 1', علم103: 'نظريات الاتصال',
  علم201: 'فن التصوير الرقمي', علم202: 'تحرير الأخبار',
  علم203: 'المدخل إلى تقنيات الاتصال', علم204: 'التصميم الغرافيكي 2',
  علم205: 'قانون وأخلاقيات الإعلام الرقمي', علم206: 'العلاقات العامة الرقمية',
  علم207: 'الفنون الصحفية', علم208: 'النشر الرقمي',
  علم301: 'الكتابة والتدوين', علم302: 'المونتاج',
  علم303: 'الاتصال المؤسسي الرقمي', علم304: 'الإنتاج التلفزيوني',
  علم305: 'كتابة النصوص', علم306: 'الإبداع الإعلامي',
  علم401: 'التدريب العملي', علم402: 'صحافة الهواتف الذكية',
  علم403: 'استراتيجيات الإعلان', علم404: 'الرسوم المتحركة',
  علم405: 'البحوث الإعلامية', علم406: 'تحليل ونقد الإعلام الرقمي',
  علم407: 'حالات دراسية في الإعلام الرقمي', علم408: 'إدارة الإعلام الرقمي',
  علم409: 'مشروع التخرج',
  ساس101: 'المدخل إلى علم السياسة', نطق101: 'التفكير المنطقي',
  نفس101: 'علم النفس الاجتماعي', تام202: 'التفاعل بين الإنسان والحاسب',
  تجر333: 'التسويق الرقمي',

  // لغة إنجليزية وترجمة
  علم001: 'مهارات الاتصال', ريض001: 'مقدمة في الرياضيات',
  نجل001: 'مهارات اللغة الإنجليزية', عال001: 'أساسيات الحاسب',
  نهج001: 'المهارات الأكاديمية',
  نجل201: 'قواعد اللغة الإنجليزية 1', نجل202: 'القراءة وبناء المفردات',
  نجل210: 'الكتابة الأكاديمية 1', نجل220: 'استماع ومحادثة 1',
  نجل230: 'قراءة متقدمة بالإنجليزية', نجل231: 'استماع ومحادثة 2',
  نجل240: 'قواعد اللغة الإنجليزية 2', نجل250: 'الكتابة الأكاديمية 2',
  نجل301: 'مقدمة في اللغويات', نجل310: 'المعاجم اللغوية',
  نجل320: 'التراكيب المقارنة', نجل340: 'قراءات في ثقافة اللغة الإنجليزية',
  نجل350: 'مقدمة في علم الدلالة والتداولية', نجل360: 'لسانيات النص وتحليل الخطاب',
  نجل380: 'علم الأسلوب', نجل401: 'مقدمة في النحو والصرف',
  ترج330: 'مقدمة في الترجمة', ترج370: 'الترجمة التجارية والقانونية',
  ترج410: 'الترجمة الثنائية والتتابعية', ترج420: 'استخدام الحاسوب في تطبيقات الترجمة',
  ترج430: 'الترجمة المنظورة والتلخيصية', ترج440: 'الترجمة العلمية والتقنية',
  ترج450: 'أساليب البحث العلمي', ترج460: 'الترجمة الفورية',
  ترج470: 'قضايا ومشكلات في دراسة الترجمة', ترج480: 'الترجمة الإعلامية',
  ترج490: 'ترجمة المؤتمرات', ترج499: 'مشروع التخرج',
  عرب211: 'التحرير العربي 1', عرب221: 'التحرير العربي 2',
  عرب260: 'النحو والصرف التطبيقي',
  سلم101: 'العقيدة الإسلامية', سلم102: 'الأخلاق وآداب المهنة في الإسلام',
  سلم103: 'النظام الاقتصادي الإسلامي', سلم104: 'النظام الاجتماعي الإسلامي',

  // العلوم الصحية
  BIO101: 'المصطلحات الطبية الأساسية', BIO102: 'مقدمة في التشريح وعلم وظائف الأعضاء',
  BIOL101: 'المصطلحات الطبية الأساسية', BIOL102: 'مقدمة في التشريح وعلم وظائف الأعضاء',
  BIOL103: 'مبادئ علم الأحياء الدقيقة للصحة العامة',
  HCM101: 'إدارة الرعاية الصحية', HCM102: 'السلوك التنظيمي',
  HCM113: 'السياسات الصحية السعودية ونظام الرعاية الصحية',
  HCM213: 'الإدارة المالية في الرعاية الصحية',
  PHC101: 'مقدمة في الصحة العامة', PHC121: 'مقدمة في الإحصاء الحيوي',
  PHC131: 'مقدمة في علم الأوبئة', PHC151: 'الصحة البيئية',
  PHC181: 'علم اجتماع الصحة والمرض والرعاية الصحية',
  PHC212: 'مفاهيم التثقيف والتعزيز الصحي', PHC215: 'مناهج البحث وتحليل البيانات الصحية',
  PHC216: 'أخلاقيات وتشريعات الرعاية الصحية', PHC231: 'مقدمة في وبائيات المستشفيات',
  PHC241: 'المفاهيم الأساسية في الغذاء والتغذية', PHC261: 'الصحة المهنية',
  PHC271: 'مقدمة في الأمراض', PHC273: 'مقدمة في الصحة النفسية',
  PHC274: 'التخطيط الصحي', PHC281: 'السلوك الصحي',
  PHC311: 'الصحة العالمية', PHC312: 'الاتصال الصحي',
  PHC313: 'إصابات حوادث الطرق والوقاية من الإعاقة',
  PHC314: 'المجتمع والإدمان', PHC331: 'وبائيات الأمراض المزمنة والوقاية منها',
  PHC372: 'إدارة الأوبئة والكوارث في الصحة العامة',
  PHC373: 'صحة الأم والطفل', PHC374: 'تعزيز صحة الفم',
  HCI111: 'مقدمة في المعلوماتية الصحية', HCI112: 'السجلات الصحية الإلكترونية',
  HCI213: 'الترميز والفوترة الطبية', HCI214: 'معلوماتية صحة المستهلك',
  HCI215: 'مناهج البحث وتحليل البيانات الصحية',
  HCI216: 'أخلاقيات وتشريعات الرعاية الصحية',
  HCI312: 'الاتصال الصحي', HCI314: 'معلوماتية الصحة العامة',
  HCI315: 'الصحة عن بُعد والطب عن بُعد', HCI316: 'الصحة الإلكترونية',

  // الحوسبة والمعلوماتية — المشترك
  MATH150: 'الرياضيات المتقطعة', MATH251: 'الجبر الخطي',
  MATH241: 'التفاضل والتكامل لعلوم البيانات',
  SCI101: 'الفيزياء العامة 1', SCI201: 'الفيزياء العامة 2',
  STAT202: 'مقدمة في الإحصاء والاحتمالات',

  // تقنية معلومات
  IT231: 'مقدمة في تقنية المعلومات ونظم المعلومات', IT232: 'البرمجة كائنية التوجه',
  IT233: 'تنظيم الحاسب', IT241: 'نظم التشغيل', IT244: 'مقدمة في قواعد البيانات',
  IT245: 'هياكل البيانات', IT342: 'هندسة البرمجيات', IT351: 'شبكات الحاسب',
  IT352: 'التفاعل بين الإنسان والحاسب', IT353: 'تحليل وتصميم النظم',
  IT354: 'نظم إدارة قواعد البيانات', IT361: 'تقنيات الويب',
  IT362: 'إدارة مشاريع تقنية المعلومات', IT451: 'إدارة مشاريع تقنية المعلومات',
  IT452: 'أمن المعلومات', IT453: 'الحوسبة السحابية',
  IT454: 'تطبيقات الويب المتقدمة', IT475: 'نظم دعم القرار',
  IT476: 'سياسات وأمن تقنية المعلومات', IT487: 'تطوير تطبيقات الجوال',
  IT488: 'مشروع التخرج 1', IT489: 'مشروع التخرج 2',

  // علوم حاسب — خطتها تطبع الأسماء بالإنجليزية فقط
  CS230: 'Object Oriented Programming', CS231: 'Digital Logic Design',
  CS240: 'Data Structure', CS241: 'Computer Architecture and Organization',
  CS242: 'Theory of Computing', CS243: 'Discrete Mathematics for CS',
  CS350: 'Introduction to Database', CS351: 'Operating Systems',
  CS352: 'System Analysis and Design', CS353: 'Design and Analysis of Algorithms',
  CS360: 'Computer Networks', CS361: 'Web Programming',
  CS362: 'Artificial Intelligence', CS363: 'Principles of Programming Languages',
  CS364: 'Computing Entrepreneurship & Innovation',
  CS470: 'Human Computer Interaction', CS471: 'Computer Security',
  CS479: 'Senior Project 1', CS480: 'Project Management in Computing',
  CS481: 'Professional Ethics in Computer Science', CS489: 'Senior Project 2',
  CS499: 'Practical Training',

  // علوم البيانات — كذلك
  DS230: 'Object Oriented Programming', DS231: 'Introduction to Data Science Programming',
  DS240: 'Data Structure', DS242: 'Advanced Data Science Programming',
  DS243: 'Computer Architecture and Organization', DS350: 'Introduction to Database',
  DS351: 'Operating Systems', DS352: 'Design and Analysis of Algorithms',
  DS353: 'Project Management in Computing', DS360: 'Computer Networks',
  DS361: 'System Analysis and Design', DS362: 'Web Programming',
  DS363: 'Artificial Intelligence', DS364: 'Data Curation, Management & Organization',
  DS470: 'Data Security and Privacy', DS471: 'Machine Learning',
  DS472: 'Data Mining', DS479: 'Senior Project 1', DS480: 'Data Visualization',
  DS481: 'Professional Ethics in Data Science', DS489: 'Senior Project 2',
  DS499: 'Practical Training',
};

/**
 * The English name of each course, where its plan prints one.
 *
 * English is what a course is called on Blackboard, in the exam header and in
 * every message students send each other, so it leads. What is NOT here is a
 * translation: a name appears below only when one of the twelve plans printed
 * it in English next to that code. Four sources are Arabic-only — إدارة أعمال,
 * محاسبة, إعلام رقمي and لغة إنجليزية وترجمة — so their codes keep the Arabic
 * name, which is a real name from a real document rather than one I invented
 * and handed a student as official.
 */
export const COURSE_TITLES_EN = {
  // السنة الأولى المشتركة
  ENG001: 'English Language Skills', ENG002: 'English Language Skills II',
  ENG103: 'Technical Writing',
  CS001: 'Computer Essentials', CI001: 'Academic Skills',
  COMM001: 'Communication Skills', COM003: 'Communication Skills',
  MATH001: 'Fundamentals of Mathematics', MATH003: 'Introduction to Mathematics',

  // الثقافة الإسلامية
  ISLM101: 'Islamic Culture I', ISLM102: 'Professional Conduct & Ethics in Islam',
  ISLM103: 'Islamic Economic System and Its Issues',
  ISLM104: 'Social System and Human Rights in Islam',

  // جذع العلوم الإدارية والمالية
  STAT101: 'Statistics', STAT201: 'Quantitative Methods',
  LAW101: 'Legal Environment of Business',
  ECON101: 'Microeconomics', ECON201: 'Macroeconomics',
  MGT101: 'Principles of Management', ACCT101: 'Principles of Accounting',
  FIN101: 'Principles of Finance', MGT201: 'Marketing Management',
  MGT211: 'Human Resource Management', ECOM101: 'E-Commerce',
  ECOM201: 'Introduction to E-Management', MIS201: 'Management Information Systems',
  MGT301: 'Organizational Behavior', MGT311: 'Introduction to Operations Management',
  ACCT301: 'Cost Accounting', MGT321: 'Introduction to International Business',
  MGT322: 'Supply Chain Management', MGT401: 'Strategic Management',

  // تمويل
  FIN201: 'Financial Management', FIN301: 'Investment Management',
  FIN401: 'Financial Markets and Institutions', FIN402: 'Financial Analysis',
  FIN403: 'International Finance', FIN405: 'Financial Risk Management',
  FIN406: 'Financial Derivatives', FIN424: 'Portfolio Management',
  FIN408: 'Financial Planning',

  // تجارة إلكترونية
  ECOM301: 'E-Marketing', ECOM402: 'E-Supply Chain Management',
  ECOM421: 'E-Business Strategies and Models', ECOM430: 'Internship',
  IT401: 'Business Computer Languages', IT402: 'Enterprise Systems',
  IT403: 'Database Fundamentals', IT404: 'Website Design',
  LAW402: 'E-Commerce Law',

  // قانون
  LAW121: 'Introduction to Legal Studies', LAW122: 'Constitutional Law',
  LAW123: 'Criminology and Penology', LAW211: 'Introduction to Islamic Jurisprudence',
  LAW212: 'History of Law', LAW213: 'Contract Law', LAW214: 'Administrative Law',
  LAW221: 'General Criminal Law', LAW222: 'Civil Liability',
  LAW223: 'Commercial Law', LAW224: 'Judiciary and Evidence',
  LAW225: 'Public International Law', LAW311: 'Labor Law and Social Insurance',
  LAW312: 'Administrative Judiciary', LAW313: 'Civil Contracts',
  LAW314: 'Inheritance, Wills and Endowment', LAW315: 'Litigation Procedures',
  LAW321: 'Debt Guarantees', LAW322: 'Property and Funds',
  LAW323: 'Commercial Contracts and Banking Operations',
  LAW324: 'Special Criminal Law', LAW325: 'Family Law',
  LAW411: 'Commercial Papers', LAW412: 'Zakat and Taxes',
  LAW413: 'Administrative Contracts', LAW414: 'Principles of Islamic Jurisprudence',
  LAW415: 'Intellectual Property Law', LAW421: 'Criminal Procedures',
  LAW422: 'Private International Law', LAW423: 'Enforcement Law',
  LAW424: 'Maritime and Air Law', LAW425: 'Principles of Scientific Research',

  // العلوم الصحية
  BIO101: 'Basic Medical Terminology', BIO102: 'Introduction to Anatomy and Physiology',
  HCM101: 'Healthcare Management', HCM102: 'Organizational Behavior',
  HCM113: 'Saudi Health Policies and Healthcare System',
  HCM213: 'Financial Management in Healthcare',
  PHC121: 'Introduction to Biostatistics', PHC131: 'Introduction to Epidemiology',
  PHC212: 'Health Education Concepts and Promotion',
  PHC215: 'Healthcare Research and Analysis Methods',
  PHC216: 'Ethics and Regulation in Health Care',
  PHC231: 'Introduction to Hospital Epidemiology',
  PHC273: 'Introduction to Mental Health', PHC274: 'Health Planning',
  PHC311: 'Global Health', PHC312: 'Health Communication',
  PHC313: 'Road Traffic Injuries and Disability Prevention',
  PHC314: 'Society and Addiction',
  PHC331: 'Chronic Disease Epidemiology and Prevention',
  PHC372: 'Public Health Outbreak and Disaster Management',
  PHC373: 'Maternal and Child Health', PHC374: 'Oral Health Promotion',
  HCI111: 'Introduction to Health Informatics', HCI112: 'Electronic Health Records',
  HCI213: 'Medical Coding and Billing', HCI214: 'Consumer Health Informatics',
  HCI215: 'Healthcare Research and Analysis Methods',
  HCI216: 'Ethics and Regulations in Healthcare',
  HCI312: 'Health Communication', HCI314: 'Public Health Informatics',
  HCI315: 'Telehealth and Telemedicine', HCI316: 'eHealth',

  // Four codes the Public Health page prints in Arabic only, filled from the
  // programme that prints the SAME Arabic name in English too: BIOL101/BIO101
  // and COMM101/COMM001 are one course under two programmes' codes. This is
  // matching a printed pair, not translating.
  COMM101: 'Communication Skills', ENG102: 'English Language Skills',
  BIOL101: 'Basic Medical Terminology',
  BIOL102: 'Introduction to Anatomy and Physiology',

  // الحوسبة والمعلوماتية — المشترك
  MATH150: 'Discrete Mathematics', MATH251: 'Linear Algebra',
  MATH241: 'Calculus for Data Science',
  SCI101: 'General Physics 1', SCI201: 'General Physics 2',
  STAT202: 'Introduction to Statistics and Probabilities',

  // تقنية معلومات
  IT231: 'Introduction to IT and Information Systems',
  IT232: 'Object-Oriented Programming', IT233: 'Computer Organization',
  IT241: 'Operating Systems', IT244: 'Introduction to Databases',
  IT245: 'Data Structures', IT342: 'Software Engineering',
  IT351: 'Computer Networks', IT352: 'Human Computer Interaction',
  IT353: 'Systems Analysis and Design', IT354: 'Database Management Systems',
  IT361: 'Web Technologies', IT362: 'IT Project Management',
  IT451: 'IT Project Management', IT452: 'Information Security',
  IT453: 'Cloud Computing', IT454: 'Advanced Web Applications',
  IT475: 'Decision Support Systems', IT476: 'IT Security and Policies',
  IT487: 'Mobile Application Development',
  IT488: 'Senior Project I', IT489: 'Senior Project II',

  // علوم حاسب وعلوم البيانات — خططهما إنجليزية أصلاً
  CS230: 'Object Oriented Programming', CS231: 'Digital Logic Design',
  CS240: 'Data Structure', CS241: 'Computer Architecture and Organization',
  CS242: 'Theory of Computing', CS243: 'Discrete Mathematics for CS',
  CS350: 'Introduction to Database', CS351: 'Operating Systems',
  CS352: 'System Analysis and Design', CS353: 'Design and Analysis of Algorithms',
  CS360: 'Computer Networks', CS361: 'Web Programming',
  CS362: 'Artificial Intelligence', CS363: 'Principles of Programming Languages',
  CS364: 'Computing Entrepreneurship & Innovation',
  CS470: 'Human Computer Interaction', CS471: 'Computer Security',
  CS479: 'Senior Project 1', CS480: 'Project Management in Computing',
  CS481: 'Professional Ethics in Computer Science', CS489: 'Senior Project 2',
  CS499: 'Practical Training',
  DS230: 'Object Oriented Programming', DS231: 'Introduction to Data Science Programming',
  DS240: 'Data Structure', DS242: 'Advanced Data Science Programming',
  DS243: 'Computer Architecture and Organization', DS350: 'Introduction to Database',
  DS351: 'Operating Systems', DS352: 'Design and Analysis of Algorithms',
  DS353: 'Project Management in Computing', DS360: 'Computer Networks',
  DS361: 'System Analysis and Design', DS362: 'Web Programming',
  DS363: 'Artificial Intelligence', DS364: 'Data Curation, Management & Organization',
  DS470: 'Data Security and Privacy', DS471: 'Machine Learning',
  DS472: 'Data Mining', DS479: 'Senior Project 1', DS480: 'Data Visualization',
  DS481: 'Professional Ethics in Data Science', DS489: 'Senior Project 2',
  DS499: 'Practical Training',
};

/**
 * The name to show for a course: English where its plan printed one, otherwise
 * the Arabic name, otherwise ''.
 *
 * Empty rather than the code repeated back — the caller already shows the code,
 * and a name that is just the code again is noise dressed as information.
 */
export const titleOf = (code) => {
  const c = String(code || '').trim();
  return COURSE_TITLES_EN[c] || COURSE_TITLES[c] || '';
};

/** The Arabic name, where one exists — shown as a subtitle under the English. */
export const titleArOf = (code) => {
  const c = String(code || '').trim();
  const ar = COURSE_TITLES[c] || '';
  // Only when it adds something: for the Arabic-only programmes `titleOf`
  // already returns this exact string, and repeating it under itself is noise.
  return ar && COURSE_TITLES_EN[c] ? ar : '';
};

/**
 * Fold a query and a target to the same shape before comparing them.
 *
 * A student typing «احصاء» must find «الإحصاء», and «stat 101» must find
 * STAT101. So: case folded, Arabic diacritics and tatweel dropped, the
 * alef/ya/ta-marbuta variants that people type interchangeably unified, and
 * every space and punctuation mark removed — the space in «stat 101» carries
 * no meaning, and neither does the one in «مبادئ الإدارة».
 */
export function normalizeSearch(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[ً-ْـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[^\p{L}\p{N}]/gu, '');
}

/**
 * Find courses by code or by name, across every plan.
 *
 * Search knew only programme names, so a student who typed the one thing they
 * actually have in front of them — «STAT101» off a lecture slide, or «إحصاء»
 * because that is what they call it — got "لا توجد نتائج" for a course the app
 * holds a page for.
 *
 * `plans` is the published map, so a course the owner added in the panel is
 * findable without a deploy; the built-in plans fill in the rest. A code shared
 * by several programmes (ISLM101 is in all twelve) is one result, and the
 * student's own programme is the one named on it.
 *
 * Ranked, because "STAT101" typed in full should not sit under a course whose
 * name merely contains it: exact code, then code prefix, then name prefix, then
 * anything containing it.
 */
export function searchCourses(query, { plans = null, myProgram = '', limit = 30 } = {}) {
  const q = normalizeSearch(query);
  if (q.length < 2) return [];

  // Published plan first, built-in second — the same precedence the site uses.
  const byProgram = {};
  Object.entries(PROGRAM_LEVELS).forEach(([program, levels]) => {
    byProgram[program] = Object.entries(levels).map(([label, courses]) => ({ label, courses }));
  });
  if (plans) {
    Object.entries(plans).forEach(([program, levels]) => {
      if (Array.isArray(levels) && levels.length) byProgram[program] = levels;
    });
  }

  const found = new Map();
  Object.entries(byProgram).forEach(([program, levels]) => {
    levels.forEach(({ label, courses }) => {
      (courses || []).forEach(code => {
        const name = titleOf(code);
        const nCode = normalizeSearch(code);
        // Both names, always: the card shows English, but plenty of students
        // know the course only as «الإحصاء», and dropping the Arabic from the
        // index would make it unfindable by the name they actually use.
        const names = [name, COURSE_TITLES[code] || ''].filter(Boolean).map(normalizeSearch);
        let rank;
        if (nCode === q) rank = 0;
        else if (nCode.startsWith(q)) rank = 1;
        else if (names.some(n => n.startsWith(q))) rank = 2;
        else if (nCode.includes(q)) rank = 3;
        else if (names.some(n => n.includes(q))) rank = 4;
        else return;

        const prev = found.get(code);
        // Prefer the student's own programme as the one shown beside the code:
        // "المستوى الثالث" means something to them only in their own plan.
        const mine = program === myProgram;
        if (!prev) found.set(code, { code, name, program, level: label, rank, mine, count: 1 });
        else {
          prev.count += 1;
          if (mine && !prev.mine) { prev.program = program; prev.level = label; prev.mine = true; }
          if (rank < prev.rank) prev.rank = rank;
        }
      });
    });
  });

  return [...found.values()]
    .sort((a, b) =>
      a.rank - b.rank ||
      (b.mine - a.mine) ||
      // At equal rank the shorter name is the closer match: «الإحصاء» is what
      // someone typing «احصاء» meant, not «مقدمة في الإحصاء الحيوي».
      (a.name || a.code).length - (b.name || b.code).length ||
      a.code.localeCompare(b.code, 'ar'))
    .slice(0, limit);
}

/** Every course code across every plan, for telling a code from a programme. */
const ALL_CODES = new Set(
  Object.values(PROGRAM_LEVELS).flatMap(levels => Object.values(levels).flat())
);

/**
 * Is this a single course, or a whole programme?
 *
 * The two want different shelves: a course has slides, summaries and past
 * papers; a programme has a study plan, a course list and admission terms.
 * The catalogue's own plans decide, so a code the owner adds in the panel
 * counts the moment it is saved — no second list to keep in step.
 */
export const isCourseCode = (name) => ALL_CODES.has(String(name || '').trim());

/**
 * What a course's library is divided into — four shelves, in the order a
 * student reaches for them through a term.
 *
 * It was seven. Splitting «تجميعات الميد» from «تجميعات الفاينل» sounded
 * faithful to how students ask, but on the shelf it produced two half-empty
 * drawers where one full one belongs — a past paper is a past paper, and the
 * owner filing it should not have to decide which exam a scanned sheet came
 * from. The book sits with the slides for the same reason: both are what the
 * course hands you to study from, as opposed to what someone made out of it.
 */
export const COURSE_CATEGORIES = [
  { id: 'slides', label: 'السلايدات والكتب', desc: 'سلايدات المقرر وكتبه ومراجعه' },
  { id: 'summary', label: 'الملخصات', desc: 'ملخصات المحتوى والمراجعة' },
  { id: 'collections', label: 'التجميعات', desc: 'أسئلة الاختبارات السابقة' },
  { id: 'solved', label: 'واجبات وحلول', desc: 'الواجبات وحلولها والأنشطة' },
];

/** What a programme's own page holds — about the programme, not one course. */
export const PROGRAM_CATEGORIES = [
  { id: 'plans', label: 'الخطط الدراسية', desc: 'الخطة الكاملة وجدول المستويات' },
  { id: 'curriculum', label: 'المقررات الدراسية', desc: 'توصيف المقررات ومحتواها' },
  { id: 'programs', label: 'البرامج والتخصصات', desc: 'نظرة عامة وشروط القبول' },
];

/**
 * Where a file filed under a retired shelf now lives.
 *
 * Merging shelves must never lose a file: everything already uploaded carries
 * the old id, and an id nothing renders is a file that silently disappears.
 * Read paths map through this; the API keeps accepting the old ids so old
 * records stay valid exactly as written.
 *
 * `collections` was the pre-split "ملفات أخرى" bucket. It becomes التجميعات
 * rather than being retired, which is also where those miscellaneous uploads
 * belonged — so «ملفات أخرى» disappears from the shelf without stranding one.
 */
export const CATEGORY_ALIASES = {
  mid: 'collections',
  final: 'collections',
  book: 'slides',
}

/** The shelf a file's stored category renders on today. */
export function shelfOf(category) {
  return CATEGORY_ALIASES[category] || category
}

/** Every category id the library accepts, retired ones included. */
export const ALL_CATEGORY_IDS = [
  ...new Set([
    ...COURSE_CATEGORIES.map(c => c.id),
    ...PROGRAM_CATEGORIES.map(c => c.id),
    ...Object.keys(CATEGORY_ALIASES),
  ]),
];

export const CATALOGUE = {
  preparatory: {
    label: 'السنة الأولى المشتركة (CFY)',
    plans: {
      a: { label: 'الفصل الأول', subjects: ['ENG001', 'CS001', 'CI001'] },
      b: { label: 'الفصل الثاني', subjects: ['ENG002', 'MATH001', 'COMM001'] },
    },
  },
  bachelor: {
    label: 'بكالوريوس',
    colleges: [
      { id: 'admin', label: 'العلوم الإدارية والمالية', programs: ['إدارة أعمال', 'محاسبة', 'تمويل', 'تجارة إلكترونية'] },
      { id: 'theory', label: 'العلوم والدراسات النظرية', programs: ['إعلام رقمي', 'قانون', 'لغة إنجليزية وترجمة'] },
      { id: 'health', label: 'العلوم الصحية', programs: ['معلوماتية صحية', 'صحة عامة'] },
      { id: 'cs', label: 'الحوسبة والمعلوماتية', programs: ['تقنية معلومات', 'علوم حاسب', 'علوم البيانات'] },
      { id: 'applied', label: 'الكلية التطبيقية', programs: ['برامج الكلية التطبيقية'] },
    ],
  },
  diploma: {
    label: 'دبلوم',
    programs: ['دبلوم إدارة الأعمال', 'دبلوم المحاسبة', 'دبلوم تقنية المعلومات', 'دبلوم اللغة الإنجليزية للأعمال'],
  },
  graduate: {
    label: 'دراسات عليا',
    programs: [
      'ماجستير إدارة الأعمال (MBA)', 'ماجستير المحاسبة المهنية', 'ماجستير القانون',
      'ماجستير تقنية المعلومات', 'ماجستير علوم الحاسب', 'ماجستير المعلوماتية الصحية',
      'ماجستير الصحة العامة', 'ماجستير الإعلام الرقمي',
    ],
  },
}

/** Grouped for a <select> — the shape the admin upload dropdown wants. */
export const COURSE_GROUPS = [
  { group: `${CATALOGUE.preparatory.label} — ${CATALOGUE.preparatory.plans.a.label}`, items: CATALOGUE.preparatory.plans.a.subjects },
  { group: `${CATALOGUE.preparatory.label} — ${CATALOGUE.preparatory.plans.b.label}`, items: CATALOGUE.preparatory.plans.b.subjects },
  ...CATALOGUE.bachelor.colleges.map(c => ({ group: `بكالوريوس — ${c.label}`, items: c.programs })),
  { group: CATALOGUE.diploma.label, items: CATALOGUE.diploma.programs },
  { group: CATALOGUE.graduate.label, items: CATALOGUE.graduate.programs },
]

/** Every course name, flat and de-duplicated. */
export const ALL_COURSE_NAMES = [...new Set(COURSE_GROUPS.flatMap(g => g.items))]

/**
 * Names the old admin dropdown offered, mapped to the catalogue.
 *
 * Files already uploaded under the old names would otherwise stay invisible
 * forever. Resolving them on read means those uploads appear immediately,
 * with no re-upload and no hand-editing of the index.
 *
 * The three old names with no counterpart at all — علوم إنسانية, علوم أساسية,
 * إدارة رعاية صحية — are left out deliberately: there is nowhere honest to put
 * them, and the admin panel now lets you move such a file to a real course.
 */
export const LEGACY_COURSE_ALIASES = {
  'مالية': 'تمويل',
  'إعلام إلكتروني': 'إعلام رقمي',

  // The prep year moved from display names to the codes the university and the
  // students' own bot both use. Every name it was ever filed under — the
  // original short ones and the catalogue's longer ones — resolves to the code,
  // so nothing already uploaded goes missing.
  'حاسب': 'CS001',
  'مهارات الحاسب': 'CS001',
  'إنجليزي': 'ENG001',
  'مهارات اللغة الإنجليزية 1': 'ENG001',
  'مهارات اللغة الإنجليزية 2': 'ENG002',
  'رياضيات': 'MATH001',
  'الرياضيات': 'MATH001',
  'مهارات اتصال': 'COMM001',
  'مهارات الاتصال والتواصل': 'COMM001',
  'مهارات أكاديمية': 'CI001',
}

/** The catalogue name a stored courseName refers to. */
export function canonicalCourse(name) {
  const n = String(name || '').trim()
  return LEGACY_COURSE_ALIASES[n] || n
}

/** Does a stored file belong to this course, allowing for legacy names? */
export function courseMatches(storedName, wanted) {
  return canonicalCourse(storedName) === canonicalCourse(wanted)
}
