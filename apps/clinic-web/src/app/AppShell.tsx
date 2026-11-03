import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import {
  Activity,
  ChevronDown,
  Plus,
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
  X,
  type LucideIcon,
} from 'lucide-react';
import { isUserRole, type Role, type UserRole } from '@clinicai/shared';
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

/**
 * `UserRole`, not `Role`: the voice agent is a principal in the permission matrix and
 * never a signed-in person, so a label for it would be a label nothing can ever show. The
 * type is what keeps it out of this map, and out of any dropdown built from one.
 */
const ROLE_LABELS: Record<UserRole, string> = {
  SUPER_ADMIN: 'Super admin',
  INTERNAL_ADMIN: 'Internal admin',
  CLINIC_OWNER: 'Clinic owner',
  CLINIC_MANAGER: 'Clinic manager',
  DOCTOR: 'Doctor',
  STAFF: 'Staff',
};

/**
 * The signed-in person's role, in words.
 *
 * The guard is not defensive decoration: `role` arrives as a `Role`, which includes the
 * voice agent, and no session can ever carry that. Rather than widen the map to hold a
 * label nothing can display, an impossible role falls back to a plain string.
 */
const roleLabel = (role: Role): string => (isUserRole(role) ? ROLE_LABELS[role] : 'Unknown role');

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
  personName,
  onSignOut,
}: {
  readonly role: Role;
  readonly items: readonly NavItem[];
  /** "Admin" beside the wordmark in the console. Absent in the clinic dashboard. */
  readonly subtitle?: string | undefined;
  /**
   * The signed-in person's name, for the header.
   *
   * Optional because the session does not carry one yet: `CurrentUser` has an id, an
   * organisation, a role and the password flag, and nothing else. The design puts a name
   * above the role in the header, so the prop exists and the fallback is the role on its
   * own rather than a placeholder name nobody has.
   */
  readonly personName?: string | undefined;
  readonly onSignOut: () => void;
}) => {
  const visible = visibleNavigation(items, role);
  // The sidebar is the design's six; `visible` still names every page, for the page title.
  const menu = visible.filter((item) => item.inMenu !== false);

  return (
    /**
     * THE SHELL IS THE DASHBOARD DESIGN'S, measurement for measurement.
     *
     * From `ClinicFlow Interactive Prototype/src/DashboardDesign.tsx`: a 220px sidebar, a
     * 72px header, and the page on `#f3f5fd`. The export is a fixed 1920px artboard, so the
     * widths that are fixed there (the 440px search, the 220px sidebar) are fixed here and
     * everything between them flexes, which is what makes it survive a laptop.
     */
    <div className="grid min-h-screen grid-cols-[220px_minmax(0,1fr)] bg-background">
      <aside className="sticky top-0 flex h-screen flex-col border-r border-border-chrome bg-surface px-4 pb-5">
        {/*
         * The same 72px as the top bar, so the wordmark and the search box sit on one line
         * across the two columns, which is how the reference draws them.
         */}
        <div className="mb-4 flex h-[72px] shrink-0 items-center px-2.5">
          <Logo subtitle={subtitle} />
        </div>

        {/* `aria-label` because there are two navigation landmarks on some pages. */}
        <nav aria-label="Main" className="flex flex-col gap-1">
          {menu.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  'flex h-[46px] items-center gap-3 rounded-lg px-[13px] text-[0.9375rem] transition-colors',
                  isActive
                    ? 'bg-accent-surface font-semibold text-accent'
                    : 'font-medium text-muted hover:bg-background hover:text-default',
                )
              }
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-[72px] items-center gap-4 border-b border-border-chrome bg-surface/95 px-[22px] backdrop-blur">
          <GlobalSearch />

          <div className="flex-1" />

          <TodayStamp />

          <Link
            to="/appointments?book=1"
            className="flex h-10 items-center gap-2 rounded-control bg-accent px-[15px] font-semibold text-sm text-inverse shadow-accent transition-opacity hover:opacity-95"
          >
            <Plus size={18} aria-hidden="true" />
            New Appointment
          </Link>

          <PersonMenu role={role} personName={personName} onSignOut={onSignOut} />
        </header>

        <main className="min-w-0 flex-1 px-[22px] py-5">
          <PageTitle items={visible} />
          <Outlet />
        </main>
      </div>
    </div>
  );
};

/**
 * Today's date, as the header states it.
 *
 * THE BROWSER'S DAY, NOT THE CLINIC'S, and that is a deliberate limitation rather than an
 * oversight. The shell is shared with the admin console, which belongs to no clinic and so
 * has no time zone, and a header that read the clinic query would make every screen in both
 * applications wait on it. Everything that MATTERS clinically, every appointment time, every
 * agenda boundary, is rendered in the clinic's zone by `lib/clinicTime`. This is a greeting.
 */
const TodayStamp = () => {
  const today = new Date();

  return (
    <div className="hidden flex-col leading-tight xl:flex">
      <span className="text-muted text-xs">Today</span>
      <time dateTime={today.toISOString().slice(0, 10)} className="font-bold text-default text-sm">
        {new Intl.DateTimeFormat('en-IN', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }).format(today)}
      </time>
    </div>
  );
};

/**
 * The signed-in person, and the only way out of the application.
 *
 * The design draws a name, a role and a chevron. The chevron implies a menu, and the one
 * thing that menu has to contain is signing out, which the previous header carried as a
 * button of its own. So the control is the design's and the function is unchanged.
 */
