/** Единая нормализация адреса: вход, регистрация, приглашения и сброс сравнивают адреса одинаково. */
export const normalizeEmail = (email: string): string => email.trim().toLowerCase();
