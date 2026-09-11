/**
 * SubKill — every displayed number is computed here.
 *
 * No screen, chart, export or report may hard-code a monetary total.
 * If a figure appears in the UI, it comes from a selector in this file.
 */

import type {
  Cents, DemoState, LedgerEvent, Obligation, Opportunity, Payment,
} from './seed.ts';
import { DAY_MS, HARBOR_CURR_DOC, HARBOR_PREV_DOC } from './seed.ts';

// ---------------------------------------------------------------------------
// Money
// ---------------------------------------------------------------------------

export function formatMoney(cents: Cents, opts: { sign?: boolean; cents?: boolean } = {}): string {
  const showCents = opts.cents !== false;
  const abs = Math.abs(cents);
  const body = (abs / 100).toLocaleString('en-US', {
    minimumFractionDigits: showCents ? 2 : 0,
    maximumFractionDigits: showCents ? 2 : 0,
  });
  const neg = cents < 0;
  const prefix = opts.sign ? (neg ? '−' : '+') : neg ? '−' : '';
  return `${prefix}$${body}`;
}

/** Monthly equivalent of a payment. Annual plans divide by 12. */
export function monthlyEquivalent(p: Payment): Cents {
  return p.interval === 'annual' ? Math.round(p.amountCents / 12) : p.amountCents;
}

export function annualized(cents: Cents): Cents {
  return cents * 12;
}

// ---------------------------------------------------------------------------
// Payment collections
// ---------------------------------------------------------------------------

export const isActive = (p: Payment) => p.status === 'active' || p.status === 'paused';

export function activeSubscriptions(s: DemoState): Payment[] {
  return s.payments.filter((p) => p.kind === 'subscription' && isActive(p));
}
export function activeBills(s: DemoState): Payment[] {
  return s.payments.filter((p) => p.kind === 'bill' && isActive(p));
}
export function activeTrials(s: DemoState): Payment[] {
  return s.payments.filter((p) => p.kind === 'trial' && isActive(p));
}
export function archivedPayments(s: DemoState): Payment[] {
  return s.payments.filter((p) => p.status === 'archived' || p.status === 'cancelled');
}
export function paymentById(s: DemoState, id: string): Payment | undefined {
  return s.payments.find((p) => p.id === id);
}

// ---------------------------------------------------------------------------
// Headline commitment figures
// ---------------------------------------------------------------------------

/** $228.84 at baseline — computed, never written down. */
export function subscriptionsMonthlyTotal(s: DemoState): Cents {
  return activeSubscriptions(s).reduce((a, p) => a + monthlyEquivalent(p), 0);
}

/** $613.16 at baseline. */
export function billsMonthlyTotal(s: DemoState): Cents {
  return activeBills(s).reduce((a, p) => a + monthlyEquivalent(p), 0);
}

/**
 * Active paid recurring commitment. $842.00 at baseline.
 * Unconverted trials are deliberately excluded: they are not yet paid commitments.
 */
export function monthlyCommitment(s: DemoState): Cents {
  return subscriptionsMonthlyTotal(s) + billsMonthlyTotal(s);
}

/** $10,104.00 at baseline. A projection at today's rates, not a guaranteed year. */
export function annualizedCommitment(s: DemoState): Cents {
  return annualized(monthlyCommitment(s));
}

/** 27 at baseline: 18 subscriptions + 7 bills + 2 trials. */
export function trackedItems(s: DemoState) {
  const subs = activeSubscriptions(s);
  const bills = activeBills(s);
  const trials = activeTrials(s);
  return {
    subscriptions: subs.length,
    bills: bills.length,
    trials: trials.length,
    total: subs.length + bills.length + trials.length,
  };
}

/** Child-assigned records. $32.97 at baseline. */
export function childMonthlyTotal(s: DemoState): Cents {
  return s.payments
    .filter((p) => isActive(p) && p.owner === 'brian')
    .reduce((a, p) => a + monthlyEquivalent(p), 0);
}

// ---------------------------------------------------------------------------
// Opportunities — candidate reductions
// ---------------------------------------------------------------------------

export function openOpportunities(s: DemoState): Opportunity[] {
  return s.opportunities.filter((o) => {
    if (o.status !== 'open') return false;
    if (o.reviewAfter && Date.parse(o.reviewAfter) > Date.parse(s.nowISO)) return false;
    const p = paymentById(s, o.paymentId);
    if (!p || !isActive(p)) return false;
    return true;
  });
}

