/**
 * Маска российского телефона "+7 (999) 999-99-99" без сторонних библиотек
 * (react-input-mask использует findDOMNode, которого нет в React 19).
 */
export function formatRuPhone(input: string): string {
  let digits = input.replace(/\D/g, '');
  if (digits.startsWith('7') || digits.startsWith('8')) digits = digits.slice(1);
  digits = digits.slice(0, 10);
  if (digits.length === 0) return input.trim().startsWith('+') || /\d/.test(input) ? '+7 (' : '';

  const a = digits.slice(0, 3);
  const b = digits.slice(3, 6);
  const c = digits.slice(6, 8);
  const d = digits.slice(8, 10);
  let out = `+7 (${a}`;
  if (a.length === 3) out += ')';
  if (b) out += ` ${b}`;
  if (c) out += `-${c}`;
  if (d) out += `-${d}`;
  return out;
}
