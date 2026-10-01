import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Блок без шифротекста: так он выглядит в списке (шифротекст — только при чтении одного блока). */
export class BlockDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  vault_id!: string;

  @ApiProperty({ enum: ['text', 'file', 'url'], description: 'Создаются только текстовые блоки; file и url — унаследованные значения' })
  type!: string;

  @ApiProperty({ description: 'Ключ блока (DEK) под ключом сейфа: конверт v1' })
  dek_wrapped!: string;

  @ApiPropertyOptional({ nullable: true, description: 'Произвольные метаданные в открытом виде (не кладите сюда секреты)', type: 'object', additionalProperties: true })
  metadata!: unknown;

  @ApiProperty({ type: [String], description: 'Теги в открытом виде (не кладите сюда секреты)' })
  tags!: string[];

  @ApiProperty({ nullable: true, type: 'integer', description: 'Размер шифротекста в байтах; null у унаследованных блоков без шифротекста' })
  size!: number | null;

  @ApiProperty({ nullable: true, type: 'string' })
  checksum!: string | null;

  @ApiProperty()
  is_public!: boolean;

  @ApiProperty({ type: 'string', format: 'date-time' })
  created_at!: Date;

  @ApiProperty({ type: 'string', format: 'date-time' })
  updated_at!: Date;
}

export class BlockDetailDto extends BlockDto {
  @ApiProperty({ nullable: true, type: 'string', description: 'Шифротекст блока (конверт v1); null у унаследованных блоков' })
  ciphertext!: string | null;
}
