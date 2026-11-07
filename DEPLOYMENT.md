# Supabase and Vercel deployment

The repository is prepared for deployment; no target project has been provisioned or deployed. Use Node 24 and npm. The root `package-lock.json` owns all three workspaces. Do not add Yarn lockfiles or separate workspace installs.

## Supabase

1. Select the intended Supabase project and region. Vercel's default in this repo is Mumbai (`bom1`); keep the database nearby or change `apps/web/vercel.json` to match the chosen region.
2. Copy the **transaction pooler** PostgreSQL URL (port 6543) to server-only `DATABASE_URL`. The driver disables prepared statements and limits each instance to three connections. URL-encode special characters in the password. Use the dashboard's actual host, not a fabricated project hostname.
3. Set optional `DATABASE_MIGRATION_URL` to a direct connection or **session pooler** URL (5432) for CLI migrations, seed and owner setup. Prefer the session pooler if the computer lacks IPv6. Never use a `NEXT_PUBLIC_` name for a SQL connection or service key.
4. Apply the checked-in **Drizzle** migrations; this project does not use Supabase CLI migration history. Do not paste a second copy of the schema into the SQL editor or migrate automatically from every Vercel build.

From the repository root, with the target URLs configured in the environment:

```powershell
npm ci
npm run db:migrate
# First installation only; safe insert-only seed, no all-day testing flag:
npm run db:seed
# Supply OWNER_PASSWORD privately in the environment, then:
npm run create-owner -w @seiketsu/db -- owner@example.com "Owner"
```

`0010_financial_safety` adds reward/reconciliation/invoice fields and enables RLS on all 38 application tables. There are deliberately **no browser table policies**: customer and staff sessions belong to the Next.js server, which connects through privileged server-side SQL. `anon` and `authenticated` have no application-table access. The runtime SQL role must own the tables or have `BYPASSRLS`; a public Supabase API key cannot replace the SQL connection.

Realtime is optional. Leave all three Realtime variables blank to use polling. To enable broadcasts, set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and server-only `SUPABASE_SERVICE_ROLE_KEY`. Public channels carry change signals only; order/customer records still come through server routes. The service-role key must never be placed in browser code or a `NEXT_PUBLIC_` variable.