/** Only the seeded candidate set rolls up. $96.96/mo at baseline. */
export function candidateMonthlyReduction(s: DemoState): Cents {
  return openOpportunities(s)
    .filter((o) => o.countsTowardCandidateTotal)
    .reduce((a, o) => a + o.monthlyReductionCents, 0);
}

/** $1,163.52 at baseline. Proposed possibilities, not confirmed savings. */
export function candidateAnnualReduction(s: DemoState): Cents {
  return annualized(candidateMonthlyReduction(s));
}

/** Opportunities held back from totals, with the reason. */
export function excludedOpportunities(s: DemoState): Opportunity[] {
  return s.opportunities.filter((o) => o.status === 'open' && !o.countsTowardCandidateTotal);
}

// ---------------------------------------------------------------------------
// Confirmed reductions — projections from accepted demo outcomes
// ---------------------------------------------------------------------------

export interface ConfirmedReduction {
  paymentId: string;
  merchant: string;
  monthlyCents: Cents;
  annualCents: Cents;
  basis: string;
  periodMonths: number | null;
}

/** Netflix cancelled alone gives $191.88. Always labelled a projection, never cash. */
export function confirmedReductions(s: DemoState): ConfirmedReduction[] {
  const out: ConfirmedReduction[] = [];
  for (const c of s.cases) {
    if (c.action !== 'cancel') continue;
    if (c.stage !== 'demo_confirmation_received' && c.stage !== 'monitoring'
      && c.stage !== 'exception_open' && c.stage !== 'draft_prepared'
      && c.stage !== 'demo_refund_requested' && c.stage !== 'resolved') continue;
    const p = paymentById(s, c.paymentId);
    if (!p) continue;
    const m = monthlyEquivalent(p);
    out.push({
      paymentId: p.id,
      merchant: p.merchant,
      monthlyCents: m,
      annualCents: annualized(m),
      basis: `Ongoing ${formatMoney(m)}/month commitment removed at today's price.`,
      periodMonths: null,
    });
  }
  if (s.harborOffer.stage === 'accepted') {
    out.push({
      paymentId: 'p_harbor',
      merchant: 'Harbor Internet',
      monthlyCents: s.harborOffer.creditCents,
      annualCents: s.harborOffer.creditCents * s.harborOffer.months,
      basis: `Applies to the ${s.harborOffer.months}-month offer period only. The price returns to the base rate afterwards.`,
      periodMonths: s.harborOffer.months,
    });
  }
  return out;
}

export function confirmedAnnualReduction(s: DemoState): Cents {
  return confirmedReductions(s).reduce((a, r) => a + r.annualCents, 0);
}

// ---------------------------------------------------------------------------
// Observed benefit — historical money only
// ---------------------------------------------------------------------------

export function liveLedger(s: DemoState): LedgerEvent[] {
  return s.ledger.filter((e) => e.status !== 'reversed');
}

export function ledgerByType(s: DemoState, type: LedgerEvent['type']): LedgerEvent[] {
  return liveLedger(s).filter((e) => e.type === type && e.status === 'confirmed');
}

/** $87.00 at baseline: $35 refund + $25 avoided renewal + $27 observed bill reduction. */
export function grossObservedBenefit(s: DemoState): Cents {
  return liveLedger(s)
    .filter((e) => e.status === 'confirmed' && e.type !== 'fee')
    .reduce((a, e) => a + e.amountCents, 0);
}

export function feesPaid(s: DemoState): Cents {
  return liveLedger(s)
    .filter((e) => e.type === 'fee' && e.status === 'confirmed')
    .reduce((a, e) => a + e.amountCents, 0);
}

export function netObservedBenefit(s: DemoState): Cents {
  return grossObservedBenefit(s) - feesPaid(s);
}

export function awaitingVerification(s: DemoState): LedgerEvent[] {
  return liveLedger(s).filter((e) => e.status === 'awaiting_verification');
}

// ---------------------------------------------------------------------------
// Forecast — scheduled charges, never a bank balance
// ---------------------------------------------------------------------------

export type Choice = 'keep' | 'cancel' | 'pause' | 'downgrade';
export type Scenario = Record<string, Choice>;

