# Seiketsu audit — 7 November 2026

Production readiness: **58/100 — risky; fix financial correctness and outlet isolation before public rollout.** This is an engineering judgment from the local checkout, not a certification or an exhaustive security guarantee.

Baseline: `ae1f710`, clean tracked files at audit start. Skills used: `production-audit` and `security-review`. No application fixes, migrations, live transactions, or deployments were performed. Only this audit folder was added.

## Highest-priority findings

### 1. P1 — The same loyalty balance can fund multiple orders

Evidence: `apps/web/src/lib/server/orders.ts:142–159,228,428`; `apps/web/src/lib/server/rewards.ts:22–31,67–76`.

Checkout reads the ledger balance, calculates a discount and stores points used on the order. Points are deducted only after payment. Create two unpaid checkouts with the same signed-in phone before paying either: both can receive the full available-points discount. Capturing both inserts separate debits, allowing a negative balance. This does not require simultaneous requests. Per-order idempotency does not protect the customer's balance.

Fix: reserve points atomically under a customer/balance lock at order creation; release reservations on expiry, failure and cancellation; consume the reservation exactly once on capture. Cover two outstanding orders and payment/expiry races.

### 2. P1 — Refunds are finalized before the provider confirms success

Evidence: `apps/web/src/lib/server/orders.ts:578–609`.

Any returned refund status causes the payment and order to be marked refunded, points to be reversed, and a refund notification to be sent. A later `refund.failed` event only changes the refund row. The order stays refunded and its captured payment is no longer eligible for `refundOrder`, preventing the normal retry path even though the customer has not received the money.

Fix: model requested/pending/processed/failed explicitly. Update financial state and rewards on confirmed success, reconcile pending refunds, and restore retry eligibility after a failure.

### 3. P1 — Refund requests have no durable idempotency boundary

Evidence: `apps/web/src/lib/server/orders.ts:580–600`; `apps/web/src/lib/server/gateway.ts` (`refund`).

The service reads a captured payment, calls the provider, and only then writes its local refund record. There is no lock, persisted refund intent or request idempotency key. Concurrent requests can enter the provider call for the same remaining amount. More critically, a process/database failure after provider acceptance leaves no local record, and a retry sends a fresh request. The provider may reject excess refunds, but local recovery and accounting remain inconsistent. Manual counter refunds can also be recorded twice.

Fix: persist a unique refund intent before the network call, serialize remaining-amount allocation and reconcile ambiguous provider responses.

### 4. P1 — Staff POS uses the customer's outlet for pricing and menu

Evidence: `apps/web/src/app/pos/page.tsx:9–10`; `apps/web/src/lib/server/orders.ts:630–646`; `apps/web/src/lib/server/catalog.ts:24–29`; `apps/web/src/lib/server/outlets.ts:49–55`.

`getStore()` resolves the customer-facing `seiketsu_outlet` cookie/default, while POS writes the order to `staff.outletId`. Switching the admin outlet changes a separate cookie. A cashier at outlet B can therefore see outlet A's availability and charge outlet A's tax settings while recording the sale at B. The GSTIN is then fetched from B, producing a mixed tax snapshot.

Related: `apps/web/src/app/pos/receipt/[id]/page.tsx:19` and `apps/web/src/app/bill/[token]/page.tsx:24` use the same cookie-derived store for bill name/address. Viewing another outlet's bill can print the wrong branch details.

Fix: load staff store data explicitly by `staff.outletId`; load bill issuer data by the order's outlet, preferably from an immutable invoice snapshot.

### 5. P1 — Saving a recipe deletes other outlets' recipes

Evidence: `apps/web/src/lib/server/inventory.ts:342–357`.

Recipe ingredients are validated against the active staff outlet, but replacement deletes every recipe line for the shared variant/add-on, without filtering the ingredient's outlet. Saving outlet B's version removes outlet A's version. Later sales at A find no matching ingredients and silently deduct no stock.

