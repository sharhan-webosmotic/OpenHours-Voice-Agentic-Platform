import { configureStore } from '@reduxjs/toolkit';
import type { ApiClient } from '@clinicai/api-client';
import { apiClient } from '../lib/apiClient';
import { api } from '../lib/api';
import { uiReducer } from './uiSlice';

/**
 * The store, built by a factory so that a test gets its own.
 *
 * A module-level singleton shared between tests carries one test's cached response into the
 * next, and the suite then passes or fails depending on the order it ran in. The application
 * still has exactly one store, created once below.
 */

/**
 * `client` is injected rather than imported by the transport.
 *
 * It is what makes a screen testable: the component tests hand the same stub to the store and
 * to `AuthProvider`, so a test that stubs a response actually stubs the response the screen
 * receives. See the note at the top of `lib/baseQuery.ts` for what happened when it did not.
 */
export const createAppStore = (client: ApiClient = apiClient) =>
  configureStore({
    reducer: {
      [api.reducerPath]: api.reducer,
      ui: uiReducer,
    },
    /**
     * RTK Query's middleware is required, not optional: without it there is no cache
     * lifetime, no polling, no invalidation and no refetch. Its absence does not error, it
     * just quietly stops the cache working, so it is added here once rather than per store.
     */
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({ thunk: { extraArgument: { client } } }).concat(api.middleware),
  });

export const store = createAppStore();

export type AppStore = ReturnType<typeof createAppStore>;
export type RootState = ReturnType<AppStore['getState']>;
export type AppDispatch = AppStore['dispatch'];
