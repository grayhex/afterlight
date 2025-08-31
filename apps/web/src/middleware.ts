import { NextRequest, NextResponse } from 'next/server';
import { httpClient } from './shared/api/httpClient';
// Prisma cannot run in Edge middleware; use API route instead

function unauthorized() {
  return new NextResponse('Unauthorized', { status: 401 });
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith('/owner') || pathname.startsWith('/verifier')) {
    try {
      const res = await httpClient('/auth/me', {
        method: 'GET',
        cache: 'no-store',
        base: req.url,
      });
      if (res.ok) return NextResponse.next();
    } catch {
      // ignore
    }
    return NextResponse.redirect(new URL('/login', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/owner',
    '/owner/:path*',
    '/verifier',
    '/verifier/:path*',
  ],
};
