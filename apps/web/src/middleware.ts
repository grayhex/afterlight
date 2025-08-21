import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { scryptSync, timingSafeEqual } from 'crypto';

const prisma = new PrismaClient();

function unauthorized() {
  return new NextResponse('Unauthorized', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Secure Area"' },
  });
}

export async function middleware(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (!auth) return unauthorized();

  const [scheme, encoded] = auth.split(' ');
  if (scheme !== 'Basic' || !encoded) return unauthorized();

  let decoded: string;
  try {
    decoded =
      typeof atob === 'function'
        ? atob(encoded)
        : Buffer.from(encoded, 'base64').toString('utf8');
  } catch {
    return unauthorized();
  }

  const [login, password] = decoded.split(':');
  if (!login || !password) return unauthorized();

  const admin = await prisma.adminUser.findUnique({ where: { email: login } });
  if (!admin || admin.role !== 'Admin') return unauthorized();

  if (!verifyPassword(password, admin.passwordHash)) return unauthorized();

  return NextResponse.next();
}

function verifyPassword(password: string, hash: string): boolean {
  const [salt, storedHash] = hash.split(':');
  try {
    const hashed = scryptSync(password, salt, 64);
    const stored = Buffer.from(storedHash, 'hex');
    return timingSafeEqual(hashed, stored);
  } catch {
    return false;
  }
}

export const config = {
  matcher: ['/adm', '/adm/:path*'],
};
