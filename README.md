# Seiketsu platform

Ordering and operations platform for Seiketsu, Versova (Mumbai).
**Phase 1** (this release): customer website and menu, cart, checkout, Razorpay payments,
live order tracking, and a basic admin for orders, menu availability and store settings.

## What is in the repo

```
apps/web          Next.js 16 app: customer site (/), admin (/admin), API (/api)
packages/core     Pure business logic: pricing, GST, order statuses, menu parser,
                  opening hours, Razorpay signatures, password hashing (all unit-tested)
packages/db       Database schema (Drizzle), migrations, menu import, owner-account script
packages/db/data  seiketsu_menu.json, copied unchanged from the asset folder
```

Stack: Next.js + TypeScript, Postgres (Supabase in production, embedded PGlite locally),
Drizzle ORM, Razorpay, Supabase Realtime (optional), Tailwind CSS. Hosting: Vercel.

## Run it locally (no accounts needed)

Requires Node 22+.

```bash
npm install
cp .env.example .env          # then set SESSION_SECRET (see the comment in the file)
npm run db:seed -- --open-all-day      # creates tables, imports the menu, opens hours for testing
OWNER_PASSWORD="choose-a-long-password" npm run create-owner -w @seiketsu/db -- you@example.com "Your Name"
npm run dev                   # http://localhost:3000   admin: http://localhost:3000/admin
```

On Windows PowerShell set the password first: `$env:OWNER_PASSWORD="..."`.

With `PAYMENTS_MODE=simulator` and no Razorpay keys, checkout opens a **payment simulator**
(pay, fail or close). It goes through the same verification code as Razorpay and is
switched off automatically in production.

`--open-all-day` is for local testing only. Real hours are set in **Admin → Settings**;
until hours are set, online ordering stays closed.

## Tests

```bash
npm test                        # 54 tests: unit + integration against an in-memory Postgres
npx tsc --noEmit -p apps/web    # type check
npm run lint -w web
npm run build                   # production build
```

The integration tests cover: database pricing with variants and extras, refusing sold-out,
hidden or closed-store orders, one payment confirmed only once (verify + webhook + duplicate
webhook), webhook signature rejection, amount mismatch, failed-then-retried payment,
expiry and late payment, kitchen status order, rejection with reason and refund.

## Deploy (Vercel + Supabase)

1. **Supabase**: create a project in the **Mumbai (ap-south-1)** region.
   - Project Settings → Database → Connection pooling: copy the **transaction pooler** URL (port 6543). This is `DATABASE_URL`.
   - Project Settings → API: copy the project URL, `anon` key and `service_role` key.
   - Realtime: allow public broadcast channels (the app sends only "status changed" signals, never customer data).
2. Apply the database and import the menu from your computer, with `DATABASE_URL` set to the Supabase URL:
   ```bash
   npm run db:seed                 # migrations + menu import (safe to re-run)
   OWNER_PASSWORD="..." npm run create-owner -w @seiketsu/db -- owner@email "Owner"
   ```
3. **Vercel**: import the Git repository, set **Root Directory = `apps/web`**, and add every
   variable from `.env.example` (leave `PAYMENTS_MODE` unset). Vercel Pro is needed for a
   commercial site and for the 10-minute reconciliation cron in `apps/web/vercel.json`.
4. **Razorpay (Test Mode first)**:
   - Dashboard → API Keys → generate **test** keys → `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`.
   - Dashboard → Webhooks → add `https://<your-domain>/api/webhooks/razorpay`, choose a secret
     (`RAZORPAY_WEBHOOK_SECRET`), events: `payment.captured`, `payment.failed`, `order.paid`,
     `refund.processed`, `refund.failed`.
   - Test with Razorpay test cards/UPI (`success@razorpay`, `failure@razorpay`).
5. **Go live** only after the owner approves test orders: swap in `rzp_live_` keys and a live
   webhook. Admin → Settings shows clearly whether the site is in Test or LIVE mode.

## How payments stay safe

- Prices are recalculated on the server from the database; the browser never sets an amount.
- A payment counts only after the server verifies Razorpay's signature **and** confirms the
  payment with Razorpay (or the signed webhook arrives).
- Verify, webhook and reconciliation all use one locked, idempotent function, so duplicates
  cannot double-confirm an order. Every webhook event id is stored once.
- A payment for a different amount is never accepted; it is flagged for staff.
- Secrets live only in server environment variables.

## Staff screens (Phases 2 to 4)

