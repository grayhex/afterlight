import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

/**
 * Канонический UUID: строчные буквы, как его хранит и возвращает PostgreSQL. Идентификаторы сейфа и блока входят в
 * контекст шифрования (AAD, соль HKDF), поэтому клиент и сервер обязаны писать их одинаково: ключ или блок,
 * созданные с «UUID» в верхнем регистре, потом не расшифровались бы с тем идентификатором, который вернул сервер (ADR-0003).
 */
export const CANONICAL_UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export const CANONICAL_UUID_MESSAGE = 'must be a UUID in canonical lowercase form';

/** Параметр пути: только канонический UUID (вместо ParseUUIDPipe там, где идентификатор входит в контекст шифрования). */
@Injectable()
export class CanonicalUuidPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (typeof value !== 'string' || !CANONICAL_UUID_PATTERN.test(value)) {
      throw new BadRequestException(`Validation failed (uuid ${CANONICAL_UUID_MESSAGE})`);
    }
    return value;
  }
}
