import type { Metadata, Viewport } from "next";
import { Figtree, Fraunces } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"], axes: ["opsz", "SOFT"] });
const figtree = Figtree({ variable: "--font-figtree", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: { default: "Seiketsu | The art of clean eating", template: "%s | Seiketsu" },
  description:
    "Good food, thoughtful ingredients, feel-good living. Discover a fresh selection of salads, wraps, nourishing bowls, fresh-pressed juices and smoothies, crafted to bring together great taste and everyday nutrition.",
  openGraph: { siteName: "Seiketsu", locale: "en_IN", type: "website", images: [{ url: "/landing/hero-poster.webp", alt: "Seiketsu" }] },
  twitter: { card: "summary_large_image" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = { themeColor: "#a51c47" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" data-scroll-behavior="smooth" className={`${fraunces.variable} ${figtree.variable} antialiased`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}