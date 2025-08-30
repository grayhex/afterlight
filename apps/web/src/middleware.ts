import { NextRequest, NextResponse } from 'next/server';
import { httpClient } from './shared/api/httpClient';
// Prisma cannot run in Edge middleware; use API route instead

function unauthorized() {
  return new NextResponse('Unauthorized', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Secure Area"' },
  });
}

export async function middleware(req: NextRequest) {
  const authCookie = req.cookies.get('auth');
  if (!authCookie) return unauthorized();
  const auth = `Basic ${authCookie.value}`;

  try {
    const res = await httpClient('/landing', {
      headers: { authorization: auth },
      // ensure fresh auth check
      cache: 'no-store',
      base: req.url,
    });
    if (res.status !== 200) return unauthorized();
  } catch {
    return unauthorized();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/adm', '/adm/:path*'],
};
