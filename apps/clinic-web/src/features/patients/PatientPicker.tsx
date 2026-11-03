import { useEffect, useId, useState } from 'react';
import type { PatientSummary } from '@clinicai/api-client';
import { Search, X } from 'lucide-react';
import { Avatar } from '../../components/ui/Avatar';
import { cn } from '../../components/ui/cn';
import { formatPhone } from '../../lib/phone';
import { usePatientsQuery } from './api';

/**
 * A patient chosen by searching, for the booking sheet.
 *
 * ─── THE SEARCH IS THE SERVER'S, BY NAME OR NUMBER ──────────────────────────────
 *
 * The select it replaces loaded the first hundred patients and filtered nothing, so a clinic
 * with a hundred and one could not book its newest patient. This sends what is typed as the
 * list endpoint's `q`, which matches a name anywhere in it or the digits of a number anywhere
 * in it: `98765`, `43210` and `+91 98765 43210` all find the same person.
 *
 * ─── A COMBOBOX, AS THE ARIA PATTERN DEFINES ONE ────────────────────────────────
 *
 * Focus stays in the input while the arrow keys move the active option, Enter chooses it and
 * Escape closes the list, so a receptionist with a caller on the line never reaches for the
 * mouse. Options are chosen on mouse-down, before the input's blur can close the list under
 * the pointer.
 */

const LIMIT = 8;

type Choice = Pick<PatientSummary, 'id' | 'fullName' | 'phone' | 'sex'>;

export const PatientPicker = ({
  selected,
  onChange,
}: {
  /** The chosen patient, or undefined while none is. */
  readonly selected: Choice | undefined;
  readonly onChange: (patientId: string) => void;
}) => {
  const id = useId();
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(text.trim());
      setActive(0);
    }, 250);

    return () => {
      clearTimeout(timer);
    };
  }, [text]);

  const { data, isFetching } = usePatientsQuery(
    { ...(query === '' ? {} : { q: query }), limit: LIMIT },
    { skip: !open },
  );
  const options = data?.items ?? [];

  const choose = (patient: Choice): void => {
    onChange(patient.id);
    setText('');
    setOpen(false);
  };

  if (selected !== undefined) {
    return (
      <div className="flex flex-col gap-1.5">
        <span className="font-semibold text-default text-xs">Select patient</span>
        <div className="flex items-center gap-3 rounded-control border border-accent/40 bg-accent-surface/40 px-3 py-2">
          <Avatar name={selected.fullName} sex={selected.sex} />
          <span className="flex min-w-0 flex-1 flex-col">
            <strong className="truncate font-semibold text-default text-sm">
              {selected.fullName ?? 'Name hidden'}
            </strong>
            <span className="text-muted text-xs tabular-nums">
              {selected.phone === null ? 'Number hidden' : formatPhone(selected.phone)}
            </span>
          </span>
          <button
            type="button"
            onClick={() => {
              onChange('');
              setOpen(true);
            }}
            className="inline-flex items-center gap-1 rounded-control px-2 py-1 font-semibold text-accent text-xs hover:bg-accent-surface"
          >
            <X size={13} aria-hidden="true" />
            Change
          </button>
        </div>
      </div>
    );
  }

  const listId = `${id}-list`;
  const optionId = (index: number) => `${id}-option-${String(index)}`;

  return (
    <div className="relative flex flex-col gap-1.5">
      <label htmlFor={id} className="font-semibold text-default text-xs">
        Select patient
      </label>
      <div className="relative">
        <Search
          size={15}
          aria-hidden="true"
          className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-3 text-subtle"
        />
        <input
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && options.length > 0 ? optionId(active) : undefined}
          autoComplete="off"
          placeholder="Search by name or mobile number"
          value={text}
          onFocus={() => {
            setOpen(true);
          }}
          onBlur={() => {
            setOpen(false);
          }}
          onChange={(event) => {
            setText(event.target.value);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setOpen(true);
              setActive((current) => Math.min(current + 1, Math.max(options.length - 1, 0)));
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setActive((current) => Math.max(current - 1, 0));
            } else if (event.key === 'Enter') {
              const option = options[active];
              if (open && option !== undefined) {
                event.preventDefault();
                choose(option);
              }
            } else if (event.key === 'Escape') {
              setOpen(false);
            }
          }}
          className="h-[42px] w-full rounded-control border border-border bg-surface pr-3 pl-9 text-default text-sm placeholder:text-subtle"
        />
      </div>

      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Matching patients"
          className="absolute top-full right-0 left-0 z-20 m-0 mt-1 max-h-72 list-none overflow-y-auto rounded-control border border-border-chrome bg-surface p-1 shadow-popover"
        >
          {options.length === 0 ? (
            <li className="px-3 py-3 text-muted text-sm" role="presentation">
              {isFetching
                ? 'Searching…'
                : query === ''
                  ? 'No patients yet.'
                  : `No patient matches “${query}”.`}
            </li>
          ) : (
            <>
              {query === '' && (
                <li role="presentation" className="px-3 pt-2 pb-1 text-subtle text-xs uppercase">
                  Recently added
                </li>
              )}
              {options.map((option, index) => (
                <li
                  key={option.id}
                  id={optionId(index)}
                  role="option"
                  aria-selected={index === active}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    choose(option);
                  }}
                  onMouseEnter={() => {
                    setActive(index);
                  }}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 rounded-md px-2.5 py-2',
                    index === active && 'bg-accent-surface',
                  )}
                >
                  <Avatar name={option.fullName} sex={option.sex} />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-semibold text-default text-sm">
                      {option.fullName ?? 'Name hidden'}
                    </span>
                    <span className="text-muted text-xs tabular-nums">
                      {option.phone === null ? 'Number hidden' : formatPhone(option.phone)}
                    </span>
                  </span>
                </li>
              ))}
            </>
          )}
        </ul>
      )}
    </div>
  );
};
