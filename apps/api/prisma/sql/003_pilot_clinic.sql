-- Feature 2 (pilot clinic setup): policies, grants and the constraints Prisma cannot express.
--
-- A separate file rather than an edit to 001 or 002, because both are already recorded as
-- applied and apply.ts does not re-run a recorded file. The policy and grant loop is
-- repeated verbatim for the third time, which is deliberate: each file is a complete,
-- self-contained statement of what it applies, and check-policies.ts is what guarantees no
-- tenant table is ever left without one.
--
-- Covers five new tenant tables: clinic_profiles, clinic_booking_policies,
-- clinic_agent_profiles, clinic_telephony, clinic_faqs.

-- ─── 1. Row-level security and grants for every tenant table ────────────────────
DO $$
DECLARE
  target record;
BEGIN
  FOR target IN
    SELECT c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attname = 'organisation_id' AND a.attnum > 0
    WHERE n.nspname = 'public' AND c.relkind = 'r'
    ORDER BY c.relname
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', target.table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', target.table_name);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', target.table_name);
    EXECUTE format($pol$
      CREATE POLICY tenant_isolation ON %I
        USING (
          organisation_id = NULLIF(current_setting('app.org_id', true), '')::uuid
          OR current_setting('app.platform', true) = 'on'
        )
        WITH CHECK (
          organisation_id = NULLIF(current_setting('app.org_id', true), '')::uuid
          OR current_setting('app.platform', true) = 'on'
        )
    $pol$, target.table_name);

    IF target.table_name = 'audit_logs' THEN
      EXECUTE 'REVOKE ALL ON audit_logs FROM app_user';
      EXECUTE 'GRANT SELECT, INSERT ON audit_logs TO app_user';
    ELSE
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO app_user', target.table_name);
    END IF;
  END LOOP;
END
$$;

-- ─── 2. No two clinics with the same name ───────────────────────────────────────
-- A DOUBLE-SUBMITTED CREATE MUST NOT LEAVE TWO HALF-CONFIGURED CLINICS BEHIND.
--
-- The console disables its button while a create is in flight, and that is a courtesy
-- rather than a control: a slow network, a double click on a re-enabled button or a retried
-- request all arrive as two POSTs that the server cannot distinguish by intent. This
-- constraint is what actually prevents the duplicate, and the service maps the violation to
-- a 409 that tells the operator to search the list first.
--
-- KEYED ON THE NAME, CASE-INSENSITIVELY, AND NOT ON THE CLINIC'S PHONE NUMBER. The phone
-- number was the first choice and it was wrong: 001 deliberately leaves CLINIC_LINE numbers
-- unconstrained, with "a shared reception number is a legitimate configuration" written
-- beside the partial index, and `tests/constraints.test.ts` asserts that two organisations
-- may share one. Overriding that to get a double-submit guard would have traded a real
-- allowance for a convenience.
--
-- A name is a good key here because a retry sends the identical name, and because
-- multi-branch clinics are out of scope: two clinics with one name are a duplicate by
-- definition today. THAT IS THE ASSUMPTION TO REVISIT when branches arrive, and
-- docs/features/pilot-clinic.md records it.
CREATE UNIQUE INDEX IF NOT EXISTS organisations_name_unique
  ON organisations (lower(name));

-- ─── 3. Opening hours cannot describe an impossible day ─────────────────────────
-- The shared zod schema rejects these too. This is the second lock, for the same reason
-- row-level security exists beside the tenant client: a direct write, a future job or a
-- repository that forgets to validate must not be able to store a day that cannot happen.
-- Minutes from clinic-local midnight, so 1440 is the end of the day and nothing exceeds it.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'clinic_hours_sane_window') THEN
    ALTER TABLE clinic_hours
      ADD CONSTRAINT clinic_hours_sane_window
      CHECK (
        opens_at_minute >= 0
        AND closes_at_minute <= 1440
        -- Strictly greater, so a zero-length opening is refused as well as an overnight
        -- one. Overnight hours are out of scope for now and are recorded as such in
        -- docs/features/pilot-clinic.md.
        AND closes_at_minute > opens_at_minute
      );
  END IF;
END
$$;

