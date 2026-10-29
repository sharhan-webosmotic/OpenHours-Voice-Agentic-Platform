import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Logo } from '../../components/ui/Logo';
import { useAuth } from '../../app/AuthProvider';

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
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="flex w-full max-w-md flex-col gap-5">
        <Logo className="self-center" />

        <Card className="flex flex-col items-start gap-3">
          <h1 className="m-0 text-xl font-bold text-default">No access</h1>
          <p className="m-0 text-xs text-muted">{reason}</p>
          <p className="m-0 text-xs text-muted">
            If you believe this is wrong, ask a clinic owner or an administrator to review your
            role. Nothing is missing from your account: this page is simply not part of it.
          </p>
          <Button kind="secondary" onClick={() => void signOut()}>
            Sign out
          </Button>
        </Card>
      </div>
    </main>
  );
};
