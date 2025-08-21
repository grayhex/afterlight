import { NextRequest, NextResponse } from 'next/server';

export function middleware(req: NextRequest) {
  const basicAuth = req.headers.get('authorization');
  const expected = process.env.ADMIN_PASSWORD || 'admin';
  const allowedUsers = ['admin', 'admin@example.com'];

  if (basicAuth) {
    const [scheme, encoded] = basicAuth.split(' ');
    if (scheme === 'Basic') {
      const decoded =
        typeof atob === 'function'
          ? atob(encoded)
          : Buffer.from(encoded, 'base64').toString('utf8');
      const [user, password] = decoded.split(':');
      if (allowedUsers.includes(user) && password === expected) {
        return NextResponse.next();
      }
    }
  }

  return new NextResponse('Unauthorized', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Secure Area"' },
  });
}

export const config = {
  matcher: ['/adm/:path*'],
};
