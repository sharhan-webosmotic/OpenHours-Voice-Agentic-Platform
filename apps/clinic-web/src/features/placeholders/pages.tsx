import { PlaceholderPage } from './PlaceholderPage';

/**
 * A destination for each of the nine sidebar items.
 *
 * The menu is driven by the permission matrix, so every item it can render needs a page
 * from the moment the shell exists, or the navigation cannot be used and the filtering
 * cannot be seen working. Each one names the ticket that replaces it, so the sequence of
 * this product is legible from the inside rather than only from the roadmap.
 *
 * None of them fakes data. This is a clinical record system, and a placeholder chart is a
 * placeholder somebody screenshots and reads as a number.
 */

export const OverviewPage = () => (
  <PlaceholderPage
    title="Overview"
    description="Today at a glance: appointments, calls the agent handled, and what needs attention."
    next="The dashboard metrics arrive with the appointments and call-history features. Until then the sidebar, your role and your session are what this screen is proving."
  />
);

export const AppointmentsPage = () => (
  <PlaceholderPage
    title="Appointments"
    description="The calendar and booking list for this clinic."
    next="Booking, rescheduling and cancellation arrive with the appointments feature, which is also what the voice agent calls into."
  />
);

export const PatientsPage = () => (
  <PlaceholderPage
    title="Patients"
    description="Patient records for this clinic."
    next="The patient list and record arrive with the patients feature. Patient data is never shown on a screen before the audit logging behind it is in place."
  />
);

export const StaffPage = () => (
  <PlaceholderPage
    title="Doctors & Staff"
    description="The people who work at this clinic, and the hours they keep."
    next="The roster, working hours and breaks arrive with the doctors and services feature, which is what appointment availability is calculated from."
  />
);

export const ServicesPage = () => (
  <PlaceholderPage
    title="Services"
    description="What this clinic offers, and how long each appointment takes."
    next="Service definitions and durations arrive with the doctors and services feature."
  />
);

export const CallsPage = () => (
  <PlaceholderPage
    title="Call History"
    description="Every call the voice agent handled, and what it did."
    next="Call records, transcripts and recordings arrive after the Sarvam integration lands. D-008 puts the foundation work before any voice work."
  />
);

export const RemindersPage = () => (
  <PlaceholderPage
    title="Reminders"
    description="Appointment reminders, and when they go out."
    next="Reminder settings and delivery arrive with the reminders feature, which depends on the outbound calling jobs."
  />
);

export const ReportsPage = () => (
  <PlaceholderPage
    title="Reports"
    description="How the clinic and the agent are performing."
    next="Reporting arrives after appointments and call history exist, because there is nothing to report on before then."
  />
);

export const SettingsPage = () => (
  <PlaceholderPage
    title="Clinic Settings"
    description="Clinic details, timezone, and how the agent answers."
    next="Clinic settings arrive with the settings feature. The timezone stored here is what every date on every other screen is rendered in."
  />
);
