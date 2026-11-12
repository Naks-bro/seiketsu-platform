import type { MetadataRoute } from "next";
import { SITE_DESCRIPTION } from "@/lib/seo";

/** Name, colours and icons when the site is saved to a phone's home screen. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Seiketsu",
    short_name: "Seiketsu",
    description: SITE_DESCRIPTION,
    start_url: "/",
    display: "standalone",
    background_color: "#fffcf5",
    theme_color: "#a51c47",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
