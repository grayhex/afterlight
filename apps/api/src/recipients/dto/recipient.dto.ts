import { ApiProperty } from '@nestjs/swagger';

export type KeyStatus = 'Invited' | 'KeyClaimed' | 'KeyConfirmed';

export class RecipientDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid', description: 'Получатель принадлежит одному сейфу' })
  vault_id!: string;

  @ApiProperty()
  contact!: string;

  @ApiProperty({ enum: ['Invited', 'KeyClaimed', 'KeyConfirmed'], description: 'Invited — ключа нет; KeyClaimed — заявлен получателем, не подтверждён владельцем; KeyConfirmed — отпечаток подтверждён владельцем' })
  key_status!: KeyStatus;

  @ApiProperty({ nullable: true, type: String, description: 'Заявленный получателем публичный ключ' })
  public_key!: string | null;

  @ApiProperty({ nullable: true, type: String, description: 'SHA-256 (hex) заявленного ключа; владелец сверяет его с получателем вне сервера' })
  key_fingerprint!: string | null;

  @ApiProperty({ nullable: true, type: Date })
  key_confirmed_at!: Date | null;

  @ApiProperty()
  created_at!: Date;
}
