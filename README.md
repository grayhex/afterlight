<div align="center">
  <img src="https://capsule-render.vercel.app/api?type=waving&height=220&color=0:0F172A,50:111827,100:1D4ED8&text=Afterlight&fontColor=E2E8F0&fontSize=64&desc=Digital%20legacy%20platform%20(MVP)&descAlignY=65&animation=fadeIn" alt="Afterlight banner" />

  <p>
    <a href="./LICENSE"><img alt="License" src="https://img.shields.io/badge/license-MIT-22C55E"></a>
    <img alt="Monorepo" src="https://img.shields.io/badge/monorepo-apps%2Fapi%20%2B%20apps%2Fweb-6366F1">
    <img alt="NestJS" src="https://img.shields.io/badge/API-NestJS%2010-EA2845">
    <img alt="Next.js" src="https://img.shields.io/badge/Web-Next.js%2014-000000">
    <img alt="Prisma" src="https://img.shields.io/badge/ORM-Prisma%205-2D3748">
  </p>

  <p><b>Afterlight</b> — сервис цифрового наследия: безопасная подготовка и передача данных по заранее заданным условиям.</p>
</div>

---

## ✨ Что это
Afterlight — monorepo из двух приложений:

- **`apps/api`**: NestJS API с PostgreSQL/Prisma, JWT-аутентификацией, ролями и Swagger.
- **`apps/web`**: Next.js интерфейс (landing + кабинет + страницы политики/контактов).

Продуктовая идея: владелец хранит данные в сейфе, назначает получателей/верификаторов, а раскрытие запускается через событие и подтверждения.

---

## 🧱 Текущие возможности (по коду)

### Backend (API)
- JWT auth: `register`, `login`, `logout`, `me`.
- Сейфы и настройки сейфа.
- Блоки данных, привязка получателей к блокам.
- Публичные ссылки для блоков (`/blocks/{id}/public`).
- Верификаторы и события верификации.
- Heartbeat-конфигурация и ping.
- Оркестрация событий (`/orchestration/start`, `/orchestration/decision`).
- CRUD для пользователей, планов, подписок, аудит-логов, recovery shares.
- Health/readiness endpoints: `/healthz`, `/readyz`.
- Swagger: `/docs`.

### Frontend (Web)
- Маршруты: `/`, `/register`, `/cabinet`, `/policies`, `/contacts`.
- Клиент API через `NEXT_PUBLIC_API_URL`.
- Отдельный server route для защищённой настройки landing: `GET/HEAD /api/landing` (Basic auth, проверка admin в БД).
- Анимированный landing (Framer Motion, particles background).

---

## 🗺️ Архитектура

```mermaid
flowchart LR
  U[User Browser] --> W[Next.js Web\napps/web]
  W -->|REST / JWT| A[NestJS API\napps/api]
  A --> P[(PostgreSQL)]
  A --> S[Swagger /docs]
```

### Основные доменные сущности

```mermaid
erDiagram
  USER ||--o{ VAULT : owns
  VAULT ||--o{ BLOCK : contains
  VAULT ||--o{ VERIFICATION_EVENT : has
  VAULT ||--o{ VERIFIER : includes
  BLOCK ||--o{ PUBLIC_LINK : exposes
  BLOCK ||--o{ RECIPIENT_ASSIGNMENT : assigned_to
  RECIPIENT ||--o{ RECIPIENT_ASSIGNMENT : receives
```

---

## 🚀 Быстрый старт (локально)

### 1) Требования
- Node.js 20+
- npm 10+
- PostgreSQL 15+

### 2) Установка
```bash
# API
cd apps/api
npm ci

# WEB
cd ../web
npm ci
```

### 3) ENV
Создайте `.env` (или экспортируйте переменные) для API на базе `.env.example`:

```env
DATABASE_URL="postgresql://user:pass@localhost:5432/afterlight?schema=public"
JWT_SECRET="replace-with-64-char-random-hex-key"
NODE_ENV="development"
PORT=3000
DEFAULT_DEBUG_USER=""
CORS_ALLOWED_ORIGINS="http://localhost:3001"
JSON_BODY_LIMIT="100kb"
```

Для Web:

```env
NEXT_PUBLIC_API_URL="http://localhost:3000"
```

### 4) База данных
```bash
cd apps/api
npx prisma generate
npx prisma migrate deploy
npm run build
npx prisma db seed
```

### 5) Запуск
```bash
# terminal 1
cd apps/api
npm run start:dev

# terminal 2
cd apps/web
npm run dev
```

- Web: `http://localhost:3000` (или порт из команды)
- API Swagger: `http://localhost:3000/docs`

---

## 🧪 Полезные команды

```bash
# API tests
cd apps/api && npm test

# WEB tests
cd apps/web && npm test

# Сгенерировать openapi.json (API)
cd apps/api && npm run openapi

# Обновить типы API в WEB
cd apps/web && npm run openapi
```

---

## ☸️ Деплой
- Kubernetes-манифесты: `k8s/base/*`
- Отдельные инструкции:
  - `docs/deploy.md`
  - `docs/INSTALL.md`
  - `k8s/README.md`

---

## 📚 Документация
- `docs/web.md` — актуальная структура web и маршруты.
- `docs/ops/EnvVars.md` — обязательные и опциональные переменные окружения.
- `docs/api/openapi.yaml` и `apps/api/openapi.json` — API контракт.

---

## 🛡️ Безопасность
- Не коммитьте секреты в git.
- Минимум для production: сильный `JWT_SECRET`, закрытый доступ к БД, корректный `CORS_ALLOWED_ORIGINS`, TLS на ingress.
- Для seed admin-пользователя можно переопределить пароль через `ADMIN_PASSWORD` перед `prisma db seed`.

---

## 📄 License
MIT — см. [LICENSE](./LICENSE).
