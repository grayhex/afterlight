import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, Max, Min, MaxLength } from 'class-validator';

export class CreateVaultDto {
  @ApiProperty({ required: false, description: 'Vault display name', maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiProperty({ required: false, description: 'Optional vault description', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  is_demo?: boolean;

  @ApiProperty({ required: false, minimum: 2, maximum: 5, default: 2 })
  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(5)
  quorum_threshold?: number;

  @ApiProperty({ required: false, minimum: 3, maximum: 5, default: 5 })
  @IsOptional()
  @IsInt()
  @Min(3)
  @Max(5)
  max_verifiers?: number;

  @ApiProperty({ required: false, default: 60 })
  @IsOptional()
  @IsInt()
  @Min(1)
  heartbeat_timeout_days?: number;

  @ApiProperty({ required: false, default: 24 })
  @IsOptional()
  @IsInt()
  @Min(1)
  grace_hours?: number;
}
