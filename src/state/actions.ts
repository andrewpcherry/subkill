/**
 * SubKill — every state transition.
 *
 * Two rules hold everywhere in this file:
 *  1. Idempotent. Repeating an action never duplicates a cancellation, a refund,
 *     a fee or a ledger entry. Ledger entries are keyed by `dedupeKey`.
 *  2. Money links to a unique obligation or transaction. The same $15.99 can
 *     never be counted twice under two different ids.
 */

import type { ActionCase, Cents, DemoState, LedgerEvent, Obligation, Payment, Txn } from './seed.ts';
import {
  DAY_MS, SCAN_MESSAGE_COUNT, SUBKILL_PREMIUM_CENTS, buildObligations,
  createInitialState, obligationId, subkillPayment,
} from './seed.ts';
import { dataFreshness, formatMoney, longDate, monthlyEquivalent, paymentById } from './derive.ts';

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

function ref(prefix: string, seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return `${prefix}-${h.toString(36).toUpperCase().padStart(7, '0').slice(0, 7)}`;
}

/** Adds a ledger event unless its dedupeKey already exists. Returns true if added. */
function addLedger(s: DemoState, e: LedgerEvent): boolean {
  if (s.ledger.some((x) => x.dedupeKey === e.dedupeKey)) return false;
  s.ledger.push(e);
  return true;
}

function futureObligations(s: DemoState, paymentId: string): Obligation[] {
  const now = Date.parse(s.nowISO);
  return s.obligations.filter(
    (o) => o.paymentId === paymentId && Date.parse(o.dueAt) > now && o.status === 'scheduled',
  );
}

function nextChargeFor(s: DemoState, paymentId: string): string | null {
  const up = futureObligations(s, paymentId).sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt));
  return up[0]?.dueAt ?? null;
}

function tl(at: string, label: string, detail: string | null = null) {
  return { at, label, detail };
}

// ---------------------------------------------------------------------------
// Cancellation
// ---------------------------------------------------------------------------

export function approveCancellation(state: DemoState, paymentId: string): DemoState {
  const s = clone(state);
  const p = s.payments.find((x) => x.id === paymentId);
  if (!p || p.status === 'cancelled') return state; // idempotent

  const now = s.nowISO;
  const upcoming = futureObligations(s, paymentId).sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt));
  const watched = upcoming[0] ?? null;

  for (const o of s.obligations) {
    if (o.paymentId === paymentId && o.status === 'scheduled' && Date.parse(o.dueAt) > Date.parse(now)) {
      o.status = 'cancelled';
    }
  }

  p.status = 'cancelled';
  p.nextChargeAt = null;

  for (const o of s.opportunities) {
    if (o.paymentId === paymentId && o.status === 'open') o.status = 'resolved';
  }

  const existing = s.cases.find((c) => c.paymentId === paymentId && c.action === 'cancel');
  if (!existing) {
    const c: ActionCase = {
      id: `case_cancel_${paymentId}`,
      paymentId,
      action: 'cancel',
      stage: 'monitoring',
      openedAt: now,
      effectiveAt: now,
      confirmationRef: ref('SK', `${paymentId}${now}`),
      approvedAt: now,
      monitoring: true,
      evidenceIds: [],
      watchObligationId: watched ? watched.id : null,
      exceptionTxnId: null,
      refundDraft: null,
      note: null,
      timeline: [
        tl(now, 'Review required', 'Cancellation prepared with its effective date and annualized effect.'),
        tl(now, 'You approved', 'Approval recorded in this demo.'),
        tl(now, 'Demo request submitted', 'No message left this device.'),
        tl(now, 'Awaiting confirmation', 'Simulated provider handling.'),
        tl(now, 'Demo confirmation received', `Reference ${ref('SK', `${paymentId}${now}`)}.`),
        tl(now, 'Monitoring future charges', watched ? `Watching the ${longDate(watched.dueAt)} renewal.` : 'Watching this account.'),
      ],
    };
    s.cases.push(c);
  }

  s.alertState[`al_op_${paymentId}`] = { status: 'resolved', reviewAfter: null };
  return s;
}

