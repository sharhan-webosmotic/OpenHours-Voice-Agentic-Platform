-- Notes on an appointment, from the booking sheet's "Notes (optional)".
--
-- Approved by the clinic on 2026-11-03. Phase 2 left the field out rather than accepting text
-- and dropping it, because a box that looks saved and is not is worse than no box.
--
-- PATIENT DATA. The application never logs it, never puts it in an audit row, nulls it for a
-- platform role's masked read, and copies it to the new row when an appointment is
-- rescheduled (a reschedule creates a row, and a note that vanished on a reschedule would be
-- a note lost without anybody deleting it).
--
-- Additive and nullable, so it is safe on a populated table: existing appointments simply
-- have no note.
ALTER TABLE "appointments" ADD COLUMN "notes" TEXT;

-- Bounded in the database as well as in the schema, because this is free text a person types
-- and the API is not the only thing that will ever write to this table.
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_notes_length" CHECK (char_length("notes") <= 2000);
