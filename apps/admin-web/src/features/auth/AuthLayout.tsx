import type { ReactNode } from 'react';

/**
 * The two-panel frame every signed-out screen sits in.
 *
 * Transcribed from the prototype's `.auth-page`: a 44/56 split, a gradient brand panel on
 * the left carrying the product's one line of marketing, and the form on the right. Every
 * number here came out of `ClinicFlow Interactive Prototype/src/index.css` rather than off
 * a screenshot, which is why the grid is `minmax(430px, 44%)` and not a round `45%`.
 *
 * WHY THE BRAND PANEL DISAPPEARS BELOW `lg` RATHER THAN STACKING. The prototype is
 * desktop-only: its `.auth-page` sets a 430px minimum on the left column and its `body` a
 * 1180px minimum overall, so it has no answer for a narrow window. Stacking the panel above
 * the form would push the form below the fold on a phone, which is the one thing a sign-in
 * screen must not do. So the panel is hidden and the wordmark moves inline above the form,
 * which is what the prototype's own unused `.mobile-logo` rule was reaching for.
 *
 * THE TWO CIRCLES ARE DECORATION AND ARE MARKED AS SUCH. They are `aria-hidden` and sit
 * behind `z-0`, so nothing in the accessibility tree mentions them.
 */
export const AuthLayout = ({
  headline,
  subhead,
  footnote,
  children,
}: {
  readonly headline: string;
  readonly subhead: string;
  /** The pill at the bottom of the brand panel. */
  readonly footnote: string;
  readonly children: ReactNode;
}) => (
  <div className="grid min-h-screen grid-cols-1 bg-surface lg:grid-cols-[minmax(430px,44%)_minmax(550px,56%)]">
    <section
      className="relative hidden flex-col justify-between overflow-hidden px-16 py-14 text-inverse lg:flex"
      style={{ background: 'var(--oh-gradient-brand)' }}
    >
      {/* Decoration only: the prototype's `.auth-brand:before` and `:after`. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-[360px] -top-[15px] z-0 size-[740px] rounded-full border border-white/15"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-[280px] top-20 z-0 size-[560px] rounded-full border border-white/15"
      />

      <span className="relative z-10 grid size-[34px] place-items-center rounded-md border border-white/25 bg-white/15">
        <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none">
          <path
            d="M12 6.75v5.25l3.25 2"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="2" />
        </svg>
      </span>

      <div className="relative z-10 max-w-[510px]">
        <span className="text-xl font-bold">OpenHours</span>
        {/*
         * A paragraph, not an `h1`, even though it is the biggest text on the screen.
         *
         * The page has one heading and it is "Sign in to OpenHours" in the form: that is
         * what the page is for and what a screen-reader user navigating by heading wants
         * to land on. This is marketing copy. Marking it up as an `h1` gave the page two
         * of them, which is a real defect rather than a lint preference: the document
         * outline gains a second top-level section that does not exist, and
         * `getByRole('heading', { level: 1 })` becomes ambiguous, which is how the
         * browser tests caught it.
         */}
        <p
          className="my-[22px] font-bold leading-[1.08] tracking-[-2px]"
          style={{ fontSize: 'var(--oh-text-display)' }}
        >
          {headline}
        </p>
        <p className="m-0 max-w-[450px] text-md leading-[1.7] text-white/80">{subhead}</p>
      </div>

      <p className="relative z-10 m-0 w-fit rounded-lg border border-white/20 bg-white/10 px-3.5 py-2.5 text-xs">
        {footnote}
      </p>
    </section>

    <section className="grid place-items-center bg-gradient-to-b from-surface to-[var(--oh-white-050)] px-6 py-12 lg:p-[50px]">
      <div className="flex w-[min(430px,100%)] flex-col gap-4">{children}</div>
    </section>
  </div>
);
