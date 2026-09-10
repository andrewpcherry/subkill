/**
 * SubKill — reconciliation gate.
 *
 * Run: node src/state/derive.test.ts
 *
 * Every figure asserted here is stated in the build brief. All of them are
 * COMPUTED from the seed records. If a seed record changes and a total no
 * longer reconciles, this goes red before anything reaches a screen.
 */

import assert from 'node:assert/strict';
import { createInitialState, offsetISO } from './seed.ts';
import type { DemoState } from './seed.ts';
import {
  activeSubscriptions, activeTrials, annualizedCommitment, billsMonthlyTotal,
  candidateAnnualReduction, candidateMonthlyReduction, childMonthlyTotal,
  confirmedAnnualReduction, dataFreshness, decisionDeadline, findTarget,
  forecastTotals, formatMoney, grossObservedBenefit, harborComparison,
  monthlyCommitment, monthlyReport, netObservedBenefit, paymentById,
  scenarioMonthlyCommitment, subscriptionsMonthlyTotal, topDecisions, trackedItems,
} from './derive.ts';
import {
  acceptProviderOffer, activatePremium, advanceDays, approveCancellation,
  applyPause, keepPayment, prepareProviderMessage, prepareRefundDraft,
  simulateLaterCharge, simulateProviderResponse, simulateRefundResponse,
  simulateSendRefundRequest, setConnectionState,
} from './actions.ts';

let passed = 0;
const failures: string[] = [];

function check(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (err) {
    failures.push(`${name}\n      ${(err as Error).message.split('\n')[0]}`);
    console.log(`FAIL  ${name}`);
    console.log(`      ${(err as Error).message.split('\n').slice(0, 4).join('\n      ')}`);
  }
}

const base = createInitialState();

console.log('\nSubKill — seed reconciliation\n');

// --- Baseline totals -------------------------------------------------------

check('18 active paid subscriptions total $228.84/month equivalent', () => {
  assert.equal(activeSubscriptions(base).length, 18);
  assert.equal(subscriptionsMonthlyTotal(base), 22884);
});

check('7 household bills total $613.16/month equivalent', () => {
  assert.equal(billsMonthlyTotal(base), 61316);
});

check('active recurring commitment is $842.00/month equivalent', () => {
  assert.equal(monthlyCommitment(base), 84200);
});

check('annualized commitment is $10,104.00', () => {
  assert.equal(annualizedCommitment(base), 1_010_400);
});

check('27 tracked current items = 18 subscriptions + 7 bills + 2 trials', () => {
  const t = trackedItems(base);
  assert.equal(t.subscriptions, 18);
  assert.equal(t.bills, 7);
  assert.equal(t.trials, 2);
  assert.equal(t.total, 27);
});

check('NewsDaily is annual and contributes $7.99/month equivalent', () => {
  const p = paymentById(base, 'p_newsdaily')!;
  assert.equal(p.interval, 'annual');
  assert.equal(p.amountCents, 9588);
  assert.equal(Math.round(p.amountCents / 12), 799);
});

check('trials are excluded from the active paid baseline', () => {
  assert.equal(activeTrials(base).length, 2);
  const trialSum = activeTrials(base).reduce((a, p) => a + p.amountCents, 0);
  assert.equal(trialSum, 2898); // 14.99 + 13.99
  assert.equal(monthlyCommitment(base), 84200); // unchanged by their presence
});

check('candidate reductions are $96.96/month and $1,163.52/year', () => {
  assert.equal(candidateMonthlyReduction(base), 9696);
  assert.equal(candidateAnnualReduction(base), 116_352);
});

check('child-assigned records total $32.97/month', () => {
  assert.equal(childMonthlyTotal(base), 3297);
});

check('September observed benefit is $87.00 gross from three ledger events', () => {
  assert.equal(grossObservedBenefit(base), 8700);
  assert.equal(netObservedBenefit(base), 8700);
  assert.equal(base.ledger.length, 3);
});

// --- The Netflix cascade ---------------------------------------------------

const afterNetflix: DemoState = approveCancellation(base, 'p_netflix');

check('Netflix cancellation: $842.00 → $826.01 monthly-equivalent commitment', () => {
  assert.equal(monthlyCommitment(afterNetflix), 82601);
});

check('Netflix cancellation: $10,104.00 → $9,912.12 annualized commitment', () => {
  assert.equal(annualizedCommitment(afterNetflix), 991_212);
});

