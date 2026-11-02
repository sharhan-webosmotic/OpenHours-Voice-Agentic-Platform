import { lazy, Suspense, type ReactElement } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router';
import { Spinner } from '../components/ui/Spinner';
import { ChangePasswordPage } from '../features/auth/ChangePasswordPage';
import { NoAccessPage } from '../features/auth/NoAccessPage';
import { SignInPage } from '../features/auth/SignInPage';
import { AppShell } from './AppShell';
import { ADMIN_NAV, landingPath } from './navigation';
import { RequirePermission } from './RequirePermission';
import { RequireSession } from './RequireSession';
import { useAuth } from './AuthProvider';

/**
 * The admin console's route table. The same two-layer guard as the dashboard:
 * `RequireSession` asks whether there is a usable session, `RequirePermission` asks whether
 * this role may read this page. Neither is a security control; the API enforces the matrix.
 */

const placeholders = () => import('../features/placeholders/pages');

const ClinicsPage = lazy(async () => ({ default: (await placeholders()).ClinicsPage }));
const InternalUsersPage = lazy(async () => ({
  default: (await placeholders()).InternalUsersPage,
}));
const MonitoringPage = lazy(async () => ({ default: (await placeholders()).MonitoringPage }));
const SettingsPage = lazy(async () => ({ default: (await placeholders()).SettingsPage }));

/** Typed to cover every nav path, so an item with no page is a compile error. */
const ELEMENTS: Record<(typeof ADMIN_NAV)[number]['path'], ReactElement> = {
  '/clinics': <ClinicsPage />,
  '/internal-users': <InternalUsersPage />,
  '/monitoring': <MonitoringPage />,
  '/settings': <SettingsPage />,
};

const Shell = () => {
  const { user, signOut } = useAuth();

  if (user === undefined) {
    return null;
  }

  return (
    <AppShell
      role={user.role}
      items={ADMIN_NAV}
      // The one word of copy that differs from the dashboard, beside the accent.
      subtitle="Admin"
      onSignOut={() => {
        void signOut();
      }}
    />
  );
};

/**
 * Sends a signed-in user to the first page their role reaches.
 *
 * Here the `undefined` branch is a case that genuinely occurs rather than a defensive one:
 * no clinic role reaches any of these four pages, so a clinic user holding a session in
 * this console gets the explanation. The audience refusal at login is what normally stops
 * them, and this is the layer behind it.
 */
const Landing = () => {
  const { user } = useAuth();

  if (user === undefined) {
    return null;
  }

  const first = landingPath(ADMIN_NAV, user.role);

  return first === undefined ? (
    <NoAccessPage reason="Your role does not include access to the ClinicAI admin console. If you work at a clinic, use the clinic dashboard instead." />
  ) : (
    <Navigate to={first} replace />
  );
};

const NotFound = () => {
  const location = useLocation();
  return <Navigate to="/" replace state={{ unknownPath: location.pathname }} />;
};

export const AppRoutes = () => (
  <Routes>
    <Route path="/sign-in" element={<SignInPage audienceNote="ClinicAI admin console" />} />
    <Route path="/change-password" element={<ChangePasswordPage />} />

    <Route element={<RequireSession />}>
      <Route element={<Shell />}>
        <Route index element={<Landing />} />
        {ADMIN_NAV.map((item) => (
          <Route
            key={item.path}
            path={item.path}
            element={
              <RequirePermission
                resource={item.resource}
                action={item.action}
                fallback={<NoAccessPage />}
              >
                <Suspense fallback={<Spinner />}>{ELEMENTS[item.path]}</Suspense>
              </RequirePermission>
            }
          />
        ))}
        <Route path="*" element={<NotFound />} />
      </Route>
    </Route>
  </Routes>
);
