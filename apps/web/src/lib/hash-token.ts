/**
 * Одноразовый токен из ссылки в письме лежит во фрагменте (#token=...): он не уходит на сервер и не попадает в логи.
 * Читаем его и сразу убираем из адресной строки, чтобы он не остался в истории и не утёк через скриншот или реферер.
 */
export function takeTokenFromHash(win: Pick<Window, 'location' | 'history'> = window): string | null {
  const token = new URLSearchParams(win.location.hash.replace(/^#/, '')).get('token');
  win.history.replaceState(null, '', win.location.pathname + win.location.search);
  return token && token.length > 0 ? token : null;
}
