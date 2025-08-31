import { auth, Role } from '../auth/store';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

interface HttpClientOptions extends RequestInit {
  base?: string;
}

export async function httpClient(
  path: string,
  { base, ...init }: HttpClientOptions = {},
) {
  const basePath = API_BASE.endsWith('/') ? API_BASE.slice(0, -1) : API_BASE;
  const finalPath = path.startsWith('/') ? path : `/${path}`;
  const url = base
    ? new URL(`${basePath}${finalPath}`, base).toString()
    : `${basePath}${finalPath}`;
  try {
    const res = await fetch(url, {
      credentials: 'include',
      method: init.method ?? 'POST',
      ...init,
    });

    if (path === '/auth/login' && res.ok && typeof window !== 'undefined') {
      try {
        const data = await res.clone().json();
        const role = data?.role;
        if (
          role === 'Owner' ||
          role === 'Verifier' ||
          role === 'Admin'
        ) {
          auth.login(role.toLowerCase() as Role);
        }
      } catch {
        // ignore JSON parse errors
      }
    }

    return res;
  } catch (error) {
    console.error('HTTP request failed', error);
    throw error;
  }
}

