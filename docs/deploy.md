# 🚀 Afterlight — Production Deploy Guide (VPS / Dedicated Server)

> Актуально для **Ubuntu 22.04/24.04** и Docker Compose.
> Цель: запустить Afterlight (API + Web + Postgres) на вашем сервере с автоперезапуском и healthcheck.

---

## 1) Что будет развернуто

- `afterlight-db` — PostgreSQL 16
- `afterlight-api` — NestJS API (`:3000` внутри сети)
- `afterlight-web` — Next.js SSR (`:3000` внутри сети, проброшен наружу)
- `afterlight-migrate` — одноразовый job для миграций Prisma

Схема трафика:

```text
Internet -> Server:80 -> afterlight-web -> afterlight-api -> afterlight-db
```

---

## 2) Подготовка сервера

```bash
sudo apt update
sudo apt install -y ca-certificates curl gnupg

# Docker Engine + Compose plugin
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker

docker --version
docker compose version
```

---

## 3) Развёртывание проекта

```bash
git clone <YOUR_REPO_URL> afterlight
cd afterlight
cp .env.example .env
```

Откройте `.env` и обязательно замените:

- `DATABASE_URL`
- `JWT_SECRET` (длинный случайный ключ)
- `CORS_ALLOWED_ORIGINS` (ваш домен)
- `NEXT_PUBLIC_API_URL` (URL API, видимый фронту)

Рекомендуемый production-пример:

```env
DATABASE_URL="postgresql://afterlight:CHANGE_ME_STRONG@db:5432/afterlight?schema=public"
JWT_SECRET="CHANGE_ME_LONG_RANDOM_64_CHARS_MIN"
NODE_ENV="production"
PORT=3000
CORS_ALLOWED_ORIGINS="https://app.example.com"
JSON_BODY_LIMIT="100kb"
NEXT_PUBLIC_API_URL="https://api.example.com"
POSTGRES_DB="afterlight"
POSTGRES_USER="afterlight"
POSTGRES_PASSWORD="CHANGE_ME_STRONG"
WEB_PORT=80
```

---

## 4) Первый запуск

```bash
# 1) Собрать и поднять базовые сервисы
docker compose -f docker-compose.server.yml up -d --build db api web

# 2) Прогнать миграции
# (job завершится с кодом 0)
docker compose -f docker-compose.server.yml run --rm migrate

# 3) Проверить статус
docker compose -f docker-compose.server.yml ps
curl -f http://127.0.0.1:${WEB_PORT:-80}/ || true
curl -f http://127.0.0.1:${WEB_PORT:-80}/api/healthz || true
```

---

## 5) Обновление приложения

```bash
git pull
docker compose -f docker-compose.server.yml up -d --build api web
docker compose -f docker-compose.server.yml run --rm migrate
```

---

## 6) Резервное копирование базы

```bash
mkdir -p backups
docker exec afterlight-db pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > backups/afterlight_$(date +%F).sql
```

---

## 7) HTTPS (рекомендовано)

Варианты:
- Caddy / Nginx Proxy Manager / Traefik на сервере.
- Cloudflare Tunnel.

Минимум для production:
- включить TLS;
- ограничить доступ к `:5432` снаружи;
- хранить `.env` только на сервере;
- регулярно обновлять образы и ОС.

---

## 8) Быстрая диагностика

```bash
docker compose -f docker-compose.server.yml logs --tail=100 web
docker compose -f docker-compose.server.yml logs --tail=100 api
docker compose -f docker-compose.server.yml logs --tail=100 db
```

Health endpoints API:
- `/healthz`
- `/readyz`
- `/docs`
