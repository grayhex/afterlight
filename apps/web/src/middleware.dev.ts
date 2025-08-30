import { NextRequest, NextResponse } from 'next/server';
import { httpClient } from './shared/api/httpClient';

export async function middleware(req: NextRequest) {
  try {
    const res = await httpClient('/auth/me', {
      method: 'GET',
      cache: 'no-store',
      base: req.url,
    });
    if (res.ok) {
      return NextResponse.next();
    }
  } catch {
    // ignore
  }
  return NextResponse.redirect(new URL('/dev/login', req.url));
}

export const config = {
  matcher: ['/dev/owner', '/dev/owner/:path*', '/dev/verifier', '/dev/verifier/:path*'],
};
