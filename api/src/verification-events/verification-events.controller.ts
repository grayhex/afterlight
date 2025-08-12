import { Body, Controller, Get, NotFoundException, Param, Post } from '@nestjs/common';
import { VerificationEventsService, VerificationEventDto } from './verification-events.service';

interface CreateEventRequest {
  vaultId: string;
}

@Controller('verification-events')
export class VerificationEventsController {
  constructor(private readonly eventsService: VerificationEventsService) {}

  /**
   * Creates a new verification event for a given vault.
   */
  @Post()
  createEvent(@Body() body: CreateEventRequest): VerificationEventDto {
    return this.eventsService.createEvent(body.vaultId);
  }

  /**
   * Retrieves a verification event by id.
   */
  @Get(':id')
  getEvent(@Param('id') id: string): VerificationEventDto {
    return this.eventsService.findOne(id);
  }

  /**
   * Submits a confirmation vote for a verification event.
   */
  @Post(':id/confirm')
  confirm(@Param('id') id: string): VerificationEventDto {
    return this.eventsService.confirm(id);
  }

  /**
   * Submits a denial vote for a verification event.
   */
  @Post(':id/deny')
  deny(@Param('id') id: string): VerificationEventDto {
    return this.eventsService.deny(id);
  }
}