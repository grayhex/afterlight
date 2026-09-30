import { NextRequest, NextResponse } from 'next/server';
import { httpClient } from './shared/api/httpClient';

// Next 16: файл middleware переименован в proxy (Node.js runtime)
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith('/cabinet')) {
    try {
      // middleware выполняется на сервере: cookie пользователя нужно передать вручную
      const res = await httpClient('/auth/me', {
        method: 'GET',
        cache: 'no-store',
        base: req.url,
        headers: { cookie: req.headers.get('cookie') ?? '' },
      });
      if (res.ok) return NextResponse.next();
    } catch {
      // ignore
    }
    return NextResponse.redirect(new URL('/', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/cabinet',
    '/cabinet/:path*',
  ],
};
