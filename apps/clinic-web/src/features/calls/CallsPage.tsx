import { useEffect, useState } from 'react';
import { CALL_STATUSES, type CallView, type OverviewRange } from '@clinicai/api-client';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Spinner } from '../../components/ui/Spinner';
import { Badge, Cell, Row, Table } from '../../components/ui/Table';
import { DateInput, FilterSelect, Pager, SearchInput, Toolbar } from '../../components/ui/Toolbar';
import { errorMessage } from '../../lib/problem';
import { formatDate, formatTime } from '../../lib/clinicTime';
import { useCan } from '../../lib/useCan';
import { useClinic } from '../clinic/api';
import { useOverviewQuery } from '../overview/api';
import { AgentCard, VoiceMetrics } from './dashboard';
import { useCallsQuery } from './api';
import { CallDetail } from './CallDetail';
import {
  callerLabel,
  directionLabel,
  durationLabel,
  outcomeLabel,
  statusBadge,
  statusLabel,
} from './status';

/**
 * Call History, from `docs/prototype/laptop-14-calls-list.png`.
 *
 * The capture's layout is kept: a filter bar above a table of time, caller, type, outcome,
 * duration and an action, newest first.
 *
 * ─── THE FILTERS ARE THE CAPTURE'S, MAPPED ONTO FIELDS THAT EXIST ───────────────
 *
 *   capture            here                  why
 *   "Search caller"    caller's number       there is nothing else to match: a call carries
 *                                            a number, and a name only when the number
 *                                            resolved to exactly one patient
 *   date picker        one clinic-local day  unchanged
 *   "All call types"   direction             the platform has incoming and outgoing, not
 *                                            "New patient" and "Reschedule"
 *   "All outcomes"     status                how the call ended. `calls.outcome` exists and
 *                                            nothing writes it yet, so filtering by it would
 *                                            be a filter that only ever matched one value
 *
 * ─── THE PROTOTYPE'S BANNER IS GONE, AND ITS REVIEW COLUMN WITH IT ──────────────
 *
 * The capture carries "AI call records and summaries are fictional", which was true of it and
 * is not true here: these rows are real calls. Its REVIEW column ("Needs review", "Reviewed")
 * has no field behind it, and a column that said the same thing on every row would be
 * decoration. The drawer carries the disabled "Mark as reviewed" control instead, which is
 * where somebody would look for it.
 */

const DIRECTION_OPTIONS = [
  { value: '', label: 'All call types' },
  { value: 'INBOUND', label: 'Incoming' },
  { value: 'OUTBOUND', label: 'Outgoing' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'All outcomes' },
  ...CALL_STATUSES.map((status) => ({ value: status, label: statusLabel(status) })),
];

