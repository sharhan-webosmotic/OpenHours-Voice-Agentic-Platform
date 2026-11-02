import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from './AuthProvider';
import { Spinner } from '../components/ui/Spinner';

/**
 * The route guard. Everything behind the shell sits inside this.
 *
 * FOUR STATES, EACH WITH ONE DESTINATION, which is why `AuthStatus` is a union rather
 * than a couple of booleans:
 *
 *  booting                - render a holding state. NOT the sign-in screen: on a cold load
 *                           there is no access token, because it only ever lived in memory,
 *                           but the refresh cookie may still be good. Showing sign-in here
 *                           would flash it at everyone who reloads the page.
 *  signed-out             - sign in, remembering where they were going.
 *  must-change-password   - the change screen, and nowhere else. The API refuses every
 *                           other route for this user anyway, so letting them navigate
 *                           would produce a wall of 403s instead of an instruction.
 *  signed-in              - through.
 *
 * WHERE THEY WERE GOING IS KEPT IN ROUTER STATE, not in a query parameter. A `?next=`
 * parameter is a redirect the user can edit, it lands in server logs and browser history,
 * and under this product's rules a path can carry a patient id. Router state stays in
 * memory.
 */
export const RequireSession = () => {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'booting') {
    return (
      <div
        className="flex min-h-screen items-center justify-center text-accent"
        role="status"
        aria-label="Restoring your session"
      >
        <Spinner />
      </div>
    );
  }

  if (status === 'signed-out') {
    return <Navigate to="/sign-in" replace state={{ from: location }} />;
  }

  if (status === 'must-change-password') {
    return <Navigate to="/change-password" replace />;
  }

  return <Outlet />;
};
