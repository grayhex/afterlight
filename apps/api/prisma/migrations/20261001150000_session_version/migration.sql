-- Версия сессий пользователя: токен с другой версией отвергается (сброс пароля и выход отзывают выданные токены)
ALTER TABLE "user" ADD COLUMN "session_version" INTEGER NOT NULL DEFAULT 0;
