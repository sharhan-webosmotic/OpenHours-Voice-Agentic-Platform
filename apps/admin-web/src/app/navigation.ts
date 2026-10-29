import {
  isPermitted,
  isPlatformRole,
  type Action,
  type Resource,
  type Role,
} from '@openhours/shared';

/**
 * The admin console's menu, and the rule that decides who sees what.
 *
 * NOT IN THE PROTOTYPE. The ClinicFlow prototype only ever covered the clinic dashboard,
 * so these four pages are built to the same visual language rather than transcribed from
 * it. The accent is violet rather than blue; everything else about the design is identical,
 * which is the point.
 *
 * EVERY ITEM NAMES A MATRIX CELL, exactly as the dashboard's does. `platform_users` is
 * SUPER_ADMIN only, so an INTERNAL_ADMIN sees three of the four items: that is the matrix
 * being honoured rather than something missing from this console.
 *
 * AND THE CELL IS NOT SUFFICIENT ON ITS OWN, which a test caught rather than a review. Two
 * of these four resources are readable by a CLINIC_OWNER: `organisations` and
 * `phone_voice_mapping`. Those grants are real but they mean "my own organisation", which
 * tenant isolation enforces and which the matrix itself notes beside the cell. They are not
 * a grant to the platform-wide clinic list this console shows, and filtering on the cell
 * alone put "Clinics" and "Settings" in a clinic owner's sidebar.
 *
 * So this console asks two questions: is the role a platform role at all, and does the
 * matrix permit the resource. The dashboard needs only the second, because every one of its
 * cells means the same thing in both applications. Nothing about the API changes: it already
 * refuses a clinic principal the platform-scoped reads, which is why this is a presentation
 * fix rather than a security one.
 *
 * HIDING AN ITEM IS NOT A CONTROL. The API enforces the same matrix in its service layer,
 * and a user who types a hidden path meets a page whose data calls are refused. This exists
 * so the product does not show people doors that are locked.
 */

export type NavItem = {
  readonly path: string;
  readonly label: string;
  readonly resource: Resource;
  readonly action: Action;
  /** lucide-react icon name, resolved by the shell. */
  readonly icon: string;
};

export const ADMIN_NAV = [
  {
    path: '/clinics',
    label: 'Clinics',
    resource: 'organisations',
    action: 'read',
    icon: 'Building2',
  },
  {
    path: '/internal-users',
    label: 'Internal users',
    resource: 'platform_users',
    action: 'read',
    icon: 'ShieldCheck',
  },
  {
    path: '/monitoring',
    label: 'Monitoring',
    resource: 'integration_errors',
    action: 'read',
    icon: 'Activity',
  },
  {
    path: '/settings',
    label: 'Settings',
    resource: 'phone_voice_mapping',
    action: 'read',
    icon: 'Settings',
  },
  /**
   * `as const satisfies` rather than a `readonly NavItem[]` annotation, so the paths keep
   * their literal types. That is what lets the route table be typed to cover every item: a
   * nav entry with no page becomes a compile error instead of a menu link to nowhere.
   */
] as const satisfies readonly NavItem[];

/**
 * The console's authorization predicate, defined once and used everywhere.
 *
 * Exported so the menu, the route guard and `useCan` all ask the same question. Having the
 * sidebar hide an item that the route then let through is exactly the inconsistency that
 * produced this function: the menu was filtered on the platform role and the route was not,
 * so a clinic owner saw no "Clinics" link but reached the page by typing the path.
 */
export const permits = (role: Role, resource: Resource, action: Action): boolean =>
  isPlatformRole(role) && isPermitted(role, resource, action);

export const visibleNavigation = (items: readonly NavItem[], role: Role): readonly NavItem[] =>
  items.filter((item) => permits(role, item.resource, item.action));

/**
 * Where to send this role after sign-in: their first reachable item.
 *
 * `undefined` when the role reaches nothing here, which the router turns into the no-access
 * page. That is a real state rather than a theoretical one: no clinic role belongs in this
 * console, so a clinic user who somehow got a session meets an explanation rather than four
 * pages of refusals.
 */
export const landingPath = (items: readonly NavItem[], role: Role): string | undefined =>
  visibleNavigation(items, role)[0]?.path;