export const CallsPage = () => {
  const { data: clinic, isLoading: clinicLoading } = useClinic();
  const timeZone = clinic?.organisation.timezone ?? 'UTC';

  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [day, setDay] = useState('');
  const [direction, setDirection] = useState('');
  const [status, setStatus] = useState('');
  const [cursors, setCursors] = useState<readonly (string | undefined)[]>([undefined]);
  const [selected, setSelected] = useState<CallView | undefined>(undefined);
  const [range, setRange] = useState<OverviewRange>('7d');

  /**
   * The dashboard needs `analytics:read`, which STAFF does not hold. They still get the call
   * log and the agent's identity; the counts are not requested, so there is no 403 to show.
   */
  const canAnalyse = useCan('analytics', 'read');
  const overview = useOverviewQuery({ range }, { skip: clinicLoading || !canAnalyse });

  /**
   * Debounced, and the search goes to the SERVER.
   *
   * Filtering the page that happens to be loaded would search twenty-five calls and tell a
   * receptionist their patient never rang.
   */
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(search.trim());
      setCursors([undefined]);
    }, 300);

    return () => {
      clearTimeout(timer);
    };
  }, [search]);

  const { data, isLoading, isFetching, isError, error, refetch } = useCallsQuery(
    {
      ...(debounced === '' ? {} : { q: debounced }),
      // One day: `from` and `to` are the same date, and the API resolves them to the clinic's
      // own midnight-to-midnight rather than UTC's.
      ...(day === '' ? {} : { from: day, to: day }),
      ...(direction === '' ? {} : { direction: direction as CallView['direction'] }),
      ...(status === '' ? {} : { status: [status as CallView['status']] }),
      ...(cursors.at(-1) === undefined ? {} : { cursor: cursors.at(-1) }),
      limit: 25,
    },
    { skip: clinicLoading },
  );

  const filtered = debounced !== '' || day !== '' || direction !== '' || status !== '';

  return (
    <>
      {clinic !== undefined && (
        <AgentCard
          mapping={clinic.sarvamMapping}
          voiceAgent={clinic.voiceAgent}
          lastCallAt={canAnalyse ? (overview.data?.agent.lastCallAt ?? null) : undefined}
          timeZone={timeZone}
          range={canAnalyse ? range : undefined}
          onRangeChange={setRange}
        />
      )}

      {canAnalyse && <VoiceMetrics overview={overview.data} />}

      <div className="mb-3 flex flex-col gap-0.5">
        <h2 className="m-0 font-bold text-default text-lg">Call log</h2>
        <p className="m-0 text-muted text-xs">
          Every call the agent handled, with its transcript and recording.
        </p>
      </div>

      <Card padded={false} className="mb-4 p-4">
        <Toolbar>
          <SearchInput
            label="Search calls"
            placeholder="Search caller number"
            value={search}
            onChange={setSearch}
          />
          <DateInput
            label="Date"
            value={day}
            onChange={(value) => {
              setDay(value);
              setCursors([undefined]);
            }}
          />
          <FilterSelect
            label="Call type"
            value={direction}
            onChange={(value) => {
              setDirection(value);
              setCursors([undefined]);
            }}
            options={DIRECTION_OPTIONS}
          />
          <FilterSelect
            label="Outcome"
            value={status}
            onChange={(value) => {
              setStatus(value);
              setCursors([undefined]);
            }}
            options={STATUS_OPTIONS}
          />
          {day !== '' && (
            <Button
              kind="secondary"
              onClick={() => {
                setDay('');
                setCursors([undefined]);
              }}
            >
              Clear date
            </Button>
          )}
        </Toolbar>
      </Card>

      {(isLoading || clinicLoading) && <Spinner />}

      {isError && (
        <div className="flex flex-col items-start gap-3">
          <Alert kind="danger">
            {errorMessage(error, 'The call history could not be loaded.')}
          </Alert>
          <Button
            kind="secondary"
            onClick={() => {
              void refetch();
            }}
          >
            Try again
          </Button>
        </div>
      )}

      {data !== undefined && data.items.length === 0 && (
        /**
         * TWO DIFFERENT EMPTY STATES, because they mean different things. A clinic with no
         * calls at all is waiting for its agent to take one; a filter that matched nothing is
         * a filter to clear. Telling the first reader to "try a different search" would be
         * nonsense, and telling the second that no calls exist would be false.
         */
        <EmptyState
          title={filtered ? 'Nothing matched those filters' : 'No calls yet'}
          body={
            filtered
              ? 'No call matches what you have selected. Clearing the date or the filters will show the rest.'
              : 'Calls answered by the AI receptionist appear here, with their transcript and recording, as soon as the first one arrives.'
          }
          action={
            filtered ? (
              <Button
                kind="secondary"
                onClick={() => {
                  setSearch('');
                  setDay('');
                  setDirection('');
                  setStatus('');
                  setCursors([undefined]);
                }}
              >
                Clear the filters
              </Button>
            ) : undefined
          }
        />
      )}

      {data !== undefined && data.items.length > 0 && (
        <>
          <Table
            caption="Calls at this clinic, newest first"
            head={['Time & date', 'Caller', 'Call type', 'Outcome', 'Duration', 'Actions']}
          >
            {data.items.map((call) => {
              const at = call.startedAt ?? call.createdAt;

              return (
                <Row key={call.id}>
                  <Cell>
                    <span className="flex flex-col gap-0.5">
                      <strong className="font-semibold text-default">
                        {formatDate(at, timeZone)}
                      </strong>
                      <small className="text-muted">{formatTime(at, timeZone)}</small>
                    </span>
                  </Cell>
                  <Cell>{callerLabel(call)}</Cell>
                  <Cell>{directionLabel(call.direction)}</Cell>
                  <Cell>
                    <span className="flex flex-wrap items-center gap-2">
                      <Badge kind={statusBadge(call.status)}>{statusLabel(call.status)}</Badge>
                      <small className="text-muted">{outcomeLabel(call.outcome)}</small>
                    </span>
                  </Cell>
                  <Cell>{durationLabel(call.durationSeconds)}</Cell>
                  <Cell>
                    <button
                      type="button"
                      className="font-semibold text-accent text-xs hover:underline"
                      onClick={() => {
                        setSelected(call);
                      }}
                    >
                      Open details
                    </button>
                  </Cell>
                </Row>
              );
            })}
          </Table>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Pager
              page={cursors.length}
              hasNext={data.nextCursor !== null}
              busy={isFetching}
              onPrevious={() => {
                setCursors((previous) => previous.slice(0, -1));
              }}
              onNext={() => {
                setCursors((previous) => [...previous, data.nextCursor ?? undefined]);
              }}
            />
          </div>
        </>
      )}

      {selected !== undefined && (
        <CallDetail
          call={selected}
          timeZone={timeZone}
          onClose={() => {
            setSelected(undefined);
          }}
        />
      )}
    </>
  );
};