export interface ForecastRow {
  obligationId: string;
  paymentId: string;
  merchant: string;
  dueAt: string;
  baselineCents: Cents;
  proposedCents: Cents;
  kind: Obligation['kind'];
  changed: boolean;
  note: string | null;
}

function windowEnd(s: DemoState, days: number): number {
  return Date.parse(s.nowISO) + days * DAY_MS;
}

/** Obligations still expected to post, inside the window. */
export function scheduledInWindow(s: DemoState, days: number): Obligation[] {
  const from = Date.parse(s.nowISO);
  const to = windowEnd(s, days);
  return s.obligations
    .filter((o) => o.status === 'scheduled')
    .filter((o) => {
      const t = Date.parse(o.dueAt);
      return t > from && t <= to;
    })
    .filter((o) => {
      const p = paymentById(s, o.paymentId);
      return !!p && isActive(p);
    })
    .sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt));
}

export function forecast(s: DemoState, scenario: Scenario, days: number): ForecastRow[] {
  const seenPause = new Set<string>();
  return scheduledInWindow(s, days).map((o) => {
    const p = paymentById(s, o.paymentId)!;
    const choice = scenario[o.paymentId] ?? 'keep';
    let proposed = o.amountCents;
    let note: string | null = null;

    if (choice === 'cancel') {
      proposed = 0;
      note = p.kind === 'trial'
        ? 'Trial cancelled before conversion, so the first charge does not happen.'
        : 'Cancellation effective before this renewal.';
    } else if (choice === 'pause' && p.pauseOption) {
      if (!seenPause.has(p.id)) {
        seenPause.add(p.id);
        proposed = 0;
        note = `One charge skipped by the ${p.pauseOption.months}-month hold. Billing resumes afterwards.`;
      } else {
        note = 'Billing has resumed after the hold.';
      }
    } else if (choice === 'downgrade' && p.downgradeOption) {
      proposed = p.downgradeOption.amountCents;
      note = `Lower tier: ${p.downgradeOption.planName}.`;
    }

    return {
      obligationId: o.id,
      paymentId: o.paymentId,
      merchant: p.merchant,
      dueAt: o.dueAt,
      baselineCents: o.amountCents,
      proposedCents: proposed,
      kind: o.kind,
      changed: proposed !== o.amountCents,
      note,
    };
  });
}

export interface ForecastTotals {
  baselineCents: Cents;
  proposedCents: Cents;
  differenceCents: Cents;
  rows: ForecastRow[];
  changedRows: ForecastRow[];
}

/** Netflix + Canva selected across the 30-day window gives a $30.98 difference. */
export function forecastTotals(s: DemoState, scenario: Scenario, days: number): ForecastTotals {
  const rows = forecast(s, scenario, days);
  const baselineCents = rows.reduce((a, r) => a + r.baselineCents, 0);
  const proposedCents = rows.reduce((a, r) => a + r.proposedCents, 0);
  return {
    baselineCents,
    proposedCents,
    differenceCents: baselineCents - proposedCents,
    rows,
    changedRows: rows.filter((r) => r.changed),
  };
}

/** Ongoing monthly commitment if the scenario were applied. Trials stay out of it. */
export function scenarioMonthlyCommitment(s: DemoState, scenario: Scenario): Cents {
  return s.payments
    .filter((p) => isActive(p) && p.kind !== 'trial')
    .reduce((a, p) => {
      const choice = scenario[p.id] ?? 'keep';
      if (choice === 'cancel') return a;
      if (choice === 'downgrade' && p.downgradeOption) return a + p.downgradeOption.amountCents;
      return a + monthlyEquivalent(p);
    }, 0);
}

// ---------------------------------------------------------------------------
// Bill Detective
// ---------------------------------------------------------------------------

export interface BillComparison {
  available: boolean;
  reason: string | null;
  previous: { total: Cents; lines: { label: string; amountCents: Cents }[]; periodLabel: string } | null;
  current: { total: Cents; lines: { label: string; amountCents: Cents }[]; periodLabel: string } | null;
  deltaCents: Cents;
  percent: number;
  annualIfSustained: Cents;
  changedLineLabel: string | null;
  explanation: string;
}

