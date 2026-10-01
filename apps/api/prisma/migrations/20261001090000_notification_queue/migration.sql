-- Очередь email (#151): повторные попытки с backoff, аренда задачи воркером, диагностика ошибок.
-- Системные письма (восстановление аккаунта) не привязаны к сейфу: vault_id становится необязательным.
ALTER TABLE "notification" ALTER COLUMN "vault_id" DROP NOT NULL;

ALTER TABLE "notification" ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "notification" ADD COLUMN "next_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "notification" ADD COLUMN "locked_until" TIMESTAMP(3);
ALTER TABLE "notification" ADD COLUMN "last_error" TEXT;
ALTER TABLE "notification" ADD COLUMN "sent_at" TIMESTAMP(3);

-- Ранее «отправленные» письма на самом деле только писались в лог: фиксируем это в диагностике,
-- а сохранённые в payload тела (в них могли быть одноразовые токены) убираем.
UPDATE "notification"
SET "last_error" = 'legacy: logged only, never delivered',
    "payload" = jsonb_build_object('subject', COALESCE("payload"->>'subject', ''), 'redacted', true)
WHERE "state" = 'Sent';

CREATE INDEX "ix_notification_due" ON "notification"("state", "next_attempt_at");