/** Local undo of the simulated cancellation. */
export function undoCancellation(state: DemoState, paymentId: string): DemoState {
  const s = clone(state);
  const p = s.payments.find((x) => x.id === paymentId);
  if (!p || p.status !== 'cancelled') return state;
  const caseIdx = s.cases.findIndex((c) => c.paymentId === paymentId && c.action === 'cancel');
  const c = s.cases[caseIdx];
  if (c && (c.exceptionTxnId || c.stage === 'demo_refund_requested')) return state; // too far along to rewind

  for (const o of s.obligations) {
    if (o.paymentId === paymentId && o.status === 'cancelled') o.status = 'scheduled';
  }
  p.status = 'active';
  p.nextChargeAt = nextChargeFor(s, paymentId);
  for (const o of s.opportunities) {
    if (o.paymentId === paymentId && o.status === 'resolved') o.status = 'open';
  }
  if (caseIdx >= 0) s.cases.splice(caseIdx, 1);
  delete s.alertState[`al_op_${paymentId}`];
  return s;
}

// ---------------------------------------------------------------------------
// Pause / downgrade / keep / review later
// ---------------------------------------------------------------------------

export function applyPause(state: DemoState, paymentId: string): DemoState {
  const s = clone(state);
  const p = s.payments.find((x) => x.id === paymentId);
  if (!p || !p.pauseOption || p.status === 'paused') return state;
  const upcoming = futureObligations(s, paymentId).sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt));
  const skip = upcoming.slice(0, p.pauseOption.months);
  for (const o of skip) o.status = 'cancelled';
  p.status = 'paused';
  p.accessThrough = skip[skip.length - 1]?.dueAt ?? p.accessThrough;
  p.nextChargeAt = nextChargeFor(s, paymentId);
  const now = s.nowISO;
  s.cases.push({
    id: `case_pause_${paymentId}`, paymentId, action: 'pause', stage: 'monitoring',
    openedAt: now, effectiveAt: now, confirmationRef: ref('SK', `pause${paymentId}`),
    approvedAt: now, monitoring: false, evidenceIds: ['ev_fitcoach_pause'],
    watchObligationId: null, exceptionTxnId: null, refundDraft: null,
    note: `One charge skipped. Billing resumes ${p.nextChargeAt ? longDate(p.nextChargeAt) : 'at the next cycle'}.`,
    timeline: [
      tl(now, 'You approved', 'One-month hold.'),
      tl(now, 'Demo request submitted', null),
      tl(now, 'Demo confirmation received', 'Hold recorded in this demo.'),
    ],
  });
  return s;
}

export function applyDowngrade(state: DemoState, paymentId: string): DemoState {
  const s = clone(state);
  const p = s.payments.find((x) => x.id === paymentId);
  if (!p || !p.downgradeOption) return state;
  const target = p.downgradeOption;
  if (p.amountCents === target.amountCents) return state;
  const now = s.nowISO;
  p.amountCents = target.amountCents;
  p.plan = target.planName;
  p.downgradeOption = null;
  for (const o of s.obligations) {
    if (o.paymentId === paymentId && o.status === 'scheduled' && Date.parse(o.dueAt) > Date.parse(now)) {
      o.amountCents = target.amountCents;
    }
  }
  for (const o of s.opportunities) {
    if (o.paymentId === paymentId && o.type === 'downgrade' && o.status === 'open') o.status = 'accepted';
  }
  s.cases.push({
    id: `case_downgrade_${paymentId}`, paymentId, action: 'downgrade', stage: 'monitoring',
    openedAt: now, effectiveAt: now, confirmationRef: ref('SK', `dg${paymentId}`),
    approvedAt: now, monitoring: false, evidenceIds: ['ev_cloudvault_tier'],
    watchObligationId: null, exceptionTxnId: null, refundDraft: null,
    note: target.losing,
    timeline: [tl(now, 'You approved', target.planName), tl(now, 'Demo confirmation received', null)],
  });
  return s;
}

export function keepPayment(state: DemoState, paymentId: string, reviewAfterISO: string | null): DemoState {
  const s = clone(state);
  for (const o of s.opportunities) {
    if (o.paymentId === paymentId && o.status === 'open') {
      o.status = reviewAfterISO ? 'open' : 'kept';
      o.reviewAfter = reviewAfterISO;
    }
  }
  const rule = s.rules.find((r) => r.kind === 'quiet_until' && r.paymentId === paymentId);
  if (rule && reviewAfterISO) rule.enabled = true;
  s.alertState[`al_op_${paymentId}`] = { status: 'resolved', reviewAfter: reviewAfterISO };
  return s;
}