export function billComparison(s: DemoState, paymentId: string): BillComparison {
  const docs = s.billDocuments
    .filter((d) => d.paymentId === paymentId)
    .sort((a, b) => Date.parse(a.issuedAt) - Date.parse(b.issuedAt));

  if (docs.length < 2) {
    return {
      available: false,
      reason: 'Only one bill for this account is present in the sample data. A prior period is required to explain a change, so SubKill has nothing to compare.',
      previous: null,
      current: docs[0]
        ? { total: docs[0].totalCents, lines: docs[0].lines, periodLabel: docs[0].periodLabel }
        : null,
      deltaCents: 0,
      percent: 0,
      annualIfSustained: 0,
      changedLineLabel: null,
      explanation: 'Comparison unavailable.',
    };
  }

  const prev = docs[docs.length - 2];
  const curr = docs[docs.length - 1];
  const deltaCents = curr.totalCents - prev.totalCents;
  const percent = prev.totalCents === 0 ? 0 : (deltaCents / prev.totalCents) * 100;

  let changedLineLabel: string | null = null;
  let explanation = 'The total changed.';
  for (const line of curr.lines) {
    const before = prev.lines.find((l) => l.label === line.label);
    if (before && before.amountCents !== line.amountCents) {
      changedLineLabel = line.label;
      const baseSame = curr.lines.some((l) => {
        const b = prev.lines.find((x) => x.label === l.label);
        return b && b.amountCents === l.amountCents && l.amountCents > 0;
      });
      explanation = baseSame
        ? `Your base plan price stayed the same. An ${formatMoney(Math.abs(before.amountCents))} monthly promotional credit ended.`
        : `The ${line.label.toLowerCase()} changed.`;
      break;
    }
  }

  return {
    available: true,
    reason: null,
    previous: { total: prev.totalCents, lines: prev.lines, periodLabel: prev.periodLabel },
    current: { total: curr.totalCents, lines: curr.lines, periodLabel: curr.periodLabel },
    deltaCents,
    percent,
    annualIfSustained: deltaCents * 12,
    changedLineLabel,
    explanation,
  };
}

export function harborComparison(s: DemoState): BillComparison {
  return billComparison(s, 'p_harbor');
}

export const HARBOR_DOC_IDS = { previous: HARBOR_PREV_DOC, current: HARBOR_CURR_DOC };

// ---------------------------------------------------------------------------
// Decisions, deadlines and alerts
// ---------------------------------------------------------------------------

export interface DecisionCard {
  id: string;
  paymentId: string;
  merchant: string;
  title: string;
  detail: string;
  amountCents: Cents;
  dueAt: string | null;
  tone: 'amber' | 'red' | 'blue';
  action: string;
  opportunityId: string | null;
  evidenceIds: string[];
  /** 0 unresolved exception, 1 trial deadline, 2 renewal review, 3 bill change. */
  priority: number;
  why: string;
}