Fix: scope recipe ownership and replacement to outlet plus variant/add-on. Add a two-outlet integration case that saves both recipes and verifies stock deductions independently. The README acknowledges recipe limitations, but the deletion is a concrete data-loss behavior beyond a missing convenience feature.

### 6. P1 — Coupon limits can be exceeded by concurrent checkout

Evidence: `apps/web/src/lib/server/rewards.ts:43–62`; `apps/web/src/lib/server/orders.ts:228,237–280`.

Coupon usage is counted before the order transaction. Two requests can both observe the final available use and both insert a redemption. There is no coupon-level lock or atomic conditional allocation enforcing total/per-phone limits.

Fix: allocate a coupon reservation inside a transaction under a coupon lock, with a consistent lock order and expiry/release policy. Also define how late payment on an expired order interacts with a released coupon reservation.

## Further correctness findings

### 7. P2 — Loyalty settlement failures never retry automatically

Evidence: `apps/web/src/lib/server/orders.ts:373–374,425–429`; `apps/web/src/app/api/cron/reconcile/route.ts:21–25`.

Loyalty settlement runs after payment commits and errors are only logged. A duplicate capture exits as unchanged and skips settlement. Cron repairs inventory, not loyalty. A transient failure permanently omits earned points or the debit for points already used, unless staff repair the ledger by hand.

Fix: persist settlement work with payment capture and retry it idempotently until complete, including refund-versus-settlement ordering.

### 8. P2 — Reconciliation can repeatedly select the same 50 expired orders

Evidence: `apps/web/src/lib/server/orders.ts:515–534`.

The stale query includes all orders expired within a day, applies `limit(50)`, and has no ordering, cursor or last-checked scheduling. Expired unpaid orders stay eligible after each run. There is no guarantee that other stale orders will ever enter the batch; a busy day can repeatedly consume the batch with already-checked rows.

Fix: schedule by a persisted next-check/last-check time, prioritize outstanding payments, and process a bounded rotating batch with deterministic ordering.

### 9. P2 — Rejected orders remain eligible for the low-level stock deduction

Evidence: `apps/web/src/lib/server/inventory.ts:226–232,269–275`; `apps/web/src/lib/server/orders.ts:425–429,565–568`.

Returning rejected stock clears `stockDeductedAt`, while `deductStockForOrder` accepts any paid order regardless of order status. The cron caller excludes rejected orders, but the function itself does not. If a rejected order is reached by a delayed deduction after stock has been returned, it can take stock out again. Rejection before a delayed first deduction can also deduct inventory after the return path found nothing to return.

Fix: enforce eligible order statuses in the same locked transaction as deduction and test payment/rejection interleavings.

### 10. P2 — Every portion snapshot contains literal template text

Evidence: `apps/web/src/lib/server/orders.ts:186–187`.

The portion string is `"{v.portionAmount}{v.portionUnit}"` rather than a template literal with interpolated values. A 450g variant is saved with that literal text on both online and POS orders, affecting kitchen/order details and receipts.

Fix: interpolate the amount and unit and verify persisted order-line labels.

### 11. P2 — Floating mobile Menu control overlaps ADD

Evidence: `apps/web/src/components/site/menu/category-nav.tsx:85`; `audit-mobile-viewport.png`.

At 390×844, the fixed Menu control overlaps the first salad's ADD area. Its z-index is higher, so it receives taps within the overlap. It can similarly obscure other dish controls during scrolling.

Fix: place category navigation in reserved layout space or a dedicated bottom bar, and verify that ordering controls remain exposed at common mobile viewport heights and while the cart bar is visible.

## Build, test and operational evidence

| Check | Result |
| --- | --- |
| `npm test` | PASS: 21 files, 141 tests |
| `npm run build` | PASS: production compilation and route generation |
| Root `npm run typecheck` | FAIL: `packages/db/src/extras-regroup.test.ts:87`, `.rows` does not exist on the declared Postgres result type |
| Web workspace `npm run typecheck` | PASS |
| `npm run lint -w web` | FAIL: 483 errors, 5,085 warnings, dominated by generated `.netlify` contents |
| `eslint src` | No errors; one unused-variable warning at `outlets.ts:82`; machine-readable result retained in `audit-eslint.json` |
| Browser smoke | Home, menu, checkout, customer sign-in and staff sign-in all HTTP 200 at widths 1440 and 390; no page errors or horizontal page overflow |
| Desktop scroll scene | Sticky lifestyle scene verified during scrolling; large spaces in the full-page capture are scroll-scene geometry, not proof of missing content |

