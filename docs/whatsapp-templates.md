# Seiketsu on WhatsApp

## What is free and what costs money

| Message | When | Cost |
|---|---|---|
| Customer messages us | Any time | Free |
| Our reply, inside 24 hours of the customer's last message | Auto-replies, login confirmation, order updates | Free |
| A template we start, outside that window | Order updates to someone who never messaged us, offers | Paid per message |
| Customer arrives from a Click-to-WhatsApp ad, or the Facebook/Instagram "Send message" button, and messages us | 72 hours from their message | Free |

The site is set to **free only** (`WHATSAPP_PAID_TEMPLATES` unset). It replies only inside the window and skips everything else, so WhatsApp cannot cost money. The order page still shows live status for everyone.

### How customers open the free window

- **Order page:** a "Get live updates on WhatsApp" button sends `Track SK-1006`. Every update after that is free.
- **Login:** "Verify on WhatsApp" opens the window too.
- **Counter:** print the QR from WhatsApp Manager → Phone numbers → Message links, with "Scan for order updates".
- **Ads:** use **Click-to-WhatsApp** as the ad destination. The customer's first message opens a free 72-hour window, and the welcome reply goes out automatically.

You cannot keep a window open without the customer: it only restarts when they message again.

## Automatic replies (free, built into the site)

| Customer sends | Reply |
|---|---|
| Anything (hi, hello, a question) | Welcome: menu link, how to track, map (at most once every 6 hours per person) |
| `Track SK-1006` or just `SK1006` | The order's live status and link (only for the phone that placed it) |
| `Seiketsu login SK-XXXXXX` | "You're verified, go back to the page" |

Order updates (confirmed, ready, out for delivery, completed, cancelled, refunded) go out as free replies when the window is open.

## Templates for later (paid)

Create these only if you decide to message customers who have not written to you. WhatsApp Manager → Message templates → Create template. Language: **English** (`en`, matching `WHATSAPP_TEMPLATE_LANG`). Then set `WHATSAPP_PAID_TEMPLATES=on` in Vercel.

Names must match exactly and variables must stay in this order.

### `seiketsu_order_placed` (Utility)
Header (text): `Order confirmed ✅`
```
Hi {{1}}, we've got your order *{{2}}* ({{3}}). The kitchen is on it.

Track it and get your bill: {{4}}
```
Footer: `Seiketsu · The art of clean eating`

### `seiketsu_order_ready` (Utility)
Header: `Your order is ready 🥗`
```
{{1}}, *{{2}}* is packed and waiting for you at Seiketsu Versova. Show this order number at the counter.
```
Footer: `Seiketsu · Versova, Mumbai`

### `seiketsu_order_out_for_delivery` (Utility)
Header: `On its way 🛵`
```
{{1}}, your order *{{2}}* is out for delivery and will be with you soon.
```

### `seiketsu_order_completed` (Utility)
Header: `Enjoy your meal 🌿`
```
Thank you {{1}}! Your order *{{2}}* is complete. We hope it tasted as good as it looks.
```

### `seiketsu_order_cancelled` (Utility)
```
Sorry {{1}}, we had to cancel your order *{{2}}* ({{3}}). If you paid, the full amount is refunded automatically.
```

### `seiketsu_order_refunded` (Utility)
```
{{1}}, we've refunded {{3}} for order *{{2}}*. It usually reaches your account in 5–7 working days.
```

### `seiketsu_staff_alert` (Utility)
```
Seiketsu alert: {{1}}
```

### Marketing (only to customers who opted in; always paid)

Fill in the real offer when you create it. Don't promise a price or discount you haven't set.

`seiketsu_new_on_menu`
Header (image): a studio photo of the dish
```
New at Seiketsu 🌿

*{{1}}* is now on the menu. {{2}}

Order for pickup or delivery in Versova.
```
Buttons: **See the menu** (URL `https://www.seiketsu.co.in/menu`), **Stop updates** (quick reply)

`seiketsu_weekly_plan`
```
Hi {{1}}, planning clean meals for the week? {{2}}

Reply *PLAN* and we'll help you pick.
```
Buttons: **See plans** (URL `https://www.seiketsu.co.in/#plans`), **Stop updates** (quick reply)
