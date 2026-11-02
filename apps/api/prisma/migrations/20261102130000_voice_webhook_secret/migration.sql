-- A per-deployment webhook secret, separate from the tool secret.
--
-- D-006 authenticates a Sarvam webhook with three measures, the first being a long random
-- secret in the URL path, because Sarvam documents no signature scheme (docs/sarvam-contract.md
-- section 7). That secret travels in a URL, where proxies and access logs can see it, so it
-- must not be the same value the tool endpoints accept as a bearer credential.
--
-- Stored as a SHA-256 hash only, like the tool secret (D-012): minted by the platform, shown
-- once, never readable back.
ALTER TABLE "voice_agents" ADD COLUMN "webhook_secret_hash" TEXT;
ALTER TABLE "voice_agents" ADD COLUMN "webhook_secret_set_at" TIMESTAMPTZ(6);

-- Resolving a webhook to a clinic is an index probe, not a scan. Unique because two clinics
-- sharing the secret would mean either clinic's calls could be attributed to the other, and
-- nothing else would notice. Many NULLs are permitted in a PostgreSQL unique index, so
-- clinics whose secret has not been minted yet are unaffected.
CREATE UNIQUE INDEX "voice_agents_webhook_secret_hash_key" ON "voice_agents" ("webhook_secret_hash");

-- The webhook payload names a deployment; the clinic is resolved from this table by that id
-- rather than from anything the payload claims.
CREATE INDEX "voice_agents_provider_sarvam_deployment_id_idx" ON "voice_agents" ("provider", "sarvam_deployment_id");
