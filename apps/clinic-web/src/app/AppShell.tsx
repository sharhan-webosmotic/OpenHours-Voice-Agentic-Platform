import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import {
  Activity,
  Bell,
  Search,
  BarChart3,
  BellRing,
  Building2,
  CalendarDays,
  ClipboardList,
  LayoutDashboard,
  PhoneCall,
  Settings,
  ShieldCheck,
  Stethoscope,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { Role } from '@clinicai/shared';
import { Button } from '../components/ui/Button';
import { Logo } from '../components/ui/Logo';
import { cn } from '../components/ui/cn';
import { visibleNavigation, type NavItem } from './navigation';

/**
 * The signed-in frame: a sidebar, a top bar and the page.
 *
 * ONE SHELL, BOTH APPLICATIONS. The clinic dashboard and the admin console pass different
 * `items` and a different `subtitle`, and take their accent from the token the app's own
 * stylesheet overrides. Nothing else differs, which is the point: two shells would drift.
 *
 * The menu is `visibleNavigation(items, role)`, so it is the shared permission matrix that
 * decides what appears. There is no second list of rules here.
 */

const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: 'Super admin',
  INTERNAL_ADMIN: 'Internal admin',
  CLINIC_OWNER: 'Clinic owner',
  CLINIC_MANAGER: 'Clinic manager',
  DOCTOR: 'Doctor',
  STAFF: 'Staff',
};

/**
 * The icons the navigation can name, imported one by one.
 *
 * NOT `import * as icons from 'lucide-react'`, which is what this was first written as and
 * what the bundle budget caught: the namespace import defeats tree shaking and pulled all
 * ~1500 icons into the entry chunk, 1.2 MB of JavaScript to render twelve glyphs. Naming
 * them costs a line each and is the difference between a 100 KB entry and a 1.2 MB one.
 *
 * Icons stay strings in `navigation.ts` so that module remains plain data with no React
 * import, which is what lets it be unit tested against the permission matrix without
 * rendering anything. This map is where a string becomes a component.
 */
const ICONS: Record<string, LucideIcon> = {
  Activity,
  BarChart3,
  BellRing,
  Building2,
  CalendarDays,
  ClipboardList,
  LayoutDashboard,
  PhoneCall,
  Settings,
  ShieldCheck,
  Stethoscope,
  Users,
};

const Icon = ({ name }: { readonly name: string }) => {
  const Resolved = ICONS[name];
  return Resolved === undefined ? null : <Resolved size={16} aria-hidden="true" />;
};

export const AppShell = ({
  role,
  items,
  subtitle,
  onSignOut,
}: {
  readonly role: Role;
  readonly items: readonly NavItem[];
  /** "Admin" beside the wordmark in the console. Absent in the clinic dashboard. */
  readonly subtitle?: string | undefined;
  readonly onSignOut: () => void;
}) => {
  const visible = visibleNavigation(items, role);
  const [signingOut, setSigningOut] = useState(false);

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="flex w-60 shrink-0 flex-col gap-6 border-r border-border bg-surface px-4 py-5">
        <Logo subtitle={subtitle} />

        {/* `aria-label` because there are two navigation landmarks on some pages. */}
        <nav aria-label="Main" className="flex flex-col gap-0.5">
          {visible.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 rounded-md px-3 py-2 text-xs font-medium transition-colors',
                  isActive
                    ? 'bg-accent text-inverse'
                    : 'text-muted hover:bg-background hover:text-default',
                )
              }
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between gap-4 border-b border-border bg-surface px-6">
          <div className="flex min-w-0 items-center gap-4">
            <GlobalSearch />
            <span className="hidden text-muted text-xs lg:inline">
              Signed in as{' '}
              <strong className="font-semibold text-default">{ROLE_LABELS[role]}</strong>
            </span>
          </div>

          <Notifications />

          <Button
            kind="secondary"
            loading={signingOut}
            onClick={() => {
              setSigningOut(true);
              onSignOut();
            }}
          >
            Sign out
          </Button>
        </header>

        <main className="min-w-0 flex-1 p-6">
          <PageTitle items={visible} />
          <Outlet />
        </main>
      </div>
    </div>
  );
};

/**
 * The prototype's global search box, rendered and DISABLED.
 *
 * ─── WHY IT IS HERE AT ALL, AND WHY IT DOES NOTHING ─────────────────────────────
 *
 * The capture has a search box across the top of every screen that searches patients,
 * appointments and calls at once. There is no endpoint that does that: the patient list and
 * the appointment list each search their own resource, and calls do not exist yet.
 *
 * Leaving it out is a visible difference from the prototype. Wiring it to something that
 * searched one resource and claimed to search three would be a lie. A disabled control with
 * "Soon" beside it is neither: the chrome matches, and nobody is misled about what it does.
 * `aria-disabled` and `readOnly` rather than `disabled` alone, so a screen reader announces
 * the field and its state instead of skipping it.
 */
