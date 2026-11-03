CREATE TABLE "subscription_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subscription_id" uuid NOT NULL,
	"date" date NOT NULL,
	"status" text NOT NULL,
	"note" text,
	"staff_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"outlet_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"tagline" text,
	"description" text,
	"meals_total" integer NOT NULL,
	"duration_days" integer NOT NULL,
	"delivery_days" text[] DEFAULT '{}'::text[] NOT NULL,
	"includes" text[] DEFAULT '{}'::text[] NOT NULL,
	"price_paise" integer NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"outlet_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"public_token" text NOT NULL,
	"plan_name" text NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"email" text,
	"address" text NOT NULL,
	"pincode" text,
	"start_date" date NOT NULL,
	"end_date" date,
	"paused_on" date,
	"status" text DEFAULT 'pending' NOT NULL,
	"meals_total" integer NOT NULL,
	"meals_used" integer DEFAULT 0 NOT NULL,
	"duration_days" integer NOT NULL,
	"delivery_days" text[] DEFAULT '{}'::text[] NOT NULL,
	"price_paise" integer NOT NULL,
	"paid_at" timestamp with time zone,
	"payment_note" text,
	"notes" text,
	"staff_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_public_token_unique" UNIQUE("public_token")
);
--> statement-breakpoint
ALTER TABLE "subscription_deliveries" ADD CONSTRAINT "subscription_deliveries_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_deliveries" ADD CONSTRAINT "subscription_deliveries_staff_id_staff_users_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_plans" ADD CONSTRAINT "subscription_plans_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_subscription_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."subscription_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "subscription_deliveries_sub_date" ON "subscription_deliveries" USING btree ("subscription_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "subscription_plans_outlet_slug" ON "subscription_plans" USING btree ("outlet_id","slug");--> statement-breakpoint
CREATE INDEX "subscriptions_outlet_status" ON "subscriptions" USING btree ("outlet_id","status");--> statement-breakpoint
CREATE INDEX "subscriptions_phone" ON "subscriptions" USING btree ("phone");