function utcMidnight(iso: string): number {
  const d = new Date(iso);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/**
 * Calendar days, not elapsed hours. A charge at 09:00 tomorrow is "tomorrow"
 * even though it is only 15 hours away from an 18:00 demo clock.
 */
export function daysUntil(s: DemoState, iso: string): number {
  return Math.round((utcMidnight(iso) - utcMidnight(s.nowISO)) / DAY_MS);
}

export function hoursUntil(s: DemoState, iso: string): number {
  return Math.floor((Date.parse(iso) - Date.parse(s.nowISO)) / 3_600_000);
}

/** Last date a cancellation can be given, allowing for a notice period. */
export function decisionDeadline(p: Payment): string | null {
  if (p.trial) return p.trial.decisionDeadlineAt;
  if (!p.nextChargeAt) return null;
  if (p.contract) return new Date(Date.parse(p.nextChargeAt) - p.contract.noticeDays * DAY_MS).toISOString();
  return p.nextChargeAt;
}

function quietUntil(s: DemoState, paymentId: string): number | null {
  const rule = s.rules.find((r) => r.kind === 'quiet_until' && r.paymentId === paymentId && r.enabled);
  if (!rule) return null;
  const op = s.opportunities.find((o) => o.paymentId === paymentId);
  return op?.reviewAfter ? Date.parse(op.reviewAfter) : null;
}

/** The Home queue. At most three, ordered by urgency then size. */
export function decisionQueue(s: DemoState): DecisionCard[] {
  const cards: DecisionCard[] = [];
  const now = Date.parse(s.nowISO);

  for (const p of activeTrials(s)) {
    if (!p.trial) continue;
    const h = hoursUntil(s, p.trial.decisionDeadlineAt);
    // Only a deadline inside 48 hours is worth interrupting for.
    if (h < 0 || h > 48) continue;
    cards.push({
      id: `dc_trial_${p.id}`,
      paymentId: p.id,
      merchant: p.merchant,
      title: `${p.merchant}: trial ends ${h <= 36 ? 'tomorrow' : `in ${Math.ceil(h / 24)} days`}`,
      detail: `${formatMoney(p.trial.firstChargeCents)} first charge if it converts.`,
      amountCents: p.trial.firstChargeCents,
      dueAt: p.trial.decisionDeadlineAt,
      tone: 'amber',
      action: 'Review trial',
      opportunityId: null,
      evidenceIds: p.id === 'p_canva' ? ['ev_canva_trial'] : ['ev_disney_trial'],
      priority: 1,
      why: 'A free trial converts to a paid plan on a fixed date. After that date the first charge has already happened, so this is a deadline rather than a renewal you can revisit.',
    });
  }

  for (const o of openOpportunities(s)) {
    const p = paymentById(s, o.paymentId);
    if (!p) continue;
    const q = quietUntil(s, p.id);
    if (q && q > now) continue;
    if (o.type === 'credit_restore') {
      const cmp = billComparison(s, p.id);
      cards.push({
        id: `dc_bill_${p.id}`,
        paymentId: p.id,
        merchant: p.merchant,
        title: `${p.merchant}: ${formatMoney(cmp.previous?.total ?? 0, { cents: false })} → ${formatMoney(cmp.current?.total ?? 0, { cents: false })}`,
        detail: `An ${formatMoney(o.monthlyReductionCents)} promotional credit expired.`,
        amountCents: o.monthlyReductionCents,
        dueAt: p.nextChargeAt,
        tone: 'blue',
        action: 'Explain increase',
        opportunityId: o.id,
        evidenceIds: o.evidenceIds,
        priority: 3,
        why: 'The amount charged changed between two bills that are both in your sample data, so the change can be explained line by line rather than guessed at.',
      });
      continue;
    }
    if (o.type !== 'cancel') continue;
    const d = p.nextChargeAt ? daysUntil(s, p.nextChargeAt) : 99;
    // Only a charge inside roughly 48 hours earns a place in the hero queue.
    // Everything else stays on the timeline and in Alerts.
    if (d > 1) continue;
    cards.push({
      id: `dc_op_${o.id}`,
      paymentId: p.id,
      merchant: p.merchant,
      title: `${p.merchant}: ${formatMoney(p.amountCents)} ${d <= 1 ? 'tomorrow' : `in ${d} days`}`,
      detail: p.usageReport ?? 'Usage unknown.',
      amountCents: p.amountCents,
      dueAt: p.nextChargeAt,
      tone: 'amber',
      action: 'Review options',
      opportunityId: o.id,
      evidenceIds: o.evidenceIds,
      priority: 2,
      why: 'A renewal on its own is not a problem. This one is here because the charge lands within 48 hours and the only usage signal available points the other way, so it is worth a look before it bills rather than after.',
    });
  }

  for (const c of s.cases) {
    if (c.stage !== 'exception_open') continue;
    const p = paymentById(s, c.paymentId);
    if (!p) continue;
    const tx = s.transactions.find((t) => t.id === c.exceptionTxnId);
    cards.push({
      id: `dc_case_${c.id}`,
      paymentId: p.id,
      merchant: p.merchant,
      title: `${p.merchant}: a charge appeared after your cancellation`,
      detail: `${formatMoney(tx?.amountCents ?? 0)} posted after the effective date. Review the evidence.`,
      amountCents: tx?.amountCents ?? 0,
      dueAt: tx?.postedAt ?? null,
      tone: 'red',
      action: 'Review evidence',
      opportunityId: null,
      evidenceIds: c.evidenceIds,
      priority: 0,
      why: 'A charge posted after the cancellation you approved. That is an unresolved payment exception, so it outranks everything else in the queue.',
    });
  }

  cards.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    const at = a.dueAt ? Date.parse(a.dueAt) : Infinity;
    const bt = b.dueAt ? Date.parse(b.dueAt) : Infinity;
    if (at !== bt) return at - bt;
    return b.amountCents - a.amountCents;
  });
  return cards;
}

