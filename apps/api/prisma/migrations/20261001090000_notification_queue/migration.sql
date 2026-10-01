-- Очередь email (#151): повторные попытки с backoff, аренда задачи воркером, диагностика ошибок.
-- Системные письма (восстановление аккаунта) не привязаны к сейфу: vault_id становится необязательным.
ALTER TABLE "notification" ALTER COLUMN "vault_id" DROP NOT NULL;

ALTER TABLE "notification" ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "notification" ADD COLUMN "next_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "notification" ADD COLUMN "locked_until" TIMESTAMP(3);
ALTER TABLE "notification" ADD COLUMN "last_error" TEXT;
ALTER TABLE "notification" ADD COLUMN "sent_at" TIMESTAMP(3);
-- Вид письма, ключ замены (новое письмо снимает неотправленные прежние) и срок годности (токен в письме истёк — не отправляем)
ALTER TABLE "notification" ADD COLUMN "kind" TEXT;
ALTER TABLE "notification" ADD COLUMN "supersede_key" TEXT;
ALTER TABLE "notification" ADD COLUMN "expires_at" TIMESTAMP(3);
ALTER TYPE "NotificationState" ADD VALUE 'Cancelled';

-- Ранее «отправленные» письма на самом деле только писались в лог: фиксируем это в диагностике,
-- а сохранённые в payload тела (в них могли быть одноразовые токены) убираем.
UPDATE "notification"
SET "last_error" = 'legacy: logged only, never delivered',
    "payload" = jsonb_build_object('subject', COALESCE("payload"->>'subject', ''), 'redacted', true)
WHERE "state" = 'Sent';

-- Письма, оставшиеся в очереди от прежней реализации (она их никогда не отправляла), не должны уйти реальным получателям
-- после выкладки: без срока годности они могли бы содержать давно недействительные токены. Снимаем их и убираем тела.
-- Состояние Failed, а не Cancelled: новое значение enum нельзя использовать в той же транзакции, где оно добавлено.
UPDATE "notification"
SET "state" = 'Failed',
    "last_error" = 'legacy: queued by the previous implementation, never delivered; not sent after upgrade',
    "payload" = jsonb_build_object('subject', COALESCE("payload"->>'subject', ''), 'redacted', true)
WHERE "state" = 'Queued';

CREATE INDEX "ix_notification_due" ON "notification"("state", "next_attempt_at");
CREATE INDEX "ix_notification_supersede" ON "notification"("kind", "supersede_key");
