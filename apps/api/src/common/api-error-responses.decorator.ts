import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiInternalServerErrorResponse,
} from '@nestjs/swagger';
import { ErrorDto } from './error.dto';

export const ApiErrorResponses = () =>
  applyDecorators(
    ApiBadRequestResponse({ type: ErrorDto }),
    ApiUnauthorizedResponse({ type: ErrorDto }),
    ApiForbiddenResponse({ type: ErrorDto }),
    ApiNotFoundResponse({ type: ErrorDto }),
    ApiInternalServerErrorResponse({ type: ErrorDto }),
  );
