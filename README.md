# AfterLight

> Платформа, которая помогает человеку заранее подготовить **приватную информацию** для близких и **безопасно** раскрывает её после наступления события (модель **N‑из‑M** верификаторов + **heartbeat** + **grace**).

![logo](https://github.com/grayhex/afterlight/blob/main/logo.jpg)

## Стек

- **API:** NestJS + Prisma (PostgreSQL), Swagger `/docs`
- **Web:** Next.js (PWA), Tailwind — кликабельные вайрфреймы
- **Crypto:** клиентское шифрование (AES‑GCM/XChaCha20‑Poly1305, Ed25519), zero‑knowledge
- **CI:** GitHub Actions (Prisma validate/generate, `nest build`)

## Структура репозитория

```
apps/
  api/        # NestJS API
  web/        # Next.js wireframes (кликабельный прототип)
docs/
  api/            # OpenAPI, REST-контракты
  architecture/   # C4, ERD
  prd/ srs/ ops/  # продукт/требования/операции
.github/workflows/
```

---

## Roadmap (обновлено)

### MVP — базовые фичи
- [x] Prisma schema + Prisma Client
- [x] API модули: `vaults`, `verifiers`, `verification-events`
- [x] Swagger `/docs`, DTO‑валидация
- [x] CI: `prisma validate/generate` + `nest build`
- [x] Blocks API (метаданные, назначение получателей)
- [x] Вайрфреймы (Next.js) `/wireframes`
- [x] Recipients API (создание/поиск получателей)
- [x] Public Links (permalink + окно публикации)
- [x] Heartbeat (сущность + обработчик)
- [x] Оркестрация статусов `Submitted → Confirming/Disputed → QuorumReached → Grace → Finalized`
- [x] Email‑нотификации (MVP)

### MVP — **Minimal Working State (Staging Smoke)**
- [ ] Health‑эндпоинт `/healthz` (простой OK) + readiness/liveness пробы
- [ ] Dockerfile (`apps/api/Dockerfile`) и сборка образа в GHCR
- [ ] K8s манифесты: Namespace, Secret, ConfigMap, Job `prisma migrate deploy`, Deployment, Service, Ingress
- [ ] GitHub Actions: workflow сборки образа и деплоя в `staging`
- [ ] ENV‑провайдинг: `DATABASE_URL`, `DEFAULT_DEBUG_USER`, (позже `JWT_SECRET`)
- [ ] Smoke‑тест: создать сейф → пригласить верификатора → старт события → подтверждение → создать блок‑метаданные

### M1
- [ ] Аутентификация (JWT) + 2FA (TOTP); Passkeys — опционально
- [ ] Primary Verifier (тайбрейкер)
- [ ] Полный dry‑run (демо‑раскрытие без контента)
- [ ] Audit Log + метрики (Prometheus/Grafana)
- [ ] S3‑хранилище для зашифрованных blob‑ов (обёртка DEK, upload URLs)

### M2
- [ ] Доказательства/модерация (Evidence)
- [ ] Telegram‑бот (нотификации)
- [ ] Поддержка‑инициированное раскрытие (ручной процесс)
- [ ] KYC уровни для верификаторов (None/Basic/Enhanced)
- [ ] Расширенная аналитика/отчёты в админке

---

## Локальный запуск (dev)

**Требования:** Node 20+, npm 10+, PostgreSQL (локально)

```bash
# API
cd apps/api
npm i
# .env (apps/api/.env) — пример:
# DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/afterlight?schema=public"
npx prisma generate
# при наличии БД: npx prisma migrate dev
npm run start:dev
# Swagger: http://localhost:3000/docs

# Вайрфреймы (если директория apps/web добавлена)
cd ../web
npm i
npm run dev  # http://localhost:3001
```

> В CI для `validate/generate` используется фейковый `DATABASE_URL` — настоящий нужен только при миграциях/демо.

---

## Yandex Cloud — минимальные ресурсы для **staging** (shopping list)

Цель: дешёвый, но реальный стенд для деплоя, миграций и smoke‑теста. Без S3/ботов/KMS на первом шаге (их легко добавить позже).

### 1) VPC (сеть)
- 1 VPC
- 1 публичная подсеть (если хотите доступ к нодам/Ingress напрямую) **или** приватная + NAT‑шлюз
- 1 NAT‑шлюз (если подсети приватные) и таблица маршрутов
- Security Groups: разрешение входа на 80/443 для Ingress‑балансировщика; доступ от нод к PG по 5432/6432

### 2) Managed Kubernetes (MKS)
- 1 кластер **staging**, версия Kubernetes 1.27+
- 1 node group: **2 ноды** по **2 vCPU / 4 GB RAM / 40 GB диска** (для старта достаточно)
- Автозамена нод включена; автомасштабирование не обязательно
- Установить через Helm: **NGINX Ingress Controller**
- (опционально) `cert-manager` для автоматических TLS (Let’s Encrypt)

### 3) Managed PostgreSQL
- 1 кластер PostgreSQL 14/15
- **1 хост** (для стейджа достаточно), **2 vCPU / 4 GB RAM / 20–50 GB** SSD
- Включить SSL; выдать строку подключения формата:  
  `postgresql://USER:PASSWORD@HOST:PORT/afterlight?schema=public&sslmode=require`

### 4) Контейнерный реестр
- Используем **GitHub Container Registry (GHCR)** (уже удобнее для нашего CI)  
  - Создать PAT `write:packages`  
  - Добавить секреты репозитория: `GHCR_USERNAME`, `GHCR_TOKEN`  
  - В кластер добавить imagePullSecret для GHCR

*(Альтернатива: Yandex Container Registry — ок, но тогда подключаем авторизацию Workload Identity; можно добавить позже.)*

### 5) Секреты и переменные
- **K8s Secret** `app-secrets` с переменными:  
  - `DATABASE_URL` — строка подключения к PG (с `sslmode=require`)  
  - `DEFAULT_DEBUG_USER` — UUID для временной авторизации на стейдже  
  - *(позже)* `JWT_SECRET`, SMTP‑креды и т. п.
- **K8s ConfigMap** `app-config`: `NODE_ENV=production`, `PORT=3000`, `SWAGGER_ENABLED=true`

### 6) Балансировщик и TLS
- **Ingress‑контроллер NGINX**, сервис типа `LoadBalancer`  
- Домен `api.<ваш‑домен>` → указываем на внешний IP балансировщика  
- TLS: через `cert-manager` (HTTP‑01) **или** через Yandex Certificate Manager (если используете ALB)

### 7) Мониторинг/логи (по минимуму)
- Включить Yandex Monitoring и Logging для кластера  
- Готовность/живость: proby на `/healthz` (см. доработки ниже)

---

## Что доработать в коде для запуска на стейдже (быстро и без ломки)

1) **Health‑контроллер** (Nest)
   - `GET /healthz` → `{ status: 'ok' }`
   - readinessProbe/livenessProbe в Deployment указывают на этот путь

