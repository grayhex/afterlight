import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateRecipientDto {
  @ApiProperty({ description: 'Идентификатор сейфа' })
  @IsUUID()
  vault_id!: string;

  @ApiProperty({ description: 'Email получателя (уникальный идентификатор)' })
  @IsEmail()
  contact!: string;

  @ApiProperty({ required: false, description: 'Публичный ключ получателя (если уже есть)' })
  @IsOptional()
  @IsString()
  @MaxLength(8192)
  pubkey?: string;
}
