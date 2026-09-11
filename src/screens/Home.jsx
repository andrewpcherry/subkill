import React, { useMemo, useState } from 'react';
import { ArrowRight, CalendarDays, CheckCircle2, Mail } from 'lucide-react';
import { useStore } from '../store.jsx';
import { CATEGORY_COLOR, Card, Chip, Money, Ring, Tile, WhyPopover } from '../ui.jsx';
import {
  annualizedCommitment, candidateAnnualReduction, dataFreshness, decisionQueue,
  formatMoney, isActive, longDate, monthlyCommitment, monthlyEquivalent,
  nextReviewDate, relativeDay, scanSummary, scheduledInWindow, shortDate,
  topDecisions, trackedItems,
} from '../state/derive.ts';

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
    const buckets = Array.from({ length: 30 }, (_, i) => ({ i, cents: 0, hl: 0 }));
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
    <Card className="hero pad-lg">
      <div className="eyebrow">Scheduled · next 30 days</div>
      <div className="figure xl" style={{ marginTop: 10 }}>{formatMoney(shown)}</div>
      <div className="row between wrap gap-sm" style={{ marginTop: 12 }}>
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

      <div className="mini" style={{ marginTop: 20 }}>
        <div
          className="mini-track"
          role="img"
          aria-label={`Scheduled recurring payments for the next 30 days, totalling ${formatMoney(shown)}`}
        >
          {days.map((d) => {
            const value = resolved ? d.cents - d.hl : d.cents;
            const h = d.cents === 0 ? 3 : Math.max(5, Math.round((value / max) * 90));
            const cls = d.hl > 0 ? (resolved ? 'gone' : 'hl') : '';
            return <div key={d.i} className={`mini-bar ${cls}`} style={{ height: `${h}px` }} />;
          })}
        </div>
        <div className="mini-axis tiny dim">
          <span>{shortDate(state.nowISO)}</span>
          <span>{shortDate(new Date(Date.parse(state.nowISO) + 29 * 86400000).toISOString())}</span>
        </div>
      </div>

      <div className="row gap-sm wrap" style={{ marginTop: 14 }}>
        <Chip tone="amber">2 decisions in the next 24 hours</Chip>
        {resolved ? <Chip tone="emerald"><Money cents={flagged} /> removed</Chip> : null}
        <button type="button" className="btn ghost sm" onClick={onOpen} style={{ marginLeft: 'auto' }}>
          Money Preview <ArrowRight size={14} />
        </button>
      </div>
      <p className="tiny dim" style={{ marginTop: 11 }}>
        Scheduled recurring payments only, not a balance forecast.
      </p>
    </Card>
  );
}

