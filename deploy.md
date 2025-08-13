# AfterLight — Deploy (k3s on VDS, GHCR)

Цель: собрать Docker‑образы **API** и **WEB**, запушить в **GHCR**, задеплоить в **k3s** (Traefik Ingress), выполнить миграции и пройти smoke через Playground.

---

## 0. Предпосылки
- Домены: `api.afterl.ru` и `app.afterl.ru` указывают на VDS.
- На VDS установлен **k3s** (Ingress = Traefik по умолчанию).
- Внешний PostgreSQL/Managed PG доступен и создана БД `afterlight`.
- Репозиторий: публичный `grayhex/afterlight` (GHCR доступен по GITHUB_TOKEN).

---

## 1. CI → GHCR
В репозитории два workflow:
- `.github/workflows/docker-api.yml` → образ `ghcr.io/<owner>/afterlight-api:latest`
- `.github/workflows/docker-web.yml` → образ `ghcr.io/<owner>/afterlight-web:latest`

> WEB собирается через **Next.js standalone**. Убедитесь, что в `apps/web/next.config.mjs`:
```js
/** @type {{}} */
const nextConfig = { output: 'standalone' };
export default nextConfig;
```

Push в `main` запускает сборку и пуш в GHCR.

---

## 2. Namespace и секреты
Один раз:
```bash
kubectl create namespace afterlight-staging || true

kubectl -n afterlight-staging create secret generic api-secrets   --from-literal=DATABASE_URL='postgresql://user:pass@db-host:5432/afterlight?schema=public'   --from-literal=JWT_SECRET='please-change-me'   --dry-run=client -o yaml | kubectl apply -f -
```

---

## 3. API
Примените конфиги/деплой/сервис/ингресс (см. `k8s/base/*api*.yaml`):
```bash
kubectl apply -f k8s/base/api-configmap.yaml
kubectl apply -f k8s/base/api-deployment.yaml
kubectl apply -f k8s/base/api-service.yaml
kubectl apply -f k8s/base/api-ingress.yaml
```

Миграции Prisma:
```bash
kubectl apply -f k8s/base/migrate-job.yaml
kubectl -n afterlight-staging logs job/prisma-migrate -f
```

Проверки: https://api.afterl.ru/healthz , /readyz

---

## 4. WEB (Next.js)
В репозиторий добавлены:
- `Dockerfile.web`
- `.github/workflows/docker-web.yml`
- `k8s/base/web-configmap.yaml`
- `k8s/base/web-deployment.yaml`
- `k8s/base/web-service.yaml`
- `k8s/base/web-ingress.yaml`

Деплой:
```bash
kubectl apply -f k8s/base/web-configmap.yaml
kubectl apply -f k8s/base/web-deployment.yaml
kubectl apply -f k8s/base/web-service.yaml
kubectl apply -f k8s/base/web-ingress.yaml
```

Проверка: https://app.afterl.ru/  и https://app.afterl.ru/playground

> CORS на API должен разрешать `app.afterl.ru`:
```ts
app.enableCors({
  origin: [/^https?:\/\/(localhost:\\d+|app\.afterl\.ru)$/],
  allowedHeaders: ['Content-Type', 'x-user-id', 'Authorization'],
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
});
```

---

## 5. Smoke сценарий (Playground)
1. POST /vaults → сохранить id как `vaultId`.
2. POST /recipients → `recipientId`.
3. POST /blocks (multipart) → `blockId`.
4. POST /blocks/{id}/recipients.
5. (опц.) POST /verifiers/invitations.
6. POST /orchestration/start.
7. POST /orchestration/decision (Confirm) до кворума.
8. (опц.) PUT /blocks/{id}/public.

---

## 6. Полезное
- **404 /playground** — убедитесь, что файл `apps/web/app/playground/page.tsx` в сборке образа (присутствует в репозитории), а образ `afterlight-web` обновлён.
- **NEXT_PUBLIC_*** — инлайнится при билде фронта. В `web-configmap.yaml` значения дублируем для SSR и сохраняем дефолт в коде.
- **Traefik** — для NGINX просто смените аннотацию: `kubernetes.io/ingress.class: nginx`.
- **Rollout**: `kubectl rollout restart deploy/afterlight-web -n afterlight-staging` и аналогично для API.
