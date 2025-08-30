import { scryptAsync } from '@noble/hashes/scrypt';
import { randomBytes, bytesToHex, hexToBytes } from '@noble/hashes/utils';

function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

const params = { N: 16384, r: 8, p: 1, dkLen: 64 } as const;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(new TextEncoder().encode(password), salt, params);
  return `${bytesToHex(salt)}:${bytesToHex(key)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(':');
  if (!saltHex || !hashHex) return false;
  const salt = hexToBytes(saltHex);
  const hash = hexToBytes(hashHex);
  try {
    const derived = await scryptAsync(new TextEncoder().encode(password), salt, params);
    return equalBytes(derived, hash);
  } catch {
    return false;
  }
}
