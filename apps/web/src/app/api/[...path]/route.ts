import { NextRequest } from 'next/server';
import { withTrustedClientAddress } from '@/lib/forwarded-headers';

// Браузер и middleware ходят в API через тот же origin (`/api/...`): cookie первая сторона, CORS не нужен,
// адрес API задаётся окружением РАНТАЙМА (API_INTERNAL_URL), а не зашивается в сборку.
export const dynamic = 'force-dynamic';

const HOP_BY_HOP = ['connection', 'keep-alive', 'transfer-encoding', 'te', 'trailer', 'upgrade', 'proxy-authorization', 'proxy-authenticate', 'host', 'content-length'];

function apiBase(): string {
  return (process.env.API_INTERNAL_URL || 'http://127.0.0.1:3000').replace(/\/+$/, '');
}

async function proxy(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const target = `${apiBase()}/${path.map(encodeURIComponent).join('/')}${req.nextUrl.search}`;
  // адрес клиента для API: присланные клиентом заголовки не доверяем (TRUST_EDGE_PROXY — только за граничным прокси)
  const headers = withTrustedClientAddress(req.headers, process.env.TRUST_EDGE_PROXY === 'true');
  for (const h of HOP_BY_HOP) headers.delete(h);
  const hasBody = !['GET', 'HEAD'].includes(req.method);
  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: req.method,
      headers,
      body: hasBody ? await req.arrayBuffer() : undefined,
      redirect: 'manual',
      cache: 'no-store',
    });
  } catch {
    return new Response(JSON.stringify({ message: 'API is unavailable' }), {
      status: 502,
      headers: { 'content-type': 'application/json' },
    });
  }
  const out = new Headers(upstream.headers);
  for (const h of HOP_BY_HOP) out.delete(h);
  out.delete('content-encoding');
  return new Response(upstream.body, { status: upstream.status, headers: out });
}

export { proxy as GET, proxy as POST, proxy as PUT, proxy as PATCH, proxy as DELETE };
