/**
 * An indeterminate activity indicator.
 *
 * `aria-hidden`, always, with no exception. A spinner conveys "something is happening",
 * which the thing that owns the wait must already be announcing: a button says
 * `aria-busy`, a region says `aria-live`. Letting the spinner speak too produces two
 * announcements for one event.
 */
export const Spinner = ({ className }: { readonly className?: string | undefined }) => (
  <svg
    aria-hidden="true"
    className={className}
    viewBox="0 0 16 16"
    width="16"
    height="16"
    fill="none"
  >
    <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
    <path d="M14.5 8A6.5 6.5 0 0 0 8 1.5" stroke="currentColor" strokeWidth="2">
      <animateTransform
        attributeName="transform"
        type="rotate"
        from="0 8 8"
        to="360 8 8"
        dur="0.7s"
        repeatCount="indefinite"
      />
    </path>
  </svg>
);
