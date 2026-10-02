import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Matches, Max, Min } from 'class-validator';
import { CANONICAL_UUID_MESSAGE, CANONICAL_UUID_PATTERN } from '../../common/canonical-uuid.js';

export class ListDeliveriesDto {
  @ApiProperty({ required: false, minimum: 1, maximum: 200, default: 50, description: 'Сколько блоков вернуть' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @ApiProperty({ required: false, format: 'uuid', description: 'block_id последнего блока предыдущей страницы: список идёт по возрастанию block_id' })
  @IsOptional()
  @IsUUID()
  @Matches(CANONICAL_UUID_PATTERN, { message: `cursor ${CANONICAL_UUID_MESSAGE}` })
  cursor?: string;
}

/** Блок, доступный получателю после раскрытия: только метаданные (шифротекст — отдельным запросом). */
export class DeliveryItemDto {
  @ApiProperty({ format: 'uuid' })
  block_id!: string;

  @ApiProperty({ format: 'uuid' })
  vault_id!: string;

  @ApiProperty({ type: 'string', format: 'date-time', nullable: true, description: 'Когда процесс раскрытия завершился' })
  finalized_at!: Date | null;

  @ApiProperty({ description: 'Размер шифротекста в байтах' })
  size!: number;
}

/** Всё, что нужно браузеру получателя для расшифрования одного блока: шифротекст и упаковка ключа под его ключ. */
export class DeliveredBlockDto {
  @ApiProperty({ format: 'uuid' })
  block_id!: string;

  @ApiProperty({ format: 'uuid' })
  vault_id!: string;

  @ApiProperty({ description: 'Шифротекст блока (конверт v1); расшифровывается в браузере получателя' })
  ciphertext!: string;

  @ApiProperty({ description: 'Ключ блока (DEK), упакованный под подтверждённый ключ этого получателя: RSA-OAEP 3072, base64' })
  dek_wrapped_for_recipient!: string;

  @ApiProperty({ description: 'Отпечаток ключа получателя, под который сделана упаковка' })
  key_fingerprint!: string;

  @ApiProperty({ type: 'string', format: 'date-time', nullable: true })
  finalized_at!: Date | null;
}
