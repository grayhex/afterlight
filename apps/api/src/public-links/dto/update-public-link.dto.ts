import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsInt, IsOptional, Min } from 'class-validator';

export class UpdatePublicLinkDto {
  @ApiProperty()
  @IsBoolean()
  enabled!: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  publish_from?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  publish_until?: string | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  max_views?: number | null;
}
