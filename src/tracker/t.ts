// FlitzWeb Studio tracker, modelled on Umami's (MIT). Built into public/t.js
// by `npm run build:tracker` (runs automatically before `npm run build`).
//
//   <script defer src="https://<dashboard>/t.js" data-site="SITE_KEY"></script>
//
// Optional attributes on the script tag (same idea as Umami's):
//   data-auto-track="false"   don't send pageviews or track clicks automatically
//   data-domains="a.nl,b.nl"  only track on these hostnames
//   data-tag="campagne-a"     tag all events (e.g. for A/B tests)
//   data-do-not-track="true"  respect the browser's Do Not Track setting
//
// In page code:
//   flitz("order_placed", { value: 24.5, meta: { type: "afhalen" } })
//   flitz.track("order_placed", { type: "afhalen" })      Umami-style
//   flitz.identify("klant-123", { plan: "pro" })
// window.umami.track / identify work too, so sites moving from Umami keep working.
//
// Click tracking without JavaScript:
//   <a href="tel:..." data-flitz-event="call_click" data-flitz-event-plek="header">Bel</a>
// (data-umami-event and data-umami-event-* are understood as well.)
//
// No cookies and no storage. Owner opt-out: localStorage.setItem("flitz-ignore", "1").

type Data = Record<string, unknown>;
type Options = { value?: number; meta?: Data };
type Flitz = ((name: string, opts?: Options) => void) & {
  q?: IArguments[];
  track?: (name?: string, data?: Data) => void;
  identify?: (id: string | Data, data?: Data) => void;
};
type W = Window & { flitz?: Flitz; umami?: unknown; doNotTrack?: string };

((w: W) => {
  const script = document.currentScript as HTMLScriptElement | null;
  const attr = (n: string) => script?.getAttribute(`data-${n}`);
  const website = attr("site");
  if (!script || !website) return;

  const endpoint = new URL(script.src).origin + "/api/collect";
  const screen = `${w.screen.width}x${w.screen.height}`;
  const tag = attr("tag") || undefined;
  const autoTrack = attr("auto-track") !== "false";
  const domains = (attr("domains") || "").split(",").map((d) => d.trim()).filter(Boolean);
  const dnt =
    attr("do-not-track") === "true" &&
    ["1", "yes"].includes(String(w.doNotTrack ?? navigator.doNotTrack));
  let currentUrl = location.href;
  let currentRef = document.referrer;
  let cache: string | undefined; // visit token, kept in memory only
  let identity: string | undefined;

  const disabled = () => {
    if (dnt || (domains.length && !domains.includes(location.hostname))) return true;
    try {
      return localStorage.getItem("flitz-ignore") === "1";
    } catch {
      return false;
    }
  };

  const send = (extra: Data = {}, type = "event") => {
    if (disabled()) return Promise.resolve();
    const payload = {
      url: currentUrl,
      referrer: currentRef,
      title: document.title,
      hostname: location.hostname,
      screen,
      language: navigator.language,
      tag,
      id: identity,
      ...extra,
    };
    // text/plain keeps this a "simple" request: no CORS preflight.
    return fetch(endpoint, {
      method: "POST",
      body: JSON.stringify({ type, website, payload, cache }),
      headers: { "Content-Type": "text/plain" },
      keepalive: true,
      credentials: "omit",
    })
      .then((r) => r.json())
      .then((d: { cache?: string }) => {
        if (d.cache) cache = d.cache;
      })
      .catch(() => {});
  };

  // flitz(name, { value, meta })
  const flitz: Flitz = (name, opts = {}) => {
    send({ name, value: opts.value, data: opts.meta });
  };
  // Umami-style: track() = pageview, track(name, data); data.value or
  // data.revenue (a number) also counts for "sum" trackers.
  const track = (name?: string, data?: Data) => {
    if (!name) return send();
    const v = data?.value ?? data?.revenue;
    return send({ name, data, value: typeof v === "number" ? v : undefined });
  };
  const identify = (id: string | Data, data?: Data) => {
    if (typeof id === "string") identity = id;
    else if (typeof id.id === "string") identity = id.id;
    cache = undefined; // a new identity means a new session
    return send({ data: typeof id === "object" ? id : data }, "identify");
  };
  flitz.track = track;
  flitz.identify = identify;

  // Clicks on elements with data-flitz-event / data-umami-event.
  const onClick = (e: MouseEvent) => {
    const el = (e.target as Element | null)?.closest?.("[data-flitz-event],[data-umami-event]");
    if (!el) return;
    const prefix = el.hasAttribute("data-flitz-event") ? "data-flitz-event" : "data-umami-event";
    const data: Data = {};
    for (const n of el.getAttributeNames()) {
      if (n.startsWith(`${prefix}-`)) data[n.slice(prefix.length + 1)] = el.getAttribute(n);
    }
    const sent = track(el.getAttribute(prefix)!, data);
    // Same-tab links: wait for the event to be sent, then follow the link.
    const a = el as HTMLAnchorElement;
    if (a.tagName === "A" && a.href && a.target !== "_blank" && !e.ctrlKey && !e.metaKey && !e.shiftKey && e.button === 0) {
      e.preventDefault();
      const go = () => (location.href = a.href);
      Promise.race([sent, new Promise((r) => setTimeout(r, 500))]).then(go, go);
    }
  };

  // Client-side navigation (pushState / replaceState), like Umami.
  const onNavigate = (url?: string | URL | null) => {
    if (!url) return;
    const next = new URL(url, location.href).href;
    if (next === currentUrl) return;
    currentRef = currentUrl;
    currentUrl = next;
    if (autoTrack) setTimeout(() => send(), 300);
  };
  for (const method of ["pushState", "replaceState"] as const) {
    const original = history[method];
    history[method] = function (this: History, ...args: Parameters<History["pushState"]>) {
      original.apply(this, args);
      onNavigate(args[2]);
    };
  }

  // Replay calls made before this script loaded (see the queue stub in the docs).
  const queued = w.flitz?.q ?? [];
  w.flitz = flitz;
  if (!w.umami) w.umami = { track, identify };
  for (const args of queued) flitz(...(Array.from(args) as [string, Options?]));

  const distinctId = attr("distinct-id");
  if (distinctId) identify(distinctId);
  if (autoTrack) {
    send();
    document.addEventListener("click", onClick, true);
  }
})(window);