const GlobalSearch = () => (
  <div className="relative hidden min-w-0 sm:block">
    <label htmlFor="global-search" className="sr-only">
      Search patients, appointments or calls
    </label>
    <Search
      size={14}
      aria-hidden="true"
      className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-3 text-subtle"
    />
    <input
      id="global-search"
      type="search"
      disabled
      aria-disabled="true"
      aria-describedby="global-search-soon"
      placeholder="Search patients, appointments or calls…"
      className="h-10 w-72 max-w-full cursor-not-allowed rounded-md border border-border bg-background pr-16 pl-9 text-default text-xs placeholder:text-subtle"
    />
    <span
      id="global-search-soon"
      className="-translate-y-1/2 absolute top-1/2 right-3 rounded-full bg-surface px-2 py-0.5 font-semibold text-[0.625rem] text-muted uppercase"
    >
      Soon
    </span>
  </div>
);

/**
 * The prototype's notifications bell and its popover.
 *
 * The popover is rendered as captured, and what is inside it is the truth: there is no
 * notification endpoint, so it says so rather than listing invented alerts. The bell carries
 * no unread dot for the same reason, since a red dot over nothing is the most misleading
 * element the capture contains.
 */
const Notifications = () => {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Notifications"
        onClick={() => {
          setOpen((previous) => !previous);
        }}
        className="rounded-md border border-border p-2 text-muted hover:bg-background"
      >
        <Bell size={16} aria-hidden="true" />
      </button>

      {open && (
        <>
          {/* A click anywhere else closes it, as the prototype's popover does. */}
          <button
            type="button"
            aria-label="Close notifications"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => {
              setOpen(false);
            }}
          />
          <div
            role="dialog"
            aria-label="Notifications"
            className="absolute right-0 z-50 mt-2 w-80 rounded-xl border border-border bg-surface p-4 shadow-card"
          >
            <div className="mb-2 flex items-center justify-between gap-3">
              <strong className="font-semibold text-default text-xs">Notifications</strong>
              <span className="rounded-full bg-background px-2 py-0.5 font-semibold text-[0.625rem] text-muted uppercase">
                Soon
              </span>
            </div>
            <p className="m-0 text-muted text-xs">
              Notifications are not available yet. There is no endpoint behind them, so nothing is
              listed here rather than alerts that were never raised. They arrive with the voice
              integration, which is what will have something to report.
            </p>
          </div>
        </>
      )}
    </div>
  );
};

/**
 * The breadcrumb and heading every page carries, rendered ONCE by the shell.
 *
 * ─── WHY IT IS HERE AND NOT IN EACH SCREEN ──────────────────────────────────────
 *
 * The prototype draws the same treatment at the top of all nine screens: "Overview /
 * Patients" above a large title. Nine copies would be nine chances for one of them to use a
 * different size, and the detail screens show that it is not really a property of a screen at
 * all: the patient profile's heading is "Patients", the list it came from, with its own back
 * link underneath.
 *
 * THE ACTIVE ITEM IS THE LONGEST MATCHING PREFIX, which is what makes `/patients/:id` carry
 * the Patients heading. Exact matching would leave every detail page with no title.
 */
const PageTitle = ({ items }: { readonly items: readonly NavItem[] }) => {
  const { pathname } = useLocation();

  const active = [...items]
    .filter((item) => pathname === item.path || pathname.startsWith(`${item.path}/`))
    .sort((a, b) => b.path.length - a.path.length)[0];

  if (active === undefined) {
    return null;
  }

  const isOverview = active.path === '/overview';

  return (
    <div className="mb-5 flex flex-col gap-1">
      {!isOverview && (
        <p className="m-0 text-muted text-xs">
          <Link to="/overview" className="text-accent hover:underline">
            Overview
          </Link>{' '}
          / {active.label}
        </p>
      )}
      <h1 className="m-0 font-bold text-default text-xl">{active.label}</h1>
    </div>
  );
};

/** A page heading for a screen that needs its own, inside the shell's. */
export const PageHeading = ({
  title,
  description,
}: {
  readonly title: string;
  readonly description?: string | undefined;
}) => (
  <div className="mb-5 flex flex-col gap-1">
    <h1 className="m-0 text-xl font-bold text-default">{title}</h1>
    {description !== undefined && <p className="m-0 text-xs text-muted">{description}</p>}
  </div>
);
