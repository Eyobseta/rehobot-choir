import argon2 from 'argon2';

/**
 * Argon2id password hashing (SRS 6.3).
 *
 * Parameters chosen for a good balance between security and
 * developer-hardware constraints. Revisit at production hardening.
 *
 * Note: the `argon2` package does not export a named `Options` type,
 * so we use `Parameters<typeof argon2.hash>[1]` to type the object.
 */
const ARGON2_OPTIONS: Parameters<typeof argon2.hash>[1] = {
  type: argon2.argon2id,
  memoryCost: 19456, // 19 MiB — OWASP recommended minimum
  timeCost: 2,
  parallelism: 1,
};

export async function hashPassword(plain: string): Promise<string> {
  // argon2.hash returns a string by default; the typed overload is Buffer.
  // Casting the result to string is safe.
  return argon2.hash(plain, ARGON2_OPTIONS);
}

export async function verifyPassword(
  hash: string,
  plain: string,
): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}