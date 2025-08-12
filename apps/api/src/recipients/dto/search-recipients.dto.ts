import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SearchRecipientsDto {
  @ApiProperty({ required: false, description: 'Подстрока для поиска по contact' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;
}
