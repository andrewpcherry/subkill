/**
 * SubKill — canonical demo seed.
 *
 * RULES ENFORCED HERE:
 *  - All money is integer cents. Never a float, never a formatted string.
 *  - No display total is written as a literal. Totals are computed in derive.ts.
 *  - Every monetary outcome links to a unique obligation or transaction id.
 */

export type Cents = number;

export const DEMO_EPOCH_ISO = '2026-09-10T18:00:00.000Z';
export const DEMO_EPOCH_MS = Date.parse(DEMO_EPOCH_ISO);
export const DAY_MS = 86_400_000;

/** Calendar-safe offset from the demo date (2026-09-10), at a fixed UTC hour. */
export function offsetISO(days: number, hourUTC = 12, minute = 0): string {
  return new Date(Date.UTC(2026, 8, 10 + days, hourUTC, minute, 0)).toISOString();
}

export function ymd(iso: string): string {
  return iso.slice(0, 10);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PaymentKind = 'subscription' | 'bill' | 'trial';
export type Category =
  | 'Streaming' | 'Software' | 'Fitness' | 'Kids'
  | 'Learning' | 'Utilities' | 'Insurance' | 'Other';
export type Interval = 'monthly' | 'annual';
export type PaymentStatus = 'active' | 'cancelled' | 'paused' | 'archived';
export type BillingChannel = 'direct' | 'app_store' | 'intermediary';
export type OwnerId = 'nancy' | 'brian' | 'household' | 'unassigned';

export interface PauseOption {
  months: number;
  label: string;
  terms: string;
}
export interface DowngradeOption {
  planName: string;
  amountCents: Cents;
  losing: string;
  terms: string;
}
export interface ContractTerms {
  noticeDays: number;
  clause: string;
  documentName: string;
  observedAt: string;
}
export interface TrialTerms {
  convertsAt: string;
  decisionDeadlineAt: string;
  firstChargeCents: Cents;
  laterCents: Cents;
  accessEndsImmediately: boolean;
}

export interface Payment {
  id: string;
  merchant: string;
  plan: string;
  kind: PaymentKind;
  category: Category;
  /** Charge amount at its billing interval. */
  amountCents: Cents;
  interval: Interval;
  status: PaymentStatus;
  owner: OwnerId;
  usedBy: OwnerId[];
  paymentSource: string;
  billingChannel: BillingChannel;
  nextChargeAt: string | null;
  essential: boolean;
  favorite: boolean;
  /** User-reported only. Bank payments do not reveal app usage. */
  usageReport: string | null;
  lastUsedDaysAgo: number | null;
  variableEstimate: boolean;
  pauseOption: PauseOption | null;
  downgradeOption: DowngradeOption | null;
  contract: ContractTerms | null;
  accessThrough: string | null;
  cancellationGuide: string[];
  providerUrl: string | null;
  trial: TrialTerms | null;
  addedByUser: boolean;
  archivedNote: string | null;
}

export type ObligationKind = 'renewal' | 'trial_conversion' | 'bill' | 'fee';
export type ObligationStatus = 'scheduled' | 'posted' | 'avoided' | 'cancelled';

/** A single expected future charge. The stable unit that money links to. */
export interface Obligation {
  id: string;
  paymentId: string;
  dueAt: string;
  amountCents: Cents;
  kind: ObligationKind;
  status: ObligationStatus;
}

export type TxnKind = 'charge' | 'refund' | 'fee';
export interface Txn {
  id: string;
  obligationId: string | null;
  paymentId: string;
  postedAt: string;
  /** Positive = money out. Negative = money back in. */
  amountCents: Cents;
  kind: TxnKind;
  label: string;
  synthetic: boolean;
}

export type EvidenceKind =
  | 'bill_document' | 'user_report' | 'charge_history'
  | 'contract_clause' | 'plan_terms' | 'receipt' | 'transaction' | 'benefit_clause';
export type Confidence = 'confirmed' | 'reported_by_user' | 'inferred';

export interface Evidence {
  id: string;
  kind: EvidenceKind;
  sourceLabel: string;
  observedAt: string;
  confidence: Confidence;
  summary: string;
  detail: string | null;
}

export type OpportunityType = 'cancel' | 'credit_restore' | 'downgrade' | 'pause' | 'bundle_overlap';
export type Availability = 'eligible' | 'unknown_until_provider_response' | 'speculative';
export type OpportunityStatus = 'open' | 'accepted' | 'kept' | 'resolved' | 'declined';

export interface Opportunity {
  id: string;
  paymentId: string;
  type: OpportunityType;
  monthlyReductionCents: Cents;
  /** Only eligible, non-speculative, non-trial reductions roll into the candidate total. */
  countsTowardCandidateTotal: boolean;
  availability: Availability;
  status: OpportunityStatus;
  evidenceIds: string[];
  headline: string;
  rationale: string;
  assumptions: string[];
  reviewAfter: string | null;
}

export type CaseStage =
  | 'review_required' | 'user_approved' | 'demo_request_submitted'
  | 'awaiting_confirmation' | 'demo_confirmation_received' | 'monitoring'
  | 'exception_open' | 'draft_prepared' | 'demo_refund_requested' | 'resolved';

export interface CaseEvent {
  at: string;
  label: string;
  detail: string | null;
}
export interface ActionCase {
  id: string;
  paymentId: string;
  action: 'cancel' | 'credit_restore' | 'refund' | 'pause' | 'downgrade';
  stage: CaseStage;
  openedAt: string;
  effectiveAt: string | null;
  confirmationRef: string | null;
  approvedAt: string | null;
  monitoring: boolean;
  evidenceIds: string[];
  timeline: CaseEvent[];
  /** Obligation this case is watching for a post-cancellation charge. */
  watchObligationId: string | null;
  exceptionTxnId: string | null;
  refundDraft: string | null;
  note: string | null;
}

export type LedgerType =
  | 'observed_avoided' | 'refund_credited' | 'observed_bill_reduction' | 'fee';
export type LedgerStatus = 'confirmed' | 'awaiting_verification' | 'reversed';

/** Observed, historical money. Never mixed with annualized projections. */
export interface LedgerEvent {
  id: string;
  /** Enforces count-once. A second event with the same key is discarded. */
  dedupeKey: string;
  type: LedgerType;
  amountCents: Cents;
  occurredAt: string;
  paymentId: string | null;
  obligationId: string | null;
  transactionId: string | null;
  basis: string;
  status: LedgerStatus;
}

export interface Reminder {
  id: string;
  paymentId: string | null;
  dueAt: string;
  label: string;
  kind: 'trial_deadline' | 'review_later' | 'notice_deadline' | 'custom';
  done: boolean;
}

export interface Rule {
  id: string;
  text: string;
  enabled: boolean;
  kind: 'trial_lead_time' | 'household_approval' | 'quiet_until' | 'digest';
  /** Payment the rule is scoped to, when applicable. */
  paymentId: string | null;
  hours: number | null;
}

export interface HouseholdMember {
  id: OwnerId;
  name: string;
  role: 'parent' | 'child';
  initials: string;
}

export interface BillDocument {
  id: string;
  paymentId: string;
  periodLabel: string;
  issuedAt: string;
  lines: { label: string; amountCents: Cents }[];
  totalCents: Cents;
}

export interface ConnectionSource {
  id: string;
  label: string;
  state: 'simulated_healthy' | 'simulated_stale' | 'disconnected';
  lastSyncAt: string;
  note: string;
}

// ---------------------------------------------------------------------------
// Household
// ---------------------------------------------------------------------------

export const HOUSEHOLD: HouseholdMember[] = [
  { id: 'nancy', name: 'Nancy', role: 'parent', initials: 'N' },
  { id: 'brian', name: 'Brian', role: 'child', initials: 'B' },
];

const CARD = 'Visa ···4412';
const CARD_ALT = 'Checking ···8830';

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

function payment(p: Partial<Payment> & Pick<Payment, 'id' | 'merchant' | 'amountCents' | 'category'>): Payment {
  return {
    plan: 'Standard',
    kind: 'subscription',
    interval: 'monthly',
    status: 'active',
    owner: 'nancy',
    usedBy: [],
    paymentSource: CARD,
    billingChannel: 'direct',
    nextChargeAt: null,
    essential: false,
    favorite: false,
    usageReport: null,
    lastUsedDaysAgo: null,
    variableEstimate: false,
    pauseOption: null,
    downgradeOption: null,
    contract: null,
    accessThrough: null,
    cancellationGuide: [],
    providerUrl: null,
    trial: null,
    addedByUser: false,
    archivedNote: null,
    ...p,
  } as Payment;
}

const GENERIC_GUIDE = [
  'Open the account page and sign in.',
  'Find the plan or membership section.',
  'Choose to end the plan, then confirm on the review step.',
  'Save the confirmation email or reference number.',
];

export const SUBSCRIPTIONS: Payment[] = [
  payment({
    id: 'p_netflix', merchant: 'Netflix', plan: 'Standard with ads', category: 'Streaming',
    amountCents: 1599, nextChargeAt: offsetISO(1, 9), usedBy: ['nancy'],
    usageReport: 'Nancy reported last watching this 39 days ago.', lastUsedDaysAgo: 39,
    accessThrough: offsetISO(1, 9), providerUrl: 'https://example-provider.demo/netflix/account',
    cancellationGuide: GENERIC_GUIDE,
  }),
  payment({
    id: 'p_spotify', merchant: 'Spotify', plan: 'Premium Individual', category: 'Streaming',
    amountCents: 1199, nextChargeAt: offsetISO(12, 9), usedBy: ['nancy'], favorite: true,
    usageReport: 'Nancy reported using this most days.', lastUsedDaysAgo: 1,
    cancellationGuide: GENERIC_GUIDE,
  }),
  payment({
    id: 'p_planetfitness', merchant: 'Planet Fitness', plan: 'Classic', category: 'Fitness',
    amountCents: 2500, nextChargeAt: offsetISO(3, 9), usedBy: ['nancy'],
    usageReport: 'Nancy reported 1 visit in the last 60 days.', lastUsedDaysAgo: 47,
    cancellationGuide: [
      'Cancellation for this membership is handled in the club or by written notice.',
      'Online self-service cancellation is not offered by this provider.',
      'Keep a copy of the written notice and the date it was sent.',
    ],
  }),
  payment({
    id: 'p_roblox', merchant: 'Roblox Premium', plan: '450 Robux', category: 'Kids',
    amountCents: 999, nextChargeAt: offsetISO(8, 9), owner: 'brian', usedBy: ['brian'],
    billingChannel: 'app_store', paymentSource: CARD,
    usageReport: 'Brian confirmed he uses this.', lastUsedDaysAgo: 2,
    cancellationGuide: ['Managed through the app store subscription list, not the merchant site.'],
  }),
  payment({
    id: 'p_abcmouse', merchant: 'ABCmouse', plan: 'Monthly', category: 'Kids',
    amountCents: 1499, nextChargeAt: offsetISO(6, 9), owner: 'brian', usedBy: [],
    usageReport: null, cancellationGuide: GENERIC_GUIDE,
  }),
  payment({
    id: 'p_chatgpt', merchant: 'ChatGPT', plan: 'Plus', category: 'Software',
    amountCents: 2000, nextChargeAt: offsetISO(7, 9), usedBy: ['nancy'], favorite: true,
    usageReport: 'Nancy reported using this for work most weekdays.', lastUsedDaysAgo: 1,
    cancellationGuide: GENERIC_GUIDE,
  }),
  payment({
    id: 'p_headspace', merchant: 'Headspace', plan: 'Monthly', category: 'Other',
    amountCents: 1299, nextChargeAt: offsetISO(9, 9), usedBy: ['nancy'],
    usageReport: 'Nancy reported last opening this 5 weeks ago.', lastUsedDaysAgo: 35,
    cancellationGuide: GENERIC_GUIDE,
  }),
  payment({
    id: 'p_cloudvault', merchant: 'CloudVault', plan: '2 TB', category: 'Software',
    amountCents: 299, nextChargeAt: offsetISO(11, 9), usedBy: ['nancy'],
    usageReport: 'Nancy reported storing family photos here.', lastUsedDaysAgo: 3,
    downgradeOption: {
      planName: 'CloudVault 200 GB', amountCents: 99,
      losing: 'Storage drops from 2 TB to 200 GB. Current usage in the sample data is 148 GB.',
      terms: 'Lower tier available on the same account. Change applies at the next billing date.',
    },
    cancellationGuide: GENERIC_GUIDE,
  }),
  payment({
    id: 'p_primevideo', merchant: 'Prime Video', plan: 'Video only', category: 'Streaming',
    amountCents: 899, nextChargeAt: offsetISO(13, 9), usedBy: ['nancy', 'brian'],
    usageReport: 'Nancy reported the household watches this weekly.', lastUsedDaysAgo: 4,
    cancellationGuide: GENERIC_GUIDE,
  }),
  payment({
    id: 'p_appletv', merchant: 'Apple TV', plan: 'Monthly', category: 'Streaming',
    amountCents: 999, nextChargeAt: offsetISO(15, 9), usedBy: ['nancy'],
    billingChannel: 'app_store',
    usageReport: null, cancellationGuide: ['Managed through the app store subscription list.'],
  }),
  payment({
    // Owned by Nancy, used by Brian. The child-total covers records Brian owns.
    id: 'p_gamepass', merchant: 'GamePass', plan: 'Ultimate', category: 'Kids',
    amountCents: 1699, nextChargeAt: offsetISO(16, 9), owner: 'nancy', usedBy: ['brian'],
    usageReport: 'Brian confirmed he uses this.', lastUsedDaysAgo: 1,
    cancellationGuide: GENERIC_GUIDE,
  }),
  payment({
    id: 'p_readly', merchant: 'Readly', plan: 'Unlimited', category: 'Learning',
    amountCents: 999, nextChargeAt: offsetISO(17, 9), usedBy: ['nancy'],
    usageReport: null, cancellationGuide: GENERIC_GUIDE,
  }),
  payment({
    id: 'p_adobe', merchant: 'Adobe', plan: 'Photography', category: 'Software',
    amountCents: 2499, nextChargeAt: offsetISO(18, 9), usedBy: ['nancy'],
    usageReport: 'Nancy reported last opening this 3 months ago.', lastUsedDaysAgo: 92,
    cancellationGuide: GENERIC_GUIDE,
  }),
  payment({
    id: 'p_fitcoach', merchant: 'FitCoach', plan: 'Coaching', category: 'Fitness',
    amountCents: 999, nextChargeAt: offsetISO(19, 9), usedBy: ['nancy'],
    usageReport: 'Nancy reported using this in the spring.', lastUsedDaysAgo: 61,
    pauseOption: {
      months: 1, label: 'Pause for one month',
      terms: 'This provider supports a single one-month hold. One $9.99 charge is skipped, then billing resumes at the same price.',
    },
    cancellationGuide: GENERIC_GUIDE,
  }),
  payment({
    id: 'p_languagelab', merchant: 'LanguageLab', plan: 'Monthly', category: 'Learning',
    amountCents: 1299, nextChargeAt: offsetISO(12, 9), usedBy: ['nancy'],
    usageReport: 'Nancy reported studying twice this month.', lastUsedDaysAgo: 6,
    contract: {
      noticeDays: 7,
      clause: 'Either party may end this agreement by giving notice no later than seven (7) days before the next renewal date. Notice received inside that window takes effect at the following renewal.',
      documentName: 'LanguageLab Subscriber Terms (sample), clause 6.2',
      observedAt: offsetISO(-40, 10),
    },
    cancellationGuide: GENERIC_GUIDE,
  }),
  payment({
    id: 'p_newsdaily', merchant: 'NewsDaily', plan: 'Annual', category: 'Learning',
    amountCents: 9588, interval: 'annual', nextChargeAt: offsetISO(45, 9), usedBy: ['nancy'],
    usageReport: 'Nancy reported reading this a few times a week.', lastUsedDaysAgo: 2,
    cancellationGuide: GENERIC_GUIDE,
  }),
  payment({
    id: 'p_kidslearn', merchant: 'KidsLearn', plan: 'Family', category: 'Kids',
    amountCents: 799, nextChargeAt: offsetISO(20, 9), owner: 'brian', usedBy: [],
    usageReport: null, cancellationGuide: GENERIC_GUIDE,
  }),
  payment({
    id: 'p_photobox', merchant: 'PhotoBox', plan: 'Prints Club', category: 'Other',
    amountCents: 499, nextChargeAt: offsetISO(21, 9), usedBy: ['nancy'],
    usageReport: null, cancellationGuide: GENERIC_GUIDE,
  }),
];

export const BILLS: Payment[] = [
  payment({
    id: 'p_harbor', merchant: 'Harbor Internet', plan: 'Fiber 500', category: 'Utilities',
    kind: 'bill', amountCents: 7900, nextChargeAt: offsetISO(10, 9), owner: 'household',
    paymentSource: CARD_ALT, essential: true,
    usageReport: 'Household broadband.', cancellationGuide: [],
  }),
  payment({
    id: 'p_water', merchant: 'City Water', plan: 'Residential', category: 'Utilities',
    kind: 'bill', amountCents: 3800, nextChargeAt: offsetISO(5, 9), owner: 'household',
    paymentSource: CARD_ALT, essential: true, variableEstimate: true,
    usageReport: 'Household utility.',
  }),
  payment({
    id: 'p_electricity', merchant: 'Gridline Power', plan: 'Residential', category: 'Utilities',
    kind: 'bill', amountCents: 9600, nextChargeAt: offsetISO(22, 9), owner: 'household',
    paymentSource: CARD_ALT, essential: true, variableEstimate: true,
    usageReport: 'Household utility.',
  }),
  payment({
    id: 'p_mobileco', merchant: 'MobileCo', plan: 'Family 3-line', category: 'Utilities',
    kind: 'bill', amountCents: 6500, nextChargeAt: offsetISO(24, 9), owner: 'household',
    paymentSource: CARD_ALT, essential: true,
    usageReport: 'Household phone plan.',
  }),
  payment({
    id: 'p_healthins', merchant: 'Health Insurance', plan: 'Family PPO', category: 'Insurance',
    kind: 'bill', amountCents: 18900, nextChargeAt: offsetISO(14, 9), owner: 'household',
    paymentSource: CARD_ALT, essential: true,
    usageReport: 'Household coverage.',
  }),
  payment({
    id: 'p_autoins', merchant: 'Auto Insurance', plan: 'Two vehicles', category: 'Insurance',
    kind: 'bill', amountCents: 6000, nextChargeAt: offsetISO(26, 9), owner: 'household',
    paymentSource: CARD_ALT, essential: true,
    usageReport: 'Household coverage.',
  }),
  payment({
    id: 'p_homeins', merchant: 'Home Insurance', plan: 'Standard dwelling', category: 'Insurance',
    kind: 'bill', amountCents: 8616, nextChargeAt: offsetISO(28, 9), owner: 'household',
    paymentSource: CARD_ALT, essential: true,
    usageReport: 'Household coverage.',
  }),
];

export const TRIALS: Payment[] = [
  payment({
    id: 'p_canva', merchant: 'Canva Pro', plan: 'Pro trial', category: 'Software',
    kind: 'trial', amountCents: 1499, nextChargeAt: offsetISO(1, 14),
    usedBy: ['nancy'],
    usageReport: 'Nancy reported making two designs during the trial.', lastUsedDaysAgo: 8,
    trial: {
      convertsAt: offsetISO(1, 14),
      decisionDeadlineAt: offsetISO(1, 14),
      firstChargeCents: 1499,
      laterCents: 1499,
      accessEndsImmediately: false,
    },
    accessThrough: offsetISO(1, 14),
    cancellationGuide: GENERIC_GUIDE,
  }),
  payment({
    id: 'p_disney', merchant: 'Disney+', plan: 'Standard trial', category: 'Streaming',
    kind: 'trial', amountCents: 1399, nextChargeAt: offsetISO(3, 14),
    usedBy: ['nancy', 'brian'],
    usageReport: 'Household reported watching one film.', lastUsedDaysAgo: 5,
    trial: {
      convertsAt: offsetISO(3, 14),
      decisionDeadlineAt: offsetISO(3, 14),
      firstChargeCents: 1399,
      laterCents: 1399,
      accessEndsImmediately: true,
    },
    accessThrough: offsetISO(3, 14),
    cancellationGuide: GENERIC_GUIDE,
  }),
];

/** Historical records. Never counted in current commitment or current item counts. */
export const ARCHIVED: Payment[] = [
  payment({
    id: 'p_puzzleclub', merchant: 'PuzzleClub', plan: 'Monthly box', category: 'Other',
    amountCents: 2500, status: 'archived', nextChargeAt: null,
    archivedNote: 'Cancelled 2026-08-20 in this demo history. The September renewal did not post.',
  }),
  payment({
    id: 'p_mealbox', merchant: 'MealBox', plan: 'Weekly plan', category: 'Other',
    amountCents: 3500, status: 'archived', nextChargeAt: null,
    archivedNote: 'Cancelled 2026-07-30 in this demo history. A charge posted afterwards and was refunded in full.',
  }),
];

export const SUBKILL_PREMIUM_CENTS: Cents = 799;

/** Added to payments only when the mock Premium plan is activated. */
export function subkillPayment(nextChargeAt: string): Payment {
  return payment({
    id: 'p_subkill', merchant: 'SubKill', plan: 'Premium', category: 'Software',
    amountCents: SUBKILL_PREMIUM_CENTS, nextChargeAt,
    usageReport: 'This app. Its cost is included in every comparison.',
    cancellationGuide: [
      'Open Pricing from the sidebar or profile menu.',
      'Choose Cancel Premium.',
      'Future demo fees stop. An already posted fee is not refunded unless a refund event is created.',
    ],
  });
}

export const ALL_SEED_PAYMENTS: Payment[] = [
  ...SUBSCRIPTIONS, ...BILLS, ...TRIALS, ...ARCHIVED,
];

// ---------------------------------------------------------------------------
// Obligations — one per expected future charge, generated from payments
// ---------------------------------------------------------------------------

export function obligationId(paymentId: string, dueAt: string): string {
  return `ob_${paymentId}_${ymd(dueAt)}`;
}

function scheduleFor(p: Payment): Obligation[] {
  if (!p.nextChargeAt || p.status !== 'active') return [];
  const out: Obligation[] = [];
  const stepMonths = p.interval === 'annual' ? 12 : 1;
  const first = new Date(p.nextChargeAt);
  // 14 months of horizon covers the 30-day preview, the annual renewal and time travel.
  const cycles = p.interval === 'annual' ? 2 : 14;
  for (let i = 0; i < cycles; i++) {
    const d = new Date(Date.UTC(
      first.getUTCFullYear(),
      first.getUTCMonth() + i * stepMonths,
      first.getUTCDate(),
      first.getUTCHours(), first.getUTCMinutes(), 0,
    ));
    const dueAt = d.toISOString();
    out.push({
      id: obligationId(p.id, dueAt),
      paymentId: p.id,
      dueAt,
      amountCents: p.kind === 'trial' && i === 0 ? (p.trial ? p.trial.firstChargeCents : p.amountCents) : p.amountCents,
      kind: p.kind === 'trial' ? (i === 0 ? 'trial_conversion' : 'renewal') : p.kind === 'bill' ? 'bill' : 'renewal',
      status: 'scheduled',
    });
  }
  return out;
}

export function buildObligations(payments: Payment[]): Obligation[] {
  return payments.flatMap(scheduleFor);
}

// ---------------------------------------------------------------------------
// History — posted transactions and the observed ledger
// ---------------------------------------------------------------------------

/** PuzzleClub's September renewal that never posted. Basis for the avoided-charge event. */
export const PUZZLECLUB_MISSED_OBLIGATION = 'ob_p_puzzleclub_2026-09-05';
export const MEALBOX_REFUND_TXN = 'tx_mealbox_refund_2026-08-14';
export const MOBILECO_REDUCTION_KEY = 'billreduction:p_mobileco:2026-08';

export const SEED_TRANSACTIONS: Txn[] = [
  { id: 'tx_mealbox_charge_2026-08-02', obligationId: null, paymentId: 'p_mealbox', postedAt: '2026-08-02T09:00:00.000Z', amountCents: 3500, kind: 'charge', label: 'MealBox charge after cancellation', synthetic: false },
  { id: MEALBOX_REFUND_TXN, obligationId: null, paymentId: 'p_mealbox', postedAt: '2026-08-14T09:00:00.000Z', amountCents: -3500, kind: 'refund', label: 'MealBox refund credited', synthetic: false },
  { id: 'tx_netflix_2026-08-11', obligationId: 'ob_p_netflix_2026-08-11', paymentId: 'p_netflix', postedAt: '2026-08-11T09:00:00.000Z', amountCents: 1599, kind: 'charge', label: 'Netflix monthly charge', synthetic: false },
  { id: 'tx_netflix_2026-07-11', obligationId: 'ob_p_netflix_2026-07-11', paymentId: 'p_netflix', postedAt: '2026-07-11T09:00:00.000Z', amountCents: 1599, kind: 'charge', label: 'Netflix monthly charge', synthetic: false },
  { id: 'tx_harbor_2026-08-20', obligationId: 'ob_p_harbor_2026-08-20', paymentId: 'p_harbor', postedAt: '2026-08-20T09:00:00.000Z', amountCents: 7100, kind: 'charge', label: 'Harbor Internet bill', synthetic: false },
  { id: 'tx_mobileco_2026-08-04', obligationId: 'ob_p_mobileco_2026-08-04', paymentId: 'p_mobileco', postedAt: '2026-08-04T09:00:00.000Z', amountCents: 6500, kind: 'charge', label: 'MobileCo bill, first month at the new rate', synthetic: false },
  { id: 'tx_mobileco_2026-07-04', obligationId: 'ob_p_mobileco_2026-07-04', paymentId: 'p_mobileco', postedAt: '2026-07-04T09:00:00.000Z', amountCents: 9200, kind: 'charge', label: 'MobileCo bill at the previous rate', synthetic: false },
];

export const SEED_LEDGER: LedgerEvent[] = [
  {
    id: 'le_refund_mealbox',
    dedupeKey: `refund:${MEALBOX_REFUND_TXN}`,
    type: 'refund_credited',
    amountCents: 3500,
    occurredAt: '2026-08-14T09:00:00.000Z',
    paymentId: 'p_mealbox',
    obligationId: null,
    transactionId: MEALBOX_REFUND_TXN,
    basis: 'A $35.00 credit posted to the card on 14 Aug 2026 after MealBox charged a cancelled plan. The credit is a recorded transaction, not a projection.',
    status: 'confirmed',
  },
  {
    id: 'le_avoided_puzzleclub',
    dedupeKey: `avoided:${PUZZLECLUB_MISSED_OBLIGATION}`,
    type: 'observed_avoided',
    amountCents: 2500,
    occurredAt: '2026-09-05T09:00:00.000Z',
    paymentId: 'p_puzzleclub',
    obligationId: PUZZLECLUB_MISSED_OBLIGATION,
    transactionId: null,
    basis: 'PuzzleClub billed $25.00 on the 5th for six consecutive months to Aug 2026. The 5 Sep 2026 renewal is absent from complete simulated activity after the 20 Aug cancellation. Counterfactual: the charge would have posted.',
    status: 'confirmed',
  },
  {
    id: 'le_billreduction_mobileco',
    dedupeKey: MOBILECO_REDUCTION_KEY,
    type: 'observed_bill_reduction',
    amountCents: 2700,
    occurredAt: '2026-08-04T09:00:00.000Z',
    paymentId: 'p_mobileco',
    obligationId: null,
    transactionId: 'tx_mobileco_2026-08-04',
    basis: 'The July MobileCo bill was $92.00 and the August bill was $65.00. Both bills are in the sample data. The $27.00 difference is evidenced by a later bill, not projected forward.',
    status: 'confirmed',
  },
];

// ---------------------------------------------------------------------------
// Bill documents — Bill Detective
// ---------------------------------------------------------------------------

export const BILL_DOCUMENTS: BillDocument[] = [
  {
    id: 'bd_harbor_aug', paymentId: 'p_harbor', periodLabel: 'August 2026', issuedAt: '2026-08-14T09:00:00.000Z',
    lines: [
      { label: 'Fiber 500 base charge', amountCents: 7900 },
      { label: 'Promotional credit (12-month welcome offer)', amountCents: -800 },
    ],
    totalCents: 7100,
  },
  {
    id: 'bd_harbor_sep', paymentId: 'p_harbor', periodLabel: 'September 2026', issuedAt: '2026-09-08T09:00:00.000Z',
    lines: [
      { label: 'Fiber 500 base charge', amountCents: 7900 },
      { label: 'Promotional credit (12-month welcome offer)', amountCents: 0 },
    ],
    totalCents: 7900,
  },
  {
    id: 'bd_electricity_sep', paymentId: 'p_electricity', periodLabel: 'September 2026', issuedAt: '2026-09-02T09:00:00.000Z',
    lines: [
      { label: 'Residential supply', amountCents: 6100 },
      { label: 'Delivery and meter charges', amountCents: 3500 },
    ],
    totalCents: 9600,
  },
];

export const HARBOR_PREV_DOC = 'bd_harbor_aug';
export const HARBOR_CURR_DOC = 'bd_harbor_sep';
export const HARBOR_CREDIT_CENTS: Cents = 800;

// ---------------------------------------------------------------------------
// Evidence
// ---------------------------------------------------------------------------

export const SEED_EVIDENCE: Evidence[] = [
  {
    id: 'ev_netflix_usage', kind: 'user_report', sourceLabel: 'Nancy, in-app usage check',
    observedAt: offsetISO(-2, 10), confidence: 'reported_by_user',
    summary: 'Nancy reported last watching Netflix 39 days ago.',
    detail: 'This is a self-report entered in the app on 8 Sep 2026. Bank payment records do not reveal app usage, so SubKill cannot confirm it independently.',
  },
  {
    id: 'ev_netflix_charges', kind: 'charge_history', sourceLabel: 'Simulated card activity',
    observedAt: offsetISO(-30, 9), confidence: 'confirmed',
    summary: '$15.99 charged on the 11th in each of the last three sample months.',
    detail: 'Jul 11, Aug 11 posted at $15.99. The next is scheduled for 11 Sep 2026.',
  },
  {
    id: 'ev_harbor_bills', kind: 'bill_document', sourceLabel: 'Harbor Internet bills, Aug and Sep 2026',
    observedAt: '2026-09-08T09:00:00.000Z', confidence: 'confirmed',
    summary: 'The base charge is unchanged at $79.00. An $8.00 monthly promotional credit is absent from the September bill.',
    detail: 'Both documents are in the sample data and can be compared line by line.',
  },
  {
    id: 'ev_canva_trial', kind: 'plan_terms', sourceLabel: 'Canva Pro trial terms (sample)',
    observedAt: offsetISO(-9, 10), confidence: 'confirmed',
    summary: 'The trial converts to a paid $14.99 monthly plan on 11 Sep 2026 unless cancelled first.',
    detail: 'Access continues to the end of the paid period if the plan converts. Cancelling before conversion prevents the first charge.',
  },
  {
    id: 'ev_disney_trial', kind: 'plan_terms', sourceLabel: 'Disney+ trial terms (sample)',
    observedAt: offsetISO(-7, 10), confidence: 'confirmed',
    summary: 'The trial converts to a paid $13.99 monthly plan on 13 Sep 2026 unless cancelled first.',
    detail: 'This provider ends access immediately on cancellation rather than at the end of the trial.',
  },
  {
    id: 'ev_languagelab_contract', kind: 'contract_clause', sourceLabel: 'LanguageLab Subscriber Terms (sample), clause 6.2',
    observedAt: offsetISO(-40, 10), confidence: 'confirmed',
    summary: 'Seven days notice is required before the renewal date, so the decision deadline is 15 Sep, not the 22 Sep renewal.',
    detail: 'Either party may end this agreement by giving notice no later than seven (7) days before the next renewal date.',
  },
  {
    id: 'ev_headspace_usage', kind: 'user_report', sourceLabel: 'Nancy, in-app usage check',
    observedAt: offsetISO(-4, 10), confidence: 'reported_by_user',
    summary: 'Nancy reported last opening Headspace about 5 weeks ago.',
    detail: null,
  },
  {
    id: 'ev_planetfitness_usage', kind: 'user_report', sourceLabel: 'Nancy, in-app usage check',
    observedAt: offsetISO(-4, 10), confidence: 'reported_by_user',
    summary: 'Nancy reported one gym visit in the last 60 days.',
    detail: null,
  },
  {
    id: 'ev_adobe_usage', kind: 'user_report', sourceLabel: 'Nancy, in-app usage check',
    observedAt: offsetISO(-4, 10), confidence: 'reported_by_user',
    summary: 'Nancy reported last opening Adobe about 3 months ago.',
    detail: null,
  },
  {
    id: 'ev_fitcoach_usage', kind: 'user_report', sourceLabel: 'Nancy, in-app usage check',
    observedAt: offsetISO(-4, 10), confidence: 'reported_by_user',
    summary: 'Nancy reported using FitCoach in the spring.',
    detail: null,
  },
  {
    id: 'ev_mobileco_benefit', kind: 'benefit_clause', sourceLabel: 'MobileCo Family 3-line plan summary (sample), section 4',
    observedAt: offsetISO(-20, 10), confidence: 'confirmed',
    summary: 'The plan lists eligibility for a MusicStream Basic benefit at no extra cost. Activation is required and it has not been activated on this account.',
    detail: 'MusicStream Basic is ad-supported and does not include offline downloads or lossless audio. Spotify Premium includes both. Whether it is a suitable replacement depends on which of those Nancy uses.',
  },
  {
    id: 'ev_electricity_single', kind: 'bill_document', sourceLabel: 'Gridline Power bill, Sep 2026',
    observedAt: '2026-09-02T09:00:00.000Z', confidence: 'confirmed',
    summary: 'Only one Gridline Power bill is present in the sample data.',
    detail: 'A prior period is required to explain a change. SubKill has nothing to compare against here.',
  },
  {
    id: 'ev_puzzleclub_pattern', kind: 'charge_history', sourceLabel: 'Simulated card activity, Mar to Aug 2026',
    observedAt: '2026-09-05T09:00:00.000Z', confidence: 'confirmed',
    summary: 'PuzzleClub billed $25.00 on the 5th for six consecutive months, then stopped after the 20 Aug cancellation.',
    detail: null,
  },
  {
    id: 'ev_mealbox_refund', kind: 'transaction', sourceLabel: 'Simulated card activity',
    observedAt: '2026-08-14T09:00:00.000Z', confidence: 'confirmed',
    summary: 'A $35.00 credit posted on 14 Aug 2026.',
    detail: null,
  },
  {
    id: 'ev_mobileco_bills', kind: 'bill_document', sourceLabel: 'MobileCo bills, Jul and Aug 2026',
    observedAt: '2026-08-04T09:00:00.000Z', confidence: 'confirmed',
    summary: 'The bill fell from $92.00 in July to $65.00 in August.',
    detail: null,
  },
  {
    id: 'ev_cloudvault_tier', kind: 'plan_terms', sourceLabel: 'CloudVault plan list (sample)',
    observedAt: offsetISO(-15, 10), confidence: 'confirmed',
    summary: 'A 200 GB tier at $0.99 exists on this account. Sample usage is 148 GB.',
    detail: null,
  },
  {
    id: 'ev_fitcoach_pause', kind: 'plan_terms', sourceLabel: 'FitCoach membership terms (sample)',
    observedAt: offsetISO(-15, 10), confidence: 'confirmed',
    summary: 'A single one-month hold is supported. It skips one charge and then resumes at the same price.',
    detail: null,
  },
];

// ---------------------------------------------------------------------------
// Opportunities — the candidate reductions
// ---------------------------------------------------------------------------

export const SEED_OPPORTUNITIES: Opportunity[] = [
  {
    id: 'op_netflix', paymentId: 'p_netflix', type: 'cancel', monthlyReductionCents: 1599,
    countsTowardCandidateTotal: true, availability: 'eligible', status: 'open',
    evidenceIds: ['ev_netflix_usage', 'ev_netflix_charges'],
    headline: 'Netflix renews tomorrow and Nancy reported not watching it for 39 days',
    rationale: 'A renewal on its own is not a problem. This one is flagged because the next charge lands inside 24 hours and the only usage signal available, Nancy’s own report, says 39 days.',
    assumptions: ['Cancelling ends the plan. This is subject to your preference, not a recommendation to cancel by default.', 'Usage is self-reported and cannot be confirmed from payment records.'],
    reviewAfter: null,
  },
  {
    id: 'op_headspace', paymentId: 'p_headspace', type: 'cancel', monthlyReductionCents: 1299,
    countsTowardCandidateTotal: true, availability: 'eligible', status: 'open',
    evidenceIds: ['ev_headspace_usage'],
    headline: 'Headspace has not been opened for about 5 weeks',
    rationale: 'Nancy reported last opening it around 5 weeks ago and it renews monthly.',
    assumptions: ['Usage is self-reported.', 'Cancelling ends access at the end of the paid period.'],
    reviewAfter: null,
  },
  {
    id: 'op_planetfitness', paymentId: 'p_planetfitness', type: 'cancel', monthlyReductionCents: 2500,
    countsTowardCandidateTotal: true, availability: 'eligible', status: 'open',
    evidenceIds: ['ev_planetfitness_usage'],
    headline: 'Planet Fitness: one reported visit in 60 days',
    rationale: 'The largest single subscription reduction available, but this provider does not support online cancellation.',
    assumptions: ['Cancellation requires an in-club or written notice in this sample.', 'Usage is self-reported.'],
    reviewAfter: null,
  },
  {
    id: 'op_adobe', paymentId: 'p_adobe', type: 'cancel', monthlyReductionCents: 2499,
    countsTowardCandidateTotal: true, availability: 'eligible', status: 'open',
    evidenceIds: ['ev_adobe_usage'],
    headline: 'Adobe Photography has not been opened for about 3 months',
    rationale: 'Nancy reported last opening it around 3 months ago.',
    assumptions: ['Usage is self-reported.', 'Files created with the plan may need exporting before access ends.'],
    reviewAfter: null,
  },
  {
    id: 'op_fitcoach', paymentId: 'p_fitcoach', type: 'cancel', monthlyReductionCents: 999,
    countsTowardCandidateTotal: true, availability: 'eligible', status: 'open',
    evidenceIds: ['ev_fitcoach_usage', 'ev_fitcoach_pause'],
    headline: 'FitCoach is unused since the spring',
    rationale: 'This candidate amount assumes cancellation. A one-month pause is also supported, which skips a single $9.99 charge and is not an ongoing annual reduction.',
    assumptions: ['The $9.99 figure here assumes cancellation, not the pause.'],
    reviewAfter: null,
  },
  {
    id: 'op_harbor_credit', paymentId: 'p_harbor', type: 'credit_restore', monthlyReductionCents: 800,
    countsTowardCandidateTotal: true, availability: 'unknown_until_provider_response', status: 'open',
    evidenceIds: ['ev_harbor_bills'],
    headline: 'Ask Harbor Internet whether the $8.00 credit can be restored',
    rationale: 'The base price did not change. A promotional credit ended. Asking is a request, not an offer that is known to be available.',
    assumptions: ['Availability is unknown until the provider responds.', 'This is not a claim that negotiation succeeds, or that this provider negotiates at all.'],
    reviewAfter: null,
  },
  {
    id: 'op_cloudvault_downgrade', paymentId: 'p_cloudvault', type: 'downgrade', monthlyReductionCents: 200,
    countsTowardCandidateTotal: false, availability: 'eligible', status: 'open',
    evidenceIds: ['ev_cloudvault_tier'],
    headline: 'CloudVault has a lower tier that still fits current usage',
    rationale: 'Sample usage is 148 GB against a 2 TB plan. Excluded from the headline candidate total, which covers the six seeded candidates only.',
    assumptions: ['Storage drops to 200 GB. Anything above that would need removing.'],
    reviewAfter: null,
  },
  {
    id: 'op_spotify_overlap', paymentId: 'p_spotify', type: 'bundle_overlap', monthlyReductionCents: 1199,
    countsTowardCandidateTotal: false, availability: 'speculative', status: 'open',
    evidenceIds: ['ev_mobileco_benefit'],
    headline: 'MobileCo may already include a music benefit that overlaps Spotify',
    rationale: 'The plan summary lists MusicStream Basic eligibility. It has not been activated and the two services differ. Excluded from every total until eligibility and a chosen replacement are confirmed.',
    assumptions: ['Eligibility is stated in a plan document, not confirmed on the account.', 'MusicStream Basic has ads and no offline downloads. Spotify Premium has neither limitation.'],
    reviewAfter: null,
  },
];

// ---------------------------------------------------------------------------
// Reminders, rules, goal, settings
// ---------------------------------------------------------------------------

export const SEED_REMINDERS: Reminder[] = [
  { id: 'rm_canva', paymentId: 'p_canva', dueAt: offsetISO(0, 14), label: 'Canva Pro trial converts tomorrow', kind: 'trial_deadline', done: false },
  { id: 'rm_disney', paymentId: 'p_disney', dueAt: offsetISO(2, 14), label: 'Disney+ trial converts in 3 days', kind: 'trial_deadline', done: false },
  { id: 'rm_languagelab', paymentId: 'p_languagelab', dueAt: offsetISO(5, 9), label: 'LanguageLab notice deadline', kind: 'notice_deadline', done: false },
];

export const SEED_RULES: Rule[] = [
  { id: 'ru_trial72', text: 'Remind me 72 hours before a trial converts.', enabled: true, kind: 'trial_lead_time', paymentId: null, hours: 72 },
  { id: 'ru_brian', text: 'Ask me before changing anything Brian uses.', enabled: true, kind: 'household_approval', paymentId: null, hours: null },
  { id: 'ru_netflix_quiet', text: 'Keep Netflix suggestions quiet until my chosen review date.', enabled: false, kind: 'quiet_until', paymentId: 'p_netflix', hours: null },
  { id: 'ru_digest', text: 'Include routine renewals in my weekly digest.', enabled: true, kind: 'digest', paymentId: null, hours: null },
];

export const SEED_CONNECTIONS: ConnectionSource[] = [
  { id: 'cx_bank', label: 'Card and account activity', state: 'simulated_healthy', lastSyncAt: offsetISO(0, 16), note: 'Simulated connection. No real bank is linked.' },
  { id: 'cx_email', label: 'Receipt inbox', state: 'simulated_healthy', lastSyncAt: offsetISO(0, 15), note: 'Simulated connection. No real mailbox is linked.' },
];

export const SAVINGS_GOAL_CENTS: Cents = 30_000;

export interface SeedSettings {
  quietHoursStart: number;
  quietHoursEnd: number;
  alertCategories: Record<string, boolean>;
  premium: boolean;
  digest: 'daily' | 'weekly';
  householdSharing: boolean;
}

export const SEED_SETTINGS: SeedSettings = {
  quietHoursStart: 21,
  quietHoursEnd: 7,
  alertCategories: {
    'Trial deadlines': true,
    'Bill increases': true,
    'Charges after cancellation': true,
    'Routine renewals': false,
  },
  premium: false,
  digest: 'weekly',
  householdSharing: true,
};

export const SEED_CASES: ActionCase[] = [];

// ---------------------------------------------------------------------------
// The complete initial state
// ---------------------------------------------------------------------------

export const SCHEMA_VERSION = 4;

export interface DemoState {
  schemaVersion: number;
  nowISO: string;
  payments: Payment[];
  obligations: Obligation[];
  transactions: Txn[];
  ledger: LedgerEvent[];
  opportunities: Opportunity[];
  cases: ActionCase[];
  evidence: Evidence[];
  reminders: Reminder[];
  rules: Rule[];
  connections: ConnectionSource[];
  billDocuments: BillDocument[];
  settings: SeedSettings;
  goalCents: Cents;
  /** Alert ids the user has resolved or snoozed, and their chosen dates. */
  alertState: Record<string, { status: 'open' | 'watching' | 'resolved'; reviewAfter: string | null }>;
  tourSeen: boolean;
  processedObligationIds: string[];
  harborOffer: {
    stage: 'none' | 'draft_prepared' | 'response_received' | 'accepted';
    creditCents: Cents;
    months: number;
    effectiveAt: string | null;
    expiresAt: string | null;
  };
}

export function createInitialState(): DemoState {
  const payments = ALL_SEED_PAYMENTS.map((p) => ({ ...p }));
  return {
    schemaVersion: SCHEMA_VERSION,
    nowISO: DEMO_EPOCH_ISO,
    payments,
    obligations: buildObligations(payments),
    transactions: SEED_TRANSACTIONS.map((t) => ({ ...t })),
    ledger: SEED_LEDGER.map((l) => ({ ...l })),
    opportunities: SEED_OPPORTUNITIES.map((o) => ({ ...o })),
    cases: SEED_CASES.map((c) => ({ ...c })),
    evidence: SEED_EVIDENCE.map((e) => ({ ...e })),
    reminders: SEED_REMINDERS.map((r) => ({ ...r })),
    rules: SEED_RULES.map((r) => ({ ...r })),
    connections: SEED_CONNECTIONS.map((c) => ({ ...c })),
    billDocuments: BILL_DOCUMENTS.map((b) => ({ ...b })),
    settings: { ...SEED_SETTINGS, alertCategories: { ...SEED_SETTINGS.alertCategories } },
    goalCents: SAVINGS_GOAL_CENTS,
    alertState: {},
    tourSeen: false,
    processedObligationIds: [],
    harborOffer: { stage: 'none', creditCents: HARBOR_CREDIT_CENTS, months: 12, effectiveAt: null, expiresAt: null },
  };
}
