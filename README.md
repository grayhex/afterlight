# AfterLight

> Платформа, которая помогает человеку заранее подготовить **приватную информацию** для близких и **безопасно** раскрывает её после наступления события (модель **N‑из‑M** верификаторов + **heartbeat** + **grace**).

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

## Roadmap

### MVP (текущая работа)
- [x] Prisma schema + Prisma Client
- [x] API модули: `vaults`, `verifiers`, `verification-events`
- [x] Swagger `/docs`, DTO‑валидация
- [x] CI: `prisma validate/generate` + `nest build`
- [x] Вайрфреймы (Next.js) `/wireframes`
- [x] **Blocks API** (метаданные, адресация получателей)
- [ ] **Recipients API**
- [ ] **Public Links** (permalink + окно публикации)
- [ ] **Heartbeat** (сущность + обработчик)
- [ ] Оркестрация статусов `Submitted → Confirming/Disputed → QuorumReached → Grace → Finalized`
- [ ] Email‑нотификации (MVP)

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

## Деплой в облако (Kubernetes, Yandex Cloud)

Ниже — минимально жизнеспособная схема, чтобы поднять стенд «с нуля».

### 1) Ресурсы в YC
- **Kubernetes (MKS):** кластер + node group (2–3 ноды `e2-medium`)
- **PostgreSQL (Managed PG):** v14+, 1–2 хоста для стейджа
- **Object Storage (S3):** бакет для зашифрованных файлов (M1/M2)
- **Lockbox / KMS:** секреты и обёртка ключей (по мере внедрения E2EE)
- **Message Queue:** Yandex Message Queue (SQS‑совместимая) — события верификации/релиза (позже)

> API публикуем через Ingress. Доступ к PG — из VPC/SSL.

### 2) Сборка контейнера и реестр

**Dockerfile** (`apps/api/Dockerfile`):

```dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
EXPOSE 3000
CMD ["node", "dist/main.js"]
```

Публикация в GHCR (рекомендуется): создайте PAT с `write:packages`, добавьте секреты `GHCR_USERNAME`, `GHCR_TOKEN` и соберите образ `ghcr.io/<owner>/afterlight-api:<tag>`.

### 3) Kubernetes манифесты (базовые)

**Namespace**

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: afterlight
```

**Secrets**

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: app-secrets
  namespace: afterlight
type: Opaque
stringData:
  DATABASE_URL: "postgresql://<user>:<pass>@<pg-host>:<port>/<db>?schema=public&sslmode=require"
  JWT_SECRET: "<long-random>"
  DEFAULT_DEBUG_USER: "<uuid-для-dev>"
```

**ConfigMap**

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
  namespace: afterlight
data:
  NODE_ENV: "production"
  PORT: "3000"
  CORS_ORIGIN: "https://your-domain.tld"
  SWAGGER_ENABLED: "true"
```

**Миграции (Job)**

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: prisma-migrate
  namespace: afterlight
spec:
  template:
    spec:
      restartPolicy: Never
      containers:
        - name: migrate
          image: ghcr.io/<owner>/afterlight-api:<tag>
          envFrom:
            - secretRef: { name: app-secrets }
          command: ["npx","prisma","migrate","deploy"]
```

**Deployment + Service**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
  namespace: afterlight
spec:
  replicas: 2
  selector: { matchLabels: { app: api } }
  template:
    metadata: { labels: { app: api } }
    spec:
      containers:
        - name: api
          image: ghcr.io/<owner>/afterlight-api:<tag>
          ports: [{ containerPort: 3000 }]
          envFrom:
            - secretRef: { name: app-secrets }
            - configMapRef: { name: app-config }
          readinessProbe:
            httpGet: { path: /docs, port: 3000 }
            initialDelaySeconds: 10
            periodSeconds: 10
          resources:
            requests: { cpu: "100m", memory: "128Mi" }
            limits: { cpu: "500m", memory: "512Mi" }
---
apiVersion: v1
kind: Service
metadata:
  name: api
  namespace: afterlight
spec:
  selector: { app: api }
  ports: [{ name: http, port: 80, targetPort: 3000 }]
```

**Ingress (Ingress‑NGINX)**

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: api
  namespace: afterlight
  annotations:
    kubernetes.io/ingress.class: nginx
spec:
  tls:
    - hosts: ["api.afterlight.yourdomain"]
      secretName: api-tls
  rules:
    - host: api.afterlight.yourdomain
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: api
                port:
                  number: 80
```

Применение:

```bash
kubectl apply -f namespace.yaml
kubectl apply -f secrets.yaml
kubectl apply -f configmap.yaml
kubectl apply -f job-migrate.yaml
kubectl apply -f deployment.yaml
kubectl apply -f ingress.yaml
```

### 4) Переменные окружения (минимум)
- `DATABASE_URL` — строка подключения к PG (в облаке `sslmode=require`)
- `JWT_SECRET` — секрет для JWT (после внедрения аутентификации)
- `DEFAULT_DEBUG_USER` — временная заглушка для dev
- (позже) SMTP/ESP, S3‑креды, KMS‑параметры

### 5) Обновления схемы
- При изменении `schema.prisma`: локально `npx prisma migrate dev` → PR → образ → в кластере `Job prisma-migrate`.

---

## Безопасность (высокоуровнево)

- Контент — **клиент‑ски зашифрованный** (сервер видит только метаданные).
- Ключи/секреты — в Secret/Lockbox; доступ к PG — по VPC/SSL.
- Верификаторы: минимум 3–5; конфликт → `Disputed` на 24 часа, затем перезапуск.

---

## Вклад (Contributing)

- PR welcome! Соблюдайте линт и формат. Изменения схемы — с миграциями.
- Для вопросов/идей — создавайте Issue с пометкой `[idea]`.

## Лицензия

MIT
