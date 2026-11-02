import { useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from './cn';

/**
 * A labelled text input, and the accessibility contract for every form in the product.
 *
 * WHY LABEL AND INPUT ARE ONE COMPONENT. Keeping them separate makes correct wiring
 * optional: somebody writes a bare `<input>` with a `<span>` beside it, and a screen
 * reader announces "edit text, blank". Here the id is generated with `useId` and the
 * label, hint and error are attached to it by construction, so there is no way to render
 * this and get it wrong.
 *
 * `aria-describedby` points at the hint AND the error when both exist, in that order,
 * because a reader should hear what the field wants before it hears what went wrong.
 * `aria-invalid` is set only when there is an error, never as `false`: an explicit
 * `aria-invalid="false"` on every field is noise that some readers announce.
 *
 * The error is a `role="alert"`, so a validation failure after submit is announced
 * without the user having to go looking for it.
 */

export type FieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'className'> & {
  readonly label: string;
  readonly hint?: string | undefined;
  readonly error?: string | undefined;
  /** Rendered inside the field box, after the input: the password show/hide control. */
  readonly trailing?: ReactNode | undefined;
};

export const Field = ({ label, hint, error, trailing, ...input }: FieldProps) => {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const described = cn(hint !== undefined && hintId, error !== undefined && errorId);

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="font-semibold text-xs text-default">
        {label}
      </label>

      <div className="relative">
        <input
          {...input}
          id={id}
          aria-invalid={error === undefined ? undefined : true}
          aria-describedby={described.length > 0 ? described : undefined}
          className={cn(
            'w-full h-10 rounded-md border bg-surface px-3 text-xs text-default',
            'placeholder:text-subtle',
            trailing !== undefined && 'pr-16',
            error === undefined ? 'border-border' : 'border-danger',
          )}
        />
        {trailing !== undefined && (
          <div className="absolute inset-y-0 right-1 flex items-center">{trailing}</div>
        )}
      </div>

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
