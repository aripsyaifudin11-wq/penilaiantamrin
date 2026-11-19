export const INITIAL_ADMIN_SALT = 'madin_mm1_admin_salt_v1';
// Precomputed SHA-256 of `${INITIAL_ADMIN_SALT}:admin123` so raw initial password is never stored in frontend/DB.
export const INITIAL_ADMIN_HASH =
  'f7154f708821af27c18f05e2546cefcdf53d68c216c56c7e880332dfe241758c';

export async function sha256Hex(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.subtle) {
    const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  // Node.js test fallback
  const { createHash } = await import('node:crypto');
  return createHash('sha256').update(input).digest('hex');
}

export function generateSalt(length = 24): string {
  const chars = 'abcdef0123456789';
  let result = '';
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.getRandomValues) {
    const bytes = new Uint8Array(length);
    globalThis.crypto.getRandomValues(bytes);
    for (let i = 0; i < length; i++) {
      result += chars[bytes[i] % chars.length];
    }
    return result;
  }
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

export async function hashSecret(secret: string, salt: string): Promise<string> {
  return sha256Hex(`${salt}:${secret}`);
}

export async function verifySecret(
  secret: string,
  salt: string,
  expectedHash: string
): Promise<boolean> {
  const computed = await hashSecret(secret, salt);
  return computed === expectedHash;
}
