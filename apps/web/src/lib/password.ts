import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, hash: string): boolean {
  const [salt, storedHash] = hash.split(':');
  try {
    const hashed = scryptSync(password, salt, 64);
    const stored = Buffer.from(storedHash, 'hex');
    return timingSafeEqual(hashed, stored);
  } catch {
    return false;
  }
}
