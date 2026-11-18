import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { db, sites } from "@/db";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";
import { getSiteIcon } from "@/lib/siteIcon";

// A site's own favicon/logo, fetched from the site and proxied. Login required.
// "No icon found" is answered with a 1×1 transparent GIF; SiteLogo sees the
// 1px image and shows the first letter instead. Not a 404 (that fills the
// browser console) and not a 204 (Chrome then fires neither load nor error on
// the <img>, so the letter never took over and the logo stayed an empty box).
const EMPTY_GIF = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

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
    // Short cache: a site that is still being built gets its icon soon after it goes up.
    return new Response(EMPTY_GIF, {
      headers: { "Content-Type": "image/gif", "Cache-Control": "private, max-age=600" },
    });
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
