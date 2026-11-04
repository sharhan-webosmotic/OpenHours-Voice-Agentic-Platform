# Prototype captures: the visual reference for the clinic dashboard

Every screen and sub-state of `ClinicFlow Interactive Prototype/`, captured from the running
prototype on 2026-11-02 at three viewport widths. These are the fidelity reference for
`apps/clinic-web`: a screen is built from the capture, not from memory and not from a
screenshot pasted into a chat.

## Why they are committed

The prototype is a Vite project with no installed dependencies in this repository, so seeing
it means installing it and running it. A reviewer checking whether a built screen matches the
design should not have to do that, and neither should a later session. The captures are the
artefact that makes the comparison possible from a clean checkout.

They were produced by driving the prototype with Playwright rather than by hand, so the set is
complete rather than whatever someone remembered to photograph.

## Naming

`<width>-<order>-<screen>.png`, plus `state-<order>-<name>.png` for sub-states captured at
1920 only.

| Prefix     | Viewport    | What it is for                                                                                 |
| ---------- | ----------- | ---------------------------------------------------------------------------------------------- |
| `desktop-` | 1920 x 1080 | The width the Overview design was authored at (`min-w-[1920px]`). The authoritative reference. |
| `laptop-`  | 1440 x 900  | The primary target width.                                                                      |
| `tablet-`  | 1024 x 768  | The narrow target width.                                                                       |
| `state-`   | 1920 x 1080 | Wizard steps, confirm dialogs and editors.                                                     |

Captures are at a device pixel ratio of 2, so a 1440 capture is a 2880 pixel wide file.

## The set

| Order                    | Screen                                                                     | Notes                                                                                                                                    |
| ------------------------ | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `auth-01` to `auth-04`   | Sign in, forgot password, reset sent, choose new password                  | The prototype simulates the reset flow. D-003 means the product has no reset email, so only the sign-in screen has a product equivalent. |
| `01`                     | Overview                                                                   | The embedded Figma export. Fixed 1920 width, which is why it clips in the `laptop` and `tablet` captures.                                |
| `02`                     | Profile popover                                                            |                                                                                                                                          |
| `03`                     | Global search panel                                                        |                                                                                                                                          |
| `04`                     | Appointments list                                                          | Filters, status badges, pagination.                                                                                                      |
| `05`                     | Appointment detail drawer                                                  |                                                                                                                                          |
| `06`                     | New appointment wizard, step 1                                             |                                                                                                                                          |
| `07`                     | Calendar and bookings                                                      | Month grid with a day agenda.                                                                                                            |
| `08`                     | Patients list                                                              |                                                                                                                                          |
| `09`                     | Add patient modal                                                          |                                                                                                                                          |
| `10`                     | Patient profile                                                            | History, follow-ups, notes.                                                                                                              |
| `11`                     | Doctors and staff                                                          | Doctor card, working hours, staff list.                                                                                                  |
| `12`                     | Services                                                                   |                                                                                                                                          |
| `13`                     | Service editor                                                             |                                                                                                                                          |
| `14`                     | Call history                                                               |                                                                                                                                          |
| `15`                     | Call detail drawer                                                         | Summary only. No transcript panel and no player: both are deviations recorded in the feature doc.                                        |
| `16`                     | Reminders                                                                  |                                                                                                                                          |
| `17`                     | Reports                                                                    |                                                                                                                                          |
| `18`                     | Clinic settings                                                            |                                                                                                                                          |
| `19`                     | Follow-ups                                                                 | Prototype screen with no sidebar entry. Deliberately not built.                                                                          |
| `20`                     | Follow-up editor                                                           |                                                                                                                                          |
| `21`                     | Notifications popover                                                      |                                                                                                                                          |
| `state-30` to `state-33` | Booking wizard: validation error, service step, date and time step, review |                                                                                                                                          |
| `state-34`, `state-35`   | Appointment detail and its inline cancel confirmation                      |                                                                                                                                          |
| `state-36` to `state-38` | Patient profile, follow-up editor, patient edit                            |                                                                                                                                          |
| `state-39`               | Service deactivation confirmation                                          |                                                                                                                                          |
| `state-40`               | Working hours editor                                                       |                                                                                                                                          |
| `state-41`               | Clinic settings, full page                                                 |                                                                                                                                          |
| `state-42`               | Logout confirmation                                                        |                                                                                                                                          |

## Reproducing them

The prototype is not installed or built by this repository, and
`ClinicFlow Interactive Prototype/CLAUDE.md` says not to change anything inside it. So the
capture run copies it elsewhere first:

```
rsync -a --exclude node_modules "ClinicFlow Interactive Prototype/" /tmp/proto/
cd /tmp/proto && pnpm install && pnpm dev --port 5199
```

Then drive it with Playwright. The prototype gates on a sign-in screen whose "Demo Access"
button enters without credentials. Two things that cost time the first time:

- The Overview embeds a fixed 1920 pixel design whose own sidebar is not visible at smaller
  widths, so its quick links cannot be clicked. Dispatching a bubbling `click` on the element
  works, because the handler is delegated on the container.
- Escape does not close the drawers or the search panel. They close through their own close
  button.
