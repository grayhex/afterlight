import { Injectable, NotFoundException } from '@nestjs/common';

export interface VerificationEventDto {
  id: string;
  vaultId: string;
  status: 'pending' | 'confirmed' | 'denied' | 'disputed';
  confirmations: number;
  denials: number;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class VerificationEventsService {
  private readonly events = new Map<string, VerificationEventDto>();

  /**
   * Creates a new verification event for the given vault.
   */
  createEvent(vaultId: string): VerificationEventDto {
    const id = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const now = new Date();
    const evt: VerificationEventDto = {
      id,
      vaultId,
      status: 'pending',
      confirmations: 0,
      denials: 0,
      createdAt: now,
      updatedAt: now,
    };
    this.events.set(id, evt);
    return evt;
  }

  /**
   * Retrieves a verification event by id.
   */
  findOne(id: string): VerificationEventDto {
    const evt = this.events.get(id);
    if (!evt) {
      throw new NotFoundException(`Verification event with id=${id} not found`);
    }
    return evt;
  }

  /**
   * Registers a confirmation vote from a verifier.
   */
  confirm(id: string): VerificationEventDto {
    const evt = this.findOne(id);
    evt.confirmations += 1;
    this.updateStatus(evt);
    evt.updatedAt = new Date();
    return evt;
  }

  /**
   * Registers a denial vote from a verifier.
   */
  deny(id: string): VerificationEventDto {
    const evt = this.findOne(id);
    evt.denials += 1;
    this.updateStatus(evt);
    evt.updatedAt = new Date();
    return evt;
  }

  /**
   * Recalculates the event status based on confirmations/denials.
   * For demo purposes we simply set confirmed when confirmations>denials,
   * denied when denials>=confirmations and both non-zero, and disputed when equal and >0.
   */
  private updateStatus(evt: VerificationEventDto) {
    if (evt.confirmations === evt.denials && evt.confirmations > 0) {
      evt.status = 'disputed';
    } else if (evt.confirmations > evt.denials) {
      evt.status = 'confirmed';
    } else if (evt.denials >= evt.confirmations && evt.denials > 0) {
      evt.status = 'denied';
    } else {
      evt.status = 'pending';
    }
  }
}