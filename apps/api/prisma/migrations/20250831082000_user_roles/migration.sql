-- CreateEnum
CREATE TYPE "VaultStatus" AS ENUM ('Active', 'Triggered', 'PendingGrace', 'Released', 'Closed');

-- CreateEnum
CREATE TYPE "BlockType" AS ENUM ('text', 'file', 'url');

-- CreateEnum
CREATE TYPE "VaultUserRoleStatus" AS ENUM ('Invited', 'Active', 'Revoked');

-- CreateEnum
CREATE TYPE "VerificationState" AS ENUM ('Draft', 'Submitted', 'Confirming', 'Disputed', 'QuorumReached', 'HeartbeatTimeout', 'Grace', 'Finalized');

-- CreateEnum
CREATE TYPE "Decision" AS ENUM ('Confirm', 'Deny');

-- CreateEnum
CREATE TYPE "HeartbeatMethod" AS ENUM ('auto', 'manual');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('email', 'sms', 'telegram', 'push');

-- CreateEnum
CREATE TYPE "NotificationState" AS ENUM ('Queued', 'Sent', 'Failed');

-- CreateEnum
CREATE TYPE "PlanTier" AS ENUM ('Free', 'Pro', 'Business');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('trial', 'active', 'canceled');

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('User', 'System');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('Owner', 'Verifier', 'Admin');