-- No two opening segments on one weekday may overlap.
--
-- An exclusion constraint rather than a check-then-insert: two concurrent saves would both
-- pass a read before either wrote. btree_gist (created in 001) supplies the `=` operator for
-- uuid and for the weekday enum, so both can sit in a GiST index beside the range.
-- '[)' makes the closing minute exclusive, so 09:00-13:00 and 13:00-20:00 do not collide at
-- the database level; the zod schema is what refuses them as one opening written as two.
--
-- THE ENUM COLUMN IS USED AS IT IS, NOT CAST TO text. `weekday::text` was the first attempt
-- and PostgreSQL refused it: "functions in index expression must be marked IMMUTABLE",
-- because an enum-to-text cast is only STABLE (the label could in principle be renamed).
-- btree_gist supports enum types directly, so no cast is needed or wanted.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'clinic_hours_no_overlap') THEN
    ALTER TABLE clinic_hours
      ADD CONSTRAINT clinic_hours_no_overlap
      EXCLUDE USING gist (
        organisation_id WITH =,
        weekday WITH =,
        int4range(opens_at_minute, closes_at_minute, '[)') WITH &&
      );
  END IF;
END
$$;

-- ─── 4. A service has a real duration and a non-negative price ──────────────────
-- A zero-minute service is bookable in an infinite number of slots; a negative one makes
-- the end of an appointment precede its start. Both would reach the availability query as
-- arithmetic rather than as an error.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'services_positive_duration') THEN
    ALTER TABLE services
      ADD CONSTRAINT services_positive_duration
      CHECK (duration_minutes > 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'services_non_negative_price') THEN
    ALTER TABLE services
      ADD CONSTRAINT services_non_negative_price
      CHECK (price_minor IS NULL OR price_minor >= 0);
  END IF;
END
$$;

-- ─── 5. Buffers and policy numbers cannot be negative ───────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'doctors_non_negative_buffer') THEN
    ALTER TABLE doctors
      ADD CONSTRAINT doctors_non_negative_buffer
      CHECK (buffer_minutes >= 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'clinic_booking_policies_sane') THEN
    ALTER TABLE clinic_booking_policies
      ADD CONSTRAINT clinic_booking_policies_sane
      CHECK (
        (slot_granularity_minutes IS NULL OR slot_granularity_minutes > 0)
        AND (minimum_notice_minutes IS NULL OR minimum_notice_minutes >= 0)
        AND (maximum_advance_days IS NULL OR maximum_advance_days > 0)
        AND (cancellation_window_hours IS NULL OR cancellation_window_hours >= 0)
        AND (default_buffer_minutes IS NULL OR default_buffer_minutes >= 0)
        AND (max_per_slot IS NULL OR max_per_slot > 0)
      );
  END IF;
END
$$;

-- ─── 6. A confirmed consent names who confirmed it ──────────────────────────────
-- Consent recorded with nobody attached is not evidence of anything. The two columns move
-- together or not at all.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'clinic_telephony_consent_attributed') THEN
    ALTER TABLE clinic_telephony
      ADD CONSTRAINT clinic_telephony_consent_attributed
      CHECK (
        (consent_confirmed_at IS NULL AND consent_confirmed_by_name IS NULL)
        OR (consent_confirmed_at IS NOT NULL AND consent_confirmed_by_name IS NOT NULL)
      );
  END IF;
END
$$;

-- ─── 7. A tool secret and the time it was set move together ─────────────────────
-- Otherwise "has a secret" and "when was it issued" could disagree, and the readiness
-- check reads the first while an operator reads the second.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'voice_agents_tool_secret_dated') THEN
    ALTER TABLE voice_agents
      ADD CONSTRAINT voice_agents_tool_secret_dated
      CHECK (
        (tool_secret_hash IS NULL AND tool_secret_set_at IS NULL)
        OR (tool_secret_hash IS NOT NULL AND tool_secret_set_at IS NOT NULL)
      );
  END IF;
END
$$;

-- ─── 8. Searching the clinic list by name ───────────────────────────────────────
-- The list is searched with ILIKE on name. A trigram index keeps that from becoming a
-- sequential scan as the number of clinics grows. Small today, and cheap enough that
-- adding it now costs less than discovering it later.
CREATE INDEX IF NOT EXISTS organisations_name_trgm
  ON organisations USING gin (name gin_trgm_ops);
