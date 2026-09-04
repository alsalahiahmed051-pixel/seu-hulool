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
 * Transcribed from the platform's own course listing. Only programmes whose
 * plan has been transcribed appear here; the rest fall back to the programme
 * card, so nothing is invented for a programme we do not have the plan for.
 */
export const PROGRAM_LEVELS = {
  'إدارة أعمال': {
    'المستوى الثالث': ['STAT101', 'LAW101', 'ECON101', 'MGT101', 'ACCT101'],
    'المستوى الرابع': ['STAT201', 'FIN101', 'MGT201', 'MGT211', 'ECOM101'],
    'المستوى الخامس': ['ECON201', 'MIS201', 'ECOM201', 'MGT301', 'MGT311', 'MGT312'],
    'المستوى السادس': ['ACCT301', 'MGT321', 'MGT322', 'MGT323'],
    'المستوى السابع': ['MGT401', 'MGT324', 'MGT402', 'MGT403'],
    'المستوى الثامن': ['MGT404', 'MGT421', 'MGT422', 'MGT430'],
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
