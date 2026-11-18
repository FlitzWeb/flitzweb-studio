import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

// Optimistic login check: bounce logged-out visitors to /login before any
// page renders. It cannot see the database, so it does not know about
// "Overal uitloggen"; every page, server action and API route still checks
// the session itself (requireSession / sessionEmail in lib/auth.ts).
export async function proxy(request: NextRequest) {
  const email = await verifySessionToken(
    request.cookies.get(SESSION_COOKIE)?.value,
  );
  if (email && email === process.env.ADMIN_EMAIL?.trim().toLowerCase()) {
    return NextResponse.next();
  }
  // An API call gets a plain 401, not the login page (a fetch would follow the redirect
  // and get HTML back where it expects data or an image).
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  // Everything except public routes: login, cron/ingest/collect APIs (they have their
  // own secrets), the tracking script, static files and brand assets. Each name is
  // anchored (a whole path segment), so "/login-anything" or "/t.jsx" are not public.
  matcher: [
    "/((?!(?:login|auth/verify|api/cron/check|api/ingest|api/collect|t\\.js|icon\\.svg|favicon\\.ico)$|_next/|brand/).*)",
  ],
};
