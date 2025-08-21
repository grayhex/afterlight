import { NextRequest, NextResponse } from 'next/server';

function unauthorized() {
  return new NextResponse('Unauthorized', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Secure Area"' },
  });
}

export function middleware(req: NextRequest) {
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

  const [user, password] = decoded.split(':');
  const expected = process.env.ADMIN_PASSWORD || 'admin';
  const allowedUsers = new Set(['admin', 'admin@example.com']);

  if (user && allowedUsers.has(user) && password === expected) {
    return NextResponse.next();
  }
  return unauthorized();
}

export const config = {
  matcher: ['/adm', '/adm/:path*'],
};
