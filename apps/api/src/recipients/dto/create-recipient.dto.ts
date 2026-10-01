import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsUUID } from 'class-validator';

export class CreateRecipientDto {
  @ApiProperty({ description: 'Идентификатор сейфа' })
  @IsUUID()
  vault_id!: string;

  @ApiProperty({ description: 'Email получателя (уникален в пределах сейфа). Ключ получатель заявляет сам, владелец его не задаёт' })
  @IsEmail()
  contact!: string;
}
