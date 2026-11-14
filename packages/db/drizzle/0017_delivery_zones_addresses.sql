CREATE TABLE "customer_addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"label" text NOT NULL,
	"house" text NOT NULL,
	"building" text,
	"area" text NOT NULL,
	"landmark" text,
	"pincode" text NOT NULL,
	"city" text,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"instructions" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "customer_addresses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "delivery_zones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"outlet_id" uuid NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"radius_m" integer,
	"polygon" jsonb,
	"fee_paise" integer DEFAULT 0 NOT NULL,
	"min_order_paise" integer DEFAULT 0 NOT NULL,
	"eta_minutes" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "delivery_zones" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "outlets" ADD COLUMN "lat" double precision;--> statement-breakpoint
ALTER TABLE "outlets" ADD COLUMN "lng" double precision;--> statement-breakpoint
ALTER TABLE "customer_addresses" ADD CONSTRAINT "customer_addresses_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_zones" ADD CONSTRAINT "delivery_zones_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "customer_addresses_customer" ON "customer_addresses" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "delivery_zones_outlet" ON "delivery_zones" USING btree ("outlet_id","sort");--> statement-breakpoint
ALTER TABLE "delivery_zones" ADD CONSTRAINT "delivery_zones_shape" CHECK (("kind" = 'radius' AND "radius_m" BETWEEN 100 AND 30000) OR ("kind" = 'polygon' AND jsonb_typeof("polygon") = 'array'));--> statement-breakpoint
ALTER TABLE "delivery_zones" ADD CONSTRAINT "delivery_zones_money" CHECK ("fee_paise" >= 0 AND "min_order_paise" >= 0 AND ("eta_minutes" IS NULL OR "eta_minutes" > 0));--> statement-breakpoint
ALTER TABLE "customer_addresses" ADD CONSTRAINT "customer_addresses_point" CHECK ("lat" BETWEEN -90 AND 90 AND "lng" BETWEEN -180 AND 180);--> statement-breakpoint
ALTER TABLE "outlets" ADD CONSTRAINT "outlets_point" CHECK (("lat" IS NULL AND "lng" IS NULL) OR ("lat" BETWEEN -90 AND 90 AND "lng" BETWEEN -180 AND 180));--> statement-breakpoint
-- PostGIS, where installed (Supabase; not the local test database): a geography point on each saved address with a
-- spatial index, and each zone's area for reports. The app decides delivery itself, so it works without these.
DO $$
DECLARE s text;
BEGIN
  SELECT n.nspname INTO s FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace WHERE e.extname = 'postgis';
  IF s IS NULL THEN RETURN; END IF;
  EXECUTE format('ALTER TABLE customer_addresses ADD COLUMN geog %1$I.geography(Point, 4326) GENERATED ALWAYS AS (%1$I.st_setsrid(%1$I.st_makepoint(lng, lat), 4326)::%1$I.geography) STORED', s);
  EXECUTE 'CREATE INDEX customer_addresses_geog ON customer_addresses USING gist (geog)';
  EXECUTE format($v$
    CREATE VIEW delivery_zone_areas WITH (security_invoker = true) AS
    SELECT z.id, z.outlet_id, z.name, z.is_active,
      CASE WHEN z.kind = 'radius'
        THEN %1$I.st_buffer(%1$I.st_setsrid(%1$I.st_makepoint(o.lng, o.lat), 4326)::%1$I.geography, z.radius_m)
        ELSE %1$I.st_geomfromgeojson(json_build_object('type', 'Polygon', 'coordinates', json_build_array(z.polygon))::text)::%1$I.geography
      END AS area
    FROM delivery_zones z JOIN outlets o ON o.id = z.outlet_id
    WHERE o.lat IS NOT NULL AND o.lng IS NOT NULL
  $v$, s);
END $$;
