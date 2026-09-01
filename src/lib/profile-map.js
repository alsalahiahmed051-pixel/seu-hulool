/**
 * Translating between the `profiles` row and the shape the app has always used.
 *
 * These two disagree in ways that matter. The app speaks Arabic track names
 * ("تحضيري", "تخصص") throughout — every picker, every label, every comparison
 * in myTrackSubjects and TRACK_TO_TREE. The column does not: `profiles.track`
 * carries a CHECK constraint of ('preparatory','bachelor','diploma',
 * 'graduate'), so writing "تحضيري" to it fails outright. The names also differ
 * (name/full_name, plan/program) and the row has fields the app never had
 * (student_code, role).
 *
 * Keeping the translation in one small, testable place means the component
 * keeps the vocabulary it already uses, and the database keeps its constraint.
 */

/** The app's Arabic track names ↔ the column's enum. */
export const TRACK_TO_DB = {
  'تحضيري': 'preparatory',
  'تخصص': 'bachelor',
  'دبلوم': 'diploma',
  'دراسات عليا': 'graduate',
}

export const TRACK_FROM_DB = Object.fromEntries(
  Object.entries(TRACK_TO_DB).map(([ar, en]) => [en, ar])
)

/** A `profiles` row → the object the app renders. */
export function toAppProfile(row, email = '') {
  if (!row) return null
  return {
    name: row.full_name || '',
    // The site's own handle, generated at signup and never edited.
    studentCode: row.student_code || '',
    // Their real university number — optional, and theirs to fill in.
    studentId: row.university_id || '',
    email: email || '',
    track: TRACK_FROM_DB[row.track] || '',
    college: row.college_id || '',
    plan: row.plan || '',
    confirmedAt: row.confirmed_at ? new Date(row.confirmed_at).getTime() : null,
    role: row.role || 'student',
  }
}

/**
 * The app's object → the columns to write.
 *
 * Only the fields a student may set. `student_code` and `role` are absent on
 * purpose: the first is assigned once by the database, the second decides who
 * can reach the admin panel, and neither should be reachable from a profile
 * form. RLS lets a student update their own row, so leaving `role` out here is
 * the difference between an edit form and a privilege escalation.
 */
export function toDbProfile(p) {
  const out = {}
  if (p.name !== undefined) out.full_name = String(p.name || '').trim()
  if (p.studentId !== undefined) out.university_id = String(p.studentId || '').trim() || null
  if (p.college !== undefined) out.college_id = p.college || null
  if (p.plan !== undefined) out.plan = p.plan || null
  if (p.track !== undefined) {
    const db = TRACK_TO_DB[p.track]
    // An unmapped track would violate the CHECK constraint and fail the whole
    // update; better to leave the column alone than to lose the other fields.
    if (db) out.track = db
    else if (!p.track) out.track = null
  }
  if (p.confirmedAt !== undefined) {
    out.confirmed_at = p.confirmedAt ? new Date(p.confirmedAt).toISOString() : null
  }
  return out
}

/** How long a track stays fixed after it is confirmed. */
export const TRACK_LOCK_DAYS = 15

/** Whole days left on the hold; 0 once it has elapsed or never started. */
export function lockDaysLeft(confirmedAt, now = Date.now()) {
  if (!confirmedAt) return 0
  const elapsed = now - Number(confirmedAt)
  const left = TRACK_LOCK_DAYS - Math.floor(elapsed / 86_400_000)
  return left > 0 ? left : 0
}