export function setPreference(
  state: DemoState, paymentId: string, key: 'favorite' | 'essential', value: boolean,
): DemoState {
  const s = clone(state);
  const p = s.payments.find((x) => x.id === paymentId);
  if (!p) return state;
  p[key] = value;
  return s;
}

export function setAlertStatus(
  state: DemoState, alertId: string, status: 'open' | 'watching' | 'resolved', reviewAfter: string | null = null,
): DemoState {
  const s = clone(state);
  s.alertState[alertId] = { status, reviewAfter };
  return s;
}

export function upsertReminder(
  state: DemoState, id: string, paymentId: string | null, dueAt: string, label: string,
): DemoState {
  const s = clone(state);
  const existing = s.reminders.find((r) => r.id === id);
  if (existing) {
    existing.dueAt = dueAt;
    existing.label = label;
  } else {
    s.reminders.push({ id, paymentId, dueAt, label, kind: 'custom', done: false });
  }
  return s;
}

// ---------------------------------------------------------------------------
// The post-cancellation charge
// ---------------------------------------------------------------------------

export function simulateLaterCharge(state: DemoState, paymentId = 'p_netflix'): DemoState {
  const s = clone(state);
  const c = s.cases.find((x) => x.paymentId === paymentId && x.action === 'cancel');
  const p = s.payments.find((x) => x.id === paymentId);
  if (!c || !p || c.exceptionTxnId) return state; // idempotent

  // Advance to just past the watched renewal, using the normal event rules.
  const watched = s.obligations.find((o) => o.id === c.watchObligationId);
  const target = watched ? Date.parse(watched.dueAt) + 2 * DAY_MS : Date.parse(s.nowISO) + 2 * DAY_MS;
  const advanced = advanceTo(s, new Date(target).toISOString());

  const c2 = advanced.cases.find((x) => x.paymentId === paymentId && x.action === 'cancel')!;
  const ob = advanced.obligations.find((o) => o.id === c2.watchObligationId);
  const postedAt = ob ? ob.dueAt : advanced.nowISO;
  const txId = `tx_after_cancel_${paymentId}_${postedAt.slice(0, 10)}`;

  if (advanced.transactions.some((t) => t.id === txId)) return advanced;

  const amount = ob ? ob.amountCents : p.amountCents;
  const tx: Txn = {
    id: txId,
    obligationId: ob ? ob.id : null,
    paymentId,
    postedAt,
    amountCents: amount,
    kind: 'charge',
    label: `${p.merchant} charge posted after cancellation`,
    synthetic: true,
  };
  advanced.transactions.push(tx);
  if (ob) ob.status = 'posted';

  // Reverse the avoided-charge benefit tied to this same obligation. The money
  // was never actually kept, so it cannot stay in observed benefit.
  if (ob) {
    const prior = advanced.ledger.find((e) => e.dedupeKey === `avoided:${ob.id}`);
    if (prior) {
      prior.status = 'reversed';
      prior.basis += ' Reversed: a charge for this same renewal posted after the cancellation, so nothing was avoided.';
    }
  }

  advanced.evidence.push({
    id: `ev_after_charge_${paymentId}`,
    kind: 'transaction',
    sourceLabel: 'Simulated card activity',
    observedAt: postedAt,
    confidence: 'confirmed',
    summary: `${formatMoney(amount)} posted on ${longDate(postedAt)}, after the cancellation took effect on ${longDate(c2.effectiveAt ?? c2.openedAt)}.`,
    detail: 'This is a synthetic demo charge. Nothing was charged to a real account.',
  });

  c2.stage = 'exception_open';
  c2.exceptionTxnId = tx.id;
  c2.evidenceIds = [...new Set([...c2.evidenceIds, `ev_after_charge_${paymentId}`])];
  c2.timeline.push(tl(postedAt, 'Charge appeared after cancellation', `${formatMoney(amount)} posted. The cancellation was effective ${longDate(c2.effectiveAt ?? c2.openedAt)}.`));
  return advanced;
}

