import {
  DASHBOARD_PATHS,
  toQueryString,
  type PatientDetail,
  type PatientListPage,
  type PatientListQuery,
} from '@clinicai/api-client';
import type { PatientInput, UpdatePatientInput } from '@clinicai/shared';
import { api } from '../../lib/api';

/**
 * Patient endpoints, injected into the one RTK Query service (D-015).
 *
 * ─── WHAT THE TAGS ARE DOING ────────────────────────────────────────────────────
 *
 * A list provides a tag per row AND a `LIST` tag. The per-row tags let an edit invalidate
 * exactly the row that changed; the `LIST` tag is what a create invalidates, because a new
 * patient has server-assigned fields and belongs at a position the client cannot work out.
 *
 * A create also invalidates `Appointment`'s list, which is less obvious and is the bug it
 * prevents: the booking form reads patients, and a patient created from inside it has to
 * appear in the picker that is still open.
 */

export const patientsApi = api.injectEndpoints({
  endpoints: (build) => ({
    patients: build.query<PatientListPage, PatientListQuery>({
      query: (filters) => ({ path: `${DASHBOARD_PATHS.patients}${toQueryString(filters)}` }),
      providesTags: (result) => [
        { type: 'Patient' as const, id: 'LIST' },
        ...(result?.items ?? []).map((item) => ({ type: 'Patient' as const, id: item.id })),
      ],
    }),

    patient: build.query<PatientDetail, string>({
      query: (patientId) => ({ path: DASHBOARD_PATHS.patient(patientId) }),
      providesTags: (_result, _error, patientId) => [{ type: 'Patient' as const, id: patientId }],
    }),

    createPatient: build.mutation<{ readonly patientId: string }, PatientInput>({
      query: (body) => ({ path: DASHBOARD_PATHS.patients, method: 'POST', body }),
      invalidatesTags: [
        { type: 'Patient', id: 'LIST' },
        // The booking form's patient picker is a patient list too.
        { type: 'Appointment', id: 'LIST' },
      ],
    }),

    updatePatient: build.mutation<
      void,
      { readonly patientId: string; readonly changes: UpdatePatientInput }
    >({
      query: ({ patientId, changes }) => ({
        path: DASHBOARD_PATHS.patient(patientId),
        method: 'PATCH',
        body: changes,
      }),
      invalidatesTags: (_result, _error, { patientId }) => [
        { type: 'Patient', id: patientId },
        { type: 'Patient', id: 'LIST' },
        /**
         * An appointment row shows the patient's name, so renaming a patient makes every
         * appointment list on screen wrong until it refetches.
         */
        { type: 'Appointment', id: 'LIST' },
      ],
    }),
  }),
});

export const {
  usePatientsQuery,
  usePatientQuery,
  useCreatePatientMutation,
  useUpdatePatientMutation,
} = patientsApi;
