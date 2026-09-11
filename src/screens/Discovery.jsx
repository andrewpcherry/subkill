import React, { useEffect, useState } from 'react';
import { Check, Mail, Search, ShieldAlert, X } from 'lucide-react';
import { useStore } from '../store.jsx';
import { Card, Chip, MerchantMark, Money, Sheet } from '../ui.jsx';
import {
  annualized, discoveriesByVerdict, formatMoney, longDate, monthlyCommitment,
  paymentById, scanSummary, shortDate,
} from '../state/derive.ts';

const CONFIDENCE = {
  confirmed: { label: 'Confirmed pattern', tone: 'emerald' },
  likely: { label: 'Likely', tone: 'amber' },
  unclear: { label: 'Not enough evidence', tone: 'red' },
};

const STAGES = [
  'Connecting to the simulated mailbox',
  'Reading receipts and confirmations',
  'Grouping senders into recurring patterns',
  'Matching against what you already track',
];

function Scanner({ onDone }) {
  const [stage, setStage] = useState(0);
  useEffect(() => {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    if (reduced) { onDone(); return undefined; }
    const t = setInterval(() => {
      setStage((v) => {
        if (v >= STAGES.length - 1) { clearInterval(t); onDone(); return v; }
        return v + 1;
      });
    }, 560);
    return () => clearInterval(t);
  }, [onDone]);

  return (
    <Card className="hero pad-lg">
      <div className="row gap-sm" style={{ alignItems: 'center' }}>
        <Search size={18} color="var(--accent)" />
        <h3 className="grow">Scanning the simulated mailbox</h3>
      </div>
      <div className="stack-sm" style={{ marginTop: 16 }}>
        {STAGES.map((s, i) => (
          <div className="row gap-sm" key={s} style={{ opacity: i <= stage ? 1 : 0.35 }}>
            <span
              className="dotc"
              style={{ '--c': i < stage ? 'var(--mint)' : i === stage ? 'var(--amber)' : 'var(--text-3)' }}
            />
            <span className="small">{s}</span>
            {i < stage ? <Check size={13} color="var(--mint)" style={{ marginLeft: 'auto' }} /> : null}
          </div>
        ))}
      </div>
      <p className="tiny dim" style={{ marginTop: 14 }}>
        No mailbox is connected and no email is read. This runs entirely on fixture data in your browser.
      </p>
    </Card>
  );
}

function DiscoveryRow({ d, onOpen }) {
  const conf = CONFIDENCE[d.confidence];
  return (
    <button type="button" className="lrow" onClick={onOpen} style={{ alignItems: 'flex-start' }}>
      <MerchantMark name={d.merchant} size={34} />
      <div className="grow" style={{ minWidth: 0 }}>
        <div className="row gap-sm wrap" style={{ alignItems: 'baseline' }}>
          <span style={{ fontWeight: 600 }}>{d.merchant}</span>
          {d.isTrial ? <Chip tone="amber">Trial converts {shortDate(d.nextChargeAt)}</Chip> : null}
          <Chip tone={conf.tone}>{conf.label}</Chip>
        </div>
        <div className="tiny dim" style={{ marginTop: 3 }}>
          {d.receiptCount} receipt{d.receiptCount === 1 ? '' : 's'} · last {shortDate(d.lastReceiptAt)} · since {shortDate(d.firstSeenAt)}
        </div>
      </div>
      <div style={{ textAlign: 'right', flex: 'none' }}>
        <div className="num" style={{ fontWeight: 680 }}>{formatMoney(d.amountCents)}</div>
        <div className="tiny dim">{d.interval === 'annual' ? 'per year' : 'per month'}</div>
      </div>
    </button>
  );
}

