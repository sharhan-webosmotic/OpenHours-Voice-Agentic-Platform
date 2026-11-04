import { useState } from 'react';
import { Button } from './Button';

/**
 * Copies a value to the clipboard, and says whether it worked.
 *
 * It says so either way because the values copied here are shown once (a temporary password)
 * or pasted into another system (a prompt). A copy that silently failed is found out only when
 * the paste comes up empty, by which time a shown-once password is gone. The clipboard API is
 * missing outside a secure context, so that counts as a failure too, with the same advice.
 */
export const CopyButton = ({
  value,
  label,
}: {
  readonly value: string;
  readonly label: string;
}) => {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');

  const copy = (): void => {
    // `navigator.clipboard` is typed as always present, but it is absent outside a secure
    // context, so this guards the case the type does not describe.
    const clipboard = navigator.clipboard as Clipboard | undefined;
    if (clipboard === undefined) {
      setState('failed');
      return;
    }

    clipboard.writeText(value).then(
      () => {
        setState('copied');
      },
      () => {
        setState('failed');
      },
    );
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button kind="secondary" onClick={copy}>
        {state === 'copied' ? 'Copied' : label}
      </Button>
      {state === 'failed' && (
        <span role="status" className="text-xs text-danger">
          Copying did not work. Select the text and copy it by hand.
        </span>
      )}
    </div>
  );
};
