import React, { useMemo, useState } from 'react';
import { CalendarDays, List, Plus, Search, Target } from 'lucide-react';
import { useStore } from '../store.jsx';
import { Avatar, Card, Chip, Empty, Money, Sheet, Tabs } from '../ui.jsx';
import {
  activeBills, activeSubscriptions, activeTrials, annualized, decisionDeadline,
  forecastTotals, formatMoney, findTarget, hoursUntil, isActive, longDate,
  monthlyCommitment, monthlyEquivalent, paymentById, relativeDay,
  scenarioMonthlyCommitment, scheduledInWindow, shortDate,
} from '../state/derive.ts';

const CATEGORIES = ['All', 'Streaming', 'Software', 'Fitness', 'Kids', 'Learning', 'Utilities', 'Insurance', 'Other'];

// ---------------------------------------------------------------- list

function RecurringList() {
  const { state, setSheet } = useStore();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('All');
  const [kind, setKind] = useState('all');
  const [sort, setSort] = useState('next');
  const [display, setDisplay] = useState('monthly');
  const [adding, setAdding] = useState(false);

  const rows = useMemo(() => {
    let list = state.payments.filter((p) => p.status !== 'archived');
    if (kind !== 'all') list = list.filter((p) => (kind === 'trial' ? p.kind === 'trial' : p.kind === kind));
    if (cat !== 'All') list = list.filter((p) => p.category === cat);
    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      list = list.filter((p) => `${p.merchant} ${p.plan} ${p.category}`.toLowerCase().includes(needle));
    }
    return [...list].sort((a, b) => {
      if (sort === 'cost') return annualized(monthlyEquivalent(b)) - annualized(monthlyEquivalent(a));
      const at = a.nextChargeAt ? Date.parse(a.nextChargeAt) : Infinity;
      const bt = b.nextChargeAt ? Date.parse(b.nextChargeAt) : Infinity;
      return at - bt;
    });
  }, [state.payments, q, cat, kind, sort]);

  return (
    <>
      <div className="stack" style={{ marginBottom: 14 }}>
        <div className="row gap-sm wrap">
          <div className="searchwrap grow" style={{ minWidth: 180 }}>
            <Search size={15} />
            <input
              className="input"
              type="search"
              placeholder="Search payments"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Search recurring payments"
            />
          </div>
          <button type="button" className="btn" onClick={() => setAdding(true)}>
            <Plus size={15} /> Add
          </button>
        </div>

        <div className="row gap-sm wrap">
          <select className="input" style={{ width: 'auto', flex: '0 1 auto' }} value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Type">
            <option value="all">All types</option>
            <option value="subscription">Subscriptions</option>
            <option value="bill">Household bills</option>
            <option value="trial">Free trials</option>
          </select>
          <select className="input" style={{ width: 'auto', flex: '0 1 auto' }} value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort by">
            <option value="next">Sort: next charge</option>
            <option value="cost">Sort: annual cost</option>
          </select>
          <select className="input" style={{ width: 'auto', flex: '0 1 auto' }} value={display} onChange={(e) => setDisplay(e.target.value)} aria-label="Show amounts as">
            <option value="monthly">Show monthly</option>
            <option value="annual">Show annual</option>
          </select>
        </div>

        <div className="filterbar" role="group" aria-label="Category">
          {CATEGORIES.map((c) => (
            <button key={c} type="button" className="chip" aria-pressed={cat === c} onClick={() => setCat(c)}>
              {c}
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <Empty
          icon="⌕"
          title="No payments match those filters"
          body="Try a different category, or clear the search box."
          action={
            <button type="button" className="btn" onClick={() => { setQ(''); setCat('All'); setKind('all'); }}>
              Clear filters
            </button>
          }
        />
      ) : (
        <div className="stack-sm">
          {rows.map((p) => {
            const m = monthlyEquivalent(p);
            return (
              <button
                key={p.id}
                type="button"
                className={`lrow ${p.status === 'cancelled' ? 'cancelled' : ''}`}
                onClick={() => setSheet({ kind: 'payment', paymentId: p.id })}
              >
                <Avatar name={p.merchant} />
                <div className="grow">
                  <div className="row gap-sm" style={{ alignItems: 'baseline' }}>
                    <span className="name truncate" style={{ fontWeight: 560 }}>{p.merchant}</span>
                    {p.kind === 'trial' ? <Chip tone="amber">Trial</Chip> : null}
                    {p.kind === 'bill' ? <Chip>Bill</Chip> : null}
                    {p.status === 'cancelled' ? <Chip tone="emerald">Cancelled in demo</Chip> : null}
                    {p.status === 'paused' ? <Chip tone="blue">Paused</Chip> : null}
                    {p.favorite ? <Chip tone="emerald">Favorite</Chip> : null}
                  </div>
                  <div className="tiny dim truncate">
                    {p.plan} · {p.category} · {p.owner === 'brian' ? 'Brian' : p.owner === 'household' ? 'Household' : 'Nancy'}
                    {p.nextChargeAt ? ` · ${relativeDay(state, p.nextChargeAt).toLowerCase()}` : ' · no scheduled charge'}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flex: 'none' }}>
                  <div className="num" style={{ fontWeight: 570 }}>
                    {display === 'annual' ? formatMoney(annualized(m), { cents: false }) : formatMoney(m)}
                  </div>
                  <div className="tiny dim">{display === 'annual' ? 'per year' : p.interval === 'annual' ? 'monthly equiv.' : 'per month'}</div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {adding ? <AddPayment onClose={() => setAdding(false)} /> : null}
    </>
  );
}

function AddPayment({ onClose }) {
  const { run, notify, state } = useStore();
  const [f, setF] = useState({
    merchant: '', plan: '', amount: '', interval: 'monthly',
    category: 'Other', owner: 'nancy', kind: 'subscription',
    nextChargeAt: new Date(Date.parse(state.nowISO) + 7 * 86400000).toISOString().slice(0, 10),
  });
  const [err, setErr] = useState({});

  const submit = () => {
    const e = {};
    if (!f.merchant.trim()) e.merchant = 'Enter a name.';
    const amt = Number.parseFloat(f.amount);
    if (!Number.isFinite(amt) || amt <= 0) e.amount = 'Enter an amount greater than zero.';
    if (!f.nextChargeAt) e.nextChargeAt = 'Pick the next charge date.';
    setErr(e);
    if (Object.keys(e).length) return;
    run.addManualPayment({
      merchant: f.merchant.trim(),
      plan: f.plan.trim() || 'Standard',
      amountCents: Math.round(amt * 100),
      interval: f.interval,
      category: f.category,
      owner: f.owner,
      kind: f.kind,
      nextChargeAt: new Date(`${f.nextChargeAt}T09:00:00.000Z`).toISOString(),
    });
    notify(`${f.merchant.trim()} added to your recurring payments.`);
    onClose();
  };

  const set = (k) => (ev) => setF((v) => ({ ...v, [k]: ev.target.value }));

  return (
    <Sheet
      title="Add a recurring payment"
      subtitle="Stored locally in this demo. Nothing is sent anywhere."
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn primary grow" onClick={submit}>Add payment</button>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
        </>
      }
    >
      <div className="stack">
        <div className="field">
          <label htmlFor="m-name">Name</label>
          <input id="m-name" className="input" value={f.merchant} onChange={set('merchant')} placeholder="e.g. Local Gym" />
          {err.merchant ? <span className="err">{err.merchant}</span> : null}
        </div>
        <div className="field">
          <label htmlFor="m-plan">Plan</label>
          <input id="m-plan" className="input" value={f.plan} onChange={set('plan')} placeholder="Standard" />
        </div>
        <div className="grid2">
          <div className="field">
            <label htmlFor="m-amt">Amount (USD)</label>
            <input id="m-amt" className="input" inputMode="decimal" value={f.amount} onChange={set('amount')} placeholder="9.99" />
            {err.amount ? <span className="err">{err.amount}</span> : null}
          </div>
          <div className="field">
            <label htmlFor="m-int">Billing interval</label>
            <select id="m-int" className="input" value={f.interval} onChange={set('interval')}>
              <option value="monthly">Monthly</option>
              <option value="annual">Annual</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="m-cat">Category</label>
            <select id="m-cat" className="input" value={f.category} onChange={set('category')}>
              {CATEGORIES.filter((c) => c !== 'All').map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="m-own">Owner</label>
            <select id="m-own" className="input" value={f.owner} onChange={set('owner')}>
              <option value="nancy">Nancy</option>
              <option value="brian">Brian</option>
              <option value="household">Household</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="m-kind">Type</label>
            <select id="m-kind" className="input" value={f.kind} onChange={set('kind')}>
              <option value="subscription">Subscription</option>
              <option value="bill">Household bill</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="m-date">Next charge</label>
            <input id="m-date" className="input" type="date" value={f.nextChargeAt} onChange={set('nextChargeAt')} />
            {err.nextChargeAt ? <span className="err">{err.nextChargeAt}</span> : null}
          </div>
        </div>
      </div>
    </Sheet>
  );
}

// ---------------------------------------------------------------- timeline

function Timeline() {
  const { state, setSheet } = useStore();
  const [mode, setMode] = useState('list');
  const [days, setDays] = useState(30);
  const rows = scheduledInWindow(state, days);

  const groups = useMemo(() => {
    const map = new Map();
    for (const o of rows) {
      const key = o.dueAt.slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(o);
    }
    return [...map.entries()];
  }, [rows]);

  const total = rows.reduce((a, o) => a + o.amountCents, 0);

  return (
    <>
      <div className="row between wrap gap-sm" style={{ marginBottom: 12 }}>
        <div>
          <h2>Upcoming recurring payments</h2>
          <p className="small muted" style={{ marginTop: 2 }}>
            {rows.length} scheduled charges totalling <Money cents={total} /> over {days} days.
            Annual plans appear on their actual renewal date.
          </p>
        </div>
        <div className="row gap-sm">
          <select className="input" style={{ width: 'auto' }} value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Window">
            <option value={30}>30 days</option>
            <option value={60}>60 days</option>
            <option value={90}>90 days</option>
          </select>
          <div className="tabs" style={{ flex: 'none' }} role="tablist" aria-label="View">
            <button type="button" role="tab" aria-selected={mode === 'list'} onClick={() => setMode('list')} aria-label="List view"><List size={15} /></button>
            <button type="button" role="tab" aria-selected={mode === 'cal'} onClick={() => setMode('cal')} aria-label="Calendar view"><CalendarDays size={15} /></button>
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <Empty icon="◷" title="No scheduled recurring payments in this window" />
      ) : mode === 'cal' ? (
        <CalendarView state={state} rows={rows} days={days} onOpen={(id) => setSheet({ kind: 'payment', paymentId: id })} />
      ) : (
        groups.map(([day, list]) => (
          <div className="daygroup" key={day}>
            <div className="dayhead">
              <span>{longDate(`${day}T12:00:00.000Z`)}</span>
              <span className="dim tiny">{relativeDay(state, `${day}T12:00:00.000Z`)}</span>
              <span className="dline" />
              <Money cents={list.reduce((a, o) => a + o.amountCents, 0)} className="dim tiny" />
            </div>
            <div className="stack-sm">
              {list.map((o) => {
                const p = paymentById(state, o.paymentId);
                return (
                  <button key={o.id} type="button" className="lrow" onClick={() => setSheet({ kind: 'payment', paymentId: o.paymentId })}>
                    <Avatar name={p?.merchant || '?'} />
                    <div className="grow">
                      <div style={{ fontWeight: 550 }}>{p?.merchant}</div>
                      <div className="tiny dim">
                        {o.kind === 'trial_conversion' ? 'First charge after trial' : o.kind === 'bill' ? 'Household bill' : 'Renewal'}
                        {p?.variableEstimate ? ' · estimated from the latest bill' : ''}
                      </div>
                    </div>
                    <Money cents={o.amountCents} />
                  </button>
                );
              })}
            </div>
          </div>
        ))
      )}
    </>
  );
}

function CalendarView({ state, rows, days, onOpen }) {
  const start = Date.parse(state.nowISO);
  const byDay = new Map();
  for (const o of rows) {
    const k = Math.floor((Date.parse(o.dueAt) - start) / 86400000);
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k).push(o);
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 5 }}>
      {Array.from({ length: days }, (_, i) => {
        const list = byDay.get(i) || [];
        const iso = new Date(start + i * 86400000).toISOString();
        const sum = list.reduce((a, o) => a + o.amountCents, 0);
        return (
          <button
            key={i}
            type="button"
            className="card"
            style={{ padding: 7, minHeight: 62, textAlign: 'left', opacity: list.length ? 1 : 0.42 }}
            onClick={() => list.length && onOpen(list[0].paymentId)}
            disabled={!list.length}
            aria-label={`${shortDate(iso)}: ${list.length} payments`}
          >
            <div className="tiny dim">{shortDate(iso)}</div>
            {list.length ? (
              <>
                <div className="num tiny" style={{ fontWeight: 640, marginTop: 3 }}>{formatMoney(sum)}</div>
                <div className="tiny dim">{list.length} item{list.length > 1 ? 's' : ''}</div>
              </>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------- money preview

function Preview() {
  const { state, setSheet, notify, run } = useStore();
  const [scenario, setScenario] = useState({});
  const [days, setDays] = useState(30);
  const [reviewing, setReviewing] = useState(false);
  const [targetOpen, setTargetOpen] = useState(false);

  const totals = forecastTotals(state, scenario, days);
  const nowCommit = monthlyCommitment(state);
  const propCommit = scenarioMonthlyCommitment(state, scenario);
  const selected = Object.entries(scenario).filter(([, v]) => v !== 'keep');

  const eligible = state.payments
    .filter((p) => isActive(p))
    .filter((p) => p.kind !== 'bill' || p.id === 'p_harbor')
    .sort((a, b) => monthlyEquivalent(b) - monthlyEquivalent(a));

  const setChoice = (id, choice) =>
    setScenario((s) => {
      const next = { ...s };
      if (choice === 'keep') delete next[id];
      else next[id] = choice;
      return next;
    });

  const maxBar = Math.max(totals.baselineCents, totals.proposedCents, 1);

  return (
    <>
      <div className="row between wrap gap-sm" style={{ marginBottom: 12 }}>
        <div>
          <h2>Money Preview</h2>
          <p className="small muted" style={{ marginTop: 2 }}>
            Explore choices. Nothing changes until you approve it.
          </p>
        </div>
        <div className="row gap-sm">
          <select className="input" style={{ width: 'auto' }} value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Forecast window">
            <option value={30}>Next 30 days</option>
            <option value={60}>Next 60 days</option>
            <option value={90}>Next 90 days</option>
          </select>
          <button type="button" className="btn" onClick={() => setTargetOpen(true)}>
            <Target size={15} /> Find an amount
          </button>
        </div>
      </div>

      <Card className="pad-lg">
        <div className="eyebrow">Scheduled recurring outgoings, next {days} days</div>
        <div className="fc" style={{ marginTop: 12 }}>
          <div className="fc-row">
            <span className="fc-label">Baseline</span>
            <div className="fc-track">
              <div className="fc-fill base" style={{ width: `${(totals.baselineCents / maxBar) * 100}%` }}>
                {formatMoney(totals.baselineCents)}
              </div>
            </div>
          </div>
          <div className="fc-row">
            <span className="fc-label">Proposed</span>
            <div className="fc-track">
              <div className="fc-fill prop" style={{ width: `${(totals.proposedCents / maxBar) * 100}%` }}>
                {formatMoney(totals.proposedCents)}
              </div>
            </div>
          </div>
        </div>

        <div className="row between wrap gap-sm" style={{ marginTop: 14 }}>
          <div>
            <div className="tiny dim">Difference over {days} days</div>
            <div className="num" style={{ fontSize: 21, fontWeight: 660, color: totals.differenceCents ? 'var(--emerald)' : 'var(--text)' }}>
              {formatMoney(totals.differenceCents)}
            </div>
          </div>
          <div>
            <div className="tiny dim">Ongoing monthly commitment</div>
            <div className="num" style={{ fontSize: 21, fontWeight: 660 }}>
              {formatMoney(nowCommit)}
              {propCommit !== nowCommit ? (
                <span style={{ color: 'var(--emerald)' }}> → {formatMoney(propCommit)}</span>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            className="btn primary wide"
            disabled={!selected.length}
            onClick={() => setReviewing(true)}
          >
            Review these actions{selected.length ? ` (${selected.length})` : ''}
          </button>
        </div>

        {totals.changedRows.length ? (
          <div className="callout" style={{ marginTop: 13 }}>
            <div className="eyebrow" style={{ marginBottom: 6 }}>What changes in this window</div>
            <div className="stack-sm">
              {totals.changedRows.map((r) => (
                <div className="row between gap-sm" key={r.obligationId}>
                  <span className="small">
                    {r.merchant} · {shortDate(r.dueAt)}
                    {r.note ? <span className="tiny dim"> — {r.note}</span> : null}
                  </span>
                  <span className="small num" style={{ color: 'var(--emerald)', flex: 'none' }}>
                    −{formatMoney(r.baselineCents - r.proposedCents)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <p className="tiny dim" style={{ marginTop: 11 }}>
          Annualized effects are shown per choice below. An annualized figure is a projection at today's
          price, never money already saved. This forecasts recurring outgoings only, not your balance.
        </p>
      </Card>

      <div className="section">
        <div className="section-head">
          <h2>Your choices</h2>
          <span className="tiny dim">Only options this provider actually supports are offered.</span>
        </div>
        <div className="stack-sm">
          {eligible.map((p) => {
            const choice = scenario[p.id] || 'keep';
            const m = monthlyEquivalent(p);
            const dl = decisionDeadline(p);
            return (
              <div className="card" key={p.id}>
                <div className="row between gap-sm wrap">
                  <div className="row gap-sm grow" style={{ minWidth: 0 }}>
                    <Avatar name={p.merchant} />
                    <div className="grow" style={{ minWidth: 0 }}>
                      <div className="row gap-sm" style={{ alignItems: 'baseline' }}>
                        <span style={{ fontWeight: 560 }}>{p.merchant}</span>
                        {p.kind === 'trial' ? <Chip tone="amber">Trial</Chip> : null}
                        {p.favorite ? <Chip tone="emerald">Favorite</Chip> : null}
                        {p.essential ? <Chip tone="blue">Essential</Chip> : null}
                      </div>
                      <div className="tiny dim">
                        <Money cents={m} />/mo
                        {p.kind === 'trial' ? ' after conversion' : ''}
                        {dl ? ` · decide by ${shortDate(dl)}` : ''}
                      </div>
                    </div>
                  </div>
                  <div className="row gap-sm wrap" style={{ flex: 'none' }}>
                    <button type="button" className={`btn sm ${choice === 'keep' ? 'primary' : ''}`} onClick={() => setChoice(p.id, 'keep')} aria-pressed={choice === 'keep'}>Keep</button>
                    {p.pauseOption ? (
                      <button type="button" className={`btn sm ${choice === 'pause' ? 'primary' : ''}`} onClick={() => setChoice(p.id, 'pause')} aria-pressed={choice === 'pause'}>Pause</button>
                    ) : null}
                    {p.downgradeOption ? (
                      <button type="button" className={`btn sm ${choice === 'downgrade' ? 'primary' : ''}`} onClick={() => setChoice(p.id, 'downgrade')} aria-pressed={choice === 'downgrade'}>Downgrade</button>
                    ) : null}
                    {p.essential ? (
                      <button type="button" className="btn sm" onClick={() => setSheet({ kind: 'payment', paymentId: p.id })}>Review</button>
                    ) : (
                      <button type="button" className={`btn sm ${choice === 'cancel' ? 'danger' : ''}`} onClick={() => setChoice(p.id, 'cancel')} aria-pressed={choice === 'cancel'}>Cancel</button>
                    )}
                  </div>
                </div>

                {choice === 'cancel' && p.kind !== 'trial' ? (
                  <p className="tiny" style={{ marginTop: 9, color: 'var(--emerald)' }}>
                    Ongoing reduction of <Money cents={annualized(m)} />/year at today's price, if cancelled.
                    This is a projection, not cash.
                  </p>
                ) : null}
                {choice === 'cancel' && p.kind === 'trial' ? (
                  <p className="tiny" style={{ marginTop: 9, color: 'var(--emerald)' }}>
                    Prevents the <Money cents={p.trial?.firstChargeCents ?? p.amountCents} /> first charge.
                    A trial is not in your active paid commitment, so this does not reduce the {formatMoney(nowCommit)} figure.
                  </p>
                ) : null}
                {choice === 'pause' && p.pauseOption ? (
                  <p className="tiny muted" style={{ marginTop: 9 }}>{p.pauseOption.terms}</p>
                ) : null}
                {choice === 'downgrade' && p.downgradeOption ? (
                  <p className="tiny muted" style={{ marginTop: 9 }}>{p.downgradeOption.losing}</p>
                ) : null}
                {p.essential ? (
                  <p className="tiny dim" style={{ marginTop: 9 }}>
                    Essential service. Excluded from bulk cancellation. Review its coverage or compare
                    alternatives from its detail view instead.
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {reviewing ? (
        <ReviewChecklist scenario={scenario} onClose={() => setReviewing(false)} onApplied={(id) => setChoice(id, 'keep')} />
      ) : null}
      {targetOpen ? <TargetFinder onClose={() => setTargetOpen(false)} onApply={setScenario} /> : null}
    </>
  );
}

function ReviewChecklist({ scenario, onClose, onApplied }) {
  const { state, run, notify } = useStore();
  const entries = Object.entries(scenario).filter(([, v]) => v !== 'keep');
  const [done, setDone] = useState({});

  const approve = (id, choice) => {
    const p = paymentById(state, id);
    if (!p) return;
    if (choice === 'cancel') run.approveCancellation(id);
    else if (choice === 'pause') run.applyPause(id);
    else if (choice === 'downgrade') run.applyDowngrade(id);
    setDone((d) => ({ ...d, [id]: true }));
    onApplied(id);
    notify(`${p.merchant}: demo ${choice} recorded.`, 'good');
  };

  const remaining = entries.filter(([id]) => !done[id]);

  return (
    <Sheet
      title="Review these actions"
      subtitle="Each one is approved separately. Nothing is submitted until you approve it here."
      onClose={onClose}
      footer={<button type="button" className="btn grow" onClick={onClose}>
        {remaining.length ? 'Keep the rest as a proposal' : 'Done'}
      </button>}
    >
      <div className="stack">
        {entries.map(([id, choice]) => {
          const p = paymentById(state, id);
          if (!p) return null;
          const m = monthlyEquivalent(p);
          const isDone = done[id];
          return (
            <div className={`card ${isDone ? '' : ''}`} key={id}>
              <div className="row between gap-sm wrap">
                <div className="grow">
                  <div style={{ fontWeight: 570 }}>{p.merchant}</div>
                  <div className="tiny dim" style={{ marginTop: 2 }}>
                    {choice === 'cancel' ? 'Cancel' : choice === 'pause' ? `Pause for ${p.pauseOption?.months} month` : `Downgrade to ${p.downgradeOption?.planName}`}
                    {' · effective '}{longDate(state.nowISO)}
                  </div>
                  {choice === 'cancel' && p.kind !== 'trial' ? (
                    <div className="tiny" style={{ color: 'var(--emerald)', marginTop: 4 }}>
                      <Money cents={annualized(m)} />/year annualized reduction at today's price (a projection).
                    </div>
                  ) : null}
                  {p.accessThrough ? (
                    <div className="tiny dim" style={{ marginTop: 3 }}>
                      Access {p.trial?.accessEndsImmediately ? 'ends immediately on cancellation' : `continues to ${shortDate(p.accessThrough)}`}.
                    </div>
                  ) : null}
                </div>
                {isDone ? (
                  <Chip tone="emerald">Approved in demo</Chip>
                ) : (
                  <button type="button" className="btn primary sm" onClick={() => approve(id, choice)}>
                    Approve (simulated)
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {!entries.length ? <p className="small muted">Nothing selected yet.</p> : null}
        <p className="tiny dim">
          Approving records a simulated request in this demo. No provider is contacted and no real
          subscription is cancelled.
        </p>
      </div>
    </Sheet>
  );
}

function TargetFinder({ onClose, onApply }) {
  const { state } = useStore();
  const [amount, setAmount] = useState('50');
  const cents = Math.round((Number.parseFloat(amount) || 0) * 100);
  const r = findTarget(state, cents);

  return (
    <Sheet
      title="Find an amount"
      subtitle="Built only from eligible records you have not protected. Nothing is cancelled here."
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            className="btn primary grow"
            disabled={!r.picks.length}
            onClick={() => {
              onApply(Object.fromEntries(r.picks.map((p) => [p.paymentId, 'cancel'])));
              onClose();
            }}
          >
            Load {r.picks.length} into the preview
          </button>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
        </>
      }
    >
      <div className="field" style={{ marginBottom: 14 }}>
        <label htmlFor="tgt">Target reduction per month (USD)</label>
        <input id="tgt" className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </div>

      <div className={`callout ${r.achievable ? 'emerald' : 'amber'}`}>
        {r.achievable ? (
          <>
            <div style={{ fontWeight: 570 }}>
              Found <Money cents={r.achievedCents} />/month in candidate reductions
            </div>
            <p className="tiny muted" style={{ marginTop: 4 }}>
              These are proposals. They become real only if you approve each one.
            </p>
          </>
        ) : (
          <>
            <div style={{ fontWeight: 570 }}>
              Available: <Money cents={r.achievedCents} />/month. Short by <Money cents={r.gapCents} />.
            </div>
            <p className="tiny muted" style={{ marginTop: 4 }}>
              SubKill will not pad the answer with reductions that are not actually available.
            </p>
          </>
        )}
      </div>

      <div className="stack-sm" style={{ marginTop: 14 }}>
        {r.picks.map((p) => (
          <div className="row between" key={p.opportunityId}>
            <span className="small">{p.merchant}</span>
            <Money cents={p.monthlyCents} className="small" />
          </div>
        ))}
      </div>

      {r.skipped.length ? (
        <>
          <div className="eyebrow" style={{ marginTop: 16, marginBottom: 7 }}>Left alone</div>
          <div className="stack-sm">
            {r.skipped.map((s, i) => (
              <div className="row between gap-sm" key={`${s.merchant}-${i}`}>
                <span className="small">{s.merchant}</span>
                <span className="tiny dim" style={{ textAlign: 'right' }}>{s.reason}</span>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </Sheet>
  );
}

// ---------------------------------------------------------------- trials

function Trials() {
  const { state, setSheet } = useStore();
  const trials = activeTrials(state);
  const deadlines = state.payments.filter((p) => isActive(p) && p.contract);

  return (
    <>
      <h2>Free trials</h2>
      <p className="small muted" style={{ marginTop: 2, marginBottom: 14 }}>
        A trial becomes a paid plan on a fixed date. These are not part of your active paid commitment yet.
      </p>

      {trials.length === 0 ? (
        <Empty icon="◷" title="No unconverted trials" body="Trials you cancel or that convert move into your recurring payments list." />
      ) : (
        <div className="stack">
          {trials.map((p) => {
            const h = hoursUntil(state, p.trial.convertsAt);
            return (
              <Card key={p.id} className="pad-lg">
                <div className="row between gap-sm wrap">
                  <div className="row gap-sm grow">
                    <Avatar name={p.merchant} />
                    <div>
                      <div style={{ fontWeight: 570 }}>{p.merchant}</div>
                      <div className="tiny dim">{p.plan}</div>
                    </div>
                  </div>
                  <Chip tone={h <= 36 ? 'amber' : 'blue'}>
                    {h <= 36 ? 'Converts tomorrow' : `Converts in ${Math.ceil(h / 24)} days`}
                  </Chip>
                </div>

                <div className="grid2" style={{ marginTop: 13 }}>
                  <div>
                    <div className="tiny dim">Decision deadline</div>
                    <div className="small num">{longDate(p.trial.decisionDeadlineAt)}</div>
                  </div>
                  <div>
                    <div className="tiny dim">Converts on</div>
                    <div className="small num">{longDate(p.trial.convertsAt)}</div>
                  </div>
                  <div>
                    <div className="tiny dim">First charge</div>
                    <div className="small num"><Money cents={p.trial.firstChargeCents} /></div>
                  </div>
                  <div>
                    <div className="tiny dim">Price after that</div>
                    <div className="small num"><Money cents={p.trial.laterCents} />/month</div>
                  </div>
                </div>

                <p className="tiny muted" style={{ marginTop: 11 }}>
                  {p.trial.accessEndsImmediately
                    ? 'Cancelling ends access immediately with this provider.'
                    : 'Cancelling keeps access to the end of the trial period.'}
                </p>

                <div className="btnrow" style={{ marginTop: 13 }}>
                  <button type="button" className="btn primary sm" onClick={() => setSheet({ kind: 'payment', paymentId: p.id })}>
                    Rescue this trial
                  </button>
                  <button type="button" className="btn sm" onClick={() => setSheet({ kind: 'reminder', paymentId: p.id })}>
                    Edit reminder
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <div className="section">
        <div className="section-head"><h2>Decision deadlines</h2></div>
        <p className="small muted" style={{ marginBottom: 12 }}>
          A renewal can be weeks away while the last date you can act is much sooner.
        </p>
        {deadlines.map((p) => {
          const dl = decisionDeadline(p);
          return (
            <Card key={p.id}>
              <div className="row between gap-sm wrap">
                <div className="grow">
                  <div style={{ fontWeight: 560 }}>{p.merchant}</div>
                  <div className="tiny dim" style={{ marginTop: 2 }}>
                    Renews {longDate(p.nextChargeAt)} · {p.contract.noticeDays} days notice required
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="tiny dim">Decide by</div>
                  <div className="small num" style={{ color: 'var(--amber)', fontWeight: 620 }}>{longDate(dl)}</div>
                </div>
              </div>
              <div className="btnrow" style={{ marginTop: 11 }}>
                <button type="button" className="btn sm" onClick={() => setSheet({ kind: 'contract', paymentId: p.id })}>
                  Read the clause
                </button>
                <button type="button" className="btn sm ghost" onClick={() => setSheet({ kind: 'payment', paymentId: p.id })}>
                  Open details
                </button>
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}

// ---------------------------------------------------------------- shell

export default function MoneyScreen() {
  const { route, go, state } = useStore();
  const sub = route.sub || 'list';
  const trials = activeTrials(state).length;

  return (
    <>
      <header style={{ marginBottom: 14 }}>
        <h1>Money</h1>
        <p className="muted small" style={{ marginTop: 3 }}>
          Every recurring payment, when it is due, and what changes if you act.
        </p>
      </header>
      <Tabs
        label="Money sections"
        value={sub}
        onChange={(v) => go('money', v)}
        options={[
          { value: 'list', label: `Recurring (${activeSubscriptions(state).length + activeBills(state).length})` },
          { value: 'timeline', label: 'Timeline' },
          { value: 'preview', label: 'Money Preview' },
          { value: 'trials', label: `Trials (${trials})` },
        ]}
      />
      <div style={{ marginTop: 18 }}>
        {sub === 'list' ? <RecurringList /> : null}
        {sub === 'timeline' ? <Timeline /> : null}
        {sub === 'preview' ? <Preview /> : null}
        {sub === 'trials' ? <Trials /> : null}
      </div>
    </>
  );
}