export function prepareRefundDraft(state: DemoState, caseId: string): DemoState {
  const s = clone(state);
  const c = s.cases.find((x) => x.id === caseId);
  if (!c || c.stage !== 'exception_open') return state;
  const p = paymentById(s, c.paymentId);
  const tx = s.transactions.find((t) => t.id === c.exceptionTxnId);
  if (!p || !tx) return state;
  c.refundDraft = [
    `Subject: Refund request for a charge after cancellation, ref ${c.confirmationRef}`,
    '',
    `Hello,`,
    '',
    `I cancelled my ${p.merchant} ${p.plan} plan effective ${longDate(c.effectiveAt ?? c.openedAt)} and received confirmation reference ${c.confirmationRef}.`,
    `A charge of ${formatMoney(tx.amountCents)} posted on ${longDate(tx.postedAt)}, after that effective date.`,
    '',
    `Please refund ${formatMoney(tx.amountCents)} to the original payment method and confirm the account is closed.`,
    '',
    `Thank you,`,
    `Nancy`,
  ].join('\n');
  c.stage = 'draft_prepared';
  c.timeline.push(tl(s.nowISO, 'Draft prepared', 'Nothing has been sent.'));
  return s;
}

export function simulateSendRefundRequest(state: DemoState, caseId: string): DemoState {
  const s = clone(state);
  const c = s.cases.find((x) => x.id === caseId);
  if (!c || c.stage !== 'draft_prepared') return state;
  c.stage = 'demo_refund_requested';
  c.timeline.push(tl(s.nowISO, 'Demo refund requested', 'Simulated only. No message was sent.'));
  return s;
}

export function simulateRefundResponse(state: DemoState, caseId: string): DemoState {
  const s = clone(state);
  const c = s.cases.find((x) => x.id === caseId);
  if (!c || c.stage !== 'demo_refund_requested') return state;
  const tx = s.transactions.find((t) => t.id === c.exceptionTxnId);
  const p = paymentById(s, c.paymentId);
  if (!tx || !p) return state;

  const refundId = `tx_refund_${tx.id}`;
  if (s.transactions.some((t) => t.id === refundId)) return state; // credit posts exactly once

  s.transactions.push({
    id: refundId,
    obligationId: tx.obligationId,
    paymentId: c.paymentId,
    postedAt: s.nowISO,
    amountCents: -tx.amountCents,
    kind: 'refund',
    label: `${p.merchant} refund credited`,
    synthetic: true,
  });

  // Keyed to the posted charge, so a second refund path cannot double count it.
  addLedger(s, {
    id: `le_${refundId}`,
    dedupeKey: `refund:${tx.id}`,
    type: 'refund_credited',
    amountCents: tx.amountCents,
    occurredAt: s.nowISO,
    paymentId: c.paymentId,
    obligationId: tx.obligationId,
    transactionId: refundId,
    basis: `A ${formatMoney(tx.amountCents)} credit posted against the charge of ${longDate(tx.postedAt)}. Linked to that charge, so it is counted once.`,
    status: 'confirmed',
  });

  c.stage = 'resolved';
  c.monitoring = true;
  c.timeline.push(tl(s.nowISO, 'Refund credited in demo', `${formatMoney(tx.amountCents)} credited. The outcome is now resolved.`));
  return s;
}

// ---------------------------------------------------------------------------
// Harbor Internet — bill detective
// ---------------------------------------------------------------------------

export function prepareProviderMessage(state: DemoState): DemoState {
  const s = clone(state);
  if (s.harborOffer.stage === 'none') s.harborOffer.stage = 'draft_prepared';
  return s;
}

export function simulateProviderResponse(state: DemoState): DemoState {
  const s = clone(state);
  if (s.harborOffer.stage !== 'draft_prepared') return state;
  s.harborOffer.stage = 'response_received';
  return s;
}

