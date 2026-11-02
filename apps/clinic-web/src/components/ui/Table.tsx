import type { ReactNode } from 'react';
import { cn } from './cn';

/**
 * A data table, and a status pill to put in one.
 *
 * ONE COPY PER APPLICATION (D-009), and this is the dashboard's. It arrived here by being
 * ported from the console rather than rewritten, because the two are the same table and a
 * second design of it would be a divergence with no reason behind it. A change to one has to
 * be applied to the other: nothing enforces that, which is the cost D-009 accepts.
 *
 * REAL TABLE SEMANTICS, not a grid of divs. A clinic list is tabular data, and a screen
 * reader user navigating it needs the row and column relationships that `<table>` gives for
 * free and that `role="table"` on divs only approximates. The caption is visually hidden
 * rather than absent, because a table with no accessible name is announced as "table" and
 * nothing else.
 */

export const Table = ({
  caption,
  head,
  children,
}: {
  /** Describes the table to a screen reader. Required, deliberately. */
  readonly caption: string;
  readonly head: readonly string[];
  readonly children: ReactNode;
}) => (
  <div className="overflow-x-auto rounded-xl border border-border bg-surface">
    <table className="w-full border-collapse text-xs">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr>
          {head.map((heading) => (
            <th
              key={heading}
              scope="col"
              className="border-border border-b px-4 py-3 text-left font-semibold text-muted"
            >
              {heading}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  </div>
);

export const Row = ({ children }: { readonly children: ReactNode }) => (
  <tr className="border-border border-b last:border-b-0 hover:bg-background">{children}</tr>
);

export const Cell = ({
  children,
  muted = false,
}: {
  readonly children: ReactNode;
  readonly muted?: boolean | undefined;
}) => <td className={cn('px-4 py-3', muted ? 'text-muted' : 'text-default')}>{children}</td>;

export type BadgeKind = 'neutral' | 'success' | 'warning' | 'danger';

const BADGES: Record<BadgeKind, string> = {
  neutral: 'bg-background text-muted',
  success: 'bg-success-surface text-success',
  warning: 'bg-warning-surface text-warning',
  danger: 'bg-danger-surface text-danger',
};

/**
 * A short status label.
 *
 * The text carries the meaning and the colour only reinforces it, which is the house rule:
 * a badge that says nothing and is merely green is unreadable in monochrome and to anyone
 * who cannot distinguish it from the red one beside it.
 */
export const Badge = ({
  kind = 'neutral',
  children,
}: {
  readonly kind?: BadgeKind | undefined;
  readonly children: ReactNode;
}) => (
  <span
    className={cn(
      'inline-flex items-center rounded-full px-2 py-0.5 font-semibold text-xs',
      BADGES[kind],
    )}
  >
    {children}
  </span>
);
