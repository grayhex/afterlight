/**
 * Заголовки с адресом клиента при проксировании в API. Присланные клиентом `X-Forwarded-For`, `X-Real-IP` и `Forwarded`
 * не доверенные: их можно подставить и обойти ограничение частоты по IP. Поэтому по умолчанию они отбрасываются.
 * Если перед вебом стоит граничный прокси (Caddy/Nginx/Traefik), который сам задаёт или перезаписывает X-Forwarded-For,
 * оператор включает TRUST_EDGE_PROXY=true — тогда передаётся только X-Forwarded-For (его значение гарантирует этот прокси).
 */
const CLIENT_ADDRESS_HEADERS = ['x-forwarded-for', 'x-real-ip', 'forwarded'];

export function withTrustedClientAddress(incoming: Headers, edgeProxyTrusted: boolean): Headers {
  const out = new Headers(incoming);
  const forwardedFor = incoming.get('x-forwarded-for');
  for (const name of CLIENT_ADDRESS_HEADERS) out.delete(name);
  if (edgeProxyTrusted && forwardedFor) out.set('x-forwarded-for', forwardedFor);
  return out;
}
