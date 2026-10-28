-- CreateEnum
CREATE TYPE "weekday" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');

-- CreateEnum
CREATE TYPE "appointment_status" AS ENUM ('SCHEDULED', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "appointment_source" AS ENUM ('VOICE_AGENT', 'DASHBOARD', 'IMPORT');

-- CreateEnum
CREATE TYPE "call_direction" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "call_status" AS ENUM ('RINGING', 'IN_PROGRESS', 'COMPLETED', 'MISSED', 'ABANDONED', 'FAILED');

-- CreateEnum
CREATE TYPE "call_outcome" AS ENUM ('BOOKED', 'RESCHEDULED', 'CANCELLED', 'INFORMATION', 'TRANSFERRED', 'NONE');

-- CreateEnum
CREATE TYPE "prescription_status" AS ENUM ('DRAFT', 'ISSUED');

-- CreateEnum
CREATE TYPE "follow_up_status" AS ENUM ('PENDING', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "outbound_call_status" AS ENUM ('QUEUED', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "webhook_event_status" AS ENUM ('RECEIVED', 'PROCESSED', 'FAILED');

-- CreateTable
CREATE TABLE "clinic_hours" (
    "id" UUID NOT NULL,
    "organisation_id" UUID NOT NULL,
    "weekday" "weekday" NOT NULL,
    "opens_at_minute" INTEGER NOT NULL,
    "closes_at_minute" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "clinic_hours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doctors" (
    "id" UUID NOT NULL,
    "organisation_id" UUID NOT NULL,
    "user_id" UUID,
    "full_name" TEXT NOT NULL,
    "specialty" TEXT,
    "buffer_minutes" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "doctors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doctor_working_hours" (
    "id" UUID NOT NULL,
    "organisation_id" UUID NOT NULL,
    "doctor_id" UUID NOT NULL,
    "weekday" "weekday" NOT NULL,
    "start_at_minute" INTEGER NOT NULL,
    "end_at_minute" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "doctor_working_hours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doctor_time_off" (
    "id" UUID NOT NULL,
    "organisation_id" UUID NOT NULL,
    "doctor_id" UUID NOT NULL,
    "start_at" TIMESTAMPTZ(6) NOT NULL,
    "end_at" TIMESTAMPTZ(6) NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "doctor_time_off_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "services" (
    "id" UUID NOT NULL,
    "organisation_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "duration_minutes" INTEGER NOT NULL,
    "price_minor" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doctor_services" (
    "id" UUID NOT NULL,
    "organisation_id" UUID NOT NULL,
    "doctor_id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "doctor_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patients" (
    "id" UUID NOT NULL,
    "organisation_id" UUID NOT NULL,
    "full_name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "date_of_birth" DATE,
    "notes" TEXT,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointments" (
    "id" UUID NOT NULL,
    "organisation_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "doctor_id" UUID NOT NULL,
    "service_id" UUID,
    "start_at" TIMESTAMPTZ(6) NOT NULL,
    "end_at" TIMESTAMPTZ(6) NOT NULL,
    "status" "appointment_status" NOT NULL DEFAULT 'SCHEDULED',
    "source" "appointment_source" NOT NULL DEFAULT 'DASHBOARD',
    "idempotency_key" TEXT,
    "rescheduled_from_id" UUID,
    "cancelled_at" TIMESTAMPTZ(6),
    "cancellation_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calls" (
    "id" UUID NOT NULL,
    "organisation_id" UUID NOT NULL,
    "provider" "provider" NOT NULL DEFAULT 'SARVAM',
    "external_call_id" TEXT NOT NULL,
    "direction" "call_direction" NOT NULL,
    "status" "call_status" NOT NULL,
    "outcome" "call_outcome" NOT NULL DEFAULT 'NONE',
    "from_e164" TEXT NOT NULL,
    "to_e164" TEXT NOT NULL,
    "patient_id" UUID,
    "appointment_id" UUID,
    "started_at" TIMESTAMPTZ(6),
    "ended_at" TIMESTAMPTZ(6),
    "duration_seconds" INTEGER,
    "cost_minor" INTEGER,
    "recording_key" TEXT,
    "transcript" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "calls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" UUID NOT NULL,
    "organisation_id" UUID,
    "provider" "provider" NOT NULL DEFAULT 'SARVAM',
    "external_event_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "status" "webhook_event_status" NOT NULL DEFAULT 'RECEIVED',
    "payload" JSONB NOT NULL,
    "last_error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "processed_at" TIMESTAMPTZ(6),
    "received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prescriptions" (
    "id" UUID NOT NULL,
    "organisation_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "doctor_id" UUID NOT NULL,
    "appointment_id" UUID,
    "status" "prescription_status" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "issued_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "prescriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prescription_items" (
    "id" UUID NOT NULL,
    "organisation_id" UUID NOT NULL,
    "prescription_id" UUID NOT NULL,
    "medication" TEXT NOT NULL,
    "dosage" TEXT,
    "frequency" TEXT,
    "duration_days" INTEGER,
    "instructions" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prescription_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "follow_ups" (
    "id" UUID NOT NULL,
    "organisation_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "doctor_id" UUID,
    "appointment_id" UUID,
    "assigned_user_id" UUID,
    "due_at" TIMESTAMPTZ(6) NOT NULL,
    "status" "follow_up_status" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "follow_ups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbound_calls" (
    "id" UUID NOT NULL,
    "organisation_id" UUID NOT NULL,
    "patient_id" UUID,
    "dedupe_key" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" "outbound_call_status" NOT NULL DEFAULT 'QUEUED',
    "scheduled_at" TIMESTAMPTZ(6) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_attempt_at" TIMESTAMPTZ(6),
    "last_error" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "outbound_calls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forwarding_schedules" (
    "id" UUID NOT NULL,
    "organisation_id" UUID NOT NULL,
    "weekday" "weekday" NOT NULL,
    "start_at_minute" INTEGER NOT NULL,
    "end_at_minute" INTEGER NOT NULL,
    "forwarding_on" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "forwarding_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forwarding_events" (
    "id" UUID NOT NULL,
    "organisation_id" UUID NOT NULL,
    "schedule_id" UUID,
    "device_id" UUID,
    "outcome" TEXT NOT NULL,
    "detail" TEXT,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "forwarding_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "clinic_hours_organisation_id_weekday_idx" ON "clinic_hours"("organisation_id", "weekday");

-- CreateIndex
CREATE UNIQUE INDEX "clinic_hours_organisation_id_weekday_opens_at_minute_key" ON "clinic_hours"("organisation_id", "weekday", "opens_at_minute");

-- CreateIndex
CREATE UNIQUE INDEX "doctors_user_id_key" ON "doctors"("user_id");

-- CreateIndex
CREATE INDEX "doctors_organisation_id_active_deleted_at_idx" ON "doctors"("organisation_id", "active", "deleted_at");

-- CreateIndex
CREATE INDEX "doctor_working_hours_organisation_id_doctor_id_weekday_idx" ON "doctor_working_hours"("organisation_id", "doctor_id", "weekday");

-- CreateIndex
CREATE UNIQUE INDEX "doctor_working_hours_organisation_id_doctor_id_weekday_star_key" ON "doctor_working_hours"("organisation_id", "doctor_id", "weekday", "start_at_minute");

-- CreateIndex
CREATE INDEX "doctor_time_off_organisation_id_doctor_id_start_at_idx" ON "doctor_time_off"("organisation_id", "doctor_id", "start_at");

-- CreateIndex
CREATE INDEX "services_organisation_id_active_deleted_at_idx" ON "services"("organisation_id", "active", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "services_organisation_id_name_key" ON "services"("organisation_id", "name");

-- CreateIndex
CREATE INDEX "doctor_services_organisation_id_service_id_idx" ON "doctor_services"("organisation_id", "service_id");

-- CreateIndex
CREATE UNIQUE INDEX "doctor_services_organisation_id_doctor_id_service_id_key" ON "doctor_services"("organisation_id", "doctor_id", "service_id");

-- CreateIndex
CREATE INDEX "patients_organisation_id_phone_idx" ON "patients"("organisation_id", "phone");

-- CreateIndex
CREATE INDEX "patients_organisation_id_deleted_at_idx" ON "patients"("organisation_id", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "appointments_rescheduled_from_id_key" ON "appointments"("rescheduled_from_id");

-- CreateIndex
CREATE INDEX "appointments_organisation_id_start_at_idx" ON "appointments"("organisation_id", "start_at");

-- CreateIndex
CREATE INDEX "appointments_organisation_id_doctor_id_start_at_idx" ON "appointments"("organisation_id", "doctor_id", "start_at");

-- CreateIndex
CREATE INDEX "appointments_organisation_id_patient_id_start_at_idx" ON "appointments"("organisation_id", "patient_id", "start_at");

-- CreateIndex
CREATE INDEX "appointments_organisation_id_status_start_at_idx" ON "appointments"("organisation_id", "status", "start_at");

-- CreateIndex
CREATE UNIQUE INDEX "appointments_organisation_id_idempotency_key_key" ON "appointments"("organisation_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "calls_organisation_id_started_at_idx" ON "calls"("organisation_id", "started_at");

-- CreateIndex
CREATE INDEX "calls_organisation_id_status_started_at_idx" ON "calls"("organisation_id", "status", "started_at");

-- CreateIndex
CREATE INDEX "calls_organisation_id_patient_id_started_at_idx" ON "calls"("organisation_id", "patient_id", "started_at");

-- CreateIndex
CREATE UNIQUE INDEX "calls_provider_external_call_id_key" ON "calls"("provider", "external_call_id");

-- CreateIndex
CREATE INDEX "webhook_events_status_received_at_idx" ON "webhook_events"("status", "received_at");

-- CreateIndex
CREATE INDEX "webhook_events_organisation_id_received_at_idx" ON "webhook_events"("organisation_id", "received_at");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_events_provider_external_event_id_key" ON "webhook_events"("provider", "external_event_id");

-- CreateIndex
CREATE INDEX "prescriptions_organisation_id_patient_id_created_at_idx" ON "prescriptions"("organisation_id", "patient_id", "created_at");

-- CreateIndex
CREATE INDEX "prescriptions_organisation_id_doctor_id_created_at_idx" ON "prescriptions"("organisation_id", "doctor_id", "created_at");

-- CreateIndex
CREATE INDEX "prescription_items_organisation_id_prescription_id_idx" ON "prescription_items"("organisation_id", "prescription_id");

-- CreateIndex
CREATE INDEX "follow_ups_organisation_id_status_due_at_idx" ON "follow_ups"("organisation_id", "status", "due_at");

-- CreateIndex
CREATE INDEX "follow_ups_organisation_id_assigned_user_id_status_idx" ON "follow_ups"("organisation_id", "assigned_user_id", "status");

-- CreateIndex
CREATE INDEX "follow_ups_organisation_id_patient_id_idx" ON "follow_ups"("organisation_id", "patient_id");

-- CreateIndex
CREATE UNIQUE INDEX "outbound_calls_dedupe_key_key" ON "outbound_calls"("dedupe_key");

-- CreateIndex
CREATE INDEX "outbound_calls_organisation_id_status_scheduled_at_idx" ON "outbound_calls"("organisation_id", "status", "scheduled_at");

-- CreateIndex
CREATE INDEX "outbound_calls_status_scheduled_at_idx" ON "outbound_calls"("status", "scheduled_at");

-- CreateIndex
CREATE INDEX "forwarding_schedules_organisation_id_active_weekday_idx" ON "forwarding_schedules"("organisation_id", "active", "weekday");

-- CreateIndex
CREATE UNIQUE INDEX "forwarding_schedules_organisation_id_weekday_start_at_minut_key" ON "forwarding_schedules"("organisation_id", "weekday", "start_at_minute");

-- CreateIndex
CREATE INDEX "forwarding_events_organisation_id_occurred_at_idx" ON "forwarding_events"("organisation_id", "occurred_at");

-- AddForeignKey
ALTER TABLE "clinic_hours" ADD CONSTRAINT "clinic_hours_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctors" ADD CONSTRAINT "doctors_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctors" ADD CONSTRAINT "doctors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_working_hours" ADD CONSTRAINT "doctor_working_hours_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_working_hours" ADD CONSTRAINT "doctor_working_hours_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_time_off" ADD CONSTRAINT "doctor_time_off_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_time_off" ADD CONSTRAINT "doctor_time_off_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_services" ADD CONSTRAINT "doctor_services_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_services" ADD CONSTRAINT "doctor_services_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_services" ADD CONSTRAINT "doctor_services_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_rescheduled_from_id_fkey" FOREIGN KEY ("rescheduled_from_id") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calls" ADD CONSTRAINT "calls_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calls" ADD CONSTRAINT "calls_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calls" ADD CONSTRAINT "calls_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_events" ADD CONSTRAINT "webhook_events_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescription_items" ADD CONSTRAINT "prescription_items_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescription_items" ADD CONSTRAINT "prescription_items_prescription_id_fkey" FOREIGN KEY ("prescription_id") REFERENCES "prescriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_assigned_user_id_fkey" FOREIGN KEY ("assigned_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_calls" ADD CONSTRAINT "outbound_calls_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_calls" ADD CONSTRAINT "outbound_calls_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forwarding_schedules" ADD CONSTRAINT "forwarding_schedules_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forwarding_events" ADD CONSTRAINT "forwarding_events_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forwarding_events" ADD CONSTRAINT "forwarding_events_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "forwarding_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;
