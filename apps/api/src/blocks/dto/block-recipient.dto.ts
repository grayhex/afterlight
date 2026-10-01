import { ApiProperty } from '@nestjs/swagger';

export class BlockRecipientDto {
  @ApiProperty({ format: 'uuid' })
  block_id!: string;

  @ApiProperty({ format: 'uuid' })
  recipient_id!: string;

  @ApiProperty()
  contact!: string;

  @ApiProperty({ enum: ['Invited', 'KeyClaimed', 'KeyConfirmed'], description: 'Состояние ключа получателя' })
  key_status!: string;

  @ApiProperty({ nullable: true, type: String, description: 'Отпечаток ключа, под который упакован DEK; null у унаследованных назначений' })
  wrapped_for_fingerprint!: string | null;

  @ApiProperty({ description: 'Упаковка действительна, только пока она сделана под нынешний подтверждённый ключ получателя' })
  wrap_valid!: boolean;

  @ApiProperty()
  created_at!: Date;
}
