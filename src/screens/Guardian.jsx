import React, { useMemo, useRef, useState } from 'react';
import { Send, Sparkles } from 'lucide-react';
import { useStore } from '../store.jsx';
import { Card, Chip, Money, Toggle } from '../ui.jsx';
import {
  activeTrials, candidateAnnualReduction, candidateMonthlyReduction,
  confirmedAnnualReduction, dataFreshness, decisionQueue, findTarget, formatMoney,
  harborComparison, longDate, monthlyCommitment, openOpportunities, paymentById,
  relativeDay, shortDate, trackedItems,
} from '../state/derive.ts';

const PRESETS = [
  'What needs me today?',
  'Find $50/month without touching my favorites',
  'Why did my internet bill increase?',
  'What happens if I keep everything?',
  'Show my trial deadlines',
  'Have any cancelled services charged again?',
];

/**
 * Deterministic local intent handler. Every answer is computed from current
 * state, so it changes the moment a decision is made or the clock moves.
 */
function answer(q, state) {
  const t = q.toLowerCase();
  const money = (c) => formatMoney(c);

  if (/(needs me|today|attention|what should i)/.test(t)) {
    const queue = decisionQueue(state);
    if (!queue.length) {
      return {
        text: 'Nothing needs your decision right now. Your queue is clear.',
        rows: [],
      };
    }
    return {
      text: `${queue.length} thing${queue.length === 1 ? '' : 's'} need you.`,
      rows: queue.map((c) => ({ label: c.title, note: c.detail, action: c })),
    };
  }

  if (/(find|save|reduce|cut).*(\$?\d+)/.test(t) || /find .*month/.test(t)) {
    const m = t.match(/\$?(\d+(?:\.\d+)?)/);
    const target = Math.round((m ? Number.parseFloat(m[1]) : 50) * 100);
    const r = findTarget(state, target);
    return {
      text: r.achievable
        ? `I can put together ${money(r.achievedCents)} a month in candidate reductions without touching anything you marked favorite or essential. These are proposals, not savings, until you approve each one.`
        : `The most I can find without touching favorites or essentials is ${money(r.achievedCents)} a month, which is ${money(r.gapCents)} short of ${money(target)}. I will not pad that with reductions that are not actually available.`,
      rows: r.picks.map((p) => ({ label: p.merchant, note: `${money(p.monthlyCents)}/month`, paymentId: p.paymentId })),
      footnote: r.skipped.length ? `Left alone: ${r.skipped.map((s) => `${s.merchant} (${s.reason.toLowerCase().replace(/\.$/, '')})`).join(', ')}.` : null,
    };
  }

  if (/(internet|harbor|bill.*(up|increase|rise))/.test(t)) {
    const c = harborComparison(state);
    if (!c.available) return { text: c.reason, rows: [] };
    return {
      text: `${c.explanation} That is +${money(c.deltaCents)} a month, about ${c.percent.toFixed(1)}%, or +${money(c.annualIfSustained)} a year if the new rate continues.`,
      rows: [
        { label: `${c.previous.periodLabel} total`, note: money(c.previous.total) },
        { label: `${c.current.periodLabel} total`, note: money(c.current.total) },
      ],
      open: { kind: 'bill', paymentId: 'p_harbor' },
      openLabel: 'Open the bill comparison',
    };
  }

  if (/keep everything|do nothing|if i keep/.test(t)) {
    const m = monthlyCommitment(state);
    const items = trackedItems(state);
    const trials = activeTrials(state);
    const trialAdd = trials.reduce((a, p) => a + (p.trial?.laterCents ?? 0), 0);
    return {
      text: `You stay at ${money(m)} a month across ${items.subscriptions} subscriptions and ${items.bills} bills, which is ${money(m * 12)} over twelve months at today's rates. ${trials.length ? `If both trials convert, that becomes ${money(m + trialAdd)} a month.` : ''}`,
      rows: [
        { label: 'Candidate reductions left on the table', note: `${money(candidateAnnualReduction(state))}/yr` },
        { label: 'Already confirmed in this demo', note: `${money(confirmedAnnualReduction(state))}/yr` },
      ],
      footnote: 'Annualized figures are projections at today\'s prices, not money in hand.',
    };
  }

  if (/trial/.test(t)) {
    const trials = activeTrials(state);
    if (!trials.length) return { text: 'You have no unconverted trials right now.', rows: [] };
    return {
      text: `${trials.length} trial${trials.length === 1 ? '' : 's'} still to decide.`,
      rows: trials.map((p) => ({
        label: p.merchant,
        note: `Converts ${longDate(p.trial.convertsAt)} at ${money(p.trial.firstChargeCents)} · ${relativeDay(state, p.trial.convertsAt).toLowerCase()}`,
        paymentId: p.id,
      })),
    };
  }

  if (/(charged again|after cancel|charge after|still charging)/.test(t)) {
    const exceptions = state.cases.filter((c) => c.exceptionTxnId);
    const fresh = dataFreshness(state);
    if (!exceptions.length) {
      return {
        text: fresh.canVerifyAbsence
          ? 'No cancelled service has charged again in the simulated activity I can see.'
          : 'No charge after cancellation has appeared, but one of your sources is not current in this demo, so I cannot treat that as proof.',
        rows: [],
      };
    }
    return {
      text: `${exceptions.length} case${exceptions.length === 1 ? '' : 's'} where a charge posted after cancellation.`,
      rows: exceptions.map((c) => {
        const p = paymentById(state, c.paymentId);
        const tx = state.transactions.find((x) => x.id === c.exceptionTxnId);
        return {
          label: p?.merchant || 'Service',
          note: `${money(tx?.amountCents ?? 0)} on ${shortDate(tx?.postedAt ?? state.nowISO)} · ${c.stage === 'resolved' ? 'refund credited' : 'unresolved'}`,
          open: { kind: 'case', paymentId: c.paymentId },
        };
      }),
    };
  }

  if (/(cancel|kill|stop)\s/.test(t)) {
    const open = openOpportunities(state).filter((o) => o.type === 'cancel');
    return {
      text: open.length
        ? `I can prepare any of these, but I will not cancel anything without your approval on each one.`
        : 'There is nothing I would suggest cancelling right now.',
      rows: open.map((o) => {
        const p = paymentById(state, o.paymentId);
        return { label: p?.merchant || '', note: `${money(o.monthlyReductionCents)}/month`, paymentId: o.paymentId };
      }),
    };
  }

  return {
    text: 'I cannot answer that one. This is a simulated assistant with a fixed set of things it understands.',
    rows: [],
    fallback: true,
  };
}

