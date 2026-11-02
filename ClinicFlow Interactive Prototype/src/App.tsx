import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import DashboardDesign from './DashboardDesign';

type Page =
  | 'overview'
  | 'appointments'
  | 'calendar'
  | 'patients'
  | 'staff'
  | 'services'
  | 'calls'
  | 'followups'
  | 'reminders'
  | 'reports'
  | 'notifications'
  | 'settings';
type Status = 'Confirmed' | 'Pending' | 'AI Booking' | 'Cancelled' | 'Reschedule Requested';
type Appointment = {
  id: number;
  patientId: number;
  serviceId: number;
  date: string;
  time: string;
  status: Status;
  source: string;
  notes: string;
};
type Patient = {
  id: number;
  name: string;
  phone: string;
  email: string;
  dob: string;
  notes: string;
};
type Service = {
  id: number;
  name: string;
  description: string;
  duration: number;
  price: number;
  active: boolean;
};
type Followup = {
  id: number;
  title: string;
  patientId: number;
  due: string;
  priority: string;
  status: string;
};
type Reminder = {
  id: number;
  appointmentId: number;
  scheduled: string;
  type: string;
  status: string;
};

const nav: { page: Page; label: string; icon: string }[] = [
  { page: 'overview', label: 'Overview', icon: '/assets/d58e7.svg' },
  { page: 'appointments', label: 'Appointments', icon: '/assets/27833.svg' },
  { page: 'patients', label: 'Patients', icon: '/assets/be24d.svg' },
  { page: 'staff', label: 'Doctors & Staff', icon: '/assets/8bbd1.svg' },
  { page: 'services', label: 'Services', icon: '/assets/0cc00.svg' },
  { page: 'calls', label: 'Call History', icon: '/assets/820e1.svg' },
  { page: 'reminders', label: 'Reminders', icon: '/assets/9a97a.svg' },
  { page: 'reports', label: 'Reports', icon: '/assets/8c2ed.svg' },
  { page: 'settings', label: 'Clinic Settings', icon: '/assets/5aa53.svg' },
];

const initialPatients: Patient[] = [
  {
    id: 1,
    name: 'Laura Miller',
    phone: '(415) 555-0142',
    email: 'laura@example.com',
    dob: '1988-06-14',
    notes: 'Prefers morning appointments.',
  },
  {
    id: 2,
    name: 'Noah Johnson',
    phone: '(415) 555-0176',
    email: 'noah@example.com',
    dob: '1992-10-08',
    notes: '',
  },
  {
    id: 3,
    name: 'Sophia Davis',
    phone: '(415) 555-0189',
    email: 'sophia@example.com',
    dob: '1985-02-21',
    notes: 'Follow-up requested.',
  },
  {
    id: 4,
    name: 'Mason Clark',
    phone: '(415) 555-0113',
    email: 'mason@example.com',
    dob: '1979-12-02',
    notes: '',
  },
  {
    id: 5,
    name: 'Emma Wilson',
    phone: '(415) 555-0134',
    email: 'emma@example.com',
    dob: '1995-04-18',
    notes: '',
  },
];
const initialServices: Service[] = [
  {
    id: 1,
    name: 'General Consultation',
    description: 'Routine consultation and assessment.',
    duration: 30,
    price: 120,
    active: true,
  },
  {
    id: 2,
    name: 'Follow-up',
    description: 'Review progress after a consultation.',
    duration: 30,
    price: 80,
    active: true,
  },
  {
    id: 3,
    name: 'Skin Review',
    description: 'Focused skin health review.',
    duration: 45,
    price: 145,
    active: true,
  },
  {
    id: 4,
    name: 'Annual Wellness',
    description: 'Sample preventive wellness appointment.',
    duration: 60,
    price: 190,
    active: true,
  },
];
const initialAppointments: Appointment[] = [
  {
    id: 1,
    patientId: 1,
    serviceId: 1,
    date: '2025-05-19',
    time: '09:00',
    status: 'Confirmed',
    source: 'Website',
    notes: 'New patient consultation.',
  },
  {
    id: 2,
    patientId: 1,
    serviceId: 1,
    date: '2025-05-19',
    time: '10:30',
    status: 'AI Booking',
    source: 'AI Receptionist',
    notes: '',
  },
  {
    id: 3,
    patientId: 2,
    serviceId: 2,
    date: '2025-05-19',
    time: '11:15',
    status: 'Confirmed',
    source: 'Clinic',
    notes: '',
  },
  {
    id: 4,
    patientId: 3,
    serviceId: 3,
    date: '2025-05-19',
    time: '14:00',
    status: 'Pending',
    source: 'AI Receptionist',
    notes: 'Please confirm request.',
  },
  {
    id: 5,
    patientId: 4,
    serviceId: 1,
    date: '2025-05-20',
    time: '09:00',
    status: 'Confirmed',
    source: 'Phone',
    notes: '',
  },
  {
    id: 6,
    patientId: 5,
    serviceId: 2,
    date: '2025-05-22',
    time: '15:30',
    status: 'Reschedule Requested',
    source: 'AI Receptionist',
    notes: '',
  },
];
const calls = [
  {
    id: 1,
    when: 'May 19, 9:42 AM',
    caller: 'Laura Miller',
    type: 'New patient',
    outcome: 'Booked',
    duration: '4m 18s',
    appointmentId: 2,
    summary: 'Laura asked about availability and booked a general consultation.',
    reviewed: false,
  },
  {
    id: 2,
    when: 'May 19, 9:18 AM',
    caller: 'Robert Patel',
    type: 'Reschedule',
    outcome: 'Updated',
    duration: '2m 46s',
    appointmentId: 0,
    summary: 'Caller requested a later appointment. Clinic review is required.',
    reviewed: false,
  },
  {
    id: 3,
    when: 'May 19, 8:54 AM',
    caller: 'Emma Wilson',
    type: 'General enquiry',
    outcome: 'Resolved',
    duration: '3m 08s',
    appointmentId: 0,
    summary: 'Asked about clinic hours and preparation guidance.',
    reviewed: true,
  },
  {
    id: 4,
    when: 'May 19, 8:21 AM',
    caller: 'James Brown',
    type: 'Cancellation',
    outcome: 'Follow-up',
    duration: '1m 52s',
    appointmentId: 0,
    summary: 'Cancellation request captured for staff review.',
    reviewed: false,
  },
];
const notices = [
  {
    id: 1,
    title: 'Booking request needs review',
    body: 'Sophia Davis requested May 19 at 2:00 PM.',
    time: '8 min ago',
    read: false,
    page: 'appointments' as Page,
  },
  {
    id: 2,
    title: 'AI call follow-up due',
    body: 'Review Robert Patel’s reschedule request.',
    time: '32 min ago',
    read: false,
    page: 'calls' as Page,
  },
  {
    id: 3,
    title: 'Reminder delivery failed',
    body: 'A simulated SMS reminder could not be delivered.',
    time: '1 hr ago',
    read: true,
    page: 'reminders' as Page,
  },
];

function load<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) || '') as T;
  } catch {
    return fallback;
  }
}

function Button({
  children,
  onClick,
  kind = 'primary',
  type = 'button',
  disabled = false,
  className = '',
}: {
  children: ReactNode;
  onClick?: () => void;
  kind?: 'primary' | 'secondary' | 'ghost' | 'danger';
  type?: 'button' | 'submit';
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      className={`btn ${kind} ${className}`}
      onClick={onClick}
      type={type}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
function Badge({
  status,
  selectedFontSize = false,
}: {
  status: string;
  selectedFontSize?: boolean;
}) {
  return (
    <span
      className={`badge ${status.toLowerCase().replaceAll(' ', '-')} ${selectedFontSize ? 'selected-font-size' : ''}`}
    >
      {status}
    </span>
  );
}
function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`card ${className}`}>{children}</section>;
}
function Empty({
  title = 'No records found',
  body = 'Try adjusting your search or filters.',
}: {
  title?: string;
  body?: string;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">◇</div>
      <strong>{title}</strong>
      <p>{body}</p>
    </div>
  );
}

