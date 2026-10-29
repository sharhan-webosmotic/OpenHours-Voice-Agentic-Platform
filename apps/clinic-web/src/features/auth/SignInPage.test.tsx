import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  PASSWORD_CHANGE_REQUIRED_TYPE,
  TOO_MANY_REQUESTS_TYPE,
  UNAUTHORIZED_TYPE,
  FORBIDDEN_TYPE,
} from '@clinicai/api-client';
import { problem, renderWith, stubClient, user } from '../../test-support/harness';
import { AppRoutes } from '../../app/routes';

/**
 * The sign-in screen.
 *
 * The routes are rendered rather than the page alone, because half of what this screen does
 * is decide where to go next, and a page rendered on its own cannot be observed doing that.
 */

const signIn = async (email: string, password: string) => {
  const typist = userEvent.setup();
  await typist.type(screen.getByLabelText('Email address'), email);
  await typist.type(screen.getByLabelText('Password'), password);
  await typist.click(screen.getByRole('button', { name: 'Sign in' }));
};

describe('validation before anything is sent', () => {
  it('names both missing fields rather than failing at the server', async () => {
    const stub = stubClient();
    renderWith(<AppRoutes />, stub, ['/sign-in']);

    await userEvent.setup().click(await screen.findByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Enter your email address.')).toBeInTheDocument();
    expect(screen.getByText('Enter your password.')).toBeInTheDocument();
    // Nothing was sent, so a mistyped form costs no round trip and no rate-limit budget.
    expect(stub.calls.login).toBe(0);
  });

  it('attaches each error to its own field for a screen reader', async () => {
    const stub = stubClient();
    renderWith(<AppRoutes />, stub, ['/sign-in']);

    await userEvent.setup().click(await screen.findByRole('button', { name: 'Sign in' }));

    const email = await screen.findByLabelText('Email address');
    // `aria-invalid` plus a described-by pointing at the message is the whole contract:
    // without it a reader announces "edit text, blank" and the user never learns why.
    expect(email).toHaveAttribute('aria-invalid', 'true');
    expect(email).toHaveAccessibleDescription('Enter your email address.');
  });
});

describe('what a failure says', () => {
  it('shows the API wording, which is the same for every wrong credential', async () => {
    const stub = stubClient({
      loginError: problem(401, UNAUTHORIZED_TYPE, 'Email or password is incorrect.'),
    });
    renderWith(<AppRoutes />, stub, ['/sign-in']);
    await screen.findByRole('button', { name: 'Sign in' });

    await signIn('nobody@clinic.example', 'wrong-password');

    /**
     * The API answers an unknown email, a wrong password, a locked account and a
     * deactivated organisation identically, on purpose, so the form cannot be used to
     * discover which accounts exist. A client that added "no account with that email"
     * would undo that, so the screen shows what the API said and nothing more.
     */
    expect(await screen.findByRole('alert')).toHaveTextContent('Email or password is incorrect.');
  });

  it('explains a rate limit instead of implying the password was wrong', async () => {
    const stub = stubClient({
      loginError: problem(429, TOO_MANY_REQUESTS_TYPE, 'Too many requests.'),
    });
    renderWith(<AppRoutes />, stub, ['/sign-in']);
    await screen.findByRole('button', { name: 'Sign in' });

    await signIn('someone@clinic.example', 'password-attempt');

    // A user who is locked out by the limiter and told "incorrect password" keeps trying,
    // which is exactly what the limiter is there to stop.
    expect(await screen.findByRole('alert')).toHaveTextContent('Too many attempts');
  });

  it('says plainly when the role belongs in the other application', async () => {
    const stub = stubClient({
      loginError: problem(
        403,
        FORBIDDEN_TYPE,
        'This account is for the ClinicAI admin console. Please sign in there instead.',
      ),
    });
    renderWith(<AppRoutes />, stub, ['/sign-in']);
    await screen.findByRole('button', { name: 'Sign in' });

    await signIn('admin@clinicai.test', 'password');

    // The whole point of the audience field: a platform user is told where to go rather
    // than signed in and left looking at nine pages of refusals.
    expect(await screen.findByRole('alert')).toHaveTextContent('admin console');
  });

  it('does not blame the credentials for a network failure', async () => {
    const stub = stubClient({ loginError: new TypeError('Failed to fetch') });
    renderWith(<AppRoutes />, stub, ['/sign-in']);
    await screen.findByRole('button', { name: 'Sign in' });

    await signIn('someone@clinic.example', 'password');

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not reach the server');
  });
});

describe('where it goes next', () => {
  it('returns the user to the page they originally asked for', async () => {
    const stub = stubClient({ user: user('CLINIC_OWNER') });
    // Arriving at a deep link while signed out: the guard sends them to sign-in carrying
    // where they were going, in router state rather than a ?next= parameter.
    renderWith(<AppRoutes />, stub, ['/patients']);

    await screen.findByRole('button', { name: 'Sign in' });
    await signIn('owner@clinic.example', 'password');

    expect(await screen.findByRole('heading', { name: 'Patients' })).toBeInTheDocument();
  });

  it('sends a user with a temporary password to the change screen, not to the dashboard', async () => {
    const stub = stubClient({ user: user('CLINIC_OWNER', true) });
    renderWith(<AppRoutes />, stub, ['/sign-in']);
    await screen.findByRole('button', { name: 'Sign in' });

    await signIn('owner@clinic.example', 'temporary-password');

    // The API refuses this user every other route, so anywhere else would be a wall of
    // 403s rather than an instruction.
    expect(
      await screen.findByRole('heading', { name: 'Choose a new password' }),
    ).toBeInTheDocument();
  });
});

describe('the session ending on its own', () => {
  it('is reported once, neutrally, and not as an error', async () => {
    const stub = stubClient({ user: user('CLINIC_OWNER'), bootSucceeds: true });
    renderWith(<AppRoutes />, stub, ['/overview']);

    await screen.findByRole('heading', { name: 'Overview' });

    // What the client does when a refresh is refused: the user is signed out where they
    // stand and the screen explains itself.
    stub.bus.emit();

    const note = await screen.findByRole('status');
    expect(note).toHaveTextContent('Your session has ended');
    // `status`, not `alert`. An expiry is the product behaving normally, not the user
    // making a mistake, so it must not interrupt a screen reader.
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('does not claim an expiry for someone who was never signed in', async () => {
    const stub = stubClient();
    renderWith(<AppRoutes />, stub, ['/sign-in']);

    await screen.findByRole('button', { name: 'Sign in' });
    // The same signal fires when the boot refresh finds no cookie. Telling a first-time
    // visitor that their session expired would be a lie.
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});

describe('forgot password', () => {
  it('is visible and disabled, and says why', async () => {
    const stub = stubClient();
    renderWith(<AppRoutes />, stub, ['/sign-in']);

    const forgot = await screen.findByRole('button', { name: 'Forgot password?' });

    /**
     * D-003: there is no email provider, so there is nothing to send a reset link with.
     * Visible, because an absent control is a mystery and generates a support call.
     * Disabled, because the prototype's version simulates sending an email, which is fine
     * in a prototype and a lie in a product that holds patient records.
     */
    expect(forgot).toBeDisabled();
    expect(forgot).toHaveAccessibleDescription(/coming soon/i);
    expect(screen.getByText(/ask an administrator/i)).toBeInTheDocument();
  });
});

describe('the password field', () => {
  it('can be revealed, and the control says which it will do', async () => {
    const stub = stubClient();
    renderWith(<AppRoutes />, stub, ['/sign-in']);

    const password = await screen.findByLabelText('Password');
    expect(password).toHaveAttribute('type', 'password');

    await userEvent.setup().click(screen.getByRole('button', { name: 'Show' }));

    await waitFor(() => {
      expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'text');
    });
    // The label is the state, so a reader hears what pressing it does next.
    expect(screen.getByRole('button', { name: 'Hide' })).toBeInTheDocument();
  });
});

describe('a signed-in user who navigates back to sign-in', () => {
  it('is sent on rather than shown the form again', async () => {
    const stub = stubClient({ user: user('CLINIC_OWNER'), bootSucceeds: true });
    renderWith(<AppRoutes />, stub, ['/sign-in']);

    expect(await screen.findByRole('heading', { name: 'Overview' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sign in' })).not.toBeInTheDocument();
  });
});

describe('the password-change problem type', () => {
  it('is the type the client branches on, not a bare 403', () => {
    // Guards the contract this screen depends on: if the API renamed it, the gate would
    // still return 403 and the dashboard would show "no access" instead of the change
    // screen. Asserted here because the string is duplicated across the boundary until
    // M1-03 generates both sides from one document.
    expect(PASSWORD_CHANGE_REQUIRED_TYPE).toBe(
      'https://clinicai.health/problems/password-change-required',
    );
  });
});