function DiscoverySheet({ d, onClose }) {
  const { state, run, notify } = useStore();
  const conf = CONFIDENCE[d.confidence];
  const matched = d.matchedPaymentId ? paymentById(state, d.matchedPaymentId) : null;
  const tracked = d.verdict === 'already_tracked';

  return (
    <Sheet
      title={d.merchant}
      subtitle={`${d.plan} · found in ${state.scan.mailbox}`}
      onClose={onClose}
      footer={
        tracked ? (
          <button type="button" className="btn grow" onClick={onClose}>Close</button>
        ) : (
          <>
            <button
              type="button"
              className="btn primary grow"
              onClick={() => {
                run.addDiscovery(d.id);
                notify(`${d.merchant} added to your recurring payments.`, 'good');
                onClose();
              }}
            >
              Add to my payments
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => { run.dismissDiscovery(d.id); notify(`${d.merchant} dismissed.`); onClose(); }}
            >
              Not a subscription
            </button>
          </>
        )
      }
    >
      <div className="stack">
        {tracked ? (
          <div className="callout emerald small">
            Already on your list as <strong>{matched?.merchant}</strong>. The scan matched it, so there is
            nothing to add.
          </div>
        ) : (
          <div className={`callout ${d.confidence === 'unclear' ? 'red' : d.confidence === 'likely' ? 'amber' : ''}`}>
            <div className="row gap-sm" style={{ alignItems: 'flex-start' }}>
              <ShieldAlert size={16} color={`var(--${conf.tone === 'emerald' ? 'mint' : conf.tone})`} style={{ marginTop: 2, flex: 'none' }} />
              <div>
                <div style={{ fontWeight: 600 }}>{conf.label}</div>
                <p className="small muted" style={{ marginTop: 4 }}>{d.confidenceWhy}</p>
              </div>
            </div>
          </div>
        )}

        <Card>
          <div className="grid2">
            <div><div className="tiny dim">Amount</div><div className="small num"><Money cents={d.amountCents} /> {d.interval === 'annual' ? 'per year' : 'per month'}</div></div>
            <div><div className="tiny dim">Monthly equivalent</div><div className="small num"><Money cents={d.interval === 'annual' ? Math.round(d.amountCents / 12) : d.amountCents} /></div></div>
            <div><div className="tiny dim">Annualized</div><div className="small num"><Money cents={d.interval === 'annual' ? d.amountCents : annualized(d.amountCents)} /></div></div>
            <div><div className="tiny dim">Receipts found</div><div className="small num">{d.receiptCount}</div></div>
            <div><div className="tiny dim">First seen</div><div className="small">{longDate(d.firstSeenAt)}</div></div>
            <div><div className="tiny dim">Most recent</div><div className="small">{longDate(d.lastReceiptAt)}</div></div>
            {d.nextChargeAt ? (
              <div><div className="tiny dim">{d.isTrial ? 'Converts' : 'Next charge'}</div><div className="small">{longDate(d.nextChargeAt)}</div></div>
            ) : null}
            <div><div className="tiny dim">Usage</div><div className="small dim">Unknown. A receipt says you paid, not that you used it.</div></div>
          </div>
        </Card>

        <p className="small muted">{d.note}</p>

        <div>
          <div className="eyebrow" style={{ marginBottom: 8 }}>The receipts this came from</div>
          <div className="stack-sm">
            {d.emails.map((e) => (
              <div className="evidence" key={`${e.subject}-${e.receivedAt}`}>
                <div className="row between gap-sm">
                  <span className="small" style={{ fontWeight: 600 }}>{e.subject}</span>
                  <span className="tiny dim" style={{ flex: 'none' }}>{shortDate(e.receivedAt)}</span>
                </div>
                <div className="tiny muted" style={{ marginTop: 3 }}>{e.snippet}</div>
                <div className="tiny dim code" style={{ marginTop: 4 }}>{e.from}</div>
              </div>
            ))}
          </div>
        </div>

        {!tracked ? (
          <p className="tiny dim">
            Adding this puts it on your list and recalculates your commitment. It does not contact the
            merchant and does not cancel anything.
          </p>
        ) : null}
      </div>
    </Sheet>
  );
}

