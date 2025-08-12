import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class UpdateVaultSettingsDto {
  @ApiProperty({ required: false, minimum: 3, maximum: 5 })
  @IsOptional()
  @IsInt()
  @Min(3)
  @Max(5)
  quorum_threshold?: number;

  @ApiProperty({ required: false, minimum: 3, maximum: 5 })
  @IsOptional()
  @IsInt()
  @Min(3)
  @Max(5)
  max_verifiers?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  heartbeat_timeout_days?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  grace_hours?: number;

  @ApiProperty({ required: false, description: 'Optional primary verifier id' })
  @IsOptional()
  @IsUUID()
  primary_verifier_id?: string;
}