export function topDecisions(s: DemoState): DecisionCard[] {
  return decisionQueue(s).slice(0, 3);
}

/** Next date worth coming back for, once the queue is clear. */
export function nextReviewDate(s: DemoState): string | null {
  const candidates: number[] = [];
  for (const p of s.payments) {
    if (!isActive(p)) continue;
    const d = decisionDeadline(p);
    if (d && Date.parse(d) > Date.parse(s.nowISO)) candidates.push(Date.parse(d));
  }
  for (const o of s.opportunities) {
    if (o.reviewAfter && Date.parse(o.reviewAfter) > Date.parse(s.nowISO)) candidates.push(Date.parse(o.reviewAfter));
  }
  if (!candidates.length) return null;
  return new Date(Math.min(...candidates)).toISOString();
}

// ---------------------------------------------------------------------------
// Alerts
// ---------------------------------------------------------------------------

export interface AlertRow {
  id: string;
  paymentId: string | null;
  title: string;
  detail: string;
  status: 'open' | 'watching' | 'resolved';
  tone: 'amber' | 'red' | 'blue' | 'emerald';
  at: string;
  evidenceIds: string[];
  action: string | null;
  reviewAfter: string | null;
}

export function alerts(s: DemoState): AlertRow[] {
  const out: AlertRow[] = [];
  const push = (a: Omit<AlertRow, 'status' | 'reviewAfter'>) => {
    const st = s.alertState[a.id];
    out.push({ ...a, status: st?.status ?? 'open', reviewAfter: st?.reviewAfter ?? null });
  };

  for (const p of activeTrials(s)) {
    if (!p.trial) continue;
    push({
      id: `al_trial_${p.id}`, paymentId: p.id,
      title: `${p.merchant} trial converts ${daysUntil(s, p.trial.convertsAt) <= 1 ? 'tomorrow' : `in ${daysUntil(s, p.trial.convertsAt)} days`}`,
      detail: `First charge would be ${formatMoney(p.trial.firstChargeCents)}. ${p.trial.accessEndsImmediately ? 'Access ends immediately on cancellation.' : 'Access continues to the end of the paid period if it converts.'}`,
      tone: 'amber', at: p.trial.convertsAt,
      evidenceIds: p.id === 'p_canva' ? ['ev_canva_trial'] : ['ev_disney_trial'],
      action: 'Review trial',
    });
  }

  const harbor = harborComparison(s);
  if (harbor.available && harbor.deltaCents > 0) {
    push({
      id: 'al_harbor', paymentId: 'p_harbor',
      title: `Harbor Internet went up by ${formatMoney(harbor.deltaCents)}`,
      detail: harbor.explanation,
      tone: 'blue', at: '2026-09-08T09:00:00.000Z',
      evidenceIds: ['ev_harbor_bills'], action: 'Explain increase',
    });
  }

  for (const p of s.payments) {
    if (!isActive(p) || !p.contract || !p.nextChargeAt) continue;
    const dd = decisionDeadline(p);
    if (!dd) continue;
    push({
      id: `al_notice_${p.id}`, paymentId: p.id,
      title: `${p.merchant}: decide by ${shortDate(dd)}, not ${shortDate(p.nextChargeAt)}`,
      detail: `${p.contract.noticeDays} days notice is required before renewal.`,
      tone: 'amber', at: dd, evidenceIds: ['ev_languagelab_contract'],
      action: 'View deadline',
    });
  }

  for (const c of s.cases) {
    if (c.stage === 'exception_open' || c.stage === 'draft_prepared' || c.stage === 'demo_refund_requested') {
      const p = paymentById(s, c.paymentId);
      push({
        id: `al_case_${c.id}`, paymentId: c.paymentId,
        title: `${p?.merchant ?? 'Service'}: charge after cancellation`,
        detail: 'A charge appeared after your cancellation. Review the evidence.',
        tone: 'red', at: c.timeline[c.timeline.length - 1]?.at ?? s.nowISO,
        evidenceIds: c.evidenceIds, action: 'Open case',
      });
    } else if (c.stage === 'monitoring') {
      push({
        id: `al_case_${c.id}`, paymentId: c.paymentId,
        title: `${paymentById(s, c.paymentId)?.merchant ?? 'Service'} cancellation confirmed in demo`,
        detail: 'Watching for another charge on this account.',
        tone: 'emerald', at: c.effectiveAt ?? c.openedAt,
        evidenceIds: c.evidenceIds, action: 'View receipt',
      });
    }
  }

  const digestOn = s.rules.find((r) => r.kind === 'digest')?.enabled;
  if (digestOn) {
    const routine = scheduledInWindow(s, 7).length;
    if (routine > 0) {
      push({
        id: 'al_digest', paymentId: null,
        title: `${routine} routine payments in the next 7 days`,
        detail: 'Included because your weekly digest rule is on. Nothing here needs a decision.',
        tone: 'blue', at: s.nowISO, evidenceIds: [], action: 'View timeline',
      });
    }
  }

  return out.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}

