import { applyDecorators } from '@nestjs/common';
import { Equals } from 'class-validator';

/**
 * Поле, которого в теле запроса быть не должно (например, user_id в голосовании).
 * Глобальный ValidationPipe с whitelist молча отбрасывает неизвестные поля, а здесь подмена
 * автора должна давать явный 400, поэтому поле объявляется и запрещается валидатором.
 */
export const ForbiddenField = (name: string) =>
  applyDecorators(Equals(undefined, { message: `${name} must not be provided: the author is taken from the session` }));
