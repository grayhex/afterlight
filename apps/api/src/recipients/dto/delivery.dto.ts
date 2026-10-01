import { ApiProperty } from '@nestjs/swagger';

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
