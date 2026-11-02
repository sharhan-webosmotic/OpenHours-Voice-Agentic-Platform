import { configureStore } from '@reduxjs/toolkit';
import { api } from '../lib/api';

/**
 * The store, built by a factory so that a test gets its own.
 *
 * A module-level singleton shared between tests carries one test's cached response into the
 * next, and the suite then passes or fails depending on the order it ran in. The application
 * still has exactly one store, created once below.
 */

export const createAppStore = () =>
  configureStore({
    /**
     * The API cache and nothing else.
     *
     * The console has no client state worth a slice: it has four screens, no shared
     * selection and no preferences. An empty `ui` slice added "for symmetry" with the clinic
     * dashboard would be a reducer nothing dispatches to, and the two applications are being
     * split into separate repositories anyway (D-009).
     */
    reducer: {
      [api.reducerPath]: api.reducer,
    },
    /**
     * RTK Query's middleware is required, not optional: without it there is no cache
     * lifetime, no polling, no invalidation and no refetch. Its absence does not error, it
     * just quietly stops the cache working, so it is added here once rather than per store.
     */
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(api.middleware),
  });

export const store = createAppStore();

export type AppStore = ReturnType<typeof createAppStore>;
export type RootState = ReturnType<AppStore['getState']>;
export type AppDispatch = AppStore['dispatch'];
