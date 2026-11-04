import { useCallback, useState } from 'react';
import { ApiError, type ProblemDetails } from '@clinicai/api-client';
import type {
  ClinicDetailView,
  ClinicListFilters,
  OrganisationPage,
  SarvamSecretRegeneration,
  SavedSarvamMapping,
} from '@clinicai/api-client';
import type { CreateOrganisationInput } from '@clinicai/shared';
import type { UseFormSetError, FieldValues, Path } from 'react-hook-form';
import { useAppDispatch } from '../../app/hooks';
import { api } from '../../lib/api';
import { clinicsApi } from '../../lib/clinicsApi';

/**
 * Server state for the clinic screens, in RTK Query (D-015).
 *
 * All of it in the cache, none of it in component state, which is the front-end rule and is
 * also what makes the detail page correct: nine sections write to one clinic, and each save
 * has to leave every other section showing what is now stored. One cache entry for the
 * clinic and an invalidation after every mutation gives that for free, where nine pieces of
 * local state would give nine chances to show something stale.
 *
 * WHY THE READS ARE ENDPOINTS AND THE WRITES ARE NOT. The two reads are cached, shared
 * between screens and invalidated by everything, so they are exactly what RTK Query is for.
 * The fifteen writes are already fifteen separately typed calls on the hand-written client,
 * and folding them into endpoints means either fifteen near-identical endpoint definitions
 * or one endpoint whose argument carries a section discriminant and an `unknown` payload,
 * which trades the type safety the sections currently have for conformity. They stay as
 * direct calls that invalidate through `api.util.invalidateTags`, so the cache contract is
 * identical and nothing reads around the cache.
 *
 * All of this is replaced by generated hooks when M1-03 lands, which `docs/BACKLOG.md` now
 * schedules for the slot after the pilot call.
 */

const clinicsEndpoints = api.injectEndpoints({
  endpoints: (build) => ({
    clinicList: build.query<OrganisationPage, ClinicListFilters>({
      /**
       * `queryFn` over the typed client rather than a `query` descriptor.
       *
       * The client owns the path, the query-string building and the response type, and it is
       * the thing M1-03 regenerates. A descriptor here would be a second copy of the path,
       * which is the drift this repository already has too much of.
       */
      queryFn: async (filters) => toQueryResult(() => clinicsApi.list(filters)),
      providesTags: (result) => [
        { type: 'Clinic' as const, id: 'LIST' },
        ...(result?.items ?? []).map((item) => ({ type: 'Clinic' as const, id: item.id })),
      ],
    }),

    clinic: build.query<ClinicDetailView, string>({
      queryFn: async (organisationId) => toQueryResult(() => clinicsApi.get(organisationId)),
      providesTags: (_result, _error, organisationId) => [
        { type: 'Clinic' as const, id: organisationId },
      ],
    }),

    createClinic: build.mutation<
      { readonly organisationId: string; readonly name: string },
      CreateOrganisationInput
    >({
      queryFn: async (input) => toQueryResult(() => clinicsApi.create(input)),
      // The list is now wrong in a way the user can see, so it is invalidated rather than
      // patched: a created clinic has server-assigned fields and the list is paginated.
      invalidatesTags: [{ type: 'Clinic', id: 'LIST' }],
    }),
  }),
});

/**
 * Runs a client call and returns RTK Query's result shape.
 *
 * The client throws `ApiError`; the store must hold something serializable, so the problem
 * document inside it is what travels. Nothing is lost, because `ApiError` carries only that
 * document. A thrown anything-else becomes a problem-shaped object with `status: 0`, which
 * is the agreed signal for "no server answered" (see `lib/baseQuery.ts`).
 */
const toQueryResult = async <T>(
  call: () => Promise<T>,
): Promise<{ data: T } | { error: ProblemDetails }> => {
  try {
    return { data: await call() };
  } catch (caught) {
    if (caught instanceof ApiError) {
      return { error: caught.problem };
    }
    return {
      error: {
        type: 'about:blank',
        title: 'Network error',
        status: 0,
        detail:
          caught instanceof Error
            ? caught.message
            : 'The request could not be sent. Check the connection and try again.',
      },
    };
  }
};

