import { createHash } from 'crypto';

/**
 * Синтетические открытые ключи RSA в формате SPKI. Для проверок формата нужна структура и размер модуля, а не простота:
 * настоящая генерация RSA-3072 занимает секунды на каждый ключ, а тестам нужны десятки различных ключей.
 * Такие ключи НЕ годятся для шифрования и не должны выходить за пределы тестов.
 */
const der = (tag: number, body: Buffer): Buffer => {
  const len = body.length < 128 ? Buffer.from([body.length]) : body.length < 256 ? Buffer.from([0x81, body.length]) : Buffer.from([0x82, body.length >> 8, body.length & 255]);
  return Buffer.concat([Buffer.from([tag]), len, body]);
};
const integer = (bytes: Buffer): Buffer => der(0x02, bytes[0] & 0x80 ? Buffer.concat([Buffer.from([0]), bytes]) : bytes);

const RSA_ALGORITHM = Buffer.from('300d06092a864886f70d0101010500', 'hex');

/** Детерминированный «модуль» заданной длины в битах: старший бит выставлен (длина точная), младший тоже (нечётный). */
const modulus = (label: string, bits: number): Buffer => {
  const out = Buffer.alloc(bits / 8);
  for (let i = 0; i * 32 < out.length; i++) createHash('sha256').update(`${label}/${i}`).digest().copy(out, i * 32);
  out[0] |= 0x80;
  out[out.length - 1] |= 1;
  return out;
};

export function rsaSpki(label: string, opts: { bits?: number; exponent?: number } = {}): string {
  const exponent = opts.exponent ?? 65537;
  const e = Buffer.from(exponent.toString(16).padStart(exponent > 0xffff ? 6 : 2, '0').replace(/^(.)$/, '0$1'), 'hex');
  const publicKey = der(0x30, Buffer.concat([integer(modulus(label, opts.bits ?? 3072)), integer(e)]));
  return der(0x30, Buffer.concat([RSA_ALGORITHM, der(0x03, Buffer.concat([Buffer.from([0]), publicKey]))])).toString('base64');
}
