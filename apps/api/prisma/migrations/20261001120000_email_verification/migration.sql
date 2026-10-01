-- Подтверждение адреса (#151): до подтверждения чувствительные действия закрыты.
-- Существующие учётные записи считаются неподтверждёнными (реальных пользователей до этого момента нет, данные синтетические):
-- владелец подтверждает адрес письмом после входа.
ALTER TABLE "user" ADD COLUMN "email_verified_at" TIMESTAMP(3);

-- Адреса приводятся к нижнему регистру (приглашения и вход сравнивают их так же). Если несколько адресов дают одно
-- нормализованное значение (Foo@x и FOO@x, в том числе когда ни один не канонический), не трогаем ни один из них:
-- такие аккаунты придётся разбирать вручную, а обновление не должно нарушить уникальность.
UPDATE "user" u SET "email" = lower(btrim(u."email"))
WHERE u."email" <> lower(btrim(u."email"))
  AND NOT EXISTS (
    SELECT 1 FROM "user" o WHERE o."id" <> u."id" AND lower(btrim(o."email")) = lower(btrim(u."email"))
  );

CREATE TABLE "email_verification_token" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_verification_token_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ix_email_verification_token_hash" ON "email_verification_token"("token_hash");
CREATE INDEX "ix_email_verification_token_expires_at" ON "email_verification_token"("expires_at");

ALTER TABLE "email_verification_token" ADD CONSTRAINT "email_verification_token_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
