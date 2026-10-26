import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { db, sites } from "@/db";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";
import { getSiteIcon } from "@/lib/siteIcon";

// A site's own favicon/logo, fetched from the site and proxied. Login required.
// 404 means "no icon found"; the UI then shows the first letter instead.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const email = await verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!email || email !== process.env.ADMIN_EMAIL?.trim().toLowerCase()) {
    return new Response(null, { status: 401 });
  }
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return new Response(null, { status: 404 });

  const [site] = await db.select({ url: sites.url }).from(sites).where(eq(sites.id, id));
  const icon = site && (await getSiteIcon(site.url));
  if (!icon) {
    return new Response(null, { status: 404, headers: { "Cache-Control": "private, max-age=3600" } });
  }

  return new Response(icon.body, {
    headers: {
      "Content-Type": icon.type,
      "Cache-Control": "private, max-age=86400",
      "X-Content-Type-Options": "nosniff",
      // Icons come from other sites: an SVG opened directly must not run scripts here.
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
