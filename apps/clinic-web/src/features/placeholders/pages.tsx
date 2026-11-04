import { PlaceholderPage } from './PlaceholderPage';

/**
 * The screens whose endpoints do not exist yet.
 *
 * ─── WHY THESE ARE NOT MOCKED ───────────────────────────────────────────────────
 *
 * Every one of them has a prototype capture full of plausible numbers: call volumes, revenue
 * estimates, reminder schedules. Rendering those would produce a screen somebody screenshots
 * for a clinic, and a fabricated call count in a clinical product is not a placeholder, it is
 * a false claim about what the agent did. So each screen says what it is for, says that the
 * data does not exist yet, and names what has to land first.
 *
 * The three that remain are the three with no API at all. Overview, Appointments, Patients,
 * Doctors and Staff, Services and Clinic Settings are built against real endpoints.
 */

export const RemindersPage = () => (
  <PlaceholderPage
    description="Appointment reminders, and when they go out."
    next="Reminders have no tables and no endpoints in the platform yet. They depend on the outbound calling jobs, which arrive after the voice integration, and on a decision about what a clinic may send and when. The schedule shown in the prototype is illustrative and is deliberately not reproduced."
  />
);

export const ReportsPage = () => (
  <PlaceholderPage
    description="How the clinic and the agent are performing."
    next="There is no analytics endpoint. The figures in the prototype, including the revenue estimate and the call outcome split, are invented demo values: showing them against a real clinic would put numbers on a screen that nothing in the platform can support. Reporting arrives once appointments and call history have enough history to report on."
  />
);
