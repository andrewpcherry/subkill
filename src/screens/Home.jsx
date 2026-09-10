import React, { useMemo, useState } from 'react';
import { ArrowRight, CalendarDays, CheckCircle2, ShieldCheck } from 'lucide-react';
import { useStore } from '../store.jsx';
import { Card, Chip, Money, WhyPopover } from '../ui.jsx';
import {
  annualizedCommitment, candidateAnnualReduction, dataFreshness, decisionQueue,
  formatMoney, longDate, monthlyCommitment, nextReviewDate, relativeDay,
  scheduledInWindow, shortDate, topDecisions, trackedItems,
} from '../state/derive.ts';

function LedgerRow({ label, value, note }) {
  return (
    <div className="ledger-row">
      <div className="grow">
        <div className="lbl">{label}</div>
        <div className="note">{note}</div>
      </div>
      <span className="val num">{value}</span>
    </div>
  );
}

function greeting(nowISO) {
  const h = new Date(nowISO).getUTCHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

/**
 * The opening miniature. Real scheduled charges over the next 30 days, with the
 * two flagged decisions highlighted and a control that shows what resolving
 * them does to the run of upcoming payments.
 */
function TimelineMini({ state, onOpen }) {
  const [resolved, setResolved] = useState(false);
  const rows = useMemo(() => scheduledInWindow(state, 30), [state]);
  const highlighted = new Set(['p_netflix', 'p_canva']);

  const days = useMemo(() => {
    const start = Date.parse(state.nowISO);
    const buckets = Array.from({ length: 30 }, (_, i) => ({ i, cents: 0, hl: 0, label: '' }));
    for (const o of rows) {
      const idx = Math.min(29, Math.max(0, Math.floor((Date.parse(o.dueAt) - start) / 86400000)));
      buckets[idx].cents += o.amountCents;
      if (highlighted.has(o.paymentId)) buckets[idx].hl += o.amountCents;
    }
    return buckets;
  }, [rows, state.nowISO]);

  const max = Math.max(...days.map((d) => d.cents), 1);
  const total = days.reduce((a, d) => a + d.cents, 0);
  const flagged = days.reduce((a, d) => a + d.hl, 0);
  const shown = resolved ? total - flagged : total;

  return (
    <Card className="pad-lg">
      <div className="eyebrow">Scheduled · next 30 days</div>
      <div className="figure xl" style={{ marginTop: 8 }}>{formatMoney(shown)}</div>
      <div className="row between wrap gap-sm" style={{ marginTop: 10 }}>
        <span className="small muted">of recurring payments</span>
        <button
          type="button"
          className={`btn sm ${resolved ? 'primary' : ''}`}
          onClick={() => setResolved((v) => !v)}
          aria-pressed={resolved}
        >
          {resolved ? 'Both resolved' : 'Show both resolved'}
        </button>
      </div>

      <div className="mini" style={{ marginTop: 18 }}>
        <div className="mini-track" role="img" aria-label={`Scheduled recurring payments for the next 30 days, totalling ${formatMoney(shown)}`}>
          {days.map((d) => {
            const value = resolved ? d.cents - d.hl : d.cents;
            const h = d.cents === 0 ? 3 : Math.max(4, Math.round((value / max) * 88));
            const cls = d.hl > 0 ? (resolved ? 'gone' : 'hl') : d.cents > 0 ? 'kept' : '';
            return <div key={d.i} className={`mini-bar ${cls}`} style={{ height: `${h}px` }} />;
          })}
        </div>
        <div className="mini-axis tiny dim">
          <span>{shortDate(state.nowISO)}</span>
          <span>{shortDate(new Date(Date.parse(state.nowISO) + 29 * 86400000).toISOString())}</span>
        </div>
      </div>

      <div className="row gap-sm wrap" style={{ marginTop: 12 }}>
        <Chip tone="amber">2 decisions in the next 24 hours</Chip>
        {resolved ? (
          <Chip tone="emerald">
            <Money cents={flagged} /> of scheduled payments removed
          </Chip>
        ) : null}
        <button type="button" className="btn ghost sm" onClick={onOpen} style={{ marginLeft: 'auto' }}>
          Open Money Preview <ArrowRight size={14} />
        </button>
      </div>
      <p className="tiny dim" style={{ marginTop: 10 }}>
        Scheduled recurring payments only, not a balance forecast.
      </p>
    </Card>
  );
}

export default function Home() {
  const { state, go, setSheet } = useStore();
  const top = topDecisions(state);
  const all = decisionQueue(state);
  const items = trackedItems(state);
  const fresh = dataFreshness(state);
  const upcoming = scheduledInWindow(state, 30);
  const review = nextReviewDate(state);

  const openDecision = (card) => {
    if (card.paymentId === 'p_harbor') setSheet({ kind: 'bill', paymentId: 'p_harbor' });
    else if (card.priority === 0) setSheet({ kind: 'case', paymentId: card.paymentId });
    else setSheet({ kind: 'payment', paymentId: card.paymentId });
  };

  return (
    <>
      <header style={{ marginBottom: 18 }}>
        <h1>{greeting(state.nowISO)}, Nancy</h1>
        <p className="muted" style={{ marginTop: 4 }}>
          {top.length ? "Here's what needs your attention." : 'Nothing needs your decision right now.'}
        </p>
      </header>

      <TimelineMini state={state} onOpen={() => go('money', 'preview')} />

      <section className="section">
        <div className="section-head">
          <h2>
            {top.length
              ? `${top.length} decision${top.length === 1 ? '' : 's'} worth your attention`
              : 'Your queue is clear'}
          </h2>
          {all.length > top.length ? (
            <button type="button" className="btn ghost sm" onClick={() => go('alerts')}>
              See all {all.length}
            </button>
          ) : null}
        </div>

        {top.length ? (
          <div>
            {top.map((card, i) => (
              <div className={`decision ${card.tone}`} key={card.id}>
                <div className="idx">{String(i + 1).padStart(2, '0')}</div>
                <div className="grow">
                  <div className="row between gap-sm" style={{ alignItems: 'baseline' }}>
                    <h3 className="grow">{card.title}</h3>
                    <Money cents={card.amountCents} className="small dim" />
                  </div>
                  <p className="small muted" style={{ marginTop: 4 }}>{card.detail}</p>
                  <div className="row gap-sm wrap" style={{ marginTop: 12 }}>
                    <button type="button" className="btn sm primary" onClick={() => openDecision(card)}>
                      {card.action}
                    </button>
                    <WhyPopover
                      why={card.why}
                      evidence={state.evidence.filter((e) => card.evidenceIds.includes(e.id))}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Card className="pad-lg">
            <div className="row gap-sm" style={{ alignItems: 'flex-start' }}>
              <CheckCircle2 size={19} color="var(--emerald)" style={{ marginTop: 2, flex: 'none' }} />
              <div>
                <h3>Nothing needs your decision right now.</h3>
                <p className="small muted" style={{ marginTop: 4 }}>
                  {review
                    ? `The next thing worth reviewing is on ${longDate(review)}. SubKill keeps watching until then.`
                    : 'SubKill keeps watching your recurring payments.'}
                </p>
                <div className="btnrow" style={{ marginTop: 12 }}>
                  <button type="button" className="btn sm" onClick={() => go('money', 'timeline')}>
                    View timeline
                  </button>
                  <button type="button" className="btn sm ghost" onClick={() => go('savings')}>
                    See what changed
                  </button>
                </div>
              </div>
            </div>
          </Card>
        )}
      </section>

      <section className="section">
        <button type="button" className="lrow" onClick={() => go('money', 'timeline')}>
          <CalendarDays size={17} color="var(--text-3)" style={{ flex: 'none' }} />
          <div className="grow">
            <div style={{ fontWeight: 550 }}>Everything else is on your timeline</div>
            <div className="tiny dim">
              {upcoming.length} scheduled recurring payments in the next 30 days. Next:{' '}
              {upcoming[0] ? `${upcoming[0].paymentId.replace('p_', '')} ${relativeDay(state, upcoming[0].dueAt).toLowerCase()}` : 'none'}
            </div>
          </div>
          <ArrowRight size={15} color="var(--text-3)" />
        </button>
      </section>

      <section className="section">
        <div className="section-head"><h2>Where you stand</h2></div>
        <div className="ledger">
          <LedgerRow
            label="Active recurring commitment"
            value={formatMoney(monthlyCommitment(state))}
            note="Per month equivalent. Annual plans spread across 12 months; unconverted trials are not counted."
          />
          <LedgerRow
            label="Annualized commitment"
            value={formatMoney(annualizedCommitment(state), { cents: false })}
            note="At today's rates. Not a guarantee of next year's bills."
          />
          <LedgerRow
            label="Candidate reductions"
            value={`${formatMoney(candidateAnnualReduction(state))}/yr`}
            note="Proposed possibilities you have not acted on. Not savings."
          />
          <LedgerRow
            label="Decisions awaiting you"
            value={String(all.length)}
            note={all.length ? 'Each one has evidence and a recommended next step.' : 'Your queue is clear.'}
          />
          <button type="button" className="ledger-row" onClick={() => go('money', 'list')}>
            <div className="grow">
              <div className="lbl row gap-sm" style={{ alignItems: 'center' }}>
                <ShieldCheck size={13} color="var(--emerald)" />
                Monitoring coverage
              </div>
              <div className="note">
                {items.subscriptions} subscriptions · {items.bills} bills · {items.trials} trials · {fresh.label}
              </div>
            </div>
            <span className="val num">{items.total}</span>
          </button>
        </div>
      </section>
    </>
  );
}
