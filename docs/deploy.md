# AfterLight — Deploy (API + WEB) на k3s (VDS) с GHCR

Цель: собрать Docker‑образы из CI, запушить в GHCR, задеплоить в k3s (Traefik). Namespace: **afterlight**.

## 0. Предпосылки
- DNS: `api.afterl.ru`, `app.afterl.ru` указывают на VDS.
- k3s установлен (Traefik ingress по умолчанию).
- Внешний PostgreSQL доступен.
- Репозиторий публичный; GHCR доступен по GITHUB_TOKEN.

## 1. CI → GHCR
Workflows:
- `.github/workflows/docker-api.yml` → `ghcr.io/<owner>/afterlight-api:latest`
- `.github/workflows/docker-web.yml` → `ghcr.io/<owner>/afterlight-web:latest`

Для WEB требуется Next `output: 'standalone'` в `apps/web/next.config.mjs`.

## 2. Namespace и секреты
```bash
kubectl create namespace afterlight || true
kubectl -n afterlight create secret generic api-secrets \
  --from-literal=DATABASE_URL='postgresql://user:pass@db-host:5432/afterlight?schema=public' \
  --from-literal=JWT_SECRET='please-change-me' \
  --dry-run=client -o yaml | kubectl apply -f -
```

## 3. API
```bash
kubectl apply -n afterlight -f https://raw.githubusercontent.com/grayhex/afterlight/main/k8s/base/api-configmap.yaml
kubectl apply -n afterlight -f https://raw.githubusercontent.com/grayhex/afterlight/main/k8s/base/api-deployment.yaml
kubectl apply -n afterlight -f https://raw.githubusercontent.com/grayhex/afterlight/main/k8s/base/api-service.yaml
kubectl apply -n afterlight -f https://raw.githubusercontent.com/grayhex/afterlight/main/k8s/base/api-ingress.yaml
kubectl apply -n afterlight -f https://raw.githubusercontent.com/grayhex/afterlight/main/k8s/base/migrate-job.yaml
kubectl -n afterlight logs job/prisma-migrate -f
```

## 4. WEB
```bash
kubectl apply -n afterlight -f https://raw.githubusercontent.com/grayhex/afterlight/main/k8s/base/web-configmap.yaml
kubectl apply -n afterlight -f https://raw.githubusercontent.com/grayhex/afterlight/main/k8s/base/web-deployment.yaml
kubectl apply -n afterlight -f https://raw.githubusercontent.com/grayhex/afterlight/main/k8s/base/web-service.yaml
kubectl apply -n afterlight -f https://raw.githubusercontent.com/grayhex/afterlight/main/k8s/base/web-ingress.yaml
```

Проверка:
```bash
kubectl -n afterlight rollout status deploy/afterlight-web
kubectl -n afterlight get deploy afterlight-web -o jsonpath='{.spec.template.spec.containers[0].image}{"\n"}'
kubectl -n afterlight get pods -l app=afterlight-web -o wide
kubectl -n afterlight logs deploy/afterlight-web --tail=100
```

## 5. CORS (API)
```ts
app.enableCors({
  origin: [/^https?:\/\/(localhost:\d+|app\.afterl\.ru)$/],
  allowedHeaders: ['Content-Type', 'x-user-id', 'Authorization'],
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
});
```

## 6. Smoke‑тест (Playground)
1) POST /vaults → vaultId  
2) POST /recipients → recipientId  
3) POST /blocks (multipart) → blockId  
4) POST /blocks/{id}/recipients  
5) POST /orchestration/start  
6) POST /orchestration/decision (Confirm) до кворума  
7) (опц.) PUT /blocks/{id}/public

## 7. Обновление/роллбэк
- Обновить: push в main → новый `:latest` → `kubectl -n afterlight rollout restart deploy/afterlight-web`
- Роллбэк: `kubectl -n afterlight rollout undo deploy/afterlight-web`

## 8. Как запускать сид
Сид запускается вручную через workflow `seed` с подтверждением `prod`.
