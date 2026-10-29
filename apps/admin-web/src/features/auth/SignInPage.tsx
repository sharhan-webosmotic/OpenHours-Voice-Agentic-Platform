import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Navigate, useLocation } from 'react-router';
import { ApiError, TOO_MANY_REQUESTS_TYPE } from '@openhours/api-client';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Field } from '../../components/ui/Field';
import { Logo } from '../../components/ui/Logo';
import { useAuth } from '../../app/AuthProvider';

/**
 * The sign-in screen, shared by both applications.
 *
 * WHAT IS SHOWN ON FAILURE IS THE API'S `detail`, NOT A MESSAGE INVENTED HERE. The API
 * answers every login failure with one indistinguishable error, deliberately, so that the
 * form cannot become an account-enumeration oracle: an unknown email, a wrong password, a
 * locked account and a deactivated organisation all read "Email or password is incorrect."
 * A client that tried to be more helpful would undo that. The two cases that DO differ are
 * rate limiting and the wrong application, and both differ because the API chose to say so.
 *
 * FORGOT PASSWORD IS VISIBLE AND DISABLED. D-003: there is no email provider, so there is
 * nothing to send a reset link with. A link that silently did nothing, or a screen that
 * claimed to have sent an email, would be worse than an honest "coming soon" — the
 * prototype's recovery flow simulates sending one, which is fine in a prototype and a lie
 * in production. Until an email provider is in scope, the way back in is an administrator
 * issuing a new temporary password.
 */

type Fields = { readonly email: string; readonly password: string };

export const SignInPage = ({ audienceNote }: { readonly audienceNote: string }) => {
  const { status, sessionExpired, signIn } = useAuth();
  const location = useLocation();
  const [failure, setFailure] = useState<string | undefined>(undefined);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Fields>({ defaultValues: { email: '', password: '' } });

  /**
   * Where they were going before the guard sent them here, if anywhere.
   *
   * Read from router state rather than a `?next=` parameter: a query parameter is editable
   * by the user, lands in logs and history, and in this product a path can carry a patient
   * id. Only a path is taken from it, never a full URL, so it cannot become an open
   * redirect to another origin.
   */
  const from = (location.state as { readonly from?: { readonly pathname?: string } } | null)?.from;
  const intended = typeof from?.pathname === 'string' ? from.pathname : undefined;

  if (status === 'signed-in') {
    return <Navigate to={intended ?? '/'} replace />;
  }
  if (status === 'must-change-password') {
    return <Navigate to="/change-password" replace />;
  }

  const onSubmit = handleSubmit(async (values) => {
    setFailure(undefined);

    try {
      await signIn(values.email, values.password);
    } catch (error) {
      if (error instanceof ApiError) {
        setFailure(
          error.type === TOO_MANY_REQUESTS_TYPE
            ? 'Too many attempts. Please wait a few minutes and try again.'
            : (error.problem.detail ?? 'Sign-in failed. Please try again.'),
        );
        return;
      }
      // A network failure, not a refusal. Saying "incorrect password" here would be wrong.
      setFailure('Could not reach the server. Check your connection and try again.');
    }
  });

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="flex w-full max-w-sm flex-col gap-5">
        <Logo className="self-center" />

        <Card className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="m-0 text-xl font-bold text-default">Sign in</h1>
            <p className="m-0 text-xs text-muted">{audienceNote}</p>
          </div>

          {/* Neutral, and only when the session ended on its own. Not an error. */}
          {sessionExpired && (
            <Alert kind="info">Your session has ended. Please sign in again to continue.</Alert>
          )}

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
              label="Email address"
              type="email"
              autoComplete="username"
              autoFocus
              placeholder="you@clinic.example"
              error={errors.email?.message}
              {...register('email', {
                required: 'Enter your email address.',
                // Deliberately permissive. The API validates properly; this only catches a
                // typo before a round trip, and a strict pattern rejects valid addresses.
                pattern: { value: /.+@.+\..+/, message: 'Enter a valid email address.' },
              })}
            />

            <Field
              label="Password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              error={errors.password?.message}
              trailing={
                <button
                  type="button"
                  className="h-8 rounded-sm px-2 text-xs font-semibold text-accent"
                  // The control's name IS its state, so a screen reader hears what it does.
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              }
              {...register('password', { required: 'Enter your password.' })}
            />

            <Button type="submit" fullWidth loading={isSubmitting}>
              Sign in
            </Button>
          </form>

          <div className="flex flex-col gap-1 border-t border-border pt-3">
            <button
              type="button"
              disabled
              // Visible so the absence is explained rather than mysterious, disabled
              // because there is no email provider to send a reset with (D-003).
              className="self-start text-xs font-semibold text-subtle disabled:cursor-not-allowed"
              aria-describedby="forgot-note"
            >
              Forgot password?
            </button>
            <small id="forgot-note" className="text-xs text-subtle">
              Coming soon. For now, ask an administrator to issue a new temporary password.
            </small>
          </div>
        </Card>
      </div>
    </main>
  );
};
