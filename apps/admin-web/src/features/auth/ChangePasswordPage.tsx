import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Navigate } from 'react-router';
import { ApiError } from '@openhours/api-client';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';
import { Logo } from '../../components/ui/Logo';
import { useAuth } from '../../app/AuthProvider';
import { AuthLayout } from './AuthLayout';

/**
 * Replacing an administrator-issued temporary password. Not in the prototype, which only
 * simulates an emailed reset, so this is built to the same visual language.
 *
 * WHY IT IS A FULL SCREEN AND NOT A DIALOG. Under D-003 a new user's first password was
 * chosen by somebody else, handed over out of band, and may have been read off a screen or
 * forwarded in a message. Until it is replaced, the API refuses this user every endpoint
 * but the four that lead out of the state, so a dialog over a dashboard would be a dialog
 * over a wall of 403s. The screen is the only thing there is to show.
 *
 * THE MINIMUM IS TWELVE, matching `MINIMUM_PASSWORD_LENGTH` in the API. The prototype says
 * eight; the API is the authority and would reject it, so showing eight would invite a
 * round trip that fails. Lower bound only: no composition rules, because forced character
 * classes produce predictable passwords and the length is doing the work.
 *
 * ON SUCCESS THE USER IS SIGNED OUT, which is not a rough edge. Changing a password revokes
 * every session for that user, this one included, so there is no session left to continue
 * in. Signing in with the new password is also the only proof it took effect.
 */

const MINIMUM_LENGTH = 12;

type Fields = {
  readonly currentPassword: string;
  readonly newPassword: string;
  readonly confirmPassword: string;
};

export const ChangePasswordPage = () => {
  const { status, changePassword } = useAuth();
  const [failure, setFailure] = useState<string | undefined>(undefined);
  const [done, setDone] = useState(false);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<Fields>({
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  // Nobody else belongs here: a user with no temporary password outstanding has nothing to
  // replace, and this screen is outside the shell so it would be a dead end for them.
  if (status === 'signed-in') {
    return <Navigate to="/" replace />;
  }
  if (status === 'signed-out' && !done) {
    return <Navigate to="/sign-in" replace />;
  }

  const onSubmit = handleSubmit(async (values) => {
    setFailure(undefined);

    try {
      await changePassword(values.currentPassword, values.newPassword);
      setDone(true);
    } catch (error) {
      if (error instanceof ApiError) {
        // The API's own wording. A wrong current password is the common case and it says so
        // without confirming anything about the account.
        setFailure(error.problem.detail ?? 'Could not change the password. Please try again.');
        return;
      }
      setFailure('Could not reach the server. Check your connection and try again.');
    }
  });

  return (
    <AuthLayout
      headline="Every clinic on the platform, in one view."
      subhead="Provisioning, monitoring and support for every OpenHours clinic, in one console."
      footnote="Internal tool. Every action here is recorded in the audit log."
    >
      <Logo className="self-start lg:hidden" />

      {done ? (
        <>
          <h1 className="m-0 text-2xl font-bold tracking-[-0.8px] text-default">
            Password changed
          </h1>
          <Alert kind="success">
            Your password has been updated and every other session was signed out. Sign in again
            with your new password.
          </Alert>
          <Button size="lg" fullWidth onClick={() => window.location.assign('/sign-in')}>
            Go to sign in
          </Button>
        </>
      ) : (
        <>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-bold uppercase tracking-[1.1px] text-accent">
              One more step
            </span>
            <h1 className="m-0 text-2xl font-bold tracking-[-0.8px] text-default">
              Choose a new password
            </h1>
            <p className="m-0 text-sm leading-[1.6] text-muted">
              Your account was created with a temporary password. Replace it before continuing.
            </p>
          </div>

          {failure !== undefined && <Alert kind="danger">{failure}</Alert>}

          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              // `handleSubmit` returns a promise and a DOM handler must return void. The
              // rejection cannot escape: `onSubmit` catches everything it can report.
              void onSubmit(event);
            }}
            noValidate
          >
            <Field
              label="Temporary password"
              type="password"
              autoComplete="current-password"
              autoFocus
              error={errors.currentPassword?.message}
              {...register('currentPassword', {
                required: 'Enter the temporary password you were given.',
              })}
            />

            <Field
              label="New password"
              type="password"
              autoComplete="new-password"
              hint={`At least ${MINIMUM_LENGTH} characters. A memorable phrase is stronger than a short complicated word.`}
              error={errors.newPassword?.message}
              {...register('newPassword', {
                required: 'Choose a new password.',
                minLength: {
                  value: MINIMUM_LENGTH,
                  message: `Use at least ${MINIMUM_LENGTH} characters.`,
                },
              })}
            />

            <Field
              label="Confirm new password"
              type="password"
              autoComplete="new-password"
              error={errors.confirmPassword?.message}
              {...register('confirmPassword', {
                required: 'Re-enter the new password.',
                validate: (value) =>
                  value === getValues('newPassword') || 'Both passwords must match.',
              })}
            />

            <Button type="submit" size="lg" fullWidth loading={isSubmitting}>
              Change password
            </Button>
          </form>
        </>
      )}
    </AuthLayout>
  );
};
