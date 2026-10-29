import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Navigate, useLocation } from 'react-router';
import { ApiError, TOO_MANY_REQUESTS_TYPE } from '@clinicai/api-client';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';
import { Logo } from '../../components/ui/Logo';
import { useAuth } from '../../app/AuthProvider';
import { AuthLayout } from './AuthLayout';

/**
 * The sign-in screen, built to the prototype's two-panel layout.
 *
 * WHAT IS SHOWN ON FAILURE IS THE API'S `detail`, NOT A MESSAGE INVENTED HERE. The API
 * answers every login failure with one indistinguishable error, deliberately, so that the
 * form cannot become an account-enumeration oracle: an unknown email, a wrong password, a
 * locked account and a deactivated organisation all read "Email or password is incorrect."
 * A client that tried to be more helpful would undo that. The two cases that DO differ are
 * rate limiting and the wrong application, and both differ because the API chose to say so.
 *
 * TWO CONTROLS FROM THE WIREFRAME ARE NOT BUILT, and neither is an oversight.
 *
 * "Remember me" has no meaning under D-002. The access token lives in memory and dies with
 * the tab; the refresh cookie has one fixed lifetime set by the server. There is nothing
 * for the checkbox to change, and a checkbox that changes nothing is worse than no
 * checkbox. If a longer-lived session is wanted, that is a decision about the refresh
 * token's lifetime and it belongs in the API.
 *
 * "Demo Access" is a prototype affordance: it signs you in without credentials. This
 * product holds patient records and has no demo mode, so there is no button to build.
 *
 * FORGOT PASSWORD IS VISIBLE AND DISABLED. D-003: there is no email provider, so there is
 * nothing to send a reset link with. The prototype's version simulates sending one, which
 * is fine in a prototype and a lie in production.
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
    <AuthLayout
      headline="One calm place for every clinic day."
      subhead="Appointments, patients and the AI receptionist's activity, organised in one place for your whole clinic."
      footnote="Your clinic's data is private to your clinic. Only your team can see it."
    >
      {/* The brand panel is hidden below lg, so the wordmark comes inline instead. */}
      <Logo className="self-start lg:hidden" />

      <div className="flex flex-col gap-1">
        <span className="text-xs font-bold uppercase tracking-[1.1px] text-accent">
          Welcome back
        </span>
        <h1 className="m-0 text-2xl font-bold tracking-[-0.8px] text-default">
          Sign in to ClinicAI
        </h1>
        <p className="m-0 text-sm leading-[1.6] text-muted">{audienceNote}</p>
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

        {/* The wireframe's row. "Remember me" is absent: see the header comment. */}
        <div className="flex items-center justify-end">
          <button
            type="button"
            disabled
            className="text-xs font-semibold text-subtle disabled:cursor-not-allowed"
            aria-describedby="forgot-note"
          >
            Forgot password?
          </button>
        </div>

        <Button type="submit" size="lg" fullWidth loading={isSubmitting}>
          Sign in
        </Button>
      </form>

      <small id="forgot-note" className="text-xs leading-[1.6] text-subtle">
        Password reset is coming soon. For now, ask an administrator to issue a new temporary
        password.
      </small>
    </AuthLayout>
  );
};
