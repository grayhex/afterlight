import { PartialType } from '@nestjs/swagger';
import { CreatePlanDto } from './create-plan.dto.js';

export class UpdatePlanDto extends PartialType(CreatePlanDto) {}
