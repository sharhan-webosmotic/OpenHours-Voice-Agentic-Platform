import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Logo } from '../components/ui/Logo';

/**
 * The last line before a white screen.
 *
 * WHAT IT DOES NOT DO IS THE INTERESTING PART: it never renders the error. A React error
 * message can carry a prop value, and in this product a prop value can be a patient's
 * name, phone number or note. So the user is told that something failed and offered a
 * reload, and the detail goes to the console in development only.
 *
 * It is a class because an error boundary has to be: `componentDidCatch` has no hook
 * equivalent.
 */

type Props = { readonly children: ReactNode };
type State = { readonly failed: boolean };

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    if (import.meta.env.DEV) {
      // Development only. In production this would be the one place patient data could
      // reach a log, and an error-tracking integration is a later, reviewed decision.
      // eslint-disable-next-line no-console -- development-only diagnostic, see comment. M1-13 adds reporting.
      console.error(error, info.componentStack);
    }
  }

  override render(): ReactNode {
    if (!this.state.failed) {
      return this.props.children;
    }

    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="flex w-full max-w-md flex-col gap-5">
          <Logo className="self-center" />
          <Card className="flex flex-col items-start gap-3">
            <h1 className="m-0 text-xl font-bold text-default">Something went wrong</h1>
            <p className="m-0 text-xs text-muted">
              This page could not be displayed. Your data has not been changed. Reloading usually
              resolves it.
            </p>
            <Button onClick={() => window.location.reload()}>Reload the page</Button>
          </Card>
        </div>
      </main>
    );
  }
}
