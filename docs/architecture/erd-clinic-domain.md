# ERD: clinic domain (M1-05)

Extends [the identity, tenancy and audit ERD](erd-identity-tenancy-audit.md). Generated from
`apps/api/prisma/schema.prisma`; update both together.

```mermaid
erDiagram
    organisations ||--o{ clinic_hours : "opening hours"
    organisations ||--o{ doctors : employs
    organisations ||--o{ services : offers
    organisations ||--o{ patients : "registers (PHI)"
    organisations ||--o{ appointments : books
    organisations ||--o{ calls : "handles (PHI)"
    organisations ||--o{ forwarding_schedules : "forwards by"
    organisations |o--o{ webhook_events : "resolved to (NULL until parsed)"

    users |o--|| doctors : "login for"
    doctors ||--o{ doctor_working_hours : "available"
    doctors ||--o{ doctor_time_off : "away"
    doctors ||--o{ doctor_services : performs
    services ||--o{ doctor_services : "performed by"
    doctors ||--o{ appointments : "sees"
    patients ||--o{ appointments : attends
    services |o--o{ appointments : "booked as"
    appointments |o--|| appointments : "rescheduled from"
    appointments |o--o{ calls : "created by"
    patients |o--o{ calls : "caller matched to"
    patients ||--o{ prescriptions : "issued (PHI)"
    doctors ||--o{ prescriptions : writes
    prescriptions ||--o{ prescription_items : contains
    patients ||--o{ follow_ups : "needs"
    users |o--o{ follow_ups : "assigned to"
    patients |o--o{ outbound_calls : "called about"
    forwarding_schedules ||--o{ forwarding_events : "reported by device"

    clinic_hours {
        uuid organisation_id FK
        weekday weekday
        int opens_at_minute "clinic-local minutes from midnight"
        int closes_at_minute
    }
    doctors {
        uuid organisation_id FK
        uuid user_id FK "UK, nullable: bookable without a login"
        text full_name
        int buffer_minutes
        timestamptz deleted_at "soft delete"
    }
    services {
        uuid organisation_id FK
        text name "unique per org"
        int duration_minutes
        int price_minor "integer minor units"
    }
    patients {
        uuid organisation_id FK
        text full_name "PHI, trigram index in M1-06"
        text phone "PHI, indexed NOT unique"
        date date_of_birth "PHI"
        text notes "PHI"
        timestamptz deleted_at "soft delete"
    }
    appointments {
        uuid organisation_id FK
        uuid patient_id FK
        uuid doctor_id FK
        timestamptz start_at
        timestamptz end_at
        appointment_status status
        appointment_source source
        text idempotency_key "unique per organisation"
        uuid rescheduled_from_id FK "UK"
    }
    calls {
        uuid organisation_id FK
        text external_call_id "unique with provider"
        call_direction direction
        call_status status
        call_outcome outcome
        text from_e164 "PHI"
        text recording_key "private S3 key, PHI"
        text transcript "PHI"
    }
    webhook_events {
        uuid organisation_id FK "NULL until resolved"
        text external_event_id "unique with provider"
        webhook_event_status status
        jsonb payload "raw provider body, may contain PHI"
        int attempts
    }
    outbound_calls {
        uuid organisation_id FK
        text dedupe_key UK "globally unique: a retry must not call twice"
        outbound_call_status status
        timestamptz scheduled_at
        int attempts
    }
```

## Decisions worth knowing

**Opening hours are stored as clinic-local minutes from midnight, not as timestamps.**
`clinic_hours`, `doctor_working_hours` and `forwarding_schedules` all do this. A clinic that
opens at 09:00 opens at 09:00 on both sides of a DST transition; storing an instant would
shift it. The instant is derived at the edges from `organisations.timezone`.

**`patients.phone` is indexed but deliberately not unique.** Families share a number, and a
clinic may legitimately hold two records against one number until someone merges them. The
voice agent therefore links a caller to a patient only when exactly one record matches.

**`appointments.idempotency_key` is unique per organisation, not globally**, so two clinics
cannot collide on one key. It satisfies root CLAUDE.md rule 8 for the create path the voice
agent can reach.

**`outbound_calls.dedupe_key` IS globally unique.** A worker restart must never place a second
call to a patient (`apps/api/CLAUDE.md`), and the key is derived from what the call is for
rather than from when it was queued, so a retry collides with the original by construction.

**`webhook_events.organisation_id` is nullable.** A provider payload is stored before it is
understood, so the organisation is unknown at insert time. Unresolved rows are reachable only
with `app.platform = 'on'` — which is exactly who needs to see a webhook that failed to
resolve. `(provider, external_event_id)` is unique, which is what makes processing idempotent.

**Money is integer minor units** (`price_minor`, `cost_minor`); never a float.

**Soft deletes** on `patients`, `doctors` and `services`, because appointment and prescription
history must outlive the removal of the row it points at.

## Index coverage

Verified against the migrated database: **23 tables carry `organisation_id`, and every one of
them has at least one index whose FIRST column is `organisation_id`** — the ordering that
matters, since every tenant query filters on it before anything else.
