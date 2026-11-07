ALTER TABLE "addon_groups" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "addons" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "area_requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "audit_log" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "categories" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "consent_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "coupon_redemptions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "coupons" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "customers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "enquiries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ingredients" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "invoice_counters" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "loyalty_ledger" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "menu_images" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "menu_item_addon_groups" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "menu_item_variants" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "menu_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "message_log" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "order_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "order_item_addons" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "order_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "otp_challenges" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "outlet_menu_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "outlets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "rate_limits" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "recipe_lines" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "refunds" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "staff_roles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "staff_users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "stock_movements" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "store_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "subscription_deliveries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "subscription_plans" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "subscriptions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "suppliers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "webhook_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "loyalty_points_earned" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "rewards_released_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "last_reconciled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "issuer_snapshot" jsonb;
--> statement-breakpoint
-- This application uses server-side SQL and its own sessions, never the public Data API.
-- RLS has no browser policies. Revoke legacy grants too, without touching Supabase-owned tables.
DO $$
DECLARE
  table_name text;
  api_role text;
BEGIN
  FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
      FOREACH table_name IN ARRAY ARRAY[
        'outlets',
        'store_settings',
        'categories',
        'menu_items',
        'menu_item_variants',
        'outlet_menu_items',
        'addon_groups',
        'addons',
        'menu_item_addon_groups',
        'customers',
        'orders',
        'order_items',
        'order_item_addons',
        'order_events',
        'payments',
        'refunds',
        'webhook_events',
        'staff_users',
        'staff_roles',
        'audit_log',
        'rate_limits',
        'invoice_counters',
        'otp_challenges',
        'consent_events',
        'message_log',
        'menu_images',
        'suppliers',
        'ingredients',
        'recipe_lines',
        'stock_movements',
        'area_requests',
        'enquiries',
        'subscription_plans',
        'subscriptions',
        'subscription_deliveries',
        'coupons',
        'coupon_redemptions',
        'loyalty_ledger'
      ] LOOP
        EXECUTE format('REVOKE ALL ON TABLE public.%I FROM %I', table_name, api_role);
      END LOOP;
      EXECUTE format('REVOKE ALL ON SEQUENCE public.order_number_seq FROM %I', api_role);
    END IF;
  END LOOP;
END $$;

--> statement-breakpoint
-- Legacy unpaid discounted quotes predate transactional reservations. Retire them so they
-- cannot overspend a balance that a newly reserved checkout also sees as available.
WITH retired AS (
  UPDATE orders SET status = 'expired', rewards_released_at = now()
  WHERE payment_state = 'unpaid' AND discount_paise > 0
    AND status IN ('pending_payment', 'payment_failed', 'expired')
  RETURNING id
)
INSERT INTO order_events (order_id, from_status, to_status, actor_type, note)
SELECT id, NULL, 'expired', 'system', 'Discount quote retired during reservation upgrade; place a new order. Late payment will be refunded.' FROM retired;
