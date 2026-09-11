import React, { useEffect, useState } from 'react';
import {
  Bell, ChevronRight, CreditCard, Home as HomeIcon, Mail, PiggyBank,
  Settings as SettingsIcon, ShieldCheck, Sliders, Users, Wallet, X,
} from 'lucide-react';
import { StoreProvider, useStore } from './store.jsx';
import { DemoBadge, Logo, Wordmark } from './ui.jsx';
import Home from './screens/Home.jsx';
import MoneyScreen from './screens/Money.jsx';
import Alerts from './screens/Alerts.jsx';
import Guardian from './screens/Guardian.jsx';
import Savings from './screens/Savings.jsx';
import Discovery from './screens/Discovery.jsx';
import SheetHost from './screens/Sheets.jsx';
import { Family, Pricing, Report, Roadmap, Settings } from './screens/More.jsx';
import { alertCounts, decisionQueue, longDate } from './state/derive.ts';

const PRIMARY = [
  { id: 'home', label: 'Home', Icon: HomeIcon },
  { id: 'money', label: 'Money', Icon: Wallet },
  { id: 'alerts', label: 'Alerts', Icon: Bell },
  { id: 'guardian', label: 'Guardian', Icon: ShieldCheck },
  { id: 'savings', label: 'Savings', Icon: PiggyBank },
];

const SECONDARY = [
  { id: 'discovery', label: 'Inbox scan', Icon: Mail },
  { id: 'family', label: 'Family', Icon: Users },
  { id: 'report', label: 'Monthly report', Icon: CreditCard },
  { id: 'pricing', label: 'Pricing', Icon: CreditCard },
  { id: 'settings', label: 'Settings', Icon: SettingsIcon },
  { id: 'roadmap', label: 'What comes next', Icon: ChevronRight },
];

// ---------------------------------------------------------------- welcome

/** Three real records from the seed, shown as a tilted glass stack. */
const PREVIEW = [
  { merchant: 'Canva Pro', meta: 'Trial ends tomorrow', amount: '$14.99', cat: 'Software', tone: 'amber' },
  { merchant: 'Netflix', meta: 'Renews tomorrow · unused 39d', amount: '$15.99', cat: 'Streaming', tone: 'amber' },
  { merchant: 'Harbor Internet', meta: 'Credit expired · $71 → $79', amount: '$79.00', cat: 'Utilities', tone: 'blue' },
];

