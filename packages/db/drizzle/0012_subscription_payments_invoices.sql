CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"outlet_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"number" text NOT NULL,
	"public_token" text NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"customer_name" text NOT NULL,
	"customer_phone" text,
	"customer_email" text,
	"billing_address" text,
	"subscription_id" uuid,
	"subscription_payment_id" uuid,
	"order_id" uuid,
	"against_number" text,
	"refund_ref" text,
	"lines" jsonb NOT NULL,
	"taxable_paise" integer NOT NULL,
	"tax_paise" integer NOT NULL,
	"total_paise" integer NOT NULL,
	"tax_snapshot" jsonb NOT NULL,
	"issuer" jsonb NOT NULL,
	"payment_method" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_number_unique" UNIQUE("number"),
	CONSTRAINT "invoices_public_token_unique" UNIQUE("public_token"),
	CONSTRAINT "invoices_refund_ref_unique" UNIQUE("refund_ref")
);
--> statement-breakpoint
ALTER TABLE "invoices" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "subscription_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subscription_id" uuid NOT NULL,
	"outlet_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"provider" text DEFAULT 'razorpay' NOT NULL,
	"razorpay_order_id" text,
	"razorpay_payment_id" text,
	"amount_paise" integer NOT NULL,
	"status" "payment_status" DEFAULT 'created' NOT NULL,
	"method" text,
	"note" text,
	"error_code" text,
	"error_description" text,
	"fee_paise" integer,
	"fee_tax_paise" integer,
	"refunded_paise" integer DEFAULT 0 NOT NULL,
	"cycle_meals" integer NOT NULL,
	"cycle_days" integer NOT NULL,
	"tax_snapshot" jsonb NOT NULL,
	"paid_at" timestamp with time zone,
	"staff_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscription_payments_razorpay_order_id_unique" UNIQUE("razorpay_order_id"),
	CONSTRAINT "subscription_payments_razorpay_payment_id_unique" UNIQUE("razorpay_payment_id")
);
--> statement-breakpoint
ALTER TABLE "subscription_payments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_subscription_payment_id_subscription_payments_id_fk" FOREIGN KEY ("subscription_payment_id") REFERENCES "public"."subscription_payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payments_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payments_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payments_staff_id_staff_users_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invoices_outlet_issued" ON "invoices" USING btree ("outlet_id","issued_at");--> statement-breakpoint
CREATE INDEX "invoices_subscription" ON "invoices" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX "subscription_payments_sub" ON "subscription_payments" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX "subscription_payments_status" ON "subscription_payments" USING btree ("status","created_at");