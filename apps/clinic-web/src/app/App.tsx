import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router';
import { apiClient, sessionBus } from '../lib/apiClient';
import { AuthProvider } from './AuthProvider';
import { ErrorBoundary } from './ErrorBoundary';
import { AppRoutes } from './routes';

/**
 * The provider stack, outermost first.
 *
 * The order is not arbitrary. The error boundary is outside everything, so a failure while
 * mounting a provider still renders something. The router is outside the auth provider
 * because the provider's guards navigate. The query client is outside both so that a
 * feature can read it from anywhere.
 */

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      /**
       * One retry, and not on a 4xx.
       *
       * The client already recovers from an expired access token by refreshing once, so a
       * query-level retry on a 401 would re-run a request whose credential problem has
       * either been fixed already or cannot be. Retrying a 403 is worse: it turns one
       * refusal into several, and for `password-change-required` it delays the screen the
       * user needs.
       */
      retry: (failureCount, error) => {
        const status = (error as { status?: unknown }).status;
        if (typeof status === 'number' && status >= 400 && status < 500) {
          return false;
        }
        return failureCount < 1;
      },
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

export const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider client={apiClient} sessionLost={sessionBus.subscribe}>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </ErrorBoundary>
);