export default function Guardian() {
  const { state, setState, setSheet } = useStore();
  const [log, setLog] = useState([]);
  const [input, setInput] = useState('');
  const endRef = useRef(null);

  const queue = decisionQueue(state);
  const fresh = dataFreshness(state);
  const cases = state.cases.filter((c) => c.monitoring || c.exceptionTxnId);

  const ask = (q) => {
    const a = answer(q, state);
    setLog((l) => [...l, { q, a, id: `${Date.now()}-${l.length}` }]);
    setInput('');
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 40);
  };

  return (
    <>
      <header style={{ marginBottom: 6 }}>
        <div className="row gap-sm" style={{ alignItems: 'center' }}>
          <h1>Guardian</h1>
          <Chip tone="blue">Simulated assistant</Chip>
        </div>
        <p className="muted small" style={{ marginTop: 3 }}>
          Answers are computed from your current demo state, not written in advance. No AI service is called.
        </p>
      </header>

      <Card className="pad-lg" style={{ marginTop: 14 }}>
        <div className="eyebrow">Today's brief</div>
        <p style={{ marginTop: 6 }}>
          {queue.length
            ? `${queue.length} decision${queue.length === 1 ? '' : 's'} waiting. Your commitment is `
            : 'Nothing needs a decision. Your commitment is '}
          <strong className="num"><Money cents={monthlyCommitment(state)} /></strong> a month, with{' '}
          <strong className="num"><Money cents={candidateMonthlyReduction(state)} /></strong> a month of
          candidate reductions still open.
        </p>
        {!fresh.canVerifyAbsence ? (
          <div className="callout amber small" style={{ marginTop: 11 }}>
            One of your sources is not current in this demo. While that is true, a missing charge does not
            prove a payment stopped, so anything resting on an absence is marked awaiting verification.
          </div>
        ) : null}
        {cases.length ? (
          <div className="stack-sm" style={{ marginTop: 12 }}>
            <div className="eyebrow">Active cases</div>
            {cases.map((c) => {
              const p = paymentById(state, c.paymentId);
              return (
                <button key={c.id} type="button" className="lrow" onClick={() => setSheet({ kind: 'case', paymentId: c.paymentId })}>
                  <div className="grow">
                    <div className="small" style={{ fontWeight: 550 }}>{p?.merchant}</div>
                    <div className="tiny dim">
                      {c.exceptionTxnId && c.stage !== 'resolved' ? 'Charge after cancellation, unresolved' : c.stage === 'resolved' ? 'Resolved' : 'Monitoring future charges'}
                    </div>
                  </div>
                  <Chip tone={c.exceptionTxnId && c.stage !== 'resolved' ? 'red' : 'emerald'}>
                    {c.exceptionTxnId && c.stage !== 'resolved' ? 'Needs you' : 'Watching'}
                  </Chip>
                </button>
              );
            })}
          </div>
        ) : null}
      </Card>

      <div className="section">
        <div className="section-head"><h2>Ask</h2></div>
        <div className="filterbar" style={{ marginBottom: 12 }}>
          {PRESETS.map((p) => (
            <button key={p} type="button" className="chip" onClick={() => ask(p)} style={{ cursor: 'pointer' }}>
              {p}
            </button>
          ))}
        </div>

        <div className="stack">
          {log.map(({ q, a, id }) => (
            <div key={id}>
              <div className="row" style={{ justifyContent: 'flex-end', marginBottom: 7 }}>
                <div className="chip" style={{ background: 'var(--surface-3)', color: 'var(--text)', maxWidth: '85%', whiteSpace: 'normal', textAlign: 'left' }}>
                  {q}
                </div>
              </div>
              <Card>
                <div className="row gap-sm" style={{ alignItems: 'flex-start' }}>
                  <Sparkles size={15} color="var(--blue)" style={{ marginTop: 3, flex: 'none' }} />
                  <div className="grow">
                    <p className="small">{a.text}</p>
                    {a.rows?.length ? (
                      <div className="stack-sm" style={{ marginTop: 10 }}>
                        {a.rows.map((r, i) => (
                          <button
                            key={i}
                            type="button"
                            className="lrow"
                            onClick={() => {
                              if (r.open) setSheet(r.open);
                              else if (r.action) {
                                if (r.action.paymentId === 'p_harbor') setSheet({ kind: 'bill', paymentId: 'p_harbor' });
                                else setSheet({ kind: 'payment', paymentId: r.action.paymentId });
                              } else if (r.paymentId) setSheet({ kind: 'payment', paymentId: r.paymentId });
                            }}
                          >
                            <div className="grow">
                              <div className="small" style={{ fontWeight: 550 }}>{r.label}</div>
                              {r.note ? <div className="tiny dim">{r.note}</div> : null}
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : null}
                    {a.footnote ? <p className="tiny dim" style={{ marginTop: 9 }}>{a.footnote}</p> : null}
                    {a.open ? (
                      <button type="button" className="btn sm" style={{ marginTop: 11 }} onClick={() => setSheet(a.open)}>
                        {a.openLabel}
                      </button>
                    ) : null}
                    {a.fallback ? (
                      <div className="btnrow" style={{ marginTop: 11 }}>
                        {PRESETS.slice(0, 3).map((p) => (
                          <button key={p} type="button" className="btn sm ghost" onClick={() => ask(p)}>{p}</button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              </Card>
            </div>
          ))}
          <div ref={endRef} />
        </div>

        <form
          className="row gap-sm"
          style={{ marginTop: 14 }}
          onSubmit={(e) => { e.preventDefault(); if (input.trim()) ask(input.trim()); }}
        >
          <input
            className="input grow"
            placeholder="Ask about your recurring payments"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            aria-label="Ask Guardian"
          />
          <button type="submit" className="btn primary" disabled={!input.trim()} aria-label="Send">
            <Send size={15} />
          </button>
        </form>
      </div>

      <div className="section">
        <div className="section-head">
          <h2>Monitoring rules</h2>
          <span className="tiny dim">These change what SubKill raises. They authorize nothing.</span>
        </div>
        <div className="stack-sm">
          {state.rules.map((r) => (
            <Card key={r.id}>
              <div className="row between gap-sm">
                <span className="small grow">{r.text}</span>
                <Toggle
                  checked={r.enabled}
                  label={r.text}
                  onChange={(v) => {
                    setState((prev) => ({
                      ...prev,
                      rules: prev.rules.map((x) => (x.id === r.id ? { ...x, enabled: v } : x)),
                    }));
                  }}
                />
              </div>
            </Card>
          ))}
        </div>
        <p className="tiny dim" style={{ marginTop: 10 }}>
          Rules affect this demo's alert engine and which recommendations are eligible. They do not authorize
          real account actions or send real notifications.
        </p>
      </div>
    </>
  );
}
