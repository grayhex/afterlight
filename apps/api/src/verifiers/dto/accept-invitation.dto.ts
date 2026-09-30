import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class AcceptInvitationDto {
  @ApiProperty({ description: 'Одноразовый токен из письма-приглашения' })
  @IsString()
  @MinLength(16)
  @MaxLength(256)
  token!: string;
}
