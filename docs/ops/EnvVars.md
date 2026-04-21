# Переменные окружения (актуально)

## API (`apps/api`)

### Обязательные
- `DATABASE_URL` — строка подключения PostgreSQL (Prisma).
- `JWT_SECRET` — секрет для подписи JWT.
- `CORS_ALLOWED_ORIGINS` — список origin через запятую.

> При отсутствии любой из обязательных переменных API не стартует (валидируется в `main.ts`).

### Опциональные
- `NODE_ENV` — обычно `development` / `production`.
- `PORT` — порт API (по умолчанию `3000`).
- `JSON_BODY_LIMIT` — лимит JSON body (по умолчанию `100kb`).
- `DEFAULT_DEBUG_USER` — debug-пользователь для локальной отладки.
- `PUBLIC_BASE_URL` — базовый URL для формирования публичных ссылок блоков.
- `ADMIN_PASSWORD` — опциональное переопределение пароля admin при сидировании.

### Пример
```env
DATABASE_URL="postgresql://user:pass@localhost:5432/afterlight?schema=public"
JWT_SECRET="replace-with-64-char-random-hex-key"
CORS_ALLOWED_ORIGINS="http://localhost:3001,https://app.example.com"
NODE_ENV="development"
PORT=3000
JSON_BODY_LIMIT="100kb"
DEFAULT_DEBUG_USER=""
PUBLIC_BASE_URL="https://api.example.com"
```

---

## WEB (`apps/web`)

### Используемые переменные
- `NEXT_PUBLIC_API_URL` — base URL API для фронтенда.

### Переменные настройки landing
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

### Пример
```env
NEXT_PUBLIC_API_URL="http://localhost:3000"
LANDING_TITLE="Afterlight"
LANDING_SUBTITLE="Идёт разработка с помощью ИИ"
LANDING_BG_COLOR="#000000"
```
