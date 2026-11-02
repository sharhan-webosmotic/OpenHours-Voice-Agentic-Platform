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
   * error anywhere.
   *
   * One tag, because the console is one resource seen two ways. The clinic list and the
   * clinic detail are the same rows, and every write is a section of one clinic, so a
   * section save invalidates the clinic and the list re-reads with it.
   */
  tagTypes: ['Clinic'],

  endpoints: () => ({}),

  /**
   * Thirty seconds, matching what the TanStack Query configuration used.
   *
   * Short enough that a screen left open is not meaningfully wrong, long enough that moving
   * between the list and a clinic does not refetch everything.
   */
  keepUnusedDataFor: 30,

  /**
   * No refetch on window focus, which is what the TanStack Query configuration also chose.
   *
   * Turning it on means every tab switch refetches every mounted query. Clinic configuration
   * is edited by one person at a time, so there is nothing for that to catch.
   */
  refetchOnFocus: false,
  refetchOnReconnect: true,
});
