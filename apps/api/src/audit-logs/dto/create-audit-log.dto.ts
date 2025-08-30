import { ApiProperty } from '@nestjs/swagger';
import { ActorType } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateAuditLogDto {
  @ApiProperty({ enum: ActorType })
  @IsEnum(ActorType)
  actorType!: ActorType;

  @ApiProperty()
  @IsString()
  actorId!: string;

  @ApiProperty()
  @IsString()
  action!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  targetId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  targetType?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  hash?: string;
}
