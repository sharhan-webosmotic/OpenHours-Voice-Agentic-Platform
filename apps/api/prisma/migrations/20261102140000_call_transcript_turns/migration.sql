-- One turn of one call's transcript, rather than a single text column on `calls`.
--
-- The dashboard shows a transcript as a conversation with each turn attributed, and a text
-- column would mean inventing a line format and parsing it back out in the browser. The
-- mapping in docs/sarvam-contract.md section 8 names a transcript table for the same reason.
-- `calls.transcript` stays as the plain-text rendering, which is what an export wants.
--
-- ROW-LEVEL SECURITY COMES FROM prisma/sql/003_pilot_clinic.sql, which loops over every table
-- carrying an `organisation_id` and applies the tenant policy. So `pnpm db:sql` must be run
-- after this migration, which is already the documented order, and the isolation suite
-- enumerates tenant tables dynamically and will cover this one without being edited.
CREATE TYPE "call_transcript_role" AS ENUM ('AGENT', 'CALLER', 'OTHER');

CREATE TABLE "call_transcript_turns" (
  "id" UUID NOT NULL,
  "organisation_id" UUID NOT NULL,
  "call_id" UUID NOT NULL,
  "turn_index" INTEGER NOT NULL,
  "role" "call_transcript_role" NOT NULL,
  "text" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),

  CONSTRAINT "call_transcript_turns_pkey" PRIMARY KEY ("id")
);

-- Re-ingesting the same call replaces its turns rather than appending a second copy, which is
-- what makes the ingestion job idempotent on the provider's interaction id.
CREATE UNIQUE INDEX "call_transcript_turns_call_id_turn_index_key"
  ON "call_transcript_turns" ("call_id", "turn_index");

CREATE INDEX "call_transcript_turns_organisation_id_call_id_turn_index_idx"
  ON "call_transcript_turns" ("organisation_id", "call_id", "turn_index");

ALTER TABLE "call_transcript_turns"
  ADD CONSTRAINT "call_transcript_turns_organisation_id_fkey"
  FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "call_transcript_turns"
  ADD CONSTRAINT "call_transcript_turns_call_id_fkey"
  FOREIGN KEY ("call_id") REFERENCES "calls"("id") ON DELETE CASCADE ON UPDATE CASCADE;