export function acceptProviderOffer(state: DemoState): DemoState {
  const s = clone(state);
  if (s.harborOffer.stage !== 'response_received') return state;
  const p = s.payments.find((x) => x.id === 'p_harbor');
  if (!p) return state;

  const effectiveAt = s.nowISO;
  const expiresAt = new Date(Date.UTC(
    new Date(s.nowISO).getUTCFullYear(),
    new Date(s.nowISO).getUTCMonth() + s.harborOffer.months,
    new Date(s.nowISO).getUTCDate(), 9, 0, 0,
  )).toISOString();

  s.harborOffer.stage = 'accepted';
  s.harborOffer.effectiveAt = effectiveAt;
  s.harborOffer.expiresAt = expiresAt;

  const newAmount = p.amountCents - s.harborOffer.creditCents;
  p.amountCents = newAmount;
  for (const o of s.obligations) {
    if (o.paymentId === 'p_harbor' && o.status === 'scheduled') {
      if (Date.parse(o.dueAt) > Date.parse(effectiveAt) && Date.parse(o.dueAt) <= Date.parse(expiresAt)) {
        o.amountCents = newAmount;
      }
      // After expiry the price returns to the base rate, which is what the
      // untouched seeded obligations already carry.
    }
  }
  for (const o of s.opportunities) {
    if (o.id === 'op_harbor_credit') o.status = 'accepted';
  }
  s.cases.push({
    id: 'case_credit_harbor', paymentId: 'p_harbor', action: 'credit_restore', stage: 'monitoring',
    openedAt: effectiveAt, effectiveAt, confirmationRef: ref('HB', effectiveAt), approvedAt: effectiveAt,
    monitoring: true, evidenceIds: ['ev_harbor_bills'], watchObligationId: null, exceptionTxnId: null,
    refundDraft: null,
    note: `Credit runs to ${longDate(expiresAt)}. The price returns to the base rate afterwards.`,
    timeline: [
      tl(effectiveAt, 'You approved', 'Simulated offer accepted after reviewing its duration.'),
      tl(effectiveAt, 'Demo confirmation received', `${formatMoney(s.harborOffer.creditCents)} monthly credit for ${s.harborOffer.months} months.`),
    ],
  });
  return s;
}

// ---------------------------------------------------------------------------
// Premium
// ---------------------------------------------------------------------------

export function activatePremium(state: DemoState): DemoState {
  const s = clone(state);
  if (s.settings.premium) return state; // repeat clicks never duplicate the fee
  s.settings.premium = true;

  const feeAt = s.nowISO;
  const nextAt = new Date(Date.UTC(
    new Date(feeAt).getUTCFullYear(), new Date(feeAt).getUTCMonth() + 1, new Date(feeAt).getUTCDate(), 9, 0, 0,
  )).toISOString();

  if (!s.payments.some((p) => p.id === 'p_subkill')) {
    const sk = subkillPayment(nextAt);
    s.payments.push(sk);
    s.obligations.push(...buildObligations([sk]));
  }

  const feeTxId = `tx_subkill_fee_${feeAt.slice(0, 10)}`;
  if (!s.transactions.some((t) => t.id === feeTxId)) {
    s.transactions.push({
      id: feeTxId, obligationId: null, paymentId: 'p_subkill', postedAt: feeAt,
      amountCents: SUBKILL_PREMIUM_CENTS, kind: 'fee', label: 'SubKill Premium demo fee', synthetic: true,
    });
    addLedger(s, {
      id: `le_${feeTxId}`, dedupeKey: `fee:${feeTxId}`, type: 'fee',
      amountCents: SUBKILL_PREMIUM_CENTS, occurredAt: feeAt, paymentId: 'p_subkill',
      obligationId: null, transactionId: feeTxId,
      basis: 'One synthetic SubKill Premium fee. Subtracted from observed benefit so the net figure is honest.',
      status: 'confirmed',
    });
  }
  return s;
}

export function cancelPremium(state: DemoState): DemoState {
  const s = clone(state);
  if (!s.settings.premium) return state;
  s.settings.premium = false;
  const p = s.payments.find((x) => x.id === 'p_subkill');
  if (p) {
    p.status = 'cancelled';
    p.nextChargeAt = null;
  }
  for (const o of s.obligations) {
    if (o.paymentId === 'p_subkill' && o.status === 'scheduled') o.status = 'cancelled';
  }
  return s;
}

// ---------------------------------------------------------------------------
// Manual add / edit
// ---------------------------------------------------------------------------

export interface ManualInput {
  merchant: string;
  plan: string;
  amountCents: Cents;
  interval: 'monthly' | 'annual';
  category: Payment['category'];
  owner: Payment['owner'];
  nextChargeAt: string;
  kind: 'subscription' | 'bill';
}

