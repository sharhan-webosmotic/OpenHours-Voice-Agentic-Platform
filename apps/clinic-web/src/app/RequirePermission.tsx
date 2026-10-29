import type { ReactNode } from 'react';
import type { Action, Resource } from '@clinicai/shared';
import { useCan } from '../lib/useCan';

/**
 * Renders a page only if the role may read it, and explains itself when it may not.
 *
 * NOT A SECURITY BOUNDARY, and the component is named for what it does rather than what it
 * protects. A user who types a hidden path reaches a page whose every data call the API
 * refuses; this turns that from a screen of failed requests into a sentence. The control is
 * the matrix in the service layer.
 *
 * It exists because a menu that hides items is not enough on its own: the path is still
 * typeable, still bookmarkable, and still in the history of a user whose role was lowered.
 */
export const RequirePermission = ({
  resource,
  action = 'read',
  children,
  fallback,
}: {
  readonly resource: Resource;
  readonly action?: Action | undefined;
  readonly children: ReactNode;
  readonly fallback: ReactNode;
}) => (useCan(resource, action) ? <>{children}</> : <>{fallback}</>);