/** Where the monthly commitment actually goes, by category. */
function Breakdown({ state, onPick }) {
  const slices = useMemo(() => {
    const totals = new Map();
    for (const p of state.payments) {
      if (!isActive(p) || p.kind === 'trial') continue;
      totals.set(p.category, (totals.get(p.category) || 0) + monthlyEquivalent(p));
    }
    return [...totals.entries()]
      .map(([label, value]) => ({
        label,
        value,
        color: CATEGORY_COLOR[label] || '#c4b5fd',
        display: formatMoney(value),
      }))
      .sort((a, b) => b.value - a.value);
  }, [state.payments]);

  const total = slices.reduce((a, s) => a + s.value, 0);

  return (
    <Card className="hero pad-lg">
      <div className="eyebrow" style={{ marginBottom: 16 }}>Where it goes each month</div>
      <div className="row gap-lg wrap" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <Ring
          slices={slices}
          total={total}
          centerLabel="Per month"
          centerValue={formatMoney(total, { cents: false })}
          onSlice={(s) => onPick(s.label)}
        />
        <div className="legend">
          {slices.map((s) => (
            <button key={s.label} type="button" className={`legend-row cat-${s.label}`} onClick={() => onPick(s.label)}>
              <span className="dotc" />
              <span className="lname truncate">{s.label}</span>
              <span className="lval">{s.display}</span>
            </button>
          ))}
        </div>
      </div>
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
  const scan = scanSummary(state);

  const openDecision = (card) => {
    if (card.paymentId === 'p_harbor') setSheet({ kind: 'bill', paymentId: 'p_harbor' });
    else if (card.priority === 0) setSheet({ kind: 'case', paymentId: card.paymentId });
    else setSheet({ kind: 'payment', paymentId: card.paymentId });
  };

  return (
    <>
      <header style={{ marginBottom: 20 }}>
        <h1>{greeting(state.nowISO)}, Nancy</h1>
        <p className="muted" style={{ marginTop: 6 }}>
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
          <div className="stack">
            {top.map((card, i) => (
              <div className={`decision ${card.tone}`} key={card.id}>
                <div className="idx">{String(i + 1).padStart(2, '0')}</div>
                <div className="grow">
                  <div className="row between gap-sm" style={{ alignItems: 'baseline' }}>
                    <h3 className="grow">{card.title}</h3>
                    <Money cents={card.amountCents} className="small dim" />
                  </div>
                  <p className="small muted" style={{ marginTop: 5 }}>{card.detail}</p>
                  <div className="row gap-sm wrap" style={{ marginTop: 13 }}>
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
          <Card className="hero pad-lg">
            <div className="row gap-sm" style={{ alignItems: 'flex-start' }}>
              <CheckCircle2 size={20} color="var(--mint)" style={{ marginTop: 2, flex: 'none' }} />
              <div>
                <h3>Nothing needs your decision right now.</h3>
                <p className="small muted" style={{ marginTop: 5 }}>
                  {review
                    ? `The next thing worth reviewing is on ${longDate(review)}. SubKill keeps watching until then.`
                    : 'SubKill keeps watching your recurring payments.'}
                </p>
                <div className="btnrow" style={{ marginTop: 14 }}>
                  <button type="button" className="btn sm" onClick={() => go('money', 'timeline')}>View timeline</button>
                  <button type="button" className="btn sm ghost" onClick={() => go('savings')}>See what changed</button>
                </div>
              </div>
            </div>
          </Card>
        )}
      </section>

      <section className="section">
        <Breakdown state={state} onPick={() => go('money', 'list')} />
      </section>

      <section className="section">
        <div className="section-head"><h2>Where you stand</h2></div>
        <div className="tiles">
          <Tile
            label="Committed"
            value={formatMoney(monthlyCommitment(state))}
            note="Per month equivalent. Trials not counted."
            glow="#8b7cff"
          />
          <Tile
            label="Annualized"
            value={formatMoney(annualizedCommitment(state), { cents: false })}
            note="At today's rates, not a guarantee."
            glow="#3dc8ff"
          />
          <Tile
            label="Candidates"
            value={formatMoney(candidateAnnualReduction(state))}
            note="Per year. Proposals, not savings."
            glow="#4ff5c0"
            valueColor="var(--mint)"
          />
          <Tile
            label="Awaiting you"
            value={String(all.length)}
            note={all.length ? 'Each has evidence and a next step.' : 'Your queue is clear.'}
            glow="#ffc24d"
            valueColor={all.length ? 'var(--amber)' : undefined}
            onClick={() => go('alerts')}
          />
        </div>

        <button
          type="button"
          className="lrow"
          style={{
            marginTop: 12,
            borderColor: scan.status === 'complete' ? 'rgba(255,138,61,.34)' : 'var(--glass-line)',
            background: 'linear-gradient(96deg, rgba(255,138,61,.14), transparent 52%), var(--glass)',
          }}
          onClick={() => go('discovery')}
        >
          <Mail size={17} color="#ff8a3d" style={{ flex: 'none' }} />
          <div className="grow">
            <div className="small" style={{ fontWeight: 620 }}>
              {scan.status === 'complete'
                ? `${scan.newCount} charge${scan.newCount === 1 ? '' : 's'} billing you that aren't on your list`
                : 'Scan your inbox for forgotten subscriptions'}
            </div>
            <div className="tiny dim">
              {scan.status === 'complete'
                ? `Worth ${formatMoney(scan.monthlyIfAllAdded)}/month if you confirm them all`
                : `SubKill reads receipts in ${scan.mailbox} and finds what you never wrote down`}
            </div>
          </div>
          <ArrowRight size={15} color="#ff8a3d" />
        </button>

        <button type="button" className="lrow" style={{ marginTop: 7 }} onClick={() => go('money', 'list')}>
          <CalendarDays size={17} color="var(--text-3)" style={{ flex: 'none' }} />
          <div className="grow">
            <div className="small" style={{ fontWeight: 600 }}>{items.total} recurring items tracked</div>
            <div className="tiny dim">
              {items.subscriptions} subscriptions · {items.bills} bills · {items.trials} trials · {fresh.label}
            </div>
          </div>
          <ArrowRight size={15} color="var(--text-3)" />
        </button>

        <button type="button" className="lrow" style={{ marginTop: 7 }} onClick={() => go('money', 'timeline')}>
          <div className="grow">
            <div className="small" style={{ fontWeight: 600 }}>Everything else is on your timeline</div>
            <div className="tiny dim">
              {upcoming.length} scheduled payments in the next 30 days
              {upcoming[0] ? ` · next ${relativeDay(state, upcoming[0].dueAt).toLowerCase()}` : ''}
            </div>
          </div>
          <ArrowRight size={15} color="var(--text-3)" />
        </button>
      </section>
    </>
  );
}
