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
