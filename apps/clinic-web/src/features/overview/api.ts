import {
  DASHBOARD_PATHS,
  toQueryString,
  type OverviewRange,
  type OverviewResult,
} from '@clinicai/api-client';
import { api } from '../../lib/api';

/**
 * The overview's figures, injected into the one RTK Query service (D-015).
 *
 * Tagged with both `Agenda` and `Call`, because a booking and an ingested call each change a
 * card on it. Without the tags, a receptionist who booked from the header would come back to
 * an overview still saying the week had one fewer AI booking than it did.
 */
export const overviewApi = api.injectEndpoints({
  endpoints: (build) => ({
    overview: build.query<OverviewResult, { readonly range: OverviewRange }>({
      query: (filters) => ({ path: `${DASHBOARD_PATHS.overview}${toQueryString(filters)}` }),
      // `Agenda/RANGE` is the tag every appointment mutation invalidates, and `Call/LIST` is
      // the call history's. A tag of its own here would be a tag nothing ever clears.
      providesTags: [
        { type: 'Agenda' as const, id: 'RANGE' },
        { type: 'Call' as const, id: 'LIST' },
      ],
    }),
  }),
});

export const { useOverviewQuery } = overviewApi;