export default function App() {
  const [auth, setAuth] = useState(() => sessionStorage.getItem('clinicflow-auth') === 'yes');
  const [authScreen, setAuthScreen] = useState<'login' | 'forgot' | 'reset'>('login');
  const [page, setPage] = useState<Page>('overview');
  const [patients, setPatients] = useState(() => load('cf-patients', initialPatients));
  const [services, setServices] = useState(() => load('cf-services', initialServices));
  const [appointments, setAppointments] = useState(() =>
    load('cf-appointments', initialAppointments),
  );
  const [followups, setFollowups] = useState<Followup[]>(() =>
    load('cf-followups', [
      {
        id: 1,
        title: 'Confirm requested time change',
        patientId: 5,
        due: '2025-05-19',
        priority: 'High',
        status: 'Overdue',
      },
      {
        id: 2,
        title: 'Check in after consultation',
        patientId: 2,
        due: '2025-05-21',
        priority: 'Medium',
        status: 'Pending',
      },
    ]),
  );
  const [reminders, setReminders] = useState<Reminder[]>(() =>
    load('cf-reminders', [
      {
        id: 1,
        appointmentId: 3,
        scheduled: 'May 18, 11:15 AM',
        type: 'SMS',
        status: 'Sent (simulated)',
      },
      { id: 2, appointmentId: 4, scheduled: 'May 18, 2:00 PM', type: 'Email', status: 'Scheduled' },
      { id: 3, appointmentId: 5, scheduled: 'May 19, 9:00 AM', type: 'SMS', status: 'Failed' },
    ]),
  );
  const [working, setWorking] = useState(() =>
    load('cf-working', {
      start: '09:00',
      end: '17:00',
      breakStart: '12:30',
      breakEnd: '13:30',
      days: [1, 2, 3, 4, 5],
    }),
  );
  const [booking, setBooking] = useState<{
    open: boolean;
    edit?: Appointment;
    initialPatient?: number;
    initialDate?: string;
  }>({ open: false });
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [toast, setToast] = useState('');
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [periodOpen, setPeriodOpen] = useState(false);
  const [period, setPeriod] = useState('Last 7 days');
  const [searchOpen, setSearchOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const [readNotices, setReadNotices] = useState<number[]>([]);

  useEffect(() => localStorage.setItem('cf-patients', JSON.stringify(patients)), [patients]);
  useEffect(() => localStorage.setItem('cf-services', JSON.stringify(services)), [services]);
  useEffect(
    () => localStorage.setItem('cf-appointments', JSON.stringify(appointments)),
    [appointments],
  );
  useEffect(() => localStorage.setItem('cf-followups', JSON.stringify(followups)), [followups]);
  useEffect(() => localStorage.setItem('cf-reminders', JSON.stringify(reminders)), [reminders]);
  useEffect(() => localStorage.setItem('cf-working', JSON.stringify(working)), [working]);
  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(''), 2800);
    return () => window.clearTimeout(id);
  }, [toast]);

  const go = (next: Page) => {
    setPage(next);
    setNotifyOpen(false);
    setProfileOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const person = (id: number) => patients.find((item) => item.id === id)!;
  const service = (id: number) => services.find((item) => item.id === id)!;
  const saveAppointment = (value: Appointment) => {
    setAppointments((current) =>
      current.some((item) => item.id === value.id)
        ? current.map((item) => (item.id === value.id ? value : item))
        : [...current, value],
    );
    setReminders((current) => {
      const existing = current.find((item) => item.appointmentId === value.id);
      if (value.status === 'Cancelled')
        return current.map((item) =>
          item.appointmentId === value.id ? { ...item, status: 'Cancelled' } : item,
        );
      if (existing)
        return current.map((item) =>
          item.appointmentId === value.id
            ? { ...item, scheduled: `${value.date}, ${value.time}`, status: 'Scheduled' }
            : item,
        );
      return [
        ...current,
        {
          id: Date.now(),
          appointmentId: value.id,
          scheduled: `${value.date}, ${value.time}`,
          type: 'SMS',
          status: 'Scheduled',
        },
      ];
    });
    setSelectedAppointment(value);
    setToast(
      value.id > 100
        ? 'Appointment created and synchronized.'
        : 'Appointment updated across ClinicFlow.',
    );
  };

  if (!auth)
    return (
      <Auth
        screen={authScreen}
        setScreen={setAuthScreen}
        onSuccess={() => {
          sessionStorage.setItem('clinicflow-auth', 'yes');
          setAuth(true);
        }}
      />
    );

  const dashboardClick = (event: React.MouseEvent) => {
    const text = (event.target as HTMLElement).closest('div, p')?.textContent?.trim() || '';
    const destinations: [string, Page][] = [
      ['Appointments', 'appointments'],
      ['Patients', 'patients'],
      ['Doctors & Staff', 'staff'],
      ['Services', 'services'],
      ['Call History', 'calls'],
      ['Follow-ups', 'followups'],
      ['Reminders', 'reminders'],
      ['Reports', 'reports'],
      ['Clinic Settings', 'settings'],
      ['View Full Schedule', 'calendar'],
      ['Recent AI Calls', 'calls'],
      ['Upcoming Appointments', 'appointments'],
    ];
    if (text === 'New Appointment' || text === 'Book') setBooking({ open: true });
    else if (
      [
        'Today',
        'Last 7 days',
        'Last 30 days',
        'This month',
        'Last month',
        'Custom date range',
      ].includes(text)
    )
      setPeriodOpen(true);
    else if (text.includes('Dr. Priya Shah') || text === 'PS') setProfileOpen(true);
    else if (text.includes('Laura Miller') && text.length < 80)
      setSelectedAppointment(appointments.find((item) => item.patientId === 1) || null);
    else {
      const found = destinations.find(([label]) => text === label || text.startsWith(label));
      if (found) go(found[1]);
    }
  };

  const pageContent = (() => {
    switch (page) {
      case 'appointments':
        return (
          <Appointments
            appointments={appointments}
            patients={patients}
            services={services}
            onNew={() => setBooking({ open: true })}
            onOpen={setSelectedAppointment}
          />
        );
      case 'calendar':
        return (
          <Calendar
            appointments={appointments}
            patients={patients}
            services={services}
            working={working}
            onNew={(date) => setBooking({ open: true, initialDate: date })}
            onOpen={setSelectedAppointment}
          />
        );
      case 'patients':
        return (
          <Patients
            patients={patients}
            appointments={appointments}
            followups={followups}
            setFollowups={setFollowups}
            toast={setToast}
            onSave={(item) => {
              setPatients((current) =>
                current.some((p) => p.id === item.id)
                  ? current.map((p) => (p.id === item.id ? item : p))
                  : [...current, item],
              );
              setToast('Patient saved and added to booking options.');
            }}
            onBook={(id) => setBooking({ open: true, initialPatient: id })}
          />
        );
      case 'staff':
        return (
          <Staff
            working={working}
            setWorking={(value) => {
              setWorking(value);
              setToast('Dr. Priya Shah’s availability was updated.');
            }}
            services={services}
          />
        );
      case 'services':
        return <Services services={services} setServices={setServices} toast={setToast} />;
      case 'calls':
        return (
          <Calls
            onAppointment={(id) => {
              const item = appointments.find((a) => a.id === id);
              if (item) setSelectedAppointment(item);
            }}
            onFollowup={(caller) => {
              const p = patients.find((item) => item.name === caller) || patients[0];
              setFollowups((current) => [
                ...current,
                {
                  id: Date.now(),
                  title: `Follow up on AI call with ${caller}`,
                  patientId: p.id,
                  due: '2025-05-20',
                  priority: 'Medium',
                  status: 'Pending',
                },
              ]);
              setToast('Follow-up task created.');
            }}
          />
        );
      case 'followups':
        return (
          <Followups
            items={followups}
            setItems={setFollowups}
            patients={patients}
            toast={setToast}
          />
        );
      case 'reminders':
        return (
          <Reminders
            items={reminders}
            setItems={setReminders}
            appointments={appointments}
            patients={patients}
            toast={setToast}
          />
        );
      case 'reports':
        return (
          <Reports
            appointments={appointments}
            services={services}
            period={period}
            setPeriod={setPeriod}
          />
        );
      case 'notifications':
        return <Notifications read={readNotices} setRead={setReadNotices} go={go} />;
      case 'settings':
        return <Settings working={working} setWorking={setWorking} toast={setToast} />;
      default:
        return null;
    }
  })();

  return (
    <>
      {page === 'overview' ? (
        <Shell
          page={page}
          go={go}
          onNew={() => setBooking({ open: true })}
          globalSearch={globalSearch}
          setGlobalSearch={setGlobalSearch}
          setSearchOpen={setSearchOpen}
          setNotifyOpen={setNotifyOpen}
          setProfileOpen={setProfileOpen}
          hidePageHeading
        >
          <div className="dashboard-embedded" onClickCapture={dashboardClick}>
            <DashboardDesign period={period} />
          </div>
        </Shell>
      ) : (
        <Shell
          page={page}
          go={go}
          onNew={() => setBooking({ open: true })}
          globalSearch={globalSearch}
          setGlobalSearch={setGlobalSearch}
          setSearchOpen={setSearchOpen}
          setNotifyOpen={setNotifyOpen}
          setProfileOpen={setProfileOpen}
        >
          {pageContent}
        </Shell>
      )}
      {booking.open && (
        <AppointmentForm
          edit={booking.edit}
          initialPatient={booking.initialPatient}
          initialDate={booking.initialDate}
          patients={patients}
          services={services}
          appointments={appointments}
          working={working}
          onClose={() => setBooking({ open: false })}
          onSave={(value) => {
            saveAppointment(value);
            setBooking({ open: false });
          }}
          onAddPatient={(item) => setPatients((current) => [...current, item])}
        />
      )}
      {selectedAppointment && (
        <AppointmentDetails
          item={selectedAppointment}
          patient={person(selectedAppointment.patientId)}
          service={service(selectedAppointment.serviceId)}
          onClose={() => setSelectedAppointment(null)}
          onEdit={() => {
            setBooking({ open: true, edit: selectedAppointment });
            setSelectedAppointment(null);
          }}
          onStatus={(status) => {
            const changed = { ...selectedAppointment, status };
            saveAppointment(changed);
            setSelectedAppointment(changed);
          }}
        />
      )}
      {notifyOpen && (
        <Popover title="Notifications" onClose={() => setNotifyOpen(false)}>
          <NotificationList compact read={readNotices} setRead={setReadNotices} go={go} />
        </Popover>
      )}
      {profileOpen && (
        <Popover title="Dr. Priya Shah" onClose={() => setProfileOpen(false)}>
          <div className="profile-card">
            <div className="avatar large">PS</div>
            <strong>Dr. Priya Shah</strong>
            <span>Clinic Owner</span>
            <Button kind="secondary" onClick={() => go('staff')}>
              View profile
            </Button>
            <Button kind="danger" onClick={() => setLogoutOpen(true)}>
              Logout
            </Button>
          </div>
        </Popover>
      )}
      {searchOpen && (
        <SearchPanel
          query={globalSearch}
          patients={patients}
          appointments={appointments}
          go={go}
          close={() => setSearchOpen(false)}
        />
      )}
      {periodOpen && (
        <Popover title="Reporting period" onClose={() => setPeriodOpen(false)}>
          {[
            'Today',
            'Last 7 days',
            'Last 30 days',
            'This month',
            'Last month',
            'Custom date range',
          ].map((item) => (
            <button
              className={`menu-row ${period === item ? 'selected' : ''}`}
              key={item}
              onClick={() => {
                setPeriod(item);
                setPeriodOpen(false);
                setToast(`Dashboard metrics updated for ${item}.`);
              }}
            >
              {item}
            </button>
          ))}
        </Popover>
      )}
      {logoutOpen && (
        <Confirm
          title="Log out of ClinicFlow?"
          body="You’ll return to the demo login screen. Your local demo records will remain available."
          action="Log out"
          onCancel={() => setLogoutOpen(false)}
          onConfirm={() => {
            sessionStorage.removeItem('clinicflow-auth');
            setAuth(false);
            setLogoutOpen(false);
            setPage('overview');
          }}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          ✓ {toast}
        </div>
      )}
    </>
  );
}

