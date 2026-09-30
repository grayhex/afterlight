<div align="center">

# 🌌 Afterlight
### Digital legacy platform (MVP)

<p>
  <a href="./LICENSE"><img alt="License" src="https://img.shields.io/badge/license-MIT-22C55E"></a>
  <img alt="API" src="https://img.shields.io/badge/API-NestJS%2010-EA2845">
  <img alt="Web" src="https://img.shields.io/badge/Web-Next.js%2014-000000">
  <img alt="ORM" src="https://img.shields.io/badge/ORM-Prisma%205-2D3748">
  <img alt="Deploy" src="https://img.shields.io/badge/Deploy-Docker%20Compose-2496ED">
</p>

**Afterlight** — сервис цифрового наследия: безопасное хранение, управление доступом и сценарии раскрытия данных по событиям.

</div>

---

## ✨ Возможности

- 🔐 JWT-аутентификация: `register`, `login`, `logout`, `me`.
- 🗂️ Сейфы, блоки данных, получатели, публичные ссылки.
- ✅ Верификаторы, события верификации, оркестрация решений.
- 🩺 Health/readiness endpoints: `/healthz`, `/readyz`.
- 📘 Swagger документация: `/docs`.
- 🖥️ Web-интерфейс: landing, регистрация, кабинет, policies, contacts.

---

## 🧱 Стек

- **Backend**: NestJS + Prisma + PostgreSQL
- **Frontend**: Next.js 14 (SSR)
- **Infra**: Docker / Docker Compose, Kubernetes manifests (`k8s/`)

---

## 🚀 Быстрый старт (локальная разработка)

### 1) Требования

- Node.js 24 (LTS)
- npm 10+
- PostgreSQL 15+

### 2) Установка зависимостей

```bash
cd apps/api && npm ci
cd ../web && npm ci
```

### 3) Настройка переменных

```bash
cp .env.example .env
```

Минимально проверьте:
- `DATABASE_URL`
- `JWT_SECRET`
- `NEXT_PUBLIC_API_URL`

### 4) Подготовка БД

```bash
cd apps/api
npx prisma generate
npx prisma migrate deploy
npm run build
npx prisma db seed
```

### 5) Запуск

```bash
# API
cd apps/api && npm run start:dev

# WEB (в отдельном терминале)
cd apps/web && npm run dev
```

---

## ✅ Проверки (то же, что в CI)

API, из `apps/api`:

```bash
npm ci
npx prisma validate && npx prisma format --check
npx prisma generate
npm run typecheck          # src + тесты
npm run build
npm run test:unit          # изолированные тесты с моками (npm test — то же самое)
```

Integration-тесты ходят по HTTP в настоящее приложение (те же guard'ы и pipes, что в runtime) и в настоящий PostgreSQL.
Им нужна **отдельная** БД, в имени которой есть `test`, — перед каждым тестом таблицы очищаются, с другой БД тесты откажутся работать:

```bash
docker run -d --name afterlight-test-db -p 5432:5432 -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=afterlight_test postgres:16
export DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/afterlight_test?schema=public"
npx prisma migrate deploy
npm run test:integration
```

Проверка, что схема совпадает с миграциями: `npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --exit-code`.

Web, из `apps/web`: `npm ci && npx tsc --noEmit && npm test && npm run build`
(пока сборка web требует выполненного `npm ci` в `apps/api`).

---

## 🖥️ Deploy на сервер (рекомендуемый путь)

Для VPS/dedicated сервера добавлен готовый сценарий через Docker Compose:

- `docker-compose.server.yml` — production stack (db + api + web + migrate job)
- `docs/deploy.md` — пошаговая инструкция деплоя и обновления

Быстрый запуск:

```bash
cp .env.example .env
# отредактируйте секреты в .env

docker compose -f docker-compose.server.yml up -d --build db api web
docker compose -f docker-compose.server.yml run --rm migrate
```

---

## 📚 Документация

- `docs/deploy.md` — деплой на сервер (Docker Compose).
- `docs/INSTALL.md` — установка и запуск.
- `docs/web.md` — структура web-части.
- `docs/ops/EnvVars.md` — переменные окружения.
- `k8s/README.md` — Kubernetes сценарий.

---

## 🛡️ Безопасность

- Никогда не коммитьте `.env` и секреты.
- Для production используйте длинный `JWT_SECRET`.
- Ограничьте доступ к PostgreSQL из внешней сети.
- Обязательно включите TLS на домене (Caddy/Nginx/Traefik/Cloudflare).

---

## 📄 License

MIT — см. [LICENSE](./LICENSE).
