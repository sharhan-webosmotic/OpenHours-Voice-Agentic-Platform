import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query';
import { ApiError } from '@clinicai/api-client';
import type {
  ClinicDetailView,
  ClinicListFilters,
  OrganisationPage,
  SavedSarvamMapping,
} from '@clinicai/api-client';
import type { CreateOrganisationInput } from '@clinicai/shared';
import type { UseFormSetError, FieldValues, Path } from 'react-hook-form';
import { clinicsApi } from '../../lib/clinicsApi';

/**
 * Server state for the clinic screens.
 *
 * All of it in TanStack Query, none of it in component state, which is the front-end rule
 * and is also what makes the detail page correct: nine sections write to one clinic, and
 * each save has to leave every other section showing what is now stored. One query key for
 * the clinic and an invalidation after every mutation gives that for free, where nine
 * pieces of local state would give nine chances to show something stale.
 */

export const clinicKeys = {
  list: (filters: ClinicListFilters) => ['clinics', 'list', filters] as const,
  detail: (id: string) => ['clinics', 'detail', id] as const,
};

export const useClinicList = (filters: ClinicListFilters) =>
  useQuery<OrganisationPage>({
    queryKey: clinicKeys.list(filters),
    queryFn: () => clinicsApi.list(filters),
  });

export const useClinic = (id: string) =>
  useQuery<ClinicDetailView>({
    queryKey: clinicKeys.detail(id),
    queryFn: () => clinicsApi.get(id),
  });

export const useCreateClinic = (): UseMutationResult<
  { readonly organisationId: string; readonly name: string },
  Error,
  CreateOrganisationInput
> => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateOrganisationInput) => clinicsApi.create(input),
    onSuccess: () => {
      // The list is now wrong in a way the user can see, so it is invalidated rather than
      // patched: a created clinic has server-assigned fields and the list is paginated.
      void queryClient.invalidateQueries({ queryKey: ['clinics', 'list'] });
    },
  });
};

/**
 * A section save: one mutation shape for all nine of them.
 *
 * Every section does the same three things, which is why they share this rather than
 * repeating it: send the section, invalidate the clinic so the readiness indicator and
 * every other section re-read, and hand the error back for the form to show.
 */
export const useSaveSection = <TInput, TResult = void>(
  organisationId: string,
  save: (id: string, input: TInput) => Promise<TResult>,
): UseMutationResult<TResult, Error, TInput> => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: TInput) => save(organisationId, input),
    onSuccess: () => {
      /**
       * The WHOLE clinic, not just this section.
       *
       * A section save changes readiness, and some of them change another section: saving
       * the profile's contact number also replaces the clinic's public line, and saving the
       * Sarvam mapping can change both numbers. Invalidating only the section that was
       * submitted would leave the page showing a readiness count that no longer matches
       * what it is displaying.
       */
      void queryClient.invalidateQueries({ queryKey: clinicKeys.detail(organisationId) });
    },
  });
};

export const useSaveSarvamMapping = (organisationId: string) => {
  const queryClient = useQueryClient();

  return useMutation<
    SavedSarvamMapping,
    Error,
    {
      readonly mapping: Parameters<typeof clinicsApi.saveSarvamMapping>[1];
      readonly regenerate: boolean;
    }
  >({
    mutationFn: ({ mapping, regenerate }) =>
      clinicsApi.saveSarvamMapping(organisationId, mapping, regenerate),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: clinicKeys.detail(organisationId) });
    },
  });
};

/**
 * Puts the server's field errors onto the form.
 *
 * The API answers a validation failure with problem+json carrying `errors[]`, each naming a
 * field as `body.city`. The `body.` prefix is stripped because the form knows its fields by
 * their own names, and anything the form does not recognise goes to the root so it is shown
 * rather than swallowed: an unmapped field error would otherwise leave the user looking at a
 * form that refused to save and said nothing.
 *
 * The client and the server validate with the same schemas, so a field error here usually
 * means a rule the form could not check, such as a name already taken.
 */
export const applyServerErrors = <TValues extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<TValues>,
): string | undefined => {
  if (!(error instanceof ApiError)) {
    return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
  }

  const fieldErrors = error.problem.errors ?? [];

  if (fieldErrors.length === 0) {
    return error.problem.detail ?? error.problem.title;
  }

  const unmapped: string[] = [];

  for (const fieldError of fieldErrors) {
    const name = fieldError.field.replace(/^body\./, '');

    if (name === '' || name === 'body') {
      unmapped.push(fieldError.message);
      continue;
    }

    setError(name as Path<TValues>, { type: 'server', message: fieldError.message });
  }

  return unmapped.length === 0 ? undefined : unmapped.join(' ');
};
