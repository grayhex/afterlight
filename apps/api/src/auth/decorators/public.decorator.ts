import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
/** Явно помечает маршрут как доступный без входа. Других исключений в guard нет. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