export function alertCounts(s: DemoState) {
  const a = alerts(s);
  return {
    all: a.length,
    needsDecision: a.filter((x) => x.status === 'open' && x.tone !== 'emerald' && x.tone !== 'blue').length,
    watching: a.filter((x) => x.status === 'watching' || x.tone === 'emerald').length,
    resolved: a.filter((x) => x.status === 'resolved').length,
  };
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function shortDate(iso: string): string {
  const d = new Date(iso);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}
export function longDate(iso: string): string {
  const d = new Date(iso);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}
export function relativeDay(s: DemoState, iso: string): string {
  const d = daysUntil(s, iso);
  if (d < 0) return `${Math.abs(d)}d ago`;
  if (d === 0) return 'Today';
  if (d === 1) return 'Tomorrow';
  return `In ${d} days`;
}

// ---------------------------------------------------------------------------
// Monthly report
// ---------------------------------------------------------------------------

export interface MonthlyReport {
  periodLabel: string;
  monthlyCommitmentCents: Cents;
  annualizedCommitmentCents: Cents;
  actualChargesCents: Cents;
  actualChargeCount: number;
  subscriptions: number;
  bills: number;
  trials: number;
  completedActions: number;
  unresolvedCases: number;
  grossObservedCents: Cents;
  netObservedCents: Cents;
  feesCents: Cents;
  futureOpportunityAnnualCents: Cents;
  confirmedAnnualCents: Cents;
}

export function monthlyReport(s: DemoState): MonthlyReport {
  const now = new Date(s.nowISO);
  const monthStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
  const monthEnd = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1);
  const inPeriod = s.transactions.filter((t) => {
    const p = Date.parse(t.postedAt);
    return p >= monthStart && p < monthEnd && t.kind === 'charge';
  });
  const items = trackedItems(s);
  return {
    periodLabel: `${MONTHS[now.getUTCMonth()]} ${now.getUTCFullYear()}`,
    monthlyCommitmentCents: monthlyCommitment(s),
    annualizedCommitmentCents: annualizedCommitment(s),
    actualChargesCents: inPeriod.reduce((a, t) => a + t.amountCents, 0),
    actualChargeCount: inPeriod.length,
    subscriptions: items.subscriptions,
    bills: items.bills,
    trials: items.trials,
    completedActions: s.cases.filter((c) => c.stage === 'monitoring' || c.stage === 'resolved').length,
    unresolvedCases: s.cases.filter((c) => c.stage === 'exception_open' || c.stage === 'draft_prepared' || c.stage === 'demo_refund_requested').length,
    grossObservedCents: grossObservedBenefit(s),
    netObservedCents: netObservedBenefit(s),
    feesCents: feesPaid(s),
    futureOpportunityAnnualCents: candidateAnnualReduction(s),
    confirmedAnnualCents: confirmedAnnualReduction(s),
  };
}

// ---------------------------------------------------------------------------
// Target finder — "find $50/month"
// ---------------------------------------------------------------------------

export interface TargetResult {
  targetCents: Cents;
  achievedCents: Cents;
  gapCents: Cents;
  achievable: boolean;
  picks: { opportunityId: string; paymentId: string; merchant: string; monthlyCents: Cents }[];
  skipped: { merchant: string; reason: string }[];
}

