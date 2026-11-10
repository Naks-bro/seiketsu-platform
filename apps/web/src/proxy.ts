import { NextResponse, type NextRequest } from "next/server";
import { LANDING_ONLY, isOrderingPath } from "@/lib/site-mode";

/** In landing-only mode, ordering pages send visitors back to the landing page. */
export function proxy(req: NextRequest) {
  if (LANDING_ONLY && isOrderingPath(req.nextUrl.pathname)) return NextResponse.redirect(new URL("/", req.url));
  return NextResponse.next();
}

export const config = {
  matcher: ["/menu/:path*", "/checkout/:path*", "/account/:path*", "/subscribe/:path*", "/subscription/:path*", "/support/:path*", "/order/:path*", "/coming-soon/:path*"],
};
