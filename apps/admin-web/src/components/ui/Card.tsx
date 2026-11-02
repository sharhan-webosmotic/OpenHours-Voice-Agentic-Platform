import type { ReactNode } from 'react';
import { cn } from './cn';

/** A surface panel: the prototype's one container treatment. */
export const Card = ({
  id,
  className,
  children,
}: {
  /**
   * An anchor target, for a page whose own index links to its sections.
   *
   * Optional and unused by most cards. It exists because the settings screen has a section
   * list beside it, and `#profile` has to land somewhere.
   */
  readonly id?: string | undefined;
  readonly className?: string | undefined;
  readonly children: ReactNode;
}) => (
  <div
    {...(id === undefined ? {} : { id })}
    className={cn('rounded-xl border border-border bg-surface shadow-card p-6', className)}
  >
    {children}
  </div>
);
