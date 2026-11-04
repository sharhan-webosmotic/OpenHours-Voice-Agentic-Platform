import { cn } from './cn';

/**
 * The ClinicAI mark and wordmark, as the dashboard design draws them.
 *
 * ─── THE MEASUREMENTS ARE THE EXPORT'S ─────────────────────────────────────────
 *
 * A 34px tile at the control radius, filled with the accent and lifted by a shadow tinted with
 * the accent rather than with black, then the wordmark at 19px bold with -0.5px tracking.
 * From `ClinicFlow Interactive Prototype/src/DashboardDesign.tsx`, node `1:6`.
 *
 * The mark draws from `currentColor` and the wrapper sets `text-accent`, so the logo takes
 * the accent of whichever application renders it with no per-app asset and no `app` prop.
 * That is the whole of "only the accent colour and the logo differ".
 */
export const Logo = ({
  subtitle,
  className,
}: {
  readonly subtitle?: string | undefined;
  readonly className?: string | undefined;
}) => (
  <span className={cn('inline-flex items-center gap-[11px] text-accent', className)}>
    <span className="grid size-[34px] shrink-0 place-items-center rounded-control bg-accent shadow-accent-strong">
      <svg aria-hidden="true" viewBox="0 0 20 20" width="20" height="20" fill="none">
        <path
          d="M10 16.25s-5.833-3.542-5.833-7.708a3.333 3.333 0 0 1 5.833-2.2 3.333 3.333 0 0 1 5.833 2.2c0 4.166-5.833 7.708-5.833 7.708Z"
          stroke="#fff"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
    <span className="font-bold text-[1.1875rem] text-default tracking-[-0.5px]">
      ClinicAI
      {subtitle !== undefined && <span className="font-medium text-muted"> {subtitle}</span>}
    </span>
  </span>
);
