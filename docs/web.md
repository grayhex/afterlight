# Frontend (apps/web) — актуальная документация

## Стек
- Next.js 14 (App Router)
- React 18
- Tailwind CSS
- Framer Motion

## Структура маршрутов
- `/` — публичный landing.
- `/register` — регистрация.
- `/cabinet` — кабинет пользователя.
- `/policies` — политики.
- `/contacts` — контакты.
- `/api/landing` (`GET`, `HEAD`) — защищённый route handler для чтения landing-конфига.

> Старые маршруты `/wireframes/*`, `/playground`, `/adm/*`, `/owner`, `/verifier` в текущем `apps/web/src/app` отсутствуют.

## Интеграция с API
Клиент использует `NEXT_PUBLIC_API_URL` (см. `src/shared/api/httpClient.ts`).

Пример:
```env
NEXT_PUBLIC_API_URL="http://localhost:3000"
```

Если переменная не задана, используется `/api` как base URL.

## Landing-конфиг через ENV
Параметры оформления и ссылки landing настраиваются через переменные:

- `LANDING_TITLE`
- `LANDING_SUBTITLE`
- `LANDING_DESCRIPTION`
- `LANDING_BG_COLOR`
- `LANDING_HEADER_BG_COLOR`
- `LANDING_HEADER_TEXT_COLOR`
- `LANDING_TITLE_COLOR`
- `LANDING_SUBTITLE_COLOR`
- `LANDING_DESCRIPTION_COLOR`
- `LANDING_BUTTON_PRIMARY_BG_COLOR`
- `LANDING_BUTTON_PRIMARY_TEXT_COLOR`
- `LANDING_BUTTON_SECONDARY_BORDER_COLOR`
- `LANDING_BUTTON_SECONDARY_TEXT_COLOR`
- `LANDING_TELEGRAM`
- `LANDING_GITHUB`
- `LANDING_DEV`
- `LANDING_POLICIES`
- `LANDING_CONTACTS`

## Доступ к `/api/landing`
Доступ защищён Basic auth:

```http
Authorization: Basic base64(email:password)
```

Проверка происходит по БД:
- пользователь существует,
- роль пользователя = `Admin`,
- пароль валиден относительно `passwordHash`.

## Локальный запуск
```bash
cd apps/web
npm ci
npm run dev
```
