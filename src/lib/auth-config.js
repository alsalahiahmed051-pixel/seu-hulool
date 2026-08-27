/**
 * Temporary switch to open the app up without requiring login, while
 * still testing/polishing before the real launch (custom domain,
 * proper email provider, etc.).
 *
 * Flip this back to `true` once you're ready to require accounts again
 * — nothing else needs to change, middleware.js and page.jsx both read
 * this one flag.
 */
export const REQUIRE_LOGIN = false