export default function Discovery() {
  const { state, run, notify } = useStore();
  const [open, setOpen] = useState(null);
  const s = scanSummary(state);
  const g = discoveriesByVerdict(state);

  const finish = React.useCallback(() => { run.completeScan(); }, [run]);

  return (
    <>
      <header style={{ marginBottom: 18 }}>
        <h1>Inbox scan</h1>
        <p className="muted small" style={{ marginTop: 4 }}>
          Recurring charges hide in your receipts. SubKill reads the mailbox you use for signups and tells
          you what is billing you that you never put on a list.
        </p>
      </header>

      <Card className="hero pad-lg">
        <div className="row gap-sm wrap" style={{ alignItems: 'center' }}>
          <Mail size={18} color="var(--accent)" />
          <div className="grow" style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 620 }}>{s.mailbox}</div>
            <div className="tiny dim" style={{ marginTop: 2 }}>
              Simulated connection.{' '}
              {s.lastRunAt
                ? `Last scan ${longDate(s.lastRunAt)} · ${s.messagesScanned.toLocaleString('en-US')} messages read.`
                : 'Never scanned.'}
            </div>
          </div>
          <Chip tone={s.sourceStale ? 'amber' : s.sourceUsable ? 'emerald' : 'red'}>
            {s.sourceStale ? 'Stale' : s.sourceUsable ? 'Connected' : 'Disconnected'}
          </Chip>
        </div>

        {s.status !== 'complete' ? (
          <div className="btnrow" style={{ marginTop: 16 }}>
            <button
              type="button"
              className="btn primary wide"
              disabled={!s.sourceUsable || s.status === 'running'}
              onClick={() => run.startScan()}
            >
              {s.status === 'running' ? 'Scanning…' : 'Run simulated scan'}
            </button>
          </div>
        ) : (
          <div className="tiles" style={{ marginTop: 18 }}>
            <div className="tile" style={{ '--glow': '#ff4d8d30', '--edge': '#ff4d8d' }}>
              <div className="tlabel">Not on your list</div>
              <div className="tval" style={{ color: 'var(--red)' }}>{s.newCount}</div>
              <div className="tnote">Worth <Money cents={s.monthlyIfAllAdded} />/mo if all confirmed</div>
            </div>
            <div className="tile" style={{ '--glow': '#ffd64530', '--edge': '#ffd645' }}>
              <div className="tlabel">Needs your call</div>
              <div className="tval" style={{ color: 'var(--amber)' }}>{s.uncertainCount}</div>
              <div className="tnote">Evidence is not conclusive</div>
            </div>
            <div className="tile" style={{ '--glow': '#4ff5c030', '--edge': '#4ff5c0' }}>
              <div className="tlabel">Already tracked</div>
              <div className="tval" style={{ color: 'var(--mint)' }}>{s.trackedCount}</div>
              <div className="tnote">Matched to your records</div>
            </div>
            <div className="tile" style={{ '--glow': '#8b7cff30', '--edge': '#8b7cff' }}>
              <div className="tlabel">Added by you</div>
              <div className="tval">{s.addedCount}</div>
              <div className="tnote">Now in your commitment</div>
            </div>
          </div>
        )}

        {s.sourceStale && s.status === 'complete' ? (
          <div className="callout amber small" style={{ marginTop: 14 }}>
            This mailbox is not current in the demo. A scan can only speak for the messages it can read, so
            treat an empty result as unproven rather than as an all-clear.
          </div>
        ) : null}
      </Card>

      {state.scan.status === 'running' ? (
        <div style={{ marginTop: 14 }}><Scanner onDone={finish} /></div>
      ) : null}

      {s.status === 'complete' ? (
        <>
          {g.found.length ? (
            <section className="section">
              <div className="section-head">
                <h2>Billing you, not on your list</h2>
                <span className="tiny dim"><Money cents={s.monthlyIfAllAdded} />/mo</span>
              </div>
              <div className="stack-sm">
                {g.found.map((d) => <DiscoveryRow key={d.id} d={d} onOpen={() => setOpen(d)} />)}
              </div>
              <p className="tiny dim" style={{ marginTop: 10 }}>
                Nothing here counts toward your commitment until you confirm it. A receipt proves a charge
                happened, not that a plan is still running.
              </p>
            </section>
          ) : null}

          {g.uncertain.length ? (
            <section className="section">
              <div className="section-head"><h2>SubKill will not guess</h2></div>
              <div className="stack-sm">
                {g.uncertain.map((d) => <DiscoveryRow key={d.id} d={d} onOpen={() => setOpen(d)} />)}
              </div>
            </section>
          ) : null}

          {g.alreadyTracked.length ? (
            <section className="section">
              <div className="section-head"><h2>Matched to what you already track</h2></div>
              <div className="stack-sm">
                {g.alreadyTracked.map((d) => <DiscoveryRow key={d.id} d={d} onOpen={() => setOpen(d)} />)}
              </div>
            </section>
          ) : null}

          {g.added.length || g.dismissed.length ? (
            <section className="section">
              <div className="section-head"><h2>Resolved</h2></div>
              <div className="stack-sm">
                {g.added.map((d) => (
                  <div className="lrow" key={d.id}>
                    <MerchantMark name={d.merchant} size={30} />
                    <span className="grow small">{d.merchant}</span>
                    <Chip tone="emerald"><Check size={11} /> Added</Chip>
                  </div>
                ))}
                {g.dismissed.map((d) => (
                  <div className="lrow" key={d.id}>
                    <MerchantMark name={d.merchant} size={30} />
                    <span className="grow small">{d.merchant}</span>
                    <Chip><X size={11} /> Dismissed</Chip>
                    <button type="button" className="btn ghost sm" onClick={() => { run.restoreDiscovery(d.id); notify('Restored to findings.'); }}>
                      Undo
                    </button>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section className="section">
            <Card>
              <div className="row between gap-sm wrap">
                <div className="grow">
                  <div className="small" style={{ fontWeight: 600 }}>Your commitment right now</div>
                  <div className="tiny dim" style={{ marginTop: 2 }}>
                    Confirmed findings are already included in this figure.
                  </div>
                </div>
                <span className="figure md">{formatMoney(monthlyCommitment(state))}</span>
              </div>
            </Card>
          </section>
        </>
      ) : null}

      {open ? <DiscoverySheet d={open} onClose={() => setOpen(null)} /> : null}
    </>
  );
}
