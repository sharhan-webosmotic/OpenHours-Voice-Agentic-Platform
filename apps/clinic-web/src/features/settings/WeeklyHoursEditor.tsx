import { useEffect, useState } from 'react';
import { WEEKDAYS, type Weekday } from '@clinicai/shared';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { cn } from '../../components/ui/cn';

/**
 * A week of hours, edited one day at a time, from the availability reference.
 *
 * The day list on the left is the week at a glance, each with a switch that opens or closes
 * it; the panel on the right edits the selected day's hours and its break. The whole week is
 * saved together, because the API replaces a week whole: a day saved on its own would be a
 * request the server does not accept.
 *
 * ─── A DAY IS AT MOST TWO SEGMENTS ──────────────────────────────────────────────
 *
 * Hours are stored as segments, and "starts, break starts, break ends, ends" is two segments
 * with the gap between them. A day stored with more than one gap cannot be shown in these
 * four fields without losing one, so it is shown read-only with a warning rather than
 * silently rewritten on the next save.
 */

export type Segment = { readonly opensAtMinute: number; readonly closesAtMinute: number };
export type WeekHours = readonly {
  readonly weekday: Weekday;
  readonly segments: readonly Segment[];
}[];

type DayDraft = {
  readonly open: boolean;
  readonly start: string;
  readonly end: string;
  readonly breakStart: string;
  readonly breakEnd: string;
  /** More than one break: shown, never rewritten here. */
  readonly complex: boolean;
};

export const DAY_NAMES: Record<Weekday, string> = {
  MONDAY: 'Monday',
  TUESDAY: 'Tuesday',
  WEDNESDAY: 'Wednesday',
  THURSDAY: 'Thursday',
  FRIDAY: 'Friday',
  SATURDAY: 'Saturday',
  SUNDAY: 'Sunday',
};

/** Sunday first, as the clinic's calendar and the reference both order the week. */
const ORDER: readonly Weekday[] = ['SUNDAY', ...WEEKDAYS.filter((day) => day !== 'SUNDAY')];

export const toTime = (minutes: number): string =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

const toMinutes = (value: string): number => {
  const [hours, minutes] = value.split(':').map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
};

const toDraft = (segments: readonly Segment[]): DayDraft => {
  const [first, second] = segments;
  const last = segments.at(-1);

  if (first === undefined || last === undefined) {
    return {
      open: false,
      start: '09:00',
      end: '17:00',
      breakStart: '',
      breakEnd: '',
      complex: false,
    };
  }

  return {
    open: true,
    start: toTime(first.opensAtMinute),
    end: toTime(last.closesAtMinute),
    breakStart: second === undefined ? '' : toTime(first.closesAtMinute),
    breakEnd: second === undefined ? '' : toTime(second.opensAtMinute),
    complex: segments.length > 2,
  };
};

const toSegments = (draft: DayDraft, original: readonly Segment[]): readonly Segment[] => {
  if (!draft.open) {
    return [];
  }
  if (draft.complex) {
    return original;
  }
  return draft.breakStart !== '' && draft.breakEnd !== ''
    ? [
        { opensAtMinute: toMinutes(draft.start), closesAtMinute: toMinutes(draft.breakStart) },
        { opensAtMinute: toMinutes(draft.breakEnd), closesAtMinute: toMinutes(draft.end) },
      ]
    : [{ opensAtMinute: toMinutes(draft.start), closesAtMinute: toMinutes(draft.end) }];
};

/** `09:00 to 17:00`, or `Day off`. */
export const daySummary = (segments: readonly Segment[]): string => {
  const first = segments[0];
  const last = segments.at(-1);
  return first === undefined || last === undefined
    ? 'Day off'
    : `${toTime(first.opensAtMinute)} to ${toTime(last.closesAtMinute)}`;
};

const draftsFrom = (week: WeekHours): Record<Weekday, DayDraft> =>
  Object.fromEntries(
    WEEKDAYS.map((weekday) => [
      weekday,
      toDraft(week.find((day) => day.weekday === weekday)?.segments ?? []),
    ]),
  ) as Record<Weekday, DayDraft>;

