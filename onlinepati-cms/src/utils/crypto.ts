/**
 * Crypto Utilities — Hashing and TOTP
 * Uses Web Crypto API (available in Cloudflare Workers)
 */

/**
 * Hash a password using SHA-256
 * Note: In a production environment with many users, Argon2 or Bcrypt is preferred,
 * but for a single-admin CMS on Workers, PBKDF2 or SHA-256 with a strong salt is a robust choice.
 */
export async function hashPassword(password: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}
