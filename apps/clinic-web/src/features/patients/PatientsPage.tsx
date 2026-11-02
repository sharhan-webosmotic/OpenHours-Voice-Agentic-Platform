import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Alert } from '../../components/ui/Alert';
import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Spinner } from '../../components/ui/Spinner';
import { Cell, Row, Table } from '../../components/ui/Table';
import { Pager, SearchInput, Toolbar } from '../../components/ui/Toolbar';
import { useCan } from '../../lib/useCan';
import { errorMessage } from '../../lib/problem';
import { formatDate } from '../../lib/clinicTime';
import { useClinicTimeZone } from '../clinic/api';
import { PatientForm } from './PatientForm';
import { usePatientsQuery } from './api';

/**
 * The patient list, built from `docs/prototype/laptop-08-patients-list.png`.
 *
 * ─── TWO DEVIATIONS FROM THE CAPTURE, BOTH RECORDED IN THE FEATURE DOC ──────────
 *
 * 1. THE CONTACT COLUMN SHOWS A PHONE NUMBER AND NO EMAIL. The prototype shows both.
 *    `patients` has no email column, and inventing one in the interface would mean either a
 *    blank line under every number or a field that silently goes nowhere. Adding the column
 *    is an additive migration awaiting sign-off.
 * 2. DATES READ `19 May 2025`, where the capture shows `2025-05-19`. The prototype is
 *    inconsistent with itself here: its calendar and overview both use the human form. The
 *    human form is also the one a receptionist reads out loud.
 *
 * ─── THE SEARCH IS THE SERVER'S ─────────────────────────────────────────────────
 *
 * Debounced and sent as `?q=`, never filtered in the browser. A clinic's patient list is
 * longer than a page, so local filtering would search only the page that happens to be
 * loaded and would quietly fail to find the patient who is on the telephone.
 */

const PAGE_SIZE = 25;

export const PatientsPage = () => {
  const timeZone = useClinicTimeZone();
  const canWrite = useCan('patients', 'write');

  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  /** Cursors already used, so "previous" can walk back. The first page has none. */
  const [cursors, setCursors] = useState<readonly (string | undefined)[]>([undefined]);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    // 300ms: below the point at which typing feels laggy, above the rate a person types.
    const timer = setTimeout(() => {
      setDebounced(search);
    }, 300);

    return () => {
      clearTimeout(timer);
    };
  }, [search]);

  useEffect(() => {
    // A new search starts a new sequence of pages: the old cursor points at a row the new
    // filter may not return at all.
    setCursors([undefined]);
  }, [debounced]);

  const cursor = cursors[cursors.length - 1];

  const { data, isLoading, isFetching, isError, error, refetch } = usePatientsQuery({
    q: debounced === '' ? undefined : debounced,
    cursor,
    limit: PAGE_SIZE,
  });

  return (
    <>
      <Card className="mb-4 p-4">
        <Toolbar
          action={
            canWrite ? (
              <Button
                onClick={() => {
                  setAdding(true);
                }}
              >
                ＋ Add Patient
              </Button>
            ) : undefined
          }
        >
          <SearchInput
            label="Search patients"
            placeholder="Search name or contact"
            value={search}
            onChange={setSearch}
          />
        </Toolbar>
      </Card>

      {isLoading && <Spinner />}

      {isError && (
        <div className="flex flex-col items-start gap-3">
          <Alert kind="danger">
            {errorMessage(error, 'The patient list could not be loaded.')}
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
        <EmptyState
          title={debounced === '' ? 'No patients yet' : 'Nothing matched that search'}
          body={
            debounced === ''
              ? 'A patient record is created here, or by the voice agent when it books a caller who has not been seen before.'
              : 'Try part of the name, or the last digits of the phone number.'
          }
          action={
            debounced === '' ? (
              canWrite ? (
                <Button
                  onClick={() => {
                    setAdding(true);
                  }}
                >
                  ＋ Add Patient
                </Button>
              ) : undefined
            ) : (
              <Button
                kind="secondary"
                onClick={() => {
                  setSearch('');
                }}
              >
                Clear the search
              </Button>
            )
          }
        />
      )}

      {data !== undefined && data.items.length > 0 && (
        <>
          <Table
            caption="Patients at this clinic"
            head={['Patient', 'Contact', 'Last appointment', 'Next appointment', 'Actions']}
          >
            {data.items.map((patient) => (
              <Row key={patient.id}>
                <Cell>
                  <span className="flex items-center gap-3">
                    <Avatar name={patient.fullName} />
                    <strong className="font-semibold text-default">
                      {/* Masked for a platform role, which is a state and not an error. */}
                      {patient.fullName ?? 'Name hidden'}
                    </strong>
                  </span>
                </Cell>
                <Cell muted={patient.phone === null}>{patient.phone ?? 'Hidden'}</Cell>
                <Cell muted={patient.lastAppointmentAt === null}>
                  {patient.lastAppointmentAt === null
                    ? '—'
                    : formatDate(patient.lastAppointmentAt, timeZone)}
                </Cell>
                <Cell muted={patient.nextAppointmentAt === null}>
                  {patient.nextAppointmentAt === null
                    ? '—'
                    : formatDate(patient.nextAppointmentAt, timeZone)}
                </Cell>
                <Cell>
                  <Link
                    to={`/patients/${patient.id}`}
                    className="font-semibold text-accent text-xs hover:underline"
                  >
                    View profile
                  </Link>
                </Cell>
              </Row>
            ))}
          </Table>

          <Pager
            page={cursors.length}
            hasNext={data.nextCursor !== null}
            busy={isFetching}
            onPrevious={() => {
              setCursors((previous) => previous.slice(0, -1));
            }}
            onNext={() => {
              setCursors((previous) =>
                data.nextCursor === null ? previous : [...previous, data.nextCursor],
              );
            }}
          />
        </>
      )}

      {adding && (
        <PatientForm
          onClose={() => {
            setAdding(false);
          }}
        />
      )}
    </>
  );
};
