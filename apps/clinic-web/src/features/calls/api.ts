import {
  DASHBOARD_PATHS,
  toQueryString,
  type CallDetail,
  type CallListPage,
  type CallListQuery,
  type CallRecordingUrl,
} from '@clinicai/api-client';
import { api } from '../../lib/api';

/**
 * Call history endpoints, injected into the one RTK Query service (D-015).
 *
 * ─── THE RECORDING URL IS A MUTATION, NOT A QUERY, AND THAT IS DELIBERATE ───────
 *
 * It looks like a read and it is modelled as a mutation for two reasons. It MINTS something:
 * a presigned URL that is valid for a few minutes and then is not, so caching it would hand
 * somebody a dead link and a cache invalidation problem nobody asked for. And every mint is
 * an audit row naming the person who asked, so it must happen when they press play rather
 * than when a list renders a row that happens to have audio.
 */

export const callsApi = api.injectEndpoints({
  endpoints: (build) => ({
    calls: build.query<CallListPage, CallListQuery>({
      query: (filters) => ({ path: `${DASHBOARD_PATHS.calls}${toQueryString(filters)}` }),
      providesTags: (result) => [
        { type: 'Call' as const, id: 'LIST' },
        ...(result?.items ?? []).map((item) => ({ type: 'Call' as const, id: item.id })),
      ],
    }),

    call: build.query<CallDetail, string>({
      query: (callId) => ({ path: DASHBOARD_PATHS.call(callId) }),
      providesTags: (_result, _error, callId) => [{ type: 'Call' as const, id: callId }],
    }),

    callRecordingUrl: build.mutation<CallRecordingUrl, string>({
      query: (callId) => ({ path: DASHBOARD_PATHS.callRecordingUrl(callId) }),
      // Invalidates nothing: minting a URL changes no data, and the audit row it writes is
      // not something this application reads.
    }),
  }),
});

export const { useCallsQuery, useCallQuery, useCallRecordingUrlMutation } = callsApi;
