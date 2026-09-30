-- Жизненный цикл приглашений: одноразовость, отзыв, автор приглашения.
ALTER TABLE "vault_user_invitation" ADD COLUMN "invited_by" UUID;
ALTER TABLE "vault_user_invitation" ADD COLUMN "accepted_at" TIMESTAMP(3);
ALTER TABLE "vault_user_invitation" ADD COLUMN "revoked_at" TIMESTAMP(3);

-- Токены раньше хранились открытым текстом. Теперь в колонке лежит SHA-256 (hex);
-- уже выданные приглашения остаются действительными, но сам секрет из БД пропадает.
UPDATE "vault_user_invitation" SET "token" = encode(sha256(convert_to("token", 'UTF8')), 'hex');

CREATE UNIQUE INDEX "uq_vault_user_invitation_token" ON "vault_user_invitation"("token");
