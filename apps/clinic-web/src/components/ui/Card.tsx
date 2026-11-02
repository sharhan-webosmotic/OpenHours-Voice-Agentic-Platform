import type { ReactNode } from 'react';
import { cn } from './cn';

/** A surface panel: the prototype's one container treatment. */
export const Card = ({
  className,
  children,
}: {
  readonly className?: string | undefined;
  readonly children: ReactNode;
}) => (
  <div className={cn('rounded-xl border border-border bg-surface shadow-card p-6', className)}>
    {children}
  </div>
);
