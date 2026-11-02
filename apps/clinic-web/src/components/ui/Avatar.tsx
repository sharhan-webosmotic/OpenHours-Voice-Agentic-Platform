import { cn } from './cn';

/**
 * Initials in a soft square, as the prototype draws a person.
 *
 * NO IMAGE, because the product stores no patient photographs and will not: an avatar that
 * could hold one is an invitation to add the field.
 *
 * `aria-hidden`, and that is the important part. The initials are decoration beside a name
 * that is already on screen, so announcing "L M Laura Miller" to a screen reader is noise.
 * When a name is masked the initials are blank rather than invented, because `?` beside an
 * empty cell reads as missing data where a letter would read as a name nobody can see.
 */
export const Avatar = ({
  name,
  className,
}: {
  readonly name: string | null;
  readonly className?: string | undefined;
}) => {
  const initials =
    name === null
      ? ''
      : name
          .split(/\s+/)
          .filter((part) => part.length > 0)
          .slice(0, 2)
          .map((part) => part[0]?.toUpperCase() ?? '')
          .join('');

  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent-surface font-semibold text-[0.6875rem] text-accent',
        className,
      )}
    >
      {initials}
    </span>
  );
};
