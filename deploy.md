# afterlight — deploy.md

Инструкция по обновлению и деплою API для проекта **afterlight**  
**Домен:** `api.afterl.ru`  
**Сервер / k3s-нода:** `89.110.97.90`  
**Kubernetes Namespace:** `afterlight`  
**Контейнерный образ:** `ghcr.io/grayhex/afterlight-api` (теги: `latest`, `main`, а также иммутабельный тег по SHA коммита)

---

## 0) Предпосылки (сделано один раз)

- На сервере настроен доступ `kubectl` к k3s от вашего пользователя.
- В кластере установлены:
  - Ingress-контроллер Traefik (ingress class `traefik`).
  - cert-manager с `ClusterIssuer`: `letsencrypt-staging` и `letsencrypt-prod`.
- В namespace `afterlight` созданы:
  - `Secret` **afterlight-secrets** (включая `DATABASE_URL`, `JWT_SECRET`, `DEFAULT_DEBUG_USER` и т. п.).
  - `ConfigMap` **afterlight-config** (включая `HOST=0.0.0.0` и прочие переменные, если нужны).
- Ingress **afterlight-api** настроен на `api.afterl.ru` и аннотирован `cert-manager.io/cluster-issuer=letsencrypt-prod`.
- Deployment **afterlight-api** содержит контейнер `api`, порт 3000 и пробы `/healthz`/`/readyz`.

---

## 1) CI/CD: что делает GitHub Actions

Workflow `.github/workflows/docker-api.yml`:

- Собирает Docker-образ из `Dockerfile.api` (база `node:20-slim`).  
- На этапе сборки выполняет `npx prisma generate --schema=apps/api/prisma/schema.prisma`  
  (в `schema.prisma` зафиксирован `binaryTargets = ["debian-openssl-3.0.x"]`).  
- Публикует образ в GHCR с тегами:
  - `ghcr.io/grayhex/afterlight-api:latest`
  - `ghcr.io/grayhex/afterlight-api:main`
  - `ghcr.io/grayhex/afterlight-api:<FULL_GITHUB_SHA>` ← **иммутабельный артефакт** конкретного коммита.

---

## 2) Обновление приложения в кластере

### Вариант A — быстрый (по тегу `:main`)

Подходит, если в деплое включён `imagePullPolicy: Always`:

```bash
kubectl -n afterlight rollout restart deploy/afterlight-api
kubectl -n afterlight rollout status deploy/afterlight-api
```

### Вариант B — «правильный» (фиксировать образ по SHA)

1) Откройте успешный Action → скопируйте **полный 40-символьный** SHA коммита.  
2) Обновите Deployment на этот тег:

```bash
SHA=<FULL_GITHUB_SHA>
kubectl -n afterlight set image deploy/afterlight-api   api=ghcr.io/grayhex/afterlight-api:${SHA}
kubectl -n afterlight rollout status deploy/afterlight-api
```

> Если роллаут завис, сначала «в ноль», потом обратно:
> ```bash
> kubectl -n afterlight scale deploy/afterlight-api --replicas=0
> kubectl -n afterlight wait --for=delete pod -l app=afterlight-api --timeout=120s
> kubectl -n afterlight scale deploy/afterlight-api --replicas=1
> ```

---

## 3) Работа с БД и миграциями

### Текущий вариант (для пустой/новой БД): `db push`

Если миграций в репозитории ещё нет, можно протолкнуть текущую схему:

```bash
# выполняется внутри контейнера API (рабочая директория /app/apps/api)
kubectl -n afterlight exec -it deploy/afterlight-api --   sh -lc 'npx prisma db push'
```

Или одноразовая Job:

```bash
cat <<'YAML' | kubectl apply -f -
apiVersion: batch/v1
kind: Job
metadata:
  name: prisma-db-push
  namespace: afterlight
spec:
  backoffLimit: 0
  template:
    spec:
      restartPolicy: Never
      containers:
      - name: db-push
        image: ghcr.io/grayhex/afterlight-api:main
        workingDir: /app/apps/api
        command: ["sh","-lc","npx prisma db push"]
        envFrom:
        - secretRef: { name: afterlight-secrets }
        - configMapRef: { name: afterlight-config }
YAML

kubectl -n afterlight logs -f job/prisma-db-push
```

### Рекомендованный вариант на будущее: фиксированные миграции

1) Локально в `apps/api/` создайте миграции и закоммитьте их:
```bash
npx prisma migrate dev --name init --schema=./prisma/schema.prisma
# появится каталог apps/api/prisma/migrations/**/migration.sql
```

2) В проде применяйте миграции так:

```bash
cat <<'YAML' | kubectl apply -f -
apiVersion: batch/v1
kind: Job
metadata:
  name: prisma-migrate
  namespace: afterlight
spec:
  backoffLimit: 0
  template:
    spec:
      restartPolicy: Never
      containers:
      - name: migrate
        image: ghcr.io/grayhex/afterlight-api:main
        workingDir: /app/apps/api
        command: ["sh","-lc","npx prisma migrate deploy"]
        envFrom:
        - secretRef: { name: afterlight-secrets }
        - configMapRef: { name: afterlight-config }
YAML

kubectl -n afterlight logs -f job/prisma-migrate
```

