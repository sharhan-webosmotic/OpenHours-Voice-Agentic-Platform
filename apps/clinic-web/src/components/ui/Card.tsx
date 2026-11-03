import type { ReactNode } from 'react';
import { cn } from './cn';

/** A surface panel: the prototype's one container treatment. */
export const Card = ({
  id,
  className,
  padded = true,
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
  /**
   * `false` when the caller sets its own padding in `className`.
   *
   * A PROP, NOT A CLASS TO OVERRIDE, because `cn` joins class names rather than resolving
   * them: `p-0` beside the default `p-6` gave two padding rules, and the stylesheet's order
   * picked `p-6`. So a card that asked for no padding, like the patient profile's tables and
   * the month grid, quietly had 24px of it. Turning the default off is the only reliable way
   * to replace it.
   */
  readonly padded?: boolean | undefined;
  readonly children: ReactNode;
}) => (
  <div
    {...(id === undefined ? {} : { id })}
    className={cn(
      // The dashboard reference's card: 18px, a hairline at 90% of the chrome border, and
      // the long soft shadow. Every screen's cards share it, so none can drift.
      'rounded-card border border-[rgba(233,237,245,0.9)] bg-surface shadow-card',
      padded && 'p-6',
      className,
    )}
  >
    {children}
  </div>
);
