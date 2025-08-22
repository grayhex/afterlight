import { NextRequest, NextResponse } from 'next/server';
// Prisma cannot run in Edge middleware; use API route instead

function unauthorized() {
  return new NextResponse('Unauthorized', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Secure Area"' },
  });
}

export async function middleware(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (!auth) return unauthorized();

  try {
    const res = await fetch(new URL('/api/landing', req.url), {
      headers: { authorization: auth },
      // ensure fresh auth check
      cache: 'no-store',
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