function Welcome() {
  const { setEntered, go, setState } = useStore();
  const enter = (tour) => {
    setEntered(true);
    if (tour) {
      setState((s) => ({ ...s, tourSeen: false }));
      go('home');
      window.dispatchEvent(new CustomEvent('subkill:tour'));
    } else {
      go('home');
    }
  };

  return (
    <div className="welcome">
      <div className="welcome-inner">
        <div className="welcome-copy">
          <Wordmark size={18} tagline />

          <h1 className="welcome-h1">
            Your recurring payments.
            <span className="grad"> Under control.</span>
          </h1>

          <p className="muted welcome-sub">
            SubKill finds upcoming charges, helps you make the right call, and keeps watching after you act.
          </p>

          <div className="welcome-promise">
            <span>Know what's coming.</span>
            <span className="sep" />
            <span>Keep what matters.</span>
            <span className="sep" />
            <span>Stop paying for what doesn't.</span>
          </div>

          <div className="btnrow welcome-cta">
            <button type="button" className="btn primary wide" onClick={() => enter(false)}>
              See My Money
            </button>
            <button type="button" className="btn wide" onClick={() => enter(true)}>
              Take the 2-minute tour
            </button>
          </div>

          <div className="welcome-foot">
            <DemoBadge />
            <p className="tiny dim" style={{ marginTop: 10 }}>
              Synthetic data for one sample household. No signup, no bank connection, and no real
              subscription is ever cancelled.
            </p>
          </div>
        </div>

        <div className="welcome-stack" aria-hidden="true">
          <div className="stack-glow" />
          {PREVIEW.map((p, i) => (
            <div className={`pcard cat-${p.cat}`} key={p.merchant} style={{ '--i': i }}>
              <span className="pbar" />
              <div className="grow" style={{ minWidth: 0 }}>
                <div className="pname">{p.merchant}</div>
                <div className="pmeta">{p.meta}</div>
              </div>
              <div className="pamt num">{p.amount}</div>
            </div>
          ))}
          <div className="pcard psum">
            <div className="grow">
              <div className="pmeta">Scheduled next 30 days</div>
              <div className="figure md" style={{ marginTop: 3 }}>$862.99</div>
            </div>
            <span className="chip emerald">3 need you</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- tour

const TOUR = [
  {
    title: 'Three decisions worth your attention',
    body: 'A trial deadline, a renewal that looks forgotten, and a bill that went up. Everything else stays on the timeline rather than shouting at you.',
    route: ['home', null],
  },
  {
    title: 'Preview before you commit',
    body: 'Select Netflix and the Canva trial. The 30-day forecast reflows as you choose. Nothing is committed until you approve each action separately.',
    route: ['money', 'preview'],
  },
  {
    title: 'Approve, then keep watching',
    body: 'Open Netflix from Recurring, choose Cancel, and approve. You get an effective date, a receipt with a reference, and an active watch. Every screen updates.',
    route: ['money', 'list'],
  },
  {
    title: 'Explain the bill, do not guess',
    body: 'Harbor Internet went from $71 to $79. The base price never moved; an $8 promotional credit expired. Open it from Alerts to see both bills side by side.',
    route: ['alerts', null],
  },
  {
    title: 'Catch what happens next',
    body: 'Use "Simulate later charge" in the demo toolbar after cancelling Netflix. The case reopens as an exception, the earlier benefit is reversed, and a refund request is drafted.',
    route: ['savings', null],
  },
];

function Tour({ onClose }) {
  const { go } = useStore();
  const [i, setI] = useState(0);
  const step = TOUR[i];

  useEffect(() => { go(step.route[0], step.route[1]); }, [i]);

  return (
    <div className="tourcard" role="dialog" aria-label="Guided tour">
      <div className="row between gap-sm" style={{ marginBottom: 7 }}>
        <span className="eyebrow">Step {i + 1} of {TOUR.length}</span>
        <button type="button" className="btn ghost sm" onClick={onClose}>Skip</button>
      </div>
      <h3>{step.title}</h3>
      <p className="small muted" style={{ marginTop: 5 }}>{step.body}</p>
      <div className="btnrow" style={{ marginTop: 13 }}>
        <button type="button" className="btn sm" disabled={i === 0} onClick={() => setI((v) => v - 1)}>Back</button>
        {i < TOUR.length - 1 ? (
          <button type="button" className="btn sm primary grow" onClick={() => setI((v) => v + 1)}>Next</button>
        ) : (
          <button type="button" className="btn sm primary grow" onClick={onClose}>Explore freely</button>
        )}
        <button type="button" className="btn sm ghost" onClick={() => setI(0)}>Restart</button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- demo toolbar

function Toolbar({ onTour }) {
  const { state, run, notify } = useStore();
  const [open, setOpen] = useState(false);
  const netflixCase = state.cases.find((c) => c.paymentId === 'p_netflix' && c.action === 'cancel');
  const canLaterCharge = !!netflixCase && !netflixCase.exceptionTxnId;

  if (!open) {
    return (
      <button
        type="button"
        className="toolbar-fab no-print"
        onClick={() => setOpen(true)}
        aria-expanded="false"
        aria-label="Open demo controls"
      >
        <Sliders size={14} />
        <span>Demo</span>
      </button>
    );
  }

  return (
    <div className="toolbar no-print" role="group" aria-label="Demo controls">
      <button type="button" onClick={() => setOpen(false)} aria-label="Close demo controls" aria-expanded="true">
        <X size={13} />
      </button>
      <span className="sep" />
      <button type="button" onClick={() => { run.reset(); notify('Demo reset to the original baseline.'); }}>Reset</button>
      <button type="button" onClick={onTour}>Tour</button>
      <span className="sep" />
      <button type="button" onClick={() => { run.advanceDays(1); notify('Advanced 1 day. Due events processed once.'); }}>+1 day</button>
      <button type="button" onClick={() => { run.advanceDays(30); notify('Advanced 30 days. Same rules as a single day.'); }}>+30 days</button>
      <span className="sep" />
      <button
        type="button"
        disabled={!canLaterCharge}
        style={{ opacity: canLaterCharge ? 1 : 0.4, cursor: canLaterCharge ? 'pointer' : 'not-allowed' }}
        onClick={() => {
          if (!canLaterCharge) return;
          run.simulateLaterCharge('p_netflix');
          notify('A synthetic charge posted after the cancellation.', 'bad');
        }}
        title={canLaterCharge ? 'Post a synthetic charge after the Netflix cancellation' : 'Cancel Netflix first'}
      >
        Simulate later charge
      </button>
      <button
        type="button"
        onClick={() => {
          const c = state.connections.find((x) => x.id === 'cx_bank');
          const next = c?.state === 'simulated_stale' ? 'simulated_healthy' : 'simulated_stale';
          run.setConnectionState('cx_bank', next);
          notify(next === 'simulated_stale' ? 'Card activity is now stale in the demo.' : 'Card activity is current again.');
        }}
      >
        Stale source
      </button>
      <button
        type="button"
        onClick={() => { run.prepareProviderMessage(); run.simulateProviderResponse(); notify('Provider responded in the demo. Review the terms before accepting.'); }}
      >
        Provider responds
      </button>
    </div>
  );
}

// ---------------------------------------------------------------- shell

function Shell() {
  const { state, route, go, entered, toast } = useStore();
  const [tour, setTour] = useState(false);
  const counts = alertCounts(state);
  const queue = decisionQueue(state).length;

  useEffect(() => {
    const h = () => setTour(true);
    window.addEventListener('subkill:tour', h);
    return () => window.removeEventListener('subkill:tour', h);
  }, []);

  if (!entered) return <Welcome />;

  const screen = {
    home: <Home />,
    money: <MoneyScreen />,
    alerts: <Alerts />,
    guardian: <Guardian />,
    savings: <Savings />,
    discovery: <Discovery />,
    family: <Family />,
    report: <Report />,
    pricing: <Pricing />,
    settings: <Settings />,
    roadmap: <Roadmap />,
  }[route.tab] || <Home />;

  return (
    <div className="app">
      <nav className="sidebar" aria-label="Primary">
        <div className="brand"><Wordmark size={17} tagline /></div>

        {PRIMARY.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            className="navlink"
            aria-current={route.tab === id ? 'page' : undefined}
            onClick={() => go(id)}
          >
            <Icon size={17} />
            {label}
            {id === 'home' && queue ? <span className="dot">{queue}</span> : null}
            {id === 'alerts' && counts.needsDecision ? <span className="dot">{counts.needsDecision}</span> : null}
          </button>
        ))}

        <div className="nav-sep" />
        <div className="nav-label">More</div>
        {SECONDARY.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            className="navlink"
            aria-current={route.tab === id ? 'page' : undefined}
            onClick={() => go(id)}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}

        <div style={{ marginTop: 'auto', paddingTop: 16 }}>
          <DemoBadge />
          <div className="tiny dim" style={{ marginTop: 8 }}>Demo date: {longDate(state.nowISO)}</div>
        </div>
      </nav>

      <div className="main">
        <header className="topbar">
          <div className="brand" style={{ padding: 0 }}>
            <Logo size={26} id="lg-top" />
            <div className="brand-name">SubKill</div>
          </div>
          <span className="spacer" />
          <DemoBadge />
          <button
            type="button"
            className="btn ghost sm"
            onClick={() => go('settings')}
            aria-label="Profile and settings"
          >
            <span className="av" style={{ width: 27, height: 27, fontSize: 12 }}>N</span>
          </button>
        </header>

        <main className="content" id="main" data-screen={route.tab}>
          {screen}
          <MobileMore />
        </main>
      </div>

      <nav className="bottomnav" aria-label="Primary">
        {PRIMARY.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            aria-current={route.tab === id ? 'page' : undefined}
            onClick={() => go(id)}
          >
            <Icon size={19} />
            {label}
            {id === 'home' && queue ? <span className="badge">{queue}</span> : null}
            {id === 'alerts' && counts.needsDecision ? <span className="badge">{counts.needsDecision}</span> : null}
          </button>
        ))}
      </nav>

      <Toolbar onTour={() => setTour(true)} />
      {tour ? <Tour onClose={() => setTour(false)} /> : null}
      <SheetHost />

      {toast ? (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed', left: '50%', transform: 'translateX(-50%)',
            bottom: 'calc(env(safe-area-inset-bottom) + 124px)', zIndex: 80,
            background: 'var(--surface-3)', border: '1px solid var(--border)',
            borderRadius: 10, padding: '9px 14px', fontSize: 13,
            maxWidth: 'calc(100vw - 28px)', boxShadow: 'var(--shadow)',
            color: toast.tone === 'good' ? 'var(--emerald)' : toast.tone === 'bad' ? 'var(--red)' : 'var(--text)',
          }}
        >
          {toast.message}
        </div>
      ) : null}
    </div>
  );
}

/** Secondary destinations on small screens, where the sidebar is hidden. */
function MobileMore() {
  const { route, go } = useStore();
  if (['discovery', 'family', 'report', 'pricing', 'settings', 'roadmap'].includes(route.tab)) return null;
  return (
    <div className="section mobile-only">
      <div className="nav-sep" style={{ margin: '20px 0 12px' }} />
      <div className="nav-label" style={{ padding: '0 0 8px' }}>More</div>
      <div className="stack-sm">
        {SECONDARY.map(({ id, label, Icon }) => (
          <button key={id} type="button" className="lrow" onClick={() => go(id)}>
            <Icon size={16} color="var(--text-3)" style={{ flex: 'none' }} />
            <span className="grow small">{label}</span>
            <ChevronRight size={15} color="var(--text-3)" />
          </button>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