-- CreateTable
CREATE TABLE "user" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "password_hash" TEXT,
    "passkey_pub" TEXT,
    "two_fa_enabled" BOOLEAN NOT NULL DEFAULT false,
    "role" "UserRole" NOT NULL DEFAULT 'Owner',
    "locale" TEXT NOT NULL DEFAULT 'ru-RU',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vault" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" "VaultStatus" NOT NULL DEFAULT 'Active',
    "quorum_threshold" INTEGER NOT NULL DEFAULT 3,
    "max_verifiers" INTEGER NOT NULL DEFAULT 5,
    "heartbeat_timeout_days" INTEGER NOT NULL DEFAULT 60,
    "grace_hours" INTEGER NOT NULL DEFAULT 24,
    "is_demo" BOOLEAN NOT NULL DEFAULT false,
    "mk_wrapped" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vault_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "block" (
    "id" UUID NOT NULL,
    "vault_id" UUID NOT NULL,
    "type" "BlockType" NOT NULL,
    "dek_wrapped" TEXT NOT NULL,
    "metadata" JSONB,
    "tags" TEXT[],
    "size" BIGINT,
    "checksum" TEXT,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "block_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipient" (
    "id" UUID NOT NULL,
    "contact" TEXT NOT NULL,
    "pubkey" TEXT,
    "verification_status" TEXT NOT NULL DEFAULT 'Invited',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "block_recipient" (
    "block_id" UUID NOT NULL,
    "recipient_id" UUID NOT NULL,
    "dek_wrapped_for_recipient" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "block_recipient_pkey" PRIMARY KEY ("block_id","recipient_id")
);

-- CreateTable
CREATE TABLE "vault_user_role" (
    "vault_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "UserRole" NOT NULL,
    "status" "VaultUserRoleStatus" NOT NULL DEFAULT 'Invited',
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vault_user_role_pkey" PRIMARY KEY ("vault_id","user_id")
);

-- CreateTable
CREATE TABLE "vault_user_invitation" (
    "id" UUID NOT NULL,
    "vault_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vault_user_invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_event" (
    "id" UUID NOT NULL,
    "vault_id" UUID NOT NULL,
    "initiator" TEXT,
    "state" "VerificationState" NOT NULL DEFAULT 'Draft',
    "quorum_required" INTEGER NOT NULL,
    "confirms_count" INTEGER NOT NULL DEFAULT 0,
    "denies_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalized_at" TIMESTAMP(3),

    CONSTRAINT "verification_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_decision" (
    "id" UUID NOT NULL,
    "verification_event_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "decision" "Decision" NOT NULL,
    "signature" TEXT,
    "decided_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_decision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "heartbeat" (
    "vault_id" UUID NOT NULL,
    "last_ping_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "timeout_days" INTEGER NOT NULL DEFAULT 60,
    "method" "HeartbeatMethod" NOT NULL DEFAULT 'manual',

    CONSTRAINT "heartbeat_pkey" PRIMARY KEY ("vault_id")
);

-- CreateTable
CREATE TABLE "notification" (
    "id" UUID NOT NULL,
    "vault_id" UUID NOT NULL,
    "to_contact" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "payload" JSONB NOT NULL,
    "state" "NotificationState" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" UUID NOT NULL,
    "actor_type" "ActorType" NOT NULL,
    "actor_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetId" TEXT,
    "targetType" TEXT,
    "hash" TEXT,
    "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recovery_share" (
    "id" UUID NOT NULL,
    "vault_id" UUID NOT NULL,
    "share_index" INTEGER NOT NULL,
    "share_cipher" TEXT NOT NULL,

    CONSTRAINT "recovery_share_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan" (
    "id" UUID NOT NULL,
    "tier" "PlanTier" NOT NULL,
    "limits" JSONB NOT NULL,

    CONSTRAINT "plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "status" "SubscriptionStatus" NOT NULL,
    "current_period_end" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public_link" (
    "id" UUID NOT NULL,
    "block_id" UUID NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "publish_from" TIMESTAMP(3) NOT NULL,
    "publish_until" TIMESTAMP(3),
    "token_hash" TEXT NOT NULL,
    "maxViews" INTEGER,
    "views_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "public_link_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence" (
    "id" UUID NOT NULL,
    "verification_event_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "hash" TEXT,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "setting" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,

    CONSTRAINT "setting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_content" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'ru',
    "data" JSONB NOT NULL,

    CONSTRAINT "site_content_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_template" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'ru',
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,

    CONSTRAINT "email_template_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE INDEX "ix_vault_user_id" ON "vault"("user_id");

-- CreateIndex
CREATE INDEX "ix_block_vault_id" ON "block"("vault_id");

-- CreateIndex
CREATE UNIQUE INDEX "recipient_contact_key" ON "recipient"("contact");

-- CreateIndex
CREATE INDEX "ix_recipient_contact" ON "recipient"("contact");

-- CreateIndex
CREATE INDEX "ix_block_recipient_recipient_id" ON "block_recipient"("recipient_id");

-- CreateIndex
CREATE INDEX "ix_vault_user_role_user_id" ON "vault_user_role"("user_id");

-- CreateIndex
CREATE INDEX "ix_vault_user_invitation_vault_id" ON "vault_user_invitation"("vault_id");

-- CreateIndex
CREATE INDEX "ix_ve_vault_id" ON "verification_event"("vault_id");

-- CreateIndex
CREATE INDEX "ix_ve_state" ON "verification_event"("state");

-- CreateIndex
CREATE INDEX "ix_vd_user_id" ON "verification_decision"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_decision_once" ON "verification_decision"("verification_event_id", "user_id");

-- CreateIndex
CREATE INDEX "ix_notification_vault_id" ON "notification"("vault_id");

-- CreateIndex
CREATE INDEX "ix_audit_actor" ON "audit_log"("actor_type", "actor_id");

-- CreateIndex
CREATE INDEX "ix_audit_ts" ON "audit_log"("ts");

-- CreateIndex
CREATE INDEX "ix_recovery_vault_id" ON "recovery_share"("vault_id");

-- CreateIndex
CREATE INDEX "ix_sub_user_id" ON "subscription"("user_id");

-- CreateIndex
CREATE INDEX "ix_sub_plan_id" ON "subscription"("plan_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_public_link_per_block" ON "public_link"("block_id");

-- CreateIndex
CREATE INDEX "ix_evidence_event_id" ON "evidence"("verification_event_id");

-- CreateIndex
CREATE UNIQUE INDEX "setting_key_key" ON "setting"("key");

-- CreateIndex
CREATE UNIQUE INDEX "uq_sitecontent_key_locale" ON "site_content"("key", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "uq_emailtpl_key_locale" ON "email_template"("key", "locale");

-- AddForeignKey
ALTER TABLE "vault" ADD CONSTRAINT "vault_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "block" ADD CONSTRAINT "block_vault_id_fkey" FOREIGN KEY ("vault_id") REFERENCES "vault"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "block_recipient" ADD CONSTRAINT "block_recipient_block_id_fkey" FOREIGN KEY ("block_id") REFERENCES "block"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "block_recipient" ADD CONSTRAINT "block_recipient_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "recipient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vault_user_role" ADD CONSTRAINT "vault_user_role_vault_id_fkey" FOREIGN KEY ("vault_id") REFERENCES "vault"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vault_user_role" ADD CONSTRAINT "vault_user_role_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vault_user_invitation" ADD CONSTRAINT "vault_user_invitation_vault_id_fkey" FOREIGN KEY ("vault_id") REFERENCES "vault"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_event" ADD CONSTRAINT "verification_event_vault_id_fkey" FOREIGN KEY ("vault_id") REFERENCES "vault"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_decision" ADD CONSTRAINT "verification_decision_verification_event_id_fkey" FOREIGN KEY ("verification_event_id") REFERENCES "verification_event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_decision" ADD CONSTRAINT "verification_decision_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "heartbeat" ADD CONSTRAINT "heartbeat_vault_id_fkey" FOREIGN KEY ("vault_id") REFERENCES "vault"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_vault_id_fkey" FOREIGN KEY ("vault_id") REFERENCES "vault"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recovery_share" ADD CONSTRAINT "recovery_share_vault_id_fkey" FOREIGN KEY ("vault_id") REFERENCES "vault"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public_link" ADD CONSTRAINT "public_link_block_id_fkey" FOREIGN KEY ("block_id") REFERENCES "block"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_verification_event_id_fkey" FOREIGN KEY ("verification_event_id") REFERENCES "verification_event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

