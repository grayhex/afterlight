# Установка и деплой на VPS (Ubuntu + k3s)

Ниже — минимальный, но безопасный способ развернуть Afterlight на **одном VPS** с Ubuntu 22.04+/24.04 и **k3s** (single‑node). Без облачного провайдера.

> Кратко: настраиваем сервер → ставим k3s + Helm → на хосте поднимаем PostgreSQL → на k3s выкатываем API, Ingress и TLS от Let’s Encrypt.

---

## Предварительные требования
- VPS с Ubuntu 22.04/24.04 LTS: **2–4 vCPU, 4–8 GB RAM, 60+ GB SSD**.
- Домен, например `api.example.com` → **A‑запись** на публичный IP VPS.
- Учетка sudo‑пользователя с доступом по **SSH‑ключу** (без пароля).
- Токен для скачивания образа, если контейнер в приватном GHCR (опционально).

---

## 1) Базовая подготовка и безопасность

1. Обновления и утилиты:
   ```bash
   sudo apt update && sudo apt -y upgrade
   sudo apt install -y ca-certificates curl git ufw fail2ban jq
   sudo apt install -y unattended-upgrades
   sudo dpkg-reconfigure -plow unattended-upgrades
   ```

2. SSH‑усиление (опционально, но рекомендуется):
   ```bash
   # Отключить вход root'ом и пароли
   sudo sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
   sudo sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
   sudo systemctl reload ssh
   ```

3. Брандмауэр UFW:
   ```bash
   sudo ufw default deny incoming
   sudo ufw default allow outgoing
   sudo ufw allow 22/tcp
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   sudo ufw enable
   sudo ufw status
   ```

4. Fail2Ban по умолчанию уже защищает SSH (профиль `sshd`).

---

## 2) Установка k3s (single‑node)

```bash
curl -sfL https://get.k3s.io | sh -s -
# дождитесь, затем проверьте:
sudo kubectl get nodes
# kubeconfig доступен как /etc/rancher/k3s/k3s.yaml (чтение под root)
# добавьте удобную копию для текущего пользователя:
mkdir -p ~/.kube && sudo cp /etc/rancher/k3s/k3s.yaml ~/.kube/config && sudo chown $(id -u):$(id -g) ~/.kube/config
kubectl get ns
```

k3s включает `containerd`, `kubectl`, Ingress‑контроллер **Traefik** и local‑storage провижионер.

---

## 3) Установка Helm и cert‑manager

1. Helm:
   ```bash
   curl -fsSL https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
   helm version
   ```

2. cert‑manager (для Let’s Encrypt):
   ```bash
   kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.15.0/cert-manager.crds.yaml
   helm repo add jetstack https://charts.jetstack.io
   helm repo update
   helm upgrade --install cert-manager jetstack/cert-manager      --namespace cert-manager --create-namespace      --version v1.15.0
   kubectl -n cert-manager get pods
   ```

3. ClusterIssuer (замените e‑mail на ваш). Сначала можно применить **staging**, потом **prod**:
   ```yaml
   # cluster-issuer-staging.yaml
   apiVersion: cert-manager.io/v1
   kind: ClusterIssuer
   metadata:
     name: letsencrypt-staging
   spec:
     acme:
       email: you@example.com
       server: https://acme-staging-v02.api.letsencrypt.org/directory
       privateKeySecretRef:
         name: letsencrypt-staging
       solvers:
       - http01:
           ingress:
             class: traefik
   ---
   # cluster-issuer-prod.yaml
   apiVersion: cert-manager.io/v1
   kind: ClusterIssuer
   metadata:
     name: letsencrypt-prod
   spec:
     acme:
       email: you@example.com
       server: https://acme-v02.api.letsencrypt.org/directory
       privateKeySecretRef:
         name: letsencrypt-prod
       solvers:
       - http01:
           ingress:
             class: traefik
   ```

   ```bash
   kubectl apply -f cluster-issuer-staging.yaml
   kubectl apply -f cluster-issuer-prod.yaml
   ```

---

## 4) PostgreSQL на хосте (вне k3s)

Так проще управлять бэкапами и обновлениями. Поды будут ходить в БД по внутреннему IP узла.

