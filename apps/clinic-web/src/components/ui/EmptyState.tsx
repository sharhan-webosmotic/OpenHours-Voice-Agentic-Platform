import type { ReactNode } from 'react';

/**
 * What a region shows when it has nothing to show.
 *
 * `action` is a slot rather than optional decoration: the house rule is that an empty
 * state names the next step, because "No records found" on its own tells a user that the
 * product is broken rather than that it is waiting for them.
 */
export const EmptyState = ({
  title,
  body,
  action,
}: {
  readonly title: string;
  readonly body: string;
  readonly action?: ReactNode | undefined;
}) => (
  <div className="flex flex-col items-center gap-2 rounded-xl border border-border border-dashed bg-surface px-6 py-14 text-center">
    <strong className="text-md font-semibold text-default">{title}</strong>
    <p className="m-0 max-w-prose text-xs text-muted">{body}</p>
    {action !== undefined && <div className="mt-2">{action}</div>}
  </div>
);