check('Netflix cancellation: $1,163.52 → $971.64 remaining candidate reductions', () => {
  assert.equal(candidateAnnualReduction(afterNetflix), 97_164);
});

check('Netflix cancellation: $191.88 confirmed annualized reduction', () => {
  assert.equal(confirmedAnnualReduction(afterNetflix), 19_188);
});

check('Netflix cancellation does not change historical observed benefit', () => {
  assert.equal(grossObservedBenefit(afterNetflix), 8700);
});

check('Netflix cancellation removes future renewals and opens a watch', () => {
  const future = afterNetflix.obligations.filter(
    (o) => o.paymentId === 'p_netflix' && o.status === 'scheduled',
  );
  assert.equal(future.length, 0);
  const c = afterNetflix.cases.find((x) => x.paymentId === 'p_netflix')!;
  assert.equal(c.stage, 'monitoring');
  assert.equal(c.monitoring, true);
  assert.ok(c.confirmationRef);
  const op = afterNetflix.opportunities.find((o) => o.id === 'op_netflix')!;
  assert.equal(op.status, 'resolved');
});

check('cancelling twice changes nothing further', () => {
  const twice = approveCancellation(afterNetflix, 'p_netflix');
  assert.equal(monthlyCommitment(twice), 82601);
  assert.equal(twice.cases.length, afterNetflix.cases.length);
  assert.equal(confirmedAnnualReduction(twice), 19_188);
});

// --- Money Preview ---------------------------------------------------------

check('Netflix + Canva across 30 days differ by $30.98', () => {
  const t = forecastTotals(base, { p_netflix: 'cancel', p_canva: 'cancel' }, 30);
  assert.equal(t.differenceCents, 3098);
  assert.equal(t.changedRows.length, 2);
});

check('preview does not commit: baseline state is untouched', () => {
  forecastTotals(base, { p_netflix: 'cancel', p_canva: 'cancel' }, 30);
  assert.equal(monthlyCommitment(base), 84200);
  assert.equal(paymentById(base, 'p_netflix')!.status, 'active');
});

check('scenario commitment excludes trials: cancelling Canva does not move $842.00', () => {
  assert.equal(scenarioMonthlyCommitment(base, { p_canva: 'cancel' }), 84200);
  assert.equal(scenarioMonthlyCommitment(base, { p_netflix: 'cancel' }), 82601);
});

check('a FitCoach pause skips one $9.99 charge, not $119.88 a year', () => {
  const t = forecastTotals(base, { p_fitcoach: 'pause' }, 60);
  assert.equal(t.differenceCents, 999);
  const paused = applyPause(base, 'p_fitcoach');
  assert.equal(confirmedAnnualReduction(paused), 0);
});

check('a CloudVault downgrade reduces the charge to the lower tier only', () => {
  const t = forecastTotals(base, { p_cloudvault: 'downgrade' }, 30);
  assert.equal(t.differenceCents, 200);
});

check('NewsDaily annual renewal sits outside the 30-day window', () => {
  const rows = forecastTotals(base, {}, 30).rows;
  assert.ok(!rows.some((r) => r.paymentId === 'p_newsdaily'));
  const wide = forecastTotals(base, {}, 60).rows;
  assert.ok(wide.some((r) => r.paymentId === 'p_newsdaily' && r.baselineCents === 9588));
});

// --- Bill Detective --------------------------------------------------------

check('Harbor: +$8.00, about +11.3%, +$96.00 a year — not 18%', () => {
  const c = harborComparison(base);
  assert.equal(c.available, true);
  assert.equal(c.previous!.total, 7100);
  assert.equal(c.current!.total, 7900);
  assert.equal(c.deltaCents, 800);
  assert.equal(c.annualIfSustained, 9600);
  assert.ok(Math.abs(c.percent - 11.27) < 0.05, `percent was ${c.percent}`);
  assert.ok(c.percent < 12, 'must never read as 18%');
  assert.match(c.explanation, /base plan price stayed the same/);
});

check('a bill with only one document reports comparison unavailable', () => {
  const c = harborComparison({ ...base, billDocuments: base.billDocuments.filter((d) => d.paymentId !== 'p_harbor') } as DemoState);
  assert.equal(c.available, false);
});

check('the Harbor credit is not a reduction until the offer is accepted', () => {
  const drafted = prepareProviderMessage(base);
  assert.equal(confirmedAnnualReduction(drafted), 0);
  const responded = simulateProviderResponse(drafted);
  assert.equal(confirmedAnnualReduction(responded), 0);
  const accepted = acceptProviderOffer(responded);
  assert.equal(confirmedAnnualReduction(accepted), 9600);
  assert.equal(accepted.harborOffer.months, 12);
  assert.ok(accepted.harborOffer.expiresAt);
});

