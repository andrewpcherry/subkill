# SubKill

**Know where every dollar goes.**

An investor prototype of an AI financial guardian for recurring household spending: subscriptions, free trials, phone plans, utilities, insurance and memberships.

> **Investor demo · sample data.** Everything here is synthetic. No signup, no bank connection, no email access, no payment processing and no AI service. No real subscription is ever cancelled and no message is ever sent.

## The three demo moments

**1. Money Preview — "what changes if I decide this?"**
Money → Money Preview. Select *Cancel* on Netflix and on the Canva Pro trial. The 30-day forecast reflows and the difference reads **$30.98** — Netflix's $15.99 renewal plus Canva's $14.99 first charge, both scheduled inside the window. Nothing is committed: *Review these actions* opens a checklist where each action is approved on its own. Approving Netflix moves the whole app from $842.00 to **$826.01** a month, $10,104 to **$9,912.12** a year, and drops remaining candidate reductions from $1,163.52 to **$971.64**.

**2. Bill Detective — "why did this go up?"**
Home → *Explain increase* on Harbor Internet. Two synthetic bills sit side by side. The base charge never moved: it is $79.00 in both. An $8.00 promotional credit is present in August and absent in September. That is **+$8.00 a month, about +11.3%, +$96.00 a year if the new rate continues** — deliberately not the 18% a naive reading gives. *Prepare provider message* drafts an editable request grounded in those exact figures. *Simulate provider response* returns a synthetic 12-month credit offer whose terms you inspect before accepting; only acceptance changes any forecast.

**3. Cancellation Watch — "and then it charged me anyway"**
After confirming the Netflix cancellation, open the demo toolbar and press *Simulate later charge*. A synthetic $15.99 posts after the effective date. The case reopens as an exception at the top of the queue, the cancellation receipt is shown beside the later charge, and the previously counted avoided-charge benefit is **reversed** — because the money was never actually kept. A refund request is drafted, sent only on an explicit second approval, and any credit is linked to the same posted charge so it cannot be counted twice.

## How the money is kept honest

- All amounts are stored as **integer cents**. Formatting happens only at display time.
- Every displayed total is **computed by a selector** in `src/state/derive.ts`. No monetary total is written as a literal anywhere else.
- Every monetary outcome links to a unique **obligation** or **transaction** id, and ledger entries carry a `dedupeKey`, so the same $15.99 cannot be counted twice under two ids.
- **Observed money and projections are never added together.** A year's projected reduction is never totalled with a month's observed benefit.
- An absent charge is only evidence while the simulated sources are current. Mark a source stale and anything resting on an absence drops to *awaiting verification*.
- Requesting a cancellation is not receiving money. Copying a draft or opening a provider link never counts as a confirmation.

## Running it

```bash
npm install
npm run build && npm run preview
```

Verify the seeded arithmetic at any time:

```bash
node src/state/derive.test.ts
```

That gate asserts 43 behaviours straight from the seed records — the baseline totals, the Netflix cascade, the $30.98 preview, the Harbor percentages, action idempotency, time advancement and reset fidelity.

## Notes

- Fixed demo clock of **2026-09-10 18:00 UTC**. "Tomorrow", deadlines and reports derive from that clock, never the device date.
- State persists in `localStorage` with a schema version. *Reset* in the demo toolbar restores the exact original seed.
- Merchant names and prices are illustrative fixtures, not current advertised prices. Providers requiring invented terms (Harbor Internet, MobileCo, LanguageLab, CloudVault, FitCoach) are fictional.
