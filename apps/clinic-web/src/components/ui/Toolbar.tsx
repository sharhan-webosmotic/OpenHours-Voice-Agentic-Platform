import { Search } from 'lucide-react';
import { useId, type ReactNode } from 'react';
import { cn } from './cn';

/**
 * The filter row that sits above every list in the prototype.
 *
 * Appointments, Patients and Call History all have the same arrangement: a search box on
 * the left, filters beside it, and the primary action on the right. One component, so the
 * three cannot drift apart by a few pixels each.
 */
export const Toolbar = ({
  children,
  action,
}: {
  readonly children: ReactNode;
  /** The primary action, pinned right. */
  readonly action?: ReactNode | undefined;
}) => (
  <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
    <div className="flex flex-wrap items-end gap-3">{children}</div>
    {action !== undefined && <div className="flex items-center gap-3">{action}</div>}
  </div>
);

/**
 * The search box, with its label attached and visually hidden.
 *
 * HIDDEN, NOT ABSENT. The prototype shows a magnifier and a placeholder, and a placeholder
 * is not a label: it disappears as soon as anybody types, and a screen reader may not
 * announce it at all. The label is there and `sr-only`, which keeps the design and the
 * accessible name.
 */
export const SearchInput = ({
  label,
  value,
  onChange,
  placeholder,
}: {
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly placeholder: string;
}) => {
  const id = useId();

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <div className="relative">
        <Search
          size={14}
          aria-hidden="true"
          className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-3 text-subtle"
        />
        <input
          id={id}
          type="search"
          value={value}
          placeholder={placeholder}
          onChange={(event) => {
            onChange(event.target.value);
          }}
          className="h-10 w-72 max-w-full rounded-md border border-border bg-surface pr-3 pl-9 text-xs text-default placeholder:text-subtle"
        />
      </div>
    </div>
  );
};

/**
 * A filter control: a labelled select whose label is visible, as the prototype has it.
 *
 * Separate from `Field`'s select because a filter is not a form field: it has no error
 * state, no hint and no validation, and reusing the form control would mean carrying three
 * unused props through every filter on every screen.
 */
export const FilterSelect = ({
  label,
  value,
  onChange,
  options,
}: {
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly options: readonly { readonly value: string; readonly label: string }[];
}) => {
  const id = useId();

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="font-semibold text-[0.6875rem] text-muted uppercase">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        className="h-10 rounded-md border border-border bg-surface px-3 text-xs text-default"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
};

/** A labelled date input, used by the agenda and the booking form. */
export const DateInput = ({
  label,
  value,
  onChange,
  min,
  hideLabel = false,
}: {
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly min?: string | undefined;
  readonly hideLabel?: boolean | undefined;
}) => {
  const id = useId();

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className={cn(
          hideLabel ? 'sr-only' : 'font-semibold text-[0.6875rem] text-muted uppercase',
        )}
      >
        {label}
      </label>
      <input
        id={id}
        type="date"
        value={value}
        min={min}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        className="h-10 rounded-md border border-border bg-surface px-3 text-xs text-default"
      />
    </div>
  );
};

/**
 * The cursor pager the prototype shows under a table.
 *
 * CURSOR, NOT PAGE NUMBERS, because the API is cursor-paginated: a page number would need a
 * total count the API deliberately does not produce, since counting a clinic's whole patient
 * list on every page view is the query that gets slower as the product succeeds.
 */
export const Pager = ({
  page,
  hasNext,
  busy,
  onPrevious,
  onNext,
}: {
  readonly page: number;
  readonly hasNext: boolean;
  readonly busy: boolean;
  readonly onPrevious: () => void;
  readonly onNext: () => void;
}) => (
  <div className="mt-4 flex items-center gap-3">
    <button
      type="button"
      disabled={page === 1 || busy}
      onClick={onPrevious}
      className="h-9 rounded-md border border-border bg-surface px-3 font-semibold text-xs text-default disabled:cursor-not-allowed disabled:opacity-50"
    >
      Previous
    </button>
    <button
      type="button"
      disabled={!hasNext || busy}
      onClick={onNext}
      className="h-9 rounded-md border border-border bg-surface px-3 font-semibold text-xs text-default disabled:cursor-not-allowed disabled:opacity-50"
    >
      Next
    </button>
    <span className="text-xs text-muted" aria-live="polite">
      Page {page}
      {busy && ', loading'}
    </span>
  </div>
);
