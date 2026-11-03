import type { ClinicDetailView } from '@clinicai/api-client';
import type {
  AgentProfileInput,
  BookingPolicyInput,
  ClinicHoursInput,
  ClinicProfileInput,
  DoctorInput,
  ServiceInput,
} from '@clinicai/shared';
import { api } from '../../lib/api';
import { useAuth } from '../../app/AuthProvider';

/**
 * The clinic's own configuration, which four screens read and three of them write.
 *
 * ONE QUERY FOR THE WHOLE CLINIC, not one per section, because the API returns it that way
 * and because the sections are read together: Settings shows all of them, Services and
 * Doctors are two views onto the same document, and every screen needs the time zone out of
 * it to render a date at all. One cache entry also means a section save invalidates
 * everything that depends on it, which is what stops the readiness count disagreeing with
 * the section beside it.
 *
 * THE ORGANISATION ID COMES FROM THE SESSION, never from a route parameter. The dashboard is
 * single-tenant by construction: a clinic user has exactly one organisation, it is on the
 * verified token, and a screen that took it from the URL would be a screen that could be
 * pointed at another clinic. The API would refuse that with a 404, and the point is not to
 * ask.
 */

/**
 * Every write is a SECTION REPLACEMENT with `PUT`, not a patch.
 *
 * That is the API's shape and the reason is worth repeating here, because it decides how the
 * forms work: a partial update would make "field absent" and "field cleared" the same
 * request, and clearing a clinic's greeting is something somebody will legitimately want to
 * do. So each form holds every field of its section and sends all of them.
 *
 * Each one invalidates the whole clinic rather than its own section, because sections affect
 * each other: saving the profile's contact number also replaces the clinic's public line, and
 * every section save changes the readiness count shown beside it.
 */
const clinicEndpoints = api.injectEndpoints({
  endpoints: (build) => ({
    clinic: build.query<ClinicDetailView, string>({
      query: (organisationId) => ({ path: `/api/v1/organisations/${organisationId}` }),
      providesTags: (_result, _error, organisationId) => [
        { type: 'Clinic' as const, id: organisationId },
      ],
    }),

    updateProfile: build.mutation<
      void,
      { readonly organisationId: string; readonly input: ClinicProfileInput }
    >({
      query: ({ organisationId, input }) => ({
        path: `/api/v1/organisations/${organisationId}/profile`,
        method: 'PUT',
        body: input,
      }),
      invalidatesTags: (_r, _e, { organisationId }) => [{ type: 'Clinic', id: organisationId }],
    }),

    replaceHours: build.mutation<
      void,
      { readonly organisationId: string; readonly input: ClinicHoursInput }
    >({
      query: ({ organisationId, input }) => ({
        path: `/api/v1/organisations/${organisationId}/hours`,
        method: 'PUT',
        body: input,
      }),
      /**
       * Opening hours decide which slots exist, so availability has to be re-read as well.
       * A booking form left open across an hours change would otherwise still be offering
       * times the clinic has just closed.
       */
      invalidatesTags: (_r, _e, { organisationId }) => [
        { type: 'Clinic', id: organisationId },
        { type: 'Availability', id: 'DAY' },
      ],
    }),

    updateBookingPolicy: build.mutation<
      void,
      { readonly organisationId: string; readonly input: BookingPolicyInput }
    >({
      query: ({ organisationId, input }) => ({
        path: `/api/v1/organisations/${organisationId}/booking-policy`,
        method: 'PUT',
        body: input,
      }),
      // The policy is the grid, the notice and the buffer: every slot on every day changes.
      invalidatesTags: (_r, _e, { organisationId }) => [
        { type: 'Clinic', id: organisationId },
        { type: 'Availability', id: 'DAY' },
      ],
    }),

    updateAgentProfile: build.mutation<
      void,
      { readonly organisationId: string; readonly input: AgentProfileInput }
    >({
      query: ({ organisationId, input }) => ({
        path: `/api/v1/organisations/${organisationId}/agent-profile`,
        method: 'PUT',
        body: input,
      }),
      invalidatesTags: (_r, _e, { organisationId }) => [{ type: 'Clinic', id: organisationId }],
    }),

    createService: build.mutation<
      { readonly serviceId: string },
      { readonly organisationId: string; readonly input: ServiceInput }
    >({
      query: ({ organisationId, input }) => ({
        path: `/api/v1/organisations/${organisationId}/services`,
        method: 'POST',
        body: input,
      }),
      invalidatesTags: (_r, _e, { organisationId }) => [
        { type: 'Clinic', id: organisationId },
        { type: 'Availability', id: 'DAY' },
      ],
    }),

    updateService: build.mutation<
      void,
      {
        readonly organisationId: string;
        readonly serviceId: string;
        readonly input: Partial<ServiceInput>;
      }
    >({
      query: ({ organisationId, serviceId, input }) => ({
        path: `/api/v1/organisations/${organisationId}/services/${serviceId}`,
        method: 'PATCH',
        body: input,
      }),
      invalidatesTags: (_r, _e, { organisationId }) => [
        { type: 'Clinic', id: organisationId },
        // A duration change moves every slot of every day this service is bookable on.
        { type: 'Availability', id: 'DAY' },
      ],
    }),

    createDoctor: build.mutation<
      { readonly doctorId: string },
      { readonly organisationId: string; readonly input: DoctorInput }
    >({
      query: ({ organisationId, input }) => ({
        path: `/api/v1/organisations/${organisationId}/doctors`,
        method: 'POST',
        body: input,
      }),
      invalidatesTags: (_r, _e, { organisationId }) => [{ type: 'Clinic', id: organisationId }],
    }),

    updateDoctor: build.mutation<
      void,
      {
        readonly organisationId: string;
        readonly doctorId: string;
        readonly input: Partial<DoctorInput>;
      }
    >({
      query: ({ organisationId, doctorId, input }) => ({
        path: `/api/v1/organisations/${organisationId}/doctors/${doctorId}`,
        method: 'PATCH',
        body: input,
      }),
      invalidatesTags: (_r, _e, { organisationId }) => [
        { type: 'Clinic', id: organisationId },
        // A doctor's buffer is part of the slot arithmetic.
        { type: 'Availability', id: 'DAY' },
      ],
    }),

    /** One doctor's working week, all seven weekdays. */
    doctorHours: build.query<
      { readonly days: ClinicHoursInput['days'] },
      { readonly organisationId: string; readonly doctorId: string }
    >({
      query: ({ organisationId, doctorId }) => ({
        path: `/api/v1/organisations/${organisationId}/doctors/${doctorId}/hours`,
      }),
      providesTags: (_r, _e, { doctorId }) => [{ type: 'DoctorHours', id: doctorId }],
    }),

    replaceDoctorHours: build.mutation<
      void,
      {
        readonly organisationId: string;
        readonly doctorId: string;
        readonly input: ClinicHoursInput;
      }
    >({
      query: ({ organisationId, doctorId, input }) => ({
        path: `/api/v1/organisations/${organisationId}/doctors/${doctorId}/hours`,
        method: 'PUT',
        body: input,
      }),
      // A doctor's hours decide which of their slots exist, as the clinic's do.
      invalidatesTags: (_r, _e, { doctorId }) => [
        { type: 'DoctorHours', id: doctorId },
        { type: 'Availability', id: 'DAY' },
      ],
    }),
  }),
});

