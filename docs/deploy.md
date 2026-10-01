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
- `WEB_BASE_URL` (внешний адрес веба, например `https://app.example.com`: он попадает в ссылки-приглашения в письмах; в production без него API не стартует)
- `COOKIE_SECURE=false` — только если стенд работает по http (например, в LAN); за HTTPS оставьте пустым

Адрес API для web задавать не нужно: в `docker-compose.server.yml` web проксирует `/api/*` в `http://api:3000` (`API_INTERNAL_URL`). Не ставьте в `.env` `API_INTERNAL_URL=http://localhost:3000`.

Рекомендуемый production-пример:

```env
DATABASE_URL="postgresql://afterlight:CHANGE_ME_STRONG@db:5432/afterlight?schema=public"
JWT_SECRET="CHANGE_ME_LONG_RANDOM_64_CHARS_MIN"
NODE_ENV="production"
PORT=3000
CORS_ALLOWED_ORIGINS="https://app.example.com"
JSON_BODY_LIMIT="100kb"
WEB_BASE_URL="https://app.example.com"
POSTGRES_DB="afterlight"
POSTGRES_USER="afterlight"
POSTGRES_PASSWORD="CHANGE_ME_STRONG"
WEB_PORT=80
```

---

## 4) Первый запуск

```bash
# 1) Собрать образы и поднять базу
docker compose -f docker-compose.server.yml build api web migrate
docker compose -f docker-compose.server.yml up -d db

# 2) Прогнать миграции до запуска API (job завершится с кодом 0)
docker compose -f docker-compose.server.yml run --rm migrate

# 3) Поднять API и web
docker compose -f docker-compose.server.yml up -d api web

# 4) Проверить статус
docker compose -f docker-compose.server.yml ps
curl -f http://127.0.0.1:${WEB_PORT:-80}/ || true
curl -f http://127.0.0.1:${WEB_PORT:-80}/api/healthz || true
```

---

## 5) Обновление приложения

```bash
git pull
docker compose -f docker-compose.server.yml build api web migrate
# миграции — до замены API: новый код читает новые колонки и без них отвечает 500
docker compose -f docker-compose.server.yml run --rm migrate
docker compose -f docker-compose.server.yml up -d api web
```

Поэтому по умолчанию каждая миграция должна быть совместима с предыдущей версией API (только добавление: новые колонки с умолчанием, таблицы, индексы; удаление и переименование — отдельным релизом после того, как старый код перестал их использовать). Иначе старый API на время между шагами работает с изменённой схемой.

### Несовместимые миграции

Если совместимость невозможна, миграция помечается первой строкой `-- BREAKING: ...` и вносится в список ниже; тогда **API и web останавливают на время применения**:

```bash
git pull
docker compose -f docker-compose.server.yml build api web migrate
docker compose -f docker-compose.server.yml stop api web
docker compose -f docker-compose.server.yml run --rm migrate
docker compose -f docker-compose.server.yml up -d api web
```

| Миграция | Почему несовместима |
|---|---|
| `20261001180000_recipients_per_vault` (#167) | Получатели становятся записями сейфа, снимается глобальная уникальность контакта: старый API создаёт получателей без сейфа и назначает блоки на неподконтрольные записи. |

Простой на время такой миграции — осознанная цена; для синтетических данных и пилота она допустима, для реальных данных такие изменения планируются заранее (окно обслуживания).

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

### Граничный прокси и адрес клиента (для ограничения частоты, #179)

Ограничение частоты запросов (вход, регистрация, сброс пароля, токены) считает обращения по IP клиента. API получает его из `X-Forwarded-For`, но **только** при явной настройке доверия, иначе клиент мог бы подставить любой адрес:

1. Перед вебом стоит граничный прокси (Caddy/Nginx/Traefik), который **перезаписывает** `X-Forwarded-For` (не дописывает к присланному клиентом). Nginx: `proxy_set_header X-Forwarded-For $remote_addr;`. Caddy (`reverse_proxy`) по умолчанию задаёт его сам.
2. Прямой доступ к web снаружи закрыт (файрвол или публикация порта только на `127.0.0.1`).
3. В `.env`: `TRUST_EDGE_PROXY=true` (web передаёт `X-Forwarded-For` в API) и `TRUST_PROXY=uniquelocal` (API доверяет web из приватной сети docker).

Без этих настроек присланные клиентом заголовки адреса отбрасываются, а для API все пользователи выглядят одним адресом (web): лимиты по IP становятся общими, и один злоумышленник может исчерпать, например, окно неудачных входов для всех. Для стенда это допустимо, для пилота — нет. Пороги меняются переменными `RATE_LIMIT_<ИМЯ>_MAX` и `RATE_LIMIT_<ИМЯ>_WINDOW_SEC` (`.env.example`).

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
