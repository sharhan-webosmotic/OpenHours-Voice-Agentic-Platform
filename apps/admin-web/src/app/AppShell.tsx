import { useState } from 'react';
import { NavLink, Outlet } from 'react-router';
import {
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
  type LucideIcon,
} from 'lucide-react';
import type { Role } from '@openhours/shared';
import { Button } from '../components/ui/Button';
import { Logo } from '../components/ui/Logo';
import { cn } from '../components/ui/cn';
import { visibleNavigation, type NavItem } from './navigation';

/**
 * The signed-in frame: a sidebar, a top bar and the page.
 *
 * A COPY OF THE DASHBOARD'S SHELL, deliberately. The two applications are being split into
 * separate repositories, so they hold their own copies rather than importing a shared
 * package: see docs/DECISIONS.md D-009, which also records the cost, that the two will
 * drift unless a change to one is applied to the other.
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
          <span className="text-xs text-muted">
            Signed in as <strong className="font-semibold text-default">{ROLE_LABELS[role]}</strong>
          </span>

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
          <Outlet />
        </main>
      </div>
    </div>
  );
};

/** A page heading, used by every placeholder and every real page after this feature. */
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
