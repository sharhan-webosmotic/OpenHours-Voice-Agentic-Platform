import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import type { OrganisationStatus } from '@clinicai/shared';
import { PageHeading } from '../../app/AppShell';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { Field } from '../../components/ui/Field';
import { Spinner } from '../../components/ui/Spinner';
import { Badge, Cell, Row, Table } from '../../components/ui/Table';
import { useCan } from '../../lib/useCan';
import { useClinicList } from './useClinics';

/**
 * Every clinic on the platform, with search and cursor pagination.
 *
 * FOUR STATES, as the house rule requires: loading, empty, error with a retry, and data.
 * The empty state distinguishes "no clinics yet" from "nothing matched your search",
 * because they need different next actions and a single "No results" tells a new user the
 * product is broken.
 *
 * THE CURSOR IS HELD AS A STACK, not as a page number. The API pages by cursor, which gives
 * "next" cheaply and nothing else, so previous is implemented by remembering the cursors
 * already visited. The alternative, an offset, re-reads rows and can repeat or skip one when
 * a clinic is created mid-browse.
 */

const STATUS_BADGES: Record<OrganisationStatus, 'success' | 'warning' | 'danger'> = {
  ACTIVE: 'success',
  SUSPENDED: 'warning',
  DEACTIVATED: 'danger',
};

const PAGE_SIZE = 25;

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });

export const ClinicsListPage = () => {
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  /** Cursors already used, so "previous" can walk back. The first page has no cursor. */
  const [cursors, setCursors] = useState<readonly (string | undefined)[]>([undefined]);

  const canCreate = useCan('organisations', 'write');
  const cursor = cursors[cursors.length - 1];

  /**
   * Debounced, because the search hits the database on every keystroke otherwise and the
   * query is an ILIKE across two tables. 300ms is below the threshold at which typing feels
   * laggy and above the rate at which a person produces characters.
   */
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(search);
    }, 300);

    return () => {
      clearTimeout(timer);
    };
  }, [search]);

  // A new search starts a new sequence of pages: keeping the old cursor would ask for the
  // page after a row that the new filter may not even return.
  useEffect(() => {
    setCursors([undefined]);
  }, [debounced]);

  const { data, isPending, isError, error, refetch, isFetching } = useClinicList({
    q: debounced === '' ? undefined : debounced,
    cursor,
    limit: PAGE_SIZE,
  });

  return (
    <>
      <PageHeading
        title="Clinics"
        description="Every clinic on the platform, and how far each one is from going live."
      />

      <div className="mb-4 flex items-end justify-between gap-4">
        <div className="w-full max-w-sm">
          <Field
            label="Search"
            type="search"
            placeholder="Clinic name or phone number"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
            }}
          />
        </div>

        {/*
          Hidden when the role may not create, which is cosmetic only: the API refuses an
          INTERNAL_ADMIN this action because the matrix gives that role read on
          `organisations`, and typing the path reaches a form whose submit is refused.
        */}
        {canCreate && (
          <Link to="/clinics/new">
            <Button>Add clinic</Button>
          </Link>
        )}
      </div>

      {isPending && <Spinner />}

      {isError && (
        <div className="flex flex-col items-start gap-3">
          <Alert kind="danger">
            {error instanceof Error ? error.message : 'The clinic list could not be loaded.'}
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
          title={debounced === '' ? 'No clinics yet' : 'Nothing matched that search'}
          body={
            debounced === ''
              ? 'A clinic is created here by hand, then configured section by section before its voice agent goes live.'
              : 'Try part of the clinic name, or the phone number without the country code.'
          }
          action={
            debounced === '' ? (
              canCreate ? (
                <Link to="/clinics/new">
                  <Button>Add the first clinic</Button>
                </Link>
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
            caption="Clinics on the platform, newest first"
            head={['Clinic', 'Status', 'Phone', 'Created']}
          >
            {data.items.map((clinic) => (
              <Row key={clinic.id}>
                <Cell>
                  <Link to={`/clinics/${clinic.id}`} className="font-semibold hover:underline">
                    {clinic.name}
                  </Link>
                </Cell>
                <Cell>
                  <Badge kind={STATUS_BADGES[clinic.status]}>{clinic.status.toLowerCase()}</Badge>
                </Cell>
                {/* A clinic with no number recorded says so, rather than showing a gap. */}
                <Cell muted={clinic.clinicPhone === null}>
                  {clinic.clinicPhone ?? 'Not recorded'}
                </Cell>
                <Cell muted>{formatDate(clinic.createdAt)}</Cell>
              </Row>
            ))}
          </Table>

          <div className="mt-4 flex items-center gap-3">
            <Button
              kind="secondary"
              disabled={cursors.length === 1 || isFetching}
              onClick={() => {
                setCursors((previous) => previous.slice(0, -1));
              }}
            >
              Previous
            </Button>
            <Button
              kind="secondary"
              disabled={data.nextCursor === null || isFetching}
              onClick={() => {
                setCursors((previous) =>
                  data.nextCursor === null ? previous : [...previous, data.nextCursor],
                );
              }}
            >
              Next
            </Button>
            <span className="text-xs text-muted">
              Page {cursors.length}
              {isFetching && ', loading'}
            </span>
          </div>
        </>
      )}
    </>
  );
};