> Если БД уже создана `db push`, первую миграцию можно сгенерировать диффом от пустой схемы и зафиксировать в репозитории.

---

## 4) Smoke‑тесты после выката

```bash
# состояние подов
kubectl -n afterlight get pods -l app=afterlight-api -o wide

# логи приложения
kubectl -n afterlight logs -f deploy/afterlight-api --tail=120

# ingress и сертификат
kubectl -n afterlight get ingress afterlight-api -o wide
kubectl -n afterlight get certificate,order,challenge

# внешние проверки
curl -I https://api.afterl.ru/healthz
curl -I https://api.afterl.ru/docs
```

---

## 5) Откат

```bash
# откат на предыдущий ReplicaSet
kubectl -n afterlight rollout undo deploy/afterlight-api

# либо на конкретный предыдущий образ
kubectl -n afterlight set image deploy/afterlight-api   api=ghcr.io/grayhex/afterlight-api:<PREV_FULL_SHA>
kubectl -n afterlight rollout status deploy/afterlight-api
```

---

## 6) Частые проблемы и решения

**ImagePullBackOff / NotFound**  
— Используйте существующий тег (`:main` или **полный** `:<FULL_SHA>`). Если реестр станет приватным — добавьте `imagePullSecrets` на `ghcr.io` и пропишите в деплой.

**CrashLoopBackOff (Prisma/OpenSSL)**  
— В `apps/api/prisma/schema.prisma` должен быть:
```prisma
generator client { provider = "prisma-client-js"; binaryTargets = ["debian-openssl-3.0.x"] }
```
— В `Dockerfile.api` есть шаг генерации клиента, а в runtime установлены `libssl3` и `ca-certificates`.  
— Рабочая директория контейнера — `/app/apps/api`; путь к схеме — `./prisma/schema.prisma` (или по умолчанию).

**TLS «self-signed» / «unknown CA»**  
— Ingress аннотирован `cert-manager.io/cluster-issuer=letsencrypt-prod`.  
— Ресурсы cert‑manager проверяйте в `-n afterlight`:
```bash
kubectl -n afterlight get certificate,order,challenge
```

**Редирект с `/` на `/docs` (опционально через Traefik)**

```bash
cat <<'YAML' | kubectl apply -f -
apiVersion: traefik.io/v1alpha1
kind: Middleware
metadata:
  name: redirect-to-docs
  namespace: afterlight
spec:
  redirectRegex:
    regex: ^/$
    replacement: /docs
    permanent: true
YAML

kubectl -n afterlight annotate ingress afterlight-api   traefik.ingress.kubernetes.io/router.middlewares=afterlight-redirect-to-docs@kubernetescrd   --overwrite
```

---

## 7) Автодеплой из GitHub Actions (опционально)

1) Сохраните kubeconfig в секрет `KUBECONFIG_B64` (base64 содержимого файла kubeconfig).
2) Добавьте job `deploy` после сборки, который выставит образ по текущему `${{ github.sha }}`:
```yaml
deploy:
  needs: build-and-push
  runs-on: ubuntu-latest
  steps:
    - name: Set up kubectl
      run: |
        echo "$KUBECONFIG_B64" | base64 -d > $HOME/kubeconfig
        chmod 600 $HOME/kubeconfig
    - name: Rollout new image
      env:
        SHA: ${{ github.sha }}
      run: |
        kubectl --kubeconfig $HOME/kubeconfig -n afterlight           set image deploy/afterlight-api api=ghcr.io/grayhex/afterlight-api:${SHA}
        kubectl --kubeconfig $HOME/kubeconfig -n afterlight           rollout status deploy/afterlight-api
```

---

## 8) Полезные команды

```bash
# какой образ сейчас в деплое
kubectl -n afterlight get deploy afterlight-api -o jsonpath='{.spec.template.spec.containers[0].image}'; echo

# события по поду
POD=$(kubectl -n afterlight get pod -l app=afterlight-api -o jsonpath='{.items[0].metadata.name}')
kubectl -n afterlight describe pod "$POD" | sed -n '/Events:/,$p'

# какой бинарь Prisma в образе (должен быть debian-openssl-3.0.x)
kubectl -n afterlight run api-debug --image=ghcr.io/grayhex/afterlight-api:main --restart=Never --command --   sh -lc 'sleep 300'
kubectl -n afterlight exec -it api-debug -- sh -lc   'ls node_modules/.prisma/client | grep libquery_engine'
kubectl -n afterlight delete pod api-debug
```

---

### Контрольная памятка
- Обновляйтесь по **иммутабельным тегам** (`:${SHA}`) или держите `imagePullPolicy: Always`.
- Храните миграции в репозитории и применяйте `migrate deploy`; `db push` — только для первичной пустой БД.
- Ресурсы cert‑manager для домена живут в **namespace приложения** (`afterlight`).

