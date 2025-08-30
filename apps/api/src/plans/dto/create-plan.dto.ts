import { ApiProperty } from '@nestjs/swagger';
import { PlanTier } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

export class CreatePlanDto {
  @ApiProperty({ enum: PlanTier })
  @IsEnum(PlanTier)
  tier: PlanTier;

  @ApiProperty({ type: Object })
  @IsOptional()
  limits?: Record<string, any>;
}