// --- Cancellation Watch ----------------------------------------------------

const later = simulateLaterCharge(afterNetflix, 'p_netflix');

check('a charge after cancellation reopens the case as an exception', () => {
  const c = later.cases.find((x) => x.paymentId === 'p_netflix')!;
  assert.equal(c.stage, 'exception_open');
  assert.ok(c.exceptionTxnId);
  const tx = later.transactions.find((t) => t.id === c.exceptionTxnId)!;
  assert.equal(tx.amountCents, 1599);
  assert.ok(Date.parse(tx.postedAt) > Date.parse(c.effectiveAt!));
});

check('the later charge reverses the avoided-charge benefit for the same obligation', () => {
  const reversed = later.ledger.filter((e) => e.status === 'reversed');
  assert.equal(reversed.length, 1);
  assert.equal(reversed[0].amountCents, 1599);
  assert.equal(grossObservedBenefit(later), 8700); // back to the September history only
});

check('simulating the later charge twice does not post two charges', () => {
  const twice = simulateLaterCharge(later, 'p_netflix');
  const charges = twice.transactions.filter((t) => t.id.startsWith('tx_after_cancel_p_netflix'));
  assert.equal(charges.length, 1);
});

check('refund lifecycle: draft → requested → credited exactly once', () => {
  const c0 = later.cases.find((x) => x.paymentId === 'p_netflix')!;
  const drafted = prepareRefundDraft(later, c0.id);
  assert.equal(drafted.cases.find((x) => x.id === c0.id)!.stage, 'draft_prepared');
  assert.equal(grossObservedBenefit(drafted), 8700); // preparing is not money

  const requested = simulateSendRefundRequest(drafted, c0.id);
  assert.equal(requested.cases.find((x) => x.id === c0.id)!.stage, 'demo_refund_requested');
  assert.equal(grossObservedBenefit(requested), 8700); // requesting is not receiving

  const credited = simulateRefundResponse(requested, c0.id);
  assert.equal(grossObservedBenefit(credited), 8700 + 1599);

  const again = simulateRefundResponse(credited, c0.id);
  assert.equal(grossObservedBenefit(again), 8700 + 1599); // counted once
  const refunds = again.ledger.filter((e) => e.type === 'refund_credited' && e.status === 'confirmed');
  assert.equal(refunds.length, 2); // the seeded MealBox refund plus this one
});

// --- Time ------------------------------------------------------------------

check('one 30-day jump equals thirty 1-day jumps', () => {
  const big = advanceDays(base, 30);
  let small = base;
  for (let i = 0; i < 30; i++) small = advanceDays(small, 1);
  assert.equal(small.nowISO, big.nowISO);
  assert.equal(small.transactions.length, big.transactions.length);
  assert.equal(monthlyCommitment(small), monthlyCommitment(big));
  assert.equal(grossObservedBenefit(small), grossObservedBenefit(big));
});

check('an uncancelled trial converts to paid and joins the commitment', () => {
  const after = advanceDays(base, 2);
  const canva = paymentById(after, 'p_canva')!;
  assert.equal(canva.kind, 'subscription');
  assert.equal(canva.amountCents, 1499);
  assert.equal(monthlyCommitment(after), 84200 + 1499);
});

check('a cancelled trial never charges and never joins the commitment', () => {
  const cancelled = approveCancellation(base, 'p_canva');
  const after = advanceDays(cancelled, 2);
  assert.equal(monthlyCommitment(after), 84200);
  assert.ok(!after.transactions.some((t) => t.paymentId === 'p_canva' && t.kind === 'charge'));
});

check('an avoided charge is only confirmed while sources are current', () => {
  const advanced = advanceDays(afterNetflix, 2);
  const avoided = advanced.ledger.find((e) => e.dedupeKey.startsWith('avoided:ob_p_netflix'))!;
  assert.equal(avoided.status, 'confirmed');
  assert.equal(grossObservedBenefit(advanced), 8700 + 1599);

  const stale = setConnectionState(advanced, 'cx_bank', 'simulated_stale');
  assert.equal(dataFreshness(stale).canVerifyAbsence, false);
  const nowAwaiting = stale.ledger.find((e) => e.dedupeKey.startsWith('avoided:ob_p_netflix'))!;
  assert.equal(nowAwaiting.status, 'awaiting_verification');
  assert.equal(grossObservedBenefit(stale), 8700); // absence proves nothing while stale
});

