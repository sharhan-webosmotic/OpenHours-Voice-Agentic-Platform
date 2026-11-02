# Database backup and restore

**The nightly dump is the only copy of the database.** Supabase's free tier (D-019) takes no
automated backups, offers no point-in-time recovery and pauses a project after a week of
inactivity. If the database is lost, or a migration goes wrong, the newest object in the
backups bucket is the whole of what survives.

Everything below follows from that sentence.

## What runs, and when

|              |                                                                                  |
| ------------ | -------------------------------------------------------------------------------- |
| Command      | `pnpm db:backup`                                                                 |
| Schedule     | 02:00 Asia/Kolkata, nightly, from cron on the Lightsail instance                 |
| Destination  | `s3://$BACKUPS_BUCKET/postgres/YYYY/MM/DD/clinicai-<timestamp>.sql.gz`           |
| Retention    | 30 days, swept by the same command after a successful upload                     |
| Verification | `pnpm db:restore-check <scratch DATABASE_URL>`, monthly and before every go-live |

The job does four things in this order, and the order is the design:

1. `pg_dump` piped through gzip, never written to disk. The instance has 2 GB and a limited
   volume: a dump that filled it would take the API down to protect the database.
2. Refuses to upload anything under 1 KB. A truncated dump that overwrote a good one is worse
   than a night with no backup, because the newest object is what a restore reaches for.
3. Uploads under a dated key, so one night cannot overwrite another.
4. Sweeps expired dumps, and only then. The sweep never deletes the object just written and
   refuses outright if it would leave the bucket empty.

## Setting up the schedule

On the Lightsail instance, as the user that owns the application:

```
crontab -e
```

```cron
# Nightly database backup to R2. The log is what a monitor watches; a non-zero exit is a
# failed backup and must page somebody.
30 20 * * * cd /srv/clinicai && /usr/bin/env pnpm db:backup >> /var/log/clinicai/backup.log 2>&1
```

20:30 UTC is 02:00 in Asia/Kolkata. Cron runs in the instance's zone, so the entry is written in
UTC deliberately rather than relying on the box being configured for India.

**A failed backup must be noticed.** The command exits non-zero and logs the reason. Until
monitoring exists, check `backup.log` on the first of the month, and treat a gap in the bucket's
dated keys as the signal: `aws s3 ls s3://$BACKUPS_BUCKET/postgres/ --recursive | tail -40`.

## Environment

These are read by `apps/api/src/config.ts` and must be set on the instance:

| Variable                                      | Pilot value                                  | Note                                                                  |
| --------------------------------------------- | -------------------------------------------- | --------------------------------------------------------------------- |
| `S3_ENDPOINT`                                 | `https://<account>.r2.cloudflarestorage.com` | Empty means AWS S3                                                    |
| `AWS_REGION`                                  | `auto`                                       | R2 requires the literal `auto`; signing still needs a region          |
| `S3_FORCE_PATH_STYLE`                         | `true`                                       | R2 and SeaweedFS serve buckets as a path segment                      |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | R2 API token pair                            | Scoped to the two buckets, nothing else                               |
| `BACKUPS_BUCKET`                              | `clinicai-backups`                           | Separate from recordings: different lifecycle, different blast radius |
| `BACKUP_RETENTION_DAYS`                       | `30`                                         | `0` is refused by the sweep                                           |
| `DATABASE_URL`                                | Supabase pooler URL                          | The dump reads from here                                              |

**The R2 token is scoped to these two buckets and nothing else.** An account-wide token on a box
that also runs the public API is a token that leaves with the first server compromise.

## Restoring

### Proving a restore works, which is the part that gets skipped

Run monthly, and before any go-live sign-off. It needs an EMPTY scratch database, never the
live one: the command refuses to run against the configured `DATABASE_URL`, because the dump
starts by dropping every object it is about to recreate.

```
pnpm db:restore-check "postgresql://postgres:password@127.0.0.1:5432/clinicai_restore_check"
```

It downloads the newest dump through a presigned URL, decompresses it, restores it with `psql`,
then counts rows in `organisations`, `users`, `patients`, `appointments`, `doctors`,
`services`, `clinic_hours` and `audit_logs`. A dump with no organisations fails the check: that
is a dump of nothing.

