import { lazy, Suspense, type ReactElement } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router';
import { Spinner } from '../components/ui/Spinner';
import { ChangePasswordPage } from '../features/auth/ChangePasswordPage';
import { NoAccessPage } from '../features/auth/NoAccessPage';
import { SignInPage } from '../features/auth/SignInPage';
import { AppShell } from './AppShell';
import { CLINIC_NAV, landingPath } from './navigation';
import { RequirePermission } from './RequirePermission';
import { RequireSession } from './RequireSession';
import { useAuth } from './AuthProvider';

/**
 * The route table.
 *
 * TWO LAYERS OF GUARD, AND THEY ANSWER DIFFERENT QUESTIONS. `RequireSession` wraps the
 * whole shell and asks "is there a session, and is it usable". `RequirePermission` wraps
 * each page and asks "may this role read this". Collapsing them would mean either checking
 * permissions before knowing the role, or letting a signed-out user reach a page that then
 * tells them they lack permission.
 *
 * NEITHER IS A SECURITY CONTROL. The API enforces the same matrix in its service layer, and
 * a user who types a hidden path meets a page whose data calls are refused. These exist so
 * the product does not show people doors that are locked.
 *
 * The placeholder pages are lazily loaded as one chunk. Nine route-level splits for nine
 * screens with no data would add nine requests to save nothing; they come out of the
 * initial bundle together, which is what the budget in `vite.config.ts` cares about.
 */

const placeholders = () => import('../features/placeholders/pages');

const OverviewPage = lazy(async () => ({ default: (await placeholders()).OverviewPage }));
const AppointmentsPage = lazy(async () => ({ default: (await placeholders()).AppointmentsPage }));
const PatientsPage = lazy(async () => ({ default: (await placeholders()).PatientsPage }));
const StaffPage = lazy(async () => ({ default: (await placeholders()).StaffPage }));
const ServicesPage = lazy(async () => ({ default: (await placeholders()).ServicesPage }));
const CallsPage = lazy(async () => ({ default: (await placeholders()).CallsPage }));
const RemindersPage = lazy(async () => ({ default: (await placeholders()).RemindersPage }));
const ReportsPage = lazy(async () => ({ default: (await placeholders()).ReportsPage }));
const SettingsPage = lazy(async () => ({ default: (await placeholders()).SettingsPage }));

/**
 * The element for each navigation path.
 *
 * Keyed by path and driven FROM `CLINIC_NAV` below, so the routes and the menu cannot
 * disagree: a nav item with no page here is a compile error, because the record is typed
 * to cover every path the nav declares. The alternative, two parallel lists, is how a menu
 * ends up with an item that navigates nowhere.
 */
const ELEMENTS: Record<(typeof CLINIC_NAV)[number]['path'], ReactElement> = {
  '/overview': <OverviewPage />,
  '/appointments': <AppointmentsPage />,
  '/patients': <PatientsPage />,
  '/staff': <StaffPage />,
  '/services': <ServicesPage />,
  '/calls': <CallsPage />,
  '/reminders': <RemindersPage />,
  '/reports': <ReportsPage />,
  '/settings': <SettingsPage />,
};

/**
 * The signed-in frame.
 *
 * Reads the role from the session rather than taking it as a prop, because a route element
 * has no way to be handed one. `RequireSession` has already established that there is a
 * user by the time this renders; the narrowing is for the compiler, not for a real case.
 */
const Shell = () => {
  const { user, signOut } = useAuth();

  if (user === undefined) {
    return null;
  }

  return (
    <AppShell
      role={user.role}
      items={CLINIC_NAV}
      onSignOut={() => {
        void signOut();
      }}
    />
  );
};

/**
 * Sends a signed-in user to the first page their role actually reaches.
 *
 * NOT A CONSTANT `/overview`, and that is not a nicety. Overview reads `analytics`, which
 * the matrix denies to STAFF, so a fixed redirect would drop every staff member on a page
 * they may not read, at every single sign-in, and the only thing they would ever see is the
 * no-access screen. A role that reaches nothing in this application gets the explanation
 * instead, which is the platform-role case.
 */
const Landing = () => {
  const { user } = useAuth();

  if (user === undefined) {
    return null;
  }

  const first = landingPath(CLINIC_NAV, user.role);

  return first === undefined ? (
    <NoAccessPage reason="Your role does not include access to any part of the clinic dashboard. If you are an OpenHours administrator, use the admin console instead." />
  ) : (
    <Navigate to={first} replace />
  );
};

/** An unknown path inside the shell. Sent to the landing route rather than a dead end. */
const NotFound = () => {
  const location = useLocation();
  return <Navigate to="/" replace state={{ unknownPath: location.pathname }} />;
};

export const AppRoutes = () => (
  <Routes>
    <Route path="/sign-in" element={<SignInPage audienceNote="Clinic dashboard" />} />
    <Route path="/change-password" element={<ChangePasswordPage />} />

    <Route element={<RequireSession />}>
      <Route element={<Shell />}>
        <Route index element={<Landing />} />
        {CLINIC_NAV.map((item) => (
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
