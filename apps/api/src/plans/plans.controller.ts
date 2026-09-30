import { Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PlansService } from './plans.service.js';
import { CreatePlanDto } from './dto/create-plan.dto.js';
import { UpdatePlanDto } from './dto/update-plan.dto.js';
import { ApiErrorResponses } from '../common/api-error-responses.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UserRole } from '@prisma/client';

@ApiTags('plans')
@ApiBearerAuth()
@ApiErrorResponses()
@Controller('plans')
export class PlansController {
  constructor(private readonly service: PlansService) {}

  @Get()
  list() {
    return this.service.list();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.get(id);
  }

  @Roles(UserRole.Admin)
  @Post()
  create(@Body() dto: CreatePlanDto) {
    return this.service.create(dto);
  }

  @Roles(UserRole.Admin)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePlanDto) {
    return this.service.update(id, dto);
  }

  @Roles(UserRole.Admin)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
