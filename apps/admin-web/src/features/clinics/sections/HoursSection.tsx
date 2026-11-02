import { useState } from 'react';
import {
  MINUTES_IN_DAY,
  WEEKDAYS,
  clinicHoursSchema,
  type ClinicHoursInput,
  type Weekday,
} from '@clinicai/shared';
import type { ClinicDetailView } from '@clinicai/api-client';
import { Alert } from '../../../components/ui/Alert';
import { Button } from '../../../components/ui/Button';
import { clinicsApi } from '../../../lib/clinicsApi';
import { SectionCard } from '../SectionCard';
import { applyServerErrors, useSaveSection } from '../useClinics';

/**
 * Opening hours: a week of segments, with breaks and closed days.
 *
 * NOT A REACT HOOK FORM. The other sections are flat objects and bind straight to inputs;
 * this one is seven days each holding a list of segments, and expressing that through
 * `useFieldArray` produces more wiring than the thing it wires. The schema is still the
 * shared one, applied to the assembled payload on submit, so the rules are identical to the
 * API's.
 *
 * A BREAK IS THE GAP BETWEEN TWO SEGMENTS, which is why this renders "opening times" rather
 * than an "opens / closes / break from / break to" grid. That shape expresses two breaks as
 * easily as one, and a clinic that closes 13:00 to 17:00 is the same data as a clinic with
 * two sessions, which is what it actually is.
 *
 * CLOSED IS AN EXPLICIT CHOICE, not an absence. A day with no segments is a weekly off, and
 * the payload states all seven weekdays every time, so saving records that the question was
 * asked. That is the distinction `openingHoursCollectedAt` exists for: a clinic nobody has
 * asked about must not read as a clinic closed all week.
 */

type Segment = { readonly opens: string; readonly closes: string };
type Week = Readonly<Record<Weekday, readonly Segment[]>>;

