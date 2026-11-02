import {
  useId,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { cn } from './cn';

/**
 * The select and textarea counterparts to `Field`, plus the wrapper all three share.
 *
 * ONLY IN THE ADMIN CONSOLE, not in the clinic dashboard. D-009 holds a copy of the shared
 * layer in each application and says a change to a shared piece has to be applied to both.
 * These are new pieces rather than changes, and the dashboard has no form that needs them
 * yet, so copying them there would be dead code, which the code quality rules forbid. When
 * the dashboard grows its first select, this file is the thing to port rather than to
 * reinvent, and docs/features/pilot-clinic.md records that.
 *
 * THE ACCESSIBILITY CONTRACT IS `Field`'s, repeated deliberately: the control and its label
 * are one component, the id comes from `useId`, the hint and error attach by construction,
 * `aria-invalid` is set only when there is an error, and the error is a `role="alert"`.
 * Keeping that wiring inside the component is what makes it impossible to render one of
 * these and get it wrong.
 */

const CONTROL =
  'w-full rounded-md border bg-surface px-3 text-xs text-default placeholder:text-subtle';

/** The label, hint and error scaffolding, shared by the two controls below. */
const Labelled = ({
  label,
  hint,
  error,
  render,
}: {
  readonly label: string;
  readonly hint?: string | undefined;
  readonly error?: string | undefined;
  readonly render: (wiring: {
    readonly id: string;
    readonly describedBy: string | undefined;
    readonly invalid: true | undefined;
    readonly className: string;
  }) => ReactNode;
}) => {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const described = cn(hint !== undefined && hintId, error !== undefined && errorId);

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="font-semibold text-xs text-default">
        {label}
      </label>

      {render({
        id,
        describedBy: described.length > 0 ? described : undefined,
        invalid: error === undefined ? undefined : true,
        className: cn(CONTROL, error === undefined ? 'border-border' : 'border-danger'),
      })}

      {hint !== undefined && (
        <small id={hintId} className="text-xs text-muted">
          {hint}
        </small>
      )}
      {error !== undefined && (
        <small id={errorId} role="alert" className="text-xs text-danger">
          {error}
        </small>
      )}
    </div>
  );
};

export type SelectOption = { readonly value: string; readonly label: string };

export type SelectFieldProps = Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  'id' | 'className' | 'children'
> & {
  readonly label: string;
  readonly hint?: string | undefined;
  readonly error?: string | undefined;
  readonly options: readonly SelectOption[];
  /** The label for the empty choice. Omitted means the select has no empty choice. */
  readonly placeholder?: string | undefined;
};

export const SelectField = ({
  label,
  hint,
  error,
  options,
  placeholder,
  ...select
}: SelectFieldProps) => (
  <Labelled
    label={label}
    hint={hint}
    error={error}
    render={(wiring) => (
      <select
        {...select}
        id={wiring.id}
        aria-invalid={wiring.invalid}
        aria-describedby={wiring.describedBy}
        className={cn(wiring.className, 'h-10')}
      >
        {/*
          An explicit empty option, because a clinic field that has not been collected is a
          real state. A select with no empty choice silently reports its first option as the
          answer, which is how a clinic ends up recorded as "FORMAL" because nobody asked.
        */}
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    )}
  />
);

export type TextAreaFieldProps = Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  'id' | 'className'
> & {
  readonly label: string;
  readonly hint?: string | undefined;
  readonly error?: string | undefined;
};

export const TextAreaField = ({
  label,
  hint,
  error,
  rows = 3,
  ...textarea
}: TextAreaFieldProps) => (
  <Labelled
    label={label}
    hint={hint}
    error={error}
    render={(wiring) => (
      <textarea
        {...textarea}
        rows={rows}
        id={wiring.id}
        aria-invalid={wiring.invalid}
        aria-describedby={wiring.describedBy}
        className={cn(wiring.className, 'py-2 leading-relaxed')}
      />
    )}
  />
);
