/**
 * Reminder timing — the single source of truth for *when* a lecture or task
 * reminder fires.
 *
 * The browser is the only place that knows the student's local time, so the
 * client computes each reminder's absolute instant (a UTC `fire_at`) and ships
 * the list to the server; the scheduler then just sends whatever is due. That
 * keeps timezones out of the server entirely.
 *
 * `seu-portal-pro-v2.jsx` imports `taskDueAt`, `taskLead` and `lectureLead`
 * from here (its in-app reminders and this server list must agree to the
 * minute), so this file must stay free of React and browser-only globals.
 */

const WEEK_ORDER = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']

// "HH:MM" → minutes past midnight, or null. Mirror of the component's helper;
// kept private so this module has no cross-file dependency.
function timeToMin(s) {
  const m = /^(\d{1,2}):(\d{2})$/.exec((s || '').trim())
  if (!m) return null
  const h = +m[1], mi = +m[2]
  if (h > 23 || mi > 59) return null
  return h * 60 + mi
}

// Lectures saved before the per-lecture lead existed keep the original
// 5-minute lead; 0 means "at start".
export const lectureLead = (lec) => (lec?.remindMin == null ? 5 : Number(lec.remindMin))

// A task with no explicit lead is reminded a day ahead.
export const taskLead = (tk) => (tk?.leadMins == null ? 1440 : Number(tk.leadMins))

/**
 * A task's deadline as a real instant. With no closing time given, end-of-day
 * (23:59) is the honest reading. Returns a Date in the caller's local zone.
 */
export function taskDueAt(tk) {
  if (!tk?.dueDate) return null
  const mins = timeToMin(tk.dueTime)
  const d = new Date(`${tk.dueDate}T00:00:00`)
  if (Number.isNaN(d.getTime())) return null
  d.setMinutes(mins == null ? 23 * 60 + 59 : mins)
  return d
}

// Local YYYY-MM-DD for a Date (not toISOString, which is UTC and can roll the
// day). Used only to build stable dedup keys, so local calendar day is right.
function localDateKey(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Build the list of upcoming reminders for one student's store.
 *
 * Returns rows shaped for the server queue:
 *   { dedup_key, title, body, url, fire_at }   (fire_at is an ISO/UTC string)
 *
 * Only future instants inside the horizon are returned. Respects a per-item
 * `remind === false` opt-out and skips done tasks — exactly like the in-app
 * `useLectureReminders` / `useTaskReminders`.
 *
 * `now` is injectable so the logic is testable without mocking the clock.
 */
export function computeReminders(store, { horizonDays = 14, now = new Date() } = {}) {
  const schedule = Array.isArray(store?.schedule) ? store.schedule : []
  const tasks = Array.isArray(store?.tasks) ? store.tasks : []
  const nowMs = now.getTime()
  const horizonMs = nowMs + horizonDays * 86400000
  const out = []

  // Lectures — weekly slots expanded to their dated occurrences in the window.
  for (const lec of schedule) {
    if (!lec || lec.remind === false || !lec.time) continue
    const mins = timeToMin(lec.time)
    if (mins == null) continue
    const dayIdx = WEEK_ORDER.indexOf(lec.day)
    if (dayIdx < 0) continue
    const lead = lectureLead(lec)

    // Walk each calendar day in the horizon; keep the ones on this weekday.
    for (let offset = 0; offset <= horizonDays; offset++) {
      const d = new Date(now)
      d.setHours(0, 0, 0, 0)
      d.setDate(d.getDate() + offset)
      if (d.getDay() !== dayIdx) continue
      d.setMinutes(mins)
      const fire = d.getTime() - lead * 60000
      if (fire <= nowMs || fire > horizonMs) continue
      const where = lec.mode === 'أونلاين' ? 'أونلاين' : (lec.room || '')
      const when = lead === 0 ? 'تبدأ الآن' : `تبدأ خلال ${lead} دقيقة`
      out.push({
        dedup_key: `lec_${lec.id}_${localDateKey(d)}`,
        title: 'تذكير محاضرة — حلول',
        body: `${lec.course || 'محاضرة'} ${when}${where ? ' • ' + where : ''}`,
        url: '/',
        fire_at: new Date(fire).toISOString(),
      })
    }
  }

  // Tasks — a deadline is a single instant.
  for (const tk of tasks) {
    if (!tk || tk.done || tk.remind === false) continue
    const due = taskDueAt(tk)
    if (!due) continue
    const lead = taskLead(tk)
    const fire = due.getTime() - lead * 60000
    if (fire <= nowMs || fire > horizonMs) continue
    out.push({
      dedup_key: `task_${tk.id}`,
      title: 'تذكير مهمة — حلول',
      body: `${tk.type ? tk.type + ': ' : ''}${tk.title || 'مهمة'} — يقترب موعدها`,
      url: '/',
      fire_at: new Date(fire).toISOString(),
    })
  }

  return out
}
