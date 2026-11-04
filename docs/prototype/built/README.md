# The built dashboard, beside the prototype it was built from

Screenshots of `apps/clinic-web` running against a real API, a real PostgreSQL database and a
provisioned clinic with synthetic data, captured on 2026-11-02 at the same two widths as the
prototype captures in the directory above.

**They are here so the comparison can be made from a clean checkout**, without standing up the
stack. The pairing is the point: each row below is the same screen twice, the prototype first.

## The pairing

| Screen             | Prototype                                                 | Built                              |
| ------------------ | --------------------------------------------------------- | ---------------------------------- |
| Overview           | `../laptop-01-overview.png`, `../desktop-01-overview.png` | `laptop-01-overview.png`           |
| Appointments       | `../laptop-04-appointments-list.png`                      | `laptop-02-appointments.png`       |
| Patients           | `../laptop-08-patients-list.png`                          | `laptop-03-patients.png`           |
| Doctors and Staff  | `../laptop-11-staff.png`                                  | `laptop-04-staff.png`              |
| Services           | `../laptop-12-services.png`                               | `laptop-05-services.png`           |
| Call History       | `../laptop-14-calls-list.png`                             | `laptop-06-calls.png`              |
| Reminders          | `../laptop-16-reminders.png`                              | `laptop-07-reminders.png`          |
| Reports            | `../laptop-17-reports.png`                                | `laptop-08-reports.png`            |
| Clinic Settings    | `../laptop-18-settings.png`                               | `laptop-09-settings.png`           |
| Patient profile    | `../state-36-patient-profile.png`                         | `laptop-10-patient-profile.png`    |
| Appointment detail | `../state-34-appointment-detail.png`                      | `laptop-11-appointment-detail.png` |
| Booking, step 1    | `../laptop-06-appointment-form.png`                       | `laptop-12-booking-step-1.png`     |
| Booking, step 2    | `../state-31-wizard-2-service.png`                        | `laptop-13-booking-step-2.png`     |
| Booking, step 3    | `../state-32-wizard-3-datetime.png`                       | `laptop-14-booking-step-3.png`     |

Each one exists as `laptop-` (1440 x 900) and `tablet-` (1024 x 768), at a device pixel ratio
of 2.

## What the clinic in these screenshots contains

Provisioned with `pnpm provision:clinic` and then filled with synthetic data: one doctor, four
services, Monday to Friday 09:00 to 13:00 and 14:00 to 18:00 with a lunch break, a booking
policy on a 15-minute grid, five patients and six appointments across today and the following
Monday. Every name is invented and every number is in the Indian mobile range and belongs to
nobody.

## Three differences a reader will notice first

1. **Call History, Reminders and Reports are empty on purpose.** The prototype fills all three
   with invented figures. There is no endpoint behind any of them, so each says what it is for,
   that the data does not exist, and what has to land first.
2. **The Overview is re-flowed, not clipped.** The prototype's own `laptop-01-overview.png`
   shows the right-hand column cut off: it is a Figma export with `min-w-[1920px]` and no
   responsive behaviour. The card order and the hierarchy are kept, and the grid collapses.
3. **The data is a real clinic's.** Times are in `Asia/Kolkata` because the organisation says
   so, prices are rupees, and the status badges are derived from the appointment's real status
   and source rather than from a fixed list.

## Reproducing them

```
docker compose up -d postgres
pnpm db:migrate && pnpm db:sql
pnpm provision:clinic "Shot Clinic"
pnpm --filter @clinicai/api dev
pnpm --filter @clinicai/clinic-web dev
```

Then sign in as the owner the provisioning printed, change the temporary password when asked,
and walk the nine sidebar items. The capture script lives in the session scratchpad rather than
in the repository, because it is one Playwright file with the credentials passed in, and a
script that needs a one-time password cannot be run by anybody else as it stands.

**One thing that cost half an hour and is worth knowing:** fourteen stale `tsx watch` API
processes from earlier sessions were holding port 3000 against an older database, so every
sign-in failed with "Email or password is incorrect" while the credentials were provably
correct. If that happens, check for more than one API process before doubting the password.