export function addManualPayment(state: DemoState, input: ManualInput): DemoState {
  const s = clone(state);
  const id = `p_manual_${Date.now().toString(36)}`;
  const p: Payment = {
    id, merchant: input.merchant, plan: input.plan || 'Standard', kind: input.kind,
    category: input.category, amountCents: input.amountCents, interval: input.interval,
    status: 'active', owner: input.owner, usedBy: [], paymentSource: 'Added by you',
    billingChannel: 'direct', nextChargeAt: input.nextChargeAt, essential: false, favorite: false,
    usageReport: null, lastUsedDaysAgo: null, variableEstimate: false, pauseOption: null,
    downgradeOption: null, contract: null, accessThrough: null, cancellationGuide: [],
    providerUrl: null, trial: null, addedByUser: true, archivedNote: null,
  };
  s.payments.push(p);
  s.obligations.push(...buildObligations([p]));
  return s;
}

export function editPayment(state: DemoState, paymentId: string, patch: Partial<ManualInput>): DemoState {
  const s = clone(state);
  const p = s.payments.find((x) => x.id === paymentId);
  if (!p) return state;
  if (patch.merchant) p.merchant = patch.merchant;
  if (patch.plan) p.plan = patch.plan;
  if (patch.category) p.category = patch.category;
  if (patch.owner) p.owner = patch.owner;
  if (typeof patch.amountCents === 'number') {
    p.amountCents = patch.amountCents;
    for (const o of s.obligations) {
      if (o.paymentId === paymentId && o.status === 'scheduled') o.amountCents = patch.amountCents;
    }
  }
  if (patch.nextChargeAt) {
    p.nextChargeAt = patch.nextChargeAt;
    s.obligations = s.obligations.filter((o) => !(o.paymentId === paymentId && o.status === 'scheduled'));
    s.obligations.push(...buildObligations([p]));
  }
  return s;
}

export function removePayment(state: DemoState, paymentId: string): DemoState {
  const s = clone(state);
  const p = s.payments.find((x) => x.id === paymentId);
  if (!p || !p.addedByUser) return state;
  s.payments = s.payments.filter((x) => x.id !== paymentId);
  s.obligations = s.obligations.filter((o) => o.paymentId !== paymentId);
  return s;
}

// ---------------------------------------------------------------------------
// Household
// ---------------------------------------------------------------------------

export function simulateHouseholdResponse(state: DemoState, paymentId: string, uses: boolean): DemoState {
  const s = clone(state);
  const p = s.payments.find((x) => x.id === paymentId);
  if (!p) return state;
  if (uses) {
    if (!p.usedBy.includes('brian')) p.usedBy.push('brian');
    p.usageReport = 'Brian confirmed he uses this.';
  } else {
    p.usedBy = p.usedBy.filter((u) => u !== 'brian');
    p.usageReport = 'Brian reported he does not use this.';
    if (!s.opportunities.some((o) => o.paymentId === paymentId && o.type === 'cancel')) {
      s.opportunities.push({
        id: `op_household_${paymentId}`, paymentId, type: 'cancel',
        monthlyReductionCents: monthlyEquivalent(p),
        countsTowardCandidateTotal: false, availability: 'eligible', status: 'open',
        evidenceIds: [], headline: `${p.merchant}: Brian reported he does not use this`,
        rationale: 'Raised by a household confirmation, not by an automatic rule. Excluded from the seeded candidate total.',
        assumptions: ['Based on one household response.'],
        reviewAfter: null,
      });
    }
  }
  return s;
}

