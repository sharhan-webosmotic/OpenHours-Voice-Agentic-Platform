# Feature 2 (pilot clinic setup): review not performed

Review date: 2026-10-29. Reviewer: fresh session, review-only mandate.

## Verdict

**Not applicable: there is nothing to review.** Feature 2 (pilot clinic setup) has not
been implemented in this repository. There is no branch, no commit, no code and no
specification document for it. The requested review asked for seven sections of findings
against a bootstrap command, new tenant tables, clinic configuration validation, a
permission matrix surface, prompt rendering and admin setup screens. None of those
artefacts exist, so none of the seven sections could be executed, and no verdict on
"safe to build on" is meaningful. The repository is currently at the end of Feature 1
(sign-in and session) on branch `feat/sign-in-and-session`, and its gate is green. This
document records what was checked and what was found in place of Feature 2, so the search
does not have to be repeated. It deliberately contains no findings: reporting graded
defects against code that does not exist would be fabrication, which is the failure mode
the three earlier reviews were meant to guard against.

## What the review was pointed at, and what is actually there

The review named `docs/features/pilot-clinic.md` as required reading. That file does not
exist. `docs/features/` contains exactly one document, `sign-in.md`.

The branch under review was described as "the branch for Feature 2 (pilot clinic setup)
against main". No such branch exists. The complete branch list, local and remote after
`git fetch --all --prune`, is: `main`, `chore/strip-adf-framework`,
`feat/foundation-backend`, `feat/foundation-setup`, `feat/m1-02-config-logging-errors`,
`feat/sign-in-and-session` and `fix/foundation-review`. The checked-out branch is
`feat/sign-in-and-session`, whose most recent commit is `9966f73 chore: rename the product
to ClinicAI, all the way down`. Its working tree is clean. There are no stashes and no
additional worktrees.

### Evidence that Feature 2 was never started

- `git log --all --diff-filter=D --name-only` returns no deleted or renamed path matching
  `pilot`, `feature-2`, `feature2` or `clinic-setup`. The feature was never committed and
  later removed. It was never committed at all.
- A search across every reachable commit on every branch (`git grep` over
  `git rev-list --all --branches`) found no occurrence of a bootstrap command, no
  `SUPER_ADMIN` creation path, no `openingHours` or `opening_hours` field, and no
  `templateVersion` or `template_version` field.
- `docs/ROADMAP.md` corroborates this. Its progress table records 2 of 92 tickets closed,
  with M0 at 1/8 and M1 at 1/14, and every milestone from M2 onward marked "Not started".
  The clinic-core backend work (M2-01 doctors, working hours, time off, services, clinic
  hours) and the admin onboarding screens (M4-04 clinics list, M4-05 clinic onboarding
  wizard, M4-06 clinic detail and edit) are all unstarted tickets. Note also that the
  roadmap does not use "Feature 2" as an identifier. It numbers work as milestone tickets
  (M1-01 and similar), and "pilot clinic" appears in it only as the M8 go-live checklist,
  not as a setup feature.

### What exists that resembles parts of the requested scope

Three things exist that a reader might mistake for Feature 2, and it is worth being
precise about each, because the difference is the whole reason this review is empty.

**The clinic-domain tables exist, but only as schema.** Migration
`20261027120809_clinic_domain` creates `clinic_hours`, `doctors`, `doctor_working_hours`,
`doctor_time_off`, `services`, `doctor_services`, `patients`, `appointments`, `calls`,
`webhook_events`, `prescriptions`, `prescription_items`, `follow_ups`, `outbound_calls`,
`forwarding_schedules` and `forwarding_events`. This is ticket M1-05 (Prisma schema:
clinic domain), part of the backend foundation, not Feature 2. There is no API module for
any of these tables. `apps/api/src/modules/` contains four modules only: `audit`, `auth`,
`devices` and `support-sessions`. There are no routes, no services, no repositories and no
zod schemas for services, doctors or clinic configuration, so section 3 of the review
(validation, which "this feature claims is production grade") has no surface to test, and
section 4 has no new matrix cell to exercise.

