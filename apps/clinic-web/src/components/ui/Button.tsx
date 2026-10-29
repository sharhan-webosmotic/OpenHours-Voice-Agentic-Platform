import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';
import { Spinner } from './Spinner';

/**
 * The only button in the product.
 *
 * Three kinds, taken from the prototype: a filled accent primary, an outlined secondary,
 * and a filled danger for destructive confirmations. No ghost or link kind, because
 * nothing in this feature needs one and an unused variant is a variant nobody maintains.
 *
 * `type` DEFAULTS TO `button`, not to `submit`. HTML's own default is `submit`, which is
 * the wrong default inside a form: a button added for an unrelated purpose silently
 * becomes a second submit control. A button that submits says so.
 */

export type ButtonKind = 'primary' | 'secondary' | 'danger';

export type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> & {
  readonly kind?: ButtonKind | undefined;
  /** Shows a spinner, sets `aria-busy` and blocks activation. */
  readonly loading?: boolean | undefined;
  readonly fullWidth?: boolean | undefined;
  readonly children: ReactNode;
};

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-md px-4 h-10 font-semibold ' +
  'text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50';

const KINDS: Record<ButtonKind, string> = {
  primary: 'bg-accent text-inverse hover:bg-accent-strong',
  secondary: 'bg-surface text-default border border-border hover:bg-background',
  danger: 'bg-danger text-inverse hover:brightness-95',
};

export const Button = ({
  kind = 'primary',
  loading = false,
  fullWidth = false,
  type = 'button',
  disabled,
  children,
  ...rest
}: ButtonProps) => (
  <button
    {...rest}
    type={type}
    // Disabled while loading, so a double submit cannot happen through the button. The
    // client is single-flight too, because a button is not a control over the network.
    disabled={disabled === true || loading}
    aria-busy={loading || undefined}
    className={cn(BASE, KINDS[kind], fullWidth && 'w-full')}
  >
    {loading && <Spinner />}
    {children}
  </button>
);