export function setConnectionState(
  state: DemoState, id: string, next: 'simulated_healthy' | 'simulated_stale' | 'disconnected',
): DemoState {
  const s = clone(state);
  const c = s.connections.find((x) => x.id === id);
  if (!c) return state;
  c.state = next;
  if (next === 'simulated_stale') {
    c.lastSyncAt = new Date(Date.parse(s.nowISO) - 6 * DAY_MS).toISOString();
    c.note = 'Simulated stale source. A missing charge cannot be treated as proof while this is out of date.';
  } else if (next === 'disconnected') {
    c.note = 'Disconnected in this demo. New activity is not arriving.';
  } else {
    c.lastSyncAt = s.nowISO;
    c.note = 'Simulated connection. No real account is linked.';
  }
  // A stale source only undermines absences it should have covered. An avoided
  // charge already evidenced before the last good sync stays verified.
  const fresh = dataFreshness(s);
  const cutoff = Math.min(...s.connections.map((x) => Date.parse(x.lastSyncAt)));
  for (const e of s.ledger) {
    if (e.type !== 'observed_avoided' || e.status === 'reversed') continue;
    const coveredBySync = Date.parse(e.occurredAt) <= cutoff;
    e.status = fresh.canVerifyAbsence || coveredBySync ? 'confirmed' : 'awaiting_verification';
  }
  return s;
}

// ---------------------------------------------------------------------------
// Inbox discovery
// ---------------------------------------------------------------------------

export function startScan(state: DemoState): DemoState {
  const s = clone(state);
  if (s.scan.status === 'running') return state;
  s.scan.status = 'running';
  return s;
}

/** Completing the scan reveals findings. It never adds anything to your list. */
export function completeScan(state: DemoState): DemoState {
  const s = clone(state);
  s.scan.status = 'complete';
  s.scan.lastRunAt = s.nowISO;
  s.scan.messagesScanned = SCAN_MESSAGE_COUNT;
  const inbox = s.connections.find((c) => c.id === 'cx_email');
  if (inbox && inbox.state === 'simulated_healthy') inbox.lastSyncAt = s.nowISO;
  return s;
}

/**
 * Confirming a discovery turns it into a tracked record. Only here does a
 * finding start counting toward any total.
 */
export function addDiscovery(state: DemoState, discoveryId: string): DemoState {
  const s = clone(state);
  const d = s.discoveries.find((x) => x.id === discoveryId);
  if (!d || d.status !== 'open' || d.verdict === 'already_tracked') return state;
  if (s.payments.some((p) => p.id === `p_${discoveryId}`)) return state; // idempotent

  const nextChargeAt = d.nextChargeAt
    ?? new Date(Date.parse(s.nowISO) + 30 * DAY_MS).toISOString();

  const p: Payment = {
    id: `p_${discoveryId}`,
    merchant: d.merchant,
    plan: d.plan,
    kind: d.isTrial ? 'trial' : 'subscription',
    category: d.category,
    amountCents: d.amountCents,
    interval: d.interval,
    status: 'active',
    owner: 'nancy',
    usedBy: [],
    paymentSource: 'Visa ···4412',
    billingChannel: 'direct',
    nextChargeAt,
    essential: false,
    favorite: false,
    usageReport: null,
    lastUsedDaysAgo: null,
    variableEstimate: false,
    pauseOption: null,
    downgradeOption: null,
    contract: null,
    accessThrough: d.isTrial ? nextChargeAt : null,
    cancellationGuide: [
      'Open the account page and sign in.',
      'Find the plan or membership section.',
      'Choose to end the plan, then confirm on the review step.',
    ],
    providerUrl: null,
    trial: d.isTrial
      ? {
        convertsAt: nextChargeAt,
        decisionDeadlineAt: nextChargeAt,
        firstChargeCents: d.amountCents,
        laterCents: d.amountCents,
        accessEndsImmediately: false,
      }
      : null,
    addedByUser: true,
    archivedNote: null,
  };

  s.payments.push(p);
  s.obligations.push(...buildObligations([p]));

  // The receipts that proved it become evidence attached to the new record.
  s.evidence.push({
    id: `ev_${discoveryId}`,
    kind: 'receipt',
    sourceLabel: `Receipt inbox · ${s.scan.mailbox}`,
    observedAt: d.lastReceiptAt,
    confidence: d.confidence === 'confirmed' ? 'confirmed' : 'inferred',
    summary: `${d.receiptCount} receipt${d.receiptCount === 1 ? '' : 's'} from ${d.merchant}, most recently ${longDate(d.lastReceiptAt)}.`,
    detail: d.confidenceWhy,
  });

  if (!d.isTrial) {
    s.opportunities.push({
      id: `op_${discoveryId}`,
      paymentId: p.id,
      type: 'cancel',
      monthlyReductionCents: monthlyEquivalent(p),
      // Found records stay out of the seeded candidate headline so the
      // baseline figure keeps meaning what it meant.
      countsTowardCandidateTotal: false,
      availability: 'eligible',
      status: 'open',
      evidenceIds: [`ev_${discoveryId}`],
      headline: `${d.merchant} was found in your inbox, not on your list`,
      rationale: d.note,
      assumptions: ['Found from receipts. Usage is unknown until you tell SubKill.'],
      reviewAfter: null,
    });
  }

  d.status = 'added';
  return s;
}

