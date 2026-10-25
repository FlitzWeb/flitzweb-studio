import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

// Optimistic login check: bounce logged-out visitors to /login before any
// page renders. Pages and actions still call requireSession() themselves.
export async function proxy(request: NextRequest) {
  const email = await verifySessionToken(
    request.cookies.get(SESSION_COOKIE)?.value,
  );
  if (email && email === process.env.ADMIN_EMAIL?.trim().toLowerCase()) {
    return NextResponse.next();
  }
  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  // Everything except public routes: login, cron/ingest/collect APIs (they have their
  // own secrets), the tracking script, static files and brand assets.
  matcher: [
    "/((?!login|auth/|api/cron|api/ingest|api/collect|t\\.js|_next/|brand/|favicon|icon|apple-icon).*)",
  ],
};
