-- Предыдущая миграция проверяла наличие внешнего ключа по одному имени ограничения во всей БД: если в другой схеме
-- уже есть таблица с таким же именем ограничения, ключ не добавлялся. Проверяем по самой таблице (conrelid);
-- изменять уже применённую миграцию нельзя (контрольная сумма), поэтому исправление — отдельной идемпотентной миграцией.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'password_reset_token'::regclass
      AND confrelid = '"user"'::regclass
      AND contype = 'f'
  ) THEN
    -- Блокировка, которую ADD FOREIGN KEY всё равно берёт, берётся заранее: пока идёт очистка, в обеих таблицах нельзя
    -- записывать, и параллельное удаление пользователя не создаст нового «сироты» между DELETE и ALTER.
    LOCK TABLE "user", "password_reset_token" IN SHARE ROW EXCLUSIVE MODE;
    -- Без ключа токены удалённых пользователей могли остаться «сиротами» и сделали бы добавление ключа невозможным;
    -- такие токены всё равно непригодны (пользователя уже нет), поэтому удаляем их.
    DELETE FROM "password_reset_token" t WHERE NOT EXISTS (SELECT 1 FROM "user" u WHERE u.id = t.user_id);
    ALTER TABLE "password_reset_token"
      ADD CONSTRAINT "password_reset_token_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
