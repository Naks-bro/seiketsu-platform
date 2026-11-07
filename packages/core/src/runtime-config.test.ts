import { describe, expect, it } from "vitest";
import { productionConfigErrors } from "./runtime-config";

const valid = {
  DATABASE_URL: "postgresql://server:password@db.example.com:6543/postgres",
  SESSION_SECRET: "random-session-secret-for-tests-1234567890",
  CRON_SECRET: "random-cron-secret-for-tests-1234567890123",
  NEXT_PUBLIC_SITE_URL: "https://orders.example.com",
};
describe("production configuration", () => {
  it("accepts a server-only database with optional integrations disabled", () => {
    expect(productionConfigErrors(valid)).toEqual([]);
  });
  it("rejects local persistence, test logins, simulators, weak secrets and incomplete payment keys", () => {
    const errors = productionConfigErrors({ ...valid, DATABASE_URL: "pglite:./data", SESSION_SECRET: "short", CRON_SECRET: "short", TEST_LOGINS: "9000000000:123456", PAYMENTS_MODE: "simulator", RAZORPAY_KEY_ID: "rzp_test_x", NEXT_PUBLIC_SITE_URL: "http://localhost:3000" });
    expect(errors).toHaveLength(8);
    expect(errors.join(" ")).not.toContain("123456");
  });
  it("requires complete Realtime credentials and an HTTPS origin", () => {
    expect(productionConfigErrors({ ...valid, NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co" })).toHaveLength(2);
    expect(productionConfigErrors({ ...valid, NEXT_PUBLIC_SITE_URL: "https://example.com/subpath" })).toHaveLength(1);
  });
});
