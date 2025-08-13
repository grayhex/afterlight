# AfterLight Web — Playground

Минимальный UI для ручного теста API. Доступен по пути `/playground` в приложении Next.js.

## Локальный запуск

```bash
cd apps/web
# у вас может быть pnpm/yarn; пример с npm:
cp .env.local.example .env.local
npm i
npm run dev
# открыть http://localhost:3000/playground
```

## Продовый билд и запуск

```bash
cd apps/web
npm run build
# PORT можно задать через env, по умолчанию 3000
npm run start -- -p 3000
# страница: http://<host>:3000/playground
```

## Деплой на VDS (без Docker)

1. Скопируйте папку `apps/web` (или весь репозиторий) на сервер.
2. Установите Node.js 20 LTS.
3. В `apps/web/.env.local` задайте:
```
NEXT_PUBLIC_API_BASE=https://api.afterl.ru
NEXT_PUBLIC_DEFAULT_USER_ID=00000000-0000-4000-8000-000000000001
```
4. Соберите и запустите в экранном/сервисном режиме (pm2/systemd):
```bash
cd apps/web
npm ci || npm i
npm run build
# pm2:
pm2 start npm --name afterlight-web -- run start -- -p 3000
pm2 save
```
5. Настройте Nginx (пример):
```
server {
    server_name app.afterl.ru;
    listen 80;
    location / {
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_pass http://127.0.0.1:3000;
    }
}
```
6. Перейдите в браузере на `https://app.afterl.ru/playground` (или ваш домен/порт).

## Важно
- На API должен быть включён CORS для домена фронта.
- Заголовок `x-user-id` используется Playground вместо полноценной аутентификации.