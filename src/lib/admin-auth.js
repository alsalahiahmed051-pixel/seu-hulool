import { timingSafeEqual } from 'crypto'

/**
 * Constant-time comparison of the admin secret header against
 * ADMIN_SECRET, so a timing side-channel can't be used to brute-force
 * the password character-by-character.
 */
export function isValidAdminSecret(provided) {
  const expected = process.env.ADMIN_SECRET
  if (!provided || !expected) return false

  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  // timingSafeEqual requires equal-length buffers or it throws.
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}
