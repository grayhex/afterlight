-- Release engine (#150): единая модель состояний события, снимок политики, явные сроки переходов,
-- «одно активное событие на сейф» на уровне БД, единая настройка heartbeat.

-- ── Пользователь: время последнего входа (вход владельца = активность)
ALTER TABLE "user" ADD COLUMN "last_login_at" TIMESTAMP(3);

-- ── Значения по умолчанию сейфа приведены к контракту MVP (3 верификатора, кворум 2, порог 30 дней)
ALTER TABLE "vault" ALTER COLUMN "quorum_threshold" SET DEFAULT 2;
ALTER TABLE "vault" ALTER COLUMN "max_verifiers" SET DEFAULT 3;
ALTER TABLE "vault" ALTER COLUMN "heartbeat_timeout_days" SET DEFAULT 30;

-- ── Heartbeat: единый источник порога — vault.heartbeat_timeout_days
ALTER TABLE "heartbeat" DROP COLUMN "timeout_days";

-- ── События: новые поля
ALTER TABLE "verification_event" ADD COLUMN "grace_hours" INTEGER NOT NULL DEFAULT 24;
ALTER TABLE "verification_event" ADD COLUMN "verifier_ids" UUID[] NOT NULL DEFAULT ARRAY[]::UUID[];
ALTER TABLE "verification_event" ADD COLUMN "grace_started_at" TIMESTAMP(3);
ALTER TABLE "verification_event" ADD COLUMN "grace_until" TIMESTAMP(3);
ALTER TABLE "verification_event" ADD COLUMN "disputed_until" TIMESTAMP(3);
ALTER TABLE "verification_event" ADD COLUMN "closed_at" TIMESTAMP(3);
ALTER TABLE "verification_event" ADD COLUMN "cancelled_by" UUID;

-- Снимок для уже существующих событий: длительность grace сейфа и активные верификаторы
UPDATE "verification_event" e
SET "grace_hours" = v."grace_hours",
    "verifier_ids" = COALESCE(
      (SELECT array_agg(r."user_id") FROM "vault_user_role" r
        WHERE r."vault_id" = e."vault_id" AND r."role" = 'Verifier' AND r."status" = 'Active'),
      ARRAY[]::UUID[])
FROM "vault" v WHERE v."id" = e."vault_id";

-- ── Перечисление состояний: убраны Draft, QuorumReached, HeartbeatTimeout; добавлены Rejected, Cancelled
CREATE TYPE "VerificationState_new" AS ENUM ('Submitted', 'Confirming', 'Disputed', 'Grace', 'Finalized', 'Rejected', 'Cancelled');
ALTER TABLE "verification_event" ALTER COLUMN "state" DROP DEFAULT;
ALTER TABLE "verification_event" ALTER COLUMN "state" TYPE "VerificationState_new" USING (
  CASE "state"::text
    WHEN 'Draft' THEN 'Submitted'
    WHEN 'QuorumReached' THEN 'Grace'
    WHEN 'HeartbeatTimeout' THEN 'Cancelled'
    ELSE "state"::text
  END
)::"VerificationState_new";
DROP TYPE "VerificationState";
ALTER TYPE "VerificationState_new" RENAME TO "VerificationState";
ALTER TABLE "verification_event" ALTER COLUMN "state" SET DEFAULT 'Submitted';

-- ── Миграция данных (консервативно: ничего не раскрывается раньше времени)
-- Бывшие HeartbeatTimeout-строки закрываются; завершённые получают момент завершения.
UPDATE "verification_event" SET "closed_at" = now() WHERE "state" = 'Cancelled' AND "closed_at" IS NULL;
UPDATE "verification_event" SET "finalized_at" = COALESCE("finalized_at", "created_at") WHERE "state" = 'Finalized';
-- Находящиеся в grace (включая бывшие QuorumReached) начинают полную отсрочку заново от момента миграции;
-- спорные получают новую 24-часовую блокировку.
UPDATE "verification_event"
SET "grace_started_at" = now(), "grace_until" = now() + ("grace_hours" * interval '1 hour')
WHERE "state" = 'Grace';
UPDATE "verification_event" SET "disputed_until" = now() + interval '24 hours' WHERE "state" = 'Disputed';

-- Дубли активных событий (прежний код допускал несколько): остаётся самое новое, остальные отменяются
UPDATE "verification_event" e
SET "state" = 'Cancelled', "closed_at" = now()
FROM (
  SELECT "id", row_number() OVER (PARTITION BY "vault_id" ORDER BY "created_at" DESC) AS rn
  FROM "verification_event"
  WHERE "state" IN ('Submitted', 'Confirming', 'Disputed', 'Grace')
) d
WHERE e."id" = d."id" AND d.rn > 1;

-- Не более одного активного события на сейф (Prisma не описывает частичные индексы, поэтому только в миграции)
CREATE UNIQUE INDEX "ux_ve_one_active_per_vault" ON "verification_event" ("vault_id")
WHERE "state" IN ('Submitted', 'Confirming', 'Disputed', 'Grace');
