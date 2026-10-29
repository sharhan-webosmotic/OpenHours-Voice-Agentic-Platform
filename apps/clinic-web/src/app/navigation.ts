import { isPermitted, type Action, type Resource, type Role } from '@openhours/shared';

/**
 * The menu, and the rule that decides who sees what.
 *
 * EVERY ITEM NAMES A MATRIX CELL. There is no second copy of the authorization rules in
 * the user interface: an item is visible exactly when `isPermitted` says the role may read
 * that resource. If a permission changes in `packages/shared`, the menu changes with it and
 * nothing here is edited.
 *
 * HIDING AN ITEM IS NOT A CONTROL, and this file is not security. The API enforces the same
 * matrix in its service layer (root CLAUDE.md rule 3), and a user who types the path of a
 * hidden page reaches a page whose data calls are refused by the server. This exists so the
 * product does not show people doors that are locked.
 *
 * THE LANDING ROUTE IS COMPUTED, NOT CONSTANT, and that is not a detail. `analytics` is
 * denied to STAFF, so Overview and Reports do not exist for a staff member: a hardcoded
 * redirect to `/overview` would drop every staff member on a page they may not read, on
 * every sign-in. `landingPath` returns the first item their role actually reaches.
 */

export type NavItem = {
  /** Route path, relative to the application root. */
  readonly path: string;
  readonly label: string;
  /** The matrix cell that governs visibility. */
  readonly resource: Resource;
  readonly action: Action;
  /** lucide-react icon name, resolved by the shell. */
  readonly icon: string;
};

/**
 * The clinic dashboard's nine items, in the prototype's order.
 *
 * The resource for each is the one the page would actually read, not the one whose name
 * sounds closest. "Doctors & Staff" and "Services" are both views onto
 * `doctors_services_hours`, which is why they share a cell: the matrix models the data,
 * and two screens over one table is a presentation choice.
 */
export const CLINIC_NAV = [
  {
    path: '/overview',
    label: 'Overview',
    resource: 'analytics',
    action: 'read',
    icon: 'LayoutDashboard',
  },
  {
    path: '/appointments',
    label: 'Appointments',
    resource: 'appointments',
    action: 'read',
    icon: 'CalendarDays',
  },
  { path: '/patients', label: 'Patients', resource: 'patients', action: 'read', icon: 'Users' },
  {
    path: '/staff',
    label: 'Doctors & Staff',
    resource: 'doctors_services_hours',
    action: 'read',
    icon: 'Stethoscope',
  },
  {
    path: '/services',
    label: 'Services',
    resource: 'doctors_services_hours',
    action: 'read',
    icon: 'ClipboardList',
  },
  {
    path: '/calls',
    label: 'Call History',
    resource: 'call_history',
    action: 'read',
    icon: 'PhoneCall',
  },
  {
    path: '/reminders',
    label: 'Reminders',
    resource: 'reminder_settings',
    action: 'read',
    icon: 'BellRing',
  },
  { path: '/reports', label: 'Reports', resource: 'analytics', action: 'read', icon: 'BarChart3' },
  {
    path: '/settings',
    label: 'Clinic Settings',
    resource: 'clinic_settings',
    action: 'read',
    icon: 'Settings',
  },
  /**
   * `as const satisfies` rather than a `readonly NavItem[]` annotation, so the paths keep
   * their literal types. That is what lets the route table be typed to cover every item:
   * a nav entry with no page becomes a compile error instead of a menu link to nowhere.
   */
] as const satisfies readonly NavItem[];

/** The items this role may see, in declared order. */
export const visibleNavigation = (items: readonly NavItem[], role: Role): readonly NavItem[] =>
  items.filter((item) => isPermitted(role, item.resource, item.action));

/**
 * Where to send this role after sign-in: their first reachable item.
 *
 * `undefined` when the role reaches nothing in this application, which the router turns
 * into the no-access page. That is a real state rather than a theoretical one: a platform
 * role that got past the audience check into the clinic dashboard reaches none of its nine
 * pages, and showing an explanation beats showing an empty shell.
 */
export const landingPath = (items: readonly NavItem[], role: Role): string | undefined =>
  visibleNavigation(items, role)[0]?.path;