1. Установка PostgreSQL:
   ```bash
   sudo apt install -y postgresql postgresql-contrib
   psql --version
   ```

2. Настройка слушателя и доступов:
   ```bash
   # /etc/postgresql/*/main/postgresql.conf
   # найдите и измените:
   # listen_addresses = '0.0.0.0'
   sudo sed -i "s/^#\?listen_addresses.*/listen_addresses = '0.0.0.0'/" /etc/postgresql/*/main/postgresql.conf

   # /etc/postgresql/*/main/pg_hba.conf
   # добавьте строчку для сети подов k3s (по умолчанию 10.42.0.0/16):
   echo 'host all all 10.42.0.0/16 scram-sha-256' | sudo tee -a /etc/postgresql/*/main/pg_hba.conf

   sudo systemctl restart postgresql
   ```

3. Ограничим порт 5432 только для сети подов:
   ```bash
   # Запрет на всё:
   sudo ufw deny 5432/tcp
   # Разрешаем только k3s pod-cidr и localhost (локалхост не проходит через UFW, это норм):
   sudo ufw allow from 10.42.0.0/16 to any port 5432 proto tcp
   sudo ufw status
   ```

4. Создание БД/пользователя (задайте свой надёжный пароль):
   ```bash
   sudo -u postgres psql -c "CREATE USER afterlight WITH PASSWORD 'CHANGE_ME_STRONG';"
   sudo -u postgres psql -c "CREATE DATABASE afterlight OWNER afterlight;"
   ```

5. (Опционально) Простой ежедневный бэкап:
   ```bash
   sudo mkdir -p /var/backups/afterlight && sudo chown postgres:postgres /var/backups/afterlight
   echo '0 3 * * * postgres pg_dump -Fc -d afterlight > /var/backups/afterlight/afterlight-$(date +\%F).dump' | sudo tee /etc/cron.d/afterlight-backup
   sudo systemctl restart cron
   ```

> Подам в k3s понадобится адрес ноды VPS. Узнайте его: `ip -4 addr` → обычно это публичный IP интерфейса `eth0`.

---

## 5) Namespace, секреты и конфигурация в k3s

1. Namespace:
   ```bash
   kubectl create namespace afterlight
   ```

2. Секреты и конфиги (замените значения на свои):
   ```yaml
   # afterlight-secrets.yaml
   apiVersion: v1
   kind: Secret
   metadata:
     name: afterlight-secrets
     namespace: afterlight
   type: Opaque
   stringData:
     DATABASE_URL: "postgresql://afterlight:CHANGE_ME_STRONG@<VPS_NODE_IP>:5432/afterlight?sslmode=disable"
     JWT_SECRET: "CHANGE_ME_LATER"
     DEFAULT_DEBUG_USER: "you@example.com"
   ---
   # afterlight-config.yaml
   apiVersion: v1
   kind: ConfigMap
   metadata:
     name: afterlight-config
     namespace: afterlight
   data:
     NODE_ENV: "production"
     PORT: "3000"
     SWAGGER_ENABLED: "true"
   ```

   ```bash
   kubectl apply -f afterlight-secrets.yaml
   kubectl apply -f afterlight-config.yaml
   ```

3. (Если образ приватный в GHCR) доступ к реестру:
   ```bash
   kubectl -n afterlight create secret docker-registry ghcr      --docker-server=ghcr.io      --docker-username=GITHUB_USERNAME      --docker-password=GITHUB_TOKEN_WITH_PACKAGES_READ
   ```

---

## 6) Миграции БД (Prisma)

В репозитории может быть Job для миграций. Если нет — выполните одноразовый pod (замените образ на актуальный тег):

```bash
kubectl -n afterlight run migrate --rm -it   --image=ghcr.io/grayhex/afterlight:main   --restart=Never --command -- sh -lc 'npx prisma migrate deploy'
```

Убедитесь, что команда завершилась успешно.

---

## 7) Деплой API и публикация через Ingress