const Switch = ({
  checked,
  label,
  disabled,
  onChange,
}: {
  readonly checked: boolean;
  readonly label: string;
  readonly disabled: boolean;
  readonly onChange: (next: boolean) => void;
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    onClick={(event) => {
      // The row behind the switch selects the day; the switch only opens or closes it.
      event.stopPropagation();
      onChange(!checked);
    }}
    className={cn(
      'relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-50',
      checked ? 'bg-success' : 'bg-border',
    )}
  >
    <span
      aria-hidden="true"
      className={cn(
        'absolute top-0.5 size-4 rounded-full bg-surface shadow-control transition-[left]',
        checked ? 'left-[18px]' : 'left-0.5',
      )}
    />
  </button>
);

const TimeField = ({
  label,
  value,
  disabled,
  onChange,
}: {
  readonly label: string;
  readonly value: string;
  readonly disabled: boolean;
  readonly onChange: (value: string) => void;
}) => (
  <label className="flex flex-col gap-1.5">
    <span className="font-semibold text-default text-xs">{label}</span>
    <input
      type="time"
      value={value}
      disabled={disabled}
      onChange={(event) => {
        onChange(event.target.value);
      }}
      className="h-10 rounded-control border border-border bg-surface px-3 text-default text-sm disabled:bg-surface-sunken"
    />
  </label>
);

export const WeeklyHoursEditor = ({
  week,
  canWrite,
  saving,
  noun,
  onSave,
}: {
  readonly week: WeekHours;
  readonly canWrite: boolean;
  readonly saving: boolean;
  /** Whose hours, for the sentences: "the clinic", "Dr Priya Sharma". */
  readonly noun: string;
  /** Resolves with an error message to show, or undefined when saved. */
  readonly onSave: (days: WeekHours) => Promise<string | undefined>;
}) => {
  const [drafts, setDrafts] = useState(() => draftsFrom(week));
  const [selected, setSelected] = useState<Weekday>('MONDAY');
  const [problem, setProblem] = useState<string | undefined>(undefined);
  const [saved, setSaved] = useState(false);

  // A different week arriving (another doctor chosen, or a save refetched) replaces the draft.
  useEffect(() => {
    setDrafts(draftsFrom(week));
    setProblem(undefined);
  }, [week]);

  const original = (weekday: Weekday) =>
    week.find((day) => day.weekday === weekday)?.segments ?? [];
  const toWeek = (): WeekHours =>
    WEEKDAYS.map((weekday) => ({
      weekday,
      segments: toSegments(drafts[weekday], original(weekday)),
    }));
  // Compared through the same conversion, so a week that round-trips unchanged is not dirty.
  const baseline = WEEKDAYS.map((weekday) => ({
    weekday,
    segments: toSegments(toDraft(original(weekday)), original(weekday)),
  }));
  const dirty = JSON.stringify(toWeek()) !== JSON.stringify(baseline);

  const update = (weekday: Weekday, change: Partial<DayDraft>): void => {
    setSaved(false);
    setDrafts((current) => ({ ...current, [weekday]: { ...current[weekday], ...change } }));
  };

  const day = drafts[selected];
  const name = DAY_NAMES[selected];
  const editable = canWrite && !day.complex;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[17rem_minmax(0,1fr)]">
        <ul className="m-0 flex list-none flex-col gap-2 p-0" aria-label="Days of the week">
          {ORDER.map((weekday) => {
            const draft = drafts[weekday];
            const isSelected = weekday === selected;

            return (
              <li key={weekday}>
                <div
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelected}
                  onClick={() => {
                    setSelected(weekday);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setSelected(weekday);
                    }
                  }}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 rounded-lg border px-3.5 py-2.5 transition-colors',
                    isSelected
                      ? 'border-accent/40 bg-accent-surface shadow-[inset_3px_0_0_var(--color-accent)]'
                      : 'border-transparent bg-surface-sunken hover:border-border-chrome',
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      'size-2 shrink-0 rounded-full',
                      draft.open ? 'bg-success' : 'bg-subtle',
                    )}
                  />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="font-semibold text-default text-sm">{DAY_NAMES[weekday]}</span>
                    <span className="text-muted text-xs">
                      {draft.open ? `${draft.start} to ${draft.end}` : 'Day off'}
                    </span>
                  </span>
                  <Switch
                    checked={draft.open}
                    label={`${DAY_NAMES[weekday]} open`}
                    disabled={!canWrite || draft.complex}
                    onChange={(open) => {
                      update(weekday, { open });
                    }}
                  />
                </div>
              </li>
            );
          })}
        </ul>

        <section
          aria-label={`${name} availability`}
          className="flex flex-col gap-5 rounded-lg border border-border-chrome p-5"
        >
          <div className="flex items-start justify-between gap-3 border-border-chrome border-b pb-4">
            <div className="flex flex-col gap-0.5">
              <h3 className="m-0 font-bold text-default text-md">{name} availability</h3>
              <p className="m-0 text-muted text-xs">
                {day.open
                  ? 'Patients can book during these hours.'
                  : 'Turn this day on to accept appointments.'}
              </p>
            </div>
            <span
              className={cn(
                'rounded-md px-2 py-0.5 font-semibold text-xs',
                day.open ? 'bg-success-surface text-success' : 'bg-background text-muted',
              )}
            >
              {day.open ? 'Available' : 'Day off'}
            </span>
          </div>

          {day.complex && (
            <Alert kind="warning">
              {name} has more than one break, which these fields cannot show. It is kept exactly as
              it is when the week is saved.
            </Alert>
          )}

          {day.open ? (
            <>
              <div className="flex flex-col gap-3">
                <span className="font-semibold text-default text-sm">Hours</span>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <TimeField
                    label="Starts"
                    value={day.start}
                    disabled={!editable}
                    onChange={(start) => {
                      update(selected, { start });
                    }}
                  />
                  <TimeField
                    label="Ends"
                    value={day.end}
                    disabled={!editable}
                    onChange={(end) => {
                      update(selected, { end });
                    }}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-3 border-border-chrome border-t pt-4">
                <span className="font-semibold text-default text-sm">
                  Break time <span className="pl-1 font-normal text-subtle text-xs">Optional</span>
                </span>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <TimeField
                    label="Break starts"
                    value={day.breakStart}
                    disabled={!editable}
                    onChange={(breakStart) => {
                      update(selected, { breakStart });
                    }}
                  />
                  <TimeField
                    label="Break ends"
                    value={day.breakEnd}
                    disabled={!editable}
                    onChange={(breakEnd) => {
                      update(selected, { breakEnd });
                    }}
                  />
                </div>
              </div>
            </>
          ) : (
            <p className="m-0 rounded-lg border border-border border-dashed bg-surface-sunken px-4 py-5 text-muted text-sm">
              {`${noun} is not available on ${name}. No appointment slots will be offered.`}
            </p>
          )}
        </section>
      </div>

      {problem !== undefined && <Alert kind="danger">{problem}</Alert>}
      {saved && <Alert kind="success">Weekly schedule saved.</Alert>}

      {canWrite && (
        <div className="flex items-center justify-end gap-3 border-border-chrome border-t pt-4">
          <Button
            kind="secondary"
            disabled={!dirty || saving}
            onClick={() => {
              setDrafts(draftsFrom(week));
              setProblem(undefined);
            }}
          >
            Discard changes
          </Button>
          <Button
            loading={saving}
            disabled={!dirty}
            onClick={() => {
              setProblem(undefined);
              void onSave(toWeek()).then((message) => {
                setProblem(message);
                setSaved(message === undefined);
              });
            }}
          >
            Save weekly schedule
          </Button>
        </div>
      )}
    </div>
  );
};
