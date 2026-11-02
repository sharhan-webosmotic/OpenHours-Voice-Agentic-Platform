import { createApi } from '@reduxjs/toolkit/query/react';
import { apiClient } from './apiClient';
import { createApiBaseQuery } from './baseQuery';

/**
 * The one RTK Query service. Features inject their endpoints into it.
 *
 * ONE service rather than one per feature, because cache invalidation crosses features:
 * booking an appointment changes the agenda, the patient's history and the overview counts,
 * and tags only invalidate within the service that owns them. Two services would mean a
 * mutation in one silently leaving the other showing yesterday's data.
 *
 * Endpoints are INJECTED (`injectEndpoints` in each feature) rather than declared here, so
 * a feature folder stays self-contained and this file does not grow a dependency on every
 * screen in the application.
 */

export const api = createApi({
  reducerPath: 'api',
  baseQuery: createApiBaseQuery(apiClient),

  /**
   * Every cache tag the application uses, declared once.
   *
   * RTK Query requires the full list up front: a tag a mutation invalidates but which was
   * never declared is silently ignored, so a missing entry here is a stale screen with no
   * error anywhere. They are listed in the order the features arrive.
   */
  tagTypes: ['Patient', 'Appointment', 'Availability', 'Agenda', 'Call', 'Doctor', 'Service'],

  endpoints: () => ({}),

  /**
   * Thirty seconds, matching what the TanStack Query configuration used.
   *
   * Clinic data changes while someone is looking at it, because the voice agent books into
   * the same calendar. Thirty seconds is short enough that a screen left open is not
   * meaningfully wrong and long enough that moving between screens does not refetch
   * everything.
   */
  keepUnusedDataFor: 30,

  /**
   * No refetch on window focus, which is what the TanStack Query configuration also chose.
   *
   * It is tempting here, because the voice agent books into the same calendar while someone
   * is looking at it. It is left off because turning it on means every tab switch refetches
   * every mounted query, and the screens that matter for that case (the agenda and the call
   * list) are better served by an explicit refresh control the user can see. Changing this
   * is a product decision, not a configuration tweak.
   */
  refetchOnFocus: false,
  refetchOnReconnect: true,
});
