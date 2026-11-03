import type { Metadata, Viewport } from "next";
import { Figtree, Fraunces } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"], axes: ["opsz", "SOFT"] });
const figtree = Figtree({ variable: "--font-figtree", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: { default: "Seiketsu, Versova | The art of clean eating", template: "%s | Seiketsu" },
  description:
    "Seiketsu is a premium nutrition fresh house in Versova, Andheri West. Fresh salads, wraps, bowls, cold-pressed juices and smoothies, with nutrition for every dish. Order online for delivery or pickup.",
  openGraph: { siteName: "Seiketsu", locale: "en_IN", type: "website" },
};

export const viewport: Viewport = { themeColor: "#a51c47" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className={`${fraunces.variable} ${figtree.variable} antialiased`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}