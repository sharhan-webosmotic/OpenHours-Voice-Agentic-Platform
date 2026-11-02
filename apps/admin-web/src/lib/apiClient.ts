import { createApiClient, type ApiClient } from '@clinicai/api-client';
import { createSessionBus, type SessionBus } from '../app/sessionBus';
import { config } from '../config';

/**
 * The one API client for this application, and the channel it reports a lost session on.
 *
 * Built here rather than inside a component so that there is exactly one: a second client
 * would hold a second access token and its own single-flight slot, which would defeat the
 * refresh de-duplication the first one does. Every feature imports this.
 *
 * `audience: 'admin'` is fixed at construction and cannot be overridden by a screen. A
 * clinic user signing in to this console is refused by the API before a token is issued. ADR-0001 records that this is user experience and defence in depth
 * rather than a boundary: the permission matrix is what protects the admin surface.
 */

export const sessionBus: SessionBus = createSessionBus();

export const apiClient: ApiClient = createApiClient({
  baseUrl: config.VITE_API_URL,
  audience: 'admin',
  onSessionLost: sessionBus.emit,
});
