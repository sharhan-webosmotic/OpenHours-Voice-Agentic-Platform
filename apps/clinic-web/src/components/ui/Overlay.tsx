import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from './cn';

/**
 * The two overlays the prototype uses: a centred modal and a right-hand drawer.
 *
 * ONE IMPLEMENTATION, TWO PRESENTATIONS. The prototype's booking form is a modal and its
 * appointment and call details are drawers, and the behaviour a user depends on is
 * identical: a backdrop that dismisses, Escape that dismisses, focus moved in on open and
 * returned on close, and the page behind made inert to the keyboard. Two components would
 * be two chances to get that wrong, so the difference is a class name.
 *
 * ─── THE ACCESSIBILITY CONTRACT, WHICH IS THE WHOLE REASON THIS IS A PRIMITIVE ──
 *
 *  - `role="dialog"` and `aria-modal`, labelled by its own heading, so a screen reader
 *    announces what opened rather than reading the page behind it.
 *  - FOCUS MOVES TO THE PANEL on open and RETURNS to the element that opened it on close.
 *    Without the return, dismissing a drawer drops focus to the top of the document and a
 *    keyboard user has to tab back through the sidebar to where they were.
 *  - Tab is TRAPPED inside the panel. A dialog a keyboard user can tab out of, into a page
 *    they cannot see, is a dialog they cannot use.
 *  - Escape closes. So does a click on the backdrop, but not a click inside the panel: the
 *    prototype stops propagation for exactly that reason.
 *  - `inert` on the rest of the page would be the modern way to do the trapping, and it is
 *    not used because the shell is not structured for it yet. The trap below is explicit
 *    instead, which is more code and the same behaviour.
 */

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export type OverlayProps = {
  /** Shown in the header and used as the dialog's accessible name. */
  readonly title: string;
  /** A short label above the title, as the prototype has it: "NEW APPOINTMENT". */
  readonly eyebrow?: string | undefined;
  readonly onClose: () => void;
  readonly children: ReactNode;
  /** The row of buttons pinned to the bottom of the panel. */
  readonly footer?: ReactNode | undefined;
  readonly variant?: 'modal' | 'drawer' | undefined;
  /**
   * `wide` is the booking sheet's 760px, from the reference; `standard` is everything else.
   * A size rather than a class name, so the two widths stay the only two.
   */
  readonly size?: 'standard' | 'wide' | undefined;
};

export const Overlay = ({
  title,
  eyebrow,
  onClose,
  children,
  footer,
  variant = 'modal',
  size = 'standard',
}: OverlayProps) => {
  const panel = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);

  useEffect(() => {
    opener.current = document.activeElement;

    const first = panel.current?.querySelector<HTMLElement>(FOCUSABLE);
    // The panel itself when it holds nothing focusable, so focus never stays behind it.
    (first ?? panel.current)?.focus();

    return () => {
      /**
       * Focus returns to whatever opened the dialog.
       *
       * The check is not defensive noise: the opener can legitimately be gone by now, for
       * instance when the row that held the button was removed by the save that closed the
       * dialog.
       */
      const previous = opener.current;
      if (previous instanceof HTMLElement && document.contains(previous)) {
        previous.focus();
      }
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }

      if (event.key !== 'Tab' || panel.current === null) {
        return;
      }

      const focusable = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      const first = focusable[0];
      const last = focusable.at(-1);

      if (first === undefined || last === undefined) {
        return;
      }

      // Wraps at both ends, which is what makes it a trap rather than a nuisance.
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [onClose]);

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex bg-scrim backdrop-blur-[2px]',
        variant === 'modal' ? 'items-center justify-center p-4' : 'items-stretch justify-end',
      )}
      onClick={onClose}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn(
          'flex max-h-full flex-col overflow-hidden bg-surface shadow-modal outline-none',
          variant === 'modal'
            ? cn('w-full rounded-xl', size === 'wide' ? 'max-w-[760px]' : 'max-w-xl')
            : cn(
                'h-full w-full border-border-chrome border-l',
                // The appointment drawer's 500px is the reference's; the others keep 448.
                size === 'wide' ? 'max-w-[500px]' : 'max-w-md',
              ),
        )}
        // A click inside the panel must not reach the backdrop's dismiss handler.
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        {/*
         * The reference's header: a 12px accent eyebrow with wide tracking, a 22px bold
         * title, and a 34px close button on the chrome border.
         */}
        <div className="flex items-start justify-between gap-4 border-border-chrome border-b px-6 pt-6 pb-5">
          <div className="flex flex-col gap-1.5">
            {eyebrow !== undefined && (
              <span className="font-bold text-accent text-xs uppercase tracking-[1px]">
                {eyebrow}
              </span>
            )}
            <h2 className="m-0 font-bold text-[1.375rem] text-default tracking-[-0.4px]">
              {title}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid size-[34px] shrink-0 place-items-center rounded-control border border-border-chrome text-muted hover:bg-background"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>

        {footer !== undefined && (
          <div className="flex items-center justify-end gap-3 border-border-chrome border-t bg-surface-sunken px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
