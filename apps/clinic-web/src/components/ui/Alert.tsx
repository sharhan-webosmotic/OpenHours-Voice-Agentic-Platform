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

/**
 * `warning` arrived with the clinic dashboard's booking form, and it earns its place.
 *
 * "The clinic is closed that day" is neither an error nor a note: nothing went wrong, and the
 * sentence is the answer to what the user just asked for. Showing it in red says the product
 * broke; showing it in grey hides the one thing on the screen that matters. The tokens
 * already carried a warning surface, which is the clue that this variant was always expected.
 *
 * Added to both applications, because D-009 holds one copy of this file per application and a
 * variant in only one of them is a divergence waiting to surprise somebody.
 */
export type AlertKind = 'danger' | 'warning' | 'success' | 'info';

const KINDS: Record<AlertKind, { readonly box: string; readonly label: string }> = {
  danger: { box: 'bg-danger-surface text-danger', label: 'Error' },
  warning: { box: 'bg-warning-surface text-warning', label: 'Heads up' },
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