References: [Supabase connections](https://supabase.com/docs/guides/database/connecting-to-postgres), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Vercel project settings

| Setting | Value |
| --- | --- |
| Framework | Next.js |
| Root directory | `apps/web` |
| Include files outside root directory | Enabled, for `packages/core` and `packages/db` |
| Node | 24.x |
| Install/build/output | Framework defaults; npm root workspace lockfile; `next build`; `.next` |
| Functions region | `bom1` by default; match the selected database region |

Required runtime variables:

- `DATABASE_URL`: Supabase transaction pooler URL.
- `SESSION_SECRET`: 32+ random characters, different for preview and production.
- `CRON_SECRET`: a separate 32+ character random secret.
- `NEXT_PUBLIC_SITE_URL`: exact HTTPS origin, with no path, query or credentials.
- `DEFAULT_OUTLET`: normally `versova`.
- `LEGAL_BUSINESS_NAME` and `SUPPORT_EMAIL`: real owner-approved public business details. These are checked by deployment preflight.

For online payments set **all three** `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET`. Start with test keys in a separate preview environment. With no keys, browsing and counter operations work but online payment is disabled. Configure Razorpay webhooks for payment captured/failed, order paid, refund processed/failed at `/api/webhooks/razorpay`.

Set messaging variables from `.env.example` only when MSG91/Resend are ready. Never set `TEST_LOGINS` or `PAYMENTS_MODE=simulator` on Vercel. Production runtime/preflight reject local persistence and development shortcuts. Production startup is not allowed to silently fall back to PGlite.

Preview deployments must use a separate test database and test payment/messaging setup. A preview must not share production customer records, session secrets or live payment keys. `NEXT_PUBLIC_` changes require a rebuild.

Generate secrets locally:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

References: [Vercel monorepos](https://vercel.com/docs/monorepos), [cron authorization](https://vercel.com/docs/cron-jobs/manage-cron-jobs).

## Validation and launch sequence

```powershell
npm run check
# With the intended production configuration loaded, no values are printed:
npm run deploy:check
# Optional read-only check against the selected migrated database:
npm run deploy:check -- --database
```

`GET /api/health` returns 200 only when database access and the new migration column work; failures return a generic 503. Check the endpoint on the actual deployed preview before promotion. It does not expose credentials or customer data.

`apps/web/vercel.json` schedules `/api/cron/reconcile` every ten minutes. Use a Vercel plan supporting that interval. Vercel sends the `CRON_SECRET` bearer authorization automatically. When Vercel scheduling is active, set the GitHub repository variable `RECONCILE_SCHEDULER=vercel` to disable its scheduled runner while preserving manual fallback. Until then the existing GitHub scheduler continues to serve the current host. Verify at least one authorized cron run and reject unauthorized requests before launch.

Before production, exercise a real provider test payment, duplicate webhook, failed payment/retry, pending refund, failed refund/retry and successful refund. Check a second outlet's POS pricing, receipt address and inventory independently. These provider and hosted-project checks cannot be completed until the deployment target and credentials are selected.

## Financial behavior and recovery

- Points are debited/reserved in the checkout transaction, so a second unpaid order cannot spend them. Earning is committed with capture. Expiry restores the reservation exactly once. A failed payment attempt retains the reservation because it can still be retried until the order expires.
- Coupons are allocated under a database row lock. Pending allocations count toward limits until expiry/rejection/refund release. First-order coupon reservations also block another first-order offer for the same phone.
- A discounted order captured after its reservation was released is rejected and a refund is requested. It never reuses points/coupon capacity or enters the kitchen. Cron repairs a missing refund request after a process crash.
- Refund intent is saved before contacting Razorpay. Orders remain paid while the refund is pending; only confirmed processed refunds change financial state and reverse rewards. Explicit failed refunds can be retried.
- A timeout/unknown refund blocks resubmission. Cron searches provider refunds by the intent ID in notes/receipt. If no matching provider refund ever exists, verify that fact in Razorpay and investigate the intent before marking the attempt failed for a retry. **Do not clear an unknown intent simply to retry a network request.** This favors avoiding double refunds over guessing that an ambiguous request failed.
- A webhook received before the initiating response is persisted is retryable; provider intent notes allow correlation. Processed refunds cannot be regressed by later pending/failed events.

The admin order page shows refund attempt status. Check `unknown`/`submitting` attempts and cron/server errors during operations. Provider notifications use the existing after-response mechanism; financial state does not depend on notification delivery.

## Role boundaries

Owner/manager permissions are outlet-local. An owner may edit only outlets where they have an owner membership. CRM data is limited to customers with an order/subscription at that outlet; customer identity and loyalty balance remain shared across outlets. Changing a shared staff user's password or global activation requires owning **all** of that user's outlets. Deactivation checks that every affected outlet retains an active owner.

## Backup and rollback

Before migrating an existing production database, take a Supabase backup or verified logical export and record the current Vercel deployment. Apply migrations once, verify the schema, then deploy the application. New fields are additive; no order/payment history is deleted. RLS intentionally revokes public Data API access, so any separate consumer that relied on direct table access must be moved behind the server first.

If the application release fails, restore the previous Vercel deployment. Keep the additive columns. **After accepting orders with the new reward reservations, do not restore the old checkout implementation without pausing online ordering and reconciling outstanding reservations**: old code does not understand release markers. Prefer a forward fix. Restore a database backup only through a coordinated recovery that also reconciles payment-provider transactions since the backup; restoring SQL alone can lose payment/refund history.

No automatic migration rollback or destructive reset is bundled.
