import type { PatientSex } from '@clinicai/shared';
import { Mars, Venus } from 'lucide-react';
import { cn } from './cn';

/**
 * Initials in a circle.
 *
 * NO IMAGE, because the product stores no patient photographs and will not: an avatar that
 * could hold one is an invitation to add the field.
 *
 * `aria-hidden`, and that is the important part. The initials are decoration beside a name
 * that is already on screen, so announcing "L M Laura Miller" to a screen reader is noise.
 * When a name is masked the initials are blank rather than invented, because `?` beside an
 * empty cell reads as missing data where a letter would read as a name nobody can see.
 *
 * A PATIENT'S RECORDED SEX SHOWS AS A SYMBOL, as the patients reference draws it: female on
 * a pink tile, male on the accent's. With nothing recorded it stays initials. The symbol is
 * decoration like the initials are, so every screen that shows it also says it in words
 * beside the name; colour alone carries nothing.
 *
 * SIZE IS A PROP, NOT A CLASS NAME. `cn` joins classes without resolving conflicts, so a
 * caller's `size-16` beside the default `size-9` was decided by stylesheet order, and the
 * profile and staff avatars were quietly rendering at the wrong size and shape.
 */
export type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';

const ICON_SIZES: Record<AvatarSize, number> = { sm: 16, md: 18, lg: 20, xl: 28 };

const SIZES: Record<AvatarSize, string> = {
  sm: 'size-9 text-[0.6875rem]',
  md: 'size-10 text-xs',
  lg: 'size-12 text-xs',
  xl: 'size-16 text-md',
};

export const Avatar = ({
  name,
  size = 'sm',
  sex = null,
}: {
  readonly name: string | null;
  readonly size?: AvatarSize | undefined;
  readonly sex?: PatientSex | null | undefined;
}) => {
  if (sex !== null) {
    const Icon = sex === 'FEMALE' ? Venus : Mars;

    return (
      <span
        aria-hidden="true"
        className={cn(
          'inline-flex shrink-0 items-center justify-center rounded-full',
          SIZES[size],
          sex === 'FEMALE' ? 'bg-female-surface text-female' : 'bg-accent-surface text-accent',
        )}
      >
        <Icon size={ICON_SIZES[size]} />
      </span>
    );
  }

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
        'inline-flex shrink-0 items-center justify-center rounded-full bg-accent-surface font-semibold text-accent',
        SIZES[size],
      )}
    >
      {initials}
    </span>
  );
};
