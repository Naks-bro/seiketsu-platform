/**
 * Seiketsu database schema.
 * - Money is integer paise.
 * - Operational rows carry outlet_id so more outlets can be added later.
 * - Orders and payments are never cascade-deleted.
 */
import { sql } from "drizzle-orm";
import {
  customType,
  bigint,
  date,
  bigserial,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgSequence,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { WeeklyHours } from "@seiketsu/core/store-hours";
import { ORDER_STATUSES } from "@seiketsu/core/order-status";
import { DEFAULT_MESSAGING, type MessagingSettings } from "@seiketsu/core/messaging";

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date());

export const dietEnum = pgEnum("diet", ["veg", "egg", "non_veg"]);
export const orderStatusEnum = pgEnum("order_status", ORDER_STATUSES);
export const fulfilmentEnum = pgEnum("fulfilment", ["pickup", "delivery"]);
export const orderSourceEnum = pgEnum("order_source", ["web", "qr", "pos", "staff"]);
export const paymentStatusEnum = pgEnum("payment_status", ["created", "authorized", "captured", "failed", "refunded"]);
export const orderPaymentStateEnum = pgEnum("order_payment_state", ["unpaid", "paid", "partially_refunded", "refunded"]);
export const staffRoleEnum = pgEnum("staff_role", ["owner", "manager", "cashier", "kitchen", "inventory"]);
export const actorTypeEnum = pgEnum("actor_type", ["system", "staff", "customer"]);
export const messageChannelEnum = pgEnum("message_channel", ["whatsapp", "sms", "email"]);
export const messageStatusEnum = pgEnum("message_status", ["queued", "sent", "delivered", "read", "failed", "skipped"]);
export const stockUnitEnum = pgEnum("stock_unit", ["g", "ml", "pc"]);
export const stockMoveKindEnum = pgEnum("stock_move_kind", ["purchase", "sale", "wastage", "count", "adjustment", "return"]);

export const orderNumberSeq = pgSequence("order_number_seq", { startWith: 1001 });

// ── Outlets & settings ─────────────────────────────────────────────