/**
 * The query hooks, with `isPending` kept as a name.
 *
 * RTK Query calls the first-load state `isLoading`. The alias exists so that removing
 * TanStack Query stayed a change to this file rather than a rename spread across every
 * screen in the console: the console is not what this feature is about, and a wide diff
 * through screens nobody touched is a wide diff a reviewer has to read.
 */
export const useClinicList = (filters: ClinicListFilters) => {
  const result = clinicsEndpoints.useClinicListQuery(filters);
  return { ...result, isPending: result.isLoading };
};

export const useClinic = (organisationId: string) => {
  const result = clinicsEndpoints.useClinicQuery(organisationId, {
    // An empty id means the route parameter was missing. Asking the API about it would be a
    // guaranteed 404 and a misleading error on screen.
    skip: organisationId === '',
  });
  return { ...result, isPending: result.isLoading };
};

export const useCreateClinic = () => {
  const [trigger, state] = clinicsEndpoints.useCreateClinicMutation();

  return {
    isPending: state.isLoading,
    // `unwrap` so the caller's `try`/`catch` and `applyServerErrors` keep working unchanged.
    mutateAsync: (input: CreateOrganisationInput) => trigger(input).unwrap(),
  };
};

/**
 * A section save: one shape for all fifteen of them.
 *
 * Every one does the same three things, which is why they share this rather than repeating
 * it: send the section, invalidate the clinic so the readiness indicator and every other
 * section re-read, and hand the error back for the form to show.
 */
export const useSaveSection = <TInput, TResult = void>(
  organisationId: string,
  save: (id: string, input: TInput) => Promise<TResult>,
): { readonly isPending: boolean; readonly mutateAsync: (input: TInput) => Promise<TResult> } => {
  const dispatch = useAppDispatch();
  const [isPending, setIsPending] = useState(false);

  const mutateAsync = useCallback(
    async (input: TInput): Promise<TResult> => {
      setIsPending(true);
      try {
        const result = await save(organisationId, input);
        /**
         * The WHOLE clinic, not just this section.
         *
         * A section save changes readiness, and some of them change another section: saving
         * the profile's contact number also replaces the clinic's public line, and saving
         * the Sarvam mapping can change both numbers. Invalidating only the section that was
         * submitted would leave the page showing a readiness count that no longer matches
         * what it is displaying.
         */
        dispatch(api.util.invalidateTags([{ type: 'Clinic', id: organisationId }]));
        return result;
      } finally {
        // Reset in `finally`, so a failed save leaves a pressable button rather than a
        // spinner that never stops.
        setIsPending(false);
      }
    },
    [dispatch, organisationId, save],
  );

  return { isPending, mutateAsync };
};

export const useSaveSarvamMapping = (organisationId: string) => {
  const inner = useSaveSection<
    {
      readonly mapping: Parameters<typeof clinicsApi.saveSarvamMapping>[1];
      readonly regenerate: SarvamSecretRegeneration;
    },
    SavedSarvamMapping
  >(organisationId, (id, { mapping, regenerate }) =>
    clinicsApi.saveSarvamMapping(id, mapping, regenerate),
  );

  return inner;
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
 *
 * IT ACCEPTS BOTH AN `ApiError` AND A BARE PROBLEM DOCUMENT, because the two now both reach
 * it: a direct client call rejects with the error class, while anything that went through
 * the cache rejects with the serializable document the store is allowed to hold.
 */
export const applyServerErrors = <TValues extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<TValues>,
): string | undefined => {
  const problem = toProblemDetails(error);

  if (problem === undefined) {
    return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
  }

  const fieldErrors = problem.errors ?? [];

  if (fieldErrors.length === 0) {
    return problem.detail ?? problem.title;
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

/**
 * Narrows the two error shapes to one, without casting anything unchecked.
 *
 * Exported because screens need it too: an RTK Query error arrives as the serializable
 * problem document rather than as `ApiError`, so `error instanceof ApiError` is no longer
 * the way to ask whether the server said 404.
 */
export const toProblemDetails = (error: unknown): ProblemDetails | undefined => {
  if (error instanceof ApiError) {
    return error.problem;
  }

  if (typeof error === 'object' && error !== null && 'status' in error && 'title' in error) {
    const candidate = error as { readonly status: unknown; readonly title: unknown };
    if (typeof candidate.status === 'number' && typeof candidate.title === 'string') {
      return error as ProblemDetails;
    }
  }

  return undefined;
};
