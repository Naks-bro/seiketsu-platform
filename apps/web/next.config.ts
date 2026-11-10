import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

// One .env at the repo root serves the app and the database scripts locally.
// On Vercel there is no file; variables come from the project settings.
const rootEnv = fileURLToPath(new URL("../../.env", import.meta.url));
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

/**
 * Content-Security-Policy. Scripts/frames are limited to our own origin plus
 * the two third parties the site needs: Razorpay Checkout and the MSG91 OTP
 * widget (and the captcha it may load). Inline scripts are needed by Next.js.
 */
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://checkout.razorpay.com https://*.razorpay.com https://verify.msg91.com https://*.msg91.com https://*.hostnsoft.com https://www.google.com https://www.gstatic.com https://*.hcaptcha.com https://hcaptcha.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://*.msg91.com https://*.hostnsoft.com",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https://fonts.gstatic.com",
  "connect-src 'self' https://*.razorpay.com https://*.msg91.com https://*.hostnsoft.com https://*.supabase.co wss://*.supabase.co https://*.hcaptcha.com",
  "frame-src https://api.razorpay.com https://checkout.razorpay.com https://*.razorpay.com https://*.msg91.com https://*.hostnsoft.com https://www.google.com https://*.hcaptcha.com",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: process.env.NODE_ENV === "production" ? csp : csp.replace("script-src 'self'", "script-src 'self' 'unsafe-eval'") },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self \"https://checkout.razorpay.com\" \"https://api.razorpay.com\")" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  // A second local preview can build into its own folder (NEXT_DIST_DIR=.next-full) so two dev servers can run side by side.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  reactCompiler: true,
  transpilePackages: ["@seiketsu/core", "@seiketsu/db"],
  serverExternalPackages: ["@electric-sql/pglite", "razorpay", "postgres"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;