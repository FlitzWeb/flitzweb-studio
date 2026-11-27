import type { NextRequest } from "next/server";
import { readFrameToken } from "@/features/editor/frameToken";
import { frameCopy, mapEditable, rewriteCss } from "@/features/editor/html";
import { editorSite } from "@/features/editor/sites";
import { readRepoFile } from "@/lib/github";

// Serves a client site's files, straight from GitHub at one commit, to the Aanpassen tab's frame.
// Pages get the editor markers and script (features/editor/html.ts); everything else is passed
// through. Not behind the login (src/proxy.ts skips /edit-frame/): the sandboxed frame sends no
// cookie, so the signed token in the URL is the check.

const TYPES: Record<string, string> = {
  html: "text/html; charset=utf-8",
  css: "text/css; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  mjs: "text/javascript; charset=utf-8",
  json: "application/json; charset=utf-8",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  ico: "image/x-icon",
  woff2: "font/woff2",
  woff: "font/woff",
  ttf: "font/ttf",
  otf: "font/otf",
  mp4: "video/mp4",
  webm: "video/webm",
  webmanifest: "application/manifest+json",
  txt: "text/plain; charset=utf-8",
  xml: "application/xml; charset=utf-8",
  pdf: "application/pdf",
};

// The frame has an opaque origin (sandbox), so fonts and module scripts need CORS to load.
const common = { "Access-Control-Allow-Origin": "*", "X-Robots-Tag": "noindex", "X-Content-Type-Options": "nosniff" };

const notFound = (text = "Niet gevonden") => new Response(text, { status: 404, headers: { ...common, "Content-Type": "text/plain; charset=utf-8" } });

export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string; path: string[] }> }) {
  const { token, path } = await params;
  const claim = await readFrameToken(token);
  if (!claim) return new Response("Deze link is verlopen. Herlaad de pagina in de Studio.", { status: 403, headers: { ...common, "Content-Type": "text/plain; charset=utf-8" } });

  if (path.some((p) => p === "" || p === "." || p === ".." || p.includes("\\") || p.includes("\0"))) return notFound();
  let file = path.join("/");
  const last = path[path.length - 1];
  if (!last.includes(".") || request.nextUrl.pathname.endsWith("/")) file = `${file}/index.html`;
  const ext = file.slice(file.lastIndexOf(".") + 1).toLowerCase();

  const found = await readRepoFile(claim.repo, claim.sha, file);
  if (!found.ok) return notFound();
  const base = `/edit-frame/${token}`;

  if (ext === "html") {
    const source = new TextDecoder().decode(found.bytes);
    const blocks = mapEditable(source);
    const html = frameCopy(source, blocks, {
      base,
      scriptUrl: "/edit-frame.js",
      origin: request.nextUrl.origin,
      hide: editorSite(claim.repo).hide,
      lock: editorSite(claim.repo).lock,
    });
    return new Response(html, {
      headers: {
        ...common,
        "Content-Type": TYPES.html,
        "Cache-Control": "private, no-store",
        // Only the Studio itself may show this page in a frame.
        "Content-Security-Policy": "frame-ancestors 'self'",
      },
    });
  }

  const body = ext === "css" ? rewriteCss(new TextDecoder().decode(found.bytes), base) : found.bytes;
  return new Response(body, {
    headers: {
      ...common,
      "Content-Type": TYPES[ext] ?? "application/octet-stream",
      // The URL holds the commit, so a file at it never changes.
      "Cache-Control": "private, max-age=86400, immutable",
    },
  });
}
