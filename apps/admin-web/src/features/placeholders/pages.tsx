import { PlaceholderPage } from './PlaceholderPage';

/**
 * A destination for each admin item that has no feature behind it yet.
 *
 * None of them fakes data. This console looks at real clinics holding real patient records,
 * and a placeholder number is a placeholder somebody screenshots and reports.
 *
 * "Clinics" is no longer here: it is a real screen now, in `features/clinics`.
 */

export const InternalUsersPage = () => (
  <PlaceholderPage
    title="Internal users"
    description="ClinicAI staff with access to the platform."
    next="Inviting and deactivating internal users arrives with the platform users feature. Only a super admin sees this page: the matrix gives platform_users to that role alone."
  />
);

export const MonitoringPage = () => (
  <PlaceholderPage
    title="Monitoring"
    description="Integration failures, webhook problems and jobs that did not finish."
    next="The integration error feed arrives once the Sarvam webhooks exist to produce errors. D-006 describes the three measures those webhooks carry."
  />
);

export const SettingsPage = () => (
  <PlaceholderPage
    title="Settings"
    description="Phone numbers, voice agent mapping and platform configuration."
    next="Phone and voice mapping arrives with the Sarvam integration. D-004 settles one agent per clinic and D-005 that numbers are bought in Sarvam."
  />
);