export const {
  useDoctorHoursQuery,
  useReplaceDoctorHoursMutation,
  useUpdateProfileMutation,
  useReplaceHoursMutation,
  useUpdateBookingPolicyMutation,
  useUpdateAgentProfileMutation,
  useCreateServiceMutation,
  useUpdateServiceMutation,
  useCreateDoctorMutation,
  useUpdateDoctorMutation,
} = clinicEndpoints;

/**
 * The signed-in user's clinic.
 *
 * `skip` while there is no session: the hook is called from screens that render inside the
 * authenticated shell, so the id is normally there, and asking the API about `undefined`
 * would be a guaranteed 404 and a misleading error on screen during the first paint.
 */
export const useClinic = () => {
  const { user } = useAuth();
  const organisationId = user?.organisationId ?? undefined;

  const query = clinicEndpoints.useClinicQuery(organisationId ?? '', {
    skip: organisationId === undefined,
  });

  /**
   * `isLoading` HERE MEANS "A CLINIC IS COMING AND IS NOT HERE YET", WHICH IS WIDER THAN
   * RTK QUERY'S OWN FLAG AND NARROWER THAN "THERE IS NO CLINIC".
   *
   * RTK Query reports `isLoading: false` while a query is skipped, and this one is skipped
   * until the session boot has produced an organisation id. Every screen reads this flag to
   * decide between a spinner and the clinic, so the narrow meaning made them paint once with
   * the UTC fallback and then throw that render away when the query finally started. On the
   * Overview that was not a flicker: the month calendar mounted, fired its own queries and
   * was unmounted a tick later, which a test caught by finding the grid and then finding it
   * detached from the document.
   *
   * The two reasons for being uninitialised are NOT the same thing, and conflating them hangs
   * a screen for ever:
   *   - no user yet, so the boot has not run: a clinic is coming, so this is loading
   *   - a user whose `organisationId` is null, which is every platform role: there is no
   *     clinic to fetch, so this is settled, and the screen renders with the UTC fallback
   */
  const clinicIsComing = user === undefined || user.organisationId !== null;

  return {
    ...query,
    isLoading: query.isLoading || (query.isUninitialized && clinicIsComing),
  };
};

/**
 * The clinic's time zone, with a safe fallback while the query is in flight.
 *
 * UTC AS THE FALLBACK, AND IT IS VISIBLE WHEN IT HAPPENS. A wrong zone shifts every time on
 * the screen silently, so the fallback is the one zone nobody's clinic is actually in: a
 * reader who sees 03:30 where they expected 09:00 knows something is loading, where a
 * fallback of `Asia/Kolkata` would look correct for the pilot and be wrong for everyone
 * after it. Screens that show times render a skeleton while the clinic query is loading, so
 * this is a belt rather than the trousers.
 */
export const useClinicTimeZone = (): string => useClinic().data?.organisation.timezone ?? 'UTC';