**On a machine with no PostgreSQL client binaries**, including a developer laptop, use the
container the local compose file already runs:

```
docker compose up -d postgres
docker compose exec -T postgres createdb -U "$POSTGRES_USER" clinicai_restore_check
pnpm db:restore-check "postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@127.0.0.1:${POSTGRES_PORT:-5432}/clinicai_restore_check"
docker compose exec -T postgres dropdb -U "$POSTGRES_USER" clinicai_restore_check
```

`pnpm db:restore-check` itself calls `psql`, so the host still needs the client. If it does not
have one, pipe the dump through the container instead:

```
# Newest dump, straight into the scratch database inside the container.
KEY=$(aws --endpoint-url "$S3_ENDPOINT" s3 ls "s3://$BACKUPS_BUCKET/postgres/" --recursive \
  | sort | tail -1 | awk '{print $4}')
aws --endpoint-url "$S3_ENDPOINT" s3 cp "s3://$BACKUPS_BUCKET/$KEY" - \
  | gunzip \
  | docker compose exec -T postgres psql -U "$POSTGRES_USER" -d clinicai_restore_check
```

### What the check does NOT prove

The dump is taken with `--no-owner --no-privileges`, so the roles, the grants and the 25
row-level security policies do not come back with it. They are recreated on top:

```
DATABASE_URL="<scratch url>" pnpm db:sql
DATABASE_URL="<scratch url>" pnpm db:check-policies
```

**A restore is not signed off until `db:check-policies` has passed against the restored
database.** A database with the right rows and no policies is a database with no tenant
isolation, and it would serve traffic perfectly well while doing it.

### Restoring for real

In the order given. Steps 2 and 4 are the ones that are easy to skip under pressure and the
ones that decide whether the restore is correct.

1. **Stop the API.** `sudo systemctl stop clinicai-api`. A running application writing into a
   half-restored schema is a second incident on top of the first.
2. **Take a dump of the broken database first, if it still answers.** `pnpm db:backup`. It may
   be the only evidence of what went wrong, and the retention sweep will not delete it today.
3. **Restore into a NEW Supabase project or a new database**, never over the broken one, so the
   broken state stays available for diagnosis.
4. **Recreate the roles and policies**: `pnpm db:sql`, then `pnpm db:check-policies`.
5. **Point `DATABASE_URL` at the restored database** and start the API.
6. **Verify through the product, not the database**: sign in, open a clinic, read a patient
   list, book an appointment. The dashboard exercises tenancy, permissions and the audit trail
   in one pass, which a row count does not.
7. **Write down what was lost.** Recovery is to the last nightly dump, so up to 24 hours of
   bookings, calls and patient records are gone. The clinic has to be told what window that is.

## The one-off checks that need real credentials

Two things cannot be proven from a developer machine and are owed before go-live. Both are
recorded here rather than in somebody's memory.

1. **Presigned URLs against the real R2 bucket.** The integration suite proves the mechanism
   against a non-AWS, path-style endpoint, which is R2's shape, but not against R2 itself. Once:
   upload an object with `pnpm db:backup`, presign it, open the URL in a browser, confirm it
   plays or downloads, wait for the TTL to pass and confirm it stops working.
2. **The isolation suite through the Supabase pooler.** See "Tenant isolation against the
   Supabase pooler" in `docs/STACK.md` for the commands and what to watch for.

## The recovery window, stated plainly

|                          |                                                                         |
| ------------------------ | ----------------------------------------------------------------------- |
| Recovery point objective | Up to 24 hours. The last nightly dump.                                  |
| Recovery time objective  | About an hour: provision a project, restore, re-apply policies, verify. |
| Worst realistic case     | A failure at 01:59 loses almost a full day of clinic activity.          |

**That window is a consequence of the free tier, not of this design.** Supabase's paid tier adds
daily backups and point-in-time recovery, which would take the objective from 24 hours to
minutes. Until then the nightly dump is the whole plan, and it is worth re-reading that sentence
before a second clinic is onboarded.