**There is a provisioning command, but it is not the bootstrap command described.**
`apps/api/prisma/provision-clinic.ts` (223 lines, exposed as `pnpm provision:clinic`)
comes from Feature 1, commit `7643b69 feat(api): provision a clinic with one-time
temporary passwords`. It creates one clinic with an owner, a manager and a staff user,
each holding a one-time temporary password. It is not a first-SUPER_ADMIN bootstrap, it
has no confirmation environment variable, and it does not claim to refuse a second run.
Its stated safety property is different: it refuses to run against any host outside an
allow-list of local hosts, so a stray `DATABASE_URL` cannot point it at staging. The
specific behaviours section 1 demanded be proved (second run refuses, refuses once a
SUPER_ADMIN exists by other means, refuses without the confirmation variable) are
properties of a command that has not been written. This file was read, not reviewed. It
belongs to Feature 1 and is outside the review's stated scope.

**The admin screens are placeholders.** `apps/admin-web/src/features/` contains an `auth`
directory (sign-in, forced password change, no-access) and a `placeholders` directory.
There is no clinics list, no onboarding wizard, no readiness indicator and no clinic
detail screen, so section 6 has nothing to load, paginate or inspect for escaping. There
is likewise no prompt template anywhere in the tree, so section 5 has nothing to examine.

## Checks that were run

The gate the review asked for was run in full, on the current branch, to confirm the
baseline is healthy and to be certain no Feature 2 code was hiding behind a build failure.

Command: `npx turbo run build typecheck test --force`
Result: exit code 0. 16 of 16 tasks successful, 0 cached, 1m6.859s.

Test totals, per package, as reported by the run:

| Package                | Test files | Tests   |
| ---------------------- | ---------- | ------- |
| `@clinicai/api`        | 37         | 536     |
| `@clinicai/shared`     | 2          | 116     |
| `@clinicai/clinic-web` | 4          | 115     |
| `@clinicai/admin-web`  | 2          | 53      |
| `@clinicai/api-client` | 1          | 14      |
| **Total**              | **46**     | **834** |

All 834 passed. These numbers describe Feature 1 and the foundation. They are not evidence
about Feature 2.

## What could not be checked

Everything the review asked for. Listed explicitly so the gap is not mistaken for a clean
result:

1. The bootstrap command: HTTP reachability, double-run refusal, refusal once a SUPER_ADMIN
   exists, refusal without the confirmation variable, password strength and source, hash
   parameters, password leakage into logs or snapshots, the audit row and its survival
   across a later failure, and protection against a production run. The command does not
   exist.
2. The data model: RLS enabled and forced on new tenant tables, policy presence, the
   check-policies guard catching an unpoliced table, cross-tenant read, update and delete
   returning 404, migration behaviour against empty and seeded databases, and the Sarvam
   mapping and per-clinic tool secret hashing. No new tenant table was added by this
   feature, and the per-clinic tool secret does not exist.
3. Validation: every case named (phone spacing, brackets, leading zero, a +1 number, an
   eleven-digit Indian number, case-differing email, "IST" and "GMT+5:30" timezones,
   inverted opening hours, a break outside opening hours, zero or negative duration, a
   10,000-character field) and the partial-write question. There is no endpoint to send
   them to.
4. Permissions and audit: per-cell granted and denied tests through the real middleware
   chain, the `requirePermission` removal sabotage, and configuration-change audit
   payloads. The feature exposes no matrix cell.
5. Prompt rendering: interpolation surface and template versioning. No template exists.
6. Admin screens: server-side pagination at 200 clinics, readiness indicator truthfulness,
   escaping and secret rendering. The screens are placeholders.
7. Test quality: tests copied from the implementation rather than the spec, the three
   sabotage-and-revert exercises, and per-file coverage against the CLAUDE.md floors. There
   are no Feature 2 tests, and no coverage run was performed, since coverage of Feature 1
   would not answer the question asked.

Two further limits worth recording. No sabotage, scratch database or scratch-copy
experiment was performed, because each one presupposed Feature 2 code to sabotage. And no
file was modified: the review-only mandate was honoured, and this document is the only
file written.

## Suggested next step

Confirm which target was intended. The three possibilities are that Feature 2 is genuinely
not yet built and the review was issued early, that it was built in a different clone or
on a machine whose branch was never pushed to `origin`, or that a different body of work
was meant (the Feature 1 sign-in branch is the only reviewable feature branch here, and it
has already been through review). Nothing further should be reviewed until the target is
named, and this file should be replaced, not appended to, once there is real code to
assess.
