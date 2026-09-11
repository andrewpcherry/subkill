import React, { useState } from 'react';
import { Download, Printer } from 'lucide-react';
import { downloadFile, useStore } from '../store.jsx';
import { Card, Chip, MerchantMark, Money, Sheet, Toggle } from '../ui.jsx';
import {
  activeBills, activeSubscriptions, activeTrials, annualized, childMonthlyTotal,
  dataFreshness, formatMoney, isActive, longDate, monthlyEquivalent, monthlyReport,
  paymentById, shortDate, trackedItems,
} from '../state/derive.ts';
import { SUBKILL_PREMIUM_CENTS } from '../state/seed.ts';

// ---------------------------------------------------------------- family

export function Family() {
  const { state, run, notify, setSheet } = useStore();
  // Genuinely shared: the household carries it, more than one person uses it,
  // or someone other than the owner does. An item Nancy owns and only Nancy
  // uses is hers, not a shared expense.
  const shared = state.payments.filter(
    (p) => isActive(p) && (p.owner === 'household' || p.usedBy.length > 1 || p.usedBy.some((u) => u !== p.owner)),
  );
  const unclaimed = state.payments.filter((p) => isActive(p) && p.usedBy.length === 0 && p.owner !== 'household');
  const spotify = paymentById(state, 'p_spotify');
  const benefit = state.evidence.find((e) => e.id === 'ev_mobileco_benefit');

  return (
    <>
      <header style={{ marginBottom: 14 }}>
        <h1>Family</h1>
        <p className="muted small" style={{ marginTop: 3 }}>
          Only expenses explicitly shared in this sample household are shown. SubKill has no access to anyone's
          private accounts or app activity.
        </p>
      </header>

      <div className="grid2">
        <Card>
          <div className="row gap-sm">
            <div className="av" style={{ width: 34, height: 34 }}>N</div>
            <div>
              <div style={{ fontWeight: 560 }}>Nancy</div>
              <div className="tiny dim">Parent · account owner</div>
            </div>
          </div>
        </Card>
        <Card>
          <div className="row gap-sm">
            <div className="av" style={{ width: 34, height: 34 }}>B</div>
            <div>
              <div style={{ fontWeight: 560 }}>Brian</div>
              <div className="tiny dim">Child · {formatMoney(childMonthlyTotal(state))}/month in his name</div>
            </div>
          </div>
        </Card>
      </div>

      <div className="section">
        <div className="section-head"><h2>Shared expenses</h2></div>
        <div className="stack-sm">
          {shared.map((p) => (
            <Card key={p.id}>
              <div className="row between gap-sm wrap">
                <MerchantMark name={p.merchant} size={32} />
                <div className="grow">
                  <div style={{ fontWeight: 550 }}>{p.merchant}</div>
                  <div className="tiny dim" style={{ marginTop: 2 }}>
                    Owner: {p.owner === 'brian' ? 'Brian' : p.owner === 'household' ? 'Household' : 'Nancy'}
                    {p.usedBy.length ? ` · used by ${p.usedBy.map((u) => (u === 'brian' ? 'Brian' : 'Nancy')).join(', ')}` : ' · nobody has claimed this'}
                  </div>
                </div>
                <Money cents={monthlyEquivalent(p)} className="small" />
              </div>
            </Card>
          ))}
        </div>
      </div>

      <div className="section">
        <div className="section-head"><h2>Who uses this?</h2></div>
        <p className="small muted" style={{ marginBottom: 12 }}>
          An unclaimed item stays uncertain. SubKill will not guess, and it does not message anyone.
        </p>
        <div className="stack-sm">
          {unclaimed.length === 0 ? (
            <Card><p className="small muted">Everything active has been claimed by someone.</p></Card>
          ) : (
            unclaimed.map((p) => (
              <Card key={p.id}>
                <div className="row between gap-sm wrap">
                  <div className="grow">
                    <div style={{ fontWeight: 550 }}>{p.merchant}</div>
                    <div className="tiny dim" style={{ marginTop: 2 }}>
                      <Money cents={monthlyEquivalent(p)} />/month · usage unknown
                    </div>
                  </div>
                  <div className="btnrow">
                    <button type="button" className="btn sm" onClick={() => { run.simulateHouseholdResponse(p.id, true); notify(`Brian confirmed he uses ${p.merchant}.`); }}>
                      Simulate Brian's response: yes
                    </button>
                    <button type="button" className="btn sm ghost" onClick={() => { run.simulateHouseholdResponse(p.id, false); notify(`Brian said he does not use ${p.merchant}.`); }}>
                      No
                    </button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>

      <div className="section">
        <div className="section-head"><h2>Possible benefit overlap</h2></div>
        <Card className="pad-lg">
          <div className="row between gap-sm wrap" style={{ marginBottom: 9 }}>
            <div style={{ fontWeight: 570 }}>MobileCo plan may already include a music benefit</div>
            <Chip tone="amber">Unconfirmed</Chip>
          </div>
          <p className="small muted">{benefit?.summary}</p>
          <div className="evidence" style={{ marginTop: 11 }}>
            <div className="tiny dim">{benefit?.sourceLabel}</div>
            <p className="small" style={{ marginTop: 4 }}>{benefit?.detail}</p>
          </div>
          <div className="stack-sm" style={{ marginTop: 12 }}>
            <div className="row between"><span className="small muted">Currently paying</span><Money cents={spotify?.amountCents ?? 0} className="small" /></div>
            <div className="row between"><span className="small muted">Activation required</span><span className="small">Yes, and not yet activated</span></div>
            <div className="row between"><span className="small muted">Counted in your totals</span><span className="small dim">No, excluded until confirmed</span></div>
          </div>
          <div className="btnrow" style={{ marginTop: 13 }}>
            <button type="button" className="btn sm primary" onClick={() => setSheet({ kind: 'payment', paymentId: 'p_spotify' })}>
              Compare benefits
            </button>
          </div>
          <p className="tiny dim" style={{ marginTop: 10 }}>
            SubKill does not recommend cancelling here. Two music services are not automatically waste, and
            the replacement is not equivalent.
          </p>
        </Card>
      </div>

      <div className="section">
        <Card>
          <div className="row between gap-sm">
            <div>
              <div className="small" style={{ fontWeight: 550 }}>Parental restrictions</div>
              <div className="tiny dim" style={{ marginTop: 2 }}>
                Concept only. SubKill does not control a child's device, purchases or bank card.
              </div>
            </div>
            <Chip>Roadmap</Chip>
          </div>
        </Card>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- report

export function Report() {
  const { state } = useStore();
  const r = monthlyReport(state);

  const exportCsv = () => {
    const rows = [
      ['metric', 'value_usd'],
      ['monthly_recurring_commitment', (r.monthlyCommitmentCents / 100).toFixed(2)],
      ['annualized_commitment_projection', (r.annualizedCommitmentCents / 100).toFixed(2)],
      ['actual_recurring_charges_in_period', (r.actualChargesCents / 100).toFixed(2)],
      ['gross_observed_benefit', (r.grossObservedCents / 100).toFixed(2)],
      ['subkill_fees', (r.feesCents / 100).toFixed(2)],
      ['net_observed_benefit', (r.netObservedCents / 100).toFixed(2)],
      ['confirmed_annualized_reduction_projection', (r.confirmedAnnualCents / 100).toFixed(2)],
      ['future_candidate_annualized_projection', (r.futureOpportunityAnnualCents / 100).toFixed(2)],
    ];
    const ok = downloadFile('subkill-report.csv', rows.map((x) => x.join(',')).join('\n'), 'text/csv');
    if (!ok) window.alert('Download is unavailable in this browser context.');
  };

  return (
    <>
      <header style={{ marginBottom: 14 }}>
        <div className="row between wrap gap-sm">
          <div>
            <h1>Monthly report</h1>
            <p className="muted small" style={{ marginTop: 3 }}>{r.periodLabel} · generated from the same records as every screen</p>
          </div>
          <div className="btnrow no-print">
            <button type="button" className="btn sm" onClick={() => window.print()}><Printer size={14} /> Print</button>
            <button type="button" className="btn sm" onClick={exportCsv}><Download size={14} /> CSV</button>
          </div>
        </div>
      </header>

      <div className="section" style={{ marginTop: 0 }}>
        <div className="section-head"><h2>Commitment</h2></div>
        <div className="stack-sm">
          <Line label="Recurring commitment" value={formatMoney(r.monthlyCommitmentCents)} note="Per month equivalent" />
          <Line label="Annualized commitment" value={formatMoney(r.annualizedCommitmentCents)} note="Projection at today's rates" />
          <Line label="Actual recurring charges in this period" value={formatMoney(r.actualChargesCents)} note={`${r.actualChargeCount} posted charges`} />
        </div>
      </div>

      <div className="section">
        <div className="section-head"><h2>What is tracked</h2></div>
        <div className="stack-sm">
          <Line label="Active paid subscriptions" value={String(r.subscriptions)} />
          <Line label="Household bills" value={String(r.bills)} />
          <Line label="Free trials" value={String(r.trials)} />
          <Line label="Completed actions" value={String(r.completedActions)} />
          <Line label="Unresolved cases" value={String(r.unresolvedCases)} note={r.unresolvedCases ? 'Excluded from confirmed benefit until resolved' : undefined} />
        </div>
      </div>

      <div className="section">
        <div className="section-head"><h2>Observed benefit</h2></div>
        <div className="stack-sm">
          <Line label="Gross observed benefit" value={formatMoney(r.grossObservedCents)} tone="emerald" />
          <Line label="SubKill fees" value={`−${formatMoney(r.feesCents)}`} tone="red" />
          <Line label="Net observed benefit" value={formatMoney(r.netObservedCents)} tone="emerald" note="Money credited, or charges that demonstrably did not happen" />
        </div>
      </div>

      <div className="section">
        <div className="section-head"><h2>Future opportunities, labelled separately</h2></div>
        <div className="stack-sm">
          <Line label="Confirmed annualized reduction" value={`${formatMoney(r.confirmedAnnualCents)}/yr`} note="Projection, not cash" />
          <Line label="Candidate annualized reduction" value={`${formatMoney(r.futureOpportunityAnnualCents)}/yr`} note="Proposals you have not acted on" />
        </div>
        <p className="tiny dim" style={{ marginTop: 11 }}>
          A full year's projection is never totalled with a month's observed benefit. They answer different
          questions and mixing them would overstate both.
        </p>
      </div>
    </>
  );
}

function Line({ label, value, note, tone }) {
  return (
    <Card>
      <div className="row between gap-sm">
        <div className="grow">
          <div className="small" style={{ fontWeight: 550 }}>{label}</div>
          {note ? <div className="tiny dim" style={{ marginTop: 2 }}>{note}</div> : null}
        </div>
        <span className="num" style={{ fontWeight: 620, flex: 'none', color: tone ? `var(--${tone})` : undefined }}>{value}</span>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------- pricing

export function Pricing() {
  const { state, run, notify } = useStore();
  const [checkout, setCheckout] = useState(false);
  const sk = paymentById(state, 'p_subkill');

  return (
    <>
      <header style={{ marginBottom: 6 }}>
        <div className="row gap-sm" style={{ alignItems: 'center' }}>
          <h1>Protect Your Money</h1>
          <Chip tone="amber">Proposed pricing</Chip>
        </div>
        <p className="muted small" style={{ marginTop: 3 }}>
          This investor demo simulates every capability listed here. Nothing below is live, and no payment is taken.
        </p>
      </header>

      <div className="grid2" style={{ marginTop: 16 }}>
        <Card className="pad-lg">
          <div className="eyebrow">Free</div>
          <div className="num" style={{ fontSize: 28, fontWeight: 680, marginTop: 4 }}>$0</div>
          <ul className="small muted" style={{ marginTop: 12, paddingLeft: 17 }}>
            <li>Manual tracking</li>
            <li>Basic reminders</li>
            <li>Recurring dashboard</li>
            <li>Basic cancellation guides</li>
          </ul>
        </Card>

        <Card className="pad-lg" style={{ borderColor: 'rgba(52,211,153,0.34)' }}>
          <div className="eyebrow" style={{ color: 'var(--emerald)' }}>Premium</div>
          <div className="num" style={{ fontSize: 28, fontWeight: 680, marginTop: 4 }}>
            {formatMoney(SUBKILL_PREMIUM_CENTS)}<span className="small dim" style={{ fontWeight: 400 }}>/month</span>
          </div>
          <ul className="small muted" style={{ marginTop: 12, paddingLeft: 17 }}>
            <li>Planned automated discovery</li>
            <li>Smart monitoring and trial rescue</li>
            <li>Guardian actions</li>
            <li>Bill explanations</li>
            <li>Household coordination</li>
            <li>Cancellation follow-up</li>
            <li>Detailed reports</li>
          </ul>
          <div className="btnrow" style={{ marginTop: 14 }}>
            {state.settings.premium ? (
              <button type="button" className="btn danger block" onClick={() => { run.cancelPremium(); notify('Premium cancelled in the demo. Future fees stop.'); }}>
                Cancel Premium
              </button>
            ) : (
              <button type="button" className="btn primary block" onClick={() => setCheckout(true)}>
                Try Premium in demo
              </button>
            )}
          </div>
        </Card>
      </div>

      {state.settings.premium ? (
        <div className="section">
          <div className="section-head"><h2>SubKill follows its own rules</h2></div>
          <Card>
            <div className="stack-sm">
              <div className="row between"><span className="small muted">Next renewal</span><span className="small num">{sk?.nextChargeAt ? longDate(sk.nextChargeAt) : 'None scheduled'}</span></div>
              <div className="row between"><span className="small muted">In your recurring payments list</span><span className="small">Yes</span></div>
              <div className="row between"><span className="small muted">Counted in your commitment</span><span className="small">Yes</span></div>
              <div className="row between"><span className="small muted">Fees subtracted from observed benefit</span><span className="small">Yes</span></div>
            </div>
            <p className="tiny dim" style={{ marginTop: 11 }}>
              Cancelling stops future demo fees. It does not refund a fee that has already posted unless a
              separate refund event is created.
            </p>
          </Card>
        </div>
      ) : null}

      {checkout ? (
        <Sheet
          title="Mock checkout"
          subtitle="No card is collected and no payment is processed."
          onClose={() => setCheckout(false)}
          footer={
            <>
              <button
                type="button"
                className="btn primary grow"
                onClick={() => {
                  run.activatePremium();
                  notify('Premium activated in the demo. One $7.99 fee recorded.');
                  setCheckout(false);
                }}
              >
                Confirm demo subscription
              </button>
              <button type="button" className="btn" onClick={() => setCheckout(false)}>Cancel</button>
            </>
          }
        >
          <div className="callout">
            <div className="row between"><span className="small muted">SubKill Premium</span><span className="small num">{formatMoney(SUBKILL_PREMIUM_CENTS)}/month</span></div>
            <div className="row between" style={{ marginTop: 7 }}><span className="small muted">Due today</span><span className="small num">{formatMoney(SUBKILL_PREMIUM_CENTS)}</span></div>
          </div>
          <p className="small muted" style={{ marginTop: 13 }}>
            Confirming adds SubKill to your recurring payments, records one synthetic fee event and
            recalculates every total. Clicking again will not charge twice.
          </p>
          <p className="tiny dim" style={{ marginTop: 9 }}>
            No card details are requested at any point in this prototype.
          </p>
        </Sheet>
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------- settings

const CONNECTION_LABEL = {
  simulated_healthy: 'Simulated healthy',
  simulated_stale: 'Simulated stale',
  disconnected: 'Disconnected',
};

export function Settings() {
  const { state, setState, run, notify } = useStore();
  const fresh = dataFreshness(state);
  const items = trackedItems(state);

  const set = (patch) => setState((prev) => ({ ...prev, settings: { ...prev.settings, ...patch } }));

  const exportAll = () => {
    const ok = downloadFile('subkill-demo-state.json', JSON.stringify(state, null, 2), 'application/json');
    if (!ok) window.alert('Download is unavailable in this browser context.');
  };

  return (
    <>
      <header style={{ marginBottom: 14 }}>
        <h1>Settings</h1>
        <p className="muted small" style={{ marginTop: 3 }}>
          Everything here is local to this browser. There is no account and no server.
        </p>
      </header>

      <div className="section" style={{ marginTop: 0 }}>
        <div className="section-head"><h2>Profile</h2></div>
        <Card>
          <div className="row gap-sm">
            <div className="av" style={{ width: 38, height: 38 }}>N</div>
            <div className="grow">
              <div style={{ fontWeight: 560 }}>Nancy</div>
              <div className="tiny dim">Sample household · {items.total} recurring items tracked</div>
            </div>
            <Chip>{state.settings.premium ? 'Premium (demo)' : 'Free'}</Chip>
          </div>
        </Card>
      </div>

      <div className="section">
        <div className="section-head"><h2>Household sharing</h2></div>
        <Card>
          <div className="row between gap-sm">
            <div className="grow">
              <div className="small" style={{ fontWeight: 550 }}>Share the household view with Brian</div>
              <div className="tiny dim" style={{ marginTop: 2 }}>Controls what a second member would see in this demo.</div>
            </div>
            <Toggle checked={state.settings.householdSharing} label="Household sharing" onChange={(v) => set({ householdSharing: v })} />
          </div>
        </Card>
      </div>

      <div className="section">
        <div className="section-head"><h2>Alerts</h2></div>
        <div className="stack-sm">
          {Object.entries(state.settings.alertCategories).map(([k, v]) => (
            <Card key={k}>
              <div className="row between gap-sm">
                <span className="small grow">{k}</span>
                <Toggle checked={v} label={k} onChange={(nv) => set({ alertCategories: { ...state.settings.alertCategories, [k]: nv } })} />
              </div>
            </Card>
          ))}
          <Card>
            <div className="row between gap-sm wrap">
              <div className="grow">
                <div className="small" style={{ fontWeight: 550 }}>Quiet hours</div>
                <div className="tiny dim" style={{ marginTop: 2 }}>
                  Delivery is held in this simulation. Approaching deadlines stay visible in the app regardless.
                </div>
              </div>
              <div className="row gap-sm" style={{ flex: 'none' }}>
                <select className="input" style={{ width: 'auto' }} value={state.settings.quietHoursStart} onChange={(e) => set({ quietHoursStart: Number(e.target.value) })} aria-label="Quiet hours start">
                  {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{String(i).padStart(2, '0')}:00</option>)}
                </select>
                <span className="small dim">to</span>
                <select className="input" style={{ width: 'auto' }} value={state.settings.quietHoursEnd} onChange={(e) => set({ quietHoursEnd: Number(e.target.value) })} aria-label="Quiet hours end">
                  {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{String(i).padStart(2, '0')}:00</option>)}
                </select>
              </div>
            </div>
          </Card>
          <Card>
            <div className="row between gap-sm">
              <span className="small grow">Digest frequency</span>
              <select className="input" style={{ width: 'auto' }} value={state.settings.digest} onChange={(e) => set({ digest: e.target.value })} aria-label="Digest frequency">
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
              </select>
            </div>
          </Card>
        </div>
      </div>

      <div className="section">
        <div className="section-head"><h2>Connections</h2></div>
        <div className="stack-sm">
          {state.connections.map((c) => (
            <Card key={c.id}>
              <div className="row between gap-sm wrap">
                <div className="grow">
                  <div className="small" style={{ fontWeight: 550 }}>{c.label}</div>
                  <div className="tiny dim" style={{ marginTop: 2 }}>{c.note}</div>
                  <div className="tiny dim" style={{ marginTop: 2 }}>Last sync in demo: {longDate(c.lastSyncAt)}</div>
                </div>
                <div className="row gap-sm" style={{ flex: 'none' }}>
                  <Chip tone={c.state === 'simulated_healthy' ? 'emerald' : c.state === 'simulated_stale' ? 'amber' : 'red'}>
                    {CONNECTION_LABEL[c.state]}
                  </Chip>
                  <select
                    className="input"
                    style={{ width: 'auto' }}
                    value={c.state}
                    onChange={(e) => { run.setConnectionState(c.id, e.target.value); notify(`${c.label}: ${CONNECTION_LABEL[e.target.value].toLowerCase()}.`); }}
                    aria-label={`${c.label} state`}
                  >
                    <option value="simulated_healthy">Simulated healthy</option>
                    <option value="simulated_stale">Simulated stale</option>
                    <option value="disconnected">Disconnected</option>
                  </select>
                </div>
              </div>
            </Card>
          ))}
        </div>
        <div className={`callout ${fresh.canVerifyAbsence ? '' : 'amber'}`} style={{ marginTop: 11 }}>
          <p className="small">
            {fresh.canVerifyAbsence
              ? 'All sources are current in this simulation, so an absent charge can be treated as evidence a payment stopped.'
              : 'A source is not current. While that is true, an absent charge proves nothing, and anything resting on an absence is marked awaiting verification rather than counted.'}
          </p>
        </div>
        <p className="tiny dim" style={{ marginTop: 10 }}>
          These are simulated connections. No bank, card or mailbox is linked, and SubKill makes no claim to
          be bank-secure or certified.
        </p>
      </div>

      <div className="section">
        <div className="section-head"><h2>Your data</h2></div>
        <div className="btnrow">
          <button type="button" className="btn" onClick={exportAll}><Download size={15} /> Export demo data</button>
          <button
            type="button"
            className="btn"
            onClick={() => {
              if (window.confirm('Clear local demo data and restore the original seed?')) {
                run.reset();
                notify('Demo reset to the original baseline.');
              }
            }}
          >
            Clear local demo data
          </button>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- roadmap

const ROADMAP = [
  { title: 'Before you subscribe', body: 'Review a shared offer or receipt before signing up: trial deadlines, any annual commitment, the cancellation notice period, and whether the household already has an equivalent benefit. Needs real document parsing and a household benefit register.' },
  { title: 'Streaming rotation', body: 'Plan which services to keep in which months from favorites, budget and dates you enter yourself. It would not invent access to viewing history or release catalogs.' },
  { title: 'Contract renewal preparation', body: 'Assemble current terms, the renewal notice and your requirements ahead of insurance, phone and internet decisions. It would not recommend a coverage change without the information needed to judge one.' },
  { title: 'Household change mode', body: 'Work through recurring commitments during a move, a child leaving home, or a change in work, with explicit sharing and clear decision ownership.' },
  { title: 'Real provider execution', body: 'Integrate supported cancellation routes, human-assisted exceptions and verified outcomes, and be honest about the providers where none of that is possible.' },
];

export function Roadmap() {
  const { setSheet } = useStore();
  return (
    <>
      <header style={{ marginBottom: 14 }}>
        <h1>What comes next</h1>
        <p className="muted small" style={{ marginTop: 3 }}>
          Concepts, not features. Each one needs real integrations and validation before it could work.
        </p>
      </header>
      <div className="stack-sm hued">
        {ROADMAP.map((t) => (
          <button key={t.title} type="button" className="lrow" onClick={() => setSheet({ kind: 'roadmap', topic: t })}>
            <div className="grow">
              <div className="small" style={{ fontWeight: 550 }}>{t.title}</div>
              <div className="tiny dim truncate">{t.body}</div>
            </div>
            <Chip>Concept</Chip>
          </button>
        ))}
      </div>
    </>
  );
}
