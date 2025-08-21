# Frontend overview

Веб-часть построена на Next.js. Корневая страница (`/`) служит временным лендингом и содержит ссылки на основные экраны приложения.

## Навигация
- `/wireframes/owner` — кабинет владельца (wireframe)
- `/wireframes/verifier` — кабинет верификатора (wireframe)
- `/wireframes/recipient` — вид получателя (wireframe)

## Отладка
- `/playground` — минимальный UI для ручного теста API
- `http://localhost:3000/docs` — Swagger UI бэкенда (порт можно изменить переменной `PORT` при запуске API)

Неиспользуемые заглушки и моковые данные удалены из исходников.

## Роли
- **Owner** — владелец сейфа.
- **Verifier** — подтверждает события.
- **Recipient** — получает данные.
- **Admin** — управляет сервисом через `/adm`.

## Перезапуск seed
Повторно заполнить БД можно так:
```bash
gh workflow run seed -f confirm=prod
```

## Basic-auth
Админский раздел `/adm` защищён Basic‑auth. Формат заголовка:

```
Authorization: Basic <base64(email:password)>
```

Используйте учётные данные администратора из таблицы `user` (role `Admin`).
