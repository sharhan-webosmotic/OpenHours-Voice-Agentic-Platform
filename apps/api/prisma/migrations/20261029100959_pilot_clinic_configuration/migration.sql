-- Feature 2 (pilot clinic setup): clinic configuration tables and the Sarvam mapping.
--
-- ADDITIVE EXCEPT FOR ONE DROP, WHICH NEEDS A REVIEWER'S EYE.
--
-- `voice_agents.external_agent_id` is DROPPED and replaced by `sarvam_app_id`. The two
-- named the same thing: the provider's identifier for one clinic's agent. Keeping both
-- would have left two columns to hold one fact with nothing enforcing that they agree, and
-- the drift would surface as a webhook resolving to no organisation.
--
-- This is safe here and will not be safe later. The column is NOT NULL today, the table is
-- empty in every environment (no clinic has been through the Sarvam setup yet), and the
-- only code that read it was a test fixture. Once a real agent is mapped, the same change
-- would need a copy-then-drop across two migrations.
--
-- The new column is NULLABLE, which the old one was not: the agent row is created with the
-- clinic, and the Sarvam id does not exist until somebody has finished the manual setup in
-- Sarvam's own console.
--
-- Everything else here is new tables, new columns and new indexes. The row-level security
-- policies for the five new tables are NOT in this file: they are applied by
-- prisma/sql/003_pilot_clinic.sql, because the policy loop lives with the hand-written SQL.
-- `pnpm db:check-policies` fails until that file has run.

-- CreateEnum
CREATE TYPE "agent_tone" AS ENUM ('FORMAL', 'FRIENDLY', 'NEUTRAL');

-- CreateEnum
CREATE TYPE "recording_consent_mode" AS ENUM ('NOT_RECORDED', 'ANNOUNCEMENT', 'EXPLICIT_OPT_IN');

-- DropIndex
DROP INDEX "voice_agents_provider_external_agent_id_key";

-- AlterTable
ALTER TABLE "organisations" ADD COLUMN     "opening_hours_collected_at" TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "voice_agents" DROP COLUMN "external_agent_id",
ADD COLUMN     "prompt_version" TEXT,
ADD COLUMN     "sarvam_app_id" TEXT,
ADD COLUMN     "sarvam_app_version" TEXT,
ADD COLUMN     "sarvam_connection_id" TEXT,
ADD COLUMN     "sarvam_deployment_id" TEXT,
ADD COLUMN     "tool_secret_hash" TEXT,
ADD COLUMN     "tool_secret_set_at" TIMESTAMPTZ(6);

-- CreateTable
CREATE TABLE "clinic_profiles" (
    "id" UUID NOT NULL,
    "organisation_id" UUID NOT NULL,
    "legal_name" TEXT,
    "contact_email" CITEXT,
    "contact_phone" TEXT,
    "website" TEXT,
    "address_line1" TEXT,
    "address_line2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postal_code" TEXT,
    "country" CHAR(2),
    "map_url" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "clinic_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinic_booking_policies" (
    "id" UUID NOT NULL,
    "organisation_id" UUID NOT NULL,
    "slot_granularity_minutes" INTEGER,
    "minimum_notice_minutes" INTEGER,
    "maximum_advance_days" INTEGER,
    "cancellation_window_hours" INTEGER,
    "accepts_new_patients" BOOLEAN,
    "default_buffer_minutes" INTEGER,
    "max_per_slot" INTEGER,
    "no_show_policy" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "clinic_booking_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinic_agent_profiles" (
    "id" UUID NOT NULL,
    "organisation_id" UUID NOT NULL,
    "greeting" TEXT,
    "languages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tone" "agent_tone",
    "fully_booked_response" TEXT,
    "escalation_rules" TEXT,
    "never_promise" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "clinic_agent_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinic_telephony" (
    "id" UUID NOT NULL,
    "organisation_id" UUID NOT NULL,
    "recording_consent_mode" "recording_consent_mode",
    "consent_announcement" TEXT,
    "consent_confirmed_at" TIMESTAMPTZ(6),
    "consent_confirmed_by_name" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "clinic_telephony_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinic_faqs" (
    "id" UUID NOT NULL,
    "organisation_id" UUID NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "clinic_faqs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "clinic_profiles_organisation_id_key" ON "clinic_profiles"("organisation_id");

-- CreateIndex
CREATE UNIQUE INDEX "clinic_booking_policies_organisation_id_key" ON "clinic_booking_policies"("organisation_id");

-- CreateIndex
CREATE UNIQUE INDEX "clinic_agent_profiles_organisation_id_key" ON "clinic_agent_profiles"("organisation_id");

-- CreateIndex
CREATE UNIQUE INDEX "clinic_telephony_organisation_id_key" ON "clinic_telephony"("organisation_id");

-- CreateIndex
CREATE INDEX "clinic_faqs_organisation_id_active_sort_order_idx" ON "clinic_faqs"("organisation_id", "active", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "clinic_faqs_organisation_id_sort_order_key" ON "clinic_faqs"("organisation_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "voice_agents_organisation_id_provider_key" ON "voice_agents"("organisation_id", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "voice_agents_provider_sarvam_app_id_key" ON "voice_agents"("provider", "sarvam_app_id");

-- AddForeignKey
ALTER TABLE "clinic_profiles" ADD CONSTRAINT "clinic_profiles_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinic_booking_policies" ADD CONSTRAINT "clinic_booking_policies_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinic_agent_profiles" ADD CONSTRAINT "clinic_agent_profiles_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinic_telephony" ADD CONSTRAINT "clinic_telephony_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinic_faqs" ADD CONSTRAINT "clinic_faqs_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

