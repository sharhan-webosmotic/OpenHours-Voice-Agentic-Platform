import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router';
import { apiClient, sessionBus } from '../lib/apiClient';
import { AuthProvider } from './AuthProvider';
import { ErrorBoundary } from './ErrorBoundary';
import { AppRoutes } from './routes';
import { store } from './store';

/**
 * The provider stack, outermost first.
 *
 * The order is not arbitrary. The error boundary is outside everything, so a failure while
 * mounting a provider still renders something. The router is outside the auth provider
 * because the provider's guards navigate. The store is outside both so that a feature can
 * read it from anywhere.
 *
 * THE SESSION IS NOT IN THE STORE. `AuthProvider` owns it and the access token stays inside
 * the API client's closure (D-002). Copying the signed-in user into a slice would add a
 * second place the session can be wrong, and would put exactly the data that must stay out
 * of a dev-tools snapshot into one.
 */

export const App = () => (
  <ErrorBoundary>
    <Provider store={store}>
      <BrowserRouter>
        <AuthProvider client={apiClient} sessionLost={sessionBus.subscribe}>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </Provider>
  </ErrorBoundary>
);
