import { Link, useParams } from 'react-router';
import type { ReadinessSection } from '@clinicai/shared';
import { PageHeading } from '../../app/AppShell';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { Badge } from '../../components/ui/Table';
import { useCan } from '../../lib/useCan';
import { ReadinessPanel } from './ReadinessPanel';
import { toProblemDetails, useClinic } from './useClinics';
import { AgentProfileSection } from './sections/AgentProfileSection';
import { BookingPolicySection } from './sections/BookingPolicySection';
import { DoctorsSection } from './sections/DoctorsSection';
import { FaqsSection } from './sections/FaqsSection';
import { HoursSection } from './sections/HoursSection';
import { IdentitySection } from './sections/IdentitySection';
import { ProfileSection } from './sections/ProfileSection';
import { SarvamMappingSection } from './sections/SarvamMappingSection';
import { ServicesSection } from './sections/ServicesSection';
import { TelephonySection } from './sections/TelephonySection';

/**
 * One clinic, every configuration section, and what is still missing before go-live.
 *
 * ONE PAGE RATHER THAN A WIZARD, because configuration arrives over several conversations
 * and in no fixed order: the address comes off a letterhead, the booking policy from the
 * practice manager, the Sarvam ids from whoever did the setup. A wizard would impose an
 * order on work that does not have one, and would be abandoned part way through with nothing
 * saved.
 *
 * EACH SECTION SAVES ON ITS OWN. Nine small writes rather than one large one, so a clinic
 * can be configured in nine sittings, and so a failure in one section cannot discard the
 * other eight.
 *
 * WRITE PERMISSION IS ASKED PER SECTION, because the matrix genuinely differs: an
 * INTERNAL_ADMIN may change a clinic's settings and its Sarvam mapping but not its services
 * or doctors. `useCan` is cosmetic, as its own comment insists: the API enforces the same
 * matrix in its service layer, and a section rendered read-only by mistake would still be
 * refused on the server.
 */

/** How many outstanding requirements belong to one section. */
const countMissing = (
  missing: readonly { readonly section: ReadinessSection }[],
  section: ReadinessSection,
): number => missing.filter((requirement) => requirement.section === section).length;

export const ClinicDetailPage = () => {
  const { clinicId } = useParams<{ clinicId: string }>();
  const { data: clinic, isPending, isError, error, refetch } = useClinic(clinicId ?? '');

  const canWriteClinic = useCan('organisations', 'write');
  const canWriteSettings = useCan('clinic_settings', 'write');
  const canWritePeople = useCan('doctors_services_hours', 'write');
  const canWriteMapping = useCan('phone_voice_mapping', 'write');

  if (isPending) {
    return <Spinner />;
  }

  if (isError) {
    /**
     * A 404 is the ordinary answer for an id that does not exist AND for a clinic this
     * principal cannot reach, which is root CLAUDE.md rule 7: a 403 would confirm the
     * clinic exists. So the message says "not found" without speculating about why.
     */
    const problem = toProblemDetails(error);
    const notFound = problem?.status === 404;

    return (
      <div className="flex flex-col items-start gap-3">
        <Alert kind="danger">
          {notFound
            ? 'That clinic was not found.'
            : (problem?.detail ?? problem?.title ?? 'The clinic could not be loaded.')}
        </Alert>
        <div className="flex items-center gap-3">
          {!notFound && (
            <Button
              kind="secondary"
              onClick={() => {
                void refetch();
              }}
            >
              Try again
            </Button>
          )}
          <Link to="/clinics" className="text-xs text-muted hover:underline">
            Back to the clinic list
          </Link>
        </div>
      </div>
    );
  }

  /**
   * The compiler cannot see that a settled, un-errored query has data, so this says it.
   *
   * It is not dead code in the way the two guards above are not dead code: RTK Query's
   * result is `data | undefined` in every state, including the moment between a cache entry
   * being invalidated and its refetch resolving. A spinner is the honest thing to show then,
   * and it is the same spinner as the first load.
   */
  if (clinic === undefined) {
    return <Spinner />;
  }

  const { missing } = clinic.readiness;

  return (
    <>
      <div className="mb-2">
        <Link to="/clinics" className="text-xs text-muted hover:underline">
          Clinics
        </Link>
      </div>

      <div className="mb-5 flex items-start justify-between gap-4">
        <PageHeading
          title={clinic.organisation.name}
          description={`${clinic.organisation.timezone} · ${clinic.organisation.clinicPhone ?? 'no phone number recorded'}`}
        />
        <Badge
          kind={
            clinic.organisation.status === 'ACTIVE'
              ? 'success'
              : clinic.organisation.status === 'SUSPENDED'
                ? 'warning'
                : 'danger'
          }
        >
          {clinic.organisation.status.toLowerCase()}
        </Badge>
      </div>

      <div className="flex flex-col gap-5">
        <ReadinessPanel readiness={clinic.readiness} />

        <IdentitySection
          clinic={clinic}
          canWrite={canWriteClinic}
          missingCount={countMissing(missing, 'identity')}
        />
        <ProfileSection
          clinic={clinic}
          canWrite={canWriteSettings}
          missingCount={countMissing(missing, 'profile')}
        />
        <HoursSection
          clinic={clinic}
          canWrite={canWriteSettings}
          missingCount={countMissing(missing, 'hours')}
        />
        <ServicesSection
          clinic={clinic}
          canWrite={canWritePeople}
          missingCount={countMissing(missing, 'services')}
        />
        <DoctorsSection
          clinic={clinic}
          canWrite={canWritePeople}
          missingCount={countMissing(missing, 'doctors')}
        />
        <BookingPolicySection
          clinic={clinic}
          canWrite={canWriteSettings}
          missingCount={countMissing(missing, 'bookingPolicy')}
        />
        <AgentProfileSection
          clinic={clinic}
          canWrite={canWriteSettings}
          missingCount={countMissing(missing, 'agentProfile')}
        />
        <FaqsSection
          clinic={clinic}
          canWrite={canWriteSettings}
          // Frequently asked answers are not a go-live requirement, so this section never
          // shows a gap count. A clinic with none has an agent that offers to check.
          missingCount={0}
        />
        <TelephonySection
          clinic={clinic}
          canWrite={canWriteSettings}
          missingCount={countMissing(missing, 'telephony')}
        />
        <SarvamMappingSection
          clinic={clinic}
          canWrite={canWriteMapping}
          missingCount={countMissing(missing, 'sarvamMapping')}
        />
      </div>
    </>
  );
};
