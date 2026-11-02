CREATE TYPE "public"."message_channel" AS ENUM('whatsapp', 'sms', 'email');--> statement-breakpoint
CREATE TYPE "public"."message_status" AS ENUM('queued', 'sent', 'delivered', 'read', 'failed', 'skipped');--> statement-breakpoint
CREATE TABLE "consent_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"customer_id" uuid NOT NULL,
	"channel" "message_channel" NOT NULL,
	"granted" boolean NOT NULL,
	"source" text NOT NULL,
	"ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice_counters" (
	"financial_year" text PRIMARY KEY NOT NULL,
	"last" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"outlet_id" uuid,
	"order_id" uuid,
	"customer_id" uuid,
	"channel" "message_channel" NOT NULL,
	"kind" text NOT NULL,
	"category" text NOT NULL,
	"recipient" text NOT NULL,
	"provider" text NOT NULL,
	"provider_message_id" text,
	"status" "message_status" DEFAULT 'queued' NOT NULL,
	"error" text,
	"cost_milli_paise" integer DEFAULT 0 NOT NULL,
	"vars" jsonb,
	"fallback_of" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "otp_challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" text NOT NULL,
	"code_hash" text NOT NULL,
	"channel" "message_channel" NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "marketing_whatsapp" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "marketing_email" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "session_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "last_login_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "invoice_number" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "fee_paise" integer;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "fee_tax_paise" integer;--> statement-breakpoint
ALTER TABLE "store_settings" ADD COLUMN "messaging" jsonb DEFAULT '{"customerUpdates":{"placed":true,"ready":true,"out_for_delivery":true,"completed":false,"cancelled":true,"refunded":true},"smsFallback":true,"rates":{"sms":29600,"whatsappAuthentication":13600,"whatsappUtility":13600,"whatsappMarketing":86310,"email":0},"dailyBudgetPaise":null,"monthlyBudgetPaise":null,"alertEmail":null,"alertWhatsapp":null}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "consent_events" ADD CONSTRAINT "consent_events_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_log" ADD CONSTRAINT "message_log_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_log" ADD CONSTRAINT "message_log_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_log" ADD CONSTRAINT "message_log_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "consent_customer_idx" ON "consent_events" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "message_log_created_idx" ON "message_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "message_log_provider_idx" ON "message_log" USING btree ("provider_message_id");--> statement-breakpoint
CREATE INDEX "message_log_order_idx" ON "message_log" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "otp_phone_idx" ON "otp_challenges" USING btree ("phone","created_at");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_invoice_number_unique" UNIQUE("invoice_number");