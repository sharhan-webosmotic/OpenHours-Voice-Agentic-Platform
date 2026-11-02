import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UNAUTHORIZED_TYPE } from '@clinicai/api-client';
import { problem, renderWith, stubClient, user } from '../../test-support/harness';
import { AppRoutes } from '../../app/routes';

/**
 * Replacing an administrator-issued temporary password.
 *
 * Under D-003 this is the only way a real account becomes usable, so a failure here locks
 * a user out of the product entirely with a credential someone else chose.
 */

const fill = async (current: string, next: string, confirm: string) => {
  const typist = userEvent.setup();
  await typist.type(screen.getByLabelText('Temporary password'), current);
  await typist.type(screen.getByLabelText('New password'), next);
  await typist.type(screen.getByLabelText('Confirm new password'), confirm);
  await typist.click(screen.getByRole('button', { name: 'Change password' }));
};

const gated = () => stubClient({ user: user('CLINIC_OWNER', true), bootSucceeds: true });

const open = async () => {
  const stub = gated();
  renderWith(<AppRoutes />, stub, ['/change-password']);
  await screen.findByRole('heading', { name: 'Choose a new password' });
  return stub;
};

describe('validation', () => {
  it('refuses a password shorter than the API would accept', async () => {
    const stub = await open();

    await fill('temp-password', 'short', 'short');

    /**
     * Twelve, matching MINIMUM_PASSWORD_LENGTH in the API. The prototype says eight; the
     * API is the authority and would reject it, so showing eight would invite a round trip
     * that fails and read as a bug in the product.
     */
    expect(await screen.findByText('Use at least 12 characters.')).toBeInTheDocument();
    expect(stub.calls.changePassword).toBe(0);
  });

  it('catches a mistyped confirmation before sending it', async () => {
    const stub = await open();

    await fill('temp-password', 'a-long-enough-password', 'a-long-enough-passwrod');

    // Worth catching locally: the change revokes every session, so a typo that reached the
    // server would lock the user out with a password they do not know.
    expect(await screen.findByText('Both passwords must match.')).toBeInTheDocument();
    expect(stub.calls.changePassword).toBe(0);
  });

  it('asks for the temporary password it is replacing', async () => {
    await open();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Change password' }));

    expect(
      await screen.findByText('Enter the temporary password you were given.'),
    ).toBeInTheDocument();
  });
});

describe('a wrong temporary password', () => {
  it('shows the API wording without confirming anything about the account', async () => {
    const stub = stubClient({
      user: user('CLINIC_OWNER', true),
      bootSucceeds: true,
      changePasswordError: problem(401, UNAUTHORIZED_TYPE, 'Current password is incorrect.'),
    });
    renderWith(<AppRoutes />, stub, ['/change-password']);
    await screen.findByRole('heading', { name: 'Choose a new password' });

    await fill('wrong-temporary', 'a-long-enough-password', 'a-long-enough-password');

    expect(await screen.findByRole('alert')).toHaveTextContent('Current password is incorrect.');
  });
});

describe('success', () => {
  it('says the other sessions ended and sends the user back to sign in', async () => {
    const stub = await open();

    await fill('temp-password', 'a-long-enough-password', 'a-long-enough-password');

    expect(await screen.findByRole('heading', { name: 'Password changed' })).toBeInTheDocument();
    // Signing in again is not a rough edge: the change revoked every session including this
    // one, and it is also the only proof the new password took effect.
    expect(screen.getByRole('status')).toHaveTextContent('every other session was signed out');
    expect(stub.calls.changePassword).toBe(1);
  });
});

describe('who may see this screen', () => {
  it('turns away a user with no temporary password outstanding', async () => {
    const stub = stubClient({ user: user('CLINIC_OWNER'), bootSucceeds: true });
    renderWith(<AppRoutes />, stub, ['/change-password']);

    // Nothing to replace, and the screen sits outside the shell, so it would be a dead end.
    expect(await screen.findByRole('heading', { name: 'Overview' })).toBeInTheDocument();
  });

  it('turns away a signed-out visitor', async () => {
    const stub = stubClient();
    renderWith(<AppRoutes />, stub, ['/change-password']);

    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument();
  });
});
