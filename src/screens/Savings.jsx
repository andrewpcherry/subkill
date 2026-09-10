import React, { useState } from 'react';
import { Download } from 'lucide-react';
import { downloadFile, useStore } from '../store.jsx';
import { Bar, Card, Chip, Empty, Money } from '../ui.jsx';
import {
  candidateAnnualReduction, confirmedAnnualReduction, confirmedReductions,
  feesPaid, formatMoney, grossObservedBenefit, awaitingVerification,
  ledgerByType, liveLedger, longDate, netObservedBenefit, paymentById, shortDate,
} from '../state/derive.ts';

const TYPE_LABEL = {
  observed_avoided: 'Avoided scheduled charge',
  refund_credited: 'Refund credited',
  observed_bill_reduction: 'Observed bill reduction',
  fee: 'SubKill fee',
};

export default function Savings() {
  const { state, setSheet } = useStore();
  const [open, setOpen] = useState(false);

  const gross = grossObservedBenefit(state);
  const fees = feesPaid(state);
  const net = netObservedBenefit(state);
  const confirmed = confirmedAnnualReduction(state);
  const candidate = candidateAnnualReduction(state);
  const pending = awaitingVerification(state);
  const reversed = state.ledger.filter((e) => e.status === 'reversed');
  const ledger = liveLedger(state).sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));

  const exportCsv = () => {
    const header = 'date,type,amount_usd,status,payment,basis\n';
    const body = state.ledger
      .map((e) => {
        const p = e.paymentId ? paymentById(state, e.paymentId)?.merchant || e.paymentId : '';
        const basis = `"${e.basis.replace(/"/g, '""')}"`;
        return [e.occurredAt.slice(0, 10), e.type, (e.amountCents / 100).toFixed(2), e.status, p, basis].join(',');
      })
      .join('\n');
    const ok = downloadFile('subkill-ledger.csv', header + body, 'text/csv');
    if (!ok) window.alert('Download is unavailable in this browser context.');
  };

  return (
    <>
      <header style={{ marginBottom: 14 }}>
        <h1>Savings</h1>
        <p className="muted small" style={{ marginTop: 3 }}>
          Observed money and future projections are kept apart on purpose. They are never added together.
        </p>
      </header>

      <div className="grid2">
        <Card className="pad-lg">
          <div className="eyebrow">Observed benefit so far</div>
          <div className="num" style={{ fontSize: 30, fontWeight: 680, letterSpacing: '-0.025em', marginTop: 5, color: 'var(--emerald)' }}>
            {formatMoney(net)}
          </div>
          <div className="small muted" style={{ marginTop: 4 }}>
            {formatMoney(gross)} gross, less {formatMoney(fees)} in SubKill fees.
          </div>
          <div className="tiny dim" style={{ marginTop: 7 }}>
            Money actually credited, or charges that demonstrably did not happen. Period to{' '}
            {shortDate(state.nowISO)}.
          </div>
        </Card>

        <Card className="pad-lg">
          <div className="eyebrow">Projected ongoing reductions</div>
          <div className="num" style={{ fontSize: 30, fontWeight: 680, letterSpacing: '-0.025em', marginTop: 5 }}>
            {formatMoney(confirmed, { cents: false })}<span className="small dim" style={{ fontWeight: 400 }}>/yr</span>
          </div>
          <div className="small muted" style={{ marginTop: 4 }}>
            Confirmed after accepted demo outcomes.
          </div>
          <div className="tiny dim" style={{ marginTop: 7 }}>
            A projection at today's prices. This is not cash and is never added to observed benefit.
          </div>
        </Card>
      </div>

      <div className="section">
        <div className="section-head"><h2>How the money breaks down</h2></div>
        <div className="stack-sm">
          <Row
            label="Candidate annualized reductions"
            value={formatMoney(candidate, { cents: false })}
            note="Eligible opportunities you have not acted on. Proposals only."
            tone="dim"
          />
          <Row
            label="Confirmed annualized reductions"
            value={formatMoney(confirmed, { cents: false })}
            note="Projected ongoing cost removed after accepted outcomes."
            tone="dim"
          />
          <Row
            label="Observed avoided scheduled charges"
            value={formatMoney(ledgerByType(state, 'observed_avoided').reduce((a, e) => a + e.amountCents, 0))}
            note="Expected renewals absent from complete simulated activity."
            tone="emerald"
          />
          <Row
            label="Refunds credited"
            value={formatMoney(ledgerByType(state, 'refund_credited').reduce((a, e) => a + e.amountCents, 0))}
            note="Actual credit events."
            tone="emerald"
          />
          <Row
            label="Observed bill reductions"
            value={formatMoney(ledgerByType(state, 'observed_bill_reduction').reduce((a, e) => a + e.amountCents, 0))}
            note="Evidenced by a later bill in the sample data."
            tone="emerald"
          />
          <Row
            label="SubKill fees and action costs"
            value={`−${formatMoney(fees)}`}
            note="Subtracted so the net figure is honest."
            tone="red"
          />
        </div>
      </div>

      {pending.length || reversed.length ? (
        <div className="section">
          <div className="section-head"><h2>Not counted</h2></div>
          <div className="stack-sm">
            {pending.map((e) => (
              <Card key={e.id}>
                <div className="row between gap-sm">
                  <div className="grow">
                    <div className="small" style={{ fontWeight: 550 }}>
                      {TYPE_LABEL[e.type]} · {paymentById(state, e.paymentId)?.merchant || ''}
                    </div>
                    <div className="tiny dim" style={{ marginTop: 3 }}>{e.basis}</div>
                  </div>
                  <Chip tone="amber">Awaiting verification</Chip>
                </div>
              </Card>
            ))}
            {reversed.map((e) => (
              <Card key={e.id}>
                <div className="row between gap-sm">
                  <div className="grow">
                    <div className="small" style={{ fontWeight: 550 }}>
                      {TYPE_LABEL[e.type]} · {paymentById(state, e.paymentId)?.merchant || ''}
                    </div>
                    <div className="tiny dim" style={{ marginTop: 3 }}>{e.basis}</div>
                  </div>
                  <Chip tone="red">Reversed</Chip>
                </div>
              </Card>
            ))}
          </div>
        </div>
      ) : null}

      <div className="section">
        <div className="section-head">
          <h2>Goal</h2>
          <span className="tiny dim">A tracking goal, not a savings account.</span>
        </div>
        <Card className="pad-lg">
          <div className="row between" style={{ marginBottom: 9 }}>
            <span className="small muted">Emergency cushion</span>
            <span className="num small">
              <Money cents={Math.max(0, net)} /> of <Money cents={state.goalCents} />
            </span>
          </div>
          <Bar pct={(Math.max(0, net) / state.goalCents) * 100} />
          <p className="tiny dim" style={{ marginTop: 9 }}>
            Progress is measured from observed net benefit only. No money is moved or held anywhere.
          </p>
        </Card>
      </div>

      <div className="section">
        <div className="section-head">
          <h2>Event ledger</h2>
          <button type="button" className="btn ghost sm" onClick={() => setOpen((v) => !v)}>
            {open ? 'Collapse' : 'Expand'}
          </button>
          <button type="button" className="btn ghost sm" onClick={exportCsv}>
            <Download size={14} /> CSV
          </button>
        </div>
        {ledger.length === 0 ? (
          <Empty icon="◎" title="No ledger events yet" />
        ) : (
          <div className="stack-sm">
            {(open ? ledger : ledger.slice(0, 4)).map((e) => (
              <Card key={e.id}>
                <div className="row between gap-sm wrap">
                  <div className="grow">
                    <div className="row gap-sm" style={{ alignItems: 'baseline' }}>
                      <span className="small" style={{ fontWeight: 560 }}>{TYPE_LABEL[e.type]}</span>
                      <span className="tiny dim">{longDate(e.occurredAt)}</span>
                    </div>
                    <div className="tiny dim" style={{ marginTop: 3 }}>
                      {paymentById(state, e.paymentId)?.merchant || '—'}
                      {e.obligationId ? ` · obligation ${e.obligationId}` : ''}
                      {e.transactionId ? ` · txn ${e.transactionId}` : ''}
                    </div>
                    {open ? <div className="tiny muted" style={{ marginTop: 6 }}>{e.basis}</div> : null}
                  </div>
                  <span className="num small" style={{ color: e.type === 'fee' ? 'var(--red)' : 'var(--emerald)', flex: 'none' }}>
                    {e.type === 'fee' ? '−' : '+'}{formatMoney(e.amountCents)}
                  </span>
                </div>
              </Card>
            ))}
          </div>
        )}
        <p className="tiny dim" style={{ marginTop: 10 }}>
          Every event links to a unique obligation or transaction, so one outcome cannot be counted twice
          even when several recommendations led to it.
        </p>
      </div>

      <div className="section">
        <div className="section-head"><h2>Share</h2></div>
        <Card className="pad-lg">
          <div style={{
            border: '1px solid var(--border)', borderRadius: 12, padding: 18,
            background: 'linear-gradient(150deg, #12211c, #0f1319)', textAlign: 'center',
          }}>
            <div className="eyebrow">SubKill · {shortDate(state.nowISO)}</div>
            <div className="num" style={{ fontSize: 28, fontWeight: 700, marginTop: 6, color: 'var(--emerald)' }}>
              {formatMoney(net)}
            </div>
            <div className="tiny dim" style={{ marginTop: 3 }}>observed benefit this period</div>
          </div>
          <div className="btnrow" style={{ marginTop: 12 }}>
            <button
              type="button"
              className="btn sm"
              onClick={() => {
                const ok = downloadFile(
                  'subkill-card.txt',
                  `SubKill\nPeriod to ${shortDate(state.nowISO)}\nObserved benefit: ${formatMoney(net)}\n`,
                );
                if (!ok) window.alert('Download is unavailable in this browser context.');
              }}
            >
              <Download size={14} /> Download card
            </button>
          </div>
          <p className="tiny dim" style={{ marginTop: 9 }}>
            The card carries a period and an amount only. No account, merchant or household detail. It saves
            to your device; nothing is published or sent.
          </p>
        </Card>
      </div>
    </>
  );
}

function Row({ label, value, note, tone }) {
  return (
    <Card>
      <div className="row between gap-sm">
        <div className="grow">
          <div className="small" style={{ fontWeight: 550 }}>{label}</div>
          <div className="tiny dim" style={{ marginTop: 2 }}>{note}</div>
        </div>
        <span
          className="num"
          style={{ fontWeight: 620, flex: 'none', color: tone === 'emerald' ? 'var(--emerald)' : tone === 'red' ? 'var(--red)' : 'var(--text)' }}
        >
          {value}
        </span>
      </div>
    </Card>
  );
}
