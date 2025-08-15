# AfterLight — Web (wireframes, Next.js)
Кликабельный прототип без бэкенда. Размещается в `apps/web` и **не влияет** на текущий CI (который строит только `apps/api`).

## Как добавить в репозиторий
1. Распакуйте архив и поместите всю папку `apps/web` в корень репозитория.
2. Commit: `feat(web): add nextjs wireframes` → Push.
3. Локальный запуск (если нужно):
   ```bash
   cd apps/web
   npm i
   npm run dev
   # http://localhost:3001
   ```

## Навигация
- `/` — приветствие
- `/wireframes` — хаб со ссылками
- `/wireframes/owner` — кабинет владельца (заглушка)
- `/wireframes/verifier` — кабинет верификатора (заглушка)
- `/wireframes/recipient` — вид получателя (заглушка)

Tailwind уже подключён; UI — условный, с акцентом на структуру и потоки.
