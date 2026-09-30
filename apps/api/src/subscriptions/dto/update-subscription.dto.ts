import { PartialType } from '@nestjs/swagger';
import { CreateSubscriptionDto } from './create-subscription.dto.js';

export class UpdateSubscriptionDto extends PartialType(CreateSubscriptionDto) {}