const PersonMenu = ({
  role,
  personName,
  onSignOut,
}: {
  readonly role: Role;
  readonly personName: string | undefined;
  readonly onSignOut: () => void;
}) => {
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const label = roleLabel(role);

  return (
    <div className="relative flex h-12 items-center gap-2.5 border-border-chrome border-l pl-1 pr-2">
      <span className="grid size-[37px] shrink-0 place-items-center rounded-lg bg-accent-contrast font-bold text-accent text-sm">
        {initialsOf(personName ?? label)}
      </span>

      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Account menu"
        onClick={() => {
          setOpen((previous) => !previous);
        }}
        className="flex items-center gap-2 text-left"
      >
        <span className="hidden flex-col leading-tight lg:flex">
          <span className="font-black text-default text-sm">{personName ?? label}</span>
          <span className="font-semibold text-muted text-xs">
            {personName === undefined ? 'Signed in' : label}
          </span>
        </span>
        <ChevronDown size={16} aria-hidden="true" className="text-muted" />
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Close the account menu"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => {
              setOpen(false);
            }}
          />
          {/*
           * The reference's account card: the name and a close button across the top, then
           * the person large and centred, then their two actions at full width, the
           * destructive one tinted red and last.
           */}
          <div
            role="dialog"
            aria-label="Account"
            className="absolute top-[56px] right-0 z-50 w-[340px] overflow-hidden rounded-xl border border-border-chrome bg-surface shadow-popover"
          >
            <div className="flex items-center justify-between border-border-chrome border-b px-4 py-3">
              <strong className="font-semibold text-[0.9375rem] text-default">
                {personName ?? label}
              </strong>
              <button
                type="button"
                aria-label="Close"
                onClick={() => {
                  setOpen(false);
                }}
                className="grid size-7 place-items-center rounded-lg bg-background text-muted hover:text-default"
              >
                <X size={14} aria-hidden="true" />
              </button>
            </div>

            <div className="flex flex-col items-center gap-1 px-5 pt-5 pb-5 text-center">
              <span className="mb-2 grid size-[58px] place-items-center rounded-[14px] bg-accent-contrast font-bold text-accent text-lg">
                {initialsOf(personName ?? label)}
              </span>
              <span className="font-medium text-[0.9375rem] text-default">
                {personName ?? label}
              </span>
              <span className="text-muted text-xs">{label}</span>

              <div className="mt-4 flex w-full flex-col gap-2">
                {/*
                 * Present and inert: there is no profile screen yet. The design draws it,
                 * and a button that went nowhere would be worse than one that says so.
                 */}
                <button
                  type="button"
                  disabled
                  aria-disabled="true"
                  title="A profile screen is not available yet."
                  className="h-[38px] w-full cursor-not-allowed rounded-control border border-border-chrome bg-surface font-semibold text-muted text-sm"
                >
                  View profile
                </button>
                <button
                  type="button"
                  disabled={signingOut}
                  onClick={() => {
                    setSigningOut(true);
                    onSignOut();
                  }}
                  className="h-[38px] w-full rounded-control border border-danger/20 bg-danger-surface font-semibold text-danger text-sm hover:border-danger/40 disabled:opacity-60"
                >
                  {signingOut ? 'Signing out…' : 'Logout'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

/** `Priya Shah` to `PS`, and a single word to its first two letters. */
const initialsOf = (name: string): string => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0] ?? '';
  const last = words.length > 1 ? (words.at(-1) ?? '') : '';

  return (last === '' ? first.slice(0, 2) : `${first[0] ?? ''}${last[0] ?? ''}`).toUpperCase();
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
  <div className="relative hidden w-[440px] min-w-0 max-w-full md:block">
    <label htmlFor="global-search" className="sr-only">
      Search patients, appointments or calls
    </label>
    <Search
      size={18}
      aria-hidden="true"
      className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-3.5 text-subtle"
    />
    <input
      id="global-search"
      type="search"
      disabled
      aria-disabled="true"
      aria-describedby="global-search-soon"
      title="Searching everything at once is coming soon."
      placeholder="Search patients, appointments or calls…"
      className="h-[42px] w-full cursor-not-allowed rounded-lg border border-border-chrome bg-surface-sunken pr-12 pl-[42px] text-[0.9375rem] text-default placeholder:text-subtle"
    />
    {/*
     * The reference's ⌘K chip, drawn as it is drawn. It is decoration on a disabled field,
     * so it is hidden from assistive technology, and the sentence that IS announced says
     * what is true: this search is not available yet.
     */}
    <span
      aria-hidden="true"
      className="-translate-y-1/2 absolute top-1/2 right-2.5 grid h-6 min-w-[27px] place-items-center rounded-[7px] border border-border-chrome px-1 text-subtle text-xs"
    >
      ⌘K
    </span>
    <span id="global-search-soon" className="sr-only">
      Not available yet.
    </span>
  </div>
);

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

  /**
   * NO TITLE ON THE OVERVIEW. The design opens that page on its greeting card, with no
   * breadcrumb and no heading above it; the page carries its own `h1`, visually hidden, so
   * it still has a landmark heading named after it.
   */
  if (active === undefined || active.path === '/overview') {
    return null;
  }

  return (
    <div className="mb-5 flex flex-col gap-1">
      <p className="m-0 text-muted text-xs">
        <Link to="/overview" className="text-accent hover:underline">
          Overview
        </Link>{' '}
        / {active.label}
      </p>
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
