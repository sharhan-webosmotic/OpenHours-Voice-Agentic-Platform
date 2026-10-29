import { Button } from '../../components/ui/Button';
import { Logo } from '../../components/ui/Logo';
import { useAuth } from '../../app/AuthProvider';
import { AuthLayout } from './AuthLayout';

/**
 * Shown when a signed-in user reaches a page their role may not read, or signs in to an
 * application where their role reaches nothing at all.
 *
 * WHY IT EXPLAINS INSTEAD OF REDIRECTING. A silent bounce to a landing page reads as a bug
 * and generates a support call. It also hides the real situation from the one person who
 * can resolve it: the user, who has to go and ask an administrator for a different role.
 *
 * WHY IT DOES NOT NAME THE RESOURCE OR THE ROLE'S GRANTS. "You need patients:write" is an
 * internal fact. It tells somebody probing the product what the permission is called and
 * what else might exist, and it means nothing to the clinic receptionist who is reading it.
 */
export const NoAccessPage = ({
  reason = 'Your role does not include access to this page.',
}: {
  readonly reason?: string | undefined;
}) => {
  const { signOut } = useAuth();

  return (
    <AuthLayout
      headline="Every clinic on the platform, in one view."
      subhead="Provisioning, monitoring and support for every OpenHours clinic, in one console."
      footnote="Internal tool. Every action here is recorded in the audit log."
    >
      <Logo className="self-start lg:hidden" />

      <div className="flex flex-col gap-1">
        <span className="text-xs font-bold uppercase tracking-[1.1px] text-accent">Access</span>
        <h1 className="m-0 text-2xl font-bold tracking-[-0.8px] text-default">No access</h1>
      </div>

      <p className="m-0 text-sm leading-[1.6] text-muted">{reason}</p>
      <p className="m-0 text-sm leading-[1.6] text-muted">
        If you believe this is wrong, ask a clinic owner or an administrator to review your role.
        Nothing is missing from your account: this page is simply not part of it.
      </p>

      <Button kind="secondary" size="lg" onClick={() => void signOut()}>
        Sign out
      </Button>
    </AuthLayout>
  );
};
