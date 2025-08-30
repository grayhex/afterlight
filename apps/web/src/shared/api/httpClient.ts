const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

interface HttpClientOptions extends RequestInit {
  base?: string;
}

export async function httpClient(
  path: string,
  { base, ...init }: HttpClientOptions = {}
) {
  const basePath = API_BASE.endsWith('/') ? API_BASE.slice(0, -1) : API_BASE;
  const finalPath = path.startsWith('/') ? path : `/${path}`;
  const url = base
    ? new URL(`${basePath}${finalPath}`, base).toString()
    : `${basePath}${finalPath}`;
  try {
    return await fetch(url, { ...init, credentials: 'include' });
  } catch (error) {
    console.error('HTTP request failed', error);
    throw error;
  }
}