/** Greedy over eligible, unprotected records. Never pads, never auto-cancels. */
export function findTarget(s: DemoState, targetCents: Cents): TargetResult {
  const skipped: TargetResult['skipped'] = [];
  const eligible = openOpportunities(s)
    .filter((o) => {
      const p = paymentById(s, o.paymentId);
      if (!p) return false;
      if (p.favorite) { skipped.push({ merchant: p.merchant, reason: 'Marked as a favorite.' }); return false; }
      if (p.essential) { skipped.push({ merchant: p.merchant, reason: 'Marked essential.' }); return false; }
      if (o.availability !== 'eligible') {
        skipped.push({ merchant: p.merchant, reason: 'Availability is unknown until the provider responds.' });
        return false;
      }
      if (o.type === 'bundle_overlap') {
        skipped.push({ merchant: p.merchant, reason: 'Overlap is unconfirmed.' });
        return false;
      }
      return true;
    })
    .sort((a, b) => b.monthlyReductionCents - a.monthlyReductionCents);

  const picks: TargetResult['picks'] = [];
  let achieved = 0;
  for (const o of eligible) {
    if (achieved >= targetCents) break;
    const p = paymentById(s, o.paymentId)!;
    picks.push({ opportunityId: o.id, paymentId: p.id, merchant: p.merchant, monthlyCents: o.monthlyReductionCents });
    achieved += o.monthlyReductionCents;
  }
  return {
    targetCents,
    achievedCents: achieved,
    gapCents: Math.max(0, targetCents - achieved),
    achievable: achieved >= targetCents,
    picks,
    skipped,
  };
}

// ---------------------------------------------------------------------------
// Inbox discovery
// ---------------------------------------------------------------------------

export function discoveriesByVerdict(s: DemoState) {
  const open = s.discoveries.filter((d) => d.status === 'open');
  return {
    found: open.filter((d) => d.verdict === 'new'),
    uncertain: open.filter((d) => d.verdict === 'uncertain'),
    alreadyTracked: open.filter((d) => d.verdict === 'already_tracked'),
    added: s.discoveries.filter((d) => d.status === 'added'),
    dismissed: s.discoveries.filter((d) => d.status === 'dismissed'),
  };
}

/**
 * What the untracked findings would add to the monthly commitment if every one
 * were confirmed. A projection of unconfirmed records, never part of the
 * current commitment figure.
 */
export function undiscoveredMonthlyCents(s: DemoState): Cents {
  return discoveriesByVerdict(s)
    .found.filter((d) => !d.isTrial)
    .reduce((a, d) => a + (d.interval === 'annual' ? Math.round(d.amountCents / 12) : d.amountCents), 0);
}

export function scanSummary(s: DemoState) {
  const g = discoveriesByVerdict(s);
  const fresh = dataFreshness(s);
  const inbox = s.connections.find((c) => c.id === 'cx_email');
  return {
    status: s.scan.status,
    mailbox: s.scan.mailbox,
    lastRunAt: s.scan.lastRunAt,
    messagesScanned: s.scan.messagesScanned,
    newCount: g.found.length,
    uncertainCount: g.uncertain.length,
    trackedCount: g.alreadyTracked.length,
    addedCount: g.added.length,
    monthlyIfAllAdded: undiscoveredMonthlyCents(s),
    trialsFound: g.found.filter((d) => d.isTrial).length,
    /** A scan can only speak for the mailbox it can actually read. */
    sourceUsable: inbox ? inbox.state !== 'disconnected' : false,
    sourceStale: inbox ? inbox.state === 'simulated_stale' : false,
    canVerify: fresh.canVerifyAbsence,
  };
}

// ---------------------------------------------------------------------------
// Data freshness
// ---------------------------------------------------------------------------

export function dataFreshness(s: DemoState) {
  const stale = s.connections.filter((c) => c.state === 'simulated_stale');
  const disconnected = s.connections.filter((c) => c.state === 'disconnected');
  return {
    healthy: stale.length === 0 && disconnected.length === 0,
    stale,
    disconnected,
    /** A missing charge proves nothing while a source is stale. */
    canVerifyAbsence: stale.length === 0 && disconnected.length === 0,
    label: stale.length || disconnected.length
      ? 'Some sources are not current in this demo'
      : `Sources current as of ${shortDate(s.connections[0]?.lastSyncAt ?? s.nowISO)}`,
  };
}
