import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, Copy, ExternalLink, ShieldCheck } from 'lucide-react';
import { copyText, useStore } from '../store.jsx';
import { Card, Chip, Evidence, Lifecycle, Money, Sheet } from '../ui.jsx';
import {
  annualized, billComparison, decisionDeadline, formatMoney, longDate,
  monthlyEquivalent, paymentById, relativeDay, shortDate,
} from '../state/derive.ts';

const OWNER = { nancy: 'Nancy', brian: 'Brian', household: 'Household', unassigned: 'Not assigned' };
const CHANNEL = {
  direct: 'Direct with the merchant',
  app_store: 'Billed through an app store',
  intermediary: 'Billed through an intermediary',
};

function Field({ label, children }) {
  return (
    <div>
      <div className="tiny dim">{label}</div>
      <div className="small" style={{ marginTop: 2 }}>{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------- payment detail

function PaymentSheet({ paymentId, onClose }) {
  const { state, run, notify, setSheet } = useStore();
  const p = paymentById(state, paymentId);
  const [step, setStep] = useState('detail');
  const [reviewDate, setReviewDate] = useState(
    new Date(Date.parse(state.nowISO) + 30 * 86400000).toISOString().slice(0, 10),
  );

  if (!p) return null;

  const m = monthlyEquivalent(p);
  const dl = decisionDeadline(p);
  const opp = state.opportunities.find((o) => o.paymentId === p.id && o.status === 'open');
  const evidence = state.evidence.filter((e) => (opp?.evidenceIds || []).includes(e.id));
  const history = state.transactions
    .filter((t) => t.paymentId === p.id)
    .sort((a, b) => Date.parse(b.postedAt) - Date.parse(a.postedAt))
    .slice(0, 4);
  const existingCase = state.cases.find((c) => c.paymentId === p.id && c.action === 'cancel');

  const cancelMessage = [
    `Hello,`,
    ``,
    `I would like to cancel my ${p.merchant} ${p.plan} plan, effective at the end of the current billing period.`,
    `The account is billed at ${formatMoney(p.amountCents)} ${p.interval === 'annual' ? 'per year' : 'per month'}.`,
    ``,
    `Please confirm the cancellation and the date access ends.`,
    ``,
    `Thank you,`,
    `Nancy`,
  ].join('\n');

  // ---- confirm step
  if (step === 'confirm') {
    return (
      <Sheet
        title={`Cancel ${p.merchant}?`}
        subtitle="Review before approving. This simulates a cancellation in the demo."
        onClose={onClose}
        footer={
          <>
            <button
              type="button"
              className="btn danger grow"
              onClick={() => {
                run.approveCancellation(p.id);
                notify(`${p.merchant}: demo cancellation confirmed.`, 'good');
                setStep('done');
              }}
            >
              Simulate cancellation
            </button>
            <button type="button" className="btn" onClick={() => setStep('detail')}>Back</button>
          </>
        }
      >
        <div className="stack">
          <div className="callout">
            <div className="stack-sm">
              <Field label="Intended action">Cancel the {p.plan} plan</Field>
              <Field label="Effective date">{longDate(state.nowISO)}</Field>
              <Field label="Remaining access">
                {p.trial?.accessEndsImmediately
                  ? 'Access ends immediately with this provider.'
                  : p.accessThrough
                    ? `Access continues to ${longDate(p.accessThrough)}.`
                    : 'Access continues to the end of the paid period.'}
              </Field>
              {p.kind !== 'trial' ? (
                <Field label="Annualized reduction">
                  <span style={{ color: 'var(--emerald)' }}><Money cents={annualized(m)} /> a year at today's price</span>
                  <div className="tiny dim" style={{ marginTop: 2 }}>
                    A projection of an ongoing cost removed, not money received.
                  </div>
                </Field>
              ) : (
                <Field label="Effect">
                  Prevents the <Money cents={p.trial?.firstChargeCents ?? p.amountCents} /> first charge.
                  <div className="tiny dim" style={{ marginTop: 2 }}>
                    A trial is not part of your active paid commitment, so this does not change that figure.
                  </div>
                </Field>
              )}
            </div>
          </div>
          <p className="tiny dim">
            The button above records a simulated request. No provider is contacted, no message is sent,
            and no real subscription is cancelled.
          </p>
        </div>
      </Sheet>
    );
  }

  // ---- confirmation screen
  if (step === 'done') {
    const c = state.cases.find((x) => x.paymentId === p.id && x.action === 'cancel');
    return (
      <Sheet
        title="Demo cancellation confirmed"
        onClose={onClose}
        footer={
          <>
            <button type="button" className="btn primary grow" onClick={onClose}>Done</button>
            <button type="button" className="btn" onClick={() => run.undoCancellation(p.id) && setStep('detail')}>
              Undo the simulation
            </button>
          </>
        }
      >
        <div className="stack">
          <div className="callout emerald">
            <div className="row gap-sm" style={{ alignItems: 'flex-start' }}>
              <CheckCircle2 size={19} color="var(--emerald)" style={{ marginTop: 1, flex: 'none' }} />
              <div>
                <div style={{ fontWeight: 600 }}>
                  <Money cents={m} />/month removed from your recurring commitment
                </div>
                <div className="small muted" style={{ marginTop: 3 }}>
                  <Money cents={annualized(m)} /> annualized reduction at today's price.
                </div>
                <div className="small" style={{ marginTop: 7, color: 'var(--emerald)' }}>
                  We'll keep watching for another charge.
                </div>
              </div>
            </div>
          </div>

          {c ? (
            <Card>
              <div className="eyebrow" style={{ marginBottom: 9 }}>Action receipt</div>
              <div className="stack-sm">
                <Field label="Merchant">{p.merchant}</Field>
                <Field label="Requested action">Cancel {p.plan}</Field>
                <Field label="Approved">{longDate(c.approvedAt)}</Field>
                <Field label="Effective">{longDate(c.effectiveAt)}</Field>
                <Field label="Confirmation reference">
                  <span className="num">{c.confirmationRef}</span>
                  <span className="tiny dim"> (synthetic)</span>
                </Field>
                <Field label="Monitoring">Active. Watching for a charge after the effective date.</Field>
              </div>
            </Card>
          ) : null}

          <p className="tiny dim">
            Undo restores the demo record. It does not imply a real cancellation could be reversed.
          </p>
        </div>
      </Sheet>
    );
  }

  // ---- detail
  return (
    <Sheet
      title={p.merchant}
      subtitle={`${p.plan} · ${p.category}`}
      onClose={onClose}
      footer={
        p.status === 'cancelled' ? (
          <>
            {existingCase ? (
              <button type="button" className="btn grow" onClick={() => setSheet({ kind: 'case', paymentId: p.id })}>
                View cancellation watch
              </button>
            ) : null}
            <button type="button" className="btn" onClick={onClose}>Close</button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="btn primary"
              onClick={() => {
                run.keepPayment(p.id, null);
                notify(`${p.merchant} kept. It won't be suggested again.`);
                onClose();
              }}
            >
              Keep
            </button>
            <button type="button" className="btn" onClick={() => setSheet({ kind: 'reviewLater', paymentId: p.id })}>
              Review later
            </button>
            {p.pauseOption ? (
              <button type="button" className="btn" onClick={() => { run.applyPause(p.id); notify(`${p.merchant} paused for ${p.pauseOption.months} month.`); onClose(); }}>
                Pause
              </button>
            ) : null}
            {p.downgradeOption ? (
              <button type="button" className="btn" onClick={() => { run.applyDowngrade(p.id); notify(`${p.merchant} moved to ${p.downgradeOption.planName}.`); onClose(); }}>
                Downgrade
              </button>
            ) : null}
            {!p.essential ? (
              <button type="button" className="btn danger" onClick={() => setStep('confirm')}>Cancel</button>
            ) : null}
          </>
        )
      }
    >
      <div className="stack">
        {p.status === 'cancelled' ? (
          <div className="callout emerald small">Cancelled in this demo. No future charges are scheduled.</div>
        ) : null}
        {p.status === 'paused' ? (
          <div className="callout small">Paused in this demo. One charge is skipped, then billing resumes.</div>
        ) : null}

        <Card>
          <div className="grid2">
            <Field label="Price">
              <Money cents={p.amountCents} /> {p.interval === 'annual' ? 'per year' : 'per month'}
            </Field>
            <Field label="Next charge">
              {p.nextChargeAt ? `${longDate(p.nextChargeAt)} · ${relativeDay(state, p.nextChargeAt)}` : 'None scheduled'}
            </Field>
            <Field label="Monthly equivalent"><Money cents={m} /></Field>
            <Field label="Annualized cost"><Money cents={annualized(m)} /></Field>
            <Field label="Household owner">{OWNER[p.owner]}</Field>
            <Field label="Payment source">{p.paymentSource}</Field>
            <Field label="Billing channel">{CHANNEL[p.billingChannel]}</Field>
            <Field label="Usage">
              {p.usageReport || <span className="dim">Usage unknown</span>}
              {!p.usageReport ? (
                <div className="tiny dim" style={{ marginTop: 2 }}>
                  Bank payments do not reveal app usage.
                </div>
              ) : null}
            </Field>
            {dl ? <Field label="Decision deadline">{longDate(dl)}</Field> : null}
            {p.contract ? <Field label="Notice required">{p.contract.noticeDays} days before renewal</Field> : null}
            {p.accessThrough ? <Field label="Access through">{longDate(p.accessThrough)}</Field> : null}
          </div>
        </Card>

        {p.variableEstimate ? (
          <div className="callout small">
            This is a variable utility. The amount shown is an estimate taken from the latest bill in the
            sample data, and the next bill may differ.
          </div>
        ) : null}

        {p.essential ? (
          <div className="callout amber small">
            Marked essential. Excluded from bulk cancellation. Cancelling coverage or a utility has service
            consequences that SubKill will not weigh for you, so it offers a review and a comparison instead.
          </div>
        ) : null}

        {opp ? (
          <Card>
            <div className="eyebrow" style={{ marginBottom: 6 }}>Recommendation</div>
            <div style={{ fontWeight: 560 }}>{opp.headline}</div>
            <p className="small muted" style={{ marginTop: 5 }}>{opp.rationale}</p>
            <div className="eyebrow" style={{ marginTop: 11, marginBottom: 5 }}>Assumptions</div>
            <ul className="small muted" style={{ margin: 0, paddingLeft: 17 }}>
              {opp.assumptions.map((a, i) => <li key={i}>{a}</li>)}
            </ul>
            {opp.availability !== 'eligible' ? (
              <div className="callout amber small" style={{ marginTop: 11 }}>
                {opp.availability === 'unknown_until_provider_response'
                  ? 'Availability is unknown until a provider responds. This is a request, not an offer you have.'
                  : 'Speculative. Excluded from every total until it is confirmed.'}
              </div>
            ) : null}
          </Card>
        ) : null}

        {evidence.length ? (
          <div>
            <div className="eyebrow" style={{ marginBottom: 7 }}>Evidence</div>
            <Evidence items={evidence} />
          </div>
        ) : null}

        {history.length ? (
          <Card>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Recent charges</div>
            <div className="stack-sm">
              {history.map((t) => (
                <div className="row between" key={t.id}>
                  <span className="small">{shortDate(t.postedAt)} · {t.label}</span>
                  <Money cents={t.amountCents} className="small" />
                </div>
              ))}
            </div>
          </Card>
        ) : null}

        <Card>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Keep what matters</div>
          <div className="stack-sm">
            <label className="row between" style={{ cursor: 'pointer' }}>
              <span className="small">Favorite. Never suggested for cancellation.</span>
              <input type="checkbox" checked={p.favorite} onChange={(e) => run.setPreference(p.id, 'favorite', e.target.checked)} />
            </label>
            <label className="row between" style={{ cursor: 'pointer' }}>
              <span className="small">Essential. Excluded from bulk actions.</span>
              <input type="checkbox" checked={p.essential} onChange={(e) => run.setPreference(p.id, 'essential', e.target.checked)} />
            </label>
          </div>
        </Card>

        {p.cancellationGuide.length ? (
          <Card>
            <div className="eyebrow" style={{ marginBottom: 8 }}>How to cancel this one</div>
            <ol className="small muted" style={{ margin: 0, paddingLeft: 17 }}>
              {p.cancellationGuide.map((g, i) => <li key={i} style={{ marginBottom: 3 }}>{g}</li>)}
            </ol>
            <div className="btnrow" style={{ marginTop: 12 }}>
              <button
                type="button"
                className="btn sm"
                onClick={async () => {
                  const ok = await copyText(cancelMessage);
                  notify(ok ? 'Cancellation message copied.' : 'Could not reach the clipboard. Select the text and copy it manually.', ok ? 'good' : 'bad');
                }}
              >
                <Copy size={14} /> Copy cancellation message
              </button>
              {p.providerUrl ? (
                <button type="button" className="btn sm ghost" onClick={() => notify('Simulated provider link. Nothing opened, and this never counts as a confirmation.')}>
                  <ExternalLink size={14} /> Provider page (simulated)
                </button>
              ) : null}
            </div>
            <p className="tiny dim" style={{ marginTop: 9 }}>
              Copying a message or opening a provider link never counts as a confirmed cancellation.
            </p>
          </Card>
        ) : null}
      </div>
    </Sheet>
  );
}

// ---------------------------------------------------------------- bill detective

function BillSheet({ paymentId, onClose }) {
  const { state, run, notify } = useStore();
  const p = paymentById(state, paymentId);
  const cmp = billComparison(state, paymentId);
  const offer = state.harborOffer;
  const [draft, setDraft] = useState('');

  if (!p) return null;

  const message = [
    `Hello,`,
    ``,
    `My ${p.merchant} bill went from ${formatMoney(cmp.previous?.total ?? 0)} to ${formatMoney(cmp.current?.total ?? 0)}.`,
    `Comparing the two bills, the ${p.plan} base charge is unchanged at ${formatMoney(cmp.current?.lines[0]?.amountCents ?? 0)}.`,
    `The difference is an ${formatMoney(Math.abs(cmp.previous?.lines[1]?.amountCents ?? 0))} monthly promotional credit that is no longer applied.`,
    ``,
    `Could you tell me whether that credit can be restored, or whether a different plan would suit this account better?`,
    ``,
    `Thank you,`,
    `Nancy`,
  ].join('\n');

  if (!cmp.available) {
    return (
      <Sheet title={`${p.merchant}`} subtitle="Comparison unavailable" onClose={onClose}
        footer={<button type="button" className="btn grow" onClick={onClose}>Close</button>}>
        <div className="callout amber">
          <div style={{ fontWeight: 570 }}>SubKill cannot explain this one</div>
          <p className="small muted" style={{ marginTop: 5 }}>{cmp.reason}</p>
        </div>
        <p className="tiny dim" style={{ marginTop: 12 }}>
          Rather than invent a reason, SubKill says what it does not have.
        </p>
      </Sheet>
    );
  }

  return (
    <Sheet
      title={`Why ${p.merchant} went up`}
      subtitle={`${cmp.previous.periodLabel} compared with ${cmp.current.periodLabel}`}
      onClose={onClose}
      wide
      footer={
        offer.stage === 'accepted' ? (
          <button type="button" className="btn grow" onClick={onClose}>Done</button>
        ) : offer.stage === 'response_received' ? (
          <>
            <button
              type="button"
              className="btn primary grow"
              onClick={() => { run.acceptProviderOffer(); notify('Simulated offer accepted.', 'good'); }}
            >
              Accept the simulated offer
            </button>
            <button type="button" className="btn" onClick={onClose}>Not now</button>
          </>
        ) : offer.stage === 'draft_prepared' ? (
          <>
            <button type="button" className="btn primary grow" onClick={() => run.simulateProviderResponse()}>
              Simulate provider response
            </button>
            <button type="button" className="btn" onClick={onClose}>Close</button>
          </>
        ) : (
          <>
            <button type="button" className="btn primary grow" onClick={() => { run.prepareProviderMessage(); setDraft(message); }}>
              Prepare provider message
            </button>
            <button type="button" className="btn" onClick={onClose}>Close</button>
          </>
        )
      }
    >
      <div className="stack">
        <div className="bills">
          {[cmp.previous, cmp.current].map((doc, di) => (
            <div className="billdoc" key={doc.periodLabel}>
              <header className="row between">
                <span className="small" style={{ fontWeight: 570 }}>{doc.periodLabel}</span>
                <Chip>{di === 0 ? 'Previous' : 'Current'}</Chip>
              </header>
              {doc.lines.map((l) => {
                const other = (di === 0 ? cmp.current : cmp.previous).lines.find((x) => x.label === l.label);
                const changed = other && other.amountCents !== l.amountCents;
                return (
                  <div className={`billline ${changed ? 'changed' : ''}`} key={l.label}>
                    <span className="muted">{l.label}</span>
                    <Money cents={l.amountCents} />
                  </div>
                );
              })}
              <div className="billline total">
                <span>Total</span>
                <Money cents={doc.total} />
              </div>
            </div>
          ))}
        </div>

        <div className="callout">
          <div style={{ fontWeight: 570 }}>{cmp.explanation}</div>
          <div className="row gap-sm wrap" style={{ marginTop: 10 }}>
            <Chip tone="amber">+{formatMoney(cmp.deltaCents)} a month</Chip>
            <Chip tone="amber">about +{cmp.percent.toFixed(1)}%</Chip>
            <Chip tone="amber">+{formatMoney(cmp.annualIfSustained)} a year if the new rate continues</Chip>
          </div>
          <p className="tiny dim" style={{ marginTop: 9 }}>
            The annual figure assumes twelve months at the new rate. It is a projection, not a charge you have had.
          </p>
        </div>

        {offer.stage === 'draft_prepared' || draft ? (
          <Card>
            <div className="eyebrow" style={{ marginBottom: 7 }}>Draft message. Nothing is sent.</div>
            <textarea
              className="input"
              value={draft || message}
              onChange={(e) => setDraft(e.target.value)}
              aria-label="Provider message draft"
            />
            <div className="btnrow" style={{ marginTop: 9 }}>
              <button
                type="button"
                className="btn sm"
                onClick={async () => {
                  const ok = await copyText(draft || message);
                  notify(ok ? 'Draft copied.' : 'Could not reach the clipboard. Select the text and copy it manually.', ok ? 'good' : 'bad');
                }}
              >
                <Copy size={14} /> Copy draft
              </button>
            </div>
            <p className="tiny dim" style={{ marginTop: 8 }}>
              At this point this is a request you could make. It is not an offer that is known to be available,
              and SubKill is not claiming this provider negotiates.
            </p>
          </Card>
        ) : null}

        {offer.stage === 'response_received' ? (
          <Card>
            <div className="eyebrow" style={{ marginBottom: 7 }}>Simulated provider response</div>
            <p className="small">
              A synthetic reply offers to restore the {formatMoney(offer.creditCents)} monthly credit for{' '}
              {offer.months} months.
            </p>
            <div className="stack-sm" style={{ marginTop: 11 }}>
              <Field label="Credit">{formatMoney(offer.creditCents)} a month</Field>
              <Field label="Duration">{offer.months} months</Field>
              <Field label="After it expires">The bill returns to {formatMoney(p.amountCents)}</Field>
            </div>
            <p className="tiny dim" style={{ marginTop: 10 }}>
              Read the duration before accepting. Your forecast and annualized reduction only change once you accept.
            </p>
          </Card>
        ) : null}

        {offer.stage === 'accepted' ? (
          <div className="callout emerald">
            <div style={{ fontWeight: 570 }}>
              {formatMoney(offer.creditCents)} monthly credit applied in the demo
            </div>
            <p className="small muted" style={{ marginTop: 5 }}>
              Effective {longDate(offer.effectiveAt)}, expiring {longDate(offer.expiresAt)}. That is{' '}
              {formatMoney(offer.creditCents * offer.months)} across the {offer.months}-month offer period,
              after which the price returns to {formatMoney(p.amountCents + offer.creditCents)}.
            </p>
          </div>
        ) : null}

        <div>
          <div className="eyebrow" style={{ marginBottom: 7 }}>Evidence</div>
          <Evidence items={state.evidence.filter((e) => e.id === 'ev_harbor_bills')} />
        </div>
      </div>
    </Sheet>
  );
}

// ---------------------------------------------------------------- cancellation watch

const STAGES = [
  ['review_required', 'Review required'],
  ['user_approved', 'You approved'],
  ['demo_request_submitted', 'Demo request submitted'],
  ['awaiting_confirmation', 'Awaiting confirmation'],
  ['demo_confirmation_received', 'Demo confirmation received'],
  ['monitoring', 'Monitoring future charges'],
];

function CaseSheet({ paymentId, onClose }) {
  const { state, run, notify } = useStore();
  const p = paymentById(state, paymentId);
  const c = state.cases.find((x) => x.paymentId === paymentId && x.action === 'cancel');
  const [draft, setDraft] = useState('');
  if (!p || !c) return null;

  const tx = state.transactions.find((t) => t.id === c.exceptionTxnId);
  const refunded = state.transactions.find((t) => t.id === `tx_refund_${c.exceptionTxnId}`);
  const afterEffective = tx && c.effectiveAt && Date.parse(tx.postedAt) > Date.parse(c.effectiveAt);

  const steps = STAGES.map(([key, label]) => ({
    label,
    state: 'done',
    detail: c.timeline.find((t) => t.label === label)?.detail || null,
    at: c.timeline.find((t) => t.label === label) ? longDate(c.timeline.find((t) => t.label === label).at) : null,
  }));
  if (c.exceptionTxnId) {
    steps.push({
      label: 'Charge appeared after cancellation',
      state: 'bad',
      detail: `${formatMoney(tx?.amountCents ?? 0)} posted on ${longDate(tx?.postedAt ?? state.nowISO)}.`,
      at: null,
    });
  }
  if (c.stage === 'draft_prepared') steps.push({ label: 'Draft prepared', state: 'now', detail: 'Nothing has been sent.', at: null });
  if (c.stage === 'demo_refund_requested') {
    steps.push({ label: 'Draft prepared', state: 'done', detail: null, at: null });
    steps.push({ label: 'Demo refund requested', state: 'now', detail: 'Simulated only.', at: null });
  }
  if (c.stage === 'resolved') {
    steps.push({ label: 'Demo refund requested', state: 'done', detail: null, at: null });
    steps.push({ label: 'Refund credited in demo', state: 'done', detail: `${formatMoney(tx?.amountCents ?? 0)} credited.`, at: null });
  }

  return (
    <Sheet
      title={`${p.merchant} cancellation watch`}
      subtitle={c.exceptionTxnId ? 'An exception is open on this case' : 'Confirmed in demo, still monitoring'}
      onClose={onClose}
      wide
      footer={
        c.stage === 'exception_open' ? (
          <>
            <button type="button" className="btn primary grow" onClick={() => { run.prepareRefundDraft(c.id); notify('Refund request drafted. Nothing sent.'); }}>
              Prepare refund request
            </button>
            <button type="button" className="btn" onClick={onClose}>Close</button>
          </>
        ) : c.stage === 'draft_prepared' ? (
          <>
            <button type="button" className="btn primary grow" onClick={() => { run.simulateSendRefundRequest(c.id); notify('Demo refund requested. No message was sent.'); }}>
              Simulate sending request
            </button>
            <button type="button" className="btn" onClick={onClose}>Close</button>
          </>
        ) : c.stage === 'demo_refund_requested' ? (
          <>
            <button type="button" className="btn primary grow" onClick={() => { run.simulateRefundResponse(c.id); notify('Simulated refund credited.', 'good'); }}>
              Simulate refund response
            </button>
            <button type="button" className="btn" onClick={onClose}>Close</button>
          </>
        ) : (
          <button type="button" className="btn grow" onClick={onClose}>Close</button>
        )
      }
    >
      <div className="stack">
        {c.exceptionTxnId && c.stage !== 'resolved' ? (
          <div className="callout red">
            <div className="row gap-sm" style={{ alignItems: 'flex-start' }}>
              <AlertTriangle size={18} color="var(--red)" style={{ marginTop: 1, flex: 'none' }} />
              <div>
                <div style={{ fontWeight: 590 }}>A charge appeared after your cancellation. Review the evidence.</div>
                <p className="small muted" style={{ marginTop: 4 }}>
                  The financial outcome is unresolved until a credit actually arrives.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {c.stage === 'resolved' && refunded ? (
          <div className="callout emerald">
            <div style={{ fontWeight: 570 }}>
              <Money cents={Math.abs(refunded.amountCents)} /> credited in the demo
            </div>
            <p className="small muted" style={{ marginTop: 4 }}>
              Linked to the same posted charge, so it is counted once in your savings ledger.
            </p>
          </div>
        ) : null}

        {tx ? (
          <div className="grid2">
            <Card>
              <div className="eyebrow" style={{ marginBottom: 8 }}>Your cancellation receipt</div>
              <div className="stack-sm">
                <Field label="Approved">{longDate(c.approvedAt)}</Field>
                <Field label="Effective">{longDate(c.effectiveAt)}</Field>
                <Field label="Reference"><span className="num">{c.confirmationRef}</span></Field>
              </div>
            </Card>
            <Card>
              <div className="eyebrow" style={{ marginBottom: 8 }}>The later charge</div>
              <div className="stack-sm">
                <Field label="Posted">{longDate(tx.postedAt)}</Field>
                <Field label="Amount"><Money cents={tx.amountCents} /></Field>
                <Field label="Check">
                  {afterEffective ? (
                    <span style={{ color: 'var(--red)' }}>Posted after the effective cancellation date</span>
                  ) : (
                    <span className="dim">Posted before the effective date</span>
                  )}
                </Field>
              </div>
            </Card>
          </div>
        ) : null}

        <Card>
          <div className="eyebrow" style={{ marginBottom: 11 }}>Action lifecycle</div>
          <Lifecycle steps={steps} />
        </Card>

        {c.refundDraft ? (
          <Card>
            <div className="eyebrow" style={{ marginBottom: 7 }}>Refund request draft</div>
            <textarea
              className="input"
              value={draft || c.refundDraft}
              onChange={(e) => setDraft(e.target.value)}
              aria-label="Refund request draft"
            />
            <div className="btnrow" style={{ marginTop: 9 }}>
              <button
                type="button"
                className="btn sm"
                onClick={async () => {
                  const ok = await copyText(draft || c.refundDraft);
                  notify(ok ? 'Draft copied.' : 'Could not reach the clipboard. Select the text and copy it manually.', ok ? 'good' : 'bad');
                }}
              >
                <Copy size={14} /> Copy draft
              </button>
            </div>
            <p className="tiny dim" style={{ marginTop: 8 }}>
              This asks the merchant for a refund. SubKill does not call this fraud and does not open a bank dispute.
            </p>
          </Card>
        ) : null}

        {c.evidenceIds.length ? (
          <div>
            <div className="eyebrow" style={{ marginBottom: 7 }}>Evidence</div>
            <Evidence items={state.evidence.filter((e) => c.evidenceIds.includes(e.id))} />
          </div>
        ) : null}
      </div>
    </Sheet>
  );
}

// ---------------------------------------------------------------- small sheets

function ContractSheet({ paymentId, onClose }) {
  const { state } = useStore();
  const p = paymentById(state, paymentId);
  if (!p?.contract) return null;
  return (
    <Sheet title="Contract clause" subtitle={p.contract.documentName} onClose={onClose}
      footer={<button type="button" className="btn grow" onClick={onClose}>Close</button>}>
      <div className="callout" style={{ fontStyle: 'italic' }}>
        <p className="small">"{p.contract.clause}"</p>
      </div>
      <div className="stack-sm" style={{ marginTop: 14 }}>
        <Field label="Renewal date">{longDate(p.nextChargeAt)}</Field>
        <Field label="Notice required">{p.contract.noticeDays} days</Field>
        <Field label="Last date to give notice">
          <span style={{ color: 'var(--amber)' }}>{longDate(decisionDeadline(p))}</span>
        </Field>
      </div>
      <p className="tiny dim" style={{ marginTop: 12 }}>
        Sample contract text written for this prototype. {p.merchant} is a fictional provider.
      </p>
    </Sheet>
  );
}

function ReviewLaterSheet({ paymentId, onClose }) {
  const { state, run, notify } = useStore();
  const p = paymentById(state, paymentId);
  const [date, setDate] = useState(new Date(Date.parse(state.nowISO) + 30 * 86400000).toISOString().slice(0, 10));
  if (!p) return null;
  return (
    <Sheet title="Review later" subtitle={`Choose when SubKill should raise ${p.merchant} again.`} onClose={onClose}
      footer={
        <>
          <button
            type="button"
            className="btn primary grow"
            onClick={() => {
              run.keepPayment(p.id, new Date(`${date}T09:00:00.000Z`).toISOString());
              notify(`${p.merchant} will stay quiet until ${longDate(`${date}T09:00:00.000Z`)}.`);
              onClose();
            }}
          >
            Set review date
          </button>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
        </>
      }
    >
      <div className="field">
        <label htmlFor="rl">Review on</label>
        <input id="rl" className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <p className="tiny dim" style={{ marginTop: 11 }}>
        Until then this stays out of your decision queue and out of active suggestions. The payment itself
        is unchanged and still appears on your timeline.
      </p>
    </Sheet>
  );
}

function ReminderSheet({ paymentId, onClose }) {
  const { state, run, notify } = useStore();
  const p = paymentById(state, paymentId);
  const existing = state.reminders.find((r) => r.paymentId === paymentId);
  const [date, setDate] = useState((existing?.dueAt || state.nowISO).slice(0, 10));
  if (!p) return null;
  return (
    <Sheet title="Edit reminder" subtitle={p.merchant} onClose={onClose}
      footer={
        <>
          <button
            type="button"
            className="btn primary grow"
            onClick={() => {
              run.upsertReminder(existing?.id || `rm_${p.id}`, p.id, new Date(`${date}T09:00:00.000Z`).toISOString(), `${p.merchant} reminder`);
              notify('Reminder updated.');
              onClose();
            }}
          >
            Save reminder
          </button>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
        </>
      }
    >
      <div className="field">
        <label htmlFor="rem">Remind me on</label>
        <input id="rem" className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <p className="tiny dim" style={{ marginTop: 11 }}>
        Reminders appear inside this demo. No notification is sent to a real device.
      </p>
    </Sheet>
  );
}

function RoadmapSheet({ topic, onClose }) {
  return (
    <Sheet title={topic.title} subtitle="Concept preview. Not available in this prototype." onClose={onClose}
      footer={<button type="button" className="btn grow" onClick={onClose}>Close</button>}>
      <div className="callout amber small" style={{ marginBottom: 13 }}>
        This needs real integrations and validation before it could work. It is shown here as a direction,
        not a working feature.
      </div>
      <p className="small muted">{topic.body}</p>
    </Sheet>
  );
}

// ---------------------------------------------------------------- dispatcher

export default function SheetHost() {
  const { sheet, setSheet } = useStore();
  if (!sheet) return null;
  const close = () => setSheet(null);
  switch (sheet.kind) {
    case 'payment': return <PaymentSheet paymentId={sheet.paymentId} onClose={close} />;
    case 'bill': return <BillSheet paymentId={sheet.paymentId} onClose={close} />;
    case 'case': return <CaseSheet paymentId={sheet.paymentId} onClose={close} />;
    case 'contract': return <ContractSheet paymentId={sheet.paymentId} onClose={close} />;
    case 'reviewLater': return <ReviewLaterSheet paymentId={sheet.paymentId} onClose={close} />;
    case 'reminder': return <ReminderSheet paymentId={sheet.paymentId} onClose={close} />;
    case 'roadmap': return <RoadmapSheet topic={sheet.topic} onClose={close} />;
    default: return null;
  }
}
