# AfterLight k8s (staging)

Минимальный набор манифестов для запуска API в Kubernetes.

## Шаги

1. **Соберите и запушьте образ** (CI уже настроен: `.github/workflows/docker-api.yml`). Итоговый тег: `ghcr.io/<owner>/afterlight-api:latest`.

2. **Создайте секреты (из шаблона не коммитить):**
```bash
kubectl apply -f k8s/base/namespace.yaml
kubectl -n afterlight-staging create secret generic api-secrets   --from-literal=DATABASE_URL='postgresql://user:pass@db-host:5432/afterlight?schema=public'   --from-literal=JWT_SECRET='please-change-me'
```

3. **Примените конфиг и сервисы:**
```bash
kubectl apply -f k8s/base/api-configmap.yaml
kubectl apply -f k8s/base/api-deployment.yaml
kubectl apply -f k8s/base/api-service.yaml
kubectl apply -f k8s/base/api-ingress.yaml
```

4. **Выполните миграции:**
```bash
kubectl apply -f k8s/base/migrate-job.yaml
kubectl -n afterlight-staging logs job/prisma-migrate -f
```

5. **Засидите базу (опционально):**
```bash
JOB=$(kubectl -n afterlight-staging create -f k8s/job-prisma-seed.yaml -o jsonpath='{.metadata.name}')
kubectl -n afterlight-staging wait --for=condition=complete job/$JOB
kubectl -n afterlight-staging logs job/$JOB --all-containers
```

6. **Проверка:**
- `GET https://staging.afterlight.example/healthz` → `{ status: "ok" }`
- `GET https://staging.afterlight.example/readyz` → `{ status: "ready" }`

> В Яндекс.Облаке можно использовать Ingress NGINX или ALB Ingress Controller — подмените аннотации/IngressClass.