function Auth({
  screen,
  setScreen,
  onSuccess,
}: {
  screen: 'login' | 'forgot' | 'reset';
  setScreen: (value: 'login' | 'forgot' | 'reset') => void;
  onSuccess: () => void;
}) {
  const [email, setEmail] = useState('demo@clinicflow.example');
  const [password, setPassword] = useState('ClinicFlow123!');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (!email.includes('@')) return setError('Enter a valid email address.');
    if (screen === 'forgot') {
      setSent(true);
      return;
    }
    if (password.length < 8) return setError('Password must contain at least 8 characters.');
    if (screen === 'reset' && password !== confirm) return setError('Passwords do not match.');
    if (screen === 'reset') {
      setSent(true);
      window.setTimeout(() => setScreen('login'), 1200);
      return;
    }
    onSuccess();
  };
  return (
    <main className="auth-page">
      <section className="auth-brand">
        <div className="brand-mark">
          <img src="/assets/068f7.svg" alt="" />
        </div>
        <div className="auth-brand-copy">
          <span>ClinicFlow</span>
          <h1>One calm place for every clinic day.</h1>
          <p>
            Appointments, patients and AI receptionist activity stay organized for Dr. Priya Shah.
          </p>
        </div>
        <div className="demo-pill">Interactive client demo · No real credentials or messages</div>
      </section>
      <section className="auth-panel">
        <form className="auth-form" onSubmit={submit}>
          <button type="button" className="mobile-logo" onClick={() => setScreen('login')}>
            <span className="mini-mark">+</span> ClinicFlow
          </button>
          <div className="eyebrow">{screen === 'login' ? 'WELCOME BACK' : 'ACCOUNT RECOVERY'}</div>
          <h2>
            {screen === 'login'
              ? 'Sign in to ClinicFlow'
              : screen === 'forgot'
                ? 'Reset your password'
                : 'Choose a new password'}
          </h2>
          <p>
            {screen === 'login'
              ? 'Use the prefilled demo account or open Demo Access.'
              : screen === 'forgot'
                ? 'We’ll simulate sending a secure reset link.'
                : 'Enter a new demo password below.'}
          </p>
          {sent && (
            <div className="success-box">
              {screen === 'forgot'
                ? 'Simulated reset link sent. No email was actually delivered.'
                : 'Password reset successfully. Returning to login…'}
            </div>
          )}
          {screen !== 'reset' && (
            <Field label="Email address">
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                placeholder="you@clinic.com"
              />
            </Field>
          )}
          {screen !== 'forgot' && (
            <Field label="Password">
              <div className="password-wrap">
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type={show ? 'text' : 'password'}
                />
                <button type="button" onClick={() => setShow(!show)}>
                  {show ? 'Hide' : 'Show'}
                </button>
              </div>
            </Field>
          )}
          {screen === 'reset' && (
            <Field label="Confirm password">
              <input value={confirm} onChange={(e) => setConfirm(e.target.value)} type="password" />
            </Field>
          )}
          {error && <div className="error-box">{error}</div>}
          {screen === 'login' && (
            <div className="form-between">
              <label className="check">
                <input type="checkbox" defaultChecked /> Remember me
              </label>
              <button type="button" className="link" onClick={() => setScreen('forgot')}>
                Forgot password?
              </button>
            </div>
          )}
          <Button type="submit">
            {screen === 'login'
              ? 'Sign In'
              : screen === 'forgot'
                ? 'Send Reset Link'
                : 'Reset Password'}
          </Button>
          {screen === 'login' ? (
            <Button kind="secondary" onClick={onSuccess}>
              Demo Access
            </Button>
          ) : (
            <button type="button" className="back-link" onClick={() => setScreen('login')}>
              ← Back to Login
            </button>
          )}
          {screen === 'forgot' && sent && (
            <Button kind="secondary" onClick={() => setScreen('reset')}>
              Open simulated reset screen
            </Button>
          )}
        </form>
      </section>
    </main>
  );
}

