import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class SearchRecipientsDto {
  @ApiProperty({ description: 'Идентификатор сейфа' })
  @IsUUID()
  vault_id!: string;

  @ApiProperty({ required: false, description: 'Подстрока для поиска по contact' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;
}