export const outlets = pgTable("outlets", {
  id: id(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  addressLines: text("address_lines").array().notNull(),
  phone: text("phone"),
  whatsapp: text("whatsapp"),
  instagram: text("instagram"),
  mapUrl: text("map_url"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: createdAt(),
}).enableRLS();

export const storeSettings = pgTable("store_settings", {
  outletId: uuid("outlet_id").primaryKey().references(() => outlets.id),
  /** null until the owner sets hours; online ordering stays closed until then */
  hours: jsonb("hours").$type<WeeklyHours | null>(),
  temporarilyClosed: boolean("temporarily_closed").notNull().default(false),
  closureMessage: text("closure_message"),
  pickupEnabled: boolean("pickup_enabled").notNull().default(true),
  deliveryEnabled: boolean("delivery_enabled").notNull().default(false),
  deliveryPincodes: text("delivery_pincodes").array().notNull().default(sql`'{}'::text[]`),
  /** Loyalty points: all off until the owner sets them. */
  loyaltyEnabled: boolean("loyalty_enabled").notNull().default(false),
  loyaltyEarnPer100: integer("loyalty_earn_per_100").notNull().default(0),
  loyaltyPointValuePaise: integer("loyalty_point_value_paise").notNull().default(0),
  loyaltyMinRedeem: integer("loyalty_min_redeem").notNull().default(0),
  loyaltyMaxRedeemPercent: integer("loyalty_max_redeem_percent").notNull().default(0),
  deliveryFeePaise: integer("delivery_fee_paise").notNull().default(0),
  freeDeliveryAbovePaise: integer("free_delivery_above_paise"),
  minOrderPaise: integer("min_order_paise").notNull().default(0),
  taxEnabled: boolean("tax_enabled").notNull().default(false),
  taxRateBps: integer("tax_rate_bps").notNull().default(0),
  taxInclusive: boolean("tax_inclusive").notNull().default(true),
  gstin: text("gstin"),
  prepTimeMinutes: integer("prep_time_minutes").notNull().default(20),
  paymentExpiryMinutes: integer("payment_expiry_minutes").notNull().default(30),
  announcement: text("announcement"),
  /** WhatsApp/SMS/email switches, estimated rates and spend budgets */
  messaging: jsonb("messaging").$type<MessagingSettings>().notNull().default(DEFAULT_MESSAGING),
  updatedAt: updatedAt(),
}).enableRLS();

// ── Menu ───────────────────────────────────────────────────────────

export const categories = pgTable("categories", {
  id: id(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  sort: integer("sort").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
}).enableRLS();

export const menuItems = pgTable(
  "menu_items",
  {
    id: id(),
    categoryId: uuid("category_id").notNull().references(() => categories.id),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    description: text("description"),
    /** set only when stated by the source or confirmed by the owner */
    diet: dietEnum("diet"),
    imageUrl: text("image_url"),
    isFeatured: boolean("is_featured").notNull().default(false),
    isBestseller: boolean("is_bestseller").notNull().default(false),
    needsReview: boolean("needs_review").notNull().default(false),
    reviewNotes: text("review_notes"),
    sort: integer("sort").notNull().default(0),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("menu_items_category_idx").on(t.categoryId)],
).enableRLS();

export const menuItemVariants = pgTable(
  "menu_item_variants",
  {
    id: id(),
    menuItemId: uuid("menu_item_id").notNull().references(() => menuItems.id),
    label: text("label"),
    portionAmount: integer("portion_amount"),
    portionUnit: text("portion_unit"),
    pricePaise: integer("price_paise").notNull(),
    diet: dietEnum("diet"),
    kcal: integer("kcal"),
    proteinG: integer("protein_g"),
    carbsG: integer("carbs_g"),
    fatG: integer("fat_g"),
    fibreG: integer("fibre_g"),
    sort: integer("sort").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
  },
  (t) => [index("variants_item_idx").on(t.menuItemId)],
).enableRLS();

/** Per-outlet availability; a missing row means unavailable at that outlet. */
export const outletMenuItems = pgTable(
  "outlet_menu_items",
  {
    outletId: uuid("outlet_id").notNull().references(() => outlets.id),
    menuItemId: uuid("menu_item_id").notNull().references(() => menuItems.id),
    isAvailable: boolean("is_available").notNull().default(true),
  },
  (t) => [primaryKey({ columns: [t.outletId, t.menuItemId] })],
).enableRLS();

export const addonGroups = pgTable("addon_groups", {
  id: id(),
  name: text("name").notNull(),
  minSelect: integer("min_select").notNull().default(0),
  maxSelect: integer("max_select").notNull().default(10),
  sort: integer("sort").notNull().default(0),
  /** One of the owner's "Extras" shelves (Proteins, Cheese, ...); the admin toggles them together. */
  isExtra: boolean("is_extra").notNull().default(false),
}).enableRLS();

export const addons = pgTable("addons", {
  id: id(),
  groupId: uuid("group_id").notNull().references(() => addonGroups.id),
  name: text("name").notNull(),
  pricePaise: integer("price_paise").notNull(),
  diet: dietEnum("diet"),
  /** Key into the customer site's icon set (see @seiketsu/core/extras). */
  icon: text("icon"),
  isAvailable: boolean("is_available").notNull().default(true),
  sort: integer("sort").notNull().default(0),
}).enableRLS();

export const menuItemAddonGroups = pgTable(
  "menu_item_addon_groups",
  {
    menuItemId: uuid("menu_item_id").notNull().references(() => menuItems.id),
    groupId: uuid("group_id").notNull().references(() => addonGroups.id),
  },
  (t) => [primaryKey({ columns: [t.menuItemId, t.groupId] })],
).enableRLS();

// ── Customers & orders ─────────────────────────────────────────────

export const customers = pgTable("customers", {
  id: id(),
  phone: text("phone").notNull().unique(),
  name: text("name").notNull(),
  email: text("email"),
  /** Staff-only CRM notes and tags. */
  notes: text("notes"),
  tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
  /** @deprecated replaced by the per-channel flags below */
  marketingConsent: boolean("marketing_consent").notNull().default(false),
  marketingWhatsapp: boolean("marketing_whatsapp").notNull().default(false),
  marketingEmail: boolean("marketing_email").notNull().default(false),
  /** bump to sign the customer out everywhere */
  sessionVersion: integer("session_version").notNull().default(1),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}).enableRLS();

export type OrderAddress = { line1: string; landmark?: string; pincode: string; instructions?: string };
export type TaxSnapshot = { enabled: boolean; rateBps: number; inclusive: boolean; gstin: string | null };

export const orders = pgTable(
  "orders",
  {
    id: id(),
    outletId: uuid("outlet_id").notNull().references(() => outlets.id),
    orderNumber: text("order_number")
      .notNull()
      .unique()
      .default(sql`'SK-' || nextval('order_number_seq')`),
    /** random secret used in the customer tracking link */
    publicToken: text("public_token").notNull().unique(),
    customerId: uuid("customer_id").references(() => customers.id),
    customerName: text("customer_name").notNull(),
    customerPhone: text("customer_phone").notNull(),
    customerEmail: text("customer_email"),
    source: orderSourceEnum("source").notNull(),
    fulfilment: fulfilmentEnum("fulfilment").notNull(),
    status: orderStatusEnum("status").notNull().default("pending_payment"),
    paymentState: orderPaymentStateEnum("payment_state").notNull().default("unpaid"),
    address: jsonb("address").$type<OrderAddress | null>(),
    notes: text("notes"),
    /** counter orders: table number or token shown on the kitchen ticket */
    tableLabel: text("table_label"),
    subtotalPaise: integer("subtotal_paise").notNull(),
    discountPaise: integer("discount_paise").notNull().default(0),
    couponCode: text("coupon_code"),
    loyaltyPointsUsed: integer("loyalty_points_used").notNull().default(0),
    loyaltyPointsEarned: integer("loyalty_points_earned"),
    rewardsReleasedAt: timestamp("rewards_released_at", { withTimezone: true }),
    lastReconciledAt: timestamp("last_reconciled_at", { withTimezone: true }),
    issuerSnapshot: jsonb("issuer_snapshot").$type<{ name: string; addressLines: string[]; phone: string | null; instagram: string | null }>(),
    deliveryFeePaise: integer("delivery_fee_paise").notNull().default(0),
    taxPaise: integer("tax_paise").notNull().default(0),
    totalPaise: integer("total_paise").notNull(),
    taxSnapshot: jsonb("tax_snapshot").$type<TaxSnapshot>().notNull(),
    statusReason: text("status_reason"),
    /** sequential per financial year, assigned when payment is captured */
    invoiceNumber: text("invoice_number").unique(),
    /** set once the order's ingredients have been taken out of stock */
    stockDeductedAt: timestamp("stock_deducted_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    placedAt: timestamp("placed_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("orders_outlet_status_idx").on(t.outletId, t.status),
    index("orders_created_idx").on(t.createdAt),
    index("orders_phone_idx").on(t.customerPhone),
  ],
).enableRLS();

export const orderItems = pgTable(
  "order_items",
  {
    id: id(),
    orderId: uuid("order_id").notNull().references(() => orders.id),
    menuItemId: uuid("menu_item_id").references(() => menuItems.id),
    variantId: uuid("variant_id").references(() => menuItemVariants.id),
    // Snapshot at time of sale
    itemName: text("item_name").notNull(),
    variantLabel: text("variant_label"),
    diet: dietEnum("diet"),
    unitPricePaise: integer("unit_price_paise").notNull(),
    quantity: integer("quantity").notNull(),
    lineTotalPaise: integer("line_total_paise").notNull(),
    note: text("note"),
  },
  (t) => [index("order_items_order_idx").on(t.orderId)],
).enableRLS();

export const orderItemAddons = pgTable(
  "order_item_addons",
  {
    id: id(),
    orderItemId: uuid("order_item_id").notNull().references(() => orderItems.id),
    addonId: uuid("addon_id").references(() => addons.id),
    name: text("name").notNull(),
    pricePaise: integer("price_paise").notNull(),
  },
  (t) => [index("order_item_addons_item_idx").on(t.orderItemId)],
).enableRLS();

export const orderEvents = pgTable(
  "order_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    orderId: uuid("order_id").notNull().references(() => orders.id),
    fromStatus: orderStatusEnum("from_status"),
    toStatus: orderStatusEnum("to_status").notNull(),
    actorType: actorTypeEnum("actor_type").notNull(),
    actorId: uuid("actor_id"),
    note: text("note"),
    createdAt: createdAt(),
  },
  (t) => [index("order_events_order_idx").on(t.orderId)],
).enableRLS();

// ── Payments ───────────────────────────────────────────────────────

export const payments = pgTable(
  "payments",
  {
    id: id(),
    orderId: uuid("order_id").notNull().references(() => orders.id),
    provider: text("provider").notNull().default("razorpay"),
    razorpayOrderId: text("razorpay_order_id").unique(),
    razorpayPaymentId: text("razorpay_payment_id").unique(),
    amountPaise: integer("amount_paise").notNull(),
    status: paymentStatusEnum("status").notNull().default("created"),
    method: text("method"),
    errorCode: text("error_code"),
    errorDescription: text("error_description"),
    refundedPaise: integer("refunded_paise").notNull().default(0),
    /** Razorpay's fee and the GST on that fee, as reported on the payment */
    feePaise: integer("fee_paise"),
    feeTaxPaise: integer("fee_tax_paise"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("payments_order_idx").on(t.orderId)],
).enableRLS();

export const refunds = pgTable("refunds", {
  id: id(),
  paymentId: uuid("payment_id").notNull().references(() => payments.id),
  razorpayRefundId: text("razorpay_refund_id").unique(),
  amountPaise: integer("amount_paise").notNull(),
  status: text("status").notNull(),
  reason: text("reason"),
  createdBy: uuid("created_by"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}).enableRLS();

/** One row per Razorpay webhook delivery; the primary key makes repeats a no-op. */
export const webhookEvents = pgTable("webhook_events", {
  id: text("id").primaryKey(),
  event: text("event").notNull(),
  payload: jsonb("payload").notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  error: text("error"),
}).enableRLS();

// ── Staff, audit, rate limits ──────────────────────────────────────

export const staffUsers = pgTable("staff_users", {
  id: id(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  /** bump to sign out every session for this user */
  sessionVersion: integer("session_version").notNull().default(1),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: createdAt(),
}).enableRLS();

export const staffRoles = pgTable(
  "staff_roles",
  {
    staffUserId: uuid("staff_user_id").notNull().references(() => staffUsers.id),
    outletId: uuid("outlet_id").notNull().references(() => outlets.id),
    role: staffRoleEnum("role").notNull(),
  },
  (t) => [primaryKey({ columns: [t.staffUserId, t.outletId] })],
).enableRLS();

export const auditLog = pgTable(
  "audit_log",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    actorId: uuid("actor_id"),
    outletId: uuid("outlet_id"),
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: text("entity_id"),
    data: jsonb("data"),
    createdAt: createdAt(),
  },
  (t) => [index("audit_entity_idx").on(t.entity, t.entityId)],
).enableRLS();

/** Fixed-window counters shared by every server instance. */
export const rateLimits = pgTable(
  "rate_limits",
  {
    key: text("key").notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => [uniqueIndex("rate_limits_key_window").on(t.key, t.windowStart)],
).enableRLS();

/** Last invoice number used in each financial year (e.g. "2026-27"). */
export const invoiceCounters = pgTable("invoice_counters", {
  financialYear: text("financial_year").primaryKey(),
  last: integer("last").notNull().default(0),
}).enableRLS();

// ── Customer login, consent & messaging ────────────────────────────

export const otpChallenges = pgTable(
  "otp_challenges",
  {
    id: id(),
    phone: text("phone").notNull(),
    codeHash: text("code_hash").notNull(),
    channel: messageChannelEnum("channel").notNull(),
    attempts: integer("attempts").notNull().default(0),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    ip: text("ip"),
    createdAt: createdAt(),
  },
  (t) => [index("otp_phone_idx").on(t.phone, t.createdAt)],
).enableRLS();

/** Append-only record of every marketing opt-in and opt-out. */
export const consentEvents = pgTable(
  "consent_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    customerId: uuid("customer_id").notNull().references(() => customers.id),
    channel: messageChannelEnum("channel").notNull(),
    granted: boolean("granted").notNull(),
    source: text("source").notNull(),
    ip: text("ip"),
    createdAt: createdAt(),
  },
  (t) => [index("consent_customer_idx").on(t.customerId)],
).enableRLS();

/** Every message sent (or skipped), with its estimated cost. */
export const messageLog = pgTable(
  "message_log",
  {
    id: id(),
    outletId: uuid("outlet_id").references(() => outlets.id),
    orderId: uuid("order_id").references(() => orders.id),
    customerId: uuid("customer_id").references(() => customers.id),
    channel: messageChannelEnum("channel").notNull(),
    kind: text("kind").notNull(),
    category: text("category").notNull(),
    recipient: text("recipient").notNull(),
    provider: text("provider").notNull(),
    providerMessageId: text("provider_message_id"),
    status: messageStatusEnum("status").notNull().default("queued"),
    error: text("error"),
    /** estimated cost in 1/1000 paise (₹0.135 = 13500) */
    costMilliPaise: integer("cost_milli_paise").notNull().default(0),
    /** template variables, kept so a failed WhatsApp can be retried by SMS (never stored for OTPs) */
    vars: jsonb("vars").$type<Record<string, string>>(),
    /** set on an SMS sent because a WhatsApp message failed */
    fallbackOf: uuid("fallback_of"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("message_log_created_idx").on(t.createdAt),
    index("message_log_provider_idx").on(t.providerMessageId),
    index("message_log_order_idx").on(t.orderId),
  ],
).enableRLS();
const bytea = customType<{ data: Buffer; driverData: Buffer | Uint8Array }>({
  dataType: () => "bytea",
  fromDriver: (v) => (Buffer.isBuffer(v) ? v : Buffer.from(v)),
});

/** Dish photos, stored in Postgres so they move with the database (small, resized in the browser). */
export const menuImages = pgTable("menu_images", {
  id: id(),
  contentType: text("content_type").notNull(),
  bytes: integer("bytes").notNull(),
  data: bytea("data").notNull(),
  createdBy: uuid("created_by"),
  createdAt: createdAt(),
}).enableRLS();

// ── Inventory ──────────────────────────────────────────────────────
// Quantities are thousandths of the ingredient's unit (1.5 kg = 1_500_000 g-milli);
// costs are thousandths of a paisa per unit. See @seiketsu/core/inventory.

export const suppliers = pgTable("suppliers", {
  id: id(),
  outletId: uuid("outlet_id").notNull().references(() => outlets.id),
  name: text("name").notNull(),
  phone: text("phone"),
  email: text("email"),
  notes: text("notes"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: createdAt(),
}).enableRLS();

export const ingredients = pgTable(
  "ingredients",
  {
    id: id(),
    outletId: uuid("outlet_id").notNull().references(() => outlets.id),
    name: text("name").notNull(),
    unit: stockUnitEnum("unit").notNull(),
    /** on hand now; kept in step with stock_movements in the same transaction. Can go below zero. */
    stockMilli: bigint("stock_milli", { mode: "number" }).notNull().default(0),
    /** warn when stock falls to this level */
    reorderMilli: bigint("reorder_milli", { mode: "number" }),
    /** moving-average cost per unit, from deliveries; null until the first priced delivery */
    costMilliPaise: integer("cost_milli_paise"),
    supplierId: uuid("supplier_id").references(() => suppliers.id),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("ingredients_outlet_name").on(t.outletId, t.name)],
).enableRLS();

/** How much of each ingredient one portion of a dish size (or one extra) uses. */
export const recipeLines = pgTable(
  "recipe_lines",
  {
    id: id(),
    variantId: uuid("variant_id").references(() => menuItemVariants.id),
    addonId: uuid("addon_id").references(() => addons.id),
    ingredientId: uuid("ingredient_id").notNull().references(() => ingredients.id),
    qtyMilli: integer("qty_milli").notNull(),
  },
  (t) => [
    uniqueIndex("recipe_variant_ingredient").on(t.variantId, t.ingredientId),
    uniqueIndex("recipe_addon_ingredient").on(t.addonId, t.ingredientId),
    index("recipe_ingredient_idx").on(t.ingredientId),
  ],
).enableRLS();

/** Append-only stock ledger: every delivery, sale, wastage and count. */
export const stockMovements = pgTable(
  "stock_movements",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    outletId: uuid("outlet_id").notNull().references(() => outlets.id),
    ingredientId: uuid("ingredient_id").notNull().references(() => ingredients.id),
    kind: stockMoveKindEnum("kind").notNull(),
    deltaMilli: bigint("delta_milli", { mode: "number" }).notNull(),
    stockAfterMilli: bigint("stock_after_milli", { mode: "number" }).notNull(),
    /** unit cost at the time, so usage and wastage can be valued later */
    costMilliPaise: integer("cost_milli_paise"),
    /** deliveries: what the bill said */
    totalPaise: integer("total_paise"),
    supplierId: uuid("supplier_id").references(() => suppliers.id),
    orderId: uuid("order_id").references(() => orders.id),
    reference: text("reference"),
    note: text("note"),
    staffId: uuid("staff_id"),
    createdAt: createdAt(),
  },
  (t) => [
    index("stock_moves_ingredient_idx").on(t.ingredientId, t.createdAt),
    index("stock_moves_outlet_idx").on(t.outletId, t.createdAt),
    index("stock_moves_order_idx").on(t.orderId),
  ],
).enableRLS();

// ── Delivery area requests ─────────────────────────────────────────

/** People outside the delivery area asking to be told when we reach them. */
export const areaRequests = pgTable(
  "area_requests",
  {
    id: id(),
    outletId: uuid("outlet_id").notNull().references(() => outlets.id),
    pincode: text("pincode").notNull(),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    email: text("email"),
    area: text("area").notNull(),
    note: text("note"),
    contactedAt: timestamp("contacted_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("area_requests_outlet_created").on(t.outletId, t.createdAt), index("area_requests_pincode").on(t.pincode)],
).enableRLS();

/** "Let's find your perfect plan" enquiries from the home page. */
export const enquiries = pgTable(
  "enquiries",
  {
    id: id(),
    outletId: uuid("outlet_id").notNull().references(() => outlets.id),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    email: text("email").notNull(),
    location: text("location").notNull(),
    interest: text("interest").notNull(),
    message: text("message"),
    contactedAt: timestamp("contacted_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("enquiries_outlet_created").on(t.outletId, t.createdAt)],
).enableRLS();

/** Meal subscription plans, written by the owner in Admin › Subscriptions › Plans. */
export const subscriptionPlans = pgTable(
  "subscription_plans",
  {
    id: id(),
    outletId: uuid("outlet_id").notNull().references(() => outlets.id),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    tagline: text("tagline"),
    description: text("description"),
    mealsTotal: integer("meals_total").notNull(),
    durationDays: integer("duration_days").notNull(),
    deliveryDays: text("delivery_days").array().notNull().default(sql`'{}'::text[]`),
    includes: text("includes").array().notNull().default(sql`'{}'::text[]`),
    pricePaise: integer("price_paise").notNull(),
    isActive: boolean("is_active").notNull().default(false),
    sort: integer("sort").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("subscription_plans_outlet_slug").on(t.outletId, t.slug)],
).enableRLS();

/** One customer's subscription. Plan details are copied in, so editing a plan never changes what someone bought. */
export const subscriptions = pgTable(
  "subscriptions",
  {
    id: id(),
    outletId: uuid("outlet_id").notNull().references(() => outlets.id),
    planId: uuid("plan_id").notNull().references(() => subscriptionPlans.id),
    publicToken: text("public_token").notNull().unique(),
    planName: text("plan_name").notNull(),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    email: text("email"),
    address: text("address").notNull(),
    pincode: text("pincode"),
    startDate: date("start_date", { mode: "string" }).notNull(),
    endDate: date("end_date", { mode: "string" }),
    pausedOn: date("paused_on", { mode: "string" }),
    status: text("status").notNull().default("pending"),
    mealsTotal: integer("meals_total").notNull(),
    mealsUsed: integer("meals_used").notNull().default(0),
    durationDays: integer("duration_days").notNull(),
    deliveryDays: text("delivery_days").array().notNull().default(sql`'{}'::text[]`),
    pricePaise: integer("price_paise").notNull(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    paymentNote: text("payment_note"),
    notes: text("notes"),
    staffNotes: text("staff_notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("subscriptions_outlet_status").on(t.outletId, t.status), index("subscriptions_phone").on(t.phone)],
).enableRLS();

/** What happened on each delivery day of a subscription: one row per subscription per date. */
export const subscriptionDeliveries = pgTable(
  "subscription_deliveries",
  {
    id: id(),
    subscriptionId: uuid("subscription_id").notNull().references(() => subscriptions.id, { onDelete: "cascade" }),
    date: date("date", { mode: "string" }).notNull(),
    status: text("status").notNull(),
    note: text("note"),
    staffId: uuid("staff_id").references(() => staffUsers.id),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("subscription_deliveries_sub_date").on(t.subscriptionId, t.date)],
).enableRLS();

/** Discount codes, set up by the owner in Admin › Coupons. */
export const coupons = pgTable(
  "coupons",
  {
    id: id(),
    outletId: uuid("outlet_id").notNull().references(() => outlets.id),
    code: text("code").notNull(),
    description: text("description"),
    kind: text("kind").notNull(),
    value: integer("value").notNull(),
    minSubtotalPaise: integer("min_subtotal_paise").notNull().default(0),
    maxDiscountPaise: integer("max_discount_paise"),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    usageLimit: integer("usage_limit"),
    perCustomerLimit: integer("per_customer_limit").default(1),
    firstOrderOnly: boolean("first_order_only").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("coupons_outlet_code").on(t.outletId, t.code)],
).enableRLS();

export const couponRedemptions = pgTable(
  "coupon_redemptions",
  {
    id: id(),
    couponId: uuid("coupon_id").notNull().references(() => coupons.id),
    orderId: uuid("order_id").notNull().unique().references(() => orders.id),
    customerPhone: text("customer_phone").notNull(),
    discountPaise: integer("discount_paise").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("coupon_redemptions_coupon").on(t.couponId), index("coupon_redemptions_phone").on(t.customerPhone)],
).enableRLS();

/** Every change to a customer's points. The balance is the sum; one row per order and reason, so settling twice is harmless. */
export const loyaltyLedger = pgTable(
  "loyalty_ledger",
  {
    id: id(),
    customerId: uuid("customer_id").notNull().references(() => customers.id),
    orderId: uuid("order_id").references(() => orders.id),
    points: integer("points").notNull(),
    reason: text("reason").notNull(),
    note: text("note"),
    staffId: uuid("staff_id").references(() => staffUsers.id),
    createdAt: createdAt(),
  },
  (t) => [index("loyalty_ledger_customer").on(t.customerId), uniqueIndex("loyalty_ledger_order_reason").on(t.orderId, t.reason)],
).enableRLS();
