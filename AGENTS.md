# AGENTS.md

Краткие правила для агентов и разработчиков. Подробности — в `README.md` и эпике #146.

## Структура
- `apps/api` — NestJS + Prisma + PostgreSQL (единый модульный монолит). `apps/web` — Next.js. `k8s/`, `Dockerfile.*` — сборка и деплой.

## Проверки перед PR
API (`apps/api`): `npm ci`, `npx prisma generate`, `npm run typecheck`, `npm run build`, `npm run test:unit`;
при наличии PostgreSQL ещё `npx prisma migrate deploy` и `npm run test:integration` (БД с `test` в имени, см. README).
Web (`apps/web`): `npx tsc --noEmit`, `npm test`, `npm run build`.
В PR указывайте реально выполненные команды и их результат.

## Правила
- Установка зависимостей только по lock-файлу: `npm ci`, без `npm i` и fallback'ов.
- Схема БД меняется только через миграции (`prisma/migrations`), не через `db push/reset`; после изменения `schema.prisma` — миграция и `prisma migrate diff --exit-code` без различий.
- Права проверяются на сервере по сессии и по конкретному сейфу (`VaultAccessService`); `userId` из тела/URL не доверяем.
- Секреты, токены и тела писем не пишем в логи и не отдаём в ответах API; ответы — явные DTO.
- Тесты: unit — с моками (`test/unit`), integration — настоящее приложение и PostgreSQL без подмен guard'ов (`test/integration`). Не выдавайте mock-проверку за E2E, не отключайте и не пропускайте тесты, не маскируйте утечки через `--forceExit`.
- Без merge, деплоя, force-push и удаления веток без отдельного разрешения; для разработки используются только синтетические данные.
