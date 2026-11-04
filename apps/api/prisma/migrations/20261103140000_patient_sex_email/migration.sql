-- A patient's sex and email, as the patients reference shows them.
--
-- Approved by the clinic on 2026-11-03: sex as Female or Male only, with null meaning "not
-- recorded", and an optional email. Awaiting the second-person review every migration needs.
--
-- PATIENT DATA, both of them. The application never logs either, never puts either in an
-- audit row, and nulls both for a platform role's masked read. The voice agent never asks
-- for either and never writes either.
--
-- Additive and nullable, so it is safe on a populated table: existing patients are simply
-- "not recorded" and have no email.
CREATE TYPE "patient_sex" AS ENUM ('FEMALE', 'MALE');

ALTER TABLE "patients" ADD COLUMN "sex" "patient_sex";
ALTER TABLE "patients" ADD COLUMN "email" TEXT;

-- Bounded in the database as well as in the schema: 254 is the longest address SMTP allows.
ALTER TABLE "patients" ADD CONSTRAINT "patients_email_length" CHECK (char_length("email") <= 254);
