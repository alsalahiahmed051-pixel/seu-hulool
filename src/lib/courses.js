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
    'المستوى الثاني': ['ISLM101', 'COMM003', 'MATH003', 'LAW121', 'LAW122', 'LAW123'],
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

export const CATALOGUE = {
  preparatory: {
    label: 'السنة الأولى المشتركة (CFY)',
    plans: {
      a: { label: 'الفصل الأول', subjects: ['مهارات اللغة الإنجليزية 1', 'مهارات الحاسب', 'مهارات أكاديمية'] },
      b: { label: 'الفصل الثاني', subjects: ['مهارات اللغة الإنجليزية 2', 'الرياضيات', 'مهارات الاتصال والتواصل'] },
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
  'حاسب': 'مهارات الحاسب',
  'إنجليزي': 'مهارات اللغة الإنجليزية 1',
  'رياضيات': 'الرياضيات',
  'مهارات اتصال': 'مهارات الاتصال والتواصل',
  'مالية': 'تمويل',
  'إعلام إلكتروني': 'إعلام رقمي',
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
