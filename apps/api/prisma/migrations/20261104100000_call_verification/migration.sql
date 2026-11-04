-- Whether Sarvam's own records hold a call, and separately whether it has audio.
--
-- D-006 as amended on 2026-11-04: a webhook's call and transcript are created from the payload
-- straight away, with no provider re-read before them, and verified after the fact. The
-- recording job, which authenticates to Sarvam for the interaction anyway, looks it up in the
-- interactions list and records the answer here. The dashboard flags only NOT_FOUND.
--
-- TWO COLUMNS FOR TWO FACTS. A recording request answers 404 both for an interaction that
-- does not exist and for a real call that was not recorded (consent declined, or a clinic
-- set to NOT_RECORDED), so "is there audio" cannot stand in for "did this call happen".
--
-- Additive and safe on a populated table: existing calls become UNCHECKED, which is true of
-- them, and have no recording answer yet. Awaiting the second-person review every migration
-- needs.
CREATE TYPE "call_verification" AS ENUM ('UNCHECKED', 'VERIFIED', 'NOT_FOUND');

ALTER TABLE "calls" ADD COLUMN "verification" "call_verification" NOT NULL DEFAULT 'UNCHECKED';
ALTER TABLE "calls" ADD COLUMN "verified_at" TIMESTAMPTZ(6);
ALTER TABLE "calls" ADD COLUMN "has_recording" BOOLEAN;