| Screen | URL | Who |
|---|---|---|
| Orders (live board, refunds) | `/admin/orders` | owner, manager, cashier, kitchen |
| Kitchen display (tablet) | `/kitchen` | owner, manager, cashier, kitchen |
| Counter POS + 80 mm receipts | `/pos`, `/pos/receipt/<id>` | owner, manager, cashier |
| Menu editor (prices, sizes, nutrition, photos, extras) | `/admin/menu` | edit: owner, manager · sold-out toggles: all |
| Inventory: stock, deliveries, wastage, counts | `/admin/inventory` | owner, manager, inventory |
| Recipes (ingredients per portion, food cost) | `/admin/inventory/recipes` | edit: owner, manager · view: inventory |
| Suppliers, usage & stock history | `/admin/inventory/suppliers`, `/admin/inventory/history` | owner, manager, inventory |
| Reports + CSV export | `/admin/reports` | owner, manager |
| Messages & costs | `/admin/messages` | owner, manager |
| Staff logins and roles | `/admin/staff` | owner |
| My account (change password) | `/admin/account` | everyone |

- Each person signs in with their own email; kitchen staff land on `/kitchen`, cashiers on `/pos`,
  inventory staff on `/admin/inventory`.
- Counter sales are paid on creation (cash / UPI / card at the till), get a bill number and go straight to
  the kitchen. Refunds of counter sales are recorded as handed back by hand; online ones go back via Razorpay.
- Dish photos are resized in the browser and stored in Postgres (`menu_images`), served from `/api/images/<id>`.
- Sizes removed in the editor are switched off, not deleted, so old orders and bills still show them.
- Netlify shows a badge at the bottom-right on free sites; pinned buttons use `.clear-badge` to stay tappable.

### Inventory (Phase 4)

- Ingredients are measured by weight (g), volume (ml) or count (pieces). Quantities are stored as
  thousandths of that unit and costs as thousandths of a paisa, so the maths stays exact.
- **Recipes come only from the owner.** A dish size or extra with no recipe sells without touching stock;
  nothing is guessed. Recipes > shows how many sizes have one and each portion's ingredient cost.
- When an order is paid (online or at the counter) its ingredients are taken out once
  (`orders.stock_deducted_at`). The cron job retries any that failed. Rejecting an order puts stock back;
  cancelling does not (the food may have been made), so record wastage instead.
- Deliveries with a bill total keep a moving-average cost per ingredient. Shelf counts set stock to what
  is really there, and Usage & history shows the difference ("count difference").
- Stock may go below zero if sales arrive before a delivery is entered. Low and out-of-stock items show
  on the Stock tab and are sent to the owner alert number (at most every 12 hours).

## Customer site: delivery area, menu and cart

- **Delivery or pickup first.** The first time someone taps ADD, a sheet asks "Delivery or pickup?". Delivery
  needs a pincode, checked against **Settings → Delivery pincodes** (an empty list means every pincode).
  The choice is kept in the browser, shown in the header pill and cart, and pre-fills checkout. The server
  still checks the pincode when the order is placed.
- **Not in the area yet**: `/coming-soon?pin=…` apologises and collects name, mobile, area, pincode and an
  optional email (validated, rate-limited per IP, with a hidden bot trap). Staff see them, grouped by pincode,
  in **Admin → Area requests**, can mark each one contacted and download a CSV.
- **Menu**: a section rail with scroll-spy (desktop) or chips plus a floating Menu button (phones), and
  Swiggy-style rows with an ADD button. Dishes with one size and no extras go straight into the cart;
  the rest open the dish sheet.
- **Veg only** shows only dishes and extras *marked* vegetarian. Unmarked ones are never assumed veg, and
  the page says how many are unmarked. Two-way dishes (Paneer / Chicken) show only their veg option.
- **Extras** sit on four shelves (Proteins, Cheese, Veggies & toppings, Sauces & dips), each with a
  pick-up-to limit that the server also enforces, and an icon chosen in **Admin → Menu → Extras**.
- **Adding to the cart** never opens it. A token flies to the cart, the badge bumps and a toast offers
  "View cart". All motion is skipped under reduced motion. The cart lists every extra with its price,
  lets each line be edited, and shows progress to free delivery and the minimum order.
- **Home page**: built from the brand brief ("Premium nutrition fresh house"). The pictures are the
  supplied brand art, café photos (no people) and hand-drawn SVG illustrations in
  `components/site/home/doodles.tsx`. Swap in real dish photography when it exists. `public/landing/`
  holds the resized café photos and posters.
- **Hero video**: `public/landing/hero.mp4` is the brand reel from Instagram (@sei_ketsu), re-encoded to
  720×900 H.264 with no sound; `hero-poster.webp` is its first frame. It loops muted, has a pause button,
  and stays paused for visitors who prefer reduced motion. To change it, replace both files (4:5, under ~2 MB).

