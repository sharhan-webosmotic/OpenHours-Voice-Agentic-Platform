import { isPermitted, type Action, type Resource } from '@clinicai/shared';
import { useRole } from '../app/AuthProvider';

/**
 * Whether the signed-in role may do this, according to the shared matrix.
 *
 * COSMETIC ONLY. This decides whether to render a control, never whether an action is
 * allowed: the API enforces the same matrix in its service layer, and that is the control
 * (root CLAUDE.md rule 3). A reviewer should be able to delete every call to this hook and
 * find the product still secure, only uglier.
 *
 * Denies while booting or signed out, which is the safe direction: a control that flashes
 * into view before the role is known is a control someone will click.
 */
export const useCan = (resource: Resource, action: Action): boolean => {
  const role = useRole();
  return role !== undefined && isPermitted(role, resource, action);
};