export function dismissDiscovery(state: DemoState, discoveryId: string): DemoState {
  const s = clone(state);
  const d = s.discoveries.find((x) => x.id === discoveryId);
  if (!d || d.status !== 'open') return state;
  d.status = 'dismissed';
  return s;
}

export function restoreDiscovery(state: DemoState, discoveryId: string): DemoState {
  const s = clone(state);
  const d = s.discoveries.find((x) => x.id === discoveryId);
  if (!d || d.status !== 'dismissed') return state;
  d.status = 'open';
  return s;
}

// ---------------------------------------------------------------------------
// Time
// ---------------------------------------------------------------------------

/** Process every due obligation exactly once, whether the jump is 1 day or 30. */
export function advanceTo(state: DemoState, targetISO: string): DemoState {
  const s = clone(state);
  const target = Date.parse(targetISO);
  if (target <= Date.parse(s.nowISO)) return state;

  const due = s.obligations
    .filter((o) => Date.parse(o.dueAt) <= target)
    .filter((o) => !s.processedObligationIds.includes(o.id))
    .sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt));

  for (const o of due) {
    s.processedObligationIds.push(o.id);
    const p = s.payments.find((x) => x.id === o.paymentId);
    if (!p) continue;

    if (o.status === 'cancelled') {
      const fresh = dataFreshness(s);
      addLedger(s, {
        id: `le_avoided_${o.id}`,
        dedupeKey: `avoided:${o.id}`,
        type: 'observed_avoided',
        amountCents: o.amountCents,
        occurredAt: o.dueAt,
        paymentId: p.id,
        obligationId: o.id,
        transactionId: null,
        basis: `${p.merchant} was scheduled to charge ${formatMoney(o.amountCents)} on ${longDate(o.dueAt)}. The charge is absent from simulated activity after the cancellation took effect.`,
        status: fresh.canVerifyAbsence ? 'confirmed' : 'awaiting_verification',
      });
      continue;
    }

    if (o.status !== 'scheduled') continue;

    if (o.kind === 'trial_conversion' && p.kind === 'trial') {
      p.kind = 'subscription';
      p.amountCents = p.trial ? p.trial.laterCents : p.amountCents;
      p.plan = p.plan.replace(' trial', '');
      p.trial = null;
    }

    const txId = `tx_${p.id}_${o.dueAt.slice(0, 10)}`;
    if (!s.transactions.some((t) => t.id === txId)) {
      s.transactions.push({
        id: txId, obligationId: o.id, paymentId: p.id, postedAt: o.dueAt,
        amountCents: o.amountCents, kind: p.id === 'p_subkill' ? 'fee' : 'charge',
        label: `${p.merchant} ${o.kind === 'trial_conversion' ? 'first charge after trial' : 'charge'}`,
        synthetic: false,
      });
      if (p.id === 'p_subkill') {
        addLedger(s, {
          id: `le_${txId}`, dedupeKey: `fee:${txId}`, type: 'fee', amountCents: o.amountCents,
          occurredAt: o.dueAt, paymentId: p.id, obligationId: o.id, transactionId: txId,
          basis: 'Recurring SubKill Premium demo fee.', status: 'confirmed',
        });
      }
    }
    o.status = 'posted';
  }

  s.nowISO = targetISO;
  for (const p of s.payments) {
    if (p.status === 'active' || p.status === 'paused') p.nextChargeAt = nextChargeFor(s, p.id);
  }
  for (const r of s.reminders) {
    if (Date.parse(r.dueAt) <= target) r.done = true;
  }
  return s;
}

export function advanceDays(state: DemoState, days: number): DemoState {
  return advanceTo(state, new Date(Date.parse(state.nowISO) + days * DAY_MS).toISOString());
}

export function resetDemo(): DemoState {
  return createInitialState();
}

export { obligationId };
