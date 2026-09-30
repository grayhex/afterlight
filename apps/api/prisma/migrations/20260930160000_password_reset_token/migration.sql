-- Модель PasswordResetToken была в schema.prisma, но не в миграциях (окружения могли получить её через db push).
-- Миграция идемпотентна: безопасна и для чистой БД, и для БД, где таблица уже есть.
CREATE TABLE IF NOT EXISTS "password_reset_token" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_token_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ix_password_reset_token_hash" ON "password_reset_token"("token_hash");

CREATE INDEX IF NOT EXISTS "ix_password_reset_token_expires_at" ON "password_reset_token"("expires_at");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'password_reset_token_user_id_fkey'
  ) THEN
    ALTER TABLE "password_reset_token"
      ADD CONSTRAINT "password_reset_token_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
