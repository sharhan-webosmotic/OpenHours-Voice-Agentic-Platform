import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { ApiClient, CurrentUser } from '@openhours/api-client';
import { ApiError, PASSWORD_CHANGE_REQUIRED_TYPE } from '@openhours/api-client';
import { isRole, type Role } from '@openhours/shared';
import type { SessionBus } from './sessionBus';

/**
 * The session, as the user interface sees it.
 *
 * ONE IMPLEMENTATION, BOTH APPLICATIONS. The clinic dashboard and the admin console differ
 * in their accent, their logo and their menu. They do not differ in how a session works,
 * so this lives in the shared package and each app passes it a client configured with its
 * own audience.
 *
 * THE TOKEN IS NOT IN HERE. React state is readable from a dev-tools snapshot and tends to
 * end up in error-tracking payloads, so the access token stays inside the client's closure
 * (D-002) and this provider holds only the principal: an id, an organisation and a role.
 * Nothing in this file can produce a credential.
 *
 * STATUS IS A UNION, NOT A PAIR OF BOOLEANS. `booting` is a genuinely distinct state from
 * `signed-out`: on a cold load there is no access token, because it only ever lived in
 * memory, but there may still be a refresh cookie. Collapsing the two would flash the sign-
 * in screen at every user who reloads the page, and then navigate away from it. So the app
 * renders nothing conclusive until the boot refresh has answered.
 */

export type AuthStatus = 'booting' | 'signed-out' | 'must-change-password' | 'signed-in';

export type AuthState = {
  readonly status: AuthStatus;
  readonly user?: CurrentUser | undefined;
  /**
   * True when the session ended on its own rather than because the user signed out.
   *
   * The sign-in screen says so, once, in a neutral note. "Quietly" was the requirement:
   * an expiry is the product's normal behaviour, not the user's mistake, so it must not
   * arrive as an error, and it must not arrive as a modal over whatever they were reading.
   */
  readonly sessionExpired: boolean;
  readonly signIn: (email: string, password: string) => Promise<void>;
  readonly signOut: () => Promise<void>;
  readonly changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

/** Narrows the role the API reports, so an unrecognised one denies rather than crashes. */
const toUser = (user: CurrentUser): CurrentUser => {
  if (!isRole(user.role)) {
    // The same defence as the API's token verifier: the matrix is indexed by role, and an
    // unknown key there used to throw a TypeError instead of denying.
    throw new Error('unrecognised role');
  }
  return user;
};

export const AuthProvider = ({
  client,
  sessionLost,
  children,
}: {
  readonly client: ApiClient;
  /** `subscribe` from the session bus the client was built with. */
  readonly sessionLost: SessionBus['subscribe'];
  readonly children: ReactNode;
}) => {
  const [status, setStatus] = useState<AuthStatus>('booting');
  const [user, setUser] = useState<CurrentUser | undefined>(undefined);
  const [sessionExpired, setSessionExpired] = useState(false);

  /**
   * Guards against a late `onSessionLost` from a request that was already in flight when
   * the user signed out by hand, which would otherwise re-render the expiry notice over
   * the sign-in screen they are already looking at.
   */
  const live = useRef(true);
  useEffect(
    () => () => {
      live.current = false;
    },
    [],
  );

  /**
   * The current status, for the bus listener to read.
   *
   * A ref rather than a dependency, so the subscription is made once. Depending on `status`
   * would tear down and re-establish the listener on every transition, and a signal that
   * arrived during that window would be dropped.
   */
  const statusRef = useRef<AuthStatus>('booting');
  statusRef.current = status;

  const clear = useCallback(() => {
    if (live.current) {
      setUser(undefined);
      // A deliberate sign-out or password change is not an expiry.
      setSessionExpired(false);
      setStatus('signed-out');
    }
  }, []);

  const adopt = useCallback((next: CurrentUser) => {
    setUser(toUser(next));
    setSessionExpired(false);
    setStatus(next.mustChangePassword ? 'must-change-password' : 'signed-in');
  }, []);

  /**
   * The client could not renew the session, so the user is signed out where they stand.
   *
   * Only flagged as an expiry if they were actually signed in. The same signal fires when
   * the boot refresh finds no cookie, and telling a first-time visitor that their session
   * expired would be a lie.
   */
  useEffect(
    () =>
      sessionLost(() => {
        if (!live.current) {
          return;
        }
        const wasSignedIn =
          statusRef.current === 'signed-in' || statusRef.current === 'must-change-password';
        setSessionExpired(wasSignedIn);
        setUser(undefined);
        setStatus('signed-out');
      }),
    [sessionLost],
  );

  /**
   * The boot sequence: ask the cookie whether there is still a session.
   *
   * A 401 here is the ordinary case, not an error. It means no cookie, an expired one, or
   * one that was revoked, and all three mean "show the sign-in screen". It is not reported
   * to the user, because they did not do anything.
   */
  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      try {
        await client.refresh();
        const current = await client.me();
        if (!cancelled) {
          adopt(current);
        }
      } catch {
        if (!cancelled) {
          setStatus('signed-out');
        }
      }
    };

    void boot();

    return () => {
      cancelled = true;
    };
  }, [client, adopt]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const session = await client.login(email, password);
      // `login` returns the principal, so this does not need a second round trip to /me.
      adopt({ ...session.user, mustChangePassword: session.mustChangePassword });
    },
    [client, adopt],
  );

  const signOut = useCallback(async () => {
    try {
      await client.logout();
    } finally {
      // Signed out locally even if the call failed. The server revokes the family when it
      // can; the interface must not keep the user in a session they have left.
      clear();
    }
  }, [client, clear]);

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      await client.changePassword(currentPassword, newPassword);
      /**
       * The change revoked every session, this one included, so there is nothing to keep.
       * The user signs in again with the password they just chose, which is also the only
       * proof that it took effect.
       */
      clear();
    },
    [client, clear],
  );

  const value = useMemo<AuthState>(
    () => ({ status, user, sessionExpired, signIn, signOut, changePassword }),
    [status, user, sessionExpired, signIn, signOut, changePassword],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthState => {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useAuth used outside AuthProvider');
  }

  return context;
};

/** The signed-in role, or undefined while booting or signed out. */
export const useRole = (): Role | undefined => {
  const { user } = useAuth();
  return user === undefined ? undefined : user.role;
};

export { ApiError, PASSWORD_CHANGE_REQUIRED_TYPE };