Improve lint ignores for `.netlify/**`; correct the test adapter/result typing without breaking PGlite assertions. The only checked-in GitHub workflow found is reconciliation cron; there is no checked-in build/test/typecheck CI gate. Add a clean-checkout quality gate and documented backup/restore and release rollback procedures. No operational recovery was executed in this audit.

## Design and UX assessment

The typography, berry/cream palette and visual hierarchy are consistent. The mobile header fits, menu search and diet controls are visible, and desktop sticky scenes function. This is a coherent visual foundation.

The main polish limitations are repeated section-level placeholder drawings for distinct dishes, long dish names wrapping into several lines on phones, and an unusually lengthy desktop marketing journey. Lifestyle, Why, How and Promise alone reserve 350+300+280+300 viewport-height units (12.3 screens). Shorten those scenes and bring food, price and ordering decisions forward. These are design judgments, separate from the confirmed defects above. Screenshots are retained beside this report.

## Security and product decisions requiring explicit resolution

- **Scope of outlet roles:** `admin/outlet-actions.ts:49–54` permits an owner of the current outlet to update any outlet ID, and the page deliberately lists all outlets. CRM listing (`crm.ts:8–30`) deliberately selects all customers, only scoping order aggregates. Staff deactivation/password resets update global users after checking membership at the current outlet (`staff-actions.ts:67–99`). If roles are outlet-local, these are cross-outlet authorization gaps. If owners/managers are intended to have chain-wide powers, document and represent that distinction explicitly. Do not silently treat an outlet-owner role as a chain administrator.
- **Production test logins:** `env.ts:55` parses `TEST_LOGINS` in production, and both OTP paths accept the fixed code. Unlike the payment simulator, there is no production guard. Fail startup or ignore this setting in production unless a separately controlled demo deployment intentionally needs it. No active production test-login setting was verified.
- **Customer profile integrity:** guest checkout upserts name/email on an existing phone before payment (`orders.ts:238–243`). Anyone who knows a phone can overwrite that customer's profile data without proving ownership or paying. Preserve verified profile fields; store guest-entered contact information only on the order, or update after authenticated confirmation.
- **Launch content:** `lib/legal.ts:8–10` still has null legal business name and support email. README's owner-confirmation section also contradicts later changes to phone, nutrition and diet marks. Have the owner confirm the business details and reconcile the setup guide with the implemented release.
- **External integrations:** no real Razorpay/MSG91 account, deployed Supabase policy configuration, production credentials, provider webhook delivery or actual refund was validated. No dependency vulnerability database or external source scanner was queried. Dependency declarations alone do not establish vulnerability status.

## Recommended work order

1. Fix loyalty reservation, refund state/idempotency and coupon allocation; add meaningful concurrency/recovery integration coverage.
2. Fix explicit outlet loading, outlet-scoped recipe replacement and stock/rejection ordering. Settle the role-scope policy before enforcing it consistently.
3. Repair root typechecking/lint and add CI. Verify rollback and provider failure/retry paths in a staging environment.
4. Fix mobile control overlap and portion labels, then shorten the homepage journey and replace repeated dish illustrations as real photos become available.

## Limits

The code findings were traced through the relevant services and callers; new exploit/concurrency reproductions were not executed. Browser coverage is a public-page smoke and visual review, not a completed authenticated checkout/POS/admin E2E suite. Existing integration tests use PGlite and a payment simulator, so their success does not establish real Postgres concurrency or provider behavior. Subscriptions, inventory, reporting, auth, API guards, migrations and deployment setup were sampled as part of this broad audit; every possible state and route was not exhaustively exercised.