1. Deployment и Service (пример минимального манифеста):
   ```yaml
   # afterlight-deploy.yaml
   apiVersion: apps/v1
   kind: Deployment
   metadata:
     name: afterlight-api
     namespace: afterlight
   spec:
     replicas: 1
     selector:
       matchLabels:
         app: afterlight-api
     template:
       metadata:
         labels:
           app: afterlight-api
       spec:
         # если нужен доступ к приватному GHCR, раскомментируйте:
         # imagePullSecrets:
         # - name: ghcr
         containers:
         - name: api
           image: ghcr.io/grayhex/afterlight:main
           imagePullPolicy: IfNotPresent
           envFrom:
           - secretRef:
               name: afterlight-secrets
           - configMapRef:
               name: afterlight-config
           ports:
           - containerPort: 3000
           readinessProbe:
             httpGet:
               path: /healthz
               port: 3000
             initialDelaySeconds: 5
             periodSeconds: 10
           livenessProbe:
             httpGet:
               path: /healthz
               port: 3000
             initialDelaySeconds: 15
             periodSeconds: 20
   ---
   apiVersion: v1
   kind: Service
   metadata:
     name: afterlight-api
     namespace: afterlight
   spec:
     type: ClusterIP
     selector:
       app: afterlight-api
     ports:
     - port: 80
       targetPort: 3000
   ```

   ```bash
   kubectl apply -f afterlight-deploy.yaml
   kubectl -n afterlight get pods -w
   ```

2. Ingress с TLS (замените домен на ваш, сначала можно указать `letsencrypt-staging`):
   ```yaml
   # afterlight-ingress.yaml
   apiVersion: networking.k8s.io/v1
   kind: Ingress
   metadata:
     name: afterlight-api
     namespace: afterlight
     annotations:
       kubernetes.io/ingress.class: traefik
       cert-manager.io/cluster-issuer: letsencrypt-prod
   spec:
     tls:
     - hosts:
       - api.example.com
       secretName: afterlight-tls
     rules:
     - host: api.example.com
       http:
         paths:
         - path: /
           pathType: Prefix
           backend:
             service:
               name: afterlight-api
               port:
                 number: 80
   ```

   ```bash
   kubectl apply -f afterlight-ingress.yaml
   kubectl -n afterlight get ingress
   ```

   Проверьте, что A‑запись домена указывает на IP VPS. Через 1–2 минуты откройте:
   - `https://api.example.com/healthz`
   - `https://api.example.com/docs` (Swagger)

---

## 8) Обновления и CI/CD

- **Обновить образ**: смените тег в Deployment и `kubectl apply -f afterlight-deploy.yaml`.
- **GitHub Actions**: настройте сборку и публикацию образа в GHCR на каждый push в `main`, затем `kubectl rollout restart deploy/afterlight-api -n afterlight` (или задайте новый тег).

---

## 9) Роли и авторизация

В системе используются роли:
- **Owner** — создаёт и управляет сейфами.
- **Verifier** — подтверждает события, связанные с сейфом.
- **Recipient** — получает данные из сейфа после подтверждения.
- **Admin** — управляет сервисом через админ‑панель `/adm`.

### Перезапуск seed
Для повторного заполнения БД запустите workflow `seed`:
```bash
gh workflow run seed -f confirm=prod
```

### Basic-auth
Доступ к `/adm` защищён Basic‑auth. Формат заголовка:

```
Authorization: Basic <base64(email:password)>
```

Используйте email и пароль администратора из таблицы `user` (поле `role` = `Admin`).

---

## 10) Траблшутинг

- Проверка k3s: `sudo journalctl -u k3s -f`, `kubectl get events -A`.
- Сертификаты: `kubectl -n cert-manager logs deploy/cert-manager -f`.
- Приложение: `kubectl -n afterlight logs deploy/afterlight-api -f`.
- PostgreSQL: `sudo journalctl -u postgresql -f`, `psql -h <VPS_NODE_IP> -U afterlight -d afterlight`.

---

### Готово
Бэкенд доступен по вашему домену, Swagger — на `/docs`. Дальше можно:
- включить `letsencrypt-prod` (если стартовали со staging);
- ужесточить UFW/Fail2Ban политики;
- подключить удалённые бэкапы БД (S3) и мониторинг (Prometheus/Grafana или netdata).
