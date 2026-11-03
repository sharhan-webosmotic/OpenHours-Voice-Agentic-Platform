-- The service's listed price at the moment an appointment was booked.
--
-- Requested by the clinic on 2026-11-03, alongside hiding the revenue card (D-023). Any future
-- revenue figure needs the price a booking was MADE at: read through to `services`, a price
-- change silently rewrites every past booking's value. It costs nothing to keep now and
-- cannot be recovered later.
--
-- Additive and nullable, so it is safe on a populated table. Appointments booked before this
-- migration have no stored price and keep none: the price they were booked at is not known,
-- and back-filling today's price would be the very rewrite this column exists to prevent.
-- Awaiting the second-person review every migration needs.
ALTER TABLE "appointments" ADD COLUMN "price_minor" INTEGER;

-- Money is integer minor units and never negative, as `services_non_negative_price` holds.
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_price_non_negative" CHECK (price_minor IS NULL OR price_minor >= 0);