2) **Dockerfile** (`apps/api/Dockerfile`)
   - многостадийная сборка (deps → build → runner)
   - копировать `dist`, `node_modules` и `prisma`

3) **K8s манифесты** (папка `deploy/`)
   - `namespace.yaml`, `secrets.yaml`, `configmap.yaml`
   - `job-migrate.yaml` — `npx prisma migrate deploy`
   - `deployment.yaml` + `service.yaml` + `ingress.yaml`

4) **GitHub Actions (deploy)**  
   - Workflow: build & push образ в GHCR → `kubectl apply -f deploy/` (через kubeconfig/oidc)

> Хочешь — соберу PR‑пакет с HealthController, Dockerfile и `deploy/`‑манифестами, чтобы запустить стенд за вечер.

---

## Smoke‑тест (после деплоя)

1) Открыть `https://api.<домен>/docs` — Swagger грузится.  
2) В `K8s Secret` задать `DEFAULT_DEBUG_USER` = любой UUID.  
3) `POST /vaults` (с заголовком `x-debug-user: <uuid>`) → 201.  
4) `POST /verifiers/invitations` (email) → 201.  
5) `POST /verification-events` → 201, затем `POST /verification-events/{id}/confirm/{verifierId}` → 200.  
6) `POST /blocks` (метаданные) → 201.  
7) Убедиться, что пробы на `/healthz` зелёные, а pod’ы рестартов не набирают.

---

## Безопасность (высокоуровнево)

- Контент — **клиент‑ски зашифрованный** (сервер видит только метаданные).
- Ключи/секреты — пока в Kubernetes Secret; KMS/Lockbox можно подключить на M1.
- Доступ к PG — по VPC/SSL. Ограничить SG, закрыть публичные порты после настройки Runner’а.

## Лицензия

MIT