function Shell({
  page,
  go,
  onNew,
  children,
  globalSearch,
  setGlobalSearch,
  setSearchOpen,
  setNotifyOpen,
  setProfileOpen,
  hidePageHeading = false,
}: {
  page: Page;
  go: (page: Page) => void;
  onNew: () => void;
  children: ReactNode;
  globalSearch: string;
  setGlobalSearch: (v: string) => void;
  setSearchOpen: (v: boolean) => void;
  setNotifyOpen: (v: boolean) => void;
  setProfileOpen: (v: boolean) => void;
  hidePageHeading?: boolean;
}) {
  const label =
    page === 'calendar'
      ? 'Calendar & Bookings'
      : nav.find((item) => item.page === page)?.label || 'ClinicFlow';
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="logo" onClick={() => go('overview')}>
          <span className="logo-mark">
            <img src="/assets/068f7.svg" alt="" />
          </span>
          <span>ClinicFlow</span>
        </button>
        <nav>
          {nav.map((item) => (
            <button
              key={item.page}
              className={page === item.page ? 'active' : ''}
              onClick={() => go(item.page)}
            >
              <img src={item.icon} alt="" />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>
      <div className="main">
        <header className="topbar">
          <div className="global-search">
            <img src="/assets/e1136.svg" alt="" />
            <input
              aria-label="Global search"
              placeholder="Search patients, appointments or calls…"
              value={globalSearch}
              onChange={(e) => {
                setGlobalSearch(e.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
            />
            <kbd>⌘K</kbd>
          </div>
          <div className="today">
            <span>Today</span>
            <strong>Monday, 19 May 2025</strong>
          </div>
          <Button onClick={onNew}>＋ New Appointment</Button>
          <button className="profile-trigger" onClick={() => setProfileOpen(true)}>
            <span className="avatar">PS</span>
            <span>
              <strong>Dr. Priya Shah</strong>
              <small>Clinic Owner</small>
            </span>
            <b>⌄</b>
          </button>
        </header>
        <main className={`page ${hidePageHeading ? 'overview-page' : ''}`}>
          {!hidePageHeading && (
            <div className="page-heading">
              <div>
                <button className="breadcrumb" onClick={() => go('overview')}>
                  Overview
                </button>
                <span> / {label}</span>
                <h1>{label}</h1>
              </div>
              {page === 'calendar' && <Button onClick={onNew}>＋ New Appointment</Button>}
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}

function Appointments({
  appointments,
  patients,
  services,
  onNew,
  onOpen,
}: {
  appointments: Appointment[];
  patients: Patient[];
  services: Service[];
  onNew: () => void;
  onOpen: (a: Appointment) => void;
}) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('All');
  const [date, setDate] = useState('');
  const filtered = appointments.filter(
    (item) =>
      (!query ||
        patients
          .find((p) => p.id === item.patientId)
          ?.name.toLowerCase()
          .includes(query.toLowerCase())) &&
      (status === 'All' || item.status === status) &&
      (!date || item.date === date),
  );
  return (
    <>
      <div className="toolbar">
        <div className="search-control">
          ⌕
          <input
            placeholder="Search patient or contact"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option>All</option>
          {['Confirmed', 'Pending', 'AI Booking', 'Cancelled', 'Reschedule Requested'].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
        <Button onClick={onNew}>＋ New Appointment</Button>
      </div>
      <Card>
        {filtered.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date & time</th>
                  <th>Patient</th>
                  <th>Service</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.date}</strong>
                      <small>{item.time}</small>
                    </td>
                    <td>{patients.find((p) => p.id === item.patientId)?.name}</td>
                    <td>{services.find((s) => s.id === item.serviceId)?.name}</td>
                    <td>
                      <Badge status={item.status} />
                    </td>
                    <td>
                      <Button kind="ghost" onClick={() => onOpen(item)}>
                        View details
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty />
        )}
      </Card>
      <div className="pagination">
        <span>
          Showing {filtered.length} of {appointments.length} appointments
        </span>
        <div>
          <button disabled>‹</button>
          <button className="active">1</button>
          <button disabled>›</button>
        </div>
      </div>
    </>
  );
}

function availableSlots(
  date: string,
  serviceId: number,
  services: Service[],
  appointments: Appointment[],
  working: { start: string; end: string; breakStart: string; breakEnd: string; days: number[] },
  editingId?: number,
) {
  if (!date || !serviceId || !working.days.includes(new Date(`${date}T12:00:00`).getDay()))
    return [];
  const duration = services.find((item) => item.id === serviceId)?.duration || 30;
  const toMinutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
  const fmt = (value: number) =>
    `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
  const slots: string[] = [];
  for (
    let start = toMinutes(working.start);
    start + duration <= toMinutes(working.end);
    start += 15
  ) {
    const end = start + duration;
    const inBreak = start < toMinutes(working.breakEnd) && end > toMinutes(working.breakStart);
    const conflict = appointments.some((item) => {
      if (item.id === editingId || item.date !== date || item.status === 'Cancelled') return false;
      const otherDuration = services.find((s) => s.id === item.serviceId)?.duration || 30;
      const otherStart = toMinutes(item.time);
      return start < otherStart + otherDuration && end > otherStart;
    });
    if (!inBreak && !conflict) slots.push(fmt(start));
  }
  return slots;
}

function AppointmentForm({
  edit,
  initialPatient,
  initialDate,
  patients,
  services,
  appointments,
  working,
  onClose,
  onSave,
  onAddPatient,
}: {
  edit?: Appointment;
  initialPatient?: number;
  initialDate?: string;
  patients: Patient[];
  services: Service[];
  appointments: Appointment[];
  working: { start: string; end: string; breakStart: string; breakEnd: string; days: number[] };
  onClose: () => void;
  onSave: (a: Appointment) => void;
  onAddPatient: (p: Patient) => void;
}) {
  const [step, setStep] = useState(edit ? 1 : 1);
  const [patientId, setPatientId] = useState(edit?.patientId || initialPatient || 0);
  const [serviceId, setServiceId] = useState(edit?.serviceId || 0);
  const [date, setDate] = useState(edit?.date || initialDate || '2025-05-21');
  const [time, setTime] = useState(edit?.time || '');
  const [notes, setNotes] = useState(edit?.notes || '');
  const [error, setError] = useState('');
  const [addPatient, setAddPatient] = useState(false);
  const slots = availableSlots(date, serviceId, services, appointments, working, edit?.id);
  const next = () => {
    if (step === 1 && !patientId) return setError('Select a patient to continue.');
    if (step === 2 && !serviceId) return setError('Select an active service.');
    if (step === 3 && (!date || !time)) return setError('Choose an available date and time.');
    setError('');
    setStep((value) => Math.min(4, value + 1));
  };
  const save = () =>
    onSave({
      id: edit?.id || Date.now(),
      patientId,
      serviceId,
      date,
      time,
      notes,
      status: edit?.status || 'Confirmed',
      source: edit?.source || 'Clinic demo',
    });
  return (
    <div className="modal-backdrop">
      <div className="modal booking-modal">
        <div className="modal-head">
          <div>
            <span className="eyebrow">{edit ? 'EDIT APPOINTMENT' : 'NEW APPOINTMENT'}</span>
            <h2>{edit ? 'Update appointment' : 'Book with Dr. Priya Shah'}</h2>
          </div>
          <button className="close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="steps">
          {['Patient', 'Service', 'Date & time', 'Review'].map((label, index) => (
            <div className={step >= index + 1 ? 'active' : ''} key={label}>
              <b>{index + 1}</b>
              <span>{label}</span>
            </div>
          ))}
        </div>
        <div className="modal-body">
          {step === 1 && (
            <>
              <Field label="Select patient">
                <select value={patientId} onChange={(e) => setPatientId(Number(e.target.value))}>
                  <option value={0}>Choose a patient</option>
                  {patients.map((item) => (
                    <option value={item.id} key={item.id}>
                      {item.name} · {item.phone}
                    </option>
                  ))}
                </select>
              </Field>
              <button className="add-inline" onClick={() => setAddPatient(true)}>
                ＋ Add a new patient
              </button>
              {addPatient && (
                <QuickPatient
                  onSave={(item) => {
                    onAddPatient(item);
                    setPatientId(item.id);
                    setAddPatient(false);
                  }}
                />
              )}
            </>
          )}
          {step === 2 && (
            <div className="option-grid">
              {services
                .filter((item) => item.active)
                .map((item) => (
                  <button
                    className={`option-card ${serviceId === item.id ? 'selected' : ''}`}
                    key={item.id}
                    onClick={() => setServiceId(item.id)}
                  >
                    <strong>{item.name}</strong>
                    <span>{item.description}</span>
                    <small>
                      {item.duration} min · ${item.price} sample price
                    </small>
                  </button>
                ))}
            </div>
          )}
          {step === 3 && (
            <>
              <Field label="Appointment date">
                <input
                  type="date"
                  value={date}
                  onChange={(e) => {
                    setDate(e.target.value);
                    setTime('');
                  }}
                />
              </Field>
              <Field
                label="Available time slots"
                hint="Calculated from Dr. Priya Shah’s hours, breaks, service duration, and existing bookings."
              >
                <div className="slot-grid">
                  {slots.length ? (
                    slots.map((item) => (
                      <button
                        className={time === item ? 'selected' : ''}
                        key={item}
                        onClick={() => setTime(item)}
                      >
                        {item}
                      </button>
                    ))
                  ) : (
                    <span className="no-slots">No available slots for this date and service.</span>
                  )}
                </div>
              </Field>
              <Field label="Notes (optional)">
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add helpful appointment notes"
                />
              </Field>
            </>
          )}
          {step === 4 && (
            <div className="review-card">
              <div className="review-icon">✓</div>
              <h3>Review booking details</h3>
              <dl>
                <div>
                  <dt>Patient</dt>
                  <dd>{patients.find((p) => p.id === patientId)?.name}</dd>
                </div>
                <div>
                  <dt>Service</dt>
                  <dd>{services.find((s) => s.id === serviceId)?.name}</dd>
                </div>
                <div>
                  <dt>Date & time</dt>
                  <dd>
                    {date} at {time}
                  </dd>
                </div>
                <div>
                  <dt>Assigned doctor</dt>
                  <dd>Dr. Priya Shah</dd>
                </div>
                <div>
                  <dt>Duration</dt>
                  <dd>{services.find((s) => s.id === serviceId)?.duration} minutes</dd>
                </div>
              </dl>
            </div>
          )}
          {error && <div className="error-box">{error}</div>}
        </div>
        <div className="modal-actions">
          <Button kind="secondary" onClick={step === 1 ? onClose : () => setStep(step - 1)}>
            {step === 1 ? 'Cancel' : 'Back'}
          </Button>
          {step < 4 ? (
            <Button onClick={next}>Continue</Button>
          ) : (
            <Button onClick={save}>Confirm appointment</Button>
          )}
        </div>
      </div>
    </div>
  );
}

function QuickPatient({ onSave }: { onSave: (item: Patient) => void }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  return (
    <div className="quick-add">
      <Field label="Full name">
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Phone">
        <input value={phone} onChange={(e) => setPhone(e.target.value)} />
      </Field>
      <Button
        disabled={!name || !phone}
        onClick={() => onSave({ id: Date.now(), name, phone, email: '', dob: '', notes: '' })}
      >
        Save patient
      </Button>
    </div>
  );
}

function AppointmentDetails({
  item,
  patient,
  service,
  onClose,
  onEdit,
  onStatus,
}: {
  item: Appointment;
  patient: Patient;
  service: Service;
  onClose: () => void;
  onEdit: () => void;
  onStatus: (s: Status) => void;
}) {
  const [cancel, setCancel] = useState(false);
  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <span className="eyebrow">APPOINTMENT DETAILS</span>
            <h2>{patient.name}</h2>
          </div>
          <button className="close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="appointment-hero">
          <div className="date-tile">
            <strong>{item.date.slice(-2)}</strong>
            <span>MAY</span>
          </div>
          <div>
            <h3>{service.name}</h3>
            <p>
              {item.date} · {item.time}
            </p>
            <Badge status={item.status} />
          </div>
        </div>
        <dl className="details-list">
          <div>
            <dt>Patient contact</dt>
            <dd>
              {patient.phone}
              <br />
              {patient.email}
            </dd>
          </div>
          <div>
            <dt>Assigned doctor</dt>
            <dd>Dr. Priya Shah</dd>
          </div>
          <div>
            <dt>Duration</dt>
            <dd>{service.duration} minutes</dd>
          </div>
          <div>
            <dt>Booking source</dt>
            <dd>{item.source}</dd>
          </div>
          <div>
            <dt>Notes</dt>
            <dd>{item.notes || 'No notes added.'}</dd>
          </div>
        </dl>
        <div className="drawer-actions">
          {item.status === 'Pending' && (
            <Button onClick={() => onStatus('Confirmed')}>Confirm request</Button>
          )}
          <Button kind="secondary" onClick={onEdit}>
            Edit or reschedule
          </Button>
          {item.status !== 'Cancelled' && (
            <Button kind="danger" onClick={() => setCancel(true)}>
              Cancel appointment
            </Button>
          )}
        </div>
        {cancel && (
          <div className="inline-confirm">
            <strong>Cancel this appointment?</strong>
            <p>The record will remain in history and its reminder will be cancelled.</p>
            <div>
              <Button kind="secondary" onClick={() => setCancel(false)}>
                Keep appointment
              </Button>
              <Button
                kind="danger"
                onClick={() => {
                  onStatus('Cancelled');
                  setCancel(false);
                }}
              >
                Confirm cancellation
              </Button>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

function Calendar({
  appointments,
  patients,
  services,
  working,
  onNew,
  onOpen,
}: {
  appointments: Appointment[];
  patients: Patient[];
  services: Service[];
  working: { start: string; end: string; breakStart: string; breakEnd: string; days: number[] };
  onNew: (date: string) => void;
  onOpen: (a: Appointment) => void;
}) {
  const [view, setView] = useState('Month');
  const [selected, setSelected] = useState('2025-05-19');
  const days = Array.from({ length: 35 }, (_, i) => {
    const day = i - 3;
    return day > 0 && day <= 31 ? `2025-05-${String(day).padStart(2, '0')}` : '';
  });
  const visible = appointments.filter((item) => item.status !== 'Cancelled');
  return (
    <>
      <Card className="calendar-toolbar">
        <div>
          <Button kind="secondary">‹</Button>
          <Button kind="secondary">Today</Button>
          <Button kind="secondary">›</Button>
          <strong>May 2025</strong>
        </div>
        <div className="segmented">
          {['Month', 'Week', 'Day', 'List'].map((item) => (
            <button
              className={view === item ? 'active' : ''}
              onClick={() => setView(item)}
              key={item}
            >
              {item}
            </button>
          ))}
        </div>
      </Card>
      {view === 'Month' ? (
        <div className="calendar-layout">
          <Card className="full-calendar">
            <div className="weekdays">
              {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>
            <div className="month-grid">
              {days.map((date, index) => (
                <button
                  key={index}
                  disabled={!date}
                  className={selected === date ? 'selected' : ''}
                  onClick={() => date && setSelected(date)}
                >
                  <span>{date ? Number(date.slice(-2)) : ''}</span>
                  {visible
                    .filter((a) => a.date === date)
                    .map((a) => (
                      <i className={a.status.toLowerCase().replaceAll(' ', '-')} key={a.id} />
                    ))}
                </button>
              ))}
            </div>
          </Card>
          <Card className="agenda">
            <div className="card-title">
              <div>
                <span className="eyebrow">SELECTED DAY</span>
                <h2>{selected}</h2>
              </div>
              <Button onClick={() => onNew(selected)}>＋ Book</Button>
            </div>
            {visible.filter((a) => a.date === selected).length ? (
              visible
                .filter((a) => a.date === selected)
                .map((a) => (
                  <button className="agenda-item" onClick={() => onOpen(a)} key={a.id}>
                    <span>{a.time}</span>
                    <div>
                      <strong>{patients.find((p) => p.id === a.patientId)?.name}</strong>
                      <small>{services.find((s) => s.id === a.serviceId)?.name}</small>
                    </div>
                    <Badge status={a.status} />
                  </button>
                ))
            ) : (
              <Empty title="No appointments" body="This day is clear and ready for bookings." />
            )}
          </Card>
        </div>
      ) : view === 'List' ? (
        <Appointments
          appointments={visible}
          patients={patients}
          services={services}
          onNew={() => onNew(selected)}
          onOpen={onOpen}
        />
      ) : (
        <Card className="time-calendar">
          <div className="time-head">
            <strong>{view === 'Week' ? 'Week of 19 May 2025' : selected}</strong>
            <span>
              Dr. Priya Shah · {working.start}–{working.end}
            </span>
          </div>
          {Array.from({ length: 9 }, (_, i) => `${String(i + 9).padStart(2, '0')}:00`).map(
            (time) => (
              <div className="time-row" key={time}>
                <span>{time}</span>
                <div>
                  {visible
                    .filter(
                      (a) =>
                        a.time.startsWith(time.slice(0, 2)) &&
                        (view === 'Week' || a.date === selected),
                    )
                    .map((a) => (
                      <button onClick={() => onOpen(a)} key={a.id}>
                        <strong>
                          {a.time} · {patients.find((p) => p.id === a.patientId)?.name}
                        </strong>
                        <small>{services.find((s) => s.id === a.serviceId)?.name}</small>
                      </button>
                    ))}
                </div>
              </div>
            ),
          )}
        </Card>
      )}
    </>
  );
}

function Patients({
  patients,
  appointments,
  followups,
  setFollowups,
  toast,
  onSave,
  onBook,
}: {
  patients: Patient[];
  appointments: Appointment[];
  followups: Followup[];
  setFollowups: (items: Followup[]) => void;
  toast: (message: string) => void;
  onSave: (p: Patient) => void;
  onBook: (id: number) => void;
}) {
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Patient | null>(null);
  const [selected, setSelected] = useState<Patient | null>(null);
  const list = patients.filter((item) =>
    `${item.name} ${item.phone} ${item.email}`.toLowerCase().includes(query.toLowerCase()),
  );
  if (selected)
    return (
      <PatientProfile
        patient={selected}
        appointments={appointments}
        followups={followups}
        setFollowups={setFollowups}
        toast={toast}
        onBack={() => setSelected(null)}
        onBook={() => onBook(selected.id)}
      />
    );
  return (
    <>
      <div className="toolbar">
        <div className="search-control">
          ⌕
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name or contact"
          />
        </div>
        <Button
          onClick={() =>
            setEditing({ id: Date.now(), name: '', phone: '', email: '', dob: '', notes: '' })
          }
        >
          ＋ Add Patient
        </Button>
      </div>
      <Card>
        {list.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Contact</th>
                  <th>Last appointment</th>
                  <th>Next appointment</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.map((item) => {
                  const history = appointments.filter((a) => a.patientId === item.id);
                  return (
                    <tr key={item.id}>
                      <td>
                        <button className="person-cell" onClick={() => setSelected(item)}>
                          <span className="avatar">
                            {item.name
                              .split(' ')
                              .map((x) => x[0])
                              .join('')}
                          </span>
                          <strong>{item.name}</strong>
                        </button>
                      </td>
                      <td>
                        {item.phone}
                        <small>{item.email}</small>
                      </td>
                      <td>{history.at(0)?.date || '—'}</td>
                      <td>{history.find((a) => a.status !== 'Cancelled')?.date || '—'}</td>
                      <td>
                        <Button kind="ghost" onClick={() => setSelected(item)}>
                          View profile
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty />
        )}
      </Card>
      {editing && (
        <PatientEditor
          value={editing}
          onClose={() => setEditing(null)}
          onSave={(value) => {
            onSave(value);
            setEditing(null);
          }}
        />
      )}
    </>
  );
}
function PatientEditor({
  value,
  onClose,
  onSave,
}: {
  value: Patient;
  onClose: () => void;
  onSave: (p: Patient) => void;
}) {
  const [data, setData] = useState(value);
  return (
    <div className="modal-backdrop">
      <form
        className="modal small-modal"
        onSubmit={(e) => {
          e.preventDefault();
          if (data.name && data.phone) onSave(data);
        }}
      >
        <div className="modal-head">
          <h2>{value.name ? 'Edit patient' : 'Add patient'}</h2>
          <button className="close" type="button" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="modal-body form-grid">
          <Field label="Full name">
            <input
              required
              value={data.name}
              onChange={(e) => setData({ ...data, name: e.target.value })}
            />
          </Field>
          <Field label="Phone number">
            <input
              required
              value={data.phone}
              onChange={(e) => setData({ ...data, phone: e.target.value })}
            />
          </Field>
          <Field label="Email">
            <input
              type="email"
              value={data.email}
              onChange={(e) => setData({ ...data, email: e.target.value })}
            />
          </Field>
          <Field label="Date of birth">
            <input
              type="date"
              value={data.dob}
              onChange={(e) => setData({ ...data, dob: e.target.value })}
            />
          </Field>
          <Field label="Relevant notes">
            <textarea
              value={data.notes}
              onChange={(e) => setData({ ...data, notes: e.target.value })}
            />
          </Field>
        </div>
        <div className="modal-actions">
          <Button kind="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Save patient</Button>
        </div>
      </form>
    </div>
  );
}
function PatientProfile({
  patient,
  appointments,
  followups,
  setFollowups,
  toast,
  onBack,
  onBook,
}: {
  patient: Patient;
  appointments: Appointment[];
  followups: Followup[];
  setFollowups: (items: Followup[]) => void;
  toast: (message: string) => void;
  onBack: () => void;
  onBook: () => void;
}) {
  const history = appointments.filter((item) => item.patientId === patient.id);
  const patientFollowups = followups.filter((item) => item.patientId === patient.id);
  const [editingFollowup, setEditingFollowup] = useState<Followup | null>(null);
  const saveFollowup = (item: Followup) => {
    setFollowups(
      followups.some((current) => current.id === item.id)
        ? followups.map((current) => (current.id === item.id ? item : current))
        : [...followups, item],
    );
    setEditingFollowup(null);
    toast('Patient follow-up saved.');
  };
  const toggleFollowup = (item: Followup) => {
    const status = item.status === 'Completed' ? 'Pending' : 'Completed';
    setFollowups(
      followups.map((current) => (current.id === item.id ? { ...current, status } : current)),
    );
    toast(status === 'Completed' ? 'Follow-up completed.' : 'Follow-up reopened.');
  };
  return (
    <>
      <button className="back-link" onClick={onBack}>
        ← Back to patients
      </button>
      <div className="profile-layout">
        <Card className="patient-summary">
          <div className="avatar xlarge">
            {patient.name
              .split(' ')
              .map((x) => x[0])
              .join('')}
          </div>
          <h2>{patient.name}</h2>
          <span>Patient #{patient.id}</span>
          <Button onClick={onBook}>＋ Create appointment</Button>
          <hr />
          <dl>
            <div>
              <dt>Phone</dt>
              <dd>{patient.phone}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{patient.email || 'Not provided'}</dd>
            </div>
            <div>
              <dt>Date of birth</dt>
              <dd>{patient.dob || 'Not provided'}</dd>
            </div>
          </dl>
        </Card>
        <Card>
          <div className="card-title">
            <div>
              <h2>Appointment history</h2>
              <p>Appointments with Dr. Priya Shah</p>
            </div>
          </div>
          {history.length ? (
            history.map((a) => (
              <div className="history-row" key={a.id}>
                <div>
                  <strong>
                    {a.date} at {a.time}
                  </strong>
                  <span>Dr. Priya Shah</span>
                </div>
                <Badge status={a.status} />
              </div>
            ))
          ) : (
            <Empty title="No appointment history" />
          )}
        </Card>
        <Card className="patient-followups">
          <div className="card-title">
            <div>
              <h2>Follow-ups</h2>
              <p>Tasks linked only to {patient.name}</p>
            </div>
            <Button
              onClick={() =>
                setEditingFollowup({
                  id: Date.now(),
                  title: '',
                  patientId: patient.id,
                  due: '2025-05-21',
                  priority: 'Medium',
                  status: 'Pending',
                })
              }
            >
              ＋ Create Follow-up
            </Button>
          </div>
          {patientFollowups.length ? (
            <div className="task-list">
              {patientFollowups.map((item) => (
                <div className="task patient-task" key={item.id}>
                  <button
                    className={`task-check ${item.status === 'Completed' ? 'done' : ''}`}
                    onClick={() => toggleFollowup(item)}
                    aria-label={
                      item.status === 'Completed' ? 'Reopen follow-up' : 'Complete follow-up'
                    }
                  >
                    {item.status === 'Completed' ? '✓' : ''}
                  </button>
                  <div>
                    <strong>{item.title}</strong>
                    <span>Due {item.due}</span>
                  </div>
                  <Badge status={item.priority} />
                  <Badge status={item.status} />
                  <Button kind="ghost" onClick={() => setEditingFollowup(item)}>
                    Edit
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <Empty
              title="No follow-ups for this patient"
              body="Create a task to keep patient-specific follow-up work organized."
            />
          )}
        </Card>
        <Card className="notes-card">
          <h2>Notes</h2>
          <p>{patient.notes || 'No patient notes have been added.'}</p>
        </Card>
      </div>
      {editingFollowup && (
        <PatientFollowupEditor
          item={editingFollowup}
          patientName={patient.name}
          onClose={() => setEditingFollowup(null)}
          onSave={saveFollowup}
        />
      )}
    </>
  );
}

function PatientFollowupEditor({
  item,
  patientName,
  onClose,
  onSave,
}: {
  item: Followup;
  patientName: string;
  onClose: () => void;
  onSave: (item: Followup) => void;
}) {
  const [data, setData] = useState(item);
  return (
    <div className="modal-backdrop">
      <form
        className="modal small-modal"
        onSubmit={(event) => {
          event.preventDefault();
          if (data.title) onSave(data);
        }}
      >
        <div className="modal-head">
          <div>
            <span className="eyebrow">PATIENT FOLLOW-UP</span>
            <h2>{item.title ? 'Edit follow-up' : 'Create follow-up'}</h2>
          </div>
          <button className="close" type="button" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="modal-body form-grid">
          <Field label="Patient">
            <input value={patientName} disabled />
          </Field>
          <Field label="Task title">
            <input
              required
              value={data.title}
              onChange={(event) => setData({ ...data, title: event.target.value })}
            />
          </Field>
          <div className="form-grid two">
            <Field label="Due date">
              <input
                type="date"
                value={data.due}
                onChange={(event) => setData({ ...data, due: event.target.value })}
              />
            </Field>
            <Field label="Priority">
              <select
                value={data.priority}
                onChange={(event) => setData({ ...data, priority: event.target.value })}
              >
                <option>Low</option>
                <option>Medium</option>
                <option>High</option>
              </select>
            </Field>
          </div>
        </div>
        <div className="modal-actions">
          <Button kind="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Save follow-up</Button>
        </div>
      </form>
    </div>
  );
}

function Staff({
  working,
  setWorking,
  services,
}: {
  working: { start: string; end: string; breakStart: string; breakEnd: string; days: number[] };
  setWorking: (v: typeof working) => void;
  services: Service[];
}) {
  const [draft, setDraft] = useState(working);
  return (
    <div className="two-column">
      <Card className="doctor-profile">
        <div className="doctor-cover" />
        <div className="doctor-main">
          <div className="avatar xlarge">PS</div>
          <div>
            <span className="eyebrow">CLINIC DOCTOR</span>
            <h2>Dr. Priya Shah</h2>
            <p>Primary Care Physician · Clinic Owner</p>
          </div>
        </div>
        <dl className="details-list">
          <div>
            <dt>Email</dt>
            <dd>priya@clinicflow.example</dd>
          </div>
          <div>
            <dt>Phone</dt>
            <dd>(415) 555-0100</dd>
          </div>
          <div>
            <dt>Services offered</dt>
            <dd>
              {services
                .filter((s) => s.active)
                .map((s) => s.name)
                .join(', ')}
            </dd>
          </div>
        </dl>
        <div className="info-box">
          ClinicFlow is configured for one doctor. All appointments are automatically assigned to
          Dr. Priya Shah.
        </div>
      </Card>
      <Card>
        <div className="card-title">
          <div>
            <h2>Working hours & availability</h2>
            <p>Changes affect all calculated booking slots.</p>
          </div>
        </div>
        <div className="day-picker">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, i) => (
            <button
              className={draft.days.includes(i) ? 'active' : ''}
              onClick={() =>
                setDraft({
                  ...draft,
                  days: draft.days.includes(i)
                    ? draft.days.filter((d) => d !== i)
                    : [...draft.days, i],
                })
              }
              key={day}
            >
              {day}
            </button>
          ))}
        </div>
        <div className="form-grid two">
          <Field label="Day starts">
            <input
              type="time"
              value={draft.start}
              onChange={(e) => setDraft({ ...draft, start: e.target.value })}
            />
          </Field>
          <Field label="Day ends">
            <input
              type="time"
              value={draft.end}
              onChange={(e) => setDraft({ ...draft, end: e.target.value })}
            />
          </Field>
          <Field label="Break starts">
            <input
              type="time"
              value={draft.breakStart}
              onChange={(e) => setDraft({ ...draft, breakStart: e.target.value })}
            />
          </Field>
          <Field label="Break ends">
            <input
              type="time"
              value={draft.breakEnd}
              onChange={(e) => setDraft({ ...draft, breakEnd: e.target.value })}
            />
          </Field>
        </div>
        <div className="card-actions">
          <Button kind="secondary" onClick={() => setDraft(working)}>
            Cancel
          </Button>
          <Button onClick={() => setWorking(draft)}>Save availability</Button>
        </div>
        <hr />
        <h3>Clinic staff</h3>
        <div className="staff-row">
          <span className="avatar">AM</span>
          <div>
            <strong>Alex Morgan</strong>
            <small>Clinic Coordinator · Non-doctor staff</small>
          </div>
          <Badge status="Active" />
        </div>
      </Card>
    </div>
  );
}

function Services({
  services,
  setServices,
  toast,
}: {
  services: Service[];
  setServices: (v: Service[]) => void;
  toast: (v: string) => void;
}) {
  const [edit, setEdit] = useState<Service | null>(null);
  return (
    <>
      <div className="toolbar">
        <div>
          <strong>Sample clinic services</strong>
          <span className="toolbar-note">Prices are fictional demo values.</span>
        </div>
        <Button
          onClick={() =>
            setEdit({
              id: Date.now(),
              name: '',
              description: '',
              duration: 30,
              price: 0,
              active: true,
            })
          }
        >
          ＋ Add Service
        </Button>
      </div>
      <div className="service-grid">
        {services.map((item) => (
          <Card key={item.id} className="service-card">
            <div className="service-icon">＋</div>
            <Badge status={item.active ? 'Active' : 'Inactive'} />
            <h2>{item.name}</h2>
            <p>{item.description}</p>
            <div className="service-meta">
              <span>
                <small>Duration</small>
                <strong>{item.duration} min</strong>
              </span>
              <span>
                <small>Sample price</small>
                <strong>${item.price}</strong>
              </span>
            </div>
            <div className="card-actions">
              <Button kind="secondary" onClick={() => setEdit(item)}>
                Edit details
              </Button>
              <Button
                kind="ghost"
                onClick={() => {
                  setServices(
                    services.map((s) => (s.id === item.id ? { ...s, active: !s.active } : s)),
                  );
                  toast(`${item.name} ${item.active ? 'deactivated' : 'activated'}.`);
                }}
              >
                {item.active ? 'Deactivate' : 'Activate'}
              </Button>
            </div>
          </Card>
        ))}
      </div>
      {edit && (
        <ServiceEditor
          item={edit}
          onClose={() => setEdit(null)}
          onSave={(value) => {
            setServices(
              services.some((s) => s.id === value.id)
                ? services.map((s) => (s.id === value.id ? value : s))
                : [...services, value],
            );
            setEdit(null);
            toast('Service saved. Future booking options are updated.');
          }}
        />
      )}
    </>
  );
}
function ServiceEditor({
  item,
  onClose,
  onSave,
}: {
  item: Service;
  onClose: () => void;
  onSave: (v: Service) => void;
}) {
  const [data, setData] = useState(item);
  return (
    <div className="modal-backdrop">
      <form
        className="modal small-modal"
        onSubmit={(e) => {
          e.preventDefault();
          onSave(data);
        }}
      >
        <div className="modal-head">
          <h2>{item.name ? 'Edit service' : 'Add service'}</h2>
          <button type="button" className="close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="modal-body form-grid">
          <Field label="Service name">
            <input
              required
              value={data.name}
              onChange={(e) => setData({ ...data, name: e.target.value })}
            />
          </Field>
          <Field label="Description">
            <textarea
              value={data.description}
              onChange={(e) => setData({ ...data, description: e.target.value })}
            />
          </Field>
          <div className="form-grid two">
            <Field label="Duration (minutes)">
              <input
                type="number"
                min="15"
                step="15"
                value={data.duration}
                onChange={(e) => setData({ ...data, duration: Number(e.target.value) })}
              />
            </Field>
            <Field label="Sample price">
              <input
                type="number"
                min="0"
                value={data.price}
                onChange={(e) => setData({ ...data, price: Number(e.target.value) })}
              />
            </Field>
          </div>
        </div>
        <div className="modal-actions">
          <Button kind="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Save service</Button>
        </div>
      </form>
    </div>
  );
}

function Calls({
  onAppointment,
  onFollowup,
}: {
  onAppointment: (id: number) => void;
  onFollowup: (caller: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<(typeof calls)[number] | null>(null);
  const [reviewed, setReviewed] = useState<number[]>(
    calls.filter((c) => c.reviewed).map((c) => c.id),
  );
  const filtered = calls.filter((c) =>
    `${c.caller} ${c.type} ${c.outcome}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      <div className="demo-notice">
        AI call records and summaries are fictional. No live call, recording, or phone integration
        exists in this prototype.
      </div>
      <div className="toolbar">
        <div className="search-control">
          ⌕
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search caller or outcome"
          />
        </div>
        <input type="date" />
        <select>
          <option>All call types</option>
          <option>New patient</option>
          <option>Reschedule</option>
          <option>Cancellation</option>
        </select>
        <select>
          <option>All outcomes</option>
          <option>Booked</option>
          <option>Updated</option>
          <option>Follow-up</option>
        </select>
      </div>
      <Card>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Time & date</th>
                <th>Caller</th>
                <th>Call type</th>
                <th>Outcome</th>
                <th>Duration</th>
                <th>Review</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((call) => (
                <tr key={call.id}>
                  <td>{call.when}</td>
                  <td>
                    <strong>{call.caller}</strong>
                  </td>
                  <td>{call.type}</td>
                  <td>
                    <Badge status={call.outcome} />
                  </td>
                  <td>{call.duration}</td>
                  <td>{reviewed.includes(call.id) ? 'Reviewed' : 'Needs review'}</td>
                  <td>
                    <Button kind="ghost" onClick={() => setSelected(call)}>
                      Open details
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      {selected && (
        <div className="drawer-backdrop" onClick={() => setSelected(null)}>
          <aside className="drawer" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <span className="eyebrow">AI CALL DETAILS</span>
                <h2>{selected.caller}</h2>
              </div>
              <button className="close" onClick={() => setSelected(null)}>
                ×
              </button>
            </div>
            <div className="call-summary">
              <Badge status={selected.outcome} />
              <h3>Conversation summary</h3>
              <p>{selected.summary}</p>
              <small>Fictional summary generated for this client demo.</small>
            </div>
            <dl className="details-list">
              <div>
                <dt>Timestamp</dt>
                <dd>{selected.when}</dd>
              </div>
              <div>
                <dt>Duration</dt>
                <dd>{selected.duration}</dd>
              </div>
              <div>
                <dt>Call type</dt>
                <dd>{selected.type}</dd>
              </div>
              <div>
                <dt>Required action</dt>
                <dd>{selected.outcome === 'Follow-up' ? 'Clinic follow-up' : 'Review details'}</dd>
              </div>
            </dl>
            <div className="drawer-actions">
              {selected.appointmentId > 0 && (
                <Button onClick={() => onAppointment(selected.appointmentId)}>
                  View related appointment
                </Button>
              )}
              <Button
                kind="secondary"
                onClick={() => {
                  onFollowup(selected.caller);
                  setSelected(null);
                }}
              >
                Create follow-up
              </Button>
              <Button kind="ghost" onClick={() => setReviewed([...reviewed, selected.id])}>
                Mark as reviewed
              </Button>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}

function Followups({
  items,
  setItems,
  patients,
  toast,
}: {
  items: Followup[];
  setItems: (v: Followup[]) => void;
  patients: Patient[];
  toast: (v: string) => void;
}) {
  const [status, setStatus] = useState('All');
  const [create, setCreate] = useState(false);
  const list = items.filter((item) => status === 'All' || item.status === status);
  return (
    <>
      <div className="toolbar">
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option>All</option>
          <option>Pending</option>
          <option>Completed</option>
          <option>Overdue</option>
          <option>Cancelled</option>
        </select>
        <input type="date" />
        <Button onClick={() => setCreate(true)}>＋ Create Follow-up</Button>
      </div>
      <Card>
        {list.length ? (
          <div className="task-list">
            {list.map((item) => (
              <div className="task" key={item.id}>
                <button
                  className={`task-check ${item.status === 'Completed' ? 'done' : ''}`}
                  onClick={() => {
                    setItems(
                      items.map((x) =>
                        x.id === item.id
                          ? { ...x, status: x.status === 'Completed' ? 'Pending' : 'Completed' }
                          : x,
                      ),
                    );
                    toast(
                      item.status === 'Completed' ? 'Follow-up reopened.' : 'Follow-up completed.',
                    );
                  }}
                >
                  {item.status === 'Completed' ? '✓' : ''}
                </button>
                <div>
                  <strong>{item.title}</strong>
                  <span>
                    {patients.find((p) => p.id === item.patientId)?.name} · Due {item.due}
                  </span>
                </div>
                <Badge status={item.priority} />
                <Badge status={item.status} />
                <Button
                  kind="ghost"
                  onClick={() =>
                    setItems(items.map((x) => (x.id === item.id ? { ...x, due: '2025-05-22' } : x)))
                  }
                >
                  Edit
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <Empty title="No follow-ups" />
        )}
      </Card>
      {create && (
        <QuickFollowup
          patients={patients}
          onClose={() => setCreate(false)}
          onSave={(item) => {
            setItems([...items, item]);
            setCreate(false);
            toast('Follow-up created.');
          }}
        />
      )}
    </>
  );
}
function QuickFollowup({
  patients,
  onClose,
  onSave,
}: {
  patients: Patient[];
  onClose: () => void;
  onSave: (x: Followup) => void;
}) {
  const [title, setTitle] = useState('');
  const [patientId, setPatientId] = useState(patients[0].id);
  const [due, setDue] = useState('2025-05-21');
  return (
    <div className="modal-backdrop">
      <div className="modal small-modal">
        <div className="modal-head">
          <h2>Create follow-up</h2>
          <button className="close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="modal-body form-grid">
          <Field label="Task title">
            <input value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="Patient">
            <select value={patientId} onChange={(e) => setPatientId(Number(e.target.value))}>
              {patients.map((p) => (
                <option value={p.id} key={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Due date">
            <input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          </Field>
        </div>
        <div className="modal-actions">
          <Button kind="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!title}
            onClick={() =>
              onSave({
                id: Date.now(),
                title,
                patientId,
                due,
                priority: 'Medium',
                status: 'Pending',
              })
            }
          >
            Create task
          </Button>
        </div>
      </div>
    </div>
  );
}

function Reminders({
  items,
  setItems,
  appointments,
  patients,
  toast,
}: {
  items: Reminder[];
  setItems: (v: Reminder[]) => void;
  appointments: Appointment[];
  patients: Patient[];
  toast: (v: string) => void;
}) {
  return (
    <>
      <div className="demo-notice">
        Reminder delivery is simulated. No SMS, email, or phone message is sent.
      </div>
      <Card>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Related appointment</th>
                <th>Patient</th>
                <th>Scheduled time</th>
                <th>Type</th>
                <th>Delivery status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const a = appointments.find((x) => x.id === item.appointmentId);
                return (
                  <tr key={item.id}>
                    <td>{a ? `${a.date} · ${a.time}` : 'Historical appointment'}</td>
                    <td>{a ? patients.find((p) => p.id === a.patientId)?.name : '—'}</td>
                    <td>{item.scheduled}</td>
                    <td>{item.type}</td>
                    <td>
                      <Badge status={item.status} selectedFontSize={[1, 2, 3].includes(item.id)} />
                    </td>
                    <td>
                      {item.status === 'Failed' ? (
                        <Button
                          kind="secondary"
                          onClick={() => {
                            setItems(
                              items.map((x) =>
                                x.id === item.id ? { ...x, status: 'Sent (simulated)' } : x,
                              ),
                            );
                            toast('Reminder retry marked sent in demo mode.');
                          }}
                        >
                          Retry
                        </Button>
                      ) : (
                        <Button
                          kind="ghost"
                          onClick={() => {
                            setItems(
                              items.map((x) =>
                                x.id === item.id ? { ...x, status: 'Cancelled' } : x,
                              ),
                            );
                            toast('Reminder cancelled.');
                          }}
                        >
                          Cancel
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

function Reports({
  appointments,
  services,
  period,
  setPeriod,
}: {
  appointments: Appointment[];
  services: Service[];
  period: string;
  setPeriod: (v: string) => void;
}) {
  const active = appointments.filter((a) => a.status !== 'Cancelled');
  const confirmed = active.filter(
    (a) => a.status === 'Confirmed' || a.status === 'AI Booking',
  ).length;
  const estimated = active.reduce(
    (sum, a) => sum + (services.find((s) => s.id === a.serviceId)?.price || 0),
    0,
  );
  return (
    <>
      <div className="toolbar">
        <div>
          <strong>Performance overview</strong>
          <span className="toolbar-note">Metrics use shared fictional demo data.</span>
        </div>
        <select value={period} onChange={(e) => setPeriod(e.target.value)}>
          {[
            'Today',
            'Last 7 days',
            'Last 30 days',
            'This month',
            'Last month',
            'Custom date range',
          ].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
        <Button kind="secondary">Export demo summary</Button>
      </div>
      <div className="metric-grid">
        <Metric label="Call volume" value={String(calls.length)} change="+12.4%" />
        <Metric
          label="AI bookings"
          value={String(active.filter((a) => a.source === 'AI Receptionist').length)}
          change="+18.2%"
        />
        <Metric
          label="Confirmed appointments"
          value={String(confirmed)}
          change={`${Math.round((confirmed / Math.max(1, active.length)) * 100)}% outcome`}
        />
        <Metric
          label="Estimated revenue impact"
          value={`$${estimated.toLocaleString()}`}
          change="Not collected revenue"
        />
      </div>
      <div className="report-grid">
        <Card>
          <div className="card-title">
            <div>
              <h2>Appointment activity</h2>
              <p>Bookings by day · {period}</p>
            </div>
          </div>
          <div className="big-bars">
            {[42, 70, 54, 88, 75, 50, 36].map((h, i) => (
              <div key={i}>
                <i style={{ height: `${h}%` }} />
                <span>{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i]}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <div className="card-title">
            <div>
              <h2>Booking outcomes</h2>
              <p>Reconciled with appointment records</p>
            </div>
          </div>
          <div className="outcome-summary">
            <div className="donut">
              <strong>{active.length}</strong>
              <span>active</span>
            </div>
            <ul>
              <li>
                <i className="blue" /> Confirmed <b>{confirmed}</b>
              </li>
              <li>
                <i className="orange" /> Pending{' '}
                <b>{active.filter((a) => a.status === 'Pending').length}</b>
              </li>
              <li>
                <i className="red" /> Cancelled{' '}
                <b>{appointments.filter((a) => a.status === 'Cancelled').length}</b>
              </li>
            </ul>
          </div>
        </Card>
        <Card>
          <div className="card-title">
            <div>
              <h2>Follow-up performance</h2>
              <p>Period-based demo tasks</p>
            </div>
          </div>
          <div className="progress-list">
            <span>
              Completed on time <b>75%</b>
            </span>
            <progress value="75" max="100" />
            <span>
              Patient response rate <b>68%</b>
            </span>
            <progress value="68" max="100" />
          </div>
        </Card>
      </div>
    </>
  );
}
function Metric({ label, value, change }: { label: string; value: string; change: string }) {
  return (
    <Card className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{change}</small>
    </Card>
  );
}

function Notifications({
  read,
  setRead,
  go,
}: {
  read: number[];
  setRead: (v: number[]) => void;
  go: (p: Page) => void;
}) {
  return (
    <>
      <div className="toolbar">
        <div>
          <strong>
            {notices.filter((n) => !n.read && !read.includes(n.id)).length} unread notifications
          </strong>
          <span className="toolbar-note">All activity shown is fictional.</span>
        </div>
        <Button kind="secondary" onClick={() => setRead(notices.map((n) => n.id))}>
          Mark all as read
        </Button>
      </div>
      <Card>
        <NotificationList read={read} setRead={setRead} go={go} />
      </Card>
    </>
  );
}
function NotificationList({
  read,
  setRead,
  go,
  compact = false,
}: {
  read: number[];
  setRead: (v: number[]) => void;
  go: (p: Page) => void;
  compact?: boolean;
}) {
  return (
    <div className={`notification-list ${compact ? 'compact' : ''}`}>
      {notices.map((item) => {
        const isRead = item.read || read.includes(item.id);
        return (
          <button
            className={isRead ? 'read' : ''}
            key={item.id}
            onClick={() => {
              setRead([...read, item.id]);
              go(item.page);
            }}
          >
            <i />
            <div>
              <strong>{item.title}</strong>
              <span>{item.body}</span>
              <small>{item.time}</small>
            </div>
            <b>›</b>
          </button>
        );
      })}
    </div>
  );
}

function Settings({
  working,
  setWorking,
  toast,
}: {
  working: { start: string; end: string; breakStart: string; breakEnd: string; days: number[] };
  setWorking: (v: typeof working) => void;
  toast: (v: string) => void;
}) {
  const [draft, setDraft] = useState(working);
  const [online, setOnline] = useState(true);
  const [clinic, setClinic] = useState('Priya Shah Family Clinic');
  return (
    <>
      <div className="settings-layout">
        <aside className="settings-nav">
          <strong>Settings</strong>
          {['Clinic profile', 'Doctor availability', 'Booking preferences', 'AI receptionist'].map(
            (x, i) => (
              <button className={i === 0 ? 'active' : ''} key={x}>
                {x}
              </button>
            ),
          )}
        </aside>
        <div className="settings-content">
          <Card>
            <div className="card-title">
              <div>
                <h2>Clinic profile</h2>
                <p>Information used throughout this demo.</p>
              </div>
            </div>
            <div className="form-grid two">
              <Field label="Clinic name">
                <input value={clinic} onChange={(e) => setClinic(e.target.value)} />
              </Field>
              <Field label="Clinic phone">
                <input defaultValue="(415) 555-0100" />
              </Field>
              <Field label="Contact email">
                <input defaultValue="hello@clinicflow.example" />
              </Field>
              <Field label="Address">
                <input defaultValue="1200 Market Street, San Francisco, CA" />
              </Field>
            </div>
          </Card>
          <Card>
            <div className="card-title">
              <div>
                <h2>Dr. Priya Shah’s availability</h2>
                <p>These settings drive available-slot calculations.</p>
              </div>
            </div>
            <div className="form-grid two">
              <Field label="Working day starts">
                <input
                  type="time"
                  value={draft.start}
                  onChange={(e) => setDraft({ ...draft, start: e.target.value })}
                />
              </Field>
              <Field label="Working day ends">
                <input
                  type="time"
                  value={draft.end}
                  onChange={(e) => setDraft({ ...draft, end: e.target.value })}
                />
              </Field>
              <Field label="Break starts">
                <input
                  type="time"
                  value={draft.breakStart}
                  onChange={(e) => setDraft({ ...draft, breakStart: e.target.value })}
                />
              </Field>
              <Field label="Break ends">
                <input
                  type="time"
                  value={draft.breakEnd}
                  onChange={(e) => setDraft({ ...draft, breakEnd: e.target.value })}
                />
              </Field>
            </div>
          </Card>
          <Card>
            <div className="card-title">
              <div>
                <h2>Booking preferences</h2>
                <p>Prototype-only appointment behavior.</p>
              </div>
            </div>
            <div className="form-grid two">
              <Field label="Booking confirmation">
                <select defaultValue="Manual review for AI requests">
                  <option>Manual review for AI requests</option>
                  <option>Auto-confirm available requests</option>
                </select>
              </Field>
              <Field label="Cancellation notice">
                <select>
                  <option>24 hours</option>
                  <option>48 hours</option>
                </select>
              </Field>
            </div>
          </Card>
          <Card>
            <div className="card-title">
              <div>
                <h2>AI receptionist</h2>
                <p>Simulated controls; no real phone system is connected.</p>
              </div>
              <button className={`toggle ${online ? 'on' : ''}`} onClick={() => setOnline(!online)}>
                <i />
              </button>
            </div>
            <div className="info-box">
              Demo status: AI receptionist is <strong>{online ? 'online' : 'offline'}</strong>. Call
              forwarding is simulated.
            </div>
          </Card>
          <div className="sticky-save">
            <Button kind="secondary" onClick={() => setDraft(working)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setWorking(draft);
                toast('Clinic settings saved. Availability recalculated.');
              }}
            >
              Save changes
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

function Popover({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="popover">
      <div className="popover-head">
        <strong>{title}</strong>
        <button onClick={onClose}>×</button>
      </div>
      {children}
    </div>
  );
}
function Confirm({
  title,
  body,
  action,
  onCancel,
  onConfirm,
}: {
  title: string;
  body: string;
  action: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="modal-backdrop">
      <div className="modal confirm-modal">
        <div className="confirm-icon">!</div>
        <h2>{title}</h2>
        <p>{body}</p>
        <div className="modal-actions">
          <Button kind="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button kind="danger" onClick={onConfirm}>
            {action}
          </Button>
        </div>
      </div>
    </div>
  );
}
function SearchPanel({
  query,
  patients,
  appointments,
  go,
  close,
}: {
  query: string;
  patients: Patient[];
  appointments: Appointment[];
  go: (p: Page) => void;
  close: () => void;
}) {
  const p = patients.filter((x) => x.name.toLowerCase().includes(query.toLowerCase())).slice(0, 3);
  return (
    <div className="search-panel">
      <div className="popover-head">
        <strong>Search ClinicFlow</strong>
        <button onClick={close}>×</button>
      </div>
      {!query ? (
        <Empty
          title="Start typing to search"
          body="Find demo patients, appointments, and AI calls."
        />
      ) : (
        <>
          <span className="result-label">PATIENTS</span>
          {p.map((x) => (
            <button
              className="search-result"
              key={x.id}
              onClick={() => {
                go('patients');
                close();
              }}
            >
              <span className="avatar">{x.name[0]}</span>
              <div>
                <strong>{x.name}</strong>
                <small>{x.phone}</small>
              </div>
              <b>›</b>
            </button>
          ))}
          <span className="result-label">RECORDS</span>
          <button
            className="search-result"
            onClick={() => {
              go('appointments');
              close();
            }}
          >
            <span className="result-icon">▣</span>
            <div>
              <strong>{appointments.length} appointments</strong>
              <small>Open appointment list</small>
            </div>
            <b>›</b>
          </button>
          <button
            className="search-result"
            onClick={() => {
              go('calls');
              close();
            }}
          >
            <span className="result-icon">◌</span>
            <div>
              <strong>{calls.length} AI calls</strong>
              <small>Open call history</small>
            </div>
            <b>›</b>
          </button>
        </>
      )}
    </div>
  );
}