const minutesToClock = (minute: number): string =>
  `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;

/** `HH:MM` to minutes from midnight. NaN for anything else, which the schema then refuses. */
const clockToMinutes = (clock: string): number => {
  const [hours, minutes] = clock.split(':');
  return Number(hours) * 60 + Number(minutes);
};

const DEFAULT_SEGMENT: Segment = { opens: '09:00', closes: '17:00' };

/** The gap a newly added break opens up, in minutes. */
const NEW_BREAK_MINUTES = 60;

/**
 * Adds a break to a day, by SPLITTING its last opening rather than appending after it.
 *
 * THIS WAS A REAL DEFECT, and only running the form in a browser found it. Appending a
 * segment after the last one produced 09:00-17:00 followed by 17:00-20:00, which touch, and
 * the schema refuses touching segments because they are one opening written as two. So the
 * primary affordance for adding a break failed validation on its first click, and the user
 * had to work out for themselves that they also needed to shorten the morning.
 *
 * Splitting is also what the button actually means. A clinic with one 09:00-17:00 opening
 * that takes a lunch break has 09:00-13:00 and 14:00-17:00, which is this function's output,
 * and is a valid state the moment it appears.
 *
 * A day whose last opening is too short to split takes an appended segment instead, after a
 * real gap, and only when the day has room for one. Returning the day unchanged is the right
 * answer for a day that is already full: the button is hidden at four segments, and a day
 * ending at 23:30 has nowhere to put a fifth.
 */
const withBreakAdded = (segments: readonly Segment[]): readonly Segment[] => {
  const last = segments[segments.length - 1];

  if (last === undefined) {
    return [DEFAULT_SEGMENT];
  }

  const opens = clockToMinutes(last.opens);
  const closes = clockToMinutes(last.closes);
  const length = closes - opens;

  // Long enough to hold two openings and a gap between them.
  if (length >= NEW_BREAK_MINUTES * 3) {
    const midpoint = opens + Math.round((length - NEW_BREAK_MINUTES) / 2);

    return [
      ...segments.slice(0, -1),
      { opens: last.opens, closes: minutesToClock(midpoint) },
      { opens: minutesToClock(midpoint + NEW_BREAK_MINUTES), closes: last.closes },
    ];
  }

  // Too short to split: append after a gap, if the day has room.
  const appendedOpens = closes + NEW_BREAK_MINUTES;
  const appendedCloses = appendedOpens + NEW_BREAK_MINUTES;

  if (appendedCloses > MINUTES_IN_DAY) {
    return segments;
  }

  return [
    ...segments,
    { opens: minutesToClock(appendedOpens), closes: minutesToClock(appendedCloses) },
  ];
};

/**
 * Built by reduce rather than `Object.fromEntries`, which types its result as an index
 * signature and would need a cast to become a `Week`. A cast there would also hide a
 * genuinely missing weekday, and a week with six days is exactly the bug worth catching.
 */
const weekFrom = (clinic: ClinicDetailView): Week =>
  WEEKDAYS.reduce<Week>(
    (week, weekday) => ({
      ...week,
      [weekday]: (clinic.hours.find((day) => day.weekday === weekday)?.segments ?? []).map(
        (segment) => ({
          opens: minutesToClock(segment.opensAtMinute),
          closes: minutesToClock(segment.closesAtMinute),
        }),
      ),
    }),
    EMPTY_WEEK,
  );

/** Every weekday present and closed: the starting point `weekFrom` fills in. */
const EMPTY_WEEK: Week = {
  MONDAY: [],
  TUESDAY: [],
  WEDNESDAY: [],
  THURSDAY: [],
  FRIDAY: [],
  SATURDAY: [],
  SUNDAY: [],
};

export const HoursSection = ({
  clinic,
  canWrite,
  missingCount,
}: {
  readonly clinic: ClinicDetailView;
  readonly canWrite: boolean;
  readonly missingCount: number;
}) => {
  const [week, setWeek] = useState<Week>(() => weekFrom(clinic));
  const [error, setError] = useState<string | undefined>(undefined);
  const [success, setSuccess] = useState<string | undefined>(undefined);

  const save = useSaveSection<ClinicHoursInput>(clinic.organisation.id, clinicsApi.saveHours);

  const setDay = (weekday: Weekday, segments: readonly Segment[]): void => {
    setWeek((previous) => ({ ...previous, [weekday]: segments }));
  };

  const submit = (): void => {
    setError(undefined);
    setSuccess(undefined);

    const payload = {
      days: WEEKDAYS.map((weekday) => ({
        weekday,
        segments: week[weekday].map((segment) => ({
          opensAtMinute: clockToMinutes(segment.opens),
          closesAtMinute: clockToMinutes(segment.closes),
        })),
      })),
    };

    // Validated against the same schema the API parses, so the message a user sees here is
    // the message the server would have sent.
    const parsed = clinicHoursSchema.safeParse(payload);

    if (!parsed.success) {
      setError(parsed.error.issues.map((issue) => issue.message).join(' '));
      return;
    }

    save
      .mutateAsync(parsed.data)
      .then(() => {
        setSuccess('Opening hours saved.');
      })
      .catch((caught: unknown) => {
        setError(applyServerErrors(caught, () => undefined) ?? 'The opening hours were not saved.');
      });
  };

  return (
    <SectionCard
      id="hours"
      title="Opening hours"
      description="Stated for all seven days, including the closed ones. Two opening times on one day means a break between them."
      missingCount={missingCount}
      canWrite={canWrite}
      saving={save.isPending}
      error={error}
      success={success}
      onSubmit={canWrite ? submit : undefined}
    >
      {clinic.organisation.openingHoursCollectedAt === null && (
        <Alert kind="info">
          These hours have never been saved, so the voice agent is told not to state any opening
          hours at all. Saving once, even with every day closed, records that the clinic was asked.
        </Alert>
      )}

      <div className="flex flex-col gap-3">
        {WEEKDAYS.map((weekday) => {
          const segments = week[weekday];
          const closed = segments.length === 0;
          const dayName = weekday.charAt(0) + weekday.slice(1).toLowerCase();

          return (
            <div
              key={weekday}
              className="flex flex-wrap items-center gap-3 rounded-md border border-border px-3 py-2.5"
            >
              <span className="w-24 shrink-0 font-semibold text-xs text-default">{dayName}</span>

              <label className="flex items-center gap-2 text-xs text-muted">
                {/*
                  The accessible name names the DAY, not just "Closed". Seven checkboxes all
                  announced as "Closed" tell a screen reader user nothing about which one
                  they are on, and the visible day name beside it is not part of the label.
                */}
                <input
                  type="checkbox"
                  aria-label={`${dayName} closed`}
                  checked={closed}
                  disabled={!canWrite}
                  onChange={(event) => {
                    setDay(weekday, event.target.checked ? [] : [DEFAULT_SEGMENT]);
                  }}
                />
                Closed
              </label>

              {!closed && (
                <div className="flex flex-wrap items-center gap-2">
                  {segments.map((segment, index) => (
                    // Index as key: these rows have no id of their own, and the list is
                    // only ever appended to or truncated from the end.
                    <div key={`${weekday}-${String(index)}`} className="flex items-center gap-1.5">
                      <input
                        type="time"
                        aria-label={`${dayName} opening time ${String(index + 1)}`}
                        value={segment.opens}
                        disabled={!canWrite}
                        className="h-9 rounded-md border border-border bg-surface px-2 text-xs text-default"
                        onChange={(event) => {
                          setDay(
                            weekday,
                            segments.map((current, position) =>
                              position === index
                                ? { ...current, opens: event.target.value }
                                : current,
                            ),
                          );
                        }}
                      />
                      <span className="text-xs text-muted">to</span>
                      <input
                        type="time"
                        aria-label={`${dayName} closing time ${String(index + 1)}`}
                        value={segment.closes}
                        disabled={!canWrite}
                        className="h-9 rounded-md border border-border bg-surface px-2 text-xs text-default"
                        onChange={(event) => {
                          setDay(
                            weekday,
                            segments.map((current, position) =>
                              position === index
                                ? { ...current, closes: event.target.value }
                                : current,
                            ),
                          );
                        }}
                      />
                      {canWrite && segments.length > 1 && (
                        <button
                          type="button"
                          className="text-xs text-danger hover:underline"
                          onClick={() => {
                            setDay(
                              weekday,
                              segments.filter((_, position) => position !== index),
                            );
                          }}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}

                  {/* Four is the schema's maximum, which is more sessions than any clinic
                      in the pilot runs and still bounded. */}
                  {canWrite && segments.length < 4 && (
                    <Button
                      kind="secondary"
                      onClick={() => {
                        setDay(weekday, withBreakAdded(segments));
                      }}
                    >
                      Add a break
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
};
