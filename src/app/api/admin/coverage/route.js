import { requireAdmin } from '@/lib/admin-guard'
import { readMeta, blobEnabled } from '@/lib/files-meta'
import { PROGRAM_LEVELS, canonicalCourse, shelfOf, COURSE_CATEGORIES } from '@/lib/courses'
import { createAdminClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

/**
 * How much of the library actually exists.
 *
 * The overview counted `courses` and `colleges` from two legacy tables the
 * site stopped reading long ago, and no file count at all — so the panel's
 * headline numbers described something that was not the platform, and the one
 * fact that matters (a catalogue of hundreds of courses with nothing on their
 * shelves) appeared nowhere.
 *
 * This answers the owner's real question: where do I upload next. Counted
 * against the same catalogue the student browses and the same index the course
 * page reads, so the number here is the number they see.
 */
export async function GET() {
  const gate = await requireAdmin()
  if (!gate.ok) return Response.json({ error: gate.error }, { status: gate.status })

  // The published plans win over the built-in ones, exactly as the site
  // resolves them — otherwise the panel would report coverage for a plan the
  // owner has already replaced.
  let live = {}
  try {
    const db = createAdminClient()
    const { data } = await db.from('program_plans').select('program, levels')
    for (const row of data || []) {
      if (Array.isArray(row.levels) && row.levels.length) live[row.program] = row.levels
    }
  } catch { /* unconfigured or unreachable — the built-in plans stand */ }

  const planOf = (program) => {
    if (live[program]) return live[program]
    const built = PROGRAM_LEVELS[program]
    return built ? Object.entries(built).map(([label, courses]) => ({ label, courses })) : []
  }

  let files = []
  let indexReadable = true
  if (blobEnabled()) {
    try { files = await readMeta() } catch { indexReadable = false }
  }

  // How many files each course holds, through the same canonicalisation the
  // student's page uses — a file stored under a legacy name counts for the
  // course it resolves to, not against it.
  const perCourse = new Map()
  const perShelf = {}
  for (const f of files) {
    const key = canonicalCourse(f.courseName)
    perCourse.set(key, (perCourse.get(key) || 0) + 1)
    const shelf = shelfOf(f.category)
    perShelf[shelf] = (perShelf[shelf] || 0) + 1
  }

  const programs = Object.keys(PROGRAM_LEVELS).map(program => {
    const levels = planOf(program)
    const codes = [...new Set(levels.flatMap(l => l.courses || []))]
    const covered = codes.filter(c => (perCourse.get(c) || 0) > 0)
    return {
      program,
      courses: codes.length,
      covered: covered.length,
      // The first few gaps, so a row is a worklist and not just a percentage.
      missing: codes.filter(c => !(perCourse.get(c) || 0)).slice(0, 8),
    }
  }).sort((a, b) => (a.covered / (a.courses || 1)) - (b.covered / (b.courses || 1)))

  const allCodes = [...new Set(Object.values(PROGRAM_LEVELS)
    .flatMap(levels => Object.values(levels).flat()))]
  const coveredCodes = allCodes.filter(c => (perCourse.get(c) || 0) > 0)

  // Files filed under something that is not a course in any plan — a
  // programme document, or a name that no longer resolves. Worth surfacing:
  // it is the only way an orphaned upload becomes visible.
  const codeSet = new Set(allCodes)
  const offCatalogue = [...perCourse.entries()]
    .filter(([name]) => !codeSet.has(name))
    .map(([name, n]) => ({ name, files: n }))
    .sort((a, b) => b.files - a.files)

  return Response.json({
    blobEnabled: blobEnabled(),
    indexReadable,
    totals: {
      courses: allCodes.length,
      covered: coveredCodes.length,
      files: files.length,
    },
    perShelf: COURSE_CATEGORIES.map(c => ({ id: c.id, label: c.label, files: perShelf[c.id] || 0 })),
    programs,
    offCatalogue: offCatalogue.slice(0, 20),
  })
}
