import {
  DASHBOARD_PATHS,
  toQueryString,
  type AgendaQuery,
  type AgendaResult,
  type AppointmentListPage,
  type AppointmentListQuery,
  type AppointmentView,
  type AvailabilityQuery,
  type AvailabilityResult,
  type BookingResult,
} from '@clinicai/api-client';
import type {
  AppointmentStatus,
  CancelAppointmentInput,
  CreateAppointmentInput,
  RescheduleAppointmentInput,
} from '@clinicai/shared';
import { api } from '../../lib/api';

/**
 * Appointment endpoints, injected into the one RTK Query service (D-015).
 *
 * ─── WHY EVERY WRITE INVALIDATES AVAILABILITY ───────────────────────────────────
 *
 * Booking, rescheduling, cancelling and confirming all change which slots are free, and the
 * booking form is usually still open when one of them lands. Without the invalidation the
 * user would be offered the slot they just took. Cancelling matters just as much in the
 * other direction: the freed slot has to come back.
 *
 * `Agenda` is its own tag rather than part of `Appointment`, because the agenda is a
 * different shape of the same data: counts per status over a range. A list refetch does not
 * update a count, and a month view that disagrees with the list under it is worse than one
 * that is briefly empty.
 */

export const appointmentsApi = api.injectEndpoints({
  endpoints: (build) => ({
    appointments: build.query<AppointmentListPage, AppointmentListQuery>({
      query: (filters) => ({ path: `${DASHBOARD_PATHS.appointments}${toQueryString(filters)}` }),
      providesTags: (result) => [
        { type: 'Appointment' as const, id: 'LIST' },
        ...(result?.items ?? []).map((item) => ({ type: 'Appointment' as const, id: item.id })),
      ],
    }),

    appointment: build.query<AppointmentView, string>({
      query: (appointmentId) => ({ path: DASHBOARD_PATHS.appointment(appointmentId) }),
      providesTags: (_result, _error, appointmentId) => [
        { type: 'Appointment' as const, id: appointmentId },
      ],
    }),

    agenda: build.query<AgendaResult, AgendaQuery>({
      query: (filters) => ({ path: `${DASHBOARD_PATHS.agenda}${toQueryString(filters)}` }),
      providesTags: [{ type: 'Agenda' as const, id: 'RANGE' }],
    }),

    availability: build.query<AvailabilityResult, AvailabilityQuery>({
      query: (filters) => ({ path: `${DASHBOARD_PATHS.availability}${toQueryString(filters)}` }),
      providesTags: [{ type: 'Availability' as const, id: 'DAY' }],
      /**
       * Five seconds, not the service's thirty.
       *
       * A slot list is the most perishable thing the API returns: the voice agent books into
       * the same calendar while somebody is choosing from it. Thirty seconds of cache here
       * means being offered a time that was taken half a minute ago, and the booking is then
       * refused by the exclusion constraint with a message the user cannot act on.
       */
      keepUnusedDataFor: 5,
    }),

    book: build.mutation<
      BookingResult,
      { readonly input: CreateAppointmentInput; readonly idempotencyKey: string }
    >({
      query: ({ input, idempotencyKey }) => ({
        path: DASHBOARD_PATHS.appointments,
        method: 'POST',
        body: input,
        headers: { 'Idempotency-Key': idempotencyKey },
      }),
      invalidatesTags: [
        { type: 'Appointment', id: 'LIST' },
        { type: 'Agenda', id: 'RANGE' },
        { type: 'Availability', id: 'DAY' },
        // The patient's profile shows their appointment history.
        { type: 'Patient', id: 'LIST' },
      ],
    }),

    reschedule: build.mutation<
      BookingResult,
      { readonly appointmentId: string; readonly input: RescheduleAppointmentInput }
    >({
      query: ({ appointmentId, input }) => ({
        path: DASHBOARD_PATHS.reschedule(appointmentId),
        method: 'POST',
        body: input,
      }),
      invalidatesTags: (_result, _error, { appointmentId }) => [
        { type: 'Appointment', id: appointmentId },
        { type: 'Appointment', id: 'LIST' },
        { type: 'Agenda', id: 'RANGE' },
        { type: 'Availability', id: 'DAY' },
        { type: 'Patient', id: 'LIST' },
      ],
    }),

    cancel: build.mutation<
      void,
      { readonly appointmentId: string; readonly input: CancelAppointmentInput }
    >({
      query: ({ appointmentId, input }) => ({
        path: DASHBOARD_PATHS.cancel(appointmentId),
        method: 'POST',
        body: input,
      }),
      invalidatesTags: (_result, _error, { appointmentId }) => [
        { type: 'Appointment', id: appointmentId },
        { type: 'Appointment', id: 'LIST' },
        { type: 'Agenda', id: 'RANGE' },
        // The slot is free again, which the booking form must see.
        { type: 'Availability', id: 'DAY' },
        { type: 'Patient', id: 'LIST' },
      ],
    }),

    changeStatus: build.mutation<
      void,
      { readonly appointmentId: string; readonly status: AppointmentStatus }
    >({
      query: ({ appointmentId, status }) => ({
        path: DASHBOARD_PATHS.status(appointmentId),
        method: 'POST',
        body: { status },
      }),
      invalidatesTags: (_result, _error, { appointmentId }) => [
        { type: 'Appointment', id: appointmentId },
        { type: 'Appointment', id: 'LIST' },
        { type: 'Agenda', id: 'RANGE' },
        /**
         * A status change can free a slot (to CANCELLED or NO_SHOW) or keep it held
         * (to CONFIRMED), and the caller does not know which until the server answers. The
         * cheap, always-correct answer is to invalidate either way.
         */
        { type: 'Availability', id: 'DAY' },
      ],
    }),
  }),
});

export const {
  useAppointmentsQuery,
  useAppointmentQuery,
  useAgendaQuery,
  useAvailabilityQuery,
  useBookMutation,
  useRescheduleMutation,
  useCancelMutation,
  useChangeStatusMutation,
} = appointmentsApi;
