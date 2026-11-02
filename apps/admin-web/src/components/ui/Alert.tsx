import type { ReactNode } from 'react';
import { cn } from './cn';

/**
 * A form-level or page-level message.
 *
 * `danger` renders as `role="alert"`, which interrupts a screen reader, because a failed
 * sign-in is the thing the user is waiting to hear. `info` and `success` render as
 * `role="status"`, which waits for a pause, because neither is urgent.
 *
 * Status is never carried by colour alone: each kind renders a text label as well as its
 * wash, so the message still reads as a failure in monochrome or to a user who cannot
 * distinguish the red from the green.
 */

export type AlertKind = 'danger' | 'success' | 'info';

const KINDS: Record<AlertKind, { readonly box: string; readonly label: string }> = {
  danger: { box: 'bg-danger-surface text-danger', label: 'Error' },
  success: { box: 'bg-success-surface text-success', label: 'Done' },
  info: { box: 'bg-background text-muted', label: 'Note' },
};

export const Alert = ({
  kind = 'info',
  children,
}: {
  readonly kind?: AlertKind | undefined;
  readonly children: ReactNode;
}) => {
  const style = KINDS[kind];

  return (
    <div
      role={kind === 'danger' ? 'alert' : 'status'}
      className={cn('rounded-md px-3 py-2.5 text-xs', style.box)}
    >
      <strong className="font-semibold">{style.label}: </strong>
      {children}
    </div>
  );
};
