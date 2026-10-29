import { cn } from './cn';

/**
 * The ClinicAI mark and wordmark.
 *
 * The mark draws from `currentColor` and the wrapper sets `text-accent`, so the logo
 * takes the accent of whichever application renders it with no per-app asset and no
 * `app` prop. That is the whole of "only the accent colour and the logo differ": the
 * logo differs BY differing in accent.
 */
export const Logo = ({
  subtitle,
  className,
}: {
  readonly subtitle?: string | undefined;
  readonly className?: string | undefined;
}) => (
  <span className={cn('inline-flex items-center gap-2 text-accent', className)}>
    <svg aria-hidden="true" viewBox="0 0 24 24" width="24" height="24" fill="none">
      <rect width="24" height="24" rx="7" fill="currentColor" />
      <path
        d="M12 6.75v5.25l3.25 2"
        stroke="#fff"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
    <span className="text-md font-bold text-default">
      ClinicAI
      {subtitle !== undefined && <span className="font-medium text-muted"> {subtitle}</span>}
    </span>
  </span>
);
