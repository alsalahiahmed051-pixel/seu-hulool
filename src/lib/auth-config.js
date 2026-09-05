/**
 * Whether the whole site sits behind a login.
 *
 * It does not, and should not: browsing is the public face of this site and
 * the account is what unlocks the rest. Read `browseGate` below for the rule
 * that actually decides anything.
 */
export const REQUIRE_LOGIN = false

/**
 * What browse mode may not do.
 *
 * The owner's rule: someone just looking around cannot download files or use
 * the assistant, and nothing is saved for them. Everything else — courses,
 * tracks, the calendar, announcements, links, search — stays open.
 *
 * The gate is "is there a profile at all", not "is there an account", and the
 * difference is a deployment problem rather than a design one: no student has
 * an account yet, and none can be created until custom SMTP is configured in
 * Supabase. Gating on an account today would take downloads and the assistant
 * away from every current student and give them no way to get them back.
 *
 * ── Once sign-ups are live ──────────────────────────────────────────────
 * Set ACCOUNTS_ONLY to true. The gate then means a verified account rather
 * than a device-local profile, which is the stricter rule the owner
 * ultimately wants. Nothing else needs to change.
 */
export const ACCOUNTS_ONLY = false

/**
 * @param {object|null} profile   the student's profile, local or from an account
 * @param {boolean} signedIn      true only for a real Supabase session
 * @returns {boolean} true when this person may download, ask, and save
 */
export function browseGate(profile, signedIn) {
  return ACCOUNTS_ONLY ? !!signedIn : !!profile
}

/**
 * How many assistant questions someone may ask before completing a profile.
 *
 * Browse mode used to be a tour of locked doors: the assistant refused on the
 * first tap, so a visitor never saw the thing the platform is actually for and
 * had no reason to finish a profile. A short trial shows them the product and
 * then asks — which is the honest order.
 *
 * Downloads stay behind the profile at zero: a file is the thing itself, not a
 * taste of it, and the owner's rule has always been that browsing does not
 * download.
 */
/**
 * How many assistant questions a visitor gets before being asked for a
 * profile.
 *
 * Counted per device, in a localStorage key kept outside the app's own store
 * so neither a data reset nor a sign-out restarts it (see `useDurable`).
 *
 * What that does NOT stop: clearing site data, a private window, or a second
 * device. Making the trial genuinely once-per-person needs the count on the
 * server, against the signed device cookie (`deviceIdentity`) or the caller's
 * IP — the shape `claim_quiz_trial` already uses for the quiz trial. That
 * needs a table, so it is the owner's call to make, not a silent addition.
 */
export const BROWSE_TRIAL_AI = 3

/**
 * May this person ask the assistant right now?
 *
 * Returns { ok, trial, left } — `trial` marks an answer given on the trial
 * rather than by right, so the UI can say so instead of quietly spending it.
 */
export function aiGate(profile, signedIn, trialUsed = 0) {
  if (browseGate(profile, signedIn)) return { ok: true, trial: false, left: Infinity }
  const left = Math.max(0, BROWSE_TRIAL_AI - (Number(trialUsed) || 0))
  return { ok: left > 0, trial: true, left }
}