## Customer login, messaging and bills

- **Login**: `/account`. Phone number + 6-digit code sent on WhatsApp (SMS fallback or "Send by SMS instead").
  Codes expire in 10 minutes, 5 tries each; limits per phone, per IP and a site-wide daily cap
  (`OTP_DAILY_CAP`) stop OTP-pumping fraud. Guest checkout still works.
- **Consent**: separate, unticked "WhatsApp offers" / "Email offers" boxes at checkout and on `/account`.
  Every opt-in/out is stored in `consent_events`. Order updates do not need consent.
- **Order updates**: confirmed (with bill link), ready for pickup, out for delivery, cancelled, refunded.
  Toggle each in **Admin › Messages**. WhatsApp first; SMS if WhatsApp is not set up or fails.
- **Bills**: every paid order gets a number `SK/<financial year>/<00001>` and a printable bill at
  `/bill/<token>` (Print / Save as PDF). It becomes a GST "Tax invoice" only when GST and a GSTIN are set
  in Settings; CGST/SGST are split equally (intra-state sale) — confirm with the accountant.
- **Cost monitoring**: Admin › Messages shows spend today/month, cost per order, delivery rate, failures,
  per-channel counts, Razorpay fees (from each payment's `fee`/`tax`) and the message log.
  Daily/monthly budgets: alert at 80%, order updates pause at 100% (login codes and alerts still send).
  The cron job also alerts on >20% failures in an hour and on OTP spikes.

### Messaging setup (MSG91)
1. MSG91 account → complete **DLT** registration (entity, sender ID) for SMS.
2. Connect a WhatsApp Business number in MSG91 (Meta business verification).
3. Create templates for each message in Admin › Messages, with variables in this order:
   - `otp` (Authentication): code
   - `order_placed`: name, order no., total, link
   - `order_ready` / `order_out_for_delivery` / `order_completed`: name, order no.
   - `order_cancelled`: name, order no., reason · `order_refunded`: name, order no., amount
   - `staff_alert`: message
4. Put the key, number and template names/IDs in the environment (`.env.example` lists them).
5. Set the delivery-report webhook in MSG91 to `https://<site>/api/webhooks/msg91?token=<MSG91_WEBHOOK_TOKEN>`.
6. Enter your real per-message rates and budgets in Admin › Messages.

## Known limitations

- WhatsApp/SMS sending is built against MSG91's documented APIs but has not yet been tried with a real
  MSG91 account. Send one test of each template before going live (see "Messaging" below).
- Message costs are estimates from the rates in Admin › Messages, not MSG91's actual bill.
- Refunds are full refunds only.
- Recipes belong to dish sizes, which are shared by all outlets; with a second outlet, ingredients are
  per outlet but a dish's recipe would need to list each outlet's ingredients.
- Stock is not reserved while an order waits for online payment; it comes out when payment is captured.
- Dish photos must be uploaded in the menu editor; the supplied food images are illustrations.

## Data that needs the owner's confirmation

The printed menu (Nov 2026) named the two unnamed salads (Spicy Tofu Protein Salad Bowl, Fresh Zucchini
Noodles Salad Bowl) and added their Small prices. Migration `0005_menu_from_print` applies this and the
other printed-menu changes to an existing database.

Shown in **Admin → Menu → Hidden until corrected**:
- Healthy Quinoa Salad Bowl: now Veg (450g) ₹380 / Chicken (450g) ₹460. Its nutrition was given for
  Small/Large, so it needs nutrition for each option before it shows again.
- Pomegranate Juice (300ml) ₹240: new on the printed menu, with no description or nutrition yet.

Also to confirm:
- Watermelon Mint Refresher has the same description as Celery – Green Apple – Carrot.
- Spelling in the source: "Honey Musterd Dip", "Ceamy Mozzarella".
- The printed menu gives the phone as 95847 58479; the site uses +91 79776 97408 (WhatsApp 917977697408).
- Which extras go with which dishes (currently: all salads, wraps, meals, sandwiches and pasta).
- Veg/non-veg marks are shown only where the menu states them (Paneer/Veg/Egg/Chicken). About 20 dishes
  (most salads, pasta, juices, smoothies) are unmarked, so **Veg only** hides them until marked in the editor.
- GST registration, rate and whether prices include it (GST is off until set).
- Opening hours, delivery area, delivery fee and minimum order (delivery is off until set).
- Policy pages (`/terms`, `/privacy`, `/refunds`, `/delivery`, `/contact`) are drafts: review the wording,
  and fill in the legal business name and support email in `apps/web/src/lib/legal.ts`.
  Razorpay checks these pages before enabling live payments.