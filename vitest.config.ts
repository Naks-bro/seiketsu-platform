import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@/": r("./apps/web/src/"),
      // Next.js enforces this at build time; in tests it is a no-op.
      "server-only": r("./apps/web/test/empty.ts"),
    },
  },
  test: {
    include: ["packages/**/src/**/*.test.ts", "apps/web/src/**/*.test.ts"],
    environment: "node",
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});