// --- Deadlines -------------------------------------------------------------

check('LanguageLab renews in 12 days but must be decided in 5', () => {
  const p = paymentById(base, 'p_languagelab')!;
  const renewal = Math.round((Date.parse(p.nextChargeAt!) - Date.parse(base.nowISO)) / 86_400_000);
  const deadline = Math.round((Date.parse(decisionDeadline(p)!) - Date.parse(base.nowISO)) / 86_400_000);
  assert.equal(renewal, 12);
  assert.equal(deadline, 5);
  assert.equal(p.contract!.noticeDays, 7);
});

check('the opening queue is Canva, then Netflix, then Harbor', () => {
  const top = topDecisions(base);
  assert.equal(top.length, 3);
  assert.deepEqual(top.map((c) => c.paymentId), ['p_canva', 'p_netflix', 'p_harbor']);
  assert.ok(top.every((c) => c.why.length > 40));
});

check('keeping a service removes it from suggestions until the review date', () => {
  const kept = keepPayment(base, 'p_headspace', offsetISO(30, 9));
  assert.ok(!topDecisions(kept).some((c) => c.paymentId === 'p_headspace'));
  assert.equal(candidateMonthlyReduction(kept), 9696 - 1299);
});

// --- Target finder ---------------------------------------------------------

check('a $50/month target is met without touching favorites or essentials', () => {
  const r = findTarget(base, 5000);
  assert.equal(r.achievable, true);
  assert.ok(r.achievedCents >= 5000);
  assert.ok(!r.picks.some((p) => p.paymentId === 'p_spotify'));
  assert.ok(!r.picks.some((p) => p.paymentId === 'p_harbor'));
});

check('an unreachable target reports the gap instead of padding', () => {
  const r = findTarget(base, 50_000);
  assert.equal(r.achievable, false);
  assert.ok(r.gapCents > 0);
  assert.equal(r.achievedCents + r.gapCents, 50_000);
});

// --- Premium ---------------------------------------------------------------

check('activating Premium posts exactly one $7.99 fee, however many clicks', () => {
  let s = activatePremium(base);
  s = activatePremium(s);
  s = activatePremium(s);
  const fees = s.ledger.filter((e) => e.type === 'fee');
  assert.equal(fees.length, 1);
  assert.equal(fees[0].amountCents, 799);
  assert.equal(netObservedBenefit(s), 8700 - 799);
  assert.equal(monthlyCommitment(s), 84200 + 799);
});

// --- Report ----------------------------------------------------------------

check('the monthly report reconciles with the same records', () => {
  const r = monthlyReport(base);
  assert.equal(r.monthlyCommitmentCents, monthlyCommitment(base));
  assert.equal(r.annualizedCommitmentCents, annualizedCommitment(base));
  assert.equal(r.grossObservedCents, 8700);
  assert.equal(r.futureOpportunityAnnualCents, 116_352);
  assert.equal(r.subscriptions + r.bills + r.trials, 27);
  assert.notEqual(r.grossObservedCents, r.futureOpportunityAnnualCents);
});

check('reset restores the identical baseline after any scenario', () => {
  const wrecked = simulateLaterCharge(approveCancellation(advanceDays(base, 12), 'p_netflix'), 'p_netflix');
  assert.notEqual(monthlyCommitment(wrecked), 84200);
  const fresh = createInitialState();
  assert.equal(monthlyCommitment(fresh), 84200);
  assert.equal(grossObservedBenefit(fresh), 8700);
  assert.equal(trackedItems(fresh).total, 27);
  assert.equal(candidateAnnualReduction(fresh), 116_352);
});

// --- Formatting ------------------------------------------------------------

check('money formats from cents with no floating point drift', () => {
  assert.equal(formatMoney(84200), '$842.00');
  assert.equal(formatMoney(1_010_400), '$10,104.00');
  assert.equal(formatMoney(116_352), '$1,163.52');
  assert.equal(formatMoney(19_188), '$191.88');
  assert.equal(formatMoney(3098), '$30.98');
  assert.equal(formatMoney(-800), '−$8.00');
});

// ---------------------------------------------------------------------------

console.log(`\n${passed} passed, ${failures.length} failed\n`);
if (failures.length) {
  console.log('FAILURES:');
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
