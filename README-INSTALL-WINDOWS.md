# AfterLight — БД пакет (Prisma) v0.1 — Windows & GitHub Desktop

Этот пакет добавляет Prisma-схему и NestJS-провайдер в `apps/api`. Ниже — шаги **без командной строки**.

## Что внутри
- `apps/api/prisma/schema.prisma` — схема БД
- `apps/api/prisma/seed.ts` — сиды
- `apps/api/src/prisma/prisma.module.ts`, `prisma.service.ts` — модуль и сервис
- `.github/workflows/db-migrate.yml` — опционально: workflow для прогонки миграций из UI
- `PATCH-package.json.txt` — что добавить в `apps/api/package.json`

## Как добавить в репозиторий (GitHub Desktop)
1. Скачайте ZIP, распакуйте.
2. Откройте **GitHub Desktop** → выберите репозиторий `afterlight`.
3. Откройте проводник Windows и **перетащите** папки/файлы из архива **в папку репозитория** так, чтобы структура стала:

   - `apps/api/prisma/schema.prisma`

   - `apps/api/prisma/seed.ts`

   - `apps/api/src/prisma/prisma.module.ts`

   - `apps/api/src/prisma/prisma.service.ts`

   - (опц.) `.github/workflows/db-migrate.yml`

4. В GitHub Desktop появятся изменения. Введите сообщение коммита, например: `chore(db): add prisma schema` → **Commit to main** → **Push origin**.

## Что дальше (без терминала)
### Вариант A: просто хранить схему сейчас
- Ничего не запускаем. API продолжит собираться в CI как раньше. К миграциям вернёмся, когда появится БД.

### Вариант B: прогон миграции через GitHub Actions (без консоли)
1. Создайте (или получите) строку подключения к PostgreSQL (например, в Yandex Managed PostgreSQL).
2. В GitHub репозитории откройте **Settings → Secrets and variables → Actions → New repository secret**:

   - Name: `DATABASE_URL`

   - Value: `postgresql://USER:PASS@HOST:5432/afterlight?schema=public`

3. Убедитесь, что файл `.github/workflows/db-migrate.yml` лежит в репозитории (он внутри ZIP).
4. Зайдите во вкладку **Actions** → выберите **DB Migrate** → **Run workflow** → укажите `migrate name` (например, `init_schema`) → **Run**.

   Workflow сам выполнит `prisma generate` и `prisma migrate deploy`.

5. Для сидов есть отдельная ручная задача **DB Seed**.

## FAQ
- **Нужно ли менять `apps/api/package.json`?** Желательно. Откройте файл в GitHub и по образцу из `PATCH-package.json.txt` добавьте:

  - в `dependencies`: `"@prisma/client"`

  - в `devDependencies`: `"prisma"`, `"ts-node"`

  - в `scripts`: `prisma:generate`, `prisma:migrate:dev`, `seed`

- **Локально без терминала не получится запустить `npx prisma`** — это нормально, миграции запускаем через Actions